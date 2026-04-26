//! TrishNote Rust backend — Phase 17.2.
//!
//! Per-UID JSON store cho local notes (10 MiB cap).
//! Logic notes (validate/review/kanban) ở `@trishteam/core/notes`.

use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};

const MAX_STORE_BYTES: u64 = 10 * 1024 * 1024;
const DEFAULT_STORE_FILENAME: &str = "notes.json";
const APP_SUBDIR: &str = "TrishNote";

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

fn default_store_dir() -> Result<PathBuf, String> {
    let mut d = dirs::data_local_dir()
        .or_else(dirs::data_dir)
        .or_else(dirs::home_dir)
        .ok_or_else(|| "Không tìm được local data dir".to_string())?;
    d.push("TrishTEAM");
    d.push(APP_SUBDIR);
    Ok(d)
}

/// Resolve store path. Phase 17.2 — chấp nhận:
///   - None → default `notes.json` trong default dir
///   - Some absolute path → dùng nguyên
///   - Some relative filename (vd "notes.{uid}.json") → đặt trong default dir
fn resolve_store_path(custom: Option<String>) -> Result<PathBuf, String> {
    if let Some(c) = custom {
        let trimmed = c.trim();
        if !trimmed.is_empty() {
            let p = PathBuf::from(trimmed);
            if p.is_absolute() {
                return Ok(p);
            }
            // Sanitize: chỉ alphanumeric + dot + dash + underscore
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
fn load_notes(path: Option<String>) -> Result<LoadResult, String> {
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

// ============================================================
// Phase 17.2 v3 — Attachments (file copy + open local path)
// File user attach vào note sẽ được copy vào:
//   %LOCALAPPDATA%\TrishTEAM\TrishNote\attachments\{uid}\{noteId}\{filename}
// — KHÔNG nằm trong cache/temp folder để TrishClean không coi là rác.
// ============================================================

#[derive(Debug, Serialize)]
pub struct AttachResult {
    pub stored_path: String,
    pub size_bytes: u64,
    pub original_name: String,
}

fn attachments_root(uid: &str, note_id: &str) -> Result<PathBuf, String> {
    let safe_uid: String = uid.chars().filter(|c| c.is_ascii_alphanumeric()).collect();
    let safe_note: String = note_id
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '_' || *c == '-')
        .collect();
    if safe_uid.is_empty() || safe_note.is_empty() {
        return Err("Invalid uid/noteId".into());
    }
    let mut d = default_store_dir()?;
    d.push("attachments");
    d.push(&safe_uid);
    d.push(&safe_note);
    Ok(d)
}

/// Copy file user pick vào attachments dir của note. Trả path mới + metadata.
#[tauri::command]
fn attach_file(
    uid: String,
    note_id: String,
    source_path: String,
) -> Result<AttachResult, String> {
    let src = PathBuf::from(&source_path);
    if !src.exists() || !src.is_file() {
        return Err(format!("Source không tồn tại hoặc không phải file: {}", source_path));
    }
    let meta = fs::metadata(&src).map_err(|e| format!("metadata: {e}"))?;
    let size = meta.len();
    if size > 100 * 1024 * 1024 {
        return Err(format!(
            "File quá lớn ({} MB). Cap 100 MB. Dùng 'Gắn link' thay attach.",
            size / 1024 / 1024
        ));
    }

    let dest_dir = attachments_root(&uid, &note_id)?;
    fs::create_dir_all(&dest_dir).map_err(|e| format!("create dir: {e}"))?;

    let original_name = src
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| "untitled".into());

    // Tránh collision: nếu file cùng tên đã tồn tại, append timestamp
    let mut dest = dest_dir.join(&original_name);
    if dest.exists() {
        let stem = src
            .file_stem()
            .map(|s| s.to_string_lossy().into_owned())
            .unwrap_or_else(|| "file".into());
        let ext = src
            .extension()
            .map(|s| format!(".{}", s.to_string_lossy()))
            .unwrap_or_default();
        let ts = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis())
            .unwrap_or(0);
        dest = dest_dir.join(format!("{}_{}.{}", stem, ts, ext.trim_start_matches('.')));
    }

    fs::copy(&src, &dest).map_err(|e| format!("copy fail: {e}"))?;

    Ok(AttachResult {
        stored_path: dest.to_string_lossy().into_owned(),
        size_bytes: size,
        original_name,
    })
}

/// Xoá file đã attach (chỉ trong attachments dir, sanity check).
#[tauri::command]
fn remove_attached_file(stored_path: String) -> Result<(), String> {
    let p = PathBuf::from(&stored_path);
    let root = default_store_dir()?;
    let attach_root = root.join("attachments");
    if !p.starts_with(&attach_root) {
        return Err("Chỉ được xoá file trong attachments dir".into());
    }
    if !p.exists() {
        return Ok(()); // already gone
    }
    fs::remove_file(&p).map_err(|e| format!("remove: {e}"))?;
    Ok(())
}

#[tauri::command]
fn save_notes(path: Option<String>, content: String) -> Result<SaveResult, String> {
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

// ============================================================
// Phase 17.2 v4 — List system fonts (Windows-installed fonts)
// Scan C:\Windows\Fonts + per-user fonts dir, derive family names.
// ============================================================

fn clean_font_family(stem: &str) -> String {
    // Strip common style/weight suffixes so multiple variants of the same
    // family collapse to one entry. Run repeatedly to catch combos
    // (e.g. "Arial-BoldItalic" → "Arial").
    const SUFFIXES: &[&str] = &[
        " Bold", " Italic", " Light", " Regular", " Medium", " Black",
        " Thin", " ExtraLight", " SemiBold", " ExtraBold", " Heavy",
        " Oblique", " Condensed", " Narrow", " Wide", " Display",
        "-Bold", "-Italic", "-Light", "-Regular", "-Medium", "-Black",
        "-Thin", "-ExtraLight", "-SemiBold", "-ExtraBold", "-Heavy",
        "-Oblique", "-Condensed", "-Narrow", "-Wide", "-Display",
        "BoldItalic", "BoldOblique", "Bold", "Italic", "Oblique",
        "Light", "Regular", "Medium", "Black", "Thin", "SemiBold",
        "ExtraBold", "ExtraLight", "Condensed", "Narrow",
    ];
    let mut name = stem.replace('_', " ").trim().to_string();
    let mut changed = true;
    while changed {
        changed = false;
        for suf in SUFFIXES {
            // Match suffix as a whole token (case-sensitive — Windows font
            // filenames follow PascalCase convention).
            if name.ends_with(suf) && name.len() > suf.len() {
                name = name[..name.len() - suf.len()].trim().to_string();
                changed = true;
            }
        }
        // Trim trailing dashes/spaces left behind
        while name.ends_with('-') || name.ends_with(' ') {
            name.pop();
        }
    }
    name.trim().to_string()
}

#[tauri::command]
fn list_system_fonts() -> Result<Vec<String>, String> {
    let mut families = std::collections::BTreeSet::<String>::new();

    let mut dirs_to_scan: Vec<PathBuf> = Vec::new();
    #[cfg(target_os = "windows")]
    {
        dirs_to_scan.push(PathBuf::from(r"C:\Windows\Fonts"));
        if let Some(local) = dirs::data_local_dir() {
            dirs_to_scan.push(local.join("Microsoft").join("Windows").join("Fonts"));
        }
    }
    #[cfg(target_os = "macos")]
    {
        dirs_to_scan.push(PathBuf::from("/System/Library/Fonts"));
        dirs_to_scan.push(PathBuf::from("/Library/Fonts"));
        if let Some(home) = dirs::home_dir() {
            dirs_to_scan.push(home.join("Library").join("Fonts"));
        }
    }
    #[cfg(target_os = "linux")]
    {
        dirs_to_scan.push(PathBuf::from("/usr/share/fonts"));
        dirs_to_scan.push(PathBuf::from("/usr/local/share/fonts"));
        if let Some(home) = dirs::home_dir() {
            dirs_to_scan.push(home.join(".fonts"));
            dirs_to_scan.push(home.join(".local").join("share").join("fonts"));
        }
    }

    fn walk_collect(dir: &Path, out: &mut std::collections::BTreeSet<String>, depth: u32) {
        if depth > 4 || !dir.exists() {
            return;
        }
        let Ok(entries) = fs::read_dir(dir) else {
            return;
        };
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                walk_collect(&path, out, depth + 1);
                continue;
            }
            let ext = path
                .extension()
                .and_then(|s| s.to_str())
                .unwrap_or("")
                .to_ascii_lowercase();
            if !matches!(ext.as_str(), "ttf" | "otf" | "ttc" | "woff" | "woff2") {
                continue;
            }
            let stem = path
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("");
            let family = clean_font_family(stem);
            // Filter junk: too short, all digits, weird chars
            if family.len() < 2 {
                continue;
            }
            if family.chars().all(|c| c.is_ascii_digit()) {
                continue;
            }
            out.insert(family);
        }
    }

    for d in &dirs_to_scan {
        walk_collect(d, &mut families, 0);
    }

    if families.is_empty() {
        // Fallback: web-safe stack so UI doesn't break
        return Ok(vec![
            "Arial".into(),
            "Calibri".into(),
            "Cambria".into(),
            "Consolas".into(),
            "Courier New".into(),
            "Georgia".into(),
            "Segoe UI".into(),
            "Tahoma".into(),
            "Times New Roman".into(),
            "Verdana".into(),
        ]);
    }

    Ok(families.into_iter().collect())
}

// ============================================================
// Phase 17.2 — App version + Update check
// ============================================================

#[tauri::command]
fn app_version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}

#[tauri::command]
async fn fetch_text(url: String) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .user_agent(concat!("TrishNote/", env!("CARGO_PKG_VERSION")))
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
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            default_store_location,
            load_notes,
            save_notes,
            attach_file,
            remove_attached_file,
            list_system_fonts,
            app_version,
            fetch_text,
        ])
        .run(tauri::generate_context!())
        .expect("error while running TrishNote");
}
