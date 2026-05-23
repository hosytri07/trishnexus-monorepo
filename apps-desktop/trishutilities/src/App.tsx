/**
 * TrishUtilities - root App component.
 *
 * 5 modules: Clean, Check, Drive (Cloud Telegram), Font, Shortcut.
 * Tat ca logic migrate sang sub-waves 44.4.x sau.
 */

import { useState } from 'react';
import {
  AppShell,
  loadActiveModule,
  type ModuleDef,
} from '@trishteam/design-system';
import { AuthGate, UserMenu } from '@trishteam/auth/react';
import { CleanModule } from './modules/clean/CleanModule.js';
import { CheckModule } from './modules/check/CheckModule.js';
import { DriveModule } from './modules/drive/DriveModule.js';
import { FontModule } from './modules/font/FontModule.js';
import { ShortcutModule } from './modules/shortcut/ShortcutModule.js';

type UtilModuleId = 'clean' | 'check' | 'drive' | 'font' | 'shortcut';

const MODULES: ReadonlyArray<ModuleDef<UtilModuleId>> = [
  { id: 'clean',    icon: 'DD', label: 'Dọn dẹp',     shortcut: 'Ctrl+1' },
  { id: 'check',    icon: 'KT', label: 'Kiểm tra máy',    shortcut: 'Ctrl+2' },
  { id: 'drive',    icon: 'CL', label: 'Cloud',       shortcut: 'Ctrl+3' },
  { id: 'font',     icon: 'FN', label: 'Font',        shortcut: 'Ctrl+4' },
  { id: 'shortcut', icon: 'SC', label: 'Shortcut',    shortcut: 'Ctrl+5' },
];

export function App(): JSX.Element {
  const [active, setActive] = useState<UtilModuleId>(() =>
    loadActiveModule('utilities', 'clean'),
  );

  return (
    <AuthGate
      appId="trishutilities"
      appShellId="utilities"
      appName="TrishUtilities"
      appTagline="Tiện ích · Cloud · Font"
    >
      <AppShell
        appId="utilities"
        version="2.0.0"
        modules={MODULES}
        active={active}
        onActiveChange={setActive}
        topbarRight={<UserMenu />}
      >
        {active === 'clean' && <CleanModule />}
        {active === 'check' && <CheckModule />}
        {active === 'drive' && <DriveModule />}
        {active === 'font' && <FontModule />}
        {active === 'shortcut' && <ShortcutModule />}
      </AppShell>
    </AuthGate>
  );
}
