import { describe, it, expect } from 'vitest';
import {
  notesDueForReview,
  markReviewed,
  countDueForReview,
  computeReviewStreak,
  reviewAgeBucket,
  filterByStatus,
  DEFAULT_REVIEW_INTERVAL_MS,
  type Note,
} from '../index.js';

const DAY = 86_400_000;

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: overrides.id ?? 'n1',
    title: overrides.title ?? 'Test',
    body: overrides.body ?? '',
    tags: overrides.tags ?? [],
    createdAt: overrides.createdAt ?? 0,
    updatedAt: overrides.updatedAt ?? 0,
    deletedAt: overrides.deletedAt ?? null,
    status: overrides.status,
    lastReviewedAt: overrides.lastReviewedAt,
    dueAt: overrides.dueAt,
  };
}

describe('notesDueForReview', () => {
  const now = 10 * DAY;

  it('note chưa review bao giờ → due', () => {
    const n = makeNote({ lastReviewedAt: null, createdAt: 0 });
    expect(notesDueForReview([n], now)).toHaveLength(1);
  });

  it('note review 8 ngày trước (> 7d interval) → due', () => {
    const n = makeNote({ lastReviewedAt: now - 8 * DAY });
    expect(notesDueForReview([n], now)).toHaveLength(1);
  });

  it('note review 3 ngày trước → không due', () => {
    const n = makeNote({ lastReviewedAt: now - 3 * DAY });
    expect(notesDueForReview([n], now)).toHaveLength(0);
  });

  it('note đã archived → không due', () => {
    const n = makeNote({ status: 'archived', lastReviewedAt: null });
    expect(notesDueForReview([n], now)).toHaveLength(0);
  });

  it('note đã done → không due', () => {
    const n = makeNote({ status: 'done', lastReviewedAt: null });
    expect(notesDueForReview([n], now)).toHaveLength(0);
  });

  it('note đã deletedAt → không due', () => {
    const n = makeNote({ deletedAt: now - DAY, lastReviewedAt: null });
    expect(notesDueForReview([n], now)).toHaveLength(0);
  });

  it('sort: cũ nhất lên đầu', () => {
    const a = makeNote({ id: 'a', lastReviewedAt: now - 30 * DAY });
    const b = makeNote({ id: 'b', lastReviewedAt: now - 10 * DAY });
    const c = makeNote({ id: 'c', lastReviewedAt: null, createdAt: 100 });
    const due = notesDueForReview([b, a, c], now);
    // null (c) lên đầu; rồi a (30d); rồi b (10d)
    expect(due.map((n) => n.id)).toEqual(['c', 'a', 'b']);
  });

  it('interval custom 30 ngày', () => {
    const n = makeNote({ lastReviewedAt: now - 10 * DAY });
    expect(notesDueForReview([n], now, 30 * DAY)).toHaveLength(0);
    expect(notesDueForReview([n], now, 5 * DAY)).toHaveLength(1);
  });
});

describe('countDueForReview', () => {
  const now = 10 * DAY;

  it('skip archived/done/deleted', () => {
    const notes: Note[] = [
      makeNote({ id: 'a', lastReviewedAt: null }),
      makeNote({ id: 'b', status: 'archived', lastReviewedAt: null }),
      makeNote({ id: 'c', status: 'done', lastReviewedAt: null }),
      makeNote({ id: 'd', deletedAt: now, lastReviewedAt: null }),
    ];
    expect(countDueForReview(notes, now)).toBe(1);
  });

  it('trả về 0 khi tất cả note fresh', () => {
    const n = makeNote({ lastReviewedAt: now - DAY });
    expect(countDueForReview([n], now)).toBe(0);
  });
});

describe('markReviewed', () => {
  it('không mutate input', () => {
    const n = makeNote({ lastReviewedAt: 0, updatedAt: 0 });
    const next = markReviewed(n, 999);
    expect(n.lastReviewedAt).toBe(0);
    expect(next.lastReviewedAt).toBe(999);
    expect(next.updatedAt).toBe(999);
  });
});

describe('computeReviewStreak', () => {
  it('hôm nay review + 3 ngày trước liên tục → streak 4', () => {
    const today = 10 * DAY;
    const notes: Note[] = [
      makeNote({ id: '1', lastReviewedAt: today }),
      makeNote({ id: '2', lastReviewedAt: today - DAY }),
      makeNote({ id: '3', lastReviewedAt: today - 2 * DAY }),
      makeNote({ id: '4', lastReviewedAt: today - 3 * DAY }),
    ];
    expect(computeReviewStreak(notes, today)).toBe(4);
  });

  it('gap 1 ngày → streak chỉ tính tới gap', () => {
    const today = 10 * DAY;
    const notes: Note[] = [
      makeNote({ id: '1', lastReviewedAt: today }),
      // Bỏ ngày -1
      makeNote({ id: '3', lastReviewedAt: today - 2 * DAY }),
    ];
    expect(computeReviewStreak(notes, today)).toBe(1);
  });

  it('hôm nay chưa review → streak 0', () => {
    const today = 10 * DAY;
    const notes: Note[] = [
      makeNote({ id: '1', lastReviewedAt: today - DAY }),
    ];
    expect(computeReviewStreak(notes, today)).toBe(0);
  });

  it('không có note review nào → streak 0', () => {
    expect(computeReviewStreak([], 10 * DAY)).toBe(0);
  });
});

describe('reviewAgeBucket', () => {
  const now = 100 * DAY;

  it('< 3.5d → fresh (default interval 7d)', () => {
    const n = makeNote({ lastReviewedAt: now - 2 * DAY });
    expect(reviewAgeBucket(n, now)).toBe('fresh');
  });

  it('3.5d ≤ age < 7d → stale', () => {
    const n = makeNote({ lastReviewedAt: now - 5 * DAY });
    expect(reviewAgeBucket(n, now)).toBe('stale');
  });

  it('7d ≤ age < 28d → overdue', () => {
    const n = makeNote({ lastReviewedAt: now - 20 * DAY });
    expect(reviewAgeBucket(n, now)).toBe('overdue');
  });

  it('age ≥ 28d (4 * 7d) → ancient', () => {
    const n = makeNote({ lastReviewedAt: now - 60 * DAY });
    expect(reviewAgeBucket(n, now)).toBe('ancient');
  });

  it('chưa review bao giờ → dùng createdAt', () => {
    const n = makeNote({ lastReviewedAt: null, createdAt: now - 50 * DAY });
    expect(reviewAgeBucket(n, now)).toBe('ancient');
  });
});

describe('filterByStatus', () => {
  const notes: Note[] = [
    makeNote({ id: 'a', status: 'inbox' }),
    makeNote({ id: 'b', status: 'active' }),
    makeNote({ id: 'c', status: 'archived' }),
    makeNote({ id: 'd' }), // status undefined → treat as inbox
    makeNote({ id: 'e', deletedAt: 1 }),
  ];

  it('null = non-archived non-deleted', () => {
    const out = filterByStatus(notes, null);
    expect(out.map((n) => n.id)).toEqual(['a', 'b', 'd']);
  });

  it('inbox bao gồm cả note status undefined', () => {
    const out = filterByStatus(notes, 'inbox');
    expect(out.map((n) => n.id).sort()).toEqual(['a', 'd']);
  });

  it('archived → return chỉ archived (ẩn deleted)', () => {
    const out = filterByStatus(notes, 'archived');
    expect(out.map((n) => n.id)).toEqual(['c']);
  });
});

describe('DEFAULT_REVIEW_INTERVAL_MS', () => {
  it('= 7 ngày', () => {
    expect(DEFAULT_REVIEW_INTERVAL_MS).toBe(7 * DAY);
  });
});
