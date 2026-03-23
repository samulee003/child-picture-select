import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import {
  fileToDeterministicEmbedding,
  fileToEmbedding,
  selectReferenceEmbeddings,
  EMBEDDING_DIMS,
} from './embeddings';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';

// Mock detector to avoid loading real models
const mockDetectFaces = vi.fn(() => Promise.resolve([]));
vi.mock('./detector', () => ({
  detectFaces: (...args: unknown[]) => mockDetectFaces(...args),
  extractFaceEmbedding: vi.fn(() => Promise.resolve(null)),
}));

// Helper: build a unit-normalized embedding biased toward a target direction
function makeEmbedding(seed: number, dims = 512): number[] {
  const arr = new Array(dims).fill(0).map((_, i) => Math.sin(seed + i * 0.1));
  let norm = Math.sqrt(arr.reduce((s, v) => s + v * v, 0));
  return arr.map(v => v / (norm + 1e-12));
}

// Helper: build a FaceDetection-like object
function makeFace(embedding: number[], confidence: number) {
  return { embedding, confidence, bbox: [0, 0, 10, 10] as [number, number, number, number] };
}

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

// ── selectReferenceEmbeddings ─────────────────────────────────────────────

describe('selectReferenceEmbeddings', () => {
  const tmpRef1 = join(process.cwd(), 'tmp-ref-1.jpg');
  const tmpRef2 = join(process.cwd(), 'tmp-ref-2.jpg');
  const tmpRef3 = join(process.cwd(), 'tmp-ref-3.jpg');

  // Child embedding (the target person)
  const childEmb = makeEmbedding(1.0);
  // Parent embedding (different person, clearly different)
  const parentEmb = makeEmbedding(50.0);
  // Another child (similar age, somewhat similar)
  const otherChildEmb = makeEmbedding(3.0);

  beforeAll(async () => {
    await writeFile(tmpRef1, Buffer.from('ref1'));
    await writeFile(tmpRef2, Buffer.from('ref2'));
    await writeFile(tmpRef3, Buffer.from('ref3'));
  });

  afterAll(async () => {
    await unlink(tmpRef1).catch(() => {});
    await unlink(tmpRef2).catch(() => {});
    await unlink(tmpRef3).catch(() => {});
    mockDetectFaces.mockReset();
  });

  it('returns empty array for empty input', async () => {
    const results = await selectReferenceEmbeddings([]);
    expect(results).toHaveLength(0);
  });

  it('single-face refs: selectionMethod is "single-face"', async () => {
    mockDetectFaces.mockResolvedValue([makeFace(childEmb, 0.9)]);

    const results = await selectReferenceEmbeddings([tmpRef1, tmpRef2]);
    expect(results).toHaveLength(2);
    expect(results[0].selectionMethod).toBe('single-face');
    expect(results[1].selectionMethod).toBe('single-face');
    expect(results[0].source).toBe('face');
    expect(results[0].faceCount).toBe(1);
    // embedding should be L2-normalized
    const norm = Math.sqrt(results[0].embedding.reduce((s, v) => s + v * v, 0));
    expect(norm).toBeCloseTo(1.0, 2);
  });

  it('mixed single+multi-face: bootstraps from single-face refs to fix multi-face selection', async () => {
    // ref1 = single face (child)
    // ref2 = two faces: parent (higher confidence) + child
    // ref3 = single face (child)
    mockDetectFaces
      .mockResolvedValueOnce([makeFace(childEmb, 0.9)]) // ref1: 1 face = child
      .mockResolvedValueOnce([
        makeFace(parentEmb, 0.95), // ref2: parent is highest-confidence
        makeFace(childEmb, 0.7), // ref2: child has lower confidence
      ])
      .mockResolvedValueOnce([makeFace(childEmb, 0.85)]); // ref3: 1 face = child

    const results = await selectReferenceEmbeddings([tmpRef1, tmpRef2, tmpRef3]);
    expect(results).toHaveLength(3);

    // ref1 and ref3: single-face
    expect(results[0].selectionMethod).toBe('single-face');
    expect(results[2].selectionMethod).toBe('single-face');

    // ref2: bootstrapped — should select the child face, NOT the parent (highest-conf)
    expect(results[1].selectionMethod).toBe('bootstrapped');
    expect(results[1].bootstrapSimilarity).toBeDefined();

    // The bootstrapped face should be more similar to child than parent
    // Verify by checking cosine similarity between result embedding and child vs parent
    const dotChild = results[1].embedding.reduce((s, v, i) => s + v * childEmb[i], 0);
    const dotParent = results[1].embedding.reduce((s, v, i) => s + v * parentEmb[i], 0);
    expect(dotChild).toBeGreaterThan(dotParent);
  });

  it('all multi-face, no single-face refs: falls back to highest-confidence', async () => {
    mockDetectFaces
      .mockResolvedValueOnce([
        makeFace(parentEmb, 0.95), // parent is highest-confidence
        makeFace(childEmb, 0.7),
      ])
      .mockResolvedValueOnce([
        makeFace(parentEmb, 0.9),
        makeFace(otherChildEmb, 0.6),
      ]);

    const results = await selectReferenceEmbeddings([tmpRef1, tmpRef2]);
    expect(results).toHaveLength(2);
    // No single-face refs → falls back to highest-confidence
    expect(results[0].selectionMethod).toBe('highest-confidence');
    expect(results[1].selectionMethod).toBe('highest-confidence');
    // Should select the highest-confidence face (parent at 0.95/0.9)
    expect(results[0].confidence).toBeCloseTo(0.95, 1);
    expect(results[1].confidence).toBeCloseTo(0.9, 1);
  });

  it('detection failure → deterministic-fallback', async () => {
    mockDetectFaces
      .mockResolvedValueOnce([makeFace(childEmb, 0.9)]) // ref1: ok
      .mockRejectedValue(new Error('SCRFD error')); // ref2: all retries fail

    const results = await selectReferenceEmbeddings([tmpRef1, tmpRef2], { retryOnNoFace: false });
    expect(results).toHaveLength(2);
    expect(results[0].selectionMethod).toBe('single-face');
    expect(results[0].source).toBe('face');
    expect(results[1].selectionMethod).toBe('deterministic-fallback');
    expect(results[1].source).toBe('deterministic');
    expect(results[1].embedding).toHaveLength(EMBEDDING_DIMS);
  });

  it('all embeddings are L2-normalized (unit vectors)', async () => {
    mockDetectFaces.mockResolvedValue([makeFace(childEmb, 0.85)]);

    const results = await selectReferenceEmbeddings([tmpRef1, tmpRef2, tmpRef3]);
    for (const r of results) {
      const norm = Math.sqrt(r.embedding.reduce((s, v) => s + v * v, 0));
      expect(norm).toBeCloseTo(1.0, 2);
    }
  });

  it('no detection and retryOnNoFace=false → deterministic-fallback', async () => {
    mockDetectFaces.mockResolvedValue([]); // no faces detected

    const results = await selectReferenceEmbeddings([tmpRef1], { retryOnNoFace: false });
    expect(results).toHaveLength(1);
    expect(results[0].selectionMethod).toBe('deterministic-fallback');
    expect(results[0].source).toBe('deterministic');
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
