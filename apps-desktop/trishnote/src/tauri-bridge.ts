import { invoke } from '@tauri-apps/api/core';
import { save as saveDialog, open as openDialog } from '@tauri-apps/plugin-dialog';
import type { Note } from '@trishteam/core/notes';

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
    // Malformed JSON — frontend xử lý bằng cách reset về []. Backend
    // đã validate khi save nên tình huống này chỉ xảy ra nếu user sửa
    // tay hoặc store bị corrupt.
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
