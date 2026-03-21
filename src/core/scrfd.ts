/**
 * SCRFD 臉部偵測模組（InsightFace det_500m.onnx）
 *
 * 使用 onnxruntime-node 在本地執行 SCRFD（Sample and Computation Redistribution
 * Face Detector）輕量模型，偵測臉部 bounding box 和 5 個特徵點（keypoints）。
 *
 * 模型：det_500m.onnx（0.5 GF, WIDER FACE 訓練集）
 * 輸入：[1, 3, 640, 640] float32，BGR 通道順序，（pixel - 127.5) / 128.0 正規化
 * 輸出：9 個 tensor（每個 stride {8, 16, 32} 各 3 個：score, bbox, kps）
 *
 * 偵測流程：
 *   1. sharp 讀取 → 可選裁切 → 可選縮放 → raw RGB
 *   2. Resize 到 640x640（不保持比例）
 *   3. 轉換為 NCHW float32，BGR 通道，（px-127.5)/128.0
 *   4. ONNX 推論
 *   5. 解析輸出：score（sigmoid）、bbox（distance-based）、kps
 *   6. 置信度過濾 → NMS（IoU 0.4）
 */

import sharp from 'sharp';
import { logger } from '../utils/logger';
import { createSessionWithGpu as createOnnxSession } from './onnx-gpu';

export interface SCRFDFace {
  bbox: [number, number, number, number]; // [x1, y1, x2, y2] in original image space
  kps: [number, number][]; // 5 keypoints [x, y] in original image space
  score: number;
  orientation?: number; // EXIF orientation (1-8), for coordinate transformation
}

const MODEL_FILENAME = 'det_500m.onnx';
const INPUT_SIZE = 640;
const SCRFD_MEAN = 127.5;
const SCRFD_STD = 128.0; // NOTE: SCRFD uses 128, not 127.5
const STRIDES = [8, 16, 32];
const ANCHORS_PER_CELL = 2;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let ort: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let session: any = null;
let sessionLoadAttempted = false;
let sessionLoadError: string | null = null;

function resolveModelPath(): string | null {
  const { join } = require('path');
  const { existsSync } = require('fs');

  const candidates: string[] = [join(process.cwd(), 'models', 'insightface', MODEL_FILENAME)];

  try {
    const { app } = require('electron');
    const resourcesPath: string =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (process as any).resourcesPath || join(app.getAppPath(), '..', 'resources');
    candidates.push(join(resourcesPath, 'models', 'insightface', MODEL_FILENAME));
  } catch {
    // Not in Electron
  }

  const found = candidates.find(p => existsSync(p));
  if (found) {
    logger.info(`SCRFD model found: ${found}`);
    return found;
  }

  logger.warn(
    `SCRFD model not found (${MODEL_FILENAME}). Run 'npm run download-models' to download it.\n` +
      `Searched:\n${candidates.join('\n')}`
  );
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function requireOrt(): any {
  const { join } = require('path');
  const { existsSync } = require('fs');

  const candidates: string[] = [join(process.cwd(), 'node_modules', 'onnxruntime-node')];

  try {
    const { app } = require('electron');
    // 使用正則表達式替換所有 app.asar（處理 Windows 反斜杠路徑）
    const appPath = app.getAppPath().replace(/app\.asar/g, 'app.asar.unpacked');
    candidates.push(join(appPath, 'node_modules', 'onnxruntime-node'));

    // 額外檢查 resourcesPath 路徑（更可靠的打包後路徑）
    const resourcesPath = (process as any).resourcesPath;
    if (resourcesPath) {
      candidates.push(join(resourcesPath, 'app.asar.unpacked', 'node_modules', 'onnxruntime-node'));
    }
  } catch {
    // Not in Electron
  }

  const found = candidates.find(p => existsSync(p));
  if (found) {
    return require(found);
  }
  return require('onnxruntime-node');
}

/**
 * 載入 SCRFD ONNX 推論 session
 */
export async function loadSCRFD(): Promise<boolean> {
  if (session) return true;
  if (sessionLoadAttempted) {
    logger.warn(`SCRFD load previously failed: ${sessionLoadError ?? 'unknown error'}`);
    return false;
  }
  sessionLoadAttempted = true;

  try {
    const modelPath = resolveModelPath();
    if (!modelPath) {
      sessionLoadError = `SCRFD model not found (${MODEL_FILENAME}). Run 'npm run download-models'.`;
      logger.error(`❌ ${sessionLoadError}`);
      return false;
    }

    ort = requireOrt();

    logger.info('Initializing SCRFD ONNX session (InsightFace det_500m)...');
    session = await createOnnxSession(ort, modelPath, 'SCRFD');

    logger.info(
      `✅ SCRFD loaded. Input: [${session.inputNames}] → Output: [${session.outputNames}] (${session.outputNames.length} tensors)`
    );
    return true;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    sessionLoadError = message;
    logger.error(`❌ Failed to load SCRFD ONNX: ${message}`);
    return false;
  }
}

export function getSCRFDStatus(): { loaded: boolean; error: string | null } {
  return { loaded: session !== null, error: sessionLoadError };
}

/**
 * 允許重新載入（用於 preloadModel retry）
 */
export function resetSCRFD(): void {
  session = null;
  sessionLoadAttempted = false;
  sessionLoadError = null;
}

/**
 * 生成 anchor 中心座標
 */
function generateAnchors(featH: number, featW: number, stride: number): [number, number][] {
  const anchors: [number, number][] = [];
  for (let row = 0; row < featH; row++) {
    for (let col = 0; col < featW; col++) {
      for (let k = 0; k < ANCHORS_PER_CELL; k++) {
        // InsightFace SCRFD 使用 cell 中心點（+0.5），而非 cell 左上角
        anchors.push([(col + 0.5) * stride, (row + 0.5) * stride]);
      }
    }
  }
  return anchors;
}

/**
 * IoU 計算
 */
function computeIoU(
  a: [number, number, number, number],
  b: [number, number, number, number]
): number {
  const ix1 = Math.max(a[0], b[0]);
  const iy1 = Math.max(a[1], b[1]);
  const ix2 = Math.min(a[2], b[2]);
  const iy2 = Math.min(a[3], b[3]);
  const inter = Math.max(0, ix2 - ix1) * Math.max(0, iy2 - iy1);
  const areaA = (a[2] - a[0]) * (a[3] - a[1]);
  const areaB = (b[2] - b[0]) * (b[3] - b[1]);
  return inter / (areaA + areaB - inter + 1e-12);
}

/**
 * NMS（Non-Maximum Suppression）
 */
function nms(faces: SCRFDFace[], iouThreshold: number): SCRFDFace[] {
  const sorted = [...faces].sort((a, b) => b.score - a.score);
  const keep: SCRFDFace[] = [];

  const suppressed = new Set<number>();
  for (let i = 0; i < sorted.length; i++) {
    if (suppressed.has(i)) continue;
    keep.push(sorted[i]);
    for (let j = i + 1; j < sorted.length; j++) {
      if (suppressed.has(j)) continue;
      if (computeIoU(sorted[i].bbox, sorted[j].bbox) > iouThreshold) {
        suppressed.add(j);
      }
    }
  }
  return keep;
}

/**
 * SCRFD 臉部偵測
 *
 * @param imagePath  圖片路徑
 * @param options    偵測參數
 * @returns 偵測到的臉部列表（含 bbox、kps、score，座標在原圖空間）
 */
export async function detectFacesSCRFD(
  imagePath: string,
  options: {
    minConfidence?: number;
    inputSize?: number;
    cropTopFraction?: number;
    maxSize?: number;
  } = {}
): Promise<SCRFDFace[]> {
  if (!session) {
    const loaded = await loadSCRFD();
    if (!loaded) {
      throw new Error(
        `SCRFD model not available: ${sessionLoadError ?? 'unknown error'}. Please restart the app.`
      );
    }
  }

  const confThreshold = options.minConfidence ?? 0.3;
  const inputSize = options.inputSize ?? INPUT_SIZE;
  // 默認最大尺寸限制，避免處理超大圖導致內存不足或超時
  const maxSize = options.maxSize ?? 2048;

  try {
    logger.debug(`SCRFD processing: ${imagePath}, maxSize=${maxSize}, inputSize=${inputSize}`);
    const startTime = Date.now();

    // 1. 讀取圖片元數據（包括 EXIF orientation）
    const meta = await sharp(imagePath).metadata();
    const originalW = meta.width || 1000;
    const originalH = meta.height || 1000;
    const orientation = meta.orientation || 1;
    logger.debug(`Original image size: ${originalW}x${originalH}, orientation: ${orientation}`);

    // 根據 EXIF orientation 計算實際處理時的寬高
    // 策略：禁用自動旋轉，讓整個 pipeline 使用原始像素空間
    // 這樣 KPS 座標和 raw buffer 始終在同一座標空間
    const needsSwap = orientation >= 5 && orientation <= 8; // 5-8 表示 90/270 度旋轉
    if (needsSwap) {
      logger.debug(
        `EXIF orientation=${orientation}: will keep original pixel space, KPS will be adjusted in alignFace if needed`
      );
    }

    // 2. 建立處理鏈（禁用自動旋轉，保持原始像素空間）
    let sharpInstance = sharp(imagePath).withMetadata({ orientation: undefined });

    // 3. 如果需要裁切上方區域（全身照）
    // 使用 originalW/H（原始像素空間）
    let effectiveW = originalW;
    let effectiveH = originalH;
    if (options.cropTopFraction && options.cropTopFraction > 0 && options.cropTopFraction < 1) {
      const cropH = Math.round(originalH * options.cropTopFraction);
      sharpInstance = sharpInstance.extract({ left: 0, top: 0, width: originalW, height: cropH });
      effectiveH = cropH;
      logger.debug(
        `Cropped top ${options.cropTopFraction * 100}% (cropH=${cropH}, originalH=${originalH})`
      );
    }

    // 4. 限制最大邊長（優化大圖處理速度）
    // 需要追蹤 resize 後的實際尺寸，座標映射才正確
    if (maxSize && (effectiveW > maxSize || effectiveH > maxSize)) {
      const ratio = Math.min(maxSize / effectiveW, maxSize / effectiveH);
      effectiveW = Math.round(effectiveW * ratio);
      effectiveH = Math.round(effectiveH * ratio);
      sharpInstance = sharpInstance.resize(maxSize, maxSize, {
        fit: 'inside',
        withoutEnlargement: true,
      });
      logger.debug(`Resized to max ${maxSize}px (effective: ${effectiveW}x${effectiveH})`);
    }

    // 5. 一次性處理：removeAlpha -> resize to inputSize -> raw buffer
    // 避免中間 buffer 減少記憶體使用
    const processedBuf = await sharpInstance
      .removeAlpha()
      .resize(inputSize, inputSize, { fit: 'fill' })
      .raw()
      .toBuffer({ resolveWithObject: true });

    // 計算縮放比例（用於座標映射）
    // 使用 effectiveW/effectiveH（裁切+maxSize 後的實際尺寸）而非原始尺寸
    const scaleX = effectiveW / processedBuf.info.width;
    const scaleY = effectiveH / processedBuf.info.height;

    logger.debug(`Image preprocessing completed in ${Date.now() - startTime}ms`);

    // 6. 轉換為 NCHW float32，BGR 通道
    const pixelCount = inputSize * inputSize;
    const inputData = new Float32Array(3 * pixelCount);
    const rawBuf = processedBuf.data;

    for (let i = 0; i < pixelCount; i++) {
      const r = rawBuf[i * 3];
      const g = rawBuf[i * 3 + 1];
      const b = rawBuf[i * 3 + 2];
      // NCHW，BGR: channel 0 = B, channel 1 = G, channel 2 = R
      inputData[i] = (b - SCRFD_MEAN) / SCRFD_STD;
      inputData[pixelCount + i] = (g - SCRFD_MEAN) / SCRFD_STD;
      inputData[2 * pixelCount + i] = (r - SCRFD_MEAN) / SCRFD_STD;
    }

    // 7. ONNX 推論
    const inputName = session.inputNames[0] as string;
    const tensor = new ort.Tensor('float32', inputData, [1, 3, inputSize, inputSize]);
    const results = await session.run({ [inputName]: tensor });

    // 5. 解析輸出
    // det_500m.onnx 有 9 個輸出 tensor，按 index：
    //   0-2: scores (stride 8, 16, 32)
    //   3-5: bboxes (stride 8, 16, 32)
    //   6-8: kps    (stride 8, 16, 32)
    const outputNames = session.outputNames as string[];
    const outputTensors = outputNames.map((name: string) => results[name]);

    const allFaces: SCRFDFace[] = [];

    for (let si = 0; si < STRIDES.length; si++) {
      const stride = STRIDES[si];
      const featH = Math.floor(inputSize / stride);
      const featW = Math.floor(inputSize / stride);
      const anchors = generateAnchors(featH, featW, stride);

      const scoreData = outputTensors[si].data as Float32Array;
      const bboxData = outputTensors[si + 3].data as Float32Array;
      const kpsData = outputTensors[si + 6].data as Float32Array;

      for (let a = 0; a < anchors.length; a++) {
        // Sigmoid for score
        const rawScore = scoreData[a];
        const score = 1 / (1 + Math.exp(-rawScore));

        if (score < confThreshold) continue;

        const [cx, cy] = anchors[a];

        // BBox decode: distance-based [dl, dt, dr, db]
        const dl = bboxData[a * 4];
        const dt = bboxData[a * 4 + 1];
        const dr = bboxData[a * 4 + 2];
        const db = bboxData[a * 4 + 3];

        const x1 = (cx - dl * stride) * scaleX;
        const y1 = (cy - dt * stride) * scaleY;
        const x2 = (cx + dr * stride) * scaleX;
        const y2 = (cy + db * stride) * scaleY;

        // Keypoint decode
        const kps: [number, number][] = [];
        for (let k = 0; k < 5; k++) {
          const dx = kpsData[a * 10 + k * 2];
          const dy = kpsData[a * 10 + k * 2 + 1];
          kps.push([(cx + dx * stride) * scaleX, (cy + dy * stride) * scaleY]);
        }

        allFaces.push({
          bbox: [x1, y1, x2, y2],
          kps,
          score,
          orientation,
        });
      }
    }

    // 6. NMS
    const kept = nms(allFaces, 0.4);

    logger.debug(
      `SCRFD: ${allFaces.length} candidates → ${kept.length} faces after NMS (conf≥${confThreshold}) for ${imagePath}`
    );
    return kept;
  } catch (err) {
    const msg =
      err instanceof Error
        ? `${err.message} (${err.stack?.split('\n')[1]?.trim() ?? ''})`
        : String(err);
    logger.error(`SCRFD detection failed for ${imagePath}: ${msg}`);
    // 拋出錯誤讓上層知道是偵測引擎故障，不是「沒有臉」
    throw new Error(`SCRFD detection error for ${imagePath}: ${msg}`);
  }
}
