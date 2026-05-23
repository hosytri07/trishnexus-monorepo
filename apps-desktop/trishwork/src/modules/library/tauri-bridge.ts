/**
 * Phase 15.2.r — TrishLibrary tauri-bridge v2.
 * Bỏ pickAndScan + import/export complex; chỉ giữ load/save + version + opener + update check.
 */

import { invoke } from '@tauri-apps/api/core';
import { save as saveDialog, open as openDialog } from '@tauri-apps/plugin-dialog';
import { openPath, openUrl } from '@tauri-apps/plugin-opener';
import type {
  LibraryFile,
  OnlineFolder,
  ScanLibrarySummary,
} from './types.js';

export interface StoreLocation {
  path: string;
  exists: boolean;
  size_bytes: number;
}

export interface LoadResult {
  path: string;
  files: LibraryFile[];
  online_folders: OnlineFolder[];
  trishteam_folders: OnlineFolder[];
  size_bytes: number;
  created_empty: boolean;
}

export interface SaveResult {
  path: string;
  size_bytes: number;
}

interface RawLoadResult {
  path: string;
  content: string;
  size_bytes: number;
  created_empty: boolean;
}

function isInTauri(): boolean {
  return (
    typeof window !== 'undefined' &&
    // @ts-expect-error — __TAURI_INTERNALS__ injected at runtime
    typeof window.__TAURI_INTERNALS__ !== 'undefined'
  );
}

// In-memory store cho dev fallback (chạy `pnpm dev` trên browser)
let DEV_FALLBACK_STORE: {
  files: LibraryFile[];
  online_folders: OnlineFolder[];
  trishteam_folders: OnlineFolder[];
} = {
  files: [],
  online_folders: [],
  trishteam_folders: [],
};

export async function getDefaultStoreLocation(): Promise<StoreLocation> {
  if (!isInTauri()) {
    return {
      path: '(browser dev — chạy trong bộ nhớ)',
      exists: true,
      size_bytes: 0,
    };
  }
  return invoke<StoreLocation>('default_store_location');
}

/**
 * Phase 16.2.d — Per-UID library file để 2 user trên cùng máy không share.
 * Pass `uid` thay path → Rust auto map thành `library.{uid}.json` trong default dir.
 */
export function libraryFilenameForUid(uid: string | null): string | null {
  if (!uid) return null;
  // Sanitize UID — chỉ alphanumeric (Firebase UID đã là alphanumeric).
  const safe = uid.replace(/[^a-zA-Z0-9]/g, '');
  if (!safe) return null;
  return `library.${safe}.json`;
}

export async function loadLibrary(path?: string | null): Promise<LoadResult> {
  if (!isInTauri()) {
    await new Promise((r) => setTimeout(r, 60));
    return {
      path: '(browser dev)',
      files: [...DEV_FALLBACK_STORE.files],
      online_folders: [...DEV_FALLBACK_STORE.online_folders],
      trishteam_folders: [...DEV_FALLBACK_STORE.trishteam_folders],
      size_bytes: JSON.stringify(DEV_FALLBACK_STORE).length,
      created_empty: DEV_FALLBACK_STORE.files.length === 0,
    };
  }
  const raw = await invoke<RawLoadResult>('load_library', { path: path ?? null });
  let files: LibraryFile[] = [];
  let online_folders: OnlineFolder[] = [];
  let trishteam_folders: OnlineFolder[] = [];
  try {
    const parsed = JSON.parse(raw.content);
    if (Array.isArray(parsed)) {
      files = parsed as LibraryFile[];
    } else if (parsed && typeof parsed === 'object') {
      files = Array.isArray(parsed.files) ? (parsed.files as LibraryFile[]) : [];
      online_folders = Array.isArray(parsed.online_folders)
        ? (parsed.online_folders as OnlineFolder[])
        : [];
      trishteam_folders = Array.isArray(parsed.trishteam_folders)
        ? (parsed.trishteam_folders as OnlineFolder[])
        : [];
    }
  } catch {
    files = [];
  }
  return {
    path: raw.path,
    files,
    online_folders,
    trishteam_folders,
    size_bytes: raw.size_bytes,
    created_empty: raw.created_empty,
  };
}

export async function saveLibrary(
  files: LibraryFile[],
  online_folders: OnlineFolder[],
  trishteam_folders: OnlineFolder[],
  path?: string | null,
): Promise<SaveResult> {
  const payload = {
    schema_version: 2,
    files,
    online_folders,
    trishteam_folders,
  };
  const content = JSON.stringify(payload);
  if (!isInTauri()) {
    DEV_FALLBACK_STORE = {
      files: [...files],
      online_folders: [...online_folders],
      trishteam_folders: [...trishteam_folders],
    };
    return {
      path: '(browser dev — không thực sự ghi file)',
      size_bytes: content.length,
    };
  }
  return invoke<SaveResult>('save_library', {
    path: path ?? null,
    content,
  });
}

/** Export library JSON ra file user chọn (backup). */
export async function exportLibraryJson(
  files: LibraryFile[],
  online_folders: OnlineFolder[],
  trishteam_folders: OnlineFolder[],
): Promise<SaveResult | null> {
  const payload = { schema_version: 2, files, online_folders, trishteam_folders };
  if (!isInTauri()) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'trishlibrary-export.json';
    a.click();
    URL.revokeObjectURL(url);
    return { path: 'trishlibrary-export.json', size_bytes: blob.size };
  }
  const picked = await saveDialog({
    defaultPath: 'trishlibrary-export.json',
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (typeof picked !== 'string') return null;
  return saveLibrary(files, online_folders, trishteam_folders, picked);
}

/** Import library JSON từ file user chọn — replace toàn bộ. */
export async function importLibraryJson(): Promise<{
  files: LibraryFile[];
  online_folders: OnlineFolder[];
  trishteam_folders: OnlineFolder[];
} | null> {
  if (!isInTauri()) {
    alert('Import chỉ hoạt động trong bản desktop.');
    return null;
  }
  const picked = await openDialog({
    multiple: false,
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (typeof picked !== 'string') return null;
  const result = await loadLibrary(picked);
  return {
    files: result.files,
    online_folders: result.online_folders,
    trishteam_folders: result.trishteam_folders,
  };
}

/**
 * Phase 15.2.r8 — Pick folder dialog → call Rust scan_library.
 * Trả null nếu user cancel dialog.
 */
export async function pickLibraryRoot(): Promise<string | null> {
  if (!isInTauri()) {
    alert('Chọn folder chỉ hoạt động trong bản desktop.');
    return null;
  }
  const picked = await openDialog({ directory: true, multiple: false });
  return typeof picked === 'string' ? picked : null;
}

export async function scanLibraryRoot(
  root: string,
): Promise<ScanLibrarySummary> {
  if (!isInTauri()) {
    return {
      root,
      entries: [],
      total_files_visited: 0,
      elapsed_ms: 0,
      errors: [],
      max_entries_reached: false,
    };
  }
  return invoke<ScanLibrarySummary>('scan_library', { dir: root });
}

/** Mở URL trong browser default (dùng cho click link tải). */
export async function openLink(url: string): Promise<void> {
  if (!isInTauri()) {
    window.open(url, '_blank', 'noopener');
    return;
  }
  try {
    await openUrl(url);
  } catch (err) {
    console.warn('[trishlibrary] openUrl fail:', err);
  }
}

/** Mở 1 path local (chưa dùng v1 vì không scan local file). */
export async function openLocalPath(path: string): Promise<void> {
  if (!isInTauri()) return;
  await openPath(path);
}

// ============================================================
// Phase 15.2.f — App version + Update check
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
    const trishlibrary = json.apps?.find((a) => a.id === 'trishlibrary');
    if (!trishlibrary) return fallback;
    return {
      current: currentVersion,
      latest: trishlibrary.version,
      hasUpdate: trishlibrary.version !== currentVersion,
      downloadUrl: trishlibrary.download?.windows_x64?.url ?? '',
      changelogUrl: trishlibrary.changelog_url ?? '',
    };
  } catch (err) {
    console.warn('[trishlibrary] checkForUpdate fail:', err);
    return fallback;
  }
}
