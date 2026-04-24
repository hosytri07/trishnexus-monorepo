//! TrishSearch Rust backend.
//!
//! Nhiệm vụ:
//!   1. Resolve default data dir (hiển thị thông tin môi trường).
//!   2. Đọc file JSON store của TrishNote / TrishLibrary (nguyên văn — để
//!      frontend parse qua `@trishteam/core/notes` / `@trishteam/core/library`).
//!   3. Scan 1 folder user chọn → trả danh sách file text rời
//!      (md/txt/html/rtf + kèm content đọc bounded) cho frontend indexing.
//!   4. Mở file bằng app mặc định OS qua plugin-opener.
//!
//! Toàn bộ tokenize / BM25 / rank / snippet đều ở @trishteam/core/fulltext
//! (pure TS). Rust ở đây chỉ đóng vai trò file-IO an toàn.

use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use walkdir::{DirEntry, WalkDir};

const MAX_JSON_BYTES: u64 = 40 * 1024 * 1024; // 40 MiB cho notes.json / library.json
const MAX_TEXT_BYTES_PER_FILE: u64 = 2 * 1024 * 1024; // 2 MiB / file text rời
const APP_SUBDIR: &str = "TrishSearch";

const MAX_ENTRIES_DEFAULT: usize = 2_000;
const MAX_ENTRIES_CAP: usize = 20_000;
const MAX_ENTRIES_FLOOR: usize = 50;
const MAX_DEPTH_DEFAULT: usize = 8;
const MAX_DEPTH_CAP: usize = 24;
const MAX_DEPTH_FLOOR: usize = 1;

/// Whitelist extensions đọc content làm full-text file rời.
const TEXT_EXTS: &[&str] = &["txt", "md", "markdown", "rst", "org", "html", "htm", "rtf"];

#[derive(Debug, Serialize)]
pub struct EnvLocation {
    pub data_dir: String,
    pub exists: bool,
}

#[derive(Debug, Serialize)]
pub struct JsonLoadResult {
    pub path: String,
    pub content: String,
    pub size_bytes: u64,
}

#[derive(Debug, Serialize)]
pub struct ScannedTextFile {
    pub path: String,
    pub name: String,
    pub ext: String,
    pub size_bytes: u64,
    pub mtime_ms: Option<i64>,
    pub content: String,
    pub truncated: bool,
}

#[derive(Debug, Serialize)]
pub struct ScanTextSummary {
    pub root: String,
    pub files: Vec<ScannedTextFile>,
    pub total_files_visited: usize,
    pub elapsed_ms: u64,
    pub errors: Vec<String>,
    pub max_entries_reached: bool,
}

fn default_data_dir() -> Result<PathBuf, String> {
    let mut d = dirs::data_local_dir()
        .or_else(dirs::data_dir)
        .or_else(dirs::home_dir)
        .ok_or_else(|| "Không tìm được local data dir".to_string())?;
    d.push(APP_SUBDIR);
    Ok(d)
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

fn read_text_bounded(path: &Path) -> Result<(String, u64, bool), String> {
    let meta = fs::metadata(path).map_err(|e| format!("stat failed: {e}"))?;
    let size = meta.len();
    // Nếu file lớn, đọc truncate bytes đầu để tránh OOM — user vẫn search được
    // title + phần đầu content (đủ cho ghi chú / tài liệu thông thường).
    let (content, truncated) = if size > MAX_TEXT_BYTES_PER_FILE {
        let bytes = fs::read(path).map_err(|e| format!("read failed: {e}"))?;
        let take = MAX_TEXT_BYTES_PER_FILE as usize;
        let slice = if bytes.len() > take { &bytes[..take] } else { &bytes };
        (String::from_utf8_lossy(slice).into_owned(), true)
    } else {
        (
            fs::read_to_string(path).map_err(|e| format!("read failed: {e}"))?,
            false,
        )
    };
    Ok((content, size, truncated))
}

#[tauri::command]
fn default_store_location() -> Result<EnvLocation, String> {
    let p = default_data_dir()?;
    let exists = p.exists();
    Ok(EnvLocation {
        data_dir: p.to_string_lossy().into_owned(),
        exists,
    })
}

#[tauri::command]
fn load_json_file(path: String) -> Result<JsonLoadResult, String> {
    let p = PathBuf::from(&path);
    if !p.exists() {
        return Err(format!("File không tồn tại: {}", p.display()));
    }
    let meta = fs::metadata(&p).map_err(|e| format!("stat failed: {e}"))?;
    if !meta.is_file() {
        return Err(format!("{} không phải file thường", p.display()));
    }
    let size = meta.len();
    if size > MAX_JSON_BYTES {
        return Err(format!(
            "File vượt cap {} bytes — refuse load để tránh OOM",
            MAX_JSON_BYTES
        ));
    }
    let content = fs::read_to_string(&p).map_err(|e| format!("read failed: {e}"))?;
    // Validate JSON nhẹ — đỡ cho frontend.
    if serde_json::from_str::<serde_json::Value>(&content).is_err() {
        return Err("Nội dung không phải JSON hợp lệ".into());
    }
    Ok(JsonLoadResult {
        path: p.to_string_lossy().into_owned(),
        content,
        size_bytes: size,
    })
}

#[tauri::command]
fn read_text_file(path: String) -> Result<ScannedTextFile, String> {
    let p = PathBuf::from(&path);
    if !p.exists() {
        return Err(format!("File không tồn tại: {}", p.display()));
    }
    if !p.is_file() {
        return Err(format!("{} không phải file thường", p.display()));
    }
    let ext = extension_of(&p).unwrap_or_default();
    if !TEXT_EXTS.contains(&ext.as_str()) {
        return Err(format!(
            "Extension .{} không nằm trong whitelist text",
            ext
        ));
    }
    let (content, size_bytes, truncated) = read_text_bounded(&p)?;
    let mtime_ms = fs::metadata(&p)
        .ok()
        .and_then(|m| m.modified().ok())
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as i64);
    let name = p
        .file_name()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_default();
    Ok(ScannedTextFile {
        path: p.to_string_lossy().into_owned(),
        name,
        ext,
        size_bytes,
        mtime_ms,
        content,
        truncated,
    })
}

#[tauri::command]
fn scan_text_folder(
    dir: String,
    max_entries: Option<usize>,
    max_depth: Option<usize>,
) -> Result<ScanTextSummary, String> {
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
    let mut files: Vec<ScannedTextFile> = Vec::new();
    let mut errors: Vec<String> = Vec::new();
    let mut total_files_visited: usize = 0;
    let mut max_entries_reached = false;

    let walker = WalkDir::new(&root)
        .max_depth(cap_depth)
        .follow_links(false)
        .into_iter()
        .filter_entry(|e| !is_hidden(e));

    for entry in walker {
        if files.len() >= cap_entries {
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
                if !TEXT_EXTS.contains(&ext.as_str()) {
                    continue;
                }
                let (content, size_bytes, truncated) = match read_text_bounded(p) {
                    Ok(v) => v,
                    Err(err) => {
                        errors.push(format!("{}: {}", p.display(), err));
                        continue;
                    }
                };
                let mtime_ms = fs::metadata(p)
                    .ok()
                    .and_then(|m| m.modified().ok())
                    .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                    .map(|d| d.as_millis() as i64);
                let name = e.file_name().to_string_lossy().into_owned();
                files.push(ScannedTextFile {
                    path: p.to_string_lossy().into_owned(),
                    name,
                    ext,
                    size_bytes,
                    mtime_ms,
                    content,
                    truncated,
                });
            }
            Err(err) => {
                errors.push(err.to_string());
            }
        }
    }

    let elapsed_ms = started.elapsed().as_millis() as u64;

    Ok(ScanTextSummary {
        root: root.to_string_lossy().into_owned(),
        files,
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
            load_json_file,
            read_text_file,
            scan_text_folder,
        ])
        .run(tauri::generate_context!())
        .expect("error while running TrishSearch");
}
