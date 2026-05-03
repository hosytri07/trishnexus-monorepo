/**
 * TrishDesign Phase 28.5 — Module ATGT (An Toàn Giao Thông).
 *
 * Data model 9 loại đối tượng theo QCVN 41:2019/BGTVT + TCVN:
 *   - Biển báo (cấm/nguy hiểm/hiệu lệnh/chỉ dẫn/phụ)
 *   - Vạch sơn mặt đường (dọc/ngang)
 *   - Đèn tín hiệu giao thông
 *   - Hộ lan / gờ giảm tốc / chống lóa
 *   - Cọc tiêu
 *   - Rãnh dọc
 *   - Cống ngang
 *   - Tiêu phản quang dẫn hướng
 *   - Gương cầu lồi
 *
 * Pattern: 1 AtgtProject = nhiều AtgtSegment, mỗi segment chứa items theo lý trình.
 * Sync với HHMĐ (RoadSegment) để 2 panel có thể dùng chung 1 đoạn đường.
 */

// =====================================================================
// Categories — 9 loại đối tượng
// =====================================================================

export type AtgtCategory =
  | 'BIENBAO'      // Biển báo (cấm/nguy hiểm/hiệu lệnh/chỉ dẫn/phụ)
  | 'VACHSON'      // Vạch sơn (dọc/ngang/qua đường)
  | 'DENTH'        // Đèn tín hiệu
  | 'HOLAN'        // Hộ lan / gờ giảm tốc / chống lóa
  | 'COCTIEU'      // Cọc tiêu
  | 'RANHDOC'      // Rãnh dọc
  | 'CONGNGANG'    // Cống ngang
  | 'TIEUPQ'       // Tiêu phản quang dẫn hướng
  | 'GUONGCAU';    // Gương cầu lồi

export const ATGT_CATEGORIES: { id: AtgtCategory; name: string; icon: string; color: number }[] = [
  { id: 'BIENBAO',   name: 'Biển báo',                icon: '🛑', color: 1 },  // Red
  { id: 'VACHSON',   name: 'Vạch sơn',                icon: '🟨', color: 2 },  // Yellow
  { id: 'DENTH',     name: 'Đèn tín hiệu',            icon: '🚦', color: 3 },  // Green
  { id: 'HOLAN',     name: 'Hộ lan / Gờ giảm tốc',   icon: '🚧', color: 4 },  // Cyan
  { id: 'COCTIEU',   name: 'Cọc tiêu',                icon: '📍', color: 5 },  // Blue
  { id: 'RANHDOC',   name: 'Rãnh dọc',                icon: '🟦', color: 6 },  // Magenta
  { id: 'CONGNGANG', name: 'Cống ngang',              icon: '⬛', color: 30 }, // Orange
  { id: 'TIEUPQ',    name: 'Tiêu phản quang',         icon: '✨', color: 7 },  // White
  { id: 'GUONGCAU',  name: 'Gương cầu lồi',           icon: '🪞', color: 8 },  // Gray
];

export function getCategoryInfo(id: AtgtCategory): { name: string; icon: string; color: number } {
  return ATGT_CATEGORIES.find((c) => c.id === id) ?? ATGT_CATEGORIES[0]!;
}

// =====================================================================
// Biển báo subtype theo QCVN 41:2019
// =====================================================================

export type BienBaoGroup = 'P' | 'W' | 'R' | 'I' | 'S';

export const BIENBAO_GROUPS: { id: BienBaoGroup; name: string; prefix: string }[] = [
  { id: 'P', name: 'Biển cấm',        prefix: 'P' },
  { id: 'W', name: 'Biển nguy hiểm',  prefix: 'W' },
  { id: 'R', name: 'Biển hiệu lệnh',  prefix: 'R' },
  { id: 'I', name: 'Biển chỉ dẫn',    prefix: 'I' },
  { id: 'S', name: 'Biển phụ',        prefix: 'S' },
];

// =====================================================================
// Side (vị trí so với tim đường) — giống HHMĐ
// =====================================================================

export type RoadSide = 'left' | 'right' | 'center';

// =====================================================================
// Item types (per category)
// =====================================================================

export interface AtgtItemBase {
  id: string;
  category: AtgtCategory;
  station: number;          // Lý trình điểm đầu (m)
  endStation?: number;      // Lý trình điểm cuối (chỉ áp dụng line-based: vạch sơn / hộ lan / rãnh dọc)
  side: RoadSide;
  cachTim: number;          // Cách tim đường (m) — offset từ polyline (Phase 28.6)
  status: 'good' | 'damaged' | 'missing' | 'new';  // Tình trạng
  note?: string;
}

export interface BienBaoItem extends AtgtItemBase {
  category: 'BIENBAO';
  group: BienBaoGroup;        // P/W/R/I/S
  code: string;               // Mã biển vd "P.103a", "W.221"
  diameter: number;           // Đường kính/cạnh (m), default 0.7
  poleHeight: number;         // Chiều cao cột (m), default 2.2
}

export interface VachSonItem extends AtgtItemBase {
  category: 'VACHSON';
  vachType: 'tim' | 'lan' | 'mep' | 'qua_duong' | 'dung_xe' | 'gianh_uu_tien';
  length: number;             // Chiều dài vạch (m)
  width: number;              // Chiều rộng vạch (m), default 0.15
  isContinuous: boolean;      // Liền (true) / đứt (false)
}

export interface DenTHItem extends AtgtItemBase {
  category: 'DENTH';
  denType: 'xe' | 'nguoi' | 'mui_ten';   // Loại đèn
  poleHeight: number;          // Chiều cao cột (m), default 4.5
  cantilever: number;          // Vươn cần (m), default 0
}

export interface HoLanItem extends AtgtItemBase {
  category: 'HOLAN';
  holanType: 'ho_lan_ton' | 'ho_lan_betong' | 'go_giam_toc' | 'chong_loa';
  length: number;              // Chiều dài (m)
}

export interface CocTieuItem extends AtgtItemBase {
  category: 'COCTIEU';
  spacing: number;             // Khoảng cách giữa cọc (m), default 5
  count: number;               // Số cọc liên tiếp
  height: number;              // Chiều cao (m), default 0.6
}

export interface RanhDocItem extends AtgtItemBase {
  category: 'RANHDOC';
  ranhType: 'dat' | 'da_xay' | 'betong' | 'nap_be' | 'tron' | 'hinh_thang';
  length: number;
  width: number;               // Chiều rộng đáy (m)
  depth: number;               // Chiều sâu (m)
}

export interface CongNgangItem extends AtgtItemBase {
  category: 'CONGNGANG';
  congType: 'tron' | 'vuong' | 'hop' | 'ban';
  diameter: number;            // Đường kính/khẩu độ (m)
  length: number;              // Chiều dài cống (m)
}

export interface TieuPQItem extends AtgtItemBase {
  category: 'TIEUPQ';
  spacing: number;             // Khoảng cách (m)
  count: number;               // Số lượng
  color: 'red' | 'yellow' | 'white';
}

export interface GuongCauItem extends AtgtItemBase {
  category: 'GUONGCAU';
  diameter: number;            // Đường kính (m), default 0.6
  poleHeight: number;          // Chiều cao cột (m), default 4
}

export type AtgtItem =
  | BienBaoItem
  | VachSonItem
  | DenTHItem
  | HoLanItem
  | CocTieuItem
  | RanhDocItem
  | CongNgangItem
  | TieuPQItem
  | GuongCauItem;

// =====================================================================
// Segment + Project
// =====================================================================

export type DrawMode = 'duoithang' | 'polyline';

export interface AtgtSegment {
  id: string;
  name: string;
  startStation: number;        // m
  endStation: number;          // m
  roadWidth: number;           // m
  drawMode?: DrawMode;         // Default 'duoithang' — duỗi thẳng auto polyline
  polylineHandle?: string;     // AutoCAD entity handle khi mode 'polyline'
  items: AtgtItem[];
}

/** Template library: mỗi loại có file DWG chứa block đặt tên theo ký hiệu */
export interface AtgtTemplateLibrary {
  /** Path tới file DWG chứa block biển báo (block name = mã biển vd "P.103a") */
  bienBaoLibrary?: string;
  /** Path tới file DWG chứa block đèn TH */
  denTHLibrary?: string;
  /** Path tới file DWG chứa block cọc tiêu */
  cocTieuLibrary?: string;
  /** Path tới file DWG chứa block cống ngang */
  congNgangLibrary?: string;
  /** Path tới file DWG chứa block tiêu phản quang */
  tieuPQLibrary?: string;
  /** Path tới file DWG chứa block gương cầu lồi */
  guongCauLibrary?: string;
  /** Path tới file DWG chứa các nét vạch sơn (1.1, 1.2, 1.3, ...) */
  vachSonLibrary?: string;
  /** Path tới file DWG chứa nét hộ lan tôn sóng */
  hoLanLibrary?: string;
  /** Path tới file DWG chứa nét rãnh dọc */
  ranhDocLibrary?: string;
}

export interface AtgtProject {
  id: string;
  name: string;
  designUnit?: string;
  surveyDate?: string;
  templates?: AtgtTemplateLibrary;   // Phase 28.6: thư viện block/nét
  segments: AtgtSegment[];
  createdAt: number;
  updatedAt: number;
}

export interface AtgtDb {
  version: number;
  projects: AtgtProject[];
  activeProjectId: string | null;
  updatedAt: number;
}

// =====================================================================
// Defaults + helpers
// =====================================================================

export function emptyAtgtDb(): AtgtDb {
  return {
    version: 1,
    projects: [],
    activeProjectId: null,
    updatedAt: Date.now(),
  };
}

export function newAtgtId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.floor(Math.random() * 1000).toString(36)}`;
}

export function defaultAtgtSegment(): Omit<AtgtSegment, 'id'> {
  return {
    name: 'Đoạn 1',
    startStation: 0,
    endStation: 1000,
    roadWidth: 7,
    items: [],
  };
}

/** Factory: tạo AtgtItem mặc định cho 1 category */
export function defaultAtgtItem(category: AtgtCategory, station: number = 0): AtgtItem {
  const base = {
    id: newAtgtId('item'),
    category,
    station,
    side: 'right' as RoadSide,
    cachTim: 1.5,  // mặc định cách tim 1.5m
    status: 'good' as const,
    note: '',
  };
  switch (category) {
    case 'BIENBAO':
      return { ...base, category: 'BIENBAO', group: 'P', code: 'P.103a', diameter: 0.7, poleHeight: 2.2 };
    case 'VACHSON':
      return { ...base, category: 'VACHSON', vachType: 'tim', length: 50, width: 0.15, isContinuous: false };
    case 'DENTH':
      return { ...base, category: 'DENTH', denType: 'xe', poleHeight: 4.5, cantilever: 0 };
    case 'HOLAN':
      return { ...base, category: 'HOLAN', holanType: 'ho_lan_ton', length: 50 };
    case 'COCTIEU':
      return { ...base, category: 'COCTIEU', spacing: 5, count: 10, height: 0.6 };
    case 'RANHDOC':
      return { ...base, category: 'RANHDOC', ranhType: 'da_xay', length: 100, width: 0.4, depth: 0.4 };
    case 'CONGNGANG':
      return { ...base, category: 'CONGNGANG', congType: 'tron', diameter: 1.0, length: 8 };
    case 'TIEUPQ':
      return { ...base, category: 'TIEUPQ', spacing: 10, count: 10, color: 'yellow' };
    case 'GUONGCAU':
      return { ...base, category: 'GUONGCAU', diameter: 0.6, poleHeight: 4 };
  }
}

export function formatStationKm(m: number): string {
  const km = Math.floor(m / 1000);
  const rest = m - km * 1000;
  return `Km${km}+${rest.toString().padStart(3, '0')}`;
}

/** Tên đoạn auto từ start/end */
export function autoAtgtSegmentName(start: number, end: number): string {
  return `${formatStationKm(start)} - ${formatStationKm(end)}`;
}

export function sideLabel(side: RoadSide): string {
  if (side === 'left') return 'Trái (T)';
  if (side === 'right') return 'Phải (P)';
  return 'Tim';
}

export function statusLabel(s: AtgtItemBase['status']): string {
  return { good: 'Tốt', damaged: 'Hư hỏng', missing: 'Mất', new: 'Mới' }[s];
}
