/**
 * Phase 28.10 — Multi-sheet OCR AI Vision schema.
 *
 * 8 sheets cho khảo sát hiện trạng đường giao thông VN. AI Vision đọc ảnh
 * sổ tay viết tay → tự phân loại từng dòng vào sheet phù hợp.
 *
 * Trí (kỹ sư GT Đà Nẵng) yêu cầu các loại hạ tầng cần khảo sát thường gặp.
 */

export const SHEET_TYPES = [
  'mat_duong',
  'bien_bao',
  'vach_son',
  'ho_lan_mem',
  'ranh_doc',
  'duong_ngang',
  'coc_tieu',
  'khac',
] as const;

export type SheetType = typeof SHEET_TYPES[number];

export const SHEET_LABEL: Record<SheetType, string> = {
  mat_duong: 'Hiện trạng mặt đường',
  bien_bao: 'Biển báo',
  vach_son: 'Vạch sơn',
  ho_lan_mem: 'Hộ lan mềm',
  ranh_doc: 'Rãnh dọc',
  duong_ngang: 'Đường ngang',
  coc_tieu: 'Cọc tiêu',
  khac: 'Khác / Chưa phân loại',
};

export const SHEET_ICON: Record<SheetType, string> = {
  mat_duong: '🛣',
  bien_bao: '🚸',
  vach_son: '📏',
  ho_lan_mem: '🛡',
  ranh_doc: '🌊',
  duong_ngang: '🚧',
  coc_tieu: '📍',
  khac: '❓',
};

/** Default header per sheet — AI có thể override. */
export const SHEET_DEFAULT_HEADER: Record<SheetType, string[]> = {
  mat_duong: ['STT', 'Lý trình', 'Loại hư hỏng', 'Dài (m)', 'Rộng (m)', 'Diện tích (m²)', 'Mã HH', 'Ghi chú'],
  bien_bao: ['STT', 'Lý trình', 'Loại biển', 'Số hiệu', 'Tình trạng', 'Ghi chú'],
  vach_son: ['STT', 'Lý trình', 'Loại vạch', 'Dài (m)', 'Tình trạng', 'Ghi chú'],
  ho_lan_mem: ['STT', 'Lý trình', 'Tình trạng', 'Dài (m)', 'Ghi chú'],
  ranh_doc: ['STT', 'Lý trình', 'Loại rãnh', 'Dài (m)', 'Tình trạng', 'Ghi chú'],
  duong_ngang: ['STT', 'Lý trình', 'Loại đường ngang', 'Tên/Số hiệu', 'Tình trạng', 'Ghi chú'],
  coc_tieu: ['STT', 'Lý trình', 'Số lượng', 'Tình trạng', 'Ghi chú'],
  khac: ['STT', 'Lý trình', 'Mô tả', 'Ghi chú'],
};

export interface SheetData {
  header: string[];
  rows: string[][];
}

export type MultiSheetParse = Record<SheetType, SheetData>;

export function emptyMultiSheet(): MultiSheetParse {
  const out = {} as MultiSheetParse;
  for (const k of SHEET_TYPES) {
    out[k] = { header: SHEET_DEFAULT_HEADER[k], rows: [] };
  }
  return out;
}

/**
 * System prompt cho AI Vision — yêu cầu đọc ảnh sổ tay khảo sát + tự phân
 * loại từng dòng vào 1 trong 8 sheet. Trả ra JSON object DUY NHẤT.
 */
export const MULTI_SHEET_SYSTEM_PROMPT = `Bạn là AI chuyên đọc sổ tay khảo sát hiện trạng đường bộ Việt Nam (chữ viết tay).
Phân tích ảnh chứa số liệu khảo sát viết tay tiếng Việt → tự phân loại từng dòng vào 1 trong 8 SHEET sau:

1. mat_duong       — Hiện trạng mặt đường (hư hỏng, nứt, ổ gà, lún, bong tróc, ...)
2. bien_bao        — Biển báo giao thông (loại biển, số hiệu W.xxx / P.xxx / R.xxx, tình trạng)
3. vach_son        — Vạch sơn kẻ đường (vạch tim, vạch lề, mũi tên, chữ viết...)
4. ho_lan_mem      — Hộ lan mềm (tôn lượn sóng, hư hỏng, biến dạng)
5. ranh_doc        — Rãnh dọc (rãnh xây, rãnh đất, tắc nghẽn, ...)
6. duong_ngang     — Đường ngang (giao cắt, ngõ rẽ, lối ra vào)
7. coc_tieu        — Cọc tiêu (cọc tiêu nhựa, cọc tiêu bê tông, mất, hỏng)
8. khac            — Bất cứ thứ gì không khớp 7 loại trên

QUAN TRỌNG về định dạng lý trình VN:
- "Km0+100" hoặc "C0+10" hoặc "C4+6" hoặc "Kn+0" đều là lý trình
- "C4+6" = cọc 4, cộng 6m. "Km0+100" = Km số 0, cộng 100m. Giữ nguyên format gốc.
- (TT) (PT) (PT) thường là viết tắt (Trái Tuyến) / (Phải Tuyến) — đưa vào cột Ghi chú hoặc cột riêng "Tuyến".

Output: JSON object DUY NHẤT (không markdown, không giải thích trước/sau):
{
  "mat_duong":   { "header": ["STT","Lý trình","Loại hư hỏng","Dài (m)","Rộng (m)","Mã HH","Ghi chú"], "rows": [["1","Km0+020","Nứt rạn mai rùa","10","3","2","TT"]] },
  "bien_bao":    { "header": [...], "rows": [...] },
  "vach_son":    { "header": [...], "rows": [...] },
  "ho_lan_mem":  { "header": [...], "rows": [...] },
  "ranh_doc":    { "header": [...], "rows": [...] },
  "duong_ngang": { "header": [...], "rows": [...] },
  "coc_tieu":    { "header": [...], "rows": [...] },
  "khac":        { "header": [...], "rows": [...] }
}

Quy tắc:
- Sheet nào không có dữ liệu → vẫn trả ra với rows: [] (giữ đủ 8 keys).
- Header dùng tiếng Việt rõ ràng. Mỗi sheet header có thể khác nhau tuỳ nội dung.
- Mỗi row là array of string. Giữ nguyên text gốc, KHÔNG đoán/sửa số liệu.
- Nếu số liệu mờ/khó đọc, thêm dấu "?" cuối, vd "10?" — đừng bỏ trống.
- Trả JSON only, không markdown code block.`;

/**
 * Parse JSON từ AI response, validate shape, trả MultiSheetParse hoặc null.
 */
export function parseMultiSheetJson(reply: string): MultiSheetParse | null {
  const m = reply.match(/\{[\s\S]*\}/);
  if (!m) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(m[0]);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const out = emptyMultiSheet();
  for (const k of SHEET_TYPES) {
    const v = obj[k];
    if (!v || typeof v !== 'object') continue;
    const sheet = v as { header?: unknown; rows?: unknown };
    const header = Array.isArray(sheet.header)
      ? sheet.header.map((x) => String(x))
      : SHEET_DEFAULT_HEADER[k];
    const rows = Array.isArray(sheet.rows)
      ? sheet.rows
          .filter((r) => Array.isArray(r))
          .map((r) => (r as unknown[]).map((c) => String(c ?? '')))
      : [];
    out[k] = { header, rows };
  }
  return out;
}

/** Tổng số rows cross-sheet, dùng cho summary UI. */
export function totalRows(data: MultiSheetParse): number {
  return SHEET_TYPES.reduce((sum, k) => sum + data[k].rows.length, 0);
}

/**
 * Phase 28.11 — Bước 1: AI Vision đọc ảnh → text tiếng Việt thô.
 * KHÔNG phân loại, chỉ transcribe trung thành theo cấu trúc sổ tay (giữ
 * lý trình, ký hiệu (TT)/(PT), gạch dòng giữa các mục).
 */
export const STEP1_TRANSCRIBE_PROMPT = `Bạn là AI đọc chữ viết tay tiếng Việt — chuyên ngành cầu đường VN.
Phân tích ảnh sổ tay khảo sát hiện trạng → trả ra TEXT tiếng Việt thô (không JSON).

Quy tắc:
- Đọc từng dòng theo thứ tự từ trên xuống, trái qua phải.
- GIỮ NGUYÊN format gốc: ký hiệu (TT) (PT), số thứ tự khoanh tròn (1), (2), lý trình "Km0+100" / "C4+6" / "C0+10".
- Mỗi dòng sổ = 1 dòng output. Không gộp dòng.
- Số liệu mờ/khó đọc → thêm "?" cuối số (vd "10?").
- Dấu ✓ ✗ ⓞ ⓘ giữ nguyên.
- KHÔNG giải thích, KHÔNG markdown, chỉ text raw.

Output ví dụ:
(1) Km0+100 (TT) C0 5x3 B3,7 LV<2,5
(2) C4+6 (PT) C0 B3,7 LV<2,5
(3) C4+6 (PT) C0 B3,7 LV>2,5
...`;

/**
 * Bước 2 — Per-sheet classify prompt. Sau khi đã có text VN, gọi AI text-only
 * để phân loại + structure thành bảng. Mỗi sheet có prompt focus riêng để
 * extract đúng field.
 */
export const STEP2_CLASSIFY_PROMPT = `Bạn là AI phân loại số liệu khảo sát hạ tầng đường bộ VN.
Input là text tiếng Việt từ sổ khảo sát viết tay (đã transcribe). Phân loại từng dòng vào 1 trong 8 sheet:

1. mat_duong       — hư hỏng mặt đường: nứt rạn mai rùa, ổ gà, lún, bong tróc, sình lún. Có Mã HH (1-10), kích thước Dài × Rộng.
2. bien_bao        — biển báo: số hiệu W.xxx (cảnh báo) / P.xxx (cấm) / R.xxx (hiệu lệnh) / I.xxx (chỉ dẫn). Trạng thái: mất, mờ, gãy, rỉ.
3. vach_son        — vạch sơn: vạch tim đường, vạch lề, mũi tên, chữ viết. Trạng thái mờ / mất.
4. ho_lan_mem      — hộ lan tôn lượn sóng: dài (m), biến dạng, mất.
5. ranh_doc        — rãnh dọc: rãnh đất / rãnh xây bê tông, dài (m), tắc / vỡ / xói lở.
6. duong_ngang     — giao cắt đường ngang: tên đường giao, lý trình, loại (cấp I-V, đường nhánh, ngõ).
7. coc_tieu        — cọc tiêu nhựa / bê tông: số lượng, mất, gãy.
8. khac            — bất cứ thứ gì không khớp 7 loại trên.

Output: JSON object DUY NHẤT (không markdown), 8 keys exactly:
{
  "mat_duong":   { "header": ["STT","Lý trình","Tuyến","Loại HH","Dài (m)","Rộng (m)","Mã HH","Ghi chú"], "rows": [...] },
  "bien_bao":    { "header": ["STT","Lý trình","Tuyến","Số hiệu","Loại biển","Tình trạng","Ghi chú"], "rows": [...] },
  "vach_son":    { "header": ["STT","Lý trình","Tuyến","Loại vạch","Dài (m)","Tình trạng","Ghi chú"], "rows": [...] },
  "ho_lan_mem":  { "header": ["STT","Lý trình","Tuyến","Dài (m)","Tình trạng","Ghi chú"], "rows": [...] },
  "ranh_doc":    { "header": ["STT","Lý trình","Tuyến","Loại rãnh","Dài (m)","Tình trạng","Ghi chú"], "rows": [...] },
  "duong_ngang": { "header": ["STT","Lý trình","Tuyến","Tên/Cấp đường","Tình trạng","Ghi chú"], "rows": [...] },
  "coc_tieu":    { "header": ["STT","Lý trình","Tuyến","Số lượng","Tình trạng","Ghi chú"], "rows": [...] },
  "khac":        { "header": ["STT","Lý trình","Tuyến","Mô tả","Ghi chú"], "rows": [...] }
}

Quy tắc:
- Sheet không có dữ liệu → vẫn trả với rows: [].
- "Tuyến" = (TT) hoặc (PT) trong text gốc.
- Giữ nguyên text gốc cho các giá trị không xác định.
- JSON only, không markdown code block, không giải thích.`;

