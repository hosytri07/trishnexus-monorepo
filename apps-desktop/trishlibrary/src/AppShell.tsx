/**
 * Phase 18.1.a — TrishLibrary 3.0 AppShell.
 *
 * Top-level orchestrator switch giữa 4 module:
 *   📚 Thư viện  — quản lý tài liệu PDF/EPUB + tag + cite + Search built-in + OCR
 *   📝 Ghi chú   — personal notes + project + task + backlinks + sticky widget
 *   📄 Tài liệu  — rich editor + chuyển đổi đa định dạng + PDF Tools
 *   🖼 Ảnh       — quản lý ảnh + video + EXIF + tag + 5 view modes + LAN UNC
 *
 * Module switching: top tabs · Ctrl+1/2/3/4 · phím tắt
 */

import { useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { App as LibraryModule } from './App.js';
import { NoteModule } from './modules/note/NoteModule.js';
import { DocumentModule } from './modules/document/DocumentModule.js';
import { ImageModule } from './modules/image/ImageModule.js';
import { TrishteamModule } from './modules/trishteam/TrishteamModule.js';
import { AppSettingsModal } from './AppSettingsModal.js';
import { UserPanel } from './components/UserPanel.js';
import { GlobalSearchModal } from './components/GlobalSearchModal.js';
import { ShortcutsHelpModal } from './components/ShortcutsHelpModal.js';
import { BackupModal } from './components/BackupModal.js';
import { runAutoBackupIfDue } from './lib/backup.js';
import { useAuth } from '@trishteam/auth/react';
import { loadSettings, applyTheme, saveSettings, type Settings } from './settings.js';
import { makeT } from './i18n/index.js';
import logoUrl from './assets/logo.png';

export type ModuleId = 'library' | 'note' | 'document' | 'image' | 'trishteam';

const STORAGE_KEY = 'trishlibrary:active_module';

const MODULE_DEFS: Array<{
  id: ModuleId;
  icon: string;
  labelKey: string;
  shortcut: string;
}> = [
  { id: 'library', icon: '📚', labelKey: 'module.library', shortcut: 'Ctrl+1' },
  { id: 'note', icon: '📝', labelKey: 'module.note', shortcut: 'Ctrl+2' },
  { id: 'document', icon: '📄', labelKey: 'module.document', shortcut: 'Ctrl+3' },
  { id: 'image', icon: '🖼', labelKey: 'module.image', shortcut: 'Ctrl+4' },
  { id: 'trishteam', icon: '☁', labelKey: 'module.trishteam', shortcut: 'Ctrl+5' },
];

function loadActiveModule(): ModuleId {
  if (typeof window === 'undefined') return 'library';
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v === 'library' || v === 'note' || v === 'document' || v === 'image' || v === 'trishteam') return v;
  } catch {
    /* ignore */
  }
  return 'library';
}

function saveActiveModule(id: ModuleId): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
}

export function AppShell(): JSX.Element {
  const { profile } = useAuth();
  const [active, setActive] = useState<ModuleId>(() => loadActiveModule());
  const [showSettings, setShowSettings] = useState(false);
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showBackup, setShowBackup] = useState(false);
  const [appVersion, setAppVersion] = useState('dev');
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const tr = useMemo(() => makeT(settings.language), [settings.language]);

  // Toggle theme nhanh từ topbar (light ↔ dark, skip system)
  function getEffectiveTheme(): 'light' | 'dark' {
    if (settings.theme === 'light' || settings.theme === 'dark') return settings.theme;
    // system → detect via matchMedia
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  }

  function toggleTheme(): void {
    const effective = getEffectiveTheme();
    const next = effective === 'dark' ? 'light' : 'dark';
    const updated: Settings = { ...settings, theme: next };
    saveSettings(updated);
    applyTheme(next);
    setSettings(updated);
  }

  // Sticky note: cửa sổ riêng (label='sticky') alwaysOnTop, skipTaskbar
  // → ẩn app chính vẫn nổi trên desktop, giống Windows Sticky Notes.
  async function toggleStickyWindow(): Promise<void> {
    try {
      const { Window } = await import('@tauri-apps/api/window');
      const win = await Window.getByLabel('sticky');
      if (!win) {
        console.warn('[sticky] window not found');
        return;
      }
      const visible = await win.isVisible();
      if (visible) {
        await win.hide();
      } else {
        await win.show();
        await win.setFocus();
      }
    } catch (err) {
      console.warn('[sticky] toggle fail:', err);
    }
  }

  // Listen sticky → save thành note thật trong module Ghi chú
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void (async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event');
        unlisten = await listen<{ text: string }>(
          'sticky:save-to-note',
          async (event) => {
            const { requestCreateNoteAbout } = await import('./lib/module-bus.js');
            const text = event.payload?.text?.trim();
            if (!text) return;
            // First line làm title (max 60 chars), còn lại làm body
            const firstLine = text.split(/\r?\n/)[0] ?? '';
            const title =
              firstLine.length > 0
                ? firstLine.slice(0, 60)
                : `Ghi nhanh ${new Date().toLocaleString('vi-VN')}`;
            const body = text;
            const escaped = body
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/\n/g, '<br>');
            requestCreateNoteAbout({
              title,
              content_html: `<p>${escaped}</p>`,
              category: 'personal',
              tags: ['ghi-nhanh'],
            });
          },
        );
      } catch (err) {
        console.warn('[sticky-listener] init fail:', err);
      }
    })();
    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  useEffect(() => {
    saveActiveModule(active);
  }, [active]);

  useEffect(() => {
    void invoke<string>('app_version')
      .then(setAppVersion)
      .catch(() => {});
    applyTheme(settings.theme);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Phase 18.4.b — Listen for cross-module switch requests from any module
  useEffect(() => {
    function onSwitch(e: Event): void {
      const target = (e as CustomEvent<ModuleId>).detail;
      if (target === 'library' || target === 'note' || target === 'document' || target === 'image') {
        setActive(target);
      }
    }
    window.addEventListener('trishlibrary:switch-module', onSwitch);
    return () => window.removeEventListener('trishlibrary:switch-module', onSwitch);
  }, []);

  // Re-apply theme khi user đổi
  useEffect(() => {
    applyTheme(settings.theme);
  }, [settings.theme]);

  // Phase 18.4.e — Auto-backup periodic checker. Chạy mỗi 5 phút,
  // hàm runAutoBackupIfDue tự check enabled + interval before doing work.
  useEffect(() => {
    const uid = profile?.id ?? null;
    function tick(): void {
      void runAutoBackupIfDue(uid, appVersion).then((res) => {
        if (res.ran) {
          console.log('[auto-backup] saved →', res.path);
        }
      });
    }
    // Run once on mount (app start)
    tick();
    const id = window.setInterval(tick, 5 * 60 * 1000);
    return () => window.clearInterval(id);
  }, [profile?.id, appVersion]);

  // Global keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      const ctrl = e.ctrlKey || e.metaKey;
      if (!ctrl) return;

      // Ctrl+K — global search — fire kể cả khi đang gõ trong input
      // (luôn ưu tiên search hơn ô input hiện tại)
      if (e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        setShowGlobalSearch((v) => !v);
        return;
      }

      // Ctrl+/ — keyboard shortcuts help (Ctrl+? on US keyboard)
      if (e.key === '/' || e.key === '?') {
        e.preventDefault();
        setShowShortcuts((v) => !v);
        return;
      }

      // Ctrl+Shift+N — sticky note quick capture (always available)
      if ((e.key === 'N' || e.key === 'n') && e.shiftKey) {
        e.preventDefault();
        void toggleStickyWindow();
        return;
      }

      const target = e.target as HTMLElement | null;
      const inField =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable === true;
      if (inField) return;
      if (e.key === '1') {
        e.preventDefault();
        setActive('library');
      } else if (e.key === '2') {
        e.preventDefault();
        setActive('note');
      } else if (e.key === '3') {
        e.preventDefault();
        setActive('document');
      } else if (e.key === '4') {
        e.preventDefault();
        setActive('image');
      } else if (e.key === ',') {
        e.preventDefault();
        setShowSettings((v) => !v);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="app-shell">
      <nav className="module-nav">
        <div className="module-nav-brand">
          <img src={logoUrl} alt="TrishLibrary" className="module-nav-logo" />
          <strong>TrishLibrary</strong>
          <span className="module-nav-version">v1.0</span>
        </div>
        <div className="module-nav-tabs">
          {MODULE_DEFS.map((m) => (
            <button
              key={m.id}
              type="button"
              className={`module-nav-tab ${active === m.id ? 'active' : ''}`}
              onClick={() => setActive(m.id)}
              title={m.shortcut}
            >
              <span className="module-nav-icon">{m.icon}</span>
              <span className="module-nav-label">{tr(m.labelKey)}</span>
            </button>
          ))}
        </div>
        <div className="module-nav-spacer" />

        <div className="module-nav-actions">
          <button
            type="button"
            className="module-nav-search-btn"
            onClick={() => setShowGlobalSearch(true)}
            title={tr('shortcut.global_search') + ' (Ctrl+K)'}
          >
            🔍 <span style={{ fontSize: 12 }}>Tìm</span>{' '}
            <kbd className="module-nav-kbd">Ctrl+K</kbd>
          </button>
          <UserPanel trKey={tr} />
          <button
            type="button"
            className="module-nav-icon"
            onClick={() => void toggleStickyWindow()}
            title="Ghi nhanh — cửa sổ riêng nổi trên desktop (Ctrl+Shift+N)"
          >
            🗒
          </button>
          <button
            type="button"
            className="module-nav-icon"
            onClick={() => setShowBackup(true)}
            title="Sao lưu / Khôi phục dữ liệu"
          >
            💾
          </button>
          <button
            type="button"
            className="module-nav-icon"
            onClick={() => setShowShortcuts(true)}
            title="Phím tắt (Ctrl+/)"
          >
            ⌨
          </button>
          <button
            type="button"
            className="module-nav-icon"
            onClick={toggleTheme}
            title={
              getEffectiveTheme() === 'dark'
                ? 'Chuyển sang giao diện sáng'
                : 'Chuyển sang giao diện tối'
            }
          >
            {getEffectiveTheme() === 'dark' ? '☀' : '🌙'}
          </button>
          <button
            type="button"
            className="module-nav-icon"
            onClick={() => setShowSettings(true)}
            title="Cài đặt (Ctrl+,)"
          >
            ⚙
          </button>
        </div>
      </nav>

      <main className="module-content">
        {active === 'library' && <LibraryModule />}
        {active === 'note' && <NoteModule tr={tr} />}
        {active === 'document' && <DocumentModule tr={tr} />}
        {active === 'image' && <ImageModule tr={tr} />}
        {active === 'trishteam' && <TrishteamModule />}
      </main>

      {showSettings && (
        <AppSettingsModal
          appVersion={appVersion}
          initial={settings}
          onClose={() => setShowSettings(false)}
          onSettingsChange={setSettings}
        />
      )}

      {showGlobalSearch && (
        <GlobalSearchModal
          tr={tr}
          onClose={() => setShowGlobalSearch(false)}
          onSwitchModule={(m) => setActive(m)}
        />
      )}

      {showShortcuts && (
        <ShortcutsHelpModal onClose={() => setShowShortcuts(false)} />
      )}

      {showBackup && (
        <BackupModal
          uid={profile?.id ?? null}
          appVersion={appVersion}
          onClose={() => setShowBackup(false)}
        />
      )}

      {/* Sticky note: cửa sổ Tauri riêng (label='sticky'), không render in main */}
    </div>
  );
}
