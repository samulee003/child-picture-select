/**
 * 臉部偵測模組
 * 使用 @vladmandic/face-api (SSD MobileNet V1) 進行臉部偵測與特徵提取
 * SSD MobileNet 對亞洲兒童臉部的偵測率優於 BlazeFace，尤其在角度、遮擋和不同膚色場景下。
 * 特徵向量由 FaceNet recognition model 輸出 128 維，以 canvas npm package 作為 Node.js 環境支援。
 */

import { logger } from '../utils/logger';
import { AppError } from '../utils/error-handler';
import sharp from 'sharp';

export interface FaceDetection {
  bbox: [number, number, number, number]; // x, y, width, height
  embedding: number[]; // 128 維特徵向量 (FaceNet)
  confidence: number;
  age?: number;
  gender?: 'male' | 'female';
}

export interface DetectorOptions {
  /** 是否啟用年齡和性別識別 */
  enableAgeGender?: boolean;
  /** 最小臉部偵測信心度 (0-1) */
  minConfidence?: number;
  /** 圖片縮放最大邊長（越大越能偵測小臉，但越慢） */
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
let ageGenderLoaded = false;

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

/**
 * 解析 @vladmandic/face-api 模型目錄路徑（含開發模式與 Electron 打包路徑）
 */
function resolveModelPath(): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { join } = require('path');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { existsSync } = require('fs');

  const devPath = join(process.cwd(), 'node_modules', '@vladmandic', 'face-api', 'model');
  if (existsSync(devPath)) {
    logger.info(`Using face-api models from: ${devPath}`);
    return devPath;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { app } = require('electron');
    const appPath = app.getAppPath();

    const unpackedPath = join(
      appPath.replace('app.asar', 'app.asar.unpacked'),
      'node_modules', '@vladmandic', 'face-api', 'model'
    );
    if (existsSync(unpackedPath)) {
      logger.info(`Using unpacked face-api models from: ${unpackedPath}`);
      return unpackedPath;
    }

    const asarPath = join(appPath, 'node_modules', '@vladmandic', 'face-api', 'model');
    if (existsSync(asarPath)) {
      logger.info(`Using asar face-api models from: ${asarPath}`);
      return asarPath;
    }
  } catch {
    // Not in Electron
  }

  throw new Error(
    'face-api model directory not found. Make sure @vladmandic/face-api is installed.'
  );
}

/**
 * 初始化 face-api 並載入所需模型
 * - ssdMobilenetv1: 臉部偵測（比 BlazeFace 對多族裔/兒童效果更好）
 * - faceLandmark68Net: 68 特徵點（對齊後供 recognition model 使用）
 * - faceRecognitionNet: 128 維特徵向量 (FaceNet)
 */
async function loadFaceApi() {
  if (faceapi) return faceapi;
  if (modelLoadAttempted) return null;

  modelLoadAttempted = true;

  try {
    logger.info('Loading @vladmandic/face-api (SSD MobileNet + FaceNet)...');

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { join } = require('path');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { existsSync } = require('fs');

    // 優先使用 node-wasm build（自含 WASM，不依賴 tfjs-node native bindings）
    const candidates = [
      join(process.cwd(), 'node_modules', '@vladmandic', 'face-api', 'dist', 'face-api.node-wasm.js'),
      join(process.cwd(), 'node_modules', '@vladmandic', 'face-api', 'dist', 'face-api.node.js'),
    ];

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { app } = require('electron');
      const appPath = app.getAppPath();
      const unpacked = appPath.replace('app.asar', 'app.asar.unpacked');
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

    const faceApiPath = candidates.find(c => existsSync(c));
    if (!faceApiPath) {
      throw new Error(`Cannot find @vladmandic/face-api build. Searched:\n${candidates.join('\n')}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const loaded = require(faceApiPath);
    faceapi = loaded.default || loaded;

    // 在 Node.js 環境中注入 canvas 實作（face-api 需要 DOM Canvas API）
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const nodeCanvas = require('canvas');
      faceapi.env.monkeyPatch({
        Canvas: nodeCanvas.Canvas,
        Image: nodeCanvas.Image,
        ImageData: nodeCanvas.ImageData,
      });
      logger.info('Node.js canvas package patched into face-api env');
    } catch (canvasErr) {
      logger.warn('canvas npm package not available, face detection may be limited:', canvasErr);
    }

    const modelPath = resolveModelPath();

    // WASM backend 必須在載入模型前完成初始化
    logger.info('Initializing TensorFlow.js backend...');
    await faceapi.tf.ready();
    logger.info(`TF.js backend ready: ${faceapi.tf.getBackend()}`);

    logger.info(`Loading SSD MobileNet V1 from: ${modelPath}`);
    await faceapi.nets.ssdMobilenetv1.loadFromDisk(modelPath);

    logger.info(`Loading FaceLandmark68Net from: ${modelPath}`);
    await faceapi.nets.faceLandmark68Net.loadFromDisk(modelPath);

    logger.info(`Loading FaceRecognitionNet from: ${modelPath}`);
    await faceapi.nets.faceRecognitionNet.loadFromDisk(modelPath);

    logger.info('@vladmandic/face-api loaded and ready (SSD MobileNet + FaceNet 128-dim)');
    return faceapi;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    modelLoadError = message;
    logger.error(`Failed to load @vladmandic/face-api: ${message}`);
    logger.error('Face detection will NOT work. Photos will get deterministic embeddings.');
    return null;
  }
}

/**
 * 延遲載入 AgeGender 模型（僅在 enableAgeGender 時載入，節省記憶體）
 */
async function ensureAgeGenderModel(fa: NonNullable<typeof faceapi>): Promise<void> {
  if (ageGenderLoaded) return;
  try {
    const modelPath = resolveModelPath();
    await fa.nets.ageGenderNet.loadFromDisk(modelPath);
    ageGenderLoaded = true;
    logger.info('AgeGenderNet loaded');
  } catch (err) {
    logger.warn('AgeGenderNet not available (optional):', err);
  }
}

/**
 * 預先載入模型（在 app ready 後呼叫，讓 UI 不顯示「AI 未載入」）
 * 允許重試：如果之前失敗，會重置狀態再嘗試
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
 * 從圖片檔案偵測臉部並提取特徵
 * 使用 SSD MobileNet V1 偵測 → FaceLandmark68 對齊 → FaceRecognitionNet 128-dim 特徵
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
          `HEIC format not supported for face detection: ${imagePath}`,
          'HEIC_NOT_SUPPORTED',
          { originalError: heicError }
        );
      }
    }

    // 若指定裁切比例，先裁切圖片上方區域（適用於全身照中臉部偵測）
    if (options.cropTopFraction && options.cropTopFraction > 0 && options.cropTopFraction < 1) {
      const meta = await sharp(imagePath).metadata();
      const imgWidth = meta.width || 1000;
      const imgHeight = meta.height || 1000;
      const cropHeight = Math.round(imgHeight * options.cropTopFraction);
      sharpInstance = sharp(imagePath).extract({
        left: 0,
        top: 0,
        width: imgWidth,
        height: cropHeight,
      });
    }

    const imageBuffer = await withTimeout(
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
    const canvas = createCanvas(img.width as number, img.height as number);
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    ctx.drawImage(img as unknown as HTMLImageElement, 0, 0);

    // 使用 overrideDetectorMinConfidence（最寬鬆重試）或 minConfidence，預設 0.3
    const minConf =
      options.overrideDetectorMinConfidence ?? options.minConfidence ?? 0.3;

    const detectionOptions = new fa.SsdMobilenetv1Options({
      minConfidence: minConf,
      maxResults: 10,
    });

    let detections: unknown[];
    if (options.enableAgeGender) {
      await ensureAgeGenderModel(fa);
      detections = await withTimeout(
        fa.detectAllFaces(canvas, detectionOptions)
          .withFaceLandmarks()
          .withAgeAndGender()
          .withFaceDescriptors(),
        FACE_DETECTION_TIMEOUT_MS,
        'FACE_DETECTION_TIMEOUT',
        `Face detection timed out for ${imagePath}`
      );
    } else {
      detections = await withTimeout(
        fa.detectAllFaces(canvas, detectionOptions)
          .withFaceLandmarks()
          .withFaceDescriptors(),
        FACE_DETECTION_TIMEOUT_MS,
        'FACE_DETECTION_TIMEOUT',
        `Face detection timed out for ${imagePath}`
      );
    }

    if (!detections || detections.length === 0) {
      logger.debug(`No faces detected in ${imagePath}`);
      return [];
    }

    logger.debug(`Found ${detections.length} face(s) in ${imagePath}`);

    const postMinConf = options.minConfidence ?? 0.01;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results: FaceDetection[] = (detections as any[])
      .filter((d) => d.detection.score >= postMinConf)
      .map((d) => {
        const detection: FaceDetection = {
          bbox: [
            d.detection.box.x,
            d.detection.box.y,
            d.detection.box.width,
            d.detection.box.height,
          ],
          embedding: Array.from(d.descriptor as Float32Array),
          confidence: d.detection.score,
        };
        if (options.enableAgeGender && d.age != null) {
          detection.age = Math.round(d.age as number);
        }
        if (options.enableAgeGender && d.gender != null) {
          detection.gender = (d.gender as string) === 'male' ? 'male' : 'female';
        }
        return detection;
      });

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
 * 從圖片中提取主要臉部的特徵向量（用於比對）
 * 如果沒有偵測到臉部，回傳 null
 */
export async function extractFaceEmbedding(
  imagePath: string,
  options: DetectorOptions = {}
): Promise<number[] | null> {
  const faces = await detectFaces(imagePath, options);

  if (faces.length === 0) {
    return null;
  }

  const bestFace = faces.reduce((best, current) =>
    current.confidence > best.confidence ? current : best
  );

  return bestFace.embedding.length > 0 ? bestFace.embedding : null;
}
