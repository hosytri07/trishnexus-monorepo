/**
 * TrishUtilities - root App component.
 *
 * 5 modules: Clean, Check, Drive (Downloader), Font, Shortcut.
 *
 * Wave 73.3 — Tab switching performance:
 *   1. React.lazy() từng module → code-split per module, giảm initial bundle.
 *   2. Keep-mounted strategy: module đã activate sẽ giữ trong DOM (display:none),
 *      switch lần 2+ là instant — state preserved, không refetch.
 *   3. <Suspense fallback> chỉ hiện lần đầu lazy-load.
 */

import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import {
  AppShell,
  applyTheme,
  loadActiveModule,
  loadTheme,
  NotificationCenter,
  type ModuleDef,
} from '@trishteam/design-system';
import { AuthGate, AppTopbar, useAuth } from '@trishteam/auth/react';
import { getFirebaseDb } from '@trishteam/auth';
import { UtilitiesSettingsModal } from './components/UtilitiesSettingsModal.js';
// Phase 78.13 — Background scheduler runner
import { useScheduledTasksRunner } from './lib/scheduled-tasks/runner.js';

// Wave 73.3 — Lazy-load modules. Mỗi module thành chunk riêng.
const CleanModule = lazy(() =>
  import('./modules/clean/CleanModule.js').then((m) => ({ default: m.CleanModule })),
);
const CheckModule = lazy(() =>
  import('./modules/check/CheckModule.js').then((m) => ({ default: m.CheckModule })),
);
const DriveModule = lazy(() =>
  import('./modules/drive/DriveModule.js').then((m) => ({ default: m.DriveModule })),
);
const FontModule = lazy(() =>
  import('./modules/font/FontModule.js').then((m) => ({ default: m.FontModule })),
);
const ShortcutModule = lazy(() =>
  import('./modules/shortcut/ShortcutModule.js').then((m) => ({ default: m.ShortcutModule })),
);

type UtilModuleId = 'clean' | 'check' | 'drive' | 'font' | 'shortcut';

const MODULES: ReadonlyArray<ModuleDef<UtilModuleId>> = [
  { id: 'clean',    icon: '', label: 'Dọn dẹp',      shortcut: 'Ctrl+1' },
  { id: 'check',    icon: '', label: 'Kiểm tra máy', shortcut: 'Ctrl+2' },
  { id: 'drive',    icon: '', label: 'Downloader',   shortcut: 'Ctrl+3' },
  { id: 'font',     icon: '', label: 'Font',         shortcut: 'Ctrl+4' },
  { id: 'shortcut', icon: '', label: 'Shortcut',     shortcut: 'Ctrl+5' },
];

const THEME_KEY = 'trishutilities.theme';

function ModuleLoading(): JSX.Element {
  return (
    <div className="module-content" style={{ padding: 32, textAlign: 'center' }}>
      <div className="muted small">⟳ Đang tải module...</div>
    </div>
  );
}

/** Inner shell — phải nằm trong AuthGate để useAuth (qua runner hook) hoạt động. */
function AppShellInner(): JSX.Element {
  // Mỗi phút check tasks tới hạn của user hiện tại, chạy nếu deviceId khớp.
  useScheduledTasksRunner();
  return <></>;
}

/** Wrapper Bell trong AuthGate — đọc uid từ useAuth, pass db + uid xuống NotificationCenter. */
function TopbarBell(): JSX.Element {
  const { firebaseUser } = useAuth();
  return (
    <NotificationCenter
      db={getFirebaseDb()}
      currentUid={firebaseUser?.uid ?? null}
      appHint="utilities"
    />
  );
}

export function App(): JSX.Element {
  const [active, setActive] = useState<UtilModuleId>(() =>
    loadActiveModule('utilities', 'clean'),
  );
  // Sync DOM ngay tại initializer để click đầu không bị "set lại cùng giá trị"
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const t = loadTheme(THEME_KEY);
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', t);
    }
    return t;
  });
  const [showSettings, setShowSettings] = useState(false);

  // Wave 73.3 — Keep-mounted set: module đã từng active thì giữ trong DOM.
  // Switch lần 2 là instant (display:none ↔ block) — state + scroll + fetch
  // được giữ nguyên, không phải refetch sysinfo/font packs/etc.
  const [activated, setActivated] = useState<Set<UtilModuleId>>(
    () => new Set([active]),
  );

  useEffect(() => {
    applyTheme(theme, THEME_KEY);
  }, [theme]);

  useEffect(() => {
    setActivated((prev) => {
      if (prev.has(active)) return prev;
      const next = new Set(prev);
      next.add(active);
      return next;
    });
  }, [active]);

  // Memoize topbarRight để theme/settings toggle không re-render AppShell
  const topbarRight = useMemo(
    () => (
      <AppTopbar
        extras={<TopbarBell />}
        theme={theme}
        onThemeToggle={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
        onSettings={() => setShowSettings(true)}
      />
    ),
    [theme],
  );

  return (
    <AuthGate
      appId="trishutilities"
      appShellId="utilities"
      appName="TrishUtilities"
      appTagline="Tiện ích · Downloader · Font"
    >
      <AppShellInner />
      <AppShell
        appId="utilities"
        version="1.0.0"
        modules={MODULES}
        active={active}
        onActiveChange={setActive}
        topbarRight={topbarRight}
      >
        <Suspense fallback={<ModuleLoading />}>
          {activated.has('clean') && (
            <div style={{ display: active === 'clean' ? 'contents' : 'none' }}>
              <CleanModule />
            </div>
          )}
          {activated.has('check') && (
            <div style={{ display: active === 'check' ? 'contents' : 'none' }}>
              <CheckModule />
            </div>
          )}
          {activated.has('drive') && (
            <div style={{ display: active === 'drive' ? 'contents' : 'none' }}>
              <DriveModule />
            </div>
          )}
          {activated.has('font') && (
            <div style={{ display: active === 'font' ? 'contents' : 'none' }}>
              <FontModule />
            </div>
          )}
          {activated.has('shortcut') && (
            <div style={{ display: active === 'shortcut' ? 'contents' : 'none' }}>
              <ShortcutModule />
            </div>
          )}
        </Suspense>
      </AppShell>
      {showSettings && (
        <UtilitiesSettingsModal
          version="1.0.0"
          theme={theme}
          onThemeChange={setTheme}
          onClose={() => setShowSettings(false)}
        />
      )}
    </AuthGate>
  );
}
