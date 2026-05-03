/**
 * TrishDesign Phase 28.5 — Module "Danh mục hồ sơ".
 *
 * Project độc lập với:
 *   - Biến chung (auto-fill các template / report)
 *   - Templates: file .docx/.xlsx user upload, tạm lưu metadata + file path local
 *   - Files: tài liệu hồ sơ (link đến file path local)
 *   - Catalogs: bảng danh mục bản vẽ / thiết bị / vật liệu (excel-like)
 *   - Reports: biên bản nghiệm thu / bàn giao tuỳ chỉnh (form fields → docx)
 */

// =====================================================================
// Biến chung của dự án (auto-fill)
// =====================================================================

export interface DossierVariables {
  tenDuAn: string;
  chuDauTu: string;
  donViTuVan: string;
  donViThietKe: string;
  donViThiCong?: string;
  donViGiamSat?: string;
  diaDiem: string;
  namThucHien: number;
  maDuAn?: string;
  giaTriHopDong?: number;     // VND
  ngayKhoiCong?: string;       // ISO date
  ngayHoanThanh?: string;      // ISO date
  diaChiChuDT?: string;
  diaChiTuVan?: string;
  ghiChu?: string;
}

export function defaultVariables(): DossierVariables {
  return {
    tenDuAn: '',
    chuDauTu: '',
    donViTuVan: '',
    donViThietKe: 'Trung tâm Quản lý hạ tầng giao thông Đà Nẵng',
    diaDiem: 'Đà Nẵng',
    namThucHien: new Date().getFullYear(),
  };
}

// =====================================================================
// Template (.docx / .xlsx) — user upload, lưu metadata + path
// =====================================================================

export type TemplateKind = 'docx' | 'xlsx' | 'pdf' | 'other';

export interface DossierTemplate {
  id: string;
  name: string;             // Tên template (vd "Thuyết minh BVTC")
  kind: TemplateKind;
  category: 'thuyet_minh' | 'bien_ban' | 'to_trinh' | 'danh_muc' | 'khac';
  filePath?: string;        // Local path (nếu đã save)
  fileSize?: number;        // bytes
  description?: string;
  variables?: string[];     // List of {variable_name} found in template
  createdAt: number;
}

export const TEMPLATE_CATEGORIES: { id: DossierTemplate['category']; name: string; icon: string }[] = [
  { id: 'thuyet_minh', name: 'Thuyết minh',           icon: '📄' },
  { id: 'bien_ban',    name: 'Biên bản',              icon: '📑' },
  { id: 'to_trinh',    name: 'Tờ trình / Quyết định', icon: '📋' },
  { id: 'danh_muc',    name: 'Danh mục',              icon: '📊' },
  { id: 'khac',        name: 'Khác',                  icon: '📁' },
];

// =====================================================================
// File hồ sơ — tài liệu đã có sẵn của dự án
// =====================================================================

export interface DossierFile {
  id: string;
  name: string;
  path: string;             // Absolute local path
  size?: number;
  category: 'khao_sat' | 'thiet_ke' | 'hoan_cong' | 'nghiem_thu' | 'tham_tra' | 'khac';
  uploadedAt: number;
  note?: string;
}

export const FILE_CATEGORIES: { id: DossierFile['category']; name: string; icon: string }[] = [
  { id: 'khao_sat',  name: 'Khảo sát',   icon: '🔍' },
  { id: 'thiet_ke',  name: 'Thiết kế',   icon: '📐' },
  { id: 'hoan_cong', name: 'Hoàn công',  icon: '🏗' },
  { id: 'nghiem_thu', name: 'Nghiệm thu', icon: '✅' },
  { id: 'tham_tra',  name: 'Thẩm tra',   icon: '🔬' },
  { id: 'khac',      name: 'Khác',       icon: '📁' },
];

// =====================================================================
// Catalog — Danh mục bản vẽ / thiết bị / vật liệu
// =====================================================================

export type CatalogKind = 'banve' | 'thietbi' | 'vatlieu';

export interface CatalogItem {
  id: string;
  stt: number;              // Số thứ tự
  ma: string;               // Mã hiệu
  ten: string;              // Tên
  donVi?: string;           // Đơn vị tính (cái, m, m², ...)
  soLuong?: number;
  ghiChu?: string;
  // Banve specific
  khoGiay?: string;         // A0/A1/A2/A3
  tyLe?: string;            // 1/100, 1/200, ...
  // Vatlieu/Thietbi specific
  quyCach?: string;         // Quy cách kỹ thuật
  xuatXu?: string;          // Xuất xứ
}

export interface Catalog {
  id: string;
  kind: CatalogKind;
  title: string;
  items: CatalogItem[];
  createdAt: number;
  updatedAt: number;
}

export const CATALOG_KIND_INFO: Record<CatalogKind, { name: string; icon: string }> = {
  banve:    { name: 'Bản vẽ',   icon: '📐' },
  thietbi:  { name: 'Thiết bị', icon: '🔧' },
  vatlieu:  { name: 'Vật liệu', icon: '🧱' },
};

// =====================================================================
// Report — Biên bản nghiệm thu / bàn giao
// =====================================================================

export type ReportKind =
  | 'nghiem_thu_cv' | 'nghiem_thu_gd' | 'nghiem_thu_ht'
  | 'ban_giao_mb' | 'hien_truong_ks' | 'thaam_tra'
  | 'thanh_toan_kl' | 'thanh_toan_dot'
  | 'khao_sat_dia_chat' | 'khao_sat_thuy_van'
  | 'thuyet_minh_co_so' | 'thuyet_minh_bvtc'
  | 'bao_cao_hoan_cong' | 'tu_trinh_phe_duyet';

export const REPORT_TEMPLATES: { id: ReportKind; name: string; icon: string; group: string; fields: string[] }[] = [
  // Nghiệm thu (3)
  { id: 'nghiem_thu_cv',  name: 'BB Nghiệm thu công việc',          icon: '✅', group: 'Nghiệm thu', fields: ['Tên công việc', 'Hạng mục', 'Ngày NT', 'Lý trình từ', 'Lý trình đến', 'Khối lượng', 'Đơn vị', 'Chất lượng', 'Tài liệu kèm theo', 'Kết luận'] },
  { id: 'nghiem_thu_gd',  name: 'BB Nghiệm thu giai đoạn',          icon: '🏁', group: 'Nghiệm thu', fields: ['Giai đoạn', 'Hạng mục', 'Ngày NT', 'Phạm vi', 'Khối lượng', 'Đánh giá', 'Tồn tại', 'Kết luận'] },
  { id: 'nghiem_thu_ht',  name: 'BB Nghiệm thu hoàn thành',          icon: '🎯', group: 'Nghiệm thu', fields: ['Tên gói', 'Ngày NT', 'Tổng giá trị HĐ', 'Tổng giá trị NT', 'Đánh giá tổng thể', 'Bảo hành', 'Kết luận'] },
  // Thanh toán (2)
  { id: 'thanh_toan_kl',  name: 'BB Thanh toán theo khối lượng',    icon: '💰', group: 'Thanh toán', fields: ['Lần thanh toán', 'Đợt', 'Ngày', 'Khối lượng đề nghị', 'Đơn giá', 'Thành tiền', 'Đã thanh toán', 'Còn lại', 'Ghi chú'] },
  { id: 'thanh_toan_dot', name: 'Đề nghị thanh toán đợt',           icon: '📑', group: 'Thanh toán', fields: ['Đợt', 'Số HĐ', 'Ngày', 'Phạm vi', 'Giá trị đề nghị', 'Lũy kế', 'Tỷ lệ % HĐ'] },
  // Khảo sát (2)
  { id: 'khao_sat_dia_chat', name: 'BB Khảo sát địa chất',           icon: '⛰', group: 'Khảo sát',  fields: ['Lý trình', 'Vị trí', 'Ngày KS', 'Phương pháp', 'Số lỗ khoan', 'Độ sâu', 'Mô tả lớp đất', 'Kết quả thí nghiệm', 'Kết luận'] },
  { id: 'khao_sat_thuy_van', name: 'BB Khảo sát thủy văn',           icon: '🌊', group: 'Khảo sát',  fields: ['Lý trình', 'Vị trí', 'Ngày KS', 'Mực nước thấp nhất', 'Mực nước cao nhất', 'Lưu lượng max', 'Tần suất', 'Kết luận'] },
  { id: 'hien_truong_ks',    name: 'BB Hiện trường khảo sát',        icon: '🔍', group: 'Khảo sát',  fields: ['Lý trình', 'Ngày KS', 'Hạng mục KS', 'Phương pháp', 'Kết quả', 'Hình ảnh kèm theo'] },
  // Thiết kế (2)
  { id: 'thuyet_minh_co_so', name: 'Thuyết minh thiết kế cơ sở',    icon: '📐', group: 'Thiết kế',  fields: ['Tổng quan dự án', 'Quy mô đầu tư', 'Tiêu chuẩn áp dụng', 'Giải pháp thiết kế', 'Khối lượng chính', 'Tổng mức đầu tư'] },
  { id: 'thuyet_minh_bvtc',  name: 'Thuyết minh BVTC',                icon: '📏', group: 'Thiết kế',  fields: ['Phạm vi BVTC', 'Tiêu chuẩn BVTC', 'Giải pháp kết cấu', 'Vật liệu chính', 'Khối lượng BVTC', 'Tổ chức thi công'] },
  // Bàn giao + Thẩm tra
  { id: 'ban_giao_mb',       name: 'BB Bàn giao mặt bằng',           icon: '🚧', group: 'Bàn giao',  fields: ['Phạm vi MB', 'Lý trình từ', 'Lý trình đến', 'Ngày bàn giao', 'Diện tích', 'Tình trạng', 'Tài sản bàn giao', 'Yêu cầu xử lý'] },
  { id: 'thaam_tra',         name: 'BB Họp thẩm tra',                icon: '🔬', group: 'Thẩm tra',  fields: ['Tên hồ sơ', 'Ngày họp', 'Người chủ trì', 'Thành phần', 'Nội dung thẩm tra', 'Ý kiến thẩm tra', 'Kết luận'] },
  // Hoàn công + Tờ trình
  { id: 'bao_cao_hoan_cong', name: 'Báo cáo hoàn công',              icon: '🏗', group: 'Hoàn công', fields: ['Phạm vi hoàn công', 'Ngày khởi công', 'Ngày hoàn thành', 'Khối lượng đã thực hiện', 'Sai khác so với thiết kế', 'Đánh giá chất lượng'] },
  { id: 'tu_trinh_phe_duyet', name: 'Tờ trình đề nghị phê duyệt',     icon: '📋', group: 'Phê duyệt', fields: ['Tên hồ sơ', 'Số tờ trình', 'Ngày', 'Cấp trình', 'Lý do trình', 'Đề nghị', 'Tài liệu kèm'] },
];

export interface Report {
  id: string;
  kind: ReportKind;
  title: string;
  fields: Record<string, string>;
  createdAt: number;
  updatedAt: number;
}

// =====================================================================
// DossierProject — top-level
// =====================================================================

export interface DossierProject {
  id: string;
  name: string;             // Hiển thị (ngắn)
  variables: DossierVariables;
  templates: DossierTemplate[];
  files: DossierFile[];
  catalogs: Catalog[];
  reports: Report[];
  createdAt: number;
  updatedAt: number;
}

export interface DossierDb {
  version: number;
  projects: DossierProject[];
  activeProjectId: string | null;
  updatedAt: number;
}

export function emptyDossierDb(): DossierDb {
  return {
    version: 1,
    projects: [],
    activeProjectId: null,
    updatedAt: Date.now(),
  };
}

export function newDossierId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.floor(Math.random() * 1000).toString(36)}`;
}

export function defaultDossierProject(name: string): DossierProject {
  return {
    id: newDossierId('proj'),
    name,
    variables: { ...defaultVariables(), tenDuAn: name },
    templates: [],
    files: [],
    catalogs: [],
    reports: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// =====================================================================
// Helpers
// =====================================================================

export function fileKindFromName(name: string): TemplateKind {
  const ext = name.toLowerCase().split('.').pop() ?? '';
  if (ext === 'docx' || ext === 'doc') return 'docx';
  if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') return 'xlsx';
  if (ext === 'pdf') return 'pdf';
  return 'other';
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

/** Find {variable_name} placeholders in text */
export function findPlaceholders(text: string): string[] {
  const re = /\{([a-zA-Z0-9_]+)\}/g;
  const set = new Set<string>();
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m[1]) set.add(m[1]);
  }
  return Array.from(set);
}

/** Replace {key} placeholders with values */
export function fillTemplate(text: string, vars: Record<string, string>): string {
  return text.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
}

/** Variables → flat record cho fillTemplate */
export function variablesToRecord(v: DossierVariables): Record<string, string> {
  return {
    ten_du_an: v.tenDuAn,
    chu_dau_tu: v.chuDauTu,
    don_vi_tu_van: v.donViTuVan,
    don_vi_thiet_ke: v.donViThietKe,
    don_vi_thi_cong: v.donViThiCong ?? '',
    don_vi_giam_sat: v.donViGiamSat ?? '',
    dia_diem: v.diaDiem,
    nam_thuc_hien: String(v.namThucHien),
    ma_du_an: v.maDuAn ?? '',
    gia_tri_hop_dong: v.giaTriHopDong != null ? v.giaTriHopDong.toLocaleString('vi-VN') : '',
    ngay_khoi_cong: v.ngayKhoiCong ?? '',
    ngay_hoan_thanh: v.ngayHoanThanh ?? '',
    dia_chi_chu_dt: v.diaChiChuDT ?? '',
    dia_chi_tu_van: v.diaChiTuVan ?? '',
    ghi_chu: v.ghiChu ?? '',
  };
}
