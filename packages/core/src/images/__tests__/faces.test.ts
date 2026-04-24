import { describe, it, expect } from 'vitest';
import {
  faceBucket,
  groupByFaceBucket,
  summarizeFaces,
  faceBucketLabel,
} from '../faces.js';
import type { ImageMeta } from '../types.js';

function im(face_count: number | null): ImageMeta {
  return {
    path: `/photo-${Math.random()}.jpg`,
    name: 'p.jpg',
    ext: 'jpg',
    size_bytes: 1000,
    taken_ms: null,
    width: 4000,
    height: 3000,
    aspect: 'landscape',
    camera: null,
    has_gps: false,
    face_count,
  };
}

describe('faceBucket', () => {
  it.each<[number | null, string]>([
    [null, 'unknown'],
    [0, 'none'],
    [1, 'solo'],
    [2, 'pair'],
    [3, 'group'],
    [12, 'group'],
  ])('face_count=%s → %s', (n, expected) => {
    expect(faceBucket(im(n))).toBe(expected);
  });
});

describe('groupByFaceBucket', () => {
  it('tất cả 5 bucket có mặt (kể cả rỗng)', () => {
    const m = groupByFaceBucket([im(1), im(2), im(0), im(null)]);
    expect(m.get('solo')).toHaveLength(1);
    expect(m.get('pair')).toHaveLength(1);
    expect(m.get('none')).toHaveLength(1);
    expect(m.get('unknown')).toHaveLength(1);
    expect(m.get('group')).toHaveLength(0);
  });
});

describe('summarizeFaces', () => {
  it('empty → zeros + coverage 0', () => {
    const s = summarizeFaces([]);
    expect(s.total).toBe(0);
    expect(s.coverage).toBe(0);
  });

  it('100% analyzed → coverage 1', () => {
    const s = summarizeFaces([im(0), im(1), im(3)]);
    expect(s.total).toBe(3);
    expect(s.with_people).toBe(2);
    expect(s.without_people).toBe(1);
    expect(s.not_analyzed).toBe(0);
    expect(s.coverage).toBe(1);
  });

  it('50% analyzed → coverage 0.5', () => {
    const s = summarizeFaces([im(1), im(null)]);
    expect(s.coverage).toBe(0.5);
  });
});

describe('faceBucketLabel', () => {
  it('label tiếng Việt cho tất cả bucket', () => {
    expect(faceBucketLabel('solo')).toBe('Chân dung (1 người)');
    expect(faceBucketLabel('pair')).toBe('Cặp đôi (2 người)');
    expect(faceBucketLabel('group')).toBe('Nhóm (3+ người)');
    expect(faceBucketLabel('none')).toBe('Không có người');
    expect(faceBucketLabel('unknown')).toBe('Chưa phân tích');
  });
});
