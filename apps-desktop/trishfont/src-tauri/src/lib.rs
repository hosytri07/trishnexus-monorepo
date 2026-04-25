//! TrishFont — Tauri 2 backend.
//!
//! Safety-first approach:
//! - `scan_fonts` / `read_font` chỉ **đọc** font file — không cài vào OS.
//! - Phân loại personality delegated cho TS (`@trishteam/core/fonts`) —
//!   Rust chỉ trả raw metadata từ TTF name table + OS/2.
//! - Hard limit `max_entries` để tránh user pick nhầm folder khổng lồ.
//! - Alpha chỉ scan + preview (font bytes load qua plugin-fs vào
//!   `FontFace` bên JS). Không command nào install/uninstall font.

use serde::Serialize;
use std::fs;
use std::path::Path;
use ttf_parser::{name_id, Face, Weight, Width};
use walkdir::WalkDir;

#[derive(Debug, Serialize, Default)]
pub struct FontMeta {
    pub path: String,
    pub family: String,
    pub subfamily: String,
    pub full_name: String,
    pub postscript_name: String,
    pub weight: u16,
    pub width: u16,
    pub italic: bool,
    pub monospace: bool,
    pub vn_support: bool,
    pub glyph_count: u16,
    pub size_bytes: u64,
}

#[derive(Debug, Serialize, Default)]
pub struct ScanFontsStats {
    pub entries: Vec<FontMeta>,
    pub truncated: bool,
    pub elapsed_ms: u128,
    pub errors: u32,
}

// Phase 15.1.k — thêm .shx (AutoCAD shape font) cho Cài font thủ công.
// scan_system_fonts vẫn ok vì Windows fonts dir không có .shx.
const FONT_EXTENSIONS: &[&str] = &["ttf", "otf", "ttc", "otc", "shx"];

/// Subset diacritic tiếng Việt phổ biến — đủ để quyết định font có
/// dùng được cho tiếng Việt hay không. Nếu font có đủ các char này,
/// coi như support (approximation).
const VN_CHECK_CHARS: &[char] = &[
    'à', 'á', 'ả', 'ã', 'ạ', 'ă', 'ằ', 'ắ', 'ặ', 'â', 'ấ', 'ầ', 'ậ', 'đ',
    'ê', 'ề', 'ế', 'ệ', 'ơ', 'ờ', 'ớ', 'ợ', 'ư', 'ừ', 'ứ', 'ự',
];

fn weight_to_u16(w: Weight) -> u16 {
    match w {
        Weight::Thin => 100,
        Weight::ExtraLight => 200,
        Weight::Light => 300,
        Weight::Normal => 400,
        Weight::Medium => 500,
        Weight::SemiBold => 600,
        Weight::Bold => 700,
        Weight::ExtraBold => 800,
        Weight::Black => 900,
        Weight::Other(v) => v,
    }
}

fn width_to_u16(w: Width) -> u16 {
    match w {
        Width::UltraCondensed => 1,
        Width::ExtraCondensed => 2,
        Width::Condensed => 3,
        Width::SemiCondensed => 4,
        Width::Normal => 5,
        Width::SemiExpanded => 6,
        Width::Expanded => 7,
        Width::ExtraExpanded => 8,
        Width::UltraExpanded => 9,
    }
}

fn find_name(face: &Face, target_id: u16) -> String {
    // Prefer English (language_id=0x0409) if exists, else first non-empty.
    let mut fallback: Option<String> = None;
    for name in face.names() {
        if name.name_id != target_id {
            continue;
        }
        if let Some(s) = name.to_string() {
            if name.language_id == 0x0409 {
                return s;
            }
            if fallback.is_none() {
                fallback = Some(s);
            }
        }
    }
    fallback.unwrap_or_default()
}

fn check_vn_support(face: &Face) -> bool {
    // Require at least 80% of check chars có glyph — conservative.
    let mut hits = 0usize;
    for &ch in VN_CHECK_CHARS {
        if face.glyph_index(ch).is_some() {
            hits += 1;
        }
    }
    let threshold = (VN_CHECK_CHARS.len() as f32 * 0.8) as usize;
    hits >= threshold
}

fn parse_font_bytes(path: &Path, bytes: &[u8]) -> Result<FontMeta, String> {
    let face = Face::parse(bytes, 0).map_err(|e| format!("parse: {}", e))?;
    let family = find_name(&face, name_id::FAMILY);
    let subfamily = find_name(&face, name_id::SUBFAMILY);
    let full_name = find_name(&face, name_id::FULL_NAME);
    let postscript_name = find_name(&face, name_id::POST_SCRIPT_NAME);
    let weight = weight_to_u16(face.weight());
    let width = width_to_u16(face.width());
    let italic = face.is_italic();
    let monospace = face.is_monospaced();
    let glyph_count = face.number_of_glyphs();
    let vn_support = check_vn_support(&face);
    let size_bytes = bytes.len() as u64;
    Ok(FontMeta {
        path: path.to_string_lossy().into_owned(),
        family,
        subfamily,
        full_name,
        postscript_name,
        weight,
        width,
        italic,
        monospace,
        vn_support,
        glyph_count,
        size_bytes,
    })
}

#[tauri::command]
async fn read_font(path: String) -> Result<FontMeta, String> {
    let p = Path::new(&path);
    let bytes = fs::read(p).map_err(|e| format!("read: {}", e))?;
    parse_font_bytes(p, &bytes)
}

/// Scan folder → liệt kê font file + parse metadata. Cap
/// `max_entries` clamp 10..10 000 (default 2 000).
#[tauri::command]
async fn scan_fonts(
    dir: String,
    max_entries: Option<usize>,
) -> Result<ScanFontsStats, String> {
    let cap = max_entries.unwrap_or(2_000).clamp(10, 10_000);
    let root = Path::new(&dir);
    if !root.exists() {
        return Err(format!("Không tìm thấy: {}", dir));
    }
    if !root.is_dir() {
        return Err(format!("Không phải thư mục: {}", dir));
    }

    let started = std::time::Instant::now();
    let mut entries: Vec<FontMeta> = Vec::new();
    let mut errors: u32 = 0;
    let mut truncated = false;

    for entry in WalkDir::new(root)
        .max_depth(8)
        .follow_links(false)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        if entries.len() >= cap {
            truncated = true;
            break;
        }
        let p = entry.path();
        if !p.is_file() {
            continue;
        }
        let ext = match p.extension().and_then(|x| x.to_str()) {
            Some(e) => e.to_ascii_lowercase(),
            None => continue,
        };
        if !FONT_EXTENSIONS.contains(&ext.as_str()) {
            continue;
        }
        // Phase 15.1.k — .shx không phải OpenType, ttf-parser fail.
        // Tạo stub FontMeta từ filename để hiện trong list + cài AutoCAD.
        if ext == "shx" {
            let size_bytes = fs::metadata(p).map(|m| m.len()).unwrap_or(0);
            let stem = p
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("?")
                .to_string();
            entries.push(FontMeta {
                path: p.to_string_lossy().into_owned(),
                family: stem.clone(),
                subfamily: "AutoCAD .shx".to_string(),
                full_name: stem.clone(),
                postscript_name: stem,
                weight: 400,
                width: 5,
                italic: false,
                monospace: false,
                vn_support: false,
                glyph_count: 0,
                size_bytes,
            });
            continue;
        }
        match fs::read(p) {
            Ok(bytes) => match parse_font_bytes(p, &bytes) {
                Ok(meta) => entries.push(meta),
                Err(_) => errors = errors.saturating_add(1),
            },
            Err(_) => errors = errors.saturating_add(1),
        }
    }

    Ok(ScanFontsStats {
        entries,
        truncated,
        elapsed_ms: started.elapsed().as_millis(),
        errors,
    })
}

#[tauri::command]
fn app_version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}

// ============================================================
// Phase 15.1.c — Scan system fonts (Windows fonts dirs)
// ============================================================

/// Scan tất cả font đã cài: C:\Windows\Fonts (system-wide) +
/// %LOCALAPPDATA%\Microsoft\Windows\Fonts (per-user). Hợp nhất 2 folder.
#[tauri::command]
async fn scan_system_fonts(
    max_entries: Option<usize>,
) -> Result<ScanFontsStats, String> {
    let cap = max_entries.unwrap_or(2_000).clamp(10, 10_000);
    let started = std::time::Instant::now();
    let mut entries: Vec<FontMeta> = Vec::new();
    let mut errors: u32 = 0;
    let mut truncated = false;

    let dirs = system_font_dirs();
    'outer: for dir in dirs {
        if !dir.exists() {
            continue;
        }
        for entry in WalkDir::new(&dir)
            .max_depth(2)
            .follow_links(false)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            if entries.len() >= cap {
                truncated = true;
                break 'outer;
            }
            let p = entry.path();
            if !p.is_file() {
                continue;
            }
            let ext = match p.extension().and_then(|x| x.to_str()) {
                Some(e) => e.to_ascii_lowercase(),
                None => continue,
            };
            if !FONT_EXTENSIONS.contains(&ext.as_str()) {
                continue;
            }
            match fs::read(p) {
                Ok(bytes) => match parse_font_bytes(p, &bytes) {
                    Ok(meta) => entries.push(meta),
                    Err(_) => errors = errors.saturating_add(1),
                },
                Err(_) => errors = errors.saturating_add(1),
            }
        }
    }

    Ok(ScanFontsStats {
        entries,
        truncated,
        elapsed_ms: started.elapsed().as_millis(),
        errors,
    })
}

#[cfg(target_os = "windows")]
fn system_font_dirs() -> Vec<std::path::PathBuf> {
    let mut dirs = Vec::new();
    if let Ok(windir) = std::env::var("WINDIR") {
        dirs.push(std::path::PathBuf::from(windir).join("Fonts"));
    } else {
        dirs.push(std::path::PathBuf::from("C:\\Windows\\Fonts"));
    }
    if let Ok(localappdata) = std::env::var("LOCALAPPDATA") {
        dirs.push(
            std::path::PathBuf::from(localappdata)
                .join("Microsoft")
                .join("Windows")
                .join("Fonts"),
        );
    }
    dirs
}

#[cfg(target_os = "macos")]
fn system_font_dirs() -> Vec<std::path::PathBuf> {
    let mut dirs = Vec::new();
    dirs.push(std::path::PathBuf::from("/Library/Fonts"));
    dirs.push(std::path::PathBuf::from("/System/Library/Fonts"));
    if let Ok(home) = std::env::var("HOME") {
        dirs.push(std::path::PathBuf::from(home).join("Library").join("Fonts"));
    }
    dirs
}

#[cfg(target_os = "linux")]
fn system_font_dirs() -> Vec<std::path::PathBuf> {
    let mut dirs = Vec::new();
    dirs.push(std::path::PathBuf::from("/usr/share/fonts"));
    dirs.push(std::path::PathBuf::from("/usr/local/share/fonts"));
    if let Ok(home) = std::env::var("HOME") {
        dirs.push(std::path::PathBuf::from(home).join(".fonts"));
        dirs.push(
            std::path::PathBuf::from(home)
                .join(".local")
                .join("share")
                .join("fonts"),
        );
    }
    dirs
}

#[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
fn system_font_dirs() -> Vec<std::path::PathBuf> {
    Vec::new()
}

// ============================================================
// Phase 15.1.b — Install font (Windows per-user, no admin)
// ============================================================
//
// Logic port từ Python apps/trishfont/modules/install/worker.py:
// - Copy font file vào %LOCALAPPDATA%\Microsoft\Windows\Fonts\
// - Write registry HKCU\Software\Microsoft\Windows NT\CurrentVersion\Fonts
//   value "{Family} (TrueType)" → file path absolute
// - Broadcast WM_FONTCHANGE để app khác nhận biết font mới
// - Per-user install KHÔNG cần admin (so với HKLM all-users)

#[derive(Debug, Serialize)]
pub struct InstallResult {
    pub path: String,
    pub family: String,
    pub success: bool,
    pub message: String,
}

#[tauri::command]
async fn install_fonts(paths: Vec<String>) -> Result<Vec<InstallResult>, String> {
    let mut results = Vec::with_capacity(paths.len());
    for path in &paths {
        let result = install_single(path).unwrap_or_else(|e| InstallResult {
            path: path.clone(),
            family: String::new(),
            success: false,
            message: e,
        });
        results.push(result);
    }

    // Broadcast WM_FONTCHANGE 1 lần sau khi cài hết
    #[cfg(target_os = "windows")]
    if results.iter().any(|r| r.success) {
        broadcast_font_change();
    }

    Ok(results)
}

fn install_single(path: &str) -> Result<InstallResult, String> {
    let src_path = Path::new(path);
    if !src_path.exists() {
        return Err(format!("File không tồn tại: {path}"));
    }

    // 1. Đọc font + lấy family name
    let bytes = fs::read(src_path).map_err(|e| format!("Đọc file fail: {e}"))?;
    let face = Face::parse(&bytes, 0).map_err(|e| format!("Parse font fail: {e}"))?;
    let family = find_name(&face, name_id::FAMILY);
    let subfamily = find_name(&face, name_id::SUBFAMILY);
    let display_name = if subfamily.is_empty() || subfamily.eq_ignore_ascii_case("Regular") {
        family.clone()
    } else {
        format!("{} {}", family, subfamily)
    };

    if family.is_empty() {
        return Err("Không đọc được tên family".to_string());
    }

    #[cfg(target_os = "windows")]
    {
        install_windows_system_wide(src_path, &display_name)
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err(format!(
            "Cài font chỉ hỗ trợ Windows hiện tại. Family: {family}"
        ))
    }
}

/// Phase 15.1.n — Public command để frontend hiển thị admin badge.
#[tauri::command]
fn is_admin() -> bool {
    #[cfg(target_os = "windows")]
    {
        is_admin_windows()
    }
    #[cfg(not(target_os = "windows"))]
    {
        false
    }
}

/// Phase 15.1.m — Test admin/elevated qua việc thử mở HKLM Fonts subkey
/// với KEY_WRITE. Nếu không admin sẽ fail (HKLM cần elevated).
#[cfg(target_os = "windows")]
fn is_admin_windows() -> bool {
    use winreg::enums::*;
    use winreg::RegKey;
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    hklm.open_subkey_with_flags(
        "SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts",
        KEY_WRITE,
    )
    .is_ok()
}

#[cfg(target_os = "windows")]
fn install_windows_system_wide(
    src: &Path,
    display_name: &str,
) -> Result<InstallResult, String> {
    use std::path::PathBuf;

    if !is_admin_windows() {
        return Err(
            "Cần Administrator: chạy lại app với chuột phải → Run as administrator. Cài font hệ thống cần ghi C:\\Windows\\Fonts + HKLM registry."
                .to_string(),
        );
    }

    let windir = std::env::var("WINDIR").unwrap_or_else(|_| "C:\\Windows".to_string());
    let dest_dir = PathBuf::from(&windir).join("Fonts");
    let file_name = src
        .file_name()
        .ok_or_else(|| "Tên file không hợp lệ".to_string())?;
    let dest_path = dest_dir.join(file_name);

    // Phase 15.1.k/m — read once, write với retry (tránh lock từ Windows font cache)
    let bytes = fs::read(src).map_err(|e| format!("Đọc src fail: {e}"))?;
    write_with_retry(&dest_path, &bytes, 3, 150)?;

    // Write HKLM registry (system-wide, all users)
    let suffix = match src
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase())
        .as_deref()
    {
        Some("otf") => "(OpenType)",
        Some("ttc") | Some("otc") => "(TrueType Collection)",
        _ => "(TrueType)",
    };
    let reg_value_name = format!("{} {}", display_name, suffix);

    use winreg::enums::*;
    use winreg::RegKey;
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    let (key, _) = hklm
        .create_subkey("SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts")
        .map_err(|e| format!("Tạo HKLM fonts key fail: {e}"))?;
    key.set_value(&reg_value_name, &dest_path.to_string_lossy().to_string())
        .map_err(|e| format!("Ghi HKLM registry fail: {e}"))?;

    Ok(InstallResult {
        path: dest_path.to_string_lossy().to_string(),
        family: display_name.to_string(),
        success: true,
        message: format!("Đã cài hệ thống: {}", dest_path.display()),
    })
}

/// Phase 15.1.k — Write bytes vào file với retry logic. Windows file lock
/// (search indexer, antivirus, font cache, FontFace API) thường giải phóng
/// trong vài trăm ms. Retry tránh cài fail oan.
fn write_with_retry(
    dest: &Path,
    bytes: &[u8],
    attempts: u32,
    delay_ms: u64,
) -> Result<(), String> {
    let mut last_err = String::new();
    for i in 0..attempts {
        match fs::write(dest, bytes) {
            Ok(_) => return Ok(()),
            Err(e) => {
                last_err = format!("{e}");
                if i + 1 < attempts {
                    std::thread::sleep(std::time::Duration::from_millis(delay_ms));
                }
            }
        }
    }
    Err(format!(
        "Ghi file fail sau {attempts} retry: {last_err}"
    ))
}

#[cfg(target_os = "windows")]
fn broadcast_font_change() {
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        SendNotifyMessageW, HWND_BROADCAST, WM_FONTCHANGE,
    };
    unsafe {
        SendNotifyMessageW(HWND_BROADCAST, WM_FONTCHANGE, 0, 0);
    }
}

// ============================================================
// Phase 15.1.h — FontPack: fetch manifest + download zip + extract
// ============================================================
//
// Manifest: https://raw.githubusercontent.com/hosytri07/trishnexus-fontpacks/main/manifest.json
// Pack zip: github releases /trishfont-origin-v1.0.0/trishfont-origin.zip
// Local extract: %APPDATA%\TrishFont\packs\<pack_id>\

/// Fetch URL → trả body text (cho manifest.json). Bypass CORS/CSP qua Rust.
#[tauri::command]
async fn fetch_text(url: String) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .user_agent(concat!("TrishFont/", env!("CARGO_PKG_VERSION")))
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

#[derive(Debug, Serialize)]
pub struct PackInstallResult {
    pub pack_id: String,
    pub extract_path: String,
    pub file_count: usize,
    pub bytes_extracted: u64,
}

/// Download zip → verify SHA256 → extract zip-slip safe vào
/// %APPDATA%\TrishFont\packs\<pack_id>\. Trả số file extract + bytes.
#[tauri::command]
async fn download_and_install_pack(
    pack_id: String,
    url: String,
    sha256: String,
) -> Result<PackInstallResult, String> {
    use sha2::{Digest, Sha256};
    use std::io::Cursor;
    use std::io::Read;

    if pack_id.is_empty() || pack_id.contains("..") || pack_id.contains('/') || pack_id.contains('\\') {
        return Err(format!("pack_id không hợp lệ: {pack_id}"));
    }

    // Download
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(300))
        .user_agent(concat!("TrishFont/", env!("CARGO_PKG_VERSION")))
        .redirect(reqwest::redirect::Policy::limited(10))
        .build()
        .map_err(|e| format!("client build: {e}"))?;
    let resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("download fail: {e}"))?;
    if !resp.status().is_success() {
        return Err(format!("HTTP {}", resp.status()));
    }
    let bytes = resp
        .bytes()
        .await
        .map_err(|e| format!("read body: {e}"))?;

    // Verify SHA256
    let mut hasher = Sha256::new();
    hasher.update(&bytes);
    let actual = hex::encode(hasher.finalize());
    let expected = sha256.trim().to_lowercase();
    if !expected.is_empty() && actual.to_lowercase() != expected {
        return Err(format!(
            "SHA256 mismatch — file có thể bị hỏng hoặc tampered. Expected {expected}, got {actual}"
        ));
    }

    // Resolve extract dir
    let appdata = std::env::var("APPDATA")
        .or_else(|_| std::env::var("HOME"))
        .map_err(|_| "Không tìm thấy APPDATA/HOME".to_string())?;
    let base = std::path::PathBuf::from(&appdata)
        .join("TrishFont")
        .join("packs");
    let extract_dir = base.join(&pack_id);
    fs::create_dir_all(&extract_dir).map_err(|e| format!("create dir: {e}"))?;

    // Extract zip-slip safe
    let cursor = Cursor::new(bytes.as_ref());
    let mut zip = zip::ZipArchive::new(cursor)
        .map_err(|e| format!("open zip: {e}"))?;

    let mut file_count = 0usize;
    let mut bytes_extracted = 0u64;

    for i in 0..zip.len() {
        let mut entry = zip
            .by_index(i)
            .map_err(|e| format!("zip entry {i}: {e}"))?;
        let entry_name = entry.name().to_string();

        // Zip-slip protection: enclosed_name() rejects path traversal (.. / abs path)
        let safe_name = match entry.enclosed_name() {
            Some(p) => p.to_owned(),
            None => {
                return Err(format!("zip-slip rejected: {entry_name}"));
            }
        };
        let dest_path = extract_dir.join(&safe_name);

        if entry.is_dir() {
            fs::create_dir_all(&dest_path).map_err(|e| format!("mkdir: {e}"))?;
            continue;
        }
        if let Some(parent) = dest_path.parent() {
            fs::create_dir_all(parent).map_err(|e| format!("mkdir parent: {e}"))?;
        }
        let mut out = fs::File::create(&dest_path)
            .map_err(|e| format!("create file: {e}"))?;
        let mut buf = Vec::new();
        entry
            .read_to_end(&mut buf)
            .map_err(|e| format!("read entry: {e}"))?;
        std::io::Write::write_all(&mut out, &buf)
            .map_err(|e| format!("write: {e}"))?;
        bytes_extracted = bytes_extracted.saturating_add(buf.len() as u64);
        file_count += 1;
    }

    Ok(PackInstallResult {
        pack_id: pack_id.clone(),
        extract_path: extract_dir.to_string_lossy().to_string(),
        file_count,
        bytes_extracted,
    })
}

// ============================================================
// Phase 15.1.i — List pack files + AutoCAD .shx install
// ============================================================

#[derive(Debug, Serialize, Default)]
pub struct PackFileEntry {
    pub path: String,
    pub name: String,
    pub kind: String, // "ttf" | "otf" | "ttc" | "otc" | "shx"
    pub size_bytes: u64,
    /// Phase 15.1.m — Tên folder cha relative từ pack root (vd "TCVN3", "VNI",
    /// "Unicode"). Empty nếu file ở root pack. UI group cards by folder.
    pub folder: String,
}

/// Phase 15.1.j — Xóa pack đã tải (delete folder + ignore errors).
#[tauri::command]
async fn delete_pack(pack_id: String) -> Result<(), String> {
    if pack_id.is_empty() || pack_id.contains("..") || pack_id.contains('/') || pack_id.contains('\\') {
        return Err(format!("pack_id không hợp lệ: {pack_id}"));
    }
    let appdata = std::env::var("APPDATA")
        .or_else(|_| std::env::var("HOME"))
        .map_err(|_| "Không tìm thấy APPDATA".to_string())?;
    let pack_dir = std::path::PathBuf::from(&appdata)
        .join("TrishFont")
        .join("packs")
        .join(&pack_id);
    if pack_dir.exists() {
        fs::remove_dir_all(&pack_dir)
            .map_err(|e| format!("Xóa fail: {e}"))?;
    }
    Ok(())
}

/// List font files trong extracted pack folder (`%APPDATA%\TrishFont\packs\<id>\`).
#[tauri::command]
async fn list_pack_files(pack_id: String) -> Result<Vec<PackFileEntry>, String> {
    if pack_id.is_empty() || pack_id.contains("..") || pack_id.contains('/') || pack_id.contains('\\') {
        return Err(format!("pack_id không hợp lệ: {pack_id}"));
    }
    let appdata = std::env::var("APPDATA")
        .or_else(|_| std::env::var("HOME"))
        .map_err(|_| "Không tìm thấy APPDATA".to_string())?;
    let pack_dir = std::path::PathBuf::from(&appdata)
        .join("TrishFont")
        .join("packs")
        .join(&pack_id);
    if !pack_dir.exists() {
        return Err(format!("Pack chưa được tải: {}", pack_dir.display()));
    }

    let mut entries: Vec<PackFileEntry> = Vec::new();
    for entry in WalkDir::new(&pack_dir)
        .follow_links(false)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let p = entry.path();
        if !p.is_file() {
            continue;
        }
        let ext = match p.extension().and_then(|x| x.to_str()) {
            Some(e) => e.to_ascii_lowercase(),
            None => continue,
        };
        let allowed = ["ttf", "otf", "ttc", "otc", "shx"];
        if !allowed.contains(&ext.as_str()) {
            continue;
        }
        let size_bytes = fs::metadata(p).map(|m| m.len()).unwrap_or(0);
        // Tên folder cha relative từ pack_dir
        let folder = p
            .strip_prefix(&pack_dir)
            .ok()
            .and_then(|rel| rel.parent())
            .and_then(|par| {
                let s = par.to_string_lossy().to_string();
                if s.is_empty() { None } else { Some(s) }
            })
            .unwrap_or_default();
        entries.push(PackFileEntry {
            path: p.to_string_lossy().to_string(),
            name: p
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("?")
                .to_string(),
            kind: ext,
            size_bytes,
            folder,
        });
    }
    entries.sort_by(|a, b| {
        a.folder
            .to_lowercase()
            .cmp(&b.folder.to_lowercase())
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });
    Ok(entries)
}

#[derive(Debug, Serialize)]
pub struct AutoCadInstall {
    pub version: String,
    pub fonts_dir: String,
    pub writable: bool,
}

/// Detect AutoCAD installations via registry (Windows). Trả list versions
/// + đường dẫn Fonts folder + flag writable (test ghi file tạm).
#[tauri::command]
fn detect_autocad_dirs() -> Vec<AutoCadInstall> {
    #[cfg(target_os = "windows")]
    {
        return detect_autocad_windows();
    }
    #[cfg(not(target_os = "windows"))]
    {
        Vec::new()
    }
}

#[cfg(target_os = "windows")]
fn detect_autocad_windows() -> Vec<AutoCadInstall> {
    use winreg::enums::*;
    use winreg::RegKey;

    let mut results: Vec<AutoCadInstall> = Vec::new();

    // Pattern: HKLM\SOFTWARE\Autodesk\AutoCAD\<Rxx.x>\<lang>\AcadLocation
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    let acad = match hklm.open_subkey("SOFTWARE\\Autodesk\\AutoCAD") {
        Ok(k) => k,
        Err(_) => return results,
    };

    for ver_name in acad.enum_keys().flatten() {
        let ver_key = match acad.open_subkey(&ver_name) {
            Ok(k) => k,
            Err(_) => continue,
        };
        // Sub-keys = language IDs (e.g., "ENU", "VNM")
        for lang_name in ver_key.enum_keys().flatten() {
            let lang_key = match ver_key.open_subkey(&lang_name) {
                Ok(k) => k,
                Err(_) => continue,
            };
            let acad_loc: Result<String, _> = lang_key.get_value("AcadLocation");
            if let Ok(acad_path) = acad_loc {
                let fonts_dir = std::path::PathBuf::from(&acad_path).join("Fonts");
                if fonts_dir.exists() {
                    let writable = test_write_access(&fonts_dir);
                    results.push(AutoCadInstall {
                        version: format!("{ver_name} {lang_name}"),
                        fonts_dir: fonts_dir.to_string_lossy().to_string(),
                        writable,
                    });
                }
            }
        }
    }

    // Fallback: scan Program Files\Autodesk\AutoCAD*\Fonts
    if results.is_empty() {
        for prog_var in &["ProgramFiles", "ProgramFiles(x86)"] {
            if let Ok(prog_dir) = std::env::var(prog_var) {
                let autodesk_dir = std::path::PathBuf::from(&prog_dir).join("Autodesk");
                if !autodesk_dir.exists() {
                    continue;
                }
                if let Ok(read_dir) = fs::read_dir(&autodesk_dir) {
                    for entry in read_dir.flatten() {
                        let name = entry.file_name().to_string_lossy().to_string();
                        if name.starts_with("AutoCAD") {
                            let fonts = entry.path().join("Fonts");
                            if fonts.exists() {
                                let writable = test_write_access(&fonts);
                                results.push(AutoCadInstall {
                                    version: name,
                                    fonts_dir: fonts.to_string_lossy().to_string(),
                                    writable,
                                });
                            }
                        }
                    }
                }
            }
        }
    }

    results
}

#[cfg(target_os = "windows")]
fn test_write_access(dir: &std::path::Path) -> bool {
    let probe = dir.join(".trishfont-write-probe.tmp");
    match fs::write(&probe, b"x") {
        Ok(_) => {
            let _ = fs::remove_file(&probe);
            true
        }
        Err(_) => false,
    }
}

#[derive(Debug, Serialize)]
pub struct ShxInstallResult {
    pub path: String,
    pub installed_to: Vec<String>,
    pub success: bool,
    pub message: String,
}

/// Install .shx files vào AutoCAD font folders. Nếu folder không writable
/// (cần admin), fallback sang `%APPDATA%\TrishFont\autocad-shx\` + notify user.
#[tauri::command]
async fn install_shx_fonts(paths: Vec<String>) -> Result<Vec<ShxInstallResult>, String> {
    let mut results: Vec<ShxInstallResult> = Vec::new();
    let acad_installs: Vec<AutoCadInstall> = {
        #[cfg(target_os = "windows")]
        {
            detect_autocad_windows()
        }
        #[cfg(not(target_os = "windows"))]
        {
            Vec::new()
        }
    };
    let writable_acad: Vec<&AutoCadInstall> =
        acad_installs.iter().filter(|a| a.writable).collect();

    // Phase 15.1.m — KHÔNG dùng fallback %APPDATA%. Lý do: user explicit
    // muốn cài thẳng vào C:\Program Files\Autodesk\AutoCAD <ver>\Fonts.
    // Nếu không admin hoặc không có AutoCAD → fail clear (xem dưới).

    for path in &paths {
        let src = std::path::Path::new(path);
        if !src.exists() {
            results.push(ShxInstallResult {
                path: path.clone(),
                installed_to: Vec::new(),
                success: false,
                message: "File không tồn tại".to_string(),
            });
            continue;
        }
        let file_name = match src.file_name() {
            Some(n) => n,
            None => continue,
        };

        // Phase 15.1.k — read once, write nhiều dest. Tránh lock conflict.
        let bytes = match fs::read(src) {
            Ok(b) => b,
            Err(e) => {
                results.push(ShxInstallResult {
                    path: path.clone(),
                    installed_to: Vec::new(),
                    success: false,
                    message: format!("Đọc src fail: {e}"),
                });
                continue;
            }
        };

        let mut installed_to: Vec<String> = Vec::new();
        let mut errors: Vec<String> = Vec::new();

        // Phase 15.1.m — KHÔNG fallback %APPDATA%. Fail clear nếu:
        // - Không có AutoCAD installed → user biết để cài AutoCAD trước
        // - Có AutoCAD nhưng folder không writable → user biết cần admin
        if acad_installs.is_empty() {
            errors.push(
                "Không tìm thấy AutoCAD trên máy. Cài AutoCAD trước rồi chạy lại."
                    .to_string(),
            );
        } else if writable_acad.is_empty() {
            errors.push(format!(
                "AutoCAD Fonts folder không writable (cần Administrator). Phát hiện {} bản: {}",
                acad_installs.len(),
                acad_installs
                    .iter()
                    .map(|a| a.version.as_str())
                    .collect::<Vec<_>>()
                    .join(", ")
            ));
        } else {
            for acad in &writable_acad {
                let dest = std::path::PathBuf::from(&acad.fonts_dir).join(file_name);
                match write_with_retry(&dest, &bytes, 3, 150) {
                    Ok(_) => installed_to.push(dest.to_string_lossy().to_string()),
                    Err(e) => errors.push(format!("{}: {e}", acad.version)),
                }
            }
        }

        let success = !installed_to.is_empty();
        let message = if success {
            format!("Cài AutoCAD: {}", installed_to.join(" · "))
        } else {
            format!("Cài fail: {}", errors.join("; "))
        };

        results.push(ShxInstallResult {
            path: path.clone(),
            installed_to,
            success,
            message,
        });
    }

    Ok(results)
}

// ============================================================
// Phase 15.1.m — Export fonts to user folder (chia sẻ)
// ============================================================

#[derive(Debug, Serialize)]
pub struct ExportResult {
    pub source: String,
    pub dest: String,
    pub success: bool,
    pub message: String,
}

#[tauri::command]
async fn export_fonts_to_folder(
    paths: Vec<String>,
    dest_dir: String,
) -> Result<Vec<ExportResult>, String> {
    let dest_root = std::path::Path::new(&dest_dir);
    if !dest_root.exists() {
        return Err(format!("Folder đích không tồn tại: {dest_dir}"));
    }
    if !dest_root.is_dir() {
        return Err(format!("Không phải folder: {dest_dir}"));
    }

    let mut results = Vec::with_capacity(paths.len());
    for path in &paths {
        let src = Path::new(path);
        let file_name = match src.file_name() {
            Some(n) => n,
            None => {
                results.push(ExportResult {
                    source: path.clone(),
                    dest: String::new(),
                    success: false,
                    message: "Tên file không hợp lệ".to_string(),
                });
                continue;
            }
        };
        let dest_path = dest_root.join(file_name);
        match fs::read(src).and_then(|bytes| fs::write(&dest_path, bytes)) {
            Ok(_) => results.push(ExportResult {
                source: path.clone(),
                dest: dest_path.to_string_lossy().to_string(),
                success: true,
                message: format!("→ {}", dest_path.display()),
            }),
            Err(e) => results.push(ExportResult {
                source: path.clone(),
                dest: String::new(),
                success: false,
                message: format!("Copy fail: {e}"),
            }),
        }
    }
    Ok(results)
}

// ============================================================
// Phase 15.1.o — Settings: Pack folder management
// ============================================================

#[derive(Debug, Serialize)]
pub struct PacksFolderInfo {
    pub path: String,
    pub exists: bool,
    pub total_bytes: u64,
    pub pack_count: usize,
}

fn dir_size(path: &Path) -> u64 {
    let mut total = 0u64;
    if let Ok(entries) = fs::read_dir(path) {
        for entry in entries.flatten() {
            let p = entry.path();
            if p.is_dir() {
                total = total.saturating_add(dir_size(&p));
            } else if let Ok(meta) = entry.metadata() {
                total = total.saturating_add(meta.len());
            }
        }
    }
    total
}

#[tauri::command]
fn get_packs_folder_info() -> Result<PacksFolderInfo, String> {
    let appdata = std::env::var("APPDATA")
        .or_else(|_| std::env::var("HOME"))
        .map_err(|_| "Không tìm thấy APPDATA".to_string())?;
    let packs_dir = std::path::PathBuf::from(&appdata)
        .join("TrishFont")
        .join("packs");

    let exists = packs_dir.exists();
    let mut pack_count = 0;
    let mut total_bytes = 0u64;

    if exists {
        if let Ok(entries) = fs::read_dir(&packs_dir) {
            for entry in entries.flatten() {
                if entry.path().is_dir() {
                    pack_count += 1;
                }
            }
        }
        total_bytes = dir_size(&packs_dir);
    }

    Ok(PacksFolderInfo {
        path: packs_dir.to_string_lossy().to_string(),
        exists,
        total_bytes,
        pack_count,
    })
}

#[tauri::command]
fn clear_all_packs() -> Result<(), String> {
    let appdata = std::env::var("APPDATA")
        .or_else(|_| std::env::var("HOME"))
        .map_err(|_| "Không tìm thấy APPDATA".to_string())?;
    let packs_dir = std::path::PathBuf::from(&appdata)
        .join("TrishFont")
        .join("packs");
    if packs_dir.exists() {
        fs::remove_dir_all(&packs_dir).map_err(|e| format!("Xóa fail: {e}"))?;
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            scan_fonts,
            scan_system_fonts,
            read_font,
            install_fonts,
            fetch_text,
            download_and_install_pack,
            list_pack_files,
            delete_pack,
            detect_autocad_dirs,
            install_shx_fonts,
            export_fonts_to_folder,
            is_admin,
            get_packs_folder_info,
            clear_all_packs,
            app_version
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
