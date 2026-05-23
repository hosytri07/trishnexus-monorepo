/**
 * TrishDesign Phase 43 wave 10.1 — Schema 9 loại tài sản ATGT.
 *
 * Theo file database-c41a296c.xlsx (Trí cung cấp 2026-05-17):
 *   9 sheet bảng nhập tương ứng 9 loại tài sản, mỗi loại có cột riêng.
 *
 * Block 0.LT = block lý trình (line dọc + text "Km{km}+{m}") — đặt tại mọi vị trí
 * có tài sản ATGT. Tài sản kế tiếp gắn cách tim/mép theo direction.
 *
 * Hiện trạng → vẽ LEADER + text trong AutoCAD.
 */

import type { RoadSide } from './atgt-types.js';

/**
 * Common base fields:
 *   - id: docId duy nhất
 *   - station: lý trình (m)
 *   - side: trái / phải / tim
 */
export interface AtgtItemBaseV2 {
  id: string;
  station: number;        // mét — lý trình block 0.LT
  side: RoadSide;
  /** Tình trạng tiếng Việt nhập tự do (vẽ LEADER + text trong CAD) */
  hienTrang?: string;
}

// =====================================================================
// 1. Biển báo — 7 cột: STT | Lí trình | Vị trí | Tên biển báo | Ý nghĩa | Cách tim | Hiện trạng
// =====================================================================
export interface BienBaoItemV2 extends AtgtItemBaseV2 {
  /** Tên biển báo — vd "P.101", "W.221" — vlookup với Database fileName */
  tenBienBao: string;
  /** Ý nghĩa — tự fill khi chọn tên (vd "Đường cấm") */
  yNghia?: string;
  /** Khoảng cách tim đường (m) */
  cachTim: number;
}

// =====================================================================
// 2. Vạch sơn — 8 cột: STT | LT đầu | LT cuối | Vị trí | Loại vạch sơn | Ý nghĩa | Cách tim | Hiện trạng
// =====================================================================
export interface VachSonItemV2 extends AtgtItemBaseV2 {
  /** Lý trình cuối (m) — vẽ PLINE từ station → stationEnd */
  stationEnd: number;
  loaiVachSon: string;
  yNghia?: string;
  cachTim: number;
}

// =====================================================================
// 3. Đèn tín hiệu — 6 cột: STT | Lí trình | Vị trí | Tên đèn | Cách mép | Hiện trạng
// =====================================================================
export interface DenTinHieuItemV2 extends AtgtItemBaseV2 {
  tenDen: string;
  cachMep: number;
}

// =====================================================================
// 4. Hộ lan mềm — 8 cột: STT | LT đầu | LT cuối | Vị trí | Loại | Số khoang | Cách mép | Hiện trạng
// =====================================================================
export interface HoLanMemItemV2 extends AtgtItemBaseV2 {
  stationEnd: number;
  loaiHoLan: string;
  /** Số khoang (vd "3m/kh", "2m/kh") — text tự do */
  soKhoang: string;
  cachMep: number;
}

// =====================================================================
// 5. Cọc tiêu — 9 cột: STT | LT đầu | LT cuối | Vị trí | Loại | Số lượng | Cách khoảng | Cách mép | Hiện trạng
// Logic rải block:
//   - Nếu stationEnd = 0 → rải soLuong block cách nhau cachKhoang (mặc định 1m)
//   - Nếu có cả 2 lý trình → rải đều: spacing = (stationEnd − station) / (soLuong + 1)
// =====================================================================
export interface CocTieuItemV2 extends AtgtItemBaseV2 {
  stationEnd: number;
  loaiCocTieu: string;
  soLuong: number;
  cachKhoang: number;
  cachMep: number;
}

// =====================================================================
// 6. Rãnh dọc — 7 cột: STT | LT đầu | LT cuối | Vị trí | Loại | Cách mép | Hiện trạng
// Vẽ PLINE từ station → stationEnd offset cachMep
// =====================================================================
export interface RanhDocItemV2 extends AtgtItemBaseV2 {
  stationEnd: number;
  loaiRanhDoc: string;
  cachMep: number;
}

// =====================================================================
// 7. Cống ngang — 5 cột: STT | Lí trình | Vị trí | Loại | Hiện trạng
// =====================================================================
export interface CongNgangItemV2 extends AtgtItemBaseV2 {
  loaiCongNgang: string;
}

// =====================================================================
// 8. Tiêu phản quang — 9 cột: giống CocTieu
// =====================================================================
export interface TieuPhanQuangItemV2 extends AtgtItemBaseV2 {
  stationEnd: number;
  loaiTPQ: string;
  soLuong: number;
  cachKhoang: number;
  cachMep: number;
}

// =====================================================================
// 9. Gương cầu lồi — 6 cột: STT | Lí trình | Vị trí | Tên | Cách tim | Hiện trạng
// =====================================================================
export interface GuongCauLoiItemV2 extends AtgtItemBaseV2 {
  tenGuong: string;
  cachTim: number;
}

// =====================================================================
// Container — Atgt items theo 9 loại
// =====================================================================
export interface AtgtSegmentItemsV2 {
  bienBao?: BienBaoItemV2[];
  vachSon?: VachSonItemV2[];
  denTinHieu?: DenTinHieuItemV2[];
  hoLanMem?: HoLanMemItemV2[];
  cocTieu?: CocTieuItemV2[];
  ranhDoc?: RanhDocItemV2[];
  congNgang?: CongNgangItemV2[];
  tieuPhanQuang?: TieuPhanQuangItemV2[];
  guongCauLoi?: GuongCauLoiItemV2[];
}

// =====================================================================
// Metadata 9 loại — dùng cho UI tab + Excel sheet name
// =====================================================================

export type AtgtItemKind =
  | 'bienBao' | 'vachSon' | 'denTinHieu' | 'hoLanMem'
  | 'cocTieu' | 'ranhDoc' | 'congNgang' | 'tieuPhanQuang' | 'guongCauLoi';

export interface AtgtKindMeta {
  id: AtgtItemKind;
  /** Tên hiển thị tiếng Việt */
  label: string;
  /** Tên sheet trong Excel database */
  sheetName: string;
  /** Tên category trong Firestore Database (Loại tài sản) — để filter dropdown */
  databaseCategory: string;
  /** Icon emoji */
  icon: string;
  /** Có LT cuối không (true = range item, false = point item) */
  hasStationEnd: boolean;
  /** Có rải đều block không (CocTieu / TieuPhanQuang) */
  isSpreadBlock: boolean;
  /** Có vẽ linetype không (VachSon / HoLanMem / RanhDoc) */
  isLinetype: boolean;
}

export const ATGT_KINDS: AtgtKindMeta[] = [
  { id: 'bienBao',       label: 'Biển báo',        sheetName: 'BienBao',       databaseCategory: 'Biển báo',        icon: '🛑', hasStationEnd: false, isSpreadBlock: false, isLinetype: false },
  { id: 'vachSon',       label: 'Vạch sơn',        sheetName: 'VachSon',       databaseCategory: 'Vạch sơn',        icon: '🟨', hasStationEnd: true,  isSpreadBlock: false, isLinetype: true  },
  { id: 'denTinHieu',    label: 'Đèn tín hiệu',    sheetName: 'DenTinHieu',    databaseCategory: 'Đèn tín hiệu',    icon: '🚦', hasStationEnd: false, isSpreadBlock: false, isLinetype: false },
  { id: 'hoLanMem',      label: 'Hộ lan mềm',      sheetName: 'HoLanMem',      databaseCategory: 'Hộ lan mềm',      icon: '🚧', hasStationEnd: true,  isSpreadBlock: false, isLinetype: true  },
  { id: 'cocTieu',       label: 'Cọc tiêu',        sheetName: 'CocTieu',       databaseCategory: 'Cọc tiêu',        icon: '📍', hasStationEnd: true,  isSpreadBlock: true,  isLinetype: false },
  { id: 'ranhDoc',       label: 'Rãnh dọc',        sheetName: 'RanhDoc',       databaseCategory: 'Rãnh dọc',        icon: '🟦', hasStationEnd: true,  isSpreadBlock: false, isLinetype: true  },
  { id: 'congNgang',     label: 'Cống ngang',      sheetName: 'CongNgang',     databaseCategory: 'Cống ngang',      icon: '⬛', hasStationEnd: false, isSpreadBlock: false, isLinetype: false },
  { id: 'tieuPhanQuang', label: 'Tiêu phản quang', sheetName: 'TieuPhanQuang', databaseCategory: 'Tiêu phản quang', icon: '✨', hasStationEnd: true,  isSpreadBlock: true,  isLinetype: false },
  { id: 'guongCauLoi',   label: 'Gương cầu lồi',   sheetName: 'GuongCauLoi',   databaseCategory: 'Gương cầu lồi',   icon: '🪞', hasStationEnd: false, isSpreadBlock: false, isLinetype: false },
];

export function getKindMeta(id: AtgtItemKind): AtgtKindMeta {
  return ATGT_KINDS.find((k) => k.id === id) ?? ATGT_KINDS[0]!;
}

export function newAtgtItemId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.floor(Math.random() * 1000).toString(36)}`;
}
