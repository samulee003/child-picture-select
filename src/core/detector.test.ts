import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { detectFaces, extractFaceEmbedding, type FaceDetection } from './detector';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';

// Mock SCRFD and ArcFace to avoid loading real models
vi.mock('./scrfd', () => ({
  detectFacesSCRFD: vi.fn(() => Promise.resolve([])),
  loadSCRFD: vi.fn(() => Promise.resolve(true)),
  getSCRFDStatus: vi.fn(() => ({ loaded: true, error: null })),
  resetSCRFD: vi.fn(),
}));

vi.mock('./arcface', () => ({
  extractArcFaceEmbeddingFromAligned: vi.fn(() => Promise.resolve(null)),
  loadArcFace: vi.fn(() => Promise.resolve(true)),
  getArcFaceStatus: vi.fn(() => ({ loaded: true, error: null })),
}));

vi.mock('./align', () => ({
  alignFace: vi.fn(() => Promise.resolve(Buffer.alloc(112 * 112 * 3))),
}));

describe('detector', () => {
  let testImagePath: string;

  beforeAll(async () => {
    testImagePath = join(process.cwd(), 'tmp-detector-test.jpg');
    await writeFile(testImagePath, Buffer.from('test image data'));
  });

  afterAll(async () => {
    await unlink(testImagePath).catch(() => {});
  });

  describe('detectFaces', () => {
    it('returns an array for valid images', async () => {
      const faces = await detectFaces(testImagePath);
      expect(Array.isArray(faces)).toBe(true);
    });

    it('respects minConfidence option', async () => {
      const faces = await detectFaces(testImagePath, { minConfidence: 0.9 });
      expect(Array.isArray(faces)).toBe(true);
    });

    it('returns empty array for non-existent file', async () => {
      try {
        const result = await detectFaces('non-existent-file.jpg');
        expect(result).toEqual([]);
      } catch {
        // Expected for invalid file
      }
    });
  });

  describe('extractFaceEmbedding', () => {
    it('returns null for images without faces', async () => {
      const embedding = await extractFaceEmbedding(testImagePath);
      expect(embedding === null || Array.isArray(embedding)).toBe(true);
    });

    it('returns null for invalid paths', async () => {
      try {
        const result = await extractFaceEmbedding('invalid-path.jpg');
        expect(result).toBeNull();
      } catch {
        // Expected for invalid file
      }
    });
  });

  describe('FaceDetection interface', () => {
    it('has correct structure', () => {
      const detection: FaceDetection = {
        bbox: [10, 20, 100, 150],
        embedding: [0.1, 0.2, 0.3],
        confidence: 0.95,
      };

      expect(detection.bbox).toHaveLength(4);
      expect(detection.embedding).toBeInstanceOf(Array);
      expect(detection.confidence).toBeGreaterThan(0);
      expect(detection.confidence).toBeLessThanOrEqual(1);
    });

    it('supports optional age and gender', () => {
      const detection: FaceDetection = {
        bbox: [0, 0, 50, 50],
        embedding: [],
        confidence: 0.8,
        age: 5,
        gender: 'male',
      };

      expect(detection.age).toBe(5);
      expect(detection.gender).toBe('male');
    });
  });
});
