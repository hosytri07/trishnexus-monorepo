//! MTProto client cho TrishDrive — Phase 23.
//!
//! Dùng `grammers-client` để upload/download file lên Telegram qua MTProto protocol
//! thay vì Bot API. Lý do:
//!   - Bot API limit 50MB upload, 20MB download → phải chia chunks.
//!   - MTProto user account: 2GB free / 4GB Premium, upload 1 file nguyên.
//!   - MTProto download streaming nhanh hơn (parallel 4-8 connections).
//!
//! Setup yêu cầu (mỗi user 1 lần):
//!   1. Đăng ký https://my.telegram.org/apps → lấy api_id + api_hash
//!   2. Trong app: nhập phone → app gửi OTP qua Telegram → user nhập code
//!   3. Session lưu file `mtproto.session` trong app data dir (encrypted với passphrase tương lai)
//!
//! Phase 23.1 (skeleton): chỉ check session có hoạt động không.
//! Phase 23.2: implement login flow.
//! Phase 23.3-4: upload + download file.

use grammers_client::{Client, Config, InitParams};
use grammers_session::Session;
use std::path::PathBuf;
use serde::Serialize;

#[derive(Debug, Serialize, Clone)]
pub struct MtprotoStatus {
    pub configured: bool,
    pub authorized: bool,
    pub user_phone: Option<String>,
    pub session_path: String,
}

pub fn session_path(app_data_dir: &PathBuf) -> PathBuf {
    app_data_dir.join("mtproto.session")
}

/// Try load session từ disk + connect Telegram. Return user info nếu authorized.
/// api_id + api_hash hardcoded null cho Phase 23.1 — Phase 23.2 sẽ load từ creds.
pub async fn check_session(
    session_path: &PathBuf,
    api_id: i32,
    api_hash: &str,
) -> Result<MtprotoStatus, String> {
    if !session_path.exists() {
        return Ok(MtprotoStatus {
            configured: false,
            authorized: false,
            user_phone: None,
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
    let user_phone = if authorized {
        client.get_me().await
            .ok()
            .and_then(|u| u.phone().map(|s| format!("+{}", s)))
    } else {
        None
    };

    Ok(MtprotoStatus {
        configured: true,
        authorized,
        user_phone,
        session_path: session_path.to_string_lossy().to_string(),
    })
}

/// TODO Phase 23.2 — Sign in flow:
///   1. send_code(phone) → return PhoneCodeHash
///   2. sign_in(phone, code, hash) → save session → return user info
///
/// TODO Phase 23.3 — Upload file:
///   client.upload_file(path).await → InputFile
///   client.send_message(channel, message_with_doc).await
///
/// TODO Phase 23.4 — Download file:
///   client.iter_download(media).into_iter().collect_into(file).await
