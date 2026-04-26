/**
 * Phase 17.3 Layer 1 — TrishSearch tauri-bridge.
 *
 * Wraps Rust commands cho:
 *  - Search location management (add/remove/rename/list)
 *  - Index location (background scan + extract text content)
 *  - Search filename + content với filters
 *  - Open file / open containing folder
 *  - App version + update check
 */

import { invoke } from '@tauri-apps/api/core';
import { open as openDialog } from '@tauri-apps/plugin-dialog';

export interface EnvLocation {
  data_dir: string;
  exists: boolean;
}

export type LocationKind = 'local' | 'lan';

export interface SearchLocation {
  id: string;
  name: string;
  path: string;
  kind: LocationKind;
  last_indexed_at: number;
  indexed_files: number;
  indexed_bytes: number;
}

export interface IndexedFile {
  location_id: string;
  path: string;
  name: string;
  ext: string;
  size_bytes: number;
  mtime_ms: number;
  content: string;
  content_truncated: boolean;
  has_content: boolean;
}

export interface PreScanResult {
  total_files: number;
  total_bytes: number;
  indexable_files: number;
  elapsed_ms: number;
  limit_reached: boolean;
}

export interface IndexResult {
  location_id: string;
  indexed_files: number;
  skipped_files: number;
  errors: string[];
  total_bytes: number;
  elapsed_ms: number;
  limit_reached: boolean;
}

export type SearchMode = 'name' | 'content' | 'both';

export interface SearchQuery {
  query: string;
  mode: SearchMode;
  extensions: string[];
  modified_after_ms: number;
  modified_before_ms: number;
  min_size_bytes: number;
  max_size_bytes: number;
  location_ids: string[];
  limit: number;
}

export interface SearchHit {
  file: IndexedFile;
  score: number;
  snippet: string;
  match_in: 'name' | 'content' | 'both' | 'browse';
}

export interface SearchResponse {
  hits: SearchHit[];
  total_indexed: number;
  elapsed_ms: number;
}

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
    return { data_dir: '(browser dev — chạy trong bộ nhớ)', exists: true };
  }
  return invoke<EnvLocation>('default_store_location');
}

// ============================================================
// Search Locations
// ============================================================

export async function listLocations(): Promise<SearchLocation[]> {
  if (!isInTauri()) return [];
  return invoke<SearchLocation[]>('list_locations');
}

/** User pick folder qua dialog hoặc nhập UNC path tay → add. */
export async function addLocation(
  path: string,
  name?: string,
): Promise<SearchLocation> {
  if (!isInTauri()) {
    throw new Error('Add location chỉ hoạt động trong bản desktop.');
  }
  return invoke<SearchLocation>('add_location', { path, name: name ?? null });
}

export async function removeLocation(locationId: string): Promise<void> {
  if (!isInTauri()) return;
  await invoke<void>('remove_location', { locationId });
}

export async function renameLocation(locationId: string, name: string): Promise<void> {
  if (!isInTauri()) return;
  await invoke<void>('rename_location', { locationId, name });
}

/** Picker chọn thư mục local. UNC path nhập tay qua textbox riêng. */
export async function pickLocalFolder(): Promise<string | null> {
  if (!isInTauri()) {
    return prompt('Nhập đường dẫn folder (browser dev):');
  }
  const picked = await openDialog({ directory: true, multiple: false });
  return typeof picked === 'string' ? picked : null;
}

// ============================================================
// Indexing
// ============================================================

export async function preScanLocation(path: string): Promise<PreScanResult> {
  if (!isInTauri()) {
    return {
      total_files: 0,
      total_bytes: 0,
      indexable_files: 0,
      elapsed_ms: 0,
      limit_reached: false,
    };
  }
  return invoke<PreScanResult>('pre_scan_location', { path });
}

export async function indexLocation(locationId: string): Promise<IndexResult> {
  if (!isInTauri()) {
    return {
      location_id: locationId,
      indexed_files: 0,
      skipped_files: 0,
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

export const DEFAULT_SEARCH_QUERY: SearchQuery = {
  query: '',
  mode: 'both',
  extensions: [],
  modified_after_ms: 0,
  modified_before_ms: 0,
  min_size_bytes: 0,
  max_size_bytes: 0,
  location_ids: [],
  limit: 200,
};

export async function searchFiles(q: SearchQuery): Promise<SearchResponse> {
  if (!isInTauri()) {
    return { hits: [], total_indexed: 0, elapsed_ms: 0 };
  }
  return invoke<SearchResponse>('search', { q });
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
// Layer 3 — OCR commands (frontend Tesseract.js + PDF.js)
// ============================================================

export interface OcrStatus {
  enabled: boolean;
  languages: string;
}

export async function getOcrStatus(): Promise<OcrStatus> {
  if (!isInTauri()) {
    return { enabled: false, languages: 'vie+eng' };
  }
  return invoke<OcrStatus>('get_ocr_status');
}

export async function setOcrSettings(
  enabled: boolean,
  languages: string,
): Promise<void> {
  if (!isInTauri()) return;
  await invoke<void>('set_ocr_settings', { enabled, languages });
}

/** Đọc bytes của file để feed vào Tesseract.js / PDF.js. */
export async function readFileBytes(path: string): Promise<Uint8Array> {
  if (!isInTauri()) {
    throw new Error('Read file bytes chỉ chạy trong desktop.');
  }
  // Tauri serialize Vec<u8> → number[] trong JS, convert lại Uint8Array
  const arr = await invoke<number[]>('read_file_bytes', { path });
  return Uint8Array.from(arr);
}

/** Update content của file đã index sau khi OCR xong. */
export async function updateFileOcr(
  path: string,
  content: string,
): Promise<void> {
  if (!isInTauri()) return;
  await invoke<void>('update_file_ocr', { path, content });
}

/** List tất cả file PDF/ảnh chưa có content (candidate cho bulk OCR). */
export async function listOcrCandidates(): Promise<IndexedFile[]> {
  if (!isInTauri()) return [];
  return invoke<IndexedFile[]>('list_ocr_candidates');
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
    const me = json.apps?.find((a) => a.id === 'trishsearch');
    if (!me) return fallback;
    return {
      current: currentVersion,
      latest: me.version,
      hasUpdate: me.version !== currentVersion,
      downloadUrl: me.download?.windows_x64?.url ?? '',
      changelogUrl: me.changelog_url ?? '',
    };
  } catch (err) {
    console.warn('[trishsearch] checkForUpdate fail:', err);
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
