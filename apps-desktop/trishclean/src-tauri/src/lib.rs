//! TrishClean — Tauri 2 backend.
//!
//! Safety-first approach:
//! - `scan_dir` đọc metadata, KHÔNG open file content.
//! - Classification logic delegated cho TS (`@trishteam/core/clean`)
//!   — Rust chỉ trả raw entries.
//! - Hard limits (max_entries, max_depth) để tránh user pick nhầm `/`
//!   treo UI.
//! - Không có `delete_file` command — Phase 14.3.1 alpha chỉ scan.
//!   Stage/commit delete sẽ thêm ở 14.3.2 sau khi UI review được
//!   test kỹ.

use serde::Serialize;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};
use walkdir::WalkDir;

#[derive(Debug, Serialize)]
pub struct RawEntry {
    path: String,
    size_bytes: u64,
    modified_at_ms: u64,
    accessed_at_ms: u64,
    is_dir: bool,
}

#[derive(Debug, Serialize)]
pub struct ScanStats {
    entries: Vec<RawEntry>,
    total_size_bytes: u64,
    truncated: bool,
    elapsed_ms: u128,
    errors: u32,
}

fn to_epoch_ms(t: Option<SystemTime>) -> u64 {
    t.and_then(|s| s.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// Scan `path` recursive. Hard-cap `max_entries` và `max_depth` để
/// an toàn khi user pick nhầm `C:\` hoặc `/`.
///
/// Returns `truncated=true` nếu cap bị chạm → UI hiển thị banner
/// "quá nhiều file, scan folder nhỏ hơn".
#[tauri::command]
async fn scan_dir(
    path: String,
    max_entries: Option<usize>,
    max_depth: Option<usize>,
) -> Result<ScanStats, String> {
    let cap = max_entries.unwrap_or(20_000).clamp(100, 200_000);
    let depth = max_depth.unwrap_or(6).clamp(1, 32);

    let root = Path::new(&path);
    if !root.exists() {
        return Err(format!("Không tìm thấy: {}", path));
    }
    if !root.is_dir() {
        return Err(format!("Không phải thư mục: {}", path));
    }

    let started = std::time::Instant::now();
    let mut entries = Vec::with_capacity(cap.min(2048));
    let mut total_size_bytes: u64 = 0;
    let mut truncated = false;
    let mut errors: u32 = 0;

    // Không dùng `.filter_map` để handle Err vì closure sẽ mutably borrow
    // `errors` suốt lifetime iterator, đâm với assign `errors` trong loop body
    // (E0503/E0506). Match Result inline trong loop cho an toàn + rõ ràng.
    for entry_result in WalkDir::new(root)
        .max_depth(depth)
        .follow_links(false)
        .into_iter()
    {
        let entry = match entry_result {
            Ok(ent) => ent,
            Err(_) => {
                errors = errors.saturating_add(1);
                continue;
            }
        };
        if entries.len() >= cap {
            truncated = true;
            break;
        }
        let meta = match entry.metadata() {
            Ok(m) => m,
            Err(_) => {
                errors = errors.saturating_add(1);
                continue;
            }
        };
        let is_dir = meta.is_dir();
        let size = if is_dir { 0 } else { meta.len() };
        total_size_bytes = total_size_bytes.saturating_add(size);

        entries.push(RawEntry {
            path: entry.path().to_string_lossy().into_owned(),
            size_bytes: size,
            modified_at_ms: to_epoch_ms(meta.modified().ok()),
            accessed_at_ms: to_epoch_ms(meta.accessed().ok()),
            is_dir,
        });
    }

    Ok(ScanStats {
        entries,
        total_size_bytes,
        truncated,
        elapsed_ms: started.elapsed().as_millis(),
        errors,
    })
}

#[tauri::command]
fn app_version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![scan_dir, app_version])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
