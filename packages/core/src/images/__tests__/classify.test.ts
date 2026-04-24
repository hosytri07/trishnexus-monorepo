import { describe, it, expect } from 'vitest';
import { classifyAspect, enrichImage, filterByAspect } from '../classify.js';
import type { ImageMeta, RawImageEntry } from '../types.js';

function im(over: Partial<ImageMeta> & { path: string }): ImageMeta {
  return {
    path: over.path,
    name: over.name ?? 'IMG.jpg',
    ext: over.ext ?? 'jpg',
    size_bytes: over.size_bytes ?? 100_000,
    taken_ms: over.taken_ms ?? null,
    width: over.width ?? null,
    height: over.height ?? null,
    aspect: over.aspect ?? 'unknown',
    camera: over.camera ?? null,
    has_gps: over.has_gps ?? false,
    face_count: over.face_count ?? null,
  };
}

describe('classifyAspect', () => {
  it('4032x3024 (iPhone 4:3) → landscape', () => {
    expect(classifyAspect(4032, 3024)).toBe('landscape');
  });

  it('3024x4032 (iPhone dọc) → portrait', () => {
    expect(classifyAspect(3024, 4032)).toBe('portrait');
  });

  it('1000x1000 (square) → square', () => {
    expect(classifyAspect(1000, 1000)).toBe('square');
  });

  it('1100x1000 (ratio 1.1) → square (trong ±0.15)', () => {
    expect(classifyAspect(1100, 1000)).toBe('square');
  });

  it('8000x2000 (ratio 4) → panorama', () => {
    expect(classifyAspect(8000, 2000)).toBe('panorama');
  });

  it('1000x3000 (ratio 0.33) → panorama (dọc)', () => {
    expect(classifyAspect(1000, 3000)).toBe('panorama');
  });

  it('width=0 hoặc null → unknown', () => {
    expect(classifyAspect(null, 1000)).toBe('unknown');
    expect(classifyAspect(1000, null)).toBe('unknown');
    expect(classifyAspect(0, 1000)).toBe('unknown');
    expect(classifyAspect(-1, 1000)).toBe('unknown');
  });
});

describe('enrichImage', () => {
  it('enrich RawImageEntry + compute aspect', () => {
    const raw: RawImageEntry = {
      path: '/Photos/IMG_001.jpg',
      name: 'IMG_001.jpg',
      ext: 'JPG',
      size_bytes: 2_000_000,
      taken_ms: 1_700_000_000_000,
      width: 4032,
      height: 3024,
      camera: 'iPhone 14 Pro',
      has_gps: true,
      face_count: 2,
    };
    const e = enrichImage(raw);
    expect(e.aspect).toBe('landscape');
    expect(e.ext).toBe('jpg'); // lowercased
    expect(e.face_count).toBe(2);
    expect(e.camera).toBe('iPhone 14 Pro');
    expect(e.has_gps).toBe(true);
  });

  it('raw không có dimensions → aspect unknown', () => {
    const raw: RawImageEntry = {
      path: '/photos/broken.png',
      name: 'broken.png',
      ext: 'png',
      size_bytes: 100,
      taken_ms: null,
      width: null,
      height: null,
      camera: null,
      has_gps: false,
      face_count: null,
    };
    expect(enrichImage(raw).aspect).toBe('unknown');
  });
});

describe('filterByAspect', () => {
  const imgs: ImageMeta[] = [
    im({ path: '/a.jpg', aspect: 'landscape' }),
    im({ path: '/b.jpg', aspect: 'portrait' }),
    im({ path: '/c.jpg', aspect: 'portrait' }),
    im({ path: '/d.jpg', aspect: 'square' }),
  ];

  it('filter portrait → 2', () => {
    expect(filterByAspect(imgs, 'portrait')).toHaveLength(2);
  });

  it('filter null → pass-through clone', () => {
    const out = filterByAspect(imgs, null);
    expect(out).toHaveLength(4);
    expect(out).not.toBe(imgs); // clone
  });

  it('filter class không tồn tại → []', () => {
    expect(filterByAspect(imgs, 'panorama')).toHaveLength(0);
  });
});
