//! TrishDrive — Cloud Storage qua Telegram. Phase 22.5+22.6.
//!
//! Pipeline:
//!   Upload: read file → AES-256-GCM encrypt → sendDocument → SQLite insert
//!   Download: SQLite query → getFile → download → decrypt → write file → verify SHA256
//!
//! Limit Phase 22.5: file < 49MB (Bot API). Phase 22.5b sẽ chunk.

mod telegram;
mod creds;
mod db;
mod crypto;
mod mtproto;

use serde::Serialize;
use tauri::Emitter;
use std::path::PathBuf;

/// Emit từ backend → frontend listen qua `listen('drive-progress', ...)`.
#[derive(Serialize, Clone)]
struct ProgressEvent {
    op: String,           // "upload" | "download"
    file_id: String,
    current_chunk: i64,
    total_chunks: i64,
    bytes_done: i64,
    total_bytes: i64,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(mtproto::MtprotoState::default())
        .invoke_handler(tauri::generate_handler![
            tg_ping,
            tg_test_bot,
            tg_get_chat,
            creds_save,
            creds_load,
            creds_delete,
            db_files_list,
            file_upload,
            file_download,
            file_delete,
            file_update_meta,
            file_restore,
            file_purge,
            file_purge_old_trash,
            db_files_list_trashed,
            share_create,
            share_list,
            share_revoke,
            share_extend,
            folder_list,
            folder_create,
            folder_rename,
            folder_delete,
            mtproto_status,
            mtproto_save_config,
            mtproto_request_code,
            mtproto_submit_code,
            mtproto_signout,
            mtproto_test_upload,
            mtproto_test_download,
            mtproto_test_delete,
            file_upload_mtproto,
            file_download_mtproto,
            file_purge_mtproto,
        ])
        .setup(|app| {
            if let Ok(path) = db::db_path(&app.handle()) {
                let _ = db::open(&path);
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running TrishDrive");
}

#[tauri::command]
fn tg_ping() -> String {
    "TrishDrive backend ready (Phase 22.5)".to_string()
}

#[tauri::command]
async fn tg_test_bot(token: String) -> Result<telegram::BotInfo, String> {
    telegram::get_me(&token).await
}

#[tauri::command]
async fn tg_get_chat(token: String, chat_id: i64) -> Result<telegram::ChatInfo, String> {
    telegram::get_chat(&token, chat_id).await
}

#[derive(Serialize)]
struct PublicCreds {
    has_creds: bool,
    bot_username: Option<String>,
    channel_title: Option<String>,
    channel_id: Option<i64>,
}

#[tauri::command]
async fn creds_save(
    uid: String,
    bot_token: String,
    channel_id: i64,
    channel_title: String,
    passphrase: String,
) -> Result<(), String> {
    if uid.is_empty() {
        return Err("Chưa login Firebase".to_string());
    }
    if passphrase.len() < 8 {
        return Err("Passphrase phải dài tối thiểu 8 ký tự".to_string());
    }
    let salt = creds::random_salt();
    let key = creds::derive_key(&passphrase, &salt);
    let creds_data = creds::TelegramCreds {
        bot_token,
        channel_id,
        channel_title,
        salt_hex: hex::encode(salt),
        master_key_hex: hex::encode(key),
        uid,
    };
    creds::save_creds(&creds_data)
}

#[tauri::command]
fn creds_load(uid: String) -> Result<PublicCreds, String> {
    if uid.is_empty() {
        return Ok(PublicCreds { has_creds: false, bot_username: None, channel_title: None, channel_id: None });
    }
    match creds::load_creds(&uid)? {
        Some(c) => Ok(PublicCreds {
            has_creds: true,
            bot_username: None,
            channel_title: Some(c.channel_title),
            channel_id: Some(c.channel_id),
        }),
        None => Ok(PublicCreds { has_creds: false, bot_username: None, channel_title: None, channel_id: None }),
    }
}

#[tauri::command]
fn creds_delete(uid: String) -> Result<(), String> {
    creds::delete_creds(&uid)
}

#[tauri::command]
fn db_files_list(
    app: tauri::AppHandle,
    folder_id: Option<String>,
    search: Option<String>,
) -> Result<Vec<db::FileRow>, String> {
    let path = db::db_path(&app)?;
    let conn = db::open(&path).map_err(|e| format!("db open: {}", e))?;
    db::list_files(&conn, folder_id.as_deref(), search.as_deref())
        .map_err(|e| format!("query: {}", e))
}

// ============================================================
// Phase 22.5 — Upload pipeline
// ============================================================

#[derive(Serialize)]
pub struct UploadResult {
    pub file_id: String,
    pub name: String,
    pub size_bytes: i64,
    pub sha256_hex: String,
    pub total_chunks: i64,
}

// Bot API có 2 limit riêng biệt:
//   - sendDocument upload: 50MB
//   - getFile download:    20MB ← chunk size phải dưới ngưỡng này
// Chia chunk 19MB plaintext → ~19.05MB ciphertext (overhead 28 byte AES-GCM nonce + tag).
// KHÔNG limit tổng file size — Telegram channel free unlimited.
// File 5GB = ~270 chunks → upload tuần tự ~25-40 phút (tuỳ tốc độ).
// Streaming read: mỗi chunk đọc trực tiếp từ disk, KHÔNG load full file vào RAM.
const CHUNK_SIZE: usize = 19 * 1024 * 1024;

#[tauri::command]
async fn file_upload(
    app: tauri::AppHandle,
    uid: String,
    file_path: String,
    folder_id: Option<String>,
    note: Option<String>,
) -> Result<UploadResult, String> {
    use sha2::{Digest, Sha256};
    use tokio::io::{AsyncReadExt, AsyncSeekExt};

    let creds = creds::load_creds(&uid)?
        .ok_or_else(|| "Chưa setup Telegram (mở wizard)".to_string())?;

    let path = PathBuf::from(&file_path);
    let filename = path.file_name()
        .and_then(|n| n.to_str())
        .ok_or_else(|| "Tên file không hợp lệ".to_string())?
        .to_string();

    // Mở file + lấy size (không load vào RAM)
    let mut file = tokio::fs::File::open(&path).await.map_err(|e| format!("open file: {}", e))?;
    let metadata = file.metadata().await.map_err(|e| format!("metadata: {}", e))?;
    let size = metadata.len() as usize;
    if size == 0 {
        return Err("File rỗng".to_string());
    }
    let total_chunks = ((size + CHUNK_SIZE - 1) / CHUNK_SIZE).max(1) as i64;

    // Pass 1: streaming SHA-256 (không load full)
    let mut hasher = Sha256::new();
    let mut buf = vec![0u8; 4 * 1024 * 1024]; // 4MB read buffer
    let mut hashed_bytes = 0;
    loop {
        let n = file.read(&mut buf).await.map_err(|e| format!("read sha: {}", e))?;
        if n == 0 { break; }
        hasher.update(&buf[..n]);
        hashed_bytes += n;
        // Emit emit 0-50% cho phase hash
        let _ = app.emit("drive-progress", ProgressEvent {
            op: "upload".into(),
            file_id: "_hashing_".into(),
            current_chunk: 0, total_chunks,
            bytes_done: (hashed_bytes / 2) as i64,
            total_bytes: size as i64,
        });
    }
    let sha256 = hex::encode(hasher.finalize());
    let file_id = format!("f_{}", &sha256[..16]);

    // Pre-check duplicate: cùng pipeline = chặn (tránh tốn bandwidth re-upload)
    let db_path_check = db::db_path(&app)?;
    let conn_check = db::open(&db_path_check).map_err(|e| format!("db: {}", e))?;
    if let Some(existing) = db::get_file(&conn_check, &file_id).map_err(|e| format!("query: {}", e))? {
        if existing.pipeline == "botapi" {
            return Err(format!(
                "File này đã upload qua Bot API trước đó (tên: '{}'). Vào tab 'File của tôi' để xem/tải. \
                Nếu muốn upload qua MTProto song song, tick 'Dùng MTProto' ở Phương thức upload.",
                existing.name
            ));
        }
    }
    drop(conn_check);

    // Pass 2: chunk + encrypt + upload tuần tự (seek về đầu file)
    file.seek(std::io::SeekFrom::Start(0)).await.map_err(|e| format!("seek: {}", e))?;

    let now_ms = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0);

    let db_path_buf = db::db_path(&app)?;
    let conn = db::open(&db_path_buf).map_err(|e| format!("db open: {}", e))?;

    let row = db::FileRow {
        id: file_id.clone(),
        name: filename.clone(),
        size_bytes: size as i64,
        mime: None,
        sha256_hex: sha256.clone(),
        folder_id,
        created_at: now_ms,
        total_chunks,
        note,
        deleted_at: None,
        pipeline: "botapi".to_string(),
    };
    db::insert_file(&conn, &row).map_err(|e| format!("insert file: {}", e))?;

    // Emit 0% upload phase
    let _ = app.emit("drive-progress", ProgressEvent {
        op: "upload".into(), file_id: file_id.clone(),
        current_chunk: 0, total_chunks,
        bytes_done: 0, total_bytes: size as i64,
    });

    let mut chunk_buf = vec![0u8; CHUNK_SIZE];
    let mut bytes_done: usize = 0;

    for idx in 0..total_chunks {
        // Đọc đúng số byte còn lại (chunk cuối có thể ngắn)
        let remaining = size - bytes_done;
        let to_read = remaining.min(CHUNK_SIZE);
        chunk_buf.resize(to_read, 0);
        let mut read_total = 0;
        while read_total < to_read {
            let n = file.read(&mut chunk_buf[read_total..]).await.map_err(|e| format!("read chunk: {}", e))?;
            if n == 0 { break; }
            read_total += n;
        }
        if read_total != to_read {
            let _ = db::delete_file(&conn, &file_id);
            return Err(format!("Read short: expect {} got {} at chunk {}", to_read, read_total, idx));
        }

        let encrypted = crypto::encrypt(&creds.master_key_hex, &chunk_buf[..to_read])?;
        let nonce_hex = hex::encode(&encrypted[..crypto::NONCE_SIZE]);
        let chunk_filename = if total_chunks > 1 {
            format!("{}.part{:03}.enc", filename, idx)
        } else {
            format!("{}.enc", filename)
        };

        // Retry 3 lần với exponential backoff khi network fail
        let mut last_err = String::new();
        let mut msg_opt = None;
        for attempt in 0..3 {
            let encrypted_clone = encrypted.clone();
            match telegram::send_document(&creds.bot_token, creds.channel_id, encrypted_clone, &chunk_filename).await {
                Ok(m) => { msg_opt = Some(m); break; }
                Err(e) => {
                    last_err = e;
                    if attempt < 2 {
                        let delay_secs = 1u64 << attempt; // 1s, 2s
                        tokio::time::sleep(std::time::Duration::from_secs(delay_secs)).await;
                    }
                }
            }
        }
        let msg = msg_opt.ok_or_else(|| {
            let _ = db::delete_file(&conn, &file_id);
            format!("Upload chunk {}/{} fail sau 3 lần thử: {}", idx + 1, total_chunks, last_err)
        })?;
        let document = msg.document.ok_or_else(|| "Telegram trả message không có document".to_string())?;
        let chunk_row = db::ChunkRow {
            file_id: file_id.clone(),
            idx,
            tg_message_id: msg.message_id,
            tg_file_id: Some(document.file_id),
            byte_size: to_read as i64,
            nonce_hex,
        };
        db::insert_chunk(&conn, &chunk_row).map_err(|e| format!("insert chunk: {}", e))?;

        bytes_done += to_read;
        let _ = app.emit("drive-progress", ProgressEvent {
            op: "upload".into(), file_id: file_id.clone(),
            current_chunk: idx + 1, total_chunks,
            bytes_done: bytes_done as i64, total_bytes: size as i64,
        });
    }

    Ok(UploadResult {
        file_id,
        name: filename,
        size_bytes: size as i64,
        sha256_hex: sha256,
        total_chunks,
    })
}

// ============================================================
// Phase 22.6 — Download + Delete
// ============================================================

#[tauri::command]
async fn file_download(
    app: tauri::AppHandle,
    uid: String,
    file_id: String,
    dest_path: String,
) -> Result<(), String> {
    let creds = creds::load_creds(&uid)?
        .ok_or_else(|| "Chưa setup Telegram".to_string())?;

    let path = db::db_path(&app)?;
    let conn = db::open(&path).map_err(|e| format!("db open: {}", e))?;
    let file_row = db::get_file(&conn, &file_id)
        .map_err(|e| format!("query: {}", e))?
        .ok_or_else(|| "File không tồn tại trong index".to_string())?;
    if file_row.pipeline == "mtproto" {
        return Err("File này upload qua MTProto — gọi file_download_mtproto thay vì file_download.".into());
    }
    let chunks = db::get_chunks(&conn, &file_id).map_err(|e| format!("chunks: {}", e))?;
    if chunks.is_empty() {
        return Err("File không có chunk nào".to_string());
    }

    use sha2::{Digest, Sha256};
    use tokio::io::AsyncWriteExt;

    let total_chunks = chunks.len() as i64;
    let total_bytes = file_row.size_bytes;
    let _ = app.emit("drive-progress", ProgressEvent {
        op: "download".into(), file_id: file_id.clone(),
        current_chunk: 0, total_chunks,
        bytes_done: 0, total_bytes,
    });

    // Streaming: ghi từng chunk decrypted ra file luôn, không build full Vec trong RAM
    let mut out_file = tokio::fs::File::create(&dest_path).await.map_err(|e| format!("create file: {}", e))?;
    let mut hasher = Sha256::new();
    let mut bytes_done: i64 = 0;

    for (i, chunk) in chunks.iter().enumerate() {
        let tg_file_id = chunk.tg_file_id.as_ref()
            .ok_or_else(|| format!("Chunk {} không có tg_file_id", chunk.idx))?;

        // Retry 3 lần với exponential backoff
        let mut last_err = String::new();
        let mut encrypted_opt = None;
        for attempt in 0..3 {
            let r: Result<Vec<u8>, String> = async {
                let file_info = telegram::get_file(&creds.bot_token, tg_file_id).await?;
                let file_path = file_info.file_path
                    .ok_or_else(|| "Telegram không trả file_path".to_string())?;
                telegram::download_file_bytes(&creds.bot_token, &file_path).await
            }.await;
            match r {
                Ok(b) => { encrypted_opt = Some(b); break; }
                Err(e) => {
                    last_err = e;
                    if attempt < 2 {
                        tokio::time::sleep(std::time::Duration::from_secs(1u64 << attempt)).await;
                    }
                }
            }
        }
        let encrypted = encrypted_opt.ok_or_else(|| format!("Download chunk {}/{} fail sau 3 lần: {}", i + 1, total_chunks, last_err))?;
        let plaintext = crypto::decrypt(&creds.master_key_hex, &encrypted)?;
        hasher.update(&plaintext);
        out_file.write_all(&plaintext).await.map_err(|e| format!("write chunk: {}", e))?;
        bytes_done += plaintext.len() as i64;

        let _ = app.emit("drive-progress", ProgressEvent {
            op: "download".into(), file_id: file_id.clone(),
            current_chunk: (i + 1) as i64, total_chunks,
            bytes_done, total_bytes,
        });
    }
    out_file.flush().await.map_err(|e| format!("flush: {}", e))?;
    drop(out_file);

    let actual_sha = hex::encode(hasher.finalize());
    if actual_sha != file_row.sha256_hex {
        // Xoá file dest vì corrupt
        let _ = tokio::fs::remove_file(&dest_path).await;
        return Err(format!(
            "SHA256 mismatch: expected {} got {}. File có thể bị corrupt — đã xoá.",
            &file_row.sha256_hex[..12], &actual_sha[..12]
        ));
    }
    Ok(())
}

// ============================================================
// Phase 22.7c — Folder CRUD + file metadata update (note + rename + move)
// ============================================================

#[tauri::command]
fn folder_list(app: tauri::AppHandle) -> Result<Vec<db::FolderRow>, String> {
    let path = db::db_path(&app)?;
    let conn = db::open(&path).map_err(|e| format!("db: {}", e))?;
    db::list_folders(&conn).map_err(|e| format!("query: {}", e))
}

#[tauri::command]
fn folder_create(
    app: tauri::AppHandle,
    name: String,
    parent_id: Option<String>,
) -> Result<db::FolderRow, String> {
    if name.trim().is_empty() {
        return Err("Tên folder không được trống".to_string());
    }
    let path = db::db_path(&app)?;
    let conn = db::open(&path).map_err(|e| format!("db: {}", e))?;
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0);
    let id = format!("fl_{}", &uuid_short());
    let row = db::FolderRow { id: id.clone(), name: name.trim().to_string(), parent_id, created_at: now };
    db::insert_folder(&conn, &row).map_err(|e| format!("insert: {}", e))?;
    Ok(row)
}

#[tauri::command]
fn folder_rename(
    app: tauri::AppHandle,
    folder_id: String,
    new_name: String,
) -> Result<(), String> {
    if new_name.trim().is_empty() {
        return Err("Tên folder không được trống".to_string());
    }
    let path = db::db_path(&app)?;
    let conn = db::open(&path).map_err(|e| format!("db: {}", e))?;
    db::rename_folder(&conn, &folder_id, new_name.trim()).map_err(|e| format!("rename: {}", e))
}

#[tauri::command]
fn folder_delete(app: tauri::AppHandle, folder_id: String) -> Result<(), String> {
    let path = db::db_path(&app)?;
    let conn = db::open(&path).map_err(|e| format!("db: {}", e))?;
    db::delete_folder(&conn, &folder_id).map_err(|e| format!("delete: {}", e))
}

#[tauri::command]
fn file_update_meta(
    app: tauri::AppHandle,
    file_id: String,
    name: Option<String>,
    folder_id: Option<String>,
    note: Option<String>,
) -> Result<(), String> {
    let path = db::db_path(&app)?;
    let conn = db::open(&path).map_err(|e| format!("db: {}", e))?;
    db::update_file_meta(
        &conn, &file_id,
        name.as_deref(), folder_id.as_deref(), note.as_deref(),
    ).map_err(|e| format!("update: {}", e))
}

// ============================================================
// Phase 23.2 — MTProto status + login flow
// ============================================================

fn mtproto_session_path(app: &tauri::AppHandle, uid: &str) -> Result<std::path::PathBuf, String> {
    use tauri::Manager;
    let dir = app.path().app_data_dir().map_err(|e| format!("app_data_dir: {}", e))?;
    std::fs::create_dir_all(&dir).map_err(|e| format!("mkdir: {}", e))?;
    Ok(mtproto::session_path(&dir, uid))
}

#[tauri::command]
async fn mtproto_status(app: tauri::AppHandle, uid: String) -> Result<mtproto::MtprotoStatus, String> {
    let session_path = mtproto_session_path(&app, &uid)?;
    let config = creds::load_mtproto_config(&uid)?;
    match config {
        None => Ok(mtproto::MtprotoStatus {
            configured: false,
            authorized: false,
            user_phone: None,
            user_username: None,
            session_path: session_path.to_string_lossy().to_string(),
        }),
        Some(cfg) => mtproto::check_session(&session_path, cfg.api_id, &cfg.api_hash).await,
    }
}

#[tauri::command]
async fn mtproto_save_config(uid: String, api_id: i32, api_hash: String) -> Result<(), String> {
    if uid.is_empty() {
        return Err("Chưa login Firebase".to_string());
    }
    if api_id <= 0 {
        return Err("api_id phải > 0".to_string());
    }
    if api_hash.len() < 16 {
        return Err("api_hash quá ngắn (cần ≥ 16 ký tự)".to_string());
    }
    creds::save_mtproto_config(&uid, &creds::MtprotoConfig { api_id, api_hash })
}

#[tauri::command]
async fn mtproto_request_code(
    state: tauri::State<'_, mtproto::MtprotoState>,
    app: tauri::AppHandle,
    uid: String,
    phone: String,
) -> Result<(), String> {
    let cfg = creds::load_mtproto_config(&uid)?
        .ok_or_else(|| "Chưa save api_id + api_hash".to_string())?;
    let session_path = mtproto_session_path(&app, &uid)?;
    mtproto::request_code(&state, cfg.api_id, &cfg.api_hash, &phone, &session_path).await
}

#[tauri::command]
async fn mtproto_submit_code(
    state: tauri::State<'_, mtproto::MtprotoState>,
    app: tauri::AppHandle,
    uid: String,
    code: String,
    password: Option<String>,
) -> Result<mtproto::SignInResult, String> {
    let session_path = mtproto_session_path(&app, &uid)?;
    mtproto::submit_code(&state, &code, password.as_deref(), &session_path).await
}

#[tauri::command]
async fn mtproto_signout(app: tauri::AppHandle, uid: String) -> Result<(), String> {
    let session_path = mtproto_session_path(&app, &uid)?;
    let cfg = creds::load_mtproto_config(&uid)?;
    if let Some(c) = cfg {
        let _ = mtproto::sign_out(&session_path, c.api_id, &c.api_hash).await;
    }
    Ok(())
}

// ============================================================
// Phase 23.3 — MTProto upload/download/delete test commands
// (chưa tích hợp pipeline file_upload — gọi qua Settings để test SDK)
// ============================================================

#[tauri::command]
async fn mtproto_test_upload(
    app: tauri::AppHandle,
    uid: String,
    file_path: String,
) -> Result<mtproto::MtprotoUploadInfo, String> {
    let cfg = creds::load_mtproto_config(&uid)?
        .ok_or_else(|| "Chưa save api_id + api_hash".to_string())?;
    let session_path = mtproto_session_path(&app, &uid)?;
    let path = std::path::PathBuf::from(&file_path);
    let upload_name = path.file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("file.bin")
        .to_string();
    mtproto::upload_to_saved(cfg.api_id, &cfg.api_hash, &session_path, &path, &upload_name).await
}

#[tauri::command]
async fn mtproto_test_download(
    app: tauri::AppHandle,
    uid: String,
    message_id: i32,
    dest_path: String,
) -> Result<(), String> {
    let cfg = creds::load_mtproto_config(&uid)?
        .ok_or_else(|| "Chưa save api_id + api_hash".to_string())?;
    let session_path = mtproto_session_path(&app, &uid)?;
    let dest = std::path::PathBuf::from(&dest_path);
    mtproto::download_from_saved(cfg.api_id, &cfg.api_hash, &session_path, message_id, &dest).await
}

#[tauri::command]
async fn mtproto_test_delete(
    app: tauri::AppHandle,
    uid: String,
    message_ids: Vec<i32>,
) -> Result<(), String> {
    let cfg = creds::load_mtproto_config(&uid)?
        .ok_or_else(|| "Chưa save api_id + api_hash".to_string())?;
    let session_path = mtproto_session_path(&app, &uid)?;
    mtproto::delete_from_saved(cfg.api_id, &cfg.api_hash, &session_path, &message_ids).await
}

fn uuid_short() -> String {
    use rand::RngCore;
    let mut bytes = [0u8; 8];
    rand::thread_rng().fill_bytes(&mut bytes);
    hex::encode(bytes)
}

// ============================================================
// Phase 22.7b — Share link (zero-knowledge, password protected)
// ============================================================

#[derive(Serialize)]
pub struct ShareResult {
    pub token: String,
    pub url: String,
    /// Phase 23.4 — link rút gọn /s/{code} (~30 ký tự thay vì ~80)
    pub short_url: Option<String>,
}

#[derive(serde::Serialize)]
struct ShareCreatePayload {
    owner_uid: String,
    file_id: String,
    file_name: String,
    file_size_bytes: i64,
    file_sha256_hex: String,
    chunks: Vec<ShareChunk>,
    encrypted_bot_token_hex: String,
    encrypted_master_key_hex: String,
    expires_at: Option<i64>,
    max_downloads: Option<i64>,
}

#[derive(serde::Serialize)]
struct ShareChunk {
    idx: i64,
    tg_file_id: String,
    byte_size: i64,
    nonce_hex: String,
}

#[derive(serde::Deserialize)]
struct ShareCreateResponse {
    token: String,
    url: String,
    #[serde(default)]
    short_url: Option<String>,
}

const SHARE_API_BASE: &str = "https://trishteam.io.vn";

#[tauri::command]
async fn share_create(
    app: tauri::AppHandle,
    uid: String,
    file_id: String,
    password: String,
    expires_hours: Option<i64>,
    max_downloads: Option<i64>,
) -> Result<ShareResult, String> {
    // Phase 23.5: password tuỳ chọn. Nếu rỗng → auto-gen random key, nhúng vào URL fragment.
    // URL fragment KHÔNG gửi server → server vẫn zero-knowledge, người nhận chỉ click link là tải.
    let no_password = password.is_empty();
    let effective_password: String = if no_password {
        use rand::RngCore;
        let mut bytes = [0u8; 16];
        rand::thread_rng().fill_bytes(&mut bytes);
        hex::encode(bytes) // 32 hex chars
    } else if password.len() < 8 {
        return Err("Password share phải dài tối thiểu 8 ký tự (hoặc bỏ trống để auto-gen key trong URL)".to_string());
    } else {
        password.clone()
    };
    let creds = creds::load_creds(&uid)?
        .ok_or_else(|| "Chưa setup Telegram".to_string())?;

    let path = db::db_path(&app)?;
    let conn = db::open(&path).map_err(|e| format!("db: {}", e))?;
    let file_row = db::get_file(&conn, &file_id)
        .map_err(|e| format!("query: {}", e))?
        .ok_or_else(|| "File không tồn tại".to_string())?;
    if file_row.pipeline == "mtproto" {
        return Err("File MTProto chưa hỗ trợ share link (chỉ Bot API). \
            Lý do: Web server proxy file qua bot.getFile, MTProto file ở Saved Messages của user account riêng tư. \
            Nếu cần share, upload lại file qua Bot API (tắt toggle 'Dùng MTProto' ở Upload page).".to_string());
    }
    let chunks_db = db::get_chunks(&conn, &file_id).map_err(|e| format!("chunks: {}", e))?;

    let chunks: Vec<ShareChunk> = chunks_db.iter().map(|c| ShareChunk {
        idx: c.idx,
        tg_file_id: c.tg_file_id.clone().unwrap_or_default(),
        byte_size: c.byte_size,
        nonce_hex: c.nonce_hex.clone(),
    }).collect();

    let encrypted_bot_token = crypto::encrypt_with_password(creds.bot_token.as_bytes(), &effective_password)?;
    let encrypted_master_key = crypto::encrypt_with_password(creds.master_key_hex.as_bytes(), &effective_password)?;

    let expires_at = expires_hours.map(|h| {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis() as i64)
            .unwrap_or(0);
        now + h * 3600 * 1000
    });

    let payload = ShareCreatePayload {
        owner_uid: uid,
        file_id,
        file_name: file_row.name,
        file_size_bytes: file_row.size_bytes,
        file_sha256_hex: file_row.sha256_hex,
        chunks,
        encrypted_bot_token_hex: encrypted_bot_token,
        encrypted_master_key_hex: encrypted_master_key,
        expires_at,
        max_downloads,
    };

    let url = format!("{}/api/drive/share/create", SHARE_API_BASE);
    let resp = reqwest::Client::new()
        .post(&url)
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Không kết nối được {}: {}. Kiểm tra mạng.", SHARE_API_BASE, e))?;
    let status = resp.status();
    let body_text = resp.text().await.unwrap_or_default();
    if !status.is_success() {
        // Detect HTML response (Vercel 404 page returning HTML thay vì JSON)
        let trimmed = body_text.trim_start();
        if trimmed.starts_with("<!DOCTYPE") || trimmed.starts_with("<html") {
            return Err(format!(
                "Server {} chưa có endpoint /api/drive/share/create (HTTP {}). \
                Web TrishTEAM cần deploy bản mới — chạy 'git push origin main' để Vercel build.",
                SHARE_API_BASE, status
            ));
        }
        // JSON error response
        if let Ok(err_json) = serde_json::from_str::<serde_json::Value>(&body_text) {
            if let Some(msg) = err_json.get("error").and_then(|v| v.as_str()) {
                return Err(format!("API {}: {}", status, msg));
            }
        }
        return Err(format!("API error {}: {}", status, body_text.chars().take(200).collect::<String>()));
    }
    let result: ShareCreateResponse = serde_json::from_str(&body_text)
        .map_err(|e| format!("Parse JSON response: {}. Body: {}", e, body_text.chars().take(200).collect::<String>()))?;

    // Phase 23.5: nếu no-password mode → nhúng key vào URL fragment.
    // Fragment chỉ chạy client-side, server không thấy → vẫn zero-knowledge.
    let fragment = if no_password {
        format!("#k={}", effective_password)
    } else {
        String::new()
    };
    let final_short = result.short_url.map(|u| format!("{}{}", u, fragment));
    let final_long = format!("{}{}", result.url, fragment);

    Ok(ShareResult {
        token: result.token,
        url: final_long,
        short_url: final_short,
    })
}

#[derive(serde::Deserialize, Serialize)]
pub struct ShareItem {
    pub token: String,
    pub file_id: String,
    pub file_name: String,
    pub file_size_bytes: i64,
    pub created_at: i64,
    pub expires_at: Option<i64>,
    pub max_downloads: Option<i64>,
    pub download_count: i64,
    pub revoked: bool,
    pub url: String,
    #[serde(default)]
    pub short_url: Option<String>,
    #[serde(default)]
    pub short_code: Option<String>,
}

#[derive(serde::Deserialize)]
struct ShareListResponse { shares: Vec<ShareItem> }

#[tauri::command]
async fn share_list(uid: String) -> Result<Vec<ShareItem>, String> {
    let url = format!("{}/api/drive/share/list?owner_uid={}", SHARE_API_BASE, urlencoding::encode(&uid));
    let resp = reqwest::Client::new().get(&url).send().await
        .map_err(|e| format!("HTTP: {}", e))?;
    let status = resp.status();
    let text = resp.text().await.unwrap_or_default();
    if !status.is_success() {
        return Err(format!("API {}: {}", status, text.chars().take(200).collect::<String>()));
    }
    let r: ShareListResponse = serde_json::from_str(&text).map_err(|e| format!("JSON: {}", e))?;
    Ok(r.shares)
}

#[derive(serde::Serialize)]
struct ManagePayload<'a> {
    owner_uid: &'a str,
    action: &'a str,
    #[serde(skip_serializing_if = "Option::is_none")]
    expires_hours: Option<i64>,
}

async fn share_manage(uid: &str, token: &str, action: &str, expires_hours: Option<i64>) -> Result<(), String> {
    let url = format!("{}/api/drive/share/{}/manage", SHARE_API_BASE, urlencoding::encode(token));
    let payload = ManagePayload { owner_uid: uid, action, expires_hours };
    let resp = reqwest::Client::new().patch(&url).json(&payload).send().await
        .map_err(|e| format!("HTTP: {}", e))?;
    let status = resp.status();
    if !status.is_success() {
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("API {}: {}", status, text.chars().take(200).collect::<String>()));
    }
    Ok(())
}

#[tauri::command]
async fn share_revoke(uid: String, token: String) -> Result<(), String> {
    share_manage(&uid, &token, "revoke", None).await
}

#[tauri::command]
async fn share_extend(uid: String, token: String, expires_hours: i64) -> Result<(), String> {
    share_manage(&uid, &token, "extend", Some(expires_hours)).await
}

/// Soft delete — file vào Thùng rác 30 ngày, KHÔNG xoá Telegram messages.
/// User có thể restore. Sau 30 ngày auto-purge (xoá Telegram + SQLite).
#[tauri::command]
fn file_delete(app: tauri::AppHandle, file_id: String) -> Result<(), String> {
    let path = db::db_path(&app)?;
    let conn = db::open(&path).map_err(|e| format!("db open: {}", e))?;
    db::soft_delete_file(&conn, &file_id).map_err(|e| format!("soft delete: {}", e))
}

#[tauri::command]
fn file_restore(app: tauri::AppHandle, file_id: String) -> Result<(), String> {
    let path = db::db_path(&app)?;
    let conn = db::open(&path).map_err(|e| format!("db open: {}", e))?;
    db::restore_file(&conn, &file_id).map_err(|e| format!("restore: {}", e))
}

/// Hard purge — xoá Telegram messages + SQLite row. Dùng cho:
///   1. User bấm "Xoá vĩnh viễn" trong Trash
///   2. Auto-purge file ≥ 30 ngày trong trash (file_purge_old_trash)
#[tauri::command]
async fn file_purge(
    app: tauri::AppHandle,
    uid: String,
    file_id: String,
) -> Result<(), String> {
    let creds = creds::load_creds(&uid)?
        .ok_or_else(|| "Chưa setup Telegram".to_string())?;
    let path = db::db_path(&app)?;
    let conn = db::open(&path).map_err(|e| format!("db open: {}", e))?;
    let chunks = db::get_chunks(&conn, &file_id).map_err(|e| format!("chunks: {}", e))?;
    for chunk in &chunks {
        let _ = telegram::delete_message(&creds.bot_token, creds.channel_id, chunk.tg_message_id).await;
    }
    db::delete_file(&conn, &file_id).map_err(|e| format!("delete: {}", e))?;
    Ok(())
}

/// Auto-purge file đã trash > 30 ngày. Gọi khi load TrashPage.
/// Phase 23.4: route theo `pipeline` — Bot API → telegram::delete_message,
/// MTProto → mtproto::delete_from_saved.
#[tauri::command]
async fn file_purge_old_trash(
    app: tauri::AppHandle,
    uid: String,
) -> Result<i64, String> {
    let creds_opt = creds::load_creds(&uid)?;
    let mt_cfg_opt = creds::load_mtproto_config(&uid)?;
    let mt_session = mtproto_session_path(&app, &uid).ok();

    let path = db::db_path(&app)?;
    let conn = db::open(&path).map_err(|e| format!("db open: {}", e))?;
    let cutoff = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
        - 30 * 24 * 3600 * 1000; // 30 ngày
    let old_files = db::list_trashed_older_than(&conn, cutoff).map_err(|e| format!("query: {}", e))?;
    let count = old_files.len() as i64;

    for f in old_files {
        let chunks = db::get_chunks(&conn, &f.id).map_err(|e| format!("chunks: {}", e))?;
        if f.pipeline == "mtproto" {
            if let (Some(cfg), Some(session_path), Some(creds)) = (&mt_cfg_opt, &mt_session, &creds_opt) {
                if session_path.exists() {
                    let msg_ids: Vec<i32> = chunks.iter().map(|c| c.tg_message_id as i32).collect();
                    let _ = mtproto::delete_from_channel(
                        cfg.api_id, &cfg.api_hash, session_path,
                        &uid, creds.channel_id, &msg_ids,
                    ).await;
                }
            }
        } else if let Some(creds) = &creds_opt {
            for chunk in &chunks {
                let _ = telegram::delete_message(&creds.bot_token, creds.channel_id, chunk.tg_message_id).await;
            }
        }
        let _ = db::delete_file(&conn, &f.id);
    }
    Ok(count)
}

#[tauri::command]
fn db_files_list_trashed(app: tauri::AppHandle) -> Result<Vec<db::FileRow>, String> {
    let path = db::db_path(&app)?;
    let conn = db::open(&path).map_err(|e| format!("db open: {}", e))?;
    db::list_trashed(&conn).map_err(|e| format!("query: {}", e))
}

// ============================================================
// Phase 23.4 — MTProto upload/download/purge pipeline
// (chunk 100MB thay vì 19MB Bot API → file 2GB chỉ 20 chunks)
// ============================================================

const MTPROTO_CHUNK_SIZE: usize = 100 * 1024 * 1024; // 100MB plaintext per Telegram message

/// Upload file qua MTProto. Yêu cầu user đã đăng nhập (mtproto_status.authorized=true).
/// Pipeline khác Bot API:
///   - chunk 100MB (5x to bigger)
///   - mỗi chunk = 1 message ở Saved Messages
///   - chunks.tg_message_id = msg.id, tg_file_id = NULL
///   - files.pipeline = "mtproto"
#[tauri::command]
async fn file_upload_mtproto(
    app: tauri::AppHandle,
    uid: String,
    file_path: String,
    folder_id: Option<String>,
    note: Option<String>,
) -> Result<UploadResult, String> {
    use sha2::{Digest, Sha256};
    use tokio::io::{AsyncReadExt, AsyncSeekExt};

    // Phải có cả creds (master_key) + mtproto config
    let creds = creds::load_creds(&uid)?
        .ok_or_else(|| "Chưa setup Telegram (mở Settings → Bot API wizard)".to_string())?;
    let mt_cfg = creds::load_mtproto_config(&uid)?
        .ok_or_else(|| "Chưa setup MTProto (Settings → MTProto)".to_string())?;
    let session_path = mtproto_session_path(&app, &uid)?;
    if !session_path.exists() {
        return Err("Chưa đăng nhập MTProto (Settings → MTProto → Setup)".into());
    }

    let path = PathBuf::from(&file_path);
    let filename = path.file_name()
        .and_then(|n| n.to_str())
        .ok_or_else(|| "Tên file không hợp lệ".to_string())?
        .to_string();

    let mut file = tokio::fs::File::open(&path).await.map_err(|e| format!("open file: {}", e))?;
    let metadata = file.metadata().await.map_err(|e| format!("metadata: {}", e))?;
    let size = metadata.len() as usize;
    if size == 0 {
        return Err("File rỗng".into());
    }
    let total_chunks = ((size + MTPROTO_CHUNK_SIZE - 1) / MTPROTO_CHUNK_SIZE).max(1) as i64;

    // Pass 1 — streaming SHA-256
    let mut hasher = Sha256::new();
    let mut buf = vec![0u8; 4 * 1024 * 1024];
    let mut hashed = 0;
    loop {
        let n = file.read(&mut buf).await.map_err(|e| format!("read sha: {}", e))?;
        if n == 0 { break; }
        hasher.update(&buf[..n]);
        hashed += n;
        let _ = app.emit("drive-progress", ProgressEvent {
            op: "upload".into(), file_id: "_hashing_".into(),
            current_chunk: 0, total_chunks,
            bytes_done: (hashed / 2) as i64, total_bytes: size as i64,
        });
    }
    let sha256 = hex::encode(hasher.finalize());
    // Suffix `_m` để MTProto file_id khác Bot API → cùng file 2 pipeline = 2 entries riêng
    let file_id = format!("f_{}_m", &sha256[..16]);
    file.seek(std::io::SeekFrom::Start(0)).await.map_err(|e| format!("seek: {}", e))?;

    let now_ms = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0);

    let db_path_buf = db::db_path(&app)?;
    let conn = db::open(&db_path_buf).map_err(|e| format!("db open: {}", e))?;

    // Pre-check duplicate trong pipeline MTProto
    if let Some(existing) = db::get_file(&conn, &file_id).map_err(|e| format!("query: {}", e))? {
        return Err(format!(
            "File này đã upload qua MTProto trước đó (tên: '{}'). Vào tab 'File của tôi' để xem/tải. \
            Nếu muốn upload qua Bot API song song, bỏ tick 'Dùng MTProto' ở Phương thức upload.",
            existing.name
        ));
    }

    let row = db::FileRow {
        id: file_id.clone(),
        name: filename.clone(),
        size_bytes: size as i64,
        mime: None,
        sha256_hex: sha256.clone(),
        folder_id,
        created_at: now_ms,
        total_chunks,
        note,
        deleted_at: None,
        pipeline: "mtproto".to_string(),
    };
    db::insert_file(&conn, &row).map_err(|e| format!("insert file: {}", e))?;

    let _ = app.emit("drive-progress", ProgressEvent {
        op: "upload".into(), file_id: file_id.clone(),
        current_chunk: 0, total_chunks,
        bytes_done: 0, total_bytes: size as i64,
    });

    let mut chunk_buf = vec![0u8; MTPROTO_CHUNK_SIZE];
    let mut bytes_done: usize = 0;

    for idx in 0..total_chunks {
        let remaining = size - bytes_done;
        let to_read = remaining.min(MTPROTO_CHUNK_SIZE);
        chunk_buf.resize(to_read, 0);
        let mut read_total = 0;
        while read_total < to_read {
            let n = file.read(&mut chunk_buf[read_total..]).await.map_err(|e| format!("read chunk: {}", e))?;
            if n == 0 { break; }
            read_total += n;
        }
        if read_total != to_read {
            let _ = db::delete_file(&conn, &file_id);
            return Err(format!("Read short chunk {}: expect {} got {}", idx, to_read, read_total));
        }

        let encrypted = crypto::encrypt(&creds.master_key_hex, &chunk_buf[..to_read])?;
        let nonce_hex = hex::encode(&encrypted[..crypto::NONCE_SIZE]);
        let chunk_filename = if total_chunks > 1 {
            format!("{}.part{:03}.enc", filename, idx)
        } else {
            format!("{}.enc", filename)
        };

        // Phase 23.7 — pass progress callback để emit drive-progress mỗi 1MB trong chunk
        let app_progress = app.clone();
        let file_id_progress = file_id.clone();
        let baseline_bytes = bytes_done; // số byte các chunk trước đã upload
        let total_size_for_progress = size;
        let chunk_idx_for_progress = idx;
        let total_chunks_for_progress = total_chunks;

        let upload_info = mtproto::upload_bytes_to_channel(
            mt_cfg.api_id, &mt_cfg.api_hash, &session_path,
            &uid, creds.channel_id,
            encrypted, &chunk_filename,
            move |bytes_in_chunk| {
                let _ = app_progress.emit("drive-progress", ProgressEvent {
                    op: "upload".into(),
                    file_id: file_id_progress.clone(),
                    current_chunk: chunk_idx_for_progress + 1,
                    total_chunks: total_chunks_for_progress,
                    bytes_done: (baseline_bytes + bytes_in_chunk) as i64,
                    total_bytes: total_size_for_progress as i64,
                });
            },
        ).await.map_err(|e| {
            let _ = db::delete_file(&conn, &file_id);
            format!("Upload chunk {}/{} fail: {}", idx + 1, total_chunks, e)
        })?;

        let chunk_row = db::ChunkRow {
            file_id: file_id.clone(),
            idx,
            tg_message_id: upload_info.message_id,
            tg_file_id: None, // MTProto path không dùng Bot file_id
            byte_size: to_read as i64,
            nonce_hex,
        };
        db::insert_chunk(&conn, &chunk_row).map_err(|e| format!("insert chunk: {}", e))?;

        bytes_done += to_read;
        let _ = app.emit("drive-progress", ProgressEvent {
            op: "upload".into(), file_id: file_id.clone(),
            current_chunk: idx + 1, total_chunks,
            bytes_done: bytes_done as i64, total_bytes: size as i64,
        });
    }

    Ok(UploadResult {
        file_id,
        name: filename,
        size_bytes: size as i64,
        sha256_hex: sha256,
        total_chunks,
    })
}

#[tauri::command]
async fn file_download_mtproto(
    app: tauri::AppHandle,
    uid: String,
    file_id: String,
    dest_path: String,
) -> Result<(), String> {
    use sha2::{Digest, Sha256};
    use tokio::io::AsyncWriteExt;

    let creds = creds::load_creds(&uid)?
        .ok_or_else(|| "Chưa setup Telegram".to_string())?;
    let mt_cfg = creds::load_mtproto_config(&uid)?
        .ok_or_else(|| "Chưa setup MTProto".to_string())?;
    let session_path = mtproto_session_path(&app, &uid)?;

    let path = db::db_path(&app)?;
    let conn = db::open(&path).map_err(|e| format!("db open: {}", e))?;
    let file_row = db::get_file(&conn, &file_id)
        .map_err(|e| format!("query: {}", e))?
        .ok_or_else(|| "File không tồn tại".to_string())?;
    if file_row.pipeline != "mtproto" {
        return Err(format!("File này upload qua {}, không phải MTProto. Dùng file_download.", file_row.pipeline));
    }
    let chunks = db::get_chunks(&conn, &file_id).map_err(|e| format!("chunks: {}", e))?;
    if chunks.is_empty() {
        return Err("File không có chunk".into());
    }

    let total_chunks = chunks.len() as i64;
    let total_bytes = file_row.size_bytes;
    let _ = app.emit("drive-progress", ProgressEvent {
        op: "download".into(), file_id: file_id.clone(),
        current_chunk: 0, total_chunks,
        bytes_done: 0, total_bytes,
    });

    let mut out_file = tokio::fs::File::create(&dest_path).await
        .map_err(|e| format!("create dest: {}", e))?;
    let mut hasher = Sha256::new();
    let mut bytes_done: i64 = 0;

    for (i, chunk) in chunks.iter().enumerate() {
        let msg_id = chunk.tg_message_id as i32;
        let encrypted = mtproto::download_bytes_from_channel(
            mt_cfg.api_id, &mt_cfg.api_hash, &session_path,
            &uid, creds.channel_id, msg_id,
        ).await.map_err(|e| format!("Download chunk {}/{}: {}", i + 1, total_chunks, e))?;

        let plaintext = crypto::decrypt(&creds.master_key_hex, &encrypted)?;
        hasher.update(&plaintext);
        out_file.write_all(&plaintext).await.map_err(|e| format!("write: {}", e))?;
        bytes_done += plaintext.len() as i64;

        let _ = app.emit("drive-progress", ProgressEvent {
            op: "download".into(), file_id: file_id.clone(),
            current_chunk: (i + 1) as i64, total_chunks,
            bytes_done, total_bytes,
        });
    }
    out_file.flush().await.map_err(|e| format!("flush: {}", e))?;
    drop(out_file);

    let actual_sha = hex::encode(hasher.finalize());
    if actual_sha != file_row.sha256_hex {
        let _ = tokio::fs::remove_file(&dest_path).await;
        return Err(format!(
            "SHA256 mismatch: expected {} got {}. File corrupt — đã xoá.",
            &file_row.sha256_hex[..12], &actual_sha[..12]
        ));
    }
    Ok(())
}

#[tauri::command]
async fn file_purge_mtproto(
    app: tauri::AppHandle,
    uid: String,
    file_id: String,
) -> Result<(), String> {
    let creds = creds::load_creds(&uid)?
        .ok_or_else(|| "Chưa setup Telegram".to_string())?;
    let mt_cfg = creds::load_mtproto_config(&uid)?
        .ok_or_else(|| "Chưa setup MTProto".to_string())?;
    let session_path = mtproto_session_path(&app, &uid)?;

    let path = db::db_path(&app)?;
    let conn = db::open(&path).map_err(|e| format!("db open: {}", e))?;
    let chunks = db::get_chunks(&conn, &file_id).map_err(|e| format!("chunks: {}", e))?;
    let msg_ids: Vec<i32> = chunks.iter().map(|c| c.tg_message_id as i32).collect();

    // Best-effort delete khỏi channel — file vẫn xoá khỏi DB dù MTProto fail
    let _ = mtproto::delete_from_channel(
        mt_cfg.api_id, &mt_cfg.api_hash, &session_path,
        &uid, creds.channel_id, &msg_ids,
    ).await;
    db::delete_file(&conn, &file_id).map_err(|e| format!("delete: {}", e))?;
    Ok(())
}
