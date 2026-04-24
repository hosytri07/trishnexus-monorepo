import type { ImageMeta } from './types.js';

/**
 * Face-based photo grouping (v1 heuristic).
 *
 * Phase 14.3.4 alpha chưa wire ONNX face model. Thay vào đó chúng
 * ta nhóm tạm theo:
 *   1. `face_count` — nếu Rust backend detect sẵn (hiện thường null).
 *   2. Ảnh "có người" (face_count >= 1) vs "không người" (=0) vs
 *      "không rõ" (null).
 *
 * Khi Phase 14.3.4.b wire face embedding, sẽ thay thế FaceBucket
 * bằng per-person cluster (bucket per identity), API giữ nguyên.
 */

export type FaceBucket =
  | 'solo' // 1 mặt
  | 'pair' // 2 mặt
  | 'group' // 3+ mặt
  | 'none' // 0 mặt
  | 'unknown'; // chưa detect

/** Classify 1 ảnh thành bucket. */
export function faceBucket(image: ImageMeta): FaceBucket {
  if (image.face_count === null) return 'unknown';
  if (image.face_count === 0) return 'none';
  if (image.face_count === 1) return 'solo';
  if (image.face_count === 2) return 'pair';
  return 'group';
}

/** Group ảnh theo face bucket. Trả về Map bucket → images. */
export function groupByFaceBucket(
  images: readonly ImageMeta[],
): Map<FaceBucket, ImageMeta[]> {
  const out = new Map<FaceBucket, ImageMeta[]>();
  const buckets: FaceBucket[] = [
    'solo',
    'pair',
    'group',
    'none',
    'unknown',
  ];
  for (const b of buckets) out.set(b, []);
  for (const im of images) {
    out.get(faceBucket(im))!.push(im);
  }
  return out;
}

/** Tổng quan face: tỉ lệ có mặt vs không + có người ẩn danh. */
export interface FaceSummary {
  with_people: number; // face_count >= 1
  without_people: number; // face_count === 0
  not_analyzed: number; // face_count === null
  total: number;
  /** % has been analyzed (face_count != null). */
  coverage: number;
}

export function summarizeFaces(
  images: readonly ImageMeta[],
): FaceSummary {
  let withP = 0;
  let withoutP = 0;
  let naP = 0;
  for (const im of images) {
    if (im.face_count === null) naP += 1;
    else if (im.face_count > 0) withP += 1;
    else withoutP += 1;
  }
  const total = images.length;
  const coverage = total === 0 ? 0 : (withP + withoutP) / total;
  return {
    with_people: withP,
    without_people: withoutP,
    not_analyzed: naP,
    total,
    coverage,
  };
}

/**
 * Label tiếng Việt cho bucket — dùng hiển thị UI.
 */
export function faceBucketLabel(b: FaceBucket): string {
  switch (b) {
    case 'solo':
      return 'Chân dung (1 người)';
    case 'pair':
      return 'Cặp đôi (2 người)';
    case 'group':
      return 'Nhóm (3+ người)';
    case 'none':
      return 'Không có người';
    case 'unknown':
      return 'Chưa phân tích';
  }
}
