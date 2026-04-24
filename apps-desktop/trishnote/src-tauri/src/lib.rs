//! TrishNote Rust backend — chỉ lo JSON I/O cho local note store.
//!
//! Toàn bộ validate/review/kanban logic sống ở `@trishteam/core/notes`
//! (pure TS, testable). Rust không biết gì về Note shape — chỉ đọc/ghi
//! bytes, resolve default store path trong app data dir.
//!
//! Hard cap 10 MiB để ngăn user/process khác đổ file khủng vào.

use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};

const MAX_STORE_BYTES: u64 = 10 * 1024 * 1024;
const DEFAULT_STORE_FILENAME: &str = "notes.json";
const APP_SUBDIR: &str = "TrishNote";

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
fn load_notes(path: Option<String>) -> Result<LoadResult, String> {
    let p = resolve_store_path(path)?;
    // Seed "[]" nếu file chưa có, để frontend không phải handle ENOENT.
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
fn save_notes(path: Option<String>, content: String) -> Result<SaveResult, String> {
    let p = resolve_store_path(path)?;
    ensure_parent(&p)?;
    let bytes = content.as_bytes();
    if bytes.len() as u64 > MAX_STORE_BYTES {
        return Err(format!(
            "content > cap {} bytes, refuse save",
            MAX_STORE_BYTES
        ));
    }
    // Best effort JSON validate — reject payload malformed để không phá store.
    if serde_json::from_slice::<serde_json::Value>(bytes).is_err() {
        return Err("content không phải JSON hợp lệ".into());
    }
    // Atomic-ish write: write tới tmp rồi rename.
    let tmp = p.with_extension("json.tmp");
    fs::write(&tmp, bytes).map_err(|e| format!("write tmp failed: {e}"))?;
    fs::rename(&tmp, &p).map_err(|e| format!("rename failed: {e}"))?;
    Ok(SaveResult {
        path: p.to_string_lossy().into_owned(),
        size_bytes: bytes.len() as u64,
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            default_store_location,
            load_notes,
            save_notes
        ])
        .run(tauri::generate_context!())
        .expect("error while running TrishNote");
}
