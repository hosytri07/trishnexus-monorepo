//! MTProto client cho TrishDrive — Phase 23.
//!
//! Setup yêu cầu (mỗi user 1 lần):
//!   1. Đăng ký https://my.telegram.org/apps → lấy api_id + api_hash
//!   2. Trong app: paste api_id/hash + nhập phone → app gửi OTP qua Telegram
//!      → user nhập code → (nếu 2FA enabled, nhập password)
//!   3. Session lưu file `mtproto.session.{uid}` trong app data dir
//!
//! Giữa request_code và submit_code, giữ Client + LoginToken in memory qua
//! Tauri State (MtprotoState). Không serialize được token.

use grammers_client::{Client, Config, InitParams, SignInError};
use grammers_client::types::{LoginToken, PasswordToken};
use grammers_session::Session;
use serde::Serialize;
use std::path::PathBuf;
use tokio::sync::Mutex;

#[derive(Debug, Serialize, Clone)]
pub struct MtprotoStatus {
    pub configured: bool,    // có api_id/hash trong keyring chưa
    pub authorized: bool,    // có session valid + logged in chưa
    pub user_phone: Option<String>,
    pub user_username: Option<String>,
    pub session_path: String,
}

pub fn session_path(app_data_dir: &PathBuf, uid: &str) -> PathBuf {
    app_data_dir.join(format!("mtproto.session.{}", uid))
}

/// Login state held in Tauri State giữa request_code → submit_code → 2FA.
/// 2 trạng thái: AwaitingCode (sau request_code) và Awaiting2FA
/// (sau khi sign_in fail PasswordRequired và user chưa cung cấp password).
pub enum LoginPending {
    AwaitingCode {
        client: Client,
        token: LoginToken,
        #[allow(dead_code)]
        phone: String,
    },
    Awaiting2FA {
        client: Client,
        password_token: PasswordToken,
        #[allow(dead_code)]
        phone: String,
    },
}

#[derive(Default)]
pub struct MtprotoState {
    pub pending: Mutex<Option<LoginPending>>,
}

/// Phase 23.2 — Step 1: Connect Telegram + request OTP.
/// Sau khi success, lưu Client + LoginToken vào State để dùng ở submit_code.
/// Có timeout 90s để không bị treo vô hạn nếu DC connect lỗi.
pub async fn request_code(
    state: &MtprotoState,
    api_id: i32,
    api_hash: &str,
    phone: &str,
    session_path: &PathBuf,
) -> Result<(), String> {
    eprintln!("[MTProto] request_code start: phone={}, api_id={}", phone, api_id);

    let session = if session_path.exists() {
        eprintln!("[MTProto] loading existing session: {:?}", session_path);
        Session::load_file(session_path).map_err(|e| format!("load session: {}", e))?
    } else {
        eprintln!("[MTProto] new session (no file at {:?})", session_path);
        Session::new()
    };

    let connect_fut = Client::connect(Config {
        session,
        api_id,
        api_hash: api_hash.to_string(),
        params: InitParams {
            catch_up: false,
            ..Default::default()
        },
    });
    eprintln!("[MTProto] connecting to Telegram DC...");
    let client = tokio::time::timeout(std::time::Duration::from_secs(60), connect_fut)
        .await
        .map_err(|_| "Connect Telegram timeout 60s — kiểm tra mạng (Telegram có thể bị ISP chặn). Thử dùng 4G di động.".to_string())?
        .map_err(|e| format!("connect Telegram: {}", e))?;
    eprintln!("[MTProto] connected, requesting login code for {}...", phone);

    let req_fut = client.request_login_code(phone);
    let token = tokio::time::timeout(std::time::Duration::from_secs(45), req_fut)
        .await
        .map_err(|_| "Request OTP timeout 45s — api_id/api_hash có thể sai, hoặc số phone chưa đăng ký Telegram. Reset config + nhập lại.".to_string())?
        .map_err(|e| format!("request OTP: {}", e))?;
    eprintln!("[MTProto] OTP token received, waiting submit_code");

    let mut pending = state.pending.lock().await;
    *pending = Some(LoginPending::AwaitingCode {
        client,
        token,
        phone: phone.to_string(),
    });
    Ok(())
}

#[derive(Debug, Serialize)]
pub struct SignInResult {
    pub user_phone: Option<String>,
    pub user_username: Option<String>,
    pub needs_password: bool,
}

/// Helper: ensure parent dir of session_path exists trước khi save.
/// Tránh os error 2 (file not found) trên Windows.
fn ensure_session_dir(session_path: &PathBuf) -> Result<(), String> {
    if let Some(parent) = session_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("create session dir {:?}: {}", parent, e))?;
        eprintln!("[MTProto] session dir ready: {:?}", parent);
    }
    Ok(())
}

/// Save session bypass grammers `save_to_file` (lỗi atomic write trên Windows os error 2).
/// Lấy bytes từ `session().save()` rồi tự write qua std::fs::write — tự create file.
fn save_session_safe(client: &Client, session_path: &PathBuf) -> Result<(), String> {
    ensure_session_dir(session_path)?;
    let bytes = client.session().save();
    eprintln!("[MTProto] save_session_safe: writing {} bytes to {:?}", bytes.len(), session_path);
    std::fs::write(session_path, &bytes)
        .map_err(|e| format!("save session bytes ({:?}): {}", session_path, e))?;
    eprintln!("[MTProto] session bytes written OK");
    Ok(())
}

/// Phase 23.2 — Step 2: Submit OTP + (optional) 2FA password → save session.
///
/// State machine:
///   - AwaitingCode + code (no password) → sign_in
///       Ok → save → done
///       PasswordRequired:
///         password = None → re-park as Awaiting2FA, return needs_password=true
///         password = Some → check_password ngay → save → done
///   - Awaiting2FA + password → check_password → save → done
pub async fn submit_code(
    state: &MtprotoState,
    code: &str,
    password: Option<&str>,
    session_path: &PathBuf,
) -> Result<SignInResult, String> {
    eprintln!("[MTProto] submit_code: session_path={:?}, has_password={}", session_path, password.is_some());
    let mut pending_guard = state.pending.lock().await;
    let pending = pending_guard.take()
        .ok_or_else(|| "Chưa request_code hoặc token đã hết hạn — bấm 'Đăng nhập lại' để gửi OTP mới".to_string())?;

    match pending {
        LoginPending::AwaitingCode { client, token, phone } => {
            eprintln!("[MTProto] sign_in with code...");
            match client.sign_in(&token, code).await {
                Ok(user) => {
                    save_session_safe(&client, session_path)?;
                    eprintln!("[MTProto] session saved (no 2FA)");
                    Ok(SignInResult {
                        user_phone: Some(format!("+{}", user.phone().unwrap_or(""))),
                        user_username: user.username().map(|s| s.to_string()),
                        needs_password: false,
                    })
                }
                Err(SignInError::PasswordRequired(password_token)) => {
                    eprintln!("[MTProto] PasswordRequired received");
                    match password {
                        Some(p) if !p.is_empty() => {
                            // User cung cấp password ngay → check liền
                            eprintln!("[MTProto] check_password with provided password");
                            let user = client.check_password(password_token, p).await
                                .map_err(|e| format!("2FA password sai: {}", e))?;
                            save_session_safe(&client, session_path)?;
                            eprintln!("[MTProto] session saved (after 2FA)");
                            Ok(SignInResult {
                                user_phone: Some(format!("+{}", user.phone().unwrap_or(""))),
                                user_username: user.username().map(|s| s.to_string()),
                                needs_password: false,
                            })
                        }
                        _ => {
                            // Chưa có password → re-park để user nhập
                            eprintln!("[MTProto] re-parking as Awaiting2FA");
                            *pending_guard = Some(LoginPending::Awaiting2FA {
                                client,
                                password_token,
                                phone,
                            });
                            Ok(SignInResult {
                                user_phone: None,
                                user_username: None,
                                needs_password: true,
                            })
                        }
                    }
                }
                Err(SignInError::InvalidCode) => Err("Mã OTP sai — bấm 'Đăng nhập lại' để gửi mã mới".to_string()),
                Err(SignInError::SignUpRequired { .. }) => Err("Số phone này chưa đăng ký Telegram — đăng ký trên app Telegram trước".to_string()),
                Err(e) => Err(format!("sign in: {}", e)),
            }
        }
        LoginPending::Awaiting2FA { client, password_token, phone: _phone } => {
            let pw = password.filter(|p| !p.is_empty())
                .ok_or_else(|| "Cần nhập Cloud password 2FA".to_string())?;
            eprintln!("[MTProto] check_password (re-park flow)");
            let user = client.check_password(password_token, pw).await
                .map_err(|e| format!("2FA password sai: {} — bấm 'Đăng nhập lại'", e))?;
            ensure_session_dir(session_path)?;
            save_session_safe(&client, session_path)?;
            eprintln!("[MTProto] session saved (after 2FA, re-park flow)");
            Ok(SignInResult {
                user_phone: Some(format!("+{}", user.phone().unwrap_or(""))),
                user_username: user.username().map(|s| s.to_string()),
                needs_password: false,
            })
        }
    }
}

/// Phase 23.1+ — Check session có authorized không.
pub async fn check_session(
    session_path: &PathBuf,
    api_id: i32,
    api_hash: &str,
) -> Result<MtprotoStatus, String> {
    if !session_path.exists() {
        return Ok(MtprotoStatus {
            configured: true,
            authorized: false,
            user_phone: None,
            user_username: None,
            session_path: session_path.to_string_lossy().to_string(),
        });
    }

    let session = Session::load_file(session_path)
        .map_err(|e| format!("load session: {}", e))?;

    let client = Client::connect(Config {
        session,
        api_id,
        api_hash: api_hash.to_string(),
        params: InitParams {
            catch_up: false,
            ..Default::default()
        },
    }).await.map_err(|e| format!("connect: {}", e))?;

    let authorized = client.is_authorized().await.map_err(|e| format!("auth check: {}", e))?;
    let (user_phone, user_username) = if authorized {
        match client.get_me().await {
            Ok(u) => (
                Some(format!("+{}", u.phone().unwrap_or(""))),
                u.username().map(|s| s.to_string()),
            ),
            Err(_) => (None, None),
        }
    } else {
        (None, None)
    };

    Ok(MtprotoStatus {
        configured: true,
        authorized,
        user_phone,
        user_username,
        session_path: session_path.to_string_lossy().to_string(),
    })
}

/// Sign out — xoá session + log out khỏi Telegram (nếu connect được).
pub async fn sign_out(
    session_path: &PathBuf,
    api_id: i32,
    api_hash: &str,
) -> Result<(), String> {
    if session_path.exists() {
        // Try connect + logout best-effort
        if let Ok(session) = Session::load_file(session_path) {
            if let Ok(client) = Client::connect(Config {
                session, api_id, api_hash: api_hash.to_string(),
                params: InitParams::default(),
            }).await {
                let _ = client.sign_out_disconnect().await;
            }
        }
        let _ = std::fs::remove_file(session_path);
    }
    Ok(())
}

// ============================================================
// Phase 23.3 — Saved Messages upload/download/delete (test commands)
//
// Đích upload là "Saved Messages" (chat = self user) — đơn giản hơn
// channel vì không cần access_hash. User chỉ cần đăng nhập phone OTP.
// File giới hạn 2GB free / 4GB Telegram Premium.
// ============================================================

#[derive(Debug, Serialize)]
pub struct MtprotoUploadInfo {
    pub message_id: i64,
    pub size_bytes: i64,
}

async fn open_authorized_client(
    api_id: i32,
    api_hash: &str,
    session_path: &PathBuf,
) -> Result<Client, String> {
    if !session_path.exists() {
        return Err("Chưa có session — đăng nhập MTProto trước".into());
    }
    let session = Session::load_file(session_path)
        .map_err(|e| format!("load session: {}", e))?;
    let client = Client::connect(Config {
        session,
        api_id,
        api_hash: api_hash.to_string(),
        params: InitParams::default(),
    }).await.map_err(|e| format!("connect MTProto: {}", e))?;
    let authed = client.is_authorized().await.map_err(|e| format!("auth check: {}", e))?;
    if !authed {
        return Err("Session chưa authorized — cần đăng nhập lại".into());
    }
    Ok(client)
}

/// Upload 1 file từ disk lên Saved Messages của user.
/// Trả về message_id để lưu DB / dùng download sau.
pub async fn upload_to_saved(
    api_id: i32,
    api_hash: &str,
    session_path: &PathBuf,
    file_path: &PathBuf,
    upload_name: &str,
) -> Result<MtprotoUploadInfo, String> {
    use grammers_client::InputMessage;

    let client = open_authorized_client(api_id, api_hash, session_path).await?;
    let me = client.get_me().await.map_err(|e| format!("get_me: {}", e))?;

    let metadata = tokio::fs::metadata(file_path).await
        .map_err(|e| format!("metadata: {}", e))?;
    let size = metadata.len() as usize;
    if size == 0 {
        return Err("File rỗng".into());
    }

    let mut stream = tokio::fs::File::open(file_path).await
        .map_err(|e| format!("open file: {}", e))?;
    let uploaded = client.upload_stream(&mut stream, size, upload_name.to_string()).await
        .map_err(|e| format!("upload_stream: {}", e))?;

    let msg = client.send_message(me.pack(), InputMessage::text("").document(uploaded)).await
        .map_err(|e| format!("send_message: {}", e))?;

    Ok(MtprotoUploadInfo {
        message_id: msg.id() as i64,
        size_bytes: size as i64,
    })
}

/// Download file từ Saved Messages về `dest_path`. Stream ra disk, không buffer toàn file.
pub async fn download_from_saved(
    api_id: i32,
    api_hash: &str,
    session_path: &PathBuf,
    message_id: i32,
    dest_path: &PathBuf,
) -> Result<(), String> {
    use grammers_client::types::Downloadable;
    use tokio::io::AsyncWriteExt;

    let client = open_authorized_client(api_id, api_hash, session_path).await?;
    let me = client.get_me().await.map_err(|e| format!("get_me: {}", e))?;

    let messages = client.get_messages_by_id(me.pack(), &[message_id]).await
        .map_err(|e| format!("get_messages_by_id: {}", e))?;
    let msg = messages.into_iter().next().flatten()
        .ok_or_else(|| format!("Message {} không tồn tại trong Saved Messages", message_id))?;

    let media = msg.media().ok_or_else(|| "Message không có media".to_string())?;
    let downloadable = Downloadable::Media(media);

    let mut out = tokio::fs::File::create(dest_path).await
        .map_err(|e| format!("create dest: {}", e))?;
    let mut iter = client.iter_download(&downloadable);
    while let Some(chunk) = iter.next().await.map_err(|e| format!("download next: {}", e))? {
        out.write_all(&chunk).await.map_err(|e| format!("write: {}", e))?;
    }
    out.flush().await.map_err(|e| format!("flush: {}", e))?;
    Ok(())
}

/// Upload bytes (đã encrypt) lên Saved Messages — version chunk-based dùng cho pipeline.
/// Khác `upload_to_saved` ở chỗ nhận Vec<u8> trong RAM thay vì path.
pub async fn upload_bytes_to_saved(
    api_id: i32,
    api_hash: &str,
    session_path: &PathBuf,
    bytes: Vec<u8>,
    upload_name: &str,
) -> Result<MtprotoUploadInfo, String> {
    use grammers_client::InputMessage;
    use std::io::Cursor;

    let client = open_authorized_client(api_id, api_hash, session_path).await?;
    let me = client.get_me().await.map_err(|e| format!("get_me: {}", e))?;

    let size = bytes.len();
    if size == 0 {
        return Err("Bytes rỗng".into());
    }
    let mut cursor = Cursor::new(bytes);
    let uploaded = client.upload_stream(&mut cursor, size, upload_name.to_string()).await
        .map_err(|e| format!("upload_stream: {}", e))?;

    let msg = client.send_message(me.pack(), InputMessage::text("").document(uploaded)).await
        .map_err(|e| format!("send_message: {}", e))?;

    Ok(MtprotoUploadInfo {
        message_id: msg.id() as i64,
        size_bytes: size as i64,
    })
}

/// Download toàn bộ message bytes vào RAM (không stream ra disk).
/// Dùng cho pipeline file_download_mtproto: chunk decrypt rồi mới ghi disk.
pub async fn download_bytes_from_saved(
    api_id: i32,
    api_hash: &str,
    session_path: &PathBuf,
    message_id: i32,
) -> Result<Vec<u8>, String> {
    use grammers_client::types::Downloadable;

    let client = open_authorized_client(api_id, api_hash, session_path).await?;
    let me = client.get_me().await.map_err(|e| format!("get_me: {}", e))?;

    let messages = client.get_messages_by_id(me.pack(), &[message_id]).await
        .map_err(|e| format!("get_messages_by_id: {}", e))?;
    let msg = messages.into_iter().next().flatten()
        .ok_or_else(|| format!("Message {} không tồn tại", message_id))?;
    let media = msg.media().ok_or_else(|| "Message không có media".to_string())?;
    let downloadable = Downloadable::Media(media);

    let mut buf = Vec::new();
    let mut iter = client.iter_download(&downloadable);
    while let Some(chunk) = iter.next().await.map_err(|e| format!("download next: {}", e))? {
        buf.extend_from_slice(&chunk);
    }
    Ok(buf)
}

/// Xoá messages khỏi Saved Messages (revoke true).
pub async fn delete_from_saved(
    api_id: i32,
    api_hash: &str,
    session_path: &PathBuf,
    message_ids: &[i32],
) -> Result<(), String> {
    if message_ids.is_empty() {
        return Ok(());
    }
    let client = open_authorized_client(api_id, api_hash, session_path).await?;
    let me = client.get_me().await.map_err(|e| format!("get_me: {}", e))?;
    client.delete_messages(me.pack(), message_ids).await
        .map_err(|e| format!("delete_messages: {}", e))?;
    Ok(())
}
