/**
 * TrishWork - root App component.
 *
 * Layout:
 *   <AuthGate appId="trishwork"
      appShellId="work">  -> chua login / chua co quyen -> chan
 *     <AppShell appId="work" modules=[...]>
 *       {active === 'design' && <DesignModule />}
 *       {active === 'library' && <LibraryModule />}
 *       {active === 'iso' && <IsoModule />}
 *     </AppShell>
 *   </AuthGate>
 *
 * Module logic se duoc migrate tu cac app cu o cac wave 44.3.* sau:
 *   - 44.3.1: Migrate trishdesign -> modules/design
 *   - 44.3.2: Migrate trishlibrary -> modules/library
 *   - 44.3.3: Migrate trishiso -> modules/iso
 */

import { useEffect, useState } from 'react';
import {
  AppShell,
  applyTheme,
  loadActiveModule,
  loadTheme,
  type ModuleDef,
} from '@trishteam/design-system';
import { AuthGate, AppTopbar } from '@trishteam/auth/react';
import { WorkSettingsModal } from './components/WorkSettingsModal.js';
import { DesignModule } from './modules/design/DesignModule.js';
import { LibraryModule } from './modules/library/LibraryModule.js';
import { IsoModule } from './modules/iso/IsoModule.js';

type WorkModuleId = 'design' | 'library' | 'iso';

const MODULES: ReadonlyArray<ModuleDef<WorkModuleId>> = [
  { id: 'design',  icon: '', label: 'Khảo sát - Thiết kế', shortcut: 'Ctrl+1' },
  { id: 'library', icon: '', label: 'Thư viện',            shortcut: 'Ctrl+2' },
  { id: 'iso',     icon: '', label: 'ISO',                 shortcut: 'Ctrl+3' },
];

const THEME_KEY = 'trishwork.theme';

export function App(): JSX.Element {
  const [active, setActive] = useState<WorkModuleId>(() =>
    loadActiveModule('work', 'design'),
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

  useEffect(() => {
    applyTheme(theme, THEME_KEY);
  }, [theme]);

  return (
    <AuthGate
      appId="trishwork"
      appShellId="work"
      appName="TrishWork"
      appTagline="Kỹ sư · Thư viện · ISO"
    >
      <AppShell
        appId="work"
        version="2.0.0"
        modules={MODULES}
        active={active}
        onActiveChange={setActive}
        topbarRight={
          <AppTopbar
            theme={theme}
            onThemeToggle={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
            onSettings={() => setShowSettings(true)}
          />
        }
      >
        {active === 'design' && <DesignModule />}
        {active === 'library' && <LibraryModule />}
        {active === 'iso' && <IsoModule />}
      </AppShell>
      {showSettings && (
        <WorkSettingsModal
          version="2.0.0"
          theme={theme}
          onThemeChange={setTheme}
          onClose={() => setShowSettings(false)}
        />
      )}
    </AuthGate>
  );
}
