/**
 * 臉部偵測模組 — 完整 InsightFace Pipeline
 *
 * 偵測：SCRFD det_500m.onnx（取代 SSD MobileNet，偵測精度更高）
 * 對齊：Umeyama 5-point similarity transform（ArcFace 準確率的關鍵）
 * 識別：InsightFace ArcFace w600k_mbf.onnx（512 維特徵向量）
 *
 * 流程：
 *   sharp 預處理 → SCRFD 偵測（bbox + 5 kps）
 *   → Umeyama 5-point alignment → 112×112 aligned face
 *   → ArcFace ONNX 提取 512 維特徵
 *
 * 公開介面（FaceDetection）保持不變，不影響上層 embeddings.ts / main/index.ts。
 */

import { logger } from '../utils/logger';
import { AppError } from '../utils/error-handler';
import sharp from 'sharp';
import { detectFacesSCRFD, loadSCRFD, getSCRFDStatus, resetSCRFD } from './scrfd';
import { alignFace } from './align';
import { extractArcFaceEmbeddingFromAligned, loadArcFace, getArcFaceStatus } from './arcface';

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

let modelLoadAttempted = false;
let modelLoadError: string | null = null;

const FACE_DETECTION_TIMEOUT_MS = 120000; // 增加到 120 秒，小孩照片通常都是高畫質大圖

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
 * 預先載入模型（app ready 後呼叫）
 * 同時載入 SCRFD（偵測）和 ArcFace（識別）
 */
export async function preloadModel(): Promise<void> {
  try {
    if (modelLoadAttempted && modelLoadError) {
      // 允許重試
      modelLoadAttempted = false;
      modelLoadError = null;
      resetSCRFD();
    }
    modelLoadAttempted = true;

    logger.info('Loading InsightFace pipeline: SCRFD (detection) + ArcFace (recognition)...');

    const [scrfdOk, arcfaceOk] = await Promise.all([loadSCRFD(), loadArcFace()]);

    if (!scrfdOk) {
      const status = getSCRFDStatus();
      modelLoadError = `SCRFD load failed: ${status.error}`;
      logger.error(modelLoadError);
      return;
    }

    if (!arcfaceOk) {
      const status = getArcFaceStatus();
      modelLoadError = `ArcFace load failed: ${status.error}`;
      logger.error(modelLoadError);
      return;
    }

    logger.info('InsightFace pipeline loaded: SCRFD + ArcFace ready');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    modelLoadError = message;
    logger.error('Failed to preload InsightFace pipeline:', err);
  }
}

/**
 * 取得模型載入狀態（供 UI 顯示）
 */
export function getModelStatus(): { loaded: boolean; error: string | null } {
  const scrfd = getSCRFDStatus();
  const arcface = getArcFaceStatus();
  return {
    loaded: scrfd.loaded && arcface.loaded,
    error: modelLoadError || scrfd.error || arcface.error,
  };
}

/**
 * 從圖片偵測臉部，並對每個偵測到的臉部提取 ArcFace 512 維特徵
 *
 * Pipeline: SCRFD → 5-point alignment → ArcFace
 */
export async function detectFaces(
  imagePath: string,
  options: DetectorOptions = {}
): Promise<FaceDetection[]> {
  // 確保模型已載入
  const status = getModelStatus();
  if (!status.loaded) {
    await preloadModel();
    const retryStatus = getModelStatus();
    if (!retryStatus.loaded) {
      logger.debug('InsightFace pipeline not available, skipping face detection');
      return [];
    }
  }

  try {
    logger.debug(`Processing image for face detection: ${imagePath}`);

    const confThreshold = options.overrideDetectorMinConfidence ?? options.minConfidence ?? 0.3;

    // 1. SCRFD 偵測 → SCRFDFace[]（含 bbox [x1,y1,x2,y2] 和 5 kps）
    const scrfdFaces = await withTimeout(
      detectFacesSCRFD(imagePath, {
        minConfidence: confThreshold,
        cropTopFraction: options.cropTopFraction,
        maxSize: options.maxSize,
      }),
      FACE_DETECTION_TIMEOUT_MS,
      'FACE_DETECTION_TIMEOUT',
      `Face detection timed out for ${imagePath}`
    );

    if (scrfdFaces.length === 0) {
      logger.debug(`No faces detected in ${imagePath}`);
      return [];
    }

    logger.debug(
      `SCRFD found ${scrfdFaces.length} face(s) in ${imagePath}, running alignment + ArcFace...`
    );

    // 2. 讀取圖片為 raw RGB buffer（alignment 和 ArcFace 共用）
    // 使用 withMetadata({ orientation: undefined }) 禁用自動旋轉，保持與 SCRFD 一致的原始像素空間
    let sharpInstance = sharp(imagePath).withMetadata({ orientation: undefined });

    // 讀取 EXIF orientation，後續需要傳遞給 alignFace
    const meta = await sharp(imagePath).metadata();
    const exifOrientation = meta.orientation || 1;

    if (options.cropTopFraction && options.cropTopFraction > 0 && options.cropTopFraction < 1) {
      const imgW = meta.width || 1000;
      const imgH = meta.height || 1000;
      const cropH = Math.round(imgH * options.cropTopFraction);
      sharpInstance = sharp(imagePath)
        .withMetadata({ orientation: undefined })
        .extract({ left: 0, top: 0, width: imgW, height: cropH });
    }

    if (options.maxSize) {
      sharpInstance = sharpInstance.resize(options.maxSize, options.maxSize, {
        fit: 'inside',
        withoutEnlargement: true,
      });
    }

    const imgRaw = await withTimeout<{ data: Buffer; info: { width: number; height: number } }>(
      sharpInstance.removeAlpha().raw().toBuffer({ resolveWithObject: true }),
      FACE_DETECTION_TIMEOUT_MS,
      'FACE_DETECTION_TIMEOUT',
      `Image preprocessing timed out for ${imagePath}`
    );

    const imgW = imgRaw.info.width;
    const imgH = imgRaw.info.height;
    logger.debug(`Image buffer loaded: ${imgW}x${imgH}, EXIF orientation: ${exifOrientation}`);

    // Post-filter: 用 minConfidence 過濾（可能和 overrideDetectorMinConfidence 不同）
    const postMinConf = options.minConfidence ?? 0.01;
    const results: FaceDetection[] = [];

    // Safety cap: limit ArcFace extractions to top-N faces by confidence.
    // Real photos have at most a few dozen people; if SCRFD returns hundreds of
    // detections (e.g. on screenshots, solid-color images, or low-quality scans)
    // it is a sign of false positives — capping prevents runaway ArcFace iterations.
    const MAX_FACES_PER_IMAGE = 20;
    const candidateFaces = scrfdFaces
      .filter(f => f.score >= postMinConf)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_FACES_PER_IMAGE);

    if (scrfdFaces.length > MAX_FACES_PER_IMAGE) {
      logger.debug(
        `detectFaces: capped ${scrfdFaces.filter(f => f.score >= postMinConf).length} SCRFD candidates → top ${MAX_FACES_PER_IMAGE} by confidence for ArcFace`
      );
    }

    // 3. 對每個臉依序做 alignment + ArcFace（避免並行 ORT session 競爭）
    for (const face of candidateFaces) {
      // 5-point alignment → 112×112 aligned face buffer
      // 傳遞 EXIF orientation，讓 alignFace 可以正確處理座標轉換
      const alignedBuffer = await alignFace(
        imgRaw.data,
        imgW,
        imgH,
        face.kps,
        112,
        exifOrientation
      );

      // ArcFace embedding extraction
      const embedding = await extractArcFaceEmbeddingFromAligned(alignedBuffer);

      // 將 bbox 從 [x1, y1, x2, y2] 轉換為 [x, y, width, height]（公開介面格式）
      const [x1, y1, x2, y2] = face.bbox;
      const bbox: [number, number, number, number] = [x1, y1, x2 - x1, y2 - y1];

      results.push({
        bbox,
        embedding: embedding ?? [],
        confidence: face.score,
      });
    }

    logger.debug(
      `InsightFace pipeline complete for ${imagePath}: ${results.length} face(s) with embeddings`
    );
    return results;
  } catch (err) {
    if (err instanceof AppError && err.code === 'FACE_DETECTION_TIMEOUT') {
      logger.warn(`${err.message}; skipping face detection for this image`);
      return [];
    }
    logger.error(`Face detection failed for ${imagePath}:`, err);
    throw new AppError(`Face detection failed for ${imagePath}`, 'FACE_DETECTION_ERROR', {
      originalError: err,
    });
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
