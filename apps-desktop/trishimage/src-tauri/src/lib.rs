//! TrishImage Rust backend — metadata-only scan.
//!
//! - `scan_images(dir, max_entries?, max_depth?)`: walk folder tìm
//!   ảnh theo extension whitelist, cho mỗi file thử parse EXIF
//!   (ưu tiên DateTimeOriginal → fallback mtime) + đọc dimensions
//!   từ header (≤ 512 byte) qua `imagesize`. Không decode pixel,
//!   tránh OOM trên ảnh 50 MP.
//! - Hard cap để bảo vệ user: max_entries clamp [100, 200_000],
//!   max_depth clamp [1, 32].

use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{Instant, SystemTime, UNIX_EPOCH};
use walkdir::WalkDir;

const EXTS: &[&str] = &[
    "jpg", "jpeg", "png", "webp", "gif", "bmp", "tif", "tiff", "heic", "heif",
];

#[derive(Debug, Serialize)]
pub struct RawImageEntry {
    pub path: String,
    pub name: String,
    pub ext: String,
    pub size_bytes: u64,
    pub taken_ms: Option<i64>,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub camera: Option<String>,
    pub has_gps: bool,
    pub face_count: Option<u32>,
}

#[derive(Debug, Serialize)]
pub struct ScanImagesStats {
    pub entries: Vec<RawImageEntry>,
    pub truncated: bool,
    pub elapsed_ms: u128,
    pub errors: usize,
}

fn is_image_ext(ext: &str) -> bool {
    let lower = ext.to_ascii_lowercase();
    EXTS.iter().any(|e| *e == lower)
}

fn parse_entry(path: &Path) -> Option<RawImageEntry> {
    let meta = fs::metadata(path).ok()?;
    if !meta.is_file() {
        return None;
    }
    let name = path.file_name()?.to_string_lossy().into_owned();
    let ext = path
        .extension()
        .map(|e| e.to_string_lossy().into_owned())
        .unwrap_or_default();
    if !is_image_ext(&ext) {
        return None;
    }
    let size_bytes = meta.len();

    // EXIF block.
    let mut taken_ms: Option<i64> = None;
    let mut camera: Option<String> = None;
    let mut has_gps = false;
    if let Ok(file) = std::fs::File::open(path) {
        let mut reader = std::io::BufReader::new(&file);
        let exif_reader = exif::Reader::new();
        if let Ok(exif) = exif_reader.read_from_container(&mut reader) {
            // DateTimeOriginal (tag 0x9003) trong IFD Exif.
            if let Some(field) = exif.get_field(
                exif::Tag::DateTimeOriginal,
                exif::In::PRIMARY,
            ) {
                let s = field.display_value().to_string();
                if let Some(ms) = parse_exif_datetime(&s) {
                    taken_ms = Some(ms);
                }
            }
            if let Some(field) =
                exif.get_field(exif::Tag::Model, exif::In::PRIMARY)
            {
                let s = field
                    .display_value()
                    .to_string()
                    .trim_matches('"')
                    .trim()
                    .to_string();
                if !s.is_empty() {
                    camera = Some(s);
                }
            }
            // GPS có hay không — check tag GPSLatitude trong IFD GPS (In::PRIMARY
            // vẫn match vì kamadak-exif đọc qua container).
            if exif
                .get_field(exif::Tag::GPSLatitude, exif::In::PRIMARY)
                .is_some()
            {
                has_gps = true;
            }
        }
    }

    // Fallback mtime nếu không có EXIF time.
    if taken_ms.is_none() {
        if let Ok(m) = meta.modified() {
            if let Ok(d) = m.duration_since(UNIX_EPOCH) {
                taken_ms = Some(d.as_millis() as i64);
            }
        }
    }

    // Dimensions qua imagesize (header-only, ≤ 512 byte đọc).
    let (width, height) = match imagesize::size(path) {
        Ok(s) => (Some(s.width as u32), Some(s.height as u32)),
        Err(_) => (None, None),
    };

    Some(RawImageEntry {
        path: path.to_string_lossy().into_owned(),
        name,
        ext: ext.to_ascii_lowercase(),
        size_bytes,
        taken_ms,
        width,
        height,
        camera,
        has_gps,
        face_count: None, // v1 chưa wire face model.
    })
}

/// Parse "2024:07:15 14:32:09" (EXIF format) → unix ms.
/// Giả định là local time của camera (không có timezone info trong
/// EXIF cơ bản — sẽ hơi lệch nếu user đi du lịch, nhưng OK cho v1).
fn parse_exif_datetime(s: &str) -> Option<i64> {
    // Strip quote nếu có.
    let s = s.trim_matches('"').trim();
    // Format: "YYYY:MM:DD HH:MM:SS".
    let mut parts = s.split(|c: char| c == ':' || c == ' ' || c == '-');
    let y: i64 = parts.next()?.parse().ok()?;
    let mo: i64 = parts.next()?.parse().ok()?;
    let d: i64 = parts.next()?.parse().ok()?;
    let h: i64 = parts.next()?.parse().ok()?;
    let mi: i64 = parts.next()?.parse().ok()?;
    let se: i64 = parts.next()?.parse().ok()?;
    if !(1970..=3000).contains(&y) {
        return None;
    }
    // Naive: days from civil epoch (thuật Hinnant).
    let a = (14 - mo) / 12;
    let y2 = y - a;
    let m2 = mo + 12 * a - 3;
    let days = (153 * m2 + 2) / 5 + 365 * y2 + y2 / 4 - y2 / 100 + y2 / 400
        - 719468 + (d - 1);
    let secs = days * 86400 + h * 3600 + mi * 60 + se;
    Some(secs * 1000)
}

#[tauri::command]
fn scan_images(
    dir: String,
    max_entries: Option<usize>,
    max_depth: Option<usize>,
) -> Result<ScanImagesStats, String> {
    let cap = max_entries.unwrap_or(5_000).clamp(100, 200_000);
    let depth = max_depth.unwrap_or(8).clamp(1, 32);
    let start = Instant::now();

    let root = PathBuf::from(&dir);
    if !root.is_dir() {
        return Err(format!("'{dir}' không phải folder"));
    }

    let mut entries: Vec<RawImageEntry> = Vec::with_capacity(cap / 8);
    let mut truncated = false;
    let mut errors: usize = 0;

    for res in WalkDir::new(&root)
        .follow_links(false)
        .max_depth(depth)
        .into_iter()
        .filter_entry(|e| {
            // Bỏ qua hidden folder phổ biến (tăng tốc).
            let name = e.file_name().to_string_lossy();
            !(e.file_type().is_dir()
                && (name == "node_modules"
                    || name == ".git"
                    || name.starts_with('.') && name.len() > 1))
        })
    {
        let e = match res {
            Ok(e) => e,
            Err(_) => {
                errors += 1;
                continue;
            }
        };
        if !e.file_type().is_file() {
            continue;
        }
        if let Some(row) = parse_entry(e.path()) {
            entries.push(row);
            if entries.len() >= cap {
                truncated = true;
                break;
            }
        }
    }

    let elapsed_ms = start.elapsed().as_millis();
    // Touch once để silence unused import warning nếu SystemTime chưa dùng khác.
    let _ = SystemTime::now();
    Ok(ScanImagesStats {
        entries,
        truncated,
        elapsed_ms,
        errors,
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![scan_images])
        .run(tauri::generate_context!())
        .expect("error while running TrishImage");
}
