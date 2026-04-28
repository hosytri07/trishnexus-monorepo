/**
 * SettingsModal — Phase 17.1.f.
 * Modal đơn giản: theme, retention days, auto-purge, auto-update.
 */

import { useState } from 'react';
import {
  type AppSettings,
  type Theme,
  DEFAULT_SETTINGS,
  saveSettings,
  applyTheme,
} from './settings.js';

interface Props {
  initial: AppSettings;
  onClose: () => void;
  onSave: (s: AppSettings) => void;
}

export function SettingsModal({ initial, onClose, onSave }: Props): JSX.Element {
  const [draft, setDraft] = useState<AppSettings>(initial);

  function update<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function handleSave(): void {
    saveSettings(draft);
    applyTheme(draft.theme);
    onSave(draft);
    onClose();
  }

  function handleReset(): void {
    setDraft({ ...DEFAULT_SETTINGS });
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <h2>⚙ Cài đặt TrishClean</h2>
          <button type="button" className="modal-close" onClick={onClose}>
            ×
          </button>
        </header>

        <div className="modal-body">
          {/* Theme */}
          <div className="setting-row">
            <div className="setting-label">
              <strong>Giao diện</strong>
              <p className="muted small">Theme sáng/tối/tự động theo OS</p>
            </div>
            <div className="setting-control">
              {(['auto', 'light', 'dark'] as Theme[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`pill-btn ${draft.theme === t ? 'active' : ''}`}
                  onClick={() => update('theme', t)}
                >
                  {t === 'auto' ? '🌓 Auto' : t === 'light' ? '☀ Light' : '🌙 Dark'}
                </button>
              ))}
            </div>
          </div>

          {/* Retention days */}
          <div className="setting-row">
            <div className="setting-label">
              <strong>Giữ trash bao lâu</strong>
              <p className="muted small">
                File trong trash sẽ tự xoá vĩnh viễn sau N ngày. Mặc định 7 ngày.
              </p>
            </div>
            <div className="setting-control">
              <input
                type="number"
                min={1}
                max={90}
                value={draft.retentionDays}
                onChange={(e) =>
                  update('retentionDays', Math.max(1, Math.min(90, Number(e.target.value) || 7)))
                }
                className="num-input"
              />
              <span className="muted small">ngày</span>
            </div>
          </div>

          {/* Auto-purge */}
          <div className="setting-row">
            <div className="setting-label">
              <strong>Tự động xoá trash cũ khi mở app</strong>
              <p className="muted small">
                Mỗi lần mở app, các session quá hạn sẽ tự bị xoá vĩnh viễn.
              </p>
            </div>
            <div className="setting-control">
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={draft.autoPurgeOnLaunch}
                  onChange={(e) => update('autoPurgeOnLaunch', e.target.checked)}
                />
                <span>{draft.autoPurgeOnLaunch ? 'Bật' : 'Tắt'}</span>
              </label>
            </div>
          </div>

          {/* Auto check update */}
          <div className="setting-row">
            <div className="setting-label">
              <strong>Kiểm tra bản mới khi mở app</strong>
              <p className="muted small">
                Fetch registry từ trishteam.io.vn — không cần login.
              </p>
            </div>
            <div className="setting-control">
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={draft.autoCheckUpdate}
                  onChange={(e) => update('autoCheckUpdate', e.target.checked)}
                />
                <span>{draft.autoCheckUpdate ? 'Bật' : 'Tắt'}</span>
              </label>
            </div>
          </div>

          {/* Confirm before clean */}
          <div className="setting-row">
            <div className="setting-label">
              <strong>Hỏi xác nhận trước khi dọn</strong>
              <p className="muted small">
                Dialog confirm trước mỗi action dọn (Quick Clean / Custom Scan).
                Tắt nếu anh muốn workflow nhanh hơn (đã quen).
              </p>
            </div>
            <div className="setting-control">
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={draft.confirmBeforeClean}
                  onChange={(e) => update('confirmBeforeClean', e.target.checked)}
                />
                <span>{draft.confirmBeforeClean ? 'Bật' : 'Tắt'}</span>
              </label>
            </div>
          </div>
        </div>

        <footer className="modal-foot">
          <button type="button" className="btn btn-ghost btn-small" onClick={handleReset}>
            ↺ Reset mặc định
          </button>
          <span style={{ flex: 1 }} />
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Huỷ
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSave}>
            Lưu
          </button>
        </footer>
      </div>
    </div>
  );
}
