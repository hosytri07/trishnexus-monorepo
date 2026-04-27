/**
 * Phase 18.1.a — App-level Settings modal.
 *
 * Pattern: draft state → user edit → bấm "Lưu cài đặt" → apply.
 * Settings module-specific vẫn nằm trong Settings của module riêng.
 * Đăng xuất nằm ở UserPanel (góc phải module-nav), KHÔNG ở đây.
 */

import { useEffect, useState } from 'react';
import { openUrl } from '@tauri-apps/plugin-opener';
import {
  type Settings,
  type ThemeMode,
  type Language,
  saveSettings,
  applyTheme,
} from './settings.js';
import { makeT } from './i18n/index.js';
import { checkForUpdate, type UpdateInfo } from './tauri-bridge.js';

interface Props {
  appVersion: string;
  initial: Settings;
  onClose: () => void;
  onSettingsChange: (s: Settings) => void;
}

export function AppSettingsModal({
  appVersion,
  initial,
  onClose,
  onSettingsChange,
}: Props): JSX.Element {
  const [draft, setDraft] = useState<Settings>(initial);
  const [savedFlash, setSavedFlash] = useState(false);
  const tr = makeT(draft.language);

  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);

  useEffect(() => {
    setDraft(initial);
  }, [initial]);

  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        if (dirty) {
          if (window.confirm('Cài đặt đã thay đổi nhưng chưa lưu. Đóng và bỏ thay đổi?')) {
            onClose();
          }
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, initial, onClose]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);

  function patch<K extends keyof Settings>(key: K, value: Settings[K]): void {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function handleSave(): void {
    saveSettings(draft);
    applyTheme(draft.theme);
    onSettingsChange(draft);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
  }

  function handleReset(): void {
    setDraft(initial);
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

  async function handleCheckUpdate(): Promise<void> {
    setCheckingUpdate(true);
    try {
      const info = await checkForUpdate(appVersion);
      setUpdateInfo(info);
    } finally {
      setCheckingUpdate(false);
    }
  }

  async function handleOpenDownloadPage(): Promise<void> {
    if (!updateInfo?.downloadUrl) return;
    try {
      await openUrl(updateInfo.downloadUrl);
    } catch (err) {
      console.warn('open download fail:', err);
    }
  }

  return (
    <div className="modal-backdrop" onClick={() => void handleClose()}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 640 }}
      >
        <header className="modal-head">
          <h2>
            ⚙ {tr('app_settings.title')}{' '}
            <span className="muted small">v{appVersion}</span>
            {dirty && <span className="muted small"> · {tr('app_settings.unsaved')}</span>}
          </h2>
          <button className="mini" onClick={() => void handleClose()}>
            ×
          </button>
        </header>

        <div className="modal-body">
          {/* Appearance */}
          <section className="settings-section">
            <h3>🎨 {tr('app_settings.section.appearance')}</h3>
            <div className="settings-row">
              <div className="settings-label">
                <strong>{tr('app_settings.theme.label')}</strong>
                <p className="muted small">{tr('app_settings.theme.hint')}</p>
              </div>
              <div className="settings-control segmented">
                {(
                  [
                    { v: 'system', label: `🌓 ${tr('app_settings.theme.auto')}` },
                    { v: 'light', label: `☀️ ${tr('app_settings.theme.light')}` },
                    { v: 'dark', label: `🌙 ${tr('app_settings.theme.dark')}` },
                  ] as Array<{ v: ThemeMode; label: string }>
                ).map((t) => (
                  <button
                    key={t.v}
                    type="button"
                    className={`seg-btn ${draft.theme === t.v ? 'active' : ''}`}
                    onClick={() => patch('theme', t.v)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="settings-row">
              <div className="settings-label">
                <strong>{tr('app_settings.lang.label')}</strong>
                <p className="muted small">{tr('app_settings.lang.hint')}</p>
              </div>
              <div className="settings-control segmented">
                {(
                  [
                    { v: 'vi', label: 'Tiếng Việt' },
                    { v: 'en', label: 'English' },
                  ] as Array<{ v: Language; label: string }>
                ).map((l) => (
                  <button
                    key={l.v}
                    type="button"
                    className={`seg-btn ${draft.language === l.v ? 'active' : ''}`}
                    onClick={() => patch('language', l.v)}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Shortcuts */}
          <section className="settings-section">
            <h3>⌨ {tr('app_settings.section.shortcuts')}</h3>
            <div className="shortcut-grid">
              <div className="shortcut-row">
                <kbd>Ctrl+1</kbd> <span>{tr('shortcut.module_lib')}</span>
              </div>
              <div className="shortcut-row">
                <kbd>Ctrl+2</kbd> <span>{tr('shortcut.module_note')}</span>
              </div>
              <div className="shortcut-row">
                <kbd>Ctrl+3</kbd> <span>{tr('shortcut.module_doc')}</span>
              </div>
              <div className="shortcut-row">
                <kbd>Ctrl+4</kbd> <span>{tr('shortcut.module_img')}</span>
              </div>
              <div className="shortcut-row">
                <kbd>Ctrl+K</kbd> <span>{tr('shortcut.global_search')}</span>
              </div>
              <div className="shortcut-row">
                <kbd>Ctrl+,</kbd> <span>{tr('shortcut.open_settings')}</span>
              </div>
              <div className="shortcut-row">
                <kbd>Ctrl+Shift+N</kbd> <span>{tr('shortcut.quick_capture')}</span>
              </div>
              <div className="shortcut-row">
                <kbd>Ctrl+S</kbd> <span>{tr('shortcut.save')}</span>
              </div>
            </div>
          </section>

          {/* Modules */}
          <section className="settings-section">
            <h3>📦 {tr('app_settings.section.modules')}</h3>
            <div className="modules-info">
              {(
                [
                  { icon: '📚', labelKey: 'module.library', descKey: 'module_desc.library' },
                  { icon: '📝', labelKey: 'module.note', descKey: 'module_desc.note' },
                  { icon: '📄', labelKey: 'module.document', descKey: 'module_desc.document' },
                  { icon: '🖼', labelKey: 'module.image', descKey: 'module_desc.image' },
                ] as const
              ).map((m) => (
                <div key={m.labelKey} className="module-info-card">
                  <span className="module-info-icon">{m.icon}</span>
                  <div>
                    <strong>{tr(m.labelKey)}</strong>
                    <p className="muted small">{tr(m.descKey)}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Update */}
          <section className="settings-section">
            <h3>🔄 {tr('app_settings.section.update')}</h3>
            <p className="muted small" style={{ marginBottom: 8 }}>
              {tr('app_settings.update.label')}: <code>{appVersion}</code>
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn-ghost"
                onClick={() => void handleCheckUpdate()}
                disabled={checkingUpdate}
              >
                {checkingUpdate
                  ? `⏳ ${tr('app_settings.update.checking')}`
                  : `🔄 ${tr('app_settings.update.check')}`}
              </button>
              {updateInfo?.hasUpdate && updateInfo.downloadUrl && (
                <button className="btn btn-primary" onClick={() => void handleOpenDownloadPage()}>
                  ⬇ {tr('app_settings.update.download')} {updateInfo.latest}
                </button>
              )}
            </div>
            {updateInfo && !updateInfo.hasUpdate && (
              <p className="muted small" style={{ marginTop: 6 }}>
                ✓ {tr('app_settings.update.up_to_date')} ({updateInfo.current})
              </p>
            )}
            {updateInfo?.hasUpdate && (
              <p className="muted small" style={{ marginTop: 6 }}>
                ✓ {tr('app_settings.update.has_new')}: {updateInfo.latest}
              </p>
            )}
          </section>

          {/* About */}
          <section className="settings-section">
            <h3>ℹ {tr('app_settings.section.about')}</h3>
            <p className="muted small">{tr('app_settings.about.intro')}</p>
            <p className="muted small" style={{ marginTop: 8 }}>
              {tr('app_settings.about.copyright')} ·{' '}
              <a
                href="https://trishteam.io.vn"
                onClick={(e) => {
                  e.preventDefault();
                  void openUrl('https://trishteam.io.vn');
                }}
                style={{ color: 'var(--accent)' }}
              >
                trishteam.io.vn
              </a>
            </p>
          </section>
        </div>

        <footer className="modal-foot">
          <span className="muted small">
            {savedFlash
              ? tr('app_settings.saved')
              : dirty
                ? tr('app_settings.has_changes')
                : tr('app_settings.no_changes')}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            {dirty && (
              <button className="btn btn-ghost" onClick={handleReset}>
                ↺ {tr('app_settings.restore')}
              </button>
            )}
            <button className="btn btn-ghost" onClick={() => void handleClose()}>
              {tr('app_settings.close')}
            </button>
            <button className="btn btn-primary" onClick={handleSave} disabled={!dirty}>
              ✓ {tr('app_settings.save')}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
