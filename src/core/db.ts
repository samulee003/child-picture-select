import Database from 'better-sqlite3';
import { join } from 'path';
import { app } from 'electron';
import { existsSync } from 'fs';
import { mkdirSync } from 'fs';

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
      UNIQUE(photoPath)
    );
    CREATE INDEX IF NOT EXISTS idx_faces_photo ON faces(photoPath);
  `);
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

export function upsertFace(path: string, embedding: number[]) {
  const d = getDb();
  const stmt = d.prepare(
    `INSERT INTO faces(photoPath, embedding) VALUES(?, ?)
     ON CONFLICT(photoPath) DO UPDATE SET embedding=excluded.embedding`
  );
  stmt.run(path, JSON.stringify(embedding));
}

export function getFacesByPath(path: string): number[][] {
  const d = getDb();
  const rows = d.prepare('SELECT embedding FROM faces WHERE photoPath = ?').all(path) as Array<{ embedding: string }>;
  return rows.map(r => JSON.parse(r.embedding));
}


