/**
 * Phase 78.13 — Cadence → nextRun calculator.
 *
 * Tính lần chạy tiếp theo dựa trên cadence + thời điểm hiện tại.
 * Sai số tối đa 60s vì runner check mỗi phút.
 */
import type { ScheduledTaskCadence } from './types.js';

/** Trả về epoch ms lần chạy kế tiếp (> now). */
export function computeNextRun(cadence: ScheduledTaskCadence, now = Date.now()): number {
  const d = new Date(now);

  switch (cadence) {
    case 'hourly': {
      const next = new Date(d);
      next.setMinutes(0, 0, 0);
      next.setHours(next.getHours() + 1);
      return next.getTime();
    }

    case 'daily-morning':
      return nextAtHour(d, 8);

    case 'daily-noon':
      return nextAtHour(d, 12);

    case 'daily-evening':
      return nextAtHour(d, 19);

    case 'weekly-monday':
      return nextAtWeekday(d, 1 /* Mon */, 8);

    case 'weekly-friday':
      return nextAtWeekday(d, 5 /* Fri */, 17);

    case 'monthly-first': {
      const next = new Date(d.getFullYear(), d.getMonth(), 1, 8, 0, 0, 0);
      if (next.getTime() <= now) {
        next.setMonth(next.getMonth() + 1);
      }
      return next.getTime();
    }

    default:
      // Fallback an toàn: 1h sau.
      return now + 60 * 60 * 1000;
  }
}

function nextAtHour(d: Date, hour: number): number {
  const next = new Date(d);
  next.setHours(hour, 0, 0, 0);
  if (next.getTime() <= d.getTime()) {
    next.setDate(next.getDate() + 1);
  }
  return next.getTime();
}

function nextAtWeekday(d: Date, weekday: number, hour: number): number {
  const next = new Date(d);
  next.setHours(hour, 0, 0, 0);
  // 0 = Sunday, 1 = Mon, …, 6 = Sat
  const cur = next.getDay();
  let delta = (weekday - cur + 7) % 7;
  if (delta === 0 && next.getTime() <= d.getTime()) delta = 7;
  next.setDate(next.getDate() + delta);
  return next.getTime();
}

/** Format relative time: "trong 2h 15m", "5 phút nữa". */
export function formatRelative(ts: number, now = Date.now()): string {
  const delta = ts - now;
  if (delta < 0) {
    const past = -delta;
    if (past < 60_000) return 'vừa xong';
    if (past < 3_600_000) return `${Math.floor(past / 60_000)} phút trước`;
    if (past < 86_400_000) return `${Math.floor(past / 3_600_000)}h trước`;
    return `${Math.floor(past / 86_400_000)} ngày trước`;
  }
  if (delta < 60_000) return '< 1 phút nữa';
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)} phút nữa`;
  if (delta < 86_400_000) {
    const h = Math.floor(delta / 3_600_000);
    const m = Math.floor((delta % 3_600_000) / 60_000);
    return m === 0 ? `${h}h nữa` : `${h}h ${m}m nữa`;
  }
  const days = Math.floor(delta / 86_400_000);
  return `${days} ngày nữa`;
}

/** Format absolute time: "28/05/2026 08:00". */
export function formatAbsolute(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
