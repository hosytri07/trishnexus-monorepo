//! TrishDesign Rust backend.
//!
//! Phase 14.4 (legacy):
//!   - `default_store_location` → app data dir cho preset/palette local.
//!   - `load_design_file(path)` → đọc JSON DesignTokenSet (cap 8 MiB, validate shape).
//!   - `save_design_file(path, payload)` → atomic write JSON (temp → rename).
//!   - Google OAuth loopback flow.
//!
//! Phase 28.4.E (2026-05-01):
//!   - AutoCAD COM automation: connect → SendCommand từng lệnh AutoCAD vào doc đang mở.
//!
//! Không dùng fs plugin — IO thuần `std::fs` để kiểm soát hard cap.

mod acad_com;

// ============================================================
// Phase 28.4 Turn 10 — Custom hatch pattern (.pat) deployment
// ============================================================
const TRISHTEAM_HATCH_PAT: &str = include_str!("../resources/SRETC_HuHong.pat");
const TRISHTEAM_HATCH_FILENAME: &str = "TrishTEAM_HatchPatterns.pat";

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HatchDeployResult {
    /// Số AutoCAD version đã cài đặt
    pub installed_count: usize,
    /// Danh sách đường dẫn đã ghi
    pub paths: Vec<String>,
    /// Số bytes mỗi file
    pub bytes: u64,
    /// Tóm tắt hiển thị cho user
    pub summary: String,
}

/// Auto-detect AutoCAD support folders + ghi file pattern vào tất cả
/// Scan %APPDATA%\Autodesk\AutoCAD * cho mọi version cài
#[tauri::command]
fn deploy_hatch_patterns() -> Result<HatchDeployResult, String> {
    let appdata = dirs::config_dir()
        .ok_or_else(|| "Không lấy được %APPDATA%".to_string())?;
    let autodesk_root = appdata.join("Autodesk");

    let mut written_paths: Vec<String> = Vec::new();
    let bytes = TRISHTEAM_HATCH_PAT.len() as u64;

    if autodesk_root.exists() {
        // Scan: %APPDATA%\Autodesk\AutoCAD {year}\R{rev}\{lang}\Support\
        if let Ok(entries) = fs::read_dir(&autodesk_root) {
            for entry in entries.flatten() {
                let dir = entry.path();
                let name = entry.file_name().to_string_lossy().to_string();
                if !name.starts_with("AutoCAD") {
                    continue;
                }
                // Recurse vào R{rev}
                if let Ok(subs) = fs::read_dir(&dir) {
                    for sub in subs.flatten() {
                        let rev_dir = sub.path();
                        let rev_name = sub.file_name().to_string_lossy().to_string();
                        if !rev_name.starts_with('R') {
                            continue;
                        }
                        // Recurse vào {lang} (enu, vie, etc.)
                        if let Ok(langs) = fs::read_dir(&rev_dir) {
                            for lang in langs.flatten() {
                                let support = lang.path().join("Support");
                                if support.exists() && support.is_dir() {
                                    let target = support.join(TRISHTEAM_HATCH_FILENAME);
                                    if fs::write(&target, TRISHTEAM_HATCH_PAT).is_ok() {
                                        written_paths.push(target.to_string_lossy().into_owned());
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // Always also write fallback to %APPDATA%\TrishDesign\hatch\
    let fallback_dir = appdata.join("TrishDesign").join("hatch");
    fs::create_dir_all(&fallback_dir)
        .map_err(|e| format!("Tạo folder fallback: {}", e))?;
    let fallback_path = fallback_dir.join(TRISHTEAM_HATCH_FILENAME);
    fs::write(&fallback_path, TRISHTEAM_HATCH_PAT)
        .map_err(|e| format!("Ghi fallback: {}", e))?;
    written_paths.push(fallback_path.to_string_lossy().into_owned());

    let summary = if written_paths.len() > 1 {
        format!(
            "✓ Đã cài đặt {} pattern vào {} folder AutoCAD support.\n\nKhởi động lại AutoCAD để nhận pattern mới.",
            25,
            written_paths.len() - 1, // Exclude fallback
        )
    } else {
        format!(
            "⚠ Không tìm thấy AutoCAD installation trong %APPDATA%.\nĐã ghi fallback vào:\n{}",
            fallback_path.display()
        )
    };

    Ok(HatchDeployResult {
        installed_count: written_paths.len() - 1,
        paths: written_paths,
        bytes,
        summary,
    })
}

// ============================================================
// Phase 28.4 Turn 11 — Scan AutoCAD .shx fonts từ Program Files
// ============================================================

/// Scan tất cả .shx font files trong AutoCAD installation folders
/// Returns vec of font filenames (e.g. ["romans.shx", "simplex.shx", ...])
#[tauri::command]
fn list_autocad_shx_fonts() -> Result<Vec<String>, String> {
    let mut fonts: Vec<String> = Vec::new();

    // Scan Program Files (cả x64 và x86)
    let program_files_paths = [
        std::env::var("ProgramFiles").ok(),
        std::env::var("ProgramFiles(x86)").ok(),
    ];

    for pf in program_files_paths.iter().flatten() {
        let autodesk = std::path::PathBuf::from(pf).join("Autodesk");
        if !autodesk.exists() {
            continue;
        }
        // Scan AutoCAD <year> folders
        if let Ok(entries) = fs::read_dir(&autodesk) {
            for entry in entries.flatten() {
                let dir = entry.path();
                let name = entry.file_name().to_string_lossy().to_string();
                if !name.starts_with("AutoCAD") {
                    continue;
                }
                let fonts_dir = dir.join("Fonts");
                if !fonts_dir.exists() {
                    continue;
                }
                if let Ok(font_entries) = fs::read_dir(&fonts_dir) {
                    for font_entry in font_entries.flatten() {
                        let fname = font_entry.file_name().to_string_lossy().to_lowercase();
                        if fname.ends_with(".shx") {
                            fonts.push(fname);
                        }
                    }
                }
            }
        }
    }

    // Dedupe + sort
    fonts.sort();
    fonts.dedup();
    Ok(fonts)
}

use std::{
    fs::{self, OpenOptions},
    io::Write,
    path::{Path, PathBuf},
};

use serde::{Deserialize, Serialize};

/// Cap tối đa khi đọc/ghi file token — 8 MiB.
const FILE_CAP_BYTES: u64 = 8 * 1024 * 1024;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvLocation {
    pub data_dir: String,
    pub exists: bool,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DesignLoadResult {
    pub path: String,
    pub bytes: u64,
    /// JSON text (utf-8) của file. UI tự parse.
    pub text: String,
    /// True nếu parse được JSON valid (không validate schema).
    pub valid_json: bool,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DesignSaveResult {
    pub path: String,
    pub bytes: u64,
}

#[tauri::command]
fn default_store_location(app: tauri::AppHandle) -> Result<EnvLocation, String> {
    let dir: PathBuf = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Không lấy được app data dir: {e}"))?;
    let exists = dir.exists();
    Ok(EnvLocation {
        data_dir: dir.to_string_lossy().into_owned(),
        exists,
    })
}

#[tauri::command]
fn load_design_file(path: String) -> Result<DesignLoadResult, String> {
    let p = Path::new(&path);
    if !p.exists() {
        return Err(format!("File không tồn tại: {path}"));
    }
    if !p.is_file() {
        return Err(format!("Không phải file: {path}"));
    }
    let meta =
        fs::metadata(p).map_err(|e| format!("Không đọc metadata: {e}"))?;
    let bytes = meta.len();
    if bytes > FILE_CAP_BYTES {
        return Err(format!(
            "File quá lớn ({} MiB) — cap {} MiB",
            bytes / (1024 * 1024),
            FILE_CAP_BYTES / (1024 * 1024)
        ));
    }
    let text =
        fs::read_to_string(p).map_err(|e| format!("Không đọc được file: {e}"))?;
    let valid_json = serde_json::from_str::<serde_json::Value>(&text).is_ok();
    Ok(DesignLoadResult {
        path: p.to_string_lossy().into_owned(),
        bytes,
        text,
        valid_json,
    })
}

#[tauri::command]
fn save_design_file(path: String, payload: String) -> Result<DesignSaveResult, String> {
    let bytes = payload.as_bytes().len() as u64;
    if bytes > FILE_CAP_BYTES {
        return Err(format!(
            "Payload quá lớn ({} MiB) — cap {} MiB",
            bytes / (1024 * 1024),
            FILE_CAP_BYTES / (1024 * 1024)
        ));
    }
    // Validate JSON trước khi ghi.
    if serde_json::from_str::<serde_json::Value>(&payload).is_err() {
        return Err("Payload không phải JSON hợp lệ.".to_string());
    }
    let p = Path::new(&path);
    if let Some(parent) = p.parent() {
        if !parent.as_os_str().is_empty() && !parent.exists() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Không tạo được thư mục: {e}"))?;
        }
    }
    // Atomic write: ghi tempfile rồi rename.
    let tmp = p.with_extension("tmp-tsn");
    {
        let mut f = OpenOptions::new()
            .write(true)
            .create(true)
            .truncate(true)
            .open(&tmp)
            .map_err(|e| format!("Không tạo temp: {e}"))?;
        f.write_all(payload.as_bytes())
            .map_err(|e| format!("Ghi temp lỗi: {e}"))?;
        f.sync_all().ok();
    }
    fs::rename(&tmp, p).map_err(|e| format!("Rename lỗi: {e}"))?;
    Ok(DesignSaveResult {
        path: p.to_string_lossy().into_owned(),
        bytes,
    })
}

// ============================================================
// Phase 14.4.10 — Google OAuth Loopback flow (Desktop OAuth)
// ============================================================

use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use rand::Rng;
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::net::TcpListener;
use std::sync::mpsc;
use std::thread;
use std::time::Duration;
use tiny_http::{Header, Response, Server};

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OAuthLoopbackResult {
    pub code: String,
    pub state: String,
    pub code_verifier: String,
    pub redirect_uri: String,
}

fn rand_string(len: usize) -> String {
    const CHARSET: &[u8] =
        b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    let mut rng = rand::thread_rng();
    (0..len)
        .map(|_| CHARSET[rng.gen_range(0..CHARSET.len())] as char)
        .collect()
}

fn pkce_challenge(verifier: &str) -> String {
    let digest = Sha256::digest(verifier.as_bytes());
    URL_SAFE_NO_PAD.encode(digest)
}

fn parse_query(url: &str) -> HashMap<String, String> {
    let query = url.split('?').nth(1).unwrap_or("");
    let mut map = HashMap::new();
    for pair in query.split('&').filter(|p| !p.is_empty()) {
        if let Some((k, v)) = pair.split_once('=') {
            let key = urlencoding::decode(k).unwrap_or_default().into_owned();
            let val = urlencoding::decode(v).unwrap_or_default().into_owned();
            map.insert(key, val);
        }
    }
    map
}

#[tauri::command]
async fn start_google_oauth_loopback(
    app: tauri::AppHandle,
    client_id: String,
) -> Result<OAuthLoopbackResult, String> {
    use tauri_plugin_opener::OpenerExt;

    // Find a free port
    let port = {
        let listener = TcpListener::bind("127.0.0.1:0")
            .map_err(|e| format!("Bind port lỗi: {e}"))?;
        let port = listener
            .local_addr()
            .map_err(|e| format!("Get port: {e}"))?
            .port();
        drop(listener);
        port
    };

    let state = rand_string(32);
    let code_verifier = rand_string(64);
    let code_challenge = pkce_challenge(&code_verifier);
    let redirect_uri = format!("http://127.0.0.1:{port}");

    // Build Google OAuth URL — Phase 14.4.10 fix: bỏ literal whitespace
    // (Google reject URL có ' ' giữa các param → callback không bao giờ về)
    let auth_url = format!(
        "https://accounts.google.com/o/oauth2/v2/auth\
?client_id={client_id_enc}\
&redirect_uri={redirect_uri_enc}\
&response_type=code\
&scope=openid%20email%20profile\
&state={state}\
&code_challenge={code_challenge}\
&code_challenge_method=S256\
&prompt=select_account\
&access_type=offline",
        client_id_enc = urlencoding::encode(&client_id),
        redirect_uri_enc = urlencoding::encode(&redirect_uri),
        state = state,
        code_challenge = code_challenge,
    );

    // Open URL trong browser ngoài
    app.opener()
        .open_url(&auth_url, None::<&str>)
        .map_err(|e| format!("Mở browser lỗi: {e}"))?;

    // Spawn server thread to catch callback
    let (tx, rx) = mpsc::channel::<HashMap<String, String>>();
    let server_addr = format!("127.0.0.1:{port}");

    thread::spawn(move || {
        let server = match Server::http(&server_addr) {
            Ok(s) => s,
            Err(e) => {
                eprintln!("[oauth] server bind fail: {e}");
                return;
            }
        };
        if let Ok(req) = server.recv() {
            let url = req.url().to_string();
            let params = parse_query(&url);
            let html = "<!DOCTYPE html><html lang=\"vi\"><head><meta charset=\"utf-8\"><title>TrishDesign</title><style>body{font-family:system-ui,Arial;background:#0f0f17;color:#e8e8f0;text-align:center;padding:60px 20px}h2{color:#ff5722;margin:0 0 16px}p{color:#9aa0b4;line-height:1.5}.box{max-width:480px;margin:0 auto;padding:32px;background:#1a1a23;border-radius:12px;border:1px solid rgba(255,87,34,0.3)}</style></head><body><div class=\"box\"><h2>✓ Đăng nhập thành công</h2><p>Bạn có thể đóng tab này và quay lại app TrishDesign.</p><p style=\"font-size:12px;opacity:0.7\">Tab sẽ tự đóng sau 3 giây…</p></div><script>setTimeout(()=>window.close(),3000)</script></body></html>";
            let _ = req.respond(
                Response::from_string(html)
                    .with_header(
                        "Content-Type: text/html; charset=utf-8"
                            .parse::<Header>()
                            .unwrap(),
                    ),
            );
            let _ = tx.send(params);
        }
    });

    // Wait callback (timeout 3 minutes)
    let params = rx
        .recv_timeout(Duration::from_secs(180))
        .map_err(|_| "Timeout 3 phút — chưa nhận được phản hồi từ Google".to_string())?;

    if let Some(err) = params.get("error") {
        let desc = params
            .get("error_description")
            .cloned()
            .unwrap_or_default();
        return Err(format!("Google OAuth lỗi: {err} — {desc}"));
    }

    let received_state = params
        .get("state")
        .ok_or("Thiếu state token trong callback")?;
    if received_state != &state {
        return Err("State token không khớp (CSRF protection)".to_string());
    }

    let code = params
        .get("code")
        .ok_or("Thiếu authorization code trong callback")?
        .clone();

    Ok(OAuthLoopbackResult {
        code,
        state,
        code_verifier,
        redirect_uri,
    })
}

// ============================================================
// Phase 28.4 Turn 18 — Save arbitrary bytes file (cho Excel export)
// ============================================================
/// Ghi `bytes` thẳng vào `path` user đã chọn qua save dialog.
/// Cap 32 MiB để tránh ghi nhầm file khổng lồ.
#[tauri::command]
fn save_file_bytes(path: String, bytes: Vec<u8>) -> Result<u64, String> {
    const CAP: usize = 32 * 1024 * 1024;
    if bytes.len() > CAP {
        return Err(format!(
            "File quá lớn ({} bytes > cap {} MiB)",
            bytes.len(),
            CAP / (1024 * 1024)
        ));
    }
    let target = PathBuf::from(&path);
    // Tạo parent dir nếu thiếu
    if let Some(parent) = target.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent).map_err(|e| format!("Tạo folder: {}", e))?;
        }
    }
    let n = bytes.len() as u64;
    fs::write(&target, &bytes).map_err(|e| format!("Ghi file: {}", e))?;
    Ok(n)
}

// ============================================================
// Phase 28.5 — AutoLISP Manager: read/write acaddoc.lsp + read .lsp files
// ============================================================

/// Read file as UTF-8 text (cap 4 MiB).
#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
    let p = PathBuf::from(&path);
    if !p.exists() {
        return Err(format!("File không tồn tại: {}", path));
    }
    let meta = fs::metadata(&p).map_err(|e| format!("Stat file: {}", e))?;
    if meta.len() > 4 * 1024 * 1024 {
        return Err(format!("File quá lớn ({} bytes > 4 MiB)", meta.len()));
    }
    fs::read_to_string(&p).map_err(|e| format!("Đọc file: {}", e))
}

/// Tìm tất cả file acaddoc.lsp trong %APPDATA%\Autodesk\AutoCAD * folders.
/// Returns list of paths.
#[tauri::command]
fn find_acaddoc_paths() -> Result<Vec<String>, String> {
    let appdata = dirs::config_dir().ok_or_else(|| "Không lấy được %APPDATA%".to_string())?;
    let autodesk_root = appdata.join("Autodesk");
    let mut paths: Vec<String> = Vec::new();
    if !autodesk_root.exists() {
        return Ok(paths);
    }
    if let Ok(entries) = fs::read_dir(&autodesk_root) {
        for entry in entries.flatten() {
            let dir = entry.path();
            let name = entry.file_name().to_string_lossy().to_string();
            if !name.starts_with("AutoCAD") { continue; }
            if let Ok(subs) = fs::read_dir(&dir) {
                for sub in subs.flatten() {
                    let rev_dir = sub.path();
                    let rev_name = sub.file_name().to_string_lossy().to_string();
                    if !rev_name.starts_with('R') { continue; }
                    if let Ok(langs) = fs::read_dir(&rev_dir) {
                        for lang in langs.flatten() {
                            let support = lang.path().join("Support");
                            if support.exists() {
                                let target = support.join("acaddoc.lsp");
                                paths.push(target.to_string_lossy().into_owned());
                            }
                        }
                    }
                }
            }
        }
    }
    Ok(paths)
}

/// Append (load "path") line vào acaddoc.lsp của tất cả AutoCAD versions.
/// Skip nếu đã có line đó. Returns số file đã update.
#[tauri::command]
fn register_lisp_autoload(lsp_path: String) -> Result<usize, String> {
    let acaddoc_paths: Vec<String> = find_acaddoc_paths()?;
    if acaddoc_paths.is_empty() {
        return Err("Không tìm thấy AutoCAD Support folder. Mở AutoCAD ít nhất 1 lần để khởi tạo.".to_string());
    }
    // Escape backslashes cho LISP string
    let escaped = lsp_path.replace('\\', "/");
    let load_line = format!("(load \"{}\")", escaped);
    let mut count: usize = 0;
    for p in &acaddoc_paths {
        let target = PathBuf::from(p);
        // Read current
        let mut content = if target.exists() {
            fs::read_to_string(&target).unwrap_or_default()
        } else {
            String::new()
        };
        // Skip nếu đã có line load này
        if content.contains(&load_line) { continue; }
        if !content.is_empty() && !content.ends_with('\n') {
            content.push('\n');
        }
        content.push_str(&format!("; TrishDesign auto-load\n{}\n", load_line));
        // Tạo parent dir nếu thiếu
        if let Some(parent) = target.parent() {
            let _ = fs::create_dir_all(parent);
        }
        if fs::write(&target, content).is_ok() {
            count += 1;
        }
    }
    Ok(count)
}

/// Remove (load "path") line từ tất cả acaddoc.lsp.
#[tauri::command]
fn unregister_lisp_autoload(lsp_path: String) -> Result<usize, String> {
    let acaddoc_paths: Vec<String> = find_acaddoc_paths()?;
    let escaped = lsp_path.replace('\\', "/");
    let load_line = format!("(load \"{}\")", escaped);
    let mut count: usize = 0;
    for p in &acaddoc_paths {
        let target = PathBuf::from(p);
        if !target.exists() { continue; }
        let content = fs::read_to_string(&target).unwrap_or_default();
        if !content.contains(&load_line) { continue; }
        let new_content: String = content
            .lines()
            .filter(|l| !l.contains(&load_line) && !l.trim().eq("; TrishDesign auto-load"))
            .collect::<Vec<_>>()
            .join("\n");
        if fs::write(&target, new_content).is_ok() {
            count += 1;
        }
    }
    Ok(count)
}

// ============================================================
// Phase 28.7 — Scan folder for .lsp/.fas/.vlx files
// ============================================================
#[tauri::command]
fn scan_folder_lsp(folder: String) -> Result<Vec<String>, String> {
    let p = PathBuf::from(&folder);
    if !p.is_dir() { return Err(format!("Không phải folder: {}", folder)); }
    let mut paths: Vec<String> = Vec::new();
    fn walk(dir: &Path, paths: &mut Vec<String>, depth: u32) {
        if depth > 5 { return; }
        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    walk(&path, paths, depth + 1);
                } else if let Some(ext) = path.extension() {
                    let e = ext.to_string_lossy().to_lowercase();
                    if e == "lsp" || e == "fas" || e == "vlx" {
                        paths.push(path.to_string_lossy().into_owned());
                    }
                }
            }
        }
    }
    walk(&p, &mut paths, 0);
    paths.sort();
    Ok(paths)
}

// ============================================================
// Phase 28.7 — Groq Cloud (free tier: Llama 3.3 70B + Vision)
// ============================================================
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GroqMessage {
    pub role: String,
    pub content: serde_json::Value,  // string or array of content blocks
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GroqChatRequest {
    pub api_key: String,
    pub model: String,
    pub messages: Vec<GroqMessage>,
    pub max_tokens: u32,
}

#[tauri::command]
async fn groq_chat(req: GroqChatRequest) -> Result<String, String> {
    let body = serde_json::json!({
        "model": req.model,
        "max_tokens": req.max_tokens,
        "messages": req.messages,
    });
    let client = reqwest::Client::new();
    let resp = client
        .post("https://api.groq.com/openai/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", req.api_key))
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;
    let status = resp.status();
    let text = resp.text().await.map_err(|e| format!("Read body: {}", e))?;
    if !status.is_success() {
        return Err(format!("Groq API error {}: {}", status, text));
    }
    let json: serde_json::Value =
        serde_json::from_str(&text).map_err(|e| format!("Parse JSON: {}", e))?;
    let content = json
        .pointer("/choices/0/message/content")
        .and_then(|c| c.as_str())
        .map(String::from)
        .unwrap_or_else(|| text.clone());
    Ok(content)
}

// ============================================================
// Phase 28.9 — Google Gemini API (free tier, no card needed)
// Endpoint: generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
// Auth: ?key=AIza... (URL param)
// ============================================================
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GeminiChatRequest {
    pub api_key: String,
    pub model: String,           // vd "gemini-2.0-flash"
    pub system: String,          // optional system instruction
    pub messages: Vec<GeminiMessage>,
    pub max_tokens: u32,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GeminiMessage {
    pub role: String,            // "user" | "model"
    pub content: String,         // plain text only (vision dùng command riêng)
}

#[tauri::command]
async fn gemini_chat(req: GeminiChatRequest) -> Result<String, String> {
    // Build contents array — Gemini không dùng "system" role, mà dùng systemInstruction
    let contents: Vec<serde_json::Value> = req.messages
        .iter()
        .map(|m| {
            let role = if m.role == "assistant" { "model" } else { "user" };
            serde_json::json!({
                "role": role,
                "parts": [{ "text": m.content }],
            })
        })
        .collect();
    let mut body = serde_json::json!({
        "contents": contents,
        "generationConfig": {
            "maxOutputTokens": req.max_tokens,
            "temperature": 0.4,
        }
    });
    if !req.system.is_empty() {
        body["systemInstruction"] = serde_json::json!({
            "parts": [{ "text": req.system }],
        });
    }
    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
        req.model, req.api_key
    );
    let client = reqwest::Client::new();
    let resp = client
        .post(&url)
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;
    let status = resp.status();
    let text = resp.text().await.map_err(|e| format!("Read body: {}", e))?;
    if !status.is_success() {
        return Err(format!("Gemini API error {}: {}", status, text));
    }
    let json: serde_json::Value =
        serde_json::from_str(&text).map_err(|e| format!("Parse JSON: {}", e))?;
    // Response: { candidates: [{ content: { parts: [{ text: "..." }] } }] }
    let content = json
        .pointer("/candidates/0/content/parts/0/text")
        .and_then(|c| c.as_str())
        .map(String::from)
        .unwrap_or_else(|| text.clone());
    Ok(content)
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GeminiVisionRequest {
    pub api_key: String,
    pub model: String,           // vd "gemini-2.0-flash"
    pub prompt: String,          // text prompt mô tả task
    pub image_base64: String,    // ảnh base64 (KHÔNG có data:image/... prefix)
    pub mime_type: String,       // "image/png" | "image/jpeg"
    pub max_tokens: u32,
}

#[tauri::command]
async fn gemini_vision(req: GeminiVisionRequest) -> Result<String, String> {
    let body = serde_json::json!({
        "contents": [{
            "role": "user",
            "parts": [
                { "text": req.prompt },
                { "inline_data": {
                    "mime_type": req.mime_type,
                    "data": req.image_base64,
                }}
            ]
        }],
        "generationConfig": {
            "maxOutputTokens": req.max_tokens,
            "temperature": 0.2,
        }
    });
    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
        req.model, req.api_key
    );
    let client = reqwest::Client::new();
    let resp = client
        .post(&url)
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;
    let status = resp.status();
    let text = resp.text().await.map_err(|e| format!("Read body: {}", e))?;
    if !status.is_success() {
        return Err(format!("Gemini Vision error {}: {}", status, text));
    }
    let json: serde_json::Value =
        serde_json::from_str(&text).map_err(|e| format!("Parse JSON: {}", e))?;
    let content = json
        .pointer("/candidates/0/content/parts/0/text")
        .and_then(|c| c.as_str())
        .map(String::from)
        .unwrap_or_else(|| text.clone());
    Ok(content)
}

// ============================================================
// Phase 28.12 — Telegram bot feedback (tận dụng bot TrishDrive)
// ============================================================
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TgSendMessageRequest {
    pub bot_token: String,
    pub chat_id: String,   // có thể là "-1001234..." hoặc "@channelname"
    pub text: String,
}

#[tauri::command]
async fn tg_send_message(req: TgSendMessageRequest) -> Result<(), String> {
    let url = format!("https://api.telegram.org/bot{}/sendMessage", req.bot_token);
    let body = serde_json::json!({
        "chat_id": req.chat_id,
        "text": req.text,
        "parse_mode": "HTML",
    });
    let client = reqwest::Client::new();
    let resp = client.post(&url).json(&body).send().await
        .map_err(|e| format!("Network: {}", e))?;
    let status = resp.status();
    let text = resp.text().await.map_err(|e| format!("Read: {}", e))?;
    if !status.is_success() {
        return Err(format!("Telegram API {} : {}", status, text));
    }
    Ok(())
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TgSendDocumentRequest {
    pub bot_token: String,
    pub chat_id: String,
    pub caption: String,
    pub filename: String,
    /** Bytes of the file as Vec<u8> from JS Uint8Array */
    pub file_data: Vec<u8>,
}

#[tauri::command]
async fn tg_send_document(req: TgSendDocumentRequest) -> Result<(), String> {
    let url = format!("https://api.telegram.org/bot{}/sendDocument", req.bot_token);
    let part = reqwest::multipart::Part::bytes(req.file_data)
        .file_name(req.filename.clone());
    let form = reqwest::multipart::Form::new()
        .text("chat_id", req.chat_id.clone())
        .text("caption", req.caption.clone())
        .text("parse_mode", "HTML")
        .part("document", part);
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(180))
        .build()
        .map_err(|e| format!("client build: {}", e))?;
    let resp = client.post(&url).multipart(form).send().await
        .map_err(|e| format!("Network: {}", e))?;
    let status = resp.status();
    let text = resp.text().await.map_err(|e| format!("Read: {}", e))?;
    if !status.is_success() {
        return Err(format!("Telegram API {} : {}", status, text));
    }
    Ok(())
}

// ============================================================
// Phase 28.14 — Telegram getFile + download (cho LISP library)
// ============================================================
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TgGetFileRequest {
    pub bot_token: String,
    pub file_id: String,
}

#[tauri::command]
async fn tg_get_file_path(req: TgGetFileRequest) -> Result<String, String> {
    let url = format!(
        "https://api.telegram.org/bot{}/getFile?file_id={}",
        req.bot_token, req.file_id
    );
    let client = reqwest::Client::new();
    let resp = client.get(&url).send().await.map_err(|e| format!("Network: {}", e))?;
    let text = resp.text().await.map_err(|e| format!("Read: {}", e))?;
    let json: serde_json::Value = serde_json::from_str(&text).map_err(|e| format!("Parse: {}", e))?;
    let file_path = json
        .pointer("/result/file_path")
        .and_then(|v| v.as_str())
        .ok_or_else(|| format!("Telegram getFile lỗi: {}", text))?;
    Ok(file_path.to_string())
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TgDownloadFileRequest {
    pub bot_token: String,
    pub file_path: String,
    pub save_path: String,
}

#[tauri::command]
async fn tg_download_file(req: TgDownloadFileRequest) -> Result<usize, String> {
    let url = format!(
        "https://api.telegram.org/file/bot{}/{}",
        req.bot_token, req.file_path
    );
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(180))
        .build()
        .map_err(|e| format!("client: {}", e))?;
    let resp = client.get(&url).send().await.map_err(|e| format!("Network: {}", e))?;
    let bytes = resp.bytes().await.map_err(|e| format!("Read bytes: {}", e))?;
    let n = bytes.len();
    std::fs::write(&req.save_path, &bytes).map_err(|e| format!("Write file: {}", e))?;
    Ok(n)
}

// ============================================================
// Phase 28.5 — Chatbot: proxy gọi Claude API (tránh CORS từ frontend)
// ============================================================

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeChatRequest {
    pub api_key: String,
    pub model: String,
    pub system: String,
    pub messages: Vec<ClaudeMessage>,
    pub max_tokens: u32,
}

#[tauri::command]
async fn claude_chat(req: ClaudeChatRequest) -> Result<String, String> {
    let body = serde_json::json!({
        "model": req.model,
        "max_tokens": req.max_tokens,
        "system": req.system,
        "messages": req.messages,
    });
    let client = reqwest::Client::new();
    let resp = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", &req.api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;
    let status = resp.status();
    let text = resp.text().await.map_err(|e| format!("Read body: {}", e))?;
    if !status.is_success() {
        return Err(format!("API error {}: {}", status, text));
    }
    // Parse response: { content: [{ type: "text", text: "..." }, ...] }
    let json: serde_json::Value = serde_json::from_str(&text)
        .map_err(|e| format!("Parse JSON: {}", e))?;
    let content = json
        .get("content")
        .and_then(|c| c.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|item| {
                    item.get("text").and_then(|t| t.as_str()).map(String::from)
                })
                .collect::<Vec<_>>()
                .join("\n")
        })
        .unwrap_or_else(|| text.clone());
    Ok(content)
}

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            default_store_location,
            load_design_file,
            save_design_file,
            start_google_oauth_loopback,
            // Phase 28.4.E — AutoCAD COM
            acad_com::autocad_check_running,
            acad_com::autocad_get_version,
            acad_com::autocad_ensure_document,
            acad_com::autocad_send_commands,
            // Phase 28.4 Turn 10 — Custom hatch pattern deployment
            deploy_hatch_patterns,
            // Phase 28.4 Turn 11 — Scan AutoCAD SHX fonts
            list_autocad_shx_fonts,
            // Phase 28.4 Turn 18 — Save Excel file (chọn path)
            save_file_bytes,
            // Phase 28.5 — AutoLISP Manager
            read_text_file,
            find_acaddoc_paths,
            register_lisp_autoload,
            unregister_lisp_autoload,
            // Phase 28.5 — Chatbot AutoCAD
            claude_chat,
            // Phase 28.7 — Scan folder LSP
            scan_folder_lsp,
            // Phase 28.7b — Groq Cloud free AI
            groq_chat,
            // Phase 28.9 — Google Gemini free AI (text + vision)
            gemini_chat,
            gemini_vision,
            // Phase 28.12 — Telegram feedback bot
            tg_send_message,
            tg_send_document,
            // Phase 28.14 — Telegram getFile + download (LISP library)
            tg_get_file_path,
            tg_download_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running TrishDesign");
}
