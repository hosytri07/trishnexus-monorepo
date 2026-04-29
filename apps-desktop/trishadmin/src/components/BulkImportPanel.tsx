/**
 * BulkImportPanel — Phase 19.24.3.
 *
 * Bulk import CSV/TSV → Firestore collection.
 *
 * Workflow:
 *   1. Pick collection target (whitelist)
 *   2. Pick file CSV (Tauri file dialog)
 *   3. Parse + preview 10 rows đầu
 *   4. Confirm → batch write
 *   5. Show result + audit log
 */

import { useState } from 'react';
import { useAuth } from '@trishteam/auth/react';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import {
  type ImportResult,
  type ParseResult,
  type ParsedRow,
  importRowsToCollection,
  parseCsvText,
} from '../lib/bulk-import.js';
import { readTextFile, isInTauri } from '../tauri-bridge.js';
import { writeAudit } from '../lib/firestore-admin.js';

interface CollectionOption {
  id: string;
  label: string;
  warning?: string;
}

const COLLECTIONS: CollectionOption[] = [
  { id: 'standards', label: 'Quy chuẩn / TCVN' },
  { id: 'dinh_muc', label: 'Định mức XD' },
  { id: 'vat_lieu', label: 'Vật liệu XD' },
  { id: 'roads_vn', label: 'Đường VN' },
  {
    id: 'apps_meta',
    label: 'Apps Desktop metadata',
    warning: 'Cẩn thận — schema phức tạp.',
  },
];

const PREVIEW_LIMIT = 10;

export function BulkImportPanel(): JSX.Element {
  const { firebaseUser } = useAuth();
  const adminUid = firebaseUser?.uid ?? '';

  const [targetCollection, setTargetCollection] = useState<string>(COLLECTIONS[0].id);
  const [filePath, setFilePath] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [busy, setBusy] = useState<'parse' | 'import' | null>(null);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [overwrite, setOverwrite] = useState(true);
  const [confirmText, setConfirmText] = useState('');
  const [toast, setToast] = useState<{ text: string; tone: 'ok' | 'err' | 'warn' } | null>(null);

  function flash(tone: 'ok' | 'err' | 'warn', text: string): void {
    setToast({ text, tone });
    setTimeout(() => setToast(null), 4500);
  }

  async function handlePickFile(): Promise<void> {
    if (!isInTauri()) {
      flash('err', 'Chỉ chạy trong app desktop.');
      return;
    }
    setBusy('parse');
    try {
      const picked = await openDialog({
        multiple: false,
        filters: [{ name: 'CSV / TSV', extensions: ['csv', 'tsv', 'txt'] }],
        title: `Chọn file import vào "${targetCollection}"`,
      });
      const path = typeof picked === 'string' ? picked : null;
      if (!path) {
        setBusy(null);
        return;
      }
      const text = await readTextFile(path);
      const result = parseCsvText(text);
      setFilePath(path);
      setParseResult(result);
      setImportResult(null);
      setConfirmText('');
      if (result.warnings.length > 0) {
        flash('warn', result.warnings.join(' · '));
      }
    } catch (err) {
      flash('err', err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  async function handleImport(): Promise<void> {
    if (!parseResult || !filePath) return;
    if (confirmText !== 'IMPORT') {
      flash('err', 'Bạn cần gõ "IMPORT" để xác nhận.');
      return;
    }
    setBusy('import');
    setProgress({ current: 0, total: parseResult.rows.length });
    try {
      const result = await importRowsToCollection(targetCollection, parseResult.rows, {
        overwrite,
        onProgress: (current, total) => setProgress({ current, total }),
      });
      setImportResult(result);
      try {
        await writeAudit({
          actor_uid: adminUid,
          action: 'bulk_import',
          target_type: targetCollection,
          target_label: filePath,
          details: {
            imported: result.imported,
            skipped: result.skipped,
            failed: result.failed,
            total_rows: parseResult.rows.length,
            overwrite,
          },
        });
      } catch {
        /* ignore */
      }
      flash(
        result.failed === 0 && result.skipped === 0 ? 'ok' : 'warn',
        `Import xong: ${result.imported} OK · ${result.skipped} skip · ${result.failed} fail`,
      );
      setConfirmText('');
    } catch (err) {
      flash('err', err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
      setProgress(null);
    }
  }

  function reset(): void {
    setFilePath(null);
    setParseResult(null);
    setImportResult(null);
    setConfirmText('');
  }

  const selectedCol = COLLECTIONS.find((c) => c.id === targetCollection);

  return (
    <div className="panel-content">
      <header className="panel-header">
        <h1>📥 Bulk Import</h1>
        <p className="muted">
          Import dữ liệu CSV/TSV vào Firestore. Excel: lưu sang CSV UTF-8 trước (File → Save As → CSV UTF-8).
          Cột <code>id</code> bắt buộc — dùng làm doc ID.
        </p>
      </header>

      {toast ? (
        <div
          className={`alert ${
            toast.tone === 'ok' ? 'alert-success' : toast.tone === 'warn' ? 'alert-warning' : 'alert-error'
          }`}
        >
          {toast.text}
        </div>
      ) : null}

      {/* Step 1: Pick collection */}
      <section className="form-section">
        <label>
          <strong>Bước 1 — Chọn collection đích:</strong>
          <select
            value={targetCollection}
            onChange={(e) => {
              setTargetCollection(e.target.value);
              reset();
            }}
            disabled={busy !== null}
          >
            {COLLECTIONS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label} ({c.id})
              </option>
            ))}
          </select>
        </label>
        {selectedCol?.warning ? (
          <div className="alert alert-warning small">⚠ {selectedCol.warning}</div>
        ) : null}
      </section>

      {/* Step 2: Pick file */}
      <section className="form-section">
        <strong>Bước 2 — Chọn file CSV/TSV:</strong>
        <div className="actions-row">
          <button
            type="button"
            onClick={() => void handlePickFile()}
            disabled={busy !== null}
            className="btn btn-primary"
          >
            {busy === 'parse' ? '⏳ Đang đọc…' : '📂 Chọn file'}
          </button>
          {filePath ? (
            <span className="muted small file-path">{filePath}</span>
          ) : null}
          {parseResult ? (
            <button type="button" onClick={reset} className="btn btn-ghost btn-sm">
              ✕ Reset
            </button>
          ) : null}
        </div>
      </section>

      {/* Step 3: Preview */}
      {parseResult ? (
        <section className="form-section">
          <strong>Bước 3 — Xem trước ({parseResult.rows.length} dòng):</strong>
          <div className="muted small">
            Separator: <code>{parseResult.separator === '\t' ? 'TAB' : parseResult.separator}</code>
            {' · '}
            {parseResult.headers.length} cột
          </div>
          {parseResult.warnings.length > 0 ? (
            <div className="alert alert-warning small">
              {parseResult.warnings.map((w, i) => (
                <div key={i}>⚠ {w}</div>
              ))}
            </div>
          ) : null}
          {parseResult.rows.length > 0 ? (
            <div className="preview-table-wrap">
              <table className="data-table preview-table">
                <thead>
                  <tr>
                    {parseResult.headers.map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parseResult.rows.slice(0, PREVIEW_LIMIT).map((row, i) => (
                    <tr key={i}>
                      {parseResult.headers.map((h) => (
                        <td key={h}>{formatCell(row[h])}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {parseResult.rows.length > PREVIEW_LIMIT ? (
                <div className="muted small">
                  … và {parseResult.rows.length - PREVIEW_LIMIT} dòng nữa.
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}

      {/* Step 4: Confirm import */}
      {parseResult && parseResult.rows.length > 0 ? (
        <section className="form-section import-confirm">
          <strong>Bước 4 — Xác nhận import:</strong>
          <div className="alert alert-warning small">
            Sắp ghi <strong>{parseResult.rows.length} doc</strong> vào collection{' '}
            <code>{targetCollection}</code>. Mỗi row → 1 doc với ID = <code>row.id</code>.
          </div>
          <label className="inline-row">
            <input
              type="checkbox"
              checked={overwrite}
              onChange={(e) => setOverwrite(e.target.checked)}
              disabled={busy !== null}
            />
            <span>
              Ghi đè doc đã có (uncheck để giữ field cũ + merge field mới)
            </span>
          </label>
          <label>
            Gõ <code>IMPORT</code> để xác nhận:
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="IMPORT"
              disabled={busy !== null}
            />
          </label>
          <div className="actions-row">
            <button
              type="button"
              onClick={() => void handleImport()}
              disabled={busy !== null || confirmText !== 'IMPORT'}
              className="btn btn-warning"
            >
              {busy === 'import'
                ? `⏳ Đang import (${progress?.current ?? 0}/${progress?.total ?? 0})…`
                : '⬆ Import'}
            </button>
          </div>
        </section>
      ) : null}

      {/* Result */}
      {importResult ? (
        <section className="form-section">
          <strong>Kết quả:</strong>
          <div className="result-stats">
            <div className="stat-item">
              <span className="stat-value ok">{importResult.imported}</span>
              <span className="muted small">Imported</span>
            </div>
            <div className="stat-item">
              <span className="stat-value warn">{importResult.skipped}</span>
              <span className="muted small">Skipped</span>
            </div>
            <div className="stat-item">
              <span className="stat-value err">{importResult.failed}</span>
              <span className="muted small">Failed</span>
            </div>
          </div>
          {importResult.errors.length > 0 ? (
            <details>
              <summary>Errors ({importResult.errors.length})</summary>
              <ul className="error-list">
                {importResult.errors.slice(0, 50).map((e, i) => (
                  <li key={i}>
                    <code>Row {e.row}:</code> {e.message}
                  </li>
                ))}
              </ul>
              {importResult.errors.length > 50 ? (
                <p className="muted small">… và {importResult.errors.length - 50} lỗi nữa.</p>
              ) : null}
            </details>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function formatCell(val: ParsedRow[string]): string {
  if (val === null) return '';
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  return String(val);
}
