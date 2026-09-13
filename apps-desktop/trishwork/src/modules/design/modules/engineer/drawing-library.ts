/**
 * Mô hình dữ liệu cho Thư viện bản vẽ (DrawingLibraryPanel).
 *
 * 2 nhánh chính:
 *   - 'detail'  : chi tiết điển hình (block CAD — cống, rãnh, bó vỉa, hố ga, taluy…)
 *   - 'sample'  : bản vẽ mẫu (mặt cắt điển hình, bình đồ, hồ sơ mẫu…)
 *
 * Nguồn dữ liệu: Firestore collection `drawing_library` (admin upload qua
 * TrishAdmin — sẽ làm sau), file DWG/DXF/PDF host trên GitHub Release.
 * File này chỉ định nghĩa type + danh mục; panel tự fetch realtime.
 */

export type DrawingCategory = 'detail' | 'sample';

export const DRAWING_CATEGORIES: { id: DrawingCategory; label: string; icon: string }[] = [
  { id: 'detail', label: 'Chi tiết điển hình', icon: '🧱' },
  { id: 'sample', label: 'Bản vẽ mẫu', icon: '📐' },
];

/** Nhóm con gợi ý (tuỳ chọn, để lọc nhanh). */
export const DRAWING_SUBGROUPS: Record<DrawingCategory, string[]> = {
  detail: ['Cống', 'Rãnh', 'Bó vỉa', 'Hố ga', 'Mái taluy', 'Mặt đường', 'Biển báo', 'Khác'],
  sample: ['Mặt cắt ngang', 'Trắc dọc', 'Bình đồ', 'Khung tên', 'Hồ sơ mẫu', 'Khác'],
};

export interface DrawingItem {
  id: string;
  name: string;
  category: DrawingCategory;
  /** Nhóm con (1 trong DRAWING_SUBGROUPS[category]) — tuỳ chọn. */
  subgroup?: string;
  description?: string;
  /** Loại file: dwg / dxf / pdf. */
  file_type?: 'dwg' | 'dxf' | 'pdf';
  /** Link tải (GitHub Release). */
  file_url?: string;
  sha256?: string;
  size_bytes?: number;
  /** Ảnh xem trước. */
  thumbnail_url?: string;
  /** Nếu là block chèn được vào CAD: id/tên block. */
  block_id?: string;
  tags?: string[];
  keywords?: string;
  /** Ghi chú admin (public). */
  release_notes?: string;
  release_date?: number;
}
