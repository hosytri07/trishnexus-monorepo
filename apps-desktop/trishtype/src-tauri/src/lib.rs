//! TrishType Rust backend — Phase 17.6 v2.
//!
//! Document editor + format converter.
//! Backend lo:
//!  - Text file I/O: read/write UTF-8 text (16 MiB cap)
//!  - Binary file I/O: read/write bytes (cho .docx, .pdf — 32 MiB cap)
//!  - Recent files: persistent JSON ở %LocalAppData%/TrishTEAM/TrishType/state.json
//!  - Update check: fetch apps-registry.json từ trishteam.io.vn

use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

const APP_SUBDIR: &str = "TrishType";
const STATE_FILENAME: &str = "state.json";

const MAX_TEXT_BYTES: u64 = 16 * 1024 * 1024;
const MAX_BINARY_BYTES: u64 = 32 * 1024 * 1024;
const MAX_RECENT_FILES: usize = 30;

// ============================================================
// State
// ============================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecentFile {
    pub path: String,
    pub name: String,
    pub last_opened_ms: i64,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
struct AppState {
    #[serde(default)]
    recent_files: Vec<RecentFile>,
}

type SharedState = Arc<Mutex<AppState>>;

fn default_data_dir() -> Result<PathBuf, String> {
    let mut d = dirs::data_local_dir()
        .or_else(dirs::data_dir)
        .or_else(dirs::home_dir)
        .ok_or_else(|| "Không tìm được local data dir".to_string())?;
    d.push("TrishTEAM");
    d.push(APP_SUBDIR);
    Ok(d)
}

fn state_path() -> Result<PathBuf, String> {
    let mut p = default_data_dir()?;
    p.push(STATE_FILENAME);
    Ok(p)
}

fn ensure_parent(path: &Path) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        if !parent.as_os_str().is_empty() && !parent.exists() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("create_dir_all {}: {e}", parent.display()))?;
        }
    }
    Ok(())
}

fn load_state() -> AppState {
    let Ok(p) = state_path() else { return AppState::default() };
    let Ok(c) = fs::read_to_string(&p) else { return AppState::default() };
    serde_json::from_str(&c).unwrap_or_default()
}

fn save_state(s: &AppState) -> Result<(), String> {
    let p = state_path()?;
    ensure_parent(&p)?;
    let json = serde_json::to_string(s).map_err(|e| format!("serialize: {e}"))?;
    let tmp = p.with_extension("json.tmp");
    fs::write(&tmp, json).map_err(|e| format!("write tmp: {e}"))?;
    fs::rename(&tmp, &p).map_err(|e| format!("rename: {e}"))?;
    Ok(())
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

fn path_basename(p: &Path) -> String {
    p.file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| p.to_string_lossy().into_owned())
}

fn track_recent(state: &SharedState, path: &str) {
    let p = PathBuf::from(path);
    let name = path_basename(&p);
    let mut s = state.lock();
    s.recent_files.retain(|f| f.path != path);
    s.recent_files.insert(
        0,
        RecentFile {
            path: path.to_string(),
            name,
            last_opened_ms: now_ms(),
        },
    );
    if s.recent_files.len() > MAX_RECENT_FILES {
        s.recent_files.truncate(MAX_RECENT_FILES);
    }
    let _ = save_state(&s);
}

// ============================================================
// Tauri commands
// ============================================================

#[derive(Debug, Serialize)]
pub struct EnvLocation {
    pub data_dir: String,
}

#[tauri::command]
fn default_store_location() -> Result<EnvLocation, String> {
    let d = default_data_dir()?;
    Ok(EnvLocation {
        data_dir: d.to_string_lossy().into_owned(),
    })
}

// ---------- Text file I/O (no recent tracking — caller chooses) ----------

#[tauri::command]
fn read_text_string(
    state: tauri::State<'_, SharedState>,
    path: String,
) -> Result<String, String> {
    let p = PathBuf::from(&path);
    let meta = fs::metadata(&p).map_err(|e| format!("stat {}: {e}", path))?;
    if !meta.is_file() {
        return Err(format!("Không phải file: {}", path));
    }
    if meta.len() > MAX_TEXT_BYTES {
        return Err(format!(
            "File > {} MB — không mở được",
            MAX_TEXT_BYTES / 1024 / 1024
        ));
    }
    let bytes = fs::read(&p).map_err(|e| format!("read: {e}"))?;
    let content = String::from_utf8_lossy(&bytes).into_owned();
    track_recent(&state, &p.to_string_lossy());
    Ok(content)
}

#[tauri::command]
fn write_text_string(
    state: tauri::State<'_, SharedState>,
    path: String,
    content: String,
) -> Result<(), String> {
    let p = PathBuf::from(&path);
    let bytes = content.as_bytes();
    if bytes.len() as u64 > MAX_TEXT_BYTES {
        return Err(format!(
            "Content > {} MB — không thể lưu",
            MAX_TEXT_BYTES / 1024 / 1024
        ));
    }
    ensure_parent(&p)?;
    // Atomic write
    let tmp_path = p.with_extension("trishtype.tmp");
    fs::write(&tmp_path, bytes).map_err(|e| format!("write tmp: {e}"))?;
    fs::rename(&tmp_path, &p).map_err(|e| format!("rename: {e}"))?;
    track_recent(&state, &p.to_string_lossy());
    Ok(())
}

// ---------- Binary file I/O (cho .docx, .pdf) ----------

#[tauri::command]
fn read_binary_file(
    state: tauri::State<'_, SharedState>,
    path: String,
) -> Result<Vec<u8>, String> {
    let p = PathBuf::from(&path);
    let meta = fs::metadata(&p).map_err(|e| format!("stat: {e}"))?;
    if !meta.is_file() {
        return Err(format!("Không phải file: {}", path));
    }
    if meta.len() > MAX_BINARY_BYTES {
        return Err(format!(
            "File > {} MB — không mở được",
            MAX_BINARY_BYTES / 1024 / 1024
        ));
    }
    let bytes = fs::read(&p).map_err(|e| format!("read: {e}"))?;
    track_recent(&state, &p.to_string_lossy());
    Ok(bytes)
}

#[tauri::command]
fn write_binary_file(
    state: tauri::State<'_, SharedState>,
    path: String,
    bytes: Vec<u8>,
) -> Result<(), String> {
    let p = PathBuf::from(&path);
    if bytes.len() as u64 > MAX_BINARY_BYTES {
        return Err(format!(
            "Content > {} MB — không thể lưu",
            MAX_BINARY_BYTES / 1024 / 1024
        ));
    }
    ensure_parent(&p)?;
    let tmp_path = p.with_extension("trishtype.tmp");
    fs::write(&tmp_path, &bytes).map_err(|e| format!("write tmp: {e}"))?;
    fs::rename(&tmp_path, &p).map_err(|e| format!("rename: {e}"))?;
    track_recent(&state, &p.to_string_lossy());
    Ok(())
}

// ---------- Recent files ----------

#[tauri::command]
fn list_recent_files(state: tauri::State<'_, SharedState>) -> Vec<RecentFile> {
    state.lock().recent_files.clone()
}

#[tauri::command]
fn clear_recent_files(state: tauri::State<'_, SharedState>) -> Result<(), String> {
    let mut s = state.lock();
    s.recent_files.clear();
    save_state(&s)
}

// ---------- Open file/folder ----------

#[tauri::command]
async fn open_file(app: tauri::AppHandle, path: String) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    app.opener()
        .open_path(&path, None::<&str>)
        .map_err(|e| format!("open: {e}"))
}

#[tauri::command]
async fn open_containing_folder(
    app: tauri::AppHandle,
    path: String,
) -> Result<(), String> {
    let p = PathBuf::from(&path);
    let parent = p.parent().ok_or_else(|| "Không có folder cha".to_string())?;
    use tauri_plugin_opener::OpenerExt;
    app.opener()
        .open_path(parent.to_string_lossy().as_ref(), None::<&str>)
        .map_err(|e| format!("open folder: {e}"))
}

// ============================================================
// System fonts (scan Windows Fonts dir + parse Name table)
// ============================================================

/// Scan font hệ thống Windows: %WINDIR%/Fonts + %LocalAppData%/Microsoft/Windows/Fonts.
/// Parse mỗi file qua ttf-parser, extract family name từ Name table (id=1).
/// Returns danh sách dedup + sort.
#[tauri::command]
fn list_system_fonts() -> Vec<String> {
    let mut set = std::collections::BTreeSet::<String>::new();

    let dirs = [
        std::env::var("WINDIR")
            .map(|w| format!("{}\\Fonts", w))
            .unwrap_or_default(),
        std::env::var("LOCALAPPDATA")
            .map(|l| format!("{}\\Microsoft\\Windows\\Fonts", l))
            .unwrap_or_default(),
    ];

    for dir in dirs.iter() {
        if dir.is_empty() {
            continue;
        }
        let rd = match fs::read_dir(dir) {
            Ok(rd) => rd,
            Err(_) => continue,
        };
        for entry in rd.flatten() {
            let name = entry.file_name();
            let name_str = name.to_string_lossy().to_ascii_lowercase();
            if !name_str.ends_with(".ttf") && !name_str.ends_with(".otf") {
                continue;
            }
            let path = entry.path();
            // Read max 4MB để tránh font khổng lồ chiếm RAM
            let bytes = match fs::read(&path) {
                Ok(b) if b.len() < 4 * 1024 * 1024 => b,
                _ => continue,
            };
            if let Some(family) = parse_font_family(&bytes) {
                if !family.is_empty() && family.len() < 80 {
                    set.insert(family);
                }
            }
        }
    }

    set.into_iter().collect()
}

fn parse_font_family(bytes: &[u8]) -> Option<String> {
    let face = ttf_parser::Face::parse(bytes, 0).ok()?;
    let names = face.names();
    let mut fallback: Option<String> = None;
    for i in 0..names.len() {
        let n = names.get(i)?;
        // name_id 1 = Family name
        if n.name_id == 1 {
            if let Some(s) = n.to_string() {
                let trimmed = s.trim().to_string();
                if !trimmed.is_empty() {
                    // Prefer English/Unicode name. Platform 3 = Windows, 0 = Unicode.
                    if n.platform_id == ttf_parser::PlatformId::Windows
                        || n.platform_id == ttf_parser::PlatformId::Unicode
                    {
                        return Some(trimmed);
                    } else if fallback.is_none() {
                        fallback = Some(trimmed);
                    }
                }
            }
        }
    }
    fallback
}

// ============================================================
// Folder expand (cho drag-drop folder support)
// ============================================================

/// Recursively scan folder, return absolute paths của file có ext hỗ trợ.
/// Supported: docx, md, html, htm, txt, json
#[tauri::command]
fn expand_folder_to_files(path: String) -> Result<Vec<String>, String> {
    let p = PathBuf::from(&path);
    if !p.exists() {
        return Err(format!("Path không tồn tại: {}", path));
    }
    let mut out = Vec::<String>::new();
    if p.is_file() {
        out.push(p.to_string_lossy().into_owned());
        return Ok(out);
    }
    if !p.is_dir() {
        return Err(format!("Không phải file/folder: {}", path));
    }
    walk_dir(&p, &mut out, 0)?;
    Ok(out)
}

const SUPPORTED_EXTS: &[&str] = &["docx", "md", "markdown", "html", "htm", "txt", "json", "pdf"];
const MAX_WALK_DEPTH_CONVERT: usize = 6;
const MAX_FILES_PER_DROP: usize = 500;

fn walk_dir(root: &Path, out: &mut Vec<String>, depth: usize) -> Result<(), String> {
    if depth > MAX_WALK_DEPTH_CONVERT || out.len() >= MAX_FILES_PER_DROP {
        return Ok(());
    }
    let rd = match fs::read_dir(root) {
        Ok(r) => r,
        Err(_) => return Ok(()),
    };
    for entry in rd.flatten() {
        if out.len() >= MAX_FILES_PER_DROP {
            break;
        }
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        // Skip hidden + common heavy dirs
        if name.starts_with('.') {
            continue;
        }
        if path.is_dir() {
            let lower = name.to_ascii_lowercase();
            if matches!(
                lower.as_str(),
                "node_modules" | "target" | "dist" | "build" | "$recycle.bin"
            ) {
                continue;
            }
            walk_dir(&path, out, depth + 1)?;
        } else if path.is_file() {
            if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                let lower = ext.to_ascii_lowercase();
                if SUPPORTED_EXTS.contains(&lower.as_str()) {
                    out.push(path.to_string_lossy().into_owned());
                }
            }
        }
    }
    Ok(())
}

// ============================================================
// Fetch HTML từ URL (cho convert URL → file)
// ============================================================

#[derive(Debug, Serialize)]
pub struct FetchHtmlResult {
    pub url: String,
    pub final_url: String,
    pub html: String,
    pub status: u16,
    pub content_type: String,
}

#[tauri::command]
async fn fetch_html(url: String) -> Result<FetchHtmlResult, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .user_agent(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) TrishType/2.0 like Chrome/120 Safari/537.36",
        )
        .redirect(reqwest::redirect::Policy::limited(8))
        .build()
        .map_err(|e| format!("client build: {e}"))?;
    let resp = client
        .get(&url)
        .header("Accept", "text/html,application/xhtml+xml,*/*;q=0.8")
        .send()
        .await
        .map_err(|e| format!("request: {e}"))?;
    let status = resp.status().as_u16();
    let final_url = resp.url().to_string();
    let content_type = resp
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("text/html")
        .to_string();
    if !resp.status().is_success() {
        return Err(format!("HTTP {} từ {}", status, final_url));
    }
    let html = resp.text().await.map_err(|e| format!("body: {e}"))?;
    if html.len() > 8 * 1024 * 1024 {
        return Err("Trang quá lớn (>8MB) — không tải được".into());
    }
    Ok(FetchHtmlResult {
        url,
        final_url,
        html,
        status,
        content_type,
    })
}

// ============================================================
// App version + Update check
// ============================================================

#[tauri::command]
fn app_version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}

#[tauri::command]
async fn fetch_text(url: String) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .user_agent(concat!("TrishType/", env!("CARGO_PKG_VERSION")))
        .build()
        .map_err(|e| format!("client build: {e}"))?;
    let resp = client
        .get(&url)
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| format!("request: {e}"))?;
    if !resp.status().is_success() {
        return Err(format!("HTTP {}", resp.status()));
    }
    resp.text().await.map_err(|e| format!("body: {e}"))
}

// ============================================================
// Main entry
// ============================================================

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let initial_state = load_state();
    let shared: SharedState = Arc::new(Mutex::new(initial_state));

    tauri::Builder::default()
        .manage(shared)
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            default_store_location,
            read_text_string,
            write_text_string,
            read_binary_file,
            write_binary_file,
            list_recent_files,
            clear_recent_files,
            list_system_fonts,
            expand_folder_to_files,
            fetch_html,
            open_file,
            open_containing_folder,
            app_version,
            fetch_text,
        ])
        .run(tauri::generate_context!())
        .expect("error while running TrishType");
}
