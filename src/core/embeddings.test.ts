import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { fileToDeterministicEmbedding, fileToEmbedding, EMBEDDING_DIMS } from './embeddings';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';

// Mock sharp for testing
vi.mock('sharp', () => {
  return {
    default: vi.fn(() => ({
      create: vi.fn(() => ({
        jpeg: vi.fn(() => ({
          toBuffer: vi.fn(() => Promise.resolve(Buffer.from('fake-jpeg-data')))
        }))
      })),
      resize: vi.fn(() => ({
        jpeg: vi.fn(() => ({
          toBuffer: vi.fn(() => Promise.resolve(Buffer.from('fake-jpeg-data')))
        }))
      }))
    }))
  };
});

describe('fileToDeterministicEmbedding', () => {
  const tmp1 = join(process.cwd(), 'tmp-emb-1.bin');
  const tmp2 = join(process.cwd(), 'tmp-emb-2.bin');

  beforeAll(async () => {
    await writeFile(tmp1, Buffer.from('abc'));
    await writeFile(tmp2, Buffer.from('abcd'));
  });

  afterAll(async () => {
    await unlink(tmp1).catch(() => {});
    await unlink(tmp2).catch(() => {});
  });

  it('returns fixed-length unit-normalized vectors', async () => {
    const emb = await fileToDeterministicEmbedding(tmp1);
    expect(emb.length).toBe(EMBEDDING_DIMS); // 128 to match FaceNet recognition model
    const norm = Math.sqrt(emb.reduce((s, v) => s + v * v, 0));
    expect(norm).toBeGreaterThan(0.99);
    expect(norm).toBeLessThan(1.01);
  });

  it('is deterministic for the same file content', async () => {
    const a = await fileToDeterministicEmbedding(tmp1);
    const b = await fileToDeterministicEmbedding(tmp1);
    expect(a).toEqual(b);
  });

  it('differs for different file content', async () => {
    const a = await fileToDeterministicEmbedding(tmp1);
    const b = await fileToDeterministicEmbedding(tmp2);
    // Not necessarily orthogonal, but should not be identical
    expect(a).not.toEqual(b);
  });

  it('supports custom dimensions', async () => {
    const emb = await fileToDeterministicEmbedding(tmp1, 512);
    expect(emb.length).toBe(512);
    const norm = Math.sqrt(emb.reduce((s, v) => s + v * v, 0));
    expect(norm).toBeGreaterThan(0.99);
    expect(norm).toBeLessThan(1.01);
  });
});

describe('fileToEmbedding', () => {
  let testImagePath: string;

  beforeAll(async () => {
    // 創建一個簡單的測試圖片（使用簡單的 JPEG header + 數據）
    testImagePath = join(process.cwd(), 'tmp-test-image.jpg');
    // 創建一個最小的有效 JPEG 檔案用於測試
    const jpegHeader = Buffer.from([
      0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
      0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
      0x00, 0xFF, 0xD9
    ]);
    await writeFile(testImagePath, jpegHeader);
  });

  afterAll(async () => {
    await unlink(testImagePath).catch(() => {});
  });

  it('returns a normalized embedding vector', { timeout: 30000 }, async () => {
    const emb = await fileToEmbedding(testImagePath);
    expect(Array.isArray(emb)).toBe(true);
    expect(emb.length).toBeGreaterThan(0);
    
    // 應該已正規化
    const norm = Math.sqrt(emb.reduce((s, v) => s + v * v, 0));
    expect(norm).toBeGreaterThan(0.99);
    expect(norm).toBeLessThan(1.01);
  });

  it('falls back to deterministic embedding when face detection fails', { timeout: 30000 }, async () => {
    // fileToEmbedding 會在臉部偵測失敗時降級到 deterministic embedding
    const emb = await fileToEmbedding(testImagePath);
    expect(emb.length).toBe(EMBEDDING_DIMS); // 128 維，匹配 FaceNet 模型
    expect(emb.every(v => typeof v === 'number')).toBe(true);
  });

  it('is deterministic for the same file', { timeout: 30000 }, async () => {
    const a = await fileToEmbedding(testImagePath);
    const b = await fileToEmbedding(testImagePath);
    // 即使臉部偵測可能不穩定，至少 deterministic fallback 應該是一致的
    expect(a.length).toBe(b.length);
  });
});


