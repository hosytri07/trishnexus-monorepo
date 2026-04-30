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
use tauri::Manager;
use std::path::PathBuf;

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
            share_create,
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
}

const MAX_FILE_SIZE: u64 = 48 * 1024 * 1024; // 48MB (buffer dưới 50MB Bot API limit)

#[tauri::command]
async fn file_upload(
    app: tauri::AppHandle,
    uid: String,
    file_path: String,
) -> Result<UploadResult, String> {
    let creds = creds::load_creds(&uid)?
        .ok_or_else(|| "Chưa setup Telegram (mở wizard)".to_string())?;

    // Read file
    let path = PathBuf::from(&file_path);
    let filename = path.file_name()
        .and_then(|n| n.to_str())
        .ok_or_else(|| "Tên file không hợp lệ".to_string())?
        .to_string();
    let plaintext = tokio::fs::read(&path).await.map_err(|e| format!("read file: {}", e))?;
    let size = plaintext.len() as u64;
    if size > MAX_FILE_SIZE {
        return Err(format!("File {} MB > 48 MB. Phase 22.5b sẽ hỗ trợ chunk.", size / 1024 / 1024));
    }

    let sha256 = crypto::sha256_hex(&plaintext);

    // Encrypt
    let encrypted = crypto::encrypt(&creds.master_key_hex, &plaintext)?;
    let nonce_hex = hex::encode(&encrypted[..crypto::NONCE_SIZE]);

    // Upload to Telegram
    let tg_filename = format!("{}.enc", filename);
    let msg = telegram::send_document(&creds.bot_token, creds.channel_id, encrypted, &tg_filename).await?;
    let document = msg.document.ok_or_else(|| "Telegram trả message không có document".to_string())?;

    // Insert SQLite
    let file_id = format!("f_{}", &sha256[..16]);
    let now_ms = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0);
    let mime = document.mime_type.clone();
    let row = db::FileRow {
        id: file_id.clone(),
        name: filename.clone(),
        size_bytes: size as i64,
        mime,
        sha256_hex: sha256.clone(),
        folder_id: None,
        created_at: now_ms,
        total_chunks: 1,
    };
    let chunk = db::ChunkRow {
        file_id: file_id.clone(),
        idx: 0,
        tg_message_id: msg.message_id,
        tg_file_id: Some(document.file_id),
        byte_size: size as i64,
        nonce_hex,
    };
    let path = db::db_path(&app)?;
    let conn = db::open(&path).map_err(|e| format!("db open: {}", e))?;
    db::insert_file(&conn, &row).map_err(|e| format!("insert file: {}", e))?;
    db::insert_chunk(&conn, &chunk).map_err(|e| format!("insert chunk: {}", e))?;

    Ok(UploadResult {
        file_id,
        name: filename,
        size_bytes: size as i64,
        sha256_hex: sha256,
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

    let mut output = Vec::with_capacity(file_row.size_bytes as usize);
    for chunk in &chunks {
        let tg_file_id = chunk.tg_file_id.as_ref()
            .ok_or_else(|| format!("Chunk {} không có tg_file_id", chunk.idx))?;
        let file_info = telegram::get_file(&creds.bot_token, tg_file_id).await?;
        let file_path = file_info.file_path
            .ok_or_else(|| "Telegram không trả file_path (file expired hoặc deleted)".to_string())?;
        let encrypted = telegram::download_file_bytes(&creds.bot_token, &file_path).await?;
        let plaintext = crypto::decrypt(&creds.master_key_hex, &encrypted)?;
        output.extend_from_slice(&plaintext);
    }

    // Verify SHA256
    let actual_sha = crypto::sha256_hex(&output);
    if actual_sha != file_row.sha256_hex {
        return Err(format!(
            "SHA256 mismatch: expected {} got {}. File có thể bị corrupt.",
            &file_row.sha256_hex[..12], &actual_sha[..12]
        ));
    }

    tokio::fs::write(&dest_path, &output).await.map_err(|e| format!("write file: {}", e))?;
    Ok(())
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
