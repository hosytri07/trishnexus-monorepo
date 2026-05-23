/**
 * Tauri command bridge — Phase 32.3 + 32.4.
 */

import { invoke, convertFileSrc } from '@tauri-apps/api/core';

export function isInTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/**
 * Phase 32.3.B — chuyển absolute file path → asset:// URL để hiển thị `<img>`.
 * Gọi convertFileSrc của Tauri 2 (yêu cầu assetProtocol enabled trong tauri.conf).
 */
export function iconUrl(filePath: string | null | undefined): string | null {
  if (!filePath) return null;
  if (!isInTauri()) return null;
  return convertFileSrc(filePath);
}

export async function getAppVersion(): Promise<string> {
  if (!isInTauri()) return 'web';
  try {
    return await invoke<string>('app_version');
  } catch {
    return 'unknown';
  }
}

// ============================================================
// Scanner — Phase 32.3
// ============================================================

export interface DesktopEntry {
  name: string;
  sourcePath: string;     // .lnk hoặc .exe gốc
  target: string | null;  // resolved target nếu .lnk
  args: string | null;
  workingDir: string | null;
  iconLocation: string | null;
  kind: 'lnk' | 'exe';
}

export interface InstalledApp {
  name: string;
  publisher: string | null;
  version: string | null;
  installLocation: string | null;
  uninstallString: string | null;
  iconPath: string | null;
}

export async function scanDesktop(): Promise<DesktopEntry[]> {
  if (!isInTauri()) return [];
  return await invoke<DesktopEntry[]>('scan_desktop');
}

export async function scanStartMenu(): Promise<DesktopEntry[]> {
  if (!isInTauri()) return [];
  return await invoke<DesktopEntry[]>('scan_start_menu');
}

export async function scanInstalledApps(): Promise<InstalledApp[]> {
  if (!isInTauri()) return [];
  return await invoke<InstalledApp[]>('scan_installed_apps');
}

export interface LnkParsed {
  target: string;
  args: string;
  workingDir: string;
  iconPath: string | null;
  description: string | null;
}

export async function parseLnk(lnkPath: string): Promise<LnkParsed> {
  if (!isInTauri()) throw new Error('Tauri only');
  return await invoke<LnkParsed>('parse_lnk', { lnkPath });
}

// ============================================================
// Launch — Phase 32.4
// ============================================================

export interface LaunchOptions {
  type: string;
  target: string;
  args?: string;
  workingDir?: string;
  runAsAdmin?: boolean;
}

export async function launchShortcut(opts: LaunchOptions): Promise<void> {
  if (!isInTauri()) {
    console.warn('[shortcut] launch ngoài Tauri không hỗ trợ');
    return;
  }
  await invoke('launch_shortcut', { opts });
}

export async function openInExplorer(path: string): Promise<void> {
  if (!isInTauri()) return;
  await invoke('open_in_explorer', { path });
}

// ============================================================
// Icon extraction — Phase 32.3.B
// ============================================================

export async function extractIconFromExe(exePath: string): Promise<string | null> {
  if (!isInTauri()) return null;
  if (!exePath) return null;
  try {
    return await invoke<string>('extract_icon_from_exe', { exePath });
  } catch (e) {
    console.warn(`[icon] extract fail for ${exePath}:`, e);
    return null;
  }
}

export async function fetchFavicon(url: string): Promise<string | null> {
  if (!isInTauri()) return null;
  // Phase sau: implement bằng reqwest fetch + cache
  console.warn('[favicon] chưa implement, url:', url);
  return null;
}

/**
 * Phase 32.3.B — Batch extract icons cho nhiều shortcut song song.
 * Dùng Promise.allSettled để 1 fail không cancel rest.
 * Return: map<target, iconPath | null>
 */
export async function extractIconsBatch(
  exePaths: string[],
): Promise<Map<string, string | null>> {
  const results = new Map<string, string | null>();
  const promises = exePaths.map(async (p) => {
    const r = await extractIconFromExe(p);
    results.set(p, r);
  });
  await Promise.allSettled(promises);
  return results;
}
