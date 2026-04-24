/**
 * Format classification từ extension + enrichRaw.
 */

import type { DocFormat, LibraryDoc, RawLibraryEntry } from './types.js';

const EXT_MAP: Record<string, DocFormat> = {
  pdf: 'pdf',
  docx: 'docx',
  doc: 'doc',
  epub: 'epub',
  txt: 'txt',
  md: 'md',
  markdown: 'md',
  html: 'html',
  htm: 'html',
  rtf: 'rtf',
  odt: 'odt',
};

export function classifyFormat(ext: string): DocFormat {
  const normalized = ext.replace(/^\./, '').toLowerCase().trim();
  return EXT_MAP[normalized] ?? 'unknown';
}

/**
 * Strip extension + normalize whitespace → candidate title.
 * "[Nguyen Van A] - Giáo_trình Cơ học.pdf" → "[Nguyen Van A] - Giáo trình Cơ học"
 */
export function defaultTitleFromName(name: string): string {
  const lastDot = name.lastIndexOf('.');
  const base = lastDot > 0 ? name.slice(0, lastDot) : name;
  return base.replace(/[_]+/g, ' ').trim();
}

export function stableIdForPath(path: string): string {
  // Deterministic hash-like id. Không cần crypto — chỉ để React key +
  // tránh trùng khi 2 doc cùng name khác folder.
  let h = 2166136261 >>> 0;
  for (let i = 0; i < path.length; i++) {
    h ^= path.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return 'doc_' + (h >>> 0).toString(36);
}

/**
 * Convert raw entry (từ Rust scan) thành LibraryDoc mặc định —
 * status='unread', tags=[], title = filename không extension.
 */
export function enrichRaw(
  raw: RawLibraryEntry,
  now: number,
): LibraryDoc {
  return {
    id: stableIdForPath(raw.path),
    path: raw.path,
    name: raw.name,
    ext: raw.ext,
    format: classifyFormat(raw.ext),
    sizeBytes: raw.size_bytes,
    mtimeMs: raw.mtime_ms,
    title: defaultTitleFromName(raw.name),
    authors: [],
    year: null,
    publisher: null,
    tags: [],
    status: 'unread',
    note: '',
    addedAt: now,
    updatedAt: now,
  };
}

/**
 * Merge doc đã tồn tại với raw entry mới (khi rescan cùng path).
 * Ưu tiên metadata user đã sửa, chỉ update sizeBytes + mtimeMs từ
 * file hệ thống.
 */
export function mergeWithExisting(
  existing: LibraryDoc,
  raw: RawLibraryEntry,
): LibraryDoc {
  if (
    existing.sizeBytes === raw.size_bytes &&
    existing.mtimeMs === raw.mtime_ms
  ) {
    return existing;
  }
  return {
    ...existing,
    sizeBytes: raw.size_bytes,
    mtimeMs: raw.mtime_ms,
  };
}
