import { describe, expect, it } from 'vitest';
import { buildIndex } from '../index-build.js';
import {
  filterHitsBySource,
  sourceLabel,
  summarizeIndex,
} from '../aggregate.js';
import { parseQuery } from '../query.js';
import { searchIndex } from '../rank.js';
import type { FulltextDoc, FulltextHit } from '../types.js';

const NOW = Date.UTC(2026, 3, 24);

function mkDoc(
  id: string,
  source: 'note' | 'library' | 'file',
  title = 'doc',
  body = 'body',
): FulltextDoc {
  return { id, source, title, body, mtimeMs: NOW };
}

describe('summarizeIndex', () => {
  it('counts docs by source', () => {
    const idx = buildIndex([
      mkDoc('n1', 'note'),
      mkDoc('n2', 'note'),
      mkDoc('l1', 'library'),
      mkDoc('f1', 'file'),
    ]);
    const s = summarizeIndex(idx);
    expect(s.totalDocs).toBe(4);
    expect(s.bySource.note).toBe(2);
    expect(s.bySource.library).toBe(1);
    expect(s.bySource.file).toBe(1);
  });

  it('lists top terms by df', () => {
    const idx = buildIndex([
      mkDoc('a', 'note', 'react', 'react library'),
      mkDoc('b', 'note', 'react', 'react tutorial'),
      mkDoc('c', 'note', 'vue', 'vue framework'),
    ]);
    const s = summarizeIndex(idx);
    const reactEntry = s.topTerms.find((t) => t.term === 'react');
    expect(reactEntry?.df).toBe(2);
  });

  it('returns zeros for empty index', () => {
    const idx = buildIndex([]);
    const s = summarizeIndex(idx);
    expect(s.totalDocs).toBe(0);
    expect(s.totalTerms).toBe(0);
    expect(s.avgDocLen).toBe(0);
  });
});

describe('filterHitsBySource', () => {
  it('passes through when source is null', () => {
    const idx = buildIndex([mkDoc('n1', 'note', 'react', 'react body')]);
    const hits = searchIndex(idx, parseQuery('react'), NOW);
    expect(filterHitsBySource(hits, null)).toEqual(hits);
  });

  it('keeps only matching source', () => {
    const idx = buildIndex([
      mkDoc('n1', 'note', 'react', 'react body'),
      mkDoc('l1', 'library', 'react', 'react body'),
    ]);
    const hits: FulltextHit[] = searchIndex(idx, parseQuery('react'), NOW);
    const filtered = filterHitsBySource(hits, 'library');
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.doc.source).toBe('library');
  });
});

describe('sourceLabel', () => {
  it('returns VN label for each source', () => {
    expect(sourceLabel('note')).toBe('Ghi chú');
    expect(sourceLabel('library')).toBe('Thư viện');
    expect(sourceLabel('file')).toBe('File rời');
  });
});
