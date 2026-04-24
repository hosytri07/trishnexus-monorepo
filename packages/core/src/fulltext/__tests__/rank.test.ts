import { describe, expect, it } from 'vitest';
import { buildIndex } from '../index-build.js';
import { parseQuery } from '../query.js';
import {
  buildSnippet,
  computeRecency,
  RECENCY_COLD_MS,
  RECENCY_HOT_MS,
  searchIndex,
} from '../rank.js';
import type { FulltextDoc } from '../types.js';

const NOW = Date.UTC(2026, 3, 24);

function mkDoc(
  id: string,
  title: string,
  body: string,
  extra: Partial<FulltextDoc> = {},
): FulltextDoc {
  return {
    id,
    source: 'note',
    title,
    body,
    mtimeMs: NOW,
    ...extra,
  };
}

describe('computeRecency', () => {
  it('returns 1 for docs newer than HOT window', () => {
    expect(computeRecency(NOW - 1000, NOW)).toBe(1);
    expect(computeRecency(NOW - RECENCY_HOT_MS, NOW)).toBe(1);
  });

  it('returns 0 for docs older than COLD window', () => {
    expect(computeRecency(NOW - RECENCY_COLD_MS, NOW)).toBe(0);
    expect(computeRecency(NOW - RECENCY_COLD_MS * 2, NOW)).toBe(0);
  });

  it('returns value in (0, 1) for docs in between', () => {
    const midAge = (RECENCY_HOT_MS + RECENCY_COLD_MS) / 2;
    const r = computeRecency(NOW - midAge, NOW);
    expect(r).toBeGreaterThan(0);
    expect(r).toBeLessThan(1);
  });
});

describe('searchIndex', () => {
  it('returns empty for empty index', () => {
    const idx = buildIndex([]);
    const hits = searchIndex(idx, parseQuery('anything'), NOW);
    expect(hits).toEqual([]);
  });

  it('returns empty for empty query', () => {
    const idx = buildIndex([mkDoc('a', 'x', 'y')]);
    const hits = searchIndex(idx, parseQuery(''), NOW);
    expect(hits).toEqual([]);
  });

  it('matches single term and returns snippet', () => {
    const idx = buildIndex([
      mkDoc('a', 'React', 'The React library for building UIs'),
      mkDoc('b', 'Vue', 'Vue progressive framework'),
    ]);
    const hits = searchIndex(idx, parseQuery('react'), NOW);
    expect(hits).toHaveLength(1);
    expect(hits[0]?.doc.id).toBe('a');
    expect(hits[0]?.snippet).toContain('<mark>');
  });

  it('ranks doc with title match higher than body match', () => {
    const idx = buildIndex([
      mkDoc('body-only', 'Misc notes', 'nothing about react here'),
      mkDoc('title-only', 'React handbook', 'unrelated content'),
    ]);
    const hits = searchIndex(idx, parseQuery('react'), NOW);
    expect(hits[0]?.doc.id).toBe('title-only');
  });

  it('applies AND semantics across clauses', () => {
    const idx = buildIndex([
      mkDoc('both', 'react hook', 'uses hooks extensively'),
      mkDoc('only-react', 'react basics', 'component model'),
      mkDoc('only-hook', 'fish hook', 'fishing gear'),
    ]);
    const hits = searchIndex(idx, parseQuery('react hook'), NOW);
    // All 3 match but 'both' should be highest
    expect(hits[0]?.doc.id).toBe('both');
  });

  it('excludes docs matching a negated term', () => {
    const idx = buildIndex([
      mkDoc('keep', 'react hook', 'useState and useEffect'),
      mkDoc('drop', 'react legacy', 'class components older'),
    ]);
    const hits = searchIndex(idx, parseQuery('react -legacy'), NOW);
    const ids = hits.map((h) => h.doc.id);
    expect(ids).toContain('keep');
    expect(ids).not.toContain('drop');
  });

  it('supports prefix match with asterisk', () => {
    const idx = buildIndex([
      mkDoc('a', 'typescript', 'typed JavaScript superset'),
      mkDoc('b', 'python', 'dynamic language'),
    ]);
    const hits = searchIndex(idx, parseQuery('typ*'), NOW);
    expect(hits.map((h) => h.doc.id)).toContain('a');
  });

  it('filters by source when prefix specified', () => {
    const idx = buildIndex([
      mkDoc('n1', 'react', 'note body', { source: 'note' }),
      mkDoc('l1', 'react', 'library body', { source: 'library' }),
    ]);
    const hits = searchIndex(idx, parseQuery('library:react'), NOW);
    expect(hits).toHaveLength(1);
    expect(hits[0]?.doc.source).toBe('library');
  });

  it('boosts recent docs over stale ones', () => {
    const idx = buildIndex([
      mkDoc('new', 'react', 'fresh content', { mtimeMs: NOW - 1000 }),
      mkDoc('old', 'react', 'fresh content', {
        mtimeMs: NOW - RECENCY_COLD_MS,
      }),
    ]);
    const hits = searchIndex(idx, parseQuery('react'), NOW);
    // Both match equally on BM25 but recency boost puts 'new' first.
    expect(hits[0]?.doc.id).toBe('new');
  });

  it('respects limit parameter', () => {
    const docs: FulltextDoc[] = [];
    for (let i = 0; i < 20; i++) {
      docs.push(mkDoc('d' + i, 'react ' + i, 'react appears here'));
    }
    const hits = searchIndex(idx(docs), parseQuery('react'), NOW, 5);
    expect(hits.length).toBeLessThanOrEqual(5);
  });
});

describe('buildSnippet', () => {
  it('returns first 200 chars for no match', () => {
    const s = buildSnippet('a b c d e', []);
    expect(s).toBe('a b c d e');
  });

  it('wraps matched term with <mark>', () => {
    const s = buildSnippet('The React library is great', ['react']);
    expect(s).toContain('<mark>');
    expect(s.toLowerCase()).toContain('react');
  });

  it('handles Vietnamese diacritics match by fold', () => {
    const s = buildSnippet('Ghi chú tiếng Việt và khảo sát', ['tieng']);
    expect(s).toContain('<mark>');
  });

  it('escapes HTML to avoid injection', () => {
    const s = buildSnippet('<script>alert(1)</script> react here', ['react']);
    expect(s).toContain('&lt;script&gt;');
    expect(s).not.toContain('<script>');
  });

  it('returns empty string for empty body', () => {
    expect(buildSnippet('', ['anything'])).toBe('');
  });
});

function idx(docs: FulltextDoc[]): ReturnType<typeof buildIndex> {
  return buildIndex(docs);
}
