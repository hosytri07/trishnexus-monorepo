/**
 * Typed wrapper quanh Tauri 2 invoke() + opener plugin.
 *
 * Tách file này để UI không phải import `@tauri-apps/api/core` khắp
 * nơi, và cho phép mock trong test (sau này thêm vitest cho launcher).
 *
 * Graceful degradation: khi chạy `pnpm dev` thuần trong browser
 * (không có Tauri runtime), invoke sẽ throw → wrapper trả fallback
 * để UI vẫn render được (dev nhanh UI mà không cần start Tauri).
 */
import { invoke } from '@tauri-apps/api/core';
import { openUrl } from '@tauri-apps/plugin-opener';
import type { InstallDetection, InstallProbe } from './install-types.js';

export interface SysInfo {
  os: string;
  os_version: string;
  arch: string;
  cpu_count: number;
  total_memory_bytes: number;
  hostname: string;
}

export const FALLBACK_SYS_INFO: SysInfo = {
  os: 'browser-dev',
  os_version: '0',
  arch: 'unknown',
  cpu_count: 0,
  total_memory_bytes: 0,
  hostname: 'dev',
};

function isInTauri(): boolean {
  return (
    typeof window !== 'undefined' &&
    // @ts-expect-error — Tauri injects __TAURI_INTERNALS__ ở runtime.
    typeof window.__TAURI_INTERNALS__ !== 'undefined'
  );
}

export async function getSysInfo(): Promise<SysInfo> {
  if (!isInTauri()) return FALLBACK_SYS_INFO;
  try {
    return await invoke<SysInfo>('sys_info');
  } catch (err) {
    console.warn('[trishlauncher] sys_info failed:', err);
    return FALLBACK_SYS_INFO;
  }
}

export async function getAppVersion(): Promise<string> {
  if (!isInTauri()) return 'dev';
  try {
    return await invoke<string>('app_version');
  } catch {
    return 'dev';
  }
}

export async function openExternal(url: string): Promise<void> {
  if (!isInTauri()) {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }
  await openUrl(url);
}

// ============================================================
// Phase 14.5.5.c — Launch detection
// ============================================================

/**
 * Probe candidate paths cho mỗi app. Trong browser dev mode không có
 * Tauri → trả `not_installed` cho tất cả (state hoàn toàn client-side
 * UI, không ảnh hưởng logic Rust).
 */
export async function detectInstall(
  probes: InstallProbe[],
): Promise<InstallDetection[]> {
  if (!isInTauri()) {
    return probes.map((p) => ({
      id: p.id,
      state: 'not_installed',
      path: null,
    }));
  }
  try {
    return await invoke<InstallDetection[]>('detect_install', { probes });
  } catch (err) {
    console.warn('[trishlauncher] detect_install failed:', err);
    return probes.map((p) => ({
      id: p.id,
      state: 'not_installed',
      path: null,
    }));
  }
}

/**
 * Launch app đã detect. `path` phải là resolved path từ `detectInstall`
 * (Rust check exists() trước khi spawn). Throw khi fail để UI hiện
 * toast / fallback.
 */
export async function launchPath(path: string): Promise<void> {
  if (!isInTauri()) {
    console.warn('[trishlauncher] launchPath no-op in browser dev:', path);
    return;
  }
  await invoke<string>('launch_path', { path });
}

// ============================================================
// Phase 14.5.5.d — System tray quick-launch
// ============================================================

/**
 * 1 item cho submenu tray Quick-launch. `id` để phân biệt khi user click
 * menu, `label` hiển thị (giữ Tiếng Việt OK), `path` là resolved path từ
 * detectInstall (chỉ gửi khi state = 'installed' + path non-null).
 */
export interface QuickLaunchItem {
  id: string;
  label: string;
  path: string;
}

/**
 * Gọi sau khi detectInstall xong để rebuild tray menu. Rust sẽ giữ list
 * trong state + set lại menu của tray 'main'. Browser dev: no-op để không
 * warn khi chạy `vite dev` thuần.
 */
export async function updateTrayQuickLaunch(
  items: QuickLaunchItem[],
): Promise<void> {
  if (!isInTauri()) return;
  try {
    await invoke<void>('update_tray_quick_launch', { items });
  } catch (err) {
    console.warn('[trishlauncher] update_tray_quick_launch failed:', err);
  }
}
