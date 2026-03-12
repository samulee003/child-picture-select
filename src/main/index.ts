import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron';
import { join } from 'path';
import { existsSync } from 'fs';
import { mkdir, readdir, copyFile } from 'fs/promises';
import { fileToEmbeddingWithSource, Embedding, type FaceAnalysis } from '../core/embeddings';
import { cosineSimilarity } from '../core/similarity';
import { getPhoto, upsertPhoto, upsertFace, getFacesByPath, getDb, closeDb } from '../core/db';
import { ensureThumbnailFor } from '../core/thumbs';
import { stat as fsStat } from 'fs/promises';
import { logger } from '../utils/logger';
import { createErrorInfo } from '../utils/error-handler';
import { performanceManager } from '../core/performance';
import { photoEnhancer } from '../core/photoEnhancer';
import { ChildQualityAssessor } from '../core/childQualityAssessment';
import { growthRecordManager } from './growthRecordManager';
import { getModelStatus } from '../core/detector';
import { autoUpdater } from 'electron-updater';

let mainWindow: BrowserWindow | null = null;
const referenceEmbeddings: Embedding[] = [];

// LRU cache for photo embeddings with max size to prevent memory leaks
const MAX_EMBEDDING_CACHE_SIZE = 50000; // ~200MB for 1024-dim float64
const photoEmbeddings = new Map<string, Embedding>();

// Scan control state
let scanCancelled = false;
let scanPaused = false;
let scanInProgress = false;
let currentScanSessionId = 0;
let resolveScanPause: { sessionId: number; resolve: () => void } | null = null;

function evictOldestEmbeddings(count: number) {
  const keys = photoEmbeddings.keys();
  for (let i = 0; i < count; i++) {
    const next = keys.next();
    if (next.done) break;
    photoEmbeddings.delete(next.value);
  }
}

function setPhotoEmbedding(path: string, embedding: Embedding) {
  if (photoEmbeddings.has(path)) {
    photoEmbeddings.delete(path);
  }
  photoEmbeddings.set(path, embedding);
  const overflow = photoEmbeddings.size - MAX_EMBEDDING_CACHE_SIZE;
  if (overflow > 0) {
    evictOldestEmbeddings(overflow);
  }
}

function wakePausedScan(sessionId: number) {
  if (resolveScanPause && resolveScanPause.sessionId === sessionId) {
    const { resolve } = resolveScanPause;
    resolveScanPause = null;
    resolve();
  }
}

function waitForScanResumeOrCancel(sessionId: number): Promise<void> {
  if (sessionId !== currentScanSessionId || !scanPaused || scanCancelled) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    resolveScanPause = { sessionId, resolve };
  });
}

function cosineSimilarityWithDimensionHandling(embedding: Embedding, reference: Embedding): { score: number; dimensionAdjusted: boolean } {
  if (embedding.length === reference.length) {
    return { score: cosineSimilarity(embedding, reference), dimensionAdjusted: false };
  }

  const minDim = Math.min(embedding.length, reference.length);
  if (minDim === 0) {
    return { score: -1, dimensionAdjusted: true };
  }

  return {
    score: cosineSimilarity(embedding.slice(0, minDim), reference.slice(0, minDim)),
    dimensionAdjusted: true,
  };
}

const isDev = !!process.env.VITE_DEV_SERVER_URL;

function getAppRoot(): string {
  if (isDev) return process.cwd();
  return app.getAppPath();
}

async function createWindow() {
  const root = getAppRoot();
  const preloadPath = join(root, 'dist/preload/index.cjs');
  const htmlPath = join(root, 'dist/renderer/index.html');
  const iconPath = join(isDev ? join(process.cwd(), 'resources') : process.resourcesPath, 'logo.ico');

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    title: '大海撈「B」',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      preload: preloadPath
    },
    ...(existsSync(iconPath) ? { icon: iconPath } : {}),
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    await mainWindow.loadURL(devUrl);
    if (isDev) {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
  } else {
    await mainWindow.loadFile(htmlPath);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

async function listImagesRecursively(root: string, acc: string[] = []): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(root, entry.name);
    if (entry.isDirectory()) {
      await listImagesRecursively(full, acc);
    } else {
      const lower = entry.name.toLowerCase();
      // Support more image formats including HEIC and WebP
      if (
        lower.endsWith('.jpg') || 
        lower.endsWith('.jpeg') || 
        lower.endsWith('.png') ||
        lower.endsWith('.gif') ||
        lower.endsWith('.bmp') ||
        lower.endsWith('.webp') ||
        lower.endsWith('.heic') ||
        lower.endsWith('.heif')
      ) {
        acc.push(full);
      }
    }
  }
  return acc;
}

// ==================== Auto-Update ====================
function setupAutoUpdater() {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    logger.info('Checking for update...');
    mainWindow?.webContents.send('update:status', { status: 'checking' });
  });

  autoUpdater.on('update-available', (info) => {
    logger.info(`Update available: v${info.version}`);
    mainWindow?.webContents.send('update:status', {
      status: 'available',
      version: info.version,
      releaseNotes: info.releaseNotes,
    });
  });

  autoUpdater.on('update-not-available', () => {
    logger.info('No update available');
    mainWindow?.webContents.send('update:status', { status: 'not-available' });
  });

  autoUpdater.on('download-progress', (progress) => {
    mainWindow?.webContents.send('update:status', {
      status: 'downloading',
      percent: Math.round(progress.percent),
    });
  });

  autoUpdater.on('update-downloaded', () => {
    logger.info('Update downloaded, ready to install');
    mainWindow?.webContents.send('update:status', { status: 'downloaded' });
  });

  autoUpdater.on('error', (err) => {
    logger.warn('Auto-updater error:', err?.message);
    mainWindow?.webContents.send('update:status', {
      status: 'error',
      error: err?.message || 'Unknown error',
    });
  });
}

function wireIpc() {
  // 模型狀態查詢 — 讓 UI 知道 face detection 是否可用
  ipcMain.handle('model:status', async () => {
    return getModelStatus();
  });

  // ==================== Auto-Update IPC ====================
  ipcMain.handle('update:check', async () => {
    try {
      const result = await autoUpdater.checkForUpdates();
      return { ok: true, data: result?.updateInfo };
    } catch (err: any) {
      return { ok: false, error: err?.message || 'Check failed' };
    }
  });

  ipcMain.handle('update:download', async () => {
    try {
      await autoUpdater.downloadUpdate();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err?.message || 'Download failed' };
    }
  });

  ipcMain.handle('update:install', async () => {
    autoUpdater.quitAndInstall(false, true);
    return { ok: true };
  });

  // ==================== Scan Control IPC ====================
  ipcMain.handle('scan:cancel', async () => {
    if (!scanInProgress) return { ok: true };
    scanCancelled = true;
    scanPaused = false;
    wakePausedScan(currentScanSessionId);
    logger.info('Scan cancel requested');
    return { ok: true };
  });

  ipcMain.handle('scan:pause', async () => {
    if (!scanInProgress || scanCancelled) return { ok: true };
    scanPaused = true;
    logger.info('Scan paused');
    return { ok: true };
  });

  ipcMain.handle('scan:resume', async () => {
    if (!scanInProgress) return { ok: true };
    scanPaused = false;
    wakePausedScan(currentScanSessionId);
    logger.info('Scan resumed');
    return { ok: true };
  });

  ipcMain.handle('app:about', async () => ({
    appName: '大海撈「B」',
    version: app.getVersion(),
    supportEmail: 'support@findmykid.app',
    changelog: [
      'v0.1.0：上線版流程與 Windows 打包',
      'v0.1.1：新增版本資訊與支援頁，補強首次啟用指引',
      'v0.1.2：穩定匯出流程並加入失敗重試',
    ],
  }));

  ipcMain.handle('ping', async () => 'pong');

  ipcMain.handle('scan:folder', async (_e, dir: string) => ({ ok: true, dir }));

  ipcMain.handle('dialog:open-files', async () => {
    if (!mainWindow) return null;
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: '選擇參考照片',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'heic', 'heif', 'webp', 'gif'] }]
    });
    if (canceled) return null;
    return filePaths;
  });

  ipcMain.handle('dialog:open-folder', async () => {
    if (!mainWindow) return null;
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: '選擇照片資料夾',
      properties: ['openDirectory']
    });
    if (canceled) return null;
    return filePaths[0] || null;
  });

  ipcMain.handle('embed:references', async (_e, files: string[]) => {
    try {
      logger.info(`Embedding ${files.length} reference files`);
      referenceEmbeddings.length = 0;
      
      let faceCount = 0;
      let deterministicCount = 0;
      
      for (const f of files) {
        logger.debug(`Processing reference file: ${f}`);
        const result = await fileToEmbeddingWithSource(f);
        referenceEmbeddings.push(result.embedding);
        if (result.source === 'face') {
          faceCount++;
        } else {
          deterministicCount++;
        }
      }
      
      if (deterministicCount > 0) {
        logger.warn(`⚠️ ${deterministicCount}/${files.length} reference photos used DETERMINISTIC embedding (no face detected)`);
      }
      if (faceCount > 0) {
        logger.info(`✅ ${faceCount}/${files.length} reference photos had faces detected`);
      }
      if (faceCount === 0) {
        logger.error(`❌ NO reference photos had faces detected! Matching will NOT work correctly.`);
      }
      
      logger.info(`Successfully embedded ${referenceEmbeddings.length} reference files`);
      return {
        ok: true,
        data: {
          count: referenceEmbeddings.length,
          faceDetected: faceCount,
          deterministicFallback: deterministicCount,
          warning: faceCount === 0
            ? '所有參考照片都無法偵測到人臉，比對結果可能不準確。請確認參考照片是否為清晰的正面人臉照片。'
            : deterministicCount > 0
              ? `${deterministicCount} 張參考照片未偵測到人臉，建議替換為正面清晰照片。`
              : undefined,
        },
      };
    } catch (err: any) {
      const errorInfo = createErrorInfo(err);
      logger.error('Failed to embed references:', errorInfo);
      return { ok: false, error: errorInfo.message };
    }
  });

  ipcMain.handle('embed:batch', async (_e, dir: string, clearCache?: boolean) => {
    if (scanInProgress) {
      return { ok: false, error: '已有掃描正在進行中，請先等待完成或先取消目前掃描。' };
    }
    scanInProgress = true;
    currentScanSessionId += 1;
    const scanSessionId = currentScanSessionId;

    // Reset scan control flags
    scanCancelled = false;
    scanPaused = false;
    resolveScanPause = null;

    try {
      logger.info(`Starting batch embedding for directory: ${dir}`);
      const files = await listImagesRecursively(dir);
      const total = files.length;
      let scanned = 0;
      let processed = 0;
      let cached = 0;
      let faceCount = 0;
      let deterministicCount = 0;
      let thumbnailErrors = 0;

      // 如果要求清除快取，清除相關的記憶體 embeddings
      if (clearCache) {
        logger.info('Clearing embedding cache as requested');
        photoEmbeddings.clear();
      }

      logger.info(`Found ${total} images to process`);

      // Process files one by one to support cancel/pause
      for (const filePath of files) {
        // Check cancel
        if (scanCancelled) {
          logger.info(`Scan cancelled at ${scanned}/${total}`);
          mainWindow?.webContents.send('scan:progress', {
            current: scanned, total, path: '', cancelled: true,
          });
          return {
            ok: true,
            data: { scanned, processed, cached, faceDetected: faceCount, deterministicFallback: deterministicCount, thumbnailErrors, cancelled: true },
          };
        }

        // Check pause — spin-wait until resumed or cancelled
        if (scanPaused && !scanCancelled) {
          await waitForScanResumeOrCancel(scanSessionId);
        }
        if (scanCancelled) {
          logger.info(`Scan cancelled while paused at ${scanned}/${total}`);
          return {
            ok: true,
            data: { scanned, processed, cached, faceDetected: faceCount, deterministicFallback: deterministicCount, thumbnailErrors, cancelled: true },
          };
        }

        const s = await fsStat(filePath);
        const mtime = Math.floor(s.mtimeMs);
        const existing = getPhoto(filePath);
        let faceAnalysis: FaceAnalysis | undefined;

        if (clearCache || !existing || existing.mtime !== mtime) {
          logger.debug(`Processing new/modified file: ${filePath}`);
          const result = await fileToEmbeddingWithSource(filePath);
          faceAnalysis = result.faceAnalysis;

          let thumb: string | null = null;
          try {
            thumb = await ensureThumbnailFor(filePath);
          } catch (thumbErr: any) {
            thumbnailErrors++;
            logger.warn(`Thumbnail generation failed for ${filePath}: ${thumbErr?.message || thumbErr}`);
          }

          upsertPhoto(filePath, mtime, thumb);
          upsertFace(filePath, result.embedding);
          setPhotoEmbedding(filePath, result.embedding);

          if (result.source === 'face') faceCount++;
          else deterministicCount++;

          processed++;
        } else if (!photoEmbeddings.has(filePath)) {
          const cachedFaces = getFacesByPath(filePath);
          if (cachedFaces.length > 0) {
            setPhotoEmbedding(filePath, cachedFaces[0]);
            cached++;
          } else {
            logger.debug(`No cached embedding found for: ${filePath}`);
            const result = await fileToEmbeddingWithSource(filePath);
            faceAnalysis = result.faceAnalysis;
            upsertFace(filePath, result.embedding);
            setPhotoEmbedding(filePath, result.embedding);
            if (result.source === 'face') faceCount++;
            else deterministicCount++;
            processed++;
          }
        } else {
          const existingEmbedding = photoEmbeddings.get(filePath);
          if (existingEmbedding) {
            setPhotoEmbedding(filePath, existingEmbedding);
          }
          cached++;
        }

        scanned += 1;

        if (mainWindow) {
          const photo = getPhoto(filePath);
          mainWindow.webContents.send('scan:progress', {
            current: scanned,
            total,
            path: filePath,
            thumbPath: photo?.thumbPath || null,
            faceAnalysis: faceAnalysis || null,
          });
        }

        // Yield to event loop every 5 files for UI responsiveness
        if (scanned % 5 === 0) {
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }

      logger.info(`Batch embedding completed: ${processed} processed, ${cached} from cache, ${faceCount} face, ${deterministicCount} deterministic`);
      if (thumbnailErrors > 0) {
        logger.warn(`⚠️ ${thumbnailErrors} photos failed thumbnail generation`);
      }

      return {
        ok: true,
        data: {
          scanned,
          processed,
          cached,
          faceDetected: faceCount,
          deterministicFallback: deterministicCount,
          thumbnailErrors,
        },
      };
    } catch (err: any) {
      const errorInfo = createErrorInfo(err);
      logger.error('Batch embedding failed:', errorInfo);
      return { ok: false, error: errorInfo.message };
    } finally {
      scanInProgress = false;
      resolveScanPause = null;
    }
  });

  ipcMain.handle('match:run', async (_e, opts: { topN: number; threshold: number }) => {
    const results: Array<{ path: string; score: number; thumbPath?: string }> = [];
    if (referenceEmbeddings.length === 0) {
      logger.warn('match:run called with 0 reference embeddings');
      return { results, dimensionAdjustedCount: 0, totalComparisons: 0 };
    }
    
    let dimensionAdjustedCount = 0;
    let totalComparisons = 0;
    let maxScoreOverall = -1;
    
    // 記錄參考向量維度
    const refDims = referenceEmbeddings.map(r => r.length);
    logger.info(`match:run: ${referenceEmbeddings.length} refs (dims: ${[...new Set(refDims)].join(',')}), ${photoEmbeddings.size} photos, threshold=${opts?.threshold ?? 0}`);
    
    for (const [path, emb] of photoEmbeddings.entries()) {
      let best = -1;
      for (const ref of referenceEmbeddings) {
        totalComparisons++;
        const { score: s, dimensionAdjusted } = cosineSimilarityWithDimensionHandling(emb, ref);
        if (dimensionAdjusted) {
          dimensionAdjustedCount++;
        }
        if (s > best) best = s;
      }
      if (best > maxScoreOverall) maxScoreOverall = best;
      if (best >= (opts?.threshold ?? 0)) {
        // 獲取縮圖路徑
        const photo = getPhoto(path);
        const thumbPath = photo?.thumbPath || null;
        results.push({ path, score: best, thumbPath: thumbPath || undefined });
      }
    }
    
    if (dimensionAdjustedCount > 0) {
      logger.warn(`⚠️ match:run: ${dimensionAdjustedCount}/${totalComparisons} comparisons used adjusted dimensions`);
    }
    logger.info(`match:run: ${results.length} matches found (best score: ${maxScoreOverall.toFixed(4)}, threshold: ${opts?.threshold ?? 0})`);
    if (results.length === 0 && maxScoreOverall > -1) {
      logger.warn(`⚠️ match:run: Best score was ${maxScoreOverall.toFixed(4)} but threshold is ${opts?.threshold ?? 0}. Consider lowering threshold.`);
    }
    
    results.sort((a, b) => b.score - a.score);
    const topN = Math.max(1, Math.min(1000, opts?.topN ?? 100));
    return {
      results: results.slice(0, topN),
      dimensionAdjustedCount,
      totalComparisons,
    };
  });

  // 清除 embedding 快取
  ipcMain.handle('scan:clear-cache', async () => {
    try {
      logger.info('Clearing all embedding caches...');
      photoEmbeddings.clear();
      // 也清除資料庫中的 faces
      const d = getDb();
      d.exec('DELETE FROM faces');
      logger.info('✅ All embedding caches cleared');
      return { ok: true };
    } catch (err: any) {
      const errorInfo = createErrorInfo(err);
      logger.error('Failed to clear cache:', errorInfo);
      return { ok: false, error: errorInfo.message };
    }
  });

  ipcMain.handle('export:copy', async (_e, payload: { files: string[]; outDir: string }) => {
    try {
      const { files, outDir } = payload;
      logger.info(`Exporting ${files.length} files to: ${outDir}`);
      
      if (!existsSync(outDir)) {
        await mkdir(outDir, { recursive: true });
        logger.debug(`Created export directory: ${outDir}`);
      }
      
      let copied = 0;
      const failedPaths: string[] = [];
      const usedNames = new Set<string>();
      for (const src of files) {
        try {
          let base = src.split(/[/\\]/).pop() || 'image.jpg';
          // Handle filename collisions by appending a counter
          if (usedNames.has(base.toLowerCase())) {
            const dot = base.lastIndexOf('.');
            const name = dot > 0 ? base.slice(0, dot) : base;
            const ext = dot > 0 ? base.slice(dot) : '';
            let counter = 2;
            while (usedNames.has(`${name}_${counter}${ext}`.toLowerCase())) {
              counter++;
            }
            base = `${name}_${counter}${ext}`;
          }
          usedNames.add(base.toLowerCase());
          const dest = join(outDir, base);
          await copyFile(src, dest);
          copied += 1;
          logger.debug(`Copied: ${src} -> ${dest}`);
        } catch (err: any) {
          failedPaths.push(src);
          logger.warn(`Export failed for ${src}: ${err?.message || 'unknown'}`);
        }
      }

      if (failedPaths.length > 0) {
        logger.warn(`Export completed with ${failedPaths.length} failures`);
        return {
          ok: false,
          data: { copied, failed: failedPaths.length, failedPaths },
          error: `有 ${failedPaths.length} 張照片匯出失敗`
        };
      }

      logger.info(`Successfully exported ${copied} files`);
      return { ok: true, data: { copied, failed: 0, failedPaths: [] } };
    } catch (err: any) {
      const errorInfo = createErrorInfo(err);
      logger.error('Export failed:', errorInfo);
      return { ok: false, error: errorInfo.message };
    }
  });

  ipcMain.handle('shell:open-external', async (_e, url: string) => {
    // Only allow known safe URLs
    if (url.startsWith('https://')) {
      await shell.openExternal(url);
      return { ok: true };
    }
    return { ok: false, error: 'Only HTTPS URLs are allowed' };
  });

  ipcMain.handle('folder:open', async (_e, folderPath: string) => {
    try {
      await shell.openPath(folderPath);
      return { ok: true };
    } catch (err: any) {
      const errorInfo = createErrorInfo(err);
      logger.error('Failed to open folder:', errorInfo);
      return { ok: false, error: errorInfo.message };
    }
  });

  // 新增：评估照片质量
  ipcMain.handle('assess:photo-quality', async (_e, filePath: string) => {
    try {
      logger.info(`Assessing photo quality: ${filePath}`);
      const assessor = new ChildQualityAssessor({ qualityLevel: 'professional' });
      const metrics = await assessor.assessPhotoQuality(filePath);
      logger.info(`Quality assessment completed for ${filePath}: score=${metrics.overallScore}`);
      return { ok: true, data: metrics };
    } catch (err: any) {
      const errorInfo = createErrorInfo(err);
      logger.error('Photo quality assessment failed:', errorInfo);
      return { ok: false, error: errorInfo.message };
    }
  });

  // 新增：增强照片
  ipcMain.handle('enhance:photo', async (_e, filePath: string) => {
    try {
      logger.info(`Enhancing photo: ${filePath}`);
      const result = await photoEnhancer.enhancePhoto(filePath);
      logger.info(`Photo enhanced successfully: ${result.enhancedPath}`);
      return { ok: true, data: result };
    } catch (err: any) {
      const errorInfo = createErrorInfo(err);
      logger.error('Photo enhancement failed:', errorInfo);
      return { ok: false, error: errorInfo.message };
    }
  });

  // ==================== 成長紀錄管理 IPC ====================

  // 儲存成長紀錄
  ipcMain.handle('growth:save-record', async (_e, record) => {
    try {
      const result = await growthRecordManager.saveGrowthRecord(record);
      return { ok: true, data: result };
    } catch (err: any) {
      const errorInfo = createErrorInfo(err);
      logger.error('Failed to save growth record:', errorInfo);
      return { ok: false, error: errorInfo.message };
    }
  });

  // 取得所有成長紀錄
  ipcMain.handle('growth:get-records', async () => {
    try {
      const result = await growthRecordManager.getGrowthRecords();
      return { ok: true, data: result };
    } catch (err: any) {
      const errorInfo = createErrorInfo(err);
      logger.error('Failed to get growth records:', errorInfo);
      return { ok: false, error: errorInfo.message };
    }
  });

  // 取得單筆成長紀錄
  ipcMain.handle('growth:get-record', async (_e, id: string) => {
    try {
      const result = await growthRecordManager.getGrowthRecord(id);
      return { ok: true, data: result };
    } catch (err: any) {
      const errorInfo = createErrorInfo(err);
      logger.error('Failed to get growth record:', errorInfo);
      return { ok: false, error: errorInfo.message };
    }
  });

  // 刪除成長紀錄
  ipcMain.handle('growth:delete-record', async (_e, id: string) => {
    try {
      await growthRecordManager.deleteGrowthRecord(id);
      return { ok: true };
    } catch (err: any) {
      const errorInfo = createErrorInfo(err);
      logger.error('Failed to delete growth record:', errorInfo);
      return { ok: false, error: errorInfo.message };
    }
  });

  // 新增成長事件
  ipcMain.handle('growth:add-event', async (_e, recordId: string, event) => {
    try {
      await growthRecordManager.addGrowthEvent(recordId, event);
      return { ok: true };
    } catch (err: any) {
      const errorInfo = createErrorInfo(err);
      logger.error('Failed to add growth event:', errorInfo);
      return { ok: false, error: errorInfo.message };
    }
  });

  // 儲存掃描工作階段
  ipcMain.handle('growth:save-session', async (_e, session) => {
    try {
      const result = await growthRecordManager.saveScanSession(session);
      return { ok: true, data: result };
    } catch (err: any) {
      const errorInfo = createErrorInfo(err);
      logger.error('Failed to save scan session:', errorInfo);
      return { ok: false, error: errorInfo.message };
    }
  });

  // 取得所有掃描工作階段
  ipcMain.handle('growth:get-sessions', async () => {
    try {
      const result = await growthRecordManager.getScanSessions();
      return { ok: true, data: result };
    } catch (err: any) {
      const errorInfo = createErrorInfo(err);
      logger.error('Failed to get scan sessions:', errorInfo);
      return { ok: false, error: errorInfo.message };
    }
  });

  // 取得提醒
  ipcMain.handle('growth:get-reminders', async () => {
    try {
      const result = await growthRecordManager.getReminders();
      return { ok: true, data: result };
    } catch (err: any) {
      const errorInfo = createErrorInfo(err);
      logger.error('Failed to get reminders:', errorInfo);
      return { ok: false, error: errorInfo.message };
    }
  });

  // 標記提醒已讀
  ipcMain.handle('growth:mark-reminder-read', async (_e, id: string) => {
    try {
      await growthRecordManager.markReminderRead(id);
      return { ok: true };
    } catch (err: any) {
      const errorInfo = createErrorInfo(err);
      logger.error('Failed to mark reminder as read:', errorInfo);
      return { ok: false, error: errorInfo.message };
    }
  });

  // 刪除提醒
  ipcMain.handle('growth:dismiss-reminder', async (_e, id: string) => {
    try {
      await growthRecordManager.dismissReminder(id);
      return { ok: true };
    } catch (err: any) {
      const errorInfo = createErrorInfo(err);
      logger.error('Failed to dismiss reminder:', errorInfo);
      return { ok: false, error: errorInfo.message };
    }
  });

  // 檢查新提醒
  ipcMain.handle('growth:check-reminders', async () => {
    try {
      const result = await growthRecordManager.checkReminders();
      return { ok: true, data: result };
    } catch (err: any) {
      const errorInfo = createErrorInfo(err);
      logger.error('Failed to check reminders:', errorInfo);
      return { ok: false, error: errorInfo.message };
    }
  });

  // 取得家庭成員
  ipcMain.handle('growth:get-family-members', async () => {
    try {
      const result = await growthRecordManager.getFamilyMembers();
      return { ok: true, data: result };
    } catch (err: any) {
      const errorInfo = createErrorInfo(err);
      logger.error('Failed to get family members:', errorInfo);
      return { ok: false, error: errorInfo.message };
    }
  });

  // 新增家庭成員
  ipcMain.handle('growth:add-family-member', async (_e, member) => {
    try {
      const result = await growthRecordManager.addFamilyMember(member);
      return { ok: true, data: result };
    } catch (err: any) {
      const errorInfo = createErrorInfo(err);
      logger.error('Failed to add family member:', errorInfo);
      return { ok: false, error: errorInfo.message };
    }
  });

  // 取得共享相簿
  ipcMain.handle('growth:get-shared-albums', async () => {
    try {
      const result = await growthRecordManager.getSharedAlbums();
      return { ok: true, data: result };
    } catch (err: any) {
      const errorInfo = createErrorInfo(err);
      logger.error('Failed to get shared albums:', errorInfo);
      return { ok: false, error: errorInfo.message };
    }
  });

  // 建立共享相簿
  ipcMain.handle('growth:create-shared-album', async (_e, album) => {
    try {
      const result = await growthRecordManager.createSharedAlbum(album);
      return { ok: true, data: result };
    } catch (err: any) {
      const errorInfo = createErrorInfo(err);
      logger.error('Failed to create shared album:', errorInfo);
      return { ok: false, error: errorInfo.message };
    }
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  wakePausedScan(currentScanSessionId);
  closeDb();
});

app.whenReady().then(async () => {
  app.setName('大海撈「B」');
  app.setAboutPanelOptions({
    applicationName: '大海撈「B」',
    version: app.getVersion(),
  });
  wireIpc();
  setupAutoUpdater();
  await createWindow();

  // Check for updates after window is ready (non-blocking)
  if (!isDev) {
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch((err) => {
        logger.warn('Auto-update check failed:', err?.message);
      });
    }, 5000);
  }
});
