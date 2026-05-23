/**
 * Phase 15.2.r8 — TrishLibrary v2 domain model (scan folder edition).
 *
 * App scan recursive 1 folder thư viện do user chọn → tự nhặt tất cả
 * file PDF/DOCX/EPUB/... Mỗi file có:
 *   - Metadata từ filesystem (read-only): path, name, type, size, folder con
 *   - Metadata user nhập (editable): doc_title, links[] (multi + QR), note
 *
 * Storage: library.json local atomic. Phase 15.3 sẽ thêm Firestore sync per user.
 */

export type FileType =
  | 'pdf'
  | 'docx'
  | 'doc'
  | 'xlsx'
  | 'xls'
  | 'pptx'
  | 'ppt'
  | 'epub'
  | 'txt'
  | 'md'
  | 'html'
  | 'rtf'
  | 'odt'
  | 'zip'
  | 'rar'
  | 'mp4'
  | 'mp3'
  | 'image'
  | 'other';

export interface DownloadLink {
  id: string;
  url: string;
  label: string;
  qr_data_url: string;
}

// ============================================================
// Phase 15.2.r12 — Online Library (folders + links collection)
// ============================================================

export interface OnlineLink {
  id: string;
  url: string;
  title: string;
  description: string;
  qr_data_url: string;
  created_at: number;
  updated_at: number;
}

export interface OnlineFolder {
  id: string;
  name: string;
  /** Emoji icon, vd "📁", "▶", "☁" */
  icon: string;
  links: OnlineLink[];
  created_at: number;
  updated_at: number;
}

/** Preset icons cho folder online (emoji-based, không cần asset). */
export const ONLINE_ICON_PRESETS: Array<{ icon: string; label: string }> = [
  { icon: '📁', label: 'Folder' },
  { icon: '🌐', label: 'Web' },
  { icon: '☁', label: 'Cloud' },
  { icon: '📦', label: 'Box' },
  { icon: '▶', label: 'Video' },
  { icon: '📺', label: 'TV' },
  { icon: '📷', label: 'Photo' },
  { icon: '🎵', label: 'Music' },
  { icon: '📚', label: 'Book' },
  { icon: '📰', label: 'News' },
  { icon: '🎬', label: 'Film' },
  { icon: '💼', label: 'Work' },
  { icon: '🎓', label: 'Edu' },
  { icon: '🛠', label: 'Tool' },
  { icon: '💡', label: 'Idea' },
  { icon: '⭐', label: 'Star' },
  { icon: '🔥', label: 'Hot' },
  { icon: '📌', label: 'Pin' },
  { icon: '🎮', label: 'Game' },
  { icon: '🎨', label: 'Design' },
];

export function nextOnlineFolderId(existing: OnlineFolder[]): string {
  let max = 0;
  for (const f of existing) {
    const m = /^OF-(\d+)$/.exec(f.id);
    if (m) {
      const n = parseInt(m[1] ?? '0', 10);
      if (n > max) max = n;
    }
  }
  return `OF-${String(max + 1).padStart(4, '0')}`;
}

export function nextOnlineLinkId(existing: OnlineLink[]): string {
  let max = 0;
  for (const l of existing) {
    const m = /^OL-(\d+)$/.exec(l.id);
    if (m) {
      const n = parseInt(m[1] ?? '0', 10);
      if (n > max) max = n;
    }
  }
  return `OL-${String(max + 1).padStart(4, '0')}`;
}

export interface LibraryFile {
  /** Mã file user-friendly tự sinh — vd "LIB-0001". */
  id: string;
  /** Absolute filesystem path — KEY chính để dedup khi scan. */
  path: string;
  /** Tên file gốc (basename, từ filesystem, read-only). */
  file_name: string;
  /** Tên tài liệu user nhập (display). Default = file_name không có ext. */
  doc_title: string;
  /** Loại file (detect từ ext, read-only). */
  file_type: FileType;
  /** Size bytes (filesystem, read-only). */
  size_bytes: number;
  /** Last modified time ms (filesystem, read-only). */
  mtime_ms: number;
  /** Relative path từ library_root tới folder cha (read-only, vd "TCVN/Bê tông"). */
  folder: string;
  /** Mảng link tải user add, mỗi link tự gen QR. */
  links: DownloadLink[];
  /** Ghi chú cá nhân (max 5000 char). */
  note: string;
  created_at: number;
  updated_at: number;
}

/** Raw entry trả từ Rust scan_library — chưa enrich. */
export interface RawLibraryEntry {
  path: string;
  name: string;
  ext: string;
  size_bytes: number;
  mtime_ms: number | null;
  folder: string;
}

export interface ScanLibrarySummary {
  root: string;
  entries: RawLibraryEntry[];
  total_files_visited: number;
  elapsed_ms: number;
  errors: string[];
  max_entries_reached: boolean;
}

// ============================================================
// Helpers
// ============================================================

export function nextFileId(existing: LibraryFile[]): string {
  let maxNum = 0;
  for (const f of existing) {
    const m = /^LIB-(\d+)$/.exec(f.id);
    if (m) {
      const n = parseInt(m[1] ?? '0', 10);
      if (n > maxNum) maxNum = n;
    }
  }
  return `LIB-${String(maxNum + 1).padStart(4, '0')}`;
}

export function newLinkId(): string {
  return 'L' + Math.random().toString(36).slice(2, 10);
}

/** Strip ext khỏi filename — vd "tcvn-5574.pdf" → "tcvn-5574". */
export function stripExtension(name: string): string {
  const idx = name.lastIndexOf('.');
  if (idx <= 0) return name;
  return name.slice(0, idx);
}

export function detectFileType(extOrName: string): FileType {
  const lower = extOrName.toLowerCase();
  const ext = lower.includes('.') ? (lower.split('.').pop() ?? '') : lower;
  switch (ext) {
    case 'pdf':
      return 'pdf';
    case 'docx':
      return 'docx';
    case 'doc':
      return 'doc';
    case 'xlsx':
      return 'xlsx';
    case 'xls':
      return 'xls';
    case 'pptx':
      return 'pptx';
    case 'ppt':
      return 'ppt';
    case 'epub':
      return 'epub';
    case 'txt':
      return 'txt';
    case 'md':
    case 'markdown':
      return 'md';
    case 'html':
    case 'htm':
      return 'html';
    case 'rtf':
      return 'rtf';
    case 'odt':
      return 'odt';
    case 'zip':
    case '7z':
      return 'zip';
    case 'rar':
      return 'rar';
    case 'mp4':
    case 'mkv':
    case 'avi':
    case 'mov':
    case 'webm':
      return 'mp4';
    case 'mp3':
    case 'wav':
    case 'flac':
    case 'm4a':
    case 'ogg':
      return 'mp3';
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
    case 'webp':
    case 'svg':
      return 'image';
    default:
      return 'other';
  }
}

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(0)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

export function sanitizeText(s: string, max = 300): string {
  return s.trim().slice(0, max);
}

export function isValidUrl(url: string): boolean {
  try {
    const u = new URL(url.trim());
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

export function groupByFolder(files: LibraryFile[]): Map<string, LibraryFile[]> {
  const map = new Map<string, LibraryFile[]>();
  for (const f of files) {
    const key = f.folder.trim() || '';
    const arr = map.get(key) ?? [];
    arr.push(f);
    map.set(key, arr);
  }
  return map;
}

export function searchFiles(files: LibraryFile[], query: string): LibraryFile[] {
  const q = query.trim().toLowerCase();
  if (!q) return files;
  return files.filter((f) => {
    return (
      f.id.toLowerCase().includes(q) ||
      f.file_name.toLowerCase().includes(q) ||
      f.doc_title.toLowerCase().includes(q) ||
      f.folder.toLowerCase().includes(q) ||
      f.note.toLowerCase().includes(q)
    );
  });
}

// ============================================================
// Scan + merge (Phase 15.2.r8)
// ============================================================

/**
 * Enrich raw entry từ filesystem thành LibraryFile mới.
 * doc_title default = stripExtension(name).
 */
export function enrichRawEntry(
  raw: RawLibraryEntry,
  id: string,
  now = Date.now(),
): LibraryFile {
  return {
    id,
    path: raw.path,
    file_name: raw.name,
    doc_title: stripExtension(raw.name),
    file_type: detectFileType(raw.ext),
    size_bytes: raw.size_bytes,
    mtime_ms: raw.mtime_ms ?? now,
    folder: raw.folder,
    links: [],
    note: '',
    created_at: now,
    updated_at: now,
  };
}

/**
 * Merge raw entries scan-trả-về với DB hiện có.
 * - File mới (path chưa có) → enrich + assign LIB-NNNN
 * - File đã có (path trùng) → update size/mtime/folder; preserve doc_title/links/note
 *
 * @returns { merged: tất cả file (kể cả file đã xoá khỏi disk còn trong DB),
 *            stats: { added, updated, missing } }
 */
export function mergeScanResult(
  existing: LibraryFile[],
  rawEntries: RawLibraryEntry[],
): {
  merged: LibraryFile[];
  stats: { added: number; updated: number; total: number; missing: number };
} {
  const now = Date.now();
  const byPath = new Map(existing.map((f) => [f.path, f] as const));
  const seenPaths = new Set<string>();
  let added = 0;
  let updated = 0;

  // Mảng tạm cho file mới — assign id sau
  const result: LibraryFile[] = [];

  // Process raw entries
  for (const raw of rawEntries) {
    seenPaths.add(raw.path);
    const old = byPath.get(raw.path);
    if (old) {
      // Update filesystem fields, preserve user fields
      const merged: LibraryFile = {
        ...old,
        file_name: raw.name,
        file_type: detectFileType(raw.ext),
        size_bytes: raw.size_bytes,
        mtime_ms: raw.mtime_ms ?? old.mtime_ms,
        folder: raw.folder,
        updated_at: now,
      };
      // Only count as updated if filesystem actually changed
      if (
        merged.size_bytes !== old.size_bytes ||
        merged.mtime_ms !== old.mtime_ms ||
        merged.folder !== old.folder
      ) {
        updated++;
      }
      result.push(merged);
    } else {
      // New file
      const id = nextFileId([...existing, ...result]);
      result.push(enrichRawEntry(raw, id, now));
      added++;
    }
  }

  // Files đã có trong DB nhưng không còn trong filesystem
  // → giữ lại để user không mất link/note (mark missing qua mtime_ms = -1?)
  // Chính sách: KHÔNG xoá tự động. User tự xoá thủ công nếu muốn.
  const missingFiles: LibraryFile[] = [];
  for (const old of existing) {
    if (!seenPaths.has(old.path)) {
      missingFiles.push(old);
    }
  }

  return {
    merged: [...result, ...missingFiles],
    stats: {
      added,
      updated,
      total: rawEntries.length,
      missing: missingFiles.length,
    },
  };
}
