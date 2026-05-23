/**
 * TrishClean tauri-bridge.
 *
 * Phase 17.1 — wrap Rust commands cho:
 *  - scan_dir (quét folder, đã có alpha.1)
 *  - list_clean_presets (preset paths Windows: Temp, Browser cache, ...)
 *  - move_to_trash (staged delete vào trash dir riêng)
 *  - list_trash_sessions / restore_session / purge_session / purge_old_sessions
 *  - fetch_text (HTTP GET, cho update check registry)
 */

import { invoke } from '@tauri-apps/api/core';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { openUrl } from '@tauri-apps/plugin-opener';

export interface RawEntry {
  path: string;
  size_bytes: number;
  modified_at_ms: number;
  accessed_at_ms: number;
  is_dir: boolean;
}

export interface ScanStats {
  entries: RawEntry[];
  total_size_bytes: number;
  truncated: boolean;
  elapsed_ms: number;
  errors: number;
}

export interface CleanPreset {
  id: string;
  label: string;
  description: string;
  path: string;
  exists: boolean;
  icon: string;
}

export interface TrashItem {
  original_path: string;
  trash_relative: string;
  size_bytes: number;
  is_dir: boolean;
}

export interface TrashManifest {
  session_id: string;
  label: string;
  created_at_ms: number;
  items: TrashItem[];
  total_size_bytes: number;
}

export interface MoveToTrashResult {
  session_id: string;
  session_dir: string;
  items_moved: number;
  total_size_bytes: number;
  errors: string[];
}

function isInTauri(): boolean {
  return (
    typeof window !== 'undefined' &&
    // @ts-expect-error — __TAURI_INTERNALS__ injected at runtime
    typeof window.__TAURI_INTERNALS__ !== 'undefined'
  );
}

/** Dev fallback: seed entries để test UI mà không cần Tauri runtime. */
export const DEV_FALLBACK_SCAN: ScanStats = {
  entries: [
    {
      path: '/Users/dev/.cache/huge.dat',
      size_bytes: 524_288_000,
      modified_at_ms: Date.now() - 3 * 86_400_000,
      accessed_at_ms: Date.now() - 3 * 86_400_000,
      is_dir: false,
    },
    {
      path: '/Users/dev/Downloads/installer-2024.dmg',
      size_bytes: 180_000_000,
      modified_at_ms: Date.now() - 400 * 86_400_000,
      accessed_at_ms: Date.now() - 400 * 86_400_000,
      is_dir: false,
    },
    {
      path: '/Users/dev/Documents/notes.md',
      size_bytes: 4_200,
      modified_at_ms: Date.now() - 2 * 86_400_000,
      accessed_at_ms: Date.now() - 2 * 86_400_000,
      is_dir: false,
    },
    {
      path: '/tmp/session-abc123',
      size_bytes: 12_000_000,
      modified_at_ms: Date.now() - 10 * 86_400_000,
      accessed_at_ms: Date.now() - 10 * 86_400_000,
      is_dir: false,
    },
  ],
  total_size_bytes: 524_288_000 + 180_000_000 + 4_200 + 12_000_000,
  truncated: false,
  elapsed_ms: 0,
  errors: 0,
};

export async function scanDir(
  path: string,
  opts?: { maxEntries?: number; maxDepth?: number },
): Promise<ScanStats> {
  if (!isInTauri()) return DEV_FALLBACK_SCAN;
  try {
    return await invoke<ScanStats>('scan_dir', {
      path,
      maxEntries: opts?.maxEntries,
      maxDepth: opts?.maxDepth,
    });
  } catch (err) {
    throw new Error(String(err));
  }
}

/**
 * Phase 17.1.i — Scan tìm file rác AutoCAD (.bak, .sv$, .dwl, .dwl2, .ac$, .err, .dmp)
 * trong Documents, Downloads, Desktop, AppData\Local\Autodesk, AppData\Roaming\Autodesk.
 */
export async function scanAutocadJunk(): Promise<ScanStats> {
  if (!isInTauri()) {
    return {
      entries: [
        {
          path: 'C:\\Users\\dev\\Documents\\Project\\house.bak',
          size_bytes: 4_500_000,
          modified_at_ms: Date.now() - 86_400_000,
          accessed_at_ms: Date.now() - 86_400_000,
          is_dir: false,
        },
        {
          path: 'C:\\Users\\dev\\Documents\\Project\\house.dwl',
          size_bytes: 1_200,
          modified_at_ms: Date.now() - 3_600_000,
          accessed_at_ms: Date.now() - 3_600_000,
          is_dir: false,
        },
      ],
      total_size_bytes: 4_501_200,
      truncated: false,
      elapsed_ms: 0,
      errors: 0,
    };
  }
  return invoke<ScanStats>('scan_autocad_junk');
}

export async function pickDirectory(): Promise<string | null> {
  if (!isInTauri()) return '/Users/dev (dev-mode seed)';
  const res = await openDialog({
    directory: true,
    multiple: false,
    title: 'Chọn thư mục để quét',
  });
  if (typeof res === 'string') return res;
  return null;
}

// ============================================================
// Phase 17.1.b — Quick-pick presets
// ============================================================

const DEV_FALLBACK_PRESETS: CleanPreset[] = [
  {
    id: 'windows_temp',
    label: 'Temp Windows',
    description: 'Cache phiên làm việc',
    path: 'C:\\Users\\dev\\AppData\\Local\\Temp',
    exists: true,
    icon: '🗂',
  },
  {
    id: 'chrome_cache',
    label: 'Chrome Cache',
    description: 'Cache trình duyệt Chrome',
    path: 'C:\\Users\\dev\\AppData\\Local\\Google\\Chrome\\User Data\\Default\\Cache',
    exists: true,
    icon: '🌐',
  },
];

export async function listCleanPresets(): Promise<CleanPreset[]> {
  if (!isInTauri()) return DEV_FALLBACK_PRESETS;
  try {
    return await invoke<CleanPreset[]>('list_clean_presets');
  } catch {
    return [];
  }
}

// ============================================================
// Phase 17.1.c — Staged delete + restore + purge
// ============================================================

export async function moveToTrash(
  paths: string[],
  label: string,
  cleanupRoot?: string,
): Promise<MoveToTrashResult> {
  if (!isInTauri()) {
    // Dev mock — pretend it worked
    return {
      session_id: `dev-${Date.now()}`,
      session_dir: '/dev/trash',
      items_moved: paths.length,
      total_size_bytes: 0,
      errors: [],
    };
  }
  return invoke<MoveToTrashResult>('move_to_trash', {
    paths,
    label,
    cleanupRoot: cleanupRoot ?? null,
  });
}

export async function listTrashSessions(): Promise<TrashManifest[]> {
  if (!isInTauri()) return [];
  try {
    return await invoke<TrashManifest[]>('list_trash_sessions');
  } catch {
    return [];
  }
}

export async function restoreSession(sessionId: string): Promise<number> {
  if (!isInTauri()) return 0;
  return invoke<number>('restore_session', { sessionId });
}

export async function purgeSession(sessionId: string): Promise<void> {
  if (!isInTauri()) return;
  return invoke<void>('purge_session', { sessionId });
}

export async function purgeOldSessions(retentionDays = 7): Promise<number> {
  if (!isInTauri()) return 0;
  return invoke<number>('purge_old_sessions', { retentionDays });
}

// ============================================================
// Phase 17.1.h — Disk usage
// ============================================================

export interface DiskInfo {
  mount: string;
  total_bytes: number;
  free_bytes: number;
  used_bytes: number;
  used_percent: number;
}

export async function getDiskUsage(): Promise<DiskInfo | null> {
  if (!isInTauri()) {
    return {
      mount: '/dev (mock)',
      total_bytes: 500_000_000_000,
      free_bytes: 200_000_000_000,
      used_bytes: 300_000_000_000,
      used_percent: 60,
    };
  }
  try {
    return await invoke<DiskInfo>('disk_usage');
  } catch (err) {
    console.warn('[trishclean] disk_usage fail:', err);
    return null;
  }
}

// ============================================================
// App version + Update check
// ============================================================

export async function getAppVersion(): Promise<string> {
  if (!isInTauri()) return 'dev';
  try {
    return await invoke<string>('app_version');
  } catch {
    return 'dev';
  }
}

export interface UpdateInfo {
  current: string;
  latest: string;
  hasUpdate: boolean;
  downloadUrl: string;
  changelogUrl: string;
}

export async function checkForUpdate(currentVersion: string): Promise<UpdateInfo> {
  const APPS_REGISTRY = 'https://trishteam.io.vn/apps-registry.json';
  const fallback: UpdateInfo = {
    current: currentVersion,
    latest: currentVersion,
    hasUpdate: false,
    downloadUrl: '',
    changelogUrl: '',
  };
  if (!isInTauri()) return fallback;
  try {
    const text = await invoke<string>('fetch_text', { url: APPS_REGISTRY });
    const json = JSON.parse(text) as {
      apps?: Array<{
        id: string;
        version: string;
        download?: { windows_x64?: { url: string } };
        changelog_url?: string;
      }>;
    };
    const trishclean = json.apps?.find((a) => a.id === 'trishclean');
    if (!trishclean) return fallback;
    return {
      current: currentVersion,
      latest: trishclean.version,
      hasUpdate: trishclean.version !== currentVersion,
      downloadUrl: trishclean.download?.windows_x64?.url ?? '',
      changelogUrl: trishclean.changelog_url ?? '',
    };
  } catch (err) {
    console.warn('[trishclean] checkForUpdate fail:', err);
    return fallback;
  }
}

/** Mở URL ở browser ngoài (cho changelog, download update). */
export async function openExternal(url: string): Promise<void> {
  if (!isInTauri()) {
    window.open(url, '_blank', 'noopener');
    return;
  }
  try {
    await openUrl(url);
  } catch (err) {
    console.warn('[trishclean] openUrl fail:', err);
  }
}
