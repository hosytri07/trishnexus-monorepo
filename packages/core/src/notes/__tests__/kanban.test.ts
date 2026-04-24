import { describe, it, expect } from 'vitest';
import {
  groupByKanban,
  moveNote,
  countByStatus,
  statusLabel,
  NOTE_STATUSES,
  type Note,
} from '../index.js';

function n(
  id: string,
  status: Note['status'] | undefined,
  updatedAt: number,
  extras: Partial<Note> = {},
): Note {
  return {
    id,
    title: id,
    body: '',
    tags: [],
    createdAt: 0,
    updatedAt,
    deletedAt: null,
    status,
    ...extras,
  };
}

describe('groupByKanban', () => {
  it('5 lane chuẩn ẩn archived mặc định', () => {
    const notes = [
      n('a', 'inbox', 1),
      n('b', 'active', 2),
      n('c', 'waiting', 3),
      n('d', 'done', 4),
      n('e', 'archived', 5),
    ];
    const lanes = groupByKanban(notes);
    expect(lanes.map((l) => l.status)).toEqual([
      'inbox',
      'active',
      'waiting',
      'done',
    ]);
  });

  it('includeArchived = true → 5 lane', () => {
    const lanes = groupByKanban([n('e', 'archived', 1)], { includeArchived: true });
    expect(lanes).toHaveLength(5);
    expect(lanes[4]!.notes).toHaveLength(1);
  });

  it('sort trong lane theo updatedAt desc', () => {
    const notes = [
      n('a', 'inbox', 1),
      n('b', 'inbox', 3),
      n('c', 'inbox', 2),
    ];
    const lanes = groupByKanban(notes);
    expect(lanes[0]!.notes.map((x) => x.id)).toEqual(['b', 'c', 'a']);
  });

  it('note status undefined → vào inbox lane', () => {
    const lanes = groupByKanban([n('x', undefined, 1)]);
    expect(lanes[0]!.status).toBe('inbox');
    expect(lanes[0]!.notes).toHaveLength(1);
  });

  it('note đã deletedAt bị bỏ qua', () => {
    const notes = [n('x', 'inbox', 1, { deletedAt: 5 })];
    const lanes = groupByKanban(notes);
    expect(lanes.every((l) => l.notes.length === 0)).toBe(true);
  });

  it('lane labels tiếng Việt', () => {
    const lanes = groupByKanban([n('a', 'inbox', 1)]);
    expect(lanes[0]!.label).toBe('Inbox');
    expect(lanes[1]!.label).toBe('Đang làm');
    expect(lanes[2]!.label).toBe('Chờ');
    expect(lanes[3]!.label).toBe('Xong');
  });
});

describe('moveNote', () => {
  it('không mutate input', () => {
    const note = n('a', 'inbox', 0);
    const next = moveNote(note, 'active', 100);
    expect(note.status).toBe('inbox');
    expect(note.updatedAt).toBe(0);
    expect(next.status).toBe('active');
    expect(next.updatedAt).toBe(100);
  });

  it('move sang done → set lastReviewedAt = now', () => {
    const note = n('a', 'active', 0);
    const next = moveNote(note, 'done', 500);
    expect(next.lastReviewedAt).toBe(500);
  });

  it('move done → done không đổi lastReviewedAt (đã có)', () => {
    const note = n('a', 'done', 0, { lastReviewedAt: 100 });
    const next = moveNote(note, 'done', 500);
    // Vẫn sẽ set vì same-status transition — ok theo rule hiện tại
    // Thực tế UI không gọi moveNote khi cùng status, test này kiểm ngưỡng cross-over
    expect(next.lastReviewedAt).toBe(100); // guard chỉ trigger khi status ≠ note.status
  });

  it('move done → active giữ nguyên lastReviewedAt', () => {
    const note = n('a', 'done', 0, { lastReviewedAt: 100 });
    const next = moveNote(note, 'active', 500);
    expect(next.lastReviewedAt).toBe(100);
  });
});

describe('countByStatus', () => {
  it('đếm đủ 5 status + skip deleted', () => {
    const notes = [
      n('a', 'inbox', 1),
      n('b', 'inbox', 2),
      n('c', 'active', 3),
      n('d', 'archived', 4),
      n('e', 'waiting', 5, { deletedAt: 6 }),
      n('f', undefined, 7), // → inbox
    ];
    const counts = countByStatus(notes);
    expect(counts).toEqual({
      inbox: 3,
      active: 1,
      waiting: 0,
      done: 0,
      archived: 1,
    });
  });
});

describe('statusLabel', () => {
  it('trả về tiếng Việt cho 5 status', () => {
    expect(statusLabel('inbox')).toBe('Inbox');
    expect(statusLabel('active')).toBe('Đang làm');
    expect(statusLabel('waiting')).toBe('Chờ');
    expect(statusLabel('done')).toBe('Xong');
    expect(statusLabel('archived')).toBe('Lưu trữ');
  });
});

describe('NOTE_STATUSES constant', () => {
  it('có 5 value đúng thứ tự', () => {
    expect(NOTE_STATUSES).toEqual(['inbox', 'active', 'waiting', 'done', 'archived']);
  });
});
