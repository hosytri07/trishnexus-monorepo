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

use serde::Serialize;
use tauri::{Manager, Emitter};
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
            share_create,
            folder_list,
            folder_create,
            folder_rename,
            folder_delete,
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

        let msg = telegram::send_document(
            &creds.bot_token, creds.channel_id, encrypted, &chunk_filename
        ).await.map_err(|e| {
            let _ = db::delete_file(&conn, &file_id);
            format!("Upload chunk {}/{} fail: {}", idx + 1, total_chunks, e)
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
        let file_info = telegram::get_file(&creds.bot_token, tg_file_id).await?;
        let file_path = file_info.file_path
            .ok_or_else(|| "Telegram không trả file_path (file expired hoặc deleted)".to_string())?;
        let encrypted = telegram::download_file_bytes(&creds.bot_token, &file_path).await?;
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
    if password.len() < 8 {
        return Err("Password share phải dài tối thiểu 8 ký tự".to_string());
    }
    let creds = creds::load_creds(&uid)?
        .ok_or_else(|| "Chưa setup Telegram".to_string())?;

    let path = db::db_path(&app)?;
    let conn = db::open(&path).map_err(|e| format!("db: {}", e))?;
    let file_row = db::get_file(&conn, &file_id)
        .map_err(|e| format!("query: {}", e))?
        .ok_or_else(|| "File không tồn tại".to_string())?;
    let chunks_db = db::get_chunks(&conn, &file_id).map_err(|e| format!("chunks: {}", e))?;

    let chunks: Vec<ShareChunk> = chunks_db.iter().map(|c| ShareChunk {
        idx: c.idx,
        tg_file_id: c.tg_file_id.clone().unwrap_or_default(),
        byte_size: c.byte_size,
        nonce_hex: c.nonce_hex.clone(),
    }).collect();

    let encrypted_bot_token = crypto::encrypt_with_password(creds.bot_token.as_bytes(), &password)?;
    let encrypted_master_key = crypto::encrypt_with_password(creds.master_key_hex.as_bytes(), &password)?;

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
        .map_err(|e| format!("HTTP: {}", e))?;
    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("API error {}: {}", status, body));
    }
    let result: ShareCreateResponse = resp.json().await.map_err(|e| format!("JSON: {}", e))?;
    Ok(ShareResult { token: result.token, url: result.url })
}

#[tauri::command]
async fn file_delete(
    app: tauri::AppHandle,
    uid: String,
    file_id: String,
) -> Result<(), String> {
    let creds = creds::load_creds(&uid)?
        .ok_or_else(|| "Chưa setup Telegram".to_string())?;

    let path = db::db_path(&app)?;
    let conn = db::open(&path).map_err(|e| format!("db open: {}", e))?;
    let chunks = db::get_chunks(&conn, &file_id).map_err(|e| format!("chunks: {}", e))?;

    // Delete each chunk message on Telegram (best-effort, ignore errors vì có thể đã bị xoá thủ công)
    for chunk in &chunks {
        let _ = telegram::delete_message(&creds.bot_token, creds.channel_id, chunk.tg_message_id).await;
    }

    // Delete from SQLite (cascade chunks)
    db::delete_file(&conn, &file_id).map_err(|e| format!("delete: {}", e))?;
    Ok(())
}
