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

import { useState } from 'react';
import {
  AppShell,
  loadActiveModule,
  type ModuleDef,
} from '@trishteam/design-system';
import { AuthGate, UserMenu } from '@trishteam/auth/react';
import { DesignModule } from './modules/design/DesignModule.js';
import { LibraryModule } from './modules/library/LibraryModule.js';
import { IsoModule } from './modules/iso/IsoModule.js';

type WorkModuleId = 'design' | 'library' | 'iso';

const MODULES: ReadonlyArray<ModuleDef<WorkModuleId>> = [
  { id: 'design',  icon: 'TK', label: 'Thiết kế',  shortcut: 'Ctrl+1' },
  { id: 'library', icon: 'TV', label: 'Thư viện',  shortcut: 'Ctrl+2' },
  { id: 'iso',     icon: 'HS', label: 'Hồ sơ ISO', shortcut: 'Ctrl+3' },
];

export function App(): JSX.Element {
  const [active, setActive] = useState<WorkModuleId>(() =>
    loadActiveModule('work', 'design'),
  );

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
        topbarRight={<UserMenu />}
      >
        {active === 'design' && <DesignModule />}
        {active === 'library' && <LibraryModule />}
        {active === 'iso' && <IsoModule />}
      </AppShell>
    </AuthGate>
  );
}
