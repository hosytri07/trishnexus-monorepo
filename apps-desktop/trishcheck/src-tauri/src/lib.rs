//! TrishCheck — lightweight hardware checker cho TrishTEAM ecosystem.
//!
//! Commands:
//! - `sys_report` → snapshot OS/CPU/RAM/swap/uptime + disks + networks.
//! - `cpu_benchmark` → SHA-256 throughput trên 50 MB buffer
//!   (single-thread, repeat N vòng, trả MB/s). Chỉ số này ổn định và
//!   so sánh được giữa các máy, không phụ thuộc GPU hay disk.
//! - `memory_bandwidth` → copy 64 MB tới buffer thứ 2 đo MB/s.
//! - `app_version` → version từ Cargo metadata.
//!
//! Phase 15.0 — extend `SysReport` thêm `disks` + `networks` cho UI
//! Min-spec compare (cần biết disk free space) + Network section.

use serde::Serialize;
use sha2::{Digest, Sha256};
use std::time::Instant;
use sysinfo::{Disks, Networks, System};

#[derive(Debug, Serialize)]
pub struct DiskInfo {
    name: String,
    mount_point: String,
    file_system: String,
    total_bytes: u64,
    available_bytes: u64,
    is_removable: bool,
}

#[derive(Debug, Serialize)]
pub struct NetworkAdapter {
    name: String,
    mac_address: String,
    received_bytes: u64,
    transmitted_bytes: u64,
}

#[derive(Debug, Serialize)]
pub struct GpuInfo {
    name: String,
    /// VRAM bytes. 0 = không detect được. Win32 cap ở 4GB cho GPU >4GB
    /// (uint32 limitation) → show "≥4GB" trên UI nếu = 4_294_967_295.
    vram_bytes: u64,
    driver_version: String,
    /// Vendor heuristic: nvidia / amd / intel / apple / unknown.
    vendor: String,
    /// True nếu là iGPU integrated (Intel HD/UHD/Iris, AMD Vega APU).
    /// False nếu là card rời (NVIDIA, AMD Radeon RX, ...).
    is_integrated: bool,
}

#[derive(Debug, Serialize)]
pub struct SysReport {
    // Base
    os: String,
    os_version: String,
    arch: String,
    hostname: String,
    uptime_seconds: u64,
    // CPU
    cpu_brand: String,
    cpu_cores: usize,
    cpu_freq_mhz: u64,
    // Memory
    total_memory_bytes: u64,
    used_memory_bytes: u64,
    total_swap_bytes: u64,
    // Disk + Network
    disks: Vec<DiskInfo>,
    networks: Vec<NetworkAdapter>,
    // Phase 15.0.m — GPU
    gpus: Vec<GpuInfo>,
}

fn collect_disks() -> Vec<DiskInfo> {
    let disks = Disks::new_with_refreshed_list();
    disks
        .iter()
        .map(|d| DiskInfo {
            name: d.name().to_string_lossy().to_string(),
            mount_point: d.mount_point().to_string_lossy().to_string(),
            file_system: d.file_system().to_string_lossy().to_string(),
            total_bytes: d.total_space(),
            available_bytes: d.available_space(),
            is_removable: d.is_removable(),
        })
        .collect()
}

fn collect_networks() -> Vec<NetworkAdapter> {
    let networks = Networks::new_with_refreshed_list();
    networks
        .iter()
        .map(|(name, data)| NetworkAdapter {
            name: name.clone(),
            mac_address: data.mac_address().to_string(),
            received_bytes: data.total_received(),
            transmitted_bytes: data.total_transmitted(),
        })
        .collect()
}

// ============================================================
// Phase 15.0.m — GPU detection (cross-platform via shell)
// ============================================================

fn classify_gpu_vendor(name: &str) -> (String, bool) {
    let lower = name.to_lowercase();
    let vendor = if lower.contains("nvidia")
        || lower.contains("geforce")
        || lower.contains("rtx")
        || lower.contains("gtx")
        || lower.contains("quadro")
        || lower.contains("tesla")
    {
        "nvidia"
    } else if lower.contains("radeon") || lower.contains("amd") {
        "amd"
    } else if lower.contains("intel")
        || lower.contains(" hd graphics")
        || lower.contains("uhd")
        || lower.contains("iris")
    {
        "intel"
    } else if lower.contains("apple") || lower.contains("m1") || lower.contains("m2") || lower.contains("m3") {
        "apple"
    } else {
        "unknown"
    };

    // Heuristic: iGPU = Intel HD/UHD/Iris, Apple silicon, AMD Vega/Radeon Graphics (APU).
    let is_integrated = match vendor {
        "intel" => true,
        "apple" => true,
        "amd" => lower.contains("vega") && !lower.contains("rx"), // RX = dGPU
        _ => false,
    };

    (vendor.to_string(), is_integrated)
}

fn collect_gpus() -> Vec<GpuInfo> {
    #[cfg(target_os = "windows")]
    {
        return collect_gpus_windows();
    }
    #[cfg(target_os = "macos")]
    {
        return collect_gpus_macos();
    }
    #[cfg(target_os = "linux")]
    {
        return collect_gpus_linux();
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        Vec::new()
    }
}

#[cfg(target_os = "windows")]
fn collect_gpus_windows() -> Vec<GpuInfo> {
    use std::process::Command;

    // PowerShell `Get-CimInstance` trả JSON sạch — parse dễ hơn `wmic` legacy.
    // -NoProfile để không load profile (fast startup). ConvertTo-Json -Compress
    // giảm kích thước output.
    let output = Command::new("powershell")
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            "Get-CimInstance Win32_VideoController | Select-Object Name,AdapterRAM,DriverVersion | ConvertTo-Json -Compress",
        ])
        .output();

    let Ok(output) = output else {
        return Vec::new();
    };
    if !output.status.success() {
        return Vec::new();
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let trimmed = stdout.trim();
    if trimmed.is_empty() {
        return Vec::new();
    }

    // PowerShell ConvertTo-Json trả single object nếu 1 GPU, array nếu 2+.
    // Wrap vào array nếu là single object để parse uniform.
    let json_str = if trimmed.starts_with('[') {
        trimmed.to_string()
    } else {
        format!("[{}]", trimmed)
    };

    let Ok(parsed) = serde_json::from_str::<Vec<serde_json::Value>>(&json_str) else {
        return Vec::new();
    };

    parsed
        .into_iter()
        .filter_map(|v| {
            let name = v.get("Name")?.as_str()?.trim().to_string();
            if name.is_empty() {
                return None;
            }
            // AdapterRAM trong PowerShell có thể là number, null, hoặc string
            let vram_bytes = v
                .get("AdapterRAM")
                .and_then(|x| x.as_u64())
                .unwrap_or(0);
            let driver_version = v
                .get("DriverVersion")
                .and_then(|x| x.as_str())
                .unwrap_or("")
                .trim()
                .to_string();
            let (vendor, is_integrated) = classify_gpu_vendor(&name);
            Some(GpuInfo {
                name,
                vram_bytes,
                driver_version,
                vendor,
                is_integrated,
            })
        })
        .collect()
}

#[cfg(target_os = "macos")]
fn collect_gpus_macos() -> Vec<GpuInfo> {
    use std::process::Command;

    let output = Command::new("system_profiler")
        .args(["SPDisplaysDataType", "-json"])
        .output();

    let Ok(output) = output else {
        return Vec::new();
    };
    if !output.status.success() {
        return Vec::new();
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&stdout) else {
        return Vec::new();
    };

    let Some(displays) = parsed.get("SPDisplaysDataType").and_then(|v| v.as_array()) else {
        return Vec::new();
    };

    displays
        .iter()
        .filter_map(|d| {
            let name = d
                .get("sppci_model")
                .or_else(|| d.get("_name"))
                .and_then(|v| v.as_str())?
                .trim()
                .to_string();
            // VRAM string "8 GB" → bytes (best-effort parse)
            let vram_bytes = d
                .get("spdisplays_vram_shared")
                .or_else(|| d.get("sppci_vram"))
                .and_then(|v| v.as_str())
                .and_then(parse_vram_string)
                .unwrap_or(0);
            let (vendor, is_integrated) = classify_gpu_vendor(&name);
            Some(GpuInfo {
                name,
                vram_bytes,
                driver_version: String::new(),
                vendor,
                is_integrated,
            })
        })
        .collect()
}

#[cfg(target_os = "linux")]
fn collect_gpus_linux() -> Vec<GpuInfo> {
    use std::process::Command;

    let output = Command::new("lspci").args(["-mm"]).output();

    let Ok(output) = output else {
        return Vec::new();
    };
    if !output.status.success() {
        return Vec::new();
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    stdout
        .lines()
        .filter(|l| {
            let lower = l.to_lowercase();
            lower.contains("vga") || lower.contains("3d controller") || lower.contains("display")
        })
        .filter_map(|line| {
            // lspci -mm: "00:02.0 \"VGA compatible controller\" \"Intel\" \"HD Graphics 630\" ..."
            // Parse vendor + device in quoted fields.
            let parts: Vec<&str> = line.split('"').collect();
            if parts.len() < 7 {
                return None;
            }
            let vendor_str = parts[3].trim();
            let device_str = parts[5].trim();
            let name = format!("{vendor_str} {device_str}");
            let (vendor, is_integrated) = classify_gpu_vendor(&name);
            Some(GpuInfo {
                name,
                vram_bytes: 0, // lspci không cho VRAM — cần `nvidia-smi` etc.
                driver_version: String::new(),
                vendor,
                is_integrated,
            })
        })
        .collect()
}

#[allow(dead_code)]
fn parse_vram_string(s: &str) -> Option<u64> {
    let trimmed = s.trim();
    let lower = trimmed.to_lowercase();
    let (num_str, mult) = if let Some(rest) = lower.strip_suffix(" gb") {
        (rest, 1_073_741_824u64)
    } else if let Some(rest) = lower.strip_suffix(" mb") {
        (rest, 1_048_576u64)
    } else {
        return None;
    };
    num_str.trim().parse::<f64>().ok().map(|n| (n * mult as f64) as u64)
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
        hostname: System::host_name().unwrap_or_else(|| "unknown".to_string()),
        uptime_seconds: System::uptime(),
        cpu_brand,
        cpu_cores: sys.cpus().len(),
        cpu_freq_mhz,
        total_memory_bytes: sys.total_memory(),
        used_memory_bytes: sys.used_memory(),
        total_swap_bytes: sys.total_swap(),
        disks: collect_disks(),
        networks: collect_networks(),
        gpus: collect_gpus(),
    }
}

#[derive(Debug, Serialize)]
pub struct BenchResult {
    pub bytes_processed: u64,
    pub elapsed_ms: u128,
    pub throughput_mb_per_s: f64,
}

/// Hash 50 MB × N rounds, parallel trên tất cả CPU core → trả MB/s tổng.
///
/// Phase 15.0 fix: chuyển từ single-thread → multi-thread vì:
/// - Single-thread bench cho 20-core machine = 78 MB/s khiến user nghĩ
///   máy yếu (nhưng thật ra chỉ là 1 core single-thread).
/// - Multi-thread reflect total compute capability — số liệu này khớp
///   với cảm nhận thực tế khi user chạy app nặng (Photoshop, Premiere
///   đều multi-threaded).
/// - Dùng `std::thread::scope` (stable từ Rust 1.63), không cần thêm
///   dep rayon.
///
/// Kết quả expected:
/// - 4-core mid-range 2024: ~1500-2500 MB/s
/// - 8-core 2025: ~3000-5000 MB/s
/// - 16-20 core 2026: ~5000-10000 MB/s
#[tauri::command]
fn cpu_benchmark(rounds: Option<u32>) -> BenchResult {
    let rounds = rounds.unwrap_or(3).clamp(1, 20);
    // Mỗi thread hash riêng 50MB buffer × `rounds` lần.
    // Scaling theo CPU count → bench tận dụng hết core.
    let n_threads = std::thread::available_parallelism()
        .map(|n| n.get())
        .unwrap_or(1);

    let buffer_size = 50_000_000usize;
    let total_bytes_expected: u64 =
        (buffer_size as u64) * (rounds as u64) * (n_threads as u64);

    let started = Instant::now();
    std::thread::scope(|s| {
        for _ in 0..n_threads {
            s.spawn(|| {
                let buffer: Vec<u8> =
                    (0..buffer_size).map(|i| (i & 0xff) as u8).collect();
                for _ in 0..rounds {
                    let mut hasher = Sha256::new();
                    hasher.update(&buffer);
                    let _ = hasher.finalize();
                }
            });
        }
    });
    let elapsed = started.elapsed();

    let mb = total_bytes_expected as f64 / 1_048_576.0;
    let throughput = if elapsed.as_secs_f64() > 0.0 {
        mb / elapsed.as_secs_f64()
    } else {
        0.0
    };

    BenchResult {
        bytes_processed: total_bytes_expected,
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

// ============================================================
// Phase 15.0.n.A — Disk benchmark (write/read sequential)
// ============================================================
//
// Write 100MB file to system temp dir → measure write throughput,
// read it back → measure read throughput, cleanup. Sequential I/O
// thay vì random — số liệu phổ biến nhất manufacturers công bố
// (ví dụ Samsung 980 EVO: 7000 MB/s seq read, 5100 MB/s seq write).
//
// Note: kết quả phụ thuộc OS file cache. Đầu tiên test có thể
// inflated do cached. Production user thấy số phù hợp nhất khi
// test 1-2 lần.

#[derive(Debug, Serialize)]
pub struct DiskBenchResult {
    pub write_throughput_mb_per_s: f64,
    pub read_throughput_mb_per_s: f64,
    pub write_elapsed_ms: u128,
    pub read_elapsed_ms: u128,
    pub bytes_processed: u64,
}

#[tauri::command]
fn disk_benchmark(size_mb: Option<u32>) -> Result<DiskBenchResult, String> {
    use std::fs;
    use std::io::{Read, Write};

    let size_mb = size_mb.unwrap_or(100).clamp(10, 500);
    let total_bytes = (size_mb as u64) * 1024 * 1024;
    let chunk_size = 512 * 1024; // 512 KB chunks
    let chunks = (total_bytes as usize) / chunk_size;

    let temp_dir = std::env::temp_dir();
    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let temp_path = temp_dir.join(format!("trishcheck_diskbench_{ts}.tmp"));

    let buffer: Vec<u8> = vec![0xA5u8; chunk_size];

    // Write
    let write_started = Instant::now();
    {
        let mut file = fs::File::create(&temp_path)
            .map_err(|e| format!("create file failed: {e}"))?;
        for _ in 0..chunks {
            file.write_all(&buffer)
                .map_err(|e| format!("write failed: {e}"))?;
        }
        file.sync_all()
            .map_err(|e| format!("sync failed: {e}"))?;
    }
    let write_elapsed = write_started.elapsed();

    // Read
    let read_started = Instant::now();
    {
        let mut file = fs::File::open(&temp_path)
            .map_err(|e| format!("open file failed: {e}"))?;
        let mut read_buf = vec![0u8; chunk_size];
        for _ in 0..chunks {
            file.read_exact(&mut read_buf)
                .map_err(|e| format!("read failed: {e}"))?;
        }
    }
    let read_elapsed = read_started.elapsed();

    // Cleanup (ignore error — file might be locked briefly by AV)
    let _ = fs::remove_file(&temp_path);

    let mb = total_bytes as f64 / 1_048_576.0;
    let write_throughput = if write_elapsed.as_secs_f64() > 0.0 {
        mb / write_elapsed.as_secs_f64()
    } else {
        0.0
    };
    let read_throughput = if read_elapsed.as_secs_f64() > 0.0 {
        mb / read_elapsed.as_secs_f64()
    } else {
        0.0
    };

    Ok(DiskBenchResult {
        write_throughput_mb_per_s: write_throughput,
        read_throughput_mb_per_s: read_throughput,
        write_elapsed_ms: write_elapsed.as_millis(),
        read_elapsed_ms: read_elapsed.as_millis(),
        bytes_processed: total_bytes,
    })
}

// ============================================================
// Phase 15.0.n.B — Battery info (laptop)
// ============================================================
//
// Win32_Battery qua PowerShell. Trên desktop không có pin → trả None.
// macOS/Linux chưa support — trả None.

#[derive(Debug, Serialize)]
pub struct BatteryInfo {
    pub has_battery: bool,
    /// 0-100, EstimatedChargeRemaining
    pub percent: u8,
    /// 1=discharging, 2=AC plugged, 3=fully charged, 4=low, 5=critical, ...
    /// Ta convert sang label dễ hiểu phía TS.
    pub status_code: u8,
    pub status_label: String,
    /// Design capacity mWh (initial battery capacity)
    pub design_capacity_mwh: u64,
    /// Full charge capacity mWh hiện tại — nhỏ hơn design = pin bị chai
    pub full_charge_capacity_mwh: u64,
    /// Tỉ lệ sức khỏe pin: full / design × 100. 0 nếu không đo được.
    pub health_pct: u8,
}

#[tauri::command]
fn battery_info() -> BatteryInfo {
    #[cfg(target_os = "windows")]
    {
        return battery_info_windows().unwrap_or(BatteryInfo {
            has_battery: false,
            percent: 0,
            status_code: 0,
            status_label: "no battery".to_string(),
            design_capacity_mwh: 0,
            full_charge_capacity_mwh: 0,
            health_pct: 0,
        });
    }
    #[cfg(not(target_os = "windows"))]
    {
        BatteryInfo {
            has_battery: false,
            percent: 0,
            status_code: 0,
            status_label: "unsupported os".to_string(),
            design_capacity_mwh: 0,
            full_charge_capacity_mwh: 0,
            health_pct: 0,
        }
    }
}

#[cfg(target_os = "windows")]
fn battery_info_windows() -> Option<BatteryInfo> {
    use std::process::Command;

    // Multi-step: Win32_Battery cho percent + status, root\WMI BatteryStaticData
    // + BatteryFullChargedCapacity cho design + full capacity. Combine.
    let script = r#"
$ErrorActionPreference = 'SilentlyContinue'
$bat = Get-CimInstance Win32_Battery | Select-Object -First 1
if (-not $bat) { Write-Output 'NOBATTERY'; exit }
$static = Get-CimInstance -Namespace root\WMI -ClassName BatteryStaticData | Select-Object -First 1
$full = Get-CimInstance -Namespace root\WMI -ClassName BatteryFullChargedCapacity | Select-Object -First 1
$result = @{
  percent = [int]$bat.EstimatedChargeRemaining
  status = [int]$bat.BatteryStatus
  designCapacity = [int64]$static.DesignedCapacity
  fullCapacity = [int64]$full.FullChargedCapacity
}
$result | ConvertTo-Json -Compress
"#;

    let output = Command::new("powershell")
        .args(["-NoProfile", "-NonInteractive", "-Command", script])
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if stdout == "NOBATTERY" || stdout.is_empty() {
        return None;
    }
    let parsed: serde_json::Value = serde_json::from_str(&stdout).ok()?;

    let percent = parsed.get("percent")?.as_u64().unwrap_or(0).min(100) as u8;
    let status_code = parsed.get("status")?.as_u64().unwrap_or(0) as u8;
    let design = parsed.get("designCapacity")?.as_u64().unwrap_or(0);
    let full = parsed.get("fullCapacity")?.as_u64().unwrap_or(0);
    let health_pct = if design > 0 {
        ((full as f64 / design as f64) * 100.0).min(100.0) as u8
    } else {
        0
    };

    let status_label = match status_code {
        1 => "Đang xả pin",
        2 => "Đang sạc",
        3 => "Đầy pin",
        4 => "Sắp hết",
        5 => "Cực thấp",
        6 => "Đang sạc + cao",
        7 => "Đang sạc + thấp",
        8 => "Đang sạc + cực thấp",
        9 => "Đang xả ổn định",
        10 => "Trạng thái không xác định",
        11 => "Một phần đã sạc",
        _ => "Không xác định",
    };

    Some(BatteryInfo {
        has_battery: true,
        percent,
        status_code,
        status_label: status_label.to_string(),
        design_capacity_mwh: design,
        full_charge_capacity_mwh: full,
        health_pct,
    })
}

// ============================================================
// Phase 15.0.n.C — Top processes (top RAM + top CPU)
// ============================================================

#[derive(Debug, Serialize, Clone)]
pub struct ProcessInfo {
    pub pid: u32,
    pub name: String,
    pub memory_bytes: u64,
    pub cpu_percent: f32,
}

#[derive(Debug, Serialize)]
pub struct TopProcesses {
    pub by_memory: Vec<ProcessInfo>,
    pub by_cpu: Vec<ProcessInfo>,
}

#[tauri::command]
fn top_processes(limit: Option<usize>) -> TopProcesses {
    let n = limit.unwrap_or(5).clamp(3, 20);
    let mut sys = System::new_all();
    sys.refresh_all();
    // Refresh CPU twice for accurate % (sysinfo cần 2 sample)
    std::thread::sleep(std::time::Duration::from_millis(200));
    sys.refresh_processes();

    let mut all: Vec<ProcessInfo> = sys
        .processes()
        .iter()
        .map(|(pid, proc)| ProcessInfo {
            pid: pid.as_u32(),
            name: proc.name().to_string(),
            memory_bytes: proc.memory(),
            cpu_percent: proc.cpu_usage(),
        })
        .collect();

    // Top N by memory
    let mut by_mem = all.clone();
    by_mem.sort_by(|a, b| b.memory_bytes.cmp(&a.memory_bytes));
    by_mem.truncate(n);

    // Top N by CPU
    all.sort_by(|a, b| b.cpu_percent.partial_cmp(&a.cpu_percent).unwrap_or(std::cmp::Ordering::Equal));
    all.truncate(n);

    TopProcesses {
        by_memory: by_mem,
        by_cpu: all,
    }
}

// ============================================================
// Phase 15.0.o — Save report (Tauri 2 path resolver)
// ============================================================
//
// Bug history: anchor `<a download>` + blob URL không trigger download
// trong Tauri WebView2 vì CSP không allow `blob:` + WebView2 không có
// download manager UI. Workaround: viết file trực tiếp qua Rust dùng
// Tauri 2's `app.path().download_dir()` (built-in, không cần plugin).
// Trả full path để frontend show toast "Đã lưu: <path>".

#[tauri::command]
fn save_report(
    app: tauri::AppHandle,
    filename: String,
    content: String,
) -> Result<String, String> {
    use std::fs;
    use tauri::Manager;

    let downloads = app
        .path()
        .download_dir()
        .map_err(|e| format!("get download dir: {e}"))?;
    let full_path = downloads.join(&filename);
    fs::write(&full_path, content).map_err(|e| format!("write file: {e}"))?;
    Ok(full_path.to_string_lossy().to_string())
}

// ============================================================
// Phase 15.0.l — HTTP fetch (cho min-specs.json + future remote data)
// ============================================================

/// Fetch URL trả body text. Rust dùng reqwest nên không bị CORS/CSP/redirect
/// browser. Frontend nhận text rồi tự JSON.parse.
///
/// Pattern giống TrishLauncher fetch_registry_text — copy-paste để mỗi app
/// self-contained, không cần share crate khi 2 hàm 30 dòng.
#[tauri::command]
async fn fetch_text(url: String) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .user_agent(concat!("TrishCheck/", env!("CARGO_PKG_VERSION")))
        .build()
        .map_err(|e| format!("client build failed: {e}"))?;

    let resp = client
        .get(&url)
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| format!("request failed: {e}"))?;

    let status = resp.status();
    if !status.is_success() {
        return Err(format!(
            "HTTP {} {}",
            status.as_u16(),
            status.canonical_reason().unwrap_or("")
        ));
    }

    resp.text()
        .await
        .map_err(|e| format!("read body failed: {e}"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            sys_report,
            cpu_benchmark,
            memory_bandwidth,
            disk_benchmark,
            battery_info,
            top_processes,
            save_report,
            app_version,
            fetch_text,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
