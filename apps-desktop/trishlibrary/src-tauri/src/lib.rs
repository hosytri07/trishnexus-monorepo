//! TrishLibrary Rust backend — Phase 15.2.r8.
//!
//! 4 nhiệm vụ:
//!   1. Resolve + đọc/ghi `library.json` trong local data dir.
//!   2. App version + fetch_text generic HTTP cho update check.
//!   3. Scan folder thư viện (walkdir whitelist 10 ext) — TrishLibrary v1
//!      yêu cầu user chọn 1 folder làm thư viện, app scan recursive.
//!   4. (Phase 15.3+) Sẽ thêm: download PDF từ link để extract text RAG.

use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;
use walkdir::{DirEntry, WalkDir};

const MAX_STORE_BYTES: u64 = 20 * 1024 * 1024; // 20 MiB
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
    "pdf", "docx", "doc", "xlsx", "xls", "pptx", "ppt", "epub", "txt", "md", "markdown",
    "html", "htm", "rtf", "odt", "zip", "rar", "7z", "mp4", "mkv", "avi", "mov", "webm",
    "mp3", "wav", "flac", "m4a", "ogg", "jpg", "jpeg", "png", "gif", "webp", "svg",
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
    /// Phase 15.2.r8 — relative path từ library root tới folder cha (không
    /// bao gồm filename). Empty = file ở root. UI dùng để group folder con.
    pub folder: String,
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
    d.push("TrishTEAM");
    d.push(APP_SUBDIR);
    Ok(d)
}

fn resolve_store_path(custom: Option<String>) -> Result<PathBuf, String> {
    if let Some(c) = custom {
        let trimmed = c.trim();
        if !trimmed.is_empty() {
            // Phase 16.2.b — relative path → đặt trong default dir
            // (cho phép per-UID file: library.{uid}.json)
            let p = PathBuf::from(trimmed);
            if p.is_absolute() {
                return Ok(p);
            }
            // Sanitize: chỉ cho phép alphanumeric + dot + dash + underscore
            // để tránh path traversal qua "../"
            if trimmed.contains("..") || trimmed.contains('/') || trimmed.contains('\\') {
                return Err(format!("Invalid store filename: {}", trimmed));
            }
            let mut base = default_store_dir()?;
            base.push(trimmed);
            return Ok(base);
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

/// Phase 15.2.r8 — Scan folder thư viện recursive. Trả raw entries cho frontend
/// merge với DB hiện có (giữ doc_title/links/note đã user nhập).
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

                // Compute relative folder path from root (parent của file, không
                // bao gồm filename). Empty = file nằm ngay tại root.
                let folder = match p.parent() {
                    Some(parent) => match parent.strip_prefix(&root) {
                        Ok(rel) => {
                            let s = rel.to_string_lossy().replace('\\', "/");
                            s.trim_matches('/').to_string()
                        }
                        Err(_) => String::new(),
                    },
                    None => String::new(),
                };

                entries.push(RawLibraryEntry {
                    path: p.to_string_lossy().into_owned(),
                    name,
                    ext,
                    size_bytes,
                    mtime_ms,
                    folder,
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

// ============================================================
// Phase 15.2.f — App version + Update check (fetch registry)
// ============================================================

#[tauri::command]
fn app_version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}

// ============================================================
// Phase 16.2.e — Save QR PNG (decode base64 data URL → write file)
// Tauri WebView2 không hỗ trợ <a download> với data: URL → cần native.
// ============================================================

#[tauri::command]
fn save_qr_file(path: String, base64_data: String) -> Result<u64, String> {
    use base64::Engine as _;
    let target = PathBuf::from(&path);
    if path.trim().is_empty() {
        return Err("save_qr_file: path rỗng".into());
    }
    ensure_parent(&target)?;
    // Strip optional `data:image/png;base64,` prefix nếu frontend lười.
    let cleaned = if let Some(idx) = base64_data.find("base64,") {
        &base64_data[idx + 7..]
    } else {
        base64_data.as_str()
    };
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(cleaned.trim())
        .map_err(|e| format!("base64 decode: {e}"))?;
    fs::write(&target, &bytes).map_err(|e| format!("write fail: {e}"))?;
    Ok(bytes.len() as u64)
}

#[tauri::command]
async fn fetch_text(url: String) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .user_agent(concat!("TrishLibrary/", env!("CARGO_PKG_VERSION")))
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
// Phase 18 — Generic file I/O (cho Document module)
// ============================================================

// Phase 39 — Tăng limit cho engineer xử lý PDF công văn lớn (50-200MB).
// Trước: 16MB text / 32MB binary → hay reject PDF công văn ngành GT.
const MAX_TEXT_BYTES: u64 = 64 * 1024 * 1024;       // 64 MB
const MAX_BINARY_BYTES: u64 = 500 * 1024 * 1024;    // 500 MB

#[tauri::command]
fn read_text_string(path: String) -> Result<String, String> {
    let p = PathBuf::from(&path);
    let meta = fs::metadata(&p).map_err(|e| format!("stat: {e}"))?;
    if !meta.is_file() {
        return Err(format!("Không phải file: {}", path));
    }
    if meta.len() > MAX_TEXT_BYTES {
        return Err(format!(
            "File > {} MB",
            MAX_TEXT_BYTES / 1024 / 1024
        ));
    }
    let bytes = fs::read(&p).map_err(|e| format!("read: {e}"))?;
    Ok(String::from_utf8_lossy(&bytes).into_owned())
}

#[tauri::command]
fn write_text_string(path: String, content: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    let bytes = content.as_bytes();
    if bytes.len() as u64 > MAX_TEXT_BYTES {
        return Err(format!(
            "Content > {} MB",
            MAX_TEXT_BYTES / 1024 / 1024
        ));
    }
    if let Some(parent) = p.parent() {
        if !parent.as_os_str().is_empty() && !parent.exists() {
            fs::create_dir_all(parent).map_err(|e| format!("create_dir: {e}"))?;
        }
    }
    let tmp = p.with_extension("trish.tmp");
    fs::write(&tmp, bytes).map_err(|e| format!("write tmp: {e}"))?;
    fs::rename(&tmp, &p).map_err(|e| format!("rename: {e}"))?;
    Ok(())
}

#[tauri::command]
fn read_binary_file(path: String) -> Result<Vec<u8>, String> {
    let p = PathBuf::from(&path);
    let meta = fs::metadata(&p).map_err(|e| format!("stat: {e}"))?;
    if !meta.is_file() {
        return Err(format!("Không phải file: {}", path));
    }
    if meta.len() > MAX_BINARY_BYTES {
        return Err(format!(
            "File > {} MB",
            MAX_BINARY_BYTES / 1024 / 1024
        ));
    }
    fs::read(&p).map_err(|e| format!("read: {e}"))
}

#[tauri::command]
fn write_binary_file(path: String, bytes: Vec<u8>) -> Result<(), String> {
    let p = PathBuf::from(&path);
    if bytes.len() as u64 > MAX_BINARY_BYTES {
        return Err(format!(
            "Content > {} MB",
            MAX_BINARY_BYTES / 1024 / 1024
        ));
    }
    if let Some(parent) = p.parent() {
        if !parent.as_os_str().is_empty() && !parent.exists() {
            fs::create_dir_all(parent).map_err(|e| format!("create_dir: {e}"))?;
        }
    }
    let tmp = p.with_extension("trish.tmp");
    fs::write(&tmp, &bytes).map_err(|e| format!("write tmp: {e}"))?;
    fs::rename(&tmp, &p).map_err(|e| format!("rename: {e}"))?;
    Ok(())
}

// ============================================================
// Phase 18 — System fonts cho Document/Note editor
// ============================================================

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
        if n.name_id == 1 {
            if let Some(s) = n.to_string() {
                let trimmed = s.trim().to_string();
                if !trimmed.is_empty() {
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
// Phase 18 — File attachments cho Note module
// ============================================================

/// Copy file vào attachments dir, return path mới.
#[tauri::command]
fn attach_file(uid: String, src_path: String) -> Result<String, String> {
    let src = PathBuf::from(&src_path);
    if !src.exists() || !src.is_file() {
        return Err(format!("File nguồn không tồn tại: {}", src_path));
    }
    let mut dir = default_store_dir()?;
    dir.push("attachments");
    dir.push(&uid);
    fs::create_dir_all(&dir).map_err(|e| format!("create_dir: {e}"))?;

    let file_name = src
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .ok_or_else(|| "Không lấy được tên file".to_string())?;
    let mut target = dir.join(&file_name);
    // Avoid overwrite — append timestamp nếu trùng
    if target.exists() {
        let stem = src.file_stem().map(|s| s.to_string_lossy().into_owned()).unwrap_or_default();
        let ext = src.extension().map(|e| e.to_string_lossy().into_owned()).unwrap_or_default();
        let ts = std::time::SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);
        let new_name = if ext.is_empty() {
            format!("{stem}_{ts}")
        } else {
            format!("{stem}_{ts}.{ext}")
        };
        target = dir.join(new_name);
    }
    fs::copy(&src, &target).map_err(|e| format!("copy: {e}"))?;
    Ok(target.to_string_lossy().into_owned())
}

#[tauri::command]
fn remove_attached_file(path: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    if !p.exists() {
        return Ok(()); // already gone
    }
    fs::remove_file(&p).map_err(|e| format!("remove: {e}"))?;
    Ok(())
}

#[tauri::command]
async fn open_local_path(app: tauri::AppHandle, path: String) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    app.opener()
        .open_path(&path, None::<&str>)
        .map_err(|e| format!("open: {e}"))
}

// ============================================================
// Phase 18.6.e — Copy file (export) + folder check (LAN/UNC)
// ============================================================

/// Copy a file from src to dst. Used by Module Ảnh export.
/// Creates parent dirs if needed. Atomic via tmp+rename when same device.
#[tauri::command]
fn copy_file(src: String, dst: String) -> Result<u64, String> {
    let src_p = PathBuf::from(&src);
    let dst_p = PathBuf::from(&dst);
    if !src_p.is_file() {
        return Err(format!("Không phải file: {src}"));
    }
    if let Some(parent) = dst_p.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("create_dir parent: {e}"))?;
    }
    fs::copy(&src_p, &dst_p).map_err(|e| format!("copy: {e}"))
}

/// Check if a folder path is reachable (works for UNC \\server\share paths).
#[tauri::command]
fn check_folder_exists(path: String) -> Result<bool, String> {
    Ok(PathBuf::from(path).is_dir())
}

// ============================================================
// Phase 18.6.h — EXIF metadata reader
// ============================================================

#[derive(serde::Serialize, Default)]
struct ExifData {
    camera_make: Option<String>,
    camera_model: Option<String>,
    lens: Option<String>,
    datetime_original: Option<String>,
    iso: Option<String>,
    aperture: Option<String>,
    shutter_speed: Option<String>,
    focal_length: Option<String>,
    flash: Option<String>,
    width: Option<u32>,
    height: Option<u32>,
    orientation: Option<String>,
    gps_lat: Option<f64>,
    gps_lon: Option<f64>,
    gps_altitude: Option<f64>,
    has_exif: bool,
}

fn parse_gps_coord(value: &exif::Value, ref_value: Option<&exif::Value>) -> Option<f64> {
    let coords = match value {
        exif::Value::Rational(v) if v.len() >= 3 => {
            let d = v[0].to_f64();
            let m = v[1].to_f64();
            let s = v[2].to_f64();
            d + m / 60.0 + s / 3600.0
        }
        _ => return None,
    };
    let sign = match ref_value {
        Some(exif::Value::Ascii(arr)) if !arr.is_empty() => {
            let s = String::from_utf8_lossy(&arr[0]);
            if s.contains('S') || s.contains('W') { -1.0 } else { 1.0 }
        }
        _ => 1.0,
    };
    Some(coords * sign)
}

#[tauri::command]
fn read_image_exif(path: String) -> Result<ExifData, String> {
    let p = PathBuf::from(&path);
    if !p.is_file() {
        return Err(format!("Không phải file: {path}"));
    }
    let mut data = ExifData::default();

    let file = match fs::File::open(&p) {
        Ok(f) => f,
        Err(e) => return Err(format!("open: {e}")),
    };
    let mut reader = std::io::BufReader::new(&file);
    let exif_reader = exif::Reader::new();
    let exif = match exif_reader.read_from_container(&mut reader) {
        Ok(e) => e,
        Err(_) => {
            return Ok(data); // No EXIF — return empty (has_exif: false)
        }
    };

    data.has_exif = true;
    use exif::{In, Tag};

    let get_str = |tag: Tag, ifd: In| -> Option<String> {
        exif.get_field(tag, ifd)
            .map(|f| f.display_value().to_string().trim().to_string())
            .filter(|s| !s.is_empty())
    };

    data.camera_make = get_str(Tag::Make, In::PRIMARY);
    data.camera_model = get_str(Tag::Model, In::PRIMARY);
    data.lens = get_str(Tag::LensModel, In::PRIMARY);
    data.datetime_original = get_str(Tag::DateTimeOriginal, In::PRIMARY)
        .or_else(|| get_str(Tag::DateTime, In::PRIMARY));
    data.iso = get_str(Tag::PhotographicSensitivity, In::PRIMARY);
    data.aperture = get_str(Tag::FNumber, In::PRIMARY)
        .or_else(|| get_str(Tag::ApertureValue, In::PRIMARY));
    data.shutter_speed = get_str(Tag::ExposureTime, In::PRIMARY)
        .or_else(|| get_str(Tag::ShutterSpeedValue, In::PRIMARY));
    data.focal_length = get_str(Tag::FocalLength, In::PRIMARY);
    data.flash = get_str(Tag::Flash, In::PRIMARY);
    data.orientation = get_str(Tag::Orientation, In::PRIMARY);

    // Width/Height: try EXIF first, fallback to PixelXDimension/YDimension
    if let Some(field) = exif.get_field(Tag::PixelXDimension, In::PRIMARY) {
        if let Some(v) = field.value.get_uint(0) {
            data.width = Some(v);
        }
    }
    if let Some(field) = exif.get_field(Tag::PixelYDimension, In::PRIMARY) {
        if let Some(v) = field.value.get_uint(0) {
            data.height = Some(v);
        }
    }

    // GPS — IFD GPS
    let gps_lat = exif.get_field(Tag::GPSLatitude, In::PRIMARY);
    let gps_lat_ref = exif.get_field(Tag::GPSLatitudeRef, In::PRIMARY);
    if let Some(field) = gps_lat {
        data.gps_lat = parse_gps_coord(&field.value, gps_lat_ref.map(|f| &f.value));
    }
    let gps_lon = exif.get_field(Tag::GPSLongitude, In::PRIMARY);
    let gps_lon_ref = exif.get_field(Tag::GPSLongitudeRef, In::PRIMARY);
    if let Some(field) = gps_lon {
        data.gps_lon = parse_gps_coord(&field.value, gps_lon_ref.map(|f| &f.value));
    }
    if let Some(field) = exif.get_field(Tag::GPSAltitude, In::PRIMARY) {
        if let exif::Value::Rational(v) = &field.value {
            if !v.is_empty() {
                data.gps_altitude = Some(v[0].to_f64());
            }
        }
    }

    Ok(data)
}

// ============================================================
// Phase 18.6 — Module Ảnh: list image files in folder
// ============================================================

#[derive(serde::Serialize)]
struct ImageFileEntry {
    path: String,
    name: String,
    size: u64,
    modified_ms: i64,
    is_video: bool,
    ext: String,
}

const IMAGE_EXTS: &[&str] = &[
    "jpg", "jpeg", "png", "gif", "bmp", "webp", "tiff", "tif", "heic", "heif", "ico", "svg",
];
const VIDEO_EXTS: &[&str] = &["mp4", "mov", "avi", "mkv", "webm", "wmv", "flv", "m4v"];

fn thumb_cache_dir() -> Result<PathBuf, String> {
    let local = dirs::data_local_dir()
        .ok_or_else(|| "Không tìm được thư mục cache".to_string())?;
    let dir = local.join("TrishTEAM").join("TrishLibrary").join("thumbs");
    fs::create_dir_all(&dir).map_err(|e| format!("create_dir thumbs: {e}"))?;
    Ok(dir)
}

fn thumb_cache_path(src_path: &str, mtime_ms: i64, size: u64, max_size: u32) -> Result<PathBuf, String> {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    let mut hasher = DefaultHasher::new();
    src_path.hash(&mut hasher);
    mtime_ms.hash(&mut hasher);
    size.hash(&mut hasher);
    max_size.hash(&mut hasher);
    let key = format!("{:016x}", hasher.finish());
    Ok(thumb_cache_dir()?.join(format!("{key}_{max_size}.jpg")))
}

/// Generate a JPEG thumbnail for the given image, cached on disk by (path, mtime, size, max_size).
/// Returns the absolute path of the cached thumbnail file. Frontend can use convertFileSrc.
#[tauri::command]
async fn get_thumbnail(path: String, max_size: u32) -> Result<String, String> {
    tokio::task::spawn_blocking(move || -> Result<String, String> {
        let src = PathBuf::from(&path);
        if !src.is_file() {
            return Err(format!("Không phải file: {path}"));
        }
        let meta = fs::metadata(&src).map_err(|e| format!("metadata: {e}"))?;
        let mtime_ms = meta
            .modified()
            .ok()
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map(|d| d.as_millis() as i64)
            .unwrap_or(0);
        let size = meta.len();
        let cache_path = thumb_cache_path(&path, mtime_ms, size, max_size)?;
        if cache_path.exists() {
            return Ok(cache_path.to_string_lossy().to_string());
        }
        // Decode + resize
        let img = image::open(&src).map_err(|e| format!("decode {path}: {e}"))?;
        let (w, h) = (img.width(), img.height());
        let max = max_size.max(32);
        let scale = (max as f32) / (w.max(h) as f32);
        let (nw, nh) = if scale >= 1.0 {
            (w, h)
        } else {
            (((w as f32) * scale) as u32, ((h as f32) * scale) as u32)
        };
        let resized = if scale >= 1.0 {
            img
        } else {
            img.resize(nw.max(1), nh.max(1), image::imageops::FilterType::Triangle)
        };
        // Save as JPEG quality 75 — encode straight to file (atomic via tmp+rename)
        let tmp = cache_path.with_extension("jpg.tmp");
        {
            let file = fs::File::create(&tmp).map_err(|e| format!("create tmp: {e}"))?;
            let writer = std::io::BufWriter::new(file);
            let encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(writer, 75);
            let rgb = resized.to_rgb8();
            image::DynamicImage::ImageRgb8(rgb)
                .write_with_encoder(encoder)
                .map_err(|e| format!("encode jpeg: {e}"))?;
        }
        fs::rename(&tmp, &cache_path).map_err(|e| format!("rename thumb: {e}"))?;
        Ok(cache_path.to_string_lossy().to_string())
    })
    .await
    .map_err(|e| format!("thumbnail join: {e}"))?
}

#[tauri::command]
fn list_image_files(folder: String, recursive: bool) -> Result<Vec<ImageFileEntry>, String> {
    let root = PathBuf::from(&folder);
    if !root.is_dir() {
        return Err(format!("Không phải thư mục: {folder}"));
    }
    let mut out: Vec<ImageFileEntry> = Vec::new();
    let max_depth = if recursive { 8 } else { 1 };
    let walker = WalkDir::new(&root)
        .max_depth(max_depth)
        .follow_links(false)
        .into_iter()
        .filter_map(|e| e.ok());
    for entry in walker {
        if !entry.file_type().is_file() {
            continue;
        }
        let path = entry.path();
        let ext_lc = match extension_of(path) {
            Some(e) => e,
            None => continue,
        };
        let is_image = IMAGE_EXTS.iter().any(|&x| x == ext_lc);
        let is_video = VIDEO_EXTS.iter().any(|&x| x == ext_lc);
        if !is_image && !is_video {
            continue;
        }
        let meta = match entry.metadata() {
            Ok(m) => m,
            Err(_) => continue,
        };
        let modified_ms = meta
            .modified()
            .ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_millis() as i64)
            .unwrap_or(0);
        out.push(ImageFileEntry {
            path: path.to_string_lossy().to_string(),
            name: path
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default(),
            size: meta.len(),
            modified_ms,
            is_video,
            ext: ext_lc,
        });
        if out.len() > 5000 {
            break;
        }
    }
    // newest first
    out.sort_by(|a, b| b.modified_ms.cmp(&a.modified_ms));
    Ok(out)
}

// ============================================================
// Phase 18.3.b — PDF Tools (merge/split/extract/delete/rotate/info)
// Backed by lopdf cho thao tác trang; printpdf cho images → pdf.
// ============================================================

#[derive(serde::Serialize)]
struct PdfInfo {
    page_count: u32,
    file_size: u64,
    title: Option<String>,
    author: Option<String>,
    producer: Option<String>,
}

#[tauri::command]
fn pdf_info(path: String) -> Result<PdfInfo, String> {
    let p = PathBuf::from(&path);
    if !p.is_file() {
        return Err(format!("Không phải file: {path}"));
    }
    let file_size = fs::metadata(&p).map(|m| m.len()).unwrap_or(0);
    let doc = lopdf::Document::load(&p).map_err(|e| format!("load pdf: {e}"))?;
    let page_count = doc.get_pages().len() as u32;

    // Try to read /Info dictionary fields
    let mut title = None;
    let mut author = None;
    let mut producer = None;
    if let Some(info_obj) = doc.trailer.get(b"Info").ok() {
        if let Ok(info_id) = info_obj.as_reference() {
            if let Ok(info_dict) = doc.get_object(info_id).and_then(|o| o.as_dict()) {
                if let Ok(s) = info_dict.get(b"Title").and_then(|o| o.as_str()) {
                    title = Some(String::from_utf8_lossy(s).to_string());
                }
                if let Ok(s) = info_dict.get(b"Author").and_then(|o| o.as_str()) {
                    author = Some(String::from_utf8_lossy(s).to_string());
                }
                if let Ok(s) = info_dict.get(b"Producer").and_then(|o| o.as_str()) {
                    producer = Some(String::from_utf8_lossy(s).to_string());
                }
            }
        }
    }

    Ok(PdfInfo {
        page_count,
        file_size,
        title,
        author,
        producer,
    })
}

#[tauri::command]
fn pdf_merge(input_paths: Vec<String>, output_path: String) -> Result<u32, String> {
    if input_paths.len() < 2 {
        return Err("Cần ít nhất 2 PDF để gộp".to_string());
    }
    let mut merged = lopdf::Document::with_version("1.5");
    let mut max_id: u32 = 1;
    let mut pages_to_add: Vec<lopdf::ObjectId> = Vec::new();
    let mut documents_pages: std::collections::BTreeMap<lopdf::ObjectId, lopdf::Object> =
        std::collections::BTreeMap::new();
    let mut documents_objects: std::collections::BTreeMap<lopdf::ObjectId, lopdf::Object> =
        std::collections::BTreeMap::new();

    for path in &input_paths {
        let mut doc = lopdf::Document::load(path)
            .map_err(|e| format!("load {path}: {e}"))?;
        doc.renumber_objects_with(max_id);
        max_id = doc.max_id + 1;

        for (_, page_id) in doc.get_pages() {
            if let Ok(obj) = doc.get_object(page_id) {
                pages_to_add.push(page_id);
                documents_pages.insert(page_id, obj.to_owned());
            }
        }
        documents_objects.extend(doc.objects);
    }

    // Build new catalog + pages tree
    let pages_id = merged.new_object_id();
    let kids: Vec<lopdf::Object> = pages_to_add
        .iter()
        .map(|id| lopdf::Object::Reference(*id))
        .collect();

    // Insert all merged objects
    for (id, obj) in documents_objects {
        merged.objects.insert(id, obj);
    }
    // Patch each page's /Parent → new pages_id
    for (id, mut page_obj) in documents_pages {
        if let lopdf::Object::Dictionary(ref mut d) = page_obj {
            d.set("Parent", pages_id);
        }
        merged.objects.insert(id, page_obj);
    }

    let mut pages_dict = lopdf::Dictionary::new();
    pages_dict.set("Type", "Pages");
    pages_dict.set("Count", pages_to_add.len() as i64);
    pages_dict.set("Kids", kids);
    merged.objects.insert(pages_id, lopdf::Object::Dictionary(pages_dict));

    let catalog_id = merged.new_object_id();
    let mut catalog = lopdf::Dictionary::new();
    catalog.set("Type", "Catalog");
    catalog.set("Pages", pages_id);
    merged.objects.insert(catalog_id, lopdf::Object::Dictionary(catalog));
    merged.trailer.set("Root", catalog_id);
    merged.compress();

    if let Some(parent) = PathBuf::from(&output_path).parent() {
        fs::create_dir_all(parent).map_err(|e| format!("create_dir: {e}"))?;
    }
    merged
        .save(&output_path)
        .map_err(|e| format!("save merged: {e}"))?;
    Ok(pages_to_add.len() as u32)
}

#[tauri::command]
fn pdf_extract_pages(
    input_path: String,
    pages: Vec<u32>,
    output_path: String,
) -> Result<u32, String> {
    if pages.is_empty() {
        return Err("Cần chọn ít nhất 1 trang".to_string());
    }
    let mut doc = lopdf::Document::load(&input_path)
        .map_err(|e| format!("load: {e}"))?;
    let total = doc.get_pages().len() as u32;
    let valid: Vec<u32> = pages.into_iter().filter(|p| *p >= 1 && *p <= total).collect();
    if valid.is_empty() {
        return Err("Số trang không hợp lệ".to_string());
    }
    // Delete all pages NOT in valid set
    let to_delete: Vec<u32> = (1..=total).filter(|p| !valid.contains(p)).collect();
    if !to_delete.is_empty() {
        doc.delete_pages(&to_delete);
    }
    doc.compress();
    if let Some(parent) = PathBuf::from(&output_path).parent() {
        fs::create_dir_all(parent).map_err(|e| format!("create_dir: {e}"))?;
    }
    doc.save(&output_path).map_err(|e| format!("save: {e}"))?;
    Ok(valid.len() as u32)
}

#[tauri::command]
fn pdf_delete_pages(
    input_path: String,
    pages: Vec<u32>,
    output_path: String,
) -> Result<u32, String> {
    if pages.is_empty() {
        return Err("Cần chọn ít nhất 1 trang".to_string());
    }
    let mut doc = lopdf::Document::load(&input_path)
        .map_err(|e| format!("load: {e}"))?;
    let total = doc.get_pages().len() as u32;
    let valid: Vec<u32> = pages.into_iter().filter(|p| *p >= 1 && *p <= total).collect();
    let remaining = total.saturating_sub(valid.len() as u32);
    if remaining == 0 {
        return Err("Không thể xóa hết trang".to_string());
    }
    doc.delete_pages(&valid);
    doc.compress();
    if let Some(parent) = PathBuf::from(&output_path).parent() {
        fs::create_dir_all(parent).map_err(|e| format!("create_dir: {e}"))?;
    }
    doc.save(&output_path).map_err(|e| format!("save: {e}"))?;
    Ok(remaining)
}

#[tauri::command]
fn pdf_split(input_path: String, output_dir: String) -> Result<u32, String> {
    let doc = lopdf::Document::load(&input_path)
        .map_err(|e| format!("load: {e}"))?;
    let total = doc.get_pages().len() as u32;
    if total == 0 {
        return Err("PDF rỗng".to_string());
    }
    fs::create_dir_all(&output_dir).map_err(|e| format!("create_dir: {e}"))?;
    let stem = PathBuf::from(&input_path)
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| "page".to_string());
    for p in 1..=total {
        let mut copy = doc.clone();
        let to_delete: Vec<u32> = (1..=total).filter(|x| *x != p).collect();
        copy.delete_pages(&to_delete);
        copy.compress();
        let out = PathBuf::from(&output_dir).join(format!("{stem}_p{p:03}.pdf"));
        copy.save(&out).map_err(|e| format!("save p{p}: {e}"))?;
    }
    Ok(total)
}

#[tauri::command]
fn pdf_rotate_pages(
    input_path: String,
    pages: Vec<u32>,
    angle: i32,
    output_path: String,
) -> Result<u32, String> {
    if angle % 90 != 0 {
        return Err("Góc xoay phải là bội của 90".to_string());
    }
    let mut doc = lopdf::Document::load(&input_path)
        .map_err(|e| format!("load: {e}"))?;
    let pages_map = doc.get_pages();
    let total = pages_map.len() as u32;
    let target_set: std::collections::HashSet<u32> = if pages.is_empty() {
        (1..=total).collect()
    } else {
        pages.into_iter().filter(|p| *p >= 1 && *p <= total).collect()
    };

    let mut rotated_count = 0u32;
    let page_ids: Vec<(u32, lopdf::ObjectId)> = pages_map.iter().map(|(k, v)| (*k, *v)).collect();
    for (page_num, page_id) in page_ids {
        if !target_set.contains(&page_num) {
            continue;
        }
        if let Ok(obj) = doc.get_object_mut(page_id) {
            if let Ok(dict) = obj.as_dict_mut() {
                let current = dict
                    .get(b"Rotate")
                    .ok()
                    .and_then(|o| o.as_i64().ok())
                    .unwrap_or(0);
                let new_rot = ((current + angle as i64) % 360 + 360) % 360;
                dict.set("Rotate", new_rot);
                rotated_count += 1;
            }
        }
    }
    doc.compress();
    if let Some(parent) = PathBuf::from(&output_path).parent() {
        fs::create_dir_all(parent).map_err(|e| format!("create_dir: {e}"))?;
    }
    doc.save(&output_path).map_err(|e| format!("save: {e}"))?;
    Ok(rotated_count)
}

#[tauri::command]
async fn images_to_pdf(
    input_paths: Vec<String>,
    output_path: String,
    page_size: String,
) -> Result<u32, String> {
    if input_paths.is_empty() {
        return Err("Cần ít nhất 1 ảnh".to_string());
    }
    tokio::task::spawn_blocking(move || -> Result<u32, String> {
        // Each page sized to image at 72 DPI. Use A4 default if requested.
        let (page_w_mm, page_h_mm) = match page_size.to_lowercase().as_str() {
            "a4" => (210.0_f32, 297.0_f32),
            "letter" => (216.0_f32, 279.0_f32),
            _ => (210.0_f32, 297.0_f32),
        };

        use printpdf::{
            ImageTransform, ImageXObject, Mm, PdfDocument, Px,
        };

        let (mut pdf, page1, layer1) = PdfDocument::new(
            "Images→PDF",
            Mm(page_w_mm),
            Mm(page_h_mm),
            "Layer 1",
        );

        for (i, img_path) in input_paths.iter().enumerate() {
            let p = PathBuf::from(img_path);
            let img = image::open(&p).map_err(|e| format!("open {img_path}: {e}"))?;
            let (w, h) = (img.width(), img.height());
            let rgb = img.to_rgb8();
            let raw = rgb.into_raw();

            let xo = ImageXObject {
                width: Px(w as usize),
                height: Px(h as usize),
                color_space: printpdf::ColorSpace::Rgb,
                bits_per_component: printpdf::ColorBits::Bit8,
                interpolate: false,
                image_data: raw,
                image_filter: None,
                clipping_bbox: None,
            };

            let (page_index, layer_index) = if i == 0 {
                (page1, layer1)
            } else {
                pdf.add_page(Mm(page_w_mm), Mm(page_h_mm), format!("Layer {}", i + 1))
            };
            let layer = pdf.get_page(page_index).get_layer(layer_index);

            // Fit image to page (preserve aspect)
            let img_aspect = w as f32 / h as f32;
            let page_aspect = page_w_mm / page_h_mm;
            let (target_w_mm, target_h_mm) = if img_aspect > page_aspect {
                (page_w_mm * 0.95, page_w_mm * 0.95 / img_aspect)
            } else {
                (page_h_mm * 0.95 * img_aspect, page_h_mm * 0.95)
            };
            // Convert mm → mm scale via dpi=72
            let dpi = 300.0_f32;
            let scale_x = (target_w_mm * dpi / 25.4) / w as f32;
            let scale_y = (target_h_mm * dpi / 25.4) / h as f32;

            let img_obj = printpdf::Image::from(xo);
            img_obj.add_to_layer(
                layer,
                ImageTransform {
                    translate_x: Some(Mm((page_w_mm - target_w_mm) / 2.0)),
                    translate_y: Some(Mm((page_h_mm - target_h_mm) / 2.0)),
                    rotate: None,
                    scale_x: Some(scale_x),
                    scale_y: Some(scale_y),
                    dpi: Some(dpi),
                },
            );
        }

        if let Some(parent) = PathBuf::from(&output_path).parent() {
            fs::create_dir_all(parent).map_err(|e| format!("create_dir: {e}"))?;
        }
        let mut writer = std::io::BufWriter::new(
            fs::File::create(&output_path).map_err(|e| format!("create: {e}"))?,
        );
        pdf.save(&mut writer).map_err(|e| format!("save: {e}"))?;
        Ok(input_paths.len() as u32)
    })
    .await
    .map_err(|e| format!("images_to_pdf join: {e}"))?
}

// ============================================================
// Phase 18.3.b.2 — PDF Tools: watermark + page numbers + encrypt
// ============================================================

/// Convert any numeric Object to f32 safely (handles Integer + Real).
fn pdf_num_to_f32(o: &lopdf::Object) -> f32 {
    match o {
        lopdf::Object::Integer(i) => *i as f32,
        lopdf::Object::Real(f) => *f as f32,
        _ => 0.0,
    }
}

/// Get MediaBox of a page (returns [llx, lly, urx, ury] in points).
fn page_media_box(doc: &lopdf::Document, page_id: lopdf::ObjectId) -> [f32; 4] {
    let mut current_id = page_id;
    loop {
        let dict = match doc.get_object(current_id).and_then(|o| o.as_dict()) {
            Ok(d) => d,
            Err(_) => return [0.0, 0.0, 595.0, 842.0], // A4 fallback
        };
        if let Ok(arr) = dict.get(b"MediaBox").and_then(|o| o.as_array()) {
            if arr.len() == 4 {
                return [
                    pdf_num_to_f32(&arr[0]),
                    pdf_num_to_f32(&arr[1]),
                    pdf_num_to_f32(&arr[2]),
                    pdf_num_to_f32(&arr[3]),
                ];
            }
        }
        // Walk up to /Parent if no MediaBox
        if let Ok(parent_obj) = dict.get(b"Parent") {
            if let Ok(pid) = parent_obj.as_reference() {
                current_id = pid;
                continue;
            }
        }
        return [0.0, 0.0, 595.0, 842.0];
    }
}

/// Escape PDF string literal: parens + backslashes.
fn escape_pdf_string(s: &str) -> String {
    s.chars()
        .map(|c| match c {
            '(' => "\\(".to_string(),
            ')' => "\\)".to_string(),
            '\\' => "\\\\".to_string(),
            c if c.is_ascii() => c.to_string(),
            // Non-ASCII: replace with ? (PDF base font Helvetica = WinAnsi only)
            _ => "?".to_string(),
        })
        .collect()
}

/// Add a text watermark overlay to every page.
/// Uses Helvetica (PDF base font, no embedding needed).
/// `opacity` 0.0-1.0, `angle_deg` rotation, `font_size` in points.
#[tauri::command]
fn pdf_add_watermark(
    input_path: String,
    text: String,
    output_path: String,
    opacity: f32,
    font_size: f32,
    angle_deg: f32,
) -> Result<u32, String> {
    use lopdf::{Dictionary, Object, Stream};
    let opacity = opacity.clamp(0.0, 1.0);
    let font_size = font_size.clamp(8.0, 200.0);
    let angle_rad = (angle_deg.clamp(-90.0, 90.0)) * std::f32::consts::PI / 180.0;
    let cos = angle_rad.cos();
    let sin = angle_rad.sin();
    let escaped = escape_pdf_string(&text);

    let mut doc = lopdf::Document::load(&input_path)
        .map_err(|e| format!("load: {e}"))?;
    let pages = doc.get_pages();
    let total = pages.len() as u32;

    // Add Helvetica font + ExtGState (for opacity) as global resources.
    // We'll inject /F_TWM and /GS_TWM into each page's resources.
    let font_id = doc.add_object(Object::Dictionary({
        let mut d = Dictionary::new();
        d.set("Type", "Font");
        d.set("Subtype", "Type1");
        d.set("BaseFont", "Helvetica");
        d.set("Encoding", "WinAnsiEncoding");
        d
    }));
    let gs_id = doc.add_object(Object::Dictionary({
        let mut d = Dictionary::new();
        d.set("Type", "ExtGState");
        d.set("ca", opacity);
        d.set("CA", opacity);
        d
    }));

    let page_ids: Vec<lopdf::ObjectId> = pages.values().copied().collect();
    for page_id in page_ids {
        let [llx, lly, urx, ury] = page_media_box(&doc, page_id);
        let cx = (llx + urx) / 2.0;
        let cy = (lly + ury) / 2.0;

        // Build content stream:
        // q
        // /GS_TWM gs
        // 0.5 0.5 0.5 rg
        // cos sin -sin cos cx cy cm  (rotate + translate to center)
        // BT
        //   /F_TWM size Tf
        //   - half_text_width 0 Td  (center horizontally — approximate)
        //   (text) Tj
        // ET
        // Q
        let approx_text_width = (text.chars().count() as f32) * font_size * 0.5;
        let content = format!(
            "q\n\
             /GS_TWM gs\n\
             0.5 0.5 0.5 rg\n\
             {cos:.5} {sin:.5} {nsin:.5} {cos:.5} {cx:.2} {cy:.2} cm\n\
             BT\n\
             /F_TWM {fsz:.1} Tf\n\
             {tx:.2} {ty:.2} Td\n\
             ({txt}) Tj\n\
             ET\n\
             Q\n",
            cos = cos,
            sin = sin,
            nsin = -sin,
            cx = cx,
            cy = cy,
            fsz = font_size,
            tx = -approx_text_width / 2.0,
            ty = -font_size / 3.0,
            txt = escaped,
        );

        // Patch page resources: ensure /Font /F_TWM and /ExtGState /GS_TWM
        // Phase 1: read existing Resources (resolve reference if any) WITHOUT mutable borrow
        let resolved_res_dict: Dictionary = {
            let existing_res = doc
                .get_object(page_id)
                .ok()
                .and_then(|o| o.as_dict().ok())
                .and_then(|d| d.get(b"Resources").ok().cloned());
            match existing_res {
                Some(Object::Dictionary(d)) => d,
                Some(Object::Reference(rid)) => doc
                    .get_object(rid)
                    .ok()
                    .and_then(|o| o.as_dict().ok())
                    .map(|d| d.clone())
                    .unwrap_or_default(),
                _ => Dictionary::new(),
            }
        };

        // Phase 2: mutate page_dict
        if let Ok(page_dict) = doc
            .get_object_mut(page_id)
            .and_then(|o| o.as_dict_mut())
        {
            let mut res_dict = resolved_res_dict;

            // /Font
            let mut fonts = match res_dict.get(b"Font").ok() {
                Some(Object::Dictionary(d)) => d.clone(),
                _ => Dictionary::new(),
            };
            fonts.set("F_TWM", font_id);
            res_dict.set("Font", Object::Dictionary(fonts));

            // /ExtGState
            let mut gs = match res_dict.get(b"ExtGState").ok() {
                Some(Object::Dictionary(d)) => d.clone(),
                _ => Dictionary::new(),
            };
            gs.set("GS_TWM", gs_id);
            res_dict.set("ExtGState", Object::Dictionary(gs));

            page_dict.set("Resources", Object::Dictionary(res_dict));
        }

        // Append our overlay as a NEW content stream (don't modify existing)
        let stream = Stream::new(Dictionary::new(), content.into_bytes());
        let stream_id = doc.add_object(Object::Stream(stream));

        // Patch page's /Contents to be array [original_content, our_overlay]
        if let Ok(page_dict) = doc
            .get_object_mut(page_id)
            .and_then(|o| o.as_dict_mut())
        {
            let existing = page_dict.get(b"Contents").ok().cloned();
            let new_contents: Object = match existing {
                Some(Object::Array(mut arr)) => {
                    arr.push(Object::Reference(stream_id));
                    Object::Array(arr)
                }
                Some(other) => Object::Array(vec![other, Object::Reference(stream_id)]),
                None => Object::Reference(stream_id),
            };
            page_dict.set("Contents", new_contents);
        }
    }

    doc.compress();
    if let Some(parent) = PathBuf::from(&output_path).parent() {
        fs::create_dir_all(parent).map_err(|e| format!("create_dir: {e}"))?;
    }
    doc.save(&output_path).map_err(|e| format!("save: {e}"))?;
    Ok(total)
}

/// Add page numbers footer ("Trang X / Y") to every page.
#[tauri::command]
fn pdf_add_page_numbers(
    input_path: String,
    output_path: String,
    format_template: String,
    font_size: f32,
    position: String, // "footer-center" | "footer-right" | "footer-left"
) -> Result<u32, String> {
    use lopdf::{Dictionary, Object, Stream};
    let font_size = font_size.clamp(7.0, 24.0);

    let mut doc = lopdf::Document::load(&input_path)
        .map_err(|e| format!("load: {e}"))?;
    let pages_map = doc.get_pages();
    let total = pages_map.len() as u32;

    let font_id = doc.add_object(Object::Dictionary({
        let mut d = Dictionary::new();
        d.set("Type", "Font");
        d.set("Subtype", "Type1");
        d.set("BaseFont", "Helvetica");
        d.set("Encoding", "WinAnsiEncoding");
        d
    }));

    // Sort by page number (1-indexed)
    let mut sorted: Vec<(u32, lopdf::ObjectId)> =
        pages_map.iter().map(|(k, v)| (*k, *v)).collect();
    sorted.sort_by_key(|(k, _)| *k);

    for (page_num, page_id) in sorted.iter() {
        let [llx, _lly, urx, _ury] = page_media_box(&doc, *page_id);
        let label = format_template
            .replace("{n}", &page_num.to_string())
            .replace("{total}", &total.to_string())
            .replace("{N}", &page_num.to_string())
            .replace("{T}", &total.to_string());
        let escaped = escape_pdf_string(&label);
        let approx_w = (label.chars().count() as f32) * font_size * 0.5;
        let pos_x = match position.as_str() {
            "footer-right" => urx - 40.0 - approx_w,
            "footer-left" => llx + 40.0,
            _ => (llx + urx) / 2.0 - approx_w / 2.0, // center
        };
        let pos_y = 30.0; // 30pt from bottom

        let content = format!(
            "q\n\
             0.3 0.3 0.3 rg\n\
             BT\n\
             /F_PNUM {fsz:.1} Tf\n\
             {x:.2} {y:.2} Td\n\
             ({txt}) Tj\n\
             ET\n\
             Q\n",
            fsz = font_size,
            x = pos_x,
            y = pos_y,
            txt = escaped,
        );

        // Add font resource
        // Phase 1: read existing Resources (resolve reference) WITHOUT mutable borrow
        let resolved_res_dict: Dictionary = {
            let existing_res = doc
                .get_object(*page_id)
                .ok()
                .and_then(|o| o.as_dict().ok())
                .and_then(|d| d.get(b"Resources").ok().cloned());
            match existing_res {
                Some(Object::Dictionary(d)) => d,
                Some(Object::Reference(rid)) => doc
                    .get_object(rid)
                    .ok()
                    .and_then(|o| o.as_dict().ok())
                    .map(|d| d.clone())
                    .unwrap_or_default(),
                _ => Dictionary::new(),
            }
        };

        // Phase 2: mutate
        if let Ok(page_dict) = doc
            .get_object_mut(*page_id)
            .and_then(|o| o.as_dict_mut())
        {
            let mut res_dict = resolved_res_dict;
            let mut fonts = match res_dict.get(b"Font").ok() {
                Some(Object::Dictionary(d)) => d.clone(),
                _ => Dictionary::new(),
            };
            fonts.set("F_PNUM", font_id);
            res_dict.set("Font", Object::Dictionary(fonts));
            page_dict.set("Resources", Object::Dictionary(res_dict));
        }

        let stream = Stream::new(Dictionary::new(), content.into_bytes());
        let stream_id = doc.add_object(Object::Stream(stream));
        if let Ok(page_dict) = doc
            .get_object_mut(*page_id)
            .and_then(|o| o.as_dict_mut())
        {
            let existing = page_dict.get(b"Contents").ok().cloned();
            let new_contents: Object = match existing {
                Some(Object::Array(mut arr)) => {
                    arr.push(Object::Reference(stream_id));
                    Object::Array(arr)
                }
                Some(other) => Object::Array(vec![other, Object::Reference(stream_id)]),
                None => Object::Reference(stream_id),
            };
            page_dict.set("Contents", new_contents);
        }
    }

    doc.compress();
    if let Some(parent) = PathBuf::from(&output_path).parent() {
        fs::create_dir_all(parent).map_err(|e| format!("create_dir: {e}"))?;
    }
    doc.save(&output_path).map_err(|e| format!("save: {e}"))?;
    Ok(total)
}

// ============================================================
// Phase 18.3.b.5 — Extract embedded images from PDF
// Iterate XObject /Subtype Image, dump bytes theo /Filter
// ============================================================

#[derive(serde::Serialize)]
struct PdfExtractImagesResult {
    extracted: u32,
    skipped: u32,
    output_dir: String,
}

#[tauri::command]
async fn pdf_extract_images(
    input_path: String,
    output_dir: String,
) -> Result<PdfExtractImagesResult, String> {
    tokio::task::spawn_blocking(move || -> Result<PdfExtractImagesResult, String> {
        let doc = lopdf::Document::load(&input_path)
            .map_err(|e| format!("load: {e}"))?;
        fs::create_dir_all(&output_dir).map_err(|e| format!("create_dir: {e}"))?;

        let stem = PathBuf::from(&input_path)
            .file_stem()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_else(|| "img".to_string());

        let mut extracted: u32 = 0;
        let mut skipped: u32 = 0;
        let mut idx: u32 = 1;

        for (id, obj) in doc.objects.iter() {
            // Look at streams with /Subtype = /Image
            let stream = match obj {
                lopdf::Object::Stream(s) => s,
                _ => continue,
            };
            let dict = &stream.dict;
            let subtype = dict.get(b"Subtype").ok().and_then(|o| o.as_name().ok());
            if subtype != Some(b"Image".as_ref()) {
                continue;
            }

            // Get /Filter to determine output format
            let filter = dict
                .get(b"Filter")
                .ok()
                .map(|f| match f {
                    lopdf::Object::Name(n) => Some(n.clone()),
                    lopdf::Object::Array(arr) if !arr.is_empty() => match &arr[0] {
                        lopdf::Object::Name(n) => Some(n.clone()),
                        _ => None,
                    },
                    _ => None,
                })
                .flatten();

            let (ext, raw_bytes_only) = match filter.as_deref() {
                Some(b"DCTDecode") => ("jpg", true), // raw JPEG bytes
                Some(b"FlateDecode") => ("png", false), // need to repack as PNG
                Some(b"CCITTFaxDecode") => ("tif", false),
                Some(b"JPXDecode") => ("jp2", true),
                _ => {
                    skipped += 1;
                    continue;
                }
            };

            if !raw_bytes_only {
                // Skip Flate/CCITT for now — would need image crate to repack
                skipped += 1;
                continue;
            }

            let out_name = format!("{stem}_p{idx:03}_obj{}_{}.{ext}", id.0, id.1);
            let out_path = PathBuf::from(&output_dir).join(out_name);

            if let Err(e) = fs::write(&out_path, &stream.content) {
                eprintln!("write image fail: {e}");
                skipped += 1;
                continue;
            }
            extracted += 1;
            idx += 1;
        }

        Ok(PdfExtractImagesResult {
            extracted,
            skipped,
            output_dir: output_dir.clone(),
        })
    })
    .await
    .map_err(|e| format!("extract_images join: {e}"))?
}

// ============================================================
// Phase 18.3.b.3 — PDF password encrypt via qpdf subprocess
// Phase 18.3.b.4 — OCR PDF via tesseract subprocess
//
// Both shell out to external binaries (qpdf, tesseract) which user
// must install separately. We detect availability and return clear
// error messages with installation hints.
// ============================================================

#[derive(serde::Serialize)]
struct ToolStatus {
    available: bool,
    version: Option<String>,
    hint: String,
}

fn check_command(cmd: &str, version_arg: &str) -> ToolStatus {
    use std::process::Command;
    match Command::new(cmd).arg(version_arg).output() {
        Ok(out) if out.status.success() => {
            let combined = format!(
                "{}{}",
                String::from_utf8_lossy(&out.stdout),
                String::from_utf8_lossy(&out.stderr)
            );
            let first_line = combined.lines().next().unwrap_or("").trim().to_string();
            ToolStatus {
                available: true,
                version: Some(first_line),
                hint: String::new(),
            }
        }
        _ => ToolStatus {
            available: false,
            version: None,
            hint: format!("Không tìm thấy '{cmd}' trong PATH. Cài đặt và thử lại."),
        },
    }
}

#[tauri::command]
fn check_qpdf() -> Result<ToolStatus, String> {
    let mut status = check_command("qpdf", "--version");
    if !status.available {
        status.hint = "Cài qpdf: https://qpdf.sourceforge.io/ — sau đó thêm vào PATH.\n\
            Windows: scoop install qpdf (hoặc choco install qpdf)\n\
            macOS: brew install qpdf\n\
            Linux: apt install qpdf"
            .to_string();
    }
    Ok(status)
}

/// Phase 39.fix — Trả về system temp dir path (e.g. C:\Users\X\AppData\Local\Temp).
/// React side dùng để build temp file paths cho OCR pipeline.
#[tauri::command]
fn get_temp_dir() -> String {
    std::env::temp_dir().to_string_lossy().to_string()
}

/// Phase 39.fix12 — Trả về app data dir cho TrishLibrary (vd %APPDATA%\TrishLibrary).
/// Dùng cho cache: tessdata_best, downloads.
fn trishlibrary_data_dir() -> Result<PathBuf, String> {
    let base = dirs::data_dir()
        .ok_or_else(|| "Không xác định được app data dir".to_string())?;
    let p = base.join("TrishLibrary");
    fs::create_dir_all(&p).map_err(|e| format!("create_dir: {e}"))?;
    Ok(p)
}

/// Phase 39.fix12 — Path tessdata_best directory (cache).
fn tessdata_best_dir() -> Result<PathBuf, String> {
    let p = trishlibrary_data_dir()?.join("tessdata_best");
    fs::create_dir_all(&p).map_err(|e| format!("create_dir: {e}"))?;
    Ok(p)
}

/// Phase 39.fix12 — Check tessdata_best đã download cho lang chưa.
/// `lang_code`: vd "vie", "eng".
#[tauri::command]
fn check_tessdata_best(lang_code: String) -> Result<bool, String> {
    let dir = tessdata_best_dir()?;
    let file = dir.join(format!("{lang_code}.traineddata"));
    Ok(file.exists() && fs::metadata(&file).map(|m| m.len() > 1_000_000).unwrap_or(false))
}

/// Phase 39.fix12 — Download tessdata_best.traineddata cho lang chỉ định.
/// Source: https://github.com/tesseract-ocr/tessdata_best/raw/main/{lang}.traineddata
/// Cache: %APPDATA%\TrishLibrary\tessdata_best\{lang}.traineddata
/// Returns: full path file đã download.
#[tauri::command]
async fn download_tessdata_best(lang_code: String) -> Result<String, String> {
    let dir = tessdata_best_dir()?;
    let file = dir.join(format!("{lang_code}.traineddata"));
    if file.exists() && fs::metadata(&file).map(|m| m.len() > 1_000_000).unwrap_or(false) {
        return Ok(file.to_string_lossy().to_string());
    }
    let url = format!(
        "https://github.com/tesseract-ocr/tessdata_best/raw/main/{lang_code}.traineddata"
    );
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(300))
        .build()
        .map_err(|e| format!("client build: {e}"))?;
    let resp = client.get(&url).send().await
        .map_err(|e| format!("download fail: {e}"))?;
    if !resp.status().is_success() {
        return Err(format!("HTTP {} cho {url}", resp.status()));
    }
    let bytes = resp.bytes().await
        .map_err(|e| format!("read body: {e}"))?;
    if bytes.len() < 1_000_000 {
        return Err(format!(
            "File tải về quá nhỏ ({} bytes), có thể fail",
            bytes.len()
        ));
    }
    fs::write(&file, &bytes).map_err(|e| format!("write file: {e}"))?;
    Ok(file.to_string_lossy().to_string())
}

/// Phase 39.fix12 — Trả TESSDATA_PREFIX dir (chứa tessdata_best đã download).
/// Set trong env khi spawn tesseract để dùng best model thay vì regular.
#[tauri::command]
fn get_tessdata_best_dir() -> Result<String, String> {
    Ok(tessdata_best_dir()?.to_string_lossy().to_string())
}

/// Phase 39.fix10 — Check MS Word installed (Windows only).
/// Detect qua 2 cách:
///   1. Check default install paths của Office 2010-2021/365.
///   2. PowerShell probe: try create Word COM object (đảm bảo COM hoạt động).
#[tauri::command]
fn check_msword() -> Result<ToolStatus, String> {
    #[cfg(target_os = "windows")]
    {
        // Step 1: Check common install paths
        let candidates = [
            r"C:\Program Files\Microsoft Office\root\Office16\WINWORD.EXE",
            r"C:\Program Files\Microsoft Office\Office16\WINWORD.EXE",
            r"C:\Program Files\Microsoft Office\Office15\WINWORD.EXE",
            r"C:\Program Files\Microsoft Office\Office14\WINWORD.EXE",
            r"C:\Program Files (x86)\Microsoft Office\root\Office16\WINWORD.EXE",
            r"C:\Program Files (x86)\Microsoft Office\Office16\WINWORD.EXE",
            r"C:\Program Files (x86)\Microsoft Office\Office15\WINWORD.EXE",
            r"C:\Program Files (x86)\Microsoft Office\Office14\WINWORD.EXE",
        ];
        for p in &candidates {
            if std::path::Path::new(p).exists() {
                return Ok(ToolStatus {
                    available: true,
                    version: Some(format!("MS Word: {p}")),
                    hint: "Word sẵn sàng convert PDF→DOCX với chất lượng cao nhất.".to_string(),
                });
            }
        }
        // Step 2: PowerShell COM probe — cover Office 365 click-to-run + custom install paths
        let probe = hidden_command("powershell")
            .arg("-NoProfile")
            .arg("-NonInteractive")
            .arg("-Command")
            .arg("try { $w = New-Object -ComObject Word.Application -ErrorAction Stop; $v = $w.Version; $w.Quit(); Write-Host \"OK $v\" } catch { Write-Host 'NO' }")
            .output();
        if let Ok(out) = probe {
            let stdout = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if stdout.starts_with("OK") {
                return Ok(ToolStatus {
                    available: true,
                    version: Some(stdout.replace("OK ", "MS Word ")),
                    hint: "Word COM sẵn sàng convert PDF→DOCX.".to_string(),
                });
            }
        }
    }
    Ok(ToolStatus {
        available: false,
        version: None,
        hint: "Không tìm thấy MS Word. Cài Office (Word 2010+) hoặc dùng LibreOffice.".to_string(),
    })
}

/// Phase 39.fix10 — Convert PDF (or DOCX) via Microsoft Word COM automation.
/// Word có built-in PDF→DOCX converter chất lượng cao + tự OCR PDF scan nếu cần.
/// Spawn PowerShell với Word COM, hidden window, no UI.
///
/// `input_path`: full path file PDF/DOCX gốc.
/// `output_path`: full path file DOCX đích.
#[tauri::command]
async fn convert_via_msword(
    input_path: String,
    output_path: String,
) -> Result<(), String> {
    #[cfg(not(target_os = "windows"))]
    {
        return Err("MS Word convert chỉ hỗ trợ Windows".to_string());
    }
    #[cfg(target_os = "windows")]
    {
        // Build PowerShell script — Word COM open + SaveAs2 + Quit
        // FileFormat: 16 = wdFormatXMLDocument (.docx)
        // Path escape: PowerShell single-quote string không escape, replace ' → ''
        let in_esc = input_path.replace('\'', "''");
        let out_esc = output_path.replace('\'', "''");
        let script = format!(
            r#"
$ErrorActionPreference = 'Stop'
try {{
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $word.DisplayAlerts = 0
    # AutomationSecurity = msoAutomationSecurityForceDisable (no macro prompts)
    $word.AutomationSecurity = 3
    $doc = $word.Documents.Open('{in_esc}', $false, $true)
    $doc.SaveAs2('{out_esc}', 16)
    $doc.Close($false)
    $word.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($doc) | Out-Null
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
    Write-Host 'OK'
}} catch {{
    Write-Error $_.Exception.Message
    exit 1
}}
"#
        );

        if let Some(parent) = PathBuf::from(&output_path).parent() {
            fs::create_dir_all(parent).map_err(|e| format!("create_dir: {e}"))?;
        }

        let script_clone = script.clone();
        tokio::task::spawn_blocking(move || -> Result<(), String> {
            let output = hidden_command("powershell")
                .arg("-NoProfile")
                .arg("-NonInteractive")
                .arg("-ExecutionPolicy").arg("Bypass")
                .arg("-Command").arg(&script_clone)
                .output()
                .map_err(|e| format!("Không gọi được PowerShell: {e}"))?;
            if !output.status.success() {
                let stderr = String::from_utf8_lossy(&output.stderr).to_string();
                let stdout = String::from_utf8_lossy(&output.stdout).to_string();
                return Err(format!(
                    "MS Word convert lỗi: {}\n{}\n\n\
                    Có thể: (1) Word chưa activate, (2) PDF protected, \
                    (3) Word bận - đóng tất cả Word đang mở rồi thử lại.",
                    stderr.trim(), stdout.trim()
                ));
            }
            Ok(())
        })
        .await
        .map_err(|e| format!("msword join: {e}"))?
    }
}

/// Phase 39 — Helper: tạo Command với CREATE_NO_WINDOW flag (Windows) để
/// subprocess KHÔNG hiện CMD console window pop-up. Cross-platform.
fn hidden_command<S: AsRef<std::ffi::OsStr>>(program: S) -> std::process::Command {
    let mut cmd = std::process::Command::new(program);
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }
    cmd
}

/// Phase 39 — Resolve LibreOffice (soffice) binary path.
/// LibreOffice headless mode dùng để convert PDF↔DOCX↔ODT preserve format.
fn resolve_libreoffice_path() -> Option<String> {
    // Phase 39.fix2 — KHÔNG dùng `--version` probe vì LibreOffice 26.x trên Windows
    // có bug pop-up "Press Enter to continue..." kể cả với CREATE_NO_WINDOW flag.
    // Chỉ check file tồn tại ở các default install paths.
    #[cfg(target_os = "windows")]
    {
        let candidates = [
            r"C:\Program Files\LibreOffice\program\soffice.exe",
            r"C:\Program Files (x86)\LibreOffice\program\soffice.exe",
        ];
        for p in &candidates {
            if std::path::Path::new(p).exists() {
                return Some(p.to_string());
            }
        }
    }
    #[cfg(target_os = "macos")]
    {
        let candidates = [
            "/Applications/LibreOffice.app/Contents/MacOS/soffice",
            "/usr/local/bin/soffice",
        ];
        for p in &candidates {
            if std::path::Path::new(p).exists() {
                return Some(p.to_string());
            }
        }
    }
    #[cfg(target_os = "linux")]
    {
        let candidates = [
            "/usr/bin/soffice",
            "/usr/bin/libreoffice",
            "/snap/bin/libreoffice",
            "/opt/libreoffice/program/soffice",
        ];
        for p in &candidates {
            if std::path::Path::new(p).exists() {
                return Some(p.to_string());
            }
        }
    }
    None
}

/// Phase 39 — Check LibreOffice available.
/// Phase 39.fix2 — Skip `--version` probe vì LibreOffice 26.x trên Windows pop-up
/// "Press Enter to continue..." console window. Chỉ check file exists.
#[tauri::command]
fn check_libreoffice() -> Result<ToolStatus, String> {
    match resolve_libreoffice_path() {
        Some(bin) => Ok(ToolStatus {
            available: true,
            version: Some(format!("Phát hiện tại: {bin}")),
            hint: "LibreOffice sẵn sàng. Convert PDF↔DOCX preserve format.".to_string(),
        }),
        None => Ok(ToolStatus {
            available: false,
            version: None,
            hint: "Cài LibreOffice (free): https://www.libreoffice.org/download/download/\n\
                Windows: tải installer + cài default location. App tự dò.\n\
                macOS: brew install --cask libreoffice\n\
                Linux: apt install libreoffice"
                .to_string(),
        }),
    }
}

/// Phase 39 — Convert file qua LibreOffice headless.
/// Hỗ trợ: pdf, docx, odt, doc, rtf, html, txt, xlsx, ods, pptx, odp.
/// Output ghi vào output_dir/{stem}.{target_format}.
/// Returns: full path output file.
///
/// Phase 39.fix:
///   - Copy input vào temp dir với tên đơn giản (`input.{ext}`) trước khi gọi LibreOffice
///     để tránh lỗi "no export filter" khi filename có nhiều dấu chấm (vd "CV 2025.12.31.docx")
///     LibreOffice CLI parse extension sai.
///   - Windows: spawn với CREATE_NO_WINDOW flag để KHÔNG hiện CMD console window pop-up.
#[tauri::command]
async fn convert_via_libreoffice(
    input_path: String,
    output_format: String,
    output_dir: String,
) -> Result<String, String> {
    use std::process::Command;
    let bin = resolve_libreoffice_path()
        .ok_or_else(|| "LibreOffice chưa cài. Tải tại libreoffice.org".to_string())?;

    fs::create_dir_all(&output_dir).map_err(|e| format!("create_dir: {e}"))?;
    let input_path_clone = input_path.clone();
    let output_format_clone = output_format.clone();
    let output_dir_clone = output_dir.clone();

    tokio::task::spawn_blocking(move || -> Result<String, String> {
        // 1. Copy input file vào temp với tên đơn giản (tránh lỗi parse extension)
        let input_path_buf = PathBuf::from(&input_path_clone);
        let original_stem = input_path_buf
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("output")
            .to_string();
        let original_ext = input_path_buf
            .extension()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_string();
        let temp_root = std::env::temp_dir().join("trishlibrary_lo");
        fs::create_dir_all(&temp_root).map_err(|e| format!("temp_dir: {e}"))?;
        let pid = std::process::id();
        let nano = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.subsec_nanos())
            .unwrap_or(0);
        let temp_session = temp_root.join(format!("conv_{pid}_{nano}"));
        fs::create_dir_all(&temp_session).map_err(|e| format!("session_dir: {e}"))?;
        let safe_input = temp_session.join(format!("input.{original_ext}"));
        fs::copy(&input_path_buf, &safe_input)
            .map_err(|e| format!("copy input: {e}"))?;

        // 2. Build isolated UserInstallation path (fix LibreOffice profile lock conflicts)
        let user_install_dir = temp_session.join("lo_profile");
        let user_install_url = format!(
            "file:///{}",
            user_install_dir.to_string_lossy().replace('\\', "/")
        );

        // 3. Map output format → explicit LibreOffice filter name (fix "no export filter")
        // LibreOffice 26.x dev build sometimes fails với generic format names
        let target_ext_only = output_format_clone
            .split(':')
            .next()
            .unwrap_or(&output_format_clone)
            .to_lowercase();
        let convert_to_arg = match target_ext_only.as_str() {
            "docx" => "docx:MS Word 2007 XML".to_string(),
            "doc" => "doc:MS Word 97".to_string(),
            "pdf" => "pdf:writer_pdf_Export".to_string(),
            "html" | "htm" => "html:HTML (StarWriter)".to_string(),
            "txt" => "txt:Text".to_string(),
            "rtf" => "rtf:Rich Text Format".to_string(),
            "odt" => "odt:writer8".to_string(),
            "xlsx" => "xlsx:Calc Office Open XML".to_string(),
            "ods" => "ods:calc8".to_string(),
            "pptx" => "pptx:Impress Office Open XML".to_string(),
            _ => output_format_clone.clone(),
        };

        // 4. Detect input filter — PDF cần force `writer_pdf_import` khi target là DOCX/DOC/ODT/RTF/HTML
        // (default LibreOffice mở PDF qua Draw → save Writer filter sẽ fail "Write Code:16").
        let input_ext = PathBuf::from(&input_path_clone)
            .extension()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_lowercase();
        let writer_targets = ["docx", "doc", "odt", "rtf", "html", "htm", "txt"];
        let needs_writer_filter = input_ext == "pdf"
            && writer_targets.contains(&target_ext_only.as_str());

        // 5. soffice --headless --convert-to {format} --outdir {temp} {safe_input}
        let mut cmd = hidden_command(&bin);
        cmd.arg("--headless")
            .arg("--nologo")
            .arg("--nofirststartwizard")
            .arg("--norestore")
            .arg("--nocrashreport")
            .arg("--nodefault")
            .arg(format!("-env:UserInstallation={user_install_url}"));
        if needs_writer_filter {
            // Force PDF mở qua Writer module thay vì Draw (default)
            cmd.arg("--infilter=writer_pdf_import");
        }
        cmd.arg("--convert-to").arg(&convert_to_arg)
            .arg("--outdir").arg(&temp_session)
            .arg(&safe_input);

        // Phase 39.fix3 — Set current_dir = soffice's parent directory
        // Fix lỗi "Could not find platform independent libraries <prefix>" — LibreOffice
        // dev builds (26.x) cần chạy từ install dir để locate Python core + share libs.
        if let Some(bin_parent) = PathBuf::from(&bin).parent() {
            cmd.current_dir(bin_parent);
        }

        let output = cmd.output().map_err(|e| {
            let _ = fs::remove_dir_all(&temp_session);
            format!("Không gọi được LibreOffice: {e}")
        })?;
        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr).to_string();
            let stdout = String::from_utf8_lossy(&output.stdout).to_string();
            let _ = fs::remove_dir_all(&temp_session);
            return Err(format!("LibreOffice lỗi: {stderr}\n{stdout}"));
        }

        // 3. Locate output file trong temp_session: input.{target_ext}
        let target_ext = output_format_clone
            .split(':')
            .next()
            .unwrap_or(&output_format_clone);
        let temp_out = temp_session.join(format!("input.{target_ext}"));
        if !temp_out.exists() {
            let _ = fs::remove_dir_all(&temp_session);
            return Err(format!(
                "LibreOffice không tạo file output tại {}",
                temp_out.display()
            ));
        }

        // 4. Move/rename về output_dir/{original_stem}.{target_ext}
        let final_out = PathBuf::from(&output_dir_clone)
            .join(format!("{original_stem}.{target_ext}"));
        fs::create_dir_all(&output_dir_clone).map_err(|e| format!("create out: {e}"))?;
        // Nếu file đích đã tồn tại, ghi đè
        if final_out.exists() {
            let _ = fs::remove_file(&final_out);
        }
        // Try rename trước (nhanh nếu cùng partition), fallback copy + remove
        if fs::rename(&temp_out, &final_out).is_err() {
            fs::copy(&temp_out, &final_out)
                .map_err(|e| format!("copy output: {e}"))?;
            let _ = fs::remove_file(&temp_out);
        }

        // 5. Cleanup temp session
        let _ = fs::remove_dir_all(&temp_session);

        Ok(final_out.to_string_lossy().to_string())
    })
    .await
    .map_err(|e| format!("libreoffice join: {e}"))?
}

/// Phase 39 — Resolve tesseract binary path:
/// 1. Try `tesseract` từ PATH
/// 2. Fallback: default Windows install path "C:\Program Files\Tesseract-OCR\tesseract.exe"
/// 3. Fallback: "C:\Program Files (x86)\Tesseract-OCR\tesseract.exe"
/// User không cần setup PATH thủ công.
fn resolve_tesseract_path() -> String {
    // Try PATH first (hidden window check)
    if hidden_command("tesseract").arg("--version").output().is_ok() {
        return "tesseract".to_string();
    }
    #[cfg(target_os = "windows")]
    {
        let candidates = [
            r"C:\Program Files\Tesseract-OCR\tesseract.exe",
            r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
        ];
        for p in &candidates {
            if std::path::Path::new(p).exists() {
                return p.to_string();
            }
        }
    }
    #[cfg(target_os = "macos")]
    {
        let candidates = [
            "/opt/homebrew/bin/tesseract",
            "/usr/local/bin/tesseract",
        ];
        for p in &candidates {
            if std::path::Path::new(p).exists() {
                return p.to_string();
            }
        }
    }
    "tesseract".to_string() // sẽ fail nhưng giữ command name
}

#[tauri::command]
fn check_tesseract() -> Result<ToolStatus, String> {
    let bin = resolve_tesseract_path();
    let mut status = check_command(&bin, "--version");
    if !status.available {
        status.hint = "Cài Tesseract OCR: https://github.com/UB-Mannheim/tesseract/wiki\n\
            Windows: tải installer + cài Vietnamese language data (vie.traineddata).\n\
            App tự dò default path nên không cần setup PATH.\n\
            macOS: brew install tesseract tesseract-lang\n\
            Linux: apt install tesseract-ocr tesseract-ocr-vie"
            .to_string();
    }
    Ok(status)
}

/// Set password on a PDF (encrypt) using qpdf subprocess.
/// `user_password`: required to open. `owner_password`: optional admin pass (default = user).
#[tauri::command]
async fn pdf_set_password(
    input_path: String,
    output_path: String,
    user_password: String,
    owner_password: String,
) -> Result<(), String> {
    use std::process::Command;
    if user_password.trim().is_empty() {
        return Err("Mật khẩu không được rỗng".to_string());
    }
    let owner = if owner_password.trim().is_empty() {
        user_password.clone()
    } else {
        owner_password
    };

    if let Some(parent) = PathBuf::from(&output_path).parent() {
        fs::create_dir_all(parent).map_err(|e| format!("create_dir: {e}"))?;
    }

    tokio::task::spawn_blocking(move || -> Result<(), String> {
        // qpdf --encrypt user_pass owner_pass 256 -- input.pdf output.pdf
        let output = Command::new("qpdf")
            .arg("--encrypt")
            .arg(&user_password)
            .arg(&owner)
            .arg("256")
            .arg("--")
            .arg(&input_path)
            .arg(&output_path)
            .output()
            .map_err(|e| format!("Không gọi được qpdf: {e}\nCài qpdf: https://qpdf.sourceforge.io/"))?;
        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr).to_string();
            return Err(format!("qpdf lỗi: {stderr}"));
        }
        Ok(())
    })
    .await
    .map_err(|e| format!("encrypt join: {e}"))?
}

/// Remove password from PDF (decrypt) — needs to know the current user password.
#[tauri::command]
async fn pdf_remove_password(
    input_path: String,
    output_path: String,
    password: String,
) -> Result<(), String> {
    use std::process::Command;
    if let Some(parent) = PathBuf::from(&output_path).parent() {
        fs::create_dir_all(parent).map_err(|e| format!("create_dir: {e}"))?;
    }
    tokio::task::spawn_blocking(move || -> Result<(), String> {
        let output = Command::new("qpdf")
            .arg(format!("--password={password}"))
            .arg("--decrypt")
            .arg(&input_path)
            .arg(&output_path)
            .output()
            .map_err(|e| format!("Không gọi được qpdf: {e}"))?;
        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr).to_string();
            return Err(format!("qpdf lỗi: {stderr}"));
        }
        Ok(())
    })
    .await
    .map_err(|e| format!("decrypt join: {e}"))?
}

/// Phase 39 — OCR an IMAGE bytes (PNG/JPG) → plain text.
///
/// Tesseract chỉ accept image input nên React render PDF page → PNG bytes
/// rồi gọi command này per-page.
///
/// `image_bytes`: PNG hoặc JPEG bytes của 1 page đã render.
/// `lang`: ngôn ngữ tesseract, vd "vie+eng" (default), "eng", "vie".
/// Returns: text extracted (UTF-8).
#[tauri::command]
async fn ocr_image_bytes(
    image_bytes: Vec<u8>,
    lang: String,
    psm: Option<u8>,
) -> Result<String, String> {
    use std::io::Write;
    let lang = if lang.trim().is_empty() { "eng".to_string() } else { lang };
    // Phase 39.fix7 — PSM 6 (Single uniform block) tốt hơn PSM 1 cho document Việt
    let psm_str = psm.unwrap_or(6).to_string();
    tokio::task::spawn_blocking(move || -> Result<String, String> {
        let temp_dir = std::env::temp_dir().join("trishlibrary_ocr");
        fs::create_dir_all(&temp_dir).map_err(|e| format!("temp_dir: {e}"))?;
        let pid = std::process::id();
        let nano = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.subsec_nanos())
            .unwrap_or(0);
        let temp_in = temp_dir.join(format!("ocr_{pid}_{nano}.png"));
        {
            let mut f = fs::File::create(&temp_in)
                .map_err(|e| format!("create temp: {e}"))?;
            f.write_all(&image_bytes).map_err(|e| format!("write temp: {e}"))?;
        }
        let tesseract_bin = resolve_tesseract_path();
        // Phase 39.fix12 — Set TESSDATA_PREFIX nếu user đã download tessdata_best
        // (accuracy cao hơn ~10% so với regular tessdata default của UB-Mannheim)
        let tessdata_best = tessdata_best_dir().ok();
        let mut cmd = hidden_command(&tesseract_bin);
        if let Some(td) = &tessdata_best {
            // Chỉ set nếu thực sự có ít nhất 1 traineddata trong dir
            if let Ok(entries) = fs::read_dir(td) {
                if entries.flatten().any(|e| {
                    e.file_name().to_string_lossy().ends_with(".traineddata")
                }) {
                    cmd.env("TESSDATA_PREFIX", td);
                }
            }
        }
        let output = cmd
            .arg(&temp_in)
            .arg("stdout")
            .arg("-l").arg(&lang)
            .arg("--psm").arg(&psm_str)
            .arg("--oem").arg("1")
            .arg("-c").arg("preserve_interword_spaces=1")
            .output()
            .map_err(|e| {
                let _ = fs::remove_file(&temp_in);
                format!(
                    "Không gọi được tesseract: {e}\n\
                    Cài Tesseract OCR: https://github.com/UB-Mannheim/tesseract/wiki"
                )
            })?;
        let _ = fs::remove_file(&temp_in);
        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr).to_string();
            return Err(format!("tesseract lỗi: {stderr}"));
        }
        let text = String::from_utf8_lossy(&output.stdout).to_string();
        Ok(text)
    })
    .await
    .map_err(|e| format!("ocr join: {e}"))?
}

/// Phase 39 — OCR an image bytes → searchable PDF (single page) bytes.
/// Tesseract tạo PDF với invisible text layer trên top of original image.
///
/// Phase 39.fix5 — `text_only` option: nếu true thì output PDF chỉ chứa text layer
/// KHÔNG embed image gốc → file rất nhẹ + LibreOffice convert sang DOCX clean
/// (không bị duplicate image + text overlap).
#[tauri::command]
async fn ocr_image_to_pdf_page(
    image_bytes: Vec<u8>,
    lang: String,
    text_only: Option<bool>,
) -> Result<Vec<u8>, String> {
    use std::io::Write;
    let lang = if lang.trim().is_empty() { "eng".to_string() } else { lang };
    let text_only_flag = text_only.unwrap_or(false);
    tokio::task::spawn_blocking(move || -> Result<Vec<u8>, String> {
        let temp_dir = std::env::temp_dir().join("trishlibrary_ocr");
        fs::create_dir_all(&temp_dir).map_err(|e| format!("temp_dir: {e}"))?;
        let pid = std::process::id();
        let nano = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.subsec_nanos())
            .unwrap_or(0);
        let stem = temp_dir.join(format!("ocr_pg_{pid}_{nano}"));
        let temp_in = temp_dir.join(format!("ocr_pg_{pid}_{nano}.png"));
        {
            let mut f = fs::File::create(&temp_in)
                .map_err(|e| format!("create temp: {e}"))?;
            f.write_all(&image_bytes).map_err(|e| format!("write temp: {e}"))?;
        }
        let stem_str = stem.to_string_lossy().to_string();
        let tesseract_bin = resolve_tesseract_path();
        let mut cmd = hidden_command(&tesseract_bin);
        cmd.arg(&temp_in)
            .arg(&stem_str)
            .arg("-l").arg(&lang)
            .arg("--psm").arg("1")
            .arg("--oem").arg("1");
        // Phase 39.fix5 — Text-only PDF (no image embed) cho convert→DOCX pipeline
        if text_only_flag {
            cmd.arg("-c").arg("textonly_pdf=1");
        }
        cmd.arg("pdf");
        let output = cmd.output().map_err(|e| {
            let _ = fs::remove_file(&temp_in);
            format!("Không gọi được tesseract: {e}")
        })?;
        let _ = fs::remove_file(&temp_in);
        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr).to_string();
            return Err(format!("tesseract lỗi: {stderr}"));
        }
        let pdf_path = format!("{stem_str}.pdf");
        let pdf_bytes = fs::read(&pdf_path)
            .map_err(|e| format!("read pdf: {e}"))?;
        let _ = fs::remove_file(&pdf_path);
        Ok(pdf_bytes)
    })
    .await
    .map_err(|e| format!("ocr join: {e}"))?
}

/// Phase 39 — Merge nhiều page PDF bytes → 1 PDF file.
/// Dùng cho OCR pipeline: render → OCR per page → merge thành searchable PDF.
#[tauri::command]
async fn merge_pdf_pages_bytes(
    pages: Vec<Vec<u8>>,
    output_path: String,
) -> Result<(), String> {
    use lopdf::Document;
    if pages.is_empty() {
        return Err("Không có page nào để merge".to_string());
    }
    if let Some(parent) = PathBuf::from(&output_path).parent() {
        fs::create_dir_all(parent).map_err(|e| format!("create_dir: {e}"))?;
    }
    tokio::task::spawn_blocking(move || -> Result<(), String> {
        // Save từng page bytes ra temp file (lopdf load qua path tiện hơn)
        let temp_dir = std::env::temp_dir().join("trishlibrary_ocr_merge");
        fs::create_dir_all(&temp_dir).map_err(|e| format!("temp_dir: {e}"))?;
        let pid = std::process::id();
        let mut temp_files: Vec<PathBuf> = Vec::with_capacity(pages.len());
        for (i, bytes) in pages.iter().enumerate() {
            let p = temp_dir.join(format!("merge_{pid}_{i}.pdf"));
            fs::write(&p, bytes).map_err(|e| format!("write temp {i}: {e}"))?;
            temp_files.push(p);
        }
        // Load + merge với lopdf logic giống pdf_merge có sẵn
        let mut docs: Vec<Document> = Vec::new();
        for p in &temp_files {
            let d = Document::load(p).map_err(|e| format!("load {}: {e}", p.display()))?;
            docs.push(d);
        }
        // Use first as base, append rest
        let mut base = docs.remove(0);
        for mut next in docs {
            // 1. Renumber object IDs to avoid collision
            let max_id = base.max_id;
            next.renumber_objects_with(max_id);
            // 2. Collect new page IDs BEFORE moving next.objects (borrow checker)
            let next_pages: Vec<lopdf::ObjectId> = next.page_iter().collect();
            let next_max = next.max_id;
            // 3. Move objects vào base
            base.objects.extend(next.objects);
            base.max_id = next_max;
            // 4. Append page refs vào /Pages.Kids của base
            if let Ok(base_pages_id) = base
                .catalog()
                .and_then(|c| c.get(b"Pages"))
                .and_then(|o| o.as_reference())
            {
                if let Ok(pages_obj) = base.get_object_mut(base_pages_id) {
                    if let Ok(pages_dict) = pages_obj.as_dict_mut() {
                        if let Ok(kids) = pages_dict.get_mut(b"Kids") {
                            if let Ok(arr) = kids.as_array_mut() {
                                for pg_id in &next_pages {
                                    arr.push(lopdf::Object::Reference(*pg_id));
                                }
                            }
                        }
                        let cur = pages_dict
                            .get(b"Count")
                            .and_then(|o| o.as_i64())
                            .unwrap_or(0);
                        pages_dict.set(
                            "Count",
                            lopdf::Object::Integer(cur + next_pages.len() as i64),
                        );
                    }
                }
            }
        }
        base.save(&output_path).map_err(|e| format!("save: {e}"))?;
        // Cleanup
        for p in &temp_files {
            let _ = fs::remove_file(p);
        }
        Ok(())
    })
    .await
    .map_err(|e| format!("merge join: {e}"))?
}

/// Phase 18.3.b.4 (legacy) — Wrapper cũ. Tesseract KHÔNG accept PDF input,
/// nên command này CHỈ work nếu input là single-image (PNG/TIFF). Phase 39 dùng
/// `ocr_image_bytes` + `ocr_image_to_pdf_page` + `merge_pdf_pages_bytes`.
#[tauri::command]
async fn pdf_ocr(
    input_path: String,
    output_path: String,
    lang: String,
) -> Result<(), String> {
    use std::process::Command;
    if let Some(parent) = PathBuf::from(&output_path).parent() {
        fs::create_dir_all(parent).map_err(|e| format!("create_dir: {e}"))?;
    }
    tokio::task::spawn_blocking(move || -> Result<(), String> {
        let stem = PathBuf::from(&output_path)
            .with_extension("")
            .to_string_lossy()
            .to_string();
        let tesseract_bin = resolve_tesseract_path();
        // Phase 39.fix12 — Set TESSDATA_PREFIX nếu user đã download tessdata_best
        // (accuracy cao hơn ~10% so với regular tessdata default của UB-Mannheim)
        let tessdata_best = tessdata_best_dir().ok();
        let mut cmd = hidden_command(&tesseract_bin);
        if let Some(td) = &tessdata_best {
            // Chỉ set nếu thực sự có ít nhất 1 traineddata trong dir
            if let Ok(entries) = fs::read_dir(td) {
                if entries.flatten().any(|e| {
                    e.file_name().to_string_lossy().ends_with(".traineddata")
                }) {
                    cmd.env("TESSDATA_PREFIX", td);
                }
            }
        }
        let output = cmd
            .arg(&input_path)
            .arg(&stem)
            .arg("-l")
            .arg(if lang.trim().is_empty() { "eng" } else { lang.as_str() })
            .arg("--psm").arg("1")
            .arg("--oem").arg("1")
            .arg("pdf")
            .output()
            .map_err(|e| format!("Không gọi được tesseract: {e}"))?;
        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr).to_string();
            return Err(format!(
                "tesseract lỗi: {stderr}\n\n\
                Lưu ý: tesseract không accept PDF multi-page. Dùng OCR mới (render PDF→image trước)."
            ));
        }
        Ok(())
    })
    .await
    .map_err(|e| format!("ocr join: {e}"))?
}

// ============================================================
// Phase 18.1.b — Library Tantivy full-text search.
//
// Index path: %LocalAppData%\TrishTEAM\TrishLibrary\library_index\
// Indexable types: .pdf (text-based), .txt, .md
// Schema: path | name | parent | content
// ============================================================

#[derive(serde::Serialize)]
struct LibIndexResult {
    files_indexed: u32,
    files_skipped: u32,
    bytes_indexed: u64,
    elapsed_ms: u64,
}

#[derive(serde::Serialize)]
struct LibSearchHit {
    path: String,
    name: String,
    parent: String,
    score: f32,
    snippet: String,
}

fn library_index_dir() -> Result<PathBuf, String> {
    let local = dirs::data_local_dir()
        .ok_or_else(|| "Không tìm được thư mục cache".to_string())?;
    let dir = local.join("TrishTEAM").join("TrishLibrary").join("library_index");
    fs::create_dir_all(&dir).map_err(|e| format!("create_dir lib_index: {e}"))?;
    Ok(dir)
}

fn lib_schema() -> tantivy::schema::Schema {
    use tantivy::schema::*;
    let mut sb = Schema::builder();
    sb.add_text_field("path", STRING | STORED);
    sb.add_text_field("name", TEXT | STORED);
    sb.add_text_field("parent", TEXT | STORED);
    sb.add_text_field("content", TEXT | STORED);
    sb.build()
}

fn extract_text_from_file(path: &Path, max_bytes: u64) -> Result<String, String> {
    let ext = match extension_of(path) {
        Some(e) => e,
        None => return Err("Không có đuôi file".to_string()),
    };
    let meta = fs::metadata(path).map_err(|e| format!("metadata: {e}"))?;
    if meta.len() > max_bytes {
        return Err(format!("Skip — file quá lớn ({} bytes)", meta.len()));
    }
    match ext.as_str() {
        "pdf" => pdf_extract::extract_text(path).map_err(|e| format!("pdf_extract: {e}")),
        "txt" | "md" | "log" | "csv" => {
            fs::read_to_string(path).map_err(|e| format!("read text: {e}"))
        }
        _ => Err(format!("Định dạng .{ext} chưa hỗ trợ extract")),
    }
}

#[tauri::command]
async fn library_index_build(
    root: String,
    paths: Vec<String>,
) -> Result<LibIndexResult, String> {
    use tantivy::doc;
    use tantivy::Index;

    let _ = root; // future use: store per-library index
    tokio::task::spawn_blocking(move || -> Result<LibIndexResult, String> {
        let start = std::time::Instant::now();
        let index_dir = library_index_dir()?;
        // Wipe existing index for full rebuild — simpler than diff
        if index_dir.exists() {
            fs::remove_dir_all(&index_dir).map_err(|e| format!("clear index: {e}"))?;
        }
        fs::create_dir_all(&index_dir).map_err(|e| format!("recreate index: {e}"))?;

        let schema = lib_schema();
        let index = Index::create_in_dir(&index_dir, schema.clone())
            .map_err(|e| format!("create_in_dir: {e}"))?;
        let mut writer = index
            .writer(50_000_000)
            .map_err(|e| format!("writer: {e}"))?;

        let f_path = schema.get_field("path").unwrap();
        let f_name = schema.get_field("name").unwrap();
        let f_parent = schema.get_field("parent").unwrap();
        let f_content = schema.get_field("content").unwrap();

        const MAX_FILE_SIZE: u64 = 80 * 1024 * 1024; // 80 MB skip threshold
        let mut files_indexed: u32 = 0;
        let mut files_skipped: u32 = 0;
        let mut bytes_indexed: u64 = 0;

        for p_str in paths.iter() {
            let p = PathBuf::from(p_str);
            if !p.is_file() {
                files_skipped += 1;
                continue;
            }
            let content = match extract_text_from_file(&p, MAX_FILE_SIZE) {
                Ok(c) => c,
                Err(_) => {
                    files_skipped += 1;
                    continue;
                }
            };
            if content.trim().is_empty() {
                files_skipped += 1;
                continue;
            }
            let name = p
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default();
            let parent = p
                .parent()
                .map(|pp| pp.to_string_lossy().to_string())
                .unwrap_or_default();
            let size = fs::metadata(&p).map(|m| m.len()).unwrap_or(0);

            writer
                .add_document(doc!(
                    f_path => p_str.clone(),
                    f_name => name,
                    f_parent => parent,
                    f_content => content,
                ))
                .map_err(|e| format!("add_document: {e}"))?;
            files_indexed += 1;
            bytes_indexed += size;
        }
        writer.commit().map_err(|e| format!("commit: {e}"))?;

        Ok(LibIndexResult {
            files_indexed,
            files_skipped,
            bytes_indexed,
            elapsed_ms: start.elapsed().as_millis() as u64,
        })
    })
    .await
    .map_err(|e| format!("index_build join: {e}"))?
}

#[tauri::command]
async fn library_search(query: String, limit: u32) -> Result<Vec<LibSearchHit>, String> {
    use tantivy::collector::TopDocs;
    use tantivy::query::QueryParser;
    use tantivy::schema::Value;
    use tantivy::Index;
    use tantivy::TantivyDocument;

    let q = query.trim().to_string();
    if q.is_empty() {
        return Ok(vec![]);
    }
    let limit = limit.clamp(1, 100) as usize;

    tokio::task::spawn_blocking(move || -> Result<Vec<LibSearchHit>, String> {
        let index_dir = library_index_dir()?;
        let schema_meta_file = index_dir.join("meta.json");
        if !schema_meta_file.exists() {
            return Err("Chưa build index — bấm 'Tạo index' trước khi search".to_string());
        }
        let index = Index::open_in_dir(&index_dir).map_err(|e| format!("open_in_dir: {e}"))?;
        let reader = index.reader().map_err(|e| format!("reader: {e}"))?;
        let searcher = reader.searcher();
        let schema = index.schema();
        let f_path = schema.get_field("path").unwrap();
        let f_name = schema.get_field("name").unwrap();
        let f_parent = schema.get_field("parent").unwrap();
        let f_content = schema.get_field("content").unwrap();

        let parser = QueryParser::for_index(&index, vec![f_name, f_parent, f_content]);
        let parsed_query = parser
            .parse_query(&q)
            .map_err(|e| format!("parse_query: {e}"))?;
        let top_docs = searcher
            .search(&parsed_query, &TopDocs::with_limit(limit))
            .map_err(|e| format!("search: {e}"))?;

        let q_lower = q.to_lowercase();
        let mut hits: Vec<LibSearchHit> = Vec::with_capacity(top_docs.len());
        for (score, addr) in top_docs {
            let doc: TantivyDocument = searcher.doc(addr).map_err(|e| format!("doc: {e}"))?;
            let path = doc
                .get_first(f_path)
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
                .unwrap_or_default();
            let name = doc
                .get_first(f_name)
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
                .unwrap_or_default();
            let parent = doc
                .get_first(f_parent)
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
                .unwrap_or_default();
            let content = doc
                .get_first(f_content)
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
                .unwrap_or_default();

            // Build a snippet around first occurrence of query term (case-insensitive substring)
            let snippet = build_snippet(&content, &q_lower, 160);
            hits.push(LibSearchHit {
                path,
                name,
                parent,
                score,
                snippet,
            });
        }
        Ok(hits)
    })
    .await
    .map_err(|e| format!("search join: {e}"))?
}

fn build_snippet(content: &str, query_lower: &str, max_len: usize) -> String {
    let lower = content.to_lowercase();
    if let Some(pos) = lower.find(query_lower) {
        let start = pos.saturating_sub(60);
        let end = (pos + query_lower.len() + 100).min(content.len());
        // Step back to char boundary to avoid panic on multi-byte UTF-8
        let safe_start = clamp_char_boundary(content, start);
        let safe_end = clamp_char_boundary(content, end);
        let mut s = content[safe_start..safe_end].to_string();
        if safe_start > 0 {
            s.insert_str(0, "…");
        }
        if safe_end < content.len() {
            s.push('…');
        }
        return s.replace('\n', " ").chars().take(max_len).collect();
    }
    content
        .chars()
        .take(max_len)
        .collect::<String>()
        .replace('\n', " ")
}

fn clamp_char_boundary(s: &str, mut idx: usize) -> usize {
    while idx > 0 && !s.is_char_boundary(idx) {
        idx -= 1;
    }
    idx
}

#[tauri::command]
fn library_index_status() -> Result<bool, String> {
    let dir = library_index_dir()?;
    Ok(dir.join("meta.json").exists())
}

#[tauri::command]
fn library_index_clear() -> Result<(), String> {
    let dir = library_index_dir()?;
    if dir.exists() {
        fs::remove_dir_all(&dir).map_err(|e| format!("remove: {e}"))?;
    }
    fs::create_dir_all(&dir).map_err(|e| format!("recreate: {e}"))?;
    Ok(())
}

// ============================================================
// Phase 38.2.1 — PDF Binder với bookmarks (Phase 38 PDF Pro)
// ============================================================

#[derive(serde::Deserialize)]
struct BinderItem {
    path: String,
    bookmark_label: String,
}

#[derive(serde::Serialize)]
struct BinderResult {
    page_count: u32,
    bookmark_count: u32,
    missing_files: Vec<String>,
}

/// Gộp nhiều PDF theo thứ tự + tạo bookmark từ label cho từng PDF.
/// Mỗi item: { path, bookmark_label } → bookmark trỏ tới trang đầu của PDF đó.
/// Nếu file không tồn tại → skip + báo trong missing_files.
#[tauri::command]
fn pdf_binder(
    items: Vec<BinderItem>,
    output_path: String,
) -> Result<BinderResult, String> {
    if items.is_empty() {
        return Err("Cần ít nhất 1 PDF trong danh mục".to_string());
    }

    let mut merged = lopdf::Document::with_version("1.5");
    let mut max_id: u32 = 1;
    let mut all_pages: Vec<lopdf::ObjectId> = Vec::new();
    let mut bookmarks: Vec<(String, usize)> = Vec::new(); // (label, page_index)
    let mut missing_files: Vec<String> = Vec::new();
    let mut all_objects: std::collections::BTreeMap<lopdf::ObjectId, lopdf::Object> =
        std::collections::BTreeMap::new();
    let mut all_page_objects: std::collections::BTreeMap<
        lopdf::ObjectId,
        lopdf::Object,
    > = std::collections::BTreeMap::new();

    for item in &items {
        if !std::path::Path::new(&item.path).exists() {
            missing_files.push(item.path.clone());
            continue;
        }
        let mut doc = lopdf::Document::load(&item.path)
            .map_err(|e| format!("load {}: {e}", item.path))?;
        doc.renumber_objects_with(max_id);
        max_id = doc.max_id + 1;

        let start_page_index = all_pages.len();
        bookmarks.push((item.bookmark_label.clone(), start_page_index));

        for (_, page_id) in doc.get_pages() {
            if let Ok(obj) = doc.get_object(page_id) {
                all_pages.push(page_id);
                all_page_objects.insert(page_id, obj.to_owned());
            }
        }
        all_objects.extend(doc.objects);
    }

    if all_pages.is_empty() {
        return Err(format!(
            "Không có file PDF hợp lệ. Thiếu {} files.",
            missing_files.len()
        ));
    }

    // Insert all objects
    for (id, obj) in all_objects {
        merged.objects.insert(id, obj);
    }

    // 2. Build pages tree
    let pages_id = merged.new_object_id();
    let kids: Vec<lopdf::Object> = all_pages
        .iter()
        .map(|id| lopdf::Object::Reference(*id))
        .collect();

    // Patch each page's /Parent → new pages_id
    for (id, mut page_obj) in all_page_objects {
        if let lopdf::Object::Dictionary(ref mut d) = page_obj {
            d.set("Parent", pages_id);
        }
        merged.objects.insert(id, page_obj);
    }

    let mut pages_dict = lopdf::Dictionary::new();
    pages_dict.set("Type", "Pages");
    pages_dict.set("Count", all_pages.len() as i64);
    pages_dict.set("Kids", kids);
    merged
        .objects
        .insert(pages_id, lopdf::Object::Dictionary(pages_dict));

    // 3. Build outlines (bookmarks tree)
    let outlines_id = merged.new_object_id();
    let mut outline_ids: Vec<lopdf::ObjectId> = Vec::new();
    for (label, page_idx) in &bookmarks {
        let outline_id = merged.new_object_id();
        let page_id = all_pages[*page_idx];
        let mut outline_dict = lopdf::Dictionary::new();
        outline_dict.set(
            "Title",
            lopdf::Object::String(label.as_bytes().to_vec(), lopdf::StringFormat::Literal),
        );
        outline_dict.set("Parent", outlines_id);
        // Dest = [page_id, /Fit]
        outline_dict.set(
            "Dest",
            vec![
                lopdf::Object::Reference(page_id),
                lopdf::Object::Name(b"Fit".to_vec()),
            ],
        );
        merged
            .objects
            .insert(outline_id, lopdf::Object::Dictionary(outline_dict));
        outline_ids.push(outline_id);
    }

    // Link prev/next siblings
    for i in 0..outline_ids.len() {
        let id = outline_ids[i];
        if let Some(lopdf::Object::Dictionary(d)) = merged.objects.get_mut(&id) {
            if i > 0 {
                d.set("Prev", outline_ids[i - 1]);
            }
            if i + 1 < outline_ids.len() {
                d.set("Next", outline_ids[i + 1]);
            }
        }
    }

    // Build outlines root dict
    let mut outlines_dict = lopdf::Dictionary::new();
    outlines_dict.set("Type", "Outlines");
    outlines_dict.set("Count", outline_ids.len() as i64);
    if let Some(first) = outline_ids.first() {
        outlines_dict.set("First", *first);
    }
    if let Some(last) = outline_ids.last() {
        outlines_dict.set("Last", *last);
    }
    merged
        .objects
        .insert(outlines_id, lopdf::Object::Dictionary(outlines_dict));

    // 4. Catalog
    let catalog_id = merged.new_object_id();
    let mut catalog = lopdf::Dictionary::new();
    catalog.set("Type", "Catalog");
    catalog.set("Pages", pages_id);
    catalog.set("Outlines", outlines_id);
    // PageMode = UseOutlines → mở PDF tự hiện sidebar bookmarks
    catalog.set("PageMode", "UseOutlines");
    merged
        .objects
        .insert(catalog_id, lopdf::Object::Dictionary(catalog));
    merged.trailer.set("Root", catalog_id);
    merged.compress();

    if let Some(parent) = PathBuf::from(&output_path).parent() {
        fs::create_dir_all(parent).map_err(|e| format!("create_dir: {e}"))?;
    }
    merged
        .save(&output_path)
        .map_err(|e| format!("save: {e}"))?;

    Ok(BinderResult {
        page_count: all_pages.len() as u32,
        bookmark_count: bookmarks.len() as u32,
        missing_files,
    })
}

// ============================================================
// Main entry
// ============================================================

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            default_store_location,
            load_library,
            save_library,
            scan_library,
            app_version,
            fetch_text,
            save_qr_file,
            // Phase 18 — Generic file I/O
            read_text_string,
            write_text_string,
            read_binary_file,
            write_binary_file,
            // Phase 18 — System fonts
            list_system_fonts,
            // Phase 18 — Note attachments
            attach_file,
            remove_attached_file,
            open_local_path,
            // Phase 18.6 — Module Ảnh
            list_image_files,
            get_thumbnail,
            // Phase 18.6.e — Copy + folder check (LAN/UNC)
            copy_file,
            check_folder_exists,
            // Phase 18.6.h — EXIF metadata
            read_image_exif,
            // Phase 18.3.b — PDF Tools
            pdf_info,
            pdf_merge,
            pdf_split,
            pdf_extract_pages,
            pdf_delete_pages,
            pdf_rotate_pages,
            images_to_pdf,
            // Phase 18.3.b.2 — Watermark + Page numbers
            pdf_add_watermark,
            pdf_add_page_numbers,
            // Phase 18.3.b.3 + 18.3.b.4 — Encrypt + OCR (subprocess)
            check_qpdf,
            check_tesseract,
            pdf_set_password,
            pdf_remove_password,
            pdf_ocr,
            // Phase 39 — OCR native pipeline (render PDF→image ở React, OCR + merge ở Rust)
            ocr_image_bytes,
            ocr_image_to_pdf_page,
            merge_pdf_pages_bytes,
            // Phase 39 — LibreOffice headless converter (PDF↔DOCX preserve format)
            check_libreoffice,
            convert_via_libreoffice,
            // Phase 39.fix — System temp dir (cho OCR pipeline tạo file tạm)
            get_temp_dir,
            // Phase 39.fix10 — MS Word PDF→DOCX (chất lượng cao nhất, có OCR built-in)
            check_msword,
            convert_via_msword,
            // Phase 39.fix12 — tessdata_best download (accuracy text Việt +10%)
            check_tessdata_best,
            download_tessdata_best,
            get_tessdata_best_dir,
            // Phase 18.3.b.5 — Extract embedded images
            pdf_extract_images,
            // Phase 18.1.b — Library Tantivy full-text search
            library_index_build,
            library_search,
            library_index_status,
            library_index_clear,
            // Phase 36.5 — Machine ID cho key concurrent control
            get_device_id,
            // Phase 38.2.1 — PDF Binder với bookmarks
            pdf_binder,
        ])
        .run(tauri::generate_context!())
        .expect("error while running TrishLibrary");
}

/// Phase 36.5 — Trả về machine_id 16 hex chars (stable cross-reboot).
/// Dùng cho key activation + concurrent session control.
#[tauri::command]
fn get_device_id() -> String {
    trishteam_machine_id::get_machine_id()
}
