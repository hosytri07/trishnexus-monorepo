import { describe, expect, it } from 'vitest';
import {
  buildScale,
  countAccessible,
  pickAccessibleSwatch,
  SCALE_KEYS,
  swatchByKey,
} from '../scale.js';

describe('buildScale', () => {
  it('produces 11 swatches with correct keys', () => {
    const scale = buildScale('primary', '#F59E0B');
    expect(scale.swatches).toHaveLength(11);
    expect(scale.swatches.map((s) => s.key)).toEqual(SCALE_KEYS);
  });
  it('50 is lighter than 950', () => {
    const scale = buildScale('primary', '#F59E0B');
    const s50 = swatchByKey(scale, '50');
    const s950 = swatchByKey(scale, '950');
    expect(s50).toBeDefined();
    expect(s950).toBeDefined();
    if (s50 && s950) {
      expect(s50.contrastBlack).toBeGreaterThan(s950.contrastBlack);
    }
  });
  it('all hex have # prefix and 7 chars', () => {
    const scale = buildScale('primary', '#F59E0B');
    for (const sw of scale.swatches) {
      expect(sw.hex).toMatch(/^#[0-9A-F]{6}$/);
    }
  });
  it('name stored', () => {
    expect(buildScale('neutral', '#808080').name).toBe('neutral');
  });
});

describe('swatchByKey', () => {
  it('returns matching swatch', () => {
    const scale = buildScale('primary', '#F59E0B');
    expect(swatchByKey(scale, '500')).toBeDefined();
  });
  it('undefined for missing', () => {
    const scale = buildScale('primary', '#F59E0B');
    expect(swatchByKey(scale, '999')).toBeUndefined();
  });
});

describe('pickAccessibleSwatch', () => {
  it('finds AA swatch on white bg', () => {
    const scale = buildScale('primary', '#F59E0B');
    const sw = pickAccessibleSwatch(scale, '#FFFFFF', 'AA');
    expect(sw).toBeDefined();
    if (sw) expect(sw.contrastWhite).toBeGreaterThanOrEqual(4.5);
  });
  it('fallback when no AA exists', () => {
    const scale = buildScale('primary', '#F59E0B');
    // 50 cực sáng — không có swatch AAA trên #FFF chắc chắn; dùng threshold AAA.
    const sw = pickAccessibleSwatch(scale, '#F8F8F8', 'AAA');
    expect(sw).toBeDefined(); // Fallback trả swatch contrast cao nhất
  });
});

describe('countAccessible', () => {
  it('counts AA+ swatches on white bg', () => {
    const scale = buildScale('primary', '#F59E0B');
    const n = countAccessible(scale, '#FFFFFF');
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThanOrEqual(11);
  });
});
