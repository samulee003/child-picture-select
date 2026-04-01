/**
 * ArcFace 人臉識別模組（InsightFace w600k_r50 ONNX）
 *
 * 使用 onnxruntime-node 在本地執行 InsightFace 的 ArcFace 模型（buffalo_l pack）。
 * 輸出 512 維 L2 正規化特徵向量，對亞洲兒童臉部辨識準確率遠優於 FaceNet 128 維。
 *
 * 模型：w600k_r50.onnx（ResNet-50 backbone, ArcFace loss, WebFace600K 訓練集）
 *   相較舊版 w600k_mbf（MobileFaceNet），R50 backbone 對小臉、模糊、低光照場景
 *   的辨識容忍度顯著提升，更適合兒童照片。模型大小約 174 MB。
 * 輸入：[1, 3, 112, 112] float32，BGR 通道順序，(pixel - 127.5) / 127.5 正規化
 * 輸出：[1, 512] float32，L2 正規化特徵向量
 *
 * 安裝後首次使用時如模型不存在，請執行 npm run download-models
 *
 * 新增 extractArcFaceEmbeddingFromAligned()：
 *   接受已通過 Umeyama 5-point 對齊的 112×112 RGB raw Buffer，
 *   直接執行 BGR 轉換 + ONNX 推論，不再做 crop/resize。
 */

import sharp from 'sharp';
import { logger } from '../utils/logger';
import { createSessionWithGpu as createOnnxSession } from './onnx-gpu';

/** ArcFace 輸出特徵維度 */
export const ARCFACE_DIMS = 512;

const ARCFACE_SIZE = 112;
const ARCFACE_MEAN = 127.5;
const ARCFACE_STD = 127.5;

/** InsightFace buffalo_l 的 ArcFace recognition 模型檔名（ResNet-50 backbone） */
const MODEL_FILENAME = 'w600k_r50.onnx';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let ort: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let session: any = null;
let sessionLoadAttempted = false;
let sessionLoadError: string | null = null;

/**
 * 解析 ArcFace ONNX 模型路徑
 * 搜尋順序：
 *   1. 專案根目錄 models/insightface/（開發環境）
 *   2. Electron app.asar.unpacked extraResources（打包後）
 */
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
    logger.info(`ArcFace model found: ${found}`);
    return found;
  }

  logger.warn(
    `ArcFace model not found. Run 'npm run download-models' to download it.\n` +
      `Searched:\n${candidates.join('\n')}`
  );
  return null;
}

/**
 * 動態載入 onnxruntime-node（不讓 tsup 打包進去）
 */
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
  return require('onnxruntime-node'); // fallback: let Node resolve it
}

/**
 * 載入 ArcFace ONNX 推論 session
 * 首次呼叫時初始化，之後快取 session。
 */
export async function loadArcFace(): Promise<boolean> {
  if (session) return true;
  if (sessionLoadAttempted) return false;
  sessionLoadAttempted = true;

  try {
    const modelPath = resolveModelPath();
    if (!modelPath) {
      sessionLoadError =
        `ArcFace model not found (${MODEL_FILENAME}). ` +
        `Run 'npm run download-models' to download it (~18 MB).`;
      return false;
    }

    ort = requireOrt();

    logger.info(`Initializing ArcFace ONNX session (InsightFace w600k_mbf)...`);
    session = await createOnnxSession(ort, modelPath, 'ArcFace');

    logger.info(
      `ArcFace loaded. Input: [${session.inputNames}] → Output: [${session.outputNames}]`
    );
    return true;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    sessionLoadError = message;
    logger.error(`Failed to load ArcFace ONNX: ${message}`);
    return false;
  }
}

/**
 * ArcFace 載入狀態（供診斷 UI 顯示）
 */
export function getArcFaceStatus(): { loaded: boolean; error: string | null } {
  return { loaded: session !== null, error: sessionLoadError };
}

/**
 * 允許重新載入（用於 preloadModel retry）
 */
export function resetArcFace(): void {
  session = null;
  sessionLoadAttempted = false;
  sessionLoadError = null;
}

/**
 * 從已縮放圖片 Buffer 的臉部 bbox 區域提取 ArcFace 512 維特徵向量
 *
 * @param imageBuffer  - Sharp 已縮放的 PNG buffer（偵測時的圖片）
 * @param bbox         - 臉部 bounding box [x, y, width, height]（同圖片座標空間）
 * @param imageWidth   - imageBuffer 的寬度（像素）
 * @param imageHeight  - imageBuffer 的高度（像素）
 * @returns L2 正規化的 512 維 float32 向量，失敗時回傳 null
 */
export async function extractArcFaceEmbedding(
  imageBuffer: Buffer,
  bbox: [number, number, number, number],
  imageWidth: number,
  imageHeight: number
): Promise<number[] | null> {
  if (!session) {
    const loaded = await loadArcFace();
    if (!loaded) return null;
  }

  try {
    const [bx, by, bw, bh] = bbox;

    // 加入 25% padding 讓 ArcFace 有足夠的臉部上下文
    const pad = Math.max(bw, bh) * 0.25;
    const left = Math.max(0, Math.round(bx - pad));
    const top = Math.max(0, Math.round(by - pad));
    const right = Math.min(imageWidth, Math.round(bx + bw + pad));
    const bottom = Math.min(imageHeight, Math.round(by + bh + pad));

    const cropW = right - left;
    const cropH = bottom - top;

    if (cropW <= 0 || cropH <= 0) {
      logger.warn(`ArcFace: invalid crop dimensions (${cropW}x${cropH}) for bbox ${bbox}`);
      return null;
    }

    // 裁切臉部 → 縮放 112×112 → RGB raw bytes
    const faceRaw = await sharp(imageBuffer)
      .extract({ left, top, width: cropW, height: cropH })
      .resize(ARCFACE_SIZE, ARCFACE_SIZE, { fit: 'fill' })
      .removeAlpha()
      .raw()
      .toBuffer();

    // 轉換為 NCHW float32；InsightFace ArcFace 使用 BGR 通道順序
    // sharp .raw() 輸出: RGB 交錯 [R0, G0, B0, R1, G1, B1, ...]
    const pixelCount = ARCFACE_SIZE * ARCFACE_SIZE;
    const data = new Float32Array(3 * pixelCount);

    for (let i = 0; i < pixelCount; i++) {
      const r = faceRaw[i * 3];
      const g = faceRaw[i * 3 + 1];
      const b = faceRaw[i * 3 + 2];
      // NCHW，BGR 排列: channel 0 = B, channel 1 = G, channel 2 = R
      data[i] = (b - ARCFACE_MEAN) / ARCFACE_STD;
      data[pixelCount + i] = (g - ARCFACE_MEAN) / ARCFACE_STD;
      data[2 * pixelCount + i] = (r - ARCFACE_MEAN) / ARCFACE_STD;
    }

    const inputName = session.inputNames[0] as string;
    const tensor = new ort.Tensor('float32', data, [1, 3, ARCFACE_SIZE, ARCFACE_SIZE]);
    const results = await session.run({ [inputName]: tensor });

    const outputName = session.outputNames[0] as string;
    const embeddingRaw = results[outputName].data as Float32Array;
    const embedding = Array.from(embeddingRaw);

    // L2 正規化（ArcFace 模型輸出通常已正規化，但再次確保）
    let norm = 0;
    for (const v of embedding) norm += v * v;
    norm = Math.sqrt(norm) + 1e-12;

    return embedding.map(v => v / norm);
  } catch (err) {
    logger.error('ArcFace embedding extraction failed:', err);
    return null;
  }
}

/**
 * 從已對齊的 112×112 RGB raw Buffer 提取 ArcFace 512 維特徵向量
 *
 * 這是完整 InsightFace pipeline（SCRFD → 5-point align → ArcFace）的最後一步。
 * 輸入必須是 alignFace() 產出的 112×112 RGB raw Buffer。
 *
 * @param alignedBuffer  已對齊的 112×112 RGB raw Buffer（112*112*3 = 37632 bytes）
 * @returns L2 正規化的 512 維 float32 向量，失敗時回傳 null
 */
export async function extractArcFaceEmbeddingFromAligned(
  alignedBuffer: Buffer
): Promise<number[] | null> {
  if (!session) {
    const loaded = await loadArcFace();
    if (!loaded) return null;
  }

  try {
    const expectedBytes = ARCFACE_SIZE * ARCFACE_SIZE * 3;
    if (alignedBuffer.length !== expectedBytes) {
      logger.warn(
        `ArcFace: expected ${expectedBytes} bytes for 112×112 RGB, got ${alignedBuffer.length}`
      );
      return null;
    }

    // 轉換為 NCHW float32；BGR 通道順序
    const pixelCount = ARCFACE_SIZE * ARCFACE_SIZE;
    const data = new Float32Array(3 * pixelCount);

    for (let i = 0; i < pixelCount; i++) {
      const r = alignedBuffer[i * 3];
      const g = alignedBuffer[i * 3 + 1];
      const b = alignedBuffer[i * 3 + 2];
      // NCHW，BGR: channel 0 = B, channel 1 = G, channel 2 = R
      data[i] = (b - ARCFACE_MEAN) / ARCFACE_STD;
      data[pixelCount + i] = (g - ARCFACE_MEAN) / ARCFACE_STD;
      data[2 * pixelCount + i] = (r - ARCFACE_MEAN) / ARCFACE_STD;
    }

    const inputName = session.inputNames[0] as string;
    const tensor = new ort.Tensor('float32', data, [1, 3, ARCFACE_SIZE, ARCFACE_SIZE]);
    const results = await session.run({ [inputName]: tensor });

    const outputName = session.outputNames[0] as string;
    const embeddingRaw = results[outputName].data as Float32Array;
    const embedding = Array.from(embeddingRaw);

    // L2 正規化
    let norm = 0;
    for (const v of embedding) norm += v * v;
    norm = Math.sqrt(norm) + 1e-12;

    return embedding.map(v => v / norm);
  } catch (err) {
    logger.error('ArcFace aligned embedding extraction failed:', err);
    return null;
  }
}
