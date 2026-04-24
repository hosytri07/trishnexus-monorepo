import { invoke } from '@tauri-apps/api/core';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { openPath } from '@tauri-apps/plugin-opener';
import type { FulltextDoc } from '@trishteam/core/fulltext';
import type { LibraryDoc } from '@trishteam/core/library';
import type { Note } from '@trishteam/core/notes';
import { collectFulltextDocs } from '@trishteam/core/fulltext';

export interface EnvLocation {
  data_dir: string;
  exists: boolean;
}

export interface ScannedTextFile {
  path: string;
  name: string;
  ext: string;
  size_bytes: number;
  mtime_ms: number | null;
  content: string;
  truncated: boolean;
}

export interface ScanTextSummary {
  root: string;
  files: ScannedTextFile[];
  total_files_visited: number;
  elapsed_ms: number;
  errors: string[];
  max_entries_reached: boolean;
}

interface JsonLoadResult {
  path: string;
  content: string;
  size_bytes: number;
}

export interface LoadedCorpus {
  notes: Note[];
  libraryDocs: LibraryDoc[];
  files: ScannedTextFile[];
  sources: {
    notesPath: string | null;
    libraryPath: string | null;
    folderRoot: string | null;
  };
  notesSize: number;
  libraryDocsSize: number;
  filesScanned: number;
  filesErrors: string[];
}

function isInTauri(): boolean {
  return (
    typeof window !== 'undefined' &&
    // @ts-expect-error — __TAURI_INTERNALS__ injected at runtime
    typeof window.__TAURI_INTERNALS__ !== 'undefined'
  );
}

/** --------------------------------------------------------------------
 *  DEV FALLBACK — mix 3 nguồn để test UI trong browser.
 *  -------------------------------------------------------------------- */
const NOW_FAKE = Date.UTC(2026, 3, 24, 9, 0);
const DAY = 86_400_000;

const DEV_NOTES: Note[] = [
  {
    id: 'n-001',
    title: 'React hook pattern',
    body: 'useState, useEffect, useMemo — AND kết hợp với custom hook để encapsulate logic. react hook là xương sống của function component.',
    tags: ['react', 'code'],
    createdAt: NOW_FAKE - 3 * DAY,
    updatedAt: NOW_FAKE - 1 * DAY,
    deletedAt: null,
    status: 'active',
  },
  {
    id: 'n-002',
    title: 'TCVN 5574 — Bê tông cốt thép',
    body: 'Ghi nhanh khi đọc chương 3 về tính toán cốt chịu lực. Ô nhiễm tiếng ồn không áp dụng ở đây. Vietnamese diacritics như "đỗ" "nở" "độ nở".',
    tags: ['xây dựng', 'tcvn'],
    createdAt: NOW_FAKE - 10 * DAY,
    updatedAt: NOW_FAKE - 5 * DAY,
    deletedAt: null,
    status: 'active',
  },
  {
    id: 'n-003',
    title: 'Deprecated ghi chú cũ',
    body: 'Chỉ để test soft delete',
    tags: [],
    createdAt: NOW_FAKE - 50 * DAY,
    updatedAt: NOW_FAKE - 40 * DAY,
    deletedAt: NOW_FAKE - 20 * DAY,
  },
];

const DEV_LIBRARY: LibraryDoc[] = [
  {
    id: 'l-001',
    path: '/dev/library/react-handbook.pdf',
    name: 'react-handbook.pdf',
    ext: 'pdf',
    format: 'pdf',
    sizeBytes: 1_800_000,
    mtimeMs: NOW_FAKE - 30 * DAY,
    title: 'The React Handbook',
    authors: ['Flavio Copes'],
    year: 2021,
    publisher: 'Self-published',
    tags: ['code', 'javascript'],
    status: 'done',
    note: 'Xong 2 lần đọc; cần ghi lại các hook pattern.',
    addedAt: NOW_FAKE - 40 * DAY,
    updatedAt: NOW_FAKE - 30 * DAY,
  },
  {
    id: 'l-002',
    path: '/dev/library/ieee_semantic.pdf',
    name: 'ieee_semantic.pdf',
    ext: 'pdf',
    format: 'pdf',
    sizeBytes: 600_000,
    mtimeMs: NOW_FAKE - 10 * DAY,
    title: 'A Survey on Semantic Retrieval',
    authors: ['Alice Johnson', 'Bob Lee'],
    year: 2023,
    publisher: 'IEEE',
    tags: ['nghiên cứu', 'code'],
    status: 'unread',
    note: 'Dùng BM25 làm baseline rerank.',
    addedAt: NOW_FAKE - 12 * DAY,
    updatedAt: NOW_FAKE - 10 * DAY,
  },
];

const DEV_FILES: ScannedTextFile[] = [
  {
    path: '/dev/notes/readme.md',
    name: 'readme.md',
    ext: 'md',
    size_bytes: 420,
    mtime_ms: NOW_FAKE - 2 * DAY,
    content:
      '# Dự án TrishSearch\n\nFull-text search xuyên notes + library + file rời với BM25. Chạy local, không cần server.',
    truncated: false,
  },
  {
    path: '/dev/notes/changelog.txt',
    name: 'changelog.txt',
    ext: 'txt',
    size_bytes: 240,
    mtime_ms: NOW_FAKE - 7 * DAY,
    content:
      'v2.0.0-alpha.1 — first cut of BM25 engine in pure TS. Rust backend chỉ lo file-IO an toàn.',
    truncated: false,
  },
];

/** Dev fallback: FulltextDoc sẵn sàng cho index (đã qua adapter). */
export const DEV_FALLBACK_DOCS: FulltextDoc[] = collectFulltextDocs({
  notes: DEV_NOTES,
  libraryDocs: DEV_LIBRARY,
  files: DEV_FILES.map((f) => ({
    path: f.path,
    content: f.content,
    mtimeMs: f.mtime_ms ?? NOW_FAKE,
  })),
});

/** --------------------------------------------------------------------
 *  Tauri commands.
 *  -------------------------------------------------------------------- */

export async function getDefaultStoreLocation(): Promise<EnvLocation> {
  if (!isInTauri()) {
    return { data_dir: '(browser dev — chạy trong bộ nhớ)', exists: true };
  }
  return invoke<EnvLocation>('default_store_location');
}

export async function pickNotesFile(): Promise<Note[] | null> {
  if (!isInTauri()) {
    await new Promise((r) => setTimeout(r, 60));
    return DEV_NOTES;
  }
  const picked = await openDialog({
    multiple: false,
    filters: [{ name: 'TrishNote JSON', extensions: ['json'] }],
  });
  if (typeof picked !== 'string') return null;
  const raw = await invoke<JsonLoadResult>('load_json_file', { path: picked });
  try {
    const parsed = JSON.parse(raw.content);
    if (!Array.isArray(parsed)) return [];
    return parsed as Note[];
  } catch {
    return [];
  }
}

export async function pickLibraryFile(): Promise<LibraryDoc[] | null> {
  if (!isInTauri()) {
    await new Promise((r) => setTimeout(r, 60));
    return DEV_LIBRARY;
  }
  const picked = await openDialog({
    multiple: false,
    filters: [{ name: 'TrishLibrary JSON', extensions: ['json'] }],
  });
  if (typeof picked !== 'string') return null;
  const raw = await invoke<JsonLoadResult>('load_json_file', { path: picked });
  try {
    const parsed = JSON.parse(raw.content);
    if (!Array.isArray(parsed)) return [];
    return parsed as LibraryDoc[];
  } catch {
    return [];
  }
}

export async function pickAndScanTextFolder(): Promise<ScanTextSummary | null> {
  if (!isInTauri()) {
    await new Promise((r) => setTimeout(r, 80));
    return {
      root: '(browser dev)',
      files: DEV_FILES,
      total_files_visited: DEV_FILES.length,
      elapsed_ms: 3,
      errors: [],
      max_entries_reached: false,
    };
  }
  const picked = await openDialog({ directory: true, multiple: false });
  if (typeof picked !== 'string') return null;
  return invoke<ScanTextSummary>('scan_text_folder', { dir: picked });
}

export async function openByPath(path: string): Promise<void> {
  if (!isInTauri()) {
    alert('Mở file bằng app mặc định chỉ hoạt động trong bản desktop.');
    return;
  }
  await openPath(path);
}
