import { describe, expect, it } from 'vitest';
import { buildAllHarmonies, buildHarmony } from '../harmony.js';
import { hexToHsl } from '../convert.js';

describe('buildHarmony', () => {
  it('complementary = 2 colors', () => {
    const h = buildHarmony('complementary', '#FF0000');
    expect(h.colors).toHaveLength(2);
  });
  it('complementary rotates 180°', () => {
    const h = buildHarmony('complementary', '#FF0000');
    const hue = hexToHsl(h.colors[1] ?? '#000000').h;
    expect(hue).toBeCloseTo(180, 0);
  });
  it('triadic = 3 colors, hue 0/120/240', () => {
    const h = buildHarmony('triadic', '#FF0000');
    expect(h.colors).toHaveLength(3);
    const hues = h.colors.map((c) => hexToHsl(c).h);
    expect(hues[0]).toBeCloseTo(0, 0);
    expect(hues[1]).toBeCloseTo(120, 0);
    expect(hues[2]).toBeCloseTo(240, 0);
  });
  it('analogous = 3 colors', () => {
    const h = buildHarmony('analogous', '#F59E0B');
    expect(h.colors).toHaveLength(3);
  });
  it('splitComplementary = 3 colors', () => {
    const h = buildHarmony('splitComplementary', '#F59E0B');
    expect(h.colors).toHaveLength(3);
  });
  it('tetradic = 4 colors', () => {
    const h = buildHarmony('tetradic', '#F59E0B');
    expect(h.colors).toHaveLength(4);
  });
  it('monochromatic = 5 tones', () => {
    const h = buildHarmony('monochromatic', '#F59E0B');
    expect(h.colors).toHaveLength(5);
  });
});

describe('buildAllHarmonies', () => {
  it('returns all 6 kinds', () => {
    const all = buildAllHarmonies('#F59E0B');
    const kinds = all.map((h) => h.kind);
    expect(kinds).toContain('monochromatic');
    expect(kinds).toContain('complementary');
    expect(kinds).toContain('analogous');
    expect(kinds).toContain('triadic');
    expect(kinds).toContain('splitComplementary');
    expect(kinds).toContain('tetradic');
    expect(all).toHaveLength(6);
  });
});
