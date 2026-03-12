/**
 * 臉部偵測模組
 * 使用 @vladmandic/human 進行臉部偵測與特徵提取
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
let hasTfjsNodeBackend = false;

/**
 * 設置 Node.js canvas polyfill（Electron main process 沒有 DOM）
 */
function ensureCanvasPolyfill() {
  if (typeof globalThis.HTMLCanvasElement !== 'undefined') return;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const canvas = require('canvas');
    globalThis.HTMLCanvasElement = canvas.Canvas;
    globalThis.HTMLImageElement = canvas.Image;
    globalThis.ImageData = canvas.ImageData;
    if (typeof globalThis.document === 'undefined') {
      // @ts-expect-error - minimal DOM polyfill for @vladmandic/human
      globalThis.document = {
        createElement: (tag: string) => {
          if (tag === 'canvas') return canvas.createCanvas(100, 100);
          return {};
        },
      };
    }
    logger.info('✅ Canvas polyfill installed for Node.js environment');
  } catch (err: any) {
    logger.error(`❌ canvas package failed to load: ${err?.message || err}`);
    logger.warn('⚠️ Face detection may not work without canvas polyfill');
  }
}

/**
 * 驗證 tfjs-node 是否可用
 */
function checkTfjsNode(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@tensorflow/tfjs-node');
    logger.info('✅ @tensorflow/tfjs-node loaded successfully');
    return true;
  } catch (err: any) {
    logger.error(`❌ @tensorflow/tfjs-node failed to load: ${err?.message || err}`);
    return false;
  }
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
    logger.info(`✅ Using local models from: ${nodeModulesPath}`);
    return `file://${nodeModulesPath.replace(/\\/g, '/')}/`;
  }

  // 2. 打包後的 Electron app 路徑
  try {
    const { app } = require('electron');
    const appPath = app.getAppPath();

    // 2a. asarUnpack 路徑 (app.asar.unpacked/node_modules/...)
    const unpackedPath = join(appPath.replace('app.asar', 'app.asar.unpacked'), 'node_modules', '@vladmandic', 'human', 'models');
    if (existsSync(unpackedPath)) {
      logger.info(`✅ Using unpacked models from: ${unpackedPath}`);
      return `file://${unpackedPath.replace(/\\/g, '/')}/`;
    }

    // 2b. extraResources 中的 models 目錄
    const resourcesModelsPath = join(process.resourcesPath || appPath, 'models');
    if (existsSync(resourcesModelsPath)) {
      logger.info(`✅ Using packaged models from: ${resourcesModelsPath}`);
      return `file://${resourcesModelsPath.replace(/\\/g, '/')}/`;
    }

    // 2c. asar 內的 node_modules（JSON/bin 可從 asar 讀取）
    const asarModulesPath = join(appPath, 'node_modules', '@vladmandic', 'human', 'models');
    if (existsSync(asarModulesPath)) {
      logger.info(`✅ Using asar models from: ${asarModulesPath}`);
      return `file://${asarModulesPath.replace(/\\/g, '/')}/`;
    }
  } catch {
    // Not running inside Electron
  }

  logger.warn('⚠️ Local models not found, using CDN fallback');
  return 'https://cdn.jsdelivr.net/npm/@vladmandic/human/models/';
}

/**
 * 初始化 Human 實例（延遲載入）
 */
async function getHuman() {
  if (humanInstance) return humanInstance;
  if (modelLoadAttempted) return null; // 已嘗試過且失敗

  modelLoadAttempted = true;

  try {
    logger.info('🔄 Loading @vladmandic/human model...');

    // 安裝 canvas polyfill
    ensureCanvasPolyfill();

    // 預先檢查 tfjs-node
    hasTfjsNodeBackend = checkTfjsNode();
    const backend = hasTfjsNodeBackend ? 'tensorflow' : 'cpu';
    if (!hasTfjsNodeBackend) {
      logger.warn('⚠️ Falling back to CPU backend (slower but works without native modules)');
    }

    // 使用 require 載入 — 避免 ESM dynamic import 在 asar 中失敗
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const humanModule = require('@vladmandic/human');
    const Human = humanModule.Human || humanModule.default?.Human || humanModule.default;

    if (!Human) {
      throw new Error('@vladmandic/human module loaded but Human class not found');
    }

    const modelBasePath = resolveModelBasePath();

    humanInstance = new Human({
      modelBasePath,
      backend,
      cacheSensitivity: 0,
      filter: { enabled: false }, // 不使用 canvas filter（Node.js 環境不需要）
      face: {
        enabled: true,
        detector: { enabled: true, modelPath: 'blazeface.json', maxDetected: 10 },
        mesh: { enabled: false },
        iris: { enabled: false },
        emotion: { enabled: false },
        description: { enabled: true, modelPath: 'faceres.json' }, // 1024-dim embedding
        antispoof: { enabled: false },
      },
      body: { enabled: false },
      hand: { enabled: false },
      gesture: { enabled: false },
      segmentation: { enabled: false },
      object: { enabled: false },
    });

    logger.info('✅ @vladmandic/human model loaded and ready!');
    return humanInstance;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    modelLoadError = message;
    logger.error(`❌ Failed to load @vladmandic/human: ${message}`);
    logger.error('❌ Face detection will NOT work. All photos will get deterministic (non-face) embeddings.');
    logger.error('❌ This means photo matching will NOT produce meaningful results!');
    return null;
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
 * 將圖片 buffer 轉換為 tensor（支援 tfjs-node 和 CPU 兩種 backend）
 */
async function bufferToTensor(human: any, imageBuffer: Buffer) {
  // tfjs-node backend: 使用 node.decodeImage（快速）
  if (hasTfjsNodeBackend && human.tf?.node?.decodeImage) {
    return human.tf.node.decodeImage(imageBuffer, 3);
  }

  // CPU backend fallback: 手動解碼 JPEG buffer 為 pixel data
  // 使用 sharp 解碼為 raw RGB pixels，再建立 tensor
  const { data, info } = await sharp(imageBuffer)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  // 建立 3D tensor [height, width, channels]
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

  // 如果 Human 未載入，回傳空陣列（將使用 deterministic embedding 作為 fallback）
  if (!human) {
    logger.debug('Human model not available, skipping face detection');
    return [];
  }

  try {
    logger.debug(`Processing image for face detection: ${imagePath}`);

    // Handle different image formats
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

    const imageBuffer = await sharpInstance
      .resize(640, 640, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();

    // 將圖片轉換為 tensor（自動選擇 tfjs-node 或 CPU fallback）
    const tensor = await bufferToTensor(human, imageBuffer);
    const result = await human.detect(tensor);
    tensor.dispose(); // 釋放記憶體

    const detections: FaceDetection[] = [];
    const { enableAgeGender = true, minConfidence = 0.3 } = options;

    if (result.face && result.face.length > 0) {
      logger.debug(`Found ${result.face.length} face(s) in ${imagePath}`);

      for (const face of result.face) {
        if (face.score < minConfidence) {
          logger.debug(`Skipping face with low confidence: ${face.score} < ${minConfidence}`);
          continue;
        }

        // 提取特徵向量
        let embedding: number[] = [];
        if (face.embedding && face.embedding.length > 0) {
          embedding = Array.from(face.embedding);
        }

        // @vladmandic/human face.box 格式: [x, y, width, height]
        const bbox: [number, number, number, number] = [
          face.box[0], // x
          face.box[1], // y
          face.box[2], // width
          face.box[3], // height
        ];

        const detection: FaceDetection = {
          bbox,
          embedding: embedding.length > 0 ? embedding : [],
          confidence: face.score,
        };

        // 年齡和性別
        if (enableAgeGender && face.age != null) {
          detection.age = Math.round(face.age);
        }
        if (enableAgeGender && face.gender != null) {
          // @vladmandic/human returns gender as string 'male'/'female'
          detection.gender = typeof face.gender === 'string' ? face.gender : (face.gender === 0 ? 'female' : 'male');
        }

        detections.push(detection);
      }
    } else {
      logger.debug(`No faces detected in ${imagePath}`);
    }

    return detections;
  } catch (err) {
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

  // 使用信心度最高的臉部
  const bestFace = faces.reduce((best, current) =>
    current.confidence > best.confidence ? current : best
  );

  return bestFace.embedding.length > 0 ? bestFace.embedding : null;
}
