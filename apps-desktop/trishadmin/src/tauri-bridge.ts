/**
 * Phase 18.7.a — TrishAdmin Tauri bridge.
 *
 * Wraps Rust commands. Khi không trong Tauri (dev browser), dùng fallback
 * để app vẫn render UI cho debug (chỉ chức năng IO là disabled).
 */

import { invoke } from '@tauri-apps/api/core';
import { open as openDialog, save as saveDialog } from '@tauri-apps/plugin-dialog';

export function isInTauri(): boolean {
  return (
    typeof window !== 'undefined' &&
    // @ts-expect-error
    typeof window.__TAURI_INTERNALS__ !== 'undefined'
  );
}

export async function getAppVersion(): Promise<string> {
  if (!isInTauri()) return 'dev';
  try {
    return await invoke<string>('app_version');
  } catch {
    return 'dev';
  }
}

export interface DataDirInfo {
  dataDir: string;
}

export async function getDefaultDataDir(): Promise<DataDirInfo | null> {
  if (!isInTauri()) return null;
  try {
    return await invoke<DataDirInfo>('default_data_dir');
  } catch (err) {
    console.warn('default_data_dir fail:', err);
    return null;
  }
}

export async function readTextFile(path: string): Promise<string> {
  if (!isInTauri()) {
    throw new Error('readTextFile chỉ dùng trong Tauri');
  }
  return invoke<string>('read_text_file', { path });
}

export async function writeTextFile(path: string, content: string): Promise<void> {
  if (!isInTauri()) {
    throw new Error('writeTextFile chỉ dùng trong Tauri');
  }
  await invoke<void>('write_text_file', { path, content });
}

export async function checkPathExists(path: string): Promise<boolean> {
  if (!isInTauri()) return false;
  try {
    return await invoke<boolean>('check_path_exists', { path });
  } catch {
    return false;
  }
}

export async function pickJsonFile(title: string): Promise<string | null> {
  if (!isInTauri()) return null;
  const picked = await openDialog({
    multiple: false,
    filters: [{ name: 'JSON', extensions: ['json'] }],
    title,
  });
  return typeof picked === 'string' ? picked : null;
}

export async function pickSavePath(
  defaultName: string,
  ext: string,
): Promise<string | null> {
  if (!isInTauri()) return null;
  const picked = await saveDialog({
    defaultPath: defaultName,
    filters: [{ name: ext.toUpperCase(), extensions: [ext] }],
  });
  return typeof picked === 'string' ? picked : null;
}
