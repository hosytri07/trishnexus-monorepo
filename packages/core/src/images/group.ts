import type { EventGroup, ImageMeta } from './types.js';

/** Default gap giữa 2 ảnh liên tiếp để coi là event mới: 8 giờ. */
export const DEFAULT_EVENT_GAP_MS = 8 * 60 * 60 * 1000;

export interface GroupEventsOptions {
  /** Gap tối đa trong 1 event (ms). */
  gap_ms?: number;
  /** Loại ảnh không có taken_ms ra khỏi grouping. */
  drop_unknown_time?: boolean;
}

/**
 * Group ảnh thành events theo time gap. Thuật toán:
 *   1. Sort asc theo taken_ms.
 *   2. Duyệt tuyến tính — nếu gap > threshold thì mở event mới.
 * Ảnh không có taken_ms → đi vào event riêng "Không rõ thời gian"
 * (unless drop_unknown_time=true).
 */
export function groupByEvent(
  images: readonly ImageMeta[],
  opts: GroupEventsOptions = {},
): EventGroup[] {
  const gap = opts.gap_ms ?? DEFAULT_EVENT_GAP_MS;
  const drop = opts.drop_unknown_time ?? false;

  const withTime: ImageMeta[] = [];
  const withoutTime: ImageMeta[] = [];
  for (const im of images) {
    if (im.taken_ms === null) withoutTime.push(im);
    else withTime.push(im);
  }
  withTime.sort((a, b) => (a.taken_ms ?? 0) - (b.taken_ms ?? 0));

  const events: EventGroup[] = [];
  let bucket: ImageMeta[] = [];
  let seq = 0;
  const flush = (): void => {
    if (bucket.length === 0) return;
    const start = bucket[0]!.taken_ms ?? 0;
    const end = bucket[bucket.length - 1]!.taken_ms ?? start;
    events.push({
      id: `ev-${seq++}`,
      start_ms: start,
      end_ms: end,
      images: bucket,
      label: labelEvent(start, bucket.length),
    });
    bucket = [];
  };
  let prev: number | null = null;
  for (const im of withTime) {
    const t = im.taken_ms!;
    if (prev !== null && t - prev > gap) flush();
    bucket.push(im);
    prev = t;
  }
  flush();

  if (!drop && withoutTime.length > 0) {
    events.push({
      id: `ev-unknown`,
      start_ms: 0,
      end_ms: 0,
      images: withoutTime,
      label: `Không rõ thời gian (${withoutTime.length} ảnh)`,
    });
  }

  return events;
}

/** Gen label kiểu "2026-04-24 (N ảnh)". */
function labelEvent(start_ms: number, count: number): string {
  const d = new Date(start_ms);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} (${count} ảnh)`;
}

/**
 * Group theo ngày (UTC). Nhẹ hơn event — 1 ảnh = 1 bucket theo ngày.
 */
export function groupByDay(
  images: readonly ImageMeta[],
): Map<string, ImageMeta[]> {
  const out = new Map<string, ImageMeta[]>();
  for (const im of images) {
    const key =
      im.taken_ms === null ? 'unknown' : isoDay(im.taken_ms);
    let arr = out.get(key);
    if (!arr) {
      arr = [];
      out.set(key, arr);
    }
    arr.push(im);
  }
  return out;
}

function isoDay(ms: number): string {
  const d = new Date(ms);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** Group theo tháng — "YYYY-MM" key. */
export function groupByMonth(
  images: readonly ImageMeta[],
): Map<string, ImageMeta[]> {
  const out = new Map<string, ImageMeta[]>();
  for (const im of images) {
    const key =
      im.taken_ms === null ? 'unknown' : isoMonth(im.taken_ms);
    let arr = out.get(key);
    if (!arr) {
      arr = [];
      out.set(key, arr);
    }
    arr.push(im);
  }
  return out;
}

function isoMonth(ms: number): string {
  const d = new Date(ms);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}`;
}
