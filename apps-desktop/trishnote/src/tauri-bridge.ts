import { invoke } from '@tauri-apps/api/core';
import { save as saveDialog, open as openDialog } from '@tauri-apps/plugin-dialog';
import { openUrl, openPath } from '@tauri-apps/plugin-opener';
import type { Note } from '@trishteam/core/notes';
import { migrateStore, type StoreV2, type NoteV2 } from './types.js';

/**
 * Phase 17.2 — Per-UID notes file để 2 user trên cùng máy không share.
 * Pass `uid` thay path → Rust auto map thành `notes.{uid}.json` trong default dir.
 */
export function notesFilenameForUid(uid: string | null): string | null {
  if (!uid) return null;
  const safe = uid.replace(/[^a-zA-Z0-9]/g, '');
  if (!safe) return null;
  return `notes.${safe}.json`;
}

export async function openExternal(url: string): Promise<void> {
  try {
    await openUrl(url);
  } catch (err) {
    console.warn('[trishnote] openUrl fail:', err);
  }
}

export async function getAppVersion(): Promise<string> {
  try {
    return await invoke<string>('app_version');
  } catch {
    return 'dev';
  }
}

/**
 * Phase 17.2 v4 — Liệt kê font đã cài trên Windows (fallback web-safe ngoài Tauri).
 * Rust scan C:\Windows\Fonts + per-user fonts dir, derive family name từ filename.
 */
const WEB_SAFE_FONTS: string[] = [
  'Arial',
  'Calibri',
  'Cambria',
  'Consolas',
  'Courier New',
  'Georgia',
  'Segoe UI',
  'Tahoma',
  'Times New Roman',
  'Verdana',
];

export async function listSystemFonts(): Promise<string[]> {
  if (!isInTauri()) {
    return WEB_SAFE_FONTS;
  }
  try {
    return await invoke<string[]>('list_system_fonts');
  } catch (err) {
    console.warn('[trishnote] list_system_fonts fail:', err);
    return WEB_SAFE_FONTS;
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
    const me = json.apps?.find((a) => a.id === 'trishnote');
    if (!me) return fallback;
    return {
      current: currentVersion,
      latest: me.version,
      hasUpdate: me.version !== currentVersion,
      downloadUrl: me.download?.windows_x64?.url ?? '',
      changelogUrl: me.changelog_url ?? '',
    };
  } catch (err) {
    console.warn('[trishnote] checkForUpdate fail:', err);
    return fallback;
  }
}

export interface StoreLocation {
  path: string;
  exists: boolean;
  size_bytes: number;
}

export interface LoadResult {
  path: string;
  notes: Note[];
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

/**
 * Dev fallback: 5 note mẫu phủ 4 status + 2 mức review age (stale/overdue).
 */
const NOW_FAKE = Date.UTC(2026, 3, 24, 9, 0);
const DAY = 86_400_000;

function fakeNote(
  id: string,
  title: string,
  body: string,
  status: Note['status'],
  daysAgoCreated: number,
  daysAgoReviewed: number | null,
  tags: string[] = [],
): Note {
  return {
    id,
    title,
    body,
    tags,
    createdAt: NOW_FAKE - daysAgoCreated * DAY,
    updatedAt: NOW_FAKE - Math.min(daysAgoCreated, daysAgoReviewed ?? 0) * DAY,
    deletedAt: null,
    status,
    lastReviewedAt: daysAgoReviewed === null ? null : NOW_FAKE - daysAgoReviewed * DAY,
    dueAt: null,
  };
}

export const DEV_FALLBACK_NOTES: Note[] = [
  fakeNote('seed-1', 'Làm roadmap Q3', 'Phase 14.4 rebuild 4 app cần auth', 'active', 2, 1, ['trishteam', 'roadmap']),
  fakeNote('seed-2', 'Email gửi khách hàng X', 'Chờ họ confirm báo giá', 'waiting', 5, 5, ['sales']),
  fakeNote('seed-3', 'Học tiếng Việt XSLT', 'Ôn lại transform rule + xpath cơ bản', 'inbox', 14, null, ['study']),
  fakeNote('seed-4', 'Fix bug login Firebase', 'Đã deploy hotfix — log ổn', 'done', 3, 3, ['bug']),
  fakeNote('seed-5', 'Ý tưởng blog post', 'So sánh Tauri vs Electron memory footprint', 'inbox', 30, 30, ['blog', 'idea']),
];

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

export async function loadNotes(path?: string | null): Promise<LoadResult> {
  if (!isInTauri()) {
    await new Promise((r) => setTimeout(r, 80));
    return {
      path: '(browser dev — chạy trong bộ nhớ)',
      notes: [...DEV_FALLBACK_NOTES],
      size_bytes: JSON.stringify(DEV_FALLBACK_NOTES).length,
      created_empty: false,
    };
  }
  const raw = await invoke<RawLoadResult>('load_notes', { path: path ?? null });
  let notes: Note[] = [];
  try {
    const parsed = JSON.parse(raw.content);
    if (Array.isArray(parsed)) notes = parsed as Note[];
  } catch {
    notes = [];
  }
  return {
    path: raw.path,
    notes,
    size_bytes: raw.size_bytes,
    created_empty: raw.created_empty,
  };
}

export async function saveNotes(
  notes: Note[],
  path?: string | null,
): Promise<SaveResult> {
  const content = JSON.stringify(notes);
  if (!isInTauri()) {
    return {
      path: '(browser dev — không thực sự ghi file)',
      size_bytes: content.length,
    };
  }
  return invoke<SaveResult>('save_notes', {
    path: path ?? null,
    content,
  });
}

// ============================================================
// Phase 17.2 — Store v2 với folders (gộp notes + folders)
// ============================================================

export interface LoadStoreResult {
  path: string;
  store: StoreV2;
  size_bytes: number;
  created_empty: boolean;
}

export async function loadStore(path?: string | null): Promise<LoadStoreResult> {
  if (!isInTauri()) {
    await new Promise((r) => setTimeout(r, 80));
    return {
      path: '(browser dev)',
      store: { schema: 2, notes: [...DEV_FALLBACK_NOTES] as NoteV2[], folders: [] },
      size_bytes: 0,
      created_empty: false,
    };
  }
  const raw = await invoke<RawLoadResult>('load_notes', { path: path ?? null });
  let store: StoreV2 = { schema: 2, notes: [], folders: [] };
  try {
    const parsed = JSON.parse(raw.content);
    store = migrateStore(parsed);
  } catch {
    /* fallback empty store */
  }
  return {
    path: raw.path,
    store,
    size_bytes: raw.size_bytes,
    created_empty: raw.created_empty,
  };
}

export async function saveStore(
  store: StoreV2,
  path?: string | null,
): Promise<SaveResult> {
  const content = JSON.stringify(store);
  if (!isInTauri()) {
    return { path: '(browser dev)', size_bytes: content.length };
  }
  return invoke<SaveResult>('save_notes', { path: path ?? null, content });
}

/** Export full store (notes + folders) ra file user pick. */
export async function exportStoreAs(store: StoreV2): Promise<SaveResult | null> {
  if (!isInTauri()) {
    const blob = new Blob([JSON.stringify(store, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'trishnote-export.json';
    a.click();
    URL.revokeObjectURL(url);
    return { path: 'trishnote-export.json', size_bytes: blob.size };
  }
  const picked = await saveDialog({
    defaultPath: 'trishnote-export.json',
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (typeof picked !== 'string') return null;
  return saveStore(store, picked);
}

// ============================================================
// Phase 17.2 v3 — Attachments + open local path
// ============================================================

export interface AttachResult {
  stored_path: string;
  size_bytes: number;
  original_name: string;
}

/** Pick file qua dialog → trả source path. */
export async function pickFileForAttach(): Promise<string | null> {
  if (!isInTauri()) {
    alert('Attach file chỉ hoạt động trong bản desktop.');
    return null;
  }
  const picked = await openDialog({ multiple: false });
  return typeof picked === 'string' ? picked : null;
}

/** Pick folder/file để gắn link (path local). */
export async function pickPathForLink(
  isDirectory = false,
): Promise<string | null> {
  if (!isInTauri()) {
    return prompt('Nhập đường dẫn (browser dev):');
  }
  const picked = await openDialog({
    directory: isDirectory,
    multiple: false,
  });
  return typeof picked === 'string' ? picked : null;
}

/** Copy file vào attachments dir của note. */
export async function attachFile(
  uid: string,
  noteId: string,
  sourcePath: string,
): Promise<AttachResult> {
  if (!isInTauri()) {
    return {
      stored_path: sourcePath,
      size_bytes: 0,
      original_name: sourcePath.split(/[\\/]/).pop() ?? 'file',
    };
  }
  return invoke<AttachResult>('attach_file', {
    uid,
    noteId,
    sourcePath,
  });
}

/** Xoá file đã attach (sanity check trong attachments dir). */
export async function removeAttachedFile(storedPath: string): Promise<void> {
  if (!isInTauri()) return;
  return invoke<void>('remove_attached_file', { storedPath });
}

/** Mở file/folder bằng app default OS. */
export async function openLocalPath(path: string): Promise<void> {
  if (!isInTauri()) {
    alert(`(dev) Mở: ${path}`);
    return;
  }
  try {
    await openPath(path);
  } catch (err) {
    console.warn('[trishnote] openPath fail:', err);
    throw err;
  }
}

export async function importStoreFrom(): Promise<StoreV2 | null> {
  if (!isInTauri()) {
    alert('Import chỉ hoạt động trong bản desktop.');
    return null;
  }
  const picked = await openDialog({
    multiple: false,
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (typeof picked !== 'string') return null;
  const result = await loadStore(picked);
  return result.store;
}

/**
 * Export ra file JSON tự chọn (user có thể dùng để backup hoặc di chuyển
 * sang máy khác). Khác save default store: người dùng pick path qua dialog.
 */
export async function exportNotesAs(notes: Note[]): Promise<SaveResult | null> {
  if (!isInTauri()) {
    // Browser dev: trigger download qua Blob.
    const blob = new Blob([JSON.stringify(notes, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'trishnote-export.json';
    a.click();
    URL.revokeObjectURL(url);
    return { path: 'trishnote-export.json', size_bytes: blob.size };
  }
  const picked = await saveDialog({
    defaultPath: 'trishnote-export.json',
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (typeof picked !== 'string') return null;
  return saveNotes(notes, picked);
}

export async function importNotesFrom(): Promise<Note[] | null> {
  if (!isInTauri()) {
    alert('Import chỉ hoạt động trong bản desktop.');
    return null;
  }
  const picked = await openDialog({
    multiple: false,
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (typeof picked !== 'string') return null;
  const result = await loadNotes(picked);
  return result.notes;
}
