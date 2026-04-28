//! TrishDesign Rust backend — 3 Tauri command:
//!
//!   - `default_store_location` → app data dir cho preset/palette local.
//!   - `load_design_file(path)` → đọc JSON DesignTokenSet (cap 8 MiB, validate shape).
//!   - `save_design_file(path, payload)` → atomic write JSON (temp → rename).
//!
//! Không dùng fs plugin — IO thuần `std::fs` để kiểm soát hard cap.

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
            start_google_oauth_loopback
        ])
        .run(tauri::generate_context!())
        .expect("error while running TrishDesign");
}
