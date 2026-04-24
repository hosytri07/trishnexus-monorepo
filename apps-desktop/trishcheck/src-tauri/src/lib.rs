//! TrishCheck — lightweight hardware checker cho TrishTEAM ecosystem.
//!
//! Commands:
//! - `sys_report` → snapshot OS/CPU/RAM/swap/uptime.
//! - `cpu_benchmark` → SHA-256 throughput trên 50 MB buffer ngẫu nhiên
//!   (single-thread, repeat N vòng, trả MB/s). Chỉ số này ổn định và
//!   so sánh được giữa các máy, không phụ thuộc GPU hay disk.
//! - `memory_bandwidth` → copy 64 MB tới buffer thứ 2 đo MB/s.
//!
//! Không dùng crate rand để tránh thêm dep — buffer seed từ counter
//! đơn giản, đủ entropy cho benchmark (không phải crypto).

use serde::Serialize;
use sha2::{Digest, Sha256};
use std::time::Instant;
use sysinfo::System;

#[derive(Debug, Serialize)]
pub struct SysReport {
    os: String,
    os_version: String,
    arch: String,
    cpu_brand: String,
    cpu_cores: usize,
    cpu_freq_mhz: u64,
    total_memory_bytes: u64,
    used_memory_bytes: u64,
    total_swap_bytes: u64,
    uptime_seconds: u64,
    hostname: String,
}

#[tauri::command]
fn sys_report() -> SysReport {
    let mut sys = System::new_all();
    sys.refresh_all();

    let (cpu_brand, cpu_freq_mhz) = sys
        .cpus()
        .first()
        .map(|c| (c.brand().to_string(), c.frequency()))
        .unwrap_or_else(|| ("unknown".to_string(), 0));

    SysReport {
        os: System::name().unwrap_or_else(|| "unknown".to_string()),
        os_version: System::os_version().unwrap_or_else(|| "unknown".to_string()),
        arch: std::env::consts::ARCH.to_string(),
        cpu_brand,
        cpu_cores: sys.cpus().len(),
        cpu_freq_mhz,
        total_memory_bytes: sys.total_memory(),
        used_memory_bytes: sys.used_memory(),
        total_swap_bytes: sys.total_swap(),
        uptime_seconds: System::uptime(),
        hostname: System::host_name().unwrap_or_else(|| "unknown".to_string()),
    }
}

#[derive(Debug, Serialize)]
pub struct BenchResult {
    pub bytes_processed: u64,
    pub elapsed_ms: u128,
    pub throughput_mb_per_s: f64,
}

/// Hash 50 MB liên tục trong `rounds` vòng → trả MB/s.
#[tauri::command]
fn cpu_benchmark(rounds: Option<u32>) -> BenchResult {
    let rounds = rounds.unwrap_or(3).clamp(1, 20);
    let buffer: Vec<u8> = (0..50_000_000u32).map(|i| (i & 0xff) as u8).collect();
    let mut total_bytes: u64 = 0;

    let started = Instant::now();
    for _ in 0..rounds {
        let mut hasher = Sha256::new();
        hasher.update(&buffer);
        let _ = hasher.finalize();
        total_bytes += buffer.len() as u64;
    }
    let elapsed = started.elapsed();
    let mb = total_bytes as f64 / 1_048_576.0;
    let throughput = if elapsed.as_secs_f64() > 0.0 {
        mb / elapsed.as_secs_f64()
    } else {
        0.0
    };

    BenchResult {
        bytes_processed: total_bytes,
        elapsed_ms: elapsed.as_millis(),
        throughput_mb_per_s: throughput,
    }
}

/// Copy 64 MB source → dest `rounds` lần → MB/s.
#[tauri::command]
fn memory_bandwidth(rounds: Option<u32>) -> BenchResult {
    let rounds = rounds.unwrap_or(5).clamp(1, 30);
    let size = 64 * 1024 * 1024;
    let src: Vec<u8> = vec![0xA5; size];
    let mut dst: Vec<u8> = vec![0u8; size];
    let mut total_bytes: u64 = 0;

    let started = Instant::now();
    for _ in 0..rounds {
        dst.copy_from_slice(&src);
        total_bytes += size as u64;
    }
    let elapsed = started.elapsed();
    let mb = total_bytes as f64 / 1_048_576.0;
    let throughput = if elapsed.as_secs_f64() > 0.0 {
        mb / elapsed.as_secs_f64()
    } else {
        0.0
    };

    // Prevent dead-code elimination.
    std::hint::black_box(&dst);

    BenchResult {
        bytes_processed: total_bytes,
        elapsed_ms: elapsed.as_millis(),
        throughput_mb_per_s: throughput,
    }
}

#[tauri::command]
fn app_version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            sys_report,
            cpu_benchmark,
            memory_bandwidth,
            app_version,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
