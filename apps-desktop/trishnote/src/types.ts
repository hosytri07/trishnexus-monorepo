/**
 * Phase 17.2 — Domain types extension cho TrishNote v2.
 *
 * Note model gốc ở @trishteam/core/notes — em extend với optional fields:
 *   - category: 'personal' | 'project' (default 'personal')
 *   - folderId: string | null (folder con)
 *   - deadline: number | null (cho project)
 *   - tasks: Task[] (checklist cho project)
 *
 * Folder = container con trong category. User CRUD được.
 */

import type { Note as CoreNote } from '@trishteam/core/notes';

export type NoteCategory = 'personal' | 'project';

export interface Task {
  id: string;
  text: string;
  done: boolean;
  createdAt: number;
}

/** Per-note typography override (overrides global settings). */
export interface NoteStyle {
  fontFamily?: string; // FontFamily key từ settings
  fontSize?: number;
}

/** Đính kèm: file copy vào attachments dir HOẶC link path local user chỉ định. */
export interface Attachment {
  id: string;
  kind: 'file' | 'link';
  /** Tên hiển thị (file basename hoặc user nhập) */
  name: string;
  /** Đường dẫn tuyệt đối: file copy đã được Rust copy vào attachments dir;
   *  link là path bất kỳ user trỏ đến (folder/file local). */
  path: string;
  /** Bytes nếu kind=file. */
  sizeBytes?: number;
  addedAt: number;
}

/** Note extended với fields TrishNote-specific. */
export interface NoteV2 extends CoreNote {
  category?: NoteCategory;
  folderId?: string | null;
  deadline?: number | null;
  tasks?: Task[];
  /** Phase 17.2 v3 — per-note typography */
  style?: NoteStyle;
  /** Phase 17.2 v3 — đính kèm + link */
  attachments?: Attachment[];
  /** Phase 17.2 v4 — pin lên Lối tắt sidebar */
  pinned?: boolean;
  /** Phase 17.2 v4 — body format: 'plain' (legacy) hoặc 'html' (rich text) */
  bodyFormat?: 'plain' | 'html';
}

export interface Folder {
  id: string;
  name: string;
  category: NoteCategory;
  color?: string; // hex hoặc CSS var (project category tag color)
  icon?: string; // emoji
  createdAt: number;
  updatedAt: number;
  /** Phase 17.2 v4 — pin lên Lối tắt sidebar */
  pinned?: boolean;
}

/** Wire format JSON file v2: gộp notes + folders. */
export interface StoreV2 {
  schema: 2;
  notes: NoteV2[];
  folders: Folder[];
}

/** Detect & migrate từ format cũ (notes-only array) → v2. */
export function migrateStore(raw: unknown): StoreV2 {
  if (Array.isArray(raw)) {
    // Old format: array of notes only
    return {
      schema: 2,
      notes: raw as NoteV2[],
      folders: [],
    };
  }
  if (raw && typeof raw === 'object') {
    const obj = raw as Partial<StoreV2>;
    return {
      schema: 2,
      notes: Array.isArray(obj.notes) ? (obj.notes as NoteV2[]) : [],
      folders: Array.isArray(obj.folders) ? (obj.folders as Folder[]) : [],
    };
  }
  return { schema: 2, notes: [], folders: [] };
}

/**
 * Phase 17.2 v3 — Bỏ default folders.
 * User mới sẽ start với 0 folder, note tạo ra default `folderId: null`
 * (nằm ngoài folder, hiện trong "Tất cả note cá nhân/dự án").
 * User có thể tạo folder + di chuyển note vào sau.
 */
export function defaultFolders(): Folder[] {
  return [];
}

export function genFolderId(): string {
  return 'fld_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function genTaskId(): string {
  return 'tsk_' + Math.random().toString(36).slice(2, 10);
}

export function genAttachmentId(): string {
  return 'att_' + Math.random().toString(36).slice(2, 10);
}
