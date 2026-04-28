//! TrishAdmin Rust backend.
//!
//! Tauri commands:
//!   - `app_version` — version từ Cargo.toml.
//!   - `read_text_file(path)` — đọc file text bất kỳ (cho Registry editor đọc
//!     apps-registry.json + min-specs.json local).
//!   - `write_text_file(path, content)` — ghi atomic (temp + rename) cho registry edit.
//!   - `default_data_dir` — thư mục local cache (vd repo path lưu sẵn cho lần sau).
//!
//! KHÔNG có Firebase Admin SDK ở Rust — frontend dùng Firebase SDK JS giống
//! các app khác. Admin role check ở client + Firestore Security Rules.

use std::{
    fs::{self, File},
    io::{Read, Write},
    path::PathBuf,
};

use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DataDirInfo {
    pub data_dir: String,
}

const FILE_CAP_BYTES: u64 = 16 * 1024 * 1024; // 16 MiB

#[tauri::command]
fn app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[tauri::command]
fn default_data_dir() -> Result<DataDirInfo, String> {
    let base = dirs::data_local_dir()
        .ok_or_else(|| "không lấy được data_local_dir".to_string())?;
    let dir = base.join("TrishTEAM").join("TrishAdmin");
    fs::create_dir_all(&dir).map_err(|e| format!("create_dir_all: {e}"))?;
    Ok(DataDirInfo {
        data_dir: dir.to_string_lossy().to_string(),
    })
}

#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
    let p = PathBuf::from(&path);
    let meta = fs::metadata(&p).map_err(|e| format!("metadata({path}): {e}"))?;
    if meta.len() > FILE_CAP_BYTES {
        return Err(format!(
            "File quá lớn ({} bytes > cap {})",
            meta.len(),
            FILE_CAP_BYTES
        ));
    }
    let mut f = File::open(&p).map_err(|e| format!("open({path}): {e}"))?;
    let mut buf = String::new();
    f.read_to_string(&mut buf).map_err(|e| format!("read: {e}"))?;
    Ok(buf)
}

#[tauri::command]
fn write_text_file(path: String, content: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    if content.len() as u64 > FILE_CAP_BYTES {
        return Err(format!("Content quá lớn ({} bytes)", content.len()));
    }
    if let Some(parent) = p.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("create_dir_all: {e}"))?;
    }
    // Atomic write: ghi vào temp rồi rename.
    let tmp = p.with_extension(format!(
        "{}.tmp",
        p.extension().map(|s| s.to_string_lossy()).unwrap_or_default()
    ));
    {
        let mut f = File::create(&tmp).map_err(|e| format!("create tmp: {e}"))?;
        f.write_all(content.as_bytes())
            .map_err(|e| format!("write tmp: {e}"))?;
        f.sync_all().ok();
    }
    fs::rename(&tmp, &p).map_err(|e| format!("rename: {e}"))?;
    Ok(())
}

#[tauri::command]
fn check_path_exists(path: String) -> bool {
    PathBuf::from(&path).exists()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            app_version,
            default_data_dir,
            read_text_file,
            write_text_file,
            check_path_exists,
        ])
        .run(tauri::generate_context!())
        .expect("error while running TrishAdmin");
}
