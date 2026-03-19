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
 * 2×2 矩陣 SVD 解析法
 * 輸入 2×2 矩陣 A，輸出 { U, S, V } 其中：
 *   A = U * diag(S) * V^T
 */
function svd2x2(a: number[][]): { U: number[][]; S: number[]; V: number[][] } {
  // E = A^T * A
  const e00 = a[0][0] * a[0][0] + a[1][0] * a[1][0];
  const e01 = a[0][0] * a[0][1] + a[1][0] * a[1][1];
  const e11 = a[0][1] * a[0][1] + a[1][1] * a[1][1];

  const traceE = e00 + e11;
  const detE = e00 * e11 - e01 * e01;
  const disc = Math.sqrt(Math.max(0, traceE * traceE / 4 - detE));

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
      V = [[1, 0], [0, 1]];
    } else {
      V = [[0, 1], [1, 0]];
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
 * Umeyama Similarity Transform（2D, N-point）
 *
 * 計算 src → dst 的最佳相似變換（旋轉 + 縮放 + 平移），
 * 回傳 2×3 仿射矩陣 M，使得 dst ≈ M * [src | 1]^T
 *
 * 基於 scikit-image Umeyama 算法實現
 */
export function umeyama2D(
  src: [number, number][],
  dst: [number, number][]
): number[][] {
  const n = src.length;

  // 1. 計算平均值
  let srcMeanX = 0, srcMeanY = 0, dstMeanX = 0, dstMeanY = 0;
  for (let i = 0; i < n; i++) {
    srcMeanX += src[i][0];
    srcMeanY += src[i][1];
    dstMeanX += dst[i][0];
    dstMeanY += dst[i][1];
  }
  srcMeanX /= n;
  srcMeanY /= n;
  dstMeanX /= n;
  dstMeanY /= n;

  // 2. 中心化
  const srcC: [number, number][] = src.map(([x, y]) => [x - srcMeanX, y - srcMeanY]);
  const dstC: [number, number][] = dst.map(([x, y]) => [x - dstMeanX, y - dstMeanY]);

  // 3. src variance
  let srcVar = 0;
  for (let i = 0; i < n; i++) {
    srcVar += srcC[i][0] * srcC[i][0] + srcC[i][1] * srcC[i][1];
  }
  srcVar /= n;

  // 4. Cross-covariance K = (dst_c^T @ src_c) / n  (2×2)
  let k00 = 0, k01 = 0, k10 = 0, k11 = 0;
  for (let i = 0; i < n; i++) {
    k00 += dstC[i][0] * srcC[i][0];
    k01 += dstC[i][0] * srcC[i][1];
    k10 += dstC[i][1] * srcC[i][0];
    k11 += dstC[i][1] * srcC[i][1];
  }
  k00 /= n; k01 /= n; k10 /= n; k11 /= n;

  const K = [[k00, k01], [k10, k11]];

  // 5. SVD
  const { U, S, V } = svd2x2(K);

  // 6. S matrix (prevent reflection)
  const detK = K[0][0] * K[1][1] - K[0][1] * K[1][0];
  const Sm = detK >= 0 ? [1, 1] : [1, -1];

  // 7. R = U * S * V^T
  // First: US = U * diag(Sm)
  const us00 = U[0][0] * Sm[0];
  const us01 = U[0][1] * Sm[1];
  const us10 = U[1][0] * Sm[0];
  const us11 = U[1][1] * Sm[1];

  // R = US * V^T
  const r00 = us00 * V[0][0] + us01 * V[0][1];
  const r01 = us00 * V[1][0] + us01 * V[1][1];
  const r10 = us10 * V[0][0] + us11 * V[0][1];
  const r11 = us10 * V[1][0] + us11 * V[1][1];

  // 8. Scale: c = trace(diag(S_sigma) * Sm) / src_var
  const c = (S[0] * Sm[0] + S[1] * Sm[1]) / (srcVar + 1e-12);

  // 9. Translation: t = dst_mean - c * R * src_mean
  const tx = dstMeanX - c * (r00 * srcMeanX + r01 * srcMeanY);
  const ty = dstMeanY - c * (r10 * srcMeanX + r11 * srcMeanY);

  // 10. 2×3 forward matrix
  return [
    [c * r00, c * r01, tx],
    [c * r10, c * r11, ty],
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
 * @returns 對齊後的 112×112 RGB raw Buffer
 */
/**
 * Sharp affine 的像素上限。超過此值時先裁切臉部區域再做仿射變換。
 * Sharp 的 affine 在非常大的圖片上會拋 "Input image exceeds pixel limit"。
 */
const AFFINE_MAX_PIXELS = 4_000_000; // ~4MP，保守值

export async function alignFace(
  imageBuffer: Buffer,
  imageWidth: number,
  imageHeight: number,
  kps: [number, number][],
  outputSize: number = ALIGN_SIZE
): Promise<Buffer> {
  // 如果圖片像素數超過 Sharp affine 限制，先裁切臉部區域再做仿射
  const totalPixels = imageWidth * imageHeight;
  let workBuffer = imageBuffer;
  let workW = imageWidth;
  let workH = imageHeight;
  let workKps = kps;

  if (totalPixels > AFFINE_MAX_PIXELS) {
    // 計算所有關鍵點的 bounding box，加 padding 後裁切
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [kx, ky] of kps) {
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
        // 調整關鍵點座標到裁切後的空間
        workKps = kps.map(([kx, ky]) => [kx - cropLeft, ky - cropTop] as [number, number]);

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

  // Sharp .affine() 需要逆映射（output → input）
  // M2 = [[m00, m01], [m10, m11]], det(M2) = m00*m11 - m01*m10
  const m00 = M[0][0], m01 = M[0][1], mtx = M[0][2];
  const m10 = M[1][0], m11 = M[1][1], mty = M[1][2];

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

  // 逆矩陣 M2_inv
  const invDet = 1 / det;
  const inv00 = m11 * invDet;
  const inv01 = -m01 * invDet;
  const inv10 = -m10 * invDet;
  const inv11 = m00 * invDet;

  // 逆平移: t_inv = -M2_inv * [tx, ty]
  const invTx = -(inv00 * mtx + inv01 * mty);
  const invTy = -(inv10 * mtx + inv11 * mty);

  try {
    // NOTE: sharp.affine() 在某些邊界條件下可能會輸出非預期尺寸（非固定 112×112）。
    // 因此這裡採用「雙保險」：先 affine 輸出 raw + 寬高資訊，再以 raw 輸入強制 resize 成固定輸出。
    const affineOut = await sharp(workBuffer, {
      raw: { width: workW, height: workH, channels: 3 },
    })
      .affine(
        [[inv00, inv01], [inv10, inv11]],
        {
          background: { r: 0, g: 0, b: 0 },
          idx: invTx,
          idy: invTy,
          interpolator: 'bicubic',
          odx: 0,
          ody: 0,
        }
      )
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const resized = await sharp(affineOut.data, {
      raw: {
        width: affineOut.info.width,
        height: affineOut.info.height,
        channels: affineOut.info.channels,
      },
    })
      .resize(outputSize, outputSize, { fit: 'fill' })
      .removeAlpha()
      .raw()
      .toBuffer();

    const expectedBytes = outputSize * outputSize * 3;
    if (resized.length !== expectedBytes) {
      logger.warn(
        `alignFace produced unexpected raw length after resize: got ${resized.length}, expected ${expectedBytes}`
      );
    }

    return resized;
  } catch (err) {
    logger.error('Face alignment affine transform failed:', err);
    // Fallback: 直接 resize
    return sharp(workBuffer, { raw: { width: workW, height: workH, channels: 3 } })
      .resize(outputSize, outputSize, { fit: 'fill' })
      .removeAlpha()
      .raw()
      .toBuffer();
  }
}
