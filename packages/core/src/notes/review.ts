import {
  DEFAULT_REVIEW_INTERVAL_MS,
  type Note,
  type NoteStatus,
} from './types.js';

/**
 * "Due for review" — note chưa xoá, chưa archive, chưa review trong
 * `intervalMs` ngày gần nhất. Sort theo age desc (cũ nhất lên đầu).
 *
 * Criteria:
 * - `deletedAt == null`
 * - `status !== 'archived'`
 * - `status !== 'done'` (done rồi thì không cần review định kỳ)
 * - `lastReviewedAt == null` HOẶC `now - lastReviewedAt >= intervalMs`
 */
export function notesDueForReview(
  notes: readonly Note[],
  now: number,
  intervalMs: number = DEFAULT_REVIEW_INTERVAL_MS,
): Note[] {
  const due: Note[] = [];
  for (const n of notes) {
    if (n.deletedAt != null) continue;
    if (n.status === 'archived' || n.status === 'done') continue;
    const last = n.lastReviewedAt ?? null;
    const age = last == null ? Infinity : now - last;
    if (age >= intervalMs) due.push(n);
  }
  // Cũ nhất lên đầu (lastReviewedAt asc; null trước)
  due.sort((a, b) => {
    const la = a.lastReviewedAt ?? -Infinity;
    const lb = b.lastReviewedAt ?? -Infinity;
    if (la === lb) {
      // Tiebreak theo createdAt asc (note cũ hơn ưu tiên review)
      return a.createdAt - b.createdAt;
    }
    return la - lb;
  });
  return due;
}

/**
 * Mark 1 note là đã review. Trả về note mới với `lastReviewedAt = now`
 * — không mutate input (ưu tiên immutable cho React).
 */
export function markReviewed(note: Note, now: number): Note {
  return { ...note, lastReviewedAt: now, updatedAt: now };
}

/** Đếm có bao nhiêu note cần review — rẻ hơn `notesDueForReview(...).length`. */
export function countDueForReview(
  notes: readonly Note[],
  now: number,
  intervalMs: number = DEFAULT_REVIEW_INTERVAL_MS,
): number {
  let n = 0;
  for (const note of notes) {
    if (note.deletedAt != null) continue;
    if (note.status === 'archived' || note.status === 'done') continue;
    const last = note.lastReviewedAt ?? null;
    const age = last == null ? Infinity : now - last;
    if (age >= intervalMs) n++;
  }
  return n;
}

/**
 * Tổng review streak — số ngày liên tục user review ít nhất 1 note.
 * Đơn giản hoá: dựa vào mảng `lastReviewedAt` của tất cả note, tính
 * xem ngày hôm nay + các ngày liền trước có hoạt động review không.
 *
 * UTC day-bucket cho deterministic; app UI convert sang local date.
 */
export function computeReviewStreak(
  notes: readonly Note[],
  now: number,
): number {
  const dayBucket = (ms: number): number => Math.floor(ms / 86_400_000);
  const today = dayBucket(now);
  const days = new Set<number>();
  for (const n of notes) {
    if (n.lastReviewedAt != null) days.add(dayBucket(n.lastReviewedAt));
  }
  let streak = 0;
  for (let d = today; days.has(d); d--) {
    streak++;
    if (streak > 365) break; // Safety cap
  }
  return streak;
}

/** Age bucket cho UI badge. */
export type ReviewAgeBucket = 'fresh' | 'stale' | 'overdue' | 'ancient';

export function reviewAgeBucket(
  note: Note,
  now: number,
  intervalMs: number = DEFAULT_REVIEW_INTERVAL_MS,
): ReviewAgeBucket {
  const last = note.lastReviewedAt ?? null;
  const age = last == null ? now - note.createdAt : now - last;
  if (age < intervalMs / 2) return 'fresh';
  if (age < intervalMs) return 'stale';
  if (age < intervalMs * 4) return 'overdue';
  return 'ancient';
}

/** Filter note theo status — null = all non-archived. */
export function filterByStatus(
  notes: readonly Note[],
  status: NoteStatus | null,
): Note[] {
  if (status === null) {
    return notes.filter(
      (n) => n.deletedAt == null && n.status !== 'archived',
    );
  }
  return notes.filter((n) => n.deletedAt == null && (n.status ?? 'inbox') === status);
}
