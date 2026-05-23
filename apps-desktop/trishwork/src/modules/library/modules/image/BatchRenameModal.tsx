/**
 * Phase 18.6.f — Batch rename modal cho Image module.
 *
 * Pattern syntax:
 *   {n}       — sequential number, padding theo `padding` prop (vd 001, 002)
 *   {n:3}     — sequential với padding 3 chữ số
 *   {date}    — modified date YYYY-MM-DD
 *   {datetime}— modified date YYYY-MM-DD_HHmm
 *   {folder}  — tên folder cha
 *   {ext}     — đuôi gốc (uppercase)
 *   {orig}    — tên file gốc không đuôi
 *
 * Áp dụng vào display_names (logical rename) — không đụng file thật.
 */

import { useMemo, useState } from 'react';
import type { ImageFile, ImageFolder } from './types.js';

interface Props {
  files: ImageFile[];
  selectedPaths: Set<string>;
  activeFolder: ImageFolder | null;
  onClose: () => void;
  onApply: (newDisplayNames: Record<string, string>) => void;
}

const PRESETS: Array<{ label: string; pattern: string }> = [
  { label: 'KS_2026_001.jpg', pattern: 'KS_{date}_{n:3}' },
  { label: 'IMG-001-thumucme.jpg', pattern: 'IMG-{n:3}-{folder}' },
  { label: 'Folder_001.jpg', pattern: '{folder}_{n:3}' },
  { label: '2026-04-27_001.jpg', pattern: '{date}_{n:3}' },
  { label: 'orig_(KS).jpg', pattern: '{orig}_(KS)' },
];

export function BatchRenameModal({
  files,
  selectedPaths,
  activeFolder,
  onClose,
  onApply,
}: Props): JSX.Element {
  const [pattern, setPattern] = useState('KS_{date}_{n:3}');
  const [startNum, setStartNum] = useState(1);
  const [keepExt, setKeepExt] = useState(true);

  const targets = useMemo(() => {
    return files.filter((f) => selectedPaths.has(f.path));
  }, [files, selectedPaths]);

  const previews = useMemo(() => {
    return targets.map((f, i) => ({
      file: f,
      newName: applyPattern(pattern, f, i + startNum, activeFolder, keepExt),
    }));
  }, [targets, pattern, startNum, activeFolder, keepExt]);

  function handleApply(): void {
    const updates: Record<string, string> = {};
    for (const { file, newName } of previews) {
      updates[file.path] = newName;
    }
    onApply(updates);
    onClose();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="batch-rename-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Đổi tên hàng loạt"
      >
        <header className="batch-rename-head">
          <h2>🏷 Đổi tên hàng loạt — {targets.length} ảnh</h2>
          <button className="mini" onClick={onClose}>×</button>
        </header>

        <div className="batch-rename-body">
          <p className="muted small" style={{ marginTop: 0 }}>
            Logical rename — chỉ đổi tên hiển thị trong app, file thật trên ổ đĩa không đổi.
            Có thể bỏ rename bằng nút ↺ trong detail panel của từng ảnh.
          </p>

          <label className="muted small" style={{ display: 'block', marginBottom: 4 }}>
            Pattern
          </label>
          <input
            type="text"
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            className="batch-rename-input"
            placeholder="KS_{date}_{n:3}"
          />

          <div className="batch-rename-presets">
            {PRESETS.map((p) => (
              <button
                key={p.pattern}
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setPattern(p.pattern)}
                title={`Pattern: ${p.pattern}`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 16, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <label className="muted small" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              Bắt đầu từ:
              <input
                type="number"
                min={0}
                value={startNum}
                onChange={(e) => setStartNum(parseInt(e.target.value, 10) || 0)}
                style={{
                  width: 70,
                  padding: '3px 6px',
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: 3,
                  color: 'var(--fg)',
                }}
              />
            </label>
            <label className="muted small" style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={keepExt}
                onChange={(e) => setKeepExt(e.target.checked)}
              />
              Giữ đuôi file gốc (.jpg/.png/.mov...)
            </label>
          </div>

          <div className="batch-rename-help muted small">
            <strong>Placeholders:</strong>{' '}
            <code>{'{n}'}</code> số tăng dần · <code>{'{n:3}'}</code> padding 3 chữ số ·{' '}
            <code>{'{date}'}</code> ngày chỉnh sửa · <code>{'{datetime}'}</code> · <code>{'{folder}'}</code> ·{' '}
            <code>{'{orig}'}</code> tên gốc · <code>{'{ext}'}</code>
          </div>

          <h4 style={{ marginTop: 16, marginBottom: 6 }}>
            Preview {previews.length} ảnh đầu:
          </h4>
          <table className="batch-rename-preview">
            <thead>
              <tr>
                <th style={{ width: 40 }}>#</th>
                <th>Tên cũ</th>
                <th>→</th>
                <th>Tên mới</th>
              </tr>
            </thead>
            <tbody>
              {previews.slice(0, 8).map((p, i) => (
                <tr key={p.file.path}>
                  <td className="muted small">{i + startNum}</td>
                  <td className="muted small">{p.file.name}</td>
                  <td>→</td>
                  <td><strong>{p.newName}</strong></td>
                </tr>
              ))}
              {previews.length > 8 && (
                <tr>
                  <td colSpan={4} className="muted small" style={{ textAlign: 'center', padding: 8 }}>
                    … và {previews.length - 8} ảnh khác
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <footer className="batch-rename-foot">
          <span className="muted small">{targets.length} ảnh sẽ được đổi tên hiển thị</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost" onClick={onClose}>
              Hủy
            </button>
            <button
              className="btn btn-primary"
              onClick={handleApply}
              disabled={targets.length === 0}
            >
              ✓ Áp dụng cho {targets.length} ảnh
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

// ============================================================
// Pattern engine
// ============================================================

function applyPattern(
  pattern: string,
  file: ImageFile,
  index: number,
  activeFolder: ImageFolder | null,
  keepExt: boolean,
): string {
  const orig = stripExt(file.name);
  const ext = file.ext;
  const folderName = activeFolder?.name ?? 'folder';
  const date = formatDate(file.modified_ms);
  const datetime = formatDatetime(file.modified_ms);

  // {n:padding} — replace before plain {n}
  let result = pattern.replace(/\{n:(\d+)\}/g, (_, p) => {
    const pad = parseInt(p, 10);
    return String(index).padStart(pad, '0');
  });
  result = result
    .replace(/\{n\}/g, String(index))
    .replace(/\{date\}/g, date)
    .replace(/\{datetime\}/g, datetime)
    .replace(/\{folder\}/g, sanitize(folderName))
    .replace(/\{orig\}/g, sanitize(orig))
    .replace(/\{ext\}/g, ext.toUpperCase());

  if (keepExt && !result.toLowerCase().endsWith(`.${ext.toLowerCase()}`)) {
    result = `${result}.${ext}`;
  }
  return result;
}

function stripExt(name: string): string {
  const i = name.lastIndexOf('.');
  return i > 0 ? name.slice(0, i) : name;
}

function formatDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDatetime(ms: number): string {
  const d = new Date(ms);
  const date = formatDate(ms);
  const time = `${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
  return `${date}_${time}`;
}

/** Replace illegal filename chars. */
function sanitize(s: string): string {
  return s.replace(/[<>:"/\\|?*]/g, '_').trim();
}
