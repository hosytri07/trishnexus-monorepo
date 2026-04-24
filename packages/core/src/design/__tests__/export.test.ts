import { describe, expect, it } from 'vitest';
import { buildScale } from '../scale.js';
import { createEmptyTokenSet, mergeTokenSets } from '../tokens.js';
import {
  scaleToPlainJson,
  toCssVars,
  toFigmaTokensJson,
  toScssMap,
  toTailwindConfigJs,
} from '../export.js';

function sampleSet() {
  const primary = buildScale('primary', '#F59E0B');
  const accent = buildScale('accent', '#2E75B6');
  const base = createEmptyTokenSet('my-id', 'My Set', primary);
  return mergeTokenSets(base, {
    scales: [accent],
    semantic: { danger: '#FF0000', action: 'primary.500' },
  });
}

describe('toCssVars', () => {
  it('emits :root block', () => {
    const out = toCssVars(sampleSet());
    expect(out).toContain(':root {');
    expect(out).toContain('--color-primary-500:');
    expect(out).toContain('--color-accent-500:');
    expect(out).toContain('--color-danger:');
    expect(out).toContain('--spacing-4:');
    expect(out).toContain('--radius-md:');
    expect(out).toContain('--shadow-md:');
    expect(out.trim().endsWith('}')).toBe(true);
  });
});

describe('toTailwindConfigJs', () => {
  it('emits module.exports', () => {
    const out = toTailwindConfigJs(sampleSet());
    expect(out).toContain('module.exports');
    expect(out).toContain('"primary"');
    expect(out).toContain('"accent"');
    expect(out).toContain('"danger"');
  });
});

describe('toFigmaTokensJson', () => {
  it('valid JSON with color type', () => {
    const out = toFigmaTokensJson(sampleSet());
    const parsed = JSON.parse(out) as Record<string, unknown>;
    expect(parsed).toHaveProperty('primary');
    expect(parsed).toHaveProperty('accent');
    expect(parsed).toHaveProperty('semantic');
    expect(parsed).toHaveProperty('spacing');
    const primary = parsed.primary as Record<string, { type: string }>;
    expect(primary['500']?.type).toBe('color');
  });
});

describe('toScssMap', () => {
  it('emits SCSS map', () => {
    const out = toScssMap(sampleSet());
    expect(out).toContain('$primary:');
    expect(out).toContain('$accent:');
    expect(out).toContain('"500":');
    expect(out).toContain('$semantic:');
  });
});

describe('scaleToPlainJson', () => {
  it('emits flat key → hex', () => {
    const scale = buildScale('primary', '#F59E0B');
    const out = scaleToPlainJson(scale);
    const parsed = JSON.parse(out) as Record<string, string>;
    expect(Object.keys(parsed)).toHaveLength(11);
    expect(parsed['500']).toMatch(/^#[0-9A-F]{6}$/);
  });
});
