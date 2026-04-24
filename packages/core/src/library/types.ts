/**
 * @trishteam/core/library — Tài liệu (PDF/docx/epub/txt/md) + tag + cite.
 *
 * Phase 14.4.2 (2026-04-24) — alpha local-only. OCR Tesseract dời
 * 14.4.2.b, Firebase sync dời 14.4.2.c.
 */

export type DocFormat =
  | 'pdf'
  | 'docx'
  | 'doc'
  | 'epub'
  | 'txt'
  | 'md'
  | 'html'
  | 'rtf'
  | 'odt'
  | 'unknown';

export const DOC_FORMATS: readonly DocFormat[] = [
  'pdf',
  'docx',
  'doc',
  'epub',
  'txt',
  'md',
  'html',
  'rtf',
  'odt',
  'unknown',
] as const;

export type ReadStatus = 'unread' | 'reading' | 'done' | 'abandoned';

export const READ_STATUSES: readonly ReadStatus[] = [
  'unread',
  'reading',
  'done',
  'abandoned',
] as const;

/**
 * Metadata tối thiểu cho 1 tài liệu. Rust trả `RawLibraryEntry`, domain
 * enrich thành `LibraryDoc` với tag + status + notes tuỳ user.
 */
export interface RawLibraryEntry {
  /** Absolute path — unique key. */
  readonly path: string;
  readonly name: string;
  readonly ext: string;
  readonly size_bytes: number;
  /** File system mtime (ms epoch). */
  readonly mtime_ms: number | null;
}

export interface LibraryDoc {
  readonly id: string;
  readonly path: string;
  readonly name: string;
  readonly ext: string;
  readonly format: DocFormat;
  readonly sizeBytes: number;
  readonly mtimeMs: number | null;
  /** Tiêu đề do user sửa (mặc định = name không extension). */
  title: string;
  /** Tác giả — mảng vì 1 sách có thể nhiều author. */
  authors: string[];
  /** Năm xuất bản — optional. */
  year: number | null;
  /** Nhà xuất bản — optional. */
  publisher: string | null;
  tags: string[];
  status: ReadStatus;
  /** Ghi chú ngắn của user. */
  note: string;
  /** Khi nào user add vào library (ms epoch). */
  addedAt: number;
  /** Last interaction (open/edit meta). Dùng cho recent sort. */
  updatedAt: number;
}

/**
 * Khi user save tài liệu mới. `path` bắt buộc (từ scan hoặc user nhập
 * thủ công), phần còn lại optional.
 */
export interface LibraryDraft {
  path: string;
  title?: string;
  authors?: string[];
  year?: number | null;
  publisher?: string | null;
  tags?: string[];
  status?: ReadStatus;
  note?: string;
}

/**
 * Thống kê tổng quan — render panel "Tổng quan" ở UI.
 */
export interface LibrarySummary {
  readonly totalDocs: number;
  readonly totalBytes: number;
  readonly byFormat: Partial<Record<DocFormat, number>>;
  readonly byStatus: Record<ReadStatus, number>;
  readonly topTags: ReadonlyArray<{ readonly tag: string; readonly count: number }>;
  readonly oldestMtimeMs: number | null;
  readonly newestMtimeMs: number | null;
}
