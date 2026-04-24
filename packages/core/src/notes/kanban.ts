import { NOTE_STATUSES, type Note, type NoteStatus } from './types.js';

export interface KanbanLane {
  status: NoteStatus;
  label: string;
  notes: Note[];
}

const STATUS_LABELS: Record<NoteStatus, string> = {
  inbox: 'Inbox',
  active: 'Đang làm',
  waiting: 'Chờ',
  done: 'Xong',
  archived: 'Lưu trữ',
};

export function statusLabel(status: NoteStatus): string {
  return STATUS_LABELS[status];
}

/**
 * Group notes thành 5 lane theo status. Note có `status` undefined rơi
 * vào lane `inbox`. Note đã `deletedAt` bị bỏ qua.
 *
 * Trong mỗi lane, sort theo `updatedAt desc` — note vừa sửa lên đầu.
 * `includeArchived` mặc định false — archive ẩn khỏi board.
 */
export function groupByKanban(
  notes: readonly Note[],
  options: { includeArchived?: boolean } = {},
): KanbanLane[] {
  const includeArchived = options.includeArchived ?? false;
  const map = new Map<NoteStatus, Note[]>();
  for (const s of NOTE_STATUSES) map.set(s, []);

  for (const n of notes) {
    if (n.deletedAt != null) continue;
    const s = n.status ?? 'inbox';
    if (s === 'archived' && !includeArchived) continue;
    map.get(s)!.push(n);
  }

  for (const list of map.values()) {
    list.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  const lanes: KanbanLane[] = [];
  for (const s of NOTE_STATUSES) {
    if (s === 'archived' && !includeArchived) continue;
    lanes.push({ status: s, label: statusLabel(s), notes: map.get(s)! });
  }
  return lanes;
}

/**
 * Transition note sang status mới. Return note mới (immutable) — không
 * mutate input.
 *
 * Rule đặc biệt: khi move sang `done`, set `lastReviewedAt = now` luôn
 * (coi như review xong). Khi move FROM `done` ra status khác → giữ
 * nguyên lastReviewedAt.
 */
export function moveNote(
  note: Note,
  status: NoteStatus,
  now: number,
): Note {
  const next: Note = { ...note, status, updatedAt: now };
  if (status === 'done' && note.status !== 'done') {
    next.lastReviewedAt = now;
  }
  return next;
}

/**
 * Đếm nhanh từng lane — dùng cho sidebar badge khi không cần render full.
 */
export function countByStatus(notes: readonly Note[]): Record<NoteStatus, number> {
  const result: Record<NoteStatus, number> = {
    inbox: 0,
    active: 0,
    waiting: 0,
    done: 0,
    archived: 0,
  };
  for (const n of notes) {
    if (n.deletedAt != null) continue;
    const s = n.status ?? 'inbox';
    result[s]++;
  }
  return result;
}
