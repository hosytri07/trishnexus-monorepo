/**
 * Phase 17.6 v2 — TrishType SettingsModal.
 *
 * Settings cho document editor:
 *  - Theme (auto/light/dark)
 *  - UI font size (12-16)
 *  - Editor font family (system/serif/georgia/times/mono) + size (12-22)
 *  - Auto-save on/off + delay
 *  - Default export format
 *  - Auto-format paste on/off
 *  - Update check
 */

import { useEffect, useState } from 'react';
import { openUrl } from '@tauri-apps/plugin-opener';
import { invoke } from '@tauri-apps/api/core';
import {
  type AppSettings,
  type EditorFontFamily,
  type Theme,
  applySettings,
  saveSettings,
} from './settings.js';

interface Props {
  settings: AppSettings;
  appVersion: string;
  onSettingsChange: (s: AppSettings) => void;
  onClose: () => void;
}

interface UpdateInfo {
  current: string;
  latest: string;
  hasUpdate: boolean;
  downloadUrl: string;
  changelogUrl: string;
}

function isInTauri(): boolean {
  return (
    typeof window !== 'undefined' &&
    // @ts-expect-error
    typeof window.__TAURI_INTERNALS__ !== 'undefined'
  );
}

async function checkForUpdate(currentVersion: string): Promise<UpdateInfo> {
  const APPS_REGISTRY = 'https://trishteam.io.vn/apps-registry.json';
  const fallback: UpdateInfo = {
    current: currentVersion,
    latest: currentVersion,
    hasUpdate: false,
    downloadUrl: '',
    changelogUrl: '',
  };
  if (!isInTauri()) return fallback;
  try {
    const text = await invoke<string>('fetch_text', { url: APPS_REGISTRY });
    const json = JSON.parse(text) as {
      apps?: Array<{
        id: string;
        version: string;
        download?: { windows_x64?: { url: string } };
        changelog_url?: string;
      }>;
    };
    const me = json.apps?.find((a) => a.id === 'trishtype');
    if (!me) return fallback;
    return {
      current: currentVersion,
      latest: me.version,
      hasUpdate: me.version !== currentVersion,
      downloadUrl: me.download?.windows_x64?.url ?? '',
      changelogUrl: me.changelog_url ?? '',
    };
  } catch {
    return fallback;
  }
}

async function clearRecents(): Promise<void> {
  if (!isInTauri()) return;
  await invoke<void>('clear_recent_files');
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
  const [clearedRecents, setClearedRecents] = useState(false);

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(settings);

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
      console.warn('[trishtype] open download fail:', err);
    }
  }

  async function handleClearRecents(): Promise<void> {
    const ok = window.confirm('Xoá toàn bộ lịch sử file mở gần đây?');
    if (!ok) return;
    try {
      await clearRecents();
      setClearedRecents(true);
      setTimeout(() => setClearedRecents(false), 1500);
    } catch (err) {
      console.warn('[trishtype] clear recents fail:', err);
    }
  }

  return (
    <div className="modal-backdrop" onClick={() => void handleClose()}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 580 }}>
        <header className="modal-head">
          <h2>⚙ Cài đặt {dirty && <span className="muted small">· chưa lưu</span>}</h2>
          <button className="mini" onClick={() => void handleClose()}>×</button>
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

            <div className="settings-row">
              <div className="settings-label">
                <strong>Cỡ chữ giao diện</strong>
                <p className="muted small">12-16 px</p>
              </div>
              <div className="settings-control">
                <input
                  type="range"
                  min={12}
                  max={16}
                  step={1}
                  value={draft.uiFontSize}
                  onChange={(e) => patch('uiFontSize', Number(e.target.value))}
                />
                <span className="size-display">{draft.uiFontSize}px</span>
              </div>
            </div>
          </section>

          {/* Editor */}
          <section className="settings-section">
            <h3>Editor</h3>
            <div className="settings-row">
              <div className="settings-label">
                <strong>Font soạn thảo</strong>
                <p className="muted small">Font dùng trong editor body</p>
              </div>
              <div className="settings-control" style={{ flexWrap: 'wrap' }}>
                {(
                  [
                    { v: 'system', label: 'System' },
                    { v: 'serif', label: 'Charter' },
                    { v: 'georgia', label: 'Georgia' },
                    { v: 'times', label: 'Times' },
                    { v: 'mono', label: 'Cascadia' },
                  ] as Array<{ v: EditorFontFamily; label: string }>
                ).map((opt) => (
                  <button
                    key={opt.v}
                    type="button"
                    className={`pill-btn ${draft.editorFontFamily === opt.v ? 'active' : ''}`}
                    onClick={() => patch('editorFontFamily', opt.v)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="settings-row">
              <div className="settings-label">
                <strong>Cỡ chữ editor</strong>
                <p className="muted small">12-22 px</p>
              </div>
              <div className="settings-control">
                <input
                  type="range"
                  min={12}
                  max={22}
                  step={1}
                  value={draft.editorFontSize}
                  onChange={(e) => patch('editorFontSize', Number(e.target.value))}
                />
                <span className="size-display">{draft.editorFontSize}px</span>
              </div>
            </div>
          </section>

          {/* Auto-save */}
          <section className="settings-section">
            <h3>Auto-save</h3>
            <div className="settings-row">
              <div className="settings-label">
                <strong>Tự lưu khi không gõ</strong>
                <p className="muted small">Chỉ áp dụng cho file đã có path</p>
              </div>
              <div className="settings-control">
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={draft.autoSave}
                    onChange={(e) => patch('autoSave', e.target.checked)}
                  />
                  <span className="toggle-track" />
                </label>
              </div>
            </div>
            {draft.autoSave && (
              <div className="settings-row">
                <div className="settings-label">
                  <strong>Delay sau khi gõ xong</strong>
                  <p className="muted small">{(draft.autoSaveDelayMs / 1000).toFixed(1)}s</p>
                </div>
                <div className="settings-control">
                  <input
                    type="range"
                    min={500}
                    max={5000}
                    step={250}
                    value={draft.autoSaveDelayMs}
                    onChange={(e) => patch('autoSaveDelayMs', Number(e.target.value))}
                  />
                  <span className="size-display">
                    {(draft.autoSaveDelayMs / 1000).toFixed(1)}s
                  </span>
                </div>
              </div>
            )}
          </section>

          {/* Editor behavior */}
          <section className="settings-section">
            <h3>Hành vi soạn thảo</h3>
            <div className="settings-row">
              <div className="settings-label">
                <strong>Auto-format khi paste</strong>
                <p className="muted small">URL → link, "1. " → list, etc.</p>
              </div>
              <div className="settings-control">
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={draft.autoFormatPaste}
                    onChange={(e) => patch('autoFormatPaste', e.target.checked)}
                  />
                  <span className="toggle-track" />
                </label>
              </div>
            </div>

            <div className="settings-row">
              <div className="settings-label">
                <strong>Format export mặc định</strong>
                <p className="muted small">Dùng khi bấm Export nhanh</p>
              </div>
              <div className="settings-control">
                <select
                  value={draft.defaultExportFormat}
                  onChange={(e) =>
                    patch('defaultExportFormat', e.target.value as AppSettings['defaultExportFormat'])
                  }
                  className="tb-select"
                >
                  <option value="docx">Word (.docx)</option>
                  <option value="md">Markdown (.md)</option>
                  <option value="pdf">PDF (.pdf)</option>
                  <option value="html">HTML (.html)</option>
                  <option value="txt">Plain text (.txt)</option>
                </select>
              </div>
            </div>
          </section>

          {/* Recent files */}
          <section className="settings-section">
            <h3>Lịch sử</h3>
            <div className="settings-row">
              <div className="settings-label">
                <strong>File mở gần đây</strong>
                <p className="muted small">
                  Lưu max 30 file ở %LocalAppData%/TrishTEAM/TrishType/state.json
                </p>
              </div>
              <div className="settings-control">
                <button
                  className="btn btn-ghost btn-small"
                  onClick={() => void handleClearRecents()}
                >
                  {clearedRecents ? '✓ Đã xoá' : '🗑 Xoá hết'}
                </button>
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
              TrishType v{appVersion} — trình soạn thảo văn bản chuyên nghiệp + converter đa format.
              Hỗ trợ: .docx · .md · .html · .txt · .pdf · .json. 100% offline.
            </p>
            <p className="muted small" style={{ marginTop: 8 }}>
              <strong>Phím tắt:</strong> Ctrl+N file mới · Ctrl+O mở · Ctrl+S lưu · Ctrl+Shift+S lưu thành ·
              Ctrl+Shift+E xuất · Ctrl+W đóng tab · Ctrl+F find · Ctrl+H replace · Ctrl+B/I/U formatting
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
