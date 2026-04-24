/**
 * Summarize + filter + sort LibraryDoc.
 */

import type { DocFormat, LibraryDoc, LibrarySummary, ReadStatus } from './types.js';
import { READ_STATUSES } from './types.js';

export function summarizeLibrary(docs: readonly LibraryDoc[]): LibrarySummary {
  let totalBytes = 0;
  const byFormat: Partial<Record<DocFormat, number>> = {};
  const byStatus: Record<ReadStatus, number> = {
    unread: 0,
    reading: 0,
    done: 0,
    abandoned: 0,
  };
  const tagCount = new Map<string, number>();
  let oldest: number | null = null;
  let newest: number | null = null;

  for (const d of docs) {
    totalBytes += d.sizeBytes;
    byFormat[d.format] = (byFormat[d.format] ?? 0) + 1;
    if (READ_STATUSES.includes(d.status)) {
      byStatus[d.status] += 1;
    }
    for (const t of d.tags) {
      tagCount.set(t, (tagCount.get(t) ?? 0) + 1);
    }
    if (d.mtimeMs != null) {
      if (oldest == null || d.mtimeMs < oldest) oldest = d.mtimeMs;
      if (newest == null || d.mtimeMs > newest) newest = d.mtimeMs;
    }
  }

  const topTags = [...tagCount.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
    .slice(0, 16);

  return {
    totalDocs: docs.length,
    totalBytes,
    byFormat,
    byStatus,
    topTags,
    oldestMtimeMs: oldest,
    newestMtimeMs: newest,
  };
}

export function filterByFormat(
  docs: readonly LibraryDoc[],
  format: DocFormat | null,
): LibraryDoc[] {
  if (format == null) return [...docs];
  return docs.filter((d) => d.format === format);
}

export function filterByStatus(
  docs: readonly LibraryDoc[],
  status: ReadStatus | null,
): LibraryDoc[] {
  if (status == null) return [...docs];
  return docs.filter((d) => d.status === status);
}

export function filterByTag(
  docs: readonly LibraryDoc[],
  tag: string | null,
): LibraryDoc[] {
  if (tag == null) return [...docs];
  const needle = tag.toLowerCase();
  return docs.filter((d) => d.tags.includes(needle));
}

/**
 * Simple fuzzy-free search — substring case-insensitive trên
 * title + authors + tags + note. Không dùng Fuse.js vì library
 * thường < 10 000 doc — substring là đủ và không phụ thuộc ngoài.
 */
export function searchDocs(
  docs: readonly LibraryDoc[],
  query: string,
): LibraryDoc[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...docs];
  return docs.filter((d) => {
    if (d.title.toLowerCase().includes(q)) return true;
    if (d.name.toLowerCase().includes(q)) return true;
    if (d.note.toLowerCase().includes(q)) return true;
    if (d.authors.some((a) => a.toLowerCase().includes(q))) return true;
    if (d.tags.some((t) => t.toLowerCase().includes(q))) return true;
    return false;
  });
}

/**
 * Sort theo updatedAt giảm dần (recent first). Trả về mảng mới —
 * không mutate input.
 */
export function sortRecent(docs: readonly LibraryDoc[]): LibraryDoc[] {
  return [...docs].sort((a, b) => b.updatedAt - a.updatedAt);
}

export function sortBySize(docs: readonly LibraryDoc[]): LibraryDoc[] {
  return [...docs].sort((a, b) => b.sizeBytes - a.sizeBytes);
}

export function sortByTitle(docs: readonly LibraryDoc[]): LibraryDoc[] {
  return [...docs].sort((a, b) => a.title.localeCompare(b.title, 'vi'));
}

export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
