//! TrishDrive USER app — Phase 26.1.A skeleton + Phase 26.1.B-C implementation.
//!
//! ROLE: User-facing app cho người dùng cuối:
//!   - Paste share link `trishteam.io.vn/drive/share/{token}#k={key}` → tải file
//!   - Browse Thư viện TrishTEAM (Firestore /shares is_public=true) (Phase 26.1.E)
//!   - Local download history + folder + tag + bookmark + note
//!
//! KHÔNG có (đã chuyển sang TrishAdmin Phase 24.1):
//!   - Bot API setup, MTProto session, file upload, share_create
//!
//! SECURITY: User chỉ tải, không upload. AES decrypt local bằng key derive
//! từ password share (PBKDF2). Server zero-knowledge.

mod crypto;
mod db;
mod webdav;
// Phase 60 — Migrate 4 module commands từ archive
mod clean;
mod check;
mod font;
mod shortcut;

use rusqlite::params;
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tauri::Emitter;

/// Phase 26.2.D — Speed limiter state (MB/s). 0 = unlimited.
/// User set qua Settings UI → invoke set_speed_limit.
#[derive(Default)]
struct SpeedLimit(Mutex<f64>);

/// Phase 26.2.B — Download control: pause/resume/cancel flags.
/// In-progress only (không persist sau crash). Reset đầu mỗi download.
#[derive(Default)]
struct DownloadControl {
    paused: Arc<AtomicBool>,
    cancelled: Arc<AtomicBool>,
}

/// Phase 26.1.G — progress event emit sau mỗi chunk download.
/// Frontend listen `drive-progress` → render % + speed + ETA.
///
/// Phase 25.1.H — Thêm `download_id` để hỗ trợ concurrent downloads.
/// Mỗi download có ID riêng, frontend track Map<download_id, progress> để
/// render multiple progress bars cùng lúc.
#[derive(Serialize, Clone)]
struct DownloadProgress {
    /// Phase 25.1.H — ID duy nhất per download (frontend gen, fallback empty string).
    download_id: String,
    current_chunk: i64,
    total_chunks: i64,
    bytes_done: i64,
    total_bytes: i64,
    file_name: String,
    /// 'downloading' | 'decrypting' | 'verifying' | 'done' | 'error' | 'paused'
    phase: String,
}

/// Phase 26.2.A — multi-link queue event. Frontend listen `drive-queue`
/// → render list status mỗi URL (queued/downloading/done/error/skipped).
#[derive(Serialize, Clone)]
struct QueueEvent {
    queue_index: i64,
    queue_total: i64,
    url: String,
    file_name: Option<String>,
    /// 'queued' | 'downloading' | 'done' | 'error' | 'skipped'
    status: String,
    error: Option<String>,
}

const SHARE_API_BASE: &str = "https://trishteam.io.vn";

// ============================================================
// App metadata
// ============================================================

#[tauri::command]
fn app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[tauri::command]
fn ping() -> String {
    "TrishDrive User app — Phase 26.1.C ready".to_string()
}

/// Phase 26.5.G — Frontend gọi để thoát hoàn toàn (không hide tray).
#[tauri::command]
fn exit_app(app: tauri::AppHandle) {
    app.exit(0);
}

/// Phase 26.5.G — Frontend gọi để hide window vào tray.
#[tauri::command]
fn hide_to_tray(window: tauri::WebviewWindow) -> Result<(), String> {
    window.hide().map_err(|e| format!("hide: {}", e))
}

/// Phase 26.2.D — Set speed limit MB/s (0 = unlimited).
#[tauri::command]
fn set_speed_limit(state: tauri::State<'_, SpeedLimit>, mbps: f64) {
    if let Ok(mut guard) = state.0.lock() {
        *guard = if mbps < 0.0 { 0.0 } else { mbps };
    }
}

#[tauri::command]
fn get_speed_limit(state: tauri::State<'_, SpeedLimit>) -> f64 {
    state.0.lock().map(|g| *g).unwrap_or(0.0)
}

/// Phase 26.2.B — Pause/resume/cancel download.
#[tauri::command]
fn pause_download(state: tauri::State<'_, DownloadControl>) {
    state.paused.store(true, Ordering::SeqCst);
}

#[tauri::command]
fn resume_download(state: tauri::State<'_, DownloadControl>) {
    state.paused.store(false, Ordering::SeqCst);
}

#[tauri::command]
fn cancel_download(state: tauri::State<'_, DownloadControl>) {
    state.cancelled.store(true, Ordering::SeqCst);
}

#[tauri::command]
fn is_download_paused(state: tauri::State<'_, DownloadControl>) -> bool {
    state.paused.load(Ordering::SeqCst)
}

// ============================================================
// Phase 26.1.B — Download history (SQLite local)
// ============================================================

#[derive(Serialize, Clone)]
pub struct HistoryRow {
    pub id: String,
    pub file_name: String,
    pub size_bytes: i64,
    pub sha256_hex: String,
    pub source_url: String,
    pub dest_path: Option<String>,
    pub downloaded_at: i64,
    pub tag: Option<String>,
    pub note: Option<String>,
    pub bookmarked: bool,
}

#[tauri::command]
fn history_list(app: tauri::AppHandle) -> Result<Vec<HistoryRow>, String> {
    let path = db::db_path(&app)?;
    let conn = db::open(&path).map_err(|e| format!("db open: {}", e))?;
    let mut stmt = conn.prepare(
        "SELECT id, file_name, size_bytes, sha256_hex, source_url, dest_path,
                downloaded_at, tag, note, bookmarked
         FROM download_history ORDER BY downloaded_at DESC LIMIT 500",
    ).map_err(|e| format!("prepare: {}", e))?;
    let rows = stmt.query_map([], |r| {
        Ok(HistoryRow {
            id: r.get(0)?,
            file_name: r.get(1)?,
            size_bytes: r.get(2)?,
            sha256_hex: r.get(3)?,
            source_url: r.get(4)?,
            dest_path: r.get(5)?,
            downloaded_at: r.get(6)?,
            tag: r.get(7)?,
            note: r.get(8)?,
            bookmarked: r.get::<_, i64>(9)? != 0,
        })
    }).map_err(|e| format!("query: {}", e))?
       .collect::<Result<Vec<_>, _>>()
       .map_err(|e| format!("collect: {}", e))?;
    Ok(rows)
}

#[tauri::command]
fn history_clear(app: tauri::AppHandle, id: String) -> Result<(), String> {
    let path = db::db_path(&app)?;
    let conn = db::open(&path).map_err(|e| format!("db: {}", e))?;
    conn.execute("DELETE FROM download_history WHERE id = ?", [id])
        .map_err(|e| format!("delete: {}", e))?;
    Ok(())
}

/// Phase 26.4.D — Auto cleanup history records cũ > N ngày.
/// KHÔNG xoá file vật lý disk (vì user save vào folder ngoài app).
/// Chỉ xoá record SQLite. File bookmark được giữ lại bất kể tuổi.
#[tauri::command]
fn history_cleanup_old(app: tauri::AppHandle, days_threshold: i64) -> Result<i64, String> {
    if days_threshold <= 0 {
        return Err("days_threshold phải > 0".to_string());
    }
    let cutoff = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
        - days_threshold * 24 * 3600 * 1000;

    let path = db::db_path(&app)?;
    let conn = db::open(&path).map_err(|e| format!("db: {}", e))?;
    let count = conn.execute(
        "DELETE FROM download_history WHERE downloaded_at < ? AND bookmarked = 0",
        [cutoff],
    ).map_err(|e| format!("cleanup: {}", e))? as i64;
    Ok(count)
}

#[tauri::command]
fn history_update_meta(
    app: tauri::AppHandle,
    id: String,
    tag: Option<String>,
    note: Option<String>,
    bookmarked: Option<bool>,
) -> Result<(), String> {
    let path = db::db_path(&app)?;
    let conn = db::open(&path).map_err(|e| format!("db: {}", e))?;
    if let Some(t) = tag {
        conn.execute("UPDATE download_history SET tag = ? WHERE id = ?", params![t, id])
            .map_err(|e| format!("update tag: {}", e))?;
    }
    if let Some(n) = note {
        conn.execute("UPDATE download_history SET note = ? WHERE id = ?", params![n, id])
            .map_err(|e| format!("update note: {}", e))?;
    }
    if let Some(b) = bookmarked {
        let v = if b { 1i64 } else { 0i64 };
        conn.execute("UPDATE download_history SET bookmarked = ? WHERE id = ?", params![v, id])
            .map_err(|e| format!("update bookmark: {}", e))?;
    }
    Ok(())
}

fn insert_history(app: &tauri::AppHandle, row: &HistoryRow) -> Result<(), String> {
    let path = db::db_path(app)?;
    let conn = db::open(&path).map_err(|e| format!("db: {}", e))?;
    conn.execute(
        "INSERT OR REPLACE INTO download_history
         (id, file_name, size_bytes, sha256_hex, source_url, dest_path,
          downloaded_at, tag, note, bookmarked)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        params![
            row.id, row.file_name, row.size_bytes, row.sha256_hex,
            row.source_url, row.dest_path, row.downloaded_at,
            row.tag, row.note, if row.bookmarked { 1i64 } else { 0i64 },
        ],
    ).map_err(|e| format!("insert: {}", e))?;
    Ok(())
}

// ============================================================
// Phase 26.1.C — share_paste_and_download
// Logic: parse URL → fetch /info → decrypt creds → loop chunks /proxy →
// decrypt + write disk → verify SHA256 → insert history
// ============================================================

#[derive(Deserialize)]
struct ShareInfo {
    file_name: String,
    file_size_bytes: i64,
    file_sha256_hex: String,
    #[serde(default)]
    pipeline: Option<String>, // 'botapi' | 'mtproto'
    encrypted_bot_token_hex: String,
    encrypted_master_key_hex: String,
    chunks: Vec<ShareChunk>,
}

#[derive(Deserialize)]
struct ShareChunk {
    #[allow(dead_code)]
    idx: i64,
    #[allow(dead_code)]
    byte_size: i64,
    nonce_hex: String,
    #[serde(default)]
    pipeline: Option<String>,
    #[serde(default)]
    tg_file_id: Option<String>,
    #[serde(default)]
    tg_message_id: Option<i64>,
    #[serde(default)]
    channel_id: Option<i64>,
}

/// Parse share URL → (token, optional key from `#k=...` fragment).
/// Support format: `https://trishteam.io.vn/drive/share/{token}#k={key}`
/// Short link `/s/{6char}` chưa support — Phase 26.2 sẽ resolve.
fn parse_share_url(url: &str) -> Result<(String, Option<String>), String> {
    let url = url.trim();
    if url.is_empty() {
        return Err("URL trống".into());
    }
    let (base, fragment) = match url.find('#') {
        Some(idx) => (&url[..idx], &url[idx + 1..]),
        None => (url, ""),
    };

    let key_from_fragment: Option<String> = fragment
        .split('&')
        .find_map(|kv| kv.strip_prefix("k="))
        .map(|s| s.to_string());

    if let Some(rest) = base.split("/drive/share/").nth(1) {
        let token = rest.trim_end_matches('/').to_string();
        if token.is_empty() {
            return Err("URL thiếu token".into());
        }
        return Ok((token, key_from_fragment));
    }
    if base.contains("/s/") {
        return Err("Short link /s/{code} chưa support — paste full URL /drive/share/{token} thay (Phase 26.2 sẽ thêm).".into());
    }
    Err(format!("URL không nhận dạng được: {}", base))
}

async fn fetch_share_info(token: &str) -> Result<ShareInfo, String> {
    let url = format!("{}/api/drive/share/{}/info", SHARE_API_BASE, urlencoding::encode(token));
    let resp = reqwest::Client::new().get(&url).send().await
        .map_err(|e| format!("HTTP /info: {}", e))?;
    let status = resp.status();
    let text = resp.text().await.unwrap_or_default();
    if !status.is_success() {
        if let Ok(err_json) = serde_json::from_str::<serde_json::Value>(&text) {
            if let Some(msg) = err_json.get("error").and_then(|v| v.as_str()) {
                return Err(format!("API {}: {}", status, msg));
            }
        }
        return Err(format!("API /info {}: {}", status, text.chars().take(200).collect::<String>()));
    }
    serde_json::from_str(&text).map_err(|e| format!("Parse /info JSON: {}. Body: {}", e, text.chars().take(200).collect::<String>()))
}

async fn proxy_download_chunk(
    token: &str,
    bot_token: &str,
    chunk: &ShareChunk,
    chunk_pipeline: &str,
    is_first_chunk: bool,
) -> Result<Vec<u8>, String> {
    let url = format!("{}/api/drive/share/{}/proxy", SHARE_API_BASE, urlencoding::encode(token));

    let body = if chunk_pipeline == "mtproto" {
        let msg_id = chunk.tg_message_id.ok_or_else(|| "MTProto chunk thiếu tg_message_id".to_string())?;
        let ch_id = chunk.channel_id.ok_or_else(|| "MTProto chunk thiếu channel_id".to_string())?;
        serde_json::json!({
            "bot_token": bot_token,
            "pipeline": "mtproto",
            "tg_message_id": msg_id,
            "channel_id": ch_id,
            "is_first_chunk": is_first_chunk,
        })
    } else {
        let file_id = chunk.tg_file_id.as_deref().ok_or_else(|| "Bot API chunk thiếu tg_file_id".to_string())?;
        serde_json::json!({
            "bot_token": bot_token,
            "pipeline": "botapi",
            "tg_file_id": file_id,
            "is_first_chunk": is_first_chunk,
        })
    };

    let resp = reqwest::Client::new().post(&url).json(&body).send().await
        .map_err(|e| format!("HTTP /proxy: {}", e))?;
    let status = resp.status();
    if !status.is_success() {
        let text = resp.text().await.unwrap_or_default();
        if let Ok(err_json) = serde_json::from_str::<serde_json::Value>(&text) {
            if let Some(msg) = err_json.get("error").and_then(|v| v.as_str()) {
                return Err(format!("Proxy {}: {}", status, msg));
            }
        }
        return Err(format!("Proxy {}: {}", status, text.chars().take(200).collect::<String>()));
    }
    let bytes = resp.bytes().await.map_err(|e| format!("read bytes: {}", e))?;
    Ok(bytes.to_vec())
}

/// Phase 26.2.D — Public Tauri command. Read speed limit từ state, gọi helper.
/// Phase 26.2.B — Reset pause/cancel flags at start.
/// Phase 25.1.H — Optional `download_id` để hỗ trợ concurrent downloads.
#[tauri::command]
async fn share_paste_and_download(
    app: tauri::AppHandle,
    state: tauri::State<'_, SpeedLimit>,
    ctrl: tauri::State<'_, DownloadControl>,
    url: String,
    password: Option<String>,
    dest_path: String,
    download_id: Option<String>,
) -> Result<HistoryRow, String> {
    let mbps = state.0.lock().map(|g| *g).unwrap_or(0.0);
    let bps = if mbps > 0.0 { mbps * 1_048_576.0 } else { 0.0 };
    // Reset control flags
    ctrl.paused.store(false, Ordering::SeqCst);
    ctrl.cancelled.store(false, Ordering::SeqCst);
    let did = download_id.unwrap_or_default();
    do_share_paste_and_download(app, bps, ctrl.paused.clone(), ctrl.cancelled.clone(), url, password, dest_path, did).await
}

/// Helper internal — KHÔNG nhận tauri::State để có thể gọi từ
/// share_queue_download (lifetime của State khó pass qua nested async).
async fn do_share_paste_and_download(
    app: tauri::AppHandle,
    speed_limit_bps: f64,
    paused: Arc<AtomicBool>,
    cancelled: Arc<AtomicBool>,
    url: String,
    password: Option<String>,
    dest_path: String,
    download_id: String,
) -> Result<HistoryRow, String> {
    use sha2::{Digest, Sha256};
    use tokio::io::AsyncWriteExt;

    // 1. Parse URL → token + optional key from fragment
    let (token, key_from_fragment) = parse_share_url(&url)?;

    // 2. Effective password: ưu tiên password user nhập, fallback fragment key
    let effective_password = password
        .filter(|p| !p.is_empty())
        .or(key_from_fragment)
        .ok_or_else(|| "Thiếu password — URL không có #k=... fragment và user không cung cấp password".to_string())?;

    // 3. Fetch /info
    let info = fetch_share_info(&token).await?;
    if info.chunks.is_empty() {
        return Err("Share không có chunk nào".into());
    }

    // 4. Decrypt creds (bot_token + master_key)
    let bot_token_bytes = crypto::decrypt_with_password(&info.encrypted_bot_token_hex, &effective_password)?;
    let bot_token = String::from_utf8(bot_token_bytes)
        .map_err(|e| format!("bot_token UTF-8: {}", e))?;
    let master_key_bytes = crypto::decrypt_with_password(&info.encrypted_master_key_hex, &effective_password)?;
    let master_key_hex = String::from_utf8(master_key_bytes)
        .map_err(|e| format!("master_key UTF-8: {}", e))?;

    // 5. Loop chunks → /proxy → decrypt → write file streaming.
    // Phase 26.1.G — emit drive-progress event sau mỗi chunk để UI render bar.
    let total_chunks = info.chunks.len() as i64;
    let total_bytes = info.file_size_bytes;

    // Emit start
    let _ = app.emit("drive-progress", DownloadProgress {
        download_id: download_id.clone(),
        current_chunk: 0, total_chunks,
        bytes_done: 0, total_bytes,
        file_name: info.file_name.clone(),
        phase: "downloading".into(),
    });

    let mut out_file = tokio::fs::File::create(&dest_path).await
        .map_err(|e| format!("create dest: {}", e))?;
    let mut hasher = Sha256::new();
    let mut bytes_done: i64 = 0;

    let pipeline_default = info.pipeline.as_deref().unwrap_or("botapi");

    for (i, chunk) in info.chunks.iter().enumerate() {
        // Phase 26.2.B — Pause/Cancel check trước mỗi chunk
        while paused.load(Ordering::SeqCst) {
            if cancelled.load(Ordering::SeqCst) {
                let _ = tokio::fs::remove_file(&dest_path).await;
                return Err("Đã huỷ download bởi user".into());
            }
            let _ = app.emit("drive-progress", DownloadProgress {
                download_id: download_id.clone(),
                current_chunk: (i + 1) as i64, total_chunks,
                bytes_done, total_bytes,
                file_name: info.file_name.clone(),
                phase: "paused".into(),
            });
            tokio::time::sleep(std::time::Duration::from_millis(500)).await;
        }
        if cancelled.load(Ordering::SeqCst) {
            let _ = tokio::fs::remove_file(&dest_path).await;
            return Err("Đã huỷ download bởi user".into());
        }

        let chunk_start = std::time::Instant::now();
        let chunk_pipeline = chunk.pipeline.as_deref().unwrap_or(pipeline_default);
        let encrypted = proxy_download_chunk(&token, &bot_token, chunk, chunk_pipeline, i == 0).await
            .map_err(|e| {
                let _ = app.emit("drive-progress", DownloadProgress {
                    download_id: download_id.clone(),
                    current_chunk: (i + 1) as i64, total_chunks,
                    bytes_done, total_bytes,
                    file_name: info.file_name.clone(),
                    phase: "error".into(),
                });
                format!("Chunk {}/{}: {}", i + 1, total_chunks, e)
            })?;

        // Verify nonce match (defensive: chunk.nonce_hex là 12 byte đầu của encrypted)
        let _ = chunk.nonce_hex;

        let plaintext = crypto::decrypt(&master_key_hex, &encrypted)?;
        hasher.update(&plaintext);
        out_file.write_all(&plaintext).await.map_err(|e| format!("write: {}", e))?;
        bytes_done += plaintext.len() as i64;

        // Phase 26.2.D — Speed limit: nếu chunk nhanh hơn target → sleep diff
        if speed_limit_bps > 0.0 {
            let chunk_bytes = plaintext.len() as f64;
            let target_dt_secs = chunk_bytes / speed_limit_bps;
            let actual_dt = chunk_start.elapsed().as_secs_f64();
            if target_dt_secs > actual_dt {
                let sleep_secs = target_dt_secs - actual_dt;
                tokio::time::sleep(std::time::Duration::from_secs_f64(sleep_secs)).await;
            }
        }

        // Emit progress sau mỗi chunk
        let _ = app.emit("drive-progress", DownloadProgress {
            download_id: download_id.clone(),
            current_chunk: (i + 1) as i64, total_chunks,
            bytes_done, total_bytes,
            file_name: info.file_name.clone(),
            phase: "downloading".into(),
        });
    }
    out_file.flush().await.map_err(|e| format!("flush: {}", e))?;
    drop(out_file);

    // Emit verify phase
    let _ = app.emit("drive-progress", DownloadProgress {
        download_id: download_id.clone(),
        current_chunk: total_chunks, total_chunks,
        bytes_done: total_bytes, total_bytes,
        file_name: info.file_name.clone(),
        phase: "verifying".into(),
    });

    // 6. Verify SHA256
    let actual_sha = hex::encode(hasher.finalize());
    if actual_sha != info.file_sha256_hex {
        let _ = tokio::fs::remove_file(&dest_path).await;
        return Err(format!(
            "SHA256 mismatch: expected {} got {}. File corrupt — đã xoá.",
            &info.file_sha256_hex[..12], &actual_sha[..12]
        ));
    }

    // 7. Insert history
    let id = format!("h_{}", &info.file_sha256_hex[..16]);
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0);
    let row = HistoryRow {
        id,
        file_name: info.file_name,
        size_bytes: info.file_size_bytes,
        sha256_hex: info.file_sha256_hex,
        source_url: url,
        dest_path: Some(dest_path),
        downloaded_at: now,
        tag: None,
        note: None,
        bookmarked: false,
    };
    insert_history(&app, &row)?;

    // Emit done
    let _ = app.emit("drive-progress", DownloadProgress {
        download_id: download_id.clone(),
        current_chunk: total_chunks, total_chunks,
        bytes_done: total_bytes, total_bytes,
        file_name: row.file_name.clone(),
        phase: "done".into(),
    });

    Ok(row)
}

// ============================================================
// Phase 26.2.A — Multi-link queue download
// Loop URLs tuần tự, gọi share_paste_and_download cho mỗi link.
// dest_folder + filename derive từ /info response.
// ============================================================

#[derive(Serialize)]
pub struct QueueResult {
    pub total: i64,
    pub success: i64,
    pub failed: i64,
    pub history_ids: Vec<String>,
}

/// Sanitize filename — bỏ characters nguy hiểm cho filesystem (Windows + Unix).
fn sanitize_filename(name: &str) -> String {
    let cleaned: String = name.chars()
        .map(|c| match c {
            '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*' => '_',
            c if c.is_control() => '_',
            c => c,
        })
        .collect();
    let trimmed = cleaned.trim().trim_matches('.').trim();
    if trimmed.is_empty() {
        "download.bin".to_string()
    } else {
        trimmed.chars().take(200).collect()
    }
}

#[tauri::command]
async fn share_queue_download(
    app: tauri::AppHandle,
    state: tauri::State<'_, SpeedLimit>,
    ctrl: tauri::State<'_, DownloadControl>,
    urls: Vec<String>,
    dest_folder: String,
) -> Result<QueueResult, String> {
    // Phase 26.2.D — share speed limit cho mọi chunk trong queue
    let mbps = state.0.lock().map(|g| *g).unwrap_or(0.0);
    let speed_limit_bps = if mbps > 0.0 { mbps * 1_048_576.0 } else { 0.0 };
    // Phase 26.2.B — share pause/cancel flags
    ctrl.paused.store(false, Ordering::SeqCst);
    ctrl.cancelled.store(false, Ordering::SeqCst);
    let paused = ctrl.paused.clone();
    let cancelled = ctrl.cancelled.clone();

    let total = urls.len() as i64;
    let mut success = 0i64;
    let mut failed = 0i64;
    let mut history_ids: Vec<String> = Vec::new();

    let folder_path = std::path::PathBuf::from(&dest_folder);
    if !folder_path.exists() {
        tokio::fs::create_dir_all(&folder_path).await
            .map_err(|e| format!("create folder {}: {}", dest_folder, e))?;
    }

    for (i, url) in urls.iter().enumerate() {
        let queue_index = i as i64;
        let url = url.trim().to_string();
        if url.is_empty() {
            let _ = app.emit("drive-queue", QueueEvent {
                queue_index, queue_total: total,
                url: url.clone(), file_name: None,
                status: "skipped".into(), error: Some("URL trống".into()),
            });
            continue;
        }

        let _ = app.emit("drive-queue", QueueEvent {
            queue_index, queue_total: total,
            url: url.clone(), file_name: None,
            status: "downloading".into(), error: None,
        });

        // Parse URL → token + key
        let (token, key_from_fragment) = match parse_share_url(&url) {
            Ok(v) => v,
            Err(e) => {
                failed += 1;
                let _ = app.emit("drive-queue", QueueEvent {
                    queue_index, queue_total: total,
                    url: url.clone(), file_name: None,
                    status: "error".into(), error: Some(format!("Parse URL: {}", e)),
                });
                continue;
            }
        };

        // Fetch info để get filename
        let info = match fetch_share_info(&token).await {
            Ok(v) => v,
            Err(e) => {
                failed += 1;
                let _ = app.emit("drive-queue", QueueEvent {
                    queue_index, queue_total: total,
                    url: url.clone(), file_name: None,
                    status: "error".into(), error: Some(format!("Fetch info: {}", e)),
                });
                continue;
            }
        };

        let filename = sanitize_filename(&info.file_name);
        let dest_path = folder_path.join(&filename);
        let dest_path_str = dest_path.to_string_lossy().to_string();

        // Skip nếu file đã tồn tại
        if dest_path.exists() {
            let _ = app.emit("drive-queue", QueueEvent {
                queue_index, queue_total: total,
                url: url.clone(), file_name: Some(filename.clone()),
                status: "skipped".into(), error: Some("File đã tồn tại trong folder dest".into()),
            });
            continue;
        }

        // Gọi do_share_paste_and_download helper (không cần re-parse URL).
        let password_for_download = key_from_fragment.unwrap_or_default();
        // Phase 25.1.H — queue download dùng download_id = format!("queue-{}", queue_index)
        let did = format!("queue-{}", queue_index);
        match do_share_paste_and_download(
            app.clone(),
            speed_limit_bps,
            paused.clone(),
            cancelled.clone(),
            url.clone(),
            if password_for_download.is_empty() { None } else { Some(password_for_download) },
            dest_path_str,
            did,
        ).await {
            Ok(row) => {
                success += 1;
                history_ids.push(row.id.clone());
                let _ = app.emit("drive-queue", QueueEvent {
                    queue_index, queue_total: total,
                    url: url.clone(), file_name: Some(row.file_name),
                    status: "done".into(), error: None,
                });
            }
            Err(e) => {
                failed += 1;
                let _ = app.emit("drive-queue", QueueEvent {
                    queue_index, queue_total: total,
                    url: url.clone(), file_name: Some(filename),
                    status: "error".into(), error: Some(e),
                });
            }
        }
    }

    Ok(QueueResult { total, success, failed, history_ids })
}

// ============================================================
// Phase 26.3.B — Preview inline (download to %TEMP% + OS viewer)
// ============================================================

/// Lấy path %TEMP%/trishdrive-preview/ (auto-create). Frontend dùng để build
/// dest_path khi preview file (vd: %TEMP%/trishdrive-preview/abc.pdf), sau đó
/// gọi openPath để OS mở default viewer (PDF, image, text, etc.).
#[tauri::command]
fn get_preview_temp_dir() -> Result<String, String> {
    let dir = std::env::temp_dir().join("trishdrive-preview");
    std::fs::create_dir_all(&dir).map_err(|e| format!("mkdir preview temp: {}", e))?;
    Ok(dir.to_string_lossy().to_string())
}

/// Cleanup file preview > 24h trong %TEMP%/trishdrive-preview/. Gọi lúc app start.
fn cleanup_preview_temp() {
    let dir = std::env::temp_dir().join("trishdrive-preview");
    if !dir.exists() { return; }
    let now = std::time::SystemTime::now();
    let cutoff = std::time::Duration::from_secs(24 * 3600);
    if let Ok(entries) = std::fs::read_dir(&dir) {
        for entry in entries.flatten() {
            if let Ok(meta) = entry.metadata() {
                if let Ok(modified) = meta.modified() {
                    if let Ok(elapsed) = now.duration_since(modified) {
                        if elapsed > cutoff {
                            let _ = std::fs::remove_file(entry.path());
                        }
                    }
                }
            }
        }
    }
}

// ============================================================
// Tauri builder + run
// ============================================================

// ============================================================
// Phase 25.1.E — WebDAV mount commands
// ============================================================

use std::sync::Mutex as StdMutex;

#[derive(Default)]
struct WebDavServerState {
    handle: StdMutex<Option<tokio::task::JoinHandle<()>>>,
    port: StdMutex<Option<u16>>,
}

#[tauri::command]
async fn webdav_start(
    app: tauri::AppHandle,
    state: tauri::State<'_, WebDavServerState>,
    port: u16,
) -> Result<u16, String> {
    let cache = webdav::cache_dir(&app)?;
    {
        let mut h = state.handle.lock().unwrap();
        if let Some(handle) = h.take() { handle.abort(); }
    }
    let cache_clone = cache.clone();
    let handle = tokio::spawn(async move {
        if let Err(e) = webdav::run_webdav(cache_clone, port).await {
            eprintln!("[webdav] server error: {}", e);
        }
    });
    {
        let mut h = state.handle.lock().unwrap();
        *h = Some(handle);
        let mut p = state.port.lock().unwrap();
        *p = Some(port);
    }
    Ok(port)
}

#[tauri::command]
fn webdav_stop(state: tauri::State<'_, WebDavServerState>) -> Result<(), String> {
    let mut h = state.handle.lock().unwrap();
    if let Some(handle) = h.take() { handle.abort(); }
    let mut p = state.port.lock().unwrap();
    *p = None;
    Ok(())
}

#[tauri::command]
fn webdav_status(state: tauri::State<'_, WebDavServerState>) -> Result<Option<u16>, String> {
    let p = state.port.lock().unwrap();
    Ok(*p)
}

#[tauri::command]
fn webdav_cache_size(app: tauri::AppHandle) -> Result<u64, String> {
    let dir = webdav::cache_dir(&app)?;
    Ok(webdav::cache_size(&dir))
}

#[tauri::command]
fn webdav_cache_evict(app: tauri::AppHandle, target_bytes: u64) -> Result<(usize, u64), String> {
    let dir = webdav::cache_dir(&app)?;
    Ok(webdav::evict_lru(&dir, target_bytes))
}

/// Phase 25.1.E.2 — Auto map Z: drive + set label "TrishTEAM Cloud"
#[tauri::command]
fn webdav_mount_drive(drive_letter: String, port: u16) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        let dl = drive_letter.trim().trim_end_matches(':').to_uppercase();
        if dl.len() != 1 || !dl.chars().all(|c| c.is_ascii_alphabetic()) {
            return Err(format!("Drive letter '{}' không hợp lệ", drive_letter));
        }
        let url = format!("http://127.0.0.1:{}/", port);

        // 1. Unmount cũ (silent ignore nếu chưa mount)
        let _ = std::process::Command::new("net")
            .args(["use", &format!("{}:", dl), "/delete", "/yes"])
            .output();

        // 2. net use Z: http://127.0.0.1:8766/ /persistent:no
        let out = std::process::Command::new("net")
            .args(["use", &format!("{}:", dl), &url, "/persistent:no"])
            .output()
            .map_err(|e| format!("net use spawn fail: {}", e))?;
        if !out.status.success() {
            let stderr = String::from_utf8_lossy(&out.stderr);
            let stdout = String::from_utf8_lossy(&out.stdout);
            return Err(format!("net use fail: {} {}", stdout, stderr));
        }

        // 3. Set drive label "TrishTEAM Cloud" qua registry MountPoints2.
        // WebDAV mount key: HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\
        //   MountPoints2\##<host>@<port>\_LabelFromReg
        // Path encode: "\\127.0.0.1@8766" → "##127.0.0.1@8766"
        let mount_key = format!(
            r"HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\MountPoints2\##127.0.0.1@{}",
            port
        );
        let _ = std::process::Command::new("reg")
            .args([
                "add", &mount_key,
                "/v", "_LabelFromReg",
                "/t", "REG_SZ",
                "/d", "TrishTEAM Cloud",
                "/f",
            ])
            .output();

        // 4. Refresh Explorer để label mới hiện ngay (không cần kill explorer).
        // Cách nhẹ: gọi SHChangeNotify qua PowerShell. Nếu fail, Trí có thể F5
        // trong This PC để refresh thủ công.
        let _ = std::process::Command::new("powershell")
            .args([
                "-NoProfile", "-Command",
                "$sig = '[DllImport(\"shell32.dll\", CharSet=CharSet.Auto)] public static extern void SHChangeNotify(int wEventId, int uFlags, IntPtr dwItem1, IntPtr dwItem2);'; \
                 $type = Add-Type -MemberDefinition $sig -Name 'Win32SHChangeNotify' -Namespace Win32Functions -PassThru; \
                 $type::SHChangeNotify(0x08000000, 0, [IntPtr]::Zero, [IntPtr]::Zero)",
            ])
            .output();

        Ok(format!("Đã mount {}:\\ → {} (label 'TrishTEAM Cloud'). Nếu tên cũ còn → F5 trong This PC.", dl, url))
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("WebDAV auto-mount chỉ hỗ trợ Windows. macOS/Linux: dùng Finder/Nautilus connect to server thủ công.".into())
    }
}

#[tauri::command]
fn webdav_unmount_drive(drive_letter: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let dl = drive_letter.trim().trim_end_matches(':').to_uppercase();
        if dl.len() != 1 { return Err("Drive letter không hợp lệ".into()); }
        let out = std::process::Command::new("net")
            .args(["use", &format!("{}:", dl), "/delete", "/yes"])
            .output()
            .map_err(|e| format!("net use /delete fail: {}", e))?;
        if !out.status.success() {
            let stderr = String::from_utf8_lossy(&out.stderr);
            // Code 2250 = chưa mount → không phải lỗi
            if !stderr.contains("2250") && !stderr.is_empty() {
                return Err(format!("Unmount fail: {}", stderr));
            }
        }
        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    { Ok(()) }
}

/// Lấy cache dir path mà KHÔNG mở Explorer (dùng cho sync logic).
#[tauri::command]
fn webdav_get_cache_dir(app: tauri::AppHandle) -> Result<String, String> {
    let dir = webdav::cache_dir(&app)?;
    Ok(dir.to_string_lossy().to_string())
}

/// Phase 25.1.E.3 — Fetch TrishTEAM Library list từ Rust để bypass CORS dev mode.
/// Truyền Firebase ID token, return JSON list items.
/// Redirect-aware: thử cả với/không www để xử lý Vercel host redirect strip auth header.
#[tauri::command]
async fn fetch_library_list(token: String) -> Result<serde_json::Value, String> {
    if token.trim().is_empty() {
        return Err("Token rỗng — frontend chưa truyền Firebase ID token. Đăng nhập lại?".into());
    }
    let token_trim = token.trim().to_string();

    // Manual redirect follow — giữ Authorization header qua mỗi hop (reqwest mặc định strip cross-host)
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|e| format!("client: {}", e))?;

    let mut current_url = "https://www.trishteam.io.vn/api/drive/library/list".to_string();
    let mut hops: Vec<String> = Vec::new();
    for hop_idx in 0..5 {
        hops.push(current_url.clone());
        let resp = client
            .get(&current_url)
            .header("Authorization", format!("Bearer {}", token_trim))
            .send()
            .await
            .map_err(|e| format!("Network hop {} {}: {}", hop_idx, current_url, e))?;
        let status = resp.status();
        if status.is_success() {
            let text = resp.text().await.map_err(|e| format!("Read: {}", e))?;
            return serde_json::from_str(&text)
                .map_err(|e| format!("Parse JSON: {} — body: {}", e, &text[..text.len().min(200)]));
        }
        if status.is_redirection() {
            let loc = resp.headers()
                .get("location")
                .and_then(|v| v.to_str().ok())
                .ok_or_else(|| format!("Status {} không có Location header", status))?
                .to_string();
            // Nếu loc relative → join với current_url base
            current_url = if loc.starts_with("http") {
                loc
            } else {
                let base = url::Url::parse(&current_url).map_err(|e| format!("URL parse: {}", e))?;
                base.join(&loc).map_err(|e| format!("URL join: {}", e))?.to_string()
            };
            continue;
        }
        // Non-success non-redirect → trả lỗi với chain
        let text = resp.text().await.unwrap_or_default();
        return Err(format!(
            "API {} (token len={}) hop {}: {}\nChain: {}",
            status, token_trim.len(), hop_idx, &text[..text.len().min(300)], hops.join(" → ")
        ));
    }
    Err(format!("Quá nhiều redirect (>5). Chain: {}", hops.join(" → ")))
}

#[tauri::command]
fn webdav_open_cache_dir(app: tauri::AppHandle) -> Result<String, String> {
    let dir = webdav::cache_dir(&app)?;
    let dir_str = dir.to_string_lossy().to_string();
    // Spawn Explorer trực tiếp (Windows). Trên macOS dùng `open`, Linux dùng `xdg-open`.
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer.exe")
            .arg(&dir_str)
            .spawn()
            .map_err(|e| format!("Spawn explorer fail: {} (path: {})", e, dir_str))?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open").arg(&dir_str).spawn()
            .map_err(|e| format!("open fail: {}", e))?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open").arg(&dir_str).spawn()
            .map_err(|e| format!("xdg-open fail: {}", e))?;
    }
    Ok(dir_str)
}

// ============================================================
// Phase 40.6 + 40.10 — Social media video downloader (yt-dlp)
// ============================================================

/// Trả về path nơi lưu yt-dlp local bundled trong AppData.
fn ytdlp_local_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    use tauri::Manager;
    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Không lấy được AppData dir: {}", e))?;
    let bin_dir = app_data.join("bin");
    std::fs::create_dir_all(&bin_dir).map_err(|e| format!("Tạo bin dir fail: {}", e))?;
    #[cfg(target_os = "windows")]
    let exe = bin_dir.join("yt-dlp.exe");
    #[cfg(not(target_os = "windows"))]
    let exe = bin_dir.join("yt-dlp");
    Ok(exe)
}

/// Resolve yt-dlp executable path: ưu tiên local bundled (AppData),
/// fallback `yt-dlp` trong PATH.
fn resolve_ytdlp_cmd(app: &tauri::AppHandle) -> String {
    if let Ok(local) = ytdlp_local_path(app) {
        if local.exists() {
            return local.to_string_lossy().to_string();
        }
    }
    #[cfg(target_os = "windows")]
    let fallback = "yt-dlp.exe";
    #[cfg(not(target_os = "windows"))]
    let fallback = "yt-dlp";
    fallback.to_string()
}

/// Path tới ffmpeg.exe (bundled local trong AppData/bin).
fn ffmpeg_local_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    use tauri::Manager;
    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Không lấy được AppData dir: {}", e))?;
    let bin_dir = app_data.join("bin");
    std::fs::create_dir_all(&bin_dir).map_err(|e| format!("Tạo bin dir fail: {}", e))?;
    #[cfg(target_os = "windows")]
    let exe = bin_dir.join("ffmpeg.exe");
    #[cfg(not(target_os = "windows"))]
    let exe = bin_dir.join("ffmpeg");
    Ok(exe)
}

#[tauri::command]
fn check_ffmpeg_available(app: tauri::AppHandle) -> Result<bool, String> {
    if let Ok(local) = ffmpeg_local_path(&app) {
        if local.exists() {
            return Ok(true);
        }
    }
    #[cfg(target_os = "windows")]
    let cmd = "ffmpeg.exe";
    #[cfg(not(target_os = "windows"))]
    let cmd = "ffmpeg";
    match std::process::Command::new(cmd).arg("-version").output() {
        Ok(out) => Ok(out.status.success()),
        Err(_) => Ok(false),
    }
}

/// Auto-install ffmpeg: tải ffmpeg-release-essentials.zip từ gyan.dev,
/// extract ffmpeg.exe + ffprobe.exe vào AppData/bin.
#[tauri::command]
async fn install_ffmpeg(app: tauri::AppHandle) -> Result<String, String> {
    #[cfg(not(target_os = "windows"))]
    {
        return Err("Auto-install ffmpeg chỉ hỗ trợ Windows. macOS: brew install ffmpeg / Linux: apt install ffmpeg".to_string());
    }

    #[cfg(target_os = "windows")]
    {
        use tauri::Manager;
        let app_data = app
            .path()
            .app_data_dir()
            .map_err(|e| format!("AppData dir fail: {}", e))?;
        let bin_dir = app_data.join("bin");
        std::fs::create_dir_all(&bin_dir).map_err(|e| format!("Create bin fail: {}", e))?;
        let zip_path = bin_dir.join("ffmpeg-release.zip");
        let url = "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip";

        let _ = app.emit(
            "ffmpeg-install:progress",
            serde_json::json!({ "status": "downloading", "msg": "Tải ffmpeg ~100MB từ gyan.dev..." }),
        );

        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(600))
            .user_agent(concat!("TrishDrive/", env!("CARGO_PKG_VERSION")))
            .build()
            .map_err(|e| format!("HTTP client fail: {}", e))?;

        let resp = client
            .get(url)
            .send()
            .await
            .map_err(|e| format!("Download fail: {}", e))?;
        if !resp.status().is_success() {
            return Err(format!("HTTP {}", resp.status().as_u16()));
        }

        let bytes = resp
            .bytes()
            .await
            .map_err(|e| format!("Read body fail: {}", e))?;

        std::fs::write(&zip_path, &bytes).map_err(|e| format!("Write zip fail: {}", e))?;

        let _ = app.emit(
            "ffmpeg-install:progress",
            serde_json::json!({ "status": "extracting", "msg": "Giải nén..." }),
        );

        // Dùng PowerShell Expand-Archive (built-in Windows 10+)
        let extract_to = bin_dir.join("ffmpeg-tmp");
        let _ = std::fs::remove_dir_all(&extract_to);
        let out = std::process::Command::new("powershell")
            .args([
                "-NoProfile",
                "-Command",
                &format!(
                    "Expand-Archive -Path '{}' -DestinationPath '{}' -Force",
                    zip_path.display(),
                    extract_to.display()
                ),
            ])
            .output()
            .map_err(|e| format!("Powershell extract fail: {}", e))?;
        if !out.status.success() {
            return Err(format!(
                "Extract zip fail: {}",
                String::from_utf8_lossy(&out.stderr)
            ));
        }

        // Tìm ffmpeg.exe + ffprobe.exe trong extract dir (gyan zip có subfolder)
        let mut found_ffmpeg: Option<std::path::PathBuf> = None;
        let mut found_ffprobe: Option<std::path::PathBuf> = None;
        for entry in walkdir_rs(&extract_to) {
            let name = entry.file_name().to_string_lossy().to_lowercase();
            if name == "ffmpeg.exe" {
                found_ffmpeg = Some(entry.path().to_path_buf());
            } else if name == "ffprobe.exe" {
                found_ffprobe = Some(entry.path().to_path_buf());
            }
        }

        let dest_ffmpeg = bin_dir.join("ffmpeg.exe");
        let dest_ffprobe = bin_dir.join("ffprobe.exe");

        if let Some(src) = found_ffmpeg {
            std::fs::copy(&src, &dest_ffmpeg).map_err(|e| format!("Copy ffmpeg fail: {}", e))?;
        } else {
            return Err("Không tìm thấy ffmpeg.exe trong zip".to_string());
        }
        if let Some(src) = found_ffprobe {
            std::fs::copy(&src, &dest_ffprobe).map_err(|e| format!("Copy ffprobe fail: {}", e))?;
        }

        // Cleanup
        let _ = std::fs::remove_dir_all(&extract_to);
        let _ = std::fs::remove_file(&zip_path);

        let _ = app.emit(
            "ffmpeg-install:progress",
            serde_json::json!({ "status": "done", "path": dest_ffmpeg.to_string_lossy() }),
        );

        Ok(dest_ffmpeg.to_string_lossy().to_string())
    }
}

/// Walkdir đệ quy đơn giản (tránh thêm dep walkdir cho 1 hàm).
#[cfg(target_os = "windows")]
fn walkdir_rs(root: &std::path::Path) -> Vec<std::fs::DirEntry> {
    let mut result = Vec::new();
    if let Ok(rd) = std::fs::read_dir(root) {
        for entry in rd.flatten() {
            let path = entry.path();
            if path.is_dir() {
                result.extend(walkdir_rs(&path));
            } else {
                result.push(entry);
            }
        }
    }
    result
}

/// Check Node.js có sẵn (giúp yt-dlp bypass YouTube n-sig challenge).
#[tauri::command]
fn check_nodejs_available() -> Result<bool, String> {
    #[cfg(target_os = "windows")]
    let cmd = "node.exe";
    #[cfg(not(target_os = "windows"))]
    let cmd = "node";
    match std::process::Command::new(cmd).arg("--version").output() {
        Ok(out) => Ok(out.status.success()),
        Err(_) => Ok(false),
    }
}

/// Path tới deno.exe bundled (AppData/bin).
fn deno_local_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    use tauri::Manager;
    let app_data = app.path().app_data_dir().map_err(|e| format!("AppData dir: {}", e))?;
    let bin_dir = app_data.join("bin");
    std::fs::create_dir_all(&bin_dir).map_err(|e| format!("Create bin: {}", e))?;
    #[cfg(target_os = "windows")]
    let exe = bin_dir.join("deno.exe");
    #[cfg(not(target_os = "windows"))]
    let exe = bin_dir.join("deno");
    Ok(exe)
}

#[tauri::command]
fn check_deno_available(app: tauri::AppHandle) -> Result<bool, String> {
    if let Ok(local) = deno_local_path(&app) {
        if local.exists() {
            return Ok(true);
        }
    }
    // Fallback PATH
    #[cfg(target_os = "windows")]
    let cmd = "deno.exe";
    #[cfg(not(target_os = "windows"))]
    let cmd = "deno";
    match std::process::Command::new(cmd).arg("--version").output() {
        Ok(out) => Ok(out.status.success()),
        Err(_) => Ok(false),
    }
}

/// Auto-install Deno portable (~30MB, single binary, support n-sig JS challenge).
#[tauri::command]
async fn install_deno(app: tauri::AppHandle) -> Result<String, String> {
    #[cfg(not(target_os = "windows"))]
    {
        return Err("Auto-install Deno chỉ hỗ trợ Windows. macOS: brew install deno / Linux: snap install deno".to_string());
    }

    #[cfg(target_os = "windows")]
    {
        use tauri::Manager;
        let app_data = app.path().app_data_dir().map_err(|e| format!("AppData: {}", e))?;
        let bin_dir = app_data.join("bin");
        std::fs::create_dir_all(&bin_dir).map_err(|e| format!("mkdir: {}", e))?;
        let zip_path = bin_dir.join("deno.zip");
        let url = "https://github.com/denoland/deno/releases/latest/download/deno-x86_64-pc-windows-msvc.zip";

        let _ = app.emit(
            "deno-install:progress",
            serde_json::json!({ "status": "downloading", "msg": "Tải Deno ~30MB..." }),
        );

        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(300))
            .user_agent(concat!("TrishDrive/", env!("CARGO_PKG_VERSION")))
            .build()
            .map_err(|e| format!("HTTP client: {}", e))?;

        let resp = client.get(url).send().await.map_err(|e| format!("DL: {}", e))?;
        if !resp.status().is_success() {
            return Err(format!("HTTP {}", resp.status().as_u16()));
        }
        let bytes = resp.bytes().await.map_err(|e| format!("Body: {}", e))?;
        std::fs::write(&zip_path, &bytes).map_err(|e| format!("Write: {}", e))?;

        let _ = app.emit(
            "deno-install:progress",
            serde_json::json!({ "status": "extracting" }),
        );

        let extract_to = bin_dir.join("deno-tmp");
        let _ = std::fs::remove_dir_all(&extract_to);
        let out = std::process::Command::new("powershell")
            .args([
                "-NoProfile",
                "-Command",
                &format!(
                    "Expand-Archive -Path '{}' -DestinationPath '{}' -Force",
                    zip_path.display(),
                    extract_to.display()
                ),
            ])
            .output()
            .map_err(|e| format!("Extract: {}", e))?;
        if !out.status.success() {
            return Err(format!("Extract fail: {}", String::from_utf8_lossy(&out.stderr)));
        }

        // Deno zip chỉ chứa 1 file deno.exe ở root
        let src = extract_to.join("deno.exe");
        let dst = bin_dir.join("deno.exe");
        if !src.exists() {
            return Err("Không tìm thấy deno.exe trong zip".to_string());
        }
        std::fs::copy(&src, &dst).map_err(|e| format!("Copy: {}", e))?;

        let _ = std::fs::remove_dir_all(&extract_to);
        let _ = std::fs::remove_file(&zip_path);

        let _ = app.emit(
            "deno-install:progress",
            serde_json::json!({ "status": "done", "path": dst.to_string_lossy() }),
        );

        Ok(dst.to_string_lossy().to_string())
    }
}

/// Wave 74.1 / 74.2 — List items trong Google Drive folder (public).
///
/// yt-dlp googledrive folder extractor có bug "expected string or bytes-like
/// object" (issue đã biết). Thay vào đó scrape HTML từ endpoint chính thức:
///
///   https://drive.google.com/embeddedfolderview?id={FOLDER_ID}#list
///
/// Endpoint này trả về HTML đơn giản với links `/file/d/{ID}/view` cho từng
/// file trong folder. Yêu cầu folder PUBLIC (share "Anyone with link").
#[derive(Serialize, Deserialize)]
pub struct GDriveItem {
    pub id: String,
    pub title: String,
    pub url: String,
}

fn extract_folder_id(url: &str) -> Option<String> {
    // Tìm "/drive/folders/" rồi lấy ID kế tiếp đến `?`, `/`, hoặc end.
    let needle = "/drive/folders/";
    let start = url.find(needle)? + needle.len();
    let rest = &url[start..];
    let end = rest
        .find(|c: char| c == '?' || c == '/' || c == '&' || c == '#')
        .unwrap_or(rest.len());
    let id = &rest[..end];
    if id.is_empty() {
        None
    } else {
        Some(id.to_string())
    }
}

/// Decode HTML entities cơ bản (&amp; &lt; &gt; &quot; &#39;).
fn html_decode(s: &str) -> String {
    s.replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&#34;", "\"")
}

#[tauri::command]
async fn list_gdrive_folder_items(url: String) -> Result<Vec<GDriveItem>, String> {
    let folder_id = extract_folder_id(&url)
        .ok_or_else(|| "Không trích xuất được folder ID từ URL".to_string())?;

    let view_url = format!(
        "https://drive.google.com/embeddedfolderview?id={}#list",
        folder_id
    );

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) TrishDrive/1.0")
        .build()
        .map_err(|e| format!("HTTP client init fail: {}", e))?;

    let resp = client
        .get(&view_url)
        .send()
        .await
        .map_err(|e| format!("Fetch folder fail: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!(
            "HTTP {} — folder có thể không public hoặc không tồn tại.",
            resp.status().as_u16()
        ));
    }

    let html = resp
        .text()
        .await
        .map_err(|e| format!("Đọc HTML fail: {}", e))?;

    // Page có chứa cụm "permission" nếu folder không public
    if html.contains("permissionDenied") || html.contains("You need permission")
        || html.contains("Truy cập bị từ chối") || html.contains("Bạn cần quyền")
    {
        return Err(
            "Folder không public — hãy chia sẻ với \"Anyone with the link\" rồi thử lại."
                .to_string(),
        );
    }

    // Parse từng entry. HTML pattern cho mỗi file:
    //   href="https://drive.google.com/file/d/<ID>/view?usp=drive_link"
    //   ...
    //   <div class="flip-entry-title">TITLE</div>
    //
    // Strategy: split theo href pattern, mỗi chunk chứa 1 file. Trong chunk
    // tìm flip-entry-title nếu có.
    let split_marker = "https://drive.google.com/file/d/";
    let mut items: Vec<GDriveItem> = Vec::new();
    let mut seen: std::collections::HashSet<String> = std::collections::HashSet::new();

    for chunk in html.split(split_marker).skip(1) {
        // chunk bắt đầu bằng FILE_ID, kết thúc bằng `/view...`
        let id_end = chunk.find('/').unwrap_or(0);
        if id_end == 0 || id_end > 80 {
            continue;
        }
        let file_id = &chunk[..id_end];
        // Validate file ID format (Google Drive IDs: alphanumeric + _ -)
        if !file_id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
        {
            continue;
        }
        if seen.contains(file_id) {
            continue;
        }
        seen.insert(file_id.to_string());

        // Tìm title trong cùng chunk (giới hạn 4000 ký tự sau href để tránh lấy từ entry kế)
        let search_window_end = chunk.len().min(4000);
        let window = &chunk[..search_window_end];
        let title = extract_title(window).unwrap_or_else(|| format!("File {}", &file_id[..6.min(file_id.len())]));

        items.push(GDriveItem {
            id: file_id.to_string(),
            title,
            url: format!("https://drive.google.com/file/d/{}/view", file_id),
        });
    }

    if items.is_empty() {
        return Err(
            "Không tìm thấy file nào trong folder. Có thể folder rỗng hoặc embeddedfolderview bị Google chặn — hãy thử mở folder trong incognito để kiểm tra public access."
                .to_string(),
        );
    }

    Ok(items)
}

fn extract_title(html_chunk: &str) -> Option<String> {
    // Tìm `<div class="flip-entry-title">TITLE</div>`
    let marker = "flip-entry-title\">";
    let start = html_chunk.find(marker)? + marker.len();
    let rest = &html_chunk[start..];
    let end = rest.find("</div>")?;
    let raw = rest[..end].trim();
    if raw.is_empty() {
        return None;
    }
    let decoded = html_decode(raw);
    // Giới hạn 200 ký tự để tránh anomaly
    Some(decoded.chars().take(200).collect())
}

/// Wave 74.3 — Tải Google Drive file trực tiếp qua drive.usercontent.google.com.
///
/// yt-dlp googledrive download có bug HTTP 400 với 1 số file. Endpoint
/// `drive.usercontent.google.com/download?id=ID&export=download&confirm=t`
/// ổn định hơn, hỗ trợ cả file nhỏ và file lớn (>100MB).
///
/// Emit event `gdrive:progress` mỗi 200ms với { item_id, percent, downloaded,
/// total, speed, eta } để frontend cập nhật UI realtime.
#[tauri::command]
async fn download_gdrive_file(
    app: tauri::AppHandle,
    item_id: String,
    file_id: String,
    output_dir: String,
    suggested_name: Option<String>,
) -> Result<MediaDownloadResult, String> {
    use futures_util::StreamExt;
    use tokio::io::AsyncWriteExt;

    // Tạo output dir nếu chưa tồn tại
    let out_dir = std::path::PathBuf::from(&output_dir);
    if !out_dir.exists() {
        std::fs::create_dir_all(&out_dir)
            .map_err(|e| format!("Tạo thư mục output fail: {}", e))?;
    }

    let primary_url = format!(
        "https://drive.usercontent.google.com/download?id={}&export=download&confirm=t",
        file_id
    );

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(3600))
        .connect_timeout(std::time::Duration::from_secs(20))
        .redirect(reqwest::redirect::Policy::limited(10))
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) TrishDrive/1.0")
        .build()
        .map_err(|e| format!("HTTP client init fail: {}", e))?;

    let mut resp = client
        .get(&primary_url)
        .send()
        .await
        .map_err(|e| format!("Request fail: {}", e))?;

    // Nếu Google trả HTML confirm page (file >100MB), parse form và retry
    let ct = resp
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_string();

    if ct.contains("text/html") {
        let html = resp
            .text()
            .await
            .map_err(|e| format!("Đọc confirm page fail: {}", e))?;

        // Parse form action + hidden inputs (id, export, authuser, confirm, uuid)
        let confirm_url = parse_confirm_form_url(&html, &file_id);
        let confirm_url = confirm_url.unwrap_or_else(|| {
            // Fallback: append &confirm=1 (cũ) hoặc &acknowledgeAbuse=true
            format!(
                "https://drive.usercontent.google.com/download?id={}&export=download&confirm=t&acknowledgeAbuse=true",
                file_id
            )
        });

        resp = client
            .get(&confirm_url)
            .send()
            .await
            .map_err(|e| format!("Confirm request fail: {}", e))?;

        let ct2 = resp
            .headers()
            .get("content-type")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("")
            .to_string();

        if ct2.contains("text/html") {
            return Err(format!(
                "Google trả HTML thay vì binary — có thể file quá lớn / cần đăng nhập / không public. File ID: {}",
                file_id
            ));
        }
    }

    if !resp.status().is_success() {
        return Err(format!(
            "HTTP {} từ Google Drive cho file {}",
            resp.status().as_u16(),
            file_id
        ));
    }

    // Lấy filename: ưu tiên Content-Disposition, fallback suggested_name, fallback file_id.bin
    let filename = extract_filename_from_headers(resp.headers())
        .or(suggested_name)
        .unwrap_or_else(|| format!("{}.bin", file_id));
    let filename = sanitize_filename(&filename);

    // Resolve conflict — append (1), (2) nếu trùng
    let final_path = unique_path(&out_dir, &filename);

    let total = resp.content_length().unwrap_or(0);
    let mut downloaded: u64 = 0;
    let start_time = std::time::Instant::now();
    let mut last_emit = std::time::Instant::now();

    let mut file = tokio::fs::File::create(&final_path)
        .await
        .map_err(|e| format!("Tạo file output fail: {}", e))?;

    let mut stream = resp.bytes_stream();
    while let Some(chunk_res) = stream.next().await {
        let chunk = chunk_res.map_err(|e| format!("Stream chunk lỗi: {}", e))?;
        file.write_all(&chunk)
            .await
            .map_err(|e| format!("Ghi file lỗi: {}", e))?;
        downloaded += chunk.len() as u64;

        if last_emit.elapsed().as_millis() >= 200 {
            emit_gdrive_progress(&app, &item_id, downloaded, total, start_time);
            last_emit = std::time::Instant::now();
        }
    }

    file.flush()
        .await
        .map_err(|e| format!("Flush file lỗi: {}", e))?;

    // Emit final 100%
    emit_gdrive_progress(&app, &item_id, downloaded.max(total), total, start_time);

    Ok(MediaDownloadResult {
        ok: true,
        output_path: Some(final_path.to_string_lossy().to_string()),
        stdout: format!("Downloaded {} bytes", downloaded),
        stderr: String::new(),
    })
}

fn emit_gdrive_progress(
    app: &tauri::AppHandle,
    item_id: &str,
    downloaded: u64,
    total: u64,
    start_time: std::time::Instant,
) {
    let elapsed = start_time.elapsed().as_secs_f64().max(0.001);
    let speed_bps = downloaded as f64 / elapsed;
    let percent = if total > 0 {
        ((downloaded as f64 / total as f64) * 100.0).min(100.0)
    } else {
        0.0
    };
    let eta_sec = if speed_bps > 0.0 && total > downloaded {
        (total - downloaded) as f64 / speed_bps
    } else {
        0.0
    };
    let speed_str = if speed_bps >= 1_000_000.0 {
        format!("{:.1} MB/s", speed_bps / 1_000_000.0)
    } else if speed_bps >= 1_000.0 {
        format!("{:.0} KB/s", speed_bps / 1_000.0)
    } else {
        format!("{:.0} B/s", speed_bps)
    };
    let eta_str = if eta_sec >= 60.0 {
        format!("{}m{}s", (eta_sec / 60.0) as u64, (eta_sec % 60.0) as u64)
    } else {
        format!("{:.0}s", eta_sec)
    };
    let _ = app.emit(
        "gdrive:progress",
        serde_json::json!({
            "item_id": item_id,
            "percent": format!("{:.1}%", percent),
            "downloaded": downloaded,
            "total": total,
            "speed": speed_str,
            "eta": eta_str,
        }),
    );
}

/// Parse confirm form URL từ HTML page (file lớn cần acknowledge).
fn parse_confirm_form_url(html: &str, file_id: &str) -> Option<String> {
    // Form pattern: <form id="download-form" action="..." method="get">
    //   <input name="id" value="..."> ...
    let form_start = html.find("id=\"download-form\"")?;
    let after_form = &html[form_start..];
    let action_marker = "action=\"";
    let action_start = after_form.find(action_marker)? + action_marker.len();
    let action_rest = &after_form[action_start..];
    let action_end = action_rest.find('"')?;
    let action = html_decode(&action_rest[..action_end]);

    // Collect hidden inputs
    let mut params: Vec<(String, String)> = Vec::new();
    let mut search_pos = 0;
    while let Some(input_start) = after_form[search_pos..].find("<input ") {
        let abs = search_pos + input_start;
        let input_end = after_form[abs..].find('>').map(|e| abs + e).unwrap_or(abs);
        let input_tag = &after_form[abs..input_end];
        // Extract name + value
        let name = extract_attr(input_tag, "name");
        let value = extract_attr(input_tag, "value");
        if let (Some(n), Some(v)) = (name, value) {
            params.push((n, html_decode(&v)));
        }
        search_pos = input_end + 1;
        // Break nếu đến hết form
        if let Some(form_end) = after_form[abs..].find("</form>") {
            if form_end < input_end - abs {
                break;
            }
        }
    }

    if params.is_empty() {
        // Fallback: just append id + confirm
        return Some(format!(
            "{}?id={}&export=download&confirm=t",
            action, file_id
        ));
    }

    let qs: Vec<String> = params
        .into_iter()
        .map(|(k, v)| format!("{}={}", urlencode(&k), urlencode(&v)))
        .collect();
    Some(format!("{}?{}", action, qs.join("&")))
}

fn extract_attr(tag: &str, attr: &str) -> Option<String> {
    let marker = format!("{}=\"", attr);
    let start = tag.find(&marker)? + marker.len();
    let rest = &tag[start..];
    let end = rest.find('"')?;
    Some(rest[..end].to_string())
}

fn urlencode(s: &str) -> String {
    s.bytes()
        .map(|b| match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                (b as char).to_string()
            }
            _ => format!("%{:02X}", b),
        })
        .collect()
}

fn extract_filename_from_headers(headers: &reqwest::header::HeaderMap) -> Option<String> {
    let cd = headers.get("content-disposition")?.to_str().ok()?;
    // Format: `attachment; filename="..."` or `filename*=UTF-8''encoded`
    if let Some(idx) = cd.find("filename*=UTF-8''") {
        let rest = &cd[idx + "filename*=UTF-8''".len()..];
        let end = rest.find(|c: char| c == ';' || c == '\n').unwrap_or(rest.len());
        // URL-decode percent escapes
        let raw = &rest[..end];
        return Some(urldecode(raw));
    }
    if let Some(idx) = cd.find("filename=\"") {
        let rest = &cd[idx + "filename=\"".len()..];
        let end = rest.find('"')?;
        return Some(rest[..end].to_string());
    }
    None
}

fn urldecode(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let bytes = s.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            let hex = &s[i + 1..i + 3];
            if let Ok(b) = u8::from_str_radix(hex, 16) {
                out.push(b as char);
                i += 3;
                continue;
            }
        }
        out.push(bytes[i] as char);
        i += 1;
    }
    out
}

fn unique_path(dir: &std::path::Path, filename: &str) -> std::path::PathBuf {
    let candidate = dir.join(filename);
    if !candidate.exists() {
        return candidate;
    }
    let stem = std::path::Path::new(filename)
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| filename.to_string());
    let ext = std::path::Path::new(filename)
        .extension()
        .map(|s| format!(".{}", s.to_string_lossy()))
        .unwrap_or_default();
    for i in 1..1000 {
        let candidate = dir.join(format!("{} ({}){}", stem, i, ext));
        if !candidate.exists() {
            return candidate;
        }
    }
    dir.join(filename)
}

/// Update yt-dlp local bundled (gọi `yt-dlp -U`).
#[tauri::command]
async fn update_ytdlp(app: tauri::AppHandle) -> Result<String, String> {
    let cmd = resolve_ytdlp_cmd(&app);
    let out = std::process::Command::new(&cmd)
        .arg("-U")
        .output()
        .map_err(|e| format!("yt-dlp -U fail: {}", e))?;
    let stdout = String::from_utf8_lossy(&out.stdout).to_string();
    let stderr = String::from_utf8_lossy(&out.stderr).to_string();
    if !out.status.success() {
        return Err(format!("Update fail: {}\n{}", stderr, stdout));
    }
    Ok(stdout)
}

/// Check if yt-dlp binary is available (local bundled OR PATH).
#[tauri::command]
fn check_ytdlp_available(app: tauri::AppHandle) -> Result<bool, String> {
    let cmd = resolve_ytdlp_cmd(&app);
    match std::process::Command::new(&cmd).arg("--version").output() {
        Ok(out) => Ok(out.status.success()),
        Err(_) => Ok(false),
    }
}

/// Auto-install yt-dlp vào AppData (chỉ Windows hỗ trợ binary single .exe).
/// Tải từ GitHub releases (latest). Trả path đã lưu.
#[tauri::command]
async fn install_ytdlp(app: tauri::AppHandle) -> Result<String, String> {
    #[cfg(not(target_os = "windows"))]
    {
        return Err("Auto-install chỉ hỗ trợ Windows. macOS/Linux dùng: brew install yt-dlp / apt install yt-dlp".to_string());
    }

    #[cfg(target_os = "windows")]
    {
        let target = ytdlp_local_path(&app)?;
        let url = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe";

        let _ = app.emit(
            "ytdlp-install:progress",
            serde_json::json!({ "status": "downloading", "url": url }),
        );

        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(120))
            .user_agent(concat!("TrishDrive/", env!("CARGO_PKG_VERSION")))
            .build()
            .map_err(|e| format!("Tạo HTTP client fail: {}", e))?;

        let resp = client
            .get(url)
            .send()
            .await
            .map_err(|e| format!("Download fail: {}", e))?;

        if !resp.status().is_success() {
            return Err(format!("HTTP {} từ GitHub", resp.status().as_u16()));
        }

        let bytes = resp
            .bytes()
            .await
            .map_err(|e| format!("Đọc body fail: {}", e))?;

        std::fs::write(&target, &bytes)
            .map_err(|e| format!("Ghi file {} fail: {}", target.display(), e))?;

        let _ = app.emit(
            "ytdlp-install:progress",
            serde_json::json!({ "status": "done", "path": target.to_string_lossy() }),
        );

        Ok(target.to_string_lossy().to_string())
    }
}

#[derive(Serialize, Deserialize)]
pub struct MediaDownloadResult {
    pub ok: bool,
    pub output_path: Option<String>,
    pub stdout: String,
    pub stderr: String,
}

/// Download video/audio từ social media (FB/TikTok/YouTube/IG/Twitter) qua yt-dlp.
///
/// args:
///   - url: URL video
///   - quality: 'best' | '1080p' | '720p' | '480p' | 'audio'
///   - output_dir: thư mục lưu file (frontend tự lấy via Tauri path API)
///   - remove_watermark: true để gọi yt-dlp với extractor-args remove_watermark (chỉ TikTok)
#[tauri::command]
async fn download_social_media(
    app: tauri::AppHandle,
    url: String,
    quality: String,
    output_dir: String,
    remove_watermark: bool,
    download_playlist: Option<bool>,
    cookies_browser: Option<String>,
    cookies_file: Option<String>,
    output_format: Option<String>,
    playlist_items: Option<String>,
    skip_duplicates: Option<bool>,
    subtitles: Option<String>,
) -> Result<MediaDownloadResult, String> {
    let cmd_name = resolve_ytdlp_cmd(&app);

    // Output template: với playlist → tạo subfolder theo title playlist
    let output_template = if download_playlist.unwrap_or(false) {
        format!("{}/%(playlist_title|Playlist)s/%(playlist_index)03d - %(title)s.%(ext)s", output_dir)
    } else {
        format!("{}/%(title)s.%(ext)s", output_dir)
    };

    let mut args: Vec<String> = vec![
        url.clone(),
        "-o".to_string(),
        output_template.clone(),
        "--newline".to_string(), // progress newline-delimited
        "--no-warnings".to_string(),
        // Phase 40.16 — Custom progress template để parse % và bytes
        "--progress-template".to_string(),
        "download:[TRISH_PROGRESS]%(progress._percent_str)s|%(progress._downloaded_bytes_str)s|%(progress._total_bytes_str)s|%(progress._speed_str)s|%(progress._eta_str)s".to_string(),
        // Phase 40.21 — YouTube anti-bot bypass: dùng player_client tv/ios/android
        // (không yêu cầu JS runtime để solve n-sig challenge)
        "--extractor-args".to_string(),
        "youtube:player_client=tv,ios,web;youtube:formats=missing_pot".to_string(),
    ];

    // Phase 40.18 — Pass ffmpeg location nếu đã cài local
    if let Ok(ffmpeg) = ffmpeg_local_path(&app) {
        if ffmpeg.exists() {
            args.push("--ffmpeg-location".to_string());
            args.push(ffmpeg.parent().unwrap_or(&ffmpeg).to_string_lossy().to_string());
        }
    }

    // Phase 40.22 — Pass Deno location (cho n-sig JS challenge)
    if let Ok(deno) = deno_local_path(&app) {
        if deno.exists() {
            args.push("--js-runtimes".to_string());
            args.push(format!("deno:{}", deno.to_string_lossy()));
        }
    }

    // Phase 40.16 + 40.17 + 40.19 — Cookies cho private video.
    // Ưu tiên: cookies_file > cookies_browser. Nếu CẢ HAI cùng pass, yt-dlp lỗi
    // → chỉ dùng 1 nguồn.
    let has_file = cookies_file.as_ref().map(|s| !s.is_empty()).unwrap_or(false);
    if has_file {
        if let Some(file) = cookies_file.as_ref() {
            args.push("--cookies".to_string());
            args.push(file.clone());
        }
    } else if let Some(browser) = cookies_browser.as_ref() {
        if !browser.is_empty() && browser != "none" {
            args.push("--cookies-from-browser".to_string());
            args.push(browser.clone());
        }
    }

    // Phase 40.17 — Output format override (mp4 / webm / mkv / mp3 / m4a / opus)
    if let Some(fmt) = output_format.as_ref() {
        if !fmt.is_empty() && fmt != "auto" {
            // Audio formats — convert sau khi tải
            if fmt == "mp3" || fmt == "m4a" || fmt == "opus" || fmt == "wav" || fmt == "flac" {
                args.push("-x".to_string());
                args.push("--audio-format".to_string());
                args.push(fmt.clone());
            } else {
                // Video: merge into format
                args.push("--merge-output-format".to_string());
                args.push(fmt.clone());
                args.push("--remux-video".to_string());
                args.push(fmt.clone());
            }
        }
    }

    // Default: no-playlist trừ khi user opt-in
    if !download_playlist.unwrap_or(false) {
        args.push("--no-playlist".to_string());
    } else {
        args.push("--yes-playlist".to_string());
    }

    // Phase 40.23 — Range playlist (vd "1-10" hoặc "1,3,5")
    if let Some(items) = playlist_items.as_ref() {
        if !items.is_empty() {
            args.push("--playlist-items".to_string());
            args.push(items.clone());
        }
    }

    // Phase 40.23 — Skip video đã tải (lưu archive trong output_dir)
    if skip_duplicates.unwrap_or(false) {
        args.push("--download-archive".to_string());
        args.push(format!("{}/.trishdrive_archive.txt", output_dir));
    }

    // Phase 40.23 — Subtitle: "none" / "auto" (auto-gen) / "manual" (sub gốc)
    if let Some(sub) = subtitles.as_ref() {
        if sub == "manual" {
            args.push("--write-subs".to_string());
            args.push("--sub-langs".to_string());
            args.push("vi,en".to_string());
            args.push("--convert-subs".to_string());
            args.push("srt".to_string());
        } else if sub == "auto" {
            args.push("--write-auto-subs".to_string());
            args.push("--sub-langs".to_string());
            args.push("vi,en".to_string());
            args.push("--convert-subs".to_string());
            args.push("srt".to_string());
        }
    }

    // Phase 40.20 — Quality / format với fallback CỰC bền:
    // Thay vì bv*+ba (cần ffmpeg merge), dùng `best` (single format, không cần merge).
    // Cuối cùng fallback `*` = ANY format yt-dlp có thể tải.
    match quality.as_str() {
        "audio" => {
            args.push("-x".to_string()); // extract audio
            args.push("--audio-format".to_string());
            args.push("mp3".to_string());
        }
        "1080p" => {
            args.push("-f".to_string());
            args.push("best[height<=1080]/bv*[height<=1080]+ba/best/bv*+ba/*".to_string());
        }
        "720p" => {
            args.push("-f".to_string());
            args.push("best[height<=720]/bv*[height<=720]+ba/best/bv*+ba/*".to_string());
        }
        "480p" => {
            args.push("-f".to_string());
            args.push("best[height<=480]/bv*[height<=480]+ba/best/bv*+ba/*".to_string());
        }
        _ => {
            // best (default) — bỏ -f hoàn toàn, để yt-dlp tự chọn (an toàn nhất)
            // Không push gì vào args → yt-dlp default = bv*+ba/b
        }
    }

    // TikTok watermark removal (yt-dlp default đã tải bản no-watermark cho TikTok)
    if !remove_watermark && url.to_lowercase().contains("tiktok.com") {
        // Nếu user muốn GIỮ watermark → dùng format có watermark
        // (yt-dlp default đã pick no-watermark, không cần arg)
    }

    let _ = app.emit(
        "media-download:progress",
        serde_json::json!({ "url": url, "status": "starting" }),
    );

    // Phase 40.16 — Spawn + stream stdout để parse progress realtime
    use std::io::BufRead;
    use std::process::Stdio;

    let mut child = std::process::Command::new(&cmd_name)
        .args(&args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| {
            format!(
                "Không chạy được yt-dlp ({}): {}\n\nBấm 'Cài yt-dlp tự động' bên dưới để tải về.",
                cmd_name, e
            )
        })?;

    let stdout_handle = child.stdout.take();
    let stderr_handle = child.stderr.take();

    let mut stdout_lines = String::new();
    if let Some(out) = stdout_handle {
        let reader = std::io::BufReader::new(out);
        for line in reader.lines().flatten() {
            stdout_lines.push_str(&line);
            stdout_lines.push('\n');

            // Phase 40.16 — Parse progress markers
            if let Some(rest) = line.strip_prefix("[TRISH_PROGRESS]") {
                // Format: %|bytes|total|speed|eta
                let parts: Vec<&str> = rest.split('|').collect();
                if parts.len() >= 5 {
                    let _ = app.emit(
                        "media-download:progress",
                        serde_json::json!({
                            "url": url,
                            "status": "downloading",
                            "percent": parts[0].trim(),
                            "downloaded": parts[1].trim(),
                            "total": parts[2].trim(),
                            "speed": parts[3].trim(),
                            "eta": parts[4].trim(),
                        }),
                    );
                }
                continue;
            }

            // Detect destination / merger output
            if let Some(p) = line
                .trim()
                .strip_prefix("[download] Destination: ")
                .or_else(|| line.trim().strip_prefix("[Merger] Merging formats into \""))
            {
                let path = p.trim_end_matches('"').to_string();
                let _ = app.emit(
                    "media-download:progress",
                    serde_json::json!({ "url": url, "status": "saving", "path": path }),
                );
            }
        }
    }

    let mut stderr_text = String::new();
    if let Some(err) = stderr_handle {
        use std::io::Read;
        let mut reader = std::io::BufReader::new(err);
        let _ = reader.read_to_string(&mut stderr_text);
    }

    let exit_status = child.wait().map_err(|e| format!("wait fail: {}", e))?;
    let stdout = stdout_lines;
    let stderr = stderr_text;

    if !exit_status.success() {
        let _ = app.emit(
            "media-download:progress",
            serde_json::json!({ "url": url, "status": "error", "error": stderr.clone() }),
        );
        return Ok(MediaDownloadResult {
            ok: false,
            output_path: None,
            stdout,
            stderr,
        });
    }

    // Try parse output path từ stdout dòng "[download] Destination: ..."
    let output_path = stdout
        .lines()
        .filter_map(|line| {
            line.trim()
                .strip_prefix("[download] Destination: ")
                .or_else(|| line.trim().strip_prefix("[Merger] Merging formats into \""))
                .map(|p| p.trim_end_matches('"').to_string())
        })
        .last();

    let _ = app.emit(
        "media-download:progress",
        serde_json::json!({ "url": url, "status": "done", "path": output_path.clone() }),
    );

    Ok(MediaDownloadResult {
        ok: true,
        output_path,
        stdout,
        stderr,
    })
}

// ============================================================
// Phase 60 — Real implementations migrate vào src/clean.rs, src/check.rs,
// src/font.rs, src/shortcut.rs. Stubs Phase 56-57 đã bỏ.
// ============================================================

/// Phase 60 — HTTP GET text helper dùng cho Font manifest + Check specs-loader.
#[tauri::command]
async fn fetch_text(url: String) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| format!("HTTP client init: {}", e))?;
    let resp = client.get(&url).send().await.map_err(|e| format!("fetch {}: {}", url, e))?;
    if !resp.status().is_success() {
        return Err(format!("HTTP {} từ {}", resp.status(), url));
    }
    resp.text().await.map_err(|e| format!("body: {}", e))
}

#[cfg(any())] mod _placeholder_unused_keep_phase_60 {

/// HTTP GET text (cho Font fetchManifest + Check specs-loader).
#[tauri::command]
async fn fetch_text(url: String) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| format!("HTTP client init: {}", e))?;
    let resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Fetch {}: {}", url, e))?;
    if !resp.status().is_success() {
        return Err(format!("HTTP {} từ {}", resp.status(), url));
    }
    resp.text().await.map_err(|e| format!("Đọc body: {}", e))
}

/// Disk usage stub — Clean module check disk free space.
/// Phase 58.1: TS invoke không truyền args nên Rust không nhận param.
#[tauri::command]
fn disk_usage() -> serde_json::Value {
    serde_json::json!({
        "mount": "C:",
        "total_bytes": 0u64,
        "used_bytes": 0u64,
        "free_bytes": 0u64,
        "used_percent": 0.0,
    })
}

/// Sys report stub — Check module hiển thị system info.
#[tauri::command]
fn sys_report() -> serde_json::Value {
    serde_json::json!({
        "os": { "name": "Windows", "version": "?" },
        "cpu": { "brand": "N/A (dev mode)", "cores_physical": 0, "cores_logical": 0, "mhz": 0u64 },
        "memory": { "total_bytes": 0u64, "used_bytes": 0u64, "swap_total_bytes": 0u64, "swap_used_bytes": 0u64 },
        "disks": [],
        "networks": [],
        "gpus": [],
        "hostname": "dev",
        "uptime_secs": 0u64,
    })
}

/// Battery info stub.
#[tauri::command]
fn battery_info() -> serde_json::Value {
    serde_json::json!({
        "has_battery": false,
        "percent": 0,
        "charging": false,
        "time_remaining_secs": serde_json::Value::Null,
    })
}

/// Top processes stub — Check module hiển thị top apps.
#[tauri::command]
fn top_processes(_limit: Option<usize>) -> serde_json::Value {
    serde_json::json!({ "by_cpu": [], "by_memory": [] })
}

/// CPU benchmark stub — shape khớp BenchResult { throughput_mb_per_s, bytes_processed, elapsed_ms }.
#[tauri::command]
fn cpu_benchmark(rounds: Option<u32>) -> serde_json::Value {
    let _ = rounds;
    serde_json::json!({
        "throughput_mb_per_s": 0.0,
        "bytes_processed": 0u64,
        "elapsed_ms": 0u64,
    })
}

/// Memory bandwidth stub — cùng shape BenchResult.
#[tauri::command]
fn memory_bandwidth(rounds: Option<u32>) -> serde_json::Value {
    let _ = rounds;
    serde_json::json!({
        "throughput_mb_per_s": 0.0,
        "bytes_processed": 0u64,
        "elapsed_ms": 0u64,
    })
}

/// Disk benchmark stub — DiskBenchResult shape.
#[tauri::command]
fn disk_benchmark(size_mb: Option<u32>) -> Result<serde_json::Value, String> {
    let _ = size_mb;
    Ok(serde_json::json!({
        "read_throughput_mb_per_s": 0.0,
        "write_throughput_mb_per_s": 0.0,
        "bytes_processed": 0u64,
        "elapsed_ms": 0u64,
    }))
}

/// Scan installed software stub — Check module check phần mềm cài đặt.
#[tauri::command]
fn scan_installed_software() -> Result<Vec<serde_json::Value>, String> {
    Ok(Vec::new())
}

/// Save report stub — Check module xuất report.
#[tauri::command]
fn save_report(_path: String, _content: String) -> Result<(), String> {
    Ok(())
}

/// Shortcut scan: Desktop / Start Menu / Installed apps — return empty.
#[tauri::command]
fn scan_desktop() -> Result<Vec<serde_json::Value>, String> {
    Ok(Vec::new())
}
#[tauri::command]
fn scan_start_menu() -> Result<Vec<serde_json::Value>, String> {
    Ok(Vec::new())
}
#[tauri::command]
fn scan_installed() -> Result<Vec<serde_json::Value>, String> {
    Ok(Vec::new())
}

/// Font: list system fonts stub.
#[tauri::command]
fn list_system_fonts() -> Result<Vec<String>, String> {
    Ok(Vec::new())
}

/// Font: download pack stub.
#[tauri::command]
async fn fetch_font_manifest(url: String) -> Result<String, String> {
    fetch_text(url).await
}

// ============================================================
// Phase 57.2 — Stub các commands còn thiếu (audit từ TS invoke list)
// Tất cả return giá trị an toàn để TS code không crash.
// Full implementations sẽ migrate từ archive sau Wave 58+.
// ============================================================

// ---- Font module ----
#[tauri::command]
fn is_admin() -> bool { false }

#[tauri::command]
fn scan_system_fonts() -> Result<Vec<serde_json::Value>, String> {
    Ok(Vec::new())
}

#[tauri::command]
fn scan_fonts(path: String) -> Result<Vec<serde_json::Value>, String> {
    let _ = path;
    Ok(Vec::new())
}

#[tauri::command]
fn read_font(path: String) -> Result<serde_json::Value, String> {
    let _ = path;
    Ok(serde_json::json!({ "name": "", "family": "", "style": "", "size_bytes": 0u64 }))
}

#[tauri::command]
fn install_fonts(paths: Vec<String>) -> Result<serde_json::Value, String> {
    let _ = paths;
    Ok(serde_json::json!({ "installed": 0, "skipped": 0, "errors": [] }))
}

#[tauri::command]
fn install_shx_fonts(paths: Vec<String>, autocad_dir: String) -> Result<serde_json::Value, String> {
    let _ = (paths, autocad_dir);
    Ok(serde_json::json!({ "installed": 0, "errors": [] }))
}

#[tauri::command]
fn export_fonts_to_folder(paths: Vec<String>, dest: String) -> Result<u64, String> {
    let _ = (paths, dest);
    Ok(0)
}

#[tauri::command]
fn detect_autocad_dirs() -> Result<Vec<String>, String> {
    Ok(Vec::new())
}

#[tauri::command]
fn clear_all_packs() -> Result<(), String> { Ok(()) }

#[tauri::command]
fn delete_pack(pack_id: String) -> Result<(), String> {
    let _ = pack_id;
    Ok(())
}

#[tauri::command]
fn download_and_install_pack(pack_id: String, url: String) -> Result<serde_json::Value, String> {
    let _ = (pack_id, url);
    Err("Chưa cấu hình Rust backend cho TrishFont. Tính năng sẽ có trong bản cập nhật tiếp theo.".to_string())
}

#[tauri::command]
fn get_packs_folder_info() -> Result<serde_json::Value, String> {
    Ok(serde_json::json!({ "path": "", "size_bytes": 0u64, "pack_count": 0 }))
}

#[tauri::command]
fn list_pack_files(pack_id: String) -> Result<Vec<serde_json::Value>, String> {
    let _ = pack_id;
    Ok(Vec::new())
}

// ---- Clean module ----
#[tauri::command]
fn list_clean_presets() -> Result<Vec<serde_json::Value>, String> {
    Ok(Vec::new())
}

#[tauri::command]
fn list_trash_sessions() -> Result<Vec<serde_json::Value>, String> {
    Ok(Vec::new())
}

#[tauri::command]
fn move_to_trash(paths: Vec<String>) -> Result<serde_json::Value, String> {
    let _ = paths;
    // MoveToTrashResult { session_id, session_dir, items_moved, total_size_bytes, errors }
    Ok(serde_json::json!({
        "session_id": "",
        "session_dir": "",
        "items_moved": 0,
        "total_size_bytes": 0u64,
        "errors": [],
    }))
}

#[tauri::command]
fn purge_session(session_id: String) -> Result<u64, String> {
    let _ = session_id;
    Ok(0)
}

#[tauri::command]
fn purge_old_sessions(retention_days: u32) -> Result<u64, String> {
    let _ = retention_days;
    Ok(0)
}

#[tauri::command]
fn restore_session(session_id: String) -> Result<u64, String> {
    let _ = session_id;
    Ok(0)
}

#[tauri::command]
fn scan_autocad_junk() -> Result<Vec<serde_json::Value>, String> {
    Ok(Vec::new())
}

#[tauri::command]
fn scan_dir(path: String, recursive: Option<bool>) -> Result<serde_json::Value, String> {
    let _ = (path, recursive);
    // ScanStats { entries, total_size_bytes, truncated, elapsed_ms, errors }
    Ok(serde_json::json!({
        "entries": [],
        "total_size_bytes": 0u64,
        "truncated": false,
        "elapsed_ms": 0u64,
        "errors": 0,
    }))
}

// ---- Shortcut module ----
#[tauri::command]
fn scan_installed_apps() -> Result<Vec<serde_json::Value>, String> {
    Ok(Vec::new())
}

#[tauri::command]
fn launch_shortcut(target: String, args: Option<Vec<String>>) -> Result<(), String> {
    let _ = (target, args);
    Err("Chưa cấu hình Rust backend cho launch_shortcut.".to_string())
}

#[tauri::command]
fn parse_lnk(path: String) -> Result<serde_json::Value, String> {
    let _ = path;
    Ok(serde_json::json!({ "target": "", "args": "", "icon_path": "", "working_dir": "" }))
}

#[tauri::command]
fn extract_icon_from_exe(path: String) -> Result<Option<String>, String> {
    let _ = path;
    Ok(None)
}

#[tauri::command]
fn open_in_explorer(path: String) -> Result<(), String> {
    let _ = path;
    Ok(())
}
} // end mod _placeholder_unused_keep_phase_60

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    use tauri::{
        menu::{Menu, MenuItem},
        tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
        Manager,
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        // Phase 26.5.F — Auto-update plugin. Cần Trí setup RSA key:
        //   1. `pnpm tauri signer generate -w ~/.tauri/trishdrive.key`
        //   2. Lưu pubkey vào tauri.conf.json plugins.updater.pubkey
        //   3. Khi release: sign installer với private key
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(SpeedLimit::default())
        .manage(DownloadControl::default())
        .manage(WebDavServerState::default())
        .invoke_handler(tauri::generate_handler![
            // Phase 40.6 + 40.10 + 40.18 + 40.21 — Social media downloader (yt-dlp + ffmpeg + node)
            check_ytdlp_available,
            install_ytdlp,
            update_ytdlp,
            check_ffmpeg_available,
            install_ffmpeg,
            check_nodejs_available,
            check_deno_available,
            install_deno,
            download_social_media,
            list_gdrive_folder_items,
            download_gdrive_file,
            app_version,
            ping,
            exit_app,
            hide_to_tray,
            set_speed_limit,
            get_speed_limit,
            pause_download,
            resume_download,
            cancel_download,
            is_download_paused,
            history_list,
            history_clear,
            history_update_meta,
            history_cleanup_old,
            share_paste_and_download,
            share_queue_download,
            get_preview_temp_dir,
            // Phase 25.1.E — WebDAV mount + cache LRU
            webdav_start,
            webdav_stop,
            webdav_status,
            webdav_cache_size,
            webdav_cache_evict,
            webdav_open_cache_dir,
            webdav_get_cache_dir,
            fetch_library_list,
            // Phase 25.1.E.2 — Auto-mount + label
            webdav_mount_drive,
            webdav_unmount_drive,
            // Phase 36.5 — Machine ID cho key concurrent control
            get_device_id,
            // Phase 60 — Real commands từ archive (clean/check/font/shortcut modules)
            fetch_text,
            // ---- Clean ----
            clean::scan_dir,
            clean::list_clean_presets,
            clean::move_to_trash,
            clean::list_trash_sessions,
            clean::restore_session,
            clean::purge_session,
            clean::purge_old_sessions,
            clean::scan_autocad_junk,
            clean::disk_usage,
            // ---- Check ----
            check::sys_report,
            check::cpu_benchmark,
            check::memory_bandwidth,
            check::disk_benchmark,
            check::battery_info,
            check::top_processes,
            check::save_report,
            check::scan_installed_software,
            check::network_speed_test,
            // ---- Font ----
            font::read_font,
            font::scan_fonts,
            font::scan_system_fonts,
            font::install_fonts,
            font::is_admin,
            font::download_and_install_pack,
            font::delete_pack,
            font::list_pack_files,
            font::detect_autocad_dirs,
            font::install_shx_fonts,
            font::export_fonts_to_folder,
            font::clear_all_packs,
            font::get_packs_folder_info,
            // ---- Shortcut ----
            shortcut::scan_desktop,
            shortcut::scan_start_menu,
            shortcut::scan_installed_apps,
            shortcut::parse_lnk,
            shortcut::launch_shortcut,
            shortcut::extract_icon_from_exe,
            shortcut::open_in_explorer,
        ])
        .on_window_event(|window, event| {
            // Phase 26.5.G — close button → emit event cho frontend quyết định
            // (theo setting localStorage 'close_behavior' = 'tray' | 'quit').
            // Default: hide (để app chạy background nhận polling notification).
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                use tauri::Emitter;
                let _ = window.emit("app-close-requested", ());
            }
        })
        .setup(|app| {
            // Init SQLite user.db lúc app start (silent fail nếu lỗi).
            if let Ok(path) = db::db_path(&app.handle()) {
                let _ = db::open(&path);
            }

            // Phase 26.3.B — cleanup file preview > 24h
            cleanup_preview_temp();

            // Phase 26.5.A — System tray icon + menu
            let show_item = MenuItem::with_id(app, "show", "Mở TrishDrive", true, None::<&str>)?;
            let history_item = MenuItem::with_id(app, "history", "Xem lịch sử", true, None::<&str>)?;
            let separator = MenuItem::with_id(app, "_sep", "─────────", false, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Thoát hoàn toàn", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_item, &history_item, &separator, &quit_item])?;

            let _tray = TrayIconBuilder::with_id("main-tray")
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("TrishDrive — Tải file từ Thư viện TrishTEAM")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                            let _ = w.unminimize();
                        }
                    }
                    "history" => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                            let _ = w.emit("nav-to-tab", "history");
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    // Click trái icon → toggle window show/hide
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(w) = app.get_webview_window("main") {
                            if w.is_visible().unwrap_or(false) {
                                let _ = w.hide();
                            } else {
                                let _ = w.show();
                                let _ = w.set_focus();
                                let _ = w.unminimize();
                            }
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running TrishDrive User app");
}

/// Phase 36.5 — Trả về machine_id 16 hex chars (stable cross-reboot).
#[tauri::command]
fn get_device_id() -> String {
    trishteam_machine_id::get_machine_id()
}
