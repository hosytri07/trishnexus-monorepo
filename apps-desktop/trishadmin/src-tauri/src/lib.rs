//! TrishAdmin Rust backend.
//!
//! Phase 18.7.a base commands (giữ nguyên):
//!   - `app_version` — version từ Cargo.toml.
//!   - `read_text_file(path)` — đọc file text bất kỳ (cho Registry editor đọc
//!     apps-registry.json + min-specs.json local).
//!   - `write_text_file(path, content)` — ghi atomic (temp + rename) cho registry edit.
//!   - `default_data_dir` — thư mục local cache (vd repo path lưu sẵn cho lần sau).
//!   - `check_path_exists(path)` — kiểm tra file/folder tồn tại.
//!
//! Phase 24.1 — TrishDrive moved vào TrishAdmin (admin-only):
//!   5 module Rust copy từ trishdrive (creds/crypto/db/mtproto/telegram).
//!   ~36 Tauri commands cho upload/download/share/MTProto/folder/trash.
//!   Pipeline:
//!     Upload Bot API:  read → AES-256-GCM encrypt → sendDocument → SQLite insert
//!     Upload MTProto:  read → AES-256-GCM encrypt → upload_stream channel → SQLite insert
//!     Download:        SQLite query → getFile/iter_download → decrypt → write file → verify SHA256
//!
//! KHÔNG có Firebase Admin SDK ở Rust — frontend dùng Firebase SDK JS giống
//! các app khác. Admin role check ở client + Firestore Security Rules.

mod creds;
mod crypto;
mod db;
mod mtproto;
mod telegram;

use std::{
    fs::{self, File},
    io::{Read, Write},
    path::PathBuf,
};

use serde::Serialize;
use tauri::Emitter;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DataDirInfo {
    pub data_dir: String,
}

const FILE_CAP_BYTES: u64 = 16 * 1024 * 1024; // 16 MiB

// ============================================================
// TrishAdmin gốc (Phase 18.7.a) — registry / data dir helpers
// ============================================================

#[tauri::command]
fn app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[tauri::command]
fn default_data_dir() -> Result<DataDirInfo, String> {
    let base = dirs::data_local_dir()
        .ok_or_else(|| "không lấy được data_local_dir".to_string())?;
    let dir = base.join("TrishTEAM").join("TrishAdmin");
    fs::create_dir_all(&dir).map_err(|e| format!("create_dir_all: {e}"))?;
    Ok(DataDirInfo {
        data_dir: dir.to_string_lossy().to_string(),
    })
}

#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
    let p = PathBuf::from(&path);
    let meta = fs::metadata(&p).map_err(|e| format!("metadata({path}): {e}"))?;
    if meta.len() > FILE_CAP_BYTES {
        return Err(format!(
            "File quá lớn ({} bytes > cap {})",
            meta.len(),
            FILE_CAP_BYTES
        ));
    }
    let mut f = File::open(&p).map_err(|e| format!("open({path}): {e}"))?;
    let mut buf = String::new();
    f.read_to_string(&mut buf).map_err(|e| format!("read: {e}"))?;
    Ok(buf)
}

#[tauri::command]
fn write_text_file(path: String, content: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    if content.len() as u64 > FILE_CAP_BYTES {
        return Err(format!("Content quá lớn ({} bytes)", content.len()));
    }
    if let Some(parent) = p.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("create_dir_all: {e}"))?;
    }
    // Atomic write: ghi vào temp rồi rename.
    let tmp = p.with_extension(format!(
        "{}.tmp",
        p.extension().map(|s| s.to_string_lossy()).unwrap_or_default()
    ));
    {
        let mut f = File::create(&tmp).map_err(|e| format!("create tmp: {e}"))?;
        f.write_all(content.as_bytes())
            .map_err(|e| format!("write tmp: {e}"))?;
        f.sync_all().ok();
    }
    fs::rename(&tmp, &p).map_err(|e| format!("rename: {e}"))?;
    Ok(())
}

#[tauri::command]
fn check_path_exists(path: String) -> bool {
    PathBuf::from(&path).exists()
}

// ============================================================
// Phase 24.1 — TrishDrive commands (copy từ trishdrive/src/lib.rs)
// ============================================================

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

#[tauri::command]
fn tg_ping() -> String {
    "TrishDrive backend (in TrishAdmin) ready — Phase 24.1".to_string()
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

    let mut file = tokio::fs::File::open(&path).await.map_err(|e| format!("open file: {}", e))?;
    let metadata = file.metadata().await.map_err(|e| format!("metadata: {}", e))?;
    let size = metadata.len() as usize;
    if size == 0 {
        return Err("File rỗng".to_string());
    }
    let total_chunks = ((size + CHUNK_SIZE - 1) / CHUNK_SIZE).max(1) as i64;

    // Pass 1: streaming SHA-256
    let mut hasher = Sha256::new();
    let mut buf = vec![0u8; 4 * 1024 * 1024];
    let mut hashed_bytes = 0;
    loop {
        let n = file.read(&mut buf).await.map_err(|e| format!("read sha: {}", e))?;
        if n == 0 { break; }
        hasher.update(&buf[..n]);
        hashed_bytes += n;
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

    // Pass 2: chunk + encrypt + upload tuần tự
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

    let _ = app.emit("drive-progress", ProgressEvent {
        op: "upload".into(), file_id: file_id.clone(),
        current_chunk: 0, total_chunks,
        bytes_done: 0, total_bytes: size as i64,
    });

    let mut chunk_buf = vec![0u8; CHUNK_SIZE];
    let mut bytes_done: usize = 0;

    for idx in 0..total_chunks {
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

        // Retry 3 lần với exponential backoff
        let mut last_err = String::new();
        let mut msg_opt = None;
        for attempt in 0..3 {
            let encrypted_clone = encrypted.clone();
            match telegram::send_document(&creds.bot_token, creds.channel_id, encrypted_clone, &chunk_filename).await {
                Ok(m) => { msg_opt = Some(m); break; }
                Err(e) => {
                    last_err = e;
                    if attempt < 2 {
                        let delay_secs = 1u64 << attempt;
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

    let mut out_file = tokio::fs::File::create(&dest_path).await.map_err(|e| format!("create file: {}", e))?;
    let mut hasher = Sha256::new();
    let mut bytes_done: i64 = 0;

    for (i, chunk) in chunks.iter().enumerate() {
        let tg_file_id = chunk.tg_file_id.as_ref()
            .ok_or_else(|| format!("Chunk {} không có tg_file_id", chunk.idx))?;

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
        let _ = tokio::fs::remove_file(&dest_path).await;
        return Err(format!(
            "SHA256 mismatch: expected {} got {}. File có thể bị corrupt — đã xoá.",
            &file_row.sha256_hex[..12], &actual_sha[..12]
        ));
    }
    Ok(())
}

// ============================================================
// Folder CRUD + file metadata update
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
// MTProto status + login flow
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
// Share link (zero-knowledge, password protected)
// ============================================================

#[derive(Serialize)]
pub struct ShareResult {
    pub token: String,
    pub url: String,
    pub short_url: Option<String>,
}

#[derive(serde::Serialize)]
struct ShareCreatePayload {
    owner_uid: String,
    file_id: String,
    file_name: String,
    file_size_bytes: i64,
    file_sha256_hex: String,
    /// Phase 26.0 — 'botapi' | 'mtproto'
    pipeline: String,
    chunks: Vec<ShareChunk>,
    encrypted_bot_token_hex: String,
    encrypted_master_key_hex: String,
    expires_at: Option<i64>,
    max_downloads: Option<i64>,
    /// Phase 26.1.E.1 — admin toggle: hiện trong "Thư viện TrishTEAM" public.
    /// Default false (private, chỉ user có URL mới tải được).
    is_public: bool,
    /// Phase 26.1.E.1 — folder label cho Library UI grouping (vd: "App", "Tài liệu").
    /// Lấy từ folder_id của file trong DB (resolve sang folder.name).
    #[serde(skip_serializing_if = "Option::is_none")]
    folder_label: Option<String>,
}

#[derive(serde::Serialize)]
struct ShareChunk {
    idx: i64,
    byte_size: i64,
    nonce_hex: String,
    /// Phase 26.0 — discriminator
    pipeline: String,
    /// Bot API only
    #[serde(skip_serializing_if = "Option::is_none")]
    tg_file_id: Option<String>,
    /// MTProto only — message id trong channel
    #[serde(skip_serializing_if = "Option::is_none")]
    tg_message_id: Option<i64>,
    /// MTProto only — channel id (cùng cho mọi chunk file)
    #[serde(skip_serializing_if = "Option::is_none")]
    channel_id: Option<i64>,
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
    is_public: Option<bool>,
) -> Result<ShareResult, String> {
    let no_password = password.is_empty();
    let effective_password: String = if no_password {
        use rand::RngCore;
        let mut bytes = [0u8; 16];
        rand::thread_rng().fill_bytes(&mut bytes);
        hex::encode(bytes)
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
    let pipeline = file_row.pipeline.clone();
    let chunks_db = db::get_chunks(&conn, &file_id).map_err(|e| format!("chunks: {}", e))?;

    // Phase 26.0 — share link cho cả Bot API và MTProto.
    // Bot API: chunks lưu tg_file_id (Bot API).
    // MTProto: chunks lưu tg_message_id + channel_id (creds.channel_id).
    //   Web /proxy MTProto path dùng bot.forwardMessage(channel→log_channel) → getFile.
    let chunks: Vec<ShareChunk> = chunks_db.iter().map(|c| {
        if pipeline == "mtproto" {
            ShareChunk {
                idx: c.idx,
                byte_size: c.byte_size,
                nonce_hex: c.nonce_hex.clone(),
                pipeline: "mtproto".into(),
                tg_file_id: None,
                tg_message_id: Some(c.tg_message_id),
                channel_id: Some(creds.channel_id),
            }
        } else {
            ShareChunk {
                idx: c.idx,
                byte_size: c.byte_size,
                nonce_hex: c.nonce_hex.clone(),
                pipeline: "botapi".into(),
                tg_file_id: Some(c.tg_file_id.clone().unwrap_or_default()),
                tg_message_id: None,
                channel_id: None,
            }
        }
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

    // Phase 26.1.E.1 — resolve folder label cho Library grouping
    let folder_label: Option<String> = if let Some(fid) = file_row.folder_id.as_ref() {
        let folders = db::list_folders(&conn).map_err(|e| format!("folders: {}", e))?;
        folders.into_iter().find(|f| &f.id == fid).map(|f| f.name)
    } else {
        None
    };

    let payload = ShareCreatePayload {
        owner_uid: uid,
        file_id,
        file_name: file_row.name,
        file_size_bytes: file_row.size_bytes,
        file_sha256_hex: file_row.sha256_hex,
        pipeline,
        chunks,
        encrypted_bot_token_hex: encrypted_bot_token,
        encrypted_master_key_hex: encrypted_master_key,
        expires_at,
        max_downloads,
        is_public: is_public.unwrap_or(false),
        folder_label,
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
        let trimmed = body_text.trim_start();
        if trimmed.starts_with("<!DOCTYPE") || trimmed.starts_with("<html") {
            return Err(format!(
                "Server {} chưa có endpoint /api/drive/share/create (HTTP {}). \
                Web TrishTEAM cần deploy bản mới — chạy 'git push origin main' để Vercel build.",
                SHARE_API_BASE, status
            ));
        }
        if let Ok(err_json) = serde_json::from_str::<serde_json::Value>(&body_text) {
            if let Some(msg) = err_json.get("error").and_then(|v| v.as_str()) {
                return Err(format!("API {}: {}", status, msg));
            }
        }
        return Err(format!("API error {}: {}", status, body_text.chars().take(200).collect::<String>()));
    }
    let result: ShareCreateResponse = serde_json::from_str(&body_text)
        .map_err(|e| format!("Parse JSON response: {}. Body: {}", e, body_text.chars().take(200).collect::<String>()))?;

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
        - 30 * 24 * 3600 * 1000;
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
// MTProto upload/download/purge pipeline (chunk 100MB)
// ============================================================

const MTPROTO_CHUNK_SIZE: usize = 100 * 1024 * 1024;

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
    let file_id = format!("f_{}_m", &sha256[..16]);
    file.seek(std::io::SeekFrom::Start(0)).await.map_err(|e| format!("seek: {}", e))?;

    let now_ms = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0);

    let db_path_buf = db::db_path(&app)?;
    let conn = db::open(&db_path_buf).map_err(|e| format!("db open: {}", e))?;

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

        let app_progress = app.clone();
        let file_id_progress = file_id.clone();
        let baseline_bytes = bytes_done;
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
            tg_file_id: None,
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

    let _ = mtproto::delete_from_channel(
        mt_cfg.api_id, &mt_cfg.api_hash, &session_path,
        &uid, creds.channel_id, &msg_ids,
    ).await;
    db::delete_file(&conn, &file_id).map_err(|e| format!("delete: {}", e))?;
    Ok(())
}

// ============================================================
// Tauri builder + run
// ============================================================

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(mtproto::MtprotoState::default())
        .invoke_handler(tauri::generate_handler![
            // TrishAdmin gốc (Phase 18.7.a)
            app_version,
            default_data_dir,
            read_text_file,
            write_text_file,
            check_path_exists,
            // TrishDrive — Bot API
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
            // TrishDrive — MTProto
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
            // Init SQLite DB lúc app start (silent fail nếu lỗi — sẽ retry khi gọi command).
            if let Ok(path) = db::db_path(&app.handle()) {
                let _ = db::open(&path);
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running TrishAdmin");
}
