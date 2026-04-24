import { describe, expect, it } from 'vitest';
import {
  collectFulltextDocs,
  fileToFulltextDoc,
  libraryDocToFulltextDoc,
  noteToFulltextDoc,
} from '../adapters.js';
import type { Note } from '../../notes/types.js';
import type { LibraryDoc } from '../../library/types.js';

const NOW = Date.UTC(2026, 3, 24);

function mkNote(extra: Partial<Note> = {}): Note {
  return {
    id: 'n1',
    title: 'Test note',
    body: 'Hello world',
    tags: ['todo'],
    createdAt: NOW - 1000,
    updatedAt: NOW,
    deletedAt: null,
    ...extra,
  };
}

function mkLibraryDoc(extra: Partial<LibraryDoc> = {}): LibraryDoc {
  return {
    id: 'l1',
    path: '/books/react.pdf',
    name: 'react.pdf',
    ext: 'pdf',
    format: 'pdf',
    sizeBytes: 1024,
    mtimeMs: NOW,
    addedAt: NOW - 5000,
    updatedAt: NOW,
    title: 'React Handbook',
    authors: ['Flavio Copes'],
    year: 2021,
    publisher: 'Self-published',
    tags: ['javascript'],
    note: 'Reading chapter 3 now',
    status: 'reading',
    ...extra,
  };
}

describe('noteToFulltextDoc', () => {
  it('converts active note', () => {
    const d = noteToFulltextDoc(mkNote());
    expect(d).not.toBeNull();
    expect(d?.id).toBe('note:n1');
    expect(d?.source).toBe('note');
    expect(d?.title).toBe('Test note');
    expect(d?.body).toBe('Hello world');
    expect(d?.mtimeMs).toBe(NOW);
  });

  it('returns null for deleted note', () => {
    expect(noteToFulltextDoc(mkNote({ deletedAt: NOW }))).toBeNull();
  });

  it('falls back title when missing', () => {
    const d = noteToFulltextDoc(mkNote({ title: '' }));
    expect(d?.title).toBe('(không tiêu đề)');
  });
});

describe('libraryDocToFulltextDoc', () => {
  it('includes authors, year, publisher in body', () => {
    const d = libraryDocToFulltextDoc(mkLibraryDoc());
    expect(d.id).toBe('library:l1');
    expect(d.source).toBe('library');
    expect(d.title).toBe('React Handbook');
    expect(d.body).toContain('Flavio Copes');
    expect(d.body).toContain('2021');
    expect(d.body).toContain('Self-published');
    expect(d.body).toContain('chapter 3');
    expect(d.path).toBe('/books/react.pdf');
  });

  it('handles missing authors/year/publisher gracefully', () => {
    const d = libraryDocToFulltextDoc(
      mkLibraryDoc({ authors: [], year: null, publisher: null, note: '' }),
    );
    expect(d.body).toBe('');
  });

  it('falls back to name when title is empty', () => {
    const d = libraryDocToFulltextDoc(mkLibraryDoc({ title: '' }));
    expect(d.title).toBe('react.pdf');
  });
});

describe('fileToFulltextDoc', () => {
  it('extracts basename from unix path', () => {
    const d = fileToFulltextDoc({
      path: '/home/u/docs/readme.md',
      content: 'Hello',
      mtimeMs: NOW,
    });
    expect(d.title).toBe('readme.md');
    expect(d.id).toBe('file:/home/u/docs/readme.md');
  });

  it('extracts basename from windows path', () => {
    const d = fileToFulltextDoc({
      path: 'C:\\Users\\u\\docs\\note.txt',
      content: 'hi',
      mtimeMs: NOW,
    });
    expect(d.title).toBe('note.txt');
  });
});

describe('collectFulltextDocs', () => {
  it('filters deleted notes', () => {
    const docs = collectFulltextDocs({
      notes: [mkNote(), mkNote({ id: 'n2', deletedAt: NOW })],
    });
    expect(docs).toHaveLength(1);
    expect(docs[0]?.id).toBe('note:n1');
  });

  it('aggregates all sources together', () => {
    const docs = collectFulltextDocs({
      notes: [mkNote()],
      libraryDocs: [mkLibraryDoc()],
      files: [{ path: '/tmp/a.md', content: 'hey', mtimeMs: NOW }],
    });
    expect(docs).toHaveLength(3);
    const sources = docs.map((d) => d.source).sort();
    expect(sources).toEqual(['file', 'library', 'note']);
  });

  it('returns empty when no inputs', () => {
    expect(collectFulltextDocs({})).toEqual([]);
  });
});
