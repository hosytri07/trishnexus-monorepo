/**
 * Phase 14.6.b — Auto-update interval scheduler.
 *
 * Gắn với `settings.autoUpdateInterval`:
 *  - 'off'    → không schedule (user chủ động reload).
 *  - 'daily'  → check mỗi 24h (dựa last_fetch_ms trong localStorage).
 *  - 'weekly' → check mỗi 7d.
 *
 * Check lần đầu khi app mở nếu đã quá interval từ last_fetch_ms. Sau
 * đó setInterval check định kỳ (60 phút 1 lần — rẻ, không ảnh hưởng
 * perf vì chỉ so sánh epoch rồi skip nếu chưa tới hạn).
 *
 * Launcher không chạy 24/7 → scheduler chỉ có hiệu lực trong lifecycle
 * app đang mở. Đủ cho use case: user bật launcher mỗi sáng → check
 * ngày hôm đó. Phase 14.6.e sẽ cân nhắc Rust background scheduler sau.
 */

import type { UpdateInterval } from './settings.js';

const LAST_FETCH_KEY = 'trishlauncher:registry:last_fetch_ms';
const POLL_INTERVAL_MS = 60 * 60 * 1000; // 1h poll — rẻ, không spam fetch

const INTERVAL_MS: Record<Exclude<UpdateInterval, 'off'>, number> = {
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
};

/** Đọc last successful fetch time từ localStorage. null nếu chưa có. */
export function getLastFetchMs(): number | null {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(LAST_FETCH_KEY);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Ghi timestamp fetch thành công. Gọi từ onResult handler. */
export function setLastFetchMs(ms: number): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(LAST_FETCH_KEY, String(ms));
  } catch (err) {
    console.warn('[trishlauncher] setLastFetchMs failed:', err);
  }
}

/**
 * Check xem đã tới lúc refetch chưa dựa trên interval config.
 * 'off' → false luôn. Chưa từng fetch → true (fire ngay lần đầu).
 */
export function shouldRefetch(interval: UpdateInterval): boolean {
  if (interval === 'off') return false;
  const last = getLastFetchMs();
  if (last === null) return true;
  return Date.now() - last >= INTERVAL_MS[interval];
}

/**
 * Setup scheduler: gọi onDue() khi đến hạn. Trả cleanup function để
 * clear interval khi component unmount / interval config đổi.
 *
 * onDue thường là `loadRegistry(url)` → nếu thành công component
 * cập nhật state + setLastFetchMs.
 */
export function startScheduler(
  interval: UpdateInterval,
  onDue: () => void,
): () => void {
  if (interval === 'off') {
    // Không schedule, trả no-op cleanup để caller không phải nullable check.
    return () => {};
  }

  // Fire ngay nếu overdue (không chờ tới tick đầu tiên).
  if (shouldRefetch(interval)) {
    onDue();
  }

  const timer = setInterval(() => {
    if (shouldRefetch(interval)) {
      onDue();
    }
  }, POLL_INTERVAL_MS);

  return () => clearInterval(timer);
}
