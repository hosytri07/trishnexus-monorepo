/**
 * Bridge giữa React UI và 3 Tauri commands. Khi chạy dev trong browser,
 * dùng in-memory stub để UI vẫn test được (không cần Tauri).
 */

import { invoke } from '@tauri-apps/api/core';
import { open as openDialog, save as saveDialog } from '@tauri-apps/plugin-dialog';
import { openPath } from '@tauri-apps/plugin-opener';
import type { DesignTokenSet } from '@trishteam/core/design';
import { suggestPalette } from '@trishteam/core/design';

export interface EnvLocation {
  data_dir: string;
  exists: boolean;
}

export interface DesignLoadResult {
  path: string;
  bytes: number;
  text: string;
  validJson: boolean;
}

export interface DesignSaveResult {
  path: string;
  bytes: number;
}

function isInTauri(): boolean {
  return (
    typeof window !== 'undefined' &&
    // @ts-expect-error — __TAURI_INTERNALS__ injected at runtime
    typeof window.__TAURI_INTERNALS__ !== 'undefined'
  );
}

/** Dev fallback: palette mẫu để UI browser có gì mà render. */
export const DEV_FALLBACK_SET: DesignTokenSet = suggestPalette(
  '#7C3AED',
  'light',
  'Palette mẫu',
).set;

export async function getDefaultStoreLocation(): Promise<EnvLocation> {
  if (!isInTauri()) {
    return { data_dir: '(browser dev — chạy trong bộ nhớ)', exists: true };
  }
  return invoke<EnvLocation>('default_store_location');
}

export async function pickAndLoadDesignFile(): Promise<DesignTokenSet | null> {
  if (!isInTauri()) {
    await new Promise((r) => setTimeout(r, 60));
    return DEV_FALLBACK_SET;
  }
  const selected = await openDialog({
    multiple: false,
    filters: [{ name: 'Design token JSON', extensions: ['json'] }],
  });
  if (!selected || typeof selected !== 'string') return null;
  const result = await invoke<DesignLoadResult>('load_design_file', {
    path: selected,
  });
  if (!result.validJson) {
    throw new Error(`File ${result.path} không phải JSON hợp lệ.`);
  }
  try {
    return JSON.parse(result.text) as DesignTokenSet;
  } catch (err) {
    throw new Error(`Parse JSON thất bại: ${(err as Error).message}`);
  }
}

export async function saveDesignFile(
  set: DesignTokenSet,
  suggestedName = 'palette.json',
): Promise<DesignSaveResult | null> {
  const payload = JSON.stringify(set, null, 2);
  if (!isInTauri()) {
    await new Promise((r) => setTimeout(r, 30));
    return {
      path: `(dev) ${suggestedName}`,
      bytes: payload.length,
    };
  }
  const dest = await saveDialog({
    defaultPath: suggestedName,
    filters: [{ name: 'Design token JSON', extensions: ['json'] }],
  });
  if (!dest) return null;
  return invoke<DesignSaveResult>('save_design_file', {
    path: dest,
    payload,
  });
}

export async function revealFile(path: string): Promise<void> {
  if (!isInTauri()) {
    console.log('[dev] reveal', path);
    return;
  }
  await openPath(path);
}

/** Copy text vào clipboard (ưu tiên navigator.clipboard, fallback textarea). */
export async function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.top = '-9999px';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  try {
    document.execCommand('copy');
  } finally {
    document.body.removeChild(ta);
  }
}
