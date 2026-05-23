/**
 * Phase 18.2.a — Note module types.
 */

export type NoteCategory = 'personal' | 'project';
export type NoteStatus = 'inbox' | 'active' | 'done';

export interface Attachment {
  id: string;
  kind: 'file' | 'link';
  name: string;
  /** path local (file) hoặc URL (link) */
  target: string;
  size_bytes?: number;
  added_at: number;
}

export interface Note {
  id: string;
  folder_id: string;
  category: NoteCategory;
  title: string;
  /** TipTap HTML content */
  content_html: string;
  tags: string[];
  pinned: boolean;
  /** Cho project notes */
  status: NoteStatus;
  deadline: number | null;
  attachments: Attachment[];
  /** Soft-delete vào trash bin */
  trashed: boolean;
  trashed_at: number | null;
  color: string | null; // hex color tag #ec4899
  created_at: number;
  updated_at: number;
}

export interface Folder {
  id: string;
  name: string;
  /** Pin to "Lối tắt" */
  pinned: boolean;
  color: string | null;
  created_at: number;
}

export interface NoteStore {
  schema_version: 1;
  notes: Note[];
  folders: Folder[];
  /** Daily notes auto */
  daily_notes: Record<string, string>; // date 'YYYY-MM-DD' → note_id
}

export const DEFAULT_FOLDERS: Folder[] = [
  {
    id: 'default-personal',
    name: 'Cá nhân',
    pinned: true,
    color: null,
    created_at: 0,
  },
  {
    id: 'default-project',
    name: 'Dự án',
    pinned: true,
    color: null,
    created_at: 0,
  },
];

export function emptyStore(): NoteStore {
  return {
    schema_version: 1,
    notes: [],
    folders: [...DEFAULT_FOLDERS],
    daily_notes: {},
  };
}

export function genId(prefix: string): string {
  const ts = Date.now().toString(36);
  const rnd = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${ts}_${rnd}`;
}

export function isToday(d: Date): boolean {
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Strip HTML tags để có plain-text excerpt cho note list. */
export function stripHtml(html: string): string {
  if (typeof DOMParser === 'undefined') {
    return html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  }
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return (doc.body.textContent ?? '').replace(/\s+/g, ' ').trim();
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
