import { describe, it, expect } from 'vitest';
import {
  summarizeImages,
  topExtensions,
  formatBytes,
  aspectOrder,
} from '../aggregate.js';
import type { ImageMeta } from '../types.js';

function im(over: Partial<ImageMeta>): ImageMeta {
  return {
    path: over.path ?? '/a.jpg',
    name: over.name ?? 'a.jpg',
    ext: over.ext ?? 'jpg',
    size_bytes: over.size_bytes ?? 1_000_000,
    taken_ms: over.taken_ms ?? null,
    width: over.width ?? 4000,
    height: over.height ?? 3000,
    aspect: over.aspect ?? 'landscape',
    camera: over.camera ?? null,
    has_gps: over.has_gps ?? false,
    face_count: over.face_count ?? null,
  };
}

describe('summarizeImages', () => {
  it('empty list → zeros + empty maps', () => {
    const s = summarizeImages([]);
    expect(s.total_files).toBe(0);
    expect(s.total_bytes).toBe(0);
    expect(s.with_exif_time).toBe(0);
    expect(s.with_gps).toBe(0);
    expect(s.min_taken_ms).toBeNull();
    expect(s.max_taken_ms).toBeNull();
    expect(s.by_aspect.landscape).toBe(0);
  });

  it('count by aspect + ext + gps + exif time', () => {
    const t1 = 1_700_000_000_000;
    const t2 = 1_700_000_100_000;
    const s = summarizeImages([
      im({ aspect: 'landscape', ext: 'jpg', taken_ms: t1, has_gps: true }),
      im({ aspect: 'portrait', ext: 'jpg', taken_ms: t2 }),
      im({ aspect: 'square', ext: 'png', size_bytes: 500_000 }),
      im({ aspect: 'landscape', ext: 'heic', has_gps: true }),
    ]);
    expect(s.total_files).toBe(4);
    expect(s.total_bytes).toBe(3_500_000);
    expect(s.with_exif_time).toBe(2);
    expect(s.with_gps).toBe(2);
    expect(s.by_aspect.landscape).toBe(2);
    expect(s.by_aspect.portrait).toBe(1);
    expect(s.by_aspect.square).toBe(1);
    expect(s.by_ext['jpg']).toBe(2);
    expect(s.by_ext['png']).toBe(1);
    expect(s.by_ext['heic']).toBe(1);
    expect(s.min_taken_ms).toBe(t1);
    expect(s.max_taken_ms).toBe(t2);
  });
});

describe('topExtensions', () => {
  it('sort desc by count, limit 2', () => {
    const s = summarizeImages([
      im({ ext: 'jpg' }),
      im({ ext: 'jpg' }),
      im({ ext: 'jpg' }),
      im({ ext: 'png' }),
      im({ ext: 'png' }),
      im({ ext: 'heic' }),
    ]);
    const top = topExtensions(s, 2);
    expect(top).toEqual([
      { ext: 'jpg', count: 3 },
      { ext: 'png', count: 2 },
    ]);
  });
});

describe('formatBytes', () => {
  it('renders various sizes', () => {
    expect(formatBytes(500)).toBe('500 B');
    expect(formatBytes(2048)).toBe('2.0 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
    expect(formatBytes(2 * 1024 * 1024 * 1024)).toBe('2.00 GB');
  });
});

describe('aspectOrder', () => {
  it('5 values', () => {
    expect(aspectOrder()).toEqual([
      'landscape',
      'portrait',
      'square',
      'panorama',
      'unknown',
    ]);
  });
});
