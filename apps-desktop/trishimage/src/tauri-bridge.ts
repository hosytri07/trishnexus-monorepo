/**
 * Phase 17.5 — TrishImage tauri-bridge.
 *
 * Wrappers cho Rust commands:
 *  - PhotoLocation CRUD (add/remove/list/rename)
 *  - Index location (parallel + thumbnail gen)
 *  - Search photos (query + filters)
 *  - Tag CRUD per photo
 *  - Open file / open folder
 *  - Read thumbnail bytes → data URL
 *  - App version + update check
 */

import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { open as openDialog } from '@tauri-apps/plugin-dialog';

export interface EnvLocation {
  data_dir: string;
  thumbnails_dir: string;
}

export interface PhotoLocation {
  id: string;
  name: string;
  path: string;
  last_indexed_at: number;
  indexed_photos: number;
  indexed_bytes: number;
}

export interface PhotoEntry {
  location_id: string;
  path: string;
  name: string;
  ext: string;
  size_bytes: number;
  mtime_ms: number;
  taken_ms: number;
  width: number | null;
  height: number | null;
  camera: string | null;
  has_gps: boolean;
  gps_lat: number | null;
  gps_lon: number | null;
  thumb_id: string | null;
  tags: string[];
  is_video: boolean;
  note: string;
}

export interface RenameFileResult {
  old_path: string;
  new_path: string;
  new_name: string;
}

export interface IndexResult {
  location_id: string;
  indexed_photos: number;
  skipped: number;
  errors: string[];
  total_bytes: number;
  elapsed_ms: number;
  limit_reached: boolean;
}

export interface PhotoQuery {
  query: string;
  location_ids: string[];
  tags: string[];
  date_after_ms: number;
  date_before_ms: number;
  camera_filter: string;
  gps_only: boolean;
  limit: number;
}

export interface PhotoQueryResult {
  photos: PhotoEntry[];
  total_indexed: number;
  elapsed_ms: number;
}

export const DEFAULT_PHOTO_QUERY: PhotoQuery = {
  query: '',
  location_ids: [],
  tags: [],
  date_after_ms: 0,
  date_before_ms: 0,
  camera_filter: '',
  gps_only: false,
  limit: 1000,
};

function isInTauri(): boolean {
  return (
    typeof window !== 'undefined' &&
    // @ts-expect-error — __TAURI_INTERNALS__ injected at runtime
    typeof window.__TAURI_INTERNALS__ !== 'undefined'
  );
}

// ============================================================
// Env
// ============================================================

export async function getDefaultStoreLocation(): Promise<EnvLocation> {
  if (!isInTauri()) {
    return {
      data_dir: '(browser dev)',
      thumbnails_dir: '(browser dev)',
    };
  }
  return invoke<EnvLocation>('default_store_location');
}

// ============================================================
// Photo Locations
// ============================================================

export async function listLocations(): Promise<PhotoLocation[]> {
  if (!isInTauri()) return [];
  return invoke<PhotoLocation[]>('list_locations');
}

export async function addLocation(path: string, name?: string): Promise<PhotoLocation> {
  if (!isInTauri()) {
    throw new Error('Add location chỉ trong desktop.');
  }
  return invoke<PhotoLocation>('add_location', { path, name: name ?? null });
}

export async function removeLocation(locationId: string): Promise<void> {
  if (!isInTauri()) return;
  await invoke<void>('remove_location', { locationId });
}

export async function renameLocation(locationId: string, name: string): Promise<void> {
  if (!isInTauri()) return;
  await invoke<void>('rename_location', { locationId, name });
}

export async function pickLocalFolder(): Promise<string | null> {
  if (!isInTauri()) {
    return prompt('Nhập đường dẫn folder ảnh (browser dev):');
  }
  const picked = await openDialog({ directory: true, multiple: false });
  return typeof picked === 'string' ? picked : null;
}

// ============================================================
// Indexing
// ============================================================

export async function indexLocation(locationId: string): Promise<IndexResult> {
  if (!isInTauri()) {
    return {
      location_id: locationId,
      indexed_photos: 0,
      skipped: 0,
      errors: [],
      total_bytes: 0,
      elapsed_ms: 0,
      limit_reached: false,
    };
  }
  return invoke<IndexResult>('index_location', { locationId });
}

// ============================================================
// Search
// ============================================================

export async function searchPhotos(q: PhotoQuery): Promise<PhotoQueryResult> {
  if (!isInTauri()) {
    return { photos: [], total_indexed: 0, elapsed_ms: 0 };
  }
  return invoke<PhotoQueryResult>('search_photos', { q });
}

// ============================================================
// Tags
// ============================================================

export async function setPhotoTags(path: string, tags: string[]): Promise<void> {
  if (!isInTauri()) return;
  await invoke<void>('set_photo_tags', { path, tags });
}

export async function listAllTags(): Promise<string[]> {
  if (!isInTauri()) return [];
  return invoke<string[]>('list_all_tags');
}

export async function setPhotoNote(path: string, note: string): Promise<void> {
  if (!isInTauri()) return;
  await invoke<void>('set_photo_note', { path, note });
}

export async function renameFile(
  oldPath: string,
  newName: string,
): Promise<RenameFileResult> {
  if (!isInTauri()) {
    throw new Error('Đổi tên file chỉ trong desktop.');
  }
  return invoke<RenameFileResult>('rename_file', { oldPath, newName });
}

/** Convert local file path → asset:// URL cho <video> / <img> trực tiếp. */
export function fileSrcUrl(absolutePath: string): string {
  if (!isInTauri()) return absolutePath;
  return convertFileSrc(absolutePath);
}

// ============================================================
// Open
// ============================================================

export async function openFile(path: string): Promise<void> {
  if (!isInTauri()) {
    alert(`(dev) Mở: ${path}`);
    return;
  }
  await invoke<void>('open_file', { path });
}

export async function openContainingFolder(path: string): Promise<void> {
  if (!isInTauri()) {
    alert(`(dev) Mở folder chứa: ${path}`);
    return;
  }
  await invoke<void>('open_containing_folder', { path });
}

// ============================================================
// Thumbnail
// ============================================================

const thumbnailCache = new Map<string, string>();

/** Đọc thumbnail từ Rust → data URL JPEG, cache trong-memory. */
export async function getThumbnailDataUrl(thumbId: string): Promise<string | null> {
  if (!thumbId) return null;
  const cached = thumbnailCache.get(thumbId);
  if (cached) return cached;
  if (!isInTauri()) return null;
  try {
    const arr = await invoke<number[]>('read_thumbnail', { thumbId });
    const bytes = Uint8Array.from(arr);
    const blob = new Blob([bytes], { type: 'image/jpeg' });
    const url = URL.createObjectURL(blob);
    thumbnailCache.set(thumbId, url);
    return url;
  } catch (err) {
    console.warn('[trishimage] thumb fail:', err);
    return null;
  }
}

export function clearThumbnailCache(): void {
  for (const url of thumbnailCache.values()) {
    URL.revokeObjectURL(url);
  }
  thumbnailCache.clear();
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
    const me = json.apps?.find((a) => a.id === 'trishimage');
    if (!me) return fallback;
    return {
      current: currentVersion,
      latest: me.version,
      hasUpdate: me.version !== currentVersion,
      downloadUrl: me.download?.windows_x64?.url ?? '',
      changelogUrl: me.changelog_url ?? '',
    };
  } catch (err) {
    console.warn('[trishimage] checkForUpdate fail:', err);
    return fallback;
  }
}

// ============================================================
// Helpers
// ============================================================

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const gb = bytes / 1024 ** 3;
  if (gb >= 1) return `${gb.toFixed(2)} GB`;
  const mb = bytes / 1024 ** 2;
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  const kb = bytes / 1024;
  if (kb >= 1) return `${kb.toFixed(0)} KB`;
  return `${bytes} B`;
}

export function formatRelativeTime(ms: number, now: number = Date.now()): string {
  if (ms <= 0) return 'chưa bao giờ';
  const diff = now - ms;
  const sec = Math.round(diff / 1000);
  if (sec < 60) return `${sec}s trước`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} phút trước`;
  const hour = Math.round(min / 60);
  if (hour < 24) return `${hour} giờ trước`;
  const day = Math.round(hour / 24);
  if (day < 7) return `${day} ngày trước`;
  return new Date(ms).toLocaleDateString('vi-VN');
}

export function groupPhotosByMonth(photos: PhotoEntry[]): Map<string, PhotoEntry[]> {
  const map = new Map<string, PhotoEntry[]>();
  for (const p of photos) {
    const d = new Date(p.taken_ms);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const arr = map.get(key) ?? [];
    arr.push(p);
    map.set(key, arr);
  }
  return map;
}
