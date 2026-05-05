/**
 * Phase 37.3 — KeyGate wrapper standalone cho TrishShortcut.
 * App KHÔNG cần login, chỉ cần activate key 1 lần bind máy.
 */
import { invoke } from '@tauri-apps/api/core';
import { KeyGate as KeyGateGeneric } from '@trishteam/auth/react';
import type { ReactNode } from 'react';

const APP_ID = 'trishshortcut';
const APP_NAME = 'TrishShortcut';

async function getMachineId(): Promise<string> {
  return invoke<string>('get_device_id');
}

export function KeyGate({ children }: { children: ReactNode }): JSX.Element {
  return (
    <KeyGateGeneric
      appId={APP_ID}
      appName={APP_NAME}
      keyType="standalone"
      getMachineId={getMachineId}
    >
      {children}
    </KeyGateGeneric>
  );
}
