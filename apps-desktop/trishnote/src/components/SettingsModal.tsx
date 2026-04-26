/**
 * Phase 17.2 v5 — SettingsModal.
 *
 * Khác v4:
 *  - Có nút "Lưu" thay vì auto-apply mỗi click (user yêu cầu).
 *  - Preview live trong modal vẫn dùng draft, nhưng app chỉ thay đổi khi Save.
 *  - "Huỷ" hoặc đóng modal mà chưa save → revert.
 */

import { useState, useEffect } from 'react';
import { exportStoreAs, importStoreFrom } from '../tauri-bridge.js';
import type { StoreV2 } from '../types.js';
import {
  type AppSettings,
  type Theme,
  FONT_SIZE_MIN,
  FONT_SIZE_MAX,
  fontStackFor,
  applySettings,
  saveSettings,
} from '../settings.js';

interface Props {
  store: StoreV2;
  storePath: string;
  settings: AppSettings;
  systemFonts: string[];
  onClose: () => void;
  onImported: (store: StoreV2) => void;
  onSettingsChange: (s: AppSettings) => void;
}

export function SettingsModal({
  store,
  storePath,
  settings,
  systemFonts,
  onClose,
  onImported,
  onSettingsChange,
}: Props): JSX.Element {
  const [busy, setBusy] = useState<'export' | 'import' | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [draft, setDraft] = useState<AppSettings>(settings);
  const [savedFlash, setSavedFlash] = useState(false);

  // Dirty = draft khác settings hiện tại
  const dirty =
    draft.theme !== settings.theme ||
    draft.fontSize !== settings.fontSize ||
    draft.fontFamily !== settings.fontFamily;

  // Re-sync nếu prop settings thay đổi từ ngoài (vd nhận import)
  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  function patch<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function handleSaveSettings(): void {
    saveSettings(draft);
    applySettings(draft);
    onSettingsChange(draft);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
  }

  function handleResetDraft(): void {
    setDraft(settings);
  }

  async function handleClose(): Promise<void> {
    if (dirty) {
      const ok = window.confirm(
        'Cài đặt đã thay đổi nhưng chưa lưu.\n\nĐóng và bỏ thay đổi?',
      );
      if (!ok) return;
    }
    onClose();
  }

  async function handleExport(): Promise<void> {
    if (busy) return;
    setBusy('export');
    setInfo(null);
    try {
      const result = await exportStoreAs(store);
      if (result) {
        setInfo(
          `✓ Đã export ${store.notes.length} notes + ${store.folders.length} folders → ${result.path}`,
        );
      } else {
        setInfo('Đã huỷ export.');
      }
    } catch (err) {
      setInfo(`⚠ Lỗi: ${err instanceof Error ? err.message : err}`);
    } finally {
      setBusy(null);
    }
  }

  async function handleImport(): Promise<void> {
    if (busy) return;
    setBusy('import');
    setInfo(null);
    try {
      const imported = await importStoreFrom();
      if (!imported) {
        setInfo('Đã huỷ import.');
        return;
      }
      const ok = window.confirm(
        `Import ${imported.notes.length} notes + ${imported.folders.length} folders?\n\nSẽ MERGE với data hiện tại.`,
      );
      if (!ok) {
        setInfo('Đã huỷ import.');
        return;
      }
      onImported(imported);
      setInfo('✓ Import thành công.');
    } catch (err) {
      setInfo(`⚠ Lỗi: ${err instanceof Error ? err.message : err}`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="modal-backdrop" onClick={() => void handleClose()}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <header className="modal-head">
          <h2>⚙ Cài đặt {dirty && <span className="muted small">· chưa lưu</span>}</h2>
          <button className="mini" onClick={() => void handleClose()}>×</button>
        </header>

        <div className="modal-body" style={{ padding: 18, maxHeight: '70vh', overflowY: 'auto' }}>
          {info && (
            <div className="settings-info">{info}</div>
          )}

          {/* Giao diện */}
          <section className="settings-section">
            <h3>Giao diện</h3>
            <div className="settings-row">
              <div className="settings-label">
                <strong>Theme</strong>
                <p className="muted small">Sáng / tối / tự động theo OS</p>
              </div>
              <div className="settings-control">
                {(['auto', 'light', 'dark'] as Theme[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`pill-btn ${draft.theme === t ? 'active' : ''}`}
                    onClick={() => patch('theme', t)}
                  >
                    {t === 'auto' ? '🌓 Auto' : t === 'light' ? '☀ Sáng' : '🌙 Tối'}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Typography */}
          <section className="settings-section">
            <h3>Chữ viết</h3>
            <div className="settings-row">
              <div className="settings-label">
                <strong>Cỡ chữ note (mặc định)</strong>
                <p className="muted small">Áp cho nội dung note ({FONT_SIZE_MIN}-{FONT_SIZE_MAX} px)</p>
              </div>
              <div className="settings-control">
                <input
                  type="range"
                  min={FONT_SIZE_MIN}
                  max={FONT_SIZE_MAX}
                  step={1}
                  value={draft.fontSize}
                  onChange={(e) => patch('fontSize', Number(e.target.value))}
                  className="size-slider"
                />
                <input
                  type="number"
                  min={FONT_SIZE_MIN}
                  max={FONT_SIZE_MAX}
                  step={1}
                  className="size-number"
                  value={draft.fontSize}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (Number.isFinite(v))
                      patch('fontSize', Math.max(FONT_SIZE_MIN, Math.min(FONT_SIZE_MAX, v)));
                  }}
                />
                <span className="size-display">px</span>
              </div>
            </div>

            <div className="settings-row">
              <div className="settings-label">
                <strong>Font chữ (mặc định)</strong>
                <p className="muted small">Lấy từ font cài trong Windows · note có thể override riêng</p>
              </div>
              <div className="settings-control">
                <select
                  className="font-select"
                  value={draft.fontFamily}
                  onChange={(e) => patch('fontFamily', e.target.value)}
                >
                  <option value="">— System default —</option>
                  {systemFonts.map((f) => (
                    <option key={f} value={f} style={{ fontFamily: fontStackFor(f) }}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Preview */}
            <div className="settings-preview">
              <div className="muted small">Xem thử:</div>
              <div
                className="settings-preview-text"
                style={{
                  fontSize: `${draft.fontSize}px`,
                  fontFamily: fontStackFor(draft.fontFamily),
                }}
              >
                Đây là một dòng note mẫu để xem font + size hiển thị thế nào. Aa Bb Cc 123.
              </div>
            </div>
          </section>

          {/* Storage info */}
          <section className="settings-section">
            <h3>Thư viện hiện tại</h3>
            <p>
              <strong>{store.notes.filter((n) => n.deletedAt == null).length}</strong> notes ·{' '}
              <strong>{store.folders.length}</strong> folders
            </p>
            <p
              className="muted small"
              style={{
                fontFamily: 'SF Mono, Menlo, Consolas, monospace',
                wordBreak: 'break-all',
                marginTop: 4,
              }}
            >
              {storePath || '—'}
            </p>
          </section>

          {/* Backup */}
          <section className="settings-section">
            <h3>Backup</h3>
            <p className="muted small" style={{ marginBottom: 10 }}>
              Export toàn bộ notes + folders ra file JSON. Anh có thể backup hoặc di chuyển sang máy khác.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn-ghost"
                onClick={() => void handleExport()}
                disabled={busy !== null}
              >
                {busy === 'export' ? '⏳ Đang export…' : '⇧ Export JSON'}
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => void handleImport()}
                disabled={busy !== null}
              >
                {busy === 'import' ? '⏳ Đang import…' : '⇩ Import JSON'}
              </button>
            </div>
          </section>

          <section className="settings-section">
            <h3>Thông tin</h3>
            <p className="muted small">
              TrishNote v2.0.0-1 — Local-first ghi chú + dự án.
              Per-UID storage trong %LocalAppData%\TrishTEAM\TrishNote.
            </p>
            <p className="muted small" style={{ marginTop: 8 }}>
              <strong>Phím tắt:</strong> Ctrl+N tạo note nhanh · Ctrl+F tìm · Esc đóng panel detail
            </p>
          </section>
        </div>

        <footer
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: 12,
            borderTop: '1px solid var(--border)',
            gap: 8,
          }}
        >
          <span className="muted small">
            {savedFlash
              ? '✓ Đã lưu cài đặt'
              : dirty
                ? '● Có thay đổi chưa lưu'
                : '— không có thay đổi —'}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            {dirty && (
              <button className="btn btn-ghost" onClick={handleResetDraft}>
                ↺ Khôi phục
              </button>
            )}
            <button className="btn btn-ghost" onClick={() => void handleClose()}>
              Đóng
            </button>
            <button
              className="btn btn-primary"
              onClick={handleSaveSettings}
              disabled={!dirty}
            >
              ✓ Lưu cài đặt
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
