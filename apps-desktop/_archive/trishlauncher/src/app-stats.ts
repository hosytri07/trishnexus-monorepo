/**
 * TrishLauncher — App stats tracking (Phase 39.3).
 *
 * Track open count + last opened time mỗi app trong localStorage để:
 *   - Dashboard sort theo most-used (app dùng nhiều xuất hiện đầu)
 *   - Hiển thị badge "Vừa dùng" cho app mở < 1h
 *   - QuickSearch ưu tiên app most-used khi query rỗng
 */

const STATS_KEY = 'trishlauncher:app_stats';

export interface AppStat {
  app_id: string;
  open_count: number;
  /** Timestamp ms */
  last_opened_at: number;
}

type StatsMap = Record<string, AppStat>;

function load(): StatsMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STATS_KEY);
    return raw ? (JSON.parse(raw) as StatsMap) : {};
  } catch {
    return {};
  }
}

function save(stats: StatsMap): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch {
    /* quota / private mode */
  }
}

/** Tăng count + cập nhật last_opened_at cho app. Gọi sau khi launch thành công. */
export function trackOpen(appId: string): void {
  const stats = load();
  const cur = stats[appId];
  stats[appId] = {
    app_id: appId,
    open_count: (cur?.open_count ?? 0) + 1,
    last_opened_at: Date.now(),
  };
  save(stats);
}

/** Lấy stat 1 app */
export function getStat(appId: string): AppStat | null {
  return load()[appId] ?? null;
}

/** Lấy toàn bộ stats */
export function getAllStats(): StatsMap {
  return load();
}

/** Reset stats (vd user trong Settings) */
export function resetStats(): void {
  save({});
}

/**
 * So sánh 2 app theo most-used (descending: more used → first).
 *
 * Logic:
 *   1. App có open_count > 0 luôn xếp trước app chưa từng mở
 *   2. Trong group "đã mở": sort theo open_count desc
 *   3. Tie-break: last_opened_at desc (mới hơn → trước)
 */
export function compareByUsage(
  a: { id: string },
  b: { id: string },
  stats: StatsMap = load(),
): number {
  const sa = stats[a.id];
  const sb = stats[b.id];
  const ca = sa?.open_count ?? 0;
  const cb = sb?.open_count ?? 0;
  if (ca !== cb) return cb - ca;
  const la = sa?.last_opened_at ?? 0;
  const lb = sb?.last_opened_at ?? 0;
  return lb - la;
}

/** True nếu app vừa mở trong < 1h gần đây (cho badge "Vừa dùng") */
export function isRecentlyOpened(appId: string, withinMs = 60 * 60 * 1000): boolean {
  const stat = load()[appId];
  if (!stat) return false;
  return Date.now() - stat.last_opened_at < withinMs;
}

/** Format relative time: "2 giờ trước", "hôm qua", etc */
export function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  if (minutes < 1) return 'vừa xong';
  if (minutes < 60) return `${minutes} phút trước`;
  if (hours < 24) return `${hours} giờ trước`;
  if (days === 1) return 'hôm qua';
  if (days < 7) return `${days} ngày trước`;
  if (days < 30) return `${Math.floor(days / 7)} tuần trước`;
  return `${Math.floor(days / 30)} tháng trước`;
}
