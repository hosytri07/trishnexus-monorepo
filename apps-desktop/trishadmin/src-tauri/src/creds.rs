//! Per-user credential storage qua keyring.
//!
//! Storage:
//!   - Service: "vn.trishteam.drive" (giữ nguyên scope với TrishDrive standalone
//!     để re-use creds đã setup. Phase 24.1 — TrishDrive merged vào TrishAdmin.)
//!   - Username: "telegram_creds_{firebase_uid}"
//!   - Secret: JSON {bot_token, channel_id, salt, master_key (PBKDF2 derive)}
//!
//! Mỗi Firebase user có cloud Telegram riêng — không dùng chung trên máy multi-user.

use serde::{Deserialize, Serialize};
use pbkdf2::pbkdf2_hmac;
use sha2::Sha256;
use rand::RngCore;
use keyring::Entry;

const SERVICE: &str = "vn.trishteam.drive";
const USERNAME_PREFIX: &str = "telegram_creds_";
const PBKDF2_ROUNDS: u32 = 200_000;

#[derive(Debug, Serialize, Deserialize)]
pub struct TelegramCreds {
    pub bot_token: String,
    pub channel_id: i64,
    pub channel_title: String,
    pub salt_hex: String,
    pub master_key_hex: String,
    /// Firebase uid để cross-check khi load
    pub uid: String,
}

pub fn derive_key(passphrase: &str, salt: &[u8]) -> [u8; 32] {
    let mut key = [0u8; 32];
    pbkdf2_hmac::<Sha256>(passphrase.as_bytes(), salt, PBKDF2_ROUNDS, &mut key);
    key
}

pub fn random_salt() -> [u8; 16] {
    let mut salt = [0u8; 16];
    rand::thread_rng().fill_bytes(&mut salt);
    salt
}

fn entry_for(uid: &str) -> Result<Entry, String> {
    if uid.is_empty() {
        return Err("Empty uid".to_string());
    }
    let username = format!("{}{}", USERNAME_PREFIX, uid);
    Entry::new(SERVICE, &username).map_err(|e| format!("keyring entry: {}", e))
}

pub fn save_creds(creds: &TelegramCreds) -> Result<(), String> {
    let entry = entry_for(&creds.uid)?;
    let json = serde_json::to_string(creds).map_err(|e| format!("serialize: {}", e))?;
    entry.set_password(&json).map_err(|e| format!("keyring set: {}", e))?;
    Ok(())
}

pub fn load_creds(uid: &str) -> Result<Option<TelegramCreds>, String> {
    let entry = entry_for(uid)?;
    match entry.get_password() {
        Ok(json) => {
            let creds: TelegramCreds = serde_json::from_str(&json).map_err(|e| format!("deserialize: {}", e))?;
            // Cross-check uid (defensive)
            if creds.uid != uid {
                return Ok(None);
            }
            Ok(Some(creds))
        }
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(format!("keyring get: {}", e)),
    }
}

pub fn delete_creds(uid: &str) -> Result<(), String> {
    let entry = entry_for(uid)?;
    match entry.delete_password() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(format!("keyring delete: {}", e)),
    }
}

// ============================================================
// Phase 23.2 — MTProto config (api_id + api_hash) per-user
// ============================================================

const MTPROTO_USERNAME_PREFIX: &str = "mtproto_config_";

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MtprotoConfig {
    pub api_id: i32,
    pub api_hash: String,
}

fn mtproto_entry(uid: &str) -> Result<Entry, String> {
    if uid.is_empty() {
        return Err("Empty uid".to_string());
    }
    let username = format!("{}{}", MTPROTO_USERNAME_PREFIX, uid);
    Entry::new(SERVICE, &username).map_err(|e| format!("keyring entry: {}", e))
}

/// Phase 25.1.K — Fallback file path khi keyring fail / bị Windows reset.
/// Lưu song song với keyring; api_id + api_hash KHÔNG phải credential nhạy cảm
/// (Telegram cho phép embed trong app source — chỉ giới hạn rate quota), nên
/// lưu plaintext local OK. Sự bền vững > security cho MTProto config.
fn mtproto_config_file(uid: &str) -> Option<std::path::PathBuf> {
    if uid.is_empty() { return None; }
    // Dùng env var APPDATA (Windows) hoặc HOME (Unix) — không cần Tauri AppHandle.
    let base = if cfg!(target_os = "windows") {
        std::env::var("APPDATA").ok().map(std::path::PathBuf::from)
    } else {
        std::env::var("HOME").ok().map(|h| std::path::PathBuf::from(h).join(".config"))
    }?;
    let dir = base.join("vn.trishteam.admin");
    let _ = std::fs::create_dir_all(&dir);
    Some(dir.join(format!("mtproto_config.{}.json", uid)))
}

pub fn save_mtproto_config(uid: &str, config: &MtprotoConfig) -> Result<(), String> {
    let json = serde_json::to_string(config).map_err(|e| format!("serialize: {}", e))?;
    // Save vào keyring (best-effort)
    if let Ok(entry) = mtproto_entry(uid) {
        let _ = entry.set_password(&json);
    }
    // Phase 25.1.K — luôn save vào file fallback
    if let Some(path) = mtproto_config_file(uid) {
        std::fs::write(&path, &json).map_err(|e| format!("write config file: {}", e))?;
    }
    Ok(())
}

pub fn load_mtproto_config(uid: &str) -> Result<Option<MtprotoConfig>, String> {
    // Thử keyring trước
    if let Ok(entry) = mtproto_entry(uid) {
        match entry.get_password() {
            Ok(json) => {
                if let Ok(config) = serde_json::from_str::<MtprotoConfig>(&json) {
                    return Ok(Some(config));
                }
            }
            Err(keyring::Error::NoEntry) => { /* fall through file */ }
            Err(_) => { /* keyring lỗi → fall through file */ }
        }
    }
    // Phase 25.1.K — fallback file JSON
    if let Some(path) = mtproto_config_file(uid) {
        if path.exists() {
            let json = std::fs::read_to_string(&path).map_err(|e| format!("read config file: {}", e))?;
            let config: MtprotoConfig = serde_json::from_str(&json).map_err(|e| format!("deserialize: {}", e))?;
            // Phase 25.1.K — auto-restore vào keyring nếu file có mà keyring không
            if let Ok(entry) = mtproto_entry(uid) {
                let _ = entry.set_password(&json);
            }
            return Ok(Some(config));
        }
    }
    Ok(None)
}

#[allow(dead_code)]
pub fn delete_mtproto_config(uid: &str) -> Result<(), String> {
    // Xoá keyring (best-effort)
    if let Ok(entry) = mtproto_entry(uid) {
        let _ = entry.delete_password();
    }
    // Phase 25.1.K — xoá luôn file fallback
    if let Some(path) = mtproto_config_file(uid) {
        let _ = std::fs::remove_file(&path);
    }
    Ok(())
}

// ============================================================
// Phase 23.6 — Cache PackedChat (channel) sau khi resolve qua iter_dialogs
// Lần đầu upload mất 1-2s tìm channel; lần sau load cache instant.
// ============================================================

const CHANNEL_PACKED_PREFIX: &str = "mtproto_channel_";

fn channel_entry(uid: &str) -> Result<Entry, String> {
    if uid.is_empty() {
        return Err("Empty uid".to_string());
    }
    let username = format!("{}{}", CHANNEL_PACKED_PREFIX, uid);
    Entry::new(SERVICE, &username).map_err(|e| format!("keyring entry: {}", e))
}

pub fn save_channel_packed(uid: &str, hex: &str) -> Result<(), String> {
    let entry = channel_entry(uid)?;
    entry.set_password(hex).map_err(|e| format!("keyring set channel: {}", e))?;
    Ok(())
}

pub fn load_channel_packed(uid: &str) -> Result<Option<String>, String> {
    let entry = channel_entry(uid)?;
    match entry.get_password() {
        Ok(s) => Ok(Some(s)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(format!("keyring get channel: {}", e)),
    }
}

#[allow(dead_code)]
pub fn delete_channel_packed(uid: &str) -> Result<(), String> {
    let entry = channel_entry(uid)?;
    match entry.delete_password() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(format!("keyring delete channel: {}", e)),
    }
}

// ============================================================
// Phase 25.0.D — HTTP API Bearer Token (cho external upload script)
// ============================================================

const API_TOKEN_USERNAME_PREFIX: &str = "api_token_";

fn api_token_entry(uid: &str) -> Result<Entry, String> {
    Entry::new(SERVICE, &format!("{}{}", API_TOKEN_USERNAME_PREFIX, uid))
        .map_err(|e| format!("keyring api_token: {}", e))
}

pub fn save_api_token(uid: &str, token: &str) -> Result<(), String> {
    let entry = api_token_entry(uid)?;
    entry.set_password(token).map_err(|e| format!("keyring set api_token: {}", e))?;
    Ok(())
}

pub fn load_api_token(uid: &str) -> Result<Option<String>, String> {
    let entry = api_token_entry(uid)?;
    match entry.get_password() {
        Ok(s) => Ok(Some(s)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(format!("keyring get api_token: {}", e)),
    }
}

pub fn delete_api_token(uid: &str) -> Result<(), String> {
    let entry = api_token_entry(uid)?;
    match entry.delete_password() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(format!("keyring delete api_token: {}", e)),
    }
}
