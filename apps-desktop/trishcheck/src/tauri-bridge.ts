import { invoke } from '@tauri-apps/api/core';

export interface SysReport {
  os: string;
  os_version: string;
  arch: string;
  cpu_brand: string;
  cpu_cores: number;
  cpu_freq_mhz: number;
  total_memory_bytes: number;
  used_memory_bytes: number;
  total_swap_bytes: number;
  uptime_seconds: number;
  hostname: string;
}

export interface BenchResult {
  bytes_processed: number;
  elapsed_ms: number;
  throughput_mb_per_s: number;
}

const FALLBACK_SYS: SysReport = {
  os: 'browser-dev',
  os_version: '0',
  arch: 'unknown',
  cpu_brand: 'N/A (dev mode)',
  cpu_cores: 0,
  cpu_freq_mhz: 0,
  total_memory_bytes: 0,
  used_memory_bytes: 0,
  total_swap_bytes: 0,
  uptime_seconds: 0,
  hostname: 'dev',
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

export async function getAppVersion(): Promise<string> {
  if (!isInTauri()) return 'dev';
  try {
    return await invoke<string>('app_version');
  } catch {
    return 'dev';
  }
}
