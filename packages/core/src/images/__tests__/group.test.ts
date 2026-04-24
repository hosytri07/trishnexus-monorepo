import { describe, it, expect } from 'vitest';
import {
  DEFAULT_EVENT_GAP_MS,
  groupByEvent,
  groupByDay,
  groupByMonth,
} from '../group.js';
import type { ImageMeta } from '../types.js';

function im(path: string, taken_ms: number | null): ImageMeta {
  return {
    path,
    name: path.split('/').pop()!,
    ext: 'jpg',
    size_bytes: 1_000_000,
    taken_ms,
    width: 4000,
    height: 3000,
    aspect: 'landscape',
    camera: null,
    has_gps: false,
    face_count: null,
  };
}

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

describe('groupByEvent', () => {
  it('ảnh cách nhau < 8h → cùng event', () => {
    const base = Date.UTC(2026, 3, 24, 9, 0);
    const imgs = [
      im('/a.jpg', base),
      im('/b.jpg', base + 2 * HOUR),
      im('/c.jpg', base + 4 * HOUR),
    ];
    const events = groupByEvent(imgs);
    expect(events).toHaveLength(1);
    expect(events[0]!.images).toHaveLength(3);
  });

  it('gap > default 8h → event mới', () => {
    const base = Date.UTC(2026, 3, 24, 9, 0);
    const imgs = [
      im('/a.jpg', base),
      im('/b.jpg', base + 10 * HOUR),
      im('/c.jpg', base + 11 * HOUR),
    ];
    const events = groupByEvent(imgs);
    expect(events).toHaveLength(2);
    expect(events[0]!.images).toHaveLength(1);
    expect(events[1]!.images).toHaveLength(2);
  });

  it('custom gap_ms — 1 giờ', () => {
    const base = Date.UTC(2026, 3, 24, 9, 0);
    const imgs = [
      im('/a.jpg', base),
      im('/b.jpg', base + 30 * 60 * 1000), // 30 min
      im('/c.jpg', base + 2 * HOUR), // 2h
    ];
    const events = groupByEvent(imgs, { gap_ms: HOUR });
    // a+b cùng event (30min < 1h), c event mới (gap 1.5h > 1h)
    expect(events).toHaveLength(2);
  });

  it('ảnh thứ tự đảo → vẫn sort asc', () => {
    const base = Date.UTC(2026, 3, 24, 9, 0);
    const imgs = [
      im('/c.jpg', base + 4 * HOUR),
      im('/a.jpg', base),
      im('/b.jpg', base + 2 * HOUR),
    ];
    const events = groupByEvent(imgs);
    expect(events).toHaveLength(1);
    expect(events[0]!.images[0]!.path).toBe('/a.jpg');
    expect(events[0]!.images[2]!.path).toBe('/c.jpg');
  });

  it('ảnh không có taken_ms → event riêng "Không rõ"', () => {
    const base = Date.UTC(2026, 3, 24, 9, 0);
    const imgs = [
      im('/a.jpg', base),
      im('/broken.jpg', null),
      im('/b.jpg', base + HOUR),
    ];
    const events = groupByEvent(imgs);
    expect(events).toHaveLength(2);
    expect(events[1]!.id).toBe('ev-unknown');
    expect(events[1]!.images).toHaveLength(1);
  });

  it('drop_unknown_time=true → loại bỏ ảnh không có thời gian', () => {
    const base = Date.UTC(2026, 3, 24, 9, 0);
    const imgs = [im('/a.jpg', base), im('/broken.jpg', null)];
    const events = groupByEvent(imgs, { drop_unknown_time: true });
    expect(events).toHaveLength(1);
    expect(events[0]!.id).not.toBe('ev-unknown');
  });

  it('label format "YYYY-MM-DD (N ảnh)"', () => {
    const base = Date.UTC(2026, 3, 24, 9, 0); // April 24, 2026 UTC
    const events = groupByEvent([im('/a.jpg', base), im('/b.jpg', base + 30 * 60 * 1000)]);
    expect(events[0]!.label).toBe('2026-04-24 (2 ảnh)');
  });

  it('DEFAULT_EVENT_GAP_MS = 8 giờ', () => {
    expect(DEFAULT_EVENT_GAP_MS).toBe(8 * HOUR);
  });
});

describe('groupByDay', () => {
  it('3 ảnh cùng ngày UTC → 1 bucket', () => {
    const base = Date.UTC(2026, 3, 24, 0, 0);
    const m = groupByDay([
      im('/a.jpg', base + 1 * HOUR),
      im('/b.jpg', base + 10 * HOUR),
      im('/c.jpg', base + 23 * HOUR),
    ]);
    expect(m.size).toBe(1);
    expect(m.get('2026-04-24')).toHaveLength(3);
  });

  it('ảnh null → bucket "unknown"', () => {
    const m = groupByDay([im('/a.jpg', null)]);
    expect(m.get('unknown')).toHaveLength(1);
  });

  it('2 ngày khác nhau → 2 bucket', () => {
    const base = Date.UTC(2026, 3, 24, 0, 0);
    const m = groupByDay([
      im('/a.jpg', base),
      im('/b.jpg', base + DAY + HOUR),
    ]);
    expect(m.size).toBe(2);
  });
});

describe('groupByMonth', () => {
  it('bucket theo YYYY-MM', () => {
    const apr = Date.UTC(2026, 3, 24);
    const may = Date.UTC(2026, 4, 1);
    const m = groupByMonth([
      im('/a.jpg', apr),
      im('/b.jpg', apr + 5 * DAY),
      im('/c.jpg', may),
    ]);
    expect(m.get('2026-04')).toHaveLength(2);
    expect(m.get('2026-05')).toHaveLength(1);
  });
});
