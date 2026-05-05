/**
 * Phase 37.3 — KeyGate wrapper Tauri-specific cho TrishLibrary.
 *
 * Logic chung dùng `<KeyGate>` từ @trishteam/auth/react.
 * File này chỉ inject Tauri command `get_device_id` và app metadata.
 */
import { invoke } from '@tauri-apps/api/core';
import { KeyGate as KeyGateGeneric } from '@trishteam/auth/react';
import type { ReactNode } from 'react';

const APP_ID = 'trishlibrary';
const APP_NAME = 'TrishLibrary';

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
