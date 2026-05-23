/**
 * TrishDesign Phase 43 wave 16.x — Engine vẽ AutoCAD cho 9 loại tài sản ATGT.
 */

import type { AtgtSegment, RoadSide, AtgtTextPrefs } from './atgt-types.js';
import { defaultAtgtTextPrefs } from './atgt-types.js';
import type { AtgtSegmentItemsV2 } from './atgt-items-types.js';
import type { AtgtBlock } from './atgt-blocks-fetch.js';
import { polylineLengths, pointAtStation, blockPositionOnPolyline, type Vec2 } from './polyline-curve.js';

const SCALE_X = 1 / 1000;
const SCALE_Y = 1 / 200;

type PosFn = (station: number, offset: number, side: RoadSide, isMep: boolean) => { x: number; y: number };

function createPosMapper(segment: AtgtSegment, halfRoad: number): { pos: PosFn; segLenDraw: number; halfRoadDraw: number; usePolyline: boolean } {
  const segStart = segment.startStation;
  const segLen = segment.endStation - segStart;
  const mode = segment.drawMode ?? 'duoithang';
  const hasPolyline = mode === 'polyline' && Array.isArray(segment.polylineVertices) && segment.polylineVertices.length >= 2;
  if (hasPolyline) {
    const vertices = segment.polylineVertices as Array<[number, number]>;
    const precomp = polylineLengths(vertices as Vec2[]);
    const pos: PosFn = (station, offset, side, isMep) => {
      const sLocal = station - segStart;
      let signed: number;
      if (side === 'center') { signed = 0; }
      else {
        const sign = side === 'left' ? 1 : -1;
        const yReal = isMep ? (halfRoad - offset) : offset;
        signed = sign * yReal;
      }
      const p = blockPositionOnPolyline(vertices as Vec2[], sLocal, signed, precomp);
      return { x: p.x, y: p.y };
    };
    return { pos, segLenDraw: precomp.total, halfRoadDraw: halfRoad, usePolyline: true };
  }
  const pos: PosFn = (station, offset, side, isMep) => {
    const x = (station - segStart) * SCALE_X;
    let y: number;
    if (side === 'center') { y = 0; }
    else {
      const sign = side === 'left' ? 1 : -1;
      const yReal = isMep ? (halfRoad - offset) : offset;
      y = sign * yReal * SCALE_Y;
    }
    return { x, y };
  };
  return { pos, segLenDraw: segLen * SCALE_X, halfRoadDraw: halfRoad * SCALE_Y, usePolyline: false };
}

function lookupFileName(label: string, blocks: AtgtBlock[]): string | null {
  if (!label) return null;
  const b = blocks.find((bk) => bk.label === label || bk.id === label);
  return b?.fileName ?? null;
}

function lookupBlock(label: string, blocks: AtgtBlock[]): AtgtBlock | null {
  if (!label) return null;
  return blocks.find((bk) => bk.label === label || bk.id === label) ?? null;
}

function safeBlockName(label: string): string {
  return label.replace(/[\s<>/\\":;?*|=,'`]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '') || 'UNNAMED';
}

function insertBlock(
  blockLabel: string,
  fileName: string,
  x: number, y: number, rotateDeg: number, scale: number, layer: string,
  blocksFolder?: string,
  insertedBlocks?: Set<string>,
): string[] {
  const blockName = safeBlockName(blockLabel);
  let blockArg: string;
  if (insertedBlocks && insertedBlocks.has(blockName)) { blockArg = blockName; }
  else if (blocksFolder) { blockArg = `${blockName}=${blocksFolder.replace(/\\/g, '/')}/${fileName}`; insertedBlocks?.add(blockName); }
  else { blockArg = blockName; insertedBlocks?.add(blockName); }
  return [
    `._-LAYER\nS\n${layer}\n\n`,
    `._-INSERT\n${blockArg}\n${x.toFixed(3)},${y.toFixed(3)}\n${scale.toFixed(3)}\n${scale.toFixed(3)}\n${rotateDeg.toFixed(2)}\n`,
  ];
}

function insertLyTrinhBlock(x: number, y: number, halfRoadDraw: number, stationLabel: string, rotationDeg: number, scale: number, blocksFolder?: string, insertedBlocks?: Set<string>): string[] {
  const blockName = 'LT';
  let blockArg: string;
  if (insertedBlocks && insertedBlocks.has(blockName)) { blockArg = blockName; }
  else if (blocksFolder) { blockArg = `${blockName}=${blocksFolder.replace(/\\/g, '/')}/0.LT.dwg`; insertedBlocks?.add(blockName); }
  else {
    return [
      `._-LAYER\nS\nATGT_LYTRINH\n\n`,
      `._LINE\n${x.toFixed(3)},${(y + halfRoadDraw + 0.5).toFixed(3)}\n${x.toFixed(3)},${(y - halfRoadDraw - 0.5).toFixed(3)}\n\n`,
      `._-LAYER\nS\nATGT_TEXT\n\n`,
      `._-TEXT\nJ\nMC\n${x.toFixed(3)},${(y + halfRoadDraw + 1.2).toFixed(3)}\n0.5\n${rotationDeg.toFixed(2)}\n${stationLabel}\n`,
    ];
  }
  return [
    `._-LAYER\nS\nATGT_LYTRINH\n\n`,
    `._-INSERT\n${blockArg}\n${x.toFixed(3)},${y.toFixed(3)}\n${scale.toFixed(3)}\n${scale.toFixed(3)}\n${rotationDeg.toFixed(2)}\n${stationLabel}\n`,
  ];
}

function stationToLabel(station: number): string {
  const km = Math.floor(station / 1000);
  const m = Math.round(station % 1000);
  return `Km${km}+${m.toString().padStart(3, '0')}`;
}

export function generateAtgtSegmentCommands(segment: AtgtSegment, blocks: AtgtBlock[], blocksFolder?: string, textPrefs?: AtgtTextPrefs): string[] {
  const tp: AtgtTextPrefs = textPrefs ?? defaultAtgtTextPrefs();
  const insertedBlocks = new Set<string>();
  const cmds: string[] = [];
  const items: AtgtSegmentItemsV2 = segment.itemsV2 ?? {};
  const segStart = segment.startStation;
  const halfRoad = segment.roadWidth / 2;
  const { pos, segLenDraw, halfRoadDraw, usePolyline } = createPosMapper(segment, halfRoad);
  void halfRoadDraw;

  const stationTextSize = tp.stationHeight;
  const leaderTextSize = tp.blockTextHeight;
  const leaderOffset = leaderTextSize * 3;
  void stationTextSize;

  const ltLen = tp.lyTrinhBlockLength ?? 0;
  const bbH = tp.bienBaoHeight ?? 0;
  const ltLenForSide = (side: RoadSide): number => ltLen + (side === 'right' ? bbH : 0);

  cmds.push('._FILEDIA\n0\n');
  cmds.push('._CMDDIA\n0\n');
  cmds.push('._ATTREQ\n1\n');
  cmds.push('._ATTDIA\n0\n');
  cmds.push(`._-STYLE\n${tp.styleName}\n${tp.fontFile}\n0\n${tp.widthFactor.toFixed(2)}\n0\nN\nN\nN\n`);
  cmds.push(`._TEXTSIZE\n${leaderTextSize.toFixed(3)}\n`);
  cmds.push(`._DIMTXT\n${leaderTextSize.toFixed(3)}\n`);
  cmds.push(`._DIMASZ\n${(leaderTextSize * 1.2).toFixed(3)}\n`);
  cmds.push('._-LAYER\nM\nATGT_TIM\nC\n2\nATGT_TIM\n\n');
  cmds.push('._-LAYER\nM\nATGT_MEP\nC\n3\nATGT_MEP\n\n');
  cmds.push('._-LAYER\nM\nATGT_LYTRINH\nC\n7\nATGT_LYTRINH\n\n');
  cmds.push('._-LAYER\nM\nATGT_BLOCK\nC\n7\nATGT_BLOCK\n\n');
  cmds.push('._-LAYER\nM\nATGT_LINETYPE\nC\n4\nATGT_LINETYPE\n\n');
  cmds.push('._-LAYER\nM\nATGT_LEADER\nC\n6\nATGT_LEADER\n\n');
  cmds.push('._-LAYER\nM\nATGT_TEXT\nC\n7\nATGT_TEXT\n\n');

  if (!usePolyline) {
    cmds.push('._-LAYER\nS\nATGT_TIM\n\n');
    cmds.push(`._LINE\n0,0\n${segLenDraw.toFixed(3)},0\n\n`);
    cmds.push('._-LAYER\nS\nATGT_MEP\n\n');
    cmds.push(`._LINE\n0,${halfRoadDraw.toFixed(3)}\n${segLenDraw.toFixed(3)},${halfRoadDraw.toFixed(3)}\n\n`);
    cmds.push(`._LINE\n0,${(-halfRoadDraw).toFixed(3)}\n${segLenDraw.toFixed(3)},${(-halfRoadDraw).toFixed(3)}\n\n`);
  } else {
    cmds.push('._-LAYER\nS\nATGT_MEP\n\n');
    const vertices = segment.polylineVertices as Array<[number, number]>;
    const precomp = polylineLengths(vertices as Vec2[]);
    const edgeL: Array<[number, number]> = [];
    const edgeR: Array<[number, number]> = [];
    for (const sCum of precomp.cumLens) {
      const cp = pointAtStation(vertices as Vec2[], sCum, precomp);
      edgeL.push([cp.x + cp.normal[0] * halfRoad, cp.y + cp.normal[1] * halfRoad]);
      edgeR.push([cp.x + cp.normal[0] * -halfRoad, cp.y + cp.normal[1] * -halfRoad]);
    }
    if (edgeL.length >= 2) {
      let plineCmd = '._PLINE\n';
      for (const [x, y] of edgeL) plineCmd += `${x.toFixed(3)},${y.toFixed(3)}\n`;
      plineCmd += '\n';
      cmds.push(plineCmd);
    }
    if (edgeR.length >= 2) {
      let plineCmd = '._PLINE\n';
      for (const [x, y] of edgeR) plineCmd += `${x.toFixed(3)},${y.toFixed(3)}\n`;
      plineCmd += '\n';
      cmds.push(plineCmd);
    }
  }

  const tangentDegAt = (station: number): number => {
    if (!usePolyline) return 0;
    const vertices = segment.polylineVertices as Array<[number, number]>;
    const precomp = polylineLengths(vertices as Vec2[]);
    const cp = pointAtStation(vertices as Vec2[], station - segStart, precomp);
    return (cp.tangentAngle * 180) / Math.PI;
  };
  const perpDegAt = (station: number, side: RoadSide): number =>
    tangentDegAt(station) + (side === 'right' ? 180 : 0);
  const paraDegAt = (station: number, side: RoadSide): number =>
    tangentDegAt(station) + 90 + (side === 'right' ? 180 : 0);
  const blockDegAt = (station: number, b: AtgtBlock | null | undefined, side: RoadSide): number =>
    (b?.orientation === 'parallel') ? paraDegAt(station, side) : perpDegAt(station, side);

  // Phase 43 wave 16.23 — Leader = SOLID arrow + PLINE 3 đỉnh (group lại 1 object) + MTEXT riêng.
  //   - Group chỉ chứa SOLID + PLINE (= leader shape). TEXT/MTEXT vẽ riêng để edit dễ.
  //   - Text dùng MTEXT (qua TEXT justify MC), căn giữa segment ngang BC, offset khỏi line.
  let ldrCounter = 0;
  const ldr = (sx: number, sy: number, side: RoadSide, text: string, station: number): string[] => {
    if (!text) return [];
    const tanDeg = tangentDegAt(station);
    const tanRad = (tanDeg * Math.PI) / 180;
    const nx = -Math.sin(tanRad);
    const ny = Math.cos(tanRad);
    const tx = Math.cos(tanRad);
    const ty = Math.sin(tanRad);
    const sign = side === 'right' ? -1 : 1;
    const bx = sx + sign * nx * leaderOffset;
    const by = sy + sign * ny * leaderOffset;
    const tw = Math.max(text.length * leaderTextSize * 0.7, leaderTextSize * 4);
    const cx = bx + tx * tw;
    const cy = by + ty * tw;
    const ah = leaderTextSize * 0.6;
    const ang = Math.atan2(by - sy, bx - sx);
    const aL = ang + (15 * Math.PI / 180);
    const aR = ang - (15 * Math.PI / 180);
    const aLx = sx + Math.cos(aL) * ah;
    const aLy = sy + Math.sin(aL) * ah;
    const aRx = sx + Math.cos(aR) * ah;
    const aRy = sy + Math.sin(aR) * ah;
    // Text căn giữa BC + offset normal lớn (1.2 × textSize để không đè line)
    const midBCx = (bx + cx) / 2;
    const midBCy = (by + cy) / 2;
    const textOff = leaderTextSize * 1.2;
    const tcx = midBCx + nx * sign * textOff;
    const tcy = midBCy + ny * sign * textOff;
    ldrCounter++;
    const grpName = `ATGT_LDR_${Math.round(station)}_${ldrCounter}`;
    return [
      `._-LAYER\nS\nATGT_LEADER\n\n`,
      // SOLID arrow tam giác đặc tại A
      `._SOLID\n${sx.toFixed(3)},${sy.toFixed(3)}\n${aLx.toFixed(3)},${aLy.toFixed(3)}\n${aRx.toFixed(3)},${aRy.toFixed(3)}\n\n\n`,
      // PLINE 3 đỉnh A → B → C
      `._PLINE\n${sx.toFixed(3)},${sy.toFixed(3)}\n${bx.toFixed(3)},${by.toFixed(3)}\n${cx.toFixed(3)},${cy.toFixed(3)}\n\n`,
      // GROUP chỉ SOLID + PLINE (2 last entities) — leader shape
      `._-GROUP\n${grpName}\n\nL\nL\n\n`,
      // MTEXT/TEXT căn giữa BC + offset normal, rotation = tangent. Entity riêng (không trong group).
      `._-LAYER\nS\nATGT_TEXT\n\n`,
      `._-TEXT\nJ\nMC\n${tcx.toFixed(3)},${tcy.toFixed(3)}\n${leaderTextSize.toFixed(3)}\n${tanDeg.toFixed(2)}\n${text}\n`,
    ];
  };

  // Phase 43 wave 16.17 — Cọc 0.LT đặt TẠI vị trí cách tim của tài sản (baseOffset = cachTim/cachMep)
  const ltAt = (station: number, side: RoadSide, baseOffset: number, label?: string): string[] => {
    const lt = pos(station, baseOffset, side, false);
    return insertLyTrinhBlock(lt.x, lt.y, halfRoadDraw, label ?? stationToLabel(station), perpDegAt(station, side), (tp.blockScale ?? 1), blocksFolder, insertedBlocks);
  };

  for (const it of items.bienBao ?? []) {
    if (it.station < segStart || it.station > segment.endStation) continue;
    const b = lookupBlock(it.tenBienBao, blocks);
    const { x, y } = pos(it.station, it.cachTim + ltLenForSide(it.side), it.side, false);
    cmds.push(...ltAt(it.station, it.side, it.cachTim));
    if (b?.fileName) cmds.push(...insertBlock(b.label || b.id, b.fileName, x, y, blockDegAt(it.station, b, it.side), (tp.blockScale ?? 1), 'ATGT_BLOCK', blocksFolder, insertedBlocks));
    cmds.push(...ldr(x, y, it.side, it.hienTrang, it.station));
  }

  for (const it of items.vachSon ?? []) {
    const file = lookupFileName(it.loaiVachSon, blocks);
    const p1 = pos(it.station, it.cachTim, it.side, false);
    const p2 = pos(it.stationEnd, it.cachTim, it.side, false);
    cmds.push(...ltAt(it.station, it.side, it.cachTim));
    if (it.stationEnd !== it.station) cmds.push(...ltAt(it.stationEnd, it.side, it.cachTim));
    cmds.push('._-LAYER\nS\nATGT_LINETYPE\n\n');
    cmds.push(`._PLINE\n${p1.x.toFixed(3)},${p1.y.toFixed(3)}\n${p2.x.toFixed(3)},${p2.y.toFixed(3)}\n\n`);
    if (it.hienTrang) {
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;
      const midSta = (it.station + it.stationEnd) / 2;
      cmds.push(...ldr(midX, midY, it.side, `${it.loaiVachSon}: ${it.hienTrang}`, midSta));
    }
    void file;
  }

  for (const it of items.denTinHieu ?? []) {
    if (it.station < segStart || it.station > segment.endStation) continue;
    const b = lookupBlock(it.tenDen, blocks);
    const { x, y } = pos(it.station, it.cachMep + ltLenForSide(it.side), it.side, true);
    cmds.push(...ltAt(it.station, it.side, it.cachMep));
    if (b?.fileName) cmds.push(...insertBlock(b.label || b.id, b.fileName, x, y, blockDegAt(it.station, b, it.side), (tp.blockScale ?? 1), 'ATGT_BLOCK', blocksFolder, insertedBlocks));
    cmds.push(...ldr(x, y, it.side, it.hienTrang, it.station));
  }

  for (const it of items.hoLanMem ?? []) {
    const file = lookupFileName(it.loaiHoLan, blocks);
    const p1 = pos(it.station, it.cachMep, it.side, true);
    const p2 = pos(it.stationEnd, it.cachMep, it.side, true);
    cmds.push(...ltAt(it.station, it.side, it.cachMep));
    if (it.stationEnd !== it.station) cmds.push(...ltAt(it.stationEnd, it.side, it.cachMep));
    cmds.push('._-LAYER\nS\nATGT_LINETYPE\n\n');
    cmds.push(`._PLINE\n${p1.x.toFixed(3)},${p1.y.toFixed(3)}\n${p2.x.toFixed(3)},${p2.y.toFixed(3)}\n\n`);
    if (it.soKhoang || it.hienTrang) {
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;
      const midSta = (it.station + it.stationEnd) / 2;
      const txt = [it.soKhoang, it.hienTrang].filter(Boolean).join(' · ');
      cmds.push(...ldr(midX, midY, it.side, txt, midSta));
    }
    void file;
  }

  for (const it of items.cocTieu ?? []) {
    const b = lookupBlock(it.loaiCocTieu, blocks);
    const positions = spreadPositions(it.station, it.stationEnd, it.soLuong, it.cachKhoang);
    for (const st of positions) {
      if (st < segStart || st > segment.endStation) continue;
      const { x, y } = pos(st, it.cachMep + ltLenForSide(it.side), it.side, true);
      if (b?.fileName) cmds.push(...insertBlock(b.label || b.id, b.fileName, x, y, blockDegAt(st, b, it.side), (tp.blockScale ?? 1), 'ATGT_BLOCK', blocksFolder, insertedBlocks));
    }
    cmds.push(...ltAt(it.station, it.side, it.cachMep));
    if (it.stationEnd > 0 && it.stationEnd !== it.station) cmds.push(...ltAt(it.stationEnd, it.side, it.cachMep));
    if (it.hienTrang) {
      const sta = positions[0] ?? it.station;
      const { x, y } = pos(sta, it.cachMep + ltLenForSide(it.side), it.side, true);
      cmds.push(...ldr(x, y, it.side, it.hienTrang, sta));
    }
  }

  for (const it of items.ranhDoc ?? []) {
    const file = lookupFileName(it.loaiRanhDoc, blocks);
    const p1 = pos(it.station, it.cachMep, it.side, true);
    const p2 = pos(it.stationEnd, it.cachMep, it.side, true);
    cmds.push(...ltAt(it.station, it.side, it.cachMep));
    if (it.stationEnd !== it.station) cmds.push(...ltAt(it.stationEnd, it.side, it.cachMep));
    cmds.push('._-LAYER\nS\nATGT_LINETYPE\n\n');
    cmds.push(`._PLINE\n${p1.x.toFixed(3)},${p1.y.toFixed(3)}\n${p2.x.toFixed(3)},${p2.y.toFixed(3)}\n\n`);
    if (it.loaiRanhDoc || it.hienTrang) {
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;
      const midSta = (it.station + it.stationEnd) / 2;
      const txt = [it.loaiRanhDoc, it.hienTrang].filter(Boolean).join(' · ');
      cmds.push(...ldr(midX, midY, it.side, txt, midSta));
    }
    void file;
  }

  for (const it of items.congNgang ?? []) {
    if (it.station < segStart || it.station > segment.endStation) continue;
    const b = lookupBlock(it.loaiCongNgang, blocks);
    const { x, y } = pos(it.station, 0, it.side === 'center' ? 'center' : it.side, false);
    cmds.push(...ltAt(it.station, it.side, 0));
    if (b?.fileName) cmds.push(...insertBlock(b.label || b.id, b.fileName, x, y, blockDegAt(it.station, b, it.side), (tp.blockScale ?? 1), 'ATGT_BLOCK', blocksFolder, insertedBlocks));
    cmds.push(...ldr(x, y, it.side, it.hienTrang ? `${it.loaiCongNgang}: ${it.hienTrang}` : '', it.station));
  }

  for (const it of items.tieuPhanQuang ?? []) {
    const b = lookupBlock(it.loaiTPQ, blocks);
    const positions = spreadPositions(it.station, it.stationEnd, it.soLuong, it.cachKhoang);
    for (const st of positions) {
      if (st < segStart || st > segment.endStation) continue;
      const { x, y } = pos(st, it.cachMep + ltLenForSide(it.side), it.side, true);
      if (b?.fileName) cmds.push(...insertBlock(b.label || b.id, b.fileName, x, y, blockDegAt(st, b, it.side), (tp.blockScale ?? 1), 'ATGT_BLOCK', blocksFolder, insertedBlocks));
    }
    cmds.push(...ltAt(it.station, it.side, it.cachMep));
    if (it.stationEnd > 0 && it.stationEnd !== it.station) cmds.push(...ltAt(it.stationEnd, it.side, it.cachMep));
    if (it.hienTrang) {
      const sta = positions[0] ?? it.station;
      const { x, y } = pos(sta, it.cachMep + ltLenForSide(it.side), it.side, true);
      cmds.push(...ldr(x, y, it.side, it.hienTrang, sta));
    }
  }

  for (const it of items.guongCauLoi ?? []) {
    if (it.station < segStart || it.station > segment.endStation) continue;
    const b = lookupBlock(it.tenGuong, blocks);
    const { x, y } = pos(it.station, it.cachTim + ltLenForSide(it.side), it.side, false);
    cmds.push(...ltAt(it.station, it.side, it.cachTim));
    if (b?.fileName) cmds.push(...insertBlock(b.label || b.id, b.fileName, x, y, blockDegAt(it.station, b, it.side), (tp.blockScale ?? 1), 'ATGT_BLOCK', blocksFolder, insertedBlocks));
    cmds.push(...ldr(x, y, it.side, it.hienTrang, it.station));
  }

  cmds.push('._FILEDIA\n1\n');
  cmds.push('._CMDDIA\n1\n');
  cmds.push('._ZOOM\nE\n');

  return cmds;
}

function spreadPositions(stationStart: number, stationEnd: number, soLuong: number, cachKhoang: number): number[] {
  if (soLuong <= 0) return [];
  const out: number[] = [];
  if (stationEnd === 0 || stationEnd <= stationStart) {
    const dx = Math.max(cachKhoang, 0.1);
    for (let i = 0; i < soLuong; i++) out.push(stationStart + i * dx);
  } else {
    const dx = (stationEnd - stationStart) / (soLuong + 1);
    for (let i = 1; i <= soLuong; i++) out.push(stationStart + i * dx);
  }
  return out;
}

export function getLyTrinhBlock(blocks: AtgtBlock[]): AtgtBlock | null {
  return blocks.find((b) => b.fileName === '0.LT.dwg' || b.fileName === '0.LT' || b.id === '0_lt') ?? null;
}
