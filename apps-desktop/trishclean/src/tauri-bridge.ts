import { invoke } from '@tauri-apps/api/core';
import { open as openDialog } from '@tauri-apps/plugin-dialog';

export interface RawEntry {
  path: string;
  size_bytes: number;
  modified_at_ms: number;
  accessed_at_ms: number;
  is_dir: boolean;
}

export interface ScanStats {
  entries: RawEntry[];
  total_size_bytes: number;
  truncated: boolean;
  elapsed_ms: number;
  errors: number;
}

function isInTauri(): boolean {
  return (
    typeof window !== 'undefined' &&
    // @ts-expect-error — __TAURI_INTERNALS__ injected at runtime
    typeof window.__TAURI_INTERNALS__ !== 'undefined'
  );
}

/**
 * Dev fallback: seed entries đa dạng để UI có thể render & test style
 * mà không cần start Tauri. Số liệu giả + path điển hình để
 * classification cover nhiều branch.
 */
export const DEV_FALLBACK_SCAN: ScanStats = {
  entries: [
    {
      path: '/Users/dev/.cache/huge.dat',
      size_bytes: 524_288_000,
      modified_at_ms: Date.now() - 3 * 86_400_000,
      accessed_at_ms: Date.now() - 3 * 86_400_000,
      is_dir: false,
    },
    {
      path: '/Users/dev/Downloads/installer-2024.dmg',
      size_bytes: 180_000_000,
      modified_at_ms: Date.now() - 400 * 86_400_000,
      accessed_at_ms: Date.now() - 400 * 86_400_000,
      is_dir: false,
    },
    {
      path: '/Users/dev/Documents/notes.md',
      size_bytes: 4_200,
      modified_at_ms: Date.now() - 2 * 86_400_000,
      accessed_at_ms: Date.now() - 2 * 86_400_000,
      is_dir: false,
    },
    {
      path: '/tmp/session-abc123',
      size_bytes: 12_000_000,
      modified_at_ms: Date.now() - 10 * 86_400_000,
      accessed_at_ms: Date.now() - 10 * 86_400_000,
      is_dir: false,
    },
  ],
  total_size_bytes: 524_288_000 + 180_000_000 + 4_200 + 12_000_000,
  truncated: false,
  elapsed_ms: 0,
  errors: 0,
};

export async function scanDir(
  path: string,
  opts?: { maxEntries?: number; maxDepth?: number },
): Promise<ScanStats> {
  if (!isInTauri()) return DEV_FALLBACK_SCAN;
  try {
    return await invoke<ScanStats>('scan_dir', {
      path,
      maxEntries: opts?.maxEntries,
      maxDepth: opts?.maxDepth,
    });
  } catch (err) {
    throw new Error(String(err));
  }
}

export async function pickDirectory(): Promise<string | null> {
  if (!isInTauri()) return '/Users/dev (dev-mode seed)';
  const res = await openDialog({
    directory: true,
    multiple: false,
    title: 'Chọn thư mục để quét',
  });
  if (typeof res === 'string') return res;
  return null;
}

export async function getAppVersion(): Promise<string> {
  if (!isInTauri()) return 'dev';
  try {
    return await invoke<string>('app_version');
  } catch {
    return 'dev';
  }
}
