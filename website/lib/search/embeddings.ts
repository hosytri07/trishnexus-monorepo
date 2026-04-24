/**
 * lib/search/embeddings.ts — Phase 12.3 client helper.
 *
 * Wrapper tiện gọi `/api/embed` từ client. Cache theo text hash để không
 * hit endpoint liên tục khi user gõ cùng 1 query. Cosine similarity
 * helper để rerank Fuse.js top-K.
 *
 * CHƯA wire vào useUniversalSearch — là nền cho Phase 12.4 reranker.
 */

export interface EmbedResponse {
  provider: 'gemini' | 'local-hash';
  model: string;
  dim: number;
  vectors: number[][];
  note?: string;
}

const cache = new Map<string, number[]>();

/** Hash string đơn giản (FNV-1a) để làm cache key ngắn. */
function cacheKey(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `${(h >>> 0).toString(36)}:${s.length}`;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  // Filter cached.
  const missIdx: number[] = [];
  const missTexts: string[] = [];
  const out: number[][] = new Array(texts.length);
  texts.forEach((t, i) => {
    const k = cacheKey(t);
    const hit = cache.get(k);
    if (hit) {
      out[i] = hit;
    } else {
      missIdx.push(i);
      missTexts.push(t);
    }
  });
  if (missTexts.length === 0) return out;

  const resp = await fetch('/api/embed', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ texts: missTexts }),
  });
  if (!resp.ok) {
    throw new Error(`embed_api_${resp.status}`);
  }
  const data = (await resp.json()) as EmbedResponse;
  data.vectors.forEach((v, j) => {
    const origIdx = missIdx[j];
    out[origIdx] = v;
    cache.set(cacheKey(missTexts[j]), v);
  });
  return out;
}

// Phase 14.1 (2026-04-23): `cosine` chuyển sang @trishteam/core/search cho
// desktop + zalo cùng dùng. Re-export để callsite website không đổi.
export { cosine } from '@trishteam/core/search';

import { cosine as _coreCosine } from '@trishteam/core/search';

/** Rerank candidate items theo cosine similarity với query vector. */
export function rerankByCosine<T>(
  query: number[],
  items: T[],
  getVec: (t: T) => number[] | null,
): Array<{ item: T; score: number }> {
  const scored = items.map((it) => {
    const v = getVec(it);
    return { item: it, score: v ? _coreCosine(query, v) : -1 };
  });
  return scored.sort((a, b) => b.score - a.score);
}
