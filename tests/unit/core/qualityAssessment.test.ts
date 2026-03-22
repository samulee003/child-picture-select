/**
 * Unit tests for src/core/childQualityAssessment.ts
 *
 * detectFaces 是透過動態 import('./detector') 呼叫的，這裡用 vi.mock 攔截，
 * 讓測試完全不依賴 ONNX 模型，快速且穩定。
 */

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Mock the detector module BEFORE importing ChildQualityAssessor so that the
// dynamic import('./detector') inside estimateFaceClarity picks up the mock.
vi.mock('../../../src/core/detector', () => ({
  detectFaces: vi.fn().mockResolvedValue([
    { confidence: 0.95, bbox: [10, 10, 100, 100], embedding: [] },
  ]),
}));

import { ChildQualityAssessor } from '../../../src/core/childQualityAssessment';

// ── Temp directory & image helpers ───────────────────────────────────────────

let tmpDir: string;

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-test-'));
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

/** Create a solid-colour JPEG at the given path */
async function createJpeg(
  filePath: string,
  w: number,
  h: number,
  r: number,
  g: number,
  b: number
): Promise<void> {
  await sharp({
    create: { width: w, height: h, channels: 3, background: { r, g, b } },
  })
    .jpeg({ quality: 85 })
    .toFile(filePath);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ChildQualityAssessor.assessPhotoQuality', () => {
  it('returns a QualityMetrics object with all required fields', async () => {
    const imgPath = path.join(tmpDir, 'mid-gray.jpg');
    await createJpeg(imgPath, 800, 600, 128, 128, 128);

    const assessor = new ChildQualityAssessor();
    const metrics = await assessor.assessPhotoQuality(imgPath);

    expect(typeof metrics.overallScore).toBe('number');
    expect(typeof metrics.sharpness).toBe('number');
    expect(typeof metrics.contrast).toBe('number');
    expect(typeof metrics.exposure).toBe('number');
    expect(typeof metrics.noise).toBe('number');
    expect(typeof metrics.resolution).toBe('number');
    expect(typeof metrics.faceClarity).toBe('number');
    expect(Array.isArray(metrics.recommendations)).toBe(true);
    expect(metrics.recommendations.length).toBeGreaterThan(0);
  });

  it('all numeric scores are within [0, 100]', async () => {
    const imgPath = path.join(tmpDir, 'bounds-check.jpg');
    await createJpeg(imgPath, 640, 480, 160, 120, 80);

    const assessor = new ChildQualityAssessor();
    const m = await assessor.assessPhotoQuality(imgPath);

    for (const score of [m.overallScore, m.sharpness, m.contrast, m.exposure, m.noise, m.resolution, m.faceClarity]) {
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });

  it('1920×1080 image has higher resolution score than 320×240', async () => {
    const hiPath = path.join(tmpDir, 'hi-res.jpg');
    const loPath = path.join(tmpDir, 'lo-res.jpg');
    await createJpeg(hiPath, 1920, 1080, 128, 128, 128);
    await createJpeg(loPath, 320, 240, 128, 128, 128);

    const assessor = new ChildQualityAssessor();
    const [hi, lo] = await Promise.all([
      assessor.assessPhotoQuality(hiPath),
      assessor.assessPhotoQuality(loPath),
    ]);

    expect(hi.resolution).toBeGreaterThan(lo.resolution);
  });

  it('mid-gray image has better exposure than all-white (over-exposed)', async () => {
    const grayPath = path.join(tmpDir, 'mid-gray-exp.jpg');
    const whitePath = path.join(tmpDir, 'white-exp.jpg');
    await createJpeg(grayPath, 400, 400, 128, 128, 128);
    await createJpeg(whitePath, 400, 400, 255, 255, 255);

    const assessor = new ChildQualityAssessor();
    const [gray, white] = await Promise.all([
      assessor.assessPhotoQuality(grayPath),
      assessor.assessPhotoQuality(whitePath),
    ]);

    expect(gray.exposure).toBeGreaterThan(white.exposure);
  });

  it('mid-gray image has better exposure than all-black (under-exposed)', async () => {
    const grayPath = path.join(tmpDir, 'mid-gray-exp2.jpg');
    const blackPath = path.join(tmpDir, 'black-exp.jpg');
    await createJpeg(grayPath, 400, 400, 128, 128, 128);
    await createJpeg(blackPath, 400, 400, 0, 0, 0);

    const assessor = new ChildQualityAssessor();
    const [gray, black] = await Promise.all([
      assessor.assessPhotoQuality(grayPath),
      assessor.assessPhotoQuality(blackPath),
    ]);

    expect(gray.exposure).toBeGreaterThan(black.exposure);
  });

  it('overall score is a finite number', async () => {
    const imgPath = path.join(tmpDir, 'overall-finite.jpg');
    await createJpeg(imgPath, 1080, 1080, 128, 128, 128);

    const assessor = new ChildQualityAssessor();
    const metrics = await assessor.assessPhotoQuality(imgPath);

    expect(Number.isFinite(metrics.overallScore)).toBe(true);
    expect(metrics.overallScore).toBeGreaterThanOrEqual(0);
    expect(metrics.overallScore).toBeLessThanOrEqual(100);
  });

  it('low-resolution image generates a resolution recommendation', async () => {
    const imgPath = path.join(tmpDir, 'tiny.jpg');
    await createJpeg(imgPath, 200, 150, 128, 128, 128);

    const assessor = new ChildQualityAssessor();
    const metrics = await assessor.assessPhotoQuality(imgPath);

    // resolution score < 60 → recommendation should mention 分辨率
    expect(metrics.recommendations.some(r => r.includes('分辨率'))).toBe(true);
  });
});

describe('ChildQualityAssessor.assessBatchQuality', () => {
  it('returns an array of the same length as input', async () => {
    const paths = await Promise.all(
      [0, 1, 2].map(async i => {
        const p = path.join(tmpDir, `batch-${i}.jpg`);
        await createJpeg(p, 400, 400, 100 + i * 50, 100, 100);
        return p;
      })
    );

    const assessor = new ChildQualityAssessor();
    const results = await assessor.assessBatchQuality(paths);

    expect(results).toHaveLength(3);
    for (const r of results) {
      expect(Number.isFinite(r.overallScore)).toBe(true);
      expect(Array.isArray(r.recommendations)).toBe(true);
    }
  });

  it('returns default score (30) for a non-existent file without throwing', async () => {
    const assessor = new ChildQualityAssessor();
    const results = await assessor.assessBatchQuality(['/does/not/exist/fake.jpg']);

    expect(results).toHaveLength(1);
    expect(results[0].overallScore).toBe(30);
    expect(results[0].recommendations).toContain('無法評估照片質量');
  });
});
