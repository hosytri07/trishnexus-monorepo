/**
 * Phase 19.24.3 — Bulk import CSV/TSV → Firestore.
 *
 * Để giữ TrishAdmin nhẹ, em không add xlsx package. Trí export Excel
 * sang CSV trước (File → Save As → CSV UTF-8) rồi import qua đây.
 *
 * Hỗ trợ:
 *   - CSV (comma)
 *   - TSV (tab)
 *   - Auto-detect separator
 *   - Quoted strings, escaped quotes ""
 *   - Skip BOM
 *
 * Schema mapping: dòng đầu là header → map field name. Field "id" bắt buộc.
 */

import { collection, doc, setDoc, writeBatch } from 'firebase/firestore';
import { getFirebaseDb } from '@trishteam/auth';

export interface ParsedRow {
  [key: string]: string | number | boolean | null;
}

export interface ParseResult {
  headers: string[];
  rows: ParsedRow[];
  separator: ',' | '\t' | ';';
  warnings: string[];
}

/**
 * Parse CSV/TSV string → headers + rows.
 * Không dùng external lib để tránh add deps.
 */
export function parseCsvText(text: string): ParseResult {
  const warnings: string[] = [];
  // Strip BOM
  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1);
  }
  const lines = text.split(/\r\n|\r|\n/);
  if (lines.length === 0) {
    return { headers: [], rows: [], separator: ',', warnings: ['File rỗng.'] };
  }
  // Auto-detect separator dựa trên dòng đầu
  const firstLine = lines[0] ?? '';
  const tabCount = (firstLine.match(/\t/g) ?? []).length;
  const commaCount = (firstLine.match(/,/g) ?? []).length;
  const semiCount = (firstLine.match(/;/g) ?? []).length;
  let separator: ',' | '\t' | ';' = ',';
  if (tabCount > commaCount && tabCount > semiCount) separator = '\t';
  else if (semiCount > commaCount) separator = ';';

  const headers = parseLine(lines[0] ?? '', separator);
  const rows: ParsedRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line.trim() === '') continue;
    const cells = parseLine(line, separator);
    if (cells.length === 0) continue;
    const row: ParsedRow = {};
    for (let j = 0; j < headers.length; j++) {
      const key = headers[j] ?? `col_${j}`;
      const raw = cells[j] ?? '';
      row[key] = coerceValue(raw);
    }
    rows.push(row);
  }
  if (!headers.includes('id') && !headers.includes('_id')) {
    warnings.push(
      'Không thấy cột "id" trong header. Bắt buộc phải có để dùng làm Firestore doc ID.',
    );
  }
  return { headers, rows, separator, warnings };
}

/** Parse 1 dòng CSV với handle quoted strings + escaped quotes. */
function parseLine(line: string, separator: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuote = false;
  let i = 0;
  while (i < line.length) {
    const ch = line[i];
    if (inQuote) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          // Escaped quote
          current += '"';
          i += 2;
          continue;
        }
        inQuote = false;
        i++;
        continue;
      }
      current += ch;
      i++;
    } else {
      if (ch === '"' && current === '') {
        inQuote = true;
        i++;
        continue;
      }
      if (ch === separator) {
        cells.push(current);
        current = '';
        i++;
        continue;
      }
      current += ch;
      i++;
    }
  }
  cells.push(current);
  return cells;
}

/** Convert string sang number/boolean/null nếu match. */
function coerceValue(raw: string): string | number | boolean | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  // Boolean
  if (trimmed === 'true' || trimmed === 'TRUE') return true;
  if (trimmed === 'false' || trimmed === 'FALSE') return false;
  if (trimmed === 'null' || trimmed === 'NULL') return null;
  // Number — chỉ convert nếu match strict
  if (/^-?\d+$/.test(trimmed)) {
    const n = Number(trimmed);
    if (Number.isSafeInteger(n)) return n;
  }
  if (/^-?\d+\.\d+$/.test(trimmed)) {
    const n = Number(trimmed);
    if (!isNaN(n)) return n;
  }
  return trimmed;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  failed: number;
  errors: Array<{ row: number; message: string }>;
}

/**
 * Import rows → Firestore collection.
 *
 * Logic:
 *   - Dùng row.id (hoặc row._id) làm doc ID
 *   - Bỏ row nào không có id
 *   - WriteBatch 500 ops mỗi lần
 *   - Trả stats success/skip/fail
 */
export async function importRowsToCollection(
  collectionName: string,
  rows: ParsedRow[],
  options: { onProgress?: (current: number, total: number) => void; overwrite?: boolean } = {},
): Promise<ImportResult> {
  const db = getFirebaseDb();
  const result: ImportResult = {
    imported: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };
  const overwrite = options.overwrite ?? true;

  for (let i = 0; i < rows.length; i += 500) {
    const slice = rows.slice(i, i + 500);
    const batch = writeBatch(db);
    let batchOps = 0;

    for (let j = 0; j < slice.length; j++) {
      const row = slice[j];
      const id = (row.id as string) || (row._id as string);
      if (!id || typeof id !== 'string') {
        result.skipped++;
        result.errors.push({ row: i + j + 2, message: 'Thiếu field "id".' });
        continue;
      }
      // Strip _id field nếu có
      const { _id, ...rest } = row as { _id?: unknown; [k: string]: unknown };
      void _id;
      try {
        batch.set(doc(db, collectionName, id), rest, { merge: !overwrite });
        batchOps++;
      } catch (err) {
        result.failed++;
        result.errors.push({
          row: i + j + 2,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }

    if (batchOps > 0) {
      try {
        await batch.commit();
        result.imported += batchOps;
      } catch (err) {
        result.failed += batchOps;
        result.errors.push({
          row: i + 2,
          message: `Batch commit fail: ${err instanceof Error ? err.message : err}`,
        });
      }
    }

    options.onProgress?.(Math.min(i + slice.length, rows.length), rows.length);
  }

  return result;
}
