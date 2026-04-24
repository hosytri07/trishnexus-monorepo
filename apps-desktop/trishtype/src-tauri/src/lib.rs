//! TrishType Rust backend — chỉ lo file I/O (read/write .txt/.md/.json).
//!
//! Toàn bộ CRDT + multi-caret logic sống ở `@trishteam/core/type`
//! (pure TS, testable, reusable cho website/Zalo). Rust không biết
//! gì về caret hay char ID — chỉ đọc/ghi bytes.
//!
//! Hard cap 5 MiB để tránh editor render cả file log khủng.

use serde::Serialize;
use std::fs;
use std::path::PathBuf;

const MAX_FILE_BYTES: u64 = 5 * 1024 * 1024;

#[derive(Debug, Serialize)]
pub struct FileReadResult {
    pub path: String,
    pub content: String,
    pub size_bytes: u64,
    pub truncated: bool,
}

#[derive(Debug, Serialize)]
pub struct FileWriteResult {
    pub path: String,
    pub size_bytes: u64,
}

#[tauri::command]
fn read_text_file(path: String) -> Result<FileReadResult, String> {
    let p = PathBuf::from(&path);
    let meta = fs::metadata(&p).map_err(|e| format!("stat failed: {e}"))?;
    if !meta.is_file() {
        return Err(format!("not a regular file: {path}"));
    }
    let size = meta.len();
    let (content, truncated) = if size > MAX_FILE_BYTES {
        // Đọc khúc đầu tiên, tránh OOM trên log file khủng.
        let bytes = fs::read(&p).map_err(|e| format!("read failed: {e}"))?;
        let slice = &bytes[..(MAX_FILE_BYTES as usize).min(bytes.len())];
        let s = String::from_utf8_lossy(slice).to_string();
        (s, true)
    } else {
        let s = fs::read_to_string(&p).map_err(|e| format!("read failed: {e}"))?;
        (s, false)
    };
    Ok(FileReadResult {
        path: p.to_string_lossy().into_owned(),
        content,
        size_bytes: size,
        truncated,
    })
}

#[tauri::command]
fn write_text_file(path: String, content: String) -> Result<FileWriteResult, String> {
    let p = PathBuf::from(&path);
    // Parent phải tồn tại — không tự tạo folder cha để tránh side effect.
    if let Some(parent) = p.parent() {
        if !parent.as_os_str().is_empty() && !parent.exists() {
            return Err(format!(
                "parent folder không tồn tại: {}",
                parent.display()
            ));
        }
    }
    let bytes = content.as_bytes();
    if bytes.len() as u64 > MAX_FILE_BYTES {
        return Err(format!(
            "content > cap {} bytes, refusing to write",
            MAX_FILE_BYTES
        ));
    }
    fs::write(&p, bytes).map_err(|e| format!("write failed: {e}"))?;
    Ok(FileWriteResult {
        path: p.to_string_lossy().into_owned(),
        size_bytes: bytes.len() as u64,
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![read_text_file, write_text_file])
        .run(tauri::generate_context!())
        .expect("error while running TrishType");
}
