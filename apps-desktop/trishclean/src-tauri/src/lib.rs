//! TrishClean — Tauri 2 backend (Phase 17.1).
//!
//! Safety-first approach:
//! - `scan_dir` đọc metadata, KHÔNG open file content.
//! - Classification logic delegated cho TS (`@trishteam/core/clean`)
//!   — Rust chỉ trả raw entries.
//! - Hard limits (max_entries, max_depth) để tránh user pick nhầm `/`
//!   treo UI.
//! - Staged delete: `move_to_trash` chuyển file vào staging dir (không xoá thực).
//!   Manifest JSON ghi nguồn gốc để `restore_session` khôi phục.
//!   `purge_old_sessions(7)` xoá vĩnh viễn các session > 7 ngày.

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use walkdir::WalkDir;

const TRASH_DIRNAME: &str = "trash";
const APP_SUBDIR: &str = "TrishClean";
const MANIFEST_FILE: &str = "_manifest.json";

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

// ============================================================
// Phase 17.1.b — Quick-pick presets cho Windows
// ============================================================

#[derive(Debug, Serialize)]
pub struct CleanPreset {
    pub id: String,
    pub label: String,
    pub description: String,
    pub path: String,
    pub exists: bool,
    pub icon: String,
}

/// Trả ra danh sách preset path mặc định cho Windows.
///
/// SAFETY: Mọi preset đều trỏ tới folder CACHE THUẦN do app tạo ra,
/// không động vào USER DATA / SETTINGS. App sẽ tự re-create cache khi cần.
///
/// Bỏ những preset nguy hiểm hoặc cần admin:
/// - Recycle Bin (cần SHEmptyRecycleBin API)
/// - C:\Windows\Logs/Prefetch/Minidump (cần admin)
/// - Spotify Storage (đó là offline tracks user đã download — KHÔNG phải rác)
#[tauri::command]
fn list_clean_presets() -> Vec<CleanPreset> {
    let mut presets: Vec<CleanPreset> = Vec::new();

    let local_data = dirs::data_local_dir();
    let _roaming = dirs::data_dir();
    let temp_dir = std::env::temp_dir();

    // ===== AutoCAD junk (đặc biệt — dùng scan_autocad_junk command) =====

    // 0. AutoCAD junk files — path dùng marker "<autocad>" để frontend nhận biết
    // và gọi scan_autocad_junk thay vì scan_dir.
    let autocad_path = if let Some(d) = dirs::document_dir() {
        d.to_string_lossy().into_owned()
    } else {
        "C:\\Users".into()
    };
    presets.push(CleanPreset {
        id: "autocad_junk".into(),
        label: "AutoCAD Junk Files".into(),
        description: "File rác AutoCAD: .bak, .sv$, .dwl/.dwl2, .ac$, .err, .dmp — KHÔNG mất .dwg".into(),
        path: format!("<autocad>::{}", autocad_path),
        exists: true,
        icon: "📐".into(),
    });

    // ===== System cache (an toàn — Windows tự tạo lại) =====

    // 1. Windows Temp (%TEMP%) — file tạm các app, OS tự dọn được
    presets.push(CleanPreset {
        id: "windows_temp".into(),
        label: "Temp Windows".into(),
        description: "File tạm của OS + apps (%TEMP%) — an toàn 100%".into(),
        path: temp_dir.to_string_lossy().into_owned(),
        exists: temp_dir.exists(),
        icon: "🗂".into(),
    });

    // 2. AppData Local Temp (nếu khác %TEMP%)
    if let Some(ld) = &local_data {
        let p = ld.join("Temp");
        if p.exists() && p != temp_dir {
            presets.push(CleanPreset {
                id: "appdata_local_temp".into(),
                label: "AppData Local Temp".into(),
                description: "File tạm app trong AppData\\Local\\Temp — an toàn".into(),
                path: p.to_string_lossy().into_owned(),
                exists: true,
                icon: "📦".into(),
            });
        }
    }

    // 3. Thumbnails cache — Windows tự tạo lại khi cần
    if let Some(ld) = &local_data {
        let p = ld.join("Microsoft/Windows/Explorer");
        if p.exists() {
            presets.push(CleanPreset {
                id: "thumbnails_cache".into(),
                label: "Thumbnails Cache".into(),
                description: "Cache thumbnail Explorer (Windows tự re-build)".into(),
                path: p.to_string_lossy().into_owned(),
                exists: true,
                icon: "🖼".into(),
            });
        }
    }

    // ===== Browser caches (an toàn — không động vào cookies/login) =====
    // Path = .../Default/Cache (cache thuần), KHÔNG phải .../Default/ (chứa
    // Cookies, Login Data, Bookmarks, History — đó là user data quan trọng)

    if let Some(ld) = &local_data {
        // 4. Chrome Cache
        let p = ld.join("Google/Chrome/User Data/Default/Cache");
        if p.exists() {
            presets.push(CleanPreset {
                id: "chrome_cache".into(),
                label: "Chrome Cache".into(),
                description: "Chỉ cache hình/JS/CSS Chrome — KHÔNG mất cookies/bookmarks".into(),
                path: p.to_string_lossy().into_owned(),
                exists: true,
                icon: "🌐".into(),
            });
        }

        // 5. Edge Cache
        let p = ld.join("Microsoft/Edge/User Data/Default/Cache");
        if p.exists() {
            presets.push(CleanPreset {
                id: "edge_cache".into(),
                label: "Edge Cache".into(),
                description: "Chỉ cache Edge — KHÔNG mất cookies/bookmarks".into(),
                path: p.to_string_lossy().into_owned(),
                exists: true,
                icon: "🌊".into(),
            });
        }

        // 6. Brave Cache
        let p = ld.join("BraveSoftware/Brave-Browser/User Data/Default/Cache");
        if p.exists() {
            presets.push(CleanPreset {
                id: "brave_cache".into(),
                label: "Brave Cache".into(),
                description: "Chỉ cache Brave — KHÔNG mất cookies/bookmarks".into(),
                path: p.to_string_lossy().into_owned(),
                exists: true,
                icon: "🦁".into(),
            });
        }

        // 7. Opera Cache
        let p = ld.join("Opera Software/Opera Stable/Cache");
        if p.exists() {
            presets.push(CleanPreset {
                id: "opera_cache".into(),
                label: "Opera Cache".into(),
                description: "Chỉ cache Opera — KHÔNG mất cookies/bookmarks".into(),
                path: p.to_string_lossy().into_owned(),
                exists: true,
                icon: "🎭".into(),
            });
        }
    }

    // ===== Apps cache (an toàn — chỉ media/temp, không phải data thực) =====

    if let Some(ld) = &local_data {
        // 8. Discord cache (hình + sticker preview, không phải tin nhắn)
        let p = ld.join("../Roaming/discord/Cache");
        if p.exists() {
            presets.push(CleanPreset {
                id: "discord_cache".into(),
                label: "Discord Cache".into(),
                description: "Chỉ cache hình/media — KHÔNG mất tin nhắn/server".into(),
                path: p.to_string_lossy().into_owned(),
                exists: true,
                icon: "💬".into(),
            });
        }

        // 9. VS Code Cache (extension cache, không phải settings/projects)
        let vsc_cache = ld.join("../Roaming/Code/Cache");
        let vsc_cdata = ld.join("../Roaming/Code/CachedData");
        if vsc_cache.exists() {
            presets.push(CleanPreset {
                id: "vscode_cache".into(),
                label: "VS Code Cache".into(),
                description: "Cache extension VSCode — KHÔNG mất settings/projects".into(),
                path: vsc_cache.to_string_lossy().into_owned(),
                exists: true,
                icon: "📝".into(),
            });
        }
        if vsc_cdata.exists() {
            presets.push(CleanPreset {
                id: "vscode_cached_data".into(),
                label: "VS Code Cached Data".into(),
                description: "Cached data VSCode — KHÔNG mất settings".into(),
                path: vsc_cdata.to_string_lossy().into_owned(),
                exists: true,
                icon: "📝".into(),
            });
        }

        // 10. Teams cache
        let p = ld.join("../Roaming/Microsoft/Teams/Cache");
        if p.exists() {
            presets.push(CleanPreset {
                id: "teams_cache".into(),
                label: "Microsoft Teams Cache".into(),
                description: "Chỉ cache media — KHÔNG mất chat history".into(),
                path: p.to_string_lossy().into_owned(),
                exists: true,
                icon: "👥".into(),
            });
        }

        // 11. NVIDIA shader cache (driver tự re-build)
        let p = ld.join("NVIDIA/DXCache");
        if p.exists() {
            presets.push(CleanPreset {
                id: "nvidia_cache".into(),
                label: "NVIDIA DX Cache".into(),
                description: "Cache shader DirectX — driver tự re-build".into(),
                path: p.to_string_lossy().into_owned(),
                exists: true,
                icon: "🎮".into(),
            });
        }

        // 12. DirectX shader cache (Windows tự re-build)
        let p = ld.join("D3DSCache");
        if p.exists() {
            presets.push(CleanPreset {
                id: "d3d_cache".into(),
                label: "DirectX Shader Cache".into(),
                description: "Cache shader DirectX — Windows tự re-build".into(),
                path: p.to_string_lossy().into_owned(),
                exists: true,
                icon: "🎯".into(),
            });
        }

        // 13. npm cache (dev tool, an toàn — npm tự re-download)
        let p = ld.join("../Roaming/npm-cache");
        if p.exists() {
            presets.push(CleanPreset {
                id: "npm_cache".into(),
                label: "npm Cache".into(),
                description: "Cache packages npm — npm tự download lại khi cần".into(),
                path: p.to_string_lossy().into_owned(),
                exists: true,
                icon: "📦".into(),
            });
        }

        // 14. pip cache (Python dev)
        let p = ld.join("pip/cache");
        if p.exists() {
            presets.push(CleanPreset {
                id: "pip_cache".into(),
                label: "pip Cache".into(),
                description: "Cache packages pip — pip tự download lại".into(),
                path: p.to_string_lossy().into_owned(),
                exists: true,
                icon: "🐍".into(),
            });
        }
    }

    presets
}

// ============================================================
// Phase 17.1.c — Staged delete + restore + purge
// ============================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrashItem {
    pub original_path: String,
    pub trash_relative: String,
    pub size_bytes: u64,
    pub is_dir: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TrashManifest {
    pub session_id: String,
    pub label: String,
    pub created_at_ms: u64,
    pub items: Vec<TrashItem>,
    pub total_size_bytes: u64,
}

#[derive(Debug, Serialize)]
pub struct MoveToTrashResult {
    pub session_id: String,
    pub session_dir: String,
    pub items_moved: usize,
    pub total_size_bytes: u64,
    pub errors: Vec<String>,
}

fn trash_root() -> Result<PathBuf, String> {
    let mut d = dirs::data_local_dir()
        .or_else(dirs::data_dir)
        .or_else(dirs::home_dir)
        .ok_or_else(|| "Không tìm được local data dir".to_string())?;
    d.push("TrishTEAM");
    d.push(APP_SUBDIR);
    d.push(TRASH_DIRNAME);
    if !d.exists() {
        fs::create_dir_all(&d)
            .map_err(|e| format!("Không tạo được trash dir: {e}"))?;
    }
    Ok(d)
}

/// Tạo session_id dạng "YYYYMMDD-HHMMSS-NNN".
/// Đơn giản, không cần uuid crate.
fn make_session_id() -> String {
    let now = std::time::SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    // Format: <millis>-<rand>
    let rand_part = (now & 0xFFFF) as u16;
    format!("{}-{:04x}", now, rand_part)
}

/// Encode original path → relative trash path an toàn + UNIQUE.
/// Format: `<hash16hex>_<truncated_safe_path>`.
/// Hash prefix tránh collision khi 2 path encode giống nhau.
fn encode_path_for_trash(original: &Path) -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    let s = original.to_string_lossy();
    let mut hasher = DefaultHasher::new();
    s.hash(&mut hasher);
    let hash = hasher.finish();
    let safe: String = s
        .chars()
        .map(|c| match c {
            ':' | '\\' | '/' | '*' | '?' | '"' | '<' | '>' | '|' => '_',
            _ => c,
        })
        .collect();
    // Truncate path part để tránh exceed Windows MAX_PATH (260)
    let truncated: String = safe.chars().take(120).collect();
    format!("{:016x}_{}", hash, truncated)
}

/// Walk parent directories upward và remove nếu rỗng.
/// Stop khi gặp dir non-empty hoặc dir nằm ngoài `boundary`.
fn remove_empty_parents(start: &Path, boundary: &Path) {
    let mut current = start.parent();
    while let Some(p) = current {
        if !p.starts_with(boundary) {
            break;
        }
        if p == boundary {
            break;
        }
        // Try remove dir if empty (remove_dir fails if non-empty — safe)
        if fs::remove_dir(p).is_err() {
            break; // non-empty or permission denied → stop walking up
        }
        current = p.parent();
    }
}

/// Move 1 file/dir vào trash. Try fs::rename trước (atomic), fallback copy+remove.
fn move_one(src: &Path, dst: &Path) -> Result<u64, String> {
    if let Some(parent) = dst.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("create_dir_all failed: {e}"))?;
        }
    }

    let meta = fs::metadata(src).map_err(|e| format!("metadata: {e}"))?;
    let is_dir = meta.is_dir();
    let mut total_size: u64 = if is_dir { 0 } else { meta.len() };

    // Try atomic rename first
    if fs::rename(src, dst).is_ok() {
        // Recompute size for dirs
        if is_dir {
            total_size = compute_dir_size(dst);
        }
        return Ok(total_size);
    }

    // Fallback: copy + remove (for cross-volume moves)
    if is_dir {
        copy_dir_recursive(src, dst).map_err(|e| format!("copy_dir: {e}"))?;
        fs::remove_dir_all(src).map_err(|e| format!("remove_dir_all: {e}"))?;
        total_size = compute_dir_size(dst);
    } else {
        fs::copy(src, dst).map_err(|e| format!("copy: {e}"))?;
        fs::remove_file(src).map_err(|e| format!("remove_file: {e}"))?;
    }

    Ok(total_size)
}

fn copy_dir_recursive(src: &Path, dst: &Path) -> std::io::Result<()> {
    fs::create_dir_all(dst)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let ty = entry.file_type()?;
        let from = entry.path();
        let to = dst.join(entry.file_name());
        if ty.is_dir() {
            copy_dir_recursive(&from, &to)?;
        } else if ty.is_file() {
            fs::copy(&from, &to)?;
        }
    }
    Ok(())
}

fn compute_dir_size(p: &Path) -> u64 {
    let mut total: u64 = 0;
    for entry in WalkDir::new(p).follow_links(false).into_iter().flatten() {
        if let Ok(meta) = entry.metadata() {
            if meta.is_file() {
                total = total.saturating_add(meta.len());
            }
        }
    }
    total
}

/// Move N file/folder vào trash session mới.
/// `paths`: danh sách đường dẫn tuyệt đối.
/// `label`: nhãn để user nhận diện (ví dụ "Quick Clean - Temp").
/// `cleanup_root`: optional — nếu set, sau khi move các file, walk parent dirs
///                 nằm dưới `cleanup_root` và remove empty dirs (giải quyết
///                 issue folder rỗng còn sót sau Quick Clean).
#[tauri::command]
fn move_to_trash(
    paths: Vec<String>,
    label: String,
    cleanup_root: Option<String>,
) -> Result<MoveToTrashResult, String> {
    if paths.is_empty() {
        return Err("Danh sách rỗng".into());
    }
    let trash = trash_root()?;
    let session_id = make_session_id();
    let session_dir = trash.join(&session_id);
    fs::create_dir_all(&session_dir)
        .map_err(|e| format!("create session dir: {e}"))?;
    let files_dir = session_dir.join("files");
    fs::create_dir_all(&files_dir)
        .map_err(|e| format!("create files dir: {e}"))?;

    let mut items: Vec<TrashItem> = Vec::new();
    let mut errors: Vec<String> = Vec::new();
    let mut total_size: u64 = 0;
    let mut moved_paths: Vec<PathBuf> = Vec::new();

    for p in &paths {
        let src = Path::new(p);
        if !src.exists() {
            errors.push(format!("Skip (not found): {}", p));
            continue;
        }
        let encoded = encode_path_for_trash(src);
        let dst = files_dir.join(&encoded);
        let is_dir = src.is_dir();
        match move_one(src, &dst) {
            Ok(size) => {
                total_size = total_size.saturating_add(size);
                moved_paths.push(src.to_path_buf());
                items.push(TrashItem {
                    original_path: p.clone(),
                    trash_relative: format!("files/{}", encoded),
                    size_bytes: size,
                    is_dir,
                });
            }
            Err(e) => {
                errors.push(format!("Move fail {}: {}", p, e));
            }
        }
    }

    // Phase 17.1.h — Cleanup empty parent dirs sau khi move
    if let Some(root_str) = cleanup_root {
        let root = PathBuf::from(&root_str);
        if root.exists() && root.is_dir() {
            for moved in &moved_paths {
                remove_empty_parents(moved, &root);
            }
        }
    }

    let manifest = TrashManifest {
        session_id: session_id.clone(),
        label,
        created_at_ms: std::time::SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0),
        items: items.clone(),
        total_size_bytes: total_size,
    };
    let manifest_path = session_dir.join(MANIFEST_FILE);
    let manifest_json = serde_json::to_string_pretty(&manifest)
        .map_err(|e| format!("serialize manifest: {e}"))?;
    fs::write(&manifest_path, manifest_json)
        .map_err(|e| format!("write manifest: {e}"))?;

    Ok(MoveToTrashResult {
        session_id,
        session_dir: session_dir.to_string_lossy().into_owned(),
        items_moved: items.len(),
        total_size_bytes: total_size,
        errors,
    })
}

/// List tất cả trash session hiện có (sort mới → cũ).
#[tauri::command]
fn list_trash_sessions() -> Result<Vec<TrashManifest>, String> {
    let trash = trash_root()?;
    let mut sessions: Vec<TrashManifest> = Vec::new();
    for entry in fs::read_dir(&trash).map_err(|e| format!("read_dir trash: {e}"))? {
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let manifest_path = path.join(MANIFEST_FILE);
        if !manifest_path.exists() {
            continue;
        }
        match fs::read_to_string(&manifest_path) {
            Ok(s) => {
                if let Ok(m) = serde_json::from_str::<TrashManifest>(&s) {
                    sessions.push(m);
                }
            }
            Err(_) => continue,
        }
    }
    sessions.sort_by(|a, b| b.created_at_ms.cmp(&a.created_at_ms));
    Ok(sessions)
}

/// Restore tất cả file của 1 session về vị trí cũ.
#[tauri::command]
fn restore_session(session_id: String) -> Result<usize, String> {
    let trash = trash_root()?;
    let session_dir = trash.join(&session_id);
    if !session_dir.exists() {
        return Err(format!("Session không tồn tại: {}", session_id));
    }
    let manifest_path = session_dir.join(MANIFEST_FILE);
    let manifest_json = fs::read_to_string(&manifest_path)
        .map_err(|e| format!("read manifest: {e}"))?;
    let manifest: TrashManifest = serde_json::from_str(&manifest_json)
        .map_err(|e| format!("parse manifest: {e}"))?;

    let mut restored: usize = 0;
    let mut errors: Vec<String> = Vec::new();
    for item in &manifest.items {
        let src = session_dir.join(&item.trash_relative);
        let dst = Path::new(&item.original_path);
        if dst.exists() {
            errors.push(format!(
                "Skip (đã có file ở đích): {}",
                item.original_path
            ));
            continue;
        }
        if !src.exists() {
            errors.push(format!("Skip (trash file mất): {}", item.original_path));
            continue;
        }
        match move_one(&src, dst) {
            Ok(_) => restored += 1,
            Err(e) => errors.push(format!("Restore fail {}: {}", item.original_path, e)),
        }
    }
    // Sau restore, xoá session dir nếu rỗng (manifest còn → giữ tracking)
    // Đơn giản: xoá full session dir để không hiển thị trong list nữa.
    if errors.is_empty() {
        let _ = fs::remove_dir_all(&session_dir);
    }
    if !errors.is_empty() {
        return Err(format!(
            "Restore {} items, có {} lỗi: {}",
            restored,
            errors.len(),
            errors.join("; ")
        ));
    }
    Ok(restored)
}

/// Xóa thực sự 1 session (không khôi phục được).
#[tauri::command]
fn purge_session(session_id: String) -> Result<(), String> {
    let trash = trash_root()?;
    let session_dir = trash.join(&session_id);
    if !session_dir.exists() {
        return Err(format!("Session không tồn tại: {}", session_id));
    }
    fs::remove_dir_all(&session_dir).map_err(|e| format!("remove: {e}"))?;
    Ok(())
}

/// Auto-purge sessions > N ngày tuổi.
/// Default 7 ngày. Trả số session đã purge.
#[tauri::command]
fn purge_old_sessions(retention_days: Option<u64>) -> Result<usize, String> {
    let days = retention_days.unwrap_or(7);
    let cutoff_ms = std::time::SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
        .saturating_sub(days * 24 * 60 * 60 * 1000);

    let sessions = list_trash_sessions()?;
    let mut purged: usize = 0;
    for s in sessions {
        if s.created_at_ms < cutoff_ms {
            if purge_session(s.session_id).is_ok() {
                purged += 1;
            }
        }
    }
    Ok(purged)
}

// ============================================================
// Phase 17.1.i — AutoCAD junk file scan
// ============================================================

/// Đuôi file rác đặc trưng của AutoCAD/Autodesk products.
/// Tất cả đều SAFE để xoá (app tự re-create khi cần):
/// - .bak  : Backup mỗi save (thường = số .dwg → gấp đôi storage)
/// - .sv$  : AutoSave file (recovery khi crash, sau khi user save thành công thì rác)
/// - .dwl  : Drawing Lock file (lock khi mở .dwg). Orphan = AutoCAD crashed.
/// - .dwl2 : Drawing Lock 2 (Civil 3D, AutoCAD 2015+). Orphan rác.
/// - .ac$  : Temp file AutoCAD R12 era (vẫn còn bị tạo trong 1 số case)
/// - .err  : Error log (lỗi script LISP, plot fail, ...)
/// - .dmp  : Crash dump (chỉ Autodesk dev cần, user xoá được)
/// - .log  : Adlmint.log, FXCM.log (Autodesk specific) — em filter theo path
const AUTOCAD_JUNK_EXTS: &[&str] = &[
    "bak", "sv$", "dwl", "dwl2", "ac$", "err", "dmp",
];

/// Scan các folder phổ biến tìm file rác AutoCAD.
/// Roots: Documents, Downloads, Desktop, AppData\Local\Autodesk, AppData\Roaming\Autodesk.
#[tauri::command]
fn scan_autocad_junk() -> Result<ScanStats, String> {
    let mut roots: Vec<PathBuf> = Vec::new();
    if let Some(d) = dirs::document_dir() { roots.push(d); }
    if let Some(d) = dirs::download_dir() { roots.push(d); }
    if let Some(d) = dirs::desktop_dir() { roots.push(d); }
    if let Some(d) = dirs::data_local_dir() {
        let autodesk = d.join("Autodesk");
        if autodesk.exists() { roots.push(autodesk); }
    }
    if let Some(d) = dirs::data_dir() {
        let autodesk = d.join("Autodesk");
        if autodesk.exists() { roots.push(autodesk); }
    }

    let started = std::time::Instant::now();
    let mut all_entries: Vec<RawEntry> = Vec::new();
    let mut total_size_bytes: u64 = 0;
    let mut errors: u32 = 0;
    let cap = 50_000usize;

    'outer: for root in &roots {
        if !root.exists() { continue; }
        for entry_result in WalkDir::new(root)
            .max_depth(10)
            .follow_links(false)
            .into_iter()
        {
            if all_entries.len() >= cap {
                break 'outer;
            }
            let entry = match entry_result {
                Ok(e) => e,
                Err(_) => {
                    errors = errors.saturating_add(1);
                    continue;
                }
            };
            if !entry.file_type().is_file() { continue; }

            let path = entry.path();
            let ext_lower = path
                .extension()
                .and_then(|e| e.to_str())
                .map(|s| s.to_ascii_lowercase())
                .unwrap_or_default();

            // Match common junk extensions
            let is_junk_ext = AUTOCAD_JUNK_EXTS.contains(&ext_lower.as_str());

            // Hoặc: AutoCAD-specific log files (adlmint.log, FXCM.log)
            let fname = entry
                .file_name()
                .to_string_lossy()
                .to_ascii_lowercase();
            let is_autodesk_log = ext_lower == "log"
                && (fname.starts_with("adlmint")
                    || fname.starts_with("fxcm")
                    || fname.contains("autocad"));

            // .tmp inside Autodesk folder only (avoid touching other apps' .tmp)
            let in_autodesk = path
                .components()
                .any(|c| c.as_os_str().to_string_lossy().eq_ignore_ascii_case("Autodesk"));
            let is_autodesk_tmp = ext_lower == "tmp" && in_autodesk;

            if !is_junk_ext && !is_autodesk_log && !is_autodesk_tmp { continue; }

            let meta = match entry.metadata() {
                Ok(m) => m,
                Err(_) => {
                    errors = errors.saturating_add(1);
                    continue;
                }
            };
            let size = meta.len();
            total_size_bytes = total_size_bytes.saturating_add(size);

            all_entries.push(RawEntry {
                path: path.to_string_lossy().into_owned(),
                size_bytes: size,
                modified_at_ms: to_epoch_ms(meta.modified().ok()),
                accessed_at_ms: to_epoch_ms(meta.accessed().ok()),
                is_dir: false,
            });
        }
    }

    Ok(ScanStats {
        entries: all_entries,
        total_size_bytes,
        truncated: false,
        elapsed_ms: started.elapsed().as_millis(),
        errors,
    })
}

// ============================================================
// Phase 17.1.h — Disk usage info
// ============================================================

#[derive(Debug, Serialize)]
pub struct DiskInfo {
    pub mount: String,
    pub total_bytes: u64,
    pub free_bytes: u64,
    pub used_bytes: u64,
    pub used_percent: f64,
}

/// Trả thông tin disk của drive chứa user home (Windows: C:, Linux/macOS: /).
/// Dùng GetDiskFreeSpaceExW trên Windows qua std::fs metadata is unreliable.
/// Implementation: shell out to `wmic` (Windows) / `df` (Unix) — đơn giản, không
/// add native dep nặng.
#[tauri::command]
fn disk_usage() -> Result<DiskInfo, String> {
    let home = dirs::home_dir().ok_or_else(|| "no home dir".to_string())?;
    // Used trên Unix branch — Windows dùng drive letter riêng.
    #[allow(unused_variables)]
    let mount_str = home.to_string_lossy().into_owned();

    #[cfg(target_os = "windows")]
    {
        let drive = home
            .components()
            .next()
            .map(|c| c.as_os_str().to_string_lossy().into_owned())
            .unwrap_or_else(|| "C:".into());
        let drive_letter = drive.chars().next().unwrap_or('C');
        // PowerShell oneliner: lấy total + free của drive
        let ps_cmd = format!(
            "Get-PSDrive -Name {} | Select-Object @{{N='Total';E={{$_.Used + $_.Free}}}}, Free | ConvertTo-Json -Compress",
            drive_letter
        );
        let output = std::process::Command::new("powershell")
            .args(["-NoProfile", "-NonInteractive", "-Command", &ps_cmd])
            .output()
            .map_err(|e| format!("ps fail: {e}"))?;
        if !output.status.success() {
            return Err(format!(
                "ps exit: {}",
                String::from_utf8_lossy(&output.stderr)
            ));
        }
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let v: serde_json::Value =
            serde_json::from_str(&stdout).map_err(|e| format!("parse json: {e}"))?;
        let total = v.get("Total").and_then(|x| x.as_u64()).unwrap_or(0);
        let free = v.get("Free").and_then(|x| x.as_u64()).unwrap_or(0);
        let used = total.saturating_sub(free);
        let used_pct = if total > 0 {
            (used as f64 / total as f64) * 100.0
        } else {
            0.0
        };
        return Ok(DiskInfo {
            mount: format!("{}:\\", drive_letter),
            total_bytes: total,
            free_bytes: free,
            used_bytes: used,
            used_percent: used_pct,
        });
    }

    #[cfg(not(target_os = "windows"))]
    {
        // Unix: df -k <home>
        let output = std::process::Command::new("df")
            .args(["-k", &mount_str])
            .output()
            .map_err(|e| format!("df fail: {e}"))?;
        let stdout = String::from_utf8_lossy(&output.stdout);
        let lines: Vec<&str> = stdout.lines().collect();
        if lines.len() < 2 {
            return Err("df output unexpected".into());
        }
        let parts: Vec<&str> = lines[1].split_whitespace().collect();
        if parts.len() < 4 {
            return Err("df parse fail".into());
        }
        let total_kb: u64 = parts[1].parse().unwrap_or(0);
        let used_kb: u64 = parts[2].parse().unwrap_or(0);
        let free_kb: u64 = parts[3].parse().unwrap_or(0);
        let total = total_kb * 1024;
        let used = used_kb * 1024;
        let free = free_kb * 1024;
        let used_pct = if total > 0 {
            (used as f64 / total as f64) * 100.0
        } else {
            0.0
        };
        return Ok(DiskInfo {
            mount: mount_str,
            total_bytes: total,
            free_bytes: free,
            used_bytes: used,
            used_percent: used_pct,
        });
    }
}

#[tauri::command]
fn app_version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}

#[tauri::command]
async fn fetch_text(url: String) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .user_agent(concat!("TrishClean/", env!("CARGO_PKG_VERSION")))
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
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            scan_dir,
            scan_autocad_junk,
            list_clean_presets,
            move_to_trash,
            list_trash_sessions,
            restore_session,
            purge_session,
            purge_old_sessions,
            disk_usage,
            app_version,
            fetch_text,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
