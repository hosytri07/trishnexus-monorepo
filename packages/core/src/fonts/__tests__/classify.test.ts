import { describe, it, expect } from 'vitest';
import { classifyPersonality } from '../classify.js';
import type { FontMeta } from '../types.js';

function meta(over: Partial<FontMeta> & { family: string }): FontMeta {
  return {
    path: '/fonts/' + over.family + '.ttf',
    family: over.family,
    subfamily: 'Regular',
    full_name: over.family + ' Regular',
    postscript_name: over.family.replace(/\s+/g, '') + '-Regular',
    weight: 400,
    width: 5,
    italic: false,
    monospace: false,
    vn_support: false,
    glyph_count: 500,
    size_bytes: 100_000,
    ...over,
  };
}

describe('classifyPersonality', () => {
  it('monospace flag → mono (bất kể tên)', () => {
    expect(classifyPersonality(meta({ family: 'Whatever', monospace: true }))).toBe(
      'mono',
    );
  });

  it('Times New Roman → serif', () => {
    expect(classifyPersonality(meta({ family: 'Times New Roman' }))).toBe('serif');
  });

  it('Inter → sans', () => {
    expect(classifyPersonality(meta({ family: 'Inter' }))).toBe('sans');
  });

  it('Roboto Slab → slab (ưu tiên hơn sans)', () => {
    expect(classifyPersonality(meta({ family: 'Roboto Slab' }))).toBe('slab');
  });

  it('Dancing Script → script', () => {
    expect(classifyPersonality(meta({ family: 'Dancing Script' }))).toBe('script');
  });

  it('Caveat → handwriting', () => {
    expect(classifyPersonality(meta({ family: 'Caveat' }))).toBe('handwriting');
  });

  it('Bebas Neue → display', () => {
    expect(classifyPersonality(meta({ family: 'Bebas Neue' }))).toBe('display');
  });

  it('weight 900 anonymous name → display fallback', () => {
    expect(
      classifyPersonality(meta({ family: 'MysteryFont', weight: 900 })),
    ).toBe('display');
  });

  it('width 1 (ultra-condensed) → display', () => {
    expect(
      classifyPersonality(meta({ family: 'MysteryFont', width: 1 })),
    ).toBe('display');
  });

  it('default fallback → sans', () => {
    expect(classifyPersonality(meta({ family: 'NeutralName' }))).toBe('sans');
  });

  it('Playfair Display → serif (serif keyword ưu tiên hơn display)', () => {
    // "playfair" không có trong SERIF_KEYS nhưng "display" không trong DISPLAY
    // list as first match. Actually, "display" keyword will be caught —
    // let verify order: SERIF checks come before DISPLAY.
    // Test full_name with "Display" word: "Playfair Display Regular"
    // → SERIF_KEYS contain "playfair" → serif wins.
    expect(
      classifyPersonality(meta({ family: 'Playfair Display' })),
    ).toBe('serif');
  });

  it('normalize underscore + dash', () => {
    expect(
      classifyPersonality(meta({ family: 'Roboto_Slab-Bold' })),
    ).toBe('slab');
  });
});
