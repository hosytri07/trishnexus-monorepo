/**
 * Build / update inverted index từ FulltextDoc.
 *
 * Index là pure JSON serializable — cache được xuống disk giữa các run
 * (Rust sẽ serde JSON qua serde_json).
 */

import type {
  FulltextDoc,
  FulltextDocMeta,
  FulltextIndex,
  PostingEntry,
} from './types.js';
import { tokenizePositions } from './tokenize.js';

/**
 * Khởi tạo index rỗng.
 */
export function createEmptyIndex(): FulltextIndex {
  return {
    docs: {},
    terms: {},
    avgDocLen: 0,
    totalDocs: 0,
  };
}

/**
 * Build index từ danh sách doc (thay thế toàn bộ index cũ).
 *
 * Complexity: O(N * L) với N = số doc, L = độ dài trung bình token.
 */
export function buildIndex(docs: readonly FulltextDoc[]): FulltextIndex {
  const index = createEmptyIndex();
  for (const doc of docs) {
    addDocToIndex(index, doc);
  }
  return index;
}

/**
 * Thêm 1 doc vào index hiện tại — không xoá doc khác.
 * Nếu doc.id đã có → xoá bản cũ trước khi add mới (upsert).
 */
export function addDocToIndex(index: FulltextIndex, doc: FulltextDoc): void {
  if (index.docs[doc.id]) {
    removeDocFromIndex(index, doc.id);
  }
  const titleTokens = tokenizePositions(doc.title);
  const bodyTokens = tokenizePositions(doc.body);
  const tagTokens = (doc.tags ?? []).flatMap((t) => tokenizePositions(t));

  // Title và tag đóng góp TF cao hơn body (×3) để boost match tiêu đề.
  const tfMap = new Map<string, { tf: number; first: number }>();
  const bump = (token: string, pos: number, weight: number): void => {
    const existing = tfMap.get(token);
    if (existing) {
      existing.tf += weight;
      if (pos < existing.first) existing.first = pos;
    } else {
      tfMap.set(token, { tf: weight, first: pos });
    }
  };
  for (const { token, pos } of titleTokens) bump(token, pos, 3);
  for (const { token, pos } of tagTokens) bump(token, pos, 2);
  for (const { token, pos } of bodyTokens) bump(token, pos, 1);

  const length = titleTokens.length + tagTokens.length + bodyTokens.length;

  const meta: FulltextDocMeta = {
    id: doc.id,
    source: doc.source,
    title: doc.title,
    path: doc.path,
    mtimeMs: doc.mtimeMs,
    tags: doc.tags,
    length,
    body: doc.body,
  };
  index.docs[doc.id] = meta;

  for (const [term, { tf, first }] of tfMap) {
    const entry: PostingEntry = { docId: doc.id, tf, first };
    const posting = index.terms[term];
    if (posting) posting.push(entry);
    else index.terms[term] = [entry];
  }

  index.totalDocs = Object.keys(index.docs).length;
  index.avgDocLen = recomputeAvgDocLen(index);
}

/**
 * Xoá 1 doc khỏi index. Idempotent — nếu doc không có thì no-op.
 */
export function removeDocFromIndex(
  index: FulltextIndex,
  docId: string,
): void {
  if (!index.docs[docId]) return;
  delete index.docs[docId];
  for (const term of Object.keys(index.terms)) {
    const posting = index.terms[term];
    if (!posting) continue;
    const filtered = posting.filter((p) => p.docId !== docId);
    if (filtered.length === 0) delete index.terms[term];
    else index.terms[term] = filtered;
  }
  index.totalDocs = Object.keys(index.docs).length;
  index.avgDocLen = recomputeAvgDocLen(index);
}

function recomputeAvgDocLen(index: FulltextIndex): number {
  const ids = Object.keys(index.docs);
  if (ids.length === 0) return 0;
  let total = 0;
  for (const id of ids) {
    const meta = index.docs[id];
    if (meta) total += meta.length;
  }
  return total / ids.length;
}

/**
 * Merge 2 index → 1 (chồng doc nếu trùng id). Hữu ích khi người dùng
 * combine TrishNote + TrishLibrary + file.
 */
export function mergeIndexes(
  a: FulltextIndex,
  b: FulltextIndex,
): FulltextIndex {
  const out = createEmptyIndex();
  for (const id of Object.keys(a.docs)) {
    const meta = a.docs[id];
    if (!meta) continue;
    addDocToIndex(out, {
      id: meta.id,
      source: meta.source,
      title: meta.title,
      body: meta.body,
      path: meta.path,
      mtimeMs: meta.mtimeMs,
      tags: meta.tags,
    });
  }
  for (const id of Object.keys(b.docs)) {
    const meta = b.docs[id];
    if (!meta) continue;
    addDocToIndex(out, {
      id: meta.id,
      source: meta.source,
      title: meta.title,
      body: meta.body,
      path: meta.path,
      mtimeMs: meta.mtimeMs,
      tags: meta.tags,
    });
  }
  return out;
}
