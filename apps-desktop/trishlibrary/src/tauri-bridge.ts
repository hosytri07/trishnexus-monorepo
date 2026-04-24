import { invoke } from '@tauri-apps/api/core';
import { save as saveDialog, open as openDialog } from '@tauri-apps/plugin-dialog';
import { openPath } from '@tauri-apps/plugin-opener';
import type { LibraryDoc, RawLibraryEntry } from '@trishteam/core/library';
import { enrichRaw } from '@trishteam/core/library';

export interface StoreLocation {
  path: string;
  exists: boolean;
  size_bytes: number;
}

export interface LoadResult {
  path: string;
  docs: LibraryDoc[];
  size_bytes: number;
  created_empty: boolean;
}

export interface SaveResult {
  path: string;
  size_bytes: number;
}

export interface ScanSummary {
  root: string;
  entries: RawLibraryEntry[];
  total_files_visited: number;
  elapsed_ms: number;
  errors: string[];
  max_entries_reached: boolean;
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
 * Dev fallback: 6 doc mẫu phủ đủ format + status + chủ đề VN/EN,
 * để test UI trong browser mà không cần Tauri runtime.
 */
const NOW_FAKE = Date.UTC(2026, 3, 24, 9, 0);
const DAY = 86_400_000;

function seed(
  rawName: string,
  ext: string,
  sizeKb: number,
  title: string,
  authors: string[],
  year: number | null,
  publisher: string | null,
  tags: string[],
  status: LibraryDoc['status'],
  addedDaysAgo: number,
): LibraryDoc {
  const raw: RawLibraryEntry = {
    path: '/dev/library/' + rawName,
    name: rawName,
    ext,
    size_bytes: sizeKb * 1024,
    mtime_ms: NOW_FAKE - addedDaysAgo * DAY,
  };
  const base = enrichRaw(raw, NOW_FAKE - addedDaysAgo * DAY);
  return { ...base, title, authors, year, publisher, tags, status };
}

export const DEV_FALLBACK_DOCS: LibraryDoc[] = [
  seed(
    'tcvn_5574_2018.pdf',
    'pdf',
    2_400,
    'TCVN 5574:2018 — Thiết kế kết cấu bê tông cốt thép',
    ['Bộ Xây dựng'],
    2018,
    'NXB Xây dựng',
    ['tcvn', 'xây dựng', 'tiếng việt'],
    'reading',
    3,
  ),
  seed(
    'react-handbook.pdf',
    'pdf',
    1_800,
    'The React Handbook',
    ['Flavio Copes'],
    2021,
    'Self-published',
    ['code', 'javascript'],
    'done',
    30,
  ),
  seed(
    'typescript_patterns.epub',
    'epub',
    900,
    'TypeScript Design Patterns',
    ['Vilic Vane'],
    2022,
    'Packt',
    ['code', 'sách'],
    'unread',
    1,
  ),
  seed(
    'ghi_chu_xay_dung.md',
    'md',
    12,
    'Ghi chú khảo sát công trình',
    ['Trí'],
    null,
    null,
    ['ghi chú', 'tiếng việt'],
    'reading',
    5,
  ),
  seed(
    'luan_van_ThS.docx',
    'docx',
    1_200,
    'Luận văn Thạc sĩ — Ứng xử kết cấu thép chịu lửa',
    ['Nguyễn Văn A'],
    2020,
    'ĐH Bách khoa',
    ['nghiên cứu', 'tiếng việt'],
    'abandoned',
    120,
  ),
  seed(
    'ieee_paper_2023.pdf',
    'pdf',
    600,
    'A Survey on Semantic Retrieval',
    ['Alice Johnson', 'Bob Lee'],
    2023,
    'IEEE',
    ['nghiên cứu', 'code'],
    'unread',
    10,
  ),
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

export async function loadLibrary(path?: string | null): Promise<LoadResult> {
  if (!isInTauri()) {
    await new Promise((r) => setTimeout(r, 80));
    return {
      path: '(browser dev — chạy trong bộ nhớ)',
      docs: [...DEV_FALLBACK_DOCS],
      size_bytes: JSON.stringify(DEV_FALLBACK_DOCS).length,
      created_empty: false,
    };
  }
  const raw = await invoke<RawLoadResult>('load_library', { path: path ?? null });
  let docs: LibraryDoc[] = [];
  try {
    const parsed = JSON.parse(raw.content);
    if (Array.isArray(parsed)) docs = parsed as LibraryDoc[];
  } catch {
    docs = [];
  }
  return {
    path: raw.path,
    docs,
    size_bytes: raw.size_bytes,
    created_empty: raw.created_empty,
  };
}

export async function saveLibrary(
  docs: LibraryDoc[],
  path?: string | null,
): Promise<SaveResult> {
  const content = JSON.stringify(docs);
  if (!isInTauri()) {
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

/**
 * Pick folder rồi gọi scan_library Rust. Trả về raw entries — UI/core
 * sẽ enrich + merge với docs đang có.
 */
export async function pickAndScan(): Promise<ScanSummary | null> {
  if (!isInTauri()) {
    await new Promise((r) => setTimeout(r, 100));
    return {
      root: '(browser dev)',
      entries: DEV_FALLBACK_DOCS.map((d) => ({
        path: d.path,
        name: d.name,
        ext: d.ext,
        size_bytes: d.sizeBytes,
        mtime_ms: d.mtimeMs,
      })),
      total_files_visited: DEV_FALLBACK_DOCS.length,
      elapsed_ms: 4,
      errors: [],
      max_entries_reached: false,
    };
  }
  const picked = await openDialog({ directory: true, multiple: false });
  if (typeof picked !== 'string') return null;
  return invoke<ScanSummary>('scan_library', { dir: picked });
}

export async function exportLibraryAs(
  docs: LibraryDoc[],
): Promise<SaveResult | null> {
  if (!isInTauri()) {
    const blob = new Blob([JSON.stringify(docs, null, 2)], {
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
  return saveLibrary(docs, picked);
}

export async function importLibraryFrom(): Promise<LibraryDoc[] | null> {
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
  return result.docs;
}

export async function openDocument(path: string): Promise<void> {
  if (!isInTauri()) {
    alert('Mở file bằng app mặc định chỉ hoạt động trong bản desktop.');
    return;
  }
  await openPath(path);
}
