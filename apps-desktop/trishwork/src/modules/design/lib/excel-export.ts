/**
 * TrishDesign — Excel export thật (.xlsx) với 3 sheets riêng biệt.
 *
 * Sheets:
 *   1. "Diện tích"      — diện tích hư hỏng theo segment + tổng project
 *   2. "Tỉ lệ %"        — tỉ lệ % phân bố hư hỏng theo loại
 *   3. "Chi tiết miếng" — raw data từng miếng hư hỏng
 *   4. "Lỗ khoan"       — Phase 42 wave 9 — bảng lỗ khoan flatten theo từng lớp
 *   5. "Hố đào"         — Phase 42 wave 9 — bảng hố đào flatten theo từng lớp
 *
 * Flow:
 *   1. Build workbook bằng SheetJS (xlsx package)
 *   2. Tauri save dialog → user chọn đường dẫn
 *   3. Convert workbook → Uint8Array
 *   4. Invoke Rust `save_file_bytes` để ghi
 */

import * as XLSX from 'xlsx';
import { save } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import {
  type Project,
  type DamageCode,
  formatStation,
} from '../types.js';
import { computeStatistics } from './acad-script.js';

export interface ExcelExportResult {
  filename: string;
  path: string;
  bytes: number;
}

export async function exportProjectStatsToExcel(
  project: Project,
  damageCodes: DamageCode[],
): Promise<ExcelExportResult | null> {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Diện tích
  const sheet1: (string | number)[][] = [];
  sheet1.push(['BẢNG 1: DIỆN TÍCH HƯ HỎNG']);
  sheet1.push(['Hồ sơ:', project.name]);
  sheet1.push(['Đơn vị thiết kế:', project.designUnit ?? '—']);
  sheet1.push(['Ngày khảo sát:', project.surveyDate ?? '—']);
  sheet1.push([]);
  sheet1.push(['Đoạn', 'Mã', 'Loại hư hỏng', 'Diện tích (m²)', '% mặt đường', 'Số miếng']);

  let projectTotalDamage = 0;
  let projectTotalRoad = 0;
  let projectPieceCount = 0;

  for (const seg of project.segments) {
    const stats = computeStatistics(seg, damageCodes);
    projectTotalRoad += stats.totalRoad;
    projectTotalDamage += stats.totalDamage;
    projectPieceCount += seg.damagePieces.length;

    for (const item of stats.byCode) {
      const pctRoad = stats.totalRoad > 0 ? (item.area / stats.totalRoad) * 100 : 0;
      sheet1.push([
        seg.name,
        item.code,
        item.name,
        Number(item.area.toFixed(2)),
        Number(pctRoad.toFixed(3)),
        item.pieceCount,
      ]);
    }
    sheet1.push([
      `Tổng đoạn "${seg.name}"`,
      '',
      `(${seg.endStation - seg.startStation}m × ${seg.roadWidth}m = ${stats.totalRoad}m²)`,
      Number(stats.totalDamage.toFixed(2)),
      Number(stats.ratio.toFixed(3)),
      seg.damagePieces.length,
    ]);
    sheet1.push([]);
  }

  const projectRatio = projectTotalRoad > 0 ? (projectTotalDamage / projectTotalRoad) * 100 : 0;
  sheet1.push([
    'TỔNG TOÀN DỰ ÁN',
    '',
    `${project.segments.length} đoạn — Tổng đường: ${projectTotalRoad}m²`,
    Number(projectTotalDamage.toFixed(2)),
    Number(projectRatio.toFixed(3)),
    projectPieceCount,
  ]);

  const ws1 = XLSX.utils.aoa_to_sheet(sheet1);
  ws1['!cols'] = [{ wch: 20 }, { wch: 6 }, { wch: 30 }, { wch: 14 }, { wch: 12 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, ws1, 'Diện tích');

  // Sheet 2: Tỉ lệ %
  const sheet2: (string | number)[][] = [];
  sheet2.push(['BẢNG 2: TỈ LỆ % PHÂN BỐ HƯ HỎNG']);
  sheet2.push([]);
  sheet2.push(['Mã', 'Loại hư hỏng', 'Diện tích (m²)', '% trong tổng HH', '% trong tổng mặt đường']);

  const projectByCode: Map<number, { name: string; area: number; pieceCount: number }> = new Map();
  for (const seg of project.segments) {
    const stats = computeStatistics(seg, damageCodes);
    for (const item of stats.byCode) {
      const existing = projectByCode.get(item.code);
      if (existing) {
        existing.area += item.area;
        existing.pieceCount += item.pieceCount;
      } else {
        projectByCode.set(item.code, { name: item.name, area: item.area, pieceCount: item.pieceCount });
      }
    }
  }

  const sortedCodes = Array.from(projectByCode.entries()).sort(([a], [b]) => a - b);
  for (const [code, item] of sortedCodes) {
    const pctHH = projectTotalDamage > 0 ? (item.area / projectTotalDamage) * 100 : 0;
    const pctMD = projectTotalRoad > 0 ? (item.area / projectTotalRoad) * 100 : 0;
    sheet2.push([
      code,
      item.name,
      Number(item.area.toFixed(2)),
      Number(pctHH.toFixed(2)),
      Number(pctMD.toFixed(3)),
    ]);
  }
  sheet2.push([]);
  sheet2.push(['', 'TỔNG hư hỏng', Number(projectTotalDamage.toFixed(2)), 100, Number(projectRatio.toFixed(3))]);
  const goodArea = projectTotalRoad - projectTotalDamage;
  const pctGood = projectTotalRoad > 0 ? (goodArea / projectTotalRoad) * 100 : 0;
  sheet2.push(['', 'Mặt đường còn tốt', Number(goodArea.toFixed(2)), '—', Number(pctGood.toFixed(3))]);

  const ws2 = XLSX.utils.aoa_to_sheet(sheet2);
  ws2['!cols'] = [{ wch: 6 }, { wch: 30 }, { wch: 14 }, { wch: 16 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(wb, ws2, 'Tỉ lệ %');

  // Sheet 3: Chi tiết miếng
  const sheet3: (string | number)[][] = [];
  sheet3.push(['BẢNG 3: CHI TIẾT MIẾNG HƯ HỎNG']);
  sheet3.push([]);
  sheet3.push([
    'Đoạn', 'STT miếng', 'Lý trình', 'Vị trí',
    'Cách tim (m)', 'Dài (m)', 'Rộng (m)', 'Diện tích (m²)',
    'Mã HH', 'Loại hư hỏng',
  ]);

  for (const seg of project.segments) {
    for (const p of seg.damagePieces) {
      const dc = damageCodes.find((d) => d.code === p.damageCode);
      sheet3.push([
        seg.name,
        p.pieceNumber,
        formatStation(p.startStation),
        p.side === 'left' ? 'Trái (T)' : p.side === 'right' ? 'Phải (P)' : 'Tim',
        Number((p.cachTim ?? 0).toFixed(2)),
        Number(p.length.toFixed(2)),
        Number(p.width.toFixed(2)),
        Number((p.length * p.width).toFixed(2)),
        p.damageCode,
        dc?.name ?? '?',
      ]);
    }
  }

  const ws3 = XLSX.utils.aoa_to_sheet(sheet3);
  ws3['!cols'] = [
    { wch: 18 }, { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 12 },
    { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 8 }, { wch: 30 },
  ];
  XLSX.utils.book_append_sheet(wb, ws3, 'Chi tiết miếng');

  // ============================================================
  // Phase 42 wave 9 — Sheet 4: Lỗ khoan (flatten theo lớp)
  // ============================================================
  const sheet4: (string | number)[][] = [];
  sheet4.push(['BẢNG 4: LỖ KHOAN (theo từng lớp)']);
  sheet4.push([]);
  sheet4.push(['Đoạn', 'STT', 'Số hiệu', 'Lý trình (m)', 'Lý trình', 'Vị trí', 'Cách tim (m)', 'Lớp #', 'Tên lớp', 'Dày (m)', 'Ghi chú lớp', 'Ghi chú lỗ khoan']);
  let bhStt = 0;
  for (const seg of project.segments) {
    const holes = seg.boreHoles ?? [];
    for (const h of holes) {
      const sideStr = h.side === 'left' ? 'Trái' : h.side === 'right' ? 'Phải' : 'Tim';
      if (h.layers.length === 0) {
        bhStt += 1;
        sheet4.push([seg.name, bhStt, h.pieceNumber, h.startStation, formatStation(h.startStation), sideStr, h.cachTim ?? 0, '—', '(không có lớp)', '—', '', h.notes ?? '']);
      } else {
        for (const l of h.layers) {
          bhStt += 1;
          sheet4.push([seg.name, bhStt, h.pieceNumber, h.startStation, formatStation(h.startStation), sideStr, h.cachTim ?? 0, l.order, l.name, l.depth, l.notes ?? '', h.notes ?? '']);
        }
      }
    }
  }
  const ws4 = XLSX.utils.aoa_to_sheet(sheet4);
  ws4['!cols'] = [{ wch: 18 }, { wch: 5 }, { wch: 10 }, { wch: 12 }, { wch: 14 }, { wch: 10 }, { wch: 12 }, { wch: 6 }, { wch: 28 }, { wch: 10 }, { wch: 22 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(wb, ws4, 'Lỗ khoan');

  // ============================================================
  // Phase 42 wave 9 — Sheet 5: Hố đào (flatten theo lớp)
  // ============================================================
  const sheet5: (string | number)[][] = [];
  sheet5.push(['BẢNG 5: HỐ ĐÀO (theo từng lớp)']);
  sheet5.push([]);
  sheet5.push(['Đoạn', 'STT', 'Số hiệu', 'Lý trình (m)', 'Lý trình', 'Vị trí', 'Cách tim (m)', 'Lớp #', 'Tên lớp', 'Dày (m)', 'Ghi chú lớp', 'Ghi chú hố đào']);
  let pitStt = 0;
  for (const seg of project.segments) {
    const pits = seg.excavationPits ?? [];
    for (const p of pits) {
      const sideStr = p.side === 'left' ? 'Trái' : p.side === 'right' ? 'Phải' : 'Tim';
      if (p.layers.length === 0) {
        pitStt += 1;
        sheet5.push([seg.name, pitStt, p.pieceNumber, p.startStation, formatStation(p.startStation), sideStr, p.cachTim ?? 0, '—', '(không có lớp)', '—', '', p.notes ?? '']);
      } else {
        for (const l of p.layers) {
          pitStt += 1;
          sheet5.push([seg.name, pitStt, p.pieceNumber, p.startStation, formatStation(p.startStation), sideStr, p.cachTim ?? 0, l.order, l.name, l.depth, l.notes ?? '', p.notes ?? '']);
        }
      }
    }
  }
  const ws5 = XLSX.utils.aoa_to_sheet(sheet5);
  ws5['!cols'] = [{ wch: 18 }, { wch: 5 }, { wch: 10 }, { wch: 12 }, { wch: 14 }, { wch: 10 }, { wch: 12 }, { wch: 6 }, { wch: 28 }, { wch: 10 }, { wch: 22 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(wb, ws5, 'Hố đào');

  // Save dialog
  const dateStr = new Date().toISOString().slice(0, 10);
  const safeName = project.name.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 50);
  const defaultName = `BaoCao_${safeName}_${dateStr}.xlsx`;

  const path = await save({
    title: 'Lưu báo cáo Excel',
    defaultPath: defaultName,
    filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }],
  });

  if (!path) return null;

  const arrayBuffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  const bytes = Array.from(new Uint8Array(arrayBuffer));

  const written = await invoke<number>('save_file_bytes', { path, bytes });

  const filename = path.split(/[\\/]/).pop() ?? defaultName;
  return { filename, path, bytes: written };
}
