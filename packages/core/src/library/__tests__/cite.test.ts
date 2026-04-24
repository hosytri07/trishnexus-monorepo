import { describe, expect, it } from 'vitest';
import { enrichRaw } from '../classify.js';
import {
  formatAuthorApa,
  formatAuthorIeee,
  formatCitation,
  formatCitationList,
  citeStyleLabel,
  CITE_STYLES,
} from '../cite.js';
import type { LibraryDoc, RawLibraryEntry } from '../types.js';

function docOf(overrides: Partial<LibraryDoc>): LibraryDoc {
  const raw: RawLibraryEntry = {
    path: '/x/a.pdf',
    name: 'a.pdf',
    ext: 'pdf',
    size_bytes: 1000,
    mtime_ms: 0,
  };
  return { ...enrichRaw(raw, 0), ...overrides };
}

describe('citeStyleLabel', () => {
  it('returns human label', () => {
    expect(citeStyleLabel('apa')).toBe('APA 7');
    expect(citeStyleLabel('ieee')).toBe('IEEE');
  });
});

describe('CITE_STYLES', () => {
  it('exposes all styles', () => {
    expect(CITE_STYLES).toEqual(['apa', 'ieee']);
  });
});

describe('formatAuthorApa', () => {
  it('Last, F. M.', () => {
    expect(formatAuthorApa('Nguyen Van An')).toBe('Nguyen, V. A.');
  });

  it('single name', () => {
    expect(formatAuthorApa('Plato')).toBe('Plato');
  });

  it('empty returns empty', () => {
    expect(formatAuthorApa('   ')).toBe('');
  });
});

describe('formatAuthorIeee', () => {
  it('F. M. Last', () => {
    expect(formatAuthorIeee('Nguyen Van An')).toBe('V. A. Nguyen');
  });
});

describe('formatCitation — APA', () => {
  it('single author + year', () => {
    const doc = docOf({
      title: 'Kết cấu bê tông',
      authors: ['Nguyen Van An'],
      year: 2020,
      publisher: 'NXB Xây dựng',
    });
    const s = formatCitation(doc, 'apa');
    expect(s).toContain('Nguyen, V. A.');
    expect(s).toContain('(2020)');
    expect(s).toContain('Kết cấu bê tông');
    expect(s).toContain('NXB Xây dựng');
  });

  it('two authors → &', () => {
    const doc = docOf({
      title: 'Foo',
      authors: ['Nguyen Van A', 'Tran Thi B'],
      year: 2021,
    });
    const s = formatCitation(doc, 'apa');
    expect(s).toContain('Nguyen, V. A. & Tran, T. B.');
  });

  it('three authors → , &', () => {
    const doc = docOf({
      title: 'Foo',
      authors: ['A B', 'C D', 'E F'],
      year: 2021,
    });
    const s = formatCitation(doc, 'apa');
    expect(s).toContain(', & ');
  });

  it('missing year → n.d.', () => {
    const doc = docOf({ title: 'Foo', authors: ['A B'], year: null });
    expect(formatCitation(doc, 'apa')).toContain('(n.d.)');
  });
});

describe('formatCitation — IEEE', () => {
  it('basic format', () => {
    const doc = docOf({
      title: 'A paper',
      authors: ['Nguyen Van A'],
      year: 2022,
      publisher: 'IEEE',
    });
    const s = formatCitation(doc, 'ieee');
    expect(s).toContain('V. A. Nguyen');
    expect(s).toContain('"A paper,"');
    expect(s).toContain('IEEE');
    expect(s).toContain('2022');
  });

  it('2 authors → and', () => {
    const doc = docOf({
      title: 'X',
      authors: ['A B', 'C D'],
      year: 2020,
    });
    const s = formatCitation(doc, 'ieee');
    expect(s).toContain('B. A and D. C');
  });

  it('7+ authors → et al.', () => {
    const doc = docOf({
      title: 'X',
      authors: ['A B', 'C D', 'E F', 'G H', 'I J', 'K L', 'M N', 'O P'],
      year: 2020,
    });
    const s = formatCitation(doc, 'ieee');
    expect(s).toContain('et al.');
  });
});

describe('formatCitationList', () => {
  it('IEEE numbers entries', () => {
    const docs = [
      docOf({ title: 'A', authors: ['X Y'], year: 2020 }),
      docOf({ title: 'B', authors: ['M N'], year: 2021 }),
    ];
    const out = formatCitationList(docs, 'ieee');
    expect(out[0]!.startsWith('[1]')).toBe(true);
    expect(out[1]!.startsWith('[2]')).toBe(true);
  });

  it('APA sorts alphabetically by first author', () => {
    const docs = [
      docOf({ title: 'Z', authors: ['Zebra X'], year: 2020 }),
      docOf({ title: 'A', authors: ['Alpha Y'], year: 2021 }),
    ];
    const out = formatCitationList(docs, 'apa');
    expect(out[0]!).toContain('Alpha');
    expect(out[1]!).toContain('Zebra');
  });
});
