import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const tempDirs: string[] = [];
let legacySchemaMode = false;

async function loadDbModule(userDataPath: string) {
  vi.resetModules();
  vi.doMock('better-sqlite3', () => {
    type FaceRow = { embedding: string; source: string };
    type DbState = { faces: Map<string, FaceRow>; hasSourceColumn: boolean };
    const dbStates = new Map<string, DbState>();

    class FakeDatabase {
      private state: DbState;

      constructor(dbPath: string) {
        const existing = dbStates.get(dbPath);
        if (existing) {
          this.state = existing;
        } else {
          this.state = {
            faces: new Map<string, FaceRow>(),
            hasSourceColumn: !legacySchemaMode,
          };
          dbStates.set(dbPath, this.state);
        }
      }

      pragma() {}

      exec(sql: string) {
        if (sql.includes('ALTER TABLE faces ADD COLUMN source')) {
          this.state.hasSourceColumn = true;
        }
        if (sql.includes('DELETE FROM faces')) {
          this.state.faces.clear();
        }
      }

      prepare(query: string) {
        return {
          get: (...args: any[]) => {
            if (query.includes("SELECT COUNT(1) AS count FROM pragma_table_info('faces') WHERE name = 'source'")) {
              return { count: this.state.hasSourceColumn ? 1 : 0 };
            }
            if (query.includes('SELECT id, path, mtime, thumbPath FROM photos WHERE path = ?')) {
              return undefined;
            }
            if (query.includes('SELECT embedding, source FROM faces WHERE photoPath = ?')) {
              const path = args[0] as string;
              const row = this.state.faces.get(path);
              return row ? { embedding: row.embedding, source: row.source } : undefined;
            }
            return undefined;
          },
          all: (...args: any[]) => {
            if (query.includes("SELECT name FROM pragma_table_info('faces')")) {
              const columns = ['id', 'photoPath', 'embedding'];
              if (this.state.hasSourceColumn) columns.push('source');
              return columns.map((name) => ({ name }));
            }
            if (query.includes('SELECT embedding, source FROM faces WHERE photoPath = ?')) {
              const path = args[0] as string;
              const row = this.state.faces.get(path);
              return row ? [{ embedding: row.embedding, source: row.source }] : [];
            }
            return [];
          },
          run: (...args: any[]) => {
            if (query.includes('INSERT INTO faces(photoPath, embedding, source)')) {
              const [path, embedding, source] = args as [string, string, string];
              this.state.faces.set(path, { embedding, source });
            }
            return { changes: 1 };
          },
        };
      }

      close() {}
    }

    return { default: FakeDatabase };
  });
  vi.doMock('electron', () => ({
    app: {
      getPath: () => userDataPath,
    },
  }));
  return import('../../../src/core/db');
}

afterEach(async () => {
  legacySchemaMode = false;
  vi.doUnmock('electron');
  vi.doUnmock('better-sqlite3');
  vi.resetModules();
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (!dir) continue;
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('db embedding source persistence', () => {
  it('stores and restores face source with embedding', async () => {
    const userDataPath = mkdtempSync(join(tmpdir(), 'ai-child-db-'));
    tempDirs.push(userDataPath);
    const dbModule = await loadDbModule(userDataPath);

    dbModule.upsertFace('C:/a.jpg', [0.1, 0.2, 0.3], 'face');
    dbModule.upsertFace('C:/b.jpg', [0.4, 0.5, 0.6], 'deterministic');

    const a = dbModule.getFacesByPath('C:/a.jpg');
    const b = dbModule.getFacesByPath('C:/b.jpg');

    expect(a[0]?.source).toBe('face');
    expect(b[0]?.source).toBe('deterministic');
    expect(a[0]?.embedding).toEqual([0.1, 0.2, 0.3]);
    expect(b[0]?.embedding).toEqual([0.4, 0.5, 0.6]);

    dbModule.closeDb();
  });

  it('migrates legacy faces table by adding source column', async () => {
    const userDataPath = mkdtempSync(join(tmpdir(), 'ai-child-db-'));
    tempDirs.push(userDataPath);
    legacySchemaMode = true;

    const dbModule = await loadDbModule(userDataPath);
    const d = dbModule.getDb();
    const columns = d.prepare(`SELECT name FROM pragma_table_info('faces')`).all() as Array<{ name: string }>;
    expect(columns.map((c) => c.name)).toContain('source');
    dbModule.closeDb();
  });
});

