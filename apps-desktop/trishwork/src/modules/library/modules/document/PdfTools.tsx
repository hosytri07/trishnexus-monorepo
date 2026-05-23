/**
 * Phase 18.3.b — PDF Tools panel.
 *
 * 7 công cụ PDF chạy hoàn toàn offline qua Rust (lopdf + printpdf):
 *   1. 📊 PDF Info     — số trang, dung lượng, metadata
 *   2. 🔗 Merge        — gộp ≥2 PDF thành 1
 *   3. ✂ Split         — tách thành mỗi trang một file
 *   4. 📤 Extract      — trích trang theo range "1-3, 5, 7-10"
 *   5. 🗑 Delete       — xóa trang theo range
 *   6. 🔄 Rotate       — xoay 90°/180°/270° trang chọn (hoặc tất cả)
 *   7. 🖼 Images→PDF   — gộp ảnh thành PDF (A4/Letter)
 */

import { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open as openDialog, save as saveDialog } from '@tauri-apps/plugin-dialog';
import { useDialogs } from '../../components/dialogs/DialogProvider.js';

type ToolId =
  | 'info'
  | 'merge'
  | 'split'
  | 'extract'
  | 'delete'
  | 'rotate'
  | 'images'
  | 'watermark'
  | 'pagenum'
  | 'encrypt'
  | 'decrypt'
  | 'ocr'
  | 'extractImg'
  | 'binder'
  | 'stamp'
  | 'compare';

const TOOLS: Array<{ id: ToolId; icon: string; title: string; desc: string }> = [
  { id: 'info', icon: '📊', title: 'PDF Info', desc: 'Xem số trang, dung lượng, metadata' },
  { id: 'merge', icon: '🔗', title: 'Merge PDF', desc: 'Gộp ≥2 PDF thành 1' },
  { id: 'binder', icon: '📚', title: 'PDF Binder', desc: 'Gộp PDF theo danh mục + tự tạo bookmark sidebar' },
  { id: 'stamp', icon: '🏷', title: 'PDF Stamp Pro', desc: 'Đóng dấu / chữ ký / QR lên PDF' },
  { id: 'compare', icon: '📑', title: 'Compare Document', desc: 'So sánh 2 file PDF/Word/MD/TXT — highlight diff' },
  { id: 'split', icon: '✂', title: 'Split PDF', desc: 'Tách mỗi trang thành 1 file' },
  { id: 'extract', icon: '📤', title: 'Extract pages', desc: 'Trích trang ra PDF mới' },
  { id: 'delete', icon: '🗑', title: 'Delete pages', desc: 'Xóa trang khỏi PDF' },
  { id: 'rotate', icon: '🔄', title: 'Rotate pages', desc: 'Xoay 90/180/270°' },
  { id: 'images', icon: '🖼', title: 'Images → PDF', desc: 'Gộp ảnh thành PDF' },
  { id: 'watermark', icon: '💧', title: 'Watermark', desc: 'Thêm chữ chìm vào mỗi trang' },
  { id: 'pagenum', icon: '#️', title: 'Page numbers', desc: 'Đánh số trang Trang X / Y' },
  { id: 'encrypt', icon: '🔒', title: 'Đặt mật khẩu', desc: 'Encrypt AES-256 (cần qpdf)' },
  { id: 'decrypt', icon: '🔓', title: 'Bỏ mật khẩu', desc: 'Decrypt nếu biết pass (cần qpdf)' },
  { id: 'ocr', icon: '🔍', title: 'OCR PDF scan', desc: 'Tạo text layer từ ảnh (cần Tesseract)' },
  { id: 'extractImg', icon: '🖼', title: 'Trích ảnh', desc: 'Lưu tất cả ảnh trong PDF ra folder' },
];

export function PdfTools({
  tr,
  variant,
}: {
  tr: (key: string, vars?: Record<string, string | number>) => string;
  /** 'grid-only' = chỉ render các card vào grid bên ngoài, không wrap card/header */
  variant?: 'full' | 'grid-only';
}): JSX.Element {
  void tr;
  const { alert } = useDialogs();
  const [active, setActive] = useState<ToolId | null>(null);
  const [log, setLog] = useState<string[]>([]);

  function pushLog(line: string): void {
    setLog((prev) => [...prev.slice(-19), `${new Date().toLocaleTimeString()}  ${line}`]);
  }

  function close(): void {
    setActive(null);
  }

  // Mảng các modal active — render chung cho cả 2 variant
  const modals = (
    <>
      {active === 'info' && <ToolPdfInfo onClose={close} onLog={pushLog} />}
      {active === 'merge' && <ToolMerge onClose={close} onLog={pushLog} onAlert={alert} />}
      {active === 'split' && <ToolSplit onClose={close} onLog={pushLog} onAlert={alert} />}
      {active === 'extract' && (
        <ToolPageRange
          mode="extract"
          title="📤 Extract pages"
          actionLabel="Trích trang"
          onClose={close}
          onLog={pushLog}
          onAlert={alert}
        />
      )}
      {active === 'delete' && (
        <ToolPageRange
          mode="delete"
          title="🗑 Delete pages"
          actionLabel="Xóa trang"
          onClose={close}
          onLog={pushLog}
          onAlert={alert}
        />
      )}
      {active === 'rotate' && <ToolRotate onClose={close} onLog={pushLog} onAlert={alert} />}
      {active === 'images' && <ToolImages onClose={close} onLog={pushLog} onAlert={alert} />}
      {active === 'watermark' && <ToolWatermark onClose={close} onLog={pushLog} onAlert={alert} />}
      {active === 'pagenum' && <ToolPageNumbers onClose={close} onLog={pushLog} onAlert={alert} />}
      {active === 'encrypt' && (
        <ToolEncrypt mode="encrypt" onClose={close} onLog={pushLog} onAlert={alert} />
      )}
      {active === 'decrypt' && (
        <ToolEncrypt mode="decrypt" onClose={close} onLog={pushLog} onAlert={alert} />
      )}
      {active === 'ocr' && <ToolOcr onClose={close} onLog={pushLog} onAlert={alert} />}
      {active === 'extractImg' && <ToolExtractImg onClose={close} onLog={pushLog} />}
      {active === 'binder' && <ToolBinder onClose={close} onLog={pushLog} />}
      {active === 'stamp' && <ToolStamp onClose={close} onLog={pushLog} onAlert={alert} />}
      {active === 'compare' && <ToolCompare onClose={close} onLog={pushLog} onAlert={alert} />}
    </>
  );

  // grid-only: chỉ render các card → cho phép parent gộp vào 1 grid lớn
  if (variant === 'grid-only') {
    return (
      <>
        {TOOLS.map((t) => (
          <button
            key={t.id}
            type="button"
            className="pdf-tool-card pdf-tool-clickable"
            onClick={() => setActive(t.id)}
          >
            <span className="pdf-tool-icon">{t.icon}</span>
            <div>
              <strong>{t.title}</strong>
              <p className="muted small">{t.desc}</p>
            </div>
          </button>
        ))}
        {modals}
      </>
    );
  }

  return (
    <div className="doc-convert-content pdf-tools-content">
      <div className="pdf-tools-card">
        <header style={{ marginBottom: 14 }}>
          <h2 style={{ margin: 0 }}>📕 PDF Tools</h2>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            Bộ công cụ PDF offline (lopdf + printpdf) — 100% local, không upload.
          </p>
        </header>

        <div className="pdf-tools-grid">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              type="button"
              className="pdf-tool-card pdf-tool-clickable"
              onClick={() => setActive(t.id)}
            >
              <span className="pdf-tool-icon">{t.icon}</span>
              <div>
                <strong>{t.title}</strong>
                <p className="muted small">{t.desc}</p>
              </div>
            </button>
          ))}
        </div>

        {log.length > 0 && (
          <div className="pdf-tools-log">
            <div className="pdf-tools-log-head">
              <strong>Lịch sử</strong>
              <button className="mini" onClick={() => setLog([])}>
                Xóa
              </button>
            </div>
            <pre className="pdf-tools-log-body">{log.join('\n')}</pre>
          </div>
        )}
      </div>

      {modals}
    </div>
  );
}

// ============================================================
// Helpers
// ============================================================

function parsePageRange(input: string, max: number): number[] {
  const out = new Set<number>();
  const parts = input.split(',').map((s) => s.trim()).filter(Boolean);
  for (const part of parts) {
    if (part.includes('-')) {
      const [a, b] = part.split('-').map((s) => parseInt(s.trim(), 10));
      if (Number.isFinite(a) && Number.isFinite(b)) {
        const lo = Math.min(a, b);
        const hi = Math.max(a, b);
        for (let i = lo; i <= hi; i++) {
          if (i >= 1 && i <= max) out.add(i);
        }
      }
    } else {
      const n = parseInt(part, 10);
      if (Number.isFinite(n) && n >= 1 && n <= max) out.add(n);
    }
  }
  return Array.from(out).sort((a, b) => a - b);
}

async function pickPdfFile(): Promise<string | null> {
  const picked = await openDialog({
    multiple: false,
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  });
  return typeof picked === 'string' ? picked : null;
}

async function pickPdfFiles(): Promise<string[]> {
  const picked = await openDialog({
    multiple: true,
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  });
  if (Array.isArray(picked)) return picked;
  if (typeof picked === 'string') return [picked];
  return [];
}

async function pickImageFiles(): Promise<string[]> {
  const picked = await openDialog({
    multiple: true,
    filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif'] }],
  });
  if (Array.isArray(picked)) return picked;
  if (typeof picked === 'string') return [picked];
  return [];
}

async function pickSavePdf(suggested: string): Promise<string | null> {
  const target = await saveDialog({
    defaultPath: suggested,
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  });
  return typeof target === 'string' ? target : null;
}

async function pickSaveTxt(suggested: string): Promise<string | null> {
  const target = await saveDialog({
    defaultPath: suggested,
    filters: [{ name: 'Text', extensions: ['txt'] }],
  });
  return typeof target === 'string' ? target : null;
}

async function pickSaveDir(): Promise<string | null> {
  const target = await openDialog({ directory: true, multiple: false });
  return typeof target === 'string' ? target : null;
}

function basename(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

function stripExt(path: string): string {
  const base = basename(path);
  const i = base.lastIndexOf('.');
  return i > 0 ? base.slice(0, i) : base;
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(2)} MB`;
}

// ============================================================
// Modal wrapper
// ============================================================

function ToolModal({
  title,
  onClose,
  children,
  busy,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  busy?: boolean;
}): JSX.Element {
  return (
    <div className="modal-backdrop" onClick={busy ? undefined : onClose}>
      <div className="modal pdf-tool-modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <h2>{title}</h2>
          <button className="mini" onClick={onClose} disabled={busy}>
            ×
          </button>
        </header>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

// ============================================================
// 1. PDF Info
// ============================================================

function ToolPdfInfo({
  onClose,
  onLog,
}: {
  onClose: () => void;
  onLog: (line: string) => void;
}): JSX.Element {
  const [path, setPath] = useState('');
  const [info, setInfo] = useState<{
    page_count: number;
    file_size: number;
    title?: string;
    author?: string;
    producer?: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function pick(): Promise<void> {
    const p = await pickPdfFile();
    if (!p) return;
    setPath(p);
    setBusy(true);
    setErr(null);
    setInfo(null);
    try {
      const result = await invoke<typeof info>('pdf_info', { path: p });
      setInfo(result);
      if (result) {
        onLog(`📊 ${basename(p)}: ${result.page_count} trang · ${formatBytes(result.file_size)}`);
      }
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ToolModal title="📊 PDF Info" onClose={onClose} busy={busy}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <button className="btn btn-primary" onClick={() => void pick()} disabled={busy}>
          📁 Chọn PDF
        </button>
        <span className="muted small" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
          {path || '(chưa chọn)'}
        </span>
      </div>
      {busy && <p className="muted">⏳ Đang đọc…</p>}
      {err && <p style={{ color: 'var(--danger, #c43)' }}>⚠ {err}</p>}
      {info && (
        <div className="pdf-info-grid">
          <span className="muted">Số trang</span>
          <strong>{info.page_count}</strong>
          <span className="muted">Dung lượng</span>
          <strong>{formatBytes(info.file_size)}</strong>
          <span className="muted">Tiêu đề</span>
          <span>{info.title || '—'}</span>
          <span className="muted">Tác giả</span>
          <span>{info.author || '—'}</span>
          <span className="muted">Producer</span>
          <span>{info.producer || '—'}</span>
        </div>
      )}
    </ToolModal>
  );
}

// ============================================================
// 2. Merge
// ============================================================

function ToolMerge({
  onClose,
  onLog,
  onAlert,
}: {
  onClose: () => void;
  onLog: (line: string) => void;
  onAlert: ReturnType<typeof useDialogs>['alert'];
}): JSX.Element {
  const [files, setFiles] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function add(): Promise<void> {
    const picked = await pickPdfFiles();
    if (picked.length > 0) setFiles((prev) => [...prev, ...picked]);
  }

  function move(from: number, to: number): void {
    if (to < 0 || to >= files.length) return;
    const next = [...files];
    [next[from], next[to]] = [next[to], next[from]];
    setFiles(next);
  }

  function remove(idx: number): void {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  async function run(): Promise<void> {
    if (files.length < 2) {
      setErr('Cần ít nhất 2 PDF');
      return;
    }
    const target = await pickSavePdf('merged.pdf');
    if (!target) return;
    setBusy(true);
    setErr(null);
    try {
      const pages = await invoke<number>('pdf_merge', {
        inputPaths: files,
        outputPath: target,
      });
      onLog(`🔗 Gộp ${files.length} PDF (${pages} trang) → ${basename(target)}`);
      await onAlert({ title: 'Thành công', message: `✓ Đã gộp ${files.length} PDF (${pages} trang)\n→ ${target}`, variant: 'success' });
      onClose();
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ToolModal title="🔗 Merge PDF" onClose={onClose} busy={busy}>
      <p className="muted small" style={{ marginTop: 0 }}>
        Sắp xếp thứ tự bằng nút ↑↓. Output là 1 file PDF chứa tất cả trang theo đúng thứ tự.
      </p>
      <button className="btn btn-primary btn-sm" onClick={() => void add()} disabled={busy}>
        + Thêm PDF
      </button>
      <div className="pdf-merge-list">
        {files.length === 0 ? (
          <p className="muted small" style={{ padding: 12 }}>
            (Chưa có file nào — bấm "+ Thêm PDF")
          </p>
        ) : (
          files.map((f, i) => (
            <div key={`${f}-${i}`} className="pdf-merge-row">
              <span className="muted small" style={{ width: 24 }}>{i + 1}.</span>
              <span title={f} style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {basename(f)}
              </span>
              <button className="mini" onClick={() => move(i, i - 1)} disabled={i === 0}>
                ↑
              </button>
              <button className="mini" onClick={() => move(i, i + 1)} disabled={i === files.length - 1}>
                ↓
              </button>
              <button className="mini" onClick={() => remove(i)}>×</button>
            </div>
          ))
        )}
      </div>
      {err && <p style={{ color: 'var(--danger, #c43)' }}>⚠ {err}</p>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
        <button className="btn btn-ghost" onClick={onClose} disabled={busy}>
          Đóng
        </button>
        <button className="btn btn-primary" onClick={() => void run()} disabled={busy || files.length < 2}>
          {busy ? '⏳ Đang gộp…' : `🔗 Gộp ${files.length} PDF`}
        </button>
      </div>
    </ToolModal>
  );
}

// ============================================================
// 3. Split
// ============================================================

function ToolSplit({
  onClose,
  onLog,
  onAlert,
}: {
  onClose: () => void;
  onLog: (line: string) => void;
  onAlert: ReturnType<typeof useDialogs>['alert'];
}): JSX.Element {
  const [path, setPath] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run(): Promise<void> {
    if (!path) {
      const p = await pickPdfFile();
      if (!p) return;
      setPath(p);
      return;
    }
    const dir = await pickSaveDir();
    if (!dir) return;
    setBusy(true);
    setErr(null);
    try {
      const count = await invoke<number>('pdf_split', {
        inputPath: path,
        outputDir: dir,
      });
      onLog(`✂ Split ${basename(path)} → ${count} files trong ${dir}`);
      await onAlert({ title: 'Thành công', message: `✓ Đã tách thành ${count} file\n→ ${dir}`, variant: 'success' });
      onClose();
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ToolModal title="✂ Split PDF" onClose={onClose} busy={busy}>
      <p className="muted small" style={{ marginTop: 0 }}>
        Tách mỗi trang thành 1 file PDF riêng (đặt tên <code>filename_p001.pdf</code>, <code>_p002.pdf</code>...)
      </p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
        <button className="btn btn-primary btn-sm" onClick={() => void pickPdfFile().then((p) => p && setPath(p))} disabled={busy}>
          📁 Chọn PDF
        </button>
        <span className="muted small" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {path || '(chưa chọn)'}
        </span>
      </div>
      {err && <p style={{ color: 'var(--danger, #c43)' }}>⚠ {err}</p>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
        <button className="btn btn-ghost" onClick={onClose} disabled={busy}>
          Đóng
        </button>
        <button className="btn btn-primary" onClick={() => void run()} disabled={busy || !path}>
          {busy ? '⏳ Đang tách…' : '✂ Chọn thư mục → Tách'}
        </button>
      </div>
    </ToolModal>
  );
}

// ============================================================
// 4 + 5. Extract / Delete pages (shared UI)
// ============================================================

function ToolPageRange({
  mode,
  title,
  actionLabel,
  onClose,
  onLog,
  onAlert,
}: {
  mode: 'extract' | 'delete';
  title: string;
  actionLabel: string;
  onClose: () => void;
  onLog: (line: string) => void;
  onAlert: ReturnType<typeof useDialogs>['alert'];
}): JSX.Element {
  const [path, setPath] = useState('');
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [range, setRange] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function pick(): Promise<void> {
    const p = await pickPdfFile();
    if (!p) return;
    setPath(p);
    setPageCount(null);
    setErr(null);
    try {
      const info = await invoke<{ page_count: number }>('pdf_info', { path: p });
      setPageCount(info.page_count);
    } catch (e) {
      setErr(String(e));
    }
  }

  async function run(): Promise<void> {
    if (!path || !pageCount) return;
    const pages = parsePageRange(range, pageCount);
    if (pages.length === 0) {
      setErr('Range trống hoặc không hợp lệ');
      return;
    }
    const suffix = mode === 'extract' ? '_extracted' : '_trimmed';
    const target = await pickSavePdf(`${stripExt(path)}${suffix}.pdf`);
    if (!target) return;
    setBusy(true);
    setErr(null);
    try {
      const cmd = mode === 'extract' ? 'pdf_extract_pages' : 'pdf_delete_pages';
      const count = await invoke<number>(cmd, {
        inputPath: path,
        pages,
        outputPath: target,
      });
      const verb = mode === 'extract' ? 'trích' : 'xóa, còn';
      onLog(`${mode === 'extract' ? '📤' : '🗑'} ${basename(path)}: ${verb} ${count} trang → ${basename(target)}`);
      await onAlert({ title: 'Thành công', message: `✓ ${mode === 'extract' ? 'Đã trích' : 'Đã xóa, còn'} ${count} trang\n→ ${target}`, variant: 'success' });
      onClose();
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ToolModal title={title} onClose={onClose} busy={busy}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
        <button className="btn btn-primary btn-sm" onClick={() => void pick()} disabled={busy}>
          📁 Chọn PDF
        </button>
        <span className="muted small" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {path ? `${basename(path)}${pageCount ? ` · ${pageCount} trang` : ''}` : '(chưa chọn)'}
        </span>
      </div>
      <label className="muted small" style={{ display: 'block', marginBottom: 4 }}>
        Range trang (ví dụ <code>1-3, 5, 7-10</code>)
      </label>
      <input
        type="text"
        value={range}
        onChange={(e) => setRange(e.target.value)}
        placeholder="1-3, 5, 7-10"
        style={{
          width: '100%',
          padding: '6px 10px',
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          borderRadius: 4,
          color: 'var(--fg)',
          fontFamily: 'var(--mono, monospace)',
        }}
        disabled={busy || !path}
      />
      {pageCount && (
        <p className="muted small" style={{ margin: '6px 0 0' }}>
          Sẽ {mode === 'extract' ? 'giữ' : 'xóa'} {parsePageRange(range, pageCount).length} / {pageCount} trang
        </p>
      )}
      {err && <p style={{ color: 'var(--danger, #c43)' }}>⚠ {err}</p>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
        <button className="btn btn-ghost" onClick={onClose} disabled={busy}>
          Đóng
        </button>
        <button className="btn btn-primary" onClick={() => void run()} disabled={busy || !path || !range.trim()}>
          {busy ? '⏳ Đang xử lý…' : actionLabel}
        </button>
      </div>
    </ToolModal>
  );
}

// ============================================================
// 6. Rotate
// ============================================================

function ToolRotate({
  onClose,
  onLog,
  onAlert,
}: {
  onClose: () => void;
  onLog: (line: string) => void;
  onAlert: ReturnType<typeof useDialogs>['alert'];
}): JSX.Element {
  const [path, setPath] = useState('');
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [range, setRange] = useState('');
  const [angle, setAngle] = useState<90 | 180 | 270>(90);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function pick(): Promise<void> {
    const p = await pickPdfFile();
    if (!p) return;
    setPath(p);
    try {
      const info = await invoke<{ page_count: number }>('pdf_info', { path: p });
      setPageCount(info.page_count);
    } catch (e) {
      setErr(String(e));
    }
  }

  async function run(): Promise<void> {
    if (!path || !pageCount) return;
    const pages = range.trim() ? parsePageRange(range, pageCount) : [];
    const target = await pickSavePdf(`${stripExt(path)}_rotated.pdf`);
    if (!target) return;
    setBusy(true);
    setErr(null);
    try {
      const count = await invoke<number>('pdf_rotate_pages', {
        inputPath: path,
        pages,
        angle,
        outputPath: target,
      });
      onLog(`🔄 Xoay ${count} trang ${angle}° trong ${basename(path)}`);
      await onAlert({ title: 'Thành công', message: `✓ Đã xoay ${count} trang ${angle}°\n→ ${target}`, variant: 'success' });
      onClose();
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ToolModal title="🔄 Rotate pages" onClose={onClose} busy={busy}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
        <button className="btn btn-primary btn-sm" onClick={() => void pick()} disabled={busy}>
          📁 Chọn PDF
        </button>
        <span className="muted small" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {path ? `${basename(path)}${pageCount ? ` · ${pageCount} trang` : ''}` : '(chưa chọn)'}
        </span>
      </div>
      <label className="muted small" style={{ display: 'block', marginBottom: 4 }}>
        Range trang (để trống = tất cả)
      </label>
      <input
        type="text"
        value={range}
        onChange={(e) => setRange(e.target.value)}
        placeholder="1-3, 5"
        style={{
          width: '100%',
          padding: '6px 10px',
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          borderRadius: 4,
          color: 'var(--fg)',
          fontFamily: 'var(--mono, monospace)',
          marginBottom: 12,
        }}
        disabled={busy || !path}
      />
      <label className="muted small" style={{ display: 'block', marginBottom: 4 }}>
        Góc xoay
      </label>
      <div className="segmented" style={{ marginBottom: 8 }}>
        {[90, 180, 270].map((a) => (
          <button
            key={a}
            type="button"
            className={`seg-btn ${angle === a ? 'active' : ''}`}
            onClick={() => setAngle(a as 90 | 180 | 270)}
          >
            {a}°
          </button>
        ))}
      </div>
      {err && <p style={{ color: 'var(--danger, #c43)' }}>⚠ {err}</p>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
        <button className="btn btn-ghost" onClick={onClose} disabled={busy}>
          Đóng
        </button>
        <button className="btn btn-primary" onClick={() => void run()} disabled={busy || !path}>
          {busy ? '⏳ Đang xoay…' : `🔄 Xoay ${angle}°`}
        </button>
      </div>
    </ToolModal>
  );
}

// ============================================================
// 7. Images → PDF
// ============================================================

function ToolImages({
  onClose,
  onLog,
  onAlert,
}: {
  onClose: () => void;
  onLog: (line: string) => void;
  onAlert: ReturnType<typeof useDialogs>['alert'];
}): JSX.Element {
  const [files, setFiles] = useState<string[]>([]);
  const [pageSize, setPageSize] = useState<'a4' | 'letter'>('a4');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function add(): Promise<void> {
    const picked = await pickImageFiles();
    if (picked.length > 0) setFiles((prev) => [...prev, ...picked]);
  }

  function move(from: number, to: number): void {
    if (to < 0 || to >= files.length) return;
    const next = [...files];
    [next[from], next[to]] = [next[to], next[from]];
    setFiles(next);
  }

  function remove(idx: number): void {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  async function run(): Promise<void> {
    if (files.length === 0) {
      setErr('Cần ít nhất 1 ảnh');
      return;
    }
    const target = await pickSavePdf('images.pdf');
    if (!target) return;
    setBusy(true);
    setErr(null);
    try {
      const count = await invoke<number>('images_to_pdf', {
        inputPaths: files,
        outputPath: target,
        pageSize,
      });
      onLog(`🖼 ${count} ảnh → ${basename(target)} (${pageSize.toUpperCase()})`);
      await onAlert({ title: 'Thành công', message: `✓ Đã tạo PDF từ ${count} ảnh\n→ ${target}`, variant: 'success' });
      onClose();
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ToolModal title="🖼 Images → PDF" onClose={onClose} busy={busy}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="btn btn-primary btn-sm" onClick={() => void add()} disabled={busy}>
          + Thêm ảnh
        </button>
        <span className="muted small">Khổ giấy:</span>
        <div className="segmented">
          {(['a4', 'letter'] as const).map((s) => (
            <button
              key={s}
              type="button"
              className={`seg-btn ${pageSize === s ? 'active' : ''}`}
              onClick={() => setPageSize(s)}
            >
              {s.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      <div className="pdf-merge-list">
        {files.length === 0 ? (
          <p className="muted small" style={{ padding: 12 }}>
            (Chưa có ảnh nào — bấm "+ Thêm ảnh")
          </p>
        ) : (
          files.map((f, i) => (
            <div key={`${f}-${i}`} className="pdf-merge-row">
              <span className="muted small" style={{ width: 24 }}>{i + 1}.</span>
              <span title={f} style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {basename(f)}
              </span>
              <button className="mini" onClick={() => move(i, i - 1)} disabled={i === 0}>↑</button>
              <button className="mini" onClick={() => move(i, i + 1)} disabled={i === files.length - 1}>↓</button>
              <button className="mini" onClick={() => remove(i)}>×</button>
            </div>
          ))
        )}
      </div>
      {err && <p style={{ color: 'var(--danger, #c43)' }}>⚠ {err}</p>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
        <button className="btn btn-ghost" onClick={onClose} disabled={busy}>
          Đóng
        </button>
        <button className="btn btn-primary" onClick={() => void run()} disabled={busy || files.length === 0}>
          {busy ? '⏳ Đang tạo…' : `🖼 Tạo PDF (${files.length} ảnh)`}
        </button>
      </div>
    </ToolModal>
  );
}

// ============================================================
// 8. Watermark
// ============================================================

function ToolWatermark({
  onClose,
  onLog,
  onAlert,
}: {
  onClose: () => void;
  onLog: (line: string) => void;
  onAlert: ReturnType<typeof useDialogs>['alert'];
}): JSX.Element {
  const [path, setPath] = useState('');
  const [text, setText] = useState('CONFIDENTIAL');
  const [opacity, setOpacity] = useState(0.25);
  const [fontSize, setFontSize] = useState(72);
  const [angle, setAngle] = useState(45);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run(): Promise<void> {
    if (!path) {
      const p = await pickPdfFile();
      if (!p) return;
      setPath(p);
      return;
    }
    if (!text.trim()) {
      setErr('Cần nhập text watermark');
      return;
    }
    const target = await pickSavePdf(`${stripExt(path)}_watermarked.pdf`);
    if (!target) return;
    setBusy(true);
    setErr(null);
    try {
      const count = await invoke<number>('pdf_add_watermark', {
        inputPath: path,
        text,
        outputPath: target,
        opacity,
        fontSize,
        angleDeg: angle,
      });
      onLog(`💧 Watermark "${text}" trên ${count} trang → ${basename(target)}`);
      await onAlert({ title: 'Thành công', message: `✓ Đã thêm watermark vào ${count} trang\n→ ${target}`, variant: 'success' });
      onClose();
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ToolModal title="💧 Watermark" onClose={onClose} busy={busy}>
      <p className="muted small" style={{ marginTop: 0 }}>
        Thêm chữ chìm ở giữa mỗi trang. Helvetica, hỗ trợ ASCII (tiếng Việt sẽ hiện dấu hỏi).
      </p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => void pickPdfFile().then((p) => p && setPath(p))}
          disabled={busy}
        >
          📁 Chọn PDF
        </button>
        <span className="muted small" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {path || '(chưa chọn)'}
        </span>
      </div>

      <label className="muted small" style={{ display: 'block', marginBottom: 4 }}>
        Text watermark
      </label>
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="DRAFT"
        style={{
          width: '100%',
          padding: '6px 10px',
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          borderRadius: 4,
          color: 'var(--fg)',
          fontWeight: 600,
          fontSize: 16,
          textTransform: 'uppercase',
          letterSpacing: 2,
          marginBottom: 12,
        }}
        disabled={busy || !path}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div>
          <label className="muted small">Opacity ({Math.round(opacity * 100)}%)</label>
          <input
            type="range"
            min={0.05}
            max={1}
            step={0.05}
            value={opacity}
            onChange={(e) => setOpacity(parseFloat(e.target.value))}
            style={{ width: '100%' }}
            disabled={busy}
          />
        </div>
        <div>
          <label className="muted small">Cỡ chữ ({fontSize}pt)</label>
          <input
            type="range"
            min={20}
            max={150}
            step={4}
            value={fontSize}
            onChange={(e) => setFontSize(parseInt(e.target.value, 10))}
            style={{ width: '100%' }}
            disabled={busy}
          />
        </div>
        <div>
          <label className="muted small">Góc xoay ({angle}°)</label>
          <input
            type="range"
            min={-90}
            max={90}
            step={5}
            value={angle}
            onChange={(e) => setAngle(parseInt(e.target.value, 10))}
            style={{ width: '100%' }}
            disabled={busy}
          />
        </div>
      </div>

      {/* Live preview */}
      <div className="pdf-watermark-preview">
        <span
          style={{
            opacity,
            transform: `rotate(${-angle}deg)`,
            fontSize: Math.min(fontSize / 1.5, 64),
            color: '#888',
            fontWeight: 700,
            letterSpacing: 2,
          }}
        >
          {text || 'WATERMARK'}
        </span>
      </div>

      {err && <p style={{ color: 'var(--danger, #c43)' }}>⚠ {err}</p>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
        <button className="btn btn-ghost" onClick={onClose} disabled={busy}>
          Đóng
        </button>
        <button className="btn btn-primary" onClick={() => void run()} disabled={busy || !path || !text.trim()}>
          {busy ? '⏳ Đang xử lý…' : '💧 Thêm watermark'}
        </button>
      </div>
    </ToolModal>
  );
}

// ============================================================
// 9. Page numbers
// ============================================================

function ToolPageNumbers({
  onClose,
  onLog,
  onAlert,
}: {
  onClose: () => void;
  onLog: (line: string) => void;
  onAlert: ReturnType<typeof useDialogs>['alert'];
}): JSX.Element {
  const [path, setPath] = useState('');
  const [template, setTemplate] = useState('Trang {n} / {total}');
  const [fontSize, setFontSize] = useState(10);
  const [position, setPosition] = useState<'footer-left' | 'footer-center' | 'footer-right'>(
    'footer-center',
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run(): Promise<void> {
    if (!path) {
      const p = await pickPdfFile();
      if (!p) return;
      setPath(p);
      return;
    }
    if (!template.trim()) {
      setErr('Cần nhập format số trang');
      return;
    }
    const target = await pickSavePdf(`${stripExt(path)}_numbered.pdf`);
    if (!target) return;
    setBusy(true);
    setErr(null);
    try {
      const count = await invoke<number>('pdf_add_page_numbers', {
        inputPath: path,
        outputPath: target,
        formatTemplate: template,
        fontSize,
        position,
      });
      onLog(`#️ Đánh số ${count} trang → ${basename(target)}`);
      await onAlert({ title: 'Thành công', message: `✓ Đã đánh số ${count} trang\n→ ${target}`, variant: 'success' });
      onClose();
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ToolModal title="#️ Page numbers" onClose={onClose} busy={busy}>
      <p className="muted small" style={{ marginTop: 0 }}>
        Thêm số trang ở footer mỗi trang. Placeholder: <code>{`{n}`}</code> = số hiện tại,{' '}
        <code>{`{total}`}</code> = tổng số.
      </p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => void pickPdfFile().then((p) => p && setPath(p))}
          disabled={busy}
        >
          📁 Chọn PDF
        </button>
        <span className="muted small" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {path || '(chưa chọn)'}
        </span>
      </div>

      <label className="muted small" style={{ display: 'block', marginBottom: 4 }}>
        Format
      </label>
      <input
        type="text"
        value={template}
        onChange={(e) => setTemplate(e.target.value)}
        placeholder="Trang {n} / {total}"
        style={{
          width: '100%',
          padding: '6px 10px',
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          borderRadius: 4,
          color: 'var(--fg)',
          fontFamily: 'var(--mono, monospace)',
          marginBottom: 6,
        }}
        disabled={busy || !path}
      />
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {[
          'Trang {n} / {total}',
          '{n} / {total}',
          'Page {n} of {total}',
          '— {n} —',
          '{n}',
        ].map((s) => (
          <button
            key={s}
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setTemplate(s)}
          >
            {s}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div>
          <label className="muted small">Vị trí</label>
          <div className="segmented">
            {(
              [
                { v: 'footer-left', label: '←' },
                { v: 'footer-center', label: '⩌' },
                { v: 'footer-right', label: '→' },
              ] as const
            ).map((p) => (
              <button
                key={p.v}
                type="button"
                className={`seg-btn ${position === p.v ? 'active' : ''}`}
                onClick={() => setPosition(p.v)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="muted small">Cỡ chữ ({fontSize}pt)</label>
          <input
            type="range"
            min={7}
            max={20}
            value={fontSize}
            onChange={(e) => setFontSize(parseInt(e.target.value, 10))}
            style={{ width: '100%' }}
            disabled={busy}
          />
        </div>
      </div>

      {err && <p style={{ color: 'var(--danger, #c43)' }}>⚠ {err}</p>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
        <button className="btn btn-ghost" onClick={onClose} disabled={busy}>
          Đóng
        </button>
        <button className="btn btn-primary" onClick={() => void run()} disabled={busy || !path}>
          {busy ? '⏳ Đang đánh số…' : '#️ Đánh số trang'}
        </button>
      </div>
    </ToolModal>
  );
}

// ============================================================
// 10 + 11. Encrypt / Decrypt (qpdf subprocess)
// ============================================================

function ToolEncrypt({
  mode,
  onClose,
  onLog,
  onAlert,
}: {
  mode: 'encrypt' | 'decrypt';
  onClose: () => void;
  onLog: (line: string) => void;
  onAlert: ReturnType<typeof useDialogs>['alert'];
}): JSX.Element {
  const [path, setPath] = useState('');
  const [userPwd, setUserPwd] = useState('');
  const [ownerPwd, setOwnerPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [qpdfStatus, setQpdfStatus] = useState<{
    available: boolean;
    version?: string;
    hint: string;
  } | null>(null);

  useEffect(() => {
    void invoke<typeof qpdfStatus>('check_qpdf')
      .then(setQpdfStatus)
      .catch(() => setQpdfStatus({ available: false, hint: 'Lỗi kiểm tra qpdf' }));
  }, []);

  async function run(): Promise<void> {
    if (!path) {
      const p = await pickPdfFile();
      if (!p) return;
      setPath(p);
      return;
    }
    if (mode === 'encrypt') {
      if (!userPwd.trim()) {
        setErr('Mật khẩu user không được rỗng');
        return;
      }
      if (userPwd !== confirmPwd) {
        setErr('Mật khẩu xác nhận không khớp');
        return;
      }
    } else {
      if (!userPwd.trim()) {
        setErr('Cần nhập mật khẩu hiện tại để gỡ');
        return;
      }
    }
    const suffix = mode === 'encrypt' ? '_encrypted' : '_decrypted';
    const target = await pickSavePdf(`${stripExt(path)}${suffix}.pdf`);
    if (!target) return;
    setBusy(true);
    setErr(null);
    try {
      if (mode === 'encrypt') {
        await invoke('pdf_set_password', {
          inputPath: path,
          outputPath: target,
          userPassword: userPwd,
          ownerPassword: ownerPwd,
        });
        onLog(`🔒 Đặt mật khẩu cho ${basename(path)} → ${basename(target)}`);
      } else {
        await invoke('pdf_remove_password', {
          inputPath: path,
          outputPath: target,
          password: userPwd,
        });
        onLog(`🔓 Bỏ mật khẩu ${basename(path)} → ${basename(target)}`);
      }
      await onAlert({ title: 'Thành công', message: `✓ Hoàn tất\n→ ${target}`, variant: 'success' });
      onClose();
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  const isEncrypt = mode === 'encrypt';

  return (
    <ToolModal
      title={isEncrypt ? '🔒 Đặt mật khẩu PDF' : '🔓 Bỏ mật khẩu PDF'}
      onClose={onClose}
      busy={busy}
    >
      {qpdfStatus && !qpdfStatus.available && (
        <div className="pdf-tool-warn">
          ⚠ <strong>Cần qpdf:</strong>
          {'\n'}
          {qpdfStatus.hint}
        </div>
      )}
      {qpdfStatus?.available && (
        <p className="muted small" style={{ marginTop: 0 }}>
          ✓ qpdf sẵn sàng: <code>{qpdfStatus.version}</code>
        </p>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => void pickPdfFile().then((p) => p && setPath(p))}
          disabled={busy}
        >
          📁 Chọn PDF
        </button>
        <span className="muted small" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {path || '(chưa chọn)'}
        </span>
      </div>

      <label className="muted small" style={{ display: 'block', marginBottom: 4 }}>
        {isEncrypt ? 'Mật khẩu user (cần để mở file)' : 'Mật khẩu hiện tại của file'}
      </label>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        <input
          type={showPwd ? 'text' : 'password'}
          value={userPwd}
          onChange={(e) => setUserPwd(e.target.value)}
          placeholder="Nhập mật khẩu…"
          className="pdf-pwd-input"
          disabled={busy || !path}
        />
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowPwd((v) => !v)}>
          {showPwd ? '🙈' : '👁'}
        </button>
      </div>

      {isEncrypt && (
        <>
          <label className="muted small" style={{ display: 'block', marginBottom: 4 }}>
            Xác nhận lại mật khẩu user
          </label>
          <input
            type={showPwd ? 'text' : 'password'}
            value={confirmPwd}
            onChange={(e) => setConfirmPwd(e.target.value)}
            placeholder="Gõ lại để chắc chắn…"
            className="pdf-pwd-input"
            style={{ marginBottom: 12 }}
            disabled={busy || !path}
          />
          <label className="muted small" style={{ display: 'block', marginBottom: 4 }}>
            Owner password (admin — tùy chọn, để trống = dùng user pass)
          </label>
          <input
            type={showPwd ? 'text' : 'password'}
            value={ownerPwd}
            onChange={(e) => setOwnerPwd(e.target.value)}
            placeholder="(để trống dùng user pass)"
            className="pdf-pwd-input"
            disabled={busy || !path}
          />
          <p className="muted small" style={{ marginTop: 8 }}>
            🔐 Mã hóa AES-256. Không có pass = không mở được file. Lưu pass cẩn thận!
          </p>
        </>
      )}

      {err && <p style={{ color: 'var(--danger, #c43)' }}>⚠ {err}</p>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
        <button className="btn btn-ghost" onClick={onClose} disabled={busy}>
          Đóng
        </button>
        <button
          className="btn btn-primary"
          onClick={() => void run()}
          disabled={busy || !path || !qpdfStatus?.available || !userPwd.trim()}
        >
          {busy ? '⏳ Đang xử lý…' : isEncrypt ? '🔒 Đặt mật khẩu' : '🔓 Bỏ mật khẩu'}
        </button>
      </div>
    </ToolModal>
  );
}

// ============================================================
// 12. OCR PDF scanned (Tesseract subprocess)
// ============================================================

/**
 * Phase 39 — OCR PDF scanned (Native Tesseract pipeline).
 *
 * Workflow mới (fix bug Phase 18.3.b.4 — tesseract KHÔNG accept PDF input):
 *   1. Render từng page PDF → PNG bytes qua pdfjs canvas (300 DPI scale=3).
 *   2. Per page: invoke 'ocr_image_to_pdf_page' (searchable PDF) hoặc 'ocr_image_bytes' (text only).
 *   3. Mode "Searchable PDF": merge pages bytes → output.pdf (qua lopdf).
 *   4. Mode "Text only": concat text → save .txt.
 *
 * Tesseract config: --psm 1 (auto page segmentation + OSD), --oem 1 (LSTM neural — chính xác nhất).
 * Default langs: vie+eng (cần vie.traineddata + eng.traineddata trong tessdata).
 */
function ToolOcr({
  onClose,
  onLog,
  onAlert,
}: {
  onClose: () => void;
  onLog: (line: string) => void;
  onAlert: ReturnType<typeof useDialogs>['alert'];
}): JSX.Element {
  const [path, setPath] = useState('');
  // Default 'vie' only — vie+eng confuses Tesseract → mất dấu Tiếng Việt
  const [lang, setLang] = useState('vie');
  const [outputMode, setOutputMode] = useState<'searchable_pdf' | 'text'>('searchable_pdf');
  const [dpi, setDpi] = useState<200 | 300 | 400 | 600>(300);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [cancelRef, setCancelRef] = useState<{ cancel: boolean }>({ cancel: false });
  const [tessStatus, setTessStatus] = useState<{
    available: boolean;
    version?: string;
    hint: string;
  } | null>(null);

  useEffect(() => {
    void invoke<typeof tessStatus>('check_tesseract')
      .then(setTessStatus)
      .catch(() => setTessStatus({ available: false, hint: 'Lỗi kiểm tra tesseract' }));
  }, []);

  async function run(): Promise<void> {
    if (!path) {
      const p = await pickPdfFile();
      if (!p) return;
      setPath(p);
      return;
    }
    const ext = outputMode === 'searchable_pdf' ? 'pdf' : 'txt';
    const target =
      outputMode === 'searchable_pdf'
        ? await pickSavePdf(`${stripExt(path)}_ocr.${ext}`)
        : await pickSaveTxt(`${stripExt(path)}_ocr.${ext}`);
    if (!target) return;

    setBusy(true);
    setErr(null);
    setProgress(null);
    const ref = { cancel: false };
    setCancelRef(ref);

    try {
      // 1. Read PDF as ArrayBuffer
      const pdfBytes = await invoke<number[]>('read_binary_file', { path });
      const buffer = new Uint8Array(pdfBytes).buffer;

      // 2. Init pdfjs + open document
      const pdfjs = await import('pdfjs-dist');
      const workerUrl = (
        await import(
          // @ts-ignore — Vite ?url suffix
          'pdfjs-dist/build/pdf.worker.min.mjs?url'
        )
      ).default;
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
      const pdf = await pdfjs.getDocument({ data: buffer }).promise;
      const total = pdf.numPages;
      setProgress({ done: 0, total });

      // 3. Per-page render → OCR
      const scale = dpi / 96; // pdfjs default DPI ≈ 96
      const pdfPagesBytes: number[][] = [];
      const textBuf: string[] = [];

      for (let i = 1; i <= total; i++) {
        if (ref.cancel) {
          throw new Error('Đã hủy OCR');
        }
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas 2D context fail');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport }).promise;

        // Canvas → PNG blob → bytes
        const blob = await new Promise<Blob | null>((res) =>
          canvas.toBlob(res, 'image/png'),
        );
        if (!blob) throw new Error('toBlob fail');
        const ab = await blob.arrayBuffer();
        const imageBytes = Array.from(new Uint8Array(ab));

        if (outputMode === 'searchable_pdf') {
          const pageBytes = await invoke<number[]>('ocr_image_to_pdf_page', {
            imageBytes,
            lang,
          });
          pdfPagesBytes.push(pageBytes);
        } else {
          // PSM 1 (auto + OSD) — tốt cho mọi loại page (text/bảng/2 cột/con dấu)
          const text = await invoke<string>('ocr_image_bytes', {
            imageBytes,
            lang,
            psm: 1,
          });
          textBuf.push(`--- Trang ${i} ---\n${text.trim()}\n`);
        }
        setProgress({ done: i, total });
      }

      // 4. Output
      if (outputMode === 'searchable_pdf') {
        await invoke('merge_pdf_pages_bytes', {
          pages: pdfPagesBytes,
          outputPath: target,
        });
        onLog(
          `🔍 OCR ${basename(path)} (${total} pages, ${lang}, ${dpi} DPI) → ${basename(target)}`,
        );
        await onAlert({ title: 'Thành công', message: `✓ Đã OCR xong searchable PDF\n→ ${target}`, variant: 'success' });
      } else {
        const text = textBuf.join('\n');
        await invoke('write_text_string', { path: target, content: text });
        onLog(`🔍 OCR text ${basename(path)} (${total} pages) → ${basename(target)}`);
        await onAlert({ title: 'Thành công', message: `✓ Đã OCR xong, lưu text\n→ ${target}`, variant: 'success' });
      }
      onClose();
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  function handleCancel(): void {
    cancelRef.cancel = true;
    setBusy(false);
  }

  const progressPct = progress ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <ToolModal title="🔍 OCR PDF scanned (Native)" onClose={onClose} busy={busy}>
      {tessStatus && !tessStatus.available && (
        <div className="pdf-tool-warn">
          ⚠ <strong>Cần Tesseract OCR:</strong>
          {'\n'}
          {tessStatus.hint}
        </div>
      )}
      {tessStatus?.available && (
        <p className="muted small" style={{ marginTop: 0 }}>
          ✓ Tesseract sẵn sàng: <code>{tessStatus.version}</code>
        </p>
      )}

      <p className="muted small">
        OCR PDF scan dùng Tesseract native (--psm 1 + --oem 1 LSTM). Render PDF→PNG{' '}
        {dpi} DPI ở browser, OCR per-page ở backend.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => void pickPdfFile().then((p) => p && setPath(p))}
          disabled={busy}
        >
          📁 Chọn PDF
        </button>
        <span
          className="muted small"
          style={{
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {path || '(chưa chọn)'}
        </span>
      </div>

      <label className="muted small" style={{ display: 'block', marginBottom: 4 }}>
        Output
      </label>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        <button
          type="button"
          className={`btn btn-sm ${outputMode === 'searchable_pdf' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setOutputMode('searchable_pdf')}
          disabled={busy}
        >
          📄 Searchable PDF
        </button>
        <button
          type="button"
          className={`btn btn-sm ${outputMode === 'text' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setOutputMode('text')}
          disabled={busy}
        >
          📝 Text (.txt)
        </button>
      </div>

      <label className="muted small" style={{ display: 'block', marginBottom: 4 }}>
        Ngôn ngữ (Tesseract language code)
      </label>
      <input
        type="text"
        value={lang}
        onChange={(e) => setLang(e.target.value)}
        placeholder="vie+eng"
        className="pdf-pwd-input"
        style={{ fontFamily: 'var(--mono, monospace)', marginBottom: 6 }}
        disabled={busy}
      />
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {['vie+eng', 'vie', 'eng', 'eng+jpn', 'eng+chi_sim'].map((s) => (
          <button
            key={s}
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setLang(s)}
            disabled={busy}
          >
            {s}
          </button>
        ))}
      </div>

      <label className="muted small" style={{ display: 'block', marginBottom: 4 }}>
        DPI render (cao = chính xác hơn nhưng chậm hơn)
      </label>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {([200, 300, 400, 600] as const).map((d) => (
          <button
            key={d}
            type="button"
            className={`btn btn-sm ${dpi === d ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setDpi(d)}
            disabled={busy}
          >
            {d} DPI
          </button>
        ))}
      </div>

      {progress && (
        <div style={{ marginTop: 12, marginBottom: 8 }}>
          <div style={{ fontSize: 12, marginBottom: 4 }}>
            ⏳ Đang OCR trang <strong>{progress.done}</strong> / {progress.total} ({progressPct}%)
          </div>
          <div
            style={{
              height: 8,
              background: 'rgba(0,0,0,0.1)',
              borderRadius: 4,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${progressPct}%`,
                height: '100%',
                background: '#10B981',
                transition: 'width 0.3s',
              }}
            />
          </div>
        </div>
      )}

      <p className="muted small" style={{ fontSize: 11 }}>
        ⏱ Tốc độ ≈ 2-4s/trang ở 300 DPI. PDF 50 trang ≈ 2-3 phút.
      </p>

      {err && <p style={{ color: 'var(--danger, #c43)' }}>⚠ {err}</p>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
        {busy ? (
          <button className="btn btn-ghost btn-danger" onClick={handleCancel}>
            🛑 Hủy
          </button>
        ) : (
          <button className="btn btn-ghost" onClick={onClose}>
            Đóng
          </button>
        )}
        <button
          className="btn btn-primary"
          onClick={() => void run()}
          disabled={busy || !path || !tessStatus?.available || !lang.trim()}
        >
          {busy ? '⏳ Đang OCR…' : '🔍 Bắt đầu OCR'}
        </button>
      </div>
    </ToolModal>
  );
}

// ============================================================
// 13. Extract embedded images
// ============================================================

function ToolExtractImg({
  onClose,
  onLog,
}: {
  onClose: () => void;
  onLog: (line: string) => void;
}): JSX.Element {
  const [path, setPath] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<{
    extracted: number;
    skipped: number;
    output_dir: string;
  } | null>(null);

  async function run(): Promise<void> {
    if (!path) {
      const p = await pickPdfFile();
      if (!p) return;
      setPath(p);
      return;
    }
    const dir = await pickSaveDir();
    if (!dir) return;
    setBusy(true);
    setErr(null);
    setResult(null);
    try {
      const res = await invoke<typeof result>('pdf_extract_images', {
        inputPath: path,
        outputDir: dir,
      });
      setResult(res);
      if (res) {
        onLog(`🖼 Trích ${res.extracted} ảnh từ ${basename(path)} → ${dir}`);
      }
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ToolModal title="🖼 Trích ảnh từ PDF" onClose={onClose} busy={busy}>
      <p className="muted small" style={{ marginTop: 0 }}>
        Lưu tất cả ảnh embedded (JPEG, JP2) ra folder. Hỗ trợ DCTDecode (JPEG) và JPXDecode
        (JPEG 2000). Ảnh dùng FlateDecode/CCITTFaxDecode sẽ bị skip (cần repack).
      </p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => void pickPdfFile().then((p) => p && setPath(p))}
          disabled={busy}
        >
          📁 Chọn PDF
        </button>
        <span
          className="muted small"
          style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {path || '(chưa chọn)'}
        </span>
      </div>

      {result && (
        <div
          style={{
            background: 'rgba(43, 182, 115, 0.10)',
            border: '1px solid rgba(43, 182, 115, 0.3)',
            padding: 10,
            borderRadius: 4,
            marginBottom: 12,
            fontSize: 13,
          }}
        >
          ✓ Trích <strong>{result.extracted}</strong> ảnh
          {result.skipped > 0 && (
            <>
              {' · '}skip <strong>{result.skipped}</strong>
            </>
          )}
          <br />
          <code style={{ fontSize: 11, wordBreak: 'break-all' }}>{result.output_dir}</code>
        </div>
      )}

      {err && <p style={{ color: 'var(--danger, #c43)' }}>⚠ {err}</p>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
        <button className="btn btn-ghost" onClick={onClose} disabled={busy}>
          Đóng
        </button>
        <button
          className="btn btn-primary"
          onClick={() => void run()}
          disabled={busy || !path}
        >
          {busy ? '⏳ Đang trích…' : path ? '🖼 Chọn folder → Trích ảnh' : '📁 Chọn PDF'}
        </button>
      </div>
    </ToolModal>
  );
}

// ============================================================
// Phase 38.2.1 — PDF Binder với bookmarks
// ============================================================

interface BinderItem {
  path: string;
  bookmark_label: string;
}

function ToolBinder({
  onClose,
  onLog,
}: {
  onClose: () => void;
  onLog: (msg: string) => void;
}): JSX.Element {
  const [items, setItems] = useState<BinderItem[]>([]);
  const [busy, setBusy] = useState(false);

  async function pickFiles(): Promise<void> {
    const sel = await openDialog({
      multiple: true,
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });
    if (!sel) return;
    const paths = Array.isArray(sel) ? sel : [sel];
    setItems((prev) => [
      ...prev,
      ...paths.map((p) => ({
        path: p,
        // Default bookmark = filename without extension
        bookmark_label:
          p
            .split(/[\\/]/)
            .pop()
            ?.replace(/\.pdf$/i, '') ?? 'Untitled',
      })),
    ]);
  }

  function moveUp(idx: number): void {
    if (idx === 0) return;
    setItems((prev) => {
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx]!, next[idx - 1]!];
      return next;
    });
  }

  function moveDown(idx: number): void {
    setItems((prev) => {
      if (idx >= prev.length - 1) return prev;
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1]!, next[idx]!];
      return next;
    });
  }

  function removeItem(idx: number): void {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateLabel(idx: number, label: string): void {
    setItems((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, bookmark_label: label } : it)),
    );
  }

  async function run(): Promise<void> {
    if (items.length === 0) {
      onLog('⚠ Chưa chọn PDF nào.');
      return;
    }
    const dest = await saveDialog({
      title: 'Lưu PDF gộp',
      defaultPath: 'HoSo_HoanCong.pdf',
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });
    if (!dest) return;
    setBusy(true);
    try {
      const result = await invoke<{
        page_count: number;
        bookmark_count: number;
        missing_files: string[];
      }>('pdf_binder', { items, outputPath: dest });
      onLog(
        `✓ Đã gộp ${result.bookmark_count} PDF (${result.page_count} trang). Bookmark sidebar đã tạo. ${result.missing_files.length > 0 ? `⚠ ${result.missing_files.length} file thiếu: ${result.missing_files.join(', ')}` : ''}`,
      );
      onClose();
    } catch (err) {
      onLog(`✗ Lỗi: ${String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ToolModal title="📚 PDF Binder — Gộp + Bookmark" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <p style={{ fontSize: 12, color: '#6B7280', margin: 0 }}>
          Gộp nhiều PDF theo thứ tự + tự tạo bookmark sidebar. Mở PDF kết quả ở
          Acrobat/Foxit/Edge sẽ thấy panel bookmark bên trái với danh mục từng PDF.
          <br />
          💡 Phù hợp hồ sơ nghiệm thu / hoàn công có nhiều PDF nhỏ cần đóng thành 1 bộ.
        </p>

        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn btn-ghost" onClick={() => void pickFiles()}>
            ➕ Thêm PDF…
          </button>
          {items.length > 0 && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setItems([])}
              disabled={busy}
            >
              🗑 Xóa hết
            </button>
          )}
          <span style={{ marginLeft: 'auto', fontSize: 11, color: '#9CA3AF' }}>
            {items.length} file
          </span>
        </div>

        {items.length === 0 ? (
          <div
            style={{
              padding: 24,
              textAlign: 'center',
              border: '1px dashed var(--color-border-default, #D1D5DB)',
              borderRadius: 8,
              color: '#9CA3AF',
              fontSize: 13,
            }}
          >
            Chưa có file. Bấm "➕ Thêm PDF…" hoặc kéo thả vào đây.
          </div>
        ) : (
          <div
            style={{
              maxHeight: 360,
              overflowY: 'auto',
              border: '1px solid var(--color-border-subtle, #E5E7EB)',
              borderRadius: 8,
            }}
          >
            {items.map((item, idx) => (
              <div
                key={`${item.path}-${idx}`}
                style={{
                  padding: 10,
                  borderBottom: '1px solid var(--color-border-subtle, #E5E7EB)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 12,
                }}
              >
                <span style={{ minWidth: 24, color: '#9CA3AF' }}>#{idx + 1}</span>
                <input
                  type="text"
                  value={item.bookmark_label}
                  onChange={(e) => updateLabel(idx, e.target.value)}
                  placeholder="Tên bookmark (sẽ hiện trong sidebar PDF)"
                  style={{
                    flex: 1,
                    padding: '6px 10px',
                    border: '1px solid var(--color-border-default, #D1D5DB)',
                    borderRadius: 4,
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                />
                <span
                  style={{
                    fontSize: 10,
                    color: '#9CA3AF',
                    maxWidth: 180,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                  title={item.path}
                >
                  {item.path.split(/[\\/]/).pop()}
                </span>
                <button
                  type="button"
                  onClick={() => moveUp(idx)}
                  disabled={idx === 0}
                  style={{ padding: '2px 6px', fontSize: 11 }}
                  title="Lên"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => moveDown(idx)}
                  disabled={idx === items.length - 1}
                  style={{ padding: '2px 6px', fontSize: 11 }}
                  title="Xuống"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => removeItem(idx)}
                  style={{ padding: '2px 6px', fontSize: 11, color: '#DC2626' }}
                  title="Xóa khỏi danh sách"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          className="btn btn-primary"
          onClick={() => void run()}
          disabled={busy || items.length === 0}
        >
          {busy
            ? '⏳ Đang gộp…'
            : items.length > 0
              ? `📚 Gộp ${items.length} PDF + tạo bookmark`
              : 'Cần ≥1 PDF'}
        </button>
      </div>
    </ToolModal>
  );
}

// ============================================================
// Phase 38.2.2 — PDF Stamp Pro (image / QR / chữ ký)
// ============================================================

type StampKind = 'image' | 'qr' | 'signature';

interface StampItem {
  kind: StampKind;
  /** Đường dẫn file image (cho image / signature). Null cho QR. */
  filePath: string | null;
  /** Text/URL cho QR code. Null cho image / signature. */
  qrText: string | null;
  /** Cached image bytes (PNG/JPG bytes hoặc QR-generated PNG bytes) */
  imageBytes: number[] | null;
  /** Vị trí preset hoặc 'custom' */
  posPreset: 'TL' | 'TR' | 'BL' | 'BR' | 'C' | 'custom';
  /** Khoảng cách lề khi dùng preset (mm) */
  margin: number;
  /** Vị trí custom (x từ trái, y từ ĐÁY page, mm) */
  customX: number;
  customY: number;
  /** Chiều rộng stamp (mm); chiều cao tự theo aspect */
  widthMm: number;
  /** Page range: 'all', 'last', '1,3,5-7' */
  pageRange: string;
}

const POS_LABELS: Record<StampItem['posPreset'], string> = {
  TL: '↖ Trên trái',
  TR: '↗ Trên phải',
  BL: '↙ Dưới trái',
  BR: '↘ Dưới phải',
  C: '⊙ Giữa trang',
  custom: '✏ Custom mm',
};

function ToolStamp({
  onClose,
  onLog,
  onAlert,
}: {
  onClose: () => void;
  onLog: (line: string) => void;
  onAlert: ReturnType<typeof useDialogs>['alert'];
}): JSX.Element {
  const [pdfPath, setPdfPath] = useState('');
  const [stamps, setStamps] = useState<StampItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Form thêm stamp mới
  const [draftKind, setDraftKind] = useState<StampKind>('image');
  const [draftQrText, setDraftQrText] = useState('');

  // Phase 38.2.2 — Preview state
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [pageDimMm, setPageDimMm] = useState<{ w: number; h: number }>({ w: 210, h: 297 });
  const [imgAspects, setImgAspects] = useState<Map<number, number>>(new Map());
  // Drag state for custom mode
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  // Phase 38.2.2 — Page navigation cho preview
  const [previewPage, setPreviewPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const PREVIEW_WIDTH = 320; // px width

  // Reset previewPage khi đổi PDF
  useEffect(() => {
    setPreviewPage(1);
  }, [pdfPath]);

  // Render currentPage to canvas khi pdfPath HOẶC previewPage thay đổi
  useEffect(() => {
    if (!pdfPath) return;
    let cancelled = false;
    (async () => {
      try {
        const pdfBytes = await invoke<number[]>('read_binary_file', { path: pdfPath });
        const pdfjs = await import('pdfjs-dist');
        if (!pdfjs.GlobalWorkerOptions.workerSrc) {
          const workerUrl = (
            await import(
              // @ts-ignore
              'pdfjs-dist/build/pdf.worker.min.mjs?url'
            )
          ).default;
          pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
        }
        const pdf = await pdfjs.getDocument({
          data: new Uint8Array(pdfBytes).buffer,
        }).promise;
        if (cancelled) return;
        setTotalPages(pdf.numPages);
        const safePage = Math.min(Math.max(1, previewPage), pdf.numPages);
        const page = await pdf.getPage(safePage);
        const rawViewport = page.getViewport({ scale: 1 });
        const wMm = (rawViewport.width / 72) * 25.4;
        const hMm = (rawViewport.height / 72) * 25.4;
        if (cancelled) return;
        setPageDimMm({ w: wMm, h: hMm });
        const scale = PREVIEW_WIDTH / rawViewport.width;
        const viewport = page.getViewport({ scale });
        if (cancelled) return;
        const canvas = previewCanvasRef.current;
        if (!canvas) return;
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport }).promise;
      } catch (e) {
        console.warn('[preview-render] fail:', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pdfPath, previewPage]);

  /** Check stamp có apply lên page hiện tại không (theo pageRange) */
  function stampAppliesToPage(stamp: StampItem, pageNum: number, total: number): boolean {
    const indices = parsePageRangeForStamp(stamp.pageRange, total);
    if (indices.length === 0) return true; // 'all'
    return indices.includes(pageNum);
  }

  // Compute image aspect (h/w) khi stamp được add — cache by index
  useEffect(() => {
    stamps.forEach((s, idx) => {
      if (imgAspects.has(idx) || !s.imageBytes) return;
      const blob = new Blob([new Uint8Array(s.imageBytes)]);
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        const a = img.height / img.width || 1;
        URL.revokeObjectURL(url);
        setImgAspects((prev) => {
          const next = new Map(prev);
          next.set(idx, a);
          return next;
        });
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        setImgAspects((prev) => {
          const next = new Map(prev);
          next.set(idx, 1);
          return next;
        });
      };
      img.src = url;
    });
  }, [stamps, imgAspects]);

  async function pickStampImage(): Promise<{ path: string; bytes: number[] } | null> {
    const picked = await openDialog({
      multiple: false,
      filters: [{ name: 'Image', extensions: ['png', 'jpg', 'jpeg'] }],
    });
    if (typeof picked !== 'string') return null;
    try {
      const bytes = await invoke<number[]>('read_binary_file', { path: picked });
      return { path: picked, bytes };
    } catch (e) {
      setErr(`Không đọc được image: ${String(e)}`);
      return null;
    }
  }

  async function generateQrPng(text: string): Promise<number[]> {
    const QRCode = (await import('qrcode')).default;
    // 600px QR đủ rõ nét cho con dấu vừa kích thước stamp (~30-50mm wide)
    const dataUrl = await QRCode.toDataURL(text, {
      errorCorrectionLevel: 'M',
      width: 600,
      margin: 1,
    });
    const base64 = dataUrl.split(',')[1];
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return Array.from(bytes);
  }

  async function addStamp(): Promise<void> {
    setErr(null);
    if (draftKind === 'qr') {
      if (!draftQrText.trim()) {
        setErr('Cần nhập text/URL cho QR');
        return;
      }
      try {
        const bytes = await generateQrPng(draftQrText.trim());
        setStamps((prev) => [
          ...prev,
          {
            kind: 'qr',
            filePath: null,
            qrText: draftQrText.trim(),
            imageBytes: bytes,
            posPreset: 'BR',
            margin: 15,
            customX: 0,
            customY: 0,
            widthMm: 25,
            pageRange: 'all',
          },
        ]);
        setDraftQrText('');
      } catch (e) {
        setErr(`Lỗi sinh QR: ${String(e)}`);
      }
      return;
    }
    // image / signature → pick file
    const picked = await pickStampImage();
    if (!picked) return;
    const isSignature = draftKind === 'signature';
    setStamps((prev) => [
      ...prev,
      {
        kind: draftKind,
        filePath: picked.path,
        qrText: null,
        imageBytes: picked.bytes,
        posPreset: isSignature ? 'BR' : 'C',
        margin: isSignature ? 25 : 15,
        customX: 0,
        customY: 0,
        widthMm: isSignature ? 50 : 40,
        pageRange: isSignature ? 'last' : 'all',
      },
    ]);
  }

  function updateStamp(idx: number, patch: Partial<StampItem>): void {
    setStamps((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  }

  function removeStamp(idx: number): void {
    setStamps((prev) => prev.filter((_, i) => i !== idx));
  }

  /**
   * Compute (x_mm, y_mm) cho stamp dựa preset + page size.
   * PDF coords: origin bottom-left. A4 = 210 × 297 mm.
   * Giả định A4 portrait (TODO: detect actual page size từ PDF).
   */
  function computePosition(
    stamp: StampItem,
    pageWidthMm: number,
    pageHeightMm: number,
    imageAspect: number,
  ): { x: number; y: number } {
    if (stamp.posPreset === 'custom') {
      return { x: stamp.customX, y: stamp.customY };
    }
    const m = stamp.margin;
    const w = stamp.widthMm;
    const h = w * imageAspect;
    switch (stamp.posPreset) {
      case 'TL':
        return { x: m, y: pageHeightMm - h - m };
      case 'TR':
        return { x: pageWidthMm - w - m, y: pageHeightMm - h - m };
      case 'BL':
        return { x: m, y: m };
      case 'BR':
        return { x: pageWidthMm - w - m, y: m };
      case 'C':
        return { x: (pageWidthMm - w) / 2, y: (pageHeightMm - h) / 2 };
    }
  }

  function parsePageRangeForStamp(range: string, totalPages: number): number[] {
    const trimmed = range.trim().toLowerCase();
    if (!trimmed || trimmed === 'all') return []; // empty = all pages
    if (trimmed === 'last') return [totalPages];
    if (trimmed === 'first') return [1];
    return parsePageRange(range, totalPages);
  }

  /** Detect aspect (h/w) bằng cách load image ngắn hạn — dùng Image() */
  async function getImageAspect(bytes: number[]): Promise<number> {
    return new Promise((resolve) => {
      const blob = new Blob([new Uint8Array(bytes)]);
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        const aspect = img.height / img.width;
        URL.revokeObjectURL(url);
        resolve(aspect || 1);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(1);
      };
      img.src = url;
    });
  }

  async function run(): Promise<void> {
    if (!pdfPath) {
      setErr('Cần chọn file PDF nguồn');
      return;
    }
    if (stamps.length === 0) {
      setErr('Chưa có stamp nào — bấm "Thêm stamp"');
      return;
    }
    const target = await pickSavePdf(`${stripExt(pdfPath)}_stamped.pdf`);
    if (!target) return;

    setBusy(true);
    setErr(null);
    try {
      // Phase 38.2.2 — Dùng totalPages + pageDimMm đã có sẵn từ preview render
      // (tránh gọi pdf_info Rust → tránh load lopdf 2 lần cho file damaged)
      const pageW = pageDimMm.w;
      const pageH = pageDimMm.h;

      // Apply stamps tuần tự: first stamp ghi vào target, các stamp sau dùng target làm input
      let currentInput = pdfPath;
      let stampedCount = 0;
      for (let i = 0; i < stamps.length; i++) {
        const stamp = stamps[i];
        if (!stamp.imageBytes) continue;
        // Dùng aspect đã cache; fallback compute nếu chưa có
        const aspect = imgAspects.get(i) ?? (await getImageAspect(stamp.imageBytes));
        const { x, y } = computePosition(stamp, pageW, pageH, aspect);
        const pageIndices = parsePageRangeForStamp(stamp.pageRange, totalPages);
        // Lần cuối ghi thẳng target; các lần trước ghi temp
        const tempOut = i === stamps.length - 1 ? target : `${target}.tmp${i}.pdf`;
        const count = await invoke<number>('pdf_add_image_stamp', {
          inputPath: currentInput,
          outputPath: tempOut,
          imageBytes: stamp.imageBytes,
          xMm: x,
          yMm: y,
          widthMm: stamp.widthMm,
          pageIndices,
        });
        stampedCount = count;
        // Cleanup temp trước (nếu có)
        if (i > 0 && currentInput !== pdfPath) {
          try {
            await invoke('write_binary_file', { path: currentInput, bytes: [] });
          } catch {
            // ignore
          }
        }
        currentInput = tempOut;
      }

      onLog(
        `🏷 Stamp ${stamps.length} item × ${stampedCount} trang → ${basename(target)}`,
      );
      await onAlert({
        title: 'Thành công',
        message: `✓ Đã stamp ${stamps.length} item lên PDF\n→ ${target}`,
        variant: 'success',
      });
      onClose();
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ToolModal title="🏷 PDF Stamp Pro" onClose={onClose} busy={busy}>
      <p className="muted small" style={{ marginTop: 0 }}>
        Đóng dấu / chữ ký scan / QR code lên PDF. Hỗ trợ multi-stamp 1 lần.
        Nguyên tắc: PDF coords origin = góc dưới trái. Mặc định A4 (210×297 mm).
      </p>

      {/* Pick PDF */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => void pickPdfFile().then((p) => p && setPdfPath(p))}
          disabled={busy}
        >
          📁 Chọn PDF
        </button>
        <span
          className="muted small"
          style={{
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {pdfPath || '(chưa chọn)'}
        </span>
      </div>

      {/* Add stamp form */}
      <div
        style={{
          padding: 10,
          marginBottom: 12,
          background: 'rgba(16,185,129,0.08)',
          border: '1px solid rgba(16,185,129,0.3)',
          borderRadius: 6,
        }}
      >
        <div style={{ display: 'flex', gap: 6, marginBottom: 8, alignItems: 'center' }}>
          <strong style={{ fontSize: 12 }}>+ Thêm stamp:</strong>
          {(['image', 'qr', 'signature'] as StampKind[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setDraftKind(k)}
              style={{
                padding: '2px 10px',
                fontSize: 11,
                border: '1px solid var(--border)',
                borderRadius: 4,
                background: draftKind === k ? '#10B981' : 'transparent',
                color: draftKind === k ? '#fff' : 'inherit',
                cursor: 'pointer',
              }}
            >
              {k === 'image' ? '🖼 Image' : k === 'qr' ? '📱 QR' : '✍ Chữ ký'}
            </button>
          ))}
        </div>
        {draftKind === 'qr' ? (
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              type="text"
              value={draftQrText}
              onChange={(e) => setDraftQrText(e.target.value)}
              placeholder="URL hoặc text cho QR (vd https://trishteam.io.vn/doc/123)"
              style={{
                flex: 1,
                padding: '4px 8px',
                fontSize: 12,
                border: '1px solid var(--border)',
                borderRadius: 4,
                background: 'var(--bg)',
                color: 'var(--fg)',
              }}
              disabled={busy}
            />
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => void addStamp()}
              disabled={busy || !draftQrText.trim()}
            >
              + Sinh QR
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => void addStamp()}
            disabled={busy}
          >
            📁 Chọn ảnh {draftKind === 'image' ? 'con dấu' : 'chữ ký scan'}
          </button>
        )}
      </div>

      {/* Phase 38.2.2 — Preview WYSIWYG với overlay stamps draggable */}
      {pdfPath && (
        <div
          style={{
            marginBottom: 12,
            padding: 10,
            background: 'rgba(0,0,0,0.03)',
            border: '1px solid var(--border)',
            borderRadius: 6,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 6,
            }}
          >
            <span className="muted small" style={{ fontWeight: 600 }}>
              👁 Preview vị trí
            </span>
            {totalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button
                  type="button"
                  onClick={() => setPreviewPage((p) => Math.max(1, p - 1))}
                  disabled={previewPage <= 1}
                  style={{
                    padding: '2px 8px',
                    fontSize: 11,
                    border: '1px solid var(--border)',
                    borderRadius: 4,
                    background: 'transparent',
                    cursor: previewPage <= 1 ? 'not-allowed' : 'pointer',
                    opacity: previewPage <= 1 ? 0.4 : 1,
                  }}
                  title="Trang trước"
                >
                  ◀
                </button>
                <span
                  style={{
                    fontSize: 11,
                    minWidth: 60,
                    textAlign: 'center',
                    fontWeight: 600,
                  }}
                >
                  Trang {previewPage}/{totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPreviewPage((p) => Math.min(totalPages, p + 1))}
                  disabled={previewPage >= totalPages}
                  style={{
                    padding: '2px 8px',
                    fontSize: 11,
                    border: '1px solid var(--border)',
                    borderRadius: 4,
                    background: 'transparent',
                    cursor: previewPage >= totalPages ? 'not-allowed' : 'pointer',
                    opacity: previewPage >= totalPages ? 0.4 : 1,
                  }}
                  title="Trang sau"
                >
                  ▶
                </button>
              </div>
            )}
            <span className="muted small" style={{ fontSize: 10, marginLeft: 'auto' }}>
              {Math.round((PREVIEW_WIDTH / pageDimMm.w) * 25.4)}px/inch
            </span>
          </div>
          <div
            style={{
              position: 'relative',
              display: 'inline-block',
              border: '1px solid #999',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              userSelect: 'none',
            }}
            onMouseMove={(e) => {
              if (dragIdx === null) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const localX = e.clientX - rect.left;
              const localY = e.clientY - rect.top;
              const scaleMmPerPx = pageDimMm.w / rect.width;
              const xMm = localX * scaleMmPerPx;
              // Y trong PDF: origin từ ĐÁY, canvas origin từ TRÊN → flip
              const yMmFromBottom = (rect.height - localY) * scaleMmPerPx;
              const stamp = stamps[dragIdx];
              const aspect = imgAspects.get(dragIdx) ?? 1;
              const wMm = stamp.widthMm;
              const hMm = wMm * aspect;
              // Position là góc DƯỚI TRÁI của stamp
              const newX = Math.max(0, Math.min(pageDimMm.w - wMm, xMm - wMm / 2));
              const newY = Math.max(0, Math.min(pageDimMm.h - hMm, yMmFromBottom - hMm / 2));
              updateStamp(dragIdx, {
                posPreset: 'custom',
                customX: Math.round(newX * 10) / 10,
                customY: Math.round(newY * 10) / 10,
              });
            }}
            onMouseUp={() => setDragIdx(null)}
            onMouseLeave={() => setDragIdx(null)}
          >
            <canvas
              ref={previewCanvasRef}
              style={{ display: 'block', width: PREVIEW_WIDTH, height: 'auto' }}
            />
            {/* Overlay rectangles — chỉ stamps apply lên page hiện tại */}
            {stamps.map((s, idx) => {
              if (!stampAppliesToPage(s, previewPage, totalPages)) return null;
              const aspect = imgAspects.get(idx) ?? 1;
              const { x, y } = computePosition(s, pageDimMm.w, pageDimMm.h, aspect);
              const wMm = s.widthMm;
              const hMm = wMm * aspect;
              const pxPerMm = PREVIEW_WIDTH / pageDimMm.w;
              const previewHeightPx =
                previewCanvasRef.current?.height ?? PREVIEW_WIDTH * (pageDimMm.h / pageDimMm.w);
              const left = x * pxPerMm;
              const top = previewHeightPx - (y + hMm) * pxPerMm;
              const w = wMm * pxPerMm;
              const h = hMm * pxPerMm;
              const color =
                s.kind === 'qr' ? '#3B82F6' : s.kind === 'signature' ? '#A855F7' : '#10B981';
              return (
                <div
                  key={idx}
                  onMouseDown={() => setDragIdx(idx)}
                  style={{
                    position: 'absolute',
                    left,
                    top,
                    width: w,
                    height: h,
                    border: `2px solid ${color}`,
                    background: `${color}33`,
                    cursor: 'grab',
                    fontSize: 10,
                    color: '#000',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxSizing: 'border-box',
                  }}
                  title={`Stamp ${idx + 1} (${s.kind}) — kéo để di chuyển (chuyển sang custom)`}
                >
                  {idx + 1}
                </div>
              );
            })}
          </div>
          <div className="muted small" style={{ marginTop: 4, fontSize: 11 }}>
            Trang giấy: {pageDimMm.w.toFixed(0)}×{pageDimMm.h.toFixed(0)} mm.{' '}
            {stamps.length > 0 ? '🖱 Kéo các ô màu để di chuyển stamp.' : ''}
          </div>
        </div>
      )}

      {/* Stamps list */}
      {stamps.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div className="muted small" style={{ marginBottom: 4 }}>
            Danh sách stamp ({stamps.length}):
          </div>
          {stamps.map((s, idx) => (
            <div
              key={idx}
              style={{
                padding: 8,
                marginBottom: 6,
                border: '1px solid var(--border)',
                borderRadius: 6,
                fontSize: 12,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  marginBottom: 6,
                }}
              >
                <strong>
                  {idx + 1}. {s.kind === 'image' ? '🖼' : s.kind === 'qr' ? '📱' : '✍'}{' '}
                  {s.kind === 'qr'
                    ? `QR: "${s.qrText?.slice(0, 30)}${(s.qrText?.length ?? 0) > 30 ? '…' : ''}"`
                    : basename(s.filePath ?? '')}
                </strong>
                <button
                  type="button"
                  onClick={() => removeStamp(idx)}
                  style={{
                    marginLeft: 'auto',
                    padding: '2px 6px',
                    fontSize: 11,
                    color: '#DC2626',
                    cursor: 'pointer',
                    background: 'transparent',
                    border: '1px solid #DC2626',
                    borderRadius: 4,
                  }}
                >
                  ✕ Xóa
                </button>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr',
                  gap: 8,
                  marginBottom: 6,
                }}
              >
                <div>
                  <label className="muted small">Vị trí</label>
                  <select
                    value={s.posPreset}
                    onChange={(e) =>
                      updateStamp(idx, { posPreset: e.target.value as StampItem['posPreset'] })
                    }
                    style={{
                      width: '100%',
                      padding: '3px 6px',
                      fontSize: 12,
                      border: '1px solid var(--border)',
                      borderRadius: 4,
                      background: 'var(--bg)',
                      color: 'var(--fg)',
                    }}
                    disabled={busy}
                  >
                    {(Object.keys(POS_LABELS) as StampItem['posPreset'][]).map((k) => (
                      <option key={k} value={k}>
                        {POS_LABELS[k]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="muted small">Width (mm)</label>
                  <input
                    type="number"
                    value={s.widthMm}
                    onChange={(e) =>
                      updateStamp(idx, { widthMm: parseFloat(e.target.value) || 30 })
                    }
                    min={5}
                    max={200}
                    style={{
                      width: '100%',
                      padding: '3px 6px',
                      fontSize: 12,
                      border: '1px solid var(--border)',
                      borderRadius: 4,
                      background: 'var(--bg)',
                      color: 'var(--fg)',
                    }}
                    disabled={busy}
                  />
                </div>
                <div>
                  <label className="muted small">Pages</label>
                  <input
                    type="text"
                    value={s.pageRange}
                    onChange={(e) => updateStamp(idx, { pageRange: e.target.value })}
                    placeholder="all / last / 1,3,5-7"
                    style={{
                      width: '100%',
                      padding: '3px 6px',
                      fontSize: 12,
                      border: '1px solid var(--border)',
                      borderRadius: 4,
                      background: 'var(--bg)',
                      color: 'var(--fg)',
                    }}
                    disabled={busy}
                  />
                </div>
              </div>

              {s.posPreset !== 'custom' ? (
                <div>
                  <label className="muted small">
                    Margin từ mép ({s.margin} mm)
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={50}
                    step={1}
                    value={s.margin}
                    onChange={(e) => updateStamp(idx, { margin: parseInt(e.target.value, 10) })}
                    style={{ width: '100%' }}
                    disabled={busy}
                  />
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <label className="muted small">X từ trái (mm)</label>
                    <input
                      type="number"
                      value={s.customX}
                      onChange={(e) =>
                        updateStamp(idx, { customX: parseFloat(e.target.value) || 0 })
                      }
                      style={{
                        width: '100%',
                        padding: '3px 6px',
                        fontSize: 12,
                        border: '1px solid var(--border)',
                        borderRadius: 4,
                        background: 'var(--bg)',
                        color: 'var(--fg)',
                      }}
                      disabled={busy}
                    />
                  </div>
                  <div>
                    <label className="muted small">Y từ đáy (mm)</label>
                    <input
                      type="number"
                      value={s.customY}
                      onChange={(e) =>
                        updateStamp(idx, { customY: parseFloat(e.target.value) || 0 })
                      }
                      style={{
                        width: '100%',
                        padding: '3px 6px',
                        fontSize: 12,
                        border: '1px solid var(--border)',
                        borderRadius: 4,
                        background: 'var(--bg)',
                        color: 'var(--fg)',
                      }}
                      disabled={busy}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {err && (
        <p
          style={{
            color: 'var(--danger, #c43)',
            padding: '6px 10px',
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 4,
            fontSize: 12,
          }}
        >
          ⚠ {err}
        </p>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
        <button className="btn btn-ghost" onClick={onClose} disabled={busy}>
          Đóng
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => void run()}
          disabled={busy || !pdfPath || stamps.length === 0}
        >
          {busy
            ? '⏳ Đang stamp…'
            : stamps.length > 0
              ? `🏷 Stamp ${stamps.length} item lên PDF`
              : 'Cần ≥1 stamp'}
        </button>
      </div>
    </ToolModal>
  );
}

// ============================================================
// Phase 38.2.4 — PDF Revision Compare
// ============================================================

function ToolCompare({
  onClose,
  onLog,
  onAlert,
}: {
  onClose: () => void;
  onLog: (line: string) => void;
  onAlert: ReturnType<typeof useDialogs>['alert'];
}): JSX.Element {
  const [path1, setPath1] = useState('');
  const [path2, setPath2] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [outputPath, setOutputPath] = useState<string | null>(null);

  /** Extract text từ file dựa extension. Hỗ trợ PDF / DOCX / TXT / MD. */
  async function extractText(path: string): Promise<string> {
    const ext = path.split('.').pop()?.toLowerCase() ?? '';
    if (ext === 'pdf') {
      const bytes = await invoke<number[]>('read_binary_file', { path });
      const pdfjs = await import('pdfjs-dist');
      if (!pdfjs.GlobalWorkerOptions.workerSrc) {
        const workerUrl = (
          await import(
            // @ts-ignore
            'pdfjs-dist/build/pdf.worker.min.mjs?url'
          )
        ).default;
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
      }
      const pdf = await pdfjs.getDocument({
        data: new Uint8Array(bytes).buffer,
      }).promise;
      const pageTexts: string[] = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const tc = await page.getTextContent();
        const t = tc.items
          .map((it: unknown) => ((it as { str?: string }).str ?? ''))
          .join(' ');
        pageTexts.push(t.trim());
      }
      return pageTexts.join('\n\n');
    }
    if (ext === 'docx') {
      const bytes = await invoke<number[]>('read_binary_file', { path });
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({
        arrayBuffer: new Uint8Array(bytes).buffer,
      });
      return result.value ?? '';
    }
    if (ext === 'txt' || ext === 'md' || ext === 'markdown') {
      return await invoke<string>('read_text_string', { path });
    }
    throw new Error(`Định dạng không hỗ trợ: .${ext} (chỉ PDF/DOCX/TXT/MD)`);
  }

  async function pickAnyDoc(): Promise<string | null> {
    const picked = await openDialog({
      multiple: false,
      filters: [
        {
          name: 'Document',
          extensions: ['pdf', 'docx', 'txt', 'md', 'markdown'],
        },
      ],
    });
    return typeof picked === 'string' ? picked : null;
  }

  async function run(): Promise<void> {
    if (!path1 || !path2) {
      setErr('Cần chọn cả 2 file (cũ và mới)');
      return;
    }
    setBusy(true);
    setErr(null);
    setOutputPath(null);
    try {
      // Extract text từ cả 2 file (frontend) — pdfjs tolerant với damaged PDFs
      const text1 = await extractText(path1);
      const text2 = await extractText(path2);
      // Rust làm diff + build HTML
      const html = await invoke<string>('text_diff_html', {
        text1,
        text2,
        name1: basename(path1),
        name2: basename(path2),
      });
      const baseName1 = stripExt(basename(path1));
      const baseName2 = stripExt(basename(path2));
      const target = await saveDialog({
        defaultPath: `compare_${baseName1}_vs_${baseName2}.html`,
        filters: [{ name: 'HTML report', extensions: ['html'] }],
      });
      if (typeof target !== 'string') {
        setBusy(false);
        return;
      }
      await invoke('write_text_string', { path: target, content: html });
      setOutputPath(target);
      onLog(`📑 So sánh ${baseName1} ↔ ${baseName2} → ${basename(target)}`);
      await onAlert({
        title: 'Thành công',
        message: `✓ Tạo HTML report: ${target}\n\nBấm "Mở report" để xem trong browser.`,
        variant: 'success',
      });
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function openReport(): Promise<void> {
    if (!outputPath) return;
    try {
      await invoke('open_local_path', { path: outputPath });
    } catch (e) {
      setErr(`Không mở được file: ${String(e)}`);
    }
  }

  return (
    <ToolModal title="📑 Document Revision Compare" onClose={onClose} busy={busy}>
      <p className="muted small" style={{ marginTop: 0 }}>
        So sánh text 2 file (PDF / DOCX / TXT / MD) → HTML report inline với{' '}
        <ins
          style={{
            background: '#BBF7D0',
            color: '#14532D',
            padding: '0 4px',
            borderRadius: 2,
          }}
        >
          thêm
        </ins>{' '}
        và{' '}
        <del
          style={{
            background: '#FECACA',
            color: '#7F1D1D',
            padding: '0 4px',
            borderRadius: 2,
          }}
        >
          xóa
        </del>
        . PDF cần text layer (scan: OCR trước qua tool 🔍 OCR PDF scan).
      </p>

      {/* Pick file v1 */}
      <div style={{ marginBottom: 10 }}>
        <label className="muted small" style={{ display: 'block', marginBottom: 4 }}>
          📄 File cũ (gốc, sẽ thấy phần xóa):
        </label>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => void pickAnyDoc().then((p) => p && setPath1(p))}
            disabled={busy}
          >
            📁 Chọn file v1
          </button>
          <span
            className="muted small"
            style={{
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              direction: 'rtl',
              textAlign: 'left',
            }}
          >
            {path1 || '(chưa chọn)'}
          </span>
        </div>
      </div>

      {/* Pick file v2 */}
      <div style={{ marginBottom: 12 }}>
        <label className="muted small" style={{ display: 'block', marginBottom: 4 }}>
          📄 File mới (revision, sẽ thấy phần thêm):
        </label>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => void pickAnyDoc().then((p) => p && setPath2(p))}
            disabled={busy}
          >
            📁 Chọn file v2
          </button>
          <span
            className="muted small"
            style={{
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              direction: 'rtl',
              textAlign: 'left',
            }}
          >
            {path2 || '(chưa chọn)'}
          </span>
        </div>
      </div>

      {err && (
        <p
          style={{
            color: 'var(--danger, #c43)',
            padding: '6px 10px',
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 4,
            fontSize: 12,
          }}
        >
          ⚠ {err}
        </p>
      )}

      {outputPath && (
        <div
          style={{
            padding: '8px 10px',
            background: 'rgba(16,185,129,0.08)',
            border: '1px solid rgba(16,185,129,0.3)',
            borderRadius: 6,
            fontSize: 12,
            marginBottom: 10,
          }}
        >
          <div style={{ marginBottom: 4 }}>
            ✓ Report đã tạo: <code>{basename(outputPath)}</code>
          </div>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => void openReport()}
          >
            🌐 Mở report trong browser
          </button>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
        <button className="btn btn-ghost" onClick={onClose} disabled={busy}>
          Đóng
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => void run()}
          disabled={busy || !path1 || !path2}
        >
          {busy ? '⏳ Đang so sánh…' : '📑 So sánh + tạo report'}
        </button>
      </div>
    </ToolModal>
  );
}
