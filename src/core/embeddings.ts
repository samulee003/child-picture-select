import { createHash } from 'crypto';
import { readFile } from 'fs/promises';
import { extractFaceEmbedding } from './detector';
import { logger } from '../utils/logger';
import { AppError } from '../utils/error-handler';

export type Embedding = number[];

export interface EmbeddingResult {
  embedding: Embedding;
  source: 'face' | 'deterministic';
  dimensions: number;
}

// Deterministic placeholder embedding based on file bytes.
// Produces a 128-dim unit-normalized vector so cosine similarity is meaningful.
// ⚠️ WARNING: This is NOT a face embedding — it's a file hash.
// Two different files of the same person will produce completely different vectors.
export async function fileToDeterministicEmbedding(filePath: string, dims = 128): Promise<Embedding> {
  const buf = await readFile(filePath);
  // Hash chunks to expand entropy deterministically
  const h1 = createHash('sha256').update(buf).digest();
  const h2 = createHash('sha256').update(h1).digest();
  const h3 = createHash('sha256').update(h2).digest();
  const source = Buffer.concat([h1, h2, h3]);

  const arr = new Array<number>(dims);
  for (let i = 0; i < dims; i++) {
    const byte = source[i % source.length];
    // map byte [0,255] -> [-1,1]
    arr[i] = (byte / 127.5) - 1.0;
  }
  // L2 normalize
  let norm = 0;
  for (let i = 0; i < dims; i++) norm += arr[i] * arr[i];
  norm = Math.sqrt(norm) + 1e-12;
  for (let i = 0; i < dims; i++) arr[i] /= norm;
  return arr;
}

/**
 * 從圖片檔案提取臉部特徵向量
 * 優先使用真正的臉部偵測，失敗時降級到 deterministic embedding
 * 回傳包含來源資訊的結果
 */
export async function fileToEmbeddingWithSource(filePath: string): Promise<EmbeddingResult> {
  try {
    logger.debug(`Attempting face detection for: ${filePath}`);
    
    // 嘗試使用真正的臉部偵測
    const faceEmbedding = await extractFaceEmbedding(filePath);
    if (faceEmbedding && faceEmbedding.length > 0) {
      // 確保向量已正規化
      let norm = 0;
      for (let i = 0; i < faceEmbedding.length; i++) norm += faceEmbedding[i] * faceEmbedding[i];
      norm = Math.sqrt(norm) + 1e-12;
      const normalized = faceEmbedding.map(v => v / norm);
      
      logger.info(`✅ Face detection successful for: ${filePath} (${normalized.length} dims)`);
      return {
        embedding: normalized,
        source: 'face',
        dimensions: normalized.length,
      };
    }
    
    logger.warn(`⚠️ No face detected in: ${filePath}, using deterministic embedding (NOT a face embedding!)`);
  } catch (err) {
    // 臉部偵測失敗，降級到 deterministic embedding
    logger.warn(`⚠️ Face detection failed for ${filePath}, using deterministic embedding:`, err);
  }

  // 降級到 deterministic embedding
  // 使用 512 維以匹配常見的臉部特徵向量維度
  try {
    const deterministicEmbedding = await fileToDeterministicEmbedding(filePath, 512);
    logger.warn(`🔶 Generated DETERMINISTIC embedding for: ${filePath} — this is a FILE HASH, not a face embedding!`);
    return {
      embedding: deterministicEmbedding,
      source: 'deterministic',
      dimensions: 512,
    };
  } catch (error) {
    throw new AppError(
      `Failed to generate embedding for ${filePath}`,
      'EMBEDDING_ERROR',
      { originalError: error }
    );
  }
}

/**
 * 相容舊介面：直接回傳 embedding 陣列
 */
export async function fileToEmbedding(filePath: string): Promise<Embedding> {
  const result = await fileToEmbeddingWithSource(filePath);
  return result.embedding;
}
