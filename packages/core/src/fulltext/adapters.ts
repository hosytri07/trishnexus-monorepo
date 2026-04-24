/**
 * Adapters — chuyển đổi Note / LibraryDoc / raw text file thành
 * `FulltextDoc` để nạp vào index.
 */

import type { Note } from '../notes/types.js';
import type { LibraryDoc } from '../library/types.js';
import type { FulltextDoc } from './types.js';

/**
 * Convert 1 note (từ TrishNote JSON) thành FulltextDoc.
 * Bỏ note đã soft-deleted.
 */
export function noteToFulltextDoc(note: Note): FulltextDoc | null {
  if (note.deletedAt) return null;
  return {
    id: 'note:' + note.id,
    source: 'note',
    title: note.title || '(không tiêu đề)',
    body: note.body || '',
    path: undefined,
    mtimeMs: note.updatedAt ?? note.createdAt ?? 0,
    tags: note.tags ?? [],
  };
}

/**
 * Convert 1 library doc (từ TrishLibrary JSON) thành FulltextDoc.
 * Body = title + authors + note (TrishLibrary chưa có full-text sách,
 * OCR dời 14.4.2.b — nhưng title + authors + note đủ để tìm theo metadata).
 */
export function libraryDocToFulltextDoc(doc: LibraryDoc): FulltextDoc {
  const authorsLine = doc.authors.length ? doc.authors.join(', ') : '';
  const yearLine = doc.year != null ? String(doc.year) : '';
  const publisherLine = doc.publisher ?? '';
  const bodyParts = [authorsLine, yearLine, publisherLine, doc.note]
    .filter((s) => s && s.trim())
    .join('\n');
  return {
    id: 'library:' + doc.id,
    source: 'library',
    title: doc.title || doc.name,
    body: bodyParts,
    path: doc.path,
    mtimeMs: doc.updatedAt ?? doc.mtimeMs,
    tags: doc.tags,
  };
}

/**
 * Convert 1 raw text file thành FulltextDoc. Caller (Rust hoặc dev
 * fallback) chuyền `path`, `content`, `mtimeMs`.
 */
export function fileToFulltextDoc(args: {
  path: string;
  content: string;
  mtimeMs: number;
}): FulltextDoc {
  const basename = extractBasename(args.path);
  return {
    id: 'file:' + args.path,
    source: 'file',
    title: basename,
    body: args.content,
    path: args.path,
    mtimeMs: args.mtimeMs,
    tags: [],
  };
}

function extractBasename(path: string): string {
  const norm = path.replace(/\\/g, '/');
  const i = norm.lastIndexOf('/');
  return i === -1 ? norm : norm.slice(i + 1);
}

/**
 * Gom adapter lại — nhận 3 nguồn tùy chọn, trả về mảng FulltextDoc đã
 * lọc null (note deleted).
 */
export function collectFulltextDocs(args: {
  notes?: readonly Note[];
  libraryDocs?: readonly LibraryDoc[];
  files?: ReadonlyArray<{ path: string; content: string; mtimeMs: number }>;
}): FulltextDoc[] {
  const out: FulltextDoc[] = [];
  for (const n of args.notes ?? []) {
    const d = noteToFulltextDoc(n);
    if (d) out.push(d);
  }
  for (const l of args.libraryDocs ?? []) {
    out.push(libraryDocToFulltextDoc(l));
  }
  for (const f of args.files ?? []) {
    out.push(fileToFulltextDoc(f));
  }
  return out;
}
