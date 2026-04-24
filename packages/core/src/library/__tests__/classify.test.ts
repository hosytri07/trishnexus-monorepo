import { describe, expect, it } from 'vitest';
import {
  classifyFormat,
  defaultTitleFromName,
  enrichRaw,
  mergeWithExisting,
  stableIdForPath,
} from '../classify.js';
import type { LibraryDoc, RawLibraryEntry } from '../types.js';

describe('classifyFormat', () => {
  it('normalizes common extensions', () => {
    expect(classifyFormat('pdf')).toBe('pdf');
    expect(classifyFormat('PDF')).toBe('pdf');
    expect(classifyFormat('.PDF')).toBe('pdf');
    expect(classifyFormat('docx')).toBe('docx');
    expect(classifyFormat('MD')).toBe('md');
    expect(classifyFormat('markdown')).toBe('md');
    expect(classifyFormat('htm')).toBe('html');
  });

  it('falls back to unknown', () => {
    expect(classifyFormat('xyz')).toBe('unknown');
    expect(classifyFormat('')).toBe('unknown');
  });
});

describe('defaultTitleFromName', () => {
  it('strips extension + underscore', () => {
    expect(defaultTitleFromName('Giáo_trình_Bê_tông.pdf')).toBe('Giáo trình Bê tông');
  });

  it('keeps name without extension intact', () => {
    expect(defaultTitleFromName('README')).toBe('README');
  });

  it('handles filenames with multiple dots', () => {
    expect(defaultTitleFromName('report.final.v2.docx')).toBe('report.final.v2');
  });
});

describe('stableIdForPath', () => {
  it('is deterministic', () => {
    expect(stableIdForPath('/a/b.pdf')).toBe(stableIdForPath('/a/b.pdf'));
  });

  it('differs for different paths', () => {
    expect(stableIdForPath('/a/b.pdf')).not.toBe(stableIdForPath('/a/c.pdf'));
  });

  it('prefix doc_', () => {
    expect(stableIdForPath('/x')).toMatch(/^doc_/);
  });
});

const raw: RawLibraryEntry = {
  path: '/books/tcvn_5574.pdf',
  name: 'tcvn_5574.pdf',
  ext: 'pdf',
  size_bytes: 2_000_000,
  mtime_ms: 1_700_000_000_000,
};

describe('enrichRaw', () => {
  it('creates LibraryDoc with defaults', () => {
    const doc = enrichRaw(raw, 123);
    expect(doc.format).toBe('pdf');
    expect(doc.title).toBe('tcvn 5574');
    expect(doc.tags).toEqual([]);
    expect(doc.status).toBe('unread');
    expect(doc.addedAt).toBe(123);
    expect(doc.updatedAt).toBe(123);
  });
});

describe('mergeWithExisting', () => {
  const base: LibraryDoc = enrichRaw(raw, 1);

  it('returns same ref if nothing changed', () => {
    const merged = mergeWithExisting(base, raw);
    expect(merged).toBe(base);
  });

  it('updates sizeBytes + mtimeMs but preserves user metadata', () => {
    const custom: LibraryDoc = { ...base, title: 'TCVN 5574', tags: ['tcvn'] };
    const newer: RawLibraryEntry = { ...raw, size_bytes: 3_000_000, mtime_ms: 1_800_000_000_000 };
    const merged = mergeWithExisting(custom, newer);
    expect(merged.sizeBytes).toBe(3_000_000);
    expect(merged.mtimeMs).toBe(1_800_000_000_000);
    expect(merged.title).toBe('TCVN 5574');
    expect(merged.tags).toEqual(['tcvn']);
  });
});
