/**
 * Database Định mức xây dựng (rút gọn) — Phase 19.20.
 *
 * Trích từ QĐ 1776/2007/QĐ-BXD + bổ sung theo Thông tư hiện hành.
 * Dữ liệu rút gọn để tham khảo nhanh — KHÔNG thay thế được tài liệu gốc khi lập dự toán chính thức.
 */

export type NormCategory =
  | 'dao-dap'
  | 'be-tong'
  | 'cot-thep'
  | 'xay'
  | 'trat'
  | 'cop-pha'
  | 'mat-duong'
  | 'coc-mong';

export interface NormResource {
  /** Loại tài nguyên: vat-lieu | nhan-cong | may */
  type: 'vat-lieu' | 'nhan-cong' | 'may';
  name: string;
  unit: string;
  qty: number;
  /** Bậc thợ nếu là nhân công */
  grade?: string;
}

export interface ConstructionNorm {
  id: string;
  /** Mã hiệu: AB.11110, AF.11110, ... */
  code: string;
  category: NormCategory;
  name: string;
  unit: string;
  /** Mô tả ngắn */
  description: string;
  resources: NormResource[];
  /** Văn bản gốc */
  source: string;
}

export const CONSTRUCTION_NORMS: ConstructionNorm[] = [
  // ===== Đào - đắp =====
  {
    id: 'AB-11410',
    code: 'AB.11410',
    category: 'dao-dap',
    name: 'Đào móng cột, móng trụ, hố kiểm tra bằng thủ công',
    unit: 'm³',
    description: 'Đất cấp II — chiều rộng móng ≤1m, sâu ≤1m.',
    resources: [
      { type: 'nhan-cong', name: 'Nhân công bậc 3,0/7', unit: 'công', qty: 0.62, grade: '3,0/7' },
    ],
    source: 'QĐ 1776/2007/QĐ-BXD — Phần đất, đá',
  },
  {
    id: 'AB-25130',
    code: 'AB.25130',
    category: 'dao-dap',
    name: 'Đào móng công trình bằng máy đào ≤0.8m³',
    unit: '100 m³',
    description: 'Đất cấp II — đổ đất tại chỗ, máy đào gầu nghịch.',
    resources: [
      { type: 'nhan-cong', name: 'Nhân công bậc 3,0/7', unit: 'công', qty: 4.55, grade: '3,0/7' },
      { type: 'may', name: 'Máy đào ≤0.8 m³', unit: 'ca', qty: 0.357 },
      { type: 'may', name: 'Máy ủi ≤110CV', unit: 'ca', qty: 0.085 },
    ],
    source: 'QĐ 1776/2007/QĐ-BXD',
  },
  {
    id: 'AB-65120',
    code: 'AB.65120',
    category: 'dao-dap',
    name: 'Đắp đất công trình bằng máy đầm 9T',
    unit: '100 m³',
    description: 'Độ chặt K=0,95 — đất đồi, đắp theo lớp.',
    resources: [
      { type: 'nhan-cong', name: 'Nhân công bậc 3,0/7', unit: 'công', qty: 1.84, grade: '3,0/7' },
      { type: 'may', name: 'Máy ủi ≤110CV', unit: 'ca', qty: 0.255 },
      { type: 'may', name: 'Máy đầm 9T', unit: 'ca', qty: 0.43 },
    ],
    source: 'QĐ 1776/2007/QĐ-BXD',
  },

  // ===== Bê tông =====
  {
    id: 'AF-11110',
    code: 'AF.11110',
    category: 'be-tong',
    name: 'Bê tông lót móng, đá 4×6, M100',
    unit: 'm³',
    description: 'Trộn bằng máy 250L, đổ thủ công.',
    resources: [
      { type: 'vat-lieu', name: 'Xi măng PCB30', unit: 'kg', qty: 218 },
      { type: 'vat-lieu', name: 'Cát vàng', unit: 'm³', qty: 0.516 },
      { type: 'vat-lieu', name: 'Đá 4×6', unit: 'm³', qty: 0.91 },
      { type: 'vat-lieu', name: 'Nước', unit: 'lít', qty: 170 },
      { type: 'nhan-cong', name: 'Nhân công bậc 3,0/7', unit: 'công', qty: 1.42, grade: '3,0/7' },
      { type: 'may', name: 'Máy trộn 250L', unit: 'ca', qty: 0.095 },
      { type: 'may', name: 'Máy đầm dùi 1.5kW', unit: 'ca', qty: 0.089 },
    ],
    source: 'QĐ 1776/2007/QĐ-BXD',
  },
  {
    id: 'AF-12320',
    code: 'AF.12320',
    category: 'be-tong',
    name: 'Bê tông móng đá 1×2, M250 (B20)',
    unit: 'm³',
    description: 'Trộn máy 250L, đổ thủ công, móng rộng >250cm.',
    resources: [
      { type: 'vat-lieu', name: 'Xi măng PCB30', unit: 'kg', qty: 415 },
      { type: 'vat-lieu', name: 'Cát vàng', unit: 'm³', qty: 0.451 },
      { type: 'vat-lieu', name: 'Đá 1×2', unit: 'm³', qty: 0.881 },
      { type: 'vat-lieu', name: 'Nước', unit: 'lít', qty: 195 },
      { type: 'nhan-cong', name: 'Nhân công bậc 3,5/7', unit: 'công', qty: 1.59, grade: '3,5/7' },
      { type: 'may', name: 'Máy trộn 250L', unit: 'ca', qty: 0.095 },
      { type: 'may', name: 'Máy đầm dùi 1.5kW', unit: 'ca', qty: 0.089 },
    ],
    source: 'QĐ 1776/2007/QĐ-BXD',
  },
  {
    id: 'AF-12420',
    code: 'AF.12420',
    category: 'be-tong',
    name: 'Bê tông cột tiết diện ≤0.1m², đá 1×2, M250',
    unit: 'm³',
    description: 'Bê tông cột ≤4m, trộn máy đổ thủ công.',
    resources: [
      { type: 'vat-lieu', name: 'Xi măng PCB30', unit: 'kg', qty: 415 },
      { type: 'vat-lieu', name: 'Cát vàng', unit: 'm³', qty: 0.451 },
      { type: 'vat-lieu', name: 'Đá 1×2', unit: 'm³', qty: 0.881 },
      { type: 'vat-lieu', name: 'Nước', unit: 'lít', qty: 195 },
      { type: 'nhan-cong', name: 'Nhân công bậc 4,0/7', unit: 'công', qty: 4.04, grade: '4,0/7' },
      { type: 'may', name: 'Máy trộn 250L', unit: 'ca', qty: 0.095 },
      { type: 'may', name: 'Máy vận thăng ≤0.8T', unit: 'ca', qty: 0.04 },
    ],
    source: 'QĐ 1776/2007/QĐ-BXD',
  },

  // ===== Cốt thép =====
  {
    id: 'AF-61120',
    code: 'AF.61120',
    category: 'cot-thep',
    name: 'Sản xuất, lắp dựng cốt thép móng, đường kính ≤18mm',
    unit: 'tấn',
    description: 'Cắt, uốn, nối, buộc tại chỗ.',
    resources: [
      { type: 'vat-lieu', name: 'Thép tròn ≤18mm', unit: 'kg', qty: 1005 },
      { type: 'vat-lieu', name: 'Dây thép buộc ϕ1mm', unit: 'kg', qty: 21.42 },
      { type: 'nhan-cong', name: 'Nhân công bậc 3,5/7', unit: 'công', qty: 8.34, grade: '3,5/7' },
      { type: 'may', name: 'Máy cắt uốn 5kW', unit: 'ca', qty: 0.4 },
      { type: 'may', name: 'Máy hàn 23kW', unit: 'ca', qty: 1.06 },
    ],
    source: 'QĐ 1776/2007/QĐ-BXD',
  },
  {
    id: 'AF-61530',
    code: 'AF.61530',
    category: 'cot-thep',
    name: 'Sản xuất, lắp dựng cốt thép cột, đường kính >18mm',
    unit: 'tấn',
    description: 'Cột nhà cao ≤16m.',
    resources: [
      { type: 'vat-lieu', name: 'Thép vằn >18mm', unit: 'kg', qty: 1020 },
      { type: 'vat-lieu', name: 'Dây thép buộc', unit: 'kg', qty: 14.28 },
      { type: 'nhan-cong', name: 'Nhân công bậc 3,5/7', unit: 'công', qty: 7.62, grade: '3,5/7' },
      { type: 'may', name: 'Máy cắt uốn 5kW', unit: 'ca', qty: 0.32 },
      { type: 'may', name: 'Máy hàn 23kW', unit: 'ca', qty: 1.51 },
      { type: 'may', name: 'Cẩu tháp 25T', unit: 'ca', qty: 0.124 },
    ],
    source: 'QĐ 1776/2007/QĐ-BXD',
  },

  // ===== Xây - trát =====
  {
    id: 'AE-22210',
    code: 'AE.22210',
    category: 'xay',
    name: 'Xây tường gạch tuynel 6x10.5x22, vữa M75, dày ≤30cm',
    unit: 'm³',
    description: 'Tường nhà cao ≤4m.',
    resources: [
      { type: 'vat-lieu', name: 'Gạch tuynel 60×105×220', unit: 'viên', qty: 643 },
      { type: 'vat-lieu', name: 'Vữa xây M75', unit: 'm³', qty: 0.29 },
      { type: 'nhan-cong', name: 'Nhân công bậc 3,5/7', unit: 'công', qty: 1.92, grade: '3,5/7' },
    ],
    source: 'QĐ 1776/2007/QĐ-BXD',
  },
  {
    id: 'AK-21220',
    code: 'AK.21220',
    category: 'trat',
    name: 'Trát tường ngoài, dày 1.5cm, vữa XM M75',
    unit: 'm²',
    description: 'Tường nhà cao ≤16m.',
    resources: [
      { type: 'vat-lieu', name: 'Vữa XM M75', unit: 'm³', qty: 0.017 },
      { type: 'nhan-cong', name: 'Nhân công bậc 4,0/7', unit: 'công', qty: 0.244, grade: '4,0/7' },
    ],
    source: 'QĐ 1776/2007/QĐ-BXD',
  },

  // ===== Cốp pha =====
  {
    id: 'AF-81120',
    code: 'AF.81120',
    category: 'cop-pha',
    name: 'Cốp pha gỗ móng',
    unit: '100 m²',
    description: 'Cốp pha gỗ ván ép, móng cột.',
    resources: [
      { type: 'vat-lieu', name: 'Ván khuôn gỗ', unit: 'm³', qty: 0.945 },
      { type: 'vat-lieu', name: 'Đinh', unit: 'kg', qty: 8.05 },
      { type: 'vat-lieu', name: 'Đinh đỉa', unit: 'cái', qty: 96 },
      { type: 'nhan-cong', name: 'Nhân công bậc 3,5/7', unit: 'công', qty: 19.6, grade: '3,5/7' },
    ],
    source: 'QĐ 1776/2007/QĐ-BXD',
  },
  {
    id: 'AF-82111',
    code: 'AF.82111',
    category: 'cop-pha',
    name: 'Cốp pha định hình thép — móng',
    unit: '100 m²',
    description: 'Sử dụng định hình thép tái sử dụng.',
    resources: [
      { type: 'vat-lieu', name: 'Cốp pha thép luân chuyển', unit: 'kg', qty: 51.8 },
      { type: 'nhan-cong', name: 'Nhân công bậc 3,5/7', unit: 'công', qty: 12.7, grade: '3,5/7' },
    ],
    source: 'QĐ 1776/2007/QĐ-BXD',
  },

  // ===== Mặt đường =====
  {
    id: 'AD-23211',
    code: 'AD.23211',
    category: 'mat-duong',
    name: 'Cấp phối đá dăm loại I, lớp móng dày 15cm',
    unit: '100 m²',
    description: 'Lu lèn K≥0,98, đá Dmax=37.5mm.',
    resources: [
      { type: 'vat-lieu', name: 'Cấp phối đá dăm I', unit: 'm³', qty: 17.4 },
      { type: 'nhan-cong', name: 'Nhân công bậc 3,5/7', unit: 'công', qty: 1.79, grade: '3,5/7' },
      { type: 'may', name: 'Máy lu rung 25T', unit: 'ca', qty: 0.064 },
      { type: 'may', name: 'Máy lu 10T', unit: 'ca', qty: 0.064 },
      { type: 'may', name: 'Máy san 110CV', unit: 'ca', qty: 0.025 },
    ],
    source: 'QĐ 1776/2007/QĐ-BXD',
  },
  {
    id: 'AD-23241',
    code: 'AD.23241',
    category: 'mat-duong',
    name: 'Bê tông nhựa nóng chặt 12.5, dày 5cm',
    unit: '100 m²',
    description: 'BTNC 12.5 mịn, lu nóng.',
    resources: [
      { type: 'vat-lieu', name: 'BTNC 12.5', unit: 'tấn', qty: 12.36 },
      { type: 'vat-lieu', name: 'Nhũ tương dính bám', unit: 'kg', qty: 50 },
      { type: 'nhan-cong', name: 'Nhân công bậc 4,0/7', unit: 'công', qty: 1.43, grade: '4,0/7' },
      { type: 'may', name: 'Máy rải 130-140CV', unit: 'ca', qty: 0.029 },
      { type: 'may', name: 'Máy lu rung 16T', unit: 'ca', qty: 0.029 },
      { type: 'may', name: 'Máy lu bánh lốp 16T', unit: 'ca', qty: 0.029 },
    ],
    source: 'QĐ 1776/2007/QĐ-BXD',
  },

  // ===== Cọc móng =====
  {
    id: 'AC-22221',
    code: 'AC.22221',
    category: 'coc-mong',
    name: 'Đóng cọc bê tông cốt thép 25×25, dài 8-12m',
    unit: '100 m',
    description: 'Búa diesel ≤2.5T, đất cấp II.',
    resources: [
      { type: 'nhan-cong', name: 'Nhân công bậc 3,5/7', unit: 'công', qty: 18.3, grade: '3,5/7' },
      { type: 'may', name: 'Búa diesel 2.5T', unit: 'ca', qty: 1.21 },
      { type: 'may', name: 'Cẩu bánh xích 25T', unit: 'ca', qty: 1.21 },
    ],
    source: 'QĐ 1776/2007/QĐ-BXD',
  },
  {
    id: 'AC-31142',
    code: 'AC.31142',
    category: 'coc-mong',
    name: 'Cọc khoan nhồi ϕ1000, đất cấp II, sâu ≤25m',
    unit: 'm',
    description: 'Khoan trong dung dịch bentonite, đổ bê tông M250.',
    resources: [
      { type: 'vat-lieu', name: 'Bê tông cọc M250', unit: 'm³', qty: 0.864 },
      { type: 'vat-lieu', name: 'Bentonite', unit: 'kg', qty: 18.85 },
      { type: 'nhan-cong', name: 'Nhân công bậc 4,0/7', unit: 'công', qty: 0.84, grade: '4,0/7' },
      { type: 'may', name: 'Máy khoan cọc nhồi', unit: 'ca', qty: 0.0354 },
      { type: 'may', name: 'Cẩu bánh xích 50T', unit: 'ca', qty: 0.018 },
    ],
    source: 'QĐ 1776/2007/QĐ-BXD',
  },
];

export interface NormCategoryConfig {
  id: NormCategory;
  name: string;
  icon: string;
  color: string;
}

export const NORM_CATEGORIES: Record<NormCategory, NormCategoryConfig> = {
  'dao-dap': { id: 'dao-dap', name: 'Đào - Đắp', icon: '🪏', color: '#A16207' },
  'be-tong': { id: 'be-tong', name: 'Bê tông', icon: '🧱', color: '#6B7280' },
  'cot-thep': { id: 'cot-thep', name: 'Cốt thép', icon: '🔩', color: '#475569' },
  xay: { id: 'xay', name: 'Xây', icon: '🧱', color: '#DC2626' },
  trat: { id: 'trat', name: 'Trát', icon: '🪣', color: '#F59E0B' },
  'cop-pha': { id: 'cop-pha', name: 'Cốp pha', icon: '📐', color: '#0EA5E9' },
  'mat-duong': { id: 'mat-duong', name: 'Mặt đường', icon: '🛣️', color: '#1F2937' },
  'coc-mong': { id: 'coc-mong', name: 'Cọc - Móng', icon: '⚓', color: '#7C3AED' },
};
