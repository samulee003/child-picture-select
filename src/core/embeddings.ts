import { createHash } from 'crypto';
import { readFile } from 'fs/promises';
import { detectFaces } from './detector';
import { cosineSimilarity, computeCentroid, computeRobustCentroid } from './similarity';
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
 * InsightFace ArcFace recognition model 輸出的 embedding 維度為 512
 * 確定性 fallback 必須使用相同維度以保持 cosine similarity 可計算
 */
export const EMBEDDING_DIMS = 512;

// Deterministic placeholder embedding based on file bytes.
// Produces a unit-normalized vector so cosine similarity is computable.
// ⚠️ WARNING: This is NOT a face embedding — it's a file hash.
// Two different files of the same person will produce completely different vectors.
export async function fileToDeterministicEmbedding(
  filePath: string,
  dims = EMBEDDING_DIMS
): Promise<Embedding> {
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
    arr[i] = byte / 127.5 - 1.0;
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
  /**
   * 參考引導選臉：提供參考照的 embedding（僅限 face-source）。
   * 當照片偵測到多張臉時，選擇與參考 centroid 最相似的臉，
   * 而非預設的最高信心度臉。解決團體照中目標小孩不是最大臉的問題。
   */
  referenceEmbeddings?: number[][];
}

export async function fileToEmbeddingWithSource(
  filePath: string,
  options: EmbeddingOptions = {}
): Promise<EmbeddingResult> {
  let fallbackReason: 'no_face' | 'detection_error' = 'no_face';
  let detectionErrorCode: string | undefined;
  try {
    const startedAt = Date.now();
    logger.info(`🧠 fileToEmbedding start: ${filePath}`);
    logger.info(
      `🧠 detectFaces attempt #1 (conf=${options.minConfidence ?? 0.3}, maxSize=${options.maxSize ?? 'default'}): ${filePath}`
    );

    const detectFacesWithTimeout = async (
      label: string,
      promise: Promise<ReturnType<typeof detectFaces> extends Promise<infer T> ? T : never>
    ) => {
      const timeoutMs = 120_000; // 增加到 120 秒，小孩照片通常都是高畫質大圖
      let timeoutId: NodeJS.Timeout | undefined;

      try {
        return await Promise.race([
          promise,
          new Promise<never>((_, reject) => {
            timeoutId = setTimeout(
              () =>
                reject(
                  new AppError(
                    `Face detection timed out (${label}, ${timeoutMs}ms): ${filePath}`,
                    'FACE_DETECTION_TIMEOUT'
                  )
                ),
              timeoutMs
            );
          }),
        ]);
      } finally {
        // 清理 timeout 避免內存洩漏
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      }
    };

    // Attempt 1：SCRFD 標準（minConfidence=0.3, inputSize=640）
    let faces: Awaited<ReturnType<typeof detectFaces>> = [];
    try {
      faces = await detectFacesWithTimeout(
        'attempt#1',
        detectFaces(filePath, {
          enableAgeGender: true,
          maxSize: options.maxSize,
          minConfidence: options.minConfidence ?? 0.3,
        })
      );
      logger.info(
        `🧠 detectFaces attempt #1 done: faces=${faces.length}, ms=${Date.now() - startedAt}: ${filePath}`
      );
    } catch (err) {
      logger.warn(`⚠️ detectFaces attempt #1 failed: ${filePath}`, err);
    }

    // Attempt 2：降低信心度（minConfidence=0.1）
    if (faces.length === 0 && options.retryOnNoFace) {
      logger.info(`Retry #2: lower confidence (0.1): ${filePath}`);
      try {
        faces = await detectFacesWithTimeout(
          'attempt#2',
          detectFaces(filePath, {
            enableAgeGender: true,
            maxSize: options.maxSize,
            minConfidence: 0.1,
            overrideDetectorMinConfidence: 0.1,
          })
        );
        logger.info(
          `🧠 detectFaces attempt #2 done: faces=${faces.length}, ms=${Date.now() - startedAt}: ${filePath}`
        );
      } catch (err) {
        logger.warn(`⚠️ detectFaces attempt #2 failed: ${filePath}`, err);
      }
    }

    // Attempt 3：裁切上方 55% + minConfidence=0.1（全身照臉部通常在上方）
    if (faces.length === 0 && options.retryOnNoFace) {
      logger.info(`Retry #3: portrait crop (top 55%) + conf=0.1: ${filePath}`);
      try {
        faces = await detectFacesWithTimeout(
          'attempt#3',
          detectFaces(filePath, {
            enableAgeGender: true,
            maxSize: options.maxSize,
            minConfidence: 0.1,
            overrideDetectorMinConfidence: 0.1,
            cropTopFraction: 0.55,
          })
        );
        logger.info(
          `🧠 detectFaces attempt #3 done: faces=${faces.length}, ms=${Date.now() - startedAt}: ${filePath}`
        );
      } catch (err) {
        logger.warn(`⚠️ detectFaces attempt #3 failed: ${filePath}`, err);
      }
    }

    // Attempt 4：裁切上方 38% + minConfidence=0.05（頭部特寫，抓遮擋的臉）
    if (faces.length === 0 && options.retryOnNoFace) {
      logger.info(`Retry #4: tight head crop (top 38%) + conf=0.05: ${filePath}`);
      try {
        faces = await detectFacesWithTimeout(
          'attempt#4',
          detectFaces(filePath, {
            enableAgeGender: true,
            maxSize: options.maxSize,
            minConfidence: 0.05,
            overrideDetectorMinConfidence: 0.05,
            cropTopFraction: 0.38,
          })
        );
        logger.info(
          `🧠 detectFaces attempt #4 done: faces=${faces.length}, ms=${Date.now() - startedAt}: ${filePath}`
        );
      } catch (err) {
        logger.warn(`⚠️ detectFaces attempt #4 failed: ${filePath}`, err);
      }
    }

    // Attempt 5：全圖最大解析度 + minConfidence=0.05（最後手段）
    if (faces.length === 0 && options.retryOnNoFace) {
      logger.info(`Retry #5: full image max resolution + conf=0.05: ${filePath}`);
      try {
        faces = await detectFacesWithTimeout(
          'attempt#5',
          detectFaces(filePath, {
            enableAgeGender: true,
            maxSize: 3072,
            minConfidence: 0.05,
            overrideDetectorMinConfidence: 0.05,
          })
        );
        logger.info(
          `🧠 detectFaces attempt #5 done: faces=${faces.length}, ms=${Date.now() - startedAt}: ${filePath}`
        );
      } catch (err) {
        logger.warn(`⚠️ detectFaces attempt #5 failed: ${filePath}`, err);
      }
    }
    if (faces.length > 0) {
      // ── 選臉策略 ─────────────────────────────────────────────────────
      // 1. 參考引導選臉：當有 referenceEmbeddings 且偵測到 ≥2 張臉時，
      //    計算參考照的 centroid，選擇與 centroid 最相似的臉。
      //    解決團體照中目標小孩不是最大/最清晰臉的問題。
      // 2. 預設：取信心度最高的臉（適用於個人照或無參考照場景）。
      let selectedFace = faces.reduce((best, current) =>
        current.confidence > best.confidence ? current : best
      );
      let selectionMethod = 'highest-confidence';

      if (
        options.referenceEmbeddings &&
        options.referenceEmbeddings.length > 0 &&
        faces.length > 1
      ) {
        // 計算參考照 centroid，與每張偵測到的臉比較
        const refCentroid = computeCentroid(options.referenceEmbeddings);
        if (refCentroid.length > 0) {
          let bestRefSim = -1;
          for (const face of faces) {
            if (!face.embedding || face.embedding.length === 0) continue;
            const sim = cosineSimilarity(face.embedding, refCentroid);
            if (sim > bestRefSim) {
              bestRefSim = sim;
              selectedFace = face;
            }
          }
          selectionMethod = `ref-guided(sim=${bestRefSim.toFixed(3)})`;
          logger.info(
            `🎯 Reference-guided face selection: ${faces.length} faces detected, ` +
              `selected face with ref-similarity=${bestRefSim.toFixed(3)} ` +
              `(conf=${selectedFace.confidence.toFixed(3)}) for: ${filePath}`
          );
        }
      }

      if (!selectedFace.embedding || selectedFace.embedding.length === 0) {
        // 偵測到臉但沒有 embedding — 通常代表 face recognition model 未載入
        logger.error(
          `❌ Face detected (confidence=${selectedFace.confidence.toFixed(3)}) but embedding is EMPTY for: ${filePath}` +
            ' — the face recognition model may have failed to load.' +
            ' Check that face_recognition_model weights exist in the models directory.'
        );
        fallbackReason = 'detection_error';
        detectionErrorCode = 'RECOGNITION_MODEL_MISSING';
      }

      if (selectedFace.embedding && selectedFace.embedding.length > 0) {
        // 確保向量已正規化
        let norm = 0;
        for (let i = 0; i < selectedFace.embedding.length; i++)
          norm += selectedFace.embedding[i] * selectedFace.embedding[i];
        norm = Math.sqrt(norm) + 1e-12;
        const normalized = selectedFace.embedding.map(v => v / norm);

        logger.info(
          `✅ Face detection successful for: ${filePath} (${normalized.length} dims, ` +
            `confidence=${selectedFace.confidence.toFixed(3)}, selection=${selectionMethod}, ` +
            `faces=${faces.length}, ms=${Date.now() - startedAt})`
        );
        return {
          embedding: normalized,
          source: 'face' as const,
          dimensions: normalized.length,
          faceAnalysis: {
            confidence: selectedFace.confidence,
            age: selectedFace.age,
            gender: selectedFace.gender,
            faceCount: faces.length,
          },
        };
      }
    }

    logger.warn(
      `⚠️ No face detected in: ${filePath}, using deterministic embedding (NOT a face embedding; keep this result for fallback only)`
    );
  } catch (err) {
    // 臉部偵測失敗，降級到 deterministic embedding
    fallbackReason = 'detection_error';
    if (err instanceof AppError) detectionErrorCode = err.code;
    logger.warn(`⚠️ Face detection failed for ${filePath}, using deterministic embedding:`, err);
  }

  // 降級到 deterministic embedding
  // 使用 EMBEDDING_DIMS (512) 以匹配 ArcFace 模型的輸出維度
  try {
    const detStart = Date.now();
    const deterministicEmbedding = await fileToDeterministicEmbedding(filePath, EMBEDDING_DIMS);
    logger.warn(
      `🔶 Generated DETERMINISTIC embedding for: ${filePath} (ms=${Date.now() - detStart}) — this is a FILE HASH, not a face embedding; UI should suggest manual review`
    );
    return {
      embedding: deterministicEmbedding,
      source: 'deterministic',
      dimensions: EMBEDDING_DIMS,
      fallbackReason,
      detectionErrorCode,
    };
  } catch (error) {
    throw new AppError(`Failed to generate embedding for ${filePath}`, 'EMBEDDING_ERROR', {
      originalError: error,
    });
  }
}

// ── Bootstrapped Centroid: Reference Photo Selection ──────────────────────

/**
 * 參考照選臉結果
 */
export interface ReferenceSelectionResult {
  filePath: string;
  embedding: number[];
  source: 'face' | 'deterministic';
  faceCount: number;
  /** 選臉策略：single-face=唯一臉、bootstrapped=用初始centroid引導、highest-confidence=退回最高信心度、deterministic-fallback=無臉 */
  selectionMethod:
    | 'single-face'
    | 'bootstrapped'
    | 'highest-confidence'
    | 'deterministic-fallback';
  /** bootstrapped 時與初始 centroid 的相似度 */
  bootstrapSimilarity?: number;
  confidence: number;
  faceAnalysis?: FaceAnalysis;
}

/**
 * Bootstrapped Centroid 參考照選臉
 *
 * 問題：使用者提供的參考照可能包含多張臉（父母、兄弟姐妹），
 *       若直接取最高信心度的臉，通常是大人而非目標小孩，
 *       汙染 centroid 導致整體匹配失敗。
 *
 * 解法：
 *   Phase 1：提取所有參考照的所有臉
 *   Phase 2：找出只有 1 張臉的參考照 → 計算 initialCentroid（保證是目標小孩）
 *   Phase 3：用 initialCentroid 從多臉參考照中選出最像的臉
 *   Phase 4：回傳每個檔案一個最佳 embedding
 *
 * Fallback：若無任何單臉參考照，退回取最高信心度（現有行為）。
 */
export async function selectReferenceEmbeddings(
  files: string[],
  options?: {
    maxSize?: number;
    minConfidence?: number;
    retryOnNoFace?: boolean;
  }
): Promise<ReferenceSelectionResult[]> {
  if (files.length === 0) return [];

  const maxSize = options?.maxSize ?? 1280;
  const retryOnNoFace = options?.retryOnNoFace ?? true;

  // ── Phase 1: 對每張參考照提取所有臉 ──────────────────────
  logger.info(
    `🔬 selectReferenceEmbeddings: Phase 1 — extracting ALL faces from ${files.length} reference photos`
  );

  interface PerFileData {
    filePath: string;
    faces: Array<{ embedding: number[]; confidence: number }>;
    faceCount: number;
    error?: string;
  }

  const perFileData: PerFileData[] = [];

  for (const filePath of files) {
    try {
      const faces = await detectFaces(filePath, {
        enableAgeGender: false,
        maxSize,
        minConfidence: options?.minConfidence ?? 0.01,
      });

      // 若第一次沒臉且允許重試，使用 fileToEmbeddingWithSource 的重試策略
      if (faces.length === 0 && retryOnNoFace) {
        // Retry #2: 降低信心度
        let retryFaces = await detectFaces(filePath, {
          maxSize,
          minConfidence: 0.1,
          overrideDetectorMinConfidence: 0.1,
        }).catch(() => [] as Awaited<ReturnType<typeof detectFaces>>);

        if (retryFaces.length === 0) {
          // Retry #3: portrait crop
          retryFaces = await detectFaces(filePath, {
            maxSize,
            minConfidence: 0.1,
            overrideDetectorMinConfidence: 0.1,
            cropTopFraction: 0.55,
          }).catch(() => [] as Awaited<ReturnType<typeof detectFaces>>);
        }

        if (retryFaces.length === 0) {
          // Retry #4: tight head crop
          retryFaces = await detectFaces(filePath, {
            maxSize,
            minConfidence: 0.05,
            overrideDetectorMinConfidence: 0.05,
            cropTopFraction: 0.38,
          }).catch(() => [] as Awaited<ReturnType<typeof detectFaces>>);
        }

        if (retryFaces.length === 0) {
          // Retry #5: full resolution
          retryFaces = await detectFaces(filePath, {
            maxSize: 3072,
            minConfidence: 0.05,
            overrideDetectorMinConfidence: 0.05,
          }).catch(() => [] as Awaited<ReturnType<typeof detectFaces>>);
        }

        if (retryFaces.length > 0) {
          const validFaces = retryFaces
            .filter(f => f.embedding && f.embedding.length > 0)
            .map(f => ({ embedding: f.embedding, confidence: f.confidence }));
          perFileData.push({
            filePath,
            faces: validFaces,
            faceCount: retryFaces.length,
          });
          continue;
        }
      }

      const validFaces = faces
        .filter(f => f.embedding && f.embedding.length > 0)
        .map(f => ({ embedding: f.embedding, confidence: f.confidence }));

      perFileData.push({ filePath, faces: validFaces, faceCount: faces.length });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(`⚠️ selectReferenceEmbeddings: detection failed for ${filePath}: ${msg}`);
      perFileData.push({ filePath, faces: [], faceCount: 0, error: msg });
    }
  }

  // ── Phase 2: 找單臉參考照 → 初始 centroid ──────────────────
  const singleFaceEmbeddings: number[][] = [];
  const singleFaceFiles: string[] = [];

  for (const data of perFileData) {
    if (data.faces.length === 1) {
      singleFaceEmbeddings.push(data.faces[0].embedding);
      singleFaceFiles.push(data.filePath);
    }
  }

  const hasSingleFaceRefs = singleFaceEmbeddings.length > 0;
  let initialCentroid: number[] = [];

  if (hasSingleFaceRefs) {
    // Use robust centroid to filter out misaligned/side-profile single-face references
    // before building the initial prototype used to guide multi-face selection.
    initialCentroid = computeRobustCentroid(singleFaceEmbeddings, 0.25);
    logger.info(
      `🔬 selectReferenceEmbeddings: Phase 2 — ${singleFaceEmbeddings.length} single-face refs found, ` +
        `robust initialCentroid computed (${initialCentroid.length} dims)`
    );
  } else {
    logger.warn(
      `⚠️ selectReferenceEmbeddings: Phase 2 — NO single-face refs found! ` +
        `Falling back to highest-confidence face selection.`
    );
  }

  // ── Phase 3 & 4: 選臉 + 建結果 ─────────────────────────────
  const results: ReferenceSelectionResult[] = [];

  for (const data of perFileData) {
    // 無臉 → deterministic fallback
    if (data.faces.length === 0) {
      try {
        const detEmb = await fileToDeterministicEmbedding(data.filePath, EMBEDDING_DIMS);
        results.push({
          filePath: data.filePath,
          embedding: detEmb,
          source: 'deterministic',
          faceCount: 0,
          selectionMethod: 'deterministic-fallback',
          confidence: 0,
        });
        logger.warn(
          `🔶 selectReferenceEmbeddings: ${data.filePath} — no face, using deterministic fallback`
        );
      } catch {
        // 連 deterministic 都失敗，給空 embedding
        results.push({
          filePath: data.filePath,
          embedding: new Array(EMBEDDING_DIMS).fill(0),
          source: 'deterministic',
          faceCount: 0,
          selectionMethod: 'deterministic-fallback',
          confidence: 0,
        });
      }
      continue;
    }

    // 只有一張臉 → 直接用
    if (data.faces.length === 1) {
      const face = data.faces[0];
      const normalized = normalizeEmbedding(face.embedding);
      results.push({
        filePath: data.filePath,
        embedding: normalized,
        source: 'face',
        faceCount: 1,
        selectionMethod: 'single-face',
        confidence: face.confidence,
        faceAnalysis: { confidence: face.confidence, faceCount: 1 },
      });
      continue;
    }

    // 多臉 → 用 bootstrapped centroid 或 highest-confidence
    if (hasSingleFaceRefs && initialCentroid.length > 0) {
      // Bootstrapped: 選與 initialCentroid 最像的臉
      let bestSim = -1;
      let bestFace = data.faces[0];
      for (const face of data.faces) {
        const sim = cosineSimilarity(face.embedding, initialCentroid);
        if (sim > bestSim) {
          bestSim = sim;
          bestFace = face;
        }
      }

      const normalized = normalizeEmbedding(bestFace.embedding);
      results.push({
        filePath: data.filePath,
        embedding: normalized,
        source: 'face',
        faceCount: data.faces.length,
        selectionMethod: 'bootstrapped',
        bootstrapSimilarity: bestSim,
        confidence: bestFace.confidence,
        faceAnalysis: { confidence: bestFace.confidence, faceCount: data.faces.length },
      });

      // 找出 highest-confidence face 的 similarity 以便比較
      const hcFace = data.faces.reduce((a, b) => (b.confidence > a.confidence ? b : a));
      const hcSim = cosineSimilarity(hcFace.embedding, initialCentroid);
      const changed = bestFace !== hcFace;

      logger.info(
        `🎯 selectReferenceEmbeddings: ${data.filePath} — ${data.faces.length} faces, ` +
          `bootstrapped: sim=${bestSim.toFixed(3)} conf=${bestFace.confidence.toFixed(3)}` +
          (changed
            ? ` (CHANGED from highest-conf face: sim=${hcSim.toFixed(3)} conf=${hcFace.confidence.toFixed(3)})`
            : ` (same as highest-conf face)`)
      );
    } else {
      // Fallback: 取最高信心度
      const bestFace = data.faces.reduce((a, b) => (b.confidence > a.confidence ? b : a));
      const normalized = normalizeEmbedding(bestFace.embedding);
      results.push({
        filePath: data.filePath,
        embedding: normalized,
        source: 'face',
        faceCount: data.faces.length,
        selectionMethod: 'highest-confidence',
        confidence: bestFace.confidence,
        faceAnalysis: { confidence: bestFace.confidence, faceCount: data.faces.length },
      });
    }
  }

  // 統計
  const methodCounts = {
    'single-face': results.filter(r => r.selectionMethod === 'single-face').length,
    bootstrapped: results.filter(r => r.selectionMethod === 'bootstrapped').length,
    'highest-confidence': results.filter(r => r.selectionMethod === 'highest-confidence').length,
    'deterministic-fallback': results.filter(r => r.selectionMethod === 'deterministic-fallback')
      .length,
  };
  logger.info(
    `🔬 selectReferenceEmbeddings: done. ` +
      `single-face=${methodCounts['single-face']}, ` +
      `bootstrapped=${methodCounts.bootstrapped}, ` +
      `highest-confidence=${methodCounts['highest-confidence']}, ` +
      `deterministic=${methodCounts['deterministic-fallback']}`
  );

  return results;
}

/** L2 正規化 embedding */
function normalizeEmbedding(emb: number[]): number[] {
  let norm = 0;
  for (let i = 0; i < emb.length; i++) norm += emb[i] * emb[i];
  norm = Math.sqrt(norm) + 1e-12;
  return emb.map(v => v / norm);
}

/**
 * 相容舊介面：直接回傳 embedding 陣列
 */
export async function fileToEmbedding(filePath: string): Promise<Embedding> {
  const result = await fileToEmbeddingWithSource(filePath);
  return result.embedding;
}
