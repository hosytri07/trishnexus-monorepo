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

const FONT_EXTENSIONS: &[&str] = &["ttf", "otf", "ttc", "otc"];

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            scan_fonts,
            read_font,
            app_version
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
