/**
 * Universal search types — dùng chung website/desktop/zalo.
 * Phase 14.1 (2026-04-23) — tách khỏi website/lib/search/types.ts.
 */

export type SearchCategory =
  | 'app'
  | 'nav'
  | 'action'
  | 'note'
  | 'announcement'
  | 'event'
  | 'setting';

export const CATEGORY_LABEL: Record<SearchCategory, string> = {
  app: 'Ứng dụng',
  nav: 'Điều hướng',
  action: 'Hành động',
  note: 'Ghi chú',
  announcement: 'Thông báo',
  event: 'Hoạt động',
  setting: 'Cài đặt',
};

export const CATEGORY_ORDER: SearchCategory[] = [
  'app',
  'nav',
  'action',
  'note',
  'announcement',
  'event',
  'setting',
];

export interface SearchableItem {
  /** ID duy nhất (prefix theo category để tránh collision). */
  id: string;
  category: SearchCategory;
  /** Tiêu đề chính — trường weight cao nhất khi search. */
  title: string;
  /** Mô tả ngắn — weight thấp hơn. */
  subtitle?: string;
  /** Thêm keyword ẩn (ví dụ tên không dấu) để fuzzy bắt. */
  keywords?: string[];
  /** Href điều hướng (priority 1). */
  href?: string;
  /**
   * Action chạy client-side (priority 2, ưu tiên href nếu cả 2 có).
   * KHÔNG serialize được — dùng ở runtime, không lưu Firestore.
   */
  run?: () => void;
  /** Metadata hiển thị ở result card. */
  meta?: string;
  /** Timestamp số (ms epoch) — dùng để rerank theo recency. */
  ts?: number;
}

export interface SearchResult {
  item: SearchableItem;
  /** 0 = perfect, 1 = no match (Fuse.js score convention). */
  score: number;
  /** Highlight ranges (start, end) từ Fuse matches. */
  matches?: { key: string; ranges: Array<[number, number]> }[];
}
