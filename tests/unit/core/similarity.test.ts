/**
 * 相似度計算單元測試
 */

import { describe, it, expect } from 'vitest';
import {
  cosineSimilarity,
  cosineSim,
  euclideanDistance,
  normalizeVector,
  multiReferenceSimilarity,
  type MultiRefStrategy,
} from '../../../src/core/similarity';

// ──────────────────────────────────────────────
// cosineSimilarity
// ──────────────────────────────────────────────
describe('cosineSimilarity', () => {
  it('returns 1 for identical vectors', () => {
    expect(cosineSimilarity([1, 0, 0], [1, 0, 0])).toBeCloseTo(1);
  });

  it('returns 0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it('returns -1 for opposite vectors', () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1);
  });

  it('returns 0 for empty vectors', () => {
    expect(cosineSimilarity([], [])).toBe(0);
  });

  it('returns 0 on dimension mismatch', () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2])).toBe(0);
  });
});

// ──────────────────────────────────────────────
// cosineSim (throws on mismatch)
// ──────────────────────────────────────────────
describe('cosineSim', () => {
  it('returns 1 for identical vectors', () => {
    expect(cosineSim([3, 4], [3, 4])).toBeCloseTo(1);
  });

  it('throws on dimension mismatch', () => {
    expect(() => cosineSim([1, 2], [1])).toThrow(/length mismatch/i);
  });
});

// ──────────────────────────────────────────────
// euclideanDistance
// ──────────────────────────────────────────────
describe('euclideanDistance', () => {
  it('returns 0 for identical vectors', () => {
    expect(euclideanDistance([1, 2, 3], [1, 2, 3])).toBe(0);
  });

  it('returns correct distance', () => {
    expect(euclideanDistance([0, 0], [3, 4])).toBeCloseTo(5);
  });

  it('throws on dimension mismatch', () => {
    expect(() => euclideanDistance([1, 2], [1])).toThrow(/length mismatch/i);
  });
});

// ──────────────────────────────────────────────
// normalizeVector
// ──────────────────────────────────────────────
describe('normalizeVector', () => {
  it('produces unit vector', () => {
    const norm = normalizeVector([3, 4]);
    const mag = Math.sqrt(norm.reduce((s, v) => s + v * v, 0));
    expect(mag).toBeCloseTo(1);
  });

  it('handles zero vector without throwing', () => {
    const norm = normalizeVector([0, 0, 0]);
    expect(norm).toEqual([0, 0, 0]);
  });
});

// ──────────────────────────────────────────────
// multiReferenceSimilarity
// ──────────────────────────────────────────────
describe('multiReferenceSimilarity', () => {
  const target = [1, 0, 0];

  const refs = [
    { embedding: [1, 0, 0], isFace: true },   // score ≈ 1.0 (face)
    { embedding: [0, 1, 0], isFace: false },   // score ≈ 0.0 (non-face)
    { embedding: [0.6, 0.8, 0], isFace: true }, // score ≈ 0.6 (face)
  ];

  it('returns 0 for empty reference list', () => {
    expect(multiReferenceSimilarity(target, [])).toBe(0);
  });

  it('best strategy returns maximum score', () => {
    const score = multiReferenceSimilarity(target, refs, 'best');
    expect(score).toBeCloseTo(1.0);
  });

  it('average strategy returns mean of all scores', () => {
    const scores = refs.map(r => cosineSimilarity(target, r.embedding));
    const expected = scores.reduce((a, b) => a + b, 0) / scores.length;
    const score = multiReferenceSimilarity(target, refs, 'average');
    expect(score).toBeCloseTo(expected);
  });

  it('weighted strategy gives face refs double weight', () => {
    // refs[0]: isFace=true  score≈1.0, weight=2
    // refs[1]: isFace=false score≈0.0, weight=1
    // refs[2]: isFace=true  score≈0.6, weight=2
    // weighted = (1.0*2 + 0.0*1 + 0.6*2) / (2+1+2) = 3.2/5 = 0.64
    const score = multiReferenceSimilarity(target, refs, 'weighted');
    expect(score).toBeCloseTo(0.64, 1);
  });

  it('defaults to best strategy when no strategy given', () => {
    const explicitBest = multiReferenceSimilarity(target, refs, 'best');
    const defaultScore = multiReferenceSimilarity(target, refs);
    expect(defaultScore).toBeCloseTo(explicitBest);
  });

  it('handles single reference', () => {
    const singleRef = [{ embedding: [1, 0, 0], isFace: true }];
    expect(multiReferenceSimilarity(target, singleRef, 'best')).toBeCloseTo(1.0);
    expect(multiReferenceSimilarity(target, singleRef, 'average')).toBeCloseTo(1.0);
    expect(multiReferenceSimilarity(target, singleRef, 'weighted')).toBeCloseTo(1.0);
  });

  it('handles dimension mismatch gracefully (truncates to min dim)', () => {
    const shortTarget = [1, 0];
    const longRef = [{ embedding: [1, 0, 0], isFace: true }];
    // Should not throw; truncates to length 2
    const score = multiReferenceSimilarity(shortTarget, longRef, 'best');
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it('weighted strategy returns 0 when totalWeight is 0', () => {
    // Impossible in real code (isFace=false gives weight 1), but guard test
    const score = multiReferenceSimilarity(target, [], 'weighted');
    expect(score).toBe(0);
  });

  it('all strategies produce scores in [0, 1] range for normalized vectors', () => {
    const normTarget = normalizeVector([0.5, 0.5, 0.5]);
    const normRefs = [
      { embedding: normalizeVector([1, 0, 0]), isFace: true },
      { embedding: normalizeVector([0, 1, 0]), isFace: false },
    ];
    const strategies: MultiRefStrategy[] = ['best', 'average', 'weighted'];
    for (const strategy of strategies) {
      const score = multiReferenceSimilarity(normTarget, normRefs, strategy);
      expect(score).toBeGreaterThanOrEqual(-0.01);
      expect(score).toBeLessThanOrEqual(1.01);
    }
  });
});
