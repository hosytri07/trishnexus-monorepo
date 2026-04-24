/**
 * @trishteam/core/notes/types — QuickNotes domain model.
 *
 * Shape chung cho website, TrishNote desktop, Zalo Mini App. Firestore
 * wrapper ở @trishteam/data sẽ implement CRUD đối với shape này.
 *
 * Phase 14.0 scaffold, Phase 14.4.1 extend với status + review.
 */

export type NoteId = string;

export type NoteTag = string;

/**
 * 5-state lifecycle — dùng cho Kanban board + filter inbox.
 *
 * - `inbox`    — mới capture, chưa phân loại.
 * - `active`   — đang làm / đang dùng.
 * - `waiting`  — đang chờ ai đó / deadline xa.
 * - `done`     — xong nhưng giữ lại để reference.
 * - `archived` — cũ, ẩn khỏi view mặc định.
 */
export type NoteStatus = 'inbox' | 'active' | 'waiting' | 'done' | 'archived';

export const NOTE_STATUSES: readonly NoteStatus[] = [
  'inbox',
  'active',
  'waiting',
  'done',
  'archived',
] as const;

export type Note = {
  id: NoteId;
  title: string;
  body: string;
  tags: NoteTag[];
  /** Epoch millis — tránh Firebase Timestamp để core không phụ thuộc SDK. */
  createdAt: number;
  updatedAt: number;
  /** Soft delete; cleanup job xử lý sau. */
  deletedAt: number | null;
  /**
   * Lifecycle. Optional để backward-compat với note cũ trên Firestore
   * (website Phase 11.7) — thiếu field → coi như `inbox`.
   */
  status?: NoteStatus;
  /**
   * Epoch millis lần review gần nhất. `null` hoặc undefined = chưa review.
   * Dùng cho Daily Review mode: note chưa review > 7 ngày được highlight.
   */
  lastReviewedAt?: number | null;
  /**
   * Deadline optional (epoch millis). Reminder toast/Telegram sẽ wire ở
   * Phase 14.4.1.b — tạm chỉ lưu để UI hiển thị.
   */
  dueAt?: number | null;
};

export type NoteDraft = Pick<Note, 'title' | 'body' | 'tags'> & {
  status?: NoteStatus;
  dueAt?: number | null;
};

export const MAX_TITLE_LENGTH = 200;
export const MAX_BODY_LENGTH = 20_000;
export const MAX_TAGS = 20;
export const MAX_TAG_LENGTH = 40;

/** Ngày mặc định trước khi 1 note được coi là "cần review". */
export const DEFAULT_REVIEW_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;
