'use client';

/**
 * lib/search/semantic-index.ts — Phase 12.4.
 *
 * CRUD + query cho Firestore `/semantic/{kind}/items/{id}`:
 *
 *   schema per-doc:
 *     {
 *       vec: number[],            // 768 (gemini) hoặc 256 (local-hash)
 *       model: string,            // 'text-embedding-004' hoặc 'fnv1a-bucket-256'
 *       text: string,             // preview text (cắt 200 char)
 *       title: string,            // hiển thị ở result
 *       category: SearchCategory, // 'app' | 'announcement' | 'note'
 *       href?: string,            // click → đâu
 *       updatedAt: serverTimestamp
 *     }
 *
 *   - kind = 'apps'           → apps ecosystem (admin reindex, public read).
 *   - kind = 'announcements'  → admin reindex khi publish, public read.
 *   - kind = 'notes'          → per-user reindex khi notes thay đổi.
 *
 * Cache memory per-kind để tránh fetch lại nhiều lần trong 1 session.
 * Invalidate bằng `invalidateCache(kind)` sau upsert.
 */

import {
  collection,
  doc,
  getDocs,
  query as fsQuery,
  setDoc,
  serverTimestamp,
  type Firestore,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { embedTexts } from './embeddings';
import type { SearchCategory } from './types';

export type SemanticKind = 'apps' | 'announcements' | 'notes';

export interface SemanticDoc {
  id: string;
  kind: SemanticKind;
  vec: number[];
  model: string;
  text: string;
  title: string;
  category: SearchCategory;
  href?: string;
}

interface RawSemanticDoc {
  vec?: number[];
  model?: string;
  text?: string;
  title?: string;
  category?: string;
  href?: string;
}

const cache = new Map<SemanticKind, SemanticDoc[]>();
const cacheAt = new Map<SemanticKind, number>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min

function requireDb(): Firestore {
  if (!db) throw new Error('firestore_not_configured');
  return db;
}

/** Upsert 1 doc + embed text tại đây. Dùng khi admin reindex hoặc user edit note. */
export async function upsertSemanticDoc(params: {
  kind: SemanticKind;
  id: string;
  text: string;
  title: string;
  category: SearchCategory;
  href?: string;
}): Promise<void> {
  const { kind, id, text, title, category, href } = params;
  const firestore = requireDb();
  const [vec] = await embedTexts([text]);
  await setDoc(
    doc(firestore, 'semantic', kind, 'items', id),
    {
      vec,
      model:
        vec.length === 768
          ? 'text-embedding-004'
          : `fnv1a-bucket-${vec.length}`,
      text: text.slice(0, 200),
      title,
      category,
      href: href ?? null,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
  // Invalidate để lần fetch tiếp theo reload.
  invalidateCache(kind);
}

/** Batch upsert — giảm số request embed (tiết kiệm Gemini quota). */
export async function batchUpsertSemanticDocs(
  kind: SemanticKind,
  items: Array<{
    id: string;
    text: string;
    title: string;
    category: SearchCategory;
    href?: string;
  }>,
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  const firestore = requireDb();
  const CHUNK = 16; // Gemini 1 request/item; batch 16 để không vượt rate limit.
  for (let i = 0; i < items.length; i += CHUNK) {
    const chunk = items.slice(i, i + CHUNK);
    const vectors = await embedTexts(chunk.map((x) => x.text));
    await Promise.all(
      chunk.map((it, j) => {
        const vec = vectors[j];
        return setDoc(
          doc(firestore, 'semantic', kind, 'items', it.id),
          {
            vec,
            model:
              vec.length === 768
                ? 'text-embedding-004'
                : `fnv1a-bucket-${vec.length}`,
            text: it.text.slice(0, 200),
            title: it.title,
            category: it.category,
            href: it.href ?? null,
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );
      }),
    );
    onProgress?.(Math.min(i + CHUNK, items.length), items.length);
  }
  invalidateCache(kind);
}

/** Fetch toàn bộ docs của 1 kind. Cache 5 phút. */
export async function fetchSemanticIndex(
  kind: SemanticKind,
  opts: { forceRefresh?: boolean } = {},
): Promise<SemanticDoc[]> {
  if (!opts.forceRefresh) {
    const hit = cache.get(kind);
    const at = cacheAt.get(kind) ?? 0;
    if (hit && Date.now() - at < CACHE_TTL_MS) return hit;
  }

  const firestore = requireDb();
  const q = fsQuery(collection(firestore, 'semantic', kind, 'items'));
  const snap = await getDocs(q);
  const out: SemanticDoc[] = [];
  snap.forEach((d) => {
    const data = d.data() as RawSemanticDoc;
    if (!Array.isArray(data.vec) || data.vec.length === 0) return;
    if (typeof data.title !== 'string') return;
    out.push({
      id: d.id,
      kind,
      vec: data.vec,
      model: data.model ?? 'unknown',
      text: data.text ?? '',
      title: data.title,
      category: (data.category as SearchCategory) ?? 'app',
      href: data.href,
    });
  });
  cache.set(kind, out);
  cacheAt.set(kind, Date.now());
  return out;
}

/** Fetch union nhiều kind — tiện cho rerank toàn cục. */
export async function fetchSemanticUnion(
  kinds: SemanticKind[],
): Promise<SemanticDoc[]> {
  const chunks = await Promise.all(kinds.map((k) => fetchSemanticIndex(k)));
  return chunks.flat();
}

export function invalidateCache(kind?: SemanticKind): void {
  if (kind) {
    cache.delete(kind);
    cacheAt.delete(kind);
  } else {
    cache.clear();
    cacheAt.clear();
  }
}

/** Doc ID stable cho per-user notes: `${uid}_${noteId}`. */
export function noteDocId(uid: string, noteId: string): string {
  return `${uid}_${noteId}`;
}
