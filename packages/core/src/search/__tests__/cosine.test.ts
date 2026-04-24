import { describe, it, expect } from 'vitest';
import { cosine, blendScore } from '../cosine.js';

describe('cosine', () => {
  it('vector giống hệt → similarity = 1', () => {
    expect(cosine([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 6);
  });

  it('vector vuông góc → similarity = 0', () => {
    expect(cosine([1, 0], [0, 1])).toBe(0);
  });

  it('vector ngược dấu → similarity = -1', () => {
    expect(cosine([1, 2], [-1, -2])).toBeCloseTo(-1, 6);
  });

  it('length mismatch → 0 thay vì throw', () => {
    expect(cosine([1, 2, 3], [1, 2])).toBe(0);
  });

  it('vector zero → 0', () => {
    expect(cosine([0, 0, 0], [1, 2, 3])).toBe(0);
  });
});

describe('blendScore', () => {
  it('default 60% semantic, 40% lexical-inverted', () => {
    // lexical=0 (perfect match), semantic=1 → blend = 0.4*1 + 0.6*1 = 1
    expect(blendScore(0, 1)).toBeCloseTo(1, 6);
    // lexical=1 (no match), semantic=0 → blend = 0.4*0 + 0.6*0 = 0
    expect(blendScore(1, 0)).toBeCloseTo(0, 6);
  });

  it('custom weight 0.8 semantic', () => {
    // lexical=0, semantic=0.5 → 0.2*1 + 0.8*0.5 = 0.6
    expect(blendScore(0, 0.5, 0.8)).toBeCloseTo(0.6, 6);
  });

  it('clamp out-of-range values', () => {
    expect(blendScore(-1, 2)).toBeCloseTo(1, 6); // -1 clamp 0, 2 clamp 1
  });
});
