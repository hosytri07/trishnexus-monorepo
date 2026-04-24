/**
 * @trishteam/core/search — public API cho universal search primitives.
 *
 * - fold tiếng Việt + tokenize: `./fold.ts`
 * - types (SearchableItem, SearchResult, category labels): `./types.ts`
 * - cosine + blend score cho semantic rerank: `./cosine.ts`
 *
 * Phase 14.1 (2026-04-23).
 */

export * from './fold.js';
export * from './types.js';
export * from './cosine.js';
