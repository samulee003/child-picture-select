import { logger } from '../utils/logger';

/**
 * 计算余弦相似度
 * 當向量維度不匹配時，記錄警告並回傳 0
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  if (a.length !== b.length) {
    logger.warn(`⚠️ cosineSimilarity: vector dimension mismatch! a=${a.length} vs b=${b.length}. Returning 0.`);
    return 0;
  }
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    const va = a[i];
    const vb = b[i];
    dot += va * vb;
    na += va * va;
    nb += vb * vb;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb) + 1e-12;
  return dot / denom;
}

/**
 * 计算余弦相似度（简化版本）
 */
export function cosineSim(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector length mismatch: ${a.length} vs ${b.length}`);
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i];
    const bi = b[i];
    dot += ai * bi;
    normA += ai * ai;
    normB += bi * bi;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB) + 1e-9;
  return dot / denom;
}

/**
 * 计算欧几里得距离
 */
export function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector length mismatch: ${a.length} vs ${b.length}`);
  }
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

/**
 * 多參考照融合策略
 * - best: 取所有參考照中的最高相似分（預設行為）
 * - average: 取所有參考照的平均分
 * - weighted: 人臉偵測到的參考照給予 2 倍權重，未偵測到的給 1 倍
 */
export type MultiRefStrategy = 'best' | 'average' | 'weighted' | 'centroid';

/**
 * 從多張參考照的 embedding 計算原型向量（centroid）
 * 將所有 embedding 逐元素平均後 L2 歸一化，產生更穩定的特徵表示
 */
export function computeCentroid(embeddings: number[][]): number[] {
  if (embeddings.length === 0) return [];
  if (embeddings.length === 1) return embeddings[0];

  const dim = embeddings[0].length;
  const sum = new Array(dim).fill(0);
  for (const emb of embeddings) {
    for (let i = 0; i < dim; i++) {
      sum[i] += emb[i];
    }
  }
  // 平均後 L2 歸一化
  return normalizeVector(sum.map(v => v / embeddings.length));
}

/**
 * 穩健 centroid：移除與初始 centroid 相似度低於門檻的離群 embedding 後再平均。
 *
 * 用途：參考照中可能有對齊失敗、側臉、遮擋等低品質 embedding，
 *       這些離群值會拉偏原型向量，導致相似度計算不準。
 *
 * @param embeddings    所有待平均的 embedding 陣列
 * @param minSimilarity 與初始 centroid 的最低餘弦相似度（預設 0.3）。
 *                      低於此值的 embedding 被視為離群值並排除。
 *                      當所有 embedding 都低於門檻時退回使用全部（保守策略）。
 * @returns L2 歸一化的穩健 centroid
 */
export function computeRobustCentroid(
  embeddings: number[][],
  minSimilarity = 0.3
): number[] {
  if (embeddings.length <= 2) return computeCentroid(embeddings);

  // Step 1：計算初始 centroid（包含所有 embedding）
  const initial = computeCentroid(embeddings);

  // Step 2：計算每個 embedding 與初始 centroid 的相似度
  const sims = embeddings.map(emb => cosineSimilarity(emb, initial));

  // Step 3：過濾離群值
  const filtered = embeddings.filter((_, i) => sims[i] >= minSimilarity);

  // 若所有 embedding 都被過濾掉（極端情況），退回使用全部
  if (filtered.length === 0) return initial;

  // 若過濾後只剩相同數量，不需重算
  if (filtered.length === embeddings.length) return initial;

  logger.debug(
    `computeRobustCentroid: removed ${embeddings.length - filtered.length} outlier(s) ` +
      `(sim<${minSimilarity}) out of ${embeddings.length} embeddings`
  );

  return computeCentroid(filtered);
}

/**
 * 加權 centroid：每個 embedding 乘以對應的權重後平均再歸一化。
 * 適用於以偵測信心度或品質分數加權參考照。
 *
 * @param embeddings  embedding 陣列
 * @param weights     對應的非負權重（長度必須與 embeddings 相同）
 * @returns L2 歸一化的加權 centroid
 */
export function computeWeightedCentroid(embeddings: number[][], weights: number[]): number[] {
  if (embeddings.length === 0) return [];
  if (embeddings.length === 1) return normalizeVector(embeddings[0]);
  if (embeddings.length !== weights.length) {
    logger.warn(
      `computeWeightedCentroid: embeddings.length (${embeddings.length}) ≠ weights.length (${weights.length}), falling back to unweighted centroid`
    );
    return computeCentroid(embeddings);
  }

  const dim = embeddings[0].length;
  const sum = new Array(dim).fill(0);
  let totalWeight = 0;

  for (let j = 0; j < embeddings.length; j++) {
    const w = Math.max(0, weights[j]); // 確保非負
    totalWeight += w;
    for (let i = 0; i < dim; i++) {
      sum[i] += embeddings[j][i] * w;
    }
  }

  if (totalWeight === 0) return computeCentroid(embeddings);
  return normalizeVector(sum.map(v => v / totalWeight));
}

/**
 * 計算目標向量對一組參考向量的融合相似度
 * 自動處理向量維度不一致的情況
 */
export function multiReferenceSimilarity(
  target: number[],
  references: Array<{ embedding: number[]; isFace: boolean }>,
  strategy: MultiRefStrategy = 'best'
): number {
  if (references.length === 0) return 0;

  const scores = references.map(ref => {
    const a = target;
    const b = ref.embedding;
    if (a.length !== b.length) {
      const minDim = Math.min(a.length, b.length);
      if (minDim === 0) return 0;
      return cosineSimilarity(a.slice(0, minDim), b.slice(0, minDim));
    }
    return cosineSimilarity(a, b);
  });

  switch (strategy) {
    case 'best':
      return Math.max(...scores);
    case 'average':
      return scores.reduce((a, b) => a + b, 0) / scores.length;
    case 'weighted': {
      let weightedSum = 0;
      let totalWeight = 0;
      for (let i = 0; i < references.length; i++) {
        const w = references[i].isFace ? 2 : 1;
        weightedSum += scores[i] * w;
        totalWeight += w;
      }
      return totalWeight > 0 ? weightedSum / totalWeight : 0;
    }
    case 'centroid': {
      // 先算 centroid，再比對 — 比逐個比較更穩定
      const faceEmbs = references.filter(r => r.isFace).map(r => r.embedding);
      const centroid = faceEmbs.length > 0
        ? computeCentroid(faceEmbs)
        : computeCentroid(references.map(r => r.embedding));
      return cosineSimilarity(target, centroid);
    }
    default:
      return Math.max(...scores);
  }
}

/**
 * 向量归一化
 */
export function normalizeVector(vec: number[]): number[] {
  const magnitude = Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0));
  if (magnitude === 0) {
    return vec.map(() => 0);
  }
  return vec.map(val => val / magnitude);
}
