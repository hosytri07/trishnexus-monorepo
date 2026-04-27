//! TrishImage Rust backend — Phase 17.5 v2.
//!
//! Photo + Video organizer offline:
//!  - PhotoLocation = thư mục ảnh user thêm (persistent state JSON)
//!  - Index parallel với rayon: scan + EXIF + dimensions + thumbnail cache
//!  - View per location (UI chọn 1 folder để xem)
//!  - Search: filename + tag + date range + camera + has_gps
//!  - Thumbnail 256×256 cached vào %LocalAppData%/TrishTEAM/TrishImage/thumbnails/
//!  - Video: index nhưng không gen thumbnail (play qua asset:// URL)
//!  - Per-photo note + rename file trên đĩa
//!
//! Format ảnh: jpg/jpeg/png/webp/gif/bmp/tiff (HEIC dời v2.0.1+).
//! Format video: mp4/mov/avi/mkv/webm/flv/wmv/m4v/3gp/mpg/mpeg.

use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use walkdir::{DirEntry, WalkDir};

const APP_SUBDIR: &str = "TrishImage";
const STATE_FILENAME: &str = "state.json";
const THUMBNAILS_SUBDIR: &str = "thumbnails";

const MAX_PHOTOS_PER_LOCATION: usize = 100_000;
const MAX_WALK_DEPTH: usize = 24;

const THUMB_SIZE: u32 = 256;
const THUMB_QUALITY: u8 = 80;

const PHOTO_EXTS: &[&str] = &[
    "jpg", "jpeg", "png", "webp", "gif", "bmp", "tif", "tiff",
];

const VIDEO_EXTS: &[&str] = &[
    "mp4", "mov", "avi", "mkv", "webm", "flv", "wmv", "m4v", "3gp", "mpg", "mpeg",
];

// ============================================================
// Domain models
// ============================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PhotoLocation {
    pub id: String,
    pub name: String,
    pub path: String,
    pub last_indexed_at: i64,
    pub indexed_photos: usize,
    pub indexed_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PhotoEntry {
    pub location_id: String,
    pub path: String,
    pub name: String,
    pub ext: String,
    pub size_bytes: u64,
    pub mtime_ms: i64,
    /// EXIF DateTimeOriginal nếu có, fallback mtime
    pub taken_ms: i64,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub camera: Option<String>,
    pub has_gps: bool,
    pub gps_lat: Option<f64>,
    pub gps_lon: Option<f64>,
    /// Thumbnail filename trong cache dir (256×256 JPEG). None cho video.
    pub thumb_id: Option<String>,
    /// User-defined tags
    pub tags: Vec<String>,
    /// True nếu là video (no thumbnail, hiện ▶ icon)
    #[serde(default)]
    pub is_video: bool,
    /// User note (free text, lưu cùng tag)
    #[serde(default)]
    pub note: String,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
struct AppState {
    locations: Vec<PhotoLocation>,
    photos: Vec<PhotoEntry>,
}

type SharedState = Arc<Mutex<AppState>>;

// ============================================================
// State management
// ============================================================

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

fn thumbnails_dir() -> Result<PathBuf, String> {
    let mut p = default_data_dir()?;
    p.push(THUMBNAILS_SUBDIR);
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
    let Ok(p) = state_path() else {
        return AppState::default();
    };
    let Ok(content) = fs::read_to_string(&p) else {
        return AppState::default();
    };
    serde_json::from_str(&content).unwrap_or_default()
}

fn save_state(state: &AppState) -> Result<(), String> {
    let p = state_path()?;
    ensure_parent(&p)?;
    let json = serde_json::to_string(state).map_err(|e| format!("serialize: {e}"))?;
    let tmp = p.with_extension("json.tmp");
    fs::write(&tmp, json).map_err(|e| format!("write tmp: {e}"))?;
    fs::rename(&tmp, &p).map_err(|e| format!("rename: {e}"))?;
    Ok(())
}

// ============================================================
// Helpers
// ============================================================

fn gen_id(prefix: &str) -> String {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    format!("{prefix}_{now:x}")
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

fn mtime_ms(path: &Path) -> i64 {
    fs::metadata(path)
        .ok()
        .and_then(|m| m.modified().ok())
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

fn extension_of(p: &Path) -> String {
    p.extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_ascii_lowercase())
        .unwrap_or_default()
}

fn is_photo_ext(ext: &str) -> bool {
    PHOTO_EXTS.contains(&ext)
}

fn is_video_ext(ext: &str) -> bool {
    VIDEO_EXTS.contains(&ext)
}

fn is_media_ext(ext: &str) -> bool {
    is_photo_ext(ext) || is_video_ext(ext)
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

/// Parse "2024:07:15 14:32:09" (EXIF format) → unix ms (assume local).
fn parse_exif_datetime(s: &str) -> Option<i64> {
    let s = s.trim_matches('"').trim();
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
    let a = (14 - mo) / 12;
    let y2 = y - a;
    let m2 = mo + 12 * a - 3;
    let days = (153 * m2 + 2) / 5 + 365 * y2 + y2 / 4 - y2 / 100 + y2 / 400 - 719468 + (d - 1);
    let secs = days * 86400 + h * 3600 + mi * 60 + se;
    Some(secs * 1000)
}

/// Convert EXIF GPS field (rational degrees+min+sec) → decimal float.
fn exif_gps_to_decimal(field: &exif::Field) -> Option<f64> {
    use exif::Value;
    if let Value::Rational(ref r) = field.value {
        if r.len() >= 3 {
            let deg = r[0].to_f64();
            let min = r[1].to_f64();
            let sec = r[2].to_f64();
            return Some(deg + min / 60.0 + sec / 3600.0);
        }
    }
    None
}

// ============================================================
// EXIF + thumbnail extraction
// ============================================================

#[derive(Debug, Default)]
struct ExifInfo {
    taken_ms: Option<i64>,
    camera: Option<String>,
    gps_lat: Option<f64>,
    gps_lon: Option<f64>,
}

fn read_exif(path: &Path) -> ExifInfo {
    let mut info = ExifInfo::default();
    let Ok(file) = std::fs::File::open(path) else {
        return info;
    };
    let mut reader = std::io::BufReader::new(&file);
    let exif_reader = exif::Reader::new();
    let Ok(exif) = exif_reader.read_from_container(&mut reader) else {
        return info;
    };

    if let Some(field) = exif.get_field(exif::Tag::DateTimeOriginal, exif::In::PRIMARY) {
        let s = field.display_value().to_string();
        info.taken_ms = parse_exif_datetime(&s);
    }
    if let Some(field) = exif.get_field(exif::Tag::Model, exif::In::PRIMARY) {
        let s = field.display_value().to_string().trim_matches('"').trim().to_string();
        if !s.is_empty() {
            info.camera = Some(s);
        }
    }
    // GPS
    if let Some(lat_field) = exif.get_field(exif::Tag::GPSLatitude, exif::In::PRIMARY) {
        if let Some(mut lat) = exif_gps_to_decimal(lat_field) {
            // Check ref (N/S)
            if let Some(ref_field) = exif.get_field(exif::Tag::GPSLatitudeRef, exif::In::PRIMARY) {
                let r = ref_field.display_value().to_string();
                if r.contains('S') {
                    lat = -lat;
                }
            }
            info.gps_lat = Some(lat);
        }
    }
    if let Some(lon_field) = exif.get_field(exif::Tag::GPSLongitude, exif::In::PRIMARY) {
        if let Some(mut lon) = exif_gps_to_decimal(lon_field) {
            if let Some(ref_field) = exif.get_field(exif::Tag::GPSLongitudeRef, exif::In::PRIMARY) {
                let r = ref_field.display_value().to_string();
                if r.contains('W') {
                    lon = -lon;
                }
            }
            info.gps_lon = Some(lon);
        }
    }
    info
}

/// Generate thumbnail 256×256 JPEG, lưu vào cache dir, return thumb_id.
fn generate_thumbnail(path: &Path, thumb_dir: &Path) -> Option<String> {
    use image::imageops::FilterType;

    let img = image::open(path).ok()?;
    let thumb = img.resize(THUMB_SIZE, THUMB_SIZE, FilterType::Triangle);
    let rgb = thumb.to_rgb8();

    // ID = hash của path (deterministic)
    let id = blake3_like(&path.to_string_lossy());
    let out_path = thumb_dir.join(format!("{}.jpg", id));

    let file = fs::File::create(&out_path).ok()?;
    let mut buf_writer = std::io::BufWriter::new(file);
    let mut encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut buf_writer, THUMB_QUALITY);
    encoder
        .encode(rgb.as_raw(), rgb.width(), rgb.height(), image::ExtendedColorType::Rgb8)
        .ok()?;
    buf_writer.flush().ok()?;
    Some(id)
}

/// Simple non-cryptographic hash of string (avoid pulling blake3 crate).
fn blake3_like(s: &str) -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    let mut hasher = DefaultHasher::new();
    s.hash(&mut hasher);
    format!("{:016x}", hasher.finish())
}

// ============================================================
// Tauri commands
// ============================================================

#[derive(Debug, Serialize)]
pub struct EnvLocation {
    pub data_dir: String,
    pub thumbnails_dir: String,
}

#[tauri::command]
fn default_store_location() -> Result<EnvLocation, String> {
    let d = default_data_dir()?;
    let t = thumbnails_dir()?;
    Ok(EnvLocation {
        data_dir: d.to_string_lossy().into_owned(),
        thumbnails_dir: t.to_string_lossy().into_owned(),
    })
}

#[tauri::command]
fn list_locations(state: tauri::State<'_, SharedState>) -> Vec<PhotoLocation> {
    state.lock().locations.clone()
}

#[tauri::command]
fn add_location(
    state: tauri::State<'_, SharedState>,
    path: String,
    name: Option<String>,
) -> Result<PhotoLocation, String> {
    let trimmed = path.trim().to_string();
    if trimmed.is_empty() {
        return Err("Đường dẫn rỗng".into());
    }
    let p = PathBuf::from(&trimmed);
    if !p.exists() {
        return Err(format!("Đường dẫn không tồn tại: {}", trimmed));
    }
    if !p.is_dir() {
        return Err(format!("Phải là thư mục: {}", trimmed));
    }
    let mut s = state.lock();
    if s.locations.iter().any(|l| l.path.eq_ignore_ascii_case(&trimmed)) {
        return Err("Thư mục này đã được thêm".into());
    }
    let display_name = name.unwrap_or_else(|| {
        p.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_else(|| trimmed.clone())
    });
    let loc = PhotoLocation {
        id: gen_id("loc"),
        name: display_name,
        path: trimmed,
        last_indexed_at: 0,
        indexed_photos: 0,
        indexed_bytes: 0,
    };
    s.locations.push(loc.clone());
    save_state(&s)?;
    Ok(loc)
}

#[tauri::command]
fn remove_location(
    state: tauri::State<'_, SharedState>,
    location_id: String,
) -> Result<(), String> {
    let mut s = state.lock();
    let before = s.locations.len();
    s.locations.retain(|l| l.id != location_id);
    if s.locations.len() == before {
        return Err("Không tìm thấy location".into());
    }
    // Cleanup thumbnails
    let thumb_dir_path = thumbnails_dir().ok();
    for photo in s.photos.iter().filter(|p| p.location_id == location_id) {
        if let (Some(ref dir), Some(ref id)) = (thumb_dir_path.clone(), &photo.thumb_id) {
            let _ = fs::remove_file(dir.join(format!("{}.jpg", id)));
        }
    }
    s.photos.retain(|p| p.location_id != location_id);
    save_state(&s)?;
    Ok(())
}

#[tauri::command]
fn rename_location(
    state: tauri::State<'_, SharedState>,
    location_id: String,
    name: String,
) -> Result<(), String> {
    let mut s = state.lock();
    let loc = s.locations.iter_mut().find(|l| l.id == location_id)
        .ok_or_else(|| "Không tìm thấy location".to_string())?;
    loc.name = name.trim().to_string();
    save_state(&s)?;
    Ok(())
}

// ---------- Index ----------

#[derive(Debug, Serialize)]
pub struct IndexResult {
    pub location_id: String,
    pub indexed_photos: usize,
    pub skipped: usize,
    pub errors: Vec<String>,
    pub total_bytes: u64,
    pub elapsed_ms: u64,
    pub limit_reached: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct IndexProgress {
    pub location_id: String,
    pub stage: String, // "scanning" | "processing" | "done"
    pub current: usize,
    pub total: usize,
    pub current_file: String,
}

#[tauri::command]
async fn index_location(
    app: tauri::AppHandle,
    state: tauri::State<'_, SharedState>,
    location_id: String,
) -> Result<IndexResult, String> {
    let shared: SharedState = state.inner().clone();
    let app_clone = app.clone();
    tokio::task::spawn_blocking(move || index_location_sync(&app_clone, &shared, &location_id))
        .await
        .map_err(|e| format!("spawn_blocking failed: {e}"))?
}

fn index_location_sync(
    app: &tauri::AppHandle,
    state: &SharedState,
    location_id: &str,
) -> Result<IndexResult, String> {
    let location = {
        let s = state.lock();
        s.locations.iter().find(|l| l.id == location_id).cloned()
            .ok_or_else(|| "Không tìm thấy location".to_string())?
    };
    let root = PathBuf::from(&location.path);
    if !root.exists() || !root.is_dir() {
        return Err(format!("Path không tồn tại: {}", location.path));
    }

    let thumb_dir = thumbnails_dir()?;
    fs::create_dir_all(&thumb_dir).map_err(|e| format!("create thumb dir: {e}"))?;

    let started = std::time::Instant::now();
    use tauri::Emitter;

    // ===== Stage 1: Walk + collect =====
    let _ = app.emit(
        "index-progress",
        IndexProgress {
            location_id: location_id.to_string(),
            stage: "scanning".into(),
            current: 0,
            total: 0,
            current_file: "Đang quét folder...".into(),
        },
    );

    let walker = WalkDir::new(&root)
        .max_depth(MAX_WALK_DEPTH)
        .follow_links(false)
        .into_iter()
        .filter_entry(|e| !is_hidden(e));

    let mut entries: Vec<DirEntry> = Vec::new();
    for entry in walker {
        if entries.len() >= MAX_PHOTOS_PER_LOCATION {
            break;
        }
        if let Ok(e) = entry {
            if e.file_type().is_file() {
                let ext = extension_of(e.path());
                if is_media_ext(&ext) {
                    entries.push(e);
                    // Emit scan progress mỗi 100 file để UI thấy
                    if entries.len() % 100 == 0 {
                        let _ = app.emit(
                            "index-progress",
                            IndexProgress {
                                location_id: location_id.to_string(),
                                stage: "scanning".into(),
                                current: entries.len(),
                                total: 0,
                                current_file: format!("Tìm thấy {} file...", entries.len()),
                            },
                        );
                    }
                }
            }
        }
    }
    let limit_reached = entries.len() >= MAX_PHOTOS_PER_LOCATION;
    let total_count = entries.len();

    // ===== Stage 2: Parallel processing =====
    let _ = app.emit(
        "index-progress",
        IndexProgress {
            location_id: location_id.to_string(),
            stage: "processing".into(),
            current: 0,
            total: total_count,
            current_file: format!("Bắt đầu xử lý {} ảnh...", total_count),
        },
    );

    use rayon::prelude::*;
    use std::sync::atomic::{AtomicU64, AtomicUsize, Ordering};

    let skipped_atomic = AtomicUsize::new(0);
    let total_bytes_atomic = AtomicU64::new(0);
    let processed_atomic = AtomicUsize::new(0);
    let errors_mutex = std::sync::Mutex::new(Vec::<String>::new());
    let location_id_owned = location_id.to_string();
    let app_for_emit = app.clone();
    let location_id_for_emit = location_id.to_string();

    // Pre-build map của old thumb_id để giữ lại nếu file không đổi
    let old_thumbs: std::collections::HashMap<String, String> = {
        let s = state.lock();
        s.photos
            .iter()
            .filter(|p| p.location_id == location_id)
            .filter_map(|p| p.thumb_id.as_ref().map(|t| (p.path.clone(), t.clone())))
            .collect()
    };

    let photos: Vec<PhotoEntry> = entries
        .par_iter()
        .filter_map(|entry| {
            let path = entry.path();
            let meta = match entry.metadata() {
                Ok(m) => m,
                Err(_) => {
                    skipped_atomic.fetch_add(1, Ordering::Relaxed);
                    return None;
                }
            };
            let size = meta.len();
            total_bytes_atomic.fetch_add(size, Ordering::Relaxed);
            let mtime = mtime_ms(path);
            let name = entry.file_name().to_string_lossy().into_owned();
            let ext = extension_of(path);
            let path_str = path.to_string_lossy().into_owned();
            let is_video = is_video_ext(&ext);

            let (taken_ms, camera, gps_lat, gps_lon, width, height, thumb_id) = if is_video {
                // Video: chỉ lấy mtime, không EXIF, không thumbnail, không dimensions
                (mtime, None, None, None, None, None, None)
            } else {
                let exif_info = read_exif(path);
                let taken = exif_info.taken_ms.unwrap_or(mtime);

                // Dimensions header-only
                let (w, h) = match imagesize::size(path) {
                    Ok(s) => (Some(s.width as u32), Some(s.height as u32)),
                    Err(_) => (None, None),
                };

                // Thumbnail: nếu có cũ thì giữ, không thì generate
                let tid = old_thumbs.get(&path_str).cloned().or_else(|| {
                    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                        generate_thumbnail(path, &thumb_dir)
                    }));
                    match result {
                        Ok(Some(id)) => Some(id),
                        Ok(None) => {
                            errors_mutex.lock().unwrap().push(format!("{}: thumb gen fail", path.display()));
                            None
                        }
                        Err(_) => {
                            errors_mutex.lock().unwrap().push(format!("{}: thumb panic", path.display()));
                            None
                        }
                    }
                });

                (taken, exif_info.camera, exif_info.gps_lat, exif_info.gps_lon, w, h, tid)
            };

            // Emit progress per-file để UI realtime giống Windows copy
            let done = processed_atomic.fetch_add(1, Ordering::Relaxed) + 1;
            let _ = app_for_emit.emit(
                "index-progress",
                IndexProgress {
                    location_id: location_id_for_emit.clone(),
                    stage: "processing".into(),
                    current: done,
                    total: total_count,
                    current_file: name.clone(),
                },
            );

            Some(PhotoEntry {
                location_id: location_id_owned.clone(),
                path: path_str,
                name,
                ext,
                size_bytes: size,
                mtime_ms: mtime,
                taken_ms,
                width,
                height,
                camera,
                has_gps: gps_lat.is_some() && gps_lon.is_some(),
                gps_lat,
                gps_lon,
                thumb_id,
                tags: Vec::new(),
                is_video,
                note: String::new(),
            })
        })
        .collect();

    let skipped = skipped_atomic.load(Ordering::Relaxed);
    let total_bytes = total_bytes_atomic.load(Ordering::Relaxed);
    let errors = errors_mutex.into_inner().unwrap();
    let elapsed_ms = started.elapsed().as_millis() as u64;

    // Update state: replace photos của location này, giữ lại tags + note từ previous index
    {
        let mut s = state.lock();
        let prev_data: std::collections::HashMap<String, (Vec<String>, String)> = s
            .photos
            .iter()
            .filter(|p| p.location_id == location_id)
            .map(|p| (p.path.clone(), (p.tags.clone(), p.note.clone())))
            .collect();
        s.photos.retain(|p| p.location_id != location_id);
        let mut new_photos = photos.clone();
        for ph in new_photos.iter_mut() {
            if let Some((tags, note)) = prev_data.get(&ph.path) {
                ph.tags = tags.clone();
                ph.note = note.clone();
            }
        }
        s.photos.extend(new_photos);
        if let Some(loc) = s.locations.iter_mut().find(|l| l.id == location_id) {
            loc.last_indexed_at = now_ms();
            loc.indexed_photos = photos.len();
            loc.indexed_bytes = total_bytes;
        }
        save_state(&s)?;
    }

    let _ = app.emit(
        "index-progress",
        IndexProgress {
            location_id: location_id.to_string(),
            stage: "done".into(),
            current: photos.len(),
            total: total_count,
            current_file: "Hoàn tất".into(),
        },
    );

    Ok(IndexResult {
        location_id: location_id.to_string(),
        indexed_photos: photos.len(),
        skipped,
        errors,
        total_bytes,
        elapsed_ms,
        limit_reached,
    })
}

// ---------- Search / browse ----------

#[derive(Debug, Clone, Deserialize)]
pub struct PhotoQuery {
    pub query: String,
    pub location_ids: Vec<String>,
    pub tags: Vec<String>,
    pub date_after_ms: i64,
    pub date_before_ms: i64,
    pub camera_filter: String,
    pub gps_only: bool,
    pub limit: usize,
}

#[derive(Debug, Serialize)]
pub struct PhotoQueryResult {
    pub photos: Vec<PhotoEntry>,
    pub total_indexed: usize,
    pub elapsed_ms: u64,
}

#[tauri::command]
fn search_photos(
    state: tauri::State<'_, SharedState>,
    q: PhotoQuery,
) -> PhotoQueryResult {
    let started = std::time::Instant::now();
    let s = state.lock();
    let total_indexed = s.photos.len();
    let limit = if q.limit == 0 { 1000 } else { q.limit };
    let needle = q.query.trim().to_lowercase();
    let camera_needle = q.camera_filter.trim().to_lowercase();

    let mut filtered: Vec<PhotoEntry> = s
        .photos
        .iter()
        .filter(|p| {
            if !q.location_ids.is_empty() && !q.location_ids.contains(&p.location_id) {
                return false;
            }
            if !needle.is_empty()
                && !p.name.to_lowercase().contains(&needle)
                && !p.tags.iter().any(|t| t.to_lowercase().contains(&needle))
            {
                return false;
            }
            if !q.tags.is_empty() && !q.tags.iter().any(|t| p.tags.contains(t)) {
                return false;
            }
            if q.date_after_ms > 0 && p.taken_ms < q.date_after_ms {
                return false;
            }
            if q.date_before_ms > 0 && p.taken_ms > q.date_before_ms {
                return false;
            }
            if !camera_needle.is_empty() {
                match &p.camera {
                    Some(c) if c.to_lowercase().contains(&camera_needle) => {}
                    _ => return false,
                }
            }
            if q.gps_only && !p.has_gps {
                return false;
            }
            true
        })
        .cloned()
        .collect();

    // Sort theo taken_ms desc (mới nhất lên đầu)
    filtered.sort_by(|a, b| b.taken_ms.cmp(&a.taken_ms));
    filtered.truncate(limit);

    PhotoQueryResult {
        photos: filtered,
        total_indexed,
        elapsed_ms: started.elapsed().as_millis() as u64,
    }
}

// ---------- Tag CRUD ----------

#[tauri::command]
fn set_photo_tags(
    state: tauri::State<'_, SharedState>,
    path: String,
    tags: Vec<String>,
) -> Result<(), String> {
    let mut s = state.lock();
    let photo = s.photos.iter_mut().find(|p| p.path == path)
        .ok_or_else(|| "Photo không có trong index".to_string())?;
    photo.tags = tags.into_iter().map(|t| t.trim().to_string()).filter(|t| !t.is_empty()).collect();
    save_state(&s)?;
    Ok(())
}

#[tauri::command]
fn list_all_tags(state: tauri::State<'_, SharedState>) -> Vec<String> {
    let s = state.lock();
    let mut set = std::collections::BTreeSet::<String>::new();
    for p in &s.photos {
        for t in &p.tags {
            set.insert(t.clone());
        }
    }
    set.into_iter().collect()
}

#[tauri::command]
fn set_photo_note(
    state: tauri::State<'_, SharedState>,
    path: String,
    note: String,
) -> Result<(), String> {
    let mut s = state.lock();
    let photo = s
        .photos
        .iter_mut()
        .find(|p| p.path == path)
        .ok_or_else(|| "Photo không có trong index".to_string())?;
    photo.note = note;
    save_state(&s)?;
    Ok(())
}

// ---------- Rename file (rename trên đĩa + cập nhật index) ----------

#[derive(Debug, Serialize)]
pub struct RenameFileResult {
    pub old_path: String,
    pub new_path: String,
    pub new_name: String,
}

#[tauri::command]
fn rename_file(
    state: tauri::State<'_, SharedState>,
    old_path: String,
    new_name: String,
) -> Result<RenameFileResult, String> {
    let trimmed = new_name.trim();
    if trimmed.is_empty() {
        return Err("Tên file mới không được rỗng".into());
    }
    if trimmed.contains('/')
        || trimmed.contains('\\')
        || trimmed.contains(':')
        || trimmed.contains('*')
        || trimmed.contains('?')
        || trimmed.contains('"')
        || trimmed.contains('<')
        || trimmed.contains('>')
        || trimmed.contains('|')
    {
        return Err("Tên file chứa ký tự không hợp lệ".into());
    }

    let old_p = PathBuf::from(&old_path);
    if !old_p.exists() {
        return Err(format!("File không tồn tại: {}", old_path));
    }
    if !old_p.is_file() {
        return Err("Đường dẫn không phải file".into());
    }

    let parent = old_p
        .parent()
        .ok_or_else(|| "Không tìm thấy folder cha".to_string())?;
    let new_p = parent.join(trimmed);

    if new_p.exists() && new_p != old_p {
        return Err(format!(
            "Tên \"{}\" đã tồn tại trong folder",
            trimmed
        ));
    }

    fs::rename(&old_p, &new_p).map_err(|e| format!("rename: {e}"))?;

    let new_path_str = new_p.to_string_lossy().into_owned();
    let new_name_str = new_p
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| trimmed.to_string());
    let new_ext = extension_of(&new_p);

    {
        let mut s = state.lock();
        if let Some(photo) = s.photos.iter_mut().find(|p| p.path == old_path) {
            photo.path = new_path_str.clone();
            photo.name = new_name_str.clone();
            photo.ext = new_ext;
        }
        save_state(&s)?;
    }

    Ok(RenameFileResult {
        old_path,
        new_path: new_path_str,
        new_name: new_name_str,
    })
}

// ---------- Open file / read thumbnail ----------

#[tauri::command]
async fn open_file(app: tauri::AppHandle, path: String) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    app.opener().open_path(&path, None::<&str>).map_err(|e| format!("open file: {e}"))
}

#[tauri::command]
async fn open_containing_folder(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    let parent = p.parent().ok_or_else(|| "Không có folder cha".to_string())?;
    use tauri_plugin_opener::OpenerExt;
    app.opener().open_path(parent.to_string_lossy().as_ref(), None::<&str>)
        .map_err(|e| format!("open folder: {e}"))
}

/// Frontend đọc thumbnail bytes (JPEG) để render trong <img> tag qua data: URL.
#[tauri::command]
async fn read_thumbnail(thumb_id: String) -> Result<Vec<u8>, String> {
    let dir = thumbnails_dir()?;
    let p = dir.join(format!("{}.jpg", thumb_id));
    if !p.exists() {
        return Err("Thumbnail không tồn tại".into());
    }
    fs::read(&p).map_err(|e| format!("read thumb: {e}"))
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
        .user_agent(concat!("TrishImage/", env!("CARGO_PKG_VERSION")))
        .build()
        .map_err(|e| format!("client build: {e}"))?;
    let resp = client.get(&url).header("Accept", "application/json").send().await
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
            list_locations,
            add_location,
            remove_location,
            rename_location,
            index_location,
            search_photos,
            set_photo_tags,
            list_all_tags,
            set_photo_note,
            rename_file,
            open_file,
            open_containing_folder,
            read_thumbnail,
            app_version,
            fetch_text,
        ])
        .run(tauri::generate_context!())
        .expect("error while running TrishImage");
}
