/**
 * Phase 17.5 — TrishImage SettingsModal.
 *
 * Theme + grid columns + cỡ chữ + update check. Có nút Lưu (apply qua Save).
 */

import { useEffect, useState } from 'react';
import { openUrl } from '@tauri-apps/plugin-opener';
import {
  type AppSettings,
  type Theme,
  FONT_SIZE_MIN,
  FONT_SIZE_MAX,
  applySettings,
  saveSettings,
} from './settings.js';
import { checkForUpdate, type UpdateInfo } from './tauri-bridge.js';

interface Props {
  settings: AppSettings;
  appVersion: string;
  onSettingsChange: (s: AppSettings) => void;
  onClose: () => void;
}

export function SettingsModal({
  settings,
  appVersion,
  onSettingsChange,
  onClose,
}: Props): JSX.Element {
  const [draft, setDraft] = useState<AppSettings>(settings);
  const [savedFlash, setSavedFlash] = useState(false);
  const [checking, setChecking] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [updateMsg, setUpdateMsg] = useState<string | null>(null);

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  const dirty =
    draft.theme !== settings.theme ||
    draft.viewMode !== settings.viewMode ||
    draft.fontSize !== settings.fontSize;

  function patch<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function handleSave(): void {
    saveSettings(draft);
    applySettings(draft);
    onSettingsChange(draft);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
  }

  function handleReset(): void {
    setDraft(settings);
  }

  async function handleClose(): Promise<void> {
    if (dirty) {
      const ok = window.confirm('Cài đặt đã thay đổi nhưng chưa lưu.\n\nĐóng và bỏ thay đổi?');
      if (!ok) return;
    }
    onClose();
  }

  async function handleCheckUpdate(): Promise<void> {
    if (checking) return;
    setChecking(true);
    setUpdateMsg(null);
    try {
      const info = await checkForUpdate(appVersion);
      setUpdateInfo(info);
      if (info.hasUpdate) {
        setUpdateMsg(`✓ Có bản mới: ${info.latest} (đang dùng ${info.current})`);
      } else {
        setUpdateMsg(`✓ Đang dùng bản mới nhất (${info.current})`);
      }
    } catch (err) {
      setUpdateMsg(`⚠ Lỗi: ${err instanceof Error ? err.message : err}`);
    } finally {
      setChecking(false);
    }
  }

  async function handleDownload(): Promise<void> {
    if (!updateInfo?.downloadUrl) return;
    try {
      await openUrl(updateInfo.downloadUrl);
    } catch (err) {
      console.warn('[trishimage] open download fail:', err);
    }
  }

  return (
    <div className="modal-backdrop" onClick={() => void handleClose()}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 540 }}>
        <header className="modal-head">
          <h2>⚙ Cài đặt {dirty && <span className="muted small">· chưa lưu</span>}</h2>
          <button className="mini" onClick={() => void handleClose()}>
            ×
          </button>
        </header>

        <div className="modal-body">
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

          {/* Grid */}
          <section className="settings-section">
            <h3>Lưới ảnh</h3>
            <div className="settings-row">
              <div className="settings-label">
                <strong>Chế độ xem mặc định</strong>
                <p className="muted small">Có thể đổi nhanh ở thanh toolbar</p>
              </div>
              <div className="settings-control" style={{ flexWrap: 'wrap' }}>
                {(
                  [
                    { v: 'xl', label: '🖼 Cực lớn' },
                    { v: 'l', label: '🖼 Lớn' },
                    { v: 'm', label: '🖼 Vừa' },
                    { v: 's', label: '🖼 Nhỏ' },
                    { v: 'details', label: '☰ Chi tiết' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.v}
                    type="button"
                    className={`pill-btn ${draft.viewMode === opt.v ? 'active' : ''}`}
                    onClick={() => patch('viewMode', opt.v)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="settings-row">
              <div className="settings-label">
                <strong>Cỡ chữ giao diện</strong>
                <p className="muted small">{FONT_SIZE_MIN}-{FONT_SIZE_MAX} px</p>
              </div>
              <div className="settings-control">
                <input
                  type="range"
                  min={FONT_SIZE_MIN}
                  max={FONT_SIZE_MAX}
                  step={1}
                  value={draft.fontSize}
                  onChange={(e) => patch('fontSize', Number(e.target.value))}
                />
                <span className="size-display">{draft.fontSize}px</span>
              </div>
            </div>
          </section>

          {/* Update */}
          <section className="settings-section">
            <h3>Cập nhật</h3>
            <p className="muted small" style={{ marginBottom: 8 }}>
              Phiên bản hiện tại: <code>{appVersion}</code>
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn-ghost"
                onClick={() => void handleCheckUpdate()}
                disabled={checking}
              >
                {checking ? '⏳ Đang kiểm tra…' : '🔄 Kiểm tra bản mới'}
              </button>
              {updateInfo?.hasUpdate && updateInfo.downloadUrl && (
                <button className="btn btn-primary" onClick={() => void handleDownload()}>
                  ⬇ Tải bản {updateInfo.latest}
                </button>
              )}
            </div>
            {updateMsg && (
              <p className="muted small" style={{ marginTop: 6 }}>
                {updateMsg}
              </p>
            )}
          </section>

          {/* About */}
          <section className="settings-section">
            <h3>Thông tin</h3>
            <p className="muted small">
              TrishImage v{appVersion} — quản lý ảnh + video local với EXIF + thumbnail + tag + timeline.
              100% offline. Hỗ trợ JPG/PNG/WEBP/GIF/BMP/TIFF + MP4/MOV/AVI/MKV/WEBM.
            </p>
            <p className="muted small" style={{ marginTop: 8 }}>
              <strong>Phím tắt:</strong> Ctrl+K focus search · Esc bỏ chọn · F2 đổi tên
            </p>
          </section>
        </div>

        <footer className="modal-foot">
          <span className="muted small">
            {savedFlash ? '✓ Đã lưu' : dirty ? '● Có thay đổi chưa lưu' : '— không có thay đổi —'}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            {dirty && (
              <button className="btn btn-ghost" onClick={handleReset}>
                ↺ Khôi phục
              </button>
            )}
            <button className="btn btn-ghost" onClick={() => void handleClose()}>
              Đóng
            </button>
            <button className="btn btn-primary" onClick={handleSave} disabled={!dirty}>
              ✓ Lưu cài đặt
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
