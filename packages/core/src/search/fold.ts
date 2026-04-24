/**
 * Fold tiếng Việt thành ASCII + tokenize — pure, no I/O.
 *
 * "Số phận" → "so phan". Dùng cho fuzzy match không phân biệt dấu,
 * index Firestore, tokenize cho Fuse.js.
 *
 * Phase 14.0 (2026-04-23).
 */

/**
 * Fold dấu tiếng Việt thành ASCII cơ bản — dùng cho fuzzy match không
 * phân biệt dấu. "Số phận" → "so phan".
 *
 * Trước đây duplicate giữa website/desktop/zalo — centralize ở đây để
 * fix một chỗ.
 */
export function foldVietnamese(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

/**
 * Tokenize cho indexing — giữ unicode word boundary, strip non-alphanum.
 * Token ngắn hơn 2 ký tự bỏ qua (noise).
 */
export function tokenize(input: string): string[] {
  return foldVietnamese(input)
    .split(/[^a-z0-9]+/i)
    .filter((t) => t.length >= 2);
}
