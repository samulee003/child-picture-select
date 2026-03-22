/**
 * 5-Point Face Alignment（Umeyama Similarity Transform）
 *
 * 使用 SCRFD 偵測到的 5 個特徵點（左眼、右眼、鼻尖、左嘴角、右嘴角）
 * 對齊到 ArcFace 標準 112×112 空間，是 ArcFace 準確率的關鍵步驟。
 *
 * 流程：
 *   SCRFD kps (5×2) → Umeyama transform → 2×3 affine matrix
 *   → sharp .affine() (inverse mapping) → 112×112 aligned face
 */

import sharp from 'sharp';
import { logger } from '../utils/logger';

/** ArcFace 標準 5 特徵點模板（112×112 空間） */
export const ARCFACE_DST_5PT: [number, number][] = [
  [38.2946, 51.6963], // 左眼
  [73.5318, 51.5014], // 右眼
  [56.0252, 71.7366], // 鼻尖
  [41.5493, 92.3655], // 左嘴角
  [70.7299, 92.2041], // 右嘴角
];

const ALIGN_SIZE = 112;

/**
 * 2×2 矩陣 SVD 解析法（保留供未來使用）
 * 輸入 2×2 矩陣 A，輸出 { U, S, V } 其中：
 *   A = U * diag(S) * V^T
 */
function _svd2x2(a: number[][]): { U: number[][]; S: number[]; V: number[][] } {
  // E = A^T * A
  const e00 = a[0][0] * a[0][0] + a[1][0] * a[1][0];
  const e01 = a[0][0] * a[0][1] + a[1][0] * a[1][1];
  const e11 = a[0][1] * a[0][1] + a[1][1] * a[1][1];

  const traceE = e00 + e11;
  const detE = e00 * e11 - e01 * e01;
  const disc = Math.sqrt(Math.max(0, (traceE * traceE) / 4 - detE));

  const lambda1 = traceE / 2 + disc;
  const lambda2 = traceE / 2 - disc;

  const sigma1 = Math.sqrt(Math.max(0, lambda1));
  const sigma2 = Math.sqrt(Math.max(0, lambda2));

  // V eigenvectors from (E - λI)v = 0
  let V: number[][];
  if (Math.abs(e01) > 1e-12) {
    // v1 for lambda1
    const v1x = e01;
    const v1y = lambda1 - e00;
    const v1norm = Math.sqrt(v1x * v1x + v1y * v1y) + 1e-12;

    // v2 for lambda2
    const v2x = e01;
    const v2y = lambda2 - e00;
    const v2norm = Math.sqrt(v2x * v2x + v2y * v2y) + 1e-12;

    V = [
      [v1x / v1norm, v2x / v2norm],
      [v1y / v1norm, v2y / v2norm],
    ];
  } else {
    // Diagonal E matrix
    if (e00 >= e11) {
      V = [
        [1, 0],
        [0, 1],
      ];
    } else {
      V = [
        [0, 1],
        [1, 0],
      ];
    }
  }

  // U = A * V * diag(1/sigma)
  const invS1 = sigma1 > 1e-12 ? 1 / sigma1 : 0;
  const invS2 = sigma2 > 1e-12 ? 1 / sigma2 : 0;

  // AV = A * V
  const av00 = a[0][0] * V[0][0] + a[0][1] * V[1][0];
  const av10 = a[1][0] * V[0][0] + a[1][1] * V[1][0];
  const av01 = a[0][0] * V[0][1] + a[0][1] * V[1][1];
  const av11 = a[1][0] * V[0][1] + a[1][1] * V[1][1];

  const U: number[][] = [
    [av00 * invS1, av01 * invS2],
    [av10 * invS1, av11 * invS2],
  ];

  return { U, S: [sigma1, sigma2], V };
}

/**
 * Estimate Affine Transform using Least Squares
 *
 * 計算 src → dst 的最佳仿射變換（6 參數），
 * 回傳 2×3 仿射矩陣 M，使得 dst = M * [src | 1]^T
 *
 * 使用線性最小二乘法求解 6 個參數 [m00, m01, tx, m10, m11, ty]
 */
export function umeyama2D(src: [number, number][], dst: [number, number][]): number[][] {
  const n = src.length;

  // Affine: [dx]   [m00  m01  tx]   [sx]
  //         [dy] = [m10  m11  ty] * [sy]
  //                                   [1 ]
  //
  // dx = m00*sx + m01*sy + tx
  // dy = m10*sx + m11*sy + ty

  // Build normal equations for x components (m00, m01, tx)
  let ata00 = 0,
    ata01 = 0,
    ata02 = 0;
  let ata11 = 0,
    ata12 = 0;
  let ata22 = 0;
  let atb0 = 0,
    atb1 = 0,
    atb2 = 0;

  for (let i = 0; i < n; i++) {
    const [sx, sy] = src[i];
    const [dx] = dst[i];

    // For x equation: [sx, sy, 1] * [m00, m01, tx]^T = dx
    ata00 += sx * sx;
    ata01 += sx * sy;
    ata02 += sx;
    ata11 += sy * sy;
    ata12 += sy;
    ata22 += 1;
    atb0 += sx * dx;
    atb1 += sy * dx;
    atb2 += dx;
  }

  // Solve for x components using Cramer's rule
  const det =
    ata00 * (ata11 * ata22 - ata12 * ata12) -
    ata01 * (ata01 * ata22 - ata12 * ata02) +
    ata02 * (ata01 * ata12 - ata11 * ata02);

  if (Math.abs(det) < 1e-12) {
    throw new Error('Singular matrix in umeyama2D');
  }

  const invDet = 1 / det;
  const m00 =
    invDet *
    ((ata11 * ata22 - ata12 * ata12) * atb0 -
      (ata01 * ata22 - ata12 * ata02) * atb1 +
      (ata01 * ata12 - ata11 * ata02) * atb2);
  const m01 =
    invDet *
    (-(ata01 * ata22 - ata12 * ata02) * atb0 +
      (ata00 * ata22 - ata02 * ata02) * atb1 -
      (ata00 * ata12 - ata02 * ata01) * atb2);
  const tx =
    invDet *
    ((ata01 * ata12 - ata11 * ata02) * atb0 -
      (ata00 * ata12 - ata02 * ata01) * atb1 +
      (ata00 * ata11 - ata01 * ata01) * atb2);

  // Build normal equations for y components (m10, m11, ty)
  atb0 = 0;
  atb1 = 0;
  atb2 = 0;
  for (let i = 0; i < n; i++) {
    const [sx, sy] = src[i];
    const [, dy] = dst[i];
    atb0 += sx * dy;
    atb1 += sy * dy;
    atb2 += dy;
  }

  const m10 =
    invDet *
    ((ata11 * ata22 - ata12 * ata12) * atb0 -
      (ata01 * ata22 - ata12 * ata02) * atb1 +
      (ata01 * ata12 - ata11 * ata02) * atb2);
  const m11 =
    invDet *
    (-(ata01 * ata22 - ata12 * ata02) * atb0 +
      (ata00 * ata22 - ata02 * ata02) * atb1 -
      (ata00 * ata12 - ata02 * ata01) * atb2);
  const ty =
    invDet *
    ((ata01 * ata12 - ata11 * ata02) * atb0 -
      (ata00 * ata12 - ata02 * ata01) * atb1 +
      (ata00 * ata11 - ata01 * ata01) * atb2);

  return [
    [m00, m01, tx],
    [m10, m11, ty],
  ];
}

/**
 * 2×2 矩陣求逆（保留供未來使用）
 */
function _invert2x2(m: number[][]): number[][] {
  const [[m00, m01], [m10, m11]] = m;
  const det = m00 * m11 - m01 * m10;
  if (Math.abs(det) < 1e-12) {
    throw new Error('Singular matrix in invert2x2');
  }
  const invDet = 1 / det;
  return [
    [m11 * invDet, -m01 * invDet],
    [-m10 * invDet, m00 * invDet],
  ];
}

/**
 * 對齊臉部圖片
 *
 * 使用 SCRFD 偵測到的 5 個特徵點，通過 Umeyama similarity transform
 * 將臉部對齊到 ArcFace 標準 112×112 空間。
 *
 * @param imageBuffer   原始圖片的 raw RGB buffer（或 sharp 可讀取的 buffer）
 * @param imageWidth    圖片寬度
 * @param imageHeight   圖片高度
 * @param kps           5 個特徵點座標（在 imageBuffer 同一座標空間）
 * @param outputSize    輸出尺寸（預設 112）
 * @param exifOrientation  EXIF orientation (1-8)，用於調整 KPS 座標
 * @returns 對齊後的 112×112 RGB raw Buffer
 */
/**
 * Sharp affine 的像素上限。超過此值時先裁切臉部區域再做仿射變換。
 * Sharp 的 affine 在非常大的圖片上會拋 "Input image exceeds pixel limit"。
 */
const AFFINE_MAX_PIXELS = 4_000_000; // ~4MP，保守值

/**
 * 根據 EXIF orientation 調整 KPS 座標
 *
 * 注意：整個 pipeline（scrfd.ts + detector.ts）均啟用了 Sharp `.rotate()`
 * 自動旋轉，所以 SCRFD 輸出的 KPS 座標已在視覺空間（post-rotation），
 * detector.ts 也以相同 `.rotate()` 讀取 raw buffer。
 * 因此 detector.ts 傳入此函數的 exifOrientation 恆為 1（無需轉換）。
 *
 * 此函數保留完整 orientation 2–8 的轉換邏輯，以備將來 pipeline 需要
 * 在原始像素空間（未旋轉）處理時使用。若 exifOrientation=1，直接回傳原始 KPS。
 *
 * EXIF orientation 定義：
 * 1: 正常 (0°)
 * 2: 水平翻轉
 * 3: 180°
 * 4: 垂直翻轉
 * 5: 水平翻轉 + 逆時針 90°
 * 6: 逆時針 90°
 * 7: 水平翻轉 + 逆時針 270°
 * 8: 逆時針 270°
 */
function transformKpsForOrientation(
  kps: [number, number][],
  orientation: number,
  width: number,
  height: number
): [number, number][] {
  if (orientation === 1) return kps; // 正常，無需轉換

  return kps.map(([x, y]) => {
    switch (orientation) {
      case 2: // 水平翻轉
        return [width - 1 - x, y];
      case 3: // 180°
        return [width - 1 - x, height - 1 - y];
      case 4: // 垂直翻轉
        return [x, height - 1 - y];
      case 5: // 水平翻轉 + 逆時針 90°
        return [y, x];
      case 6: // 逆時針 90°
        return [y, width - 1 - x];
      case 7: // 水平翻轉 + 逆時針 270°
        return [height - 1 - y, width - 1 - x];
      case 8: // 逆時針 270°
        return [height - 1 - y, x];
      default:
        return [x, y];
    }
  });
}

export async function alignFace(
  imageBuffer: Buffer,
  imageWidth: number,
  imageHeight: number,
  kps: [number, number][],
  outputSize: number = ALIGN_SIZE,
  exifOrientation: number = 1
): Promise<Buffer> {
  // 根據 EXIF orientation 調整 KPS 座標
  // 由於整個 pipeline 使用原始像素空間，需要將 KPS 轉換到與 buffer 對應的座標系
  const adjustedKps = transformKpsForOrientation(kps, exifOrientation, imageWidth, imageHeight);

  if (exifOrientation !== 1) {
    logger.debug(`alignFace: adjusted KPS for EXIF orientation=${exifOrientation}`);
  }

  // 如果圖片像素數超過 Sharp affine 限制，先裁切臉部區域再做仿射
  const totalPixels = imageWidth * imageHeight;
  let workBuffer = imageBuffer;
  let workW = imageWidth;
  let workH = imageHeight;
  let workKps = adjustedKps;

  if (totalPixels > AFFINE_MAX_PIXELS) {
    // 計算所有關鍵點的 bounding box，加 padding 後裁切
    // 使用 adjustedKps（已根據 exifOrientation 轉換），確保裁切區域和座標空間一致
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const [kx, ky] of adjustedKps) {
      if (kx < minX) minX = kx;
      if (kx > maxX) maxX = kx;
      if (ky < minY) minY = ky;
      if (ky > maxY) maxY = ky;
    }

    // 加上 padding（臉部區域的 50%），確保有足夠上下文
    const kpsW = maxX - minX;
    const kpsH = maxY - minY;
    const padX = kpsW * 0.5;
    const padY = kpsH * 0.5;

    const cropLeft = Math.max(0, Math.floor(minX - padX));
    const cropTop = Math.max(0, Math.floor(minY - padY));
    const cropRight = Math.min(imageWidth, Math.ceil(maxX + padX));
    const cropBottom = Math.min(imageHeight, Math.ceil(maxY + padY));
    const cropW = cropRight - cropLeft;
    const cropH = cropBottom - cropTop;

    if (cropW > 0 && cropH > 0) {
      try {
        workBuffer = await sharp(imageBuffer, {
          raw: { width: imageWidth, height: imageHeight, channels: 3 },
        })
          .extract({ left: cropLeft, top: cropTop, width: cropW, height: cropH })
          .removeAlpha()
          .raw()
          .toBuffer();

        workW = cropW;
        workH = cropH;
        // 調整關鍵點座標到裁切後的空間（基於 adjustedKps，已包含 orientation 轉換）
        workKps = adjustedKps.map(([kx, ky]) => [kx - cropLeft, ky - cropTop] as [number, number]);

        logger.debug(
          `alignFace: cropped ${imageWidth}x${imageHeight} → ${cropW}x${cropH} ` +
            `(${totalPixels}MP → ${cropW * cropH}MP) to stay within Sharp affine pixel limit`
        );
      } catch (cropErr) {
        logger.warn('alignFace: crop failed, attempting affine on full image:', cropErr);
        // 裁切失敗就用原圖繼續嘗試
        workBuffer = imageBuffer;
        workW = imageWidth;
        workH = imageHeight;
        workKps = kps;
      }
    }
  }

  // 計算 forward matrix: src_face → 112×112 canvas
  const M = umeyama2D(workKps, ARCFACE_DST_5PT);

  const m00 = M[0][0],
    m01 = M[0][1],
    mtx = M[0][2];
  const m10 = M[1][0],
    m11 = M[1][1],
    mty = M[1][2];

  const det = m00 * m11 - m01 * m10;
  if (Math.abs(det) < 1e-12) {
    logger.warn('Degenerate affine transform, falling back to identity');
    // Fallback: 直接 resize 到 outputSize
    return sharp(workBuffer, { raw: { width: workW, height: workH, channels: 3 } })
      .resize(outputSize, outputSize, { fit: 'fill' })
      .removeAlpha()
      .raw()
      .toBuffer();
  }

  // ── Pure JS Bilinear Warp (correct 112×112 output) ───────────────────────────
  //
  // Sharp's affine API cannot produce a fixed 112×112 output because it always
  // sizes the output canvas to cover the transform of ALL input corners.
  // When the face is larger than 112px (scale < 1), the canvas dimension < 112.
  //
  // Solution: for each of the 112×112 output pixels, compute the source pixel
  // location using the INVERSE Umeyama transform, then bilinear interpolate.
  //
  //   Forward M:  dst = M_2x2 * src + [tx, ty]
  //   Inverse:    src = M_inv * (dst - [tx, ty])
  //             = M_inv * dst + inv_translation
  //
  // M_inv computation:
  const invDet = 1 / det;
  const inv00 = m11 * invDet;
  const inv01 = -m01 * invDet;
  const inv10 = -m10 * invDet;
  const inv11 = m00 * invDet;
  // inv_translation = M_inv * [-tx, -ty]
  const invTx = -(inv00 * mtx + inv01 * mty);
  const invTy = -(inv10 * mtx + inv11 * mty);

  logger.debug(
    `alignFace warp: M=[${m00.toFixed(3)},${m01.toFixed(3)},${mtx.toFixed(1)};${m10.toFixed(3)},${m11.toFixed(3)},${mty.toFixed(1)}] ` +
      `inv=[${inv00.toFixed(3)},${inv01.toFixed(3)},${invTx.toFixed(1)};${inv10.toFixed(3)},${inv11.toFixed(3)},${invTy.toFixed(1)}]`
  );

  // Output buffer: RGB, 112×112
  const outBuf = Buffer.alloc(outputSize * outputSize * 3, 0);
  const srcData = workBuffer;
  const srcW = workW;
  const srcH = workH;

  for (let oy = 0; oy < outputSize; oy++) {
    for (let ox = 0; ox < outputSize; ox++) {
      // Inverse map: output pixel (ox, oy) → source pixel (sx, sy)
      const sx = inv00 * ox + inv01 * oy + invTx;
      const sy = inv10 * ox + inv11 * oy + invTy;

      // Bilinear interpolation
      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      const x1 = x0 + 1;
      const y1 = y0 + 1;
      const fx = sx - x0;
      const fy = sy - y0;

      // Sample 4 neighbour pixels (clamp to border)
      const x0c = Math.max(0, Math.min(srcW - 1, x0));
      const y0c = Math.max(0, Math.min(srcH - 1, y0));
      const x1c = Math.max(0, Math.min(srcW - 1, x1));
      const y1c = Math.max(0, Math.min(srcH - 1, y1));

      const i00 = (y0c * srcW + x0c) * 3;
      const i10 = (y0c * srcW + x1c) * 3;
      const i01 = (y1c * srcW + x0c) * 3;
      const i11 = (y1c * srcW + x1c) * 3;

      const w00 = (1 - fx) * (1 - fy);
      const w10 = fx * (1 - fy);
      const w01 = (1 - fx) * fy;
      const w11 = fx * fy;

      const outIdx = (oy * outputSize + ox) * 3;
      for (let c = 0; c < 3; c++) {
        outBuf[outIdx + c] = Math.round(
          w00 * srcData[i00 + c] +
            w10 * srcData[i10 + c] +
            w01 * srcData[i01 + c] +
            w11 * srcData[i11 + c]
        );
      }
    }
  }

  return outBuf;
}
