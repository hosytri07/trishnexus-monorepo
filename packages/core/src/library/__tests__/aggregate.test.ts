import { describe, expect, it } from 'vitest';
import { enrichRaw } from '../classify.js';
import {
  filterByFormat,
  filterByStatus,
  filterByTag,
  formatBytes,
  searchDocs,
  sortBySize,
  sortByTitle,
  sortRecent,
  summarizeLibrary,
} from '../aggregate.js';
import type { LibraryDoc, RawLibraryEntry } from '../types.js';

function make(raw: Partial<RawLibraryEntry> & { name: string }, o: Partial<LibraryDoc> = {}): LibraryDoc {
  const full: RawLibraryEntry = {
    path: '/x/' + raw.name,
    name: raw.name,
    ext: raw.ext ?? 'pdf',
    size_bytes: raw.size_bytes ?? 1000,
    mtime_ms: raw.mtime_ms ?? null,
  };
  return { ...enrichRaw(full, 0), ...o };
}

describe('summarizeLibrary', () => {
  it('empty library', () => {
    const s = summarizeLibrary([]);
    expect(s.totalDocs).toBe(0);
    expect(s.totalBytes).toBe(0);
    expect(s.byStatus.unread).toBe(0);
  });

  it('counts by format, status, tag', () => {
    const docs = [
      make({ name: 'a.pdf' }, { tags: ['tcvn'], status: 'reading' }),
      make({ name: 'b.docx', ext: 'docx' }, { tags: ['tcvn', 'xây dựng'], status: 'done' }),
      make({ name: 'c.md', ext: 'md' }, { tags: ['ghi chú'], status: 'unread' }),
    ];
    const s = summarizeLibrary(docs);
    expect(s.totalDocs).toBe(3);
    expect(s.byFormat.pdf).toBe(1);
    expect(s.byFormat.docx).toBe(1);
    expect(s.byStatus.reading).toBe(1);
    expect(s.byStatus.done).toBe(1);
    expect(s.byStatus.unread).toBe(1);
    const topTcvn = s.topTags.find((t) => t.tag === 'tcvn');
    expect(topTcvn?.count).toBe(2);
  });

  it('tracks oldest + newest mtime', () => {
    const docs = [
      make({ name: 'a', mtime_ms: 1000 }),
      make({ name: 'b', mtime_ms: 5000 }),
      make({ name: 'c', mtime_ms: 3000 }),
      make({ name: 'd', mtime_ms: null }),
    ];
    const s = summarizeLibrary(docs);
    expect(s.oldestMtimeMs).toBe(1000);
    expect(s.newestMtimeMs).toBe(5000);
  });
});

describe('filterByFormat / filterByStatus / filterByTag', () => {
  const docs = [
    make({ name: 'a.pdf' }, { status: 'done', tags: ['tcvn'] }),
    make({ name: 'b.docx', ext: 'docx' }, { status: 'unread', tags: ['xây dựng'] }),
    make({ name: 'c.pdf' }, { status: 'reading', tags: ['tcvn'] }),
  ];

  it('null passes through', () => {
    expect(filterByFormat(docs, null)).toHaveLength(3);
    expect(filterByStatus(docs, null)).toHaveLength(3);
    expect(filterByTag(docs, null)).toHaveLength(3);
  });

  it('filterByFormat', () => {
    expect(filterByFormat(docs, 'pdf')).toHaveLength(2);
    expect(filterByFormat(docs, 'docx')).toHaveLength(1);
  });

  it('filterByStatus', () => {
    expect(filterByStatus(docs, 'done')).toHaveLength(1);
  });

  it('filterByTag', () => {
    expect(filterByTag(docs, 'tcvn')).toHaveLength(2);
    expect(filterByTag(docs, 'xây dựng')).toHaveLength(1);
  });
});

describe('searchDocs', () => {
  const docs = [
    make({ name: 'tcvn_5574.pdf' }, { title: 'TCVN 5574:2018', authors: ['Nguyen Van A'], tags: ['tcvn'] }),
    make({ name: 'react-handbook.pdf' }, { title: 'React Handbook', note: 'Good book about JSX' }),
  ];

  it('empty query returns all', () => {
    expect(searchDocs(docs, '')).toHaveLength(2);
    expect(searchDocs(docs, '   ')).toHaveLength(2);
  });

  it('matches title', () => {
    expect(searchDocs(docs, 'react')).toHaveLength(1);
  });

  it('matches tag', () => {
    expect(searchDocs(docs, 'tcvn')).toHaveLength(1);
  });

  it('matches author', () => {
    expect(searchDocs(docs, 'nguyen')).toHaveLength(1);
  });

  it('matches note', () => {
    expect(searchDocs(docs, 'jsx')).toHaveLength(1);
  });
});

describe('sort helpers', () => {
  const docs = [
    make({ name: 'a', size_bytes: 100 }, { updatedAt: 300, title: 'Zulu' }),
    make({ name: 'b', size_bytes: 500 }, { updatedAt: 100, title: 'Alpha' }),
    make({ name: 'c', size_bytes: 300 }, { updatedAt: 200, title: 'Mike' }),
  ];

  it('sortRecent by updatedAt desc', () => {
    const r = sortRecent(docs);
    expect(r.map((d) => d.updatedAt)).toEqual([300, 200, 100]);
  });

  it('sortBySize desc', () => {
    const r = sortBySize(docs);
    expect(r.map((d) => d.sizeBytes)).toEqual([500, 300, 100]);
  });

  it('sortByTitle vi-locale asc', () => {
    const r = sortByTitle(docs);
    expect(r.map((d) => d.title)).toEqual(['Alpha', 'Mike', 'Zulu']);
  });
});

describe('formatBytes', () => {
  it('handles B/KB/MB/GB', () => {
    expect(formatBytes(100)).toBe('100 B');
    expect(formatBytes(2048)).toBe('2.0 KB');
    expect(formatBytes(5_000_000)).toBe('4.8 MB');
    expect(formatBytes(2_500_000_000)).toBe('2.33 GB');
  });

  it('handles invalid', () => {
    expect(formatBytes(-1)).toBe('—');
    expect(formatBytes(NaN)).toBe('—');
  });
});
