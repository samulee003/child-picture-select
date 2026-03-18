import { createHash } from 'crypto';
import { readFile } from 'fs/promises';
import { detectFaces } from './detector';
import { logger } from '../utils/logger';
import { AppError } from '../utils/error-handler';

export type Embedding = number[];

export interface FaceAnalysis {
  confidence: number;
  age?: number;
  gender?: 'male' | 'female';
  faceCount: number;
}

export interface EmbeddingResult {
  embedding: Embedding;
  source: 'face' | 'deterministic';
  dimensions: number;
  faceAnalysis?: FaceAnalysis;
  fallbackReason?: 'no_face' | 'detection_error';
  detectionErrorCode?: string;
}

/**
 * deterministic fallback 不是人臉特徵，對匹配分數做保守折減可降低誤判。
 * 實際套用位置在 match 流程。
 */
export const DETERMINISTIC_SCORE_PENALTY = 0.12;

/**
 * FaceRes 模型輸出的 embedding 維度為 1024
 * 確定性 fallback 必須使用相同維度以保持 cosine similarity 可計算
 */
export const EMBEDDING_DIMS = 1024;

// Deterministic placeholder embedding based on file bytes.
// Produces a unit-normalized vector so cosine similarity is computable.
// ⚠️ WARNING: This is NOT a face embedding — it's a file hash.
// Two different files of the same person will produce completely different vectors.
export async function fileToDeterministicEmbedding(filePath: string, dims = EMBEDDING_DIMS): Promise<Embedding> {
  const buf = await readFile(filePath);
  // Hash chunks to expand entropy deterministically
  const hashes: Buffer[] = [];
  let h = createHash('sha256').update(buf).digest();
  hashes.push(h);
  // Generate enough hash rounds to cover dims
  const roundsNeeded = Math.ceil((dims * 4) / 32); // 32 bytes per SHA-256
  for (let i = 0; i < roundsNeeded; i++) {
    h = createHash('sha256').update(h).digest();
    hashes.push(h);
  }
  const source = Buffer.concat(hashes);

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
export interface EmbeddingOptions {
  /** 圖片縮放最大邊長 — 用於團體照小臉偵測，預設 640 */
  maxSize?: number;
  /** 最小臉部信心度 */
  minConfidence?: number;
  /** 抓不到臉時是否自動以更寬鬆條件重試一次 */
  retryOnNoFace?: boolean;
}

export async function fileToEmbeddingWithSource(filePath: string, options: EmbeddingOptions = {}): Promise<EmbeddingResult> {
  let fallbackReason: 'no_face' | 'detection_error' = 'no_face';
  let detectionErrorCode: string | undefined;
  try {
    logger.debug(`Attempting face detection for: ${filePath}`);

    // 嘗試使用真正的臉部偵測（含年齡/性別分析）
    let faces = await detectFaces(filePath, {
      enableAgeGender: true,
      maxSize: options.maxSize,
      minConfidence: options.minConfidence,
    });

    if (faces.length === 0 && options.retryOnNoFace) {
      const retryMaxSize = Math.max(options.maxSize ?? 640, 2048);
      const retryMinConfidence = Math.min(options.minConfidence ?? 0.3, 0.05);
      logger.info(`Retrying face detection with broader settings: ${filePath}`);
      faces = await detectFaces(filePath, {
        enableAgeGender: true,
        maxSize: retryMaxSize,
        minConfidence: retryMinConfidence,
      });
    }

    // 第三次重試：裁切圖片上半部後偵測（適用於全身照，臉部通常在上方 50-60%）
    if (faces.length === 0 && options.retryOnNoFace) {
      logger.info(`Third retry with portrait crop (top 55%): ${filePath}`);
      faces = await detectFaces(filePath, {
        enableAgeGender: true,
        maxSize: 2048,
        minConfidence: 0.05,
        cropTopFraction: 0.55,
      });
    }

    // 第四次重試：裁切上方 38%（頭部特寫），最低信心度 0.01，抓住被頭飾遮擋的臉
    if (faces.length === 0 && options.retryOnNoFace) {
      logger.info(`Fourth retry with tight head crop (top 38%) + relaxed confidence: ${filePath}`);
      faces = await detectFaces(filePath, {
        enableAgeGender: true,
        maxSize: 2048,
        minConfidence: 0.01,
        cropTopFraction: 0.38,
        overrideDetectorMinConfidence: 0.01,
      });
    }

    // 第五次重試：完整圖片，最高解析度，最低信心度（最後手段）
    if (faces.length === 0 && options.retryOnNoFace) {
      logger.info(`Fifth retry with full image at max resolution + minimum confidence: ${filePath}`);
      faces = await detectFaces(filePath, {
        enableAgeGender: true,
        maxSize: 3072,
        minConfidence: 0.01,
        overrideDetectorMinConfidence: 0.01,
      });
    }
    if (faces.length > 0) {
      // 使用信心度最高的臉部
      const bestFace = faces.reduce((best, current) =>
        current.confidence > best.confidence ? current : best
      );

      if (!bestFace.embedding || bestFace.embedding.length === 0) {
        // 偵測到臉但沒有 embedding — 通常代表 faceres 描述模型未載入
        logger.error(
          `❌ Face detected (confidence=${bestFace.confidence.toFixed(3)}) but embedding is EMPTY for: ${filePath}` +
          ' — the faceres description model may have failed to load.' +
          ' Check that faceres.json and its weight shards exist in the models directory.'
        );
        fallbackReason = 'detection_error';
        detectionErrorCode = 'FACERES_MODEL_MISSING';
      }

      if (bestFace.embedding && bestFace.embedding.length > 0) {
        // 確保向量已正規化
        let norm = 0;
        for (let i = 0; i < bestFace.embedding.length; i++) norm += bestFace.embedding[i] * bestFace.embedding[i];
        norm = Math.sqrt(norm) + 1e-12;
        const normalized = bestFace.embedding.map(v => v / norm);

        logger.info(`✅ Face detection successful for: ${filePath} (${normalized.length} dims)`);
        return {
          embedding: normalized,
          source: 'face' as const,
          dimensions: normalized.length,
          faceAnalysis: {
            confidence: bestFace.confidence,
            age: bestFace.age,
            gender: bestFace.gender,
            faceCount: faces.length,
          },
        };
      }
    }

    logger.warn(`⚠️ No face detected in: ${filePath}, using deterministic embedding (NOT a face embedding; keep this result for fallback only)`);
  } catch (err) {
    // 臉部偵測失敗，降級到 deterministic embedding
    fallbackReason = 'detection_error';
    if (err instanceof AppError) detectionErrorCode = err.code;
    logger.warn(`⚠️ Face detection failed for ${filePath}, using deterministic embedding:`, err);
  }

  // 降級到 deterministic embedding
  // 使用 EMBEDDING_DIMS (1024) 以匹配 faceres 模型的輸出維度
  try {
    const deterministicEmbedding = await fileToDeterministicEmbedding(filePath, EMBEDDING_DIMS);
    logger.warn(`🔶 Generated DETERMINISTIC embedding for: ${filePath} — this is a FILE HASH, not a face embedding; UI should suggest manual review`);
    return {
      embedding: deterministicEmbedding,
      source: 'deterministic',
      dimensions: EMBEDDING_DIMS,
      fallbackReason,
      detectionErrorCode,
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
