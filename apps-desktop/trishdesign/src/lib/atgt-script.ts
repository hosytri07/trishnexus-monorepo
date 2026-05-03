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

const SCALE_X = 0.1;     // 1m lý trình → 0.1 đv vẽ
const SCALE_Y = 1.0;     // 1m ngang → 1 đv

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
  const segLen = seg.endStation - seg.startStation;
  const halfW = seg.roadWidth / 2;

  const X = (m: number) => ((m - seg.startStation) * SCALE_X).toFixed(3);
  const Y = (m: number) => (m * SCALE_Y + originY).toFixed(3);

  // Mode duỗi thẳng: vẽ tim đường + 2 mép
  if ((seg.drawMode ?? 'duoithang') === 'duoithang') {
    cmds.push(`._-LAYER\nS\nATGT_DUONG\n\n`);
    // Tim đường (dashed)
    cmds.push(`._LINE ${X(seg.startStation)},${Y(0)} ${X(seg.endStation)},${Y(0)} `);
    // 2 mép
    cmds.push(`._LINE ${X(seg.startStation)},${Y(halfW)} ${X(seg.endStation)},${Y(halfW)} `);
    cmds.push(`._LINE ${X(seg.startStation)},${Y(-halfW)} ${X(seg.endStation)},${Y(-halfW)} `);
  }
  // Mode polyline: app giả định user đã có polyline ở vị trí (0, originY) → (segLen*scaleX, originY)
  // Phase sau wire LSP để đặt theo polyline cong thật.

  // Tên đoạn label
  cmds.push(`._-LAYER\nS\nATGT_TEXT\n\n`);
  cmds.push(`._-TEXT\nJ\nMC\n${(((seg.startStation + seg.endStation) / 2 - seg.startStation) * SCALE_X).toFixed(3)},${(halfW + 2 + originY).toFixed(3)}\n1.2\n0\n${seg.name}\n`);

  // Vẽ từng item
  for (const item of seg.items) {
    cmds.push(...itemCommands(item, project, X, Y, halfW));
  }
  return cmds;
}

function itemCommands(
  item: AtgtItem,
  project: AtgtProject,
  X: (m: number) => string,
  Y: (m: number) => string,
  halfW: number,
): string[] {
  switch (item.category) {
    case 'BIENBAO':   return drawBienBao(item, project, X, Y, halfW);
    case 'VACHSON':   return drawVachSon(item, project, X, Y, halfW);
    case 'DENTH':     return drawDenTH(item, project, X, Y, halfW);
    case 'HOLAN':     return drawHoLan(item, project, X, Y, halfW);
    case 'COCTIEU':   return drawCocTieu(item, project, X, Y, halfW);
    case 'RANHDOC':   return drawRanhDoc(item, project, X, Y, halfW);
    case 'CONGNGANG': return drawCongNgang(item, project, X, Y, halfW);
    case 'TIEUPQ':    return drawTieuPQ(item, project, X, Y, halfW);
    case 'GUONGCAU':  return drawGuongCau(item, project, X, Y, halfW);
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

function drawBienBao(it: BienBaoItem, _proj: AtgtProject, X: (m: number) => string, Y: (m: number) => string, _halfW: number): string[] {
  const cmds: string[] = [];
  cmds.push(`._-LAYER\nS\nATGT_BIENBAO\n\n`);
  const x = X(it.station);
  const y = Y(ySide(it.side, it.cachTim));
  // INSERT block: tên = mã biển (vd "P.103a")
  const blockName = it.code || `BIENBAO_${it.group}`;
  cmds.push(...insertBlockOrFallback(blockName, x, y, () => {
    // Fallback: vòng tròn + text mã
    return [
      `._CIRCLE\n${x},${y}\n${(it.diameter / 2).toFixed(2)}\n`,
      `._-TEXT\nJ\nMC\n${x},${y}\n0.3\n0\n${blockName}\n`,
    ];
  }));
  // Leader 1: lý trình (offset góc trên phải)
  cmds.push(...leaderText(x, y, 1.5, 1.5, 0.3, formatStationKm(it.station)));
  // Leader 2: hiện trạng (offset góc dưới phải)
  cmds.push(...leaderText(x, y, 1.5, -1.5, 0.3, statusLabel(it.status)));
  return cmds;
}

function drawDenTH(it: DenTHItem, _proj: AtgtProject, X: (m: number) => string, Y: (m: number) => string, _halfW: number): string[] {
  const cmds: string[] = [];
  cmds.push(`._-LAYER\nS\nATGT_DENTH\n\n`);
  const x = X(it.station);
  const y = Y(ySide(it.side, it.cachTim));
  const blockName = `DENTH_${it.denType}`;
  cmds.push(...insertBlockOrFallback(blockName, x, y, () => [
    `._RECTANG\n${(Number(x) - 0.3).toFixed(3)},${y}\n${(Number(x) + 0.3).toFixed(3)},${(Number(y) + 1.5).toFixed(3)}\n`,
  ]));
  cmds.push(...leaderText(x, y, 1.5, 1.5, 0.3, formatStationKm(it.station)));
  cmds.push(...leaderText(x, y, 1.5, -1.5, 0.3, statusLabel(it.status)));
  return cmds;
}

function drawCocTieu(it: CocTieuItem, _proj: AtgtProject, X: (m: number) => string, Y: (m: number) => string, _halfW: number): string[] {
  const cmds: string[] = [];
  cmds.push(`._-LAYER\nS\nATGT_COCTIEU\n\n`);
  const yy = ySide(it.side, it.cachTim);
  const blockName = 'COCTIEU';
  for (let i = 0; i < it.count; i++) {
    const station = it.station + i * it.spacing;
    const x = X(station);
    const y = Y(yy);
    cmds.push(...insertBlockOrFallback(blockName, x, y, () => [
      `._CIRCLE\n${x},${y}\n0.15\n`,
    ]));
  }
  // Leader đầu: lý trình bắt đầu
  cmds.push(...leaderText(X(it.station), Y(yy), 1, 1.5, 0.3, formatStationKm(it.station)));
  // Leader cuối: lý trình kết thúc
  const endStation = it.station + (it.count - 1) * it.spacing;
  cmds.push(...leaderText(X(endStation), Y(yy), 1, -1.5, 0.3, formatStationKm(endStation)));
  // Leader hiện trạng
  cmds.push(...leaderText(X((it.station + endStation) / 2), Y(yy), 0, 2.5, 0.3, statusLabel(it.status)));
  return cmds;
}

function drawCongNgang(it: CongNgangItem, _proj: AtgtProject, X: (m: number) => string, Y: (m: number) => string, halfW: number): string[] {
  const cmds: string[] = [];
  cmds.push(`._-LAYER\nS\nATGT_CONGNGANG\n\n`);
  const x = X(it.station);
  const y = Y(0);  // Cống ngang luôn ngang qua tim
  const blockName = `CONG_${it.congType}_${it.diameter}`;
  cmds.push(...insertBlockOrFallback(blockName, x, y, () => {
    const rx = (it.diameter / 2);
    return [
      `._RECTANG\n${(Number(x) - rx * SCALE_X).toFixed(3)},${(Number(y) + halfW + 2).toFixed(3)}\n${(Number(x) + rx * SCALE_X).toFixed(3)},${(Number(y) - halfW - 2).toFixed(3)}\n`,
    ];
  }));
  cmds.push(...leaderText(x, y, 2, 3, 0.3, formatStationKm(it.station)));
  cmds.push(...leaderText(x, y, 2, -3, 0.3, statusLabel(it.status)));
  // Leader 3: loại cống
  cmds.push(...leaderText(x, y, -3, 0, 0.3, `${it.congType} Ø${it.diameter}m L=${it.length}m`));
  return cmds;
}

function drawTieuPQ(it: TieuPQItem, _proj: AtgtProject, X: (m: number) => string, Y: (m: number) => string, _halfW: number): string[] {
  const cmds: string[] = [];
  cmds.push(`._-LAYER\nS\nATGT_TIEUPQ\n\n`);
  const yy = ySide(it.side, it.cachTim);
  const blockName = `TIEUPQ_${it.color}`;
  for (let i = 0; i < it.count; i++) {
    const station = it.station + i * it.spacing;
    cmds.push(...insertBlockOrFallback(blockName, X(station), Y(yy), () => [
      `._CIRCLE\n${X(station)},${Y(yy)}\n0.08\n`,
    ]));
  }
  cmds.push(...leaderText(X(it.station), Y(yy), 1, 1.5, 0.25, formatStationKm(it.station)));
  const endStation = it.station + (it.count - 1) * it.spacing;
  cmds.push(...leaderText(X(endStation), Y(yy), 1, -1.5, 0.25, formatStationKm(endStation)));
  cmds.push(...leaderText(X((it.station + endStation) / 2), Y(yy), 0, 2.5, 0.25, statusLabel(it.status)));
  return cmds;
}

function drawGuongCau(it: GuongCauItem, _proj: AtgtProject, X: (m: number) => string, Y: (m: number) => string, _halfW: number): string[] {
  const cmds: string[] = [];
  cmds.push(`._-LAYER\nS\nATGT_GUONGCAU\n\n`);
  const x = X(it.station);
  const y = Y(ySide(it.side, it.cachTim));
  const blockName = 'GUONGCAU';
  cmds.push(...insertBlockOrFallback(blockName, x, y, () => [
    `._CIRCLE\n${x},${y}\n${(it.diameter / 2).toFixed(2)}\n`,
  ]));
  cmds.push(...leaderText(x, y, 1.5, 1.5, 0.3, formatStationKm(it.station)));
  cmds.push(...leaderText(x, y, 1.5, -1.5, 0.3, statusLabel(it.status)));
  return cmds;
}

// =====================================================================
// Line-based items
// =====================================================================

function drawVachSon(it: VachSonItem, _proj: AtgtProject, X: (m: number) => string, Y: (m: number) => string, _halfW: number): string[] {
  const cmds: string[] = [];
  cmds.push(`._-LAYER\nS\nATGT_VACHSON\n\n`);
  const x0 = X(it.station);
  const x1 = X(it.station + it.length);
  const yy = ySide(it.side, it.cachTim);
  const y = Y(yy);
  // Vẽ polyline (liền hoặc đứt)
  if (it.isContinuous) {
    cmds.push(`._LINE ${x0},${y} ${x1},${y} `);
  } else {
    const dash = 3, gap = 6;
    let s = it.station;
    while (s < it.station + it.length) {
      const se = Math.min(s + dash, it.station + it.length);
      cmds.push(`._LINE ${X(s)},${y} ${X(se)},${y} `);
      s += dash + gap;
    }
  }
  // Leader đầu: lý trình bắt đầu
  cmds.push(...leaderText(x0, y, 0, 1.5, 0.3, formatStationKm(it.station)));
  // Leader cuối
  cmds.push(...leaderText(x1, y, 0, -1.5, 0.3, formatStationKm(it.station + it.length)));
  // Leader hiện trạng + loại vạch
  const xMid = (Number(x0) + Number(x1)) / 2;
  cmds.push(...leaderText(xMid.toFixed(3), y, 0, 2.5, 0.3, `Vạch ${it.vachType} · ${statusLabel(it.status)}`));
  return cmds;
}

function drawHoLan(it: HoLanItem, _proj: AtgtProject, X: (m: number) => string, Y: (m: number) => string, halfW: number): string[] {
  const cmds: string[] = [];
  cmds.push(`._-LAYER\nS\nATGT_HOLAN\n\n`);
  const x0 = X(it.station);
  const x1 = X(it.station + it.length);
  const yy = ySide(it.side, halfW + it.cachTim * 0.1 + 0.3);  // hộ lan ngoài mép đường
  const y = Y(yy);
  // Vẽ 2 đường song song = hộ lan tôn sóng
  cmds.push(`._LINE ${x0},${y} ${x1},${y} `);
  const yOffset = it.side === 'left' ? 0.2 : -0.2;
  cmds.push(`._LINE ${x0},${(Number(y) + yOffset).toFixed(3)} ${x1},${(Number(y) + yOffset).toFixed(3)} `);
  // Tick marks 4m
  for (let s = 0; s < it.length; s += 4) {
    const xs = X(it.station + s);
    cmds.push(`._LINE ${xs},${y} ${xs},${(Number(y) + yOffset).toFixed(3)} `);
  }
  cmds.push(...leaderText(x0, y, 0, 1.5, 0.3, formatStationKm(it.station)));
  cmds.push(...leaderText(x1, y, 0, -1.5, 0.3, formatStationKm(it.station + it.length)));
  const xMid = (Number(x0) + Number(x1)) / 2;
  cmds.push(...leaderText(xMid.toFixed(3), y, 0, 2.5, 0.3, `${it.holanType} · ${statusLabel(it.status)}`));
  return cmds;
}

function drawRanhDoc(it: RanhDocItem, _proj: AtgtProject, X: (m: number) => string, Y: (m: number) => string, halfW: number): string[] {
  const cmds: string[] = [];
  cmds.push(`._-LAYER\nS\nATGT_RANHDOC\n\n`);
  const x0 = X(it.station);
  const x1 = X(it.station + it.length);
  const yy = ySide(it.side, halfW + it.cachTim);
  const y = Y(yy);
  const yWidth = it.side === 'left' ? it.width : -it.width;
  cmds.push(`._RECTANG\n${x0},${y}\n${x1},${(Number(y) + yWidth).toFixed(3)}\n`);
  cmds.push(...leaderText(x0, y, 0, 1.5, 0.3, formatStationKm(it.station)));
  cmds.push(...leaderText(x1, y, 0, -1.5, 0.3, formatStationKm(it.station + it.length)));
  const xMid = (Number(x0) + Number(x1)) / 2;
  cmds.push(...leaderText(xMid.toFixed(3), y, 0, 3, 0.3, `Rãnh ${it.ranhType} · ${it.width}×${it.depth}m · ${statusLabel(it.status)}`));
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
