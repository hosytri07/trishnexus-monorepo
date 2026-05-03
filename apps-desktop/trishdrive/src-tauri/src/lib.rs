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
