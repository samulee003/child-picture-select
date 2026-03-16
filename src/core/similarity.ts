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
export type MultiRefStrategy = 'best' | 'average' | 'weighted';

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
