import type { CleanCategory } from './types.js';

const LARGE_FILE_BYTES = 100 * 1024 * 1024; // 100 MB
const OLD_DAYS = 180;
const DAY_MS = 86_400_000;

export interface ClassifyInput {
  path: string;
  size_bytes: number;
  accessed_at_ms: number;
  is_dir: boolean;
  nowMs: number;
}

/**
 * Classify raw file entry → category.
 *
 * Rule ưu tiên (first match wins):
 *   1. Folder rỗng (size=0 && is_dir=true) → empty_dir
 *   2. Path chứa "/cache/" hoặc Cache folder                → cache
 *   3. Path trong %TEMP% / /tmp / var/folders               → temp
 *   4. Path trong Downloads                                 → download
 *   5. Path trong Recycle/Trash                             → recycle
 *   6. Size ≥ 100 MB                                        → large
 *   7. Chưa access ≥ 180 ngày                               → old
 *   8. Otherwise                                            → other
 *
 * Match case-insensitive; support cả separator / và \.
 */
export function classifyPath(input: ClassifyInput): CleanCategory {
  const { path, size_bytes, accessed_at_ms, is_dir, nowMs } = input;
  if (is_dir && size_bytes === 0) return 'empty_dir';

  const p = normalize(path);

  if (
    p.includes('/cache/') ||
    p.includes('/.cache/') || // Linux XDG
    p.includes('/appdata/local/cache') ||
    p.endsWith('/cache') ||
    p.endsWith('/.cache')
  )
    return 'cache';

  if (
    p.includes('/tmp/') ||
    p.includes('/temp/') ||
    p.includes('/appdata/local/temp/') ||
    p.includes('/var/folders/')
  )
    return 'temp';

  if (p.includes('/downloads/')) return 'download';

  if (
    p.includes('/$recycle.bin/') ||
    p.includes('/.trash/') ||
    p.includes('/trash/') ||
    p.includes('/recyclebin/')
  )
    return 'recycle';

  if (size_bytes >= LARGE_FILE_BYTES) return 'large';

  const ageDays = (nowMs - accessed_at_ms) / DAY_MS;
  if (ageDays >= OLD_DAYS) return 'old';

  return 'other';
}

function normalize(p: string): string {
  return p.replace(/\\/g, '/').toLowerCase();
}
