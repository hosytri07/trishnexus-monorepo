import { describe, it, expect } from 'vitest';
import { buildCollection, recommendPairs, scorePair } from '../pair.js';
import type { FontMeta, FontFamily } from '../types.js';

function meta(over: Partial<FontMeta> & { family: string }): FontMeta {
  return {
    path: '/fonts/' + over.family + '.ttf',
    family: over.family,
    subfamily: 'Regular',
    full_name: over.family + ' ' + (over.subfamily ?? 'Regular'),
    postscript_name:
      over.family.replace(/\s+/g, '') +
      '-' +
      (over.subfamily ?? 'Regular').replace(/\s+/g, ''),
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

describe('buildCollection', () => {
  it('nhóm các style cùng family', () => {
    const c = buildCollection([
      meta({ family: 'Inter', subfamily: 'Regular', weight: 400 }),
      meta({ family: 'Inter', subfamily: 'Bold', weight: 700 }),
      meta({ family: 'Inter', subfamily: 'Italic', weight: 400, italic: true }),
      meta({ family: 'Merriweather', subfamily: 'Regular', weight: 400 }),
    ]);
    expect(c.families).toHaveLength(2);
    const inter = c.families.find((f) => f.family === 'Inter')!;
    expect(inter.styles).toHaveLength(3);
    expect(inter.weight_min).toBe(400);
    expect(inter.weight_max).toBe(700);
    expect(inter.has_italic).toBe(true);
    expect(inter.personality).toBe('sans');
  });

  it('classify personality từ representative (Regular) style', () => {
    const c = buildCollection([
      meta({ family: 'Merriweather', subfamily: 'Regular', weight: 400 }),
      meta({ family: 'Merriweather', subfamily: 'Black', weight: 900 }),
    ]);
    const fam = c.families[0]!;
    expect(fam.personality).toBe('serif');
  });

  it('vn_support true nếu bất kỳ style nào support', () => {
    const c = buildCollection([
      meta({ family: 'Inter', subfamily: 'Regular', vn_support: false }),
      meta({ family: 'Inter', subfamily: 'Bold', vn_support: true, weight: 700 }),
    ]);
    expect(c.families[0]!.vn_support).toBe(true);
  });

  it('total_size_bytes + total_files', () => {
    const c = buildCollection([
      meta({ family: 'A', size_bytes: 100 }),
      meta({ family: 'A', subfamily: 'Bold', size_bytes: 200, weight: 700 }),
      meta({ family: 'B', size_bytes: 50 }),
    ]);
    expect(c.total_files).toBe(3);
    expect(c.total_size_bytes).toBe(350);
  });

  it('sort family theo tên', () => {
    const c = buildCollection([
      meta({ family: 'Zeta' }),
      meta({ family: 'Alpha' }),
      meta({ family: 'Mu' }),
    ]);
    expect(c.families.map((f) => f.family)).toEqual(['Alpha', 'Mu', 'Zeta']);
  });

  it('collection rỗng', () => {
    const c = buildCollection([]);
    expect(c.families).toHaveLength(0);
    expect(c.total_files).toBe(0);
    expect(c.total_size_bytes).toBe(0);
  });
});

function fam(
  family: string,
  personality: FontFamily['personality'],
  over: Partial<FontFamily> = {},
): FontFamily {
  return {
    family,
    personality,
    vn_support: true,
    styles: [meta({ family })],
    weight_min: 400,
    weight_max: 700,
    has_italic: false,
    ...over,
  };
}

describe('scorePair', () => {
  it('serif + sans → score cao (contrast tốt)', () => {
    const p = scorePair(fam('Merriweather', 'serif'), fam('Inter', 'sans'));
    expect(p.score).toBeGreaterThanOrEqual(80);
    expect(p.contrast).toBeGreaterThanOrEqual(0.85);
  });

  it('cùng personality → score thấp hơn', () => {
    const diff = scorePair(fam('Georgia', 'serif'), fam('Inter', 'sans'));
    const same = scorePair(fam('Georgia', 'serif'), fam('Merriweather', 'serif'));
    expect(same.score).toBeLessThan(diff.score);
  });

  it('cùng family → score=0', () => {
    const p = scorePair(fam('Inter', 'sans'), fam('Inter', 'sans'));
    expect(p.score).toBe(0);
    expect(p.rationale).toMatch(/chính nó/);
  });

  it('body không support VN → rationale cảnh báo', () => {
    const p = scorePair(
      fam('Merriweather', 'serif'),
      fam('Inter', 'sans', { vn_support: false }),
    );
    expect(p.rationale).toMatch(/tiếng Việt/);
  });

  it('heading thiếu bold → cảnh báo chìm', () => {
    const p = scorePair(
      fam('ThinOnly', 'display', { weight_min: 300, weight_max: 400 }),
      fam('Inter', 'sans'),
    );
    expect(p.rationale).toMatch(/chìm|đậm/);
  });

  it('score trong range [0, 100]', () => {
    const p = scorePair(fam('A', 'serif'), fam('B', 'sans'));
    expect(p.score).toBeGreaterThanOrEqual(0);
    expect(p.score).toBeLessThanOrEqual(100);
  });
});

describe('recommendPairs', () => {
  function mkCollection(
    list: Array<{ family: string; p: FontFamily['personality']; vn?: boolean }>,
  ) {
    return {
      families: list.map((x) =>
        fam(x.family, x.p, { vn_support: x.vn ?? true }),
      ),
      total_files: list.length,
      total_size_bytes: 0,
    };
  }

  it('return top N sắp xếp theo score giảm dần', () => {
    const c = mkCollection([
      { family: 'Merriweather', p: 'serif' },
      { family: 'Inter', p: 'sans' },
      { family: 'JetBrains Mono', p: 'mono' },
      { family: 'Bebas', p: 'display' },
    ]);
    const pairs = recommendPairs(c, { limit: 3 });
    expect(pairs).toHaveLength(3);
    expect(pairs[0]!.score).toBeGreaterThanOrEqual(pairs[1]!.score);
    expect(pairs[1]!.score).toBeGreaterThanOrEqual(pairs[2]!.score);
  });

  it('fixHeading giới hạn heading family', () => {
    const c = mkCollection([
      { family: 'Merriweather', p: 'serif' },
      { family: 'Inter', p: 'sans' },
      { family: 'Roboto', p: 'sans' },
    ]);
    const pairs = recommendPairs(c, { fixHeading: 'Merriweather' });
    for (const p of pairs) {
      expect(p.heading.family).toBe('Merriweather');
    }
  });

  it('requireVnBody lọc body không support VN', () => {
    const c = mkCollection([
      { family: 'Merriweather', p: 'serif', vn: false },
      { family: 'Inter', p: 'sans', vn: true },
      { family: 'NoVN', p: 'sans', vn: false },
    ]);
    const pairs = recommendPairs(c, { requireVnBody: true });
    for (const p of pairs) {
      expect(p.body.vn_support).toBe(true);
    }
  });

  it('không pair cùng family với chính mình', () => {
    const c = mkCollection([
      { family: 'Merriweather', p: 'serif' },
      { family: 'Inter', p: 'sans' },
    ]);
    const pairs = recommendPairs(c);
    for (const p of pairs) {
      expect(p.heading.family).not.toBe(p.body.family);
    }
  });

  it('collection rỗng → [] ', () => {
    expect(recommendPairs(buildCollection([]))).toEqual([]);
  });
});
