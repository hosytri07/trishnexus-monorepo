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

import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open as openDialog, save as saveDialog } from '@tauri-apps/plugin-dialog';

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
  | 'binder';

const TOOLS: Array<{ id: ToolId; icon: string; title: string; desc: string }> = [
  { id: 'info', icon: '📊', title: 'PDF Info', desc: 'Xem số trang, dung lượng, metadata' },
  { id: 'merge', icon: '🔗', title: 'Merge PDF', desc: 'Gộp ≥2 PDF thành 1' },
  { id: 'binder', icon: '📚', title: 'PDF Binder', desc: 'Gộp PDF theo danh mục + tự tạo bookmark sidebar (Phase 38.2 PRO)' },
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
      {active === 'merge' && <ToolMerge onClose={close} onLog={pushLog} />}
      {active === 'split' && <ToolSplit onClose={close} onLog={pushLog} />}
      {active === 'extract' && (
        <ToolPageRange
          mode="extract"
          title="📤 Extract pages"
          actionLabel="Trích trang"
          onClose={close}
          onLog={pushLog}
        />
      )}
      {active === 'delete' && (
        <ToolPageRange
          mode="delete"
          title="🗑 Delete pages"
          actionLabel="Xóa trang"
          onClose={close}
          onLog={pushLog}
        />
      )}
      {active === 'rotate' && <ToolRotate onClose={close} onLog={pushLog} />}
      {active === 'images' && <ToolImages onClose={close} onLog={pushLog} />}
      {active === 'watermark' && <ToolWatermark onClose={close} onLog={pushLog} />}
      {active === 'pagenum' && <ToolPageNumbers onClose={close} onLog={pushLog} />}
      {active === 'encrypt' && (
        <ToolEncrypt mode="encrypt" onClose={close} onLog={pushLog} />
      )}
      {active === 'decrypt' && (
        <ToolEncrypt mode="decrypt" onClose={close} onLog={pushLog} />
      )}
      {active === 'ocr' && <ToolOcr onClose={close} onLog={pushLog} />}
      {active === 'extractImg' && <ToolExtractImg onClose={close} onLog={pushLog} />}
      {active === 'binder' && <ToolBinder onClose={close} onLog={pushLog} />}
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
}: {
  onClose: () => void;
  onLog: (line: string) => void;
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
      window.alert(`✓ Đã gộp ${files.length} PDF (${pages} trang)\n→ ${target}`);
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
}: {
  onClose: () => void;
  onLog: (line: string) => void;
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
      window.alert(`✓ Đã tách thành ${count} file\n→ ${dir}`);
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
}: {
  mode: 'extract' | 'delete';
  title: string;
  actionLabel: string;
  onClose: () => void;
  onLog: (line: string) => void;
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
      window.alert(`✓ ${mode === 'extract' ? 'Đã trích' : 'Đã xóa, còn'} ${count} trang\n→ ${target}`);
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
}: {
  onClose: () => void;
  onLog: (line: string) => void;
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
      window.alert(`✓ Đã xoay ${count} trang ${angle}°\n→ ${target}`);
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
}: {
  onClose: () => void;
  onLog: (line: string) => void;
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
      window.alert(`✓ Đã tạo PDF từ ${count} ảnh\n→ ${target}`);
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
}: {
  onClose: () => void;
  onLog: (line: string) => void;
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
      window.alert(`✓ Đã thêm watermark vào ${count} trang\n→ ${target}`);
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
}: {
  onClose: () => void;
  onLog: (line: string) => void;
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
      window.alert(`✓ Đã đánh số ${count} trang\n→ ${target}`);
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
}: {
  mode: 'encrypt' | 'decrypt';
  onClose: () => void;
  onLog: (line: string) => void;
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
      window.alert(`✓ Hoàn tất\n→ ${target}`);
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

function ToolOcr({
  onClose,
  onLog,
}: {
  onClose: () => void;
  onLog: (line: string) => void;
}): JSX.Element {
  const [path, setPath] = useState('');
  const [lang, setLang] = useState('vie+eng');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
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
    const target = await pickSavePdf(`${stripExt(path)}_ocr.pdf`);
    if (!target) return;
    setBusy(true);
    setErr(null);
    try {
      await invoke('pdf_ocr', {
        inputPath: path,
        outputPath: target,
        lang,
      });
      onLog(`🔍 OCR ${basename(path)} (${lang}) → ${basename(target)}`);
      window.alert(`✓ Đã OCR xong, tạo searchable PDF\n→ ${target}`);
      onClose();
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ToolModal title="🔍 OCR PDF scanned" onClose={onClose} busy={busy}>
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
        Tạo searchable PDF từ PDF scan (ảnh) — text layer phủ lên ảnh gốc, có thể copy + tìm kiếm.
        Cần language data (vd <code>vie.traineddata</code>) trong tessdata.
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
        Ngôn ngữ (Tesseract language code)
      </label>
      <input
        type="text"
        value={lang}
        onChange={(e) => setLang(e.target.value)}
        placeholder="vie+eng"
        className="pdf-pwd-input"
        style={{ fontFamily: 'var(--mono, monospace)', marginBottom: 6 }}
        disabled={busy || !path}
      />
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {['vie+eng', 'vie', 'eng', 'eng+jpn', 'eng+chi_sim'].map((s) => (
          <button key={s} type="button" className="btn btn-ghost btn-sm" onClick={() => setLang(s)}>
            {s}
          </button>
        ))}
      </div>

      <p className="muted small" style={{ fontSize: 11 }}>
        ⏱ OCR có thể mất từ vài giây đến vài phút tùy số trang.
      </p>

      {err && <p style={{ color: 'var(--danger, #c43)' }}>⚠ {err}</p>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
        <button className="btn btn-ghost" onClick={onClose} disabled={busy}>
          Đóng
        </button>
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
