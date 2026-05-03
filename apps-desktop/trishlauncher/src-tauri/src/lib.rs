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
//! - `update_tray_quick_launch` → frontend gọi sau detect_install để
//!   populate submenu tray Quick-launch (Phase 14.5.5.d).
//!
//! Filesystem write + installer runner sẽ thêm ở Phase 14.6 khi
//! launcher quản lý install/uninstall thật.

use serde::{Deserialize, Serialize};
use std::path::Path;
use std::sync::Mutex;
use sysinfo::System;
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem, Submenu},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, WindowEvent,
};

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
// Phase 14.7.g — Rust-side registry fetch
// ============================================================
//
// Tại sao fetch ở Rust thay vì frontend `fetch()`?
// - WebView2 (Edge Chromium) enforce CORS strict cho cross-origin fetch.
//   trishteam.io.vn (Vercel) không phải cùng origin với tauri://localhost
//   → cần CORS header. Vercel set `Access-Control-Allow-Origin: *` qua
//   next.config.mjs, nhưng vẫn có thể bị 307 redirect (canonicalization)
//   không đính kèm CORS header → CORS check fail trên redirect.
// - CSP `connect-src` cũng phải khớp domain — thêm khớp domain root vs
//   wildcard subdomain dễ sai.
// - Rust HTTP client không bị 2 ràng buộc đó: native HTTP, follow redirect
//   tự nhiên, không CORS check. Fetch bao nhiêu domain cũng được không
//   cần đụng CSP.
//
// Trade-off: thêm 1 dependency `reqwest` (~3MB binary) — chấp nhận được
// vì registry fetch là core feature.

/// Fetch URL trả body text. Timeout 10s. Status không 2xx → Err.
/// Frontend nhận text rồi tự JSON.parse — separation of concerns
/// (Rust không cần biết shape registry).
#[tauri::command]
async fn fetch_registry_text(url: String) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .user_agent(concat!("TrishLauncher/", env!("CARGO_PKG_VERSION")))
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
        return Err(format!("HTTP {} {}", status.as_u16(), status.canonical_reason().unwrap_or("")));
    }

    resp.text()
        .await
        .map_err(|e| format!("read body failed: {e}"))
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
// Phase 14.5.5.d — System tray
// ============================================================
//
// Yêu cầu:
// - Icon tray cùng icon app, tooltip "TrishLauncher — 10 ứng dụng tiện ích".
// - Menu tĩnh: Mở TrishLauncher / Ẩn xuống tray / separator /
//   Quick-launch (submenu động, populate sau detect_install) /
//   separator / Thoát.
// - Click trái lên icon toggle show/hide cửa sổ chính.
// - Close (X) window event → ẩn xuống tray thay vì quit (macOS vẫn
//   giữ hành vi này để đồng nhất). User thoát hẳn qua menu "Thoát".

/// 1 item trong submenu Quick-launch. `id` unique để phân biệt khi
/// user click menu event, `label` hiển thị (giữ Tiếng Việt OK),
/// `path` là resolved path từ detect_install.
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct QuickLaunchItem {
    pub id: String,
    pub label: String,
    pub path: String,
}

/// State lưu trong `app.manage()` để on_menu_event tra path từ id
/// khi user click submenu. Mutex vì TrayIconEvent / MenuEvent chạy
/// trên main thread nhưng frontend update qua IPC có thể từ worker.
///
/// Phase 20.2 — thêm `minimize_to_tray` flag. Default `false` (bấm X
/// → đóng hẳn), frontend gọi `set_close_to_tray` mỗi khi user lưu
/// Settings để cập nhật.
#[derive(Default)]
struct TrayState {
    quick_launch: Mutex<Vec<QuickLaunchItem>>,
    minimize_to_tray: Mutex<bool>,
}

/// Phase 20.2 — Frontend push setting xuống Rust để on_window_event đọc
/// được khi user bấm X. Mặc định false → đóng hẳn.
#[tauri::command]
fn set_close_to_tray(state: tauri::State<'_, TrayState>, enabled: bool) -> Result<(), String> {
    let mut guard = state
        .minimize_to_tray
        .lock()
        .map_err(|_| "minimize_to_tray lock poisoned".to_string())?;
    *guard = enabled;
    Ok(())
}

/// Build menu chính + submenu Quick-launch với N item. Tách function
/// để rebuild được khi frontend gửi list mới qua update_tray_quick_launch.
fn build_tray_menu(
    app: &AppHandle,
    items: &[QuickLaunchItem],
) -> tauri::Result<Menu<tauri::Wry>> {
    let show_i = MenuItem::with_id(app, "tray:show", "Mở TrishLauncher", true, None::<&str>)?;
    let hide_i = MenuItem::with_id(app, "tray:hide", "Ẩn xuống tray", true, None::<&str>)?;
    let sep1 = PredefinedMenuItem::separator(app)?;

    // Submenu Quick-launch — nếu rỗng thì disable để user biết chưa detect
    // xong (hoặc chưa cài app nào).
    let submenu = if items.is_empty() {
        let placeholder = MenuItem::with_id(
            app,
            "tray:ql:empty",
            "Chưa có app nào được cài",
            false,
            None::<&str>,
        )?;
        Submenu::with_items(
            app,
            "Quick-launch",
            true,
            &[&placeholder as &dyn tauri::menu::IsMenuItem<tauri::Wry>],
        )?
    } else {
        let mut entries: Vec<MenuItem<tauri::Wry>> = Vec::with_capacity(items.len());
        for it in items {
            let id = format!("tray:launch:{}", it.id);
            entries.push(MenuItem::with_id(app, id, &it.label, true, None::<&str>)?);
        }
        let refs: Vec<&dyn tauri::menu::IsMenuItem<tauri::Wry>> =
            entries.iter().map(|e| e as &dyn tauri::menu::IsMenuItem<tauri::Wry>).collect();
        Submenu::with_items(app, "Quick-launch", true, &refs)?
    };

    let sep2 = PredefinedMenuItem::separator(app)?;
    let quit_i = MenuItem::with_id(app, "tray:quit", "Thoát", true, None::<&str>)?;

    Menu::with_items(
        app,
        &[
            &show_i as &dyn tauri::menu::IsMenuItem<tauri::Wry>,
            &hide_i,
            &sep1,
            &submenu,
            &sep2,
            &quit_i,
        ],
    )
}

/// Áp menu mới lên tray 'main'. Tách riêng để command IPC gọi lại khi
/// frontend push danh sách Quick-launch.
fn apply_tray_menu(app: &AppHandle, menu: Menu<tauri::Wry>) -> Result<(), String> {
    let Some(tray) = app.tray_by_id("main") else {
        return Err("tray 'main' not found".to_string());
    };
    tray.set_menu(Some(menu))
        .map_err(|e| format!("set_menu failed: {e}"))
}

/// Frontend gọi sau khi detect_install + filter installed → push list
/// vào state + rebuild menu. Item ID dạng "tray:launch:<app_id>" để
/// on_menu_event dispatch đúng app.
#[tauri::command]
fn update_tray_quick_launch(
    app: AppHandle,
    state: tauri::State<'_, TrayState>,
    items: Vec<QuickLaunchItem>,
) -> Result<(), String> {
    {
        let mut guard = state
            .quick_launch
            .lock()
            .map_err(|_| "quick_launch lock poisoned".to_string())?;
        *guard = items.clone();
    }
    let menu = build_tray_menu(&app, &items).map_err(|e| format!("build menu: {e}"))?;
    apply_tray_menu(&app, menu)
}

/// Unminimize + show + set_focus cửa sổ chính. Dùng cho "Mở
/// TrishLauncher" menu item và left-click tray.
fn focus_main_window(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.unminimize();
        let _ = w.show();
        let _ = w.set_focus();
    }
}

/// Helper spawn process mở path — dùng cho menu event
/// "tray:launch:<id>". Tách riêng vì launch_path() là #[tauri::command]
/// nên không gọi trực tiếp từ menu handler được.
fn spawn_open(path: &str) -> std::io::Result<std::process::Child> {
    use std::process::Command;

    #[cfg(target_os = "windows")]
    {
        Command::new("cmd").args(["/c", "start", "", path]).spawn()
    }
    #[cfg(target_os = "macos")]
    {
        Command::new("open").args(["-a", path]).spawn()
    }
    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open").arg(path).spawn()
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        Err(std::io::Error::new(
            std::io::ErrorKind::Unsupported,
            "unsupported os",
        ))
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .manage(TrayState::default())
        .invoke_handler(tauri::generate_handler![
            sys_info,
            app_version,
            detect_install,
            launch_path,
            update_tray_quick_launch,
            fetch_registry_text,
            set_close_to_tray
        ])
        .setup(|app| {
            // Build menu rỗng trước → sau detect_install frontend sẽ push
            // list thật vào qua update_tray_quick_launch.
            let handle = app.handle().clone();
            let initial_menu = build_tray_menu(&handle, &[])?;

            let icon = app
                .default_window_icon()
                .cloned()
                .ok_or("default window icon missing")?;
            let _tray = TrayIconBuilder::with_id("main")
                .tooltip("TrishLauncher — Hệ sinh thái TrishTEAM")
                .icon(icon)
                .menu(&initial_menu)
                .show_menu_on_left_click(false)
                .on_menu_event(move |app, event| {
                    let id = event.id().as_ref();
                    match id {
                        "tray:show" => focus_main_window(app),
                        "tray:hide" => {
                            if let Some(w) = app.get_webview_window("main") {
                                let _ = w.hide();
                            }
                        }
                        "tray:quit" => {
                            app.exit(0);
                        }
                        other if other.starts_with("tray:launch:") => {
                            let app_id = &other["tray:launch:".len()..];
                            let state = app.state::<TrayState>();
                            let path_opt = state
                                .quick_launch
                                .lock()
                                .ok()
                                .and_then(|g| {
                                    g.iter()
                                        .find(|it| it.id == app_id)
                                        .map(|it| it.path.clone())
                                });
                            if let Some(path) = path_opt {
                                if let Err(e) = spawn_open(&path) {
                                    eprintln!("[trishlauncher] tray launch failed: {e}");
                                }
                            }
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(w) = app.get_webview_window("main") {
                            if w.is_visible().unwrap_or(false) {
                                let _ = w.hide();
                            } else {
                                focus_main_window(app);
                            }
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            // Phase 20.2 — đọc setting `minimize_to_tray` từ TrayState. True
            // = ẩn xuống tray + prevent close. False = để Tauri close hẳn
            // (default). Frontend gọi `set_close_to_tray` mỗi lần user lưu
            // Settings để cập nhật flag này.
            if window.label() == "main" {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    let app = window.app_handle();
                    let should_hide = app
                        .try_state::<TrayState>()
                        .and_then(|s| s.minimize_to_tray.lock().ok().map(|g| *g))
                        .unwrap_or(false);
                    if should_hide {
                        let _ = window.hide();
                        api.prevent_close();
                    }
                    // else: để Tauri tiếp tục quit như mặc định
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
