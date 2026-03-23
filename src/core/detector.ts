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
import {
  extractArcFaceEmbeddingFromAligned,
  loadArcFace,
  getArcFaceStatus,
  resetArcFace,
} from './arcface';

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
      resetArcFace();
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

    // SCRFD 預設 maxSize=2048；detector 的 raw buffer 必須使用相同的值
    // 否則 SCRFD 的 keypoints 座標空間和 raw buffer 尺寸不匹配，alignment 完全錯誤
    const effectiveMaxSize = options.maxSize ?? 2048;

    // 1. SCRFD 偵測 → SCRFDFace[]（含 bbox [x1,y1,x2,y2] 和 5 kps）
    const scrfdFaces = await withTimeout(
      detectFacesSCRFD(imagePath, {
        minConfidence: confThreshold,
        cropTopFraction: options.cropTopFraction,
        maxSize: effectiveMaxSize,
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
    // 使用 .rotate() 自動根據 EXIF 旋轉，與 SCRFD 保持一致（都在視覺空間）
    let sharpInstance = sharp(imagePath).rotate();

    // 讀取 EXIF orientation，計算旋轉後的有效尺寸
    const meta = await sharp(imagePath).metadata();
    const rawOrientation = meta.orientation || 1;
    const needsSwap = rawOrientation >= 5 && rawOrientation <= 8;
    // 旋轉後 orientation 已變為 1，座標空間已統一
    const exifOrientation = 1;

    if (options.cropTopFraction && options.cropTopFraction > 0 && options.cropTopFraction < 1) {
      const imgW = needsSwap ? (meta.height || 1000) : (meta.width || 1000);
      const imgH = needsSwap ? (meta.width || 1000) : (meta.height || 1000);
      const cropH = Math.round(imgH * options.cropTopFraction);
      sharpInstance = sharp(imagePath)
        .rotate()
        .extract({ left: 0, top: 0, width: imgW, height: cropH });
    }

    // 使用與 SCRFD 相同的 maxSize，確保座標空間一致
    sharpInstance = sharpInstance.resize(effectiveMaxSize, effectiveMaxSize, {
      fit: 'inside',
      withoutEnlargement: true,
    });

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
    let filtered = scrfdFaces
      .filter(f => f.score >= postMinConf)
      .sort((a, b) => b.score - a.score);

    // ── Adaptive confidence filtering ────────────────────────────────────
    // Problem: SCRFD with low minConfidence produces hundreds of false-positive
    // "faces" with scores clustered at ~0.50-0.52 (barely above sigmoid(0)=0.5).
    // Real faces typically score ≥0.6. When we naively take top-20 from 100+
    // candidates, the false positives enter ArcFace and produce random embeddings
    // that can match reference photos at 60-80% by chance — destroying accuracy.
    //
    // Solution: Apply a minimum effective threshold of 0.55. For photos where all
    // detections cluster near 0.50 (no real faces above 0.55), allow the original
    // low threshold so retry logic (crop/zoom attempts) can still find weak faces.
    const ADAPTIVE_MIN_CONF = 0.55;
    if (filtered.length > 0 && filtered[0].score >= ADAPTIVE_MIN_CONF) {
      const beforeCount = filtered.length;
      filtered = filtered.filter(f => f.score >= ADAPTIVE_MIN_CONF);
      if (filtered.length < beforeCount) {
        logger.debug(
          `detectFaces: adaptive filter removed ${beforeCount - filtered.length} low-confidence candidates (kept ${filtered.length} with score≥${ADAPTIVE_MIN_CONF})`
        );
      }
    }

    const candidateFaces = filtered.slice(0, MAX_FACES_PER_IMAGE);

    if (scrfdFaces.length > MAX_FACES_PER_IMAGE) {
      logger.debug(
        `detectFaces: capped ${filtered.length} SCRFD candidates → top ${MAX_FACES_PER_IMAGE} by confidence for ArcFace`
      );
    }

    // 3. 對每個臉依序做 alignment + ArcFace（避免並行 ORT session 競爭）
    //
    // ── High-res re-alignment for small faces ───────────────────────
    // 問題：群組照（4-7 人）中每個小孩的臉在 maxSize=1280 的圖中只有 30-80px，
    //       alignment 到 112×112 時 3-4 倍放大 → 模糊 → ArcFace embedding 品質差。
    // 解法：偵測到小臉後，回到原圖全解析度裁切臉部區域，在高解析度下重做
    //       alignment + ArcFace，大幅提升小臉的 embedding 品質。
    // 注意：SCRFD 偵測仍使用 maxSize（偵測精度足夠），只有 alignment 階段使用高解析度。
    const SMALL_FACE_PX = 112; // 臉部 bbox 短邊 < 此值時啟用高解析度重提取

    // 計算原圖旋轉後的實際尺寸（用於高解析度裁切）
    const origW = needsSwap ? (meta.height || imgW) : (meta.width || imgW);
    const origH = needsSwap ? (meta.width || imgH) : (meta.height || imgH);
    const canDoHiRes = origW > imgW * 1.3 || origH > imgH * 1.3; // 原圖明顯大於 maxSize 版本

    for (let fi = 0; fi < candidateFaces.length; fi++) {
      const face = candidateFaces[fi];

      // 將 bbox 從 [x1, y1, x2, y2] 轉換為 [x, y, width, height]（公開介面格式）
      const [x1, y1, x2, y2] = face.bbox;
      const bboxW = x2 - x1;
      const bboxH = y2 - y1;
      const bbox: [number, number, number, number] = [x1, y1, bboxW, bboxH];
      const faceSize = Math.min(bboxW, bboxH);

      // ── 判斷是否需要高解析度重提取 ──
      const needsHiRes = canDoHiRes && faceSize < SMALL_FACE_PX && faceSize > 5;

      let embedding: number[] | null = null;

      if (needsHiRes) {
        // ── 高解析度路徑：從原圖裁切臉部區域 + 重新偵測 ──
        // 關鍵改進：不只是縮放 keypoints，而是在高解析度裁切上重新跑 SCRFD
        // 以獲得全新的、更精確的 keypoints。低解析度 SCRFD keypoints 有 4-16px 誤差，
        // 即使放大到高解析度，alignment 仍然不準。重新偵測才能根本解決。
        try {
          const scaleX = origW / imgW;
          const scaleY = origH / imgH;

          // 將 SCRFD bbox 從 maxSize 座標空間映射回原圖座標
          const origX1 = x1 * scaleX;
          const origY1 = y1 * scaleY;
          const origX2 = x2 * scaleX;
          const origY2 = y2 * scaleY;
          const origBboxW = origX2 - origX1;
          const origBboxH = origY2 - origY1;
          const origFaceSpan = Math.max(origBboxW, origBboxH);

          // 慷慨的 padding（臉部尺寸的 2 倍，確保完整臉部 + 額頭/下巴/耳朵）
          const pad = Math.max(origFaceSpan * 2, 100);
          const cropLeft = Math.max(0, Math.floor(origX1 - pad));
          const cropTop = Math.max(0, Math.floor(origY1 - pad));
          const cropRight = Math.min(origW, Math.ceil(origX2 + pad));
          const cropBottom = Math.min(origH, Math.ceil(origY2 + pad));
          const cropW = cropRight - cropLeft;
          const cropH = cropBottom - cropTop;

          if (cropW >= 50 && cropH >= 50) {
            // 將高解析度裁切存為臨時 buffer，用 SCRFD 重新偵測
            const cropSharp = sharp(imagePath)
              .rotate()
              .extract({ left: cropLeft, top: cropTop, width: cropW, height: cropH });

            // 將裁切寫入臨時 PNG buffer 供 SCRFD 偵測
            const cropPngBuffer = await cropSharp.png().toBuffer();

            // 在高解析度裁切上重新跑 SCRFD
            // 使用較高的信心門檻（0.55）避免大量 false-positive 浪費時間
            const hiResFaces = await detectFacesSCRFD(cropPngBuffer, {
              minConfidence: ADAPTIVE_MIN_CONF,
              maxSize: Math.max(cropW, cropH), // 不縮小
            });

            if (hiResFaces.length > 0) {
              // 從重新偵測的臉中選最接近原始位置的（避免選到鄰居的臉）
              // 原始臉中心在裁切座標系中的位置
              const origCenterX = (origX1 + origX2) / 2 - cropLeft;
              const origCenterY = (origY1 + origY2) / 2 - cropTop;

              let bestHiResFace = hiResFaces[0];
              let bestDist = Infinity;
              for (const hf of hiResFaces) {
                const hfCenterX = (hf.bbox[0] + hf.bbox[2]) / 2;
                const hfCenterY = (hf.bbox[1] + hf.bbox[3]) / 2;
                const dist = Math.sqrt(
                  (hfCenterX - origCenterX) ** 2 + (hfCenterY - origCenterY) ** 2
                );
                if (dist < bestDist) {
                  bestDist = dist;
                  bestHiResFace = hf;
                }
              }

              // 用重新偵測的高精度 keypoints 做 alignment
              const cropRaw = await sharp(imagePath)
                .rotate()
                .extract({ left: cropLeft, top: cropTop, width: cropW, height: cropH })
                .removeAlpha()
                .raw()
                .toBuffer({ resolveWithObject: true });

              const hiResAligned = await alignFace(
                cropRaw.data,
                cropRaw.info.width,
                cropRaw.info.height,
                bestHiResFace.kps,
                112,
                1
              );

              embedding = await extractArcFaceEmbeddingFromAligned(hiResAligned);

              if (embedding && embedding.length > 0) {
                const hiResFaceSize = Math.min(
                  bestHiResFace.bbox[2] - bestHiResFace.bbox[0],
                  bestHiResFace.bbox[3] - bestHiResFace.bbox[1]
                );
                logger.info(
                  `🔍 Hi-res SCRFD re-detect: face ${faceSize.toFixed(0)}px → ${cropW}×${cropH}px crop, re-detected ${hiResFaces.length} face(s), best=${hiResFaceSize.toFixed(0)}px (${(hiResFaceSize / faceSize).toFixed(1)}× larger): ${imagePath}`
                );
              }
            } else {
              // SCRFD 在高解析度裁切上沒偵測到臉 → 退回 scaled keypoints
              logger.debug(
                `Hi-res SCRFD re-detect found 0 faces in crop, falling back to scaled keypoints`
              );
              const origKps: [number, number][] = face.kps.map(
                ([kx, ky]: [number, number]) => [kx * scaleX, ky * scaleY] as [number, number]
              );
              const cropKps: [number, number][] = origKps.map(
                ([kx, ky]) => [kx - cropLeft, ky - cropTop] as [number, number]
              );
              const cropRaw = await sharp(imagePath)
                .rotate()
                .extract({ left: cropLeft, top: cropTop, width: cropW, height: cropH })
                .removeAlpha()
                .raw()
                .toBuffer({ resolveWithObject: true });

              const hiResAligned = await alignFace(
                cropRaw.data,
                cropRaw.info.width,
                cropRaw.info.height,
                cropKps,
                112,
                1
              );
              embedding = await extractArcFaceEmbeddingFromAligned(hiResAligned);
              if (embedding && embedding.length > 0) {
                logger.info(
                  `🔍 Hi-res scaled-kps fallback: face ${faceSize.toFixed(0)}px → ${cropW}×${cropH}px crop: ${imagePath}`
                );
              }
            }
          }
        } catch (err) {
          // 高解析度失敗不影響流程，退回標準路徑
          logger.debug(
            `Hi-res re-detect failed for face #${fi} in ${imagePath}, falling back to standard: ${err}`
          );
          embedding = null;
        }
      }

      // ── 標準路徑（或高解析度失敗的 fallback）──
      if (!embedding || embedding.length === 0) {
        const alignedBuffer = await alignFace(
          imgRaw.data,
          imgW,
          imgH,
          face.kps,
          112,
          exifOrientation
        );
        embedding = await extractArcFaceEmbeddingFromAligned(alignedBuffer);
      }

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
