/**
 * TrishDesign Phase 28.6 — ATGT AutoCAD command generator V2.
 *
 * Workflow:
 *   - Mode "duỗi thẳng": app vẽ polyline tim đường ngang trục X
 *   - Mode "polyline": user pick polyline có sẵn trong AutoCAD (Phase sau wire qua LSP)
 *
 * Block-based items (biển báo / đèn / cọc tiêu / cống / tiêu PQ / gương cầu):
 *   - INSERT block từ thư viện template (block name = mã/code)
 *   - Leader 1: lý trình (vd "Km0+520")
 *   - Leader 2: hiện trạng (Tốt/Hư hỏng/Mất/Mới)
 *   - Cống ngang có thêm leader 3: loại cống
 *
 * Line-based items (vạch sơn / hộ lan / rãnh dọc):
 *   - Polyline đường (theo length + offset cách tim)
 *   - Leader đầu: lý trình bắt đầu
 *   - Leader cuối: lý trình kết thúc
 *   - Leader giữa: hiện trạng
 */

import {
  type AtgtProject,
  type AtgtSegment,
  type AtgtItem,
  type BienBaoItem,
  type VachSonItem,
  type DenTHItem,
  type HoLanItem,
  type CocTieuItem,
  type RanhDocItem,
  type CongNgangItem,
  type TieuPQItem,
  type GuongCauItem,
  ATGT_CATEGORIES,
  formatStationKm,
  statusLabel,
} from './atgt-types.js';
import { polylineLengths, blockPositionOnPolyline, pointAtStation, type Vec2 } from './polyline-curve.js';

/** Phase 43 wave 16.3 — Hàm map (station, offset từ tim) → "x,y" AutoCAD. */
type PosXYFn = (stationM: number, offsetFromCenterM: number) => string;

/**
 * Phase 42 — Helper: chỉ tạo leader khi item có nội dung Hiện trạng (notes) hoặc status khác 'good'.
 * Trả về text hiển thị trên leader, hoặc null nếu KHÔNG cần leader.
 */
export function leaderTextFor(item: { status: string; note?: string }): string | null {
  const n = (item.note ?? '').trim();
  if (n.length > 0) return n;          // ưu tiên text Trí nhập tay
  if (item.status === 'good') return null;  // tốt → không cần leader
  // các trạng thái khác hiển thị label mặc định
  const m: Record<string, string> = {
    damaged: 'Hư hỏng', missing: 'Mất', new: 'Mới',
  };
  return m[item.status] ?? null;
}

const SCALE_X = 0.1;     // 1m lý trình → 0.1 đv vẽ
const SCALE_Y = 1.0;     // 1m ngang → 1 đv


/**
 * Phase 42 — Generate AutoCAD _-INSERT command cho 1 ATGT item.
 *
 * Tên block = item.code (vd "GC.31a" → file "GC.31a.dwg")
 * Path = trishdesign:atgt-blocks-folder localStorage (admin/user set trong Settings)
 *
 * Cấu trúc command:
 *   _-INSERT  <path>\<code>.dwg  <x>,<y>  1 1 0
 *
 * Biển báo: thêm attribute STATION = lý trình "Km1+500" (block .dwg phải có attdef STATION).
 *
 * Trả về [] nếu chưa setup folder hoặc thiếu code.
 */
/**
 * Phase 42 — Lấy default folder block ATGT.
 *   1. User config qua Settings → localStorage 'trishdesign:atgt-blocks-folder'
 *   2. Fallback: %APPDATA%\\vn.trishteam.design\\blocks\\ATGT (cài kèm hoặc tự tải về)
 */
export function getAtgtBlocksFolder(): string {
  if (typeof window === 'undefined') return '';
  const cfg = (window.localStorage.getItem('trishdesign:atgt-blocks-folder') ?? '').trim();
  if (cfg) return cfg;
  // Fallback APPDATA default (Windows)
  const appdata = (window as { __APPDATA__?: string }).__APPDATA__;
  if (appdata) return `${appdata}\\vn.trishteam.design\\blocks\\ATGT`;
  return '';
}

export function generateBlockInsertCmd(opts: {
  code: string;
  x: number;
  y: number;
  rotation?: number;
  scale?: number;
  attributes?: Record<string, string>;
}): string[] {
  if (typeof window === 'undefined') return [];
  const folder = getAtgtBlocksFolder();
  if (!folder || !opts.code) return [];
  const sep = folder.endsWith('\\') || folder.endsWith('/') ? '' : '\\';
  const blockPath = `${folder}${sep}${opts.code}.dwg`;
  const scale = opts.scale ?? 1;
  const rot = opts.rotation ?? 0;
  const cmds: string[] = [];
  // _-INSERT prompt: name → insertion point → x scale → y scale → rotation → [attribute prompts...]
  let cmd = `._-INSERT\n${blockPath}\n${opts.x},${opts.y}\n${scale}\n${scale}\n${rot}\n`;
  // Attribute values (nếu có): AutoCAD prompt từng attribute theo thứ tự định nghĩa trong block
  if (opts.attributes) {
    for (const v of Object.values(opts.attributes)) {
      cmd += `${v}\n`;
    }
  }
  cmds.push(cmd);
  return cmds;
}

/**
 * Phase 42 — Chèn block biển báo + block ghi chú lý trình GHICHUBIENBAO.
 *
 * GHICHUBIENBAO là block Trí cấp sẵn, có 1 attribute:
 *   - Tag: KM, Value: "KM1824+555"
 *
 * Workflow trong AutoCAD:
 *   1. _-INSERT <folder>/<bienBaoCode>.dwg <x>,<y> 1 1 0
 *   2. _-INSERT GHICHUBIENBAO <x>,<y+offsetY> 1 1 0 "KM1824+555"
 *
 * Yêu cầu: folder block ATGT phải có file GHICHUBIENBAO.dwg
 */
export function insertBienBaoWithStation(opts: {
  bienBaoCode: string;          // VD "GC.31a"
  x: number;
  y: number;                    // Tâm biển báo
  stationLabel: string;         // VD "KM1824+555"
  rotation?: number;
  offsetYGhiChu?: number;       // Y offset cho block GHICHUBIENBAO, default 1.5m
}): string[] {
  const cmds: string[] = [];
  const folder = getAtgtBlocksFolder();
  if (!folder) return cmds;
  const sep = folder.endsWith('\\') || folder.endsWith('/') ? '' : '\\';

  // 1. Insert biển báo block
  const bienBaoPath = `${folder}${sep}${opts.bienBaoCode}.dwg`;
  cmds.push(`._-INSERT\n${bienBaoPath}\n${opts.x},${opts.y}\n1\n1\n${opts.rotation ?? 0}\n`);

  // 2. Insert GHICHUBIENBAO với attribute KM
  const offsetY = opts.offsetYGhiChu ?? 1.5;
  const ghiChuPath = `${folder}${sep}GHICHUBIENBAO.dwg`;
  // _-INSERT prompts: name → point → x → y → rotation → attribute KM
  cmds.push(`._-INSERT\n${ghiChuPath}\n${opts.x},${opts.y + offsetY}\n1\n1\n0\n${opts.stationLabel}\n`);

  return cmds;
}


export function generateAtgtCommands(project: AtgtProject): string[] {
  const cmds: string[] = [];
  cmds.push(...setupCommands(project));
  let originY = 0;
  for (const seg of project.segments) {
    cmds.push(...segmentCommands(seg, project, originY));
    originY -= 30;
  }
  cmds.push(...cleanupCommands());
  return cmds;
}

function setupCommands(project: AtgtProject): string[] {
  const cmds: string[] = [];
  cmds.push('._FILEDIA\n0\n');
  cmds.push('._CMDDIA\n0\n');
  cmds.push('._-COLOR\nBYLAYER\n');
  cmds.push('._-STYLE\nATGT_TEXT\narial.ttf\n0\n0.7\n0\nN\nN\n');

  // Layer per category
  for (const cat of ATGT_CATEGORIES) {
    cmds.push(`._-LAYER\nM\nATGT_${cat.id}\nC\n${cat.color}\nATGT_${cat.id}\n\n`);
  }
  cmds.push('._-LAYER\nM\nATGT_DUONG\nC\n7\nATGT_DUONG\n\n');
  cmds.push('._-LAYER\nM\nATGT_TEXT\nC\n7\nATGT_TEXT\n\n');
  cmds.push('._-LAYER\nM\nATGT_LEADER\nC\n8\nATGT_LEADER\n\n');

  // Insert template libraries (XATTACH/INSERT blocks once)
  const templates = project.templates;
  if (templates) {
    for (const [_, path] of Object.entries(templates)) {
      if (!path) continue;
      // Insert library với scale 0 (chỉ define block, không vẽ entities) — dùng INSERT name=path
      // Để đơn giản, app sẽ xáo defined block khi user dùng từng item
    }
  }
  return cmds;
}

function cleanupCommands(): string[] {
  return [
    '\n\n\n',
    '._ZOOM\nE\n',
    '._FILEDIA\n1\n',
    '._CMDDIA\n1\n',
    '\n\n',
  ];
}

function segmentCommands(seg: AtgtSegment, project: AtgtProject, originY: number): string[] {
  const cmds: string[] = [];
  const halfW = seg.roadWidth / 2;
  const mode = seg.drawMode ?? 'duoithang';
  const hasPolyline = mode === 'polyline'
    && Array.isArray(seg.polylineVertices)
    && seg.polylineVertices.length >= 2;

  // X, Y giữ cho backward compat (chỉ dùng straight mode + leader offset global)
  const X = (m: number) => ((m - seg.startStation) * SCALE_X).toFixed(3);
  const Y = (m: number) => (m * SCALE_Y + originY).toFixed(3);

  // Phase 43 wave 16.3 — posXY: map (station, offset cách tim) → "x,y" AutoCAD theo mode
  let posXY: PosXYFn;
  if (hasPolyline) {
    const vertices = seg.polylineVertices as Array<[number, number]>;
    const precomp = polylineLengths(vertices as Vec2[]);
    // Station trong polyline tính từ điểm đầu (= startStation lý trình)
    posXY = (stationM, offsetM) => {
      const sLocal = stationM - seg.startStation;
      const p = blockPositionOnPolyline(vertices as Vec2[], sLocal, offsetM, precomp);
      return `${p.x.toFixed(3)},${p.y.toFixed(3)}`;
    };
  } else {
    posXY = (stationM, offsetM) => `${X(stationM)},${Y(offsetM)}`;
  }

  // Vẽ trục tuyến: mode duỗi thẳng → vẽ tim + 2 mép; mode polyline → user đã có polyline, chỉ vẽ 2 mép offset
  if (!hasPolyline) {
    cmds.push(`._-LAYER\nS\nATGT_DUONG\n\n`);
    cmds.push(`._LINE ${posXY(seg.startStation, 0)} ${posXY(seg.endStation, 0)} `);
    cmds.push(`._LINE ${posXY(seg.startStation, halfW)} ${posXY(seg.endStation, halfW)} `);
    cmds.push(`._LINE ${posXY(seg.startStation, -halfW)} ${posXY(seg.endStation, -halfW)} `);
  } else {
    cmds.push(`._-LAYER\nS\nATGT_DUONG\n\n`);
    // Vẽ 2 mép theo polyline: lấy điểm tại mỗi đỉnh + offset normal — kết quả là polyline offset
    const vertices = seg.polylineVertices as Array<[number, number]>;
    const precomp = polylineLengths(vertices as Vec2[]);
    const edgeLeft: Array<[number, number]> = [];
    const edgeRight: Array<[number, number]> = [];
    // Sample các đỉnh + 1 vài điểm trung gian để smooth (dùng cumLens)
    for (const sCum of precomp.cumLens) {
      const cp = pointAtStation(vertices as Vec2[], sCum, precomp);
      edgeLeft.push([cp.x + cp.normal[0] * halfW, cp.y + cp.normal[1] * halfW]);
      edgeRight.push([cp.x + cp.normal[0] * -halfW, cp.y + cp.normal[1] * -halfW]);
    }
    // Vẽ LINE cho 2 mép qua các đỉnh
    for (let i = 1; i < edgeLeft.length; i++) {
      const [x0, y0] = edgeLeft[i - 1]!;
      const [x1, y1] = edgeLeft[i]!;
      cmds.push(`._LINE ${x0.toFixed(3)},${y0.toFixed(3)} ${x1.toFixed(3)},${y1.toFixed(3)} `);
    }
    for (let i = 1; i < edgeRight.length; i++) {
      const [x0, y0] = edgeRight[i - 1]!;
      const [x1, y1] = edgeRight[i]!;
      cmds.push(`._LINE ${x0.toFixed(3)},${y0.toFixed(3)} ${x1.toFixed(3)},${y1.toFixed(3)} `);
    }
  }

  // Tên đoạn label (đặt tại điểm giữa, offset +halfW + 2 lên trên)
  cmds.push(`._-LAYER\nS\nATGT_TEXT\n\n`);
  const midStation = (seg.startStation + seg.endStation) / 2;
  cmds.push(`._-TEXT\nJ\nMC\n${posXY(midStation, halfW + 2)}\n1.2\n0\n${seg.name}\n`);

  // Vẽ từng item (X, Y giữ cho leader global offset; posXY cho đặt block + line)
  for (const item of seg.items) {
    cmds.push(...itemCommands(item, project, X, Y, halfW, posXY));
  }
  return cmds;
}

function itemCommands(
  item: AtgtItem,
  project: AtgtProject,
  X: (m: number) => string,
  Y: (m: number) => string,
  halfW: number,
  posXY: PosXYFn,
): string[] {
  switch (item.category) {
    case 'BIENBAO':   return drawBienBao(item, project, X, Y, halfW, posXY);
    case 'VACHSON':   return drawVachSon(item, project, X, Y, halfW, posXY);
    case 'DENTH':     return drawDenTH(item, project, X, Y, halfW, posXY);
    case 'HOLAN':     return drawHoLan(item, project, X, Y, halfW, posXY);
    case 'COCTIEU':   return drawCocTieu(item, project, X, Y, halfW, posXY);
    case 'RANHDOC':   return drawRanhDoc(item, project, X, Y, halfW, posXY);
    case 'CONGNGANG': return drawCongNgang(item, project, X, Y, halfW, posXY);
    case 'TIEUPQ':    return drawTieuPQ(item, project, X, Y, halfW, posXY);
    case 'GUONGCAU':  return drawGuongCau(item, project, X, Y, halfW, posXY);
  }
}

// =====================================================================
// Helpers
// =====================================================================

/** Compute Y theo cách tim đường + side */
function ySide(side: 'left' | 'right' | 'center', cachTim: number): number {
  if (side === 'left') return cachTim;
  if (side === 'right') return -cachTim;
  return 0;
}

/** Insert block từ template library, fallback symbol nếu thiếu */
function insertBlockOrFallback(
  blockName: string,
  x: string,
  y: string,
  fallback: () => string[],
): string[] {
  const cmds: string[] = [];
  // Try INSERT — nếu block chưa define, AutoCAD sẽ báo error, app fallback vẽ shape
  // Dùng `(if (tblsearch "BLOCK" "name") ...)` LISP để check, nhưng SendCommand đơn giản hóa:
  // chỉ INSERT thẳng, lỗi sẽ skip
  cmds.push(`._-INSERT\n${blockName}\n${x},${y}\n1\n1\n0\n`);
  // Fallback chỉ chạy nếu user xác nhận block không có (Phase sau check qua LSP)
  return cmds;
}

/** Vẽ leader text với offset theo direction */
function leaderText(x: string, y: string, dx: number, dy: number, height: number, text: string): string[] {
  const xEnd = (Number(x) + dx).toFixed(3);
  const yEnd = (Number(y) + dy).toFixed(3);
  return [
    `._-LAYER\nS\nATGT_LEADER\n\n`,
    `._LINE ${x},${y} ${xEnd},${yEnd} `,
    `._-LAYER\nS\nATGT_TEXT\n\n`,
    `._-TEXT\nJ\nML\n${(Number(xEnd) + 0.2).toFixed(3)},${yEnd}\n${height}\n0\n${text}\n`,
  ];
}

// =====================================================================
// Block-based items
// =====================================================================

function drawBienBao(it: BienBaoItem, _proj: AtgtProject, _X: (m: number) => string, _Y: (m: number) => string, _halfW: number, posXY: PosXYFn): string[] {
  const cmds: string[] = [];
  cmds.push(`._-LAYER\nS\nATGT_BIENBAO\n\n`);
  const offset = ySide(it.side, it.cachTim);
  const xy = posXY(it.station, offset);
  const [x, y] = xy.split(',');
  // INSERT block: tên = mã biển (vd "P.103a")
  const blockName = it.code || `BIENBAO_${it.group}`;
  cmds.push(...insertBlockOrFallback(blockName, x!, y!, () => {
    return [
      `._CIRCLE\n${xy}\n${(it.diameter / 2).toFixed(2)}\n`,
      `._-TEXT\nJ\nMC\n${xy}\n0.3\n0\n${blockName}\n`,
    ];
  }));
  cmds.push(...leaderText(x!, y!, 1.5, 1.5, 0.3, formatStationKm(it.station)));
  cmds.push(...leaderText(x!, y!, 1.5, -1.5, 0.3, statusLabel(it.status)));
  return cmds;
}

function drawDenTH(it: DenTHItem, _proj: AtgtProject, _X: (m: number) => string, _Y: (m: number) => string, _halfW: number, posXY: PosXYFn): string[] {
  const cmds: string[] = [];
  cmds.push(`._-LAYER\nS\nATGT_DENTH\n\n`);
  const xy = posXY(it.station, ySide(it.side, it.cachTim));
  const [x, y] = xy.split(',');
  const blockName = `DENTH_${it.denType}`;
  cmds.push(...insertBlockOrFallback(blockName, x!, y!, () => [
    `._RECTANG\n${(Number(x) - 0.3).toFixed(3)},${y}\n${(Number(x) + 0.3).toFixed(3)},${(Number(y) + 1.5).toFixed(3)}\n`,
  ]));
  cmds.push(...leaderText(x!, y!, 1.5, 1.5, 0.3, formatStationKm(it.station)));
  cmds.push(...leaderText(x!, y!, 1.5, -1.5, 0.3, statusLabel(it.status)));
  return cmds;
}

function drawCocTieu(it: CocTieuItem, _proj: AtgtProject, _X: (m: number) => string, _Y: (m: number) => string, _halfW: number, posXY: PosXYFn): string[] {
  const cmds: string[] = [];
  cmds.push(`._-LAYER\nS\nATGT_COCTIEU\n\n`);
  const offset = ySide(it.side, it.cachTim);
  const blockName = 'COCTIEU';
  for (let i = 0; i < it.count; i++) {
    const station = it.station + i * it.spacing;
    const xy = posXY(station, offset);
    const [x, y] = xy.split(',');
    cmds.push(...insertBlockOrFallback(blockName, x!, y!, () => [
      `._CIRCLE\n${xy}\n0.15\n`,
    ]));
  }
  const xyStart = posXY(it.station, offset);
  const [xs, ys] = xyStart.split(',');
  const endStation = it.station + (it.count - 1) * it.spacing;
  const xyEnd = posXY(endStation, offset);
  const [xe, ye] = xyEnd.split(',');
  const xyMid = posXY((it.station + endStation) / 2, offset);
  const [xm, ym] = xyMid.split(',');
  cmds.push(...leaderText(xs!, ys!, 1, 1.5, 0.3, formatStationKm(it.station)));
  cmds.push(...leaderText(xe!, ye!, 1, -1.5, 0.3, formatStationKm(endStation)));
  cmds.push(...leaderText(xm!, ym!, 0, 2.5, 0.3, statusLabel(it.status)));
  return cmds;
}

function drawCongNgang(it: CongNgangItem, _proj: AtgtProject, _X: (m: number) => string, _Y: (m: number) => string, halfW: number, posXY: PosXYFn): string[] {
  const cmds: string[] = [];
  cmds.push(`._-LAYER\nS\nATGT_CONGNGANG\n\n`);
  const xy = posXY(it.station, 0);
  const [x, y] = xy.split(',');
  const blockName = `CONG_${it.congType}_${it.diameter}`;
  cmds.push(...insertBlockOrFallback(blockName, x!, y!, () => {
    const rx = (it.diameter / 2);
    return [
      `._RECTANG\n${(Number(x) - rx * SCALE_X).toFixed(3)},${(Number(y) + halfW + 2).toFixed(3)}\n${(Number(x) + rx * SCALE_X).toFixed(3)},${(Number(y) - halfW - 2).toFixed(3)}\n`,
    ];
  }));
  cmds.push(...leaderText(x!, y!, 2, 3, 0.3, formatStationKm(it.station)));
  cmds.push(...leaderText(x!, y!, 2, -3, 0.3, statusLabel(it.status)));
  cmds.push(...leaderText(x!, y!, -3, 0, 0.3, `${it.congType} Ø${it.diameter}m L=${it.length}m`));
  return cmds;
}

function drawTieuPQ(it: TieuPQItem, _proj: AtgtProject, _X: (m: number) => string, _Y: (m: number) => string, _halfW: number, posXY: PosXYFn): string[] {
  const cmds: string[] = [];
  cmds.push(`._-LAYER\nS\nATGT_TIEUPQ\n\n`);
  const offset = ySide(it.side, it.cachTim);
  const blockName = `TIEUPQ_${it.color}`;
  for (let i = 0; i < it.count; i++) {
    const station = it.station + i * it.spacing;
    const xy = posXY(station, offset);
    const [x, y] = xy.split(',');
    cmds.push(...insertBlockOrFallback(blockName, x!, y!, () => [
      `._CIRCLE\n${xy}\n0.08\n`,
    ]));
  }
  const xyStart = posXY(it.station, offset);
  const [xs, ys] = xyStart.split(',');
  const endStation = it.station + (it.count - 1) * it.spacing;
  const xyEnd = posXY(endStation, offset);
  const [xe, ye] = xyEnd.split(',');
  const xyMid = posXY((it.station + endStation) / 2, offset);
  const [xm, ym] = xyMid.split(',');
  cmds.push(...leaderText(xs!, ys!, 1, 1.5, 0.25, formatStationKm(it.station)));
  cmds.push(...leaderText(xe!, ye!, 1, -1.5, 0.25, formatStationKm(endStation)));
  cmds.push(...leaderText(xm!, ym!, 0, 2.5, 0.25, statusLabel(it.status)));
  return cmds;
}

function drawGuongCau(it: GuongCauItem, _proj: AtgtProject, _X: (m: number) => string, _Y: (m: number) => string, _halfW: number, posXY: PosXYFn): string[] {
  const cmds: string[] = [];
  cmds.push(`._-LAYER\nS\nATGT_GUONGCAU\n\n`);
  const xy = posXY(it.station, ySide(it.side, it.cachTim));
  const [x, y] = xy.split(',');
  const blockName = 'GUONGCAU';
  cmds.push(...insertBlockOrFallback(blockName, x!, y!, () => [
    `._CIRCLE\n${xy}\n${(it.diameter / 2).toFixed(2)}\n`,
  ]));
  cmds.push(...leaderText(x!, y!, 1.5, 1.5, 0.3, formatStationKm(it.station)));
  cmds.push(...leaderText(x!, y!, 1.5, -1.5, 0.3, statusLabel(it.status)));
  return cmds;
}

// =====================================================================
// Line-based items
// =====================================================================

function drawVachSon(it: VachSonItem, _proj: AtgtProject, _X: (m: number) => string, _Y: (m: number) => string, _halfW: number, posXY: PosXYFn): string[] {
  const cmds: string[] = [];
  cmds.push(`._-LAYER\nS\nATGT_VACHSON\n\n`);
  const offset = ySide(it.side, it.cachTim);
  if (it.isContinuous) {
    cmds.push(`._LINE ${posXY(it.station, offset)} ${posXY(it.station + it.length, offset)} `);
  } else {
    const dash = 3, gap = 6;
    let s = it.station;
    while (s < it.station + it.length) {
      const se = Math.min(s + dash, it.station + it.length);
      cmds.push(`._LINE ${posXY(s, offset)} ${posXY(se, offset)} `);
      s += dash + gap;
    }
  }
  const xyStart = posXY(it.station, offset);
  const [xs, ys] = xyStart.split(',');
  const xyEnd = posXY(it.station + it.length, offset);
  const [xe, ye] = xyEnd.split(',');
  const xyMid = posXY(it.station + it.length / 2, offset);
  const [xm, ym] = xyMid.split(',');
  cmds.push(...leaderText(xs!, ys!, 0, 1.5, 0.3, formatStationKm(it.station)));
  cmds.push(...leaderText(xe!, ye!, 0, -1.5, 0.3, formatStationKm(it.station + it.length)));
  cmds.push(...leaderText(xm!, ym!, 0, 2.5, 0.3, `Vạch ${it.vachType} · ${statusLabel(it.status)}`));
  return cmds;
}

function drawHoLan(it: HoLanItem, _proj: AtgtProject, _X: (m: number) => string, _Y: (m: number) => string, halfW: number, posXY: PosXYFn): string[] {
  const cmds: string[] = [];
  cmds.push(`._-LAYER\nS\nATGT_HOLAN\n\n`);
  const offsetOuter = halfW + it.cachTim * 0.1 + 0.3; // ngoài mép đường
  const sideOffset = it.side === 'left' ? offsetOuter : -offsetOuter;
  cmds.push(`._LINE ${posXY(it.station, sideOffset)} ${posXY(it.station + it.length, sideOffset)} `);
  const innerOffset = sideOffset + (it.side === 'left' ? 0.2 : -0.2);
  cmds.push(`._LINE ${posXY(it.station, innerOffset)} ${posXY(it.station + it.length, innerOffset)} `);
  for (let s = 0; s < it.length; s += 4) {
    cmds.push(`._LINE ${posXY(it.station + s, sideOffset)} ${posXY(it.station + s, innerOffset)} `);
  }
  const xyStart = posXY(it.station, sideOffset);
  const [xs, ys] = xyStart.split(',');
  const xyEnd = posXY(it.station + it.length, sideOffset);
  const [xe, ye] = xyEnd.split(',');
  const xyMid = posXY(it.station + it.length / 2, sideOffset);
  const [xm, ym] = xyMid.split(',');
  cmds.push(...leaderText(xs!, ys!, 0, 1.5, 0.3, formatStationKm(it.station)));
  cmds.push(...leaderText(xe!, ye!, 0, -1.5, 0.3, formatStationKm(it.station + it.length)));
  cmds.push(...leaderText(xm!, ym!, 0, 2.5, 0.3, `${it.holanType} · ${statusLabel(it.status)}`));
  return cmds;
}

function drawRanhDoc(it: RanhDocItem, _proj: AtgtProject, _X: (m: number) => string, _Y: (m: number) => string, halfW: number, posXY: PosXYFn): string[] {
  const cmds: string[] = [];
  cmds.push(`._-LAYER\nS\nATGT_RANHDOC\n\n`);
  const offsetInner = halfW + it.cachTim;
  const sideOffsetInner = it.side === 'left' ? offsetInner : -offsetInner;
  const sideOffsetOuter = sideOffsetInner + (it.side === 'left' ? it.width : -it.width);
  // Vẽ 4 cạnh rãnh (2 dọc + 2 ngang) — gần đúng cho mode polyline (giả định rãnh hẹp so với curvature)
  cmds.push(`._LINE ${posXY(it.station, sideOffsetInner)} ${posXY(it.station + it.length, sideOffsetInner)} `);
  cmds.push(`._LINE ${posXY(it.station, sideOffsetOuter)} ${posXY(it.station + it.length, sideOffsetOuter)} `);
  cmds.push(`._LINE ${posXY(it.station, sideOffsetInner)} ${posXY(it.station, sideOffsetOuter)} `);
  cmds.push(`._LINE ${posXY(it.station + it.length, sideOffsetInner)} ${posXY(it.station + it.length, sideOffsetOuter)} `);
  const xyStart = posXY(it.station, sideOffsetInner);
  const [xs, ys] = xyStart.split(',');
  const xyEnd = posXY(it.station + it.length, sideOffsetInner);
  const [xe, ye] = xyEnd.split(',');
  const xyMid = posXY(it.station + it.length / 2, sideOffsetInner);
  const [xm, ym] = xyMid.split(',');
  cmds.push(...leaderText(xs!, ys!, 0, 1.5, 0.3, formatStationKm(it.station)));
  cmds.push(...leaderText(xe!, ye!, 0, -1.5, 0.3, formatStationKm(it.station + it.length)));
  cmds.push(...leaderText(xm!, ym!, 0, 3, 0.3, `Rãnh ${it.ranhType} · ${it.width}×${it.depth}m · ${statusLabel(it.status)}`));
  return cmds;
}

// =====================================================================
// Statistics (giữ nguyên)
// =====================================================================

export interface AtgtStats {
  total: number;
  byCategory: { id: string; name: string; count: number }[];
  byStatus: { status: string; count: number }[];
}

export function computeAtgtStats(segment: AtgtSegment): AtgtStats {
  const byCategory: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  for (const it of segment.items) {
    byCategory[it.category] = (byCategory[it.category] ?? 0) + 1;
    byStatus[it.status] = (byStatus[it.status] ?? 0) + 1;
  }
  return {
    total: segment.items.length,
    byCategory: ATGT_CATEGORIES
      .filter((c) => byCategory[c.id] && byCategory[c.id]! > 0)
      .map((c) => ({ id: c.id, name: c.name, count: byCategory[c.id]! })),
    byStatus: Object.entries(byStatus).map(([status, count]) => ({ status, count })),
  };
}
