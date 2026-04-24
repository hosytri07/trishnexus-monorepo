import { describe, expect, it } from 'vitest';
import {
  bestForegroundOn,
  buildContrastMatrix,
  contrastRatio,
  meetsAA,
  meetsAAA,
  ratingFor,
  relativeLuminance,
} from '../contrast.js';

describe('relativeLuminance', () => {
  it('black = 0', () => {
    expect(relativeLuminance('#000000')).toBe(0);
  });
  it('white = 1', () => {
    expect(relativeLuminance('#FFFFFF')).toBeCloseTo(1, 5);
  });
  it('middle gray ~0.215', () => {
    const l = relativeLuminance('#808080');
    expect(l).toBeGreaterThan(0.2);
    expect(l).toBeLessThan(0.25);
  });
});

describe('contrastRatio', () => {
  it('black vs white = 21', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBe(21);
  });
  it('same color = 1', () => {
    expect(contrastRatio('#F59E0B', '#F59E0B')).toBe(1);
  });
  it('symmetric', () => {
    const a = contrastRatio('#2E75B6', '#FFFFFF');
    const b = contrastRatio('#FFFFFF', '#2E75B6');
    expect(a).toBe(b);
  });
});

describe('ratingFor', () => {
  it('labels correctly', () => {
    expect(ratingFor(21)).toBe('AAA');
    expect(ratingFor(7)).toBe('AAA');
    expect(ratingFor(6.9)).toBe('AA');
    expect(ratingFor(4.5)).toBe('AA');
    expect(ratingFor(4.4)).toBe('AA-large');
    expect(ratingFor(3)).toBe('AA-large');
    expect(ratingFor(2.9)).toBe('fail');
    expect(ratingFor(1)).toBe('fail');
  });
});

describe('meetsAA / meetsAAA', () => {
  it('normal text thresholds', () => {
    expect(meetsAA(4.5)).toBe(true);
    expect(meetsAA(4.4)).toBe(false);
    expect(meetsAAA(7)).toBe(true);
    expect(meetsAAA(6.9)).toBe(false);
  });
  it('large text thresholds', () => {
    expect(meetsAA(3, true)).toBe(true);
    expect(meetsAA(2.9, true)).toBe(false);
    expect(meetsAAA(4.5, true)).toBe(true);
  });
});

describe('buildContrastMatrix', () => {
  it('N×N matrix', () => {
    const colors = ['#000000', '#FFFFFF', '#F59E0B'];
    const m = buildContrastMatrix(colors);
    expect(m).toHaveLength(3);
    expect(m[0]).toHaveLength(3);
    // Diagonal = 1
    expect(m[0]?.[0]?.ratio).toBe(1);
    expect(m[1]?.[1]?.ratio).toBe(1);
    // Black vs white top-right
    expect(m[0]?.[1]?.ratio).toBe(21);
  });
});

describe('bestForegroundOn', () => {
  it('picks white on dark bg', () => {
    expect(bestForegroundOn('#0D1116')).toBe('#FFFFFF');
  });
  it('picks black on light bg', () => {
    expect(bestForegroundOn('#F7F8FB')).toBe('#000000');
  });
});
