/**
 * 臉部偵測模組
 * 使用 @vladmandic/human (WASM backend) 進行臉部偵測與特徵提取
 * 不依賴 @tensorflow/tfjs-node 或 canvas，安裝包更小更穩定
 */

import { logger } from '../utils/logger';
import { AppError } from '../utils/error-handler';
import sharp from 'sharp';

export interface FaceDetection {
  bbox: [number, number, number, number]; // x, y, width, height
  embedding: number[]; // 1024 維特徵向量 (faceres model)
  confidence: number;
  age?: number;
  gender?: 'male' | 'female';
}

export interface DetectorOptions {
  /** 是否啟用年齡和性別識別 */
  enableAgeGender?: boolean;
  /** 最小臉部偵測信心度 (0-1) */
  minConfidence?: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let humanInstance: any = null;
let modelLoadAttempted = false;
let modelLoadError: string | null = null;
const FACE_DETECTION_TIMEOUT_MS = 30000;
type DisposableTensor = { dispose: () => void };

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutCode: string, timeoutMessage: string): Promise<T> {
  let timer: NodeJS.Timeout | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(new AppError(timeoutMessage, timeoutCode));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * 解析 WASM 二進位檔案路徑
 */
function resolveWasmPath(): string {
  const { join } = require('path');
  const { existsSync } = require('fs');

  // 開發模式
  const devPath = join(process.cwd(), 'node_modules', '@tensorflow', 'tfjs-backend-wasm', 'dist');
  if (existsSync(join(devPath, 'tfjs-backend-wasm.wasm'))) {
    logger.info(`Using WASM from: ${devPath}`);
    return devPath + '/';
  }

  // 打包後 — asarUnpack 路徑
  try {
    const { app } = require('electron');
    const appPath = app.getAppPath();
    const unpackedPath = join(
      appPath.replace('app.asar', 'app.asar.unpacked'),
      'node_modules', '@tensorflow', 'tfjs-backend-wasm', 'dist'
    );
    if (existsSync(join(unpackedPath, 'tfjs-backend-wasm.wasm'))) {
      logger.info(`Using WASM from: ${unpackedPath}`);
      return unpackedPath + '/';
    }
  } catch {
    // Not in Electron
  }

  return '';
}

/**
 * 解析模型路徑，支援開發模式和打包後的 Electron
 */
function resolveModelBasePath(): string {
  const { join } = require('path');
  const { existsSync } = require('fs');

  // 1. 開發模式：node_modules 中的模型
  const nodeModulesPath = join(process.cwd(), 'node_modules', '@vladmandic', 'human', 'models');
  if (existsSync(nodeModulesPath)) {
    logger.info(`Using models from: ${nodeModulesPath}`);
    return `file://${nodeModulesPath.replace(/\\/g, '/')}/`;
  }

  // 2. 打包後的 Electron app 路徑
  try {
    const { app } = require('electron');
    const appPath = app.getAppPath();

    // asarUnpack 路徑
    const unpackedPath = join(
      appPath.replace('app.asar', 'app.asar.unpacked'),
      'node_modules', '@vladmandic', 'human', 'models'
    );
    if (existsSync(unpackedPath)) {
      logger.info(`Using unpacked models from: ${unpackedPath}`);
      return `file://${unpackedPath.replace(/\\/g, '/')}/`;
    }

    // extraResources
    const resourcesModelsPath = join(process.resourcesPath || appPath, 'models');
    if (existsSync(resourcesModelsPath)) {
      logger.info(`Using packaged models from: ${resourcesModelsPath}`);
      return `file://${resourcesModelsPath.replace(/\\/g, '/')}/`;
    }

    // asar 內 (JSON 可讀)
    const asarModulesPath = join(appPath, 'node_modules', '@vladmandic', 'human', 'models');
    if (existsSync(asarModulesPath)) {
      logger.info(`Using asar models from: ${asarModulesPath}`);
      return `file://${asarModulesPath.replace(/\\/g, '/')}/`;
    }
  } catch {
    // Not in Electron
  }

  logger.warn('Local models not found, using CDN fallback');
  return 'https://cdn.jsdelivr.net/npm/@vladmandic/human/models/';
}

/**
 * 初始化 Human 實例（延遲載入，WASM backend）
 */
async function getHuman() {
  if (humanInstance) return humanInstance;
  if (modelLoadAttempted) return null;

  modelLoadAttempted = true;

  try {
    logger.info('Loading @vladmandic/human model (WASM backend)...');

    // 載入 WASM 版本 — 不依賴 tfjs-node，無 native bindings
    // 動態構建路徑，避免 Node.js exports 限制和 tsup 靜態分析
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { join } = require('path');
    const { existsSync } = require('fs');
    const humanWasmFile = ['dist', 'human.node-wasm.js'].join('/');
    const candidates = [
      join(process.cwd(), 'node_modules', '@vladmandic', 'human', humanWasmFile),
    ];
    // Electron 打包路徑
    try {
      const { app } = require('electron');
      const appPath = app.getAppPath();
      candidates.push(
        join(appPath.replace('app.asar', 'app.asar.unpacked'), 'node_modules', '@vladmandic', 'human', humanWasmFile),
        join(appPath, 'node_modules', '@vladmandic', 'human', humanWasmFile),
      );
    } catch { /* not in Electron */ }
    const wasmEntry = candidates.find(c => existsSync(c));
    if (!wasmEntry) throw new Error('Cannot find @vladmandic/human WASM build');
    const humanModule = require(wasmEntry);
    const Human = humanModule.Human || humanModule.default?.Human || humanModule.default;

    if (!Human) {
      throw new Error('@vladmandic/human module loaded but Human class not found');
    }

    // 配置 WASM 路徑
    const wasmPath = resolveWasmPath();
    const modelBasePath = resolveModelBasePath();

    humanInstance = new Human({
      modelBasePath,
      backend: 'wasm',
      wasmPath,
      cacheSensitivity: 0,
      filter: { enabled: false },
      face: {
        enabled: true,
        detector: { enabled: true, modelPath: 'blazeface.json', maxDetected: 10 },
        mesh: { enabled: false },
        iris: { enabled: false },
        emotion: { enabled: false },
        description: { enabled: true, modelPath: 'faceres.json' },
        antispoof: { enabled: false },
      },
      body: { enabled: false },
      hand: { enabled: false },
      gesture: { enabled: false },
      segmentation: { enabled: false },
      object: { enabled: false },
    });

    logger.info('@vladmandic/human model loaded and ready (WASM backend)');
    return humanInstance;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    modelLoadError = message;
    logger.error(`Failed to load @vladmandic/human: ${message}`);
    logger.error('Face detection will NOT work. Photos will get deterministic embeddings.');
    return null;
  }
}

/**
 * 預先載入模型（在 app ready 後呼叫，讓 UI 不會顯示「AI 未載入」）
 */
export async function preloadModel(): Promise<void> {
  try {
    await getHuman();
  } catch (err) {
    logger.error('Failed to preload face detection model:', err);
  }
}

/**
 * 取得模型載入狀態（供 UI 顯示）
 */
export function getModelStatus(): { loaded: boolean; error: string | null } {
  return {
    loaded: humanInstance !== null,
    error: modelLoadError,
  };
}

/**
 * 將圖片 buffer 轉為 tensor（使用 sharp 解碼 + human.tf）
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function bufferToTensor(human: any, imageBuffer: Buffer) {
  const { data, info } = await sharp(imageBuffer)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  return human.tf.tensor3d(
    new Uint8Array(data.buffer, data.byteOffset, data.byteLength),
    [height, width, channels]
  );
}

/**
 * 從圖片檔案偵測臉部並提取特徵
 */
export async function detectFaces(
  imagePath: string,
  options: DetectorOptions = {}
): Promise<FaceDetection[]> {
  const human = await getHuman();

  if (!human) {
    logger.debug('Human model not available, skipping face detection');
    return [];
  }

  try {
    logger.debug(`Processing image for face detection: ${imagePath}`);

    let sharpInstance = sharp(imagePath);
    const isHeic = imagePath.toLowerCase().endsWith('.heic') || imagePath.toLowerCase().endsWith('.heif');

    if (isHeic) {
      try {
        sharpInstance = sharp(imagePath, { sequentialRead: true });
      } catch (heicError) {
        logger.warn(`Failed to process HEIC file ${imagePath}:`, heicError);
        throw new AppError(
          `HEIC format not supported for face detection: ${imagePath}`,
          'HEIC_NOT_SUPPORTED',
          { originalError: heicError }
        );
      }
    }

    const imageBuffer = await withTimeout<Buffer>(
      sharpInstance
        .resize(640, 640, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer(),
      FACE_DETECTION_TIMEOUT_MS,
      'FACE_DETECTION_TIMEOUT',
      `Image preprocessing timed out for ${imagePath}`
    );

    const tensor = await withTimeout<DisposableTensor>(
      bufferToTensor(human, imageBuffer),
      FACE_DETECTION_TIMEOUT_MS,
      'FACE_DETECTION_TIMEOUT',
      `Tensor conversion timed out for ${imagePath}`
    );
    let result: any;
    try {
      result = await withTimeout(
        human.detect(tensor),
        FACE_DETECTION_TIMEOUT_MS,
        'FACE_DETECTION_TIMEOUT',
        `Face detection timed out for ${imagePath}`
      );
    } finally {
      tensor.dispose(); // 釋放記憶體
    }

    const detections: FaceDetection[] = [];
    const { enableAgeGender = true, minConfidence = 0.3 } = options;

    if (result.face && result.face.length > 0) {
      logger.debug(`Found ${result.face.length} face(s) in ${imagePath}`);

      for (const face of result.face) {
        if (face.score < minConfidence) {
          logger.debug(`Skipping face with low confidence: ${face.score} < ${minConfidence}`);
          continue;
        }

        let embedding: number[] = [];
        if (face.embedding && face.embedding.length > 0) {
          embedding = Array.from(face.embedding);
        }

        const bbox: [number, number, number, number] = [
          face.box[0],
          face.box[1],
          face.box[2],
          face.box[3],
        ];

        const detection: FaceDetection = {
          bbox,
          embedding: embedding.length > 0 ? embedding : [],
          confidence: face.score,
        };

        if (enableAgeGender && face.age != null) {
          detection.age = Math.round(face.age);
        }
        if (enableAgeGender && face.gender != null) {
          detection.gender = typeof face.gender === 'string' ? face.gender : (face.gender === 0 ? 'female' : 'male');
        }

        detections.push(detection);
      }
    } else {
      logger.debug(`No faces detected in ${imagePath}`);
    }

    return detections;
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
