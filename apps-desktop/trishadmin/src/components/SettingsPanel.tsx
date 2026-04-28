/**
 * Phase 18.7.b — Settings panel.
 *
 * Cài đặt app: theme · language · about.
 */

import { useEffect, useState } from 'react';
import {
  type Language,
  type Settings,
  type ThemeMode,
  applyTheme,
  loadSettings,
  saveSettings,
} from '../settings.js';
import { getAppVersion } from '../tauri-bridge.js';

interface Props {
  onSettingsChange?: (s: Settings) => void;
}

const THEME_LABEL: Record<ThemeMode, string> = {
  dark: '🌙 Tối',
  light: '☀ Sáng',
  system: '💻 Theo hệ thống',
};

const LANG_LABEL: Record<Language, string> = {
  vi: '🇻🇳 Tiếng Việt',
  en: '🇬🇧 English',
};

export function SettingsPanel({ onSettingsChange }: Props): JSX.Element {
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [appVersion, setAppVersion] = useState('dev');
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    void getAppVersion().then(setAppVersion);
  }, []);

  function update<K extends keyof Settings>(key: K, value: Settings[K]): void {
    const next = { ...settings, [key]: value };
    setSettings(next);
    saveSettings(next);
    if (key === 'theme') {
      applyTheme(value as ThemeMode);
    }
    onSettingsChange?.(next);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1200);
  }

  return (
    <div className="panel">
      <header className="panel-head">
        <div>
          <h1>Cài đặt</h1>
          <p className="muted small">
            Tuỳ chỉnh giao diện TrishAdmin. Cài đặt lưu trên máy này.
          </p>
        </div>
        {savedFlash && <span className="info-banner" style={{ margin: 0 }}>✓ Đã lưu</span>}
      </header>

      <section className="settings-section">
        <h2>Giao diện</h2>
        <div className="settings-row">
          <label className="settings-label">Theme (chế độ màu)</label>
          <div className="settings-pills">
            {(Object.keys(THEME_LABEL) as ThemeMode[]).map((t) => (
              <button
                key={t}
                type="button"
                className={`settings-pill ${settings.theme === t ? 'active' : ''}`}
                onClick={() => update('theme', t)}
              >
                {THEME_LABEL[t]}
              </button>
            ))}
          </div>
        </div>

        <div className="settings-row">
          <label className="settings-label">Ngôn ngữ</label>
          <div className="settings-pills">
            {(Object.keys(LANG_LABEL) as Language[]).map((l) => (
              <button
                key={l}
                type="button"
                className={`settings-pill ${settings.language === l ? 'active' : ''}`}
                onClick={() => update('language', l)}
              >
                {LANG_LABEL[l]}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="settings-section">
        <h2>Về TrishAdmin</h2>
        <div className="about-card">
          <p>
            <strong>Phiên bản:</strong> v{appVersion}
          </p>
          <p>
            <strong>Mục đích:</strong> quản trị nội bộ hệ sinh thái TrishTEAM. KHÔNG
            phân phối public. Chỉ admin email trong allowlist mới login được.
          </p>
          <p className="muted small">
            © 2026 TrishTEAM · Tauri 2 + React + Firebase
          </p>
        </div>
      </section>
    </div>
  );
}
