/**
 * Phase 78.13 — Task executor.
 *
 * Mỗi loại task gọi Tauri command tương ứng và trả về summary string.
 * Lỗi quăng ra ngoài để runner cập nhật lastStatus='error'.
 *
 * Để an toàn (chạy không có user supervise), các action xoá file thật bị giới hạn:
 *   - clean.full chỉ xoá file rác AutoCAD .bak/.sv$ + Temp file > 7 ngày.
 *   - Không bao giờ tự empty Recycle Bin / xoá browser cache cookie auto.
 */
import { invoke } from '@tauri-apps/api/core';
import type { ScheduledTaskKind } from './types.js';

export interface ExecResult {
  summary: string;
}

export async function executeTask(kind: ScheduledTaskKind): Promise<ExecResult> {
  switch (kind) {
    case 'clean.preview':
      return execCleanPreview();
    case 'clean.full':
      return execCleanFull();
    case 'check.report':
      return execCheckReport();
    case 'font.scan-system':
      return execFontScan();
    default:
      throw new Error(`Unknown task kind: ${kind}`);
  }
}

interface CleanScanResult {
  total_files?: number;
  total_size?: number;
  files?: unknown[];
}

async function execCleanPreview(): Promise<ExecResult> {
  const stats = await invoke<CleanScanResult>('scan_autocad_junk').catch(() => null);
  const files = stats?.total_files ?? 0;
  const bytes = stats?.total_size ?? 0;
  return {
    summary: `Preview: ${files} files, ${formatBytes(bytes)} có thể giải phóng.`,
  };
}

async function execCleanFull(): Promise<ExecResult> {
  // Strategy: scan AutoCAD junk → move_to_trash (safe, có session để restore).
  const stats = await invoke<CleanScanResult>('scan_autocad_junk').catch(() => null);
  const files = (stats?.files as Array<{ path?: string; size?: number }> | undefined) ?? [];
  if (files.length === 0) {
    return { summary: 'Không tìm thấy file rác AutoCAD.' };
  }
  const paths = files.map((f) => f.path).filter((p): p is string => typeof p === 'string');
  const bytes = files.reduce((acc, f) => acc + (f.size ?? 0), 0);
  if (paths.length === 0) {
    return { summary: 'Scan ok nhưng không có path hợp lệ để xoá.' };
  }
  try {
    await invoke('move_to_trash', { paths, sessionName: `scheduled-${new Date().toISOString()}` });
  } catch (err) {
    throw new Error(`move_to_trash thất bại: ${err instanceof Error ? err.message : String(err)}`);
  }
  return { summary: `Đã chuyển ${paths.length} file (${formatBytes(bytes)}) vào trash session.` };
}

interface SysReportResult {
  cpu?: { name?: string };
  mem?: { total?: number };
  disk?: { free?: number };
  health_score?: number;
}

async function execCheckReport(): Promise<ExecResult> {
  const r = await invoke<SysReportResult>('sys_report').catch(() => null);
  if (!r) return { summary: 'Sys report không trả về dữ liệu.' };
  const score = r.health_score ?? 0;
  return {
    summary: `Health Score: ${score}/100. CPU: ${r.cpu?.name ?? 'n/a'}. RAM total: ${formatBytes(r.mem?.total ?? 0)}.`,
  };
}

interface FontScanResult {
  fonts?: Array<{ name?: string }>;
}

async function execFontScan(): Promise<ExecResult> {
  const r = await invoke<FontScanResult>('scan_fonts', {
    folder: 'C:\\Windows\\Fonts',
    recursive: false,
  }).catch(() => null);
  const count = r?.fonts?.length ?? 0;
  return { summary: `Quét hệ thống: ${count} font đã cài.` };
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  return `${(b / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
