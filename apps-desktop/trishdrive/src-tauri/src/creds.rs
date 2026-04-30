//! Per-user credential storage qua keyring.
//!
//! Storage:
//!   - Service: "vn.trishteam.drive"
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

pub fn save_mtproto_config(uid: &str, config: &MtprotoConfig) -> Result<(), String> {
    let entry = mtproto_entry(uid)?;
    let json = serde_json::to_string(config).map_err(|e| format!("serialize: {}", e))?;
    entry.set_password(&json).map_err(|e| format!("keyring set: {}", e))?;
    Ok(())
}

pub fn load_mtproto_config(uid: &str) -> Result<Option<MtprotoConfig>, String> {
    let entry = mtproto_entry(uid)?;
    match entry.get_password() {
        Ok(json) => {
            let config: MtprotoConfig = serde_json::from_str(&json).map_err(|e| format!("deserialize: {}", e))?;
            Ok(Some(config))
        }
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(format!("keyring get: {}", e)),
    }
}

pub fn delete_mtproto_config(uid: &str) -> Result<(), String> {
    let entry = mtproto_entry(uid)?;
    match entry.delete_password() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(format!("keyring delete: {}", e)),
    }
}
