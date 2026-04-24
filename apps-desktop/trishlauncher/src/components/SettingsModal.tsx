import { useEffect, useState } from 'react';
import {
  type Settings,
  type ThemeMode,
  type Language,
  type UpdateInterval,
} from '../settings.js';
import { makeT } from '../i18n/index.js';

/**
 * Phase 14.5.5.e — Settings modal.
 *
 * 4 section:
 *  1. Theme (light/dark/system) — radio
 *  2. Language (vi/en) — radio
 *  3. Registry source URL — input (dev/advanced, trống = built-in)
 *  4. Auto-update interval (off/daily/weekly) — select
 *
 * Pattern copy từ AppDetailModal: overlay click đóng, dialog click
 * stopPropagation, Esc đóng. Draft state local → user bấm Lưu mới
 * commit lên parent → App apply + persist.
 */

interface SettingsModalProps {
  initial: Settings;
  onSave: (next: Settings) => void;
  onClose: () => void;
}

export function SettingsModal({
  initial,
  onSave,
  onClose,
}: SettingsModalProps): JSX.Element {
  const [draft, setDraft] = useState<Settings>(initial);
  const tr = makeT(draft.language); // Đổi ngôn ngữ preview live trong modal

  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const updateTheme = (theme: ThemeMode): void =>
    setDraft((d) => ({ ...d, theme }));
  const updateLang = (language: Language): void =>
    setDraft((d) => ({ ...d, language }));
  const updateUpdate = (autoUpdateInterval: UpdateInterval): void =>
    setDraft((d) => ({ ...d, autoUpdateInterval }));
  const updateRegistry = (registryUrl: string): void =>
    setDraft((d) => ({ ...d, registryUrl }));

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
      onClick={onClose}
    >
      <div
        className="modal-dialog modal-dialog-settings"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="modal-close"
          onClick={onClose}
          aria-label={tr('settings.close')}
          type="button"
        >
          ×
        </button>

        <header className="modal-head modal-head-simple">
          <div className="modal-head-text">
            <h2 id="settings-modal-title">{tr('settings.title')}</h2>
          </div>
        </header>

        <section className="modal-body">
          {/* Theme ---------------------------------------------------- */}
          <div className="modal-section settings-section">
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

          {/* Language ------------------------------------------------- */}
          <div className="modal-section settings-section">
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

          {/* Registry URL -------------------------------------------- */}
          <div className="modal-section settings-section">
            <h3>{tr('settings.registry.label')}</h3>
            <input
              type="url"
              className="settings-input"
              value={draft.registryUrl}
              placeholder={tr('settings.registry.placeholder')}
              onChange={(e) => updateRegistry(e.target.value)}
              spellCheck={false}
            />
            <p className="settings-hint">{tr('settings.registry.hint')}</p>
          </div>

          {/* Auto-update interval ------------------------------------ */}
          <div className="modal-section settings-section">
            <h3>{tr('settings.update.label')}</h3>
            <select
              className="settings-select"
              value={draft.autoUpdateInterval}
              onChange={(e) =>
                updateUpdate(e.target.value as UpdateInterval)
              }
            >
              <option value="off">{tr('settings.update.off')}</option>
              <option value="daily">{tr('settings.update.daily')}</option>
              <option value="weekly">{tr('settings.update.weekly')}</option>
            </select>
          </div>
        </section>

        <footer className="modal-foot">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onClose}
          >
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
