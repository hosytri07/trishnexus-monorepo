/**
 * Phase 37.3 — KeyGate wrapper Tauri-specific cho TrishDrive.
 */
import { invoke } from '@tauri-apps/api/core';
import { KeyGate as KeyGateGeneric } from '@trishteam/auth/react';
import type { ReactNode } from 'react';

const APP_ID = 'trishdrive';
const APP_NAME = 'TrishDrive';

async function getMachineId(): Promise<string> {
  return invoke<string>('get_device_id');
}

export function KeyGate({ children }: { children: ReactNode }): JSX.Element {
  return (
    <KeyGateGeneric
      appId={APP_ID}
      appName={APP_NAME}
      keyType="account"
      getMachineId={getMachineId}
    >
      {children}
    </KeyGateGeneric>
  );
}
