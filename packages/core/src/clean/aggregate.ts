import type {
  AgeBucket,
  AgeStat,
  CategoryStat,
  CleanCategory,
  FileEntry,
  ScanSummary,
  StagedDelete,
} from './types.js';

export const DAY_MS = 86_400_000;
export const DEFAULT_RETENTION_DAYS = 7;

export const AGE_BUCKETS: readonly AgeBucket[] = [
  { id: 'recent', label: 'Trong 7 ngày', min_days: 0, max_days: 7 },
  { id: 'month', label: 'Trong 30 ngày', min_days: 7, max_days: 30 },
  { id: 'quarter', label: 'Trong 90 ngày', min_days: 30, max_days: 90 },
  { id: 'year', label: 'Trong 1 năm', min_days: 90, max_days: 365 },
  { id: 'ancient', label: 'Trên 1 năm', min_days: 365, max_days: null },
];

const CATEGORIES: CleanCategory[] = [
  'cache',
  'temp',
  'download',
  'duplicate',
  'large',
  'old',
  'empty_dir',
  'recycle',
  'other',
];

export function emptyCategoryMap(): Record<CleanCategory, CategoryStat> {
  const out = {} as Record<CleanCategory, CategoryStat>;
  for (const c of CATEGORIES) out[c] = { count: 0, size_bytes: 0 };
  return out;
}

function emptyAgeMap(): Record<AgeBucket['id'], AgeStat> {
  return {
    recent: { count: 0, size_bytes: 0 },
    month: { count: 0, size_bytes: 0 },
    quarter: { count: 0, size_bytes: 0 },
    year: { count: 0, size_bytes: 0 },
    ancient: { count: 0, size_bytes: 0 },
  };
}

/**
 * Tính age bucket từ accessed timestamp và reference "now" millis.
 * `max_days = null` = open-ended → fallback bucket.
 */
export function bucketForAge(
  accessedAtMs: number,
  nowMs: number,
): AgeBucket['id'] {
  const days = Math.max(0, (nowMs - accessedAtMs) / DAY_MS);
  for (const b of AGE_BUCKETS) {
    if (b.max_days === null) continue;
    if (days >= b.min_days && days < b.max_days) return b.id;
  }
  return 'ancient';
}

/**
 * Tổng hợp scan result → summary cho UI (số file, dung lượng theo
 * category + age bucket). Pure function — deterministic.
 */
export function summarizeScan(
  entries: readonly FileEntry[],
  nowMs: number,
): ScanSummary {
  const by_category = emptyCategoryMap();
  const by_age = emptyAgeMap();
  let total_files = 0;
  let total_size_bytes = 0;

  for (const e of entries) {
    total_files += 1;
    total_size_bytes += e.size_bytes;

    const cat = by_category[e.category];
    cat.count += 1;
    cat.size_bytes += e.size_bytes;

    const ageId = bucketForAge(e.accessed_at_ms, nowMs);
    const ageStat = by_age[ageId];
    ageStat.count += 1;
    ageStat.size_bytes += e.size_bytes;
  }

  return { total_files, total_size_bytes, by_category, by_age };
}

export interface StageDeleteInput {
  entries: readonly FileEntry[];
  trashDir: string;
  nowMs: number;
  retentionDays?: number;
  idFactory?: (entry: FileEntry, index: number) => string;
}

/**
 * Chuẩn bị danh sách StagedDelete từ entries. KHÔNG move file — chỉ
 * tính metadata. Tauri-side sẽ dùng `trash_path` để move thật.
 *
 * `idFactory` inject cho test (mặc định dùng path + index).
 */
export function planStageDelete(input: StageDeleteInput): StagedDelete[] {
  const {
    entries,
    trashDir,
    nowMs,
    retentionDays = DEFAULT_RETENTION_DAYS,
    idFactory = defaultIdFactory,
  } = input;

  const retentionMs = Math.max(0, retentionDays) * DAY_MS;
  const normalizedTrash = trashDir.endsWith('/') || trashDir.endsWith('\\')
    ? trashDir.slice(0, -1)
    : trashDir;

  return entries.map((e, idx) => {
    const basename = basenameOf(e.path);
    const id = idFactory(e, idx);
    const trash_path = `${normalizedTrash}/${id}__${basename}`;
    return {
      id,
      original_path: e.path,
      trash_path,
      size_bytes: e.size_bytes,
      staged_at_ms: nowMs,
      commit_after_ms: nowMs + retentionMs,
      category: e.category,
    };
  });
}

/**
 * Từ danh sách staged delete, trả ra danh sách có thể commit (đã
 * qua retention) tại thời điểm `nowMs`.
 */
export function listReadyToCommit(
  staged: readonly StagedDelete[],
  nowMs: number,
): StagedDelete[] {
  return staged.filter((s) => s.commit_after_ms <= nowMs);
}

export function sumSize(entries: readonly { size_bytes: number }[]): number {
  return entries.reduce((acc, e) => acc + e.size_bytes, 0);
}

function basenameOf(p: string): string {
  const i = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'));
  return i >= 0 ? p.slice(i + 1) : p;
}

function defaultIdFactory(entry: FileEntry, index: number): string {
  // Deterministic nhưng đủ unique — kết hợp index + len + mod.
  const pathLen = entry.path.length.toString(36);
  const mod = (entry.modified_at_ms % 1_000_000).toString(36);
  return `${index.toString(36)}${pathLen}${mod}`;
}
