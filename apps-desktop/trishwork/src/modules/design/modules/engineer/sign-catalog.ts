/**
 * Dữ liệu tra cứu Biển báo · Vạch sơn theo QCVN 41:2024/BGTVT.
 *
 * Cấu trúc dữ liệu cho SignRefPanel. Hiện để (gần như) RỖNG — Trí sẽ nhồi data
 * sau (ảnh + Excel kích thước). Có thể nạp từ:
 *   1. Mảng SIGN_CATALOG tĩnh bên dưới (bundle sẵn), hoặc
 *   2. Firestore collection `qc41_signs` (admin upload qua TrishAdmin) — TODO.
 *
 * Ảnh biển: dùng `image_url` (https / asset) hoặc `image_base64`.
 */

export type SignGroup =
  | 'cam' // biển báo cấm (series 100, P)
  | 'nguy_hiem' // biển nguy hiểm & cảnh báo (200, W)
  | 'hieu_lenh' // biển hiệu lệnh (300, R)
  | 'chi_dan' // biển chỉ dẫn (400, I)
  | 'phu' // biển phụ (500, S)
  | 'vach' // vạch kẻ đường
  | 'khac'; // cọc tiêu, hộ lan, đèn tín hiệu...

export const SIGN_GROUPS: { id: SignGroup; label: string; icon: string }[] = [
  { id: 'cam', label: 'Biển cấm', icon: '⛔' },
  { id: 'nguy_hiem', label: 'Nguy hiểm · Cảnh báo', icon: '⚠️' },
  { id: 'hieu_lenh', label: 'Hiệu lệnh', icon: '🔵' },
  { id: 'chi_dan', label: 'Chỉ dẫn', icon: 'ℹ️' },
  { id: 'phu', label: 'Biển phụ', icon: '🏷️' },
  { id: 'vach', label: 'Vạch kẻ đường', icon: '🛣️' },
  { id: 'khac', label: 'Khác', icon: '🚧' },
];

/** Một dòng kích thước theo cấp đường / tốc độ. */
export interface SignDimRow {
  /** Điều kiện áp dụng (vd "Đường cao tốc", "V ≤ 60 km/h"). */
  condition: string;
  /** Kích thước/giá trị (vd "Ø700", "900×900"). */
  size: string;
  /** Ghi chú thêm (tuỳ chọn). */
  note?: string;
}

export interface SignItem {
  /** Mã biển theo QC (vd "P.101", "W.201a", "R.301", "Vạch 1.1"). */
  code: string;
  name: string;
  group: SignGroup;
  /** Ý nghĩa / nội dung biển. */
  meaning?: string;
  /** Tác dụng / phạm vi hiệu lực / cách đặt. */
  effect?: string;
  /** Bảng kích thước theo cấp đường (Trí nhồi từ Excel). */
  dims?: SignDimRow[];
  /** Thay đổi so với QCVN 41:2019 (nếu có). */
  changes?: string;
  /** Trích dẫn điều/khoản/phụ lục trong QC 41:2024. */
  qc_ref?: string;
  /** Ảnh ký hiệu. */
  image_url?: string;
  image_base64?: string;
  /** Mã block ATGT tương ứng để chèn vào AutoCAD (map sau). */
  block_id?: string;
  /** Từ khoá phụ cho tìm kiếm. */
  keywords?: string;
}

/**
 * CATALOG — hiện RỖNG. Trí gửi data → nhồi vào đây (hoặc nạp Firestore).
 * Để 1 ví dụ mẫu (đã comment) cho thấy định dạng:
 */
export const SIGN_CATALOG: SignItem[] = [
  // {
  //   code: 'P.101',
  //   name: 'Đường cấm',
  //   group: 'cam',
  //   meaning: 'Cấm tất cả các loại phương tiện đi lại cả hai hướng.',
  //   effect: 'Đặt ở đầu đoạn đường cấm. Có hiệu lực với mọi phương tiện trừ xe ưu tiên.',
  //   dims: [
  //     { condition: 'Đường thông thường', size: 'Ø700' },
  //     { condition: 'Đường cao tốc / V cao', size: 'Ø1000' },
  //   ],
  //   changes: '',
  //   qc_ref: 'QCVN 41:2024 — Phụ lục B',
  //   image_url: '',
  //   keywords: 'duong cam p101',
  // },
];
