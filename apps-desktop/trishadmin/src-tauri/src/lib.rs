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
mod http_api;
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

// Phase 28.14 — LISP library upload (chat_id as string để support @channelname)
#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TgUploadLispRequest {
    pub bot_token: String,
    pub chat_id: String,
    pub caption: String,
    pub filename: String,
    pub file_data: Vec<u8>,
}

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TgUploadLispResponse {
    pub file_id: String,
    pub file_path: String,
}

#[tauri::command]
async fn tg_upload_lisp(req: TgUploadLispRequest) -> Result<TgUploadLispResponse, String> {
    let url = format!("https://api.telegram.org/bot{}/sendDocument", req.bot_token);
    let part = reqwest::multipart::Part::bytes(req.file_data)
        .file_name(req.filename.clone());
    let form = reqwest::multipart::Form::new()
        .text("chat_id", req.chat_id.clone())
        .text("caption", req.caption.clone())
        .part("document", part);
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(180))
        .build()
        .map_err(|e| format!("client: {}", e))?;
    let resp = client.post(&url).multipart(form).send().await
        .map_err(|e| format!("Network: {}", e))?;
    let text = resp.text().await.map_err(|e| format!("Read: {}", e))?;
    let json: serde_json::Value = serde_json::from_str(&text)
        .map_err(|e| format!("Parse: {}", e))?;
    if !json.get("ok").and_then(|v| v.as_bool()).unwrap_or(false) {
        return Err(format!("Telegram error: {}", text));
    }
    let file_id = json
        .pointer("/result/document/file_id")
        .and_then(|v| v.as_str())
        .ok_or("Missing file_id in response")?
        .to_string();

    // getFile để lấy file_path tươi (sẽ refresh ở client mỗi lần download)
    let get_url = format!("https://api.telegram.org/bot{}/getFile?file_id={}", req.bot_token, file_id);
    let getf = client.get(&get_url).send().await.map_err(|e| format!("getFile: {}", e))?;
    let getf_text = getf.text().await.map_err(|e| format!("getFile read: {}", e))?;
    let getf_json: serde_json::Value = serde_json::from_str(&getf_text)
        .map_err(|e| format!("getFile parse: {}", e))?;
    let file_path = getf_json
        .pointer("/result/file_path")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    Ok(TgUploadLispResponse { file_id, file_path })
}

#[tauri::command]
async fn read_file_bytes(path: String) -> Result<Vec<u8>, String> {
    tokio::fs::read(&path).await.map_err(|e| format!("Read file: {}", e))
}

#[tauri::command]
fn file_size(path: String) -> Result<u64, String> {
    std::fs::metadata(&path)
        .map(|m| m.len())
        .map_err(|e| format!("metadata: {}", e))
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
        thumb_tg_file_id: None,
    };
    db::insert_file(&conn, &row).map_err(|e| format!("insert file: {}", e))?;

    let _ = app.emit("drive-progress", ProgressEvent {
        op: "upload".into(), file_id: file_id.clone(),
        current_chunk: 0, total_chunks,
        bytes_done: 0, total_bytes: size as i64,
    });

    // Phase 25.0.C — Parallel upload 3 chunks song song.
    // Pass 1: read tất cả chunks vào memory (file ≤50MB-ish nên RAM acceptable).
    // Pass 2: spawn upload tasks với buffer_unordered(3).
    let mut chunks_data: Vec<(i64, Vec<u8>)> = Vec::with_capacity(total_chunks as usize);
    {
        let mut chunk_buf = vec![0u8; CHUNK_SIZE];
        let mut bytes_read: usize = 0;
        for idx in 0..total_chunks {
            let remaining = size - bytes_read;
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
            chunks_data.push((idx, chunk_buf[..to_read].to_vec()));
            bytes_read += to_read;
        }
    }

    // Pass 2: parallel encrypt + upload (concurrency 3 — Telegram rate-limit)
    use futures::stream::{self, StreamExt};
    use std::sync::atomic::{AtomicI64, Ordering};
    use std::sync::Arc;
    const CONCURRENCY: usize = 3;
    let bot_token = creds.bot_token.clone();
    let master_key_hex = creds.master_key_hex.clone();
    let channel_id = creds.channel_id;
    let filename_clone = filename.clone();
    let total_chunks_for_name = total_chunks;
    // Shared progress counter for parallel upload tasks
    let bytes_done_atomic = Arc::new(AtomicI64::new(0));
    let chunks_done_atomic = Arc::new(AtomicI64::new(0));
    let app_handle = app.clone();
    let file_id_for_emit = file_id.clone();
    let size_for_emit = size as i64;

    type UploadOut = Result<(i64, i64, Option<String>, i64, String), String>;
    let upload_tasks = stream::iter(chunks_data.into_iter())
        .map(|(idx, plaintext): (i64, Vec<u8>)| {
            let bot_token = bot_token.clone();
            let master_key_hex = master_key_hex.clone();
            let filename = filename_clone.clone();
            let bytes_done_a = bytes_done_atomic.clone();
            let chunks_done_a = chunks_done_atomic.clone();
            let app_h = app_handle.clone();
            let fid_emit = file_id_for_emit.clone();
            let total_bytes_emit = size_for_emit;
            async move {
                let to_read = plaintext.len();
                let encrypted = crypto::encrypt(&master_key_hex, &plaintext)?;
                let nonce_hex = hex::encode(&encrypted[..crypto::NONCE_SIZE]);
                let chunk_filename = if total_chunks_for_name > 1 {
                    format!("{}.part{:03}.enc", filename, idx)
                } else {
                    format!("{}.enc", filename)
                };
                // Retry 3 lần
                let mut last_err = String::new();
                for attempt in 0..3 {
                    match telegram::send_document(&bot_token, channel_id, encrypted.clone(), &chunk_filename).await {
                        Ok(m) => {
                            let document = m.document.ok_or_else(|| "msg missing document".to_string())?;
                            // Emit progress: bytes + chunks tăng atomic
                            let new_bytes = bytes_done_a.fetch_add(to_read as i64, Ordering::SeqCst) + to_read as i64;
                            let new_chunks = chunks_done_a.fetch_add(1, Ordering::SeqCst) + 1;
                            let _ = app_h.emit("drive-progress", ProgressEvent {
                                op: "upload".into(),
                                file_id: fid_emit.clone(),
                                current_chunk: new_chunks,
                                total_chunks: total_chunks_for_name,
                                bytes_done: new_bytes,
                                total_bytes: total_bytes_emit,
                            });
                            return Ok::<_, String>((idx, m.message_id, Some(document.file_id), to_read as i64, nonce_hex));
                        }
                        Err(e) => {
                            last_err = e;
                            if attempt < 2 {
                                tokio::time::sleep(std::time::Duration::from_secs(1u64 << attempt)).await;
                            }
                        }
                    }
                }
                Err(format!("chunk {} fail sau 3 lần: {}", idx, last_err))
            }
        })
        .buffer_unordered(CONCURRENCY);

    let results: Vec<UploadOut> = upload_tasks.collect().await;
    let mut chunk_rows: Vec<db::ChunkRow> = Vec::with_capacity(total_chunks as usize);
    for r in results {
        match r {
            Ok((idx, msg_id, tg_file_id, byte_size, nonce_hex)) => {
                chunk_rows.push(db::ChunkRow {
                    file_id: file_id.clone(), idx,
                    tg_message_id: msg_id,
                    tg_file_id,
                    byte_size, nonce_hex,
                });
            }
            Err(e) => {
                let _ = db::delete_file(&conn, &file_id);
                return Err(format!("Upload chunk parallel fail: {}", e));
            }
        }
    }
    // Insert chunks theo idx order (download cần đúng thứ tự)
    chunk_rows.sort_by_key(|c| c.idx);
    for c in chunk_rows.iter() {
        db::insert_chunk(&conn, c).map_err(|e| format!("insert chunk: {}", e))?;
    }
    // Final emit 100%
    let _ = app.emit("drive-progress", ProgressEvent {
        op: "upload".into(), file_id: file_id.clone(),
        current_chunk: total_chunks, total_chunks,
        bytes_done: size as i64, total_bytes: size as i64,
    });

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
    /// Phase 25.1.G — Public no-password shares: gửi key plaintext lên server
    /// để Library API trả cho user app auto-decrypt. CHỈ set khi is_public=true
    /// và user không nhập password (key auto-gen random).
    #[serde(skip_serializing_if = "Option::is_none")]
    library_password_hex: Option<String>,
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

    let public_flag = is_public.unwrap_or(false);
    // Phase 25.1.G — public + no-password → gửi effective_password (random hex)
    // lên server để Library API trả cho user app auto-decrypt.
    let library_password_hex = if public_flag && no_password {
        Some(effective_password.clone())
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
        is_public: public_flag,
        folder_label,
        library_password_hex,
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

/// Phase 25.1.J — Hạ chunk MTProto từ 100MB → 19MB.
///
/// Lý do: download qua website `/api/drive/share/[token]/proxy` route forward
/// MTProto message sang log channel rồi gọi Bot API `getFile`. Bot API giới hạn
/// `getFile` trả file ≤ 20MB. File >20MB upload nguyên 1 chunk MTProto sẽ KHÔNG
/// tải được qua website hoặc TrishDrive User app (cùng pipeline).
///
/// Giảm xuống 19MB đồng bộ với `CHUNK_SIZE` của Bot API → mỗi chunk forward
/// + getFile đều dưới 20MB. Trade-off: upload nhiều chunk hơn (file 100MB →
/// 6 chunks thay vì 1), nhưng vẫn nhanh hơn Bot API thuần vì MTProto upload
/// stream được, không bị rate-limit như sendDocument.
///
/// File MTProto cũ (size > 19MB · 1 chunk) phải re-upload sau khi update.
const MTPROTO_CHUNK_SIZE: usize = 19 * 1024 * 1024;

// ============================================================
// Phase 25.0.B — FFmpeg thumbnail generator
// ============================================================

/// Detect kind từ extension. Return None nếu không thumbnailable.
fn thumb_kind_from_path(path: &str) -> Option<&'static str> {
    let ext = std::path::Path::new(path)
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_ascii_lowercase())
        .unwrap_or_default();
    match ext.as_str() {
        "mp4" | "mov" | "avi" | "mkv" | "webm" | "flv" | "wmv" | "m4v" | "3gp" => Some("video"),
        "mp3" | "wav" | "ogg" | "flac" | "m4a" | "aac" | "opus" => Some("audio"),
        "pdf" => Some("pdf"),
        "jpg" | "jpeg" | "png" | "gif" | "bmp" | "webp" => Some("image"),
        _ => None,
    }
}

/// Sinh thumbnail JPG bytes (max 250x250) cho video/audio/PDF/image.
/// Dùng FFmpeg subprocess. Nếu FFmpeg không có, return Err — caller xử lý skip.
#[tauri::command]
async fn generate_thumbnail(file_path: String) -> Result<Vec<u8>, String> {
    let kind = thumb_kind_from_path(&file_path)
        .ok_or_else(|| "Không hỗ trợ thumbnail cho định dạng này".to_string())?;

    // Output JPG vào temp file để đọc bytes
    let tmp_dir = std::env::temp_dir();
    let tmp_name = format!("trishdrive_thumb_{}.jpg", std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos()).unwrap_or(0));
    let tmp_path = tmp_dir.join(&tmp_name);
    let tmp_str = tmp_path.to_string_lossy().to_string();

    let args: Vec<String> = match kind {
        "video" => vec![
            "-y".into(), "-i".into(), file_path.clone(),
            "-ss".into(), "00:00:01".into(),    // skip 1 giây để skip black intro
            "-vframes".into(), "1".into(),
            "-vf".into(), "scale='min(250,iw)':'-1'".into(),
            "-q:v".into(), "5".into(),
            tmp_str.clone(),
        ],
        "audio" => vec![
            "-y".into(), "-i".into(), file_path.clone(),
            "-filter_complex".into(),
            "showwavespic=s=250x100:colors=#10b981".into(),
            "-frames:v".into(), "1".into(),
            tmp_str.clone(),
        ],
        "pdf" => {
            // pdftoppm preferable; FFmpeg can read 1st page via -i image2 nhưng yêu cầu MuPDF.
            // Fallback: try ffmpeg với "image2" demuxer; nếu fail thì user chấp nhận no thumb.
            vec![
                "-y".into(), "-i".into(), file_path.clone(),
                "-vframes".into(), "1".into(),
                "-vf".into(), "scale='min(250,iw)':'-1'".into(),
                tmp_str.clone(),
            ]
        }
        "image" => vec![
            "-y".into(), "-i".into(), file_path.clone(),
            "-vf".into(), "scale='min(250,iw)':'-1'".into(),
            "-q:v".into(), "5".into(),
            tmp_str.clone(),
        ],
        _ => return Err("kind không hỗ trợ".into()),
    };

    let output = tokio::process::Command::new("ffmpeg")
        .args(&args)
        .output()
        .await
        .map_err(|e| format!("Spawn ffmpeg lỗi (cài FFmpeg + thêm vào PATH): {}", e))?;

    if !output.status.success() {
        let _ = std::fs::remove_file(&tmp_path);
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("FFmpeg fail: {}", stderr.lines().last().unwrap_or("?")));
    }

    let bytes = tokio::fs::read(&tmp_path).await
        .map_err(|e| format!("Đọc thumbnail temp: {}", e))?;
    let _ = std::fs::remove_file(&tmp_path);
    Ok(bytes)
}

/// Sinh thumbnail rồi upload lên Telegram channel + lưu DB.
/// Idempotent: nếu file đã có thumb_tg_file_id, skip.
#[tauri::command]
async fn file_generate_and_upload_thumb(
    app: tauri::AppHandle,
    uid: String,
    file_id: String,
    file_path: String,
) -> Result<Option<String>, String> {
    let creds = creds::load_creds(&uid)?
        .ok_or_else(|| "Chưa setup Telegram".to_string())?;

    // Check existing
    let db_path_buf = db::db_path(&app)?;
    let conn = db::open(&db_path_buf).map_err(|e| format!("db: {}", e))?;
    if let Ok(Some(_existing)) = db::get_thumb_file_id(&conn, &file_id) {
        return Ok(None); // đã có rồi, skip
    }

    let thumb_bytes = match generate_thumbnail(file_path.clone()).await {
        Ok(b) => b,
        Err(e) => return Err(e),
    };
    if thumb_bytes.is_empty() {
        return Err("Thumbnail rỗng".into());
    }

    // Upload thumbnail (KHÔNG encrypt — thumbnail là metadata, chấp nhận plain)
    let thumb_filename = format!("{}.thumb.jpg", file_id);
    let msg = telegram::send_document(
        &creds.bot_token,
        creds.channel_id,
        thumb_bytes,
        &thumb_filename,
    ).await.map_err(|e| format!("upload thumb: {}", e))?;

    let document = msg.document.ok_or_else(|| "msg missing document".to_string())?;
    db::update_thumb(&conn, &file_id, &document.file_id, msg.message_id)
        .map_err(|e| format!("update thumb db: {}", e))?;

    Ok(Some(document.file_id))
}

/// Phase 25.0.A — Auto-route upload theo size:
///   > 50MB → MTProto (nếu có session) — upload 1 chunk lớn 2GB/4GB
///   ≤ 50MB → Bot API (nhanh, đơn giản, không cần MTProto session)
///   > 50MB nhưng chưa có MTProto → trả lỗi yêu cầu admin setup MTProto.
const BOT_API_UPLOAD_LIMIT: u64 = 50 * 1024 * 1024;

#[tauri::command]
async fn file_upload_auto(
    app: tauri::AppHandle,
    uid: String,
    file_path: String,
    folder_id: Option<String>,
    note: Option<String>,
) -> Result<UploadResult, String> {
    let metadata = tokio::fs::metadata(&file_path).await
        .map_err(|e| format!("metadata: {}", e))?;
    let size = metadata.len();

    if size <= BOT_API_UPLOAD_LIMIT {
        // Đường nhanh: Bot API (chunk 19MB nếu cần)
        return file_upload(app, uid, file_path, folder_id, note).await;
    }

    // File > 50MB — cần MTProto userbot
    let mt_cfg = creds::load_mtproto_config(&uid)?;
    if mt_cfg.is_none() {
        return Err(format!(
            "File này {} MB > 50 MB — cần MTProto userbot để upload (Bot API max 50MB). \
             Setup MTProto: Settings → MTProto → đăng ký api_id/hash tại my.telegram.org → đăng nhập số ĐT.",
            size / 1024 / 1024
        ));
    }
    let session_path = mtproto_session_path(&app, &uid)?;
    if !session_path.exists() {
        return Err(
            "MTProto đã có config nhưng chưa đăng nhập. Vào Settings → MTProto → Setup → nhập OTP.".into()
        );
    }

    file_upload_mtproto(app, uid, file_path, folder_id, note).await
}

#[tauri::command]
async fn file_upload_mtproto(
    app: tauri::AppHandle,
    uid: String,
    file_path: String,
    folder_id: Option<String>,
    note: Option<String>,
) -> Result<UploadResult, String> {
    use sha2::{Digest, Sha256};
    use std::sync::Arc;
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
        thumb_tg_file_id: None,
    };
    db::insert_file(&conn, &row).map_err(|e| format!("insert file: {}", e))?;

    let _ = app.emit("drive-progress", ProgressEvent {
        op: "upload".into(), file_id: file_id.clone(),
        current_chunk: 0, total_chunks,
        bytes_done: 0, total_bytes: size as i64,
    });

    // Phase 25.2.A — Parallel chunks upload MTProto (3 song song).
    //
    // Trước: tuần tự — mỗi chunk open client → upload → send_message → close.
    // 100MB file (6 chunk) ≈ 3-4 phút.
    //
    // Sau: open client 1 lần + spawn parallel với semaphore=3.
    // - Loop main đọc + encrypt 1 chunk khi có slot trống → bộ nhớ tối đa
    //   ~3-4 chunk × 19MB = 57-76MB (an toàn cả file 10GB+).
    // - Spawn task upload + send_message dùng client.clone() (Arc internally).
    // - Telegram cho phép multiple RPC concurrent trên cùng MTProto session.
    // Kỳ vọng: upload 100MB ~30-60s, file 1GB ~5-10 phút.
    // grammers Client + PackedChat đều cheap-clone (Arc internal cho Client,
    // Copy fields cho PackedChat) → spawn task chỉ cần .clone() là đủ.
    let client = mtproto::open_authorized_client(mt_cfg.api_id, &mt_cfg.api_hash, &session_path).await?;
    let channel = mtproto::resolve_or_load_channel(&client, &uid, creds.channel_id).await?;

    use std::sync::atomic::{AtomicI64, Ordering as AtomicOrdering};
    let bytes_done_atomic = Arc::new(AtomicI64::new(0));
    let total_size_i64 = size as i64;
    let semaphore = Arc::new(tokio::sync::Semaphore::new(3));

    let mut tasks: Vec<tokio::task::JoinHandle<Result<(i64, i64, String, i64), String>>> = Vec::with_capacity(total_chunks as usize);
    let mut chunk_buf = vec![0u8; MTPROTO_CHUNK_SIZE];
    let mut bytes_read: usize = 0;

    for idx in 0..total_chunks {
        // Đợi semaphore (tối đa 3 chunk song song) trước khi đọc chunk tiếp theo
        // → bộ nhớ không bao giờ giữ quá 4 chunks (3 uploading + 1 đang đọc).
        let permit = semaphore.clone().acquire_owned().await
            .map_err(|e| format!("semaphore: {}", e))?;

        let remaining = size - bytes_read;
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
        bytes_read += to_read;

        let encrypted = crypto::encrypt(&creds.master_key_hex, &chunk_buf[..to_read])?;
        let nonce_hex_str = hex::encode(&encrypted[..crypto::NONCE_SIZE]);
        let chunk_filename = if total_chunks > 1 {
            format!("{}.part{:03}.enc", filename, idx)
        } else {
            format!("{}.enc", filename)
        };

        let client_c = client.clone();
        let channel_c = channel.clone();
        let app_c = app.clone();
        let file_id_c = file_id.clone();
        let bytes_done_c = bytes_done_atomic.clone();
        let total_chunks_c = total_chunks;

        let task = tokio::spawn(async move {
            let _permit = permit; // hold permit until task ends (release on drop)
            let bytes_len = encrypted.len();
            let cursor = std::io::Cursor::new(encrypted);
            // ProgressReader để đảm bảo signature compatible — không dùng callback
            // vì progress concurrent từ 3 chunk khác nhau sẽ rối, dùng atomic tổng.
            let mut reader = mtproto::ProgressReader::new(cursor, |_| {});
            let uploaded = client_c.upload_stream(&mut reader, bytes_len, chunk_filename).await
                .map_err(|e| format!("upload_stream chunk {}: {}", idx, e))?;
            let msg = client_c.send_message(
                channel_c,
                grammers_client::InputMessage::text("").document(uploaded),
            ).await
                .map_err(|e| format!("send_message chunk {}: {}", idx, e))?;

            // Cộng dồn bytes_done atomic + emit progress
            let new_done = bytes_done_c.fetch_add(bytes_len as i64, AtomicOrdering::SeqCst) + bytes_len as i64;
            let _ = app_c.emit("drive-progress", ProgressEvent {
                op: "upload".into(),
                file_id: file_id_c,
                current_chunk: idx + 1,
                total_chunks: total_chunks_c,
                bytes_done: new_done,
                total_bytes: total_size_i64,
            });

            Ok((idx, msg.id() as i64, nonce_hex_str, bytes_len as i64))
        });
        tasks.push(task);
    }

    // Collect results theo thứ tự spawn (không cần sort vì idx đã track)
    let mut results: Vec<(i64, i64, String, i64)> = Vec::with_capacity(tasks.len());
    for task in tasks {
        let r = task.await.map_err(|e| {
            let _ = db::delete_file(&conn, &file_id);
            format!("join task: {}", e)
        })?.map_err(|e| {
            let _ = db::delete_file(&conn, &file_id);
            e
        })?;
        results.push(r);
    }
    // Sort theo idx để insert DB đúng thứ tự (offsets phải đúng cho download)
    results.sort_by_key(|(idx, _, _, _)| *idx);

    for (idx, message_id, nonce_hex, byte_size) in results {
        let chunk_row = db::ChunkRow {
            file_id: file_id.clone(),
            idx,
            tg_message_id: message_id,
            tg_file_id: None,
            byte_size,
            nonce_hex,
        };
        db::insert_chunk(&conn, &chunk_row).map_err(|e| format!("insert chunk: {}", e))?;
    }

    // Final progress emit
    let _ = app.emit("drive-progress", ProgressEvent {
        op: "upload".into(),
        file_id: file_id.clone(),
        current_chunk: total_chunks,
        total_chunks,
        bytes_done: total_size_i64,
        total_bytes: total_size_i64,
    });

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
// Phase 25.0.D — HTTP API external (Bearer Token + Axum)
// ============================================================

// Helper functions called by http_api.rs (cross-module bridge)
pub(crate) async fn http_api_dispatch_upload(
    app: tauri::AppHandle,
    uid: String,
    file_path: String,
    folder_id: Option<String>,
    note: Option<String>,
) -> Result<UploadResult, String> {
    file_upload_auto(app, uid, file_path, folder_id, note).await
}

pub(crate) fn http_api_dispatch_list(app: tauri::AppHandle) -> Result<Vec<http_api::ApiFileItem>, String> {
    let path = db::db_path(&app)?;
    let conn = db::open(&path).map_err(|e| format!("db: {}", e))?;
    let files = db::list_files(&conn, None, None).map_err(|e| format!("list: {}", e))?;
    Ok(files.into_iter().map(|f| http_api::ApiFileItem {
        id: f.id,
        name: f.name,
        size_bytes: f.size_bytes,
        created_at: f.created_at,
        pipeline: f.pipeline,
    }).collect())
}

pub(crate) async fn http_api_dispatch_download(
    app: tauri::AppHandle,
    uid: String,
    file_id: String,
) -> Result<Vec<u8>, String> {
    // Download tới file tạm rồi đọc bytes (đơn giản hơn streaming Axum body)
    let tmp = std::env::temp_dir().join(format!(
        "trishdrive-api-dl-{}-{}",
        std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos()).unwrap_or(0),
        file_id
    ));
    let tmp_str = tmp.to_string_lossy().to_string();
    let path = db::db_path(&app)?;
    let conn = db::open(&path).map_err(|e| format!("db: {}", e))?;
    let f = db::get_file(&conn, &file_id).map_err(|e| format!("query: {}", e))?
        .ok_or_else(|| "File không tồn tại".to_string())?;
    drop(conn);
    if f.pipeline == "mtproto" {
        file_download_mtproto(app, uid, file_id, tmp_str.clone()).await?;
    } else {
        file_download(app, uid, file_id, tmp_str.clone()).await?;
    }
    let bytes = tokio::fs::read(&tmp).await.map_err(|e| format!("read tmp: {}", e))?;
    let _ = tokio::fs::remove_file(&tmp).await;
    Ok(bytes)
}

// Tauri commands cho UI quản lý API token + start/stop server
#[tauri::command]
fn api_token_get(uid: String) -> Result<Option<String>, String> {
    creds::load_api_token(&uid)
}

#[tauri::command]
fn api_token_generate(uid: String) -> Result<String, String> {
    let token = uuid::Uuid::new_v4().simple().to_string();
    creds::save_api_token(&uid, &token)?;
    Ok(token)
}

#[tauri::command]
fn api_token_revoke(uid: String) -> Result<(), String> {
    creds::delete_api_token(&uid)
}

use std::sync::Mutex as StdMutex;
struct HttpServerState {
    handle: StdMutex<Option<tokio::task::JoinHandle<()>>>,
    port: StdMutex<Option<u16>>,
}
impl Default for HttpServerState {
    fn default() -> Self {
        Self { handle: StdMutex::new(None), port: StdMutex::new(None) }
    }
}

#[tauri::command]
async fn http_api_start(
    app: tauri::AppHandle,
    state: tauri::State<'_, HttpServerState>,
    uid: String,
    port: u16,
) -> Result<u16, String> {
    let token = creds::load_api_token(&uid)?
        .ok_or_else(|| "Chưa generate API token. Bấm 'Generate token' trước.".to_string())?;
    // Stop existing server nếu có
    {
        let mut h = state.handle.lock().unwrap();
        if let Some(handle) = h.take() { handle.abort(); }
    }
    let api_state = http_api::ApiState {
        uid,
        token,
        app_handle: app,
    };
    let handle = tokio::spawn(async move {
        let _ = http_api::run_server(api_state, port).await;
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
fn http_api_stop(state: tauri::State<'_, HttpServerState>) -> Result<(), String> {
    let mut h = state.handle.lock().unwrap();
    if let Some(handle) = h.take() { handle.abort(); }
    let mut p = state.port.lock().unwrap();
    *p = None;
    Ok(())
}

#[tauri::command]
fn http_api_status(state: tauri::State<'_, HttpServerState>) -> Result<Option<u16>, String> {
    let p = state.port.lock().unwrap();
    Ok(*p)
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
        .manage(HttpServerState::default())
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
            // Phase 28.14 — LISP library upload helpers
            tg_upload_lisp,
            read_file_bytes,
            file_size,
            // Phase 25.0.A — Auto upload (Bot API ≤50MB, MTProto >50MB)
            file_upload_auto,
            // Phase 25.0.B — FFmpeg thumbnail
            generate_thumbnail,
            file_generate_and_upload_thumb,
            // Phase 25.0.D — HTTP API external Bearer Token
            api_token_get,
            api_token_generate,
            api_token_revoke,
            http_api_start,
            http_api_stop,
            http_api_status,
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
