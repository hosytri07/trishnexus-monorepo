/**
 * Aggregate helper — thống kê index + lọc source.
 */

import type {
  FulltextHit,
  FulltextIndex,
  FulltextSource,
} from './types.js';
import { FULLTEXT_SOURCES } from './types.js';

export interface IndexStats {
  totalDocs: number;
  totalTerms: number;
  avgDocLen: number;
  bySource: Record<FulltextSource, number>;
  topTerms: Array<{ term: string; df: number }>;
}

/**
 * Thống kê tóm tắt cho UI — số doc theo source, avg length, top term
 * có document frequency cao nhất.
 */
export function summarizeIndex(index: FulltextIndex): IndexStats {
  const bySource: Record<FulltextSource, number> = {
    note: 0,
    library: 0,
    file: 0,
  };
  for (const id of Object.keys(index.docs)) {
    const meta = index.docs[id];
    if (!meta) continue;
    if (FULLTEXT_SOURCES.includes(meta.source)) bySource[meta.source]++;
  }
  const termEntries: Array<{ term: string; df: number }> = [];
  for (const term of Object.keys(index.terms)) {
    const postings = index.terms[term];
    if (!postings) continue;
    const df = new Set(postings.map((p) => p.docId)).size;
    termEntries.push({ term, df });
  }
  termEntries.sort((a, b) => b.df - a.df);
  return {
    totalDocs: index.totalDocs,
    totalTerms: Object.keys(index.terms).length,
    avgDocLen: Math.round(index.avgDocLen * 10) / 10,
    bySource,
    topTerms: termEntries.slice(0, 20),
  };
}

/**
 * Filter hits theo source — dùng sau khi searchIndex khi user bấm pill.
 */
export function filterHitsBySource(
  hits: readonly FulltextHit[],
  source: FulltextSource | null,
): FulltextHit[] {
  if (source == null) return [...hits];
  return hits.filter((h) => h.doc.source === source);
}

/**
 * Label tiếng Việt cho source pill.
 */
export function sourceLabel(source: FulltextSource): string {
  switch (source) {
    case 'note':
      return 'Ghi chú';
    case 'library':
      return 'Thư viện';
    case 'file':
      return 'File rời';
  }
}
