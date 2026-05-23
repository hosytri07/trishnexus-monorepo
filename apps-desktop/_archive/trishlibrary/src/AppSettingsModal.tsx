/**
 * Phase 18.1.a — App-level Settings modal.
 *
 * Pattern: draft state → user edit → bấm "Lưu cài đặt" → apply.
 * Settings module-specific vẫn nằm trong Settings của module riêng.
 * Đăng xuất nằm ở UserPanel (góc phải module-nav), KHÔNG ở đây.
 */

import { useEffect, useState } from 'react';
import { openUrl } from '@tauri-apps/plugin-opener';
import { invoke } from '@tauri-apps/api/core';
import {
  type Settings,
  type ThemeMode,
  type Language,
  saveSettings,
  applyTheme,
} from './settings.js';
import { makeT } from './i18n/index.js';
import { checkForUpdate, type UpdateInfo } from './tauri-bridge.js';
import { useDialogs } from './components/dialogs/DialogProvider.js';

interface ExternalToolsStatus {
  tesseract: boolean;
  qpdf: boolean;
  libreoffice: boolean;
  vie_traineddata: boolean;
  eng_traineddata: boolean;
}

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
  const { confirm } = useDialogs();
  const [draft, setDraft] = useState<Settings>(initial);
  const [savedFlash, setSavedFlash] = useState(false);
  const tr = makeT(draft.language);

  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);

  // Phase 38.2.0 — External tools status
  const [toolsStatus, setToolsStatus] = useState<ExternalToolsStatus | null>(null);
  const [refreshingTools, setRefreshingTools] = useState(false);
  const [toolsError, setToolsError] = useState<string | null>(null);

  async function refreshToolsStatus(): Promise<void> {
    setRefreshingTools(true);
    try {
      const s = await invoke<ExternalToolsStatus>('check_external_tools');
      setToolsStatus(s);
    } catch (err) {
      console.warn('check_external_tools fail:', err);
    } finally {
      setRefreshingTools(false);
    }
  }

  async function openInstallToolsWizard(): Promise<void> {
    setToolsError(null);
    try {
      await invoke('open_install_tools_wizard');
    } catch (err) {
      setToolsError(`Không mở được wizard: ${String(err)}`);
    }
  }

  useEffect(() => {
    void refreshToolsStatus();
  }, []);

  useEffect(() => {
    setDraft(initial);
  }, [initial]);

  useEffect(() => {
    const handler = async (e: KeyboardEvent): Promise<void> => {
      if (e.key === 'Escape') {
        if (dirty) {
          const ok = await confirm({
            title: 'Xác nhận',
            message: 'Cài đặt đã thay đổi nhưng chưa lưu. Đóng và bỏ thay đổi?',
            variant: 'warning',
          });
          if (ok) {
            onClose();
          }
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handler as unknown as EventListener);
    return () => window.removeEventListener('keydown', handler as unknown as EventListener);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, initial, onClose, confirm]);

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
      const ok = await confirm({
        title: 'Xác nhận',
        message: 'Cài đặt đã thay đổi nhưng chưa lưu. Đóng và bỏ thay đổi?',
        variant: 'warning',
      });
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

          {/* Phase 38.2.0 — Công cụ ngoài (Tesseract / qpdf / LibreOffice) */}
          <section className="settings-section">
            <h3>🛠 Công cụ ngoài</h3>
            <p className="muted small" style={{ marginBottom: 8 }}>
              Cần cho OCR PDF tiếng Việt + đặt mật khẩu PDF + convert PDF↔Word.
            </p>
            <div style={{ display: 'grid', gap: 6, marginBottom: 10 }}>
              <ToolRow
                label="Tesseract OCR"
                hint="OCR tiếng Việt"
                ok={toolsStatus?.tesseract === true}
              />
              <ToolRow
                label="qpdf"
                hint="Mật khẩu PDF"
                ok={toolsStatus?.qpdf === true}
              />
              <ToolRow
                label="LibreOffice"
                hint="Convert PDF↔Word"
                ok={toolsStatus?.libreoffice === true}
              />
              <ToolRow
                label="vie.traineddata"
                hint="Tessdata Việt (best)"
                ok={toolsStatus?.vie_traineddata === true}
              />
              <ToolRow
                label="eng.traineddata"
                hint="Tessdata Anh (best)"
                ok={toolsStatus?.eng_traineddata === true}
              />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn-primary"
                onClick={() => void openInstallToolsWizard()}
              >
                ⬇ Mở wizard cài đặt
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => void refreshToolsStatus()}
                disabled={refreshingTools}
              >
                {refreshingTools ? '⏳ Đang kiểm tra...' : '🔄 Kiểm tra lại'}
              </button>
            </div>
            {toolsError && (
              <div
                style={{
                  marginTop: 8,
                  padding: '6px 10px',
                  background: 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(239,68,68,0.4)',
                  borderRadius: 6,
                  color: '#DC2626',
                  fontSize: 12,
                }}
              >
                ⚠ {toolsError}
              </div>
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

// Phase 38.2.0 — Row hiển thị 1 tool ngoài với badge OK/CHƯA CÀI
function ToolRow({
  label,
  hint,
  ok,
}: {
  label: string;
  hint: string;
  ok: boolean;
}): JSX.Element {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '4px 10px',
        background: 'var(--bg-soft, rgba(0,0,0,0.04))',
        borderRadius: 8,
        fontSize: 13,
      }}
    >
      <span style={{ flex: 1 }}>
        <strong>{label}</strong>{' '}
        <span className="muted small" style={{ marginLeft: 4 }}>
          — {hint}
        </span>
      </span>
      {ok ? (
        <span style={{ color: 'var(--success, #10b981)', fontWeight: 600 }}>✓ Đã cài</span>
      ) : (
        <span style={{ color: 'var(--danger, #ef4444)', fontWeight: 600 }}>✗ Chưa cài</span>
      )}
    </div>
  );
}
