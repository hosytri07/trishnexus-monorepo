/**
 * Phase 15.0 — TrishCheck Tauri bridge.
 *
 * Wrap `@tauri-apps/api/core` invoke với fallback browser-dev mode để
 * UI render được khi `pnpm dev` thuần (không có Tauri runtime).
 */

import { invoke } from '@tauri-apps/api/core';

export interface DiskInfo {
  name: string;
  mount_point: string;
  file_system: string;
  total_bytes: number;
  available_bytes: number;
  is_removable: boolean;
}

export interface NetworkAdapter {
  name: string;
  mac_address: string;
  received_bytes: number;
  transmitted_bytes: number;
}

export interface GpuInfo {
  name: string;
  /** VRAM bytes. 0 = không detect. ~4_294_967_295 = capped (cần show "≥4 GB"). */
  vram_bytes: number;
  driver_version: string;
  /** Heuristic: nvidia / amd / intel / apple / unknown */
  vendor: string;
  is_integrated: boolean;
}

export interface SysReport {
  // Base
  os: string;
  os_version: string;
  arch: string;
  hostname: string;
  uptime_seconds: number;
  // CPU
  cpu_brand: string;
  cpu_cores: number;
  cpu_freq_mhz: number;
  // Memory
  total_memory_bytes: number;
  used_memory_bytes: number;
  total_swap_bytes: number;
  // Hardware
  disks: DiskInfo[];
  networks: NetworkAdapter[];
  gpus: GpuInfo[];
}

export interface BenchResult {
  bytes_processed: number;
  elapsed_ms: number;
  throughput_mb_per_s: number;
}

export interface DiskBenchResult {
  write_throughput_mb_per_s: number;
  read_throughput_mb_per_s: number;
  write_elapsed_ms: number;
  read_elapsed_ms: number;
  bytes_processed: number;
}

export interface BatteryInfo {
  has_battery: boolean;
  percent: number;
  status_code: number;
  status_label: string;
  design_capacity_mwh: number;
  full_charge_capacity_mwh: number;
  health_pct: number;
}

export interface ProcessInfo {
  pid: number;
  name: string;
  memory_bytes: number;
  cpu_percent: number;
}

export interface TopProcesses {
  by_memory: ProcessInfo[];
  by_cpu: ProcessInfo[];
}

const FALLBACK_SYS: SysReport = {
  os: 'browser-dev',
  os_version: '0',
  arch: 'unknown',
  hostname: 'dev',
  uptime_seconds: 0,
  cpu_brand: 'N/A (dev mode)',
  cpu_cores: 0,
  cpu_freq_mhz: 0,
  total_memory_bytes: 0,
  used_memory_bytes: 0,
  total_swap_bytes: 0,
  disks: [],
  networks: [],
  gpus: [],
};

const FALLBACK_BENCH: BenchResult = {
  bytes_processed: 0,
  elapsed_ms: 0,
  throughput_mb_per_s: 0,
};

function isInTauri(): boolean {
  return (
    typeof window !== 'undefined' &&
    // @ts-expect-error — __TAURI_INTERNALS__ injected bởi runtime
    typeof window.__TAURI_INTERNALS__ !== 'undefined'
  );
}

export async function getSysReport(): Promise<SysReport> {
  if (!isInTauri()) return FALLBACK_SYS;
  try {
    return await invoke<SysReport>('sys_report');
  } catch (err) {
    console.warn('[trishcheck] sys_report failed:', err);
    return FALLBACK_SYS;
  }
}

export async function runCpuBenchmark(rounds = 3): Promise<BenchResult> {
  if (!isInTauri()) return FALLBACK_BENCH;
  try {
    return await invoke<BenchResult>('cpu_benchmark', { rounds });
  } catch (err) {
    console.warn('[trishcheck] cpu_benchmark failed:', err);
    return FALLBACK_BENCH;
  }
}

export async function runMemoryBandwidth(rounds = 5): Promise<BenchResult> {
  if (!isInTauri()) return FALLBACK_BENCH;
  try {
    return await invoke<BenchResult>('memory_bandwidth', { rounds });
  } catch (err) {
    console.warn('[trishcheck] memory_bandwidth failed:', err);
    return FALLBACK_BENCH;
  }
}

const FALLBACK_DISK_BENCH: DiskBenchResult = {
  write_throughput_mb_per_s: 0,
  read_throughput_mb_per_s: 0,
  write_elapsed_ms: 0,
  read_elapsed_ms: 0,
  bytes_processed: 0,
};

export async function runDiskBenchmark(sizeMb = 100): Promise<DiskBenchResult> {
  if (!isInTauri()) return FALLBACK_DISK_BENCH;
  try {
    return await invoke<DiskBenchResult>('disk_benchmark', { sizeMb });
  } catch (err) {
    console.warn('[trishcheck] disk_benchmark failed:', err);
    return FALLBACK_DISK_BENCH;
  }
}

export async function getBatteryInfo(): Promise<BatteryInfo> {
  const fallback: BatteryInfo = {
    has_battery: false,
    percent: 0,
    status_code: 0,
    status_label: 'unknown',
    design_capacity_mwh: 0,
    full_charge_capacity_mwh: 0,
    health_pct: 0,
  };
  if (!isInTauri()) return fallback;
  try {
    return await invoke<BatteryInfo>('battery_info');
  } catch (err) {
    console.warn('[trishcheck] battery_info failed:', err);
    return fallback;
  }
}

export async function getTopProcesses(limit = 5): Promise<TopProcesses> {
  const fallback: TopProcesses = { by_memory: [], by_cpu: [] };
  if (!isInTauri()) return fallback;
  try {
    return await invoke<TopProcesses>('top_processes', { limit });
  } catch (err) {
    console.warn('[trishcheck] top_processes failed:', err);
    return fallback;
  }
}

export async function getAppVersion(): Promise<string> {
  if (!isInTauri()) return 'dev';
  try {
    return await invoke<string>('app_version');
  } catch {
    return 'dev';
  }
}

/**
 * Phase 15.0.l — Fetch URL via Rust (bypass CORS/CSP).
 * Browser dev mode (no Tauri) → fallback to browser fetch (sẽ bị CORS
 * nếu cross-origin, OK cho dev — chỉ test UI).
 */
export async function fetchText(url: string): Promise<string> {
  if (!isInTauri()) {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }
    return res.text();
  }
  return invoke<string>('fetch_text', { url });
}

/**
 * Phase 15.0.o — Save text file vào Downloads folder qua Rust.
 *
 * Trả full path đã lưu (vd `C:\Users\TRI\Downloads\trishcheck-report.json`)
 * để UI hiện toast confirm. Throw nếu fail.
 *
 * Browser dev mode: fallback dùng anchor download (giới hạn cũ — có
 * thể không work trong WebView2 nhưng OK cho browser test).
 */
export async function saveReport(
  filename: string,
  content: string,
): Promise<string> {
  if (!isInTauri()) {
    // Fallback browser anchor — chỉ dùng khi `pnpm dev` thuần
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return `~/Downloads/${filename} (browser fallback)`;
  }
  return invoke<string>('save_report', { filename, content });
}
