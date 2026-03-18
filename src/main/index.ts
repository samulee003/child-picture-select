import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron';
import { join } from 'path';
import { existsSync } from 'fs';
import { mkdir, readdir, copyFile } from 'fs/promises';
import { fileToEmbeddingWithSource, Embedding, DETERMINISTIC_SCORE_PENALTY, type FaceAnalysis } from '../core/embeddings';
import { cosineSimilarity, multiReferenceSimilarity, type MultiRefStrategy } from '../core/similarity';
import { getPhoto, upsertPhoto, upsertFace, getFacesByPath, getDb, closeDb } from '../core/db';
import { ensureThumbnailFor } from '../core/thumbs';
import { stat as fsStat } from 'fs/promises';
import { logger } from '../utils/logger';
import { createErrorInfo } from '../utils/error-handler';
import { performanceManager } from '../core/performance';
import { getPhotoEnhancer } from '../core/photoEnhancer';
import { ChildQualityAssessor } from '../core/childQualityAssessment';
import { getGrowthRecordManager } from './growthRecordManager';
import type { ScanSession } from '../types/api';
import { getModelStatus, preloadModel } from '../core/detector';
import { autoUpdater } from 'electron-updater';

let mainWindow: BrowserWindow | null = null;
const referenceEmbeddings: Embedding[] = [];
// Tracks whether each reference embedding came from face detection or deterministic fallback
const referenceEmbeddingSources: Array<'face' | 'deterministic'> = [];

// LRU cache for photo embeddings with max size to prevent memory leaks
const MAX_EMBEDDING_CACHE_SIZE = 50000; // ~200MB for 1024-dim float64
const photoEmbeddings = new Map<string, Embedding>();
const photoEmbeddingSources = new Map<string, 'face' | 'deterministic' | 'unknown'>();

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

function setPhotoEmbedding(path: string, embedding: Embedding, source: 'face' | 'deterministic' | 'unknown' = 'unknown') {
  if (photoEmbeddings.has(path)) {
    photoEmbeddings.delete(path);
  }
  photoEmbeddings.set(path, embedding);
  photoEmbeddingSources.set(path, source);
  const overflow = photoEmbeddings.size - MAX_EMBEDDING_CACHE_SIZE;
  if (overflow > 0) {
    evictOldestEmbeddings(overflow);
  }
}

async function ensureModelReady(context: 'references' | 'batch'): Promise<{ ok: true } | { ok: false; error: string }> {
  const status = getModelStatus();
  if (status.loaded) return { ok: true };

  logger.warn(`Model not loaded when running ${context}, attempting to load...`);
  await preloadModel();
  const retryStatus = getModelStatus();
  if (retryStatus.loaded) return { ok: true };

  if (context === 'references') {
    return {
      ok: false,
      error: `AI 模型載入失敗，無法進行臉部辨識。${retryStatus.error ? `\n錯誤：${retryStatus.error}` : ''}\n\n請嘗試重新啟動應用程式。`,
    };
  }

  return {
    ok: false,
    error: `AI 模型未載入，無法掃描。${retryStatus.error ? `\n錯誤：${retryStatus.error}` : ''}\n\n請重新啟動應用程式。`,
  };
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
    title: '大海撈Ｂ',
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

  // 診斷資訊 — 回傳 log 路徑、模型檔案狀態、WASM 狀態，供開發者排查問題
  ipcMain.handle('diagnostics:get-info', async () => {
    const { join: pathJoin } = require('path');
    const { existsSync: fsExistsSync, readdirSync } = require('fs');

    const modelStatus = getModelStatus();

    // Log 檔路徑
    const userDataPath = app.getPath('userData');
    const logsDir = pathJoin(userDataPath, 'logs');
    const today = new Date().toISOString().split('T')[0];
    const logFilePath = pathJoin(logsDir, `app-${today}.log`);

    // 模型檔案檢查
    const modelsDir = pathJoin(process.cwd(), 'node_modules', '@vladmandic', 'human', 'models');
    let modelFiles: string[] = [];
    try {
      modelFiles = readdirSync(modelsDir);
    } catch { /* not found */ }

    const faceresExists = modelFiles.some(f => f === 'faceres.json');
    const facedetectExists = modelFiles.some(f => f.startsWith('blazeface'));

    // WASM 檔案檢查
    const wasmDir = pathJoin(process.cwd(), 'node_modules', '@tensorflow', 'tfjs-backend-wasm', 'dist');
    const wasmExists = fsExistsSync(pathJoin(wasmDir, 'tfjs-backend-wasm.wasm'));

    // human WASM build 檢查
    const humanWasmPath = pathJoin(process.cwd(), 'node_modules', '@vladmandic', 'human', 'dist', 'human.node-wasm.js');
    const humanWasmExists = fsExistsSync(humanWasmPath);

    // canvas 套件檢查
    let canvasAvailable = false;
    try {
      require('canvas');
      canvasAvailable = true;
    } catch { /* not available */ }

    return {
      ok: true,
      data: {
        logFilePath,
        logFileExists: fsExistsSync(logFilePath),
        modelLoaded: modelStatus.loaded,
        modelError: modelStatus.error,
        faceresModelExists: faceresExists,
        facedetectModelExists: facedetectExists,
        modelFilesFound: modelFiles.length,
        modelsDir,
        wasmBackendExists: wasmExists,
        humanWasmBuildExists: humanWasmExists,
        canvasAvailable,
        nodeVersion: process.version,
        platform: process.platform,
      },
    };
  });

  // 讀取 log 最後 N 行 — 供 UI 顯示診斷資訊
  ipcMain.handle('diagnostics:get-log-tail', async (_event, lines: number = 100) => {
    const { join: pathJoin } = require('path');
    const { existsSync: fsExistsSync, readFileSync } = require('fs');
    const userDataPath = app.getPath('userData');
    const today = new Date().toISOString().split('T')[0];
    const logFilePath = pathJoin(userDataPath, 'logs', `app-${today}.log`);
    if (!fsExistsSync(logFilePath)) {
      return { ok: true, data: { lines: [], logFilePath } };
    }
    try {
      const content = readFileSync(logFilePath, 'utf-8');
      const allLines = content.split('\n').filter((l: string) => l.trim());
      const tail = allLines.slice(-lines);
      return { ok: true, data: { lines: tail, logFilePath } };
    } catch (err: any) {
      return { ok: false, error: err?.message };
    }
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

  ipcMain.handle('scan:performance-mode', async (_e, mode: 'default' | 'eco') => {
    const normalized = mode === 'eco' ? 'eco' : 'default';
    if (normalized === 'eco') {
      performanceManager.updateConfig({ batchSize: 20, maxConcurrency: 2 });
    } else {
      performanceManager.updateConfig({ batchSize: 50, maxConcurrency: 4 });
    }
    logger.info(`Scan performance mode updated: ${normalized}`);
    return { ok: true, data: { mode: normalized } };
  });

  ipcMain.handle('app:about', async () => ({
    appName: '大海撈Ｂ',
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
      const modelReady = await ensureModelReady('references');
      if (!modelReady.ok) {
        return {
          ok: false,
          error: modelReady.error,
        };
      }

      logger.info(`Embedding ${files.length} reference files`);
      referenceEmbeddings.length = 0;
      referenceEmbeddingSources.length = 0;

      let faceCount = 0;
      let deterministicCount = 0;
      let detectionErrorFallbackCount = 0;
      const perFileResults: Array<{
        path: string;
        source: 'face' | 'deterministic';
        faceAnalysis?: { confidence: number; age?: number; gender?: 'male' | 'female'; faceCount: number };
      }> = [];

      for (const f of files) {
        logger.debug(`Processing reference file: ${f}`);
        const result = await fileToEmbeddingWithSource(f, {
          maxSize: 1280,
          minConfidence: 0.01,
          retryOnNoFace: true,
        });
        referenceEmbeddings.push(result.embedding);
        referenceEmbeddingSources.push(result.source === 'face' ? 'face' : 'deterministic');
        perFileResults.push({
          path: f,
          source: result.source,
          faceAnalysis: result.faceAnalysis,
        });
        if (result.source === 'face') {
          faceCount++;
        } else {
          deterministicCount++;
          if (result.fallbackReason === 'detection_error') detectionErrorFallbackCount++;
        }
      }

      if (deterministicCount > 0) {
        logger.warn(`⚠️ ${deterministicCount}/${files.length} reference photos used DETERMINISTIC embedding (no face detected)`);
      }
      if (faceCount > 0) {
        logger.info(`✅ ${faceCount}/${files.length} reference photos had faces detected`);
      }

      // 若偵測引擎異常才阻擋；若只是沒抓到臉，允許以降級模式繼續（維持舊版可用體感）
      if (faceCount === 0) {
        logger.warn(`⚠️ NO reference photos had faces detected; continue in deterministic fallback mode.`);
        const modelStatus = getModelStatus();
        if (!modelStatus.loaded || modelStatus.error || detectionErrorFallbackCount === files.length) {
          logger.error(`❌ Blocking scan because model engine is not healthy.`);
          referenceEmbeddings.length = 0;
          return {
            ok: false,
            error: `AI 模型目前不可用，無法正確辨識人臉。${modelStatus.error ? `\n錯誤：${modelStatus.error}` : ''}${detectionErrorFallbackCount === files.length ? '\n偵測引擎回傳錯誤，已自動改用降級模式。' : ''}\n\n請重新啟動應用程式後再試一次。`,
          };
        }
      }
      
      logger.info(`Successfully embedded ${referenceEmbeddings.length} reference files`);
      return {
        ok: true,
        data: {
          count: referenceEmbeddings.length,
          faceDetected: faceCount,
          deterministicFallback: deterministicCount,
          perFileResults,
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

    const modelReady = await ensureModelReady('batch');
    if (!modelReady.ok) {
      return { ok: false, error: modelReady.error };
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
      let readErrors = 0;
      let embeddingErrors = 0;
      let skippedErrors = 0;
      const warnings: string[] = [];
      const scanStartTs = Date.now();

      // 如果要求清除快取，清除相關的記憶體 embeddings
      if (clearCache) {
        logger.info('Clearing embedding cache as requested');
      }
      // 每次新掃描都重建本次 in-memory 索引，避免混入前一次資料夾結果
      photoEmbeddings.clear();
      photoEmbeddingSources.clear();

      logger.info(`Found ${total} images to process`);

      // Adaptive batch size based on available memory
      const freeMem = require('os').freemem();
      const freeMB = freeMem / (1024 * 1024);
      let adaptiveBatchSize: number;
      if (freeMB < 512) {
        adaptiveBatchSize = 10;
      } else if (freeMB < 1024) {
        adaptiveBatchSize = 20;
      } else {
        adaptiveBatchSize = Math.max(5, performanceManager.getMetrics().maxConcurrency * 10);
      }
      const perfBatchSize = adaptiveBatchSize;

      // Process files in small batches for better responsiveness and ETA updates
      for (let offset = 0; offset < files.length; offset += perfBatchSize) {
        const batch = files.slice(offset, offset + perfBatchSize);
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

        for (const filePath of batch) {
          // Check pause — spin-wait until resumed or cancelled
          if (scanPaused && !scanCancelled) {
            await waitForScanResumeOrCancel(scanSessionId);
          }
          if (scanCancelled) {
            logger.info(`Scan cancelled while paused at ${scanned}/${total}`);
            return {
              ok: true,
              data: {
                scanned,
                processed,
                cached,
                faceDetected: faceCount,
                deterministicFallback: deterministicCount,
                thumbnailErrors,
                readErrors,
                embeddingErrors,
                skippedErrors,
                avgPhotosPerSec: scanned > 0 ? scanned / Math.max(1, (Date.now() - scanStartTs) / 1000) : 0,
                durationMs: Date.now() - scanStartTs,
                warnings,
                cancelled: true,
              },
            };
          }

          let faceAnalysis: FaceAnalysis | undefined;
          try {
            const s = await fsStat(filePath);
            const mtime = Math.floor(s.mtimeMs);
            const existing = getPhoto(filePath);

            if (clearCache || !existing || existing.mtime !== mtime) {
              logger.debug(`Processing new/modified file: ${filePath}`);
              const result = await fileToEmbeddingWithSource(filePath, {
                maxSize: 1280,
                minConfidence: 0.01,
                retryOnNoFace: true,
              });
              faceAnalysis = result.faceAnalysis;

              let thumb: string | null = null;
              try {
                thumb = await ensureThumbnailFor(filePath);
              } catch (thumbErr: any) {
                thumbnailErrors++;
                logger.warn(`Thumbnail generation failed for ${filePath}: ${thumbErr?.message || thumbErr}`);
              }

              upsertPhoto(filePath, mtime, thumb);
              upsertFace(filePath, result.embedding, result.source);
              setPhotoEmbedding(filePath, result.embedding, result.source);

              if (result.source === 'face') faceCount++;
              else deterministicCount++;

              processed++;
            } else if (!photoEmbeddings.has(filePath)) {
              const cachedFaces = getFacesByPath(filePath);
              if (cachedFaces.length > 0) {
                const cachedFace = cachedFaces[0];
                setPhotoEmbedding(filePath, cachedFace.embedding, cachedFace.source);
                cached++;
              } else {
                logger.debug(`No cached embedding found for: ${filePath}`);
                const result = await fileToEmbeddingWithSource(filePath, {
                  maxSize: 1280,
                  minConfidence: 0.01,
                  retryOnNoFace: true,
                });
                faceAnalysis = result.faceAnalysis;
                upsertFace(filePath, result.embedding, result.source);
                setPhotoEmbedding(filePath, result.embedding, result.source);
                if (result.source === 'face') faceCount++;
                else deterministicCount++;
                processed++;
              }
            } else {
              const existingEmbedding = photoEmbeddings.get(filePath);
              const existingSource = photoEmbeddingSources.get(filePath) || 'unknown';
              if (existingEmbedding) {
                setPhotoEmbedding(filePath, existingEmbedding, existingSource);
              }
              cached++;
            }
          } catch (itemErr: any) {
            const msg = itemErr?.message || 'unknown';
            if (msg.toLowerCase().includes('enoent') || msg.toLowerCase().includes('permission')) {
              readErrors++;
            } else {
              embeddingErrors++;
            }
            skippedErrors++;
            logger.warn(`Skipping file due to processing error: ${filePath}`, msg);
          }

          scanned += 1;
          const elapsedSec = Math.max(1, (Date.now() - scanStartTs) / 1000);
          const photosPerSec = scanned / elapsedSec;
          const etaSeconds = Math.max(0, Math.round((total - scanned) / Math.max(0.01, photosPerSec)));

          if (mainWindow) {
            const photo = getPhoto(filePath);
            mainWindow.webContents.send('scan:progress', {
              current: scanned,
              total,
              path: filePath,
              thumbPath: photo?.thumbPath || null,
              faceAnalysis: faceAnalysis || null,
              photosPerSec: Number(photosPerSec.toFixed(2)),
              etaSeconds,
            });
          }
        }

        // Yield to event loop between batches
        await new Promise(resolve => setTimeout(resolve, 0));
      }

      if (deterministicCount > 0 && faceCount === 0) {
        warnings.push('本次掃描沒有偵測到可用人臉，結果可能偏低，建議補充清晰正面參考照。');
      } else if (deterministicCount > 0) {
        warnings.push('部分照片未偵測到人臉，已使用保底特徵，請優先複核低信心結果。');
      }
      if (skippedErrors > 0) {
        warnings.push(`有 ${skippedErrors} 張照片處理失敗（讀檔 ${readErrors}、嵌入 ${embeddingErrors}）。`);
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
          readErrors,
          embeddingErrors,
          skippedErrors,
          avgPhotosPerSec: scanned > 0 ? Number((scanned / Math.max(1, (Date.now() - scanStartTs) / 1000)).toFixed(2)) : 0,
          durationMs: Date.now() - scanStartTs,
          warnings,
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

  ipcMain.handle('match:run', async (_e, opts: { topN: number; threshold: number; strategy?: MultiRefStrategy }) => {
    const results: Array<{ path: string; score: number; thumbPath?: string; source?: 'face' | 'deterministic' | 'unknown'; bestRefIndex?: number }> = [];
    if (referenceEmbeddings.length === 0) {
      logger.warn('match:run called with 0 reference embeddings');
      return { results, dimensionAdjustedCount: 0, totalComparisons: 0 };
    }

    const strategy: MultiRefStrategy = opts?.strategy ?? 'best';
    let dimensionAdjustedCount = 0;
    let maxScoreOverall = -1;

    // Build reference objects with face/deterministic info for weighted strategy
    const refObjects = referenceEmbeddings.map((emb, i) => ({
      embedding: emb,
      isFace: referenceEmbeddingSources[i] === 'face',
    }));

    const refDims = referenceEmbeddings.map(r => r.length);
    logger.info(`match:run: ${referenceEmbeddings.length} refs (dims: ${[...new Set(refDims)].join(',')}, strategy: ${strategy}), ${photoEmbeddings.size} photos, threshold=${opts?.threshold ?? 0}`);

    for (const [path, emb] of photoEmbeddings.entries()) {
      // Check for any dimension mismatch (for logging only)
      for (const ref of referenceEmbeddings) {
        if (emb.length !== ref.length) dimensionAdjustedCount++;
      }

      let score = multiReferenceSimilarity(emb, refObjects, strategy);

      // Track which reference photo gave the best individual score
      let bestRefIndex = 0;
      let bestIndividualScore = -1;
      for (let ri = 0; ri < refObjects.length; ri++) {
        const ref = refObjects[ri];
        const a = emb;
        const b = ref.embedding;
        const s = a.length === b.length
          ? cosineSimilarity(a, b)
          : cosineSimilarity(a.slice(0, Math.min(a.length, b.length)), b.slice(0, Math.min(a.length, b.length)));
        if (s > bestIndividualScore) { bestIndividualScore = s; bestRefIndex = ri; }
      }

      const source = photoEmbeddingSources.get(path) || 'unknown';
      // Deterministic vectors are only a fallback signal, reduce score to lower false positives.
      if (source === 'deterministic' && score > 0) {
        score = Math.max(0, score - DETERMINISTIC_SCORE_PENALTY);
      }
      if (score > maxScoreOverall) maxScoreOverall = score;
      if (score >= (opts?.threshold ?? 0)) {
        const photo = getPhoto(path);
        const thumbPath = photo?.thumbPath || null;
        results.push({ path, score, thumbPath: thumbPath || undefined, source, bestRefIndex });
      }
    }

    if (dimensionAdjustedCount > 0) {
      logger.warn(`⚠️ match:run: ${dimensionAdjustedCount} comparisons had mismatched dimensions (handled internally)`);
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
      totalComparisons: photoEmbeddings.size * referenceEmbeddings.length,
    };
  });

  // 清除 embedding 快取
  ipcMain.handle('scan:clear-cache', async () => {
    try {
      logger.info('Clearing all embedding caches...');
      photoEmbeddings.clear();
      photoEmbeddingSources.clear();
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
      const result = await getPhotoEnhancer().enhancePhoto(filePath);
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
      const result = await getGrowthRecordManager().saveGrowthRecord(record);
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
      const result = await getGrowthRecordManager().getGrowthRecords();
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
      const result = await getGrowthRecordManager().getGrowthRecord(id);
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
      await getGrowthRecordManager().deleteGrowthRecord(id);
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
      await getGrowthRecordManager().addGrowthEvent(recordId, event);
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
      const result = await getGrowthRecordManager().saveScanSession(session);
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
      const result = await getGrowthRecordManager().getScanSessions();
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
      const result = await getGrowthRecordManager().getReminders();
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
      await getGrowthRecordManager().markReminderRead(id);
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
      await getGrowthRecordManager().dismissReminder(id);
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
      const result = await getGrowthRecordManager().checkReminders();
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
      const result = await getGrowthRecordManager().getFamilyMembers();
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
      const result = await getGrowthRecordManager().addFamilyMember(member);
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
      const result = await getGrowthRecordManager().getSharedAlbums();
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
      const result = await getGrowthRecordManager().createSharedAlbum(album);
      return { ok: true, data: result };
    } catch (err: any) {
      const errorInfo = createErrorInfo(err);
      logger.error('Failed to create shared album:', errorInfo);
      return { ok: false, error: errorInfo.message };
    }
  });

  // GDPR 資料匯出 — 將所有本地資料匯出為 JSON
  ipcMain.handle('data:export-all', async () => {
    if (!mainWindow) return { ok: false, error: '視窗未就緒' };
    try {
      const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
        title: '匯出所有資料',
        defaultPath: `find-my-kid-export-${new Date().toISOString().slice(0, 10)}.json`,
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });
      if (canceled || !filePath) return { ok: false, error: 'cancelled' };

      const mgr = getGrowthRecordManager();
      const [growthRecords, scanSessions, reminders, familyMembers, sharedAlbums] = await Promise.all([
        mgr.getGrowthRecords(),
        mgr.getScanSessions(),
        mgr.getReminders(),
        mgr.getFamilyMembers(),
        mgr.getSharedAlbums(),
      ]);

      const exportPayload = {
        exportedAt: new Date().toISOString(),
        appVersion: app.getVersion(),
        growthRecords,
        scanSessions,
        reminders,
        familyMembers,
        sharedAlbums,
      };

      const fs = require('fs');
      fs.writeFileSync(filePath, JSON.stringify(exportPayload, null, 2), 'utf-8');
      logger.info(`Data exported to ${filePath}`);
      return { ok: true, data: { filePath } };
    } catch (err: any) {
      const errorInfo = createErrorInfo(err);
      logger.error('Failed to export data:', errorInfo);
      return { ok: false, error: errorInfo.message };
    }
  });

  ipcMain.handle('privacy:clear-old-sessions', async (_e, olderThanDays: number) => {
    try {
      const mgr = getGrowthRecordManager();
      const { sessions } = await mgr.getScanSessions();
      const cutoff = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
      const toDelete = sessions.filter((s: ScanSession) => new Date(s.createdAt).getTime() < cutoff);
      let deleted = 0;
      for (const session of toDelete) {
        try {
          await mgr.deleteScanSession(session.id);
          deleted++;
        } catch {
          // best-effort
        }
      }
      logger.info(`privacy:clear-old-sessions: removed ${deleted} sessions older than ${olderThanDays} days`);
      return { ok: true, data: { deleted } };
    } catch (err: any) {
      const errorInfo = createErrorInfo(err);
      logger.error('Failed to clear old sessions:', errorInfo);
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
  app.setName('大海撈Ｂ');
  app.setAboutPanelOptions({
    applicationName: '大海撈Ｂ',
    version: app.getVersion(),
  });
  wireIpc();
  setupAutoUpdater();
  await createWindow();

  // 預先載入 AI 模型，讓 UI 不會顯示「AI 未載入」
  preloadModel().catch((err) => {
    logger.warn('Model preload failed:', err);
  });

  // Check for updates after window is ready (non-blocking)
  if (!isDev) {
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch((err) => {
        logger.warn('Auto-update check failed:', err?.message);
      });
    }, 5000);
  }
});
