import type { AspectClass, ImageMeta, RawImageEntry } from './types.js';

/**
 * Classify aspect ratio từ width/height. Thresholds cân nhắc UX
 * gallery — ảnh phone (3:4, 4:3) vẫn coi là landscape/portrait bình
 * thường, panorama chỉ khi ratio cực đoan.
 */
export function classifyAspect(
  width: number | null,
  height: number | null,
): AspectClass {
  if (!width || !height || width <= 0 || height <= 0) return 'unknown';
  const r = width / height;
  if (r >= 2.0 || r <= 0.5) return 'panorama';
  if (r > 1.15) return 'landscape';
  if (r < 1 / 1.15) return 'portrait';
  return 'square';
}

/**
 * Enrich RawImageEntry từ Rust → ImageMeta (thêm aspect, bảo toàn
 * face_count/has_gps/...). Pure hàm → tách Rust I/O khỏi TS classify
 * logic, test dễ.
 */
export function enrichImage(raw: RawImageEntry): ImageMeta {
  return {
    path: raw.path,
    name: raw.name,
    ext: raw.ext.toLowerCase(),
    size_bytes: raw.size_bytes,
    taken_ms: raw.taken_ms,
    width: raw.width,
    height: raw.height,
    aspect: classifyAspect(raw.width, raw.height),
    camera: raw.camera,
    has_gps: raw.has_gps,
    face_count: raw.face_count,
  };
}

/**
 * Filter ảnh theo aspect. `null` = không filter.
 */
export function filterByAspect(
  images: readonly ImageMeta[],
  aspect: AspectClass | null,
): ImageMeta[] {
  if (aspect === null) return [...images];
  return images.filter((i) => i.aspect === aspect);
}
