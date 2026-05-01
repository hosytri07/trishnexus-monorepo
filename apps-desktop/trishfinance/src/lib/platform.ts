/**
 * Platform abstraction — Phase 27.1.A.
 *
 * TrishFinance chạy được cả Tauri 2 desktop lẫn PWA browser.
 * Module này wrapper các Tauri-specific API. Khi build web mode,
 * Vite tree-shake bỏ các dynamic imports nên bundle web không kéo
 * theo `@tauri-apps/*` packages.
 *
 * Usage:
 *   import { isTauri, invoke, openUrl, getAppVersion } from './lib/platform';
 *
 *   const version = await getAppVersion();   // '1.0.0' or '1.0.0-web'
 *   await openUrl('https://...');             // shell open or window.open
 */

export function isTauri(): boolean {
  if (typeof window === 'undefined') return false;
  return '__TAURI_INTERNALS__' in window || '__TAURI__' in window;
}

/**
 * Invoke Tauri command. Trả fallback nếu chạy ở web.
 *
 * Built-in fallbacks:
 * - 'app_version' → '1.0.0-web'
 *
 * Mọi command khác sẽ throw để app catch + handle.
 */
export async function invoke<T = unknown>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauri()) {
    if (cmd === 'app_version') return ('1.0.0-web' as unknown) as T;
    throw new Error(`[platform] Tauri command "${cmd}" not available on web`);
  }
  const tauri = await import('@tauri-apps/api/core');
  return tauri.invoke<T>(cmd, args);
}

/** Mở URL — shell.open trong Tauri, window.open trên web. */
export async function openUrl(url: string): Promise<void> {
  if (!isTauri()) {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }
  const opener = await import('@tauri-apps/plugin-opener');
  await opener.openUrl(url);
}

/** Lấy app version. Trên web trả '1.0.0-web'. */
export async function getAppVersion(): Promise<string> {
  try {
    return await invoke<string>('app_version');
  } catch {
    return '1.0.0-web';
  }
}

// ==========================================================
// Updater wrapper (chỉ desktop)
// ==========================================================
export interface UpdateCheckResult {
  available: boolean;
  version?: string;
  body?: string;
}

export async function checkForUpdate(): Promise<UpdateCheckResult> {
  if (!isTauri()) {
    return { available: false };
  }
  try {
    const { check } = await import('@tauri-apps/plugin-updater');
    const update = await check();
    if (update) {
      return { available: true, version: update.version, body: update.body };
    }
    return { available: false };
  } catch (e) {
    console.warn('[platform] checkForUpdate failed:', e);
    return { available: false };
  }
}

export async function downloadAndInstallUpdate(onProgress?: (loaded: number, total: number) => void): Promise<void> {
  if (!isTauri()) {
    throw new Error('Auto-update chỉ có trên bản desktop. Bản web sẽ tự cập nhật khi reload.');
  }
  const { check } = await import('@tauri-apps/plugin-updater');
  const update = await check();
  if (!update) throw new Error('Không có bản cập nhật mới');
  let downloaded = 0;
  let contentLength = 0;
  await update.downloadAndInstall((event) => {
    if (event.event === 'Started') {
      contentLength = event.data.contentLength ?? 0;
    } else if (event.event === 'Progress') {
      downloaded += event.data.chunkLength;
      onProgress?.(downloaded, contentLength);
    }
  });
}

export async function relaunchApp(): Promise<void> {
  if (!isTauri()) {
    location.reload();
    return;
  }
  const { relaunch } = await import('@tauri-apps/plugin-process');
  await relaunch();
}

/** Tên platform để hiển thị (label nhỏ ở đâu đó). */
export function platformLabel(): string {
  return isTauri() ? 'Desktop' : 'Web';
}
