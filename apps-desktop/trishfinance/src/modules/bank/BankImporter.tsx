/**
 * Phase 40.13 — Bank CSV import.
 *
 * Standalone modal/page cho phép user paste hoặc upload CSV sao kê ngân hàng VN
 * (VCB / Techcombank / MB Bank / ACB / TPBank) → parse → preview → push vào ledger.
 *
 * Mỗi ngân hàng có format CSV khác nhau (column names + date format). Em hỗ trợ
 * 3 format phổ biến nhất + auto-detect dựa trên header.
 *
 * Tích hợp vào module Tài chính qua tab mới "🏦 Ngân hàng".
 */
import { useMemo, useRef, useState } from 'react';
import {
  CreditCard,
  Upload,
  CheckCircle2,
  AlertCircle,
  FileText,
  ChevronRight,
  X,
  Save,
} from 'lucide-react';
import { addLedgerEntry } from '../../lib/ledger-helper';

// ============================================================
// Bank format definitions
// ============================================================
interface BankFormat {
  id: string;
  name: string;
  emoji: string;
  /** Header pattern để auto-detect */
  headerSignals: string[];
  /** Tên cột date trong CSV */
  dateCol: string[];
  /** Tên cột description / memo */
  descCol: string[];
  /** Tên cột credit (tiền vào) */
  creditCol: string[];
  /** Tên cột debit (tiền ra) */
  debitCol: string[];
  /** Date format dd/MM/yyyy hoặc yyyy-MM-dd */
  dateFormat: 'dmy' | 'mdy' | 'ymd';
}

const BANK_FORMATS: BankFormat[] = [
  {
    id: 'vcb',
    name: 'Vietcombank',
    emoji: '🟢',
    headerSignals: ['ngay giao dich', 'so tien ghi co', 'so tien ghi no', 'noi dung'],
    dateCol: ['ngày giao dịch', 'ngay giao dich', 'date'],
    descCol: ['nội dung', 'noi dung', 'mô tả', 'mo ta', 'description'],
    creditCol: ['số tiền ghi có', 'so tien ghi co', 'credit', 'có'],
    debitCol: ['số tiền ghi nợ', 'so tien ghi no', 'debit', 'nợ'],
    dateFormat: 'dmy',
  },
  {
    id: 'tcb',
    name: 'Techcombank',
    emoji: '🔴',
    headerSignals: ['ngày', 'số dư', 'ghi có', 'ghi nợ'],
    dateCol: ['ngày', 'ngay', 'transaction date', 'date'],
    descCol: ['nội dung', 'noi dung', 'description', 'memo'],
    creditCol: ['ghi có', 'ghi co', 'credit', 'amount in'],
    debitCol: ['ghi nợ', 'ghi no', 'debit', 'amount out'],
    dateFormat: 'dmy',
  },
  {
    id: 'mb',
    name: 'MB Bank',
    emoji: '🟣',
    headerSignals: ['transaction date', 'description', 'credit amount', 'debit amount'],
    dateCol: ['transaction date', 'ngày'],
    descCol: ['description', 'mô tả', 'noi dung'],
    creditCol: ['credit amount', 'amount in', 'ghi có'],
    debitCol: ['debit amount', 'amount out', 'ghi nợ'],
    dateFormat: 'dmy',
  },
  {
    id: 'generic',
    name: 'Generic (tự detect)',
    emoji: '📋',
    headerSignals: [],
    dateCol: ['date', 'ngày', 'ngay', 'transaction date', 'ngày giao dịch'],
    descCol: ['description', 'desc', 'memo', 'note', 'nội dung', 'noi dung', 'mô tả', 'mo ta'],
    creditCol: ['credit', 'in', 'amount in', 'có', 'co', 'ghi có', 'thu'],
    debitCol: ['debit', 'out', 'amount out', 'nợ', 'no', 'ghi nợ', 'chi'],
    dateFormat: 'dmy',
  },
];

// ============================================================
// CSV parser
// ============================================================
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let i = 0;
  let current = '';
  let row: string[] = [];
  let inQuotes = false;

  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        current += '"';
        i += 2;
        continue;
      }
      if (ch === '"') {
        inQuotes = false;
        i++;
        continue;
      }
      current += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ',' || ch === ';' || ch === '\t') {
      row.push(current.trim());
      current = '';
      i++;
      continue;
    }
    if (ch === '\n' || ch === '\r') {
      if (current.trim() || row.length > 0) {
        row.push(current.trim());
        rows.push(row);
      }
      row = [];
      current = '';
      i++;
      if (ch === '\r' && text[i] === '\n') i++;
      continue;
    }
    current += ch;
    i++;
  }
  if (current.trim() || row.length > 0) {
    row.push(current.trim());
    rows.push(row);
  }
  return rows;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[áàảãạâấầẩẫậăắằẳẵặ]/g, 'a').replace(/[éèẻẽẹêếềểễệ]/g, 'e').replace(/[íìỉĩị]/g, 'i').replace(/[óòỏõọôốồổỗộơớờởỡợ]/g, 'o').replace(/[úùủũụưứừửữự]/g, 'u').replace(/[ýỳỷỹỵ]/g, 'y').replace(/đ/g, 'd').trim();
}

function findColIndex(headers: string[], candidates: string[]): number {
  const norm = headers.map((h) => normalize(h));
  for (const cand of candidates) {
    const c = normalize(cand);
    const idx = norm.findIndex((h) => h === c || h.includes(c));
    if (idx >= 0) return idx;
  }
  return -1;
}

function autoDetectFormat(headers: string[]): BankFormat {
  const norm = headers.map((h) => normalize(h)).join('|');
  for (const fmt of BANK_FORMATS) {
    if (fmt.id === 'generic') continue;
    const hits = fmt.headerSignals.filter((s) => norm.includes(s)).length;
    if (hits >= 2) return fmt;
  }
  return BANK_FORMATS[BANK_FORMATS.length - 1]; // generic
}

function parseAmount(s: string): number {
  if (!s) return 0;
  // Bỏ dấu phẩy phân cách hàng nghìn (VN: 1,234,567 hoặc 1.234.567)
  // Em đoán dấu nào là decimal: nếu có cả . và , — cái sau là decimal
  const cleaned = s.replace(/[^\d.,-]/g, '');
  if (!cleaned) return 0;
  // Nếu có cả . và , — phần đuôi là decimal
  const lastDot = cleaned.lastIndexOf('.');
  const lastComma = cleaned.lastIndexOf(',');
  let normalized = cleaned;
  if (lastDot >= 0 && lastComma >= 0) {
    if (lastComma > lastDot) {
      // VN format: 1.234,56
      normalized = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      // US format: 1,234.56
      normalized = cleaned.replace(/,/g, '');
    }
  } else if (lastComma >= 0 && cleaned.length - lastComma <= 3) {
    // 1234,56 — decimal
    normalized = cleaned.replace(',', '.');
  } else {
    // Pure thousand separator
    normalized = cleaned.replace(/[.,]/g, '');
  }
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? Math.abs(n) : 0;
}

function parseDate(s: string, format: 'dmy' | 'mdy' | 'ymd'): string {
  if (!s) return new Date().toISOString().slice(0, 10);
  const m = s.match(/(\d{1,4})[/\-.](\d{1,2})[/\-.](\d{1,4})/);
  if (!m) {
    // Try ISO
    const iso = new Date(s);
    if (!isNaN(iso.getTime())) return iso.toISOString().slice(0, 10);
    return new Date().toISOString().slice(0, 10);
  }
  let dd: number, mm: number, yy: number;
  if (format === 'ymd') {
    yy = parseInt(m[1]!, 10); mm = parseInt(m[2]!, 10); dd = parseInt(m[3]!, 10);
  } else if (format === 'mdy') {
    mm = parseInt(m[1]!, 10); dd = parseInt(m[2]!, 10); yy = parseInt(m[3]!, 10);
  } else {
    dd = parseInt(m[1]!, 10); mm = parseInt(m[2]!, 10); yy = parseInt(m[3]!, 10);
  }
  if (yy < 100) yy += 2000;
  const isoMonth = String(mm).padStart(2, '0');
  const isoDay = String(dd).padStart(2, '0');
  return `${yy}-${isoMonth}-${isoDay}`;
}

// ============================================================
interface ParsedEntry {
  selected: boolean;
  date: string;
  description: string;
  credit: number;
  debit: number;
  raw: string[];
}

interface BankImporterProps {
  onClose?: () => void;
}

export function BankImporter({ onClose }: BankImporterProps): JSX.Element {
  const [csvText, setCsvText] = useState('');
  const [formatId, setFormatId] = useState<string>('auto');
  const [parsed, setParsed] = useState<ParsedEntry[] | null>(null);
  const [detectedBank, setDetectedBank] = useState<string>('');
  const [importing, setImporting] = useState(false);
  const [importedCount, setImportedCount] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>): void {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = (ev.target?.result as string) ?? '';
      setCsvText(text);
    };
    reader.readAsText(file, 'utf-8');
  }

  function handleParse(): void {
    if (!csvText.trim()) return;
    const rows = parseCSV(csvText);
    if (rows.length < 2) {
      alert('CSV ít nhất phải có header + 1 dòng dữ liệu');
      return;
    }
    const headers = rows[0]!;
    const fmt = formatId === 'auto' ? autoDetectFormat(headers) : BANK_FORMATS.find((f) => f.id === formatId) ?? BANK_FORMATS[BANK_FORMATS.length - 1];
    setDetectedBank(fmt.name);

    const dateIdx = findColIndex(headers, fmt.dateCol);
    const descIdx = findColIndex(headers, fmt.descCol);
    const creditIdx = findColIndex(headers, fmt.creditCol);
    const debitIdx = findColIndex(headers, fmt.debitCol);

    if (dateIdx < 0 || descIdx < 0) {
      alert(`Không tìm thấy cột Ngày hoặc Mô tả.\nCác cột phát hiện: ${headers.join(', ')}`);
      return;
    }

    const entries: ParsedEntry[] = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i]!;
      if (r.length === 0 || (r.length === 1 && !r[0])) continue;
      const date = parseDate(r[dateIdx] ?? '', fmt.dateFormat);
      const description = (r[descIdx] ?? '').trim();
      const credit = creditIdx >= 0 ? parseAmount(r[creditIdx] ?? '') : 0;
      const debit = debitIdx >= 0 ? parseAmount(r[debitIdx] ?? '') : 0;
      if (!description && credit === 0 && debit === 0) continue;
      entries.push({
        selected: true,
        date,
        description,
        credit,
        debit,
        raw: r,
      });
    }
    setParsed(entries);
    setImportedCount(null);
  }

  function toggleEntry(i: number): void {
    if (!parsed) return;
    setParsed(parsed.map((e, idx) => (idx === i ? { ...e, selected: !e.selected } : e)));
  }
  function toggleAll(value: boolean): void {
    if (!parsed) return;
    setParsed(parsed.map((e) => ({ ...e, selected: value })));
  }

  async function handleImport(): Promise<void> {
    if (!parsed) return;
    setImporting(true);
    let count = 0;
    for (const e of parsed) {
      if (!e.selected) continue;
      const isCredit = e.credit > 0;
      const amount = isCredit ? e.credit : e.debit;
      if (amount <= 0) continue;
      const ok = addLedgerEntry({
        amount,
        kind: isCredit ? 'thu' : 'chi',
        category: isCredit ? 'khac_thu' : 'khac_chi',
        description: `[${detectedBank || 'Bank'}] ${e.description}`.slice(0, 200),
        source: 'manual',
        refId: `bank_${e.date}_${amount}`,
        date: e.date,
      });
      if (ok) count++;
    }
    setImporting(false);
    setImportedCount(count);
  }

  const selectedCount = parsed?.filter((e) => e.selected).length ?? 0;
  const totalCredit = parsed?.filter((e) => e.selected).reduce((s, e) => s + e.credit, 0) ?? 0;
  const totalDebit = parsed?.filter((e) => e.selected).reduce((s, e) => s + e.debit, 0) ?? 0;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
          <CreditCard style={{ width: 22, height: 22, color: 'var(--color-accent-primary)' }} /> Import sao kê ngân hàng
        </h2>
        {onClose && <button type="button" onClick={onClose} className="icon-btn"><X style={{ width: 16, height: 16 }} /></button>}
      </div>

      {importedCount !== null && (
        <div style={{ padding: 14, background: 'rgba(16,185,129,0.1)', border: '1px solid #10B981', borderRadius: 10, marginBottom: 14, color: '#065F46', display: 'flex', alignItems: 'center', gap: 10 }}>
          <CheckCircle2 style={{ width: 18, height: 18 }} />
          <div>
            <strong>Đã import {importedCount} giao dịch</strong> vào sổ Tài chính cá nhân.
            <div style={{ fontSize: 11, marginTop: 2 }}>Xem ngay tại tab "Tài chính cá nhân" → Sổ thu chi</div>
          </div>
        </div>
      )}

      {/* Step 1: Input */}
      <div className="card" style={{ padding: 16, marginBottom: 12 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginTop: 0, marginBottom: 10 }}>
          <strong>Bước 1:</strong> Tải sao kê CSV từ app ngân hàng → paste hoặc upload
        </h3>

        <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)' }}>Ngân hàng:</label>
          <select className="input" value={formatId} onChange={(e) => setFormatId(e.target.value)} style={{ width: 220 }}>
            <option value="auto">🔍 Tự động phát hiện</option>
            {BANK_FORMATS.map((f) => <option key={f.id} value={f.id}>{f.emoji} {f.name}</option>)}
          </select>
          <button type="button" className="btn-secondary" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4" /> Upload CSV
          </button>
          <input ref={fileInputRef} type="file" accept=".csv,.txt" onChange={handleFileUpload} style={{ display: 'none' }} />
        </div>

        <textarea
          className="input"
          value={csvText}
          onChange={(e) => setCsvText(e.target.value)}
          placeholder={`Paste nội dung CSV sao kê vào đây...\n\nVD format Vietcombank:\nNgày giao dịch,Số tiền ghi có,Số tiền ghi nợ,Nội dung\n12/05/2026,1500000,,Chuyen tien tu Nguyen Van A\n13/05/2026,,80000,Mua sam cua hang ABC\n...`}
          rows={8}
          style={{ width: '100%', fontFamily: 'monospace', fontSize: 12, resize: 'vertical', minHeight: 120 }}
        />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
            💡 VCB: app → Lịch sử giao dịch → Xuất CSV. TCB: app → Sao kê → Tải về.
          </span>
          <button type="button" className="btn-primary" onClick={handleParse} disabled={!csvText.trim()}>
            <ChevronRight className="h-4 w-4" /> Phân tích
          </button>
        </div>
      </div>

      {/* Step 2: Preview */}
      {parsed && (
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>
              <strong>Bước 2:</strong> Xem trước ({parsed.length} dòng) — {detectedBank}
            </h3>
            <div style={{ display: 'flex', gap: 6 }}>
              <button type="button" className="btn-secondary" onClick={() => toggleAll(true)} style={{ padding: '4px 10px', fontSize: 11 }}>Chọn tất</button>
              <button type="button" className="btn-secondary" onClick={() => toggleAll(false)} style={{ padding: '4px 10px', fontSize: 11 }}>Bỏ chọn tất</button>
            </div>
          </div>

          <div style={{ overflow: 'auto', maxHeight: 400 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'var(--color-surface-row)', position: 'sticky', top: 0 }}>
                  <th style={{ padding: 6, textAlign: 'center', width: 32 }}>✓</th>
                  <th style={{ padding: 6, textAlign: 'left', width: 90 }}>Ngày</th>
                  <th style={{ padding: 6, textAlign: 'left' }}>Mô tả</th>
                  <th style={{ padding: 6, textAlign: 'right', width: 120 }}>Có (Thu)</th>
                  <th style={{ padding: 6, textAlign: 'right', width: 120 }}>Nợ (Chi)</th>
                </tr>
              </thead>
              <tbody>
                {parsed.map((e, i) => (
                  <tr key={i} style={{ borderTop: '1px solid var(--color-border-subtle)', opacity: e.selected ? 1 : 0.4 }}>
                    <td style={{ padding: 6, textAlign: 'center' }}>
                      <input type="checkbox" checked={e.selected} onChange={() => toggleEntry(i)} style={{ accentColor: 'var(--color-accent-primary)' }} />
                    </td>
                    <td style={{ padding: 6 }}>{e.date}</td>
                    <td style={{ padding: 6, fontSize: 11 }}>{e.description}</td>
                    <td style={{ padding: 6, textAlign: 'right', color: '#10B981', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                      {e.credit > 0 ? new Intl.NumberFormat('vi-VN').format(e.credit) : ''}
                    </td>
                    <td style={{ padding: 6, textAlign: 'right', color: '#DC2626', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                      {e.debit > 0 ? new Intl.NumberFormat('vi-VN').format(e.debit) : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ borderTop: '1px solid var(--color-border-subtle)', marginTop: 12, paddingTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div style={{ fontSize: 12 }}>
              <strong>{selectedCount}</strong> dòng được chọn ·{' '}
              <span style={{ color: '#10B981' }}>+{new Intl.NumberFormat('vi-VN').format(totalCredit)}đ thu</span>
              {' / '}
              <span style={{ color: '#DC2626' }}>-{new Intl.NumberFormat('vi-VN').format(totalDebit)}đ chi</span>
            </div>
            <button type="button" className="btn-primary" onClick={() => void handleImport()} disabled={importing || selectedCount === 0} style={{ padding: '10px 20px', fontWeight: 700 }}>
              <Save className="h-4 w-4" /> {importing ? 'Đang nhập...' : `Nhập ${selectedCount} dòng vào sổ`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
