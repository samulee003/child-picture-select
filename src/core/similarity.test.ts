import { describe, it, expect } from 'vitest';
import {
  cosineSimilarity,
  cosineSim,
  computeCentroid,
  computeRobustCentroid,
  computeWeightedCentroid,
  normalizeVector,
} from './similarity';

describe('cosineSimilarity', () => {
  it('returns 1 for identical vectors', () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBeCloseTo(1, 6);
  });
  it('returns 0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 6);
  });
  it('is symmetric and bounded', () => {
    const a = [0.3, -0.7, 0.2];
    const b = [-0.4, 0.1, 0.9];
    const ab = cosineSimilarity(a, b);
    const ba = cosineSimilarity(b, a);
    expect(ab).toBeCloseTo(ba, 10);
    expect(Math.abs(ab)).toBeLessThanOrEqual(1);
  });
});

describe('cosineSim', () => {
  it('returns 1 for identical vectors', () => {
    expect(cosineSim([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 6);
  });

  it('returns -1 for opposite vectors', () => {
    expect(cosineSim([1, 0], [-1, 0])).toBeCloseTo(-1, 6);
  });

  it('returns 0 for orthogonal vectors', () => {
    expect(cosineSim([1, 0], [0, 1])).toBeCloseTo(0, 6);
  });

  it('throws on length mismatch', () => {
    expect(() => cosineSim([1, 2], [1])).toThrow();
  });
});

describe('computeCentroid', () => {
  it('returns empty for empty input', () => {
    expect(computeCentroid([])).toEqual([]);
  });

  it('returns the single embedding unchanged when given one', () => {
    const e = [1, 0, 0];
    expect(computeCentroid([e])).toEqual(e);
  });

  it('produces a unit-length vector for two embeddings', () => {
    const c = computeCentroid([[1, 0], [0, 1]]);
    const mag = Math.sqrt(c.reduce((s, v) => s + v * v, 0));
    expect(mag).toBeCloseTo(1, 5);
  });

  it('centroid of identical vectors equals that vector (normalized)', () => {
    const e = normalizeVector([3, 4]);
    const c = computeCentroid([e, e, e]);
    expect(c[0]).toBeCloseTo(e[0], 5);
    expect(c[1]).toBeCloseTo(e[1], 5);
  });
});

describe('computeRobustCentroid', () => {
  it('returns empty for empty input', () => {
    expect(computeRobustCentroid([])).toEqual([]);
  });

  it('returns the single embedding for one-element input', () => {
    const e = [1, 0, 0];
    expect(computeRobustCentroid([e])).toEqual(e);
  });

  it('passes through when all embeddings are close (≤2 items)', () => {
    const a = normalizeVector([1, 0]);
    const b = normalizeVector([0.9, 0.1]);
    const result = computeRobustCentroid([a, b], 0.5);
    const mag = Math.sqrt(result.reduce((s, v) => s + v * v, 0));
    expect(mag).toBeCloseTo(1, 5);
  });

  it('removes an outlier that deviates from the cluster', () => {
    // Three embeddings pointing roughly in the same direction,
    // plus one outlier pointing opposite.
    const good1 = normalizeVector([1, 0.1, 0]);
    const good2 = normalizeVector([0.9, 0.2, 0]);
    const good3 = normalizeVector([0.95, 0.05, 0]);
    const outlier = normalizeVector([-1, -0.1, 0]); // opposite direction

    const robust = computeRobustCentroid([good1, good2, good3, outlier], 0.3);
    const plain = computeCentroid([good1, good2, good3, outlier]);

    // Robust centroid should be more aligned with [1,0,0] than plain centroid
    const robustSim = cosineSimilarity(robust, [1, 0, 0]);
    const plainSim = cosineSimilarity(plain, [1, 0, 0]);
    expect(robustSim).toBeGreaterThan(plainSim);
  });

  it('falls back to full centroid when all embeddings are outliers', () => {
    // All point in completely different directions — no consensus
    const a = normalizeVector([1, 0, 0]);
    const b = normalizeVector([0, 1, 0]);
    const c = normalizeVector([0, 0, 1]);
    // With a very high threshold, all are filtered → fallback
    const result = computeRobustCentroid([a, b, c], 0.99);
    // Should not throw; result should be a unit vector
    const mag = Math.sqrt(result.reduce((s, v) => s + v * v, 0));
    expect(mag).toBeCloseTo(1, 5);
  });

  it('result is unit-length', () => {
    const embs = [
      normalizeVector([1, 0.2, -0.3]),
      normalizeVector([0.8, 0.5, 0.1]),
      normalizeVector([0.9, 0.3, -0.1]),
      normalizeVector([-0.9, 0.1, 0.2]), // outlier
    ];
    const result = computeRobustCentroid(embs, 0.4);
    const mag = Math.sqrt(result.reduce((s, v) => s + v * v, 0));
    expect(mag).toBeCloseTo(1, 5);
  });
});

describe('computeWeightedCentroid', () => {
  it('returns empty for empty input', () => {
    expect(computeWeightedCentroid([], [])).toEqual([]);
  });

  it('returns normalized single embedding', () => {
    const e = [3, 4];
    const result = computeWeightedCentroid([e], [1]);
    const mag = Math.sqrt(result.reduce((s, v) => s + v * v, 0));
    expect(mag).toBeCloseTo(1, 5);
  });

  it('equal weights produce the same result as computeCentroid', () => {
    const a = normalizeVector([1, 0.5]);
    const b = normalizeVector([0.5, 1]);
    const plain = computeCentroid([a, b]);
    const weighted = computeWeightedCentroid([a, b], [1, 1]);
    expect(weighted[0]).toBeCloseTo(plain[0], 5);
    expect(weighted[1]).toBeCloseTo(plain[1], 5);
  });

  it('high weight on one embedding pulls centroid toward it', () => {
    const target = normalizeVector([1, 0]);
    const other = normalizeVector([0, 1]);
    // Weight target heavily
    const result = computeWeightedCentroid([target, other], [10, 1]);
    const simToTarget = cosineSimilarity(result, target);
    const simToOther = cosineSimilarity(result, other);
    expect(simToTarget).toBeGreaterThan(simToOther);
  });

  it('falls back to unweighted centroid on length mismatch', () => {
    const a = normalizeVector([1, 0]);
    const b = normalizeVector([0, 1]);
    // Wrong weights length — should not throw
    const result = computeWeightedCentroid([a, b], [1]);
    const mag = Math.sqrt(result.reduce((s, v) => s + v * v, 0));
    expect(mag).toBeCloseTo(1, 5);
  });

  it('zero total weight falls back to unweighted centroid', () => {
    const a = normalizeVector([1, 0]);
    const b = normalizeVector([0, 1]);
    // All-zero weights → fallback
    const result = computeWeightedCentroid([a, b], [0, 0]);
    const mag = Math.sqrt(result.reduce((s, v) => s + v * v, 0));
    expect(mag).toBeCloseTo(1, 5);
  });

  it('result is always unit-length for valid normalized inputs', () => {
    const embs = [
      normalizeVector([1, 2, 3]),
      normalizeVector([4, 5, 6]),
      normalizeVector([-1, 0, 1]),
    ];
    const weights = [0.8, 0.9, 0.5];
    const result = computeWeightedCentroid(embs, weights);
    const mag = Math.sqrt(result.reduce((s, v) => s + v * v, 0));
    expect(mag).toBeCloseTo(1, 5);
  });
});


