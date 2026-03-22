/**
 * Unit tests for src/core/photoEnhancer.ts
 *
 * getThumbsDir (db.ts → electron) 透過 vi.mock 攔截，
 * 讓測試完全不依賴 Electron / SQLite。
 */

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Provide a real temp dir in place of Electron's userData/thumbs
let tmpDir: string;

vi.mock('../../../src/core/db', () => ({
  getThumbsDir: () => tmpDir,
}));

import { PhotoEnhancer } from '../../../src/core/photoEnhancer';

// ── helpers ──────────────────────────────────────────────────────────────────

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'enhancer-test-'));
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

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

describe('PhotoEnhancer.enhancePhoto', () => {
  it('returns an EnhancedPhoto with original and enhanced paths', async () => {
    const src = path.join(tmpDir, 'input-normal.jpg');
    await createJpeg(src, 400, 400, 128, 128, 128);

    const enhancer = new PhotoEnhancer();
    const result = await enhancer.enhancePhoto(src);

    expect(result.originalPath).toBe(src);
    expect(typeof result.enhancedPath).toBe('string');
    expect(Array.isArray(result.enhancements)).toBe(true);
  });

  it('writes the enhanced file to disk', async () => {
    const src = path.join(tmpDir, 'input-write.jpg');
    await createJpeg(src, 400, 400, 80, 80, 80); // dark image

    const enhancer = new PhotoEnhancer();
    const result = await enhancer.enhancePhoto(src);

    expect(fs.existsSync(result.enhancedPath)).toBe(true);
    const stat = fs.statSync(result.enhancedPath);
    expect(stat.size).toBeGreaterThan(0);
  });

  it('enhanced file is a valid JPEG', async () => {
    const src = path.join(tmpDir, 'input-valid.jpg');
    await createJpeg(src, 300, 300, 100, 100, 100);

    const enhancer = new PhotoEnhancer();
    const result = await enhancer.enhancePhoto(src);

    // Should be readable by sharp
    const meta = await sharp(result.enhancedPath).metadata();
    expect(meta.format).toBe('jpeg');
    expect(meta.width).toBeGreaterThan(0);
    expect(meta.height).toBeGreaterThan(0);
  });

  it('applies brightness adjustment for a dark image', async () => {
    const src = path.join(tmpDir, 'input-dark.jpg');
    await createJpeg(src, 300, 300, 30, 30, 30); // very dark

    const enhancer = new PhotoEnhancer();
    const result = await enhancer.enhancePhoto(src);

    // Brightness adjustment should be in the enhancements list
    expect(result.enhancements.some(e => e.includes('亮度'))).toBe(true);
  });

  it('downscales images larger than 1920px on the long side', async () => {
    const src = path.join(tmpDir, 'input-huge.jpg');
    await createJpeg(src, 3000, 2000, 128, 128, 128);

    const enhancer = new PhotoEnhancer();
    const result = await enhancer.enhancePhoto(src);

    const meta = await sharp(result.enhancedPath).metadata();
    expect(Math.max(meta.width ?? 0, meta.height ?? 0)).toBeLessThanOrEqual(1920);
    expect(result.enhancements.some(e => e.includes('調整尺寸'))).toBe(true);
  });

  it('does not downscale images already within 1920px', async () => {
    const src = path.join(tmpDir, 'input-small.jpg');
    await createJpeg(src, 800, 600, 128, 128, 128);

    const enhancer = new PhotoEnhancer();
    const result = await enhancer.enhancePhoto(src);

    expect(result.enhancements.some(e => e.includes('調整尺寸'))).toBe(false);
  });

  it('throws on a non-existent file', async () => {
    const enhancer = new PhotoEnhancer();
    await expect(
      enhancer.enhancePhoto('/does/not/exist/photo.jpg')
    ).rejects.toThrow();
  });
});

describe('PhotoEnhancer.enhanceBatch', () => {
  it('returns successes and failures arrays of the right lengths', async () => {
    const good = path.join(tmpDir, 'batch-good.jpg');
    await createJpeg(good, 300, 300, 120, 120, 120);

    const enhancer = new PhotoEnhancer();
    const result = await enhancer.enhanceBatch([good, '/no/such/file.jpg']);

    expect(result.successes).toHaveLength(1);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0].path).toBe('/no/such/file.jpg');
    expect(typeof result.failures[0].error).toBe('string');
  });

  it('returns all successes when all files are valid', async () => {
    const paths = await Promise.all(
      [0, 1].map(async i => {
        const p = path.join(tmpDir, `batch-valid-${i}.jpg`);
        await createJpeg(p, 200, 200, 100 + i * 40, 100, 100);
        return p;
      })
    );

    const enhancer = new PhotoEnhancer();
    const result = await enhancer.enhanceBatch(paths);

    expect(result.successes).toHaveLength(2);
    expect(result.failures).toHaveLength(0);
  });
});

describe('PhotoEnhancer.getEnhancementSuggestion', () => {
  it('returns full enhancements when quality is far below threshold', () => {
    const enhancer = new PhotoEnhancer();
    const opts = enhancer.getEnhancementSuggestion(30, 70); // gap = 40 > 30

    expect(opts.brightness).toBeDefined();
    expect(opts.contrast).toBeDefined();
    expect(opts.sharpen).toBeDefined();
  });

  it('returns partial enhancements for medium gap', () => {
    const enhancer = new PhotoEnhancer();
    const opts = enhancer.getEnhancementSuggestion(45, 70); // gap = 25

    expect(opts.brightness).toBeDefined();
    expect(opts.contrast).toBeUndefined(); // medium gap: no contrast
  });

  it('returns minimal enhancement for small gap', () => {
    const enhancer = new PhotoEnhancer();
    const opts = enhancer.getEnhancementSuggestion(60, 70); // gap = 10

    expect(opts.brightness).toBeDefined();
    expect(opts.sharpen).toBeUndefined(); // small gap: no sharpen
  });

  it('returns empty options when quality is above threshold', () => {
    const enhancer = new PhotoEnhancer();
    const opts = enhancer.getEnhancementSuggestion(85, 70);

    expect(Object.keys(opts)).toHaveLength(0);
  });
});

describe('PhotoEnhancer.clearTempFiles', () => {
  it('cleans up temp dir without throwing', async () => {
    const src = path.join(tmpDir, 'input-clear.jpg');
    await createJpeg(src, 200, 200, 100, 100, 100);

    const enhancer = new PhotoEnhancer();
    await enhancer.enhancePhoto(src); // creates enhanced/ subdir
    expect(() => enhancer.clearTempFiles()).not.toThrow();
  });
});
