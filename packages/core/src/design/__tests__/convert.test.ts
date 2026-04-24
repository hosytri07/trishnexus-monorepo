import { describe, expect, it } from 'vitest';
import {
  clamp,
  hexToRgb,
  hexToHsl,
  hslToHex,
  hslToRgb,
  normalizeHex,
  parseColor,
  rgbToHex,
  rgbToHsl,
} from '../convert.js';

describe('clamp', () => {
  it('clamps in range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });
  it('NaN → min', () => {
    expect(clamp(Number.NaN, 3, 10)).toBe(3);
  });
});

describe('hexToRgb', () => {
  it('parses 6-digit', () => {
    expect(hexToRgb('#FF8800')).toEqual({ r: 255, g: 136, b: 0 });
  });
  it('parses 3-digit', () => {
    expect(hexToRgb('#f80')).toEqual({ r: 255, g: 136, b: 0 });
  });
  it('parses 8-digit with alpha', () => {
    const rgb = hexToRgb('#FF880080');
    expect(rgb.r).toBe(255);
    expect(rgb.g).toBe(136);
    expect(rgb.b).toBe(0);
    expect(rgb.a).toBeCloseTo(0.502, 2);
  });
  it('accepts without hash', () => {
    expect(hexToRgb('F80')).toEqual({ r: 255, g: 136, b: 0 });
  });
  it('rejects invalid', () => {
    expect(() => hexToRgb('#GGG')).toThrow(/Invalid hex/);
  });
});

describe('rgbToHex', () => {
  it('round-trip', () => {
    expect(rgbToHex({ r: 255, g: 136, b: 0 })).toBe('#FF8800');
  });
  it('alpha < 1 includes alpha', () => {
    expect(rgbToHex({ r: 0, g: 0, b: 0, a: 0.5 })).toBe('#00000080');
  });
  it('alpha = 1 omits alpha', () => {
    expect(rgbToHex({ r: 0, g: 0, b: 0, a: 1 })).toBe('#000000');
  });
  it('clamps oversaturated', () => {
    expect(rgbToHex({ r: 300, g: -5, b: 128 })).toBe('#FF0080');
  });
});

describe('rgbToHsl ↔ hslToRgb', () => {
  it('pure red → 0° hue', () => {
    const hsl = rgbToHsl({ r: 255, g: 0, b: 0 });
    expect(hsl.h).toBe(0);
    expect(hsl.s).toBe(100);
    expect(hsl.l).toBe(50);
  });
  it('pure green → 120°', () => {
    const hsl = rgbToHsl({ r: 0, g: 255, b: 0 });
    expect(hsl.h).toBe(120);
  });
  it('white → l=100 s=0', () => {
    const hsl = rgbToHsl({ r: 255, g: 255, b: 255 });
    expect(hsl.s).toBe(0);
    expect(hsl.l).toBe(100);
  });
  it('round-trip keeps hex', () => {
    const hex = '#F59E0B';
    expect(hslToHex(hexToHsl(hex))).toBe(hex);
  });
  it('hslToRgb with saturation=0 returns gray', () => {
    expect(hslToRgb({ h: 180, s: 0, l: 50 })).toEqual({
      r: 128,
      g: 128,
      b: 128,
    });
  });
});

describe('parseColor', () => {
  it('parses hex', () => {
    expect(parseColor('#FF0000')).toEqual({ r: 255, g: 0, b: 0 });
  });
  it('parses rgb()', () => {
    expect(parseColor('rgb(10, 20, 30)')).toEqual({ r: 10, g: 20, b: 30 });
  });
  it('parses rgba()', () => {
    const rgb = parseColor('rgba(10, 20, 30, 0.5)');
    expect(rgb).toEqual({ r: 10, g: 20, b: 30, a: 0.5 });
  });
  it('parses hsl()', () => {
    const rgb = parseColor('hsl(0, 100%, 50%)');
    expect(rgb.r).toBe(255);
    expect(rgb.g).toBe(0);
    expect(rgb.b).toBe(0);
  });
  it('throws on garbage', () => {
    expect(() => parseColor('not a color')).toThrow(/Cannot parse/);
  });
});

describe('normalizeHex', () => {
  it('uppercases', () => {
    expect(normalizeHex('#abcdef')).toBe('#ABCDEF');
  });
  it('expands shorthand', () => {
    expect(normalizeHex('#f80')).toBe('#FF8800');
  });
});
