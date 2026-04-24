//! TrishLauncher — Tauri 2 backend.
//!
//! Command set v1:
//! - `sys_info` → trả OS/arch/CPU/mem cho Launcher hiển thị compat với app.
//! - `app_version` → version launcher từ Cargo metadata.
//! - `open_external` → mở URL/file path bằng opener plugin (wrap lại để
//!   front-end không phải import plugin trực tiếp) — vẫn dùng plugin
//!   trong TypeScript bridge.
//! - `detect_install` → probe path ứng viên để biết app đã cài chưa
//!   (Phase 14.5.5.c).
//! - `launch_path` → spawn executable / mở .app / .desktop đã detect
//!   (Phase 14.5.5.c, dùng opener::open_path gián tiếp qua Command).
//!
//! Filesystem write + installer runner sẽ thêm ở Phase 14.6 khi
//! launcher quản lý install/uninstall thật.

use serde::{Deserialize, Serialize};
use std::path::Path;
use sysinfo::System;

#[derive(Debug, Serialize)]
pub struct SysInfo {
    os: String,
    os_version: String,
    arch: String,
    cpu_count: usize,
    total_memory_bytes: u64,
    hostname: String,
}

#[tauri::command]
fn sys_info() -> SysInfo {
    let mut sys = System::new_all();
    sys.refresh_all();

    SysInfo {
        os: System::name().unwrap_or_else(|| "unknown".to_string()),
        os_version: System::os_version().unwrap_or_else(|| "unknown".to_string()),
        arch: std::env::consts::ARCH.to_string(),
        cpu_count: sys.cpus().len(),
        total_memory_bytes: sys.total_memory(),
        hostname: System::host_name().unwrap_or_else(|| "unknown".to_string()),
    }
}

#[tauri::command]
fn app_version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}

// ============================================================
// Phase 14.5.5.c — Launch detection
// ============================================================

#[derive(Debug, Deserialize)]
pub struct InstallProbe {
    id: String,
    candidates: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct InstallDetection {
    id: String,
    /// "installed" | "not_installed"
    state: String,
    /// Full resolved path nếu installed, null nếu không.
    path: Option<String>,
}

/// Expand `%VAR%` (Windows style), `$VAR`/`${VAR}` (Unix) và `~/` leading
/// trong path string về absolute path. Thêm token đặc biệt `%EXE_DIR%`
/// (Phase 14.5.5.c revision): resolve về parent directory của launcher
/// binary đang chạy — dùng để detect sibling dev binary trong
/// `target-desktop/debug/` mà không false-positive ở production install.
/// Nếu env var không tồn tại, trả string nguyên (Path::exists() sẽ fail
/// sạch → không detect nhầm).
fn expand_path(raw: &str) -> String {
    let mut s = raw.to_string();

    // `%EXE_DIR%` — parent dir của launcher binary. Resolve trước mọi
    // expansion khác để tránh đụng với `%VAR%` loop bên dưới.
    if s.contains("%EXE_DIR%") {
        if let Ok(exe) = std::env::current_exe() {
            if let Some(dir) = exe.parent() {
                s = s.replace("%EXE_DIR%", &dir.to_string_lossy());
            }
        }
    }

    // Leading `~/` → $HOME (cross-platform). `~` giữa path không expand
    // để tránh nhầm file tên bắt đầu ~.
    if let Some(rest) = s.strip_prefix("~/").or_else(|| s.strip_prefix("~\\")) {
        if let Ok(home) = std::env::var("HOME").or_else(|_| std::env::var("USERPROFILE")) {
            let sep = if cfg!(windows) { "\\" } else { "/" };
            s = format!("{home}{sep}{rest}");
        }
    } else if s == "~" {
        if let Ok(home) = std::env::var("HOME").or_else(|_| std::env::var("USERPROFILE")) {
            s = home;
        }
    }

    // Windows-style `%VAR%` expansion — repeat cho tới khi không còn `%`
    // match (tránh infinite loop: guard counter).
    let mut guard = 0;
    while let (Some(start), Some(end)) = (s.find('%'), s.rfind('%')) {
        if start == end || guard > 8 {
            break;
        }
        let key = &s[start + 1..end];
        if key.is_empty() || key.contains('%') || key.contains('/') || key.contains('\\') {
            break;
        }
        match std::env::var(key) {
            Ok(val) => {
                s = format!("{}{}{}", &s[..start], val, &s[end + 1..]);
            }
            Err(_) => break,
        }
        guard += 1;
    }

    // Unix `$VAR` + `${VAR}` expansion — char-based để an toàn với
    // unicode username (user có thể set candidate `$HOME/.local/bin/x`).
    if s.contains('$') {
        let input = s;
        let mut out = String::with_capacity(input.len());
        let mut rest = input.as_str();
        while !rest.is_empty() {
            let Some(dollar_pos) = rest.find('$') else {
                out.push_str(rest);
                break;
            };
            out.push_str(&rest[..dollar_pos]);
            let after = &rest[dollar_pos + 1..];
            // ${VAR}
            if let Some(braced) = after.strip_prefix('{') {
                if let Some(close) = braced.find('}') {
                    let key = &braced[..close];
                    if let Ok(val) = std::env::var(key) {
                        out.push_str(&val);
                    }
                    rest = &braced[close + 1..];
                    continue;
                }
            }
            // $VAR — tới char không-alphanumeric/underscore
            let end = after
                .char_indices()
                .find(|(_, c)| !c.is_ascii_alphanumeric() && *c != '_')
                .map(|(idx, _)| idx)
                .unwrap_or(after.len());
            if end > 0 {
                let key = &after[..end];
                if let Ok(val) = std::env::var(key) {
                    out.push_str(&val);
                }
                rest = &after[end..];
            } else {
                // `$` đứng một mình hoặc theo sau ký tự không hợp lệ — giữ nguyên.
                out.push('$');
                rest = after;
            }
        }
        s = out;
    }

    s
}

/// Probe 1 app × N candidates — path đầu tiên tồn tại = installed,
/// trả full resolved path. Không tồn tại cái nào → not_installed.
fn detect_one(probe: InstallProbe) -> InstallDetection {
    for raw in probe.candidates.iter() {
        let expanded = expand_path(raw);
        let path = Path::new(&expanded);
        if path.exists() {
            return InstallDetection {
                id: probe.id,
                state: "installed".to_string(),
                path: Some(expanded),
            };
        }
    }
    InstallDetection {
        id: probe.id,
        state: "not_installed".to_string(),
        path: None,
    }
}

#[tauri::command]
fn detect_install(probes: Vec<InstallProbe>) -> Vec<InstallDetection> {
    probes.into_iter().map(detect_one).collect()
}

/// Launch installed app — mở path bằng opener plugin pattern. Dùng
/// `open::that()` không trực tiếp vì cần bắt error đẩy lên UI, nên
/// spawn process thủ công:
/// - Windows: `cmd /c start "" <path>` để shell xử lý .exe / shortcut
/// - macOS: `open -a <path>` để mở .app bundle
/// - Linux: `xdg-open <path>` để shell xử lý .desktop / binary
///
/// Return OK("ok") khi spawn thành công, Err(String) khi fail — UI
/// hiện toast nếu cần.
#[tauri::command]
fn launch_path(path: String) -> Result<String, String> {
    use std::process::Command;

    if path.trim().is_empty() {
        return Err("empty path".to_string());
    }

    // Bảo vệ: chỉ cho mở path thực sự tồn tại trên máy. Tránh UI gửi
    // nhầm URL lên đây.
    if !Path::new(&path).exists() {
        return Err(format!("path not found: {path}"));
    }

    #[cfg(target_os = "windows")]
    let result = Command::new("cmd").args(["/c", "start", "", &path]).spawn();

    #[cfg(target_os = "macos")]
    let result = Command::new("open").args(["-a", &path]).spawn();

    #[cfg(target_os = "linux")]
    let result = Command::new("xdg-open").arg(&path).spawn();

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    let result: std::io::Result<std::process::Child> =
        Err(std::io::Error::new(std::io::ErrorKind::Unsupported, "os"));

    match result {
        Ok(_child) => Ok("ok".to_string()),
        Err(e) => Err(format!("spawn failed: {e}")),
    }
}

// ============================================================
// Tauri bootstrap
// ============================================================

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            sys_info,
            app_version,
            detect_install,
            launch_path
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
