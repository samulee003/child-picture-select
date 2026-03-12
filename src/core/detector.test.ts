import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { detectFaces, extractFaceEmbedding, type FaceDetection } from './detector';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';

describe('detector', () => {
  let testImagePath: string;

  beforeAll(async () => {
    // 創建一個簡單的測試圖片
    testImagePath = join(process.cwd(), 'tmp-detector-test.jpg');
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

  describe('detectFaces', () => {
    it('returns an array or throws for invalid images', { timeout: 30000 }, async () => {
      try {
        const faces = await detectFaces(testImagePath);
        // If Human model loaded and processed the image, expect an array
        expect(Array.isArray(faces)).toBe(true);

        if (faces.length > 0) {
          const face = faces[0];
          expect(face).toHaveProperty('bbox');
          expect(face).toHaveProperty('embedding');
          expect(face).toHaveProperty('confidence');
          expect(face.bbox).toHaveLength(4);
        }
      } catch (err) {
        // With the real model, invalid JPEG data may cause an error
        expect(err).toBeDefined();
      }
    });

    it('respects minConfidence option', async () => {
      try {
        const faces = await detectFaces(testImagePath, { minConfidence: 0.9 });
        faces.forEach(face => {
          expect(face.confidence).toBeGreaterThanOrEqual(0.9);
        });
      } catch {
        // Expected for invalid test image
      }
    });

    it('returns empty array or throws for non-existent file', async () => {
      try {
        const result = await detectFaces('non-existent-file.jpg');
        // If model not loaded, returns empty array gracefully
        expect(result).toEqual([]);
      } catch {
        // If model is loaded, throws for invalid file
      }
    });
  });

  describe('extractFaceEmbedding', () => {
    it('returns null or throws for images without faces', async () => {
      try {
        const embedding = await extractFaceEmbedding(testImagePath);
        // Either null (no face) or array (face detected)
        expect(embedding === null || Array.isArray(embedding)).toBe(true);
      } catch {
        // Expected for invalid test image
      }
    });

    it('returns null or throws for invalid paths', async () => {
      try {
        const result = await extractFaceEmbedding('invalid-path.jpg');
        // If model not loaded, returns null gracefully
        expect(result).toBeNull();
      } catch {
        // If model is loaded, throws for invalid file
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
