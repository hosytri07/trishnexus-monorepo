import { useEffect, useState } from 'react';
import { openUrl } from '@tauri-apps/plugin-opener';
import {
  type Settings,
  type ThemeMode,
  type Language,
} from '../settings.js';
import { makeT } from '../i18n/index.js';
import {
  getPacksFolderInfo,
  clearAllPacks,
  checkForUpdate,
  type PacksFolderInfo,
  type UpdateInfo,
} from '../tauri-bridge.js';

/**
 * Phase 15.1.d/o — Settings modal cho TrishFont.
 *
 * 4 section + Phase 15.1.o thêm:
 *  - Pack folder info (path + size + clear button)
 *  - Update check (current version + check button)
 */

interface SettingsModalProps {
  initial: Settings;
  appVersion: string;
  onSave: (next: Settings) => void;
  onClose: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) return '—';
  const mb = bytes / 1_048_576;
  if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

export function SettingsModal({
  initial,
  appVersion,
  onSave,
  onClose,
}: SettingsModalProps): JSX.Element {
  const [draft, setDraft] = useState<Settings>(initial);
  const tr = makeT(draft.language);

  // Phase 15.1.o — Pack folder info + update check state
  const [packsInfo, setPacksInfo] = useState<PacksFolderInfo | null>(null);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [clearingPacks, setClearingPacks] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    void getPacksFolderInfo().then(setPacksInfo);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  async function handleClearPacks(): Promise<void> {
    if (!confirm(tr('settings.packs.confirm_clear'))) return;
    setClearingPacks(true);
    try {
      await clearAllPacks();
      const fresh = await getPacksFolderInfo();
      setPacksInfo(fresh);
    } finally {
      setClearingPacks(false);
    }
  }

  async function handleOpenPacksFolder(): Promise<void> {
    if (!packsInfo) return;
    try {
      await openUrl(packsInfo.path);
    } catch (err) {
      console.warn('[trishfont] open folder fail:', err);
    }
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
      console.warn('[trishfont] open download fail:', err);
    }
  }

  const updateTheme = (theme: ThemeMode): void =>
    setDraft((d) => ({ ...d, theme }));
  const updateLang = (language: Language): void =>
    setDraft((d) => ({ ...d, language }));
  const updateSize = (previewSize: number): void =>
    setDraft((d) => ({ ...d, previewSize }));

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

          {/* Phase 15.1.j — Sample text section removed (preview text hardcoded
              to alphabet, không expose cho user) */}

          {/* Preview size */}
          <div className="settings-section">
            <h3>
              {tr('preview.size')}: {draft.previewSize}px
            </h3>
            <input
              type="range"
              min={12}
              max={72}
              step={1}
              value={draft.previewSize}
              onChange={(e) => updateSize(Number(e.target.value))}
              className="settings-range"
            />
          </div>

          {/* Phase 15.1.o — Pack folder info */}
          <div className="settings-section">
            <h3>{tr('settings.packs.label')}</h3>
            {packsInfo ? (
              <div className="settings-packs-info">
                <div className="settings-row">
                  <code className="settings-path" title={packsInfo.path}>
                    {packsInfo.path}
                  </code>
                </div>
                <div className="settings-row">
                  <span className="muted small">
                    {packsInfo.exists
                      ? `${packsInfo.pack_count} pack · ${formatBytes(packsInfo.total_bytes)}`
                      : tr('settings.packs.empty')}
                  </span>
                  <span className="actions-spacer" />
                  <button
                    type="button"
                    className="btn btn-ghost btn-small"
                    onClick={() => void handleOpenPacksFolder()}
                    disabled={!packsInfo.exists}
                  >
                    📂 {tr('settings.packs.open_folder')}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-small btn-danger"
                    onClick={() => void handleClearPacks()}
                    disabled={!packsInfo.exists || clearingPacks}
                  >
                    {clearingPacks
                      ? `🗑 ${tr('settings.packs.clearing')}`
                      : `🗑 ${tr('settings.packs.clear_all')}`}
                  </button>
                </div>
                <p className="settings-hint">{tr('settings.packs.hint')}</p>
              </div>
            ) : (
              <p className="muted small">{tr('settings.packs.loading')}</p>
            )}
          </div>

          {/* Phase 15.1.o — Update check */}
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
                {checkingUpdate ? '⟳ ...' : `⟳ ${tr('settings.update.check')}`}
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
