//! TrishLibrary Rust backend.
//!
//! 3 nhiệm vụ:
//!   1. Resolve + đọc/ghi `library.json` trong local data dir.
//!   2. Scan 1 folder user chỉ định → trả list `RawLibraryEntry`
//!      (path + name + ext + size + mtime), để @trishteam/core/library
//!      enrich thành LibraryDoc.
//!   3. Mở tài liệu bằng app mặc định của OS qua plugin-opener.
//!
//! Toàn bộ tag/cite/validate logic ở @trishteam/core/library (pure TS).
//! Rust không biết gì về Library doc shape.

use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use walkdir::{DirEntry, WalkDir};

const MAX_STORE_BYTES: u64 = 20 * 1024 * 1024; // 20 MiB — library metadata có thể nhiều doc hơn notes
const DEFAULT_STORE_FILENAME: &str = "library.json";
const APP_SUBDIR: &str = "TrishLibrary";

const MAX_ENTRIES_DEFAULT: usize = 5_000;
const MAX_ENTRIES_CAP: usize = 200_000;
const MAX_ENTRIES_FLOOR: usize = 100;
const MAX_DEPTH_DEFAULT: usize = 8;
const MAX_DEPTH_CAP: usize = 32;
const MAX_DEPTH_FLOOR: usize = 1;

/// Whitelist extensions nhận diện là tài liệu.
const ALLOWED_EXTS: &[&str] = &[
    "pdf", "docx", "doc", "epub", "txt", "md", "markdown", "html", "htm", "rtf", "odt",
];

#[derive(Debug, Serialize)]
pub struct StoreLocation {
    pub path: String,
    pub exists: bool,
    pub size_bytes: u64,
}

#[derive(Debug, Serialize)]
pub struct LoadResult {
    pub path: String,
    pub content: String,
    pub size_bytes: u64,
    pub created_empty: bool,
}

#[derive(Debug, Serialize)]
pub struct SaveResult {
    pub path: String,
    pub size_bytes: u64,
}

#[derive(Debug, Serialize)]
pub struct RawLibraryEntry {
    pub path: String,
    pub name: String,
    pub ext: String,
    pub size_bytes: u64,
    pub mtime_ms: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct ScanLibrarySummary {
    pub root: String,
    pub entries: Vec<RawLibraryEntry>,
    pub total_files_visited: usize,
    pub elapsed_ms: u64,
    pub errors: Vec<String>,
    pub max_entries_reached: bool,
}

fn default_store_dir() -> Result<PathBuf, String> {
    let mut d = dirs::data_local_dir()
        .or_else(dirs::data_dir)
        .or_else(dirs::home_dir)
        .ok_or_else(|| "Không tìm được local data dir".to_string())?;
    d.push(APP_SUBDIR);
    Ok(d)
}

fn resolve_store_path(custom: Option<String>) -> Result<PathBuf, String> {
    if let Some(c) = custom {
        let trimmed = c.trim();
        if !trimmed.is_empty() {
            return Ok(PathBuf::from(trimmed));
        }
    }
    let mut p = default_store_dir()?;
    p.push(DEFAULT_STORE_FILENAME);
    Ok(p)
}

fn ensure_parent(path: &Path) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        if !parent.as_os_str().is_empty() && !parent.exists() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Không tạo được folder {}: {e}", parent.display()))?;
        }
    }
    Ok(())
}

fn is_hidden(entry: &DirEntry) -> bool {
    if entry.depth() == 0 {
        return false;
    }
    let name = entry.file_name().to_string_lossy();
    if name.starts_with('.') {
        return true;
    }
    if entry.file_type().is_dir() {
        let lowered = name.to_ascii_lowercase();
        if matches!(
            lowered.as_str(),
            "node_modules" | "target" | ".git" | "$recycle.bin" | "system volume information"
        ) {
            return true;
        }
    }
    false
}

fn extension_of(p: &Path) -> Option<String> {
    p.extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_ascii_lowercase())
}

#[tauri::command]
fn default_store_location() -> Result<StoreLocation, String> {
    let p = resolve_store_path(None)?;
    let (exists, size) = match fs::metadata(&p) {
        Ok(m) => (m.is_file(), m.len()),
        Err(_) => (false, 0),
    };
    Ok(StoreLocation {
        path: p.to_string_lossy().into_owned(),
        exists,
        size_bytes: size,
    })
}

#[tauri::command]
fn load_library(path: Option<String>) -> Result<LoadResult, String> {
    let p = resolve_store_path(path)?;
    if !p.exists() {
        ensure_parent(&p)?;
        fs::write(&p, b"[]").map_err(|e| format!("Không khởi tạo store: {e}"))?;
        return Ok(LoadResult {
            path: p.to_string_lossy().into_owned(),
            content: "[]".into(),
            size_bytes: 2,
            created_empty: true,
        });
    }
    let meta = fs::metadata(&p).map_err(|e| format!("stat failed: {e}"))?;
    if !meta.is_file() {
        return Err(format!("{} không phải file thường", p.display()));
    }
    let size = meta.len();
    if size > MAX_STORE_BYTES {
        return Err(format!(
            "Store vượt cap {} bytes — refuse load để tránh OOM",
            MAX_STORE_BYTES
        ));
    }
    let content = fs::read_to_string(&p).map_err(|e| format!("read failed: {e}"))?;
    Ok(LoadResult {
        path: p.to_string_lossy().into_owned(),
        content,
        size_bytes: size,
        created_empty: false,
    })
}

#[tauri::command]
fn save_library(path: Option<String>, content: String) -> Result<SaveResult, String> {
    let p = resolve_store_path(path)?;
    ensure_parent(&p)?;
    let bytes = content.as_bytes();
    if bytes.len() as u64 > MAX_STORE_BYTES {
        return Err(format!(
            "content > cap {} bytes, refuse save",
            MAX_STORE_BYTES
        ));
    }
    if serde_json::from_slice::<serde_json::Value>(bytes).is_err() {
        return Err("content không phải JSON hợp lệ".into());
    }
    let tmp = p.with_extension("json.tmp");
    fs::write(&tmp, bytes).map_err(|e| format!("write tmp failed: {e}"))?;
    fs::rename(&tmp, &p).map_err(|e| format!("rename failed: {e}"))?;
    Ok(SaveResult {
        path: p.to_string_lossy().into_owned(),
        size_bytes: bytes.len() as u64,
    })
}

#[tauri::command]
fn scan_library(
    dir: String,
    max_entries: Option<usize>,
    max_depth: Option<usize>,
) -> Result<ScanLibrarySummary, String> {
    let root = PathBuf::from(&dir);
    if !root.exists() {
        return Err(format!("Thư mục không tồn tại: {}", root.display()));
    }
    if !root.is_dir() {
        return Err(format!("{} không phải thư mục", root.display()));
    }

    let cap_entries = max_entries
        .unwrap_or(MAX_ENTRIES_DEFAULT)
        .clamp(MAX_ENTRIES_FLOOR, MAX_ENTRIES_CAP);
    let cap_depth = max_depth
        .unwrap_or(MAX_DEPTH_DEFAULT)
        .clamp(MAX_DEPTH_FLOOR, MAX_DEPTH_CAP);

    let started = std::time::Instant::now();
    let mut entries: Vec<RawLibraryEntry> = Vec::new();
    let mut errors: Vec<String> = Vec::new();
    let mut total_files_visited: usize = 0;
    let mut max_entries_reached = false;

    let walker = WalkDir::new(&root)
        .max_depth(cap_depth)
        .follow_links(false)
        .into_iter()
        .filter_entry(|e| !is_hidden(e));

    for entry in walker {
        if entries.len() >= cap_entries {
            max_entries_reached = true;
            break;
        }
        match entry {
            Ok(e) => {
                if !e.file_type().is_file() {
                    continue;
                }
                total_files_visited += 1;
                let p = e.path();
                let ext = extension_of(p).unwrap_or_default();
                if !ALLOWED_EXTS.contains(&ext.as_str()) {
                    continue;
                }
                let meta = match fs::metadata(p) {
                    Ok(m) => m,
                    Err(err) => {
                        errors.push(format!("metadata {}: {err}", p.display()));
                        continue;
                    }
                };
                let size_bytes = meta.len();
                let mtime_ms = meta
                    .modified()
                    .ok()
                    .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                    .map(|d| d.as_millis() as i64);
                let name = e.file_name().to_string_lossy().into_owned();
                entries.push(RawLibraryEntry {
                    path: p.to_string_lossy().into_owned(),
                    name,
                    ext,
                    size_bytes,
                    mtime_ms,
                });
            }
            Err(err) => {
                errors.push(err.to_string());
            }
        }
    }

    let elapsed_ms = started.elapsed().as_millis() as u64;

    Ok(ScanLibrarySummary {
        root: root.to_string_lossy().into_owned(),
        entries,
        total_files_visited,
        elapsed_ms,
        errors,
        max_entries_reached,
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            default_store_location,
            load_library,
            save_library,
            scan_library,
        ])
        .run(tauri::generate_context!())
        .expect("error while running TrishLibrary");
}
