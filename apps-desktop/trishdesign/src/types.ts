/**
 * TrishDesign — Phase 28.1 — Domain types.
 *
 * Multi-project pattern (giống TrishFinance multi-property):
 *   DesignDb {
 *     projects: Project[]                 // Hồ sơ (1 hồ sơ = 1 dự án/công trình)
 *     activeProjectId: string | null
 *     damageCodes: DamageCode[]           // Danh mục mã hư hỏng (cấu hình toàn cục)
 *     roadTemplates: RoadTemplate[]       // Template khuôn đường (preset)
 *     drawingPrefs: DrawingPrefs          // Tỷ lệ X:Y, layer naming, font...
 *   }
 *
 * Mỗi Project chứa nhiều RoadSegment (đoạn đường), mỗi đoạn có:
 *   - Khuôn đường (loại, bề rộng, số làn, DPC...)
 *   - Cọc H (manual hoặc auto 100m)
 *   - DamagePiece[] (miếng hư hỏng — hình chữ nhật + lý trình + vị trí + mã)
 *   - Drawing settings (khung A3 hoặc A4 bão lũ, scale)
 */

// ============================================================
// Project (Hồ sơ)
// ============================================================
export interface Project {
  id: string;
  name: string;             // VD: "Khảo sát hư hỏng QL14B năm 2026"
  code?: string;            // Mã dự án nội bộ
  client?: string;          // Chủ đầu tư / Đơn vị quản lý
  designUnit?: string;      // Đơn vị thiết kế / khảo sát
  surveyDate?: string;      // Ngày khảo sát (ISO yyyy-mm-dd)
  surveyor?: string;        // Người khảo sát
  notes?: string;
  createdAt: number;
  updatedAt: number;
  segments: RoadSegment[];
}

// ============================================================
// RoadSegment (Đoạn đường)
// ============================================================
export type RoadType = 'single' | 'dual';   // Đường đơn / đường đôi (có DPC)

export interface RoadSegment {
  id: string;
  projectId: string;
  /** Tên đoạn (auto-sinh "Km0 - Km1" hoặc user nhập) */
  name: string;
  /** Lý trình bắt đầu — milimet (=1mm AutoCAD unit). 0 = Km0+0, 1000 = Km0+1 (=1m). Lưu BY METERS để dễ. */
  startStation: number;     // mét (0 = Km0)
  /** Lý trình kết thúc — mét */
  endStation: number;
  /** Loại đường */
  roadType: RoadType;
  /** Bề rộng tổng mặt đường (mét) */
  roadWidth: number;
  /** TỔNG số làn xe cả 2 chiều. Lane width = (roadWidth - medianWidth) / laneCount cho dual, roadWidth / laneCount cho single. */
  laneCount: number;
  /** Bề rộng dải phân cách (mét) — chỉ dùng nếu dual */
  medianWidth?: number;
  /** Cách nhập số liệu vị trí miếng: 'tim' (cách tim) hoặc 'mep' (cách mép đường) */
  cachTimMode?: 'tim' | 'mep';
  /** Cọc H — nếu rỗng → auto-sinh mỗi 100m khi vẽ */
  stakes: RoadStake[];
  /** Miếng hư hỏng */
  damagePieces: DamagePiece[];
  /** Drawing layout settings */
  drawing: DrawingSettings;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface RoadStake {
  id: string;
  /** Tên cọc: "H1", "H2", "H3"... */
  label: string;
  /** Lý trình theo mét tính từ Km0 */
  station: number;
}

// ============================================================
// DamagePiece (Miếng hư hỏng)
// ============================================================
export type DamageSide = 'left' | 'right' | 'center';

export interface DamagePiece {
  id: string;
  segmentId: string;
  /** Số miếng — user nhập tay (1, 2, 2A, 3B, 4...). Không auto-increment. */
  pieceNumber: string;
  /** Lý trình đầu — vị trí đầu miếng tính theo mét từ đầu đoạn */
  startStation: number;
  /** Vị trí: trái/phải/tim đường */
  side: DamageSide;
  /** Khoảng cách từ tim (hoặc mép, theo cachTimMode của segment) — mét */
  cachTim?: number;
  /** Bề rộng miếng (mét) */
  width: number;
  /** Chiều dài miếng (mét, theo trục đường) */
  length: number;
  /** Mã hư hỏng — reference tới DamageCode.code */
  damageCode: number;
  notes?: string;
}

// ============================================================
// DamageCode (Mã hư hỏng — global config)
// ============================================================
export interface DamageCode {
  /** Mã số (1, 2, 3...) — natural number */
  code: number;
  /** Tên đầy đủ: "Nứt rạn mai rùa nhẹ" */
  name: string;
  /** Mã vẽ (ký hiệu ngắn): L, M, H, BT, SL, LV<2.5, LV>2.5, LL, LT, OG7, OG13... */
  maVe: string;
  /** AutoCAD hatch pattern name (ANSI31, EARTH, AR-CONC, NET, GRATE, STARS, CORK, HONEY, FLEX, GRAVEL...) */
  hatchPattern: string;
  /** Hatch scale (default 1.0) */
  hatchScale: number;
  /** Hatch angle (degrees, default 0) */
  hatchAngle: number;
  /** Color index AutoCAD (1=red, 2=yellow, 3=green, 4=cyan, 5=blue, 6=magenta, 7=white/black, 30=orange...) */
  colorIndex: number;
  /** Layer name AutoCAD — auto: HH_<code> (HH_1, HH_2...) */
  layerName: string;
}

// ============================================================
// RoadTemplate (preset khuôn đường)
// ============================================================
export interface RoadTemplate {
  id: string;
  name: string;             // VD: "QL 2 làn 7m", "Đô thị 4 làn 14m + DPC 2m"
  roadType: RoadType;
  roadWidth: number;
  laneCount: number;
  medianWidth?: number;
}

// ============================================================
// DrawingSettings (per segment)
// ============================================================
export type FrameType = 'A3_390x280' | 'A4_270x195_baolut';

export interface DrawingSettings {
  /** Frame type — A3 thường, A4 cho hồ sơ bão lũ */
  frameType: FrameType;
  /** Tỷ lệ vẽ trục X (default 1:1) — nghĩa: 1m thực = scaleX đơn vị bản vẽ */
  scaleX: number;
  /** Tỷ lệ vẽ trục Y (default 1:1) */
  scaleY: number;
  /** Bão lũ mode: layout 500m trên + 500m dưới mỗi tờ A4 */
  baoLutMode: boolean;
}

// ============================================================
// Layer config — user chỉnh tên + màu của các layer chuẩn AutoCAD
// ============================================================
export type StandardLayerKey =
  | 'KHUNG' | 'KHUONDUONG' | 'TIM' | 'COCH'
  | 'MIENG' | 'TEXT' | 'KICHTHUOC' | 'VACHLAN' | 'THONGKE';

/** Các linetype AutoCAD chuẩn (load từ acad.lin) */
export const LINETYPE_OPTIONS = [
  'CONTINUOUS', 'DASHED', 'DASHED2', 'DASHEDX2',
  'CENTER', 'CENTER2', 'CENTERX2',
  'HIDDEN', 'HIDDEN2', 'HIDDENX2',
  'DASHDOT', 'DASHDOT2', 'DASHDOTX2',
  'DOT', 'DOT2', 'DOTX2',
  'BORDER', 'BORDER2', 'BORDERX2',
  'DIVIDE', 'DIVIDE2', 'DIVIDEX2',
  'PHANTOM', 'PHANTOM2', 'PHANTOMX2',
  'TRACKS', 'BATTING',
  'GAS_LINE', 'HOT_WATER_SUPPLY', 'FENCELINE1', 'FENCELINE2',
] as const;
export type LinetypeName = typeof LINETYPE_OPTIONS[number];

export interface LayerSpec {
  /** Tên layer trong AutoCAD (user có thể đổi) */
  name: string;
  /** Color index AutoCAD 1-255 */
  color: number;
  /** Linetype name (xem LINETYPE_OPTIONS) */
  linetype?: LinetypeName;
  /** Mô tả (cho UI) — không gửi vào AutoCAD */
  description?: string;
}

export const STANDARD_LAYERS: { key: StandardLayerKey; description: string; default: LayerSpec }[] = [
  { key: 'KHUNG',       description: 'Khung bản vẽ A3/A4 + bảng tên',      default: { name: 'KHUNG', color: 7, linetype: 'CONTINUOUS' } },
  { key: 'KHUONDUONG',  description: 'Mép đường (mép trên/dưới + 2 đầu)',  default: { name: 'KHUONDUONG', color: 3, linetype: 'CONTINUOUS' } },
  { key: 'TIM',         description: 'Tim đường + DPC tim (yellow dashed)', default: { name: 'TIM', color: 2, linetype: 'DASHED' } },
  { key: 'COCH',        description: 'Cọc H tick mark + label',             default: { name: 'COCH', color: 5, linetype: 'CONTINUOUS' } },
  { key: 'MIENG',       description: 'Border miếng hư hỏng',                default: { name: 'MIENG', color: 4, linetype: 'CONTINUOUS' } },
  { key: 'TEXT',        description: 'Text label miếng + lý trình',         default: { name: 'TEXT', color: 3, linetype: 'CONTINUOUS' } },
  { key: 'KICHTHUOC',   description: 'Kích thước L=, W= của miếng',         default: { name: 'KICHTHUOC', color: 4, linetype: 'CONTINUOUS' } },
  { key: 'VACHLAN',     description: 'Vạch chia làn xe (white dashed)',     default: { name: 'VACHLAN', color: 7, linetype: 'DASHED' } },
  { key: 'THONGKE',     description: 'Bảng thống kê hư hỏng',               default: { name: 'THONGKE', color: 6, linetype: 'CONTINUOUS' } },
];

export function defaultLayers(): Record<StandardLayerKey, LayerSpec> {
  const obj = {} as Record<StandardLayerKey, LayerSpec>;
  for (const l of STANDARD_LAYERS) obj[l.key] = { ...l.default };
  return obj;
}

// ============================================================
// DrawingPrefs (global config)
// ============================================================
export interface DrawingPrefs {
  /** Default scale ratio cho project mới */
  defaultScaleX: number;
  defaultScaleY: number;
  /** Auto-sinh cọc H mỗi N mét khi không nhập */
  autoStakeInterval: number;      // default 100
  /** Style text annotation — height (mét) trên bản vẽ */
  dimTextHeight: number;          // default 0.3
  stationTextHeight: number;      // default 0.4
  pieceLabelTextHeight: number;   // default 0.35
  /** Tên text style trong AutoCAD — sẽ tạo nếu chưa có */
  textStyleName: string;          // default "TEXT_HH"
  /** Font .shx hoặc .ttf — VD romans.shx, arial.ttf */
  textStyleFont: string;          // default "romans.shx"
  /** Width factor */
  textStyleWidth: number;         // default 0.7
  /** Loại font: 'shx' (8 prompts) hoặc 'ttf' (7 prompts, không có vertical) */
  textStyleType: 'shx' | 'ttf';  // default 'shx'
  /** Layer config — user chỉnh tên + màu các layer chuẩn */
  layers: Record<StandardLayerKey, LayerSpec>;
}

// ============================================================
// Frame size constants (đã trừ margin in, scale 0.2 để phù hợp với scale X=0.2 default)
// Khung A3 thực = 78×56 đơn vị (= 0.2 × 390×280mm)
// Khung A4 bão lũ = 54×39 đơn vị (= 0.2 × 270×195mm)
// ============================================================
export const FRAME_A3 = { width: 78, height: 56 };
export const FRAME_A4_BAOLUT = { width: 54, height: 39 };

// Default scale theo loại khung
export const DEFAULT_SCALE_A3 = { scaleX: 0.2, scaleY: 1 };       // Tỉ lệ 1:5
export const DEFAULT_SCALE_A4 = { scaleX: 0.1, scaleY: 1 };       // Tỉ lệ 1:10

// ============================================================
// Database root (Firestore /design_database/{uid})
// ============================================================
export interface DesignDb {
  version: number;          // schema version (=1 hiện tại)
  projects: Project[];
  activeProjectId: string | null;
  damageCodes: DamageCode[];
  roadTemplates: RoadTemplate[];
  drawingPrefs: DrawingPrefs;
  updatedAt: number;
}

// ============================================================
// Helpers
// ============================================================
export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function emptyDb(): DesignDb {
  return {
    version: 1,
    projects: [],
    activeProjectId: null,
    damageCodes: defaultDamageCodes(),
    roadTemplates: defaultRoadTemplates(),
    drawingPrefs: defaultDrawingPrefs(),
    updatedAt: Date.now(),
  };
}

// ============================================================
// Defaults — 10 mã hư hỏng theo TCVN + AutoCAD hatch pattern
// (Trí cấp danh sách 2026-05-01)
// ============================================================
export function defaultDamageCodes(): DamageCode[] {
  // 11 mã hư hỏng theo TCCS/TCVN — port từ giao diện S-RETC WPF (Hồ Sỹ Trí)
  return [
    { code: 1,  name: 'Nứt rạn mai rùa nhẹ',         maVe: 'L',       hatchPattern: 'NET',     hatchScale: 1.0,  hatchAngle: 0, colorIndex: 8, layerName: 'HH_1' },
    { code: 2,  name: 'Nứt rạn mai rùa vừa',         maVe: 'M',       hatchPattern: 'GRATE',   hatchScale: 1.0,  hatchAngle: 0, colorIndex: 8, layerName: 'HH_2' },
    { code: 3,  name: 'Nứt rạn mai rùa nặng',        maVe: 'H',       hatchPattern: 'STARS',   hatchScale: 1.0,  hatchAngle: 0, colorIndex: 8, layerName: 'HH_3' },
    { code: 4,  name: 'Bong tróc',                   maVe: 'BT',      hatchPattern: 'DOTS',    hatchScale: 0.5,  hatchAngle: 0, colorIndex: 8, layerName: 'HH_4' },
    { code: 5,  name: 'Sình lún',                    maVe: 'SL',      hatchPattern: 'EARTH',   hatchScale: 0.3,  hatchAngle: 0, colorIndex: 8, layerName: 'HH_5' },
    { code: 6,  name: 'Lún vệt bánh xe <2.5cm',      maVe: 'LV<2.5',  hatchPattern: 'ANSI37',  hatchScale: 0.5,  hatchAngle: 0, colorIndex: 8, layerName: 'HH_6' },
    { code: 7,  name: 'Lún vệt bánh xe >2.5cm',      maVe: 'LV>2.5',  hatchPattern: 'CORK',    hatchScale: 1.0,  hatchAngle: 0, colorIndex: 8, layerName: 'HH_7' },
    { code: 8,  name: 'Lún lõm',                     maVe: 'LL',      hatchPattern: 'HONEY',   hatchScale: 0.5,  hatchAngle: 0, colorIndex: 8, layerName: 'HH_8' },
    { code: 9,  name: 'Lún trồi',                    maVe: 'LT',      hatchPattern: 'FLEX',    hatchScale: 1.0,  hatchAngle: 0, colorIndex: 8, layerName: 'HH_9' },
    { code: 10, name: 'Ổ gà sâu 7cm',                maVe: 'OG7',     hatchPattern: 'AR-CONC', hatchScale: 0.3,  hatchAngle: 0, colorIndex: 8, layerName: 'HH_10' },
    { code: 11, name: 'Ổ gà sâu 13cm',               maVe: 'OG13',    hatchPattern: 'GRAVEL',  hatchScale: 0.3,  hatchAngle: 0, colorIndex: 8, layerName: 'HH_11' },
  ];
}

export function defaultRoadTemplates(): RoadTemplate[] {
  return [
    { id: 'tpl_ql_2lane_7m',     name: 'QL 2 làn 7m (3.5m/làn)',           roadType: 'single', roadWidth: 7,  laneCount: 2 },
    { id: 'tpl_ql_2lane_8m',     name: 'QL 2 làn 8m (4m/làn)',             roadType: 'single', roadWidth: 8,  laneCount: 2 },
    { id: 'tpl_dt_4lane_14m',    name: 'Đô thị 4 làn 14m (3.5m/làn)',      roadType: 'single', roadWidth: 14, laneCount: 4 },
    { id: 'tpl_dt_dual_14m_dpc2', name: 'Đô thị đôi 14m + DPC 2m',         roadType: 'dual',   roadWidth: 14, laneCount: 2, medianWidth: 2 },
    { id: 'tpl_caotoc_dual_22m', name: 'Cao tốc đôi 22m + DPC 4m',         roadType: 'dual',   roadWidth: 22, laneCount: 3, medianWidth: 4 },
  ];
}

export function defaultDrawingPrefs(): DrawingPrefs {
  return {
    defaultScaleX: 1,
    defaultScaleY: 1,
    autoStakeInterval: 100,
    dimTextHeight: 0.3,
    stationTextHeight: 0.4,
    pieceLabelTextHeight: 0.35,
    textStyleName: 'TEXT_HH',
    textStyleFont: 'arial.ttf',     // Universal Windows font, support Vietnamese
    textStyleWidth: 0.7,
    textStyleType: 'ttf',
    layers: defaultLayers(),
  };
}

// ============================================================
// Format station "Km0+100" từ mét
// ============================================================
export function formatStation(meters: number): string {
  const km = Math.floor(meters / 1000);
  const offset = Math.round(meters - km * 1000);
  return `Km${km}+${offset.toString().padStart(3, '0')}`;
}

/** Tên đoạn auto-sinh từ start/end station: "Km0 - Km1" hoặc "Km1+200 - Km2+500" */
export function autoSegmentName(startMeters: number, endMeters: number): string {
  const startKm = startMeters / 1000;
  const endKm = endMeters / 1000;
  // Nếu cả 2 chia hết km → ngắn gọn "Km0 - Km1"
  if (startMeters % 1000 === 0 && endMeters % 1000 === 0) {
    return `Km${startKm} - Km${endKm}`;
  }
  return `${formatStation(startMeters)} - ${formatStation(endMeters)}`;
}
