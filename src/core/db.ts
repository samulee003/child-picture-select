import Database from 'better-sqlite3';
import { join } from 'path';
import { app } from 'electron';
import { existsSync, mkdirSync } from 'fs';
import { logger } from '../utils/logger';
import { validatePath } from '../utils/path-validator';

type BetterSqlite3Database = InstanceType<typeof Database>;
type BetterSqlite3Statement = ReturnType<BetterSqlite3Database['prepare']>;

type PhotoRow = { id: number; path: string; mtime: number; thumbPath: string | null };
type FaceRow = { id: number; photoPath: string; embedding: string; source: string };
type FaceResult = { embedding: number[]; source: 'face' | 'deterministic' | 'unknown' };

let db: BetterSqlite3Database | null = null;

export function getUserDataDir(): string {
  const dir = app.getPath('userData');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

export function getThumbsDir(): string {
  const dir = join(getUserDataDir(), 'thumbs');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

export function getDb(): BetterSqlite3Database {
  if (db) return db;
  const dbPath = join(getUserDataDir(), 'cache.sqlite');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  const CURRENT_CACHE_VERSION = 3;
  const user_version = db.pragma('user_version', { simple: true }) as number;
  if (user_version !== CURRENT_CACHE_VERSION) {
    logger.info(
      `Upgrading cache database from v${user_version} to v${CURRENT_CACHE_VERSION}, clearing old data...`
    );
    db.exec(`
      DROP TABLE IF EXISTS photos;
      DROP TABLE IF EXISTS faces;
    `);
    db.pragma(`user_version = ${CURRENT_CACHE_VERSION}`);
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS photos (
      id INTEGER PRIMARY KEY,
      path TEXT UNIQUE NOT NULL,
      mtime INTEGER,
      thumbPath TEXT
    );
    CREATE TABLE IF NOT EXISTS faces (
      id INTEGER PRIMARY KEY,
      photoPath TEXT NOT NULL,
      embedding TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'unknown',
      UNIQUE(photoPath)
    );
    CREATE INDEX IF NOT EXISTS idx_faces_photo ON faces(photoPath);
  `);

  const hasSourceColumn = db
    .prepare(`SELECT COUNT(1) AS count FROM pragma_table_info('faces') WHERE name = 'source'`)
    .get() as { count: number } | undefined;
  if (hasSourceColumn && !hasSourceColumn.count) {
    db.exec(`ALTER TABLE faces ADD COLUMN source TEXT NOT NULL DEFAULT 'unknown'`);
  }
  return db;
}

export function upsertPhoto(filePath: string, mtime: number, thumbPath: string | null): void {
  const validation = validatePath(filePath);
  if (!validation.valid) {
    logger.warn(`Invalid path in upsertPhoto: ${validation.error}`);
    return;
  }

  const safePath = validation.normalizedPath || filePath;
  const d = getDb();
  const stmt = d.prepare(
    `INSERT INTO photos(path, mtime, thumbPath) VALUES(?, ?, ?)
     ON CONFLICT(path) DO UPDATE SET mtime=excluded.mtime, thumbPath=excluded.thumbPath`
  ) as BetterSqlite3Statement;
  stmt.run(safePath, mtime, thumbPath);
}

export function getPhoto(filePath: string): PhotoRow | undefined {
  const validation = validatePath(filePath);
  if (!validation.valid) {
    return undefined;
  }

  const safePath = validation.normalizedPath || filePath;
  const d = getDb();
  const stmt = d.prepare(
    'SELECT id, path, mtime, thumbPath FROM photos WHERE path = ?'
  ) as BetterSqlite3Statement;
  return stmt.get(safePath) as PhotoRow | undefined;
}

export function upsertFace(
  filePath: string,
  embedding: number[],
  source: 'face' | 'deterministic' | 'unknown' = 'unknown'
): void {
  const validation = validatePath(filePath);
  if (!validation.valid) {
    logger.warn(`Invalid path in upsertFace: ${validation.error}`);
    return;
  }

  if (!Array.isArray(embedding) || !embedding.every(v => typeof v === 'number')) {
    logger.warn('Invalid embedding in upsertFace: must be array of numbers');
    return;
  }

  const safePath = validation.normalizedPath || filePath;
  const d = getDb();
  const stmt = d.prepare(
    `INSERT INTO faces(photoPath, embedding, source) VALUES(?, ?, ?)
     ON CONFLICT(photoPath) DO UPDATE SET embedding=excluded.embedding, source=excluded.source`
  ) as BetterSqlite3Statement;
  stmt.run(safePath, JSON.stringify(embedding), source);
}

export function getFacesByPath(filePath: string): FaceResult[] {
  const validation = validatePath(filePath);
  if (!validation.valid) {
    return [];
  }

  const safePath = validation.normalizedPath || filePath;
  const d = getDb();
  const stmt = d.prepare(
    'SELECT embedding, source FROM faces WHERE photoPath = ?'
  ) as BetterSqlite3Statement;
  const rows = stmt.all(safePath) as FaceRow[];

  return rows.flatMap((r: FaceRow): FaceResult[] => {
    try {
      const parsed: unknown = JSON.parse(r.embedding);
      if (!Array.isArray(parsed) || !parsed.every((v: unknown) => typeof v === 'number')) {
        logger.warn(`Invalid embedding payload in DB for ${safePath}, skipping row`);
        return [];
      }
      const faceSource: 'face' | 'deterministic' | 'unknown' =
        r.source === 'face' || r.source === 'deterministic' ? r.source : 'unknown';
      return [{ embedding: parsed, source: faceSource }];
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.warn(`Failed to parse embedding JSON for ${safePath}, skipping row: ${errorMessage}`);
      return [];
    }
  });
}

export function closeDb(): void {
  if (!db) return;
  try {
    db.close();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.warn(`Failed to close SQLite database: ${errorMessage}`);
  } finally {
    db = null;
  }
}

/**
 * 在資料庫事務中執行多個操作
 * 使用 better-sqlite3 內建 transaction API（自動 commit/rollback）
 */
export function withTransaction<T>(fn: () => T): T {
  const d = getDb();
  const txn = d.transaction(fn);
  return txn();
}

/**
 * 原子性更新照片和臉部資料
 * 確保照片記錄和臉部 embedding 同時寫入
 */
export function upsertPhotoAndFace(
  filePath: string,
  mtime: number,
  thumbPath: string | null,
  embedding: number[],
  source: 'face' | 'deterministic' | 'unknown'
): void {
  return withTransaction(() => {
    upsertPhoto(filePath, mtime, thumbPath);
    upsertFace(filePath, embedding, source);
  });
}
