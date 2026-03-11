import { app, BrowserWindow, ipcMain } from 'electron';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { readdir, stat, mkdir, copyFile } from 'fs/promises';
import { existsSync } from 'fs';
import { fileToDeterministicEmbedding, Embedding } from '../src/core/embeddings';
import { cosineSimilarity } from '../src/core/similarity';

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '..');

let mainWindow: BrowserWindow | null = null;
const referenceEmbeddings: Embedding[] = [];
const photoEmbeddings = new Map<string, Embedding>();

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      preload: join(__dirname, 'preload.cjs')
    }
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    await mainWindow.loadURL(devServerUrl);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    await mainWindow.loadFile(join(process.cwd(), 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.whenReady().then(createWindow);

// Minimal IPC placeholders for later wiring
ipcMain.handle('ping', async () => 'pong');

// Very minimal placeholder implementations; real logic will be wired in next tasks
ipcMain.handle('scan:folder', async (_e, dir: string) => {
  return { ok: true, dir };
});

ipcMain.handle('embed:references', async (_e, files: string[]) => {
  try {
    referenceEmbeddings.length = 0;
    for (const f of files) {
      const emb = await fileToDeterministicEmbedding(f);
      referenceEmbeddings.push(emb);
    }
    return { ok: true, count: referenceEmbeddings.length };
  } catch (err: any) {
    return { ok: false, error: String(err?.message ?? err) };
  }
});

async function listImagesRecursively(root: string, acc: string[] = []): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(root, entry.name);
    if (entry.isDirectory()) {
      await listImagesRecursively(full, acc);
    } else {
      const lower = entry.name.toLowerCase();
      if (lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png')) {
        acc.push(full);
      }
    }
  }
  return acc;
}

ipcMain.handle('embed:batch', async (_e, dir: string) => {
  try {
    const files = await listImagesRecursively(dir);
    let scanned = 0;
    for (const f of files) {
      if (!photoEmbeddings.has(f)) {
        const emb = await fileToDeterministicEmbedding(f);
        photoEmbeddings.set(f, emb);
      }
      scanned += 1;
    }
    return { ok: true, scanned };
  } catch (err: any) {
    return { ok: false, error: String(err?.message ?? err) };
  }
});

ipcMain.handle('match:run', async (_e, opts: { topN: number; threshold: number }) => {
  const results: Array<{ path: string; score: number }> = [];
  if (referenceEmbeddings.length === 0) return results;
  for (const [path, emb] of photoEmbeddings.entries()) {
    let best = -1;
    for (const ref of referenceEmbeddings) {
      const s = cosineSimilarity(emb, ref);
      if (s > best) best = s;
    }
    if (best >= (opts?.threshold ?? 0)) {
      results.push({ path, score: best });
    }
  }
  results.sort((a, b) => b.score - a.score);
  const topN = Math.max(1, Math.min(1000, opts?.topN ?? 100));
  return results.slice(0, topN);
});

ipcMain.handle('export:copy', async (_e, payload: { files: string[]; outDir: string }) => {
  try {
    const { files, outDir } = payload;
    if (!existsSync(outDir)) {
      await mkdir(outDir, { recursive: true });
    }
    let copied = 0;
    for (const src of files) {
      const base = src.split(/[/\\]/).pop() || 'image.jpg';
      const dest = join(outDir, base);
      await copyFile(src, dest);
      copied += 1;
    }
    return { ok: true, copied };
  } catch (err: any) {
    return { ok: false, error: String(err?.message ?? err) };
  }
});


