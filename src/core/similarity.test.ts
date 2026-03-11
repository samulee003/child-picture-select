import { describe, it, expect } from 'vitest';
import { cosineSimilarity, cosineSim } from './similarity';

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


