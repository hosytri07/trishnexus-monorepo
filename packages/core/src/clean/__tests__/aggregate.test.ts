import { describe, it, expect } from 'vitest';
import {
  AGE_BUCKETS,
  DAY_MS,
  DEFAULT_RETENTION_DAYS,
  bucketForAge,
  listReadyToCommit,
  planStageDelete,
  summarizeScan,
  sumSize,
} from '../aggregate.js';
import type { FileEntry, StagedDelete } from '../types.js';

const NOW = 1_745_480_000_000; // 2026-04-24 approx

function entry(
  overrides: Partial<FileEntry> & Pick<FileEntry, 'path'>,
): FileEntry {
  return {
    path: overrides.path,
    size_bytes: 1024,
    modified_at_ms: NOW - DAY_MS,
    accessed_at_ms: NOW - DAY_MS,
    is_dir: false,
    category: 'other',
    ...overrides,
  };
}

describe('AGE_BUCKETS', () => {
  it('đủ 5 bucket theo thứ tự tăng dần', () => {
    expect(AGE_BUCKETS.map((b) => b.id)).toEqual([
      'recent',
      'month',
      'quarter',
      'year',
      'ancient',
    ]);
  });

  it('ancient có max_days = null', () => {
    const ancient = AGE_BUCKETS.at(-1);
    expect(ancient?.max_days).toBeNull();
  });
});

describe('bucketForAge', () => {
  it('0 ngày → recent', () => {
    expect(bucketForAge(NOW, NOW)).toBe('recent');
  });

  it('5 ngày → recent', () => {
    expect(bucketForAge(NOW - 5 * DAY_MS, NOW)).toBe('recent');
  });

  it('20 ngày → month', () => {
    expect(bucketForAge(NOW - 20 * DAY_MS, NOW)).toBe('month');
  });

  it('60 ngày → quarter', () => {
    expect(bucketForAge(NOW - 60 * DAY_MS, NOW)).toBe('quarter');
  });

  it('200 ngày → year', () => {
    expect(bucketForAge(NOW - 200 * DAY_MS, NOW)).toBe('year');
  });

  it('1000 ngày → ancient', () => {
    expect(bucketForAge(NOW - 1000 * DAY_MS, NOW)).toBe('ancient');
  });

  it('accessed trong tương lai (clock skew) → clamp về recent', () => {
    expect(bucketForAge(NOW + 5 * DAY_MS, NOW)).toBe('recent');
  });
});

describe('summarizeScan', () => {
  it('danh sách rỗng → mọi stat đều 0', () => {
    const s = summarizeScan([], NOW);
    expect(s.total_files).toBe(0);
    expect(s.total_size_bytes).toBe(0);
    expect(s.by_category.cache.count).toBe(0);
    expect(s.by_age.recent.count).toBe(0);
  });

  it('aggregate đúng theo category + age', () => {
    const entries = [
      entry({
        path: '/cache/a',
        size_bytes: 100,
        category: 'cache',
        accessed_at_ms: NOW - 2 * DAY_MS,
      }),
      entry({
        path: '/cache/b',
        size_bytes: 200,
        category: 'cache',
        accessed_at_ms: NOW - 10 * DAY_MS,
      }),
      entry({
        path: '/tmp/x',
        size_bytes: 500,
        category: 'temp',
        accessed_at_ms: NOW - 400 * DAY_MS,
      }),
    ];

    const s = summarizeScan(entries, NOW);
    expect(s.total_files).toBe(3);
    expect(s.total_size_bytes).toBe(800);
    expect(s.by_category.cache.count).toBe(2);
    expect(s.by_category.cache.size_bytes).toBe(300);
    expect(s.by_category.temp.size_bytes).toBe(500);
    expect(s.by_age.recent.count).toBe(1);
    expect(s.by_age.month.count).toBe(1);
    expect(s.by_age.ancient.count).toBe(1);
  });
});

describe('planStageDelete', () => {
  const entries = [
    entry({ path: '/foo/bar.txt', size_bytes: 100, category: 'cache' }),
    entry({ path: 'C:\\Users\\trí\\big.dat', size_bytes: 2_000_000 }),
  ];

  it('tạo StagedDelete với trash_path + commit_after', () => {
    const plan = planStageDelete({
      entries,
      trashDir: '/trash',
      nowMs: NOW,
    });
    expect(plan).toHaveLength(2);
    expect(plan[0]?.original_path).toBe('/foo/bar.txt');
    expect(plan[0]?.trash_path).toMatch(/^\/trash\/.+__bar\.txt$/);
    expect(plan[0]?.commit_after_ms).toBe(NOW + DEFAULT_RETENTION_DAYS * DAY_MS);
  });

  it('custom retention được tôn trọng', () => {
    const plan = planStageDelete({
      entries,
      trashDir: '/trash',
      nowMs: NOW,
      retentionDays: 30,
    });
    expect(plan[0]?.commit_after_ms).toBe(NOW + 30 * DAY_MS);
  });

  it('trim trailing slash của trashDir', () => {
    const plan = planStageDelete({
      entries,
      trashDir: '/trash/',
      nowMs: NOW,
    });
    expect(plan[0]?.trash_path.startsWith('/trash/')).toBe(true);
    expect(plan[0]?.trash_path.includes('//')).toBe(false);
  });

  it('handle Windows path separator', () => {
    const plan = planStageDelete({
      entries,
      trashDir: 'C:\\Trash\\',
      nowMs: NOW,
    });
    expect(plan[1]?.trash_path).toContain('big.dat');
  });

  it('idFactory được inject', () => {
    const plan = planStageDelete({
      entries,
      trashDir: '/trash',
      nowMs: NOW,
      idFactory: (_, i) => `fixed-${i}`,
    });
    expect(plan[0]?.id).toBe('fixed-0');
    expect(plan[1]?.id).toBe('fixed-1');
  });
});

describe('listReadyToCommit', () => {
  const base: StagedDelete = {
    id: 'a',
    original_path: '/p',
    trash_path: '/t',
    size_bytes: 1,
    staged_at_ms: NOW - 10 * DAY_MS,
    commit_after_ms: NOW - 3 * DAY_MS,
    category: 'cache',
  };
  const staged: StagedDelete[] = [
    base,
    { ...base, id: 'b', commit_after_ms: NOW + DAY_MS },
    { ...base, id: 'c', commit_after_ms: NOW }, // exact boundary
  ];

  it('chỉ giữ những cái đã qua commit_after_ms', () => {
    const ready = listReadyToCommit(staged, NOW);
    expect(ready.map((r) => r.id).sort()).toEqual(['a', 'c']);
  });

  it('nowMs ở quá khứ → không cái nào ready', () => {
    expect(listReadyToCommit(staged, NOW - 100 * DAY_MS)).toHaveLength(0);
  });
});

describe('sumSize', () => {
  it('cộng dồn size_bytes', () => {
    expect(sumSize([{ size_bytes: 100 }, { size_bytes: 200 }])).toBe(300);
  });

  it('array rỗng → 0', () => {
    expect(sumSize([])).toBe(0);
  });
});
