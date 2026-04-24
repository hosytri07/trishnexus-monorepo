/**
 * Domain types cho TrishClean — dọn dẹp file/ folder với undo 7 ngày.
 *
 * Không dùng Date trực tiếp — mọi timestamp là epoch millis để
 * serialize qua Tauri IPC an toàn và compare reproducible.
 */

export type CleanCategory =
  | 'cache'        // Browser cache, app cache
  | 'temp'         // %TEMP%, /tmp
  | 'download'     // Downloads cũ
  | 'duplicate'    // File trùng (future: hash match)
  | 'large'        // File > ngưỡng user
  | 'old'          // Chưa mở lâu
  | 'empty_dir'    // Folder rỗng
  | 'recycle'      // Thùng rác OS
  | 'other';

export interface FileEntry {
  path: string;
  size_bytes: number;
  modified_at_ms: number;
  accessed_at_ms: number;
  is_dir: boolean;
  category: CleanCategory;
}

export interface AgeBucket {
  id: 'recent' | 'month' | 'quarter' | 'year' | 'ancient';
  label: string;
  min_days: number;
  max_days: number | null;
}

export interface ScanSummary {
  total_files: number;
  total_size_bytes: number;
  by_category: Record<CleanCategory, CategoryStat>;
  by_age: Record<AgeBucket['id'], AgeStat>;
}

export interface CategoryStat {
  count: number;
  size_bytes: number;
}

export interface AgeStat {
  count: number;
  size_bytes: number;
}

/**
 * Staged delete — khi user "Xoá", file được move sang trash, không
 * unlink. Sau `retention_days` ngày (mặc định 7) mới xoá thật.
 */
export interface StagedDelete {
  id: string;              // uuid
  original_path: string;
  trash_path: string;
  size_bytes: number;
  staged_at_ms: number;
  commit_after_ms: number; // = staged_at_ms + retention_days * 86_400_000
  category: CleanCategory;
}

export type StagedStatus = 'pending' | 'committed' | 'restored' | 'expired';
