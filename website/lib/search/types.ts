/**
 * lib/search/types.ts — re-export types từ @trishteam/core/search.
 *
 * Phase 14.1 (2026-04-23): shared types giờ nằm ở core để desktop +
 * Zalo Mini App cùng dùng. File này giữ lại làm barrel tương thích với
 * import path `@/lib/search` hiện tại.
 */

export type {
  SearchCategory,
  SearchableItem,
  SearchResult,
} from '@trishteam/core/search';

export { CATEGORY_LABEL, CATEGORY_ORDER } from '@trishteam/core/search';
