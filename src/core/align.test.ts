/**
 * Unit tests for src/core/align.ts
 *
 * 覆蓋範圍：
 *   - umeyama2D: Linear Least Squares 仿射變換計算
 *   - alignFace: 全流程對齊（含 bilinear warp + EXIF orientation）
 *
 * 這些測試直接驗證 v0.2.19 重寫的核心算法，保護其不退化。
 */

import { describe, it, expect } from 'vitest';
import { umeyama2D, alignFace, ARCFACE_DST_5PT } from './align';

// ── helpers ──────────────────────────────────────────────────────────────────

/** Apply 2×3 affine matrix M to point (x, y) */
function applyM(M: number[][], x: number, y: number): [number, number] {
  return [M[0][0] * x + M[0][1] * y + M[0][2], M[1][0] * x + M[1][1] * y + M[1][2]];
}

/** Max reconstruction error when applying M to src, comparing with dst */
function maxReconstructionError(
  M: number[][],
  src: [number, number][],
  dst: [number, number][]
): number {
  let maxErr = 0;
  for (let i = 0; i < src.length; i++) {
    const [mx, my] = applyM(M, src[i][0], src[i][1]);
    const err = Math.sqrt((mx - dst[i][0]) ** 2 + (my - dst[i][1]) ** 2);
    if (err > maxErr) maxErr = err;
  }
  return maxErr;
}

/** Create a minimal raw RGB buffer filled with a constant gray value */
function makeSolidBuffer(w: number, h: number, gray = 128): Buffer {
  return Buffer.alloc(w * h * 3, gray);
}

// ── umeyama2D ─────────────────────────────────────────────────────────────────

describe('umeyama2D', () => {
  it('returns a 2×3 matrix', () => {
    const M = umeyama2D(ARCFACE_DST_5PT, ARCFACE_DST_5PT);
    expect(M).toHaveLength(2);
    expect(M[0]).toHaveLength(3);
    expect(M[1]).toHaveLength(3);
  });

  it('identity: src === dst → reconstruction error ≈ 0', () => {
    const pts = ARCFACE_DST_5PT;
    const M = umeyama2D(pts, pts);
    expect(maxReconstructionError(M, pts, pts)).toBeLessThan(1e-6);
  });

  it('pure translation: correctly encodes (tx, ty) offset', () => {
    const tx = 15;
    const ty = -8;
    const src: [number, number][] = [[10, 10], [20, 10], [15, 20], [12, 30], [18, 30]];
    const dst: [number, number][] = src.map(([x, y]) => [x + tx, y + ty]);
    const M = umeyama2D(src, dst);
    // Translation components
    expect(M[0][2]).toBeCloseTo(tx, 3);
    expect(M[1][2]).toBeCloseTo(ty, 3);
    // Linear part ≈ identity
    expect(M[0][0]).toBeCloseTo(1, 3);
    expect(M[0][1]).toBeCloseTo(0, 3);
    expect(M[1][0]).toBeCloseTo(0, 3);
    expect(M[1][1]).toBeCloseTo(1, 3);
    expect(maxReconstructionError(M, src, dst)).toBeLessThan(1e-6);
  });

  it('uniform scale: correctly encodes scale factor', () => {
    const scale = 0.5;
    // Points centred near origin so scale is clean
    const src: [number, number][] = [[0, 0], [100, 0], [50, 80], [20, 120], [80, 120]];
    const dst: [number, number][] = src.map(([x, y]) => [x * scale, y * scale]);
    const M = umeyama2D(src, dst);
    expect(maxReconstructionError(M, src, dst)).toBeLessThan(1e-4);
    // Scale factor is reflected in the diagonal
    const detectedScale = Math.sqrt(M[0][0] ** 2 + M[1][0] ** 2);
    expect(detectedScale).toBeCloseTo(scale, 2);
  });

  it('maps typical face keypoints to ArcFace template with < 2px error', () => {
    // Simulate a frontal face at ~600×800 image crop, roughly centred
    const src: [number, number][] = [
      [220, 240], // left eye
      [370, 238], // right eye
      [295, 310], // nose tip
      [228, 380], // left mouth
      [362, 378], // right mouth
    ];
    const dst = ARCFACE_DST_5PT;
    const M = umeyama2D(src, dst);
    expect(maxReconstructionError(M, src, dst)).toBeLessThan(2);
  });

  it('throws on degenerate (collinear) input', () => {
    // 5 collinear points — singular normal matrix
    const pts: [number, number][] = [[0, 0], [1, 1], [2, 2], [3, 3], [4, 4]];
    expect(() => umeyama2D(pts, pts)).toThrow();
  });
});

// ── alignFace ─────────────────────────────────────────────────────────────────

/** Typical frontal-face keypoints for a 300×300 test image */
const KPS_300: [number, number][] = [
  [100, 110], // left eye
  [200, 110], // right eye
  [150, 160], // nose tip
  [110, 210], // left mouth
  [190, 210], // right mouth
];

describe('alignFace', () => {
  it('returns a Buffer of exactly 112×112×3 bytes', async () => {
    const w = 300, h = 300;
    const buf = makeSolidBuffer(w, h);
    const result = await alignFace(buf, w, h, KPS_300);
    expect(result).toBeInstanceOf(Buffer);
    expect(result.length).toBe(112 * 112 * 3);
  });

  it('accepts a custom outputSize', async () => {
    const w = 300, h = 300;
    const buf = makeSolidBuffer(w, h);
    const result = await alignFace(buf, w, h, KPS_300, 64);
    expect(result.length).toBe(64 * 64 * 3);
  });

  it('handles large image (> 4MP) via auto-crop without throwing', async () => {
    // 2400×1800 = 4.32MP > AFFINE_MAX_PIXELS (4MP threshold)
    const w = 2400, h = 1800;
    // Scale KPS_300 up to fit inside 2400×1800
    const kps: [number, number][] = KPS_300.map(([x, y]) => [
      Math.round(x * 6),
      Math.round(y * 4),
    ]);
    const buf = makeSolidBuffer(w, h);
    const result = await alignFace(buf, w, h, kps);
    expect(result.length).toBe(112 * 112 * 3);
  });

  // Test all 8 EXIF orientations — each must produce a valid 112×112×3 output
  // without throwing.
  const ORIENTATIONS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

  it.each(ORIENTATIONS)('EXIF orientation %i produces 112×112×3 buffer', async orientation => {
    // For transposing orientations (5-8) the image is logically rotated 90°,
    // so "x" and "y" roles swap — use a square image to keep KPS in-bounds.
    const side = 300;
    const buf = makeSolidBuffer(side, side);
    const result = await alignFace(buf, side, side, KPS_300, 112, orientation);
    expect(result).toBeInstanceOf(Buffer);
    expect(result.length).toBe(112 * 112 * 3);
  });

  it('orientation 1 and default (no arg) produce identical output', async () => {
    const w = 300, h = 300;
    const buf = makeSolidBuffer(w, h);
    const r1 = await alignFace(buf, w, h, KPS_300, 112, 1);
    const rDefault = await alignFace(buf, w, h, KPS_300);
    expect(r1).toEqual(rDefault);
  });
});
