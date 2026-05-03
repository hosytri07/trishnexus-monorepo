/**
 * TrishDesign Phase 28.4.E + 28.4.F (Turn 4) — AutoCAD command generator.
 *
 * Output array<string> — mỗi string = 1 command line gửi vào AutoCAD command line
 * thông qua COM automation `acadDoc.SendCommand("...")`.
 *
 * Phase 28.4 Turn 4 features:
 *   - Multi-segment: vẽ all segments của project, stack vertical theo Y axis
 *   - Multi-frame tile: nếu đoạn dài hơn 1 khung, tile nhiều khung A3/A4 nối tiếp ngang
 *   - Bảng thống kê HH: vẽ ra mỗi khung (Mã | Loại | DT m² | %)
 *   - Frame title block + segment label
 *
 * Coordinate system:
 *   - X axis: dọc theo đường (trục lý trình), drawing units sau scaleX
 *   - Y axis: ngang đường, +Y = TRÁI (trên), -Y = PHẢI (dưới), drawing units sau scaleY
 *   - originY (drawing units): offset Y của segment để stack vertical multi-segment
 */

import {
  type Project,
  type RoadSegment,
  type DamageCode,
  type RoadStake,
  type DrawingPrefs,
  FRAME_A3,
  FRAME_A4_BAOLUT,
} from '../types.js';

// ============================================================
// PUBLIC API
// ============================================================

/**
 * Generate full command sequence cho TOÀN BỘ project (multi-segment stack vertical).
 * Setup + tất cả segments + cleanup.
 */
export function generateProjectCommands(
  project: Project,
  damageCodes: DamageCode[],
  prefs: DrawingPrefs,
  initialOriginY: number = 0, // Offset Y bắt đầu (cho vẽ lần N)
): string[] {
  const cmds: string[] = [];
  cmds.push(...setupCommands(damageCodes, prefs));
  let originY = initialOriginY; // drawing units
  for (const segment of project.segments) {
    cmds.push(...segmentBodyCommands(segment, damageCodes, prefs, project.name, originY));
    // Compute next segment Y offset (xuống dưới)
    originY -= segmentVerticalSpace(segment);
  }
  cmds.push(...cleanupCommands());
  return cmds;
}

/**
 * Backward-compat: vẽ 1 segment độc lập (dùng từ legacy code).
 * Equivalent to generateProjectCommands với project chỉ có 1 segment.
 */
export function generateSegmentCommands(
  segment: RoadSegment,
  damageCodes: DamageCode[],
  prefs: DrawingPrefs,
  projectName: string,
): string[] {
  const fakeProject: Project = {
    id: '_tmp', name: projectName,
    createdAt: 0, updatedAt: 0,
    segments: [segment],
  };
  return generateProjectCommands(fakeProject, damageCodes, prefs);
}

/**
 * Tính thống kê diện tích miếng theo mã hư hỏng.
 */
export function computeStatistics(segment: RoadSegment, damageCodes: DamageCode[]): {
  byCode: { code: number; name: string; maVe: string; area: number; pieceCount: number }[];
  totalDamage: number;
  totalRoad: number;
  ratio: number;
} {
  const byCode: { code: number; name: string; maVe: string; area: number; pieceCount: number }[] = [];
  for (const dc of damageCodes) {
    const pieces = segment.damagePieces.filter((p) => p.damageCode === dc.code);
    const area = pieces.reduce((sum, p) => sum + p.width * p.length, 0);
    if (area > 0) {
      byCode.push({ code: dc.code, name: dc.name, maVe: dc.maVe, area, pieceCount: pieces.length });
    }
  }
  const totalDamage = byCode.reduce((sum, x) => sum + x.area, 0);
  const segmentLength = segment.endStation - segment.startStation;
  const totalRoad = segmentLength * segment.roadWidth;
  const ratio = totalRoad > 0 ? (totalDamage / totalRoad) * 100 : 0;
  return { byCode, totalDamage, totalRoad, ratio };
}

/**
 * Tính số khung A3/A4 cần để gói đoạn (multi-frame tile).
 */
export function computeFrameCount(segment: RoadSegment): number {
  const segmentLength = segment.endStation - segment.startStation;
  const drawnLength = segmentLength * segment.drawing.scaleX;
  const frame = segment.drawing.frameType === 'A3_390x280' ? FRAME_A3 : FRAME_A4_BAOLUT;
  return Math.max(1, Math.ceil(drawnLength / frame.width));
}

// ============================================================
// INTERNAL — Setup / Cleanup
// ============================================================

function setupCommands(damageCodes: DamageCode[], prefs: DrawingPrefs): string[] {
  const cmds: string[] = [];

  // 0a. FILEDIA + CMDDIA + COLOR + HPCOLOR
  cmds.push('._FILEDIA\n0\n');
  cmds.push('._CMDDIA\n0\n');
  cmds.push('._-COLOR\nBYLAYER\n');
  cmds.push('._-SETVAR\nHPCOLOR\nBYLAYER\n');
  // HPISLANDDETECTION = 2 (Ignore): không cần island detection (Select Last đã chỉ rõ boundary)
  cmds.push('._-SETVAR\nHPISLANDDETECTION\n2\n');

  // 0b. Text style
  const styleName = prefs.textStyleName ?? 'TEXT_HH';
  const styleFont = prefs.textStyleFont ?? 'romans.shx';
  const styleWidth = prefs.textStyleWidth ?? 0.7;
  const styleType = prefs.textStyleType ?? 'shx';
  if (styleType === 'shx') {
    cmds.push(`._-STYLE\n${styleName}\n${styleFont}\n0\n${styleWidth}\n0\nN\nN\nN\n`);
  } else {
    cmds.push(`._-STYLE\n${styleName}\n${styleFont}\n0\n${styleWidth}\n0\nN\nN\n`);
  }

  // 0c. Load tất cả linetypes user đang dùng (dedupe)
  const usedLinetypes = new Set<string>();
  for (const layer of Object.values(prefs.layers)) {
    if (layer.linetype && layer.linetype !== 'CONTINUOUS') {
      usedLinetypes.add(layer.linetype);
    }
  }
  for (const lt of usedLinetypes) {
    cmds.push(`._-LINETYPE\nL\n${lt}\nacad.lin\n\n`);
  }

  // 0d. Layers — đọc từ prefs.layers
  for (const layer of Object.values(prefs.layers)) {
    cmds.push(cmdLayerMake(layer.name, layer.color));
    if (layer.linetype && layer.linetype !== 'CONTINUOUS') {
      cmds.push(`._-LAYER\nLT\n${layer.linetype}\n${layer.name}\n\n`);
    }
  }
  for (const dc of damageCodes) {
    cmds.push(cmdLayerMake(dc.layerName, dc.colorIndex));
  }
  return cmds;
}

function cleanupCommands(): string[] {
  return [
    '\n\n\n\n',
    '._ZOOM\nE\n',
    '._FILEDIA\n1\n',
    '._CMDDIA\n1\n',
    '\n\n',
  ];
}

// ============================================================
// INTERNAL — Helpers (commands)
// ============================================================

function cmdLayerMake(name: string, color: number): string {
  return `._-LAYER\nM\n${name}\nC\n${color}\n${name}\n\n`;
}

function cmdLayerSet(name: string): string {
  return `._-LAYER\nS\n${name}\n\n`;
}

function cmdText(x: string, y: string, height: number, rotation: number, text: string): string {
  return `._-TEXT\n${x},${y}\n${height}\n${rotation}\n${text}\n`;
}

function cmdTextCenter(x: string, y: string, height: number, rotation: number, text: string): string {
  return `._-TEXT\nJ\nMC\n${x},${y}\n${height}\n${rotation}\n${text}\n`;
}

// Hatch dùng SELECT LAST — rectangle vừa vẽ luôn là _last, deterministic 100%.
// Flow: -HATCH → P → pattern → scale → angle → S → L → ENTER → ENTER
function cmdHatchSelectLast(pattern: string, scale: number, angle: number): string {
  return `._-HATCH\nP\n${pattern}\n${scale}\n${angle}\nS\nL\n\n\n`;
}

// ============================================================
// INTERNAL — Segment vertical space (cho stack vertical)
// ============================================================
function segmentVerticalSpace(segment: RoadSegment): number {
  const halfW = segment.roadWidth / 2;
  return halfW * 2 * segment.drawing.scaleY + 5 + 20 + 25;
}

// ============================================================
// INTERNAL — Segment body (vẽ 1 segment ở vị trí originY)
// ============================================================
function segmentBodyCommands(
  segment: RoadSegment,
  damageCodes: DamageCode[],
  prefs: DrawingPrefs,
  _projectName: string,
  originY: number,
): string[] {
  const cmds: string[] = [];
  const { scaleX, scaleY } = segment.drawing;
  const segmentLength = segment.endStation - segment.startStation;
  const halfWidth = segment.roadWidth / 2;
  const halfDpc = (segment.medianWidth ?? 0) / 2;

  const X = (m: number) => (m * scaleX).toFixed(3);
  const Y = (m: number) => (m * scaleY + originY).toFixed(3);

  cmds.push('\n\n\n');

  // 1. Khuôn đường
  cmds.push(cmdLayerSet(prefs.layers.KHUONDUONG.name));
  cmds.push(`._LINE ${X(0)},${Y(halfWidth)} ${X(segmentLength)},${Y(halfWidth)} `);
  cmds.push(`._LINE ${X(0)},${Y(-halfWidth)} ${X(segmentLength)},${Y(-halfWidth)} `);
  cmds.push(`._LINE ${X(0)},${Y(-halfWidth)} ${X(0)},${Y(halfWidth)} `);
  cmds.push(`._LINE ${X(segmentLength)},${Y(-halfWidth)} ${X(segmentLength)},${Y(halfWidth)} `);

  if (segment.roadType === 'dual' && halfDpc > 0) {
    cmds.push(`._LINE ${X(0)},${Y(halfDpc)} ${X(segmentLength)},${Y(halfDpc)} `);
    cmds.push(`._LINE ${X(0)},${Y(-halfDpc)} ${X(segmentLength)},${Y(-halfDpc)} `);
  }

  // 2. Tim đường + Vạch chia làn
  cmds.push(cmdLayerSet(prefs.layers.TIM.name));
  cmds.push(`._LINE ${X(0)},${Y(0)} ${X(segmentLength)},${Y(0)} `);

  cmds.push(cmdLayerSet(prefs.layers.VACHLAN.name));
  if (segment.roadType === 'single') {
    const laneWidth = segment.roadWidth / Math.max(segment.laneCount, 1);
    for (let k = 1; k < segment.laneCount; k++) {
      const yLane = -halfWidth + k * laneWidth;
      if (Math.abs(yLane) < 0.01) continue;
      cmds.push(`._LINE ${X(0)},${Y(yLane)} ${X(segmentLength)},${Y(yLane)} `);
    }
  } else if (halfDpc > 0) {
    const lanesPerSide = Math.max(Math.floor(segment.laneCount / 2), 1);
    const laneWidth = (halfWidth - halfDpc) / lanesPerSide;
    for (let k = 1; k < lanesPerSide; k++) {
      cmds.push(`._LINE ${X(0)},${Y(halfDpc + k * laneWidth)} ${X(segmentLength)},${Y(halfDpc + k * laneWidth)} `);
      cmds.push(`._LINE ${X(0)},${Y(-halfDpc - k * laneWidth)} ${X(segmentLength)},${Y(-halfDpc - k * laneWidth)} `);
    }
  }

  // 3. Cọc H
  let stakes: RoadStake[] = segment.stakes;
  if (stakes.length === 0) {
    stakes = [];
    let n = 1;
    const interval = prefs.autoStakeInterval;
    let s = Math.floor(segment.startStation / interval) * interval + interval;
    while (s < segment.endStation) {
      stakes.push({ id: `auto_${n}`, label: `H${n}`, station: s });
      s += interval;
      n += 1;
    }
  }

  cmds.push(cmdLayerSet(prefs.layers.COCH.name));
  for (const stake of stakes) {
    const x = stake.station - segment.startStation;
    if (x < 0 || x > segmentLength) continue;
    cmds.push(`._LINE ${X(x)},${Y(halfWidth + 0.5)} ${X(x)},${Y(-halfWidth - 0.5)} `);
    cmds.push(cmdLayerSet(prefs.layers.TEXT.name));
    const stakeText = `${stake.label}=${stake.station}`;
    cmds.push(cmdText(X(x), Y(halfWidth + 1.5), prefs.stationTextHeight, 90, stakeText));
    cmds.push(cmdLayerSet(prefs.layers.COCH.name));
  }

  // 4. Miếng hư hỏng
  for (const piece of segment.damagePieces) {
    const code = damageCodes.find((dc) => dc.code === piece.damageCode);
    if (!code) continue;

    const xStart = piece.startStation - segment.startStation;
    const xEnd = xStart + piece.length;
    const cachTim = piece.cachTim ?? 0;
    const mode = segment.cachTimMode ?? 'tim';
    let yBottom: number; let yTop: number;
    if (piece.side === 'center') {
      yBottom = -piece.width / 2;
      yTop = piece.width / 2;
    } else if (segment.roadType === 'dual' && halfDpc > 0) {
      if (piece.side === 'left') {
        yBottom = halfDpc + cachTim;
        yTop = halfDpc + cachTim + piece.width;
      } else {
        yTop = -halfDpc - cachTim;
        yBottom = -halfDpc - cachTim - piece.width;
      }
    } else if (mode === 'mep') {
      if (piece.side === 'left') {
        yTop = halfWidth - cachTim;
        yBottom = halfWidth - cachTim - piece.width;
      } else {
        yBottom = -halfWidth + cachTim;
        yTop = -halfWidth + cachTim + piece.width;
      }
    } else {
      if (piece.side === 'left') {
        yBottom = cachTim;
        yTop = cachTim + piece.width;
      } else {
        yTop = -cachTim;
        yBottom = -cachTim - piece.width;
      }
    }
    // Rectangle border
    cmds.push(cmdLayerSet(prefs.layers.MIENG.name));
    cmds.push(`._RECTANG ${X(xStart)},${Y(yBottom)} ${X(xEnd)},${Y(yTop)}`);

    // HATCH dùng Select Last (deterministic 100%)
    cmds.push(cmdLayerSet(code.layerName));
    cmds.push(cmdHatchSelectLast(code.hatchPattern, code.hatchScale, code.hatchAngle));
    const xMid = (xStart + xEnd) / 2;
    const yMid = (yBottom + yTop) / 2;

    // Số miếng
    cmds.push(cmdLayerSet(prefs.layers.TEXT.name));
    cmds.push(cmdTextCenter(X(xMid), Y(yMid), prefs.pieceLabelTextHeight * 1.2, 0, piece.pieceNumber));

    // Kích thước
    cmds.push(cmdLayerSet(prefs.layers.KICHTHUOC.name));
    cmds.push(cmdTextCenter(
      X(xMid),
      Y(yBottom - prefs.dimTextHeight - 0.3),
      prefs.dimTextHeight,
      0,
      `KT(${piece.length.toFixed(1)}x${piece.width.toFixed(1)})`,
    ));

    // Lý trình
    cmds.push(cmdLayerSet(prefs.layers.TEXT.name));
    const stationStr = `+${(piece.startStation % 1000).toString().padStart(3, '0')}`;
    cmds.push(cmdText(X(xStart), Y(halfWidth + 1.2), prefs.stationTextHeight, 90, stationStr));
  }

  // 5. Title đoạn + 3 bảng
  const titleY = halfWidth * scaleY + 3 + originY;
  cmds.push(cmdLayerSet(prefs.layers.TEXT.name));
  cmds.push(cmdTextCenter(
    String(segmentLength * scaleX / 2),
    titleY.toFixed(2),
    1.0,
    0,
    segment.name,
  ));

  const tableTopY = -halfWidth * scaleY - 6 + originY;
  const stats = computeStatistics(segment, damageCodes);
  // Layout 3 bảng ngang: Bảng 1 (x=0) → Bảng 2 (x=37) → Legend (x=74)
  cmds.push(...generateStatsTable(stats, tableTopY, prefs, 0));
  cmds.push(...generateRatioTable(stats, tableTopY, prefs, 37));
  cmds.push(...generateHatchLegend(stats, damageCodes, tableTopY, prefs, 74));

  return cmds;
}

// ============================================================
// Bảng 3: Ghi chú ký hiệu hatch (legend)
// ============================================================
function generateHatchLegend(
  stats: ReturnType<typeof computeStatistics>,
  damageCodes: DamageCode[],
  topY: number,
  prefs: DrawingPrefs,
  x0: number,
): string[] {
  const cmds: string[] = [];
  if (stats.byCode.length === 0) return cmds;

  const swatchW = 4;
  const labelW = 18;
  const rowH = 1.5;
  const totalW = swatchW + labelW;
  // Title + header + data rows
  const nRows = stats.byCode.length + 2;
  const tableHeight = nRows * rowH;
  const yTop = topY;
  const yBottom = yTop - tableHeight;

  cmds.push(cmdLayerSet(prefs.layers.THONGKE.name));
  cmds.push(`._RECTANG ${x0.toFixed(2)},${yTop.toFixed(2)} ${(x0 + totalW).toFixed(2)},${yBottom.toFixed(2)}`);
  // Vertical separator (chỉ trong vùng dưới title)
  cmds.push(`._LINE ${(x0 + swatchW).toFixed(2)},${(yTop - rowH).toFixed(2)} ${(x0 + swatchW).toFixed(2)},${yBottom.toFixed(2)} `);
  for (let r = 1; r < nRows; r++) {
    const yLine = yTop - r * rowH;
    cmds.push(`._LINE ${x0.toFixed(2)},${yLine.toFixed(2)} ${(x0 + totalW).toFixed(2)},${yLine.toFixed(2)} `);
  }

  // Title row (Unicode tiếng Việt)
  cmds.push(cmdLayerSet(prefs.layers.TEXT.name));
  cmds.push(cmdTextCenter(
    (x0 + totalW / 2).toFixed(2),
    (yTop - rowH / 2).toFixed(2),
    0.5, 0, 'BẢNG 3: GHI CHÚ KÝ HIỆU HATCH',
  ));

  // Header
  cmds.push(cmdTextCenter(
    (x0 + swatchW / 2).toFixed(2),
    (yTop - rowH * 1.5).toFixed(2),
    0.4, 0, 'Ký hiệu',
  ));
  cmds.push(cmdTextCenter(
    (x0 + swatchW + labelW / 2).toFixed(2),
    (yTop - rowH * 1.5).toFixed(2),
    0.4, 0, 'Loại hư hỏng',
  ));

  // Data rows
  for (let r = 0; r < stats.byCode.length; r++) {
    const item = stats.byCode[r]!;
    const code = damageCodes.find((d) => d.code === item.code);
    if (!code) continue;
    const row = r + 2;
    const yRowTop = yTop - row * rowH;
    const yRowBot = yRowTop - rowH;
    cmds.push(cmdLayerSet(prefs.layers.MIENG.name));
    const swX0 = x0 + 0.2;
    const swX1 = x0 + swatchW - 0.2;
    const swY0 = yRowTop - 0.2;
    const swY1 = yRowBot + 0.2;
    cmds.push(`._RECTANG ${swX0.toFixed(2)},${swY0.toFixed(2)} ${swX1.toFixed(2)},${swY1.toFixed(2)}`);
    cmds.push(cmdLayerSet(code.layerName));
    cmds.push(cmdHatchSelectLast(code.hatchPattern, code.hatchScale, code.hatchAngle));
    cmds.push(cmdLayerSet(prefs.layers.TEXT.name));
    cmds.push(cmdTextCenter(
      (x0 + swatchW + labelW / 2).toFixed(2),
      ((yRowTop + yRowBot) / 2).toFixed(2),
      prefs.dimTextHeight, 0, item.name,
    ));
  }
  return cmds;
}

// ============================================================
// Bảng 1: DIỆN TÍCH HƯ HỎNG (Mã | Loại | DT m² | Số miếng)
// ============================================================
function generateStatsTable(
  stats: ReturnType<typeof computeStatistics>,
  topY: number,
  prefs: DrawingPrefs,
  x0: number,
): string[] {
  const cmds: string[] = [];
  if (stats.byCode.length === 0) return cmds;

  const colW = [3, 18, 7, 5];
  const rowH = 1.2;
  const xs = [
    0,
    colW[0],
    colW[0] + colW[1],
    colW[0] + colW[1] + colW[2],
    colW[0] + colW[1] + colW[2] + colW[3],
  ];
  const totalW = xs[xs.length - 1]!;
  // Title + header + data + total
  const nRows = stats.byCode.length + 3;
  const tableHeight = nRows * rowH;
  const yTop = topY;
  const yBottom = yTop - tableHeight;

  cmds.push(cmdLayerSet(prefs.layers.THONGKE.name));
  cmds.push(`._RECTANG ${x0.toFixed(2)},${yTop.toFixed(2)} ${(x0 + totalW).toFixed(2)},${yBottom.toFixed(2)}`);
  for (let i = 1; i < xs.length - 1; i++) {
    const xLine = x0 + xs[i]!;
    cmds.push(`._LINE ${xLine.toFixed(2)},${(yTop - rowH).toFixed(2)} ${xLine.toFixed(2)},${yBottom.toFixed(2)} `);
  }
  for (let r = 1; r < nRows; r++) {
    const yLine = yTop - r * rowH;
    cmds.push(`._LINE ${x0.toFixed(2)},${yLine.toFixed(2)} ${(x0 + totalW).toFixed(2)},${yLine.toFixed(2)} `);
  }

  const cellCenter = (col: number, row: number): { x: string; y: string } => ({
    x: (x0 + xs[col]! + colW[col]! / 2).toFixed(2),
    y: (yTop - row * rowH - rowH / 2).toFixed(2),
  });

  cmds.push(cmdLayerSet(prefs.layers.TEXT.name));
  // Title row (Unicode tiếng Việt — font TTF như arial.ttf hỗ trợ đầy đủ)
  cmds.push(cmdTextCenter(
    (x0 + totalW / 2).toFixed(2),
    (yTop - rowH / 2).toFixed(2),
    0.5, 0, 'BẢNG 1: DIỆN TÍCH HƯ HỎNG',
  ));
  // Header
  const headers = ['Mã', 'Loại hư hỏng', 'DT (m²)', 'Số miếng'];
  for (let i = 0; i < headers.length; i++) {
    const c = cellCenter(i, 1);
    cmds.push(cmdTextCenter(c.x, c.y, 0.4, 0, headers[i]!));
  }
  // Data rows
  for (let r = 0; r < stats.byCode.length; r++) {
    const item = stats.byCode[r]!;
    const row = r + 2;
    let c = cellCenter(0, row);
    cmds.push(cmdTextCenter(c.x, c.y, 0.35, 0, String(item.code)));
    c = cellCenter(1, row);
    cmds.push(cmdTextCenter(c.x, c.y, 0.35, 0, item.name));
    c = cellCenter(2, row);
    cmds.push(cmdTextCenter(c.x, c.y, 0.35, 0, item.area.toFixed(2)));
    c = cellCenter(3, row);
    cmds.push(cmdTextCenter(c.x, c.y, 0.35, 0, String(item.pieceCount)));
  }
  // Total
  const totalRow = stats.byCode.length + 2;
  let c = cellCenter(0, totalRow);
  cmds.push(cmdTextCenter(c.x, c.y, 0.4, 0, 'TỔNG'));
  c = cellCenter(2, totalRow);
  cmds.push(cmdTextCenter(c.x, c.y, 0.4, 0, stats.totalDamage.toFixed(2)));
  c = cellCenter(3, totalRow);
  cmds.push(cmdTextCenter(c.x, c.y, 0.4, 0, String(stats.byCode.reduce((s, x) => s + x.pieceCount, 0))));

  return cmds;
}

// ============================================================
// Bảng 2: TỈ LỆ % HƯ HỎNG (Mã | Loại | % HH | % MĐ)
// ============================================================
function generateRatioTable(
  stats: ReturnType<typeof computeStatistics>,
  topY: number,
  prefs: DrawingPrefs,
  x0: number,
): string[] {
  const cmds: string[] = [];
  if (stats.byCode.length === 0) return cmds;

  const colW = [3, 18, 6, 6];
  const rowH = 1.2;
  const xs = [
    0,
    colW[0],
    colW[0] + colW[1],
    colW[0] + colW[1] + colW[2],
    colW[0] + colW[1] + colW[2] + colW[3],
  ];
  const totalW = xs[xs.length - 1]!;
  // Title + header + data + total + good row
  const nRows = stats.byCode.length + 4;
  const tableHeight = nRows * rowH;
  const yTop = topY;
  const yBottom = yTop - tableHeight;

  cmds.push(cmdLayerSet(prefs.layers.THONGKE.name));
  cmds.push(`._RECTANG ${x0.toFixed(2)},${yTop.toFixed(2)} ${(x0 + totalW).toFixed(2)},${yBottom.toFixed(2)}`);
  for (let i = 1; i < xs.length - 1; i++) {
    const xLine = x0 + xs[i]!;
    cmds.push(`._LINE ${xLine.toFixed(2)},${(yTop - rowH).toFixed(2)} ${xLine.toFixed(2)},${yBottom.toFixed(2)} `);
  }
  for (let r = 1; r < nRows; r++) {
    const yLine = yTop - r * rowH;
    cmds.push(`._LINE ${x0.toFixed(2)},${yLine.toFixed(2)} ${(x0 + totalW).toFixed(2)},${yLine.toFixed(2)} `);
  }

  const cellCenter = (col: number, row: number): { x: string; y: string } => ({
    x: (x0 + xs[col]! + colW[col]! / 2).toFixed(2),
    y: (yTop - row * rowH - rowH / 2).toFixed(2),
  });

  cmds.push(cmdLayerSet(prefs.layers.TEXT.name));
  // Title (Unicode tiếng Việt)
  cmds.push(cmdTextCenter(
    (x0 + totalW / 2).toFixed(2),
    (yTop - rowH / 2).toFixed(2),
    0.5, 0, 'BẢNG 2: TỈ LỆ % HƯ HỎNG',
  ));
  // Header
  const headers = ['Mã', 'Loại hư hỏng', '% HH', '% MĐ'];
  for (let i = 0; i < headers.length; i++) {
    const c = cellCenter(i, 1);
    cmds.push(cmdTextCenter(c.x, c.y, 0.4, 0, headers[i]!));
  }
  // Data rows
  for (let r = 0; r < stats.byCode.length; r++) {
    const item = stats.byCode[r]!;
    const row = r + 2;
    const pctHH = stats.totalDamage > 0 ? (item.area / stats.totalDamage) * 100 : 0;
    const pctMD = stats.totalRoad > 0 ? (item.area / stats.totalRoad) * 100 : 0;
    let c = cellCenter(0, row);
    cmds.push(cmdTextCenter(c.x, c.y, 0.35, 0, String(item.code)));
    c = cellCenter(1, row);
    cmds.push(cmdTextCenter(c.x, c.y, 0.35, 0, item.name));
    c = cellCenter(2, row);
    cmds.push(cmdTextCenter(c.x, c.y, 0.35, 0, pctHH.toFixed(1) + '%'));
    c = cellCenter(3, row);
    cmds.push(cmdTextCenter(c.x, c.y, 0.35, 0, pctMD.toFixed(2) + '%'));
  }
  // TỔNG HH row
  const totalRow = stats.byCode.length + 2;
  let c = cellCenter(0, totalRow);
  cmds.push(cmdTextCenter(c.x, c.y, 0.4, 0, 'TỔNG HH'));
  c = cellCenter(2, totalRow);
  cmds.push(cmdTextCenter(c.x, c.y, 0.4, 0, '100.0%'));
  c = cellCenter(3, totalRow);
  cmds.push(cmdTextCenter(c.x, c.y, 0.4, 0, stats.ratio.toFixed(2) + '%'));
  // MĐ tốt row
  const goodRow = stats.byCode.length + 3;
  c = cellCenter(0, goodRow);
  cmds.push(cmdTextCenter(c.x, c.y, 0.35, 0, 'MĐ tốt'));
  c = cellCenter(1, goodRow);
  cmds.push(cmdTextCenter(c.x, c.y, 0.35, 0, 'Mặt đường còn tốt'));
  c = cellCenter(2, goodRow);
  cmds.push(cmdTextCenter(c.x, c.y, 0.35, 0, '-'));
  c = cellCenter(3, goodRow);
  const pctGood = stats.totalRoad > 0 ? ((stats.totalRoad - stats.totalDamage) / stats.totalRoad) * 100 : 0;
  cmds.push(cmdTextCenter(c.x, c.y, 0.35, 0, pctGood.toFixed(2) + '%'));

  return cmds;
}
