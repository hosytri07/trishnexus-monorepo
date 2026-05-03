/**
 * TrishDesign Phase 28.5 — Module Dự toán xây dựng.
 *
 * Theo nghị định 10/2021/NĐ-CP + thông tư 12/2021/TT-BXD:
 *   Tổng dự toán = (Chi phí TT + Chi phí gián tiếp + Lãi) × (1 + thuế VAT)
 *
 * Chi phí trực tiếp = Vật liệu + Nhân công + Máy thi công
 * Chi phí gián tiếp = TLPT (trực tiếp phí khác) + Chi phí chung
 *
 * Pattern data:
 *   - NormCatalog: thư viện mã định mức (theo QĐ 1776/BXD và sửa đổi)
 *   - PriceCatalog: đơn giá vật liệu / nhân công / máy
 *   - WorkItem: 1 dòng BKL (Mã ĐM + KL + đơn giá tổng = thành tiền)
 *   - EstimateProject: dự án dự toán
 */

// =====================================================================
// Norm (định mức) — đầu vào: 1 đơn vị work cần bao nhiêu vật liệu/nhân công/máy
// =====================================================================

export interface NormResource {
  type: 'vatlieu' | 'nhancong' | 'may';
  code: string;          // Mã vật liệu / nhân công / máy
  name: string;
  donVi: string;         // m³, kg, công, ca, ...
  hao: number;           // Hao phí (số lượng cho 1 đơn vị work)
}

export interface Norm {
  id: string;
  code: string;          // Mã ĐM (vd "AB.11122")
  name: string;          // Tên công việc
  donVi: string;         // Đơn vị (m², m³, kg, ...)
  category?: string;     // Nhóm (Đào, Bê tông, Thép, ...)
  resources: NormResource[];
  note?: string;
}

// =====================================================================
// Price (đơn giá) — VND/đơn vị
// =====================================================================

export interface Price {
  id: string;
  code: string;          // Match với NormResource.code
  name: string;
  type: 'vatlieu' | 'nhancong' | 'may';
  donVi: string;
  donGia: number;        // VND
  region?: string;       // Vùng (Đà Nẵng, HCM, ...)
  source?: string;       // Nguồn công bố (Sở XD ĐN Q4-2025)
  updatedAt?: number;
}

// =====================================================================
// Work item — 1 dòng BKL
// =====================================================================

export interface WorkItem {
  id: string;
  stt: number;
  normCode: string;      // Match Norm.code
  customName?: string;   // Override tên (nếu khác)
  donVi: string;
  khoiLuong: number;
  donGiaVL: number;      // Vật liệu
  donGiaNC: number;      // Nhân công
  donGiaM: number;       // Máy
  ghiChu?: string;
  // Computed
  thanhTienVL?: number;
  thanhTienNC?: number;
  thanhTienM?: number;
  thanhTien?: number;
}

// =====================================================================
// Hệ số tổng hợp chi phí (theo TT 12/2021)
// =====================================================================

export interface CostFactors {
  truciepPhiKhac: number;   // % TLPT (default 2.5%)
  chiPhiChung: number;       // % Chi phí chung (default 6.5%)
  thuNhapChiuThueTinhTruoc: number; // % Thu nhập chịu thuế tính trước (lãi định mức, default 5.5%)
  vat: number;               // % VAT (default 10%)
  duPhongPhi: number;        // % Dự phòng phí (default 5%)
}

export function defaultCostFactors(): CostFactors {
  return {
    truciepPhiKhac: 2.5,
    chiPhiChung: 6.5,
    thuNhapChiuThueTinhTruoc: 5.5,
    vat: 10,
    duPhongPhi: 5,
  };
}

// =====================================================================
// EstimateProject + Db
// =====================================================================

export interface EstimateProject {
  id: string;
  name: string;
  congTrinh?: string;        // Tên công trình
  diaDiem?: string;
  chuDauTu?: string;
  donViThietKe?: string;
  ngayLap?: string;          // ISO date
  workItems: WorkItem[];
  factors: CostFactors;
  createdAt: number;
  updatedAt: number;
}

export interface EstimateDb {
  version: number;
  projects: EstimateProject[];
  activeProjectId: string | null;
  // Catalog dùng chung cho tất cả project
  norms: Norm[];
  prices: Price[];
  updatedAt: number;
}

export function emptyEstimateDb(): EstimateDb {
  return {
    version: 1,
    projects: [],
    activeProjectId: null,
    norms: [],
    prices: [],
    updatedAt: Date.now(),
  };
}

export function newEstId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.floor(Math.random() * 1000).toString(36)}`;
}

export function defaultEstimateProject(name: string): EstimateProject {
  return {
    id: newEstId('proj'),
    name,
    workItems: [],
    factors: defaultCostFactors(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// =====================================================================
// Cost calculations
// =====================================================================

export interface EstimateCosts {
  vlTotal: number;            // Tổng vật liệu
  ncTotal: number;            // Tổng nhân công
  mayTotal: number;           // Tổng máy
  trucTiep: number;           // Chi phí trực tiếp (VL+NC+M)
  truciepPhiKhac: number;     // TLPT
  chiPhiChung: number;
  thuNhapChiuThueTinhTruoc: number;
  giaTriTruocVAT: number;     // = TT + TLPT + CPC + TNTT
  vat: number;
  giaTriSauVAT: number;
  duPhongPhi: number;
  tongDuToan: number;          // Tổng cộng
}

export function calculateCosts(items: WorkItem[], factors: CostFactors): EstimateCosts {
  let vlTotal = 0, ncTotal = 0, mayTotal = 0;
  for (const it of items) {
    vlTotal += it.khoiLuong * it.donGiaVL;
    ncTotal += it.khoiLuong * it.donGiaNC;
    mayTotal += it.khoiLuong * it.donGiaM;
  }
  const trucTiep = vlTotal + ncTotal + mayTotal;
  const truciepPhiKhac = trucTiep * factors.truciepPhiKhac / 100;
  const subAfterTLPT = trucTiep + truciepPhiKhac;
  const chiPhiChung = subAfterTLPT * factors.chiPhiChung / 100;
  const subAfterCPC = subAfterTLPT + chiPhiChung;
  const thuNhapChiuThueTinhTruoc = subAfterCPC * factors.thuNhapChiuThueTinhTruoc / 100;
  const giaTriTruocVAT = subAfterCPC + thuNhapChiuThueTinhTruoc;
  const vat = giaTriTruocVAT * factors.vat / 100;
  const giaTriSauVAT = giaTriTruocVAT + vat;
  const duPhongPhi = giaTriSauVAT * factors.duPhongPhi / 100;
  const tongDuToan = giaTriSauVAT + duPhongPhi;
  return {
    vlTotal, ncTotal, mayTotal, trucTiep,
    truciepPhiKhac, chiPhiChung, thuNhapChiuThueTinhTruoc,
    giaTriTruocVAT, vat, giaTriSauVAT, duPhongPhi, tongDuToan,
  };
}

export function recomputeWorkItem(it: WorkItem): WorkItem {
  const tVL = it.khoiLuong * it.donGiaVL;
  const tNC = it.khoiLuong * it.donGiaNC;
  const tM = it.khoiLuong * it.donGiaM;
  return { ...it, thanhTienVL: tVL, thanhTienNC: tNC, thanhTienM: tM, thanhTien: tVL + tNC + tM };
}

export function formatVnd(n: number): string {
  return Math.round(n).toLocaleString('vi-VN');
}
