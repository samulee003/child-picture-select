import Database from 'better-sqlite3';
import { join } from 'path';
import { app } from 'electron';
import { existsSync } from 'fs';
import { mkdirSync } from 'fs';
import { logger } from '../utils/logger';

let db: any | null = null;

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

export function getDb(): any {
  if (db) return db;
  const dbPath = join(getUserDataDir(), 'cache.sqlite');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  const CURRENT_CACHE_VERSION = 2;
  const user_version = db.pragma('user_version', { simple: true }) as number;
  if (user_version !== CURRENT_CACHE_VERSION) {
    logger.info(`Upgrading cache database from v${user_version} to v${CURRENT_CACHE_VERSION}, clearing old data...`);
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
    .get() as { count: number };
  if (!hasSourceColumn.count) {
    db.exec(`ALTER TABLE faces ADD COLUMN source TEXT NOT NULL DEFAULT 'unknown'`);
  }
  return db;
}

export function upsertPhoto(path: string, mtime: number, thumbPath: string | null) {
  const d = getDb();
  const stmt = d.prepare(
    `INSERT INTO photos(path, mtime, thumbPath) VALUES(?, ?, ?)
     ON CONFLICT(path) DO UPDATE SET mtime=excluded.mtime, thumbPath=excluded.thumbPath`
  );
  stmt.run(path, mtime, thumbPath);
}

export function getPhoto(path: string): { id: number; path: string; mtime: number; thumbPath: string | null } | undefined {
  const d = getDb();
  const row = d.prepare('SELECT id, path, mtime, thumbPath FROM photos WHERE path = ?').get(path);
  return row as any;
}

export function upsertFace(path: string, embedding: number[], source: 'face' | 'deterministic' | 'unknown' = 'unknown') {
  const d = getDb();
  const stmt = d.prepare(
    `INSERT INTO faces(photoPath, embedding, source) VALUES(?, ?, ?)
     ON CONFLICT(photoPath) DO UPDATE SET embedding=excluded.embedding, source=excluded.source`
  );
  stmt.run(path, JSON.stringify(embedding), source);
}

export function getFacesByPath(path: string): Array<{ embedding: number[]; source: 'face' | 'deterministic' | 'unknown' }> {
  const d = getDb();
  const rows = d.prepare('SELECT embedding, source FROM faces WHERE photoPath = ?').all(path) as Array<{ embedding: string; source?: string }>;
  return rows.flatMap((r) => {
    try {
      const parsed = JSON.parse(r.embedding);
      if (!Array.isArray(parsed) || !parsed.every(v => typeof v === 'number')) {
        logger.warn(`Invalid embedding payload in DB for ${path}, skipping row`);
        return [];
      }
      const source: 'face' | 'deterministic' | 'unknown' =
        r.source === 'face' || r.source === 'deterministic' ? r.source : 'unknown';
      return [{ embedding: parsed, source }];
    } catch (error) {
      logger.warn(`Failed to parse embedding JSON for ${path}, skipping row: ${(error as Error)?.message || error}`);
      return [];
    }
  });
}

export function closeDb(): void {
  if (!db) return;
  try {
    db.close();
  } catch (error) {
    logger.warn(`Failed to close SQLite database: ${(error as Error)?.message || error}`);
  } finally {
    db = null;
  }
}

