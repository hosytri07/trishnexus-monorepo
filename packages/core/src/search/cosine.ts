/**
 * Cosine similarity + rerank helpers cho semantic search.
 *
 * Pure math — không I/O. Embedding lấy từ đâu là việc của caller
 * (website hit /api/embed, desktop có thể hit trực tiếp Gemini, zalo
 * có thể dùng local hash).
 *
 * Phase 14.1 (2026-04-23) — tách khỏi website/lib/search/embeddings.ts.
 */

export function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i] ?? 0;
    const bi = b[i] ?? 0;
    dot += ai * bi;
    na += ai * ai;
    nb += bi * bi;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Blend giữa lexical score (Fuse 0..1, lower better) và semantic cosine
 * (0..1, higher better). Website hiện dùng 40% lexical + 60% semantic —
 * giữ default đó ở đây để các host khác share.
 */
export function blendScore(
  lexical0to1: number,
  semantic0to1: number,
  semanticWeight = 0.6,
): number {
  const lexicalBetter = 1 - Math.min(Math.max(lexical0to1, 0), 1);
  const semantic = Math.min(Math.max(semantic0to1, 0), 1);
  return (1 - semanticWeight) * lexicalBetter + semanticWeight * semantic;
}
