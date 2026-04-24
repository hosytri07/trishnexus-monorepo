/**
 * BM25 ranking + snippet highlight.
 *
 * BM25 formula:
 *   score(d, Q) = Σ_{q ∈ Q} IDF(q) * (tf * (k1 + 1)) /
 *                              (tf + k1 * (1 - b + b * |d| / avgdl))
 *
 * Tham số mặc định: k1 = 1.2, b = 0.75. Kinh điển.
 *
 * Recency boost: nhân với factor `(1 + α * recencyScore)` với
 * recencyScore ∈ [0, 1] giảm theo tuổi doc (7 ngày gần → 1, 365 ngày → 0).
 */

import type {
  FulltextHit,
  FulltextIndex,
  ParsedQuery,
} from './types.js';
import { foldVietnamese } from '../search/fold.js';

export const BM25_K1 = 1.2;
export const BM25_B = 0.75;
/** Trọng số recency: final = bm25 * (1 + RECENCY_ALPHA * recency). */
export const RECENCY_ALPHA = 0.2;
/** 1 tuần tính theo ms — doc mới hơn ngưỡng này recency = 1. */
export const RECENCY_HOT_MS = 7 * 24 * 60 * 60 * 1000;
/** 1 năm — doc cũ hơn ngưỡng này recency = 0. */
export const RECENCY_COLD_MS = 365 * 24 * 60 * 60 * 1000;

/**
 * Chính — search index bằng parsed query. Trả về mảng hit sort desc theo
 * score.
 */
export function searchIndex(
  index: FulltextIndex,
  query: ParsedQuery,
  now: number,
  limit: number = 50,
): FulltextHit[] {
  const docIds = Object.keys(index.docs);
  if (docIds.length === 0 || query.clauses.length === 0) return [];

  // Tính IDF mỗi term.
  const N = index.totalDocs;
  const avgdl = index.avgDocLen || 1;

  // Gather matched doc → score.
  const docScores = new Map<string, number>();
  const docMatchedTerms = new Map<string, Set<string>>();
  const docNegated = new Set<string>();

  for (const clause of query.clauses) {
    const terms = clause.term.split(' ').filter(Boolean);
    if (terms.length === 0) continue;

    if (clause.negate) {
      // Negate: mark doc có ít nhất 1 term để exclude.
      for (const t of terms) {
        const matching = matchTermToPostings(index, t, clause.prefix);
        for (const p of matching) docNegated.add(p.docId);
      }
      continue;
    }

    for (const t of terms) {
      const postings = matchTermToPostings(index, t, clause.prefix);
      const df = countDistinctDocs(postings);
      if (df === 0) continue;
      const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
      for (const p of postings) {
        const meta = index.docs[p.docId];
        if (!meta) continue;
        if (clause.source && meta.source !== clause.source) continue;
        if (query.sourceFilter && meta.source !== query.sourceFilter) continue;
        const tfNorm =
          (p.tf * (BM25_K1 + 1)) /
          (p.tf + BM25_K1 * (1 - BM25_B + BM25_B * (meta.length / avgdl)));
        const score = idf * tfNorm;
        docScores.set(p.docId, (docScores.get(p.docId) ?? 0) + score);
        const termSet = docMatchedTerms.get(p.docId) ?? new Set();
        termSet.add(t);
        docMatchedTerms.set(p.docId, termSet);
      }
    }

    // Phrase bonus: nếu phrase (nhiều term) thì doc phải chứa tất cả term.
    if (clause.phrase && terms.length > 1) {
      for (const docId of [...docScores.keys()]) {
        const terms2 = docMatchedTerms.get(docId);
        if (!terms2 || !terms.every((t) => terms2.has(t))) {
          docScores.delete(docId);
          docMatchedTerms.delete(docId);
        } else {
          // Bonus nhỏ khi khớp toàn phrase.
          docScores.set(docId, (docScores.get(docId) ?? 0) * 1.4);
        }
      }
    }
  }

  // Exclude negated.
  for (const docId of docNegated) {
    docScores.delete(docId);
    docMatchedTerms.delete(docId);
  }

  // Recency boost + xây FulltextHit.
  const hits: FulltextHit[] = [];
  for (const [docId, baseScore] of docScores) {
    const meta = index.docs[docId];
    if (!meta) continue;
    const recency = computeRecency(meta.mtimeMs, now);
    const finalScore = baseScore * (1 + RECENCY_ALPHA * recency);
    const matched = [...(docMatchedTerms.get(docId) ?? [])];
    hits.push({
      doc: meta,
      score: finalScore,
      snippet: buildSnippet(meta.body, matched),
      matchedTerms: matched,
    });
  }

  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, limit);
}

function matchTermToPostings(
  index: FulltextIndex,
  term: string,
  prefix: boolean,
): Array<{ docId: string; tf: number; first: number }> {
  if (!prefix) {
    return index.terms[term] ?? [];
  }
  const out: Array<{ docId: string; tf: number; first: number }> = [];
  for (const key of Object.keys(index.terms)) {
    if (key.startsWith(term)) {
      const postings = index.terms[key];
      if (!postings) continue;
      for (const p of postings) out.push(p);
    }
  }
  return out;
}

function countDistinctDocs(
  postings: Array<{ docId: string; tf: number; first: number }>,
): number {
  const set = new Set<string>();
  for (const p of postings) set.add(p.docId);
  return set.size;
}

/**
 * Recency score ∈ [0, 1] giảm tuyến tính từ HOT đến COLD.
 */
export function computeRecency(mtimeMs: number, now: number): number {
  const age = now - mtimeMs;
  if (age <= RECENCY_HOT_MS) return 1;
  if (age >= RECENCY_COLD_MS) return 0;
  return 1 - (age - RECENCY_HOT_MS) / (RECENCY_COLD_MS - RECENCY_HOT_MS);
}

/**
 * Tạo snippet ~200 ký tự quanh term match đầu tiên. Bọc `<mark>…</mark>`
 * cho UI highlight.
 *
 * Dùng fold lower để tìm nhưng trả về substring từ body gốc (giữ diacritic).
 */
export function buildSnippet(body: string, matchedTerms: string[]): string {
  if (!body) return '';
  const folded = foldVietnamese(body);
  let earliest = -1;
  let earliestLen = 0;
  for (const term of matchedTerms) {
    const idx = folded.indexOf(term);
    if (idx === -1) continue;
    if (earliest === -1 || idx < earliest) {
      earliest = idx;
      earliestLen = term.length;
    }
  }
  if (earliest === -1) {
    return body.slice(0, 200).trim();
  }
  const radius = 90;
  let start = Math.max(0, earliest - radius);
  let end = Math.min(body.length, earliest + earliestLen + radius);
  // Cắt đúng word boundary.
  while (start > 0 && /\w/.test(body[start - 1] ?? '')) start--;
  while (end < body.length && /\w/.test(body[end] ?? '')) end++;
  let snippet = body.slice(start, end);
  // Escape HTML basic để không XSS vô tình nếu body là HTML.
  snippet = escapeHtml(snippet ?? '');
  // Highlight từng term (fold-insensitive) trong snippet.
  const foldedSnippet = foldVietnamese(snippet);
  const highlights: Array<[number, number]> = [];
  for (const term of matchedTerms) {
    let idx = 0;
    while ((idx = foldedSnippet.indexOf(term, idx)) !== -1) {
      highlights.push([idx, idx + term.length]);
      idx += term.length;
    }
  }
  if (highlights.length === 0) {
    return (start > 0 ? '…' : '') + snippet + (end < body.length ? '…' : '');
  }
  highlights.sort((a, b) => a[0] - b[0]);
  // Merge overlapping.
  const merged: Array<[number, number]> = [];
  for (const [s, e] of highlights) {
    const last = merged[merged.length - 1];
    if (last && s <= last[1]) last[1] = Math.max(last[1], e);
    else merged.push([s, e]);
  }
  let out = '';
  let cursor = 0;
  for (const [s, e] of merged) {
    out += snippet.slice(cursor, s);
    out += '<mark>' + snippet.slice(s, e) + '</mark>';
    cursor = e;
  }
  out += snippet.slice(cursor);
  return (start > 0 ? '…' : '') + out + (end < body.length ? '…' : '');
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
