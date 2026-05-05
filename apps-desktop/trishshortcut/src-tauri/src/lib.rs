//! TrishShortcut — Tauri 2 backend (Phase 32.3 + 32.4).
//!
//! Commands:
//!   - app_version
//!   - scan_desktop / scan_start_menu / scan_installed_apps
//!   - parse_lnk
//!   - launch_shortcut
//!   - open_in_explorer

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::process::Command;

// ============================================================
// Types
// ============================================================

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DesktopEntry {
    pub name: String,
    /// Path to .lnk hoặc .exe gốc (file trên Desktop / Start Menu)
    pub source_path: String,
    /// Path đã resolve (nếu .lnk → target thật; nếu .exe → giống source_path)
    pub target: Option<String>,
    pub args: Option<String>,
    pub working_dir: Option<String>,
    pub icon_location: Option<String>,
    /// 'lnk' | 'exe'
    pub kind: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct InstalledApp {
    pub name: String,
    pub publisher: Option<String>,
    pub version: Option<String>,
    pub install_location: Option<String>,
    pub uninstall_string: Option<String>,
    pub icon_path: Option<String>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LnkParsed {
    pub target: String,
    pub args: String,
    pub working_dir: String,
    pub icon_path: Option<String>,
    pub description: Option<String>,
}

#[derive(Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LaunchOpts {
    /// 'app' | 'game' | 'folder' | 'url' | 'file' | 'uwp'
    #[serde(rename = "type")]
    pub type_: String,
    pub target: String,
    pub args: Option<String>,
    pub working_dir: Option<String>,
    pub run_as_admin: Option<bool>,
}

// ============================================================
// app_version
// ============================================================

#[tauri::command]
fn app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

/// Phase 32.12 — Frontend gọi để exit hẳn app (tắt cả tray, kill process).
/// Tauri 2 không tự exit khi window close vì còn tray icon giữ process alive.
#[tauri::command]
fn exit_app(app: tauri::AppHandle) {
    app.exit(0);
}

/// Phase 32.12 — Frontend gọi để hide window vào tray (giữ app chạy nền).
#[tauri::command]
fn hide_to_tray(window: tauri::WebviewWindow) -> Result<(), String> {
    window.hide().map_err(|e| format!("hide: {}", e))
}

// ============================================================
// Scan commands (Windows only — guard cfg)
// ============================================================

#[cfg(target_os = "windows")]
fn scan_dir_for_shortcuts(dir: &Path, out: &mut Vec<DesktopEntry>) -> Result<(), String> {
    if !dir.exists() {
        return Ok(());
    }
    let read = std::fs::read_dir(dir).map_err(|e| format!("read_dir {:?}: {}", dir, e))?;
    for entry in read {
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };
        let path = entry.path();
        if path.is_dir() {
            // Recurse 1 cấp cho Start Menu (nhiều subfolder cho từng app)
            let _ = scan_dir_for_shortcuts(&path, out);
            continue;
        }
        let ext = path
            .extension()
            .and_then(|e| e.to_str())
            .map(|s| s.to_lowercase());
        let name = path
            .file_stem()
            .and_then(|n| n.to_str())
            .unwrap_or("Unknown")
            .to_string();
        let source_path = path.to_string_lossy().into_owned();

        match ext.as_deref() {
            Some("lnk") => {
                let parsed = parse_lnk_internal(&path).ok();
                out.push(DesktopEntry {
                    name,
                    source_path,
                    target: parsed.as_ref().map(|p| p.target.clone()),
                    args: parsed.as_ref().and_then(|p| {
                        if p.args.is_empty() {
                            None
                        } else {
                            Some(p.args.clone())
                        }
                    }),
                    working_dir: parsed.as_ref().and_then(|p| {
                        if p.working_dir.is_empty() {
                            None
                        } else {
                            Some(p.working_dir.clone())
                        }
                    }),
                    icon_location: parsed.and_then(|p| p.icon_path),
                    kind: "lnk".into(),
                });
            }
            Some("exe") => {
                let working_dir = path
                    .parent()
                    .map(|p| p.to_string_lossy().into_owned());
                out.push(DesktopEntry {
                    name,
                    source_path: source_path.clone(),
                    target: Some(source_path),
                    args: None,
                    working_dir,
                    icon_location: None,
                    kind: "exe".into(),
                });
            }
            _ => {}
        }
    }
    Ok(())
}

#[cfg(not(target_os = "windows"))]
fn scan_dir_for_shortcuts(_dir: &Path, _out: &mut Vec<DesktopEntry>) -> Result<(), String> {
    Err("Scan chỉ hỗ trợ Windows".into())
}

#[tauri::command]
fn scan_desktop() -> Result<Vec<DesktopEntry>, String> {
    let mut entries = Vec::new();
    if let Some(desktop) = dirs::desktop_dir() {
        scan_dir_for_shortcuts(&desktop, &mut entries)?;
    }
    // Public Desktop (chia sẻ all users)
    let public = PathBuf::from(r"C:\Users\Public\Desktop");
    let _ = scan_dir_for_shortcuts(&public, &mut entries);
    // Dedupe theo target (nếu có) hoặc source_path
    entries.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    entries.dedup_by(|a, b| {
        a.target.as_deref().unwrap_or(&a.source_path)
            == b.target.as_deref().unwrap_or(&b.source_path)
    });
    Ok(entries)
}

#[tauri::command]
fn scan_start_menu() -> Result<Vec<DesktopEntry>, String> {
    let mut entries = Vec::new();
    // User Start Menu
    if let Some(appdata) = dirs::data_dir() {
        // %APPDATA%\Microsoft\Windows\Start Menu\Programs
        let user_start = appdata.join("Microsoft").join("Windows").join("Start Menu").join("Programs");
        let _ = scan_dir_for_shortcuts(&user_start, &mut entries);
    }
    // Common Start Menu
    let common_start = PathBuf::from(r"C:\ProgramData\Microsoft\Windows\Start Menu\Programs");
    let _ = scan_dir_for_shortcuts(&common_start, &mut entries);

    entries.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    entries.dedup_by(|a, b| {
        a.target.as_deref().unwrap_or(&a.source_path)
            == b.target.as_deref().unwrap_or(&b.source_path)
    });
    Ok(entries)
}

#[cfg(target_os = "windows")]
#[tauri::command]
fn scan_installed_apps() -> Result<Vec<InstalledApp>, String> {
    use winreg::enums::*;
    use winreg::RegKey;

    let mut apps: Vec<InstalledApp> = Vec::new();

    fn read_uninstall_branch(hive: &RegKey, subpath: &str, out: &mut Vec<InstalledApp>) {
        let uninstall = match hive.open_subkey_with_flags(subpath, KEY_READ) {
            Ok(k) => k,
            Err(_) => return,
        };
        for sk_name in uninstall.enum_keys().flatten() {
            let sk = match uninstall.open_subkey_with_flags(&sk_name, KEY_READ) {
                Ok(k) => k,
                Err(_) => continue,
            };
            let display_name: Option<String> = sk.get_value("DisplayName").ok();
            // Bỏ qua entry không tên (windows updates, dependencies)
            let name = match display_name {
                Some(n) if !n.trim().is_empty() => n,
                _ => continue,
            };
            // Bỏ qua SystemComponent=1 (component không phải app)
            if let Ok(sc) = sk.get_value::<u32, _>("SystemComponent") {
                if sc == 1 {
                    continue;
                }
            }
            let publisher: Option<String> = sk.get_value("Publisher").ok();
            let version: Option<String> = sk.get_value("DisplayVersion").ok();
            let install_location: Option<String> = sk.get_value("InstallLocation").ok();
            let uninstall_string: Option<String> = sk.get_value("UninstallString").ok();
            let icon_path: Option<String> = sk.get_value("DisplayIcon").ok();
            out.push(InstalledApp {
                name,
                publisher,
                version,
                install_location,
                uninstall_string,
                icon_path,
            });
        }
    }

    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);

    read_uninstall_branch(
        &hklm,
        r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall",
        &mut apps,
    );
    read_uninstall_branch(
        &hklm,
        r"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall",
        &mut apps,
    );
    read_uninstall_branch(
        &hkcu,
        r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall",
        &mut apps,
    );

    apps.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    apps.dedup_by(|a, b| a.name.to_lowercase() == b.name.to_lowercase());
    Ok(apps)
}

#[cfg(not(target_os = "windows"))]
#[tauri::command]
fn scan_installed_apps() -> Result<Vec<InstalledApp>, String> {
    Err("Quét app cài chỉ hỗ trợ Windows".into())
}

// ============================================================
// parse_lnk
// ============================================================

#[cfg(target_os = "windows")]
fn parse_lnk_internal(lnk_path: &Path) -> Result<LnkParsed, String> {
    let link = lnk::ShellLink::open(lnk_path)
        .map_err(|e| format!("ShellLink::open {:?}: {:?}", lnk_path, e))?;

    // Target path: ưu tiên local_base_path từ link_info, fallback relative_path
    let target = link
        .link_info()
        .as_ref()
        .and_then(|i| i.local_base_path().clone())
        .or_else(|| {
            link.relative_path()
                .clone()
                .and_then(|rel| {
                    lnk_path
                        .parent()
                        .map(|p| p.join(&rel).to_string_lossy().into_owned())
                })
        })
        .unwrap_or_else(|| lnk_path.to_string_lossy().into_owned());

    let args = link.arguments().clone().unwrap_or_default();
    let working_dir = link.working_dir().clone().unwrap_or_default();
    let icon_path = link.icon_location().clone();
    // Phase 32.3 — `name_string` field không public; dùng accessor `name()`.
    let description = link.name().clone();

    Ok(LnkParsed {
        target,
        args,
        working_dir,
        icon_path,
        description,
    })
}

#[cfg(not(target_os = "windows"))]
fn parse_lnk_internal(_lnk_path: &Path) -> Result<LnkParsed, String> {
    Err("Parse .lnk chỉ hỗ trợ Windows".into())
}

#[tauri::command]
fn parse_lnk(lnk_path: String) -> Result<LnkParsed, String> {
    parse_lnk_internal(Path::new(&lnk_path))
}

// ============================================================
// launch_shortcut
// ============================================================

#[tauri::command]
fn launch_shortcut(opts: LaunchOpts) -> Result<(), String> {
    let run_as_admin = opts.run_as_admin.unwrap_or(false);

    match opts.type_.as_str() {
        "app" | "game" | "file" => {
            if run_as_admin {
                #[cfg(target_os = "windows")]
                {
                    return launch_runas(&opts.target, opts.args.as_deref(), opts.working_dir.as_deref());
                }
                #[cfg(not(target_os = "windows"))]
                {
                    return Err("Run as Admin chỉ hỗ trợ Windows".into());
                }
            }
            let mut cmd = Command::new(&opts.target);
            if let Some(args) = &opts.args {
                if !args.is_empty() {
                    // Split simple by whitespace; user nhập args đơn giản OK,
                    // shell-style quoting phức tạp dùng PowerShell wrapper sau.
                    cmd.args(args.split_whitespace());
                }
            }
            if let Some(wd) = &opts.working_dir {
                if !wd.is_empty() {
                    cmd.current_dir(wd);
                }
            }
            cmd.spawn().map_err(|e| format!("spawn {}: {}", opts.target, e))?;
        }
        "folder" => {
            #[cfg(target_os = "windows")]
            {
                Command::new("explorer.exe")
                    .arg(&opts.target)
                    .spawn()
                    .map_err(|e| format!("explorer {}: {}", opts.target, e))?;
            }
            #[cfg(not(target_os = "windows"))]
            {
                return Err("Mở folder chỉ hỗ trợ Windows".into());
            }
        }
        "url" => {
            #[cfg(target_os = "windows")]
            {
                Command::new("cmd")
                    .args(["/c", "start", "", &opts.target])
                    .spawn()
                    .map_err(|e| format!("open url: {}", e))?;
            }
            #[cfg(not(target_os = "windows"))]
            {
                Command::new("xdg-open")
                    .arg(&opts.target)
                    .spawn()
                    .map_err(|e| format!("xdg-open: {}", e))?;
            }
        }
        "uwp" => {
            #[cfg(target_os = "windows")]
            {
                let app_id = format!("shell:appsfolder\\{}", opts.target);
                Command::new("explorer.exe")
                    .arg(&app_id)
                    .spawn()
                    .map_err(|e| format!("uwp launch: {}", e))?;
            }
            #[cfg(not(target_os = "windows"))]
            {
                return Err("UWP chỉ hỗ trợ Windows".into());
            }
        }
        "command" => {
            // Phase 32.4.C — Lệnh hệ thống (notepad/calc/cmd/...). Search PATH qua
            // `cmd /c start` để dùng default file association + shell builtins.
            #[cfg(target_os = "windows")]
            {
                let mut full_cmd = opts.target.clone();
                if let Some(args) = &opts.args {
                    if !args.is_empty() {
                        full_cmd.push(' ');
                        full_cmd.push_str(args);
                    }
                }
                Command::new("cmd")
                    .args(["/c", "start", "", &full_cmd])
                    .spawn()
                    .map_err(|e| format!("run command: {}", e))?;
            }
            #[cfg(not(target_os = "windows"))]
            {
                let mut cmd = Command::new(&opts.target);
                if let Some(args) = &opts.args {
                    if !args.is_empty() {
                        cmd.args(args.split_whitespace());
                    }
                }
                cmd.spawn().map_err(|e| format!("run command: {}", e))?;
            }
        }
        other => {
            return Err(format!("Loại shortcut không hỗ trợ: {}", other));
        }
    }
    Ok(())
}

#[cfg(target_os = "windows")]
fn launch_runas(target: &str, args: Option<&str>, working_dir: Option<&str>) -> Result<(), String> {
    // Build PowerShell Start-Process command với escape single quotes.
    let target_esc = target.replace('\'', "''");
    let mut ps_cmd = format!("Start-Process -FilePath '{}' -Verb RunAs", target_esc);
    if let Some(a) = args {
        if !a.is_empty() {
            ps_cmd.push_str(&format!(" -ArgumentList '{}'", a.replace('\'', "''")));
        }
    }
    if let Some(wd) = working_dir {
        if !wd.is_empty() {
            ps_cmd.push_str(&format!(
                " -WorkingDirectory '{}'",
                wd.replace('\'', "''")
            ));
        }
    }
    Command::new("powershell")
        .args(["-NoProfile", "-WindowStyle", "Hidden", "-Command", &ps_cmd])
        .spawn()
        .map_err(|e| format!("powershell runas: {}", e))?;
    Ok(())
}

// ============================================================
// extract_icon_from_exe — Phase 32.3.B
// ============================================================

#[cfg(target_os = "windows")]
#[tauri::command]
async fn extract_icon_from_exe(
    app: tauri::AppHandle,
    exe_path: String,
) -> Result<String, String> {
    use sha2::{Digest, Sha256};
    use tauri::Manager;

    if exe_path.is_empty() {
        return Err("exe_path rỗng".into());
    }

    let cache_dir = app
        .path()
        .app_local_data_dir()
        .map_err(|e| format!("app_local_data_dir: {}", e))?
        .join("icons");
    std::fs::create_dir_all(&cache_dir)
        .map_err(|e| format!("create cache dir: {}", e))?;

    // Hash path → filename ổn định, cache hit nếu đã extract
    let mut hasher = Sha256::new();
    hasher.update(exe_path.as_bytes());
    let hash = hex::encode(&hasher.finalize()[..8]);
    let icon_path = cache_dir.join(format!("{}.png", hash));
    let icon_path_str = icon_path.to_string_lossy().into_owned();

    if icon_path.exists() {
        return Ok(icon_path_str);
    }

    // PowerShell + System.Drawing.Icon — chạy nhanh, không cần GTK Linux deps.
    // Escape single-quote bằng cách double-up ('' trong PS literal string).
    let exe_esc = exe_path.replace('\'', "''");
    let icon_esc = icon_path_str.replace('\'', "''");
    let script = format!(
        "Add-Type -AssemblyName System.Drawing; \
         $i = [System.Drawing.Icon]::ExtractAssociatedIcon('{}'); \
         if ($i) {{ $bmp = $i.ToBitmap(); $bmp.Save('{}', [System.Drawing.Imaging.ImageFormat]::Png); $bmp.Dispose(); $i.Dispose() }}",
        exe_esc, icon_esc,
    );

    let output = std::process::Command::new("powershell")
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-WindowStyle", "Hidden",
            "-Command", &script,
        ])
        .output()
        .map_err(|e| format!("spawn powershell: {}", e))?;

    if !icon_path.exists() {
        return Err(format!(
            "extract icon fail cho '{}': {}",
            exe_path,
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }

    Ok(icon_path_str)
}

#[cfg(not(target_os = "windows"))]
#[tauri::command]
async fn extract_icon_from_exe(
    _app: tauri::AppHandle,
    _exe_path: String,
) -> Result<String, String> {
    Err("Extract icon chỉ hỗ trợ Windows".into())
}

// ============================================================
// open_in_explorer (mở Explorer + select file)
// ============================================================

#[tauri::command]
fn open_in_explorer(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        Command::new("explorer.exe")
            .args(["/select,", &path])
            .spawn()
            .map_err(|e| format!("explorer /select: {}", e))?;
        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = path;
        Err("Mở Explorer chỉ hỗ trợ Windows".into())
    }
}

// ============================================================
// run
// ============================================================

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            // Phase 32.12 — System tray: cho phép app chạy nền sau khi user
            // bấm X (nếu setting "minimize to tray" bật). Click tray icon →
            // mở lại window. Right-click → menu Show / Quit.
            use tauri::Manager;
            use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
            use tauri::tray::{TrayIconBuilder, MouseButton, MouseButtonState, TrayIconEvent};

            let show_i = MenuItem::with_id(app, "show", "Mở TrishShortcut", true, None::<&str>)?;
            let sep_i = PredefinedMenuItem::separator(app)?;
            let quit_i = MenuItem::with_id(app, "quit", "Thoát", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &sep_i, &quit_i])?;

            let _tray = TrayIconBuilder::with_id("main")
                .icon(app.default_window_icon().expect("default icon").clone())
                .tooltip("TrishShortcut — quản lý shortcut Windows")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                            let _ = w.unminimize();
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
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
                            // Toggle: nếu visible → hide, nếu hidden → show
                            let visible = w.is_visible().unwrap_or(false);
                            if visible {
                                let _ = w.hide();
                            } else {
                                let _ = w.show();
                                let _ = w.set_focus();
                                let _ = w.unminimize();
                            }
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            app_version,
            exit_app,
            hide_to_tray,
            scan_desktop,
            scan_start_menu,
            scan_installed_apps,
            parse_lnk,
            launch_shortcut,
            open_in_explorer,
            extract_icon_from_exe,
            // Phase 36.5 — Machine ID cho key concurrent control
            get_device_id,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

/// Phase 36.5 — Trả về machine_id 16 hex chars (stable cross-reboot).
#[tauri::command]
fn get_device_id() -> String {
    trishteam_machine_id::get_machine_id()
}
