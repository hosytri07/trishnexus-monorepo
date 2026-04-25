import { useEffect, useState } from 'react';
import {
  type Settings,
  type ThemeMode,
  type Language,
} from '../settings.js';
import { makeT } from '../i18n/index.js';

/**
 * Phase 15.0.g — Settings modal cho TrishCheck.
 *
 * 3 section: Theme / Language / Auto-snapshot toggle.
 * Pattern copy từ TrishLauncher (overlay click + Esc + draft state).
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
  const tr = makeT(draft.language);

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
  const toggleSnapshot = (autoSnapshot: boolean): void =>
    setDraft((d) => ({ ...d, autoSnapshot }));

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
      onClick={onClose}
    >
      <div
        className="modal-dialog"
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

          {/* Auto-snapshot */}
          <div className="settings-section">
            <label className="settings-toggle">
              <input
                type="checkbox"
                checked={draft.autoSnapshot}
                onChange={(e) => toggleSnapshot(e.target.checked)}
              />
              <span>{tr('settings.snapshot.label')}</span>
            </label>
            <p className="settings-hint">{tr('settings.snapshot.hint')}</p>
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
