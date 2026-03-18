/**
 * 臉部偵測模組
 *
 * 偵測：@vladmandic/face-api SSD MobileNet V1（比 BlazeFace 對亞洲兒童效果更好）
 * 識別：InsightFace ArcFace w600k_mbf ONNX（512 維，對亞洲人臉辨識遠優於 FaceNet）
 *
 * 流程：
 *   sharp 預處理 → face-api SSD MobileNet 偵測 → ArcFace ONNX 提取 512 維特徵
 */

import { logger } from '../utils/logger';
import { AppError } from '../utils/error-handler';
import sharp from 'sharp';
import { extractArcFaceEmbedding, loadArcFace } from './arcface';

export interface FaceDetection {
  bbox: [number, number, number, number]; // x, y, width, height
  embedding: number[]; // 512 維 ArcFace 特徵向量
  confidence: number;
  age?: number;
  gender?: 'male' | 'female';
}

export interface DetectorOptions {
  /** 是否啟用年齡和性別識別（需額外模型，目前保留介面） */
  enableAgeGender?: boolean;
  /** 最小臉部偵測信心度 (0-1) */
  minConfidence?: number;
  /** 圖片縮放最大邊長 */
  maxSize?: number;
  /** 裁切圖片上方比例（0-1），用於全身照中定位臉部區域 */
  cropTopFraction?: number;
  /** 覆蓋偵測器最低信心度門檻（用於最寬鬆重試） */
  overrideDetectorMinConfidence?: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let faceapi: any = null;
let modelLoadAttempted = false;
let modelLoadError: string | null = null;

const FACE_DETECTION_TIMEOUT_MS = 30000;

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutCode: string,
  timeoutMessage: string
): Promise<T> {
  let timer: NodeJS.Timeout | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new AppError(timeoutMessage, timeoutCode)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function resolveFaceApiModelPath(): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { join } = require('path');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { existsSync } = require('fs');

  const devPath = join(process.cwd(), 'node_modules', '@vladmandic', 'face-api', 'model');
  if (existsSync(devPath)) return devPath;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { app } = require('electron');
    const appPath = app.getAppPath();
    const unpackedPath = join(
      appPath.replace('app.asar', 'app.asar.unpacked'),
      'node_modules', '@vladmandic', 'face-api', 'model'
    );
    if (existsSync(unpackedPath)) return unpackedPath;
  } catch {
    // Not in Electron
  }

  throw new Error('face-api model directory not found. Make sure @vladmandic/face-api is installed.');
}

/**
 * 載入 face-api SSD MobileNet（偵測用）
 * 注意：只載入 ssdMobilenetv1，不載入 faceLandmark68Net 或 faceRecognitionNet。
 *       識別功能由獨立的 ArcFace ONNX 模組處理。
 */
async function loadFaceApi() {
  if (faceapi) return faceapi;
  if (modelLoadAttempted) return null;
  modelLoadAttempted = true;

  try {
    logger.info('Loading @vladmandic/face-api SSD MobileNet (detection only)...');

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { join } = require('path');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { existsSync } = require('fs');

    const candidates = [
      join(process.cwd(), 'node_modules', '@vladmandic', 'face-api', 'dist', 'face-api.node-wasm.js'),
      join(process.cwd(), 'node_modules', '@vladmandic', 'face-api', 'dist', 'face-api.node.js'),
    ];

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { app } = require('electron');
      const unpacked = app.getAppPath().replace('app.asar', 'app.asar.unpacked');
      candidates.push(
        join(unpacked, 'node_modules', '@vladmandic', 'face-api', 'dist', 'face-api.node-wasm.js'),
        join(unpacked, 'node_modules', '@vladmandic', 'face-api', 'dist', 'face-api.node.js'),
      );
    } catch {
      // Not in Electron
    }

    for (const c of candidates) {
      logger.info(`face-api candidate: ${c} → ${existsSync(c) ? 'FOUND' : 'NOT FOUND'}`);
    }

    const faceApiPath = candidates.find((c) => existsSync(c));
    if (!faceApiPath) {
      throw new Error(`Cannot find @vladmandic/face-api. Searched:\n${candidates.join('\n')}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const loaded = require(faceApiPath);
    faceapi = loaded.default || loaded;

    // Node.js 環境注入 canvas
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const nodeCanvas = require('canvas');
      faceapi.env.monkeyPatch({
        Canvas: nodeCanvas.Canvas,
        Image: nodeCanvas.Image,
        ImageData: nodeCanvas.ImageData,
      });
      logger.info('Node.js canvas patched into face-api env');
    } catch (canvasErr) {
      logger.warn('canvas npm package not available:', canvasErr);
    }

    const modelPath = resolveFaceApiModelPath();

    // WASM backend 初始化（必須在載入模型前）
    logger.info('Initializing TensorFlow.js backend...');
    await faceapi.tf.ready();
    logger.info(`TF.js backend ready: ${faceapi.tf.getBackend()}`);

    // 只載入偵測模型（SSD MobileNet）
    logger.info(`Loading SSD MobileNet V1 from: ${modelPath}`);
    await faceapi.nets.ssdMobilenetv1.loadFromDisk(modelPath);

    logger.info('face-api SSD MobileNet loaded (detection only)');

    // 同步預熱 ArcFace ONNX（不 await，讓它在背景載入）
    loadArcFace().catch((err) =>
      logger.warn('ArcFace pre-warm failed (will retry on first use):', err)
    );

    return faceapi;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    modelLoadError = message;
    logger.error(`Failed to load face-api SSD MobileNet: ${message}`);
    return null;
  }
}

/**
 * 預先載入模型（app ready 後呼叫）
 */
export async function preloadModel(): Promise<void> {
  try {
    if (modelLoadAttempted && !faceapi) {
      modelLoadAttempted = false;
      modelLoadError = null;
    }
    await loadFaceApi();
  } catch (err) {
    logger.error('Failed to preload face detection model:', err);
  }
}

/**
 * 取得模型載入狀態（供 UI 顯示）
 */
export function getModelStatus(): { loaded: boolean; error: string | null } {
  return {
    loaded: faceapi !== null,
    error: modelLoadError,
  };
}

/**
 * 從圖片偵測臉部，並對每個偵測到的臉部提取 ArcFace 512 維特徵
 */
export async function detectFaces(
  imagePath: string,
  options: DetectorOptions = {}
): Promise<FaceDetection[]> {
  const fa = await loadFaceApi();

  if (!fa) {
    logger.debug('face-api not available, skipping face detection');
    return [];
  }

  try {
    logger.debug(`Processing image for face detection: ${imagePath}`);

    const maxEdge = options.maxSize || 1280;
    let sharpInstance = sharp(imagePath);

    const isHeic =
      imagePath.toLowerCase().endsWith('.heic') || imagePath.toLowerCase().endsWith('.heif');
    if (isHeic) {
      try {
        sharpInstance = sharp(imagePath, { sequentialRead: true });
      } catch (heicError) {
        throw new AppError(
          `HEIC format not supported: ${imagePath}`,
          'HEIC_NOT_SUPPORTED',
          { originalError: heicError }
        );
      }
    }

    // 裁切上方區域（全身照臉部偵測用）
    if (options.cropTopFraction && options.cropTopFraction > 0 && options.cropTopFraction < 1) {
      const meta = await sharp(imagePath).metadata();
      const imgW = meta.width || 1000;
      const imgH = meta.height || 1000;
      const cropH = Math.round(imgH * options.cropTopFraction);
      sharpInstance = sharp(imagePath).extract({ left: 0, top: 0, width: imgW, height: cropH });
    }

    // sharp 預處理 → PNG buffer（偵測與 ArcFace 共用同一張縮放後的圖片）
    const imageBuffer: Buffer = await withTimeout(
      sharpInstance
        .resize(maxEdge, maxEdge, { fit: 'inside', withoutEnlargement: true })
        .png()
        .toBuffer(),
      FACE_DETECTION_TIMEOUT_MS,
      'FACE_DETECTION_TIMEOUT',
      `Image preprocessing timed out for ${imagePath}`
    );

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createCanvas, loadImage } = require('canvas');
    const img = await loadImage(imageBuffer);
    const imgWidth = img.width as number;
    const imgHeight = img.height as number;
    const canvas = createCanvas(imgWidth, imgHeight);
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    ctx.drawImage(img as unknown as HTMLImageElement, 0, 0);

    const minConf = options.overrideDetectorMinConfidence ?? options.minConfidence ?? 0.3;
    const detectionOptions = new fa.SsdMobilenetv1Options({
      minConfidence: minConf,
      maxResults: 10,
    });

    // SSD MobileNet 偵測（只取 bbox + score，不跑 landmark/descriptor）
    const rawDetections = await withTimeout(
      fa.detectAllFaces(canvas, detectionOptions),
      FACE_DETECTION_TIMEOUT_MS,
      'FACE_DETECTION_TIMEOUT',
      `Face detection timed out for ${imagePath}`
    ) as unknown[];

    if (!rawDetections || rawDetections.length === 0) {
      logger.debug(`No faces detected in ${imagePath}`);
      return [];
    }

    logger.debug(`Found ${rawDetections.length} face(s) in ${imagePath}, extracting ArcFace embeddings...`);

    const postMinConf = options.minConfidence ?? 0.01;
    const results: FaceDetection[] = [];

    // 對每個偵測到的臉部依序提取 ArcFace embedding（避免並行 ORT session 競爭）
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const d of rawDetections as any[]) {
      if (d.score < postMinConf) continue;

      const bbox: [number, number, number, number] = [
        d.detection.box.x,
        d.detection.box.y,
        d.detection.box.width,
        d.detection.box.height,
      ];

      const embedding = await extractArcFaceEmbedding(imageBuffer, bbox, imgWidth, imgHeight);

      results.push({
        bbox,
        embedding: embedding ?? [],
        confidence: d.score,
      });
    }

    logger.debug(
      `ArcFace extraction complete for ${imagePath}: ${results.length} face(s) with embeddings`
    );
    return results;
  } catch (err) {
    if (err instanceof AppError && err.code === 'FACE_DETECTION_TIMEOUT') {
      logger.warn(`${err.message}; skipping face detection for this image`);
      return [];
    }
    logger.error(`Face detection failed for ${imagePath}:`, err);
    throw new AppError(
      `Face detection failed for ${imagePath}`,
      'FACE_DETECTION_ERROR',
      { originalError: err }
    );
  }
}

/**
 * 從圖片中提取主要臉部的 ArcFace 特徵向量
 */
export async function extractFaceEmbedding(
  imagePath: string,
  options: DetectorOptions = {}
): Promise<number[] | null> {
  const faces = await detectFaces(imagePath, options);
  if (faces.length === 0) return null;

  const bestFace = faces.reduce((best, current) =>
    current.confidence > best.confidence ? current : best
  );

  return bestFace.embedding.length > 0 ? bestFace.embedding : null;
}
