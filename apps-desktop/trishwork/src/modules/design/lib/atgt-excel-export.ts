/**
 * TrishDesign Phase 43 wave 10.4 — Export Excel 9 sheet đúng format database-c41a296c.xlsx.
 *
 * 1 file Excel với 9 sheet riêng theo 9 loại tài sản + sheet "Đoạn" thông tin.
 * Mỗi sheet column structure giống file mẫu Trí gửi (sheet BienBao, VachSon, ...).
 */

import * as XLSX from 'xlsx';
import { save } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import type { AtgtSegment, RoadSide } from './atgt-types.js';
import type {
  AtgtSegmentItemsV2,
  BienBaoItemV2, VachSonItemV2, DenTinHieuItemV2,
  HoLanMemItemV2, CocTieuItemV2, RanhDocItemV2,
  CongNgangItemV2, TieuPhanQuangItemV2, GuongCauLoiItemV2,
} from './atgt-items-types.js';

function sideStr(s: RoadSide): string {
  return s === 'left' ? 'Trái' : s === 'right' ? 'Phải' : 'Tim';
}

/**
 * Build workbook + save dialog → ghi file.
 * Trả về { path } nếu thành công, null nếu user huỷ.
 */
export async function exportAtgtItemsToExcel(segment: AtgtSegment): Promise<{ path: string } | null> {
  const items: AtgtSegmentItemsV2 = segment.itemsV2 ?? {};
  const wb = XLSX.utils.book_new();

  // Sheet "Đoạn" — thông tin chung
  const segRows: (string | number)[][] = [
    ['Thông số', 'Giá trị'],
    ['Tên đoạn', segment.name],
    ['Lý trình bắt đầu (m)', segment.startStation],
    ['Lý trình kết thúc (m)', segment.endStation],
    ['Bề rộng đường (m)', segment.roadWidth],
    ['Loại đường', segment.roadType === 'dual' ? 'Đường đôi (có DPC)' : 'Đường đơn'],
    ['Số làn', segment.laneCount ?? '—'],
    ['Bề rộng DPC (m)', segment.medianWidth ?? '—'],
    ['Cách nhập vị trí', segment.cachTimMode === 'mep' ? 'Cách mép' : 'Cách tim'],
    ['Chế độ vẽ', segment.drawMode === 'polyline' ? 'Theo polyline' : 'Bình đồ duỗi thẳng'],
  ];
  const wsSeg = XLSX.utils.aoa_to_sheet(segRows);
  wsSeg['!cols'] = [{ wch: 26 }, { wch: 32 }];
  XLSX.utils.book_append_sheet(wb, wsSeg, 'Đoạn');

  // Sheet BienBao (7 cột)
  {
    const arr = (items.bienBao ?? []) as BienBaoItemV2[];
    const rows: (string | number)[][] = [
      ['STT', 'Lí trình', 'Vị trí', 'Tên biển báo', 'Ý nghĩa', 'Cách tim', 'Hiện trạng'],
    ];
    arr.forEach((it, i) => rows.push([i + 1, it.station, sideStr(it.side), it.tenBienBao, it.yNghia ?? '', it.cachTim, it.hienTrang ?? '']));
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 5 }, { wch: 12 }, { wch: 8 }, { wch: 14 }, { wch: 30 }, { wch: 10 }, { wch: 22 }];
    XLSX.utils.book_append_sheet(wb, ws, 'BienBao');
  }

  // Sheet VachSon (8 cột)
  {
    const arr = (items.vachSon ?? []) as VachSonItemV2[];
    const rows: (string | number)[][] = [
      ['STT', 'Lí trình đầu', 'Lí trình cuối', 'Vị trí', 'Loại vạch sơn', 'Ý nghĩa', 'Cách tim', 'Hiện trạng'],
    ];
    arr.forEach((it, i) => rows.push([i + 1, it.station, it.stationEnd, sideStr(it.side), it.loaiVachSon, it.yNghia ?? '', it.cachTim, it.hienTrang ?? '']));
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 5 }, { wch: 12 }, { wch: 12 }, { wch: 8 }, { wch: 16 }, { wch: 30 }, { wch: 10 }, { wch: 22 }];
    XLSX.utils.book_append_sheet(wb, ws, 'VachSon');
  }

  // Sheet DenTinHieu (6 cột)
  {
    const arr = (items.denTinHieu ?? []) as DenTinHieuItemV2[];
    const rows: (string | number)[][] = [
      ['STT', 'Lí trình', 'Vị trí', 'Tên đèn tín hiệu', 'Cách mép', 'Hiện trạng'],
    ];
    arr.forEach((it, i) => rows.push([i + 1, it.station, sideStr(it.side), it.tenDen, it.cachMep, it.hienTrang ?? '']));
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 5 }, { wch: 12 }, { wch: 8 }, { wch: 18 }, { wch: 10 }, { wch: 22 }];
    XLSX.utils.book_append_sheet(wb, ws, 'DenTinHieu');
  }

  // Sheet HoLanMem (8 cột)
  {
    const arr = (items.hoLanMem ?? []) as HoLanMemItemV2[];
    const rows: (string | number)[][] = [
      ['STT', 'Lí trình đầu', 'Lí trình cuối', 'Vị trí', 'Loại hộ lan mềm', 'Số khoang', 'Cách mép', 'Hiện trạng'],
    ];
    arr.forEach((it, i) => rows.push([i + 1, it.station, it.stationEnd, sideStr(it.side), it.loaiHoLan, it.soKhoang, it.cachMep, it.hienTrang ?? '']));
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 5 }, { wch: 12 }, { wch: 12 }, { wch: 8 }, { wch: 18 }, { wch: 12 }, { wch: 10 }, { wch: 22 }];
    XLSX.utils.book_append_sheet(wb, ws, 'HoLanMem');
  }

  // Sheet CocTieu (9 cột)
  {
    const arr = (items.cocTieu ?? []) as CocTieuItemV2[];
    const rows: (string | number)[][] = [
      ['STT', 'Lí trình đầu', 'Lí trình cuối', 'Vị trí', 'Loại cọc tiêu', 'Số lượng', 'Cách khoảng', 'Cách mép', 'Hiện trạng'],
    ];
    arr.forEach((it, i) => rows.push([i + 1, it.station, it.stationEnd, sideStr(it.side), it.loaiCocTieu, it.soLuong, it.cachKhoang, it.cachMep, it.hienTrang ?? '']));
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 5 }, { wch: 12 }, { wch: 12 }, { wch: 8 }, { wch: 16 }, { wch: 10 }, { wch: 11 }, { wch: 10 }, { wch: 22 }];
    XLSX.utils.book_append_sheet(wb, ws, 'CocTieu');
  }

  // Sheet RanhDoc (7 cột)
  {
    const arr = (items.ranhDoc ?? []) as RanhDocItemV2[];
    const rows: (string | number)[][] = [
      ['STT', 'Lí trình đầu', 'Lí trình cuối', 'Vị trí', 'Loại rãnh dọc', 'Cách mép', 'Hiện trạng'],
    ];
    arr.forEach((it, i) => rows.push([i + 1, it.station, it.stationEnd, sideStr(it.side), it.loaiRanhDoc, it.cachMep, it.hienTrang ?? '']));
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 5 }, { wch: 12 }, { wch: 12 }, { wch: 8 }, { wch: 18 }, { wch: 10 }, { wch: 22 }];
    XLSX.utils.book_append_sheet(wb, ws, 'RanhDoc');
  }

  // Sheet CongNgang (5 cột)
  {
    const arr = (items.congNgang ?? []) as CongNgangItemV2[];
    const rows: (string | number)[][] = [
      ['STT', 'Lí trình', 'Vị trí', 'Loại cống ngang', 'Hiện trạng'],
    ];
    arr.forEach((it, i) => rows.push([i + 1, it.station, sideStr(it.side), it.loaiCongNgang, it.hienTrang ?? '']));
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 5 }, { wch: 12 }, { wch: 8 }, { wch: 18 }, { wch: 22 }];
    XLSX.utils.book_append_sheet(wb, ws, 'CongNgang');
  }

  // Sheet TieuPhanQuang (9 cột)
  {
    const arr = (items.tieuPhanQuang ?? []) as TieuPhanQuangItemV2[];
    const rows: (string | number)[][] = [
      ['STT', 'Lí trình đầu', 'Lí trình cuối', 'Vị trí', 'Loại tiêu phản quang', 'Số lượng', 'Cách khoảng', 'Cách mép', 'Hiện trạng'],
    ];
    arr.forEach((it, i) => rows.push([i + 1, it.station, it.stationEnd, sideStr(it.side), it.loaiTPQ, it.soLuong, it.cachKhoang, it.cachMep, it.hienTrang ?? '']));
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 5 }, { wch: 12 }, { wch: 12 }, { wch: 8 }, { wch: 18 }, { wch: 10 }, { wch: 11 }, { wch: 10 }, { wch: 22 }];
    XLSX.utils.book_append_sheet(wb, ws, 'TieuPhanQuang');
  }

  // Sheet GuongCauLoi (6 cột)
  {
    const arr = (items.guongCauLoi ?? []) as GuongCauLoiItemV2[];
    const rows: (string | number)[][] = [
      ['STT', 'Lí trình', 'Vị trí', 'Tên gương cầu lồi', 'Cách tim', 'Hiện trạng'],
    ];
    arr.forEach((it, i) => rows.push([i + 1, it.station, sideStr(it.side), it.tenGuong, it.cachTim, it.hienTrang ?? '']));
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 5 }, { wch: 12 }, { wch: 8 }, { wch: 18 }, { wch: 10 }, { wch: 22 }];
    XLSX.utils.book_append_sheet(wb, ws, 'GuongCauLoi');
  }

  // Save dialog
  const dateStr = new Date().toISOString().slice(0, 10);
  const safe = segment.name.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 40);
  const path = await save({
    title: 'Lưu báo cáo ATGT (9 sheet)',
    defaultPath: `ATGT_${safe}_${dateStr}.xlsx`,
    filters: [{ name: 'Excel', extensions: ['xlsx'] }],
  });
  if (!path) return null;

  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  const bytes = Array.from(new Uint8Array(buf));
  await invoke<number>('save_file_bytes', { path, bytes });
  return { path };
}
