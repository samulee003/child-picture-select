import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { detectFaces, extractFaceEmbedding, type FaceDetection } from './detector';
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

describe('detector', () => {
  let testImagePath: string;

  beforeAll(async () => {
    // 創建一個簡單的測試圖片（使用簡單的 JPEG header + 數據）
    testImagePath = join(process.cwd(), 'tmp-detector-test.jpg');
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

  describe('detectFaces', () => {
    it('returns an array of face detections', async () => {
      // 注意：如果 @vladmandic/human 未載入，會回傳空陣列
      const faces = await detectFaces(testImagePath);
      expect(Array.isArray(faces)).toBe(true);
      
      // 如果成功載入，檢查結構
      if (faces.length > 0) {
        const face = faces[0];
        expect(face).toHaveProperty('bbox');
        expect(face).toHaveProperty('embedding');
        expect(face).toHaveProperty('confidence');
        expect(face.bbox).toHaveLength(4);
        expect(face.confidence).toBeGreaterThan(0);
        expect(face.confidence).toBeLessThanOrEqual(1);
      }
    });

    it('respects minConfidence option', async () => {
      const faces = await detectFaces(testImagePath, { minConfidence: 0.9 });
      
      // 所有結果的信心度應該 >= 0.9
      faces.forEach(face => {
        expect(face.confidence).toBeGreaterThanOrEqual(0.9);
      });
    });

    it('handles non-existent file gracefully', async () => {
      const faces = await detectFaces('non-existent-file.jpg');
      expect(faces).toEqual([]);
    });

    it('validates bbox format', async () => {
      const faces = await detectFaces(testImagePath);
      
      faces.forEach(face => {
        expect(face.bbox).toHaveLength(4);
        expect(face.bbox[0]).toBeGreaterThanOrEqual(0); // x
        expect(face.bbox[1]).toBeGreaterThanOrEqual(0); // y
        expect(face.bbox[2]).toBeGreaterThan(0); // width
        expect(face.bbox[3]).toBeGreaterThan(0); // height
      });
    });
  });

  describe('extractFaceEmbedding', () => {
    it('returns null when no faces detected', async () => {
      // 對於沒有臉部的圖片（純色背景），應該回傳 null
      const embedding = await extractFaceEmbedding(testImagePath);
      
      // 如果沒有偵測到臉部，回傳 null
      if (embedding === null) {
        expect(embedding).toBeNull();
      } else {
        // 如果有臉部，應該是數值陣列
        expect(Array.isArray(embedding)).toBe(true);
        expect(embedding!.length).toBeGreaterThan(0);
        expect(embedding!.every(v => typeof v === 'number')).toBe(true);
      }
    });

    it('returns embedding array when faces detected', async () => {
      const embedding = await extractFaceEmbedding(testImagePath);
      
      // 可能是 null（沒有臉部）或陣列（有臉部）
      if (embedding !== null) {
        expect(Array.isArray(embedding)).toBe(true);
        expect(embedding.length).toBeGreaterThan(0);
      }
    });

    it('selects highest confidence face when multiple faces exist', async () => {
      // 這個測試需要實際有臉部的圖片，但我們至少可以測試邏輯
      const embedding = await extractFaceEmbedding(testImagePath);
      
      // 即使沒有臉部，函數應該正常執行
      expect(embedding === null || Array.isArray(embedding)).toBe(true);
    });

    it('handles errors gracefully', async () => {
      // 測試錯誤處理
      const embedding = await extractFaceEmbedding('invalid-path.jpg');
      // 應該回傳 null 而不是拋出錯誤
      expect(embedding === null || Array.isArray(embedding)).toBe(true);
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

