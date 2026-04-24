import { describe, expect, it } from 'vitest';
import { enrichRaw } from '../classify.js';
import { buildTagIndex, normalizeLibraryTag, suggestTags } from '../tag-suggest.js';
import type { LibraryDoc, RawLibraryEntry } from '../types.js';

function docOf(raw: Partial<RawLibraryEntry> & { name: string }, overrides: Partial<LibraryDoc> = {}): LibraryDoc {
  const full: RawLibraryEntry = {
    path: '/x/' + raw.name,
    name: raw.name,
    ext: raw.ext ?? 'pdf',
    size_bytes: raw.size_bytes ?? 1000,
    mtime_ms: raw.mtime_ms ?? 0,
  };
  return { ...enrichRaw(full, 0), ...overrides };
}

describe('normalizeLibraryTag', () => {
  it('lowercases + collapses whitespace', () => {
    expect(normalizeLibraryTag('  TCVN   5574  ')).toBe('tcvn 5574');
  });
  it('strips leading/trailing hyphen', () => {
    expect(normalizeLibraryTag('-foo-')).toBe('foo');
  });
});

describe('buildTagIndex', () => {
  it('counts tag frequency', () => {
    const docs = [
      docOf({ name: 'a' }, { tags: ['pdf', 'xây dựng'] }),
      docOf({ name: 'b' }, { tags: ['xây dựng'] }),
      docOf({ name: 'c' }, { tags: ['pdf'] }),
    ];
    const idx = buildTagIndex(docs);
    expect(idx.get('pdf')).toBe(2);
    expect(idx.get('xây dựng')).toBe(2);
  });

  it('ignores empty tags', () => {
    const docs = [docOf({ name: 'a' }, { tags: ['', '  '] })];
    expect(buildTagIndex(docs).size).toBe(0);
  });
});

describe('suggestTags — keyword rules', () => {
  it('suggests tcvn when title mentions TCVN', () => {
    const doc = docOf({ name: 'TCVN_5574_2018.pdf' });
    const suggestions = suggestTags(doc, new Map());
    expect(suggestions.some((s) => s.tag === 'tcvn')).toBe(true);
  });

  it('suggests xây dựng for bê tông', () => {
    const doc = docOf({ name: 'ket_cau_be_tong.pdf' });
    doc.title = 'Kết cấu bê tông cốt thép';
    const suggestions = suggestTags(doc, new Map());
    expect(suggestions.some((s) => s.tag === 'xây dựng')).toBe(true);
  });

  it('suggests học for giáo trình', () => {
    const doc = docOf({ name: 'x.pdf' });
    doc.title = 'Giáo trình Vật lý đại cương';
    const suggestions = suggestTags(doc, new Map());
    expect(suggestions.some((s) => s.tag === 'học')).toBe(true);
  });

  it('suggests tiếng việt when title has diacritics', () => {
    const doc = docOf({ name: 'notes.md' });
    doc.title = 'Ghi chú tiếng Việt';
    const suggestions = suggestTags(doc, new Map());
    expect(suggestions.some((s) => s.tag === 'tiếng việt')).toBe(true);
  });

  it('does NOT suggest tcvn for purely English content', () => {
    const doc = docOf({ name: 'react-handbook.pdf' });
    doc.title = 'React Handbook';
    const suggestions = suggestTags(doc, new Map());
    expect(suggestions.some((s) => s.tag === 'tcvn')).toBe(false);
  });
});

describe('suggestTags — format fallback', () => {
  it('fallback md → ghi chú', () => {
    const doc = docOf({ name: 'notes.md', ext: 'md' });
    const suggestions = suggestTags(doc, new Map());
    expect(suggestions.some((s) => s.tag === 'ghi chú')).toBe(true);
  });

  it('fallback epub → sách', () => {
    const doc = docOf({ name: 'novel.epub', ext: 'epub' });
    const suggestions = suggestTags(doc, new Map());
    expect(suggestions.some((s) => s.tag === 'sách')).toBe(true);
  });
});

describe('suggestTags — co-occurrence', () => {
  it('includes popular tags from index', () => {
    const index = new Map<string, number>([
      ['xây dựng', 5],
      ['tcvn', 8],
      ['code', 3],
    ]);
    const doc = docOf({ name: 'random.pdf' });
    doc.title = 'random title';
    const suggestions = suggestTags(doc, index, 10);
    const tags = suggestions.map((s) => s.tag);
    expect(tags).toContain('xây dựng');
    expect(tags).toContain('tcvn');
  });
});

describe('suggestTags — ranking', () => {
  it('keyword rules rank above format fallback', () => {
    const doc = docOf({ name: 'tcvn_5574.pdf' });
    doc.title = 'TCVN 5574';
    const suggestions = suggestTags(doc, new Map());
    const tcvnScore = suggestions.find((s) => s.tag === 'tcvn')?.score ?? 0;
    const fallback = suggestions.find((s) => s.tag === 'tài liệu')?.score ?? 0;
    expect(tcvnScore).toBeGreaterThan(fallback);
  });

  it('limit respected', () => {
    const index = new Map<string, number>(
      Array.from({ length: 50 }, (_, i) => [`tag${i}`, i + 1] as const),
    );
    const doc = docOf({ name: 'x.pdf' });
    const suggestions = suggestTags(doc, index, 5);
    expect(suggestions.length).toBeLessThanOrEqual(5);
  });

  it('sorted by score desc', () => {
    const doc = docOf({ name: 'tcvn.pdf', ext: 'pdf' });
    doc.title = 'TCVN về xây dựng';
    const suggestions = suggestTags(doc, new Map());
    for (let i = 1; i < suggestions.length; i++) {
      expect(suggestions[i - 1]!.score).toBeGreaterThanOrEqual(suggestions[i]!.score);
    }
  });
});
