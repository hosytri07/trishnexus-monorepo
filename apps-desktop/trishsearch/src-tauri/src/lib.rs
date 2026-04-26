//! TrishSearch Rust backend — Phase 17.3 Layer 1.
//!
//! Mục đích: tìm file + nội dung trên máy local + LAN UNC path.
//!
//! Architecture:
//!  - SearchLocation = thư mục user add (local hoặc UNC) — persistent
//!  - Mỗi location index → list IndexedFile lưu trong state.json
//!  - Search = filter trên IndexedFile theo filename + content match
//!
//! Layer 1 chỉ index plain text + code files (UTF-8). Layer 2 thêm
//! PDF text + DOCX + XLSX. Layer 3 thêm OCR PDF scan.
//!
//! State persistent ở `%LocalAppData%\TrishTEAM\TrishSearch\state.json`.

use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use walkdir::{DirEntry, WalkDir};

const APP_SUBDIR: &str = "TrishSearch";
const STATE_FILENAME: &str = "state.json";

/// Cap số file/location để tránh OOM. User được cảnh báo trước khi index.
const MAX_FILES_PER_LOCATION: usize = 200_000;
/// Cap kích thước content/file để index — file lớn hơn chỉ index tên + truncate content.
const MAX_CONTENT_BYTES: u64 = 1024 * 1024; // 1 MiB
/// Cap depth tránh symlink loop.
const MAX_WALK_DEPTH: usize = 32;

/// Whitelist extensions index content (text-based ở Layer 1).
const TEXT_EXTS: &[&str] = &[
    // Plain text
    "txt", "md", "markdown", "rst", "org", "html", "htm", "rtf", "csv", "tsv",
    "log", "json", "xml", "yaml", "yml", "toml", "ini", "cfg", "conf", "env",
    // Code
    "ts", "tsx", "js", "jsx", "mjs", "cjs", "py", "go", "rs", "java", "kt",
    "c", "cpp", "h", "hpp", "cs", "php", "rb", "swift", "scala", "sh", "bash",
    "zsh", "ps1", "bat", "cmd", "lua", "pl", "r", "sql", "vue", "svelte",
    "css", "scss", "sass", "less", "graphql", "gql", "proto", "dockerfile",
];

/// Layer 2 — Format có content extractable (PDF text-based, DOCX, XLSX).
const LAYER2_CONTENT_EXTS: &[&str] = &["pdf", "docx", "xlsx", "xlsm"];

/// Layer 3 — Format cần OCR (PDF scan + ảnh chứa text).
const LAYER3_OCR_IMAGE_EXTS: &[&str] = &["jpg", "jpeg", "png", "bmp", "tiff", "tif"];

/// Heuristic: nếu Layer 2 PDF text < ngưỡng này (chars), coi là PDF scan
/// và thử OCR ở Layer 3.
const PDF_SCAN_TEXT_THRESHOLD: usize = 80;

/// OCR cap số trang PDF để index, tránh OCR PDF dày 500 trang mất 1 giờ.
/// (Dời v2.0.1 — chưa dùng nhưng giữ để re-enable sau).
#[allow(dead_code)]
const OCR_PDF_MAX_PAGES: u16 = 30;

/// OCR DPI render PDF page → PNG. Cao hơn = chính xác hơn nhưng chậm hơn.
#[allow(dead_code)]
const OCR_PDF_RENDER_DPI: f32 = 200.0;

/// Whitelist extensions chỉ index TÊN (không content extractable bởi
/// Layer 1/2). Bao gồm Layer 2 exts + media + archive + binary.
const NAME_ONLY_EXTS: &[&str] = &[
    "doc", "xls", "ppt", "pptx", "odt", "ods", "odp",
    "epub", "mobi", "azw3",
    "jpg", "jpeg", "png", "gif", "bmp", "webp", "svg", "tiff", "tif",
    "mp3", "wav", "flac", "aac", "ogg", "m4a",
    "mp4", "avi", "mkv", "mov", "webm", "flv", "wmv",
    "zip", "rar", "7z", "tar", "gz", "bz2", "xz",
    "exe", "dll", "msi", "iso",
];

// ============================================================
// Domain models
// ============================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchLocation {
    pub id: String,
    pub name: String,
    pub path: String,
    pub kind: LocationKind, // 'local' | 'lan'
    /// 0 = chưa index, > 0 = unix ms
    pub last_indexed_at: i64,
    pub indexed_files: usize,
    pub indexed_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum LocationKind {
    Local,
    Lan,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexedFile {
    pub location_id: String,
    pub path: String,
    pub name: String,
    pub ext: String,
    pub size_bytes: u64,
    pub mtime_ms: i64,
    /// Full content cho text-based, empty cho name-only files.
    pub content: String,
    pub content_truncated: bool,
    /// Layer 2/3 — flag để biết file đã được extract content chưa
    pub has_content: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OcrSettings {
    /// Bật OCR cho PDF scan + ảnh. Mặc định OFF vì OCR chậm.
    pub enabled: bool,
    /// Languages tesseract: "vie" hoặc "vie+eng"
    pub languages: String,
}

impl Default for OcrSettings {
    fn default() -> Self {
        Self {
            enabled: false,
            languages: "vie+eng".to_string(),
        }
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
struct AppState {
    locations: Vec<SearchLocation>,
    files: Vec<IndexedFile>,
    #[serde(default)]
    ocr: OcrSettings,
}

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

/// In-memory state, sync với JSON file qua save_state.
type SharedState = Arc<Mutex<AppState>>;

// ============================================================
// Helpers
// ============================================================

fn gen_id(prefix: &str) -> String {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let rand = rand_suffix();
    format!("{prefix}_{now:x}{rand}")
}

fn rand_suffix() -> String {
    // Đơn giản, không cần rand crate
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.subsec_nanos())
        .unwrap_or(0);
    format!("{:x}", now)
}

fn extension_of(p: &Path) -> String {
    p.extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_ascii_lowercase())
        .unwrap_or_default()
}

fn is_hidden(entry: &DirEntry) -> bool {
    if entry.depth() == 0 {
        return false;
    }
    let name = entry.file_name().to_string_lossy();
    if name.starts_with('.') && name != ".env" && name != ".env.local" {
        return true;
    }
    if entry.file_type().is_dir() {
        let lowered = name.to_ascii_lowercase();
        if matches!(
            lowered.as_str(),
            "node_modules"
                | "target"
                | ".git"
                | ".svn"
                | ".hg"
                | "$recycle.bin"
                | "system volume information"
                | "__pycache__"
                | ".venv"
                | "venv"
                | "env"
        ) {
            return true;
        }
    }
    false
}

fn detect_kind(raw_path: &str) -> LocationKind {
    let trimmed = raw_path.trim();
    if trimmed.starts_with("\\\\") || trimmed.starts_with("//") {
        LocationKind::Lan
    } else {
        LocationKind::Local
    }
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

fn read_text_bounded(path: &Path) -> Result<(String, bool), String> {
    let meta = fs::metadata(path).map_err(|e| format!("stat: {e}"))?;
    let size = meta.len();
    if size > MAX_CONTENT_BYTES {
        let bytes = fs::read(path).map_err(|e| format!("read: {e}"))?;
        let take = MAX_CONTENT_BYTES as usize;
        let slice = if bytes.len() > take { &bytes[..take] } else { &bytes };
        Ok((String::from_utf8_lossy(slice).into_owned(), true))
    } else {
        let s = fs::read_to_string(path).map_err(|e| format!("read: {e}"))?;
        Ok((s, false))
    }
}

/// Truncate string về byte limit, đảm bảo char boundary UTF-8 hợp lệ.
fn truncate_utf8(mut s: String, max_bytes: usize) -> (String, bool) {
    if s.len() <= max_bytes {
        return (s, false);
    }
    s.truncate(max_bytes);
    while !s.is_char_boundary(s.len()) {
        s.pop();
    }
    (s, true)
}

// ============================================================
// Layer 2 — Format extractors (PDF text-based, DOCX, XLSX)
// ============================================================

/// Extract text từ PDF text-based (KHÔNG phải scan ảnh — Layer 3 sẽ OCR).
/// Note: pdf-extract spam stderr với "unknown glyph", "missing char" — không
/// phải lỗi, chỉ là log debug. Production exe không có console nên user
/// không thấy. Dev mode terminal sẽ thấy spam nhưng không ảnh hưởng tốc độ.
fn extract_pdf_text(path: &Path) -> Result<(String, bool), String> {
    let bytes = fs::read(path).map_err(|e| format!("read pdf: {e}"))?;
    if bytes.len() > 100 * 1024 * 1024 {
        return Err("PDF > 100MB, skip".into());
    }
    let text = pdf_extract::extract_text_from_mem(&bytes)
        .map_err(|e| format!("pdf parse: {e}"))?;
    Ok(truncate_utf8(text, MAX_CONTENT_BYTES as usize))
}

/// Extract text từ DOCX = ZIP chứa word/document.xml với <w:t> elements.
fn extract_docx_text(path: &Path) -> Result<(String, bool), String> {
    let file = fs::File::open(path).map_err(|e| format!("open docx: {e}"))?;
    let mut archive =
        zip::ZipArchive::new(file).map_err(|e| format!("docx not a zip: {e}"))?;

    let mut document_xml = String::new();
    {
        let mut document = archive
            .by_name("word/document.xml")
            .map_err(|e| format!("missing word/document.xml: {e}"))?;
        // Cap đọc 50MB tránh OOM với DOCX lạ
        let mut buf = Vec::new();
        let limit = 50 * 1024 * 1024;
        let took = (&mut document)
            .take(limit as u64)
            .read_to_end(&mut buf)
            .map_err(|e| format!("read xml: {e}"))?;
        if took == limit {
            return Err("DOCX document.xml > 50MB, skip".into());
        }
        document_xml = String::from_utf8_lossy(&buf).into_owned();
    }

    // Parse XML, extract text từ <w:t> elements
    let mut reader = quick_xml::Reader::from_str(&document_xml);
    reader.config_mut().trim_text(true);
    let mut buf = Vec::new();
    let mut text = String::new();
    let mut in_t = false;

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(quick_xml::events::Event::Start(e)) => {
                let n = e.name();
                let local = n.as_ref();
                // Match cả "w:t" và namespaced tag
                if local == b"w:t" || local.ends_with(b":t") || local == b"t" {
                    in_t = true;
                }
            }
            Ok(quick_xml::events::Event::End(e)) => {
                let n = e.name();
                let local = n.as_ref();
                if local == b"w:t" || local.ends_with(b":t") || local == b"t" {
                    in_t = false;
                    text.push(' ');
                }
                // Paragraph break
                if local == b"w:p" || local.ends_with(b":p") {
                    text.push('\n');
                }
            }
            Ok(quick_xml::events::Event::Text(e)) if in_t => {
                if let Ok(s) = e.unescape() {
                    text.push_str(&s);
                }
            }
            Ok(quick_xml::events::Event::Eof) => break,
            Err(_) => break,
            _ => {}
        }
        buf.clear();
        if text.len() > MAX_CONTENT_BYTES as usize * 2 {
            break;
        }
    }

    Ok(truncate_utf8(text, MAX_CONTENT_BYTES as usize))
}

/// Extract text từ XLSX (và .xlsm) — đọc tất cả sheet, mỗi cell ngăn cách bằng tab.
fn extract_xlsx_text(path: &Path) -> Result<(String, bool), String> {
    use calamine::{open_workbook_auto, Data, Reader};

    let mut workbook =
        open_workbook_auto(path).map_err(|e| format!("open xlsx: {e}"))?;
    let mut text = String::new();

    let sheet_names: Vec<String> = workbook.sheet_names().to_vec();
    for sheet_name in sheet_names.iter().take(50) {
        // cap 50 sheets
        let range = match workbook.worksheet_range(sheet_name) {
            Ok(r) => r,
            Err(_) => continue,
        };
        text.push_str("--- Sheet: ");
        text.push_str(sheet_name);
        text.push_str(" ---\n");
        let mut row_count = 0usize;
        for row in range.rows() {
            row_count += 1;
            if row_count > 10_000 {
                break; // cap 10k rows / sheet
            }
            for cell in row {
                let s = match cell {
                    Data::Empty => continue,
                    Data::String(s) => s.clone(),
                    Data::Float(n) => n.to_string(),
                    Data::Int(n) => n.to_string(),
                    Data::Bool(b) => b.to_string(),
                    Data::DateTime(d) => d.to_string(),
                    Data::DateTimeIso(s) => s.clone(),
                    Data::DurationIso(s) => s.clone(),
                    Data::Error(e) => format!("#{e:?}"),
                };
                if !s.is_empty() {
                    text.push_str(&s);
                    text.push('\t');
                }
            }
            text.push('\n');
            if text.len() > MAX_CONTENT_BYTES as usize * 2 {
                break;
            }
        }
        if text.len() > MAX_CONTENT_BYTES as usize * 2 {
            break;
        }
    }

    Ok(truncate_utf8(text, MAX_CONTENT_BYTES as usize))
}

/// Dispatcher: gọi extractor phù hợp theo extension.
fn extract_content_layer2(path: &Path, ext: &str) -> Result<(String, bool), String> {
    match ext {
        "pdf" => extract_pdf_text(path),
        "docx" => extract_docx_text(path),
        "xlsx" | "xlsm" => extract_xlsx_text(path),
        _ => Err(format!("ext .{ext} không thuộc Layer 2")),
    }
}

// ============================================================
// Layer 3 — OCR pipeline (frontend Tesseract.js + PDF.js)
// ============================================================
// Rust chỉ đóng vai trò:
//   1. read_file_bytes(path) -> Vec<u8> để frontend OCR
//   2. update_file_ocr(path, content) để frontend inject text vào index
//
// Frontend (src/ocr-engine.ts) chạy:
//   - PDF.js render PDF page → canvas
//   - Tesseract.js OCR canvas → text
//   - Loop tất cả pages → concat text → call update_file_ocr
//
// Đây là approach đơn giản nhất cho v2.0.0-1: Pure JS/WASM, không FFI,
// không Tesseract.exe, không PDFium DLL. Apache 2.0 license cho cả 2.

/// Heuristic: PDF scan thường có Layer 2 text rất ít (< threshold).
/// Frontend dùng để quyết định nên OCR file PDF nào.
#[allow(dead_code)]
fn likely_pdf_scan(layer2_text: &str) -> bool {
    layer2_text.trim().chars().count() < PDF_SCAN_TEXT_THRESHOLD
}

/// Extension nào có thể OCR (PDF + ảnh).
fn is_ocr_candidate_ext(ext: &str) -> bool {
    ext == "pdf" || LAYER3_OCR_IMAGE_EXTS.contains(&ext)
}

// ============================================================
// Tauri commands
// ============================================================

#[derive(Debug, Serialize)]
pub struct EnvLocation {
    pub data_dir: String,
    pub exists: bool,
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
fn list_locations(state: tauri::State<'_, SharedState>) -> Vec<SearchLocation> {
    state.lock().locations.clone()
}

#[tauri::command]
fn add_location(
    state: tauri::State<'_, SharedState>,
    path: String,
    name: Option<String>,
) -> Result<SearchLocation, String> {
    let trimmed = path.trim().to_string();
    if trimmed.is_empty() {
        return Err("Đường dẫn rỗng".into());
    }
    let kind = detect_kind(&trimmed);
    // Validate path tồn tại (LAN có thể chậm, cho timeout sau)
    let p = PathBuf::from(&trimmed);
    if !p.exists() {
        return Err(format!(
            "Đường dẫn không tồn tại hoặc không truy cập được: {}",
            trimmed
        ));
    }
    if !p.is_dir() {
        return Err(format!("Phải là thư mục: {}", trimmed));
    }

    let mut s = state.lock();
    // Check trùng path
    if s.locations.iter().any(|l| l.path.eq_ignore_ascii_case(&trimmed)) {
        return Err("Đường dẫn này đã được thêm".into());
    }

    let display_name = name.unwrap_or_else(|| {
        p.file_name()
            .map(|n| n.to_string_lossy().into_owned())
            .unwrap_or_else(|| trimmed.clone())
    });

    let loc = SearchLocation {
        id: gen_id("loc"),
        name: display_name,
        path: trimmed,
        kind,
        last_indexed_at: 0,
        indexed_files: 0,
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
    s.files.retain(|f| f.location_id != location_id);
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
    let loc = s
        .locations
        .iter_mut()
        .find(|l| l.id == location_id)
        .ok_or_else(|| "Không tìm thấy location".to_string())?;
    loc.name = name.trim().to_string();
    save_state(&s)?;
    Ok(())
}

// ---------- Pre-scan: estimate size + file count ----------

#[derive(Debug, Serialize)]
pub struct PreScanResult {
    pub total_files: usize,
    pub total_bytes: u64,
    pub indexable_files: usize,
    pub elapsed_ms: u64,
    pub limit_reached: bool,
}

/// Walk nhẹ chỉ đếm — KHÔNG đọc content. Dùng để cảnh báo user trước index.
#[tauri::command]
async fn pre_scan_location(path: String) -> Result<PreScanResult, String> {
    tokio::task::spawn_blocking(move || pre_scan_location_sync(&path))
        .await
        .map_err(|e| format!("spawn_blocking failed: {e}"))?
}

fn pre_scan_location_sync(path: &str) -> Result<PreScanResult, String> {
    let p = PathBuf::from(path);
    if !p.exists() || !p.is_dir() {
        return Err("Đường dẫn không hợp lệ".into());
    }
    let started = std::time::Instant::now();
    let mut total_files = 0usize;
    let mut total_bytes = 0u64;
    let mut indexable_files = 0usize;
    let mut limit_reached = false;

    let walker = WalkDir::new(&p)
        .max_depth(MAX_WALK_DEPTH)
        .follow_links(false)
        .into_iter()
        .filter_entry(|e| !is_hidden(e));

    for entry in walker {
        if total_files >= MAX_FILES_PER_LOCATION {
            limit_reached = true;
            break;
        }
        let Ok(e) = entry else { continue };
        if !e.file_type().is_file() {
            continue;
        }
        total_files += 1;
        let meta = match e.metadata() {
            Ok(m) => m,
            Err(_) => continue,
        };
        total_bytes += meta.len();
        let ext = extension_of(e.path());
        if TEXT_EXTS.contains(&ext.as_str()) || NAME_ONLY_EXTS.contains(&ext.as_str()) {
            indexable_files += 1;
        }
    }

    Ok(PreScanResult {
        total_files,
        total_bytes,
        indexable_files,
        elapsed_ms: started.elapsed().as_millis() as u64,
        limit_reached,
    })
}

// ---------- Index: scan + extract content ----------

#[derive(Debug, Serialize)]
pub struct IndexResult {
    pub location_id: String,
    pub indexed_files: usize,
    pub skipped_files: usize,
    pub errors: Vec<String>,
    pub total_bytes: u64,
    pub elapsed_ms: u64,
    pub limit_reached: bool,
}

#[tauri::command]
async fn index_location(
    state: tauri::State<'_, SharedState>,
    location_id: String,
) -> Result<IndexResult, String> {
    // Clone Arc để chuyển vào blocking thread (tránh block main thread Tauri)
    let shared: SharedState = state.inner().clone();
    tokio::task::spawn_blocking(move || index_location_sync(&shared, &location_id))
        .await
        .map_err(|e| format!("spawn_blocking failed: {e}"))?
}

/// Sync impl — chạy trong blocking thread pool, không block UI.
fn index_location_sync(
    state: &SharedState,
    location_id: &str,
) -> Result<IndexResult, String> {
    // Lấy info location (không hold lock khi walk vì walk lâu)
    let location = {
        let s = state.lock();
        s.locations
            .iter()
            .find(|l| l.id == location_id)
            .cloned()
            .ok_or_else(|| "Không tìm thấy location".to_string())?
    };

    let root = PathBuf::from(&location.path);
    if !root.exists() || !root.is_dir() {
        return Err(format!("Đường dẫn không tồn tại: {}", location.path));
    }

    let started = std::time::Instant::now();

    // Collect tất cả entry trước (walk fast, sequential) để parallel xử lý
    // bằng rayon ở bước sau (parse PDF/DOCX/XLSX là CPU-bound, parallel hợp).
    let walker = WalkDir::new(&root)
        .max_depth(MAX_WALK_DEPTH)
        .follow_links(false)
        .into_iter()
        .filter_entry(|e| !is_hidden(e));

    let mut entries: Vec<DirEntry> = Vec::new();
    let mut walk_errors: Vec<String> = Vec::new();
    for entry in walker {
        if entries.len() >= MAX_FILES_PER_LOCATION {
            break;
        }
        match entry {
            Ok(e) if e.file_type().is_file() => entries.push(e),
            Ok(_) => continue,
            Err(err) => walk_errors.push(err.to_string()),
        }
    }
    let limit_reached = entries.len() >= MAX_FILES_PER_LOCATION;

    // Parallel processing với rayon — mỗi worker handle 1 file
    use rayon::prelude::*;
    use std::sync::atomic::{AtomicU64, AtomicUsize, Ordering};

    let skipped_atomic = AtomicUsize::new(0);
    let total_bytes_atomic = AtomicU64::new(0);
    let errors_mutex = std::sync::Mutex::new(walk_errors);
    let location_id_owned = location_id.to_string();

    let indexed_files: Vec<IndexedFile> = entries
        .par_iter()
        .filter_map(|entry| {
            let p = entry.path();
            let ext = extension_of(p);

            let is_text = TEXT_EXTS.contains(&ext.as_str());
            let is_layer2 = LAYER2_CONTENT_EXTS.contains(&ext.as_str());
            let is_ocr_image = LAYER3_OCR_IMAGE_EXTS.contains(&ext.as_str());
            let is_name_only = NAME_ONLY_EXTS.contains(&ext.as_str());
            if !is_text && !is_layer2 && !is_ocr_image && !is_name_only {
                skipped_atomic.fetch_add(1, Ordering::Relaxed);
                return None;
            }

            let meta = match entry.metadata() {
                Ok(m) => m,
                Err(_) => {
                    skipped_atomic.fetch_add(1, Ordering::Relaxed);
                    return None;
                }
            };
            let size = meta.len();
            total_bytes_atomic.fetch_add(size, Ordering::Relaxed);
            let mtime = mtime_ms(p);
            let name = entry.file_name().to_string_lossy().into_owned();

            let (content, content_truncated, has_content) = if is_text {
                match read_text_bounded(p) {
                    Ok((c, trunc)) => (c, trunc, true),
                    Err(err) => {
                        errors_mutex.lock().unwrap().push(format!("{}: {}", p.display(), err));
                        (String::new(), false, false)
                    }
                }
            } else if is_layer2 {
                // Layer 2: PDF text-based, DOCX, XLSX (parallel-safe)
                let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                    extract_content_layer2(p, &ext)
                }));
                let (l2_text, l2_trunc) = match result {
                    Ok(Ok((c, trunc))) => (c, trunc),
                    Ok(Err(err)) => {
                        errors_mutex.lock().unwrap().push(format!("{}: {}", p.display(), err));
                        (String::new(), false)
                    }
                    Err(_) => {
                        errors_mutex.lock().unwrap().push(format!("{}: panic khi extract Layer 2", p.display()));
                        (String::new(), false)
                    }
                };
                let has = !l2_text.is_empty();
                (l2_text, l2_trunc, has)
            } else if is_ocr_image {
                (String::new(), false, false)
            } else {
                (String::new(), false, false)
            };

            Some(IndexedFile {
                location_id: location_id_owned.clone(),
                path: p.to_string_lossy().into_owned(),
                name,
                ext,
                size_bytes: size,
                mtime_ms: mtime,
                content,
                content_truncated,
                has_content,
            })
        })
        .collect();

    let skipped_files = skipped_atomic.load(Ordering::Relaxed);
    let total_bytes = total_bytes_atomic.load(Ordering::Relaxed);
    let errors = errors_mutex.into_inner().unwrap();
    let elapsed_ms = started.elapsed().as_millis() as u64;

    // Update state: replace files của location này
    {
        let mut s = state.lock();
        s.files.retain(|f| f.location_id != location_id);
        s.files.extend(indexed_files.iter().cloned());
        // Update location stats
        if let Some(loc) = s.locations.iter_mut().find(|l| l.id == location_id) {
            loc.last_indexed_at = now_ms();
            loc.indexed_files = indexed_files.len();
            loc.indexed_bytes = total_bytes;
        }
        save_state(&s)?;
    }

    Ok(IndexResult {
        location_id: location_id.to_string(),
        indexed_files: indexed_files.len(),
        skipped_files,
        errors,
        total_bytes,
        elapsed_ms,
        limit_reached,
    })
}

// ---------- Search ----------

#[derive(Debug, Clone, Deserialize)]
pub struct SearchQuery {
    pub query: String,
    /// 'name' | 'content' | 'both'
    pub mode: String,
    /// Lọc theo extension (lowercase, no dot). Empty = tất cả.
    pub extensions: Vec<String>,
    /// 0 = no filter. unix ms.
    pub modified_after_ms: i64,
    pub modified_before_ms: i64,
    /// 0 = no filter
    pub min_size_bytes: u64,
    pub max_size_bytes: u64,
    /// Empty = tất cả locations.
    pub location_ids: Vec<String>,
    /// Cap kết quả trả về.
    pub limit: usize,
}

#[derive(Debug, Serialize)]
pub struct SearchHit {
    pub file: IndexedFile,
    /// Score càng cao càng relevant
    pub score: f32,
    /// Snippet từ content nếu match content
    pub snippet: String,
    /// Match ở đâu: 'name' | 'content' | 'both'
    pub match_in: String,
}

#[derive(Debug, Serialize)]
pub struct SearchResponse {
    pub hits: Vec<SearchHit>,
    pub total_indexed: usize,
    pub elapsed_ms: u64,
}

const SNIPPET_RADIUS: usize = 80;

fn make_snippet(content: &str, match_pos: usize, query: &str) -> String {
    if content.is_empty() {
        return String::new();
    }
    let bytes = content.as_bytes();
    // Tìm boundary char gần nhất để snippet không cắt giữa UTF-8 multi-byte
    let start = match_pos.saturating_sub(SNIPPET_RADIUS);
    let end = (match_pos + query.len() + SNIPPET_RADIUS).min(bytes.len());
    let mut s = start;
    while s > 0 && (bytes[s] & 0xC0) == 0x80 {
        s -= 1;
    }
    let mut e = end;
    while e < bytes.len() && (bytes[e] & 0xC0) == 0x80 {
        e += 1;
    }
    let slice = &content[s..e];
    let prefix = if s > 0 { "…" } else { "" };
    let suffix = if e < bytes.len() { "…" } else { "" };
    format!("{prefix}{}{suffix}", slice.replace('\n', " "))
}

#[tauri::command]
fn search(
    state: tauri::State<'_, SharedState>,
    q: SearchQuery,
) -> SearchResponse {
    let started = std::time::Instant::now();
    let s = state.lock();
    let files = s.files.clone();
    drop(s);

    let total_indexed = files.len();
    let needle = q.query.trim().to_lowercase();
    let limit = if q.limit == 0 { 200 } else { q.limit };

    let search_name = q.mode == "name" || q.mode == "both";
    let search_content = q.mode == "content" || q.mode == "both";

    let ext_filter = !q.extensions.is_empty();
    let loc_filter = !q.location_ids.is_empty();

    let mut hits: Vec<SearchHit> = Vec::new();

    for f in &files {
        // Filter location
        if loc_filter && !q.location_ids.contains(&f.location_id) {
            continue;
        }
        // Filter ext
        if ext_filter && !q.extensions.iter().any(|x| x == &f.ext) {
            continue;
        }
        // Filter mtime
        if q.modified_after_ms > 0 && f.mtime_ms < q.modified_after_ms {
            continue;
        }
        if q.modified_before_ms > 0 && f.mtime_ms > q.modified_before_ms {
            continue;
        }
        // Filter size
        if q.min_size_bytes > 0 && f.size_bytes < q.min_size_bytes {
            continue;
        }
        if q.max_size_bytes > 0 && f.size_bytes > q.max_size_bytes {
            continue;
        }

        if needle.is_empty() {
            // Browse mode: liệt kê tất cả file thoả filter
            hits.push(SearchHit {
                file: f.clone(),
                score: 1.0,
                snippet: String::new(),
                match_in: "browse".into(),
            });
            if hits.len() >= limit {
                break;
            }
            continue;
        }

        // Match name
        let name_lower = f.name.to_lowercase();
        let name_match = search_name && name_lower.contains(&needle);
        let mut name_score = 0.0f32;
        if name_match {
            // Boost: exact match > prefix > substring
            if name_lower == needle {
                name_score = 100.0;
            } else if name_lower.starts_with(&needle) {
                name_score = 50.0;
            } else {
                name_score = 20.0;
            }
            // Penalty cho file dài (rule of thumb)
            name_score -= (name_lower.len() as f32) * 0.05;
        }

        // Match content
        let mut content_score = 0.0f32;
        let mut snippet = String::new();
        if search_content && f.has_content && !f.content.is_empty() {
            let content_lower = f.content.to_lowercase();
            if let Some(pos) = content_lower.find(&needle) {
                content_score = 10.0;
                // Đếm số lần xuất hiện cho score (cap 50)
                let count = content_lower.matches(&needle).count().min(50);
                content_score += count as f32 * 0.5;
                snippet = make_snippet(&f.content, pos, &needle);
            }
        }

        let score = name_score + content_score;
        if score == 0.0 {
            continue;
        }

        let match_in = if name_match && content_score > 0.0 {
            "both"
        } else if name_match {
            "name"
        } else {
            "content"
        };

        hits.push(SearchHit {
            file: f.clone(),
            score,
            snippet,
            match_in: match_in.into(),
        });
    }

    // Sort by score desc, mtime desc
    hits.sort_by(|a, b| {
        b.score
            .partial_cmp(&a.score)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then_with(|| b.file.mtime_ms.cmp(&a.file.mtime_ms))
    });
    hits.truncate(limit);

    SearchResponse {
        hits,
        total_indexed,
        elapsed_ms: started.elapsed().as_millis() as u64,
    }
}

// ---------- Open file / open containing folder ----------

#[tauri::command]
async fn open_file(
    app: tauri::AppHandle,
    path: String,
) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    app.opener()
        .open_path(&path, None::<&str>)
        .map_err(|e| format!("open file: {e}"))
}

#[tauri::command]
async fn open_containing_folder(
    app: tauri::AppHandle,
    path: String,
) -> Result<(), String> {
    let p = PathBuf::from(&path);
    let parent = p.parent().ok_or_else(|| "Không có folder cha".to_string())?;
    use tauri_plugin_opener::OpenerExt;
    app.opener()
        .open_path(parent.to_string_lossy().as_ref(), None::<&str>)
        .map_err(|e| format!("open folder: {e}"))
}

// ============================================================
// Layer 3 — OCR settings + frontend integration commands
// ============================================================

#[derive(Debug, Serialize)]
pub struct OcrStatus {
    pub enabled: bool,
    pub languages: String,
}

#[tauri::command]
fn get_ocr_status(state: tauri::State<'_, SharedState>) -> OcrStatus {
    let s = state.lock();
    OcrStatus {
        enabled: s.ocr.enabled,
        languages: s.ocr.languages.clone(),
    }
}

#[tauri::command]
fn set_ocr_settings(
    state: tauri::State<'_, SharedState>,
    enabled: bool,
    languages: String,
) -> Result<(), String> {
    let mut s = state.lock();
    s.ocr.enabled = enabled;
    if !languages.is_empty() {
        s.ocr.languages = languages;
    }
    save_state(&s)?;
    Ok(())
}

/// Frontend gọi để đọc bytes của file (PDF/image) → feed vào Tesseract.js / PDF.js.
/// Cap 100MB tránh OOM webview.
#[tauri::command]
async fn read_file_bytes(path: String) -> Result<Vec<u8>, String> {
    let p = PathBuf::from(&path);
    if !p.exists() || !p.is_file() {
        return Err(format!("File không tồn tại: {}", path));
    }
    let meta = fs::metadata(&p).map_err(|e| format!("stat: {e}"))?;
    if meta.len() > 100 * 1024 * 1024 {
        return Err("File > 100MB, không OCR được".into());
    }
    fs::read(&p).map_err(|e| format!("read: {e}"))
}

/// Frontend gọi sau khi OCR xong để inject text vào index.
#[tauri::command]
fn update_file_ocr(
    state: tauri::State<'_, SharedState>,
    path: String,
    content: String,
) -> Result<(), String> {
    let mut s = state.lock();
    let mut found = false;
    let truncated = content.len() >= MAX_CONTENT_BYTES as usize;
    let truncated_content = if truncated {
        let (s, _) = truncate_utf8(content.clone(), MAX_CONTENT_BYTES as usize);
        s
    } else {
        content.clone()
    };
    for f in s.files.iter_mut() {
        if f.path == path {
            f.has_content = !truncated_content.is_empty();
            f.content = truncated_content.clone();
            f.content_truncated = truncated;
            found = true;
            break;
        }
    }
    if !found {
        return Err(format!("File chưa có trong index: {}", path));
    }
    save_state(&s)?;
    Ok(())
}

/// List tất cả file PDF/ảnh chưa có content (candidates cho bulk OCR).
#[tauri::command]
fn list_ocr_candidates(state: tauri::State<'_, SharedState>) -> Vec<IndexedFile> {
    let s = state.lock();
    s.files
        .iter()
        .filter(|f| !f.has_content && is_ocr_candidate_ext(&f.ext))
        .cloned()
        .collect()
}

// ============================================================
// Phase 17.3 — App version + Update check
// ============================================================

#[tauri::command]
fn app_version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}

#[tauri::command]
async fn fetch_text(url: String) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .user_agent(concat!("TrishSearch/", env!("CARGO_PKG_VERSION")))
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
            pre_scan_location,
            index_location,
            search,
            open_file,
            open_containing_folder,
            get_ocr_status,
            set_ocr_settings,
            read_file_bytes,
            update_file_ocr,
            list_ocr_candidates,
            app_version,
            fetch_text,
        ])
        .run(tauri::generate_context!())
        .expect("error while running TrishSearch");
}
