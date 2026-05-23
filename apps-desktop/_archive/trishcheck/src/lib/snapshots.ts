/**
 * Phase 15.0.f — Snapshot persistence (localStorage).
 *
 * Mỗi snapshot: timestamp + SysReport + benchmark results (nếu có).
 * Lưu localStorage key `trishcheck:snapshots:v1`. Limit 30 entries
 * (FIFO — entry cũ nhất bị đẩy ra khi push entry thứ 31).
 *
 * Không dùng IndexedDB cho phase này — JSON < 200KB cho 30 snapshot
 * (mỗi snapshot ~5-7KB) đủ trong localStorage 5MB quota.
 */

import type { SysReport, BenchResult } from '../tauri-bridge.js';

export interface Snapshot {
  /** ISO timestamp khi lưu. */
  taken_at: string;
  /** Auto = lưu sau benchmark (nếu setting bật). Manual = user bấm "Lưu snapshot". */
  source: 'auto' | 'manual';
  sys: SysReport;
  cpu_bench: BenchResult | null;
  mem_bench: BenchResult | null;
  /** Optional label user nhập sau (Phase 15.x). */
  label?: string;
}

const STORAGE_KEY = 'trishcheck:snapshots:v1';
const MAX_ENTRIES = 30;

export function loadSnapshots(): Snapshot[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as Snapshot[];
  } catch (err) {
    console.warn('[trishcheck] loadSnapshots corrupt, reset:', err);
    return [];
  }
}

export function saveSnapshots(list: Snapshot[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    // Trim FIFO trước khi save
    const trimmed = list.slice(-MAX_ENTRIES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch (err) {
    console.warn('[trishcheck] saveSnapshots failed:', err);
  }
}

/**
 * Push 1 snapshot mới vào history. Tự trim nếu vượt MAX_ENTRIES.
 * Trả list đã update để caller setState luôn.
 */
export function pushSnapshot(
  current: Snapshot[],
  snapshot: Snapshot,
): Snapshot[] {
  const next = [...current, snapshot].slice(-MAX_ENTRIES);
  saveSnapshots(next);
  return next;
}

export function deleteSnapshot(
  current: Snapshot[],
  taken_at: string,
): Snapshot[] {
  const next = current.filter((s) => s.taken_at !== taken_at);
  saveSnapshots(next);
  return next;
}

export function clearSnapshots(): Snapshot[] {
  saveSnapshots([]);
  return [];
}

/** Build snapshot object cho lúc push. Tách hàm để App component gọn. */
export function buildSnapshot(
  sys: SysReport,
  cpu_bench: BenchResult | null,
  mem_bench: BenchResult | null,
  source: 'auto' | 'manual' = 'manual',
): Snapshot {
  return {
    taken_at: new Date().toISOString(),
    source,
    sys,
    cpu_bench,
    mem_bench,
  };
}
