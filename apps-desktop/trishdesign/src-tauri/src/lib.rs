//! TrishDesign Rust backend — 3 Tauri command:
//!
//!   - `default_store_location` → app data dir cho preset/palette local.
//!   - `load_design_file(path)` → đọc JSON DesignTokenSet (cap 8 MiB, validate shape).
//!   - `save_design_file(path, payload)` → atomic write JSON (temp → rename).
//!
//! Không dùng fs plugin — IO thuần `std::fs` để kiểm soát hard cap.

use std::{
    fs::{self, OpenOptions},
    io::Write,
    path::{Path, PathBuf},
};

use serde::{Deserialize, Serialize};

/// Cap tối đa khi đọc/ghi file token — 8 MiB.
const FILE_CAP_BYTES: u64 = 8 * 1024 * 1024;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvLocation {
    pub data_dir: String,
    pub exists: bool,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DesignLoadResult {
    pub path: String,
    pub bytes: u64,
    /// JSON text (utf-8) của file. UI tự parse.
    pub text: String,
    /// True nếu parse được JSON valid (không validate schema).
    pub valid_json: bool,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DesignSaveResult {
    pub path: String,
    pub bytes: u64,
}

#[tauri::command]
fn default_store_location(app: tauri::AppHandle) -> Result<EnvLocation, String> {
    let dir: PathBuf = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Không lấy được app data dir: {e}"))?;
    let exists = dir.exists();
    Ok(EnvLocation {
        data_dir: dir.to_string_lossy().into_owned(),
        exists,
    })
}

#[tauri::command]
fn load_design_file(path: String) -> Result<DesignLoadResult, String> {
    let p = Path::new(&path);
    if !p.exists() {
        return Err(format!("File không tồn tại: {path}"));
    }
    if !p.is_file() {
        return Err(format!("Không phải file: {path}"));
    }
    let meta =
        fs::metadata(p).map_err(|e| format!("Không đọc metadata: {e}"))?;
    let bytes = meta.len();
    if bytes > FILE_CAP_BYTES {
        return Err(format!(
            "File quá lớn ({} MiB) — cap {} MiB",
            bytes / (1024 * 1024),
            FILE_CAP_BYTES / (1024 * 1024)
        ));
    }
    let text =
        fs::read_to_string(p).map_err(|e| format!("Không đọc được file: {e}"))?;
    let valid_json = serde_json::from_str::<serde_json::Value>(&text).is_ok();
    Ok(DesignLoadResult {
        path: p.to_string_lossy().into_owned(),
        bytes,
        text,
        valid_json,
    })
}

#[tauri::command]
fn save_design_file(path: String, payload: String) -> Result<DesignSaveResult, String> {
    let bytes = payload.as_bytes().len() as u64;
    if bytes > FILE_CAP_BYTES {
        return Err(format!(
            "Payload quá lớn ({} MiB) — cap {} MiB",
            bytes / (1024 * 1024),
            FILE_CAP_BYTES / (1024 * 1024)
        ));
    }
    // Validate JSON trước khi ghi.
    if serde_json::from_str::<serde_json::Value>(&payload).is_err() {
        return Err("Payload không phải JSON hợp lệ.".to_string());
    }
    let p = Path::new(&path);
    if let Some(parent) = p.parent() {
        if !parent.as_os_str().is_empty() && !parent.exists() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Không tạo được thư mục: {e}"))?;
        }
    }
    // Atomic write: ghi tempfile rồi rename.
    let tmp = p.with_extension("tmp-tsn");
    {
        let mut f = OpenOptions::new()
            .write(true)
            .create(true)
            .truncate(true)
            .open(&tmp)
            .map_err(|e| format!("Không tạo temp: {e}"))?;
        f.write_all(payload.as_bytes())
            .map_err(|e| format!("Ghi temp lỗi: {e}"))?;
        f.sync_all().ok();
    }
    fs::rename(&tmp, p).map_err(|e| format!("Rename lỗi: {e}"))?;
    Ok(DesignSaveResult {
        path: p.to_string_lossy().into_owned(),
        bytes,
    })
}

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            default_store_location,
            load_design_file,
            save_design_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running TrishDesign");
}
