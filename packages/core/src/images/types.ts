/**
 * TrishImage domain types — pure TS.
 *
 * Phase 14.3.4: metadata-only model (không decode pixels). Rust
 * backend đọc file size + EXIF + dimensions qua header scan; TS
 * classify + group theo event/aspect/face hints.
 */

/** 5 aspect class phổ biến cho photo organizing. */
export type AspectClass =
  | 'landscape' // width / height > 1.15
  | 'portrait' //  height / width > 1.15
  | 'square' //   ratio ≈ 1 ± 0.15
  | 'panorama' // ratio ≥ 2.0 (landscape rộng) hoặc ≤ 0.5 (dọc)
  | 'unknown'; // thiếu dimensions

/** Event group = chuỗi ảnh chụp gần nhau. */
export interface EventGroup {
  id: string;
  /** Unix ms của ảnh đầu tiên trong event. */
  start_ms: number;
  /** Unix ms của ảnh cuối cùng. */
  end_ms: number;
  /** Danh sách ảnh trong event, order theo taken_ms asc. */
  images: ImageMeta[];
  /** Label tự gen: "2026-04-24 (23 ảnh)". */
  label: string;
}

/** Raw metadata từ Rust + enrich bên TS. */
export interface ImageMeta {
  /** Full path trên OS. */
  path: string;
  /** Filename cuối (basename). */
  name: string;
  /** Extension lowercased, no dot: "jpg", "png", ... */
  ext: string;
  /** File size bytes. */
  size_bytes: number;
  /**
   * Taken time (unix ms). Ưu tiên EXIF DateTimeOriginal; fallback
   * file mtime. `null` nếu không đọc được gì.
   */
  taken_ms: number | null;
  /** Width pixels (null nếu fail probe). */
  width: number | null;
  /** Height pixels. */
  height: number | null;
  /** Aspect class, compute từ width/height. */
  aspect: AspectClass;
  /** EXIF camera model (e.g. "iPhone 14 Pro"); null nếu không có. */
  camera: string | null;
  /** EXIF GPS có hay không. */
  has_gps: boolean;
  /**
   * Face count hint — đếm face detect rough (phase 14.3.4.b sẽ wire
   * ONNX model). Hiện trong v1 = null (chưa detect).
   */
  face_count: number | null;
}

/** Source khi ảnh được Rust scan. Rust output này. */
export interface RawImageEntry {
  path: string;
  name: string;
  ext: string;
  size_bytes: number;
  /** Unix ms từ EXIF hoặc mtime. */
  taken_ms: number | null;
  width: number | null;
  height: number | null;
  camera: string | null;
  has_gps: boolean;
  face_count: number | null;
}

export interface ScanImagesSummary {
  total_files: number;
  total_bytes: number;
  with_exif_time: number;
  with_gps: number;
  by_aspect: Record<AspectClass, number>;
  by_ext: Record<string, number>;
  min_taken_ms: number | null;
  max_taken_ms: number | null;
}
