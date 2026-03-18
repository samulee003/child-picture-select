import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { fileToDeterministicEmbedding, fileToEmbedding, EMBEDDING_DIMS } from './embeddings';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';

// Mock detector to avoid loading real models
vi.mock('./detector', () => ({
  detectFaces: vi.fn(() => Promise.resolve([])),
  extractFaceEmbedding: vi.fn(() => Promise.resolve(null)),
}));

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
    expect(emb.length).toBe(EMBEDDING_DIMS);
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
    testImagePath = join(process.cwd(), 'tmp-test-image.jpg');
    await writeFile(testImagePath, Buffer.from('test image data'));
  });

  afterAll(async () => {
    await unlink(testImagePath).catch(() => {});
  });

  it('returns a normalized embedding vector', async () => {
    const emb = await fileToEmbedding(testImagePath);
    expect(Array.isArray(emb)).toBe(true);
    expect(emb.length).toBe(EMBEDDING_DIMS);

    const norm = Math.sqrt(emb.reduce((s, v) => s + v * v, 0));
    expect(norm).toBeGreaterThan(0.99);
    expect(norm).toBeLessThan(1.01);
  });

  it('falls back to deterministic embedding when face detection fails', async () => {
    const emb = await fileToEmbedding(testImagePath);
    expect(emb.length).toBe(EMBEDDING_DIMS);
    expect(emb.every(v => typeof v === 'number')).toBe(true);
  });

  it('is deterministic for the same file', async () => {
    const a = await fileToEmbedding(testImagePath);
    const b = await fileToEmbedding(testImagePath);
    expect(a.length).toBe(b.length);
    expect(a).toEqual(b);
  });
});
