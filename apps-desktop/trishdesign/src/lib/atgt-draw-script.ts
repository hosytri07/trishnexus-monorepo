/**
 * TrishDesign Phase 43 wave 10.3 — Engine vẽ AutoCAD cho 9 loại tài sản ATGT.
 *
 * Workflow:
 *   1. Vẽ trục tuyến (line từ startStation → endStation) tại Y=0
 *   2. Vẽ mép trái + mép phải theo roadWidth
 *   3. Với mỗi item theo 9 loại:
 *      - INSERT block 0.LT tại lý trình (line lý trình)
 *      - INSERT block tài sản tại offset cách tim/mép
 *      - LEADER + text "Hiện trạng" (nếu có)
 *
 * 9 loại logic:
 *   - BienBao, DenTinHieu, CongNgang, GuongCauLoi: 1 INSERT block đơn
 *   - VachSon, HoLanMem, RanhDoc: PLINE từ station → stationEnd, offset cachTim/cachMep
 *   - CocTieu, TieuPhanQuang: rải nhiều block theo công thức
 *
 * Scale: 1:1000 X / 1:200 Y (giống HHMĐ bình đồ duỗi thẳng)
 */

import type { AtgtSegment, RoadSide } from './atgt-types.js';
import type {
  AtgtSegmentItemsV2,
  BienBaoItemV2, VachSonItemV2, DenTinHieuItemV2,
  HoLanMemItemV2, CocTieuItemV2, RanhDocItemV2,
  CongNgangItemV2, TieuPhanQuangItemV2, GuongCauLoiItemV2,
} from './atgt-items-types.js';
import type { AtgtBlock } from './atgt-blocks-fetch.js';

const SCALE_X = 1 / 1000;   // 1m thực = 1mm vẽ
const SCALE_Y = 1 / 200;    // exaggerate Y

/** Convert lý trình + cách tim/mép + side → (x, y) drawing units */
function toXY(station: number, segStart: number, offset: number, side: RoadSide, isMep: boolean, halfRoad: number): { x: number; y: number } {
  const x = (station - segStart) * SCALE_X;
  let y: number;
  if (side === 'center') {
    y = 0;
  } else {
    // Cách tim: offset trực tiếp
    // Cách mép: halfRoad - offset (từ mép vào trong)
    const sign = side === 'left' ? 1 : -1;
    const yReal = isMep ? (halfRoad - offset) : offset;
    y = sign * yReal * SCALE_Y;
  }
  return { x, y };
}

/** Lookup file .dwg name from label (Tên biển báo / Loại vạch sơn...) */
function lookupFileName(label: string, blocks: AtgtBlock[]): string | null {
  if (!label) return null;
  const b = blocks.find((bk) => bk.label === label || bk.id === label);
  return b?.fileName ?? null;
}

/** Insert block command — fileName phải có .dwg */
function insertBlock(fileName: string, x: number, y: number, rotateDeg: number, scale: number, layer: string): string[] {
  return [
    `._-LAYER\nS\n${layer}\n\n`,
    `._-INSERT\n${fileName}\n${x.toFixed(3)},${y.toFixed(3)}\n${scale.toFixed(3)}\n${scale.toFixed(3)}\n${rotateDeg.toFixed(2)}\n`,
  ];
}

/** Insert block 0.LT tại lý trình (line lý trình + text Km) — block attribute */
function insertLyTrinhBlock(x: number, halfRoadDraw: number, stationLabel: string): string[] {
  // Block 0.LT cho phép attribute Km label. Nếu file 0.LT có attribute (xem mẫu hình),
  // INSERT sẽ prompt cho attribute. Gửi attribute value sau insert point.
  // Cú pháp: -INSERT 0.LT x,y scale rotation [attribute values...]
  // Tạm thời gửi mặc định scale=1, rotation=0 — block 0.LT tự vẽ line dọc + text.
  // Để fallback nếu file 0.LT chưa load: vẽ thủ công.
  return [
    `._-LAYER\nS\nATGT_LYTRINH\n\n`,
    // Line dọc thay cho block 0.LT (fallback nếu chưa có file)
    `._LINE\n${x.toFixed(3)},${(halfRoadDraw + 0.5).toFixed(3)}\n${x.toFixed(3)},${(-halfRoadDraw - 0.5).toFixed(3)}\n\n`,
    // Text label Km
    `._-LAYER\nS\nATGT_TEXT\n\n`,
    `._-TEXT\nJ\nMC\n${x.toFixed(3)},${(halfRoadDraw + 1.2).toFixed(3)}\n0.35\n90\n${stationLabel}\n`,
  ];
}

/** LEADER + text hiện trạng */
function drawLeader(fromX: number, fromY: number, toX: number, toY: number, text: string): string[] {
  if (!text) return [];
  return [
    `._-LAYER\nS\nATGT_LEADER\n\n`,
    `._LEADER\n${fromX.toFixed(3)},${fromY.toFixed(3)}\n${toX.toFixed(3)},${toY.toFixed(3)}\n\nA\n${text}\n\n`,
  ];
}

function stationToLabel(station: number): string {
  const km = Math.floor(station / 1000);
  const m = Math.round(station % 1000);
  return `Km${km}+${m.toString().padStart(3, '0')}`;
}

/**
 * Generate AutoCAD commands cho tất cả items trong 1 segment (mode bình đồ duỗi thẳng).
 */
export function generateAtgtSegmentCommands(
  segment: AtgtSegment,
  blocks: AtgtBlock[],
): string[] {
  const cmds: string[] = [];
  const items: AtgtSegmentItemsV2 = segment.itemsV2 ?? {};
  const segStart = segment.startStation;
  const segLen = segment.endStation - segStart;
  const halfRoad = segment.roadWidth / 2;
  const halfRoadDraw = halfRoad * SCALE_Y;
  const segLenDraw = segLen * SCALE_X;
  const isMep = (segment.cachTimMode ?? 'tim') === 'mep';

  // ============ Setup ============
  cmds.push('._FILEDIA\n0\n');
  cmds.push('._CMDDIA\n0\n');
  cmds.push('._-LAYER\nM\nATGT_TIM\nC\n2\nATGT_TIM\n\n');
  cmds.push('._-LAYER\nM\nATGT_MEP\nC\n3\nATGT_MEP\n\n');
  cmds.push('._-LAYER\nM\nATGT_LYTRINH\nC\n7\nATGT_LYTRINH\n\n');
  cmds.push('._-LAYER\nM\nATGT_BLOCK\nC\n7\nATGT_BLOCK\n\n');
  cmds.push('._-LAYER\nM\nATGT_LINETYPE\nC\n4\nATGT_LINETYPE\n\n');
  cmds.push('._-LAYER\nM\nATGT_LEADER\nC\n6\nATGT_LEADER\n\n');
  cmds.push('._-LAYER\nM\nATGT_TEXT\nC\n7\nATGT_TEXT\n\n');

  // ============ Trục tuyến + mép ============
  cmds.push('._-LAYER\nS\nATGT_TIM\n\n');
  cmds.push(`._LINE\n0,0\n${segLenDraw.toFixed(3)},0\n\n`);

  cmds.push('._-LAYER\nS\nATGT_MEP\n\n');
  cmds.push(`._LINE\n0,${halfRoadDraw.toFixed(3)}\n${segLenDraw.toFixed(3)},${halfRoadDraw.toFixed(3)}\n\n`);
  cmds.push(`._LINE\n0,${(-halfRoadDraw).toFixed(3)}\n${segLenDraw.toFixed(3)},${(-halfRoadDraw).toFixed(3)}\n\n`);

  // ============ 1. Biển báo ============
  for (const it of items.bienBao ?? []) {
    if (it.station < segStart || it.station > segment.endStation) continue;
    const file = lookupFileName(it.tenBienBao, blocks);
    const { x, y } = toXY(it.station, segStart, it.cachTim, it.side, false, halfRoad);
    cmds.push(...insertLyTrinhBlock(x, halfRoadDraw, stationToLabel(it.station)));
    if (file) cmds.push(...insertBlock(file, x, y, 90, 1, 'ATGT_BLOCK'));
    if (it.hienTrang) {
      const ldrEndX = x + 1.5;
      const ldrEndY = y + (it.side === 'left' ? 1 : -1);
      cmds.push(...drawLeader(x, y, ldrEndX, ldrEndY, it.hienTrang));
    }
  }

  // ============ 2. Vạch sơn — PLINE từ station → stationEnd offset cachTim ============
  for (const it of items.vachSon ?? []) {
    const file = lookupFileName(it.loaiVachSon, blocks);
    const p1 = toXY(it.station, segStart, it.cachTim, it.side, false, halfRoad);
    const p2 = toXY(it.stationEnd, segStart, it.cachTim, it.side, false, halfRoad);
    cmds.push(...insertLyTrinhBlock(p1.x, halfRoadDraw, stationToLabel(it.station)));
    if (it.stationEnd !== it.station) {
      cmds.push(...insertLyTrinhBlock(p2.x, halfRoadDraw, stationToLabel(it.stationEnd)));
    }
    cmds.push('._-LAYER\nS\nATGT_LINETYPE\n\n');
    cmds.push(`._PLINE\n${p1.x.toFixed(3)},${p1.y.toFixed(3)}\n${p2.x.toFixed(3)},${p2.y.toFixed(3)}\n\n`);
    if (it.hienTrang) {
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;
      cmds.push(...drawLeader(midX, midY, midX + 1, midY + (it.side === 'left' ? 1 : -1), `${it.loaiVachSon}: ${it.hienTrang}`));
    }
    // file block: chỉ giải thích (linetype) — không insert
    void file;
  }

  // ============ 3. Đèn tín hiệu ============
  for (const it of items.denTinHieu ?? []) {
    if (it.station < segStart || it.station > segment.endStation) continue;
    const file = lookupFileName(it.tenDen, blocks);
    const { x, y } = toXY(it.station, segStart, it.cachMep, it.side, true, halfRoad);
    cmds.push(...insertLyTrinhBlock(x, halfRoadDraw, stationToLabel(it.station)));
    if (file) cmds.push(...insertBlock(file, x, y, 0, 1, 'ATGT_BLOCK'));
    if (it.hienTrang) {
      cmds.push(...drawLeader(x, y, x + 1.5, y + (it.side === 'left' ? 1 : -1), it.hienTrang));
    }
  }

  // ============ 4. Hộ lan mềm — PLINE từ station → stationEnd offset cachMep ============
  for (const it of items.hoLanMem ?? []) {
    const file = lookupFileName(it.loaiHoLan, blocks);
    const p1 = toXY(it.station, segStart, it.cachMep, it.side, true, halfRoad);
    const p2 = toXY(it.stationEnd, segStart, it.cachMep, it.side, true, halfRoad);
    cmds.push(...insertLyTrinhBlock(p1.x, halfRoadDraw, stationToLabel(it.station)));
    if (it.stationEnd !== it.station) {
      cmds.push(...insertLyTrinhBlock(p2.x, halfRoadDraw, stationToLabel(it.stationEnd)));
    }
    cmds.push('._-LAYER\nS\nATGT_LINETYPE\n\n');
    cmds.push(`._PLINE\n${p1.x.toFixed(3)},${p1.y.toFixed(3)}\n${p2.x.toFixed(3)},${p2.y.toFixed(3)}\n\n`);
    if (it.soKhoang || it.hienTrang) {
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;
      const txt = [it.soKhoang, it.hienTrang].filter(Boolean).join(' · ');
      cmds.push(...drawLeader(midX, midY, midX + 1, midY + (it.side === 'left' ? 1 : -1), txt));
    }
    void file;
  }

  // ============ 5. Cọc tiêu — rải block theo công thức ============
  for (const it of items.cocTieu ?? []) {
    const file = lookupFileName(it.loaiCocTieu, blocks);
    const positions = spreadPositions(it.station, it.stationEnd, it.soLuong, it.cachKhoang);
    for (const st of positions) {
      if (st < segStart || st > segment.endStation) continue;
      const { x, y } = toXY(st, segStart, it.cachMep, it.side, true, halfRoad);
      if (file) cmds.push(...insertBlock(file, x, y, 0, 1, 'ATGT_BLOCK'));
    }
    // Vẽ block 0.LT tại đầu + cuối
    const p1 = toXY(it.station, segStart, 0, 'center', false, halfRoad);
    cmds.push(...insertLyTrinhBlock(p1.x, halfRoadDraw, stationToLabel(it.station)));
    if (it.stationEnd > 0 && it.stationEnd !== it.station) {
      const p2 = toXY(it.stationEnd, segStart, 0, 'center', false, halfRoad);
      cmds.push(...insertLyTrinhBlock(p2.x, halfRoadDraw, stationToLabel(it.stationEnd)));
    }
    if (it.hienTrang) {
      const { x, y } = toXY(positions[0] ?? it.station, segStart, it.cachMep, it.side, true, halfRoad);
      cmds.push(...drawLeader(x, y, x + 1.5, y + (it.side === 'left' ? 1 : -1), it.hienTrang));
    }
  }

  // ============ 6. Rãnh dọc — PLINE từ station → stationEnd offset cachMep ============
  for (const it of items.ranhDoc ?? []) {
    const file = lookupFileName(it.loaiRanhDoc, blocks);
    const p1 = toXY(it.station, segStart, it.cachMep, it.side, true, halfRoad);
    const p2 = toXY(it.stationEnd, segStart, it.cachMep, it.side, true, halfRoad);
    cmds.push(...insertLyTrinhBlock(p1.x, halfRoadDraw, stationToLabel(it.station)));
    if (it.stationEnd !== it.station) {
      cmds.push(...insertLyTrinhBlock(p2.x, halfRoadDraw, stationToLabel(it.stationEnd)));
    }
    cmds.push('._-LAYER\nS\nATGT_LINETYPE\n\n');
    cmds.push(`._PLINE\n${p1.x.toFixed(3)},${p1.y.toFixed(3)}\n${p2.x.toFixed(3)},${p2.y.toFixed(3)}\n\n`);
    if (it.loaiRanhDoc || it.hienTrang) {
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;
      const txt = [it.loaiRanhDoc, it.hienTrang].filter(Boolean).join(' · ');
      cmds.push(...drawLeader(midX, midY, midX + 1, midY + (it.side === 'left' ? 1 : -1), txt));
    }
    void file;
  }

  // ============ 7. Cống ngang ============
  for (const it of items.congNgang ?? []) {
    if (it.station < segStart || it.station > segment.endStation) continue;
    const file = lookupFileName(it.loaiCongNgang, blocks);
    const { x, y } = toXY(it.station, segStart, 0, it.side === 'center' ? 'center' : it.side, false, halfRoad);
    cmds.push(...insertLyTrinhBlock(x, halfRoadDraw, stationToLabel(it.station)));
    if (file) cmds.push(...insertBlock(file, x, y, 0, 1, 'ATGT_BLOCK'));
    if (it.hienTrang) {
      cmds.push(...drawLeader(x, y, x + 1.5, y + 1, `${it.loaiCongNgang}: ${it.hienTrang}`));
    }
  }

  // ============ 8. Tiêu phản quang — rải block giống Cọc tiêu ============
  for (const it of items.tieuPhanQuang ?? []) {
    const file = lookupFileName(it.loaiTPQ, blocks);
    const positions = spreadPositions(it.station, it.stationEnd, it.soLuong, it.cachKhoang);
    for (const st of positions) {
      if (st < segStart || st > segment.endStation) continue;
      const { x, y } = toXY(st, segStart, it.cachMep, it.side, true, halfRoad);
      if (file) cmds.push(...insertBlock(file, x, y, 0, 1, 'ATGT_BLOCK'));
    }
    const p1 = toXY(it.station, segStart, 0, 'center', false, halfRoad);
    cmds.push(...insertLyTrinhBlock(p1.x, halfRoadDraw, stationToLabel(it.station)));
    if (it.stationEnd > 0 && it.stationEnd !== it.station) {
      const p2 = toXY(it.stationEnd, segStart, 0, 'center', false, halfRoad);
      cmds.push(...insertLyTrinhBlock(p2.x, halfRoadDraw, stationToLabel(it.stationEnd)));
    }
    if (it.hienTrang) {
      const { x, y } = toXY(positions[0] ?? it.station, segStart, it.cachMep, it.side, true, halfRoad);
      cmds.push(...drawLeader(x, y, x + 1.5, y + (it.side === 'left' ? 1 : -1), it.hienTrang));
    }
  }

  // ============ 9. Gương cầu lồi ============
  for (const it of items.guongCauLoi ?? []) {
    if (it.station < segStart || it.station > segment.endStation) continue;
    const file = lookupFileName(it.tenGuong, blocks);
    const { x, y } = toXY(it.station, segStart, it.cachTim, it.side, false, halfRoad);
    cmds.push(...insertLyTrinhBlock(x, halfRoadDraw, stationToLabel(it.station)));
    if (file) cmds.push(...insertBlock(file, x, y, 0, 1, 'ATGT_BLOCK'));
    if (it.hienTrang) {
      cmds.push(...drawLeader(x, y, x + 1.5, y + (it.side === 'left' ? 1 : -1), it.hienTrang));
    }
  }

  // Cleanup
  cmds.push('._FILEDIA\n1\n');
  cmds.push('._CMDDIA\n1\n');
  cmds.push('._ZOOM\nE\n');

  return cmds;
}

/**
 * Rải vị trí block theo Cọc tiêu / Tiêu phản quang.
 * - Nếu stationEnd = 0: rải soLuong cọc cách nhau cachKhoang (m)
 * - Nếu có cả 2 lý trình: rải đều (stationEnd - station) / (soLuong + 1)
 */
function spreadPositions(stationStart: number, stationEnd: number, soLuong: number, cachKhoang: number): number[] {
  if (soLuong <= 0) return [];
  const out: number[] = [];
  if (stationEnd === 0 || stationEnd <= stationStart) {
    // Rải theo cách khoảng từ station_start
    const dx = Math.max(cachKhoang, 0.1);
    for (let i = 0; i < soLuong; i++) {
      out.push(stationStart + i * dx);
    }
  } else {
    // Rải đều
    const dx = (stationEnd - stationStart) / (soLuong + 1);
    for (let i = 1; i <= soLuong; i++) {
      out.push(stationStart + i * dx);
    }
  }
  return out;
}

/** Lookup file 0.LT để verify có tồn tại trong blocks không (warn nếu thiếu) */
export function getLyTrinhBlock(blocks: AtgtBlock[]): AtgtBlock | null {
  return blocks.find((b) => b.fileName === '0.LT.dwg' || b.fileName === '0.LT' || b.id === '0_lt') ?? null;
}
