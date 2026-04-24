import type {
  AspectClass,
  ImageMeta,
  ScanImagesSummary,
} from './types.js';

const ASPECT_KEYS: AspectClass[] = [
  'landscape',
  'portrait',
  'square',
  'panorama',
  'unknown',
];

/** Tính stats summary từ danh sách ảnh đã enrich. */
export function summarizeImages(
  images: readonly ImageMeta[],
): ScanImagesSummary {
  const by_aspect: Record<AspectClass, number> = {
    landscape: 0,
    portrait: 0,
    square: 0,
    panorama: 0,
    unknown: 0,
  };
  const by_ext: Record<string, number> = {};
  let total_bytes = 0;
  let with_exif_time = 0;
  let with_gps = 0;
  let min_taken_ms: number | null = null;
  let max_taken_ms: number | null = null;

  for (const im of images) {
    by_aspect[im.aspect] = (by_aspect[im.aspect] ?? 0) + 1;
    by_ext[im.ext] = (by_ext[im.ext] ?? 0) + 1;
    total_bytes += im.size_bytes;
    if (im.taken_ms !== null) {
      with_exif_time += 1;
      if (min_taken_ms === null || im.taken_ms < min_taken_ms) {
        min_taken_ms = im.taken_ms;
      }
      if (max_taken_ms === null || im.taken_ms > max_taken_ms) {
        max_taken_ms = im.taken_ms;
      }
    }
    if (im.has_gps) with_gps += 1;
  }

  return {
    total_files: images.length,
    total_bytes,
    with_exif_time,
    with_gps,
    by_aspect,
    by_ext,
    min_taken_ms,
    max_taken_ms,
  };
}

/** Top N extension theo count, sort desc. */
export function topExtensions(
  summary: ScanImagesSummary,
  limit = 6,
): Array<{ ext: string; count: number }> {
  return Object.entries(summary.by_ext)
    .map(([ext, count]) => ({ ext, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/** Total số ảnh theo aspect (dùng cho progress bar phân loại). */
export function aspectOrder(): AspectClass[] {
  return ASPECT_KEYS.slice();
}

/** Format bytes → human "1.2 MB" etc. */
export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
