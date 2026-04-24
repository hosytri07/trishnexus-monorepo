import { describe, expect, it } from 'vitest';
import {
  addDocToIndex,
  buildIndex,
  createEmptyIndex,
  mergeIndexes,
  removeDocFromIndex,
} from '../index-build.js';
import type { FulltextDoc } from '../types.js';

const NOW = Date.UTC(2026, 3, 24);

function makeDoc(
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

describe('createEmptyIndex', () => {
  it('returns a valid empty index', () => {
    const idx = createEmptyIndex();
    expect(idx.totalDocs).toBe(0);
    expect(idx.avgDocLen).toBe(0);
    expect(Object.keys(idx.terms)).toHaveLength(0);
    expect(Object.keys(idx.docs)).toHaveLength(0);
  });
});

describe('buildIndex', () => {
  it('indexes N docs and tracks totalDocs', () => {
    const idx = buildIndex([
      makeDoc('a', 'React', 'hello react world'),
      makeDoc('b', 'Vue', 'vue is reactive'),
    ]);
    expect(idx.totalDocs).toBe(2);
    expect(idx.docs['a']).toBeTruthy();
    expect(idx.docs['b']).toBeTruthy();
  });

  it('weights title > tag > body in TF', () => {
    const idx = buildIndex([
      makeDoc('a', 'react', 'react react react', { tags: ['react'] }),
    ]);
    const postings = idx.terms['react'];
    expect(postings).toBeDefined();
    // TF = 3 (title) + 2 (tag) + 3 (body) = 8
    expect(postings?.[0]?.tf).toBe(8);
  });

  it('computes avgDocLen correctly', () => {
    const idx = buildIndex([
      makeDoc('a', 'a', 'one two three'),
      makeDoc('b', 'b', 'four five'),
    ]);
    expect(idx.avgDocLen).toBeGreaterThan(0);
  });
});

describe('addDocToIndex (upsert)', () => {
  it('overwrites existing doc with same id', () => {
    const idx = createEmptyIndex();
    addDocToIndex(idx, makeDoc('x', 'orig', 'original body'));
    addDocToIndex(idx, makeDoc('x', 'new', 'fresh body'));
    expect(idx.totalDocs).toBe(1);
    expect(idx.docs['x']?.title).toBe('new');
    expect(idx.terms['origin']).toBeUndefined();
    expect(idx.terms['fresh']).toBeDefined();
  });
});

describe('removeDocFromIndex', () => {
  it('removes doc and its terms', () => {
    const idx = buildIndex([
      makeDoc('a', 'react', 'react handbook guide'),
      makeDoc('b', 'vue', 'vue tutorial'),
    ]);
    removeDocFromIndex(idx, 'a');
    expect(idx.totalDocs).toBe(1);
    expect(idx.docs['a']).toBeUndefined();
    // 'react' chỉ còn ở posting của b — mà b không có 'react' → term bị xoá
    expect(idx.terms['react']).toBeUndefined();
  });

  it('is idempotent for missing id', () => {
    const idx = createEmptyIndex();
    expect(() => removeDocFromIndex(idx, 'nope')).not.toThrow();
  });
});

describe('mergeIndexes', () => {
  it('combines all docs from both sides', () => {
    const a = buildIndex([makeDoc('a', 'alpha', 'alpha body')]);
    const b = buildIndex([makeDoc('b', 'beta', 'beta body')]);
    const merged = mergeIndexes(a, b);
    expect(merged.totalDocs).toBe(2);
    expect(merged.docs['a']).toBeTruthy();
    expect(merged.docs['b']).toBeTruthy();
  });

  it('last-wins on duplicate id', () => {
    const a = buildIndex([makeDoc('x', 'v1', 'body v1')]);
    const b = buildIndex([makeDoc('x', 'v2', 'body v2')]);
    const merged = mergeIndexes(a, b);
    expect(merged.totalDocs).toBe(1);
    expect(merged.docs['x']?.title).toBe('v2');
  });
});
