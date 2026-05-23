import { useEffect, useState } from 'react';
import { openUrl } from '@tauri-apps/plugin-opener';
import {
  type Settings,
  type ThemeMode,
  type Language,
} from '../settings.js';
import { makeT } from '../i18n/index.js';
import { checkForUpdate, type UpdateInfo } from '../tauri-bridge.js';

/**
 * Phase 15.2.r10 — TrishLibrary Settings modal.
 * 5 sections: Library (name + root) + Theme + Language + Backup (import/export) + Update check.
 */

interface SettingsModalProps {
  initial: Settings;
  appVersion: string;
  onSave: (next: Settings) => void;
  onClose: () => void;
  onImportLibrary: () => void;
  onExportLibrary: () => void;
}

export function SettingsModal({
  initial,
  appVersion,
  onSave,
  onClose,
  onImportLibrary,
  onExportLibrary,
}: SettingsModalProps): JSX.Element {
  const [draft, setDraft] = useState<Settings>(initial);
  const tr = makeT(draft.language);

  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

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
      console.warn('[trishlibrary] open download fail:', err);
    }
  }

  const updateTheme = (theme: ThemeMode): void =>
    setDraft((d) => ({ ...d, theme }));
  const updateLang = (language: Language): void =>
    setDraft((d) => ({ ...d, language }));

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
      onClick={onClose}
    >
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <button
          className="modal-close"
          onClick={onClose}
          aria-label={tr('settings.close')}
          type="button"
        >
          ×
        </button>

        <header className="modal-head">
          <h2 id="settings-modal-title">{tr('settings.title')}</h2>
        </header>

        <section className="modal-body">
          {/* Theme */}
          <div className="settings-section">
            <h3>{tr('settings.theme.label')}</h3>
            <div className="settings-radio-group" role="radiogroup">
              {(['light', 'dark', 'system'] as const).map((mode) => (
                <label
                  key={mode}
                  className={
                    draft.theme === mode
                      ? 'settings-radio settings-radio-active'
                      : 'settings-radio'
                  }
                >
                  <input
                    type="radio"
                    name="settings-theme"
                    value={mode}
                    checked={draft.theme === mode}
                    onChange={() => updateTheme(mode)}
                  />
                  <span>{tr(`settings.theme.${mode}`)}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Language */}
          <div className="settings-section">
            <h3>{tr('settings.language.label')}</h3>
            <div className="settings-radio-group" role="radiogroup">
              {(['vi', 'en'] as const).map((lang) => (
                <label
                  key={lang}
                  className={
                    draft.language === lang
                      ? 'settings-radio settings-radio-active'
                      : 'settings-radio'
                  }
                >
                  <input
                    type="radio"
                    name="settings-language"
                    value={lang}
                    checked={draft.language === lang}
                    onChange={() => updateLang(lang)}
                  />
                  <span>{tr(`settings.language.${lang}`)}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Backup / Restore */}
          <div className="settings-section">
            <h3>{tr('settings.backup.label')}</h3>
            <div className="settings-row">
              <button
                type="button"
                className="btn btn-ghost btn-small"
                onClick={() => {
                  onImportLibrary();
                  onClose();
                }}
              >
                ⬇ {tr('settings.backup.import')}
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-small"
                onClick={() => {
                  onExportLibrary();
                  onClose();
                }}
              >
                ⬆ {tr('settings.backup.export')}
              </button>
            </div>
            <p className="form-hint" style={{ marginTop: 8 }}>
              {tr('settings.backup.hint')}
            </p>
          </div>

          {/* Update check */}
          <div className="settings-section">
            <h3>{tr('settings.update.label')}</h3>
            <div className="settings-row">
              <span className="muted small">
                {tr('settings.update.current')}: <strong>v{appVersion}</strong>
              </span>
              <span className="actions-spacer" />
              <button
                type="button"
                className="btn btn-ghost btn-small"
                onClick={() => void handleCheckUpdate()}
                disabled={checkingUpdate}
              >
                {checkingUpdate
                  ? tr('settings.update.checking')
                  : `⟳ ${tr('settings.update.check')}`}
              </button>
            </div>
            {updateInfo && (
              <div className="settings-update-result">
                {updateInfo.hasUpdate ? (
                  <div className="settings-update-new">
                    <strong>
                      🎉 {tr('settings.update.new_version')}: v{updateInfo.latest}
                    </strong>
                    <button
                      type="button"
                      className="btn btn-primary btn-small"
                      onClick={() => void handleOpenDownloadPage()}
                    >
                      ⬇ {tr('settings.update.download')}
                    </button>
                  </div>
                ) : (
                  <p className="muted small">
                    ✓ {tr('settings.update.up_to_date')}
                  </p>
                )}
              </div>
            )}
          </div>
        </section>

        <footer className="modal-foot">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {tr('settings.cancel')}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => onSave(draft)}
          >
            {tr('settings.save')}
          </button>
        </footer>
      </div>
    </div>
  );
}
