//! AES-256-GCM encryption wrapper. Phase 22.5.
//!
//! Format: [nonce 12 bytes | ciphertext + 16-byte auth tag]
//! Nonce random per file (not per chunk yet — Phase 22.5b sẽ chunk).

use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use rand::RngCore;

pub const NONCE_SIZE: usize = 12;

pub fn encrypt(key_hex: &str, plaintext: &[u8]) -> Result<Vec<u8>, String> {
    let key_bytes = hex::decode(key_hex).map_err(|e| format!("key hex decode: {}", e))?;
    if key_bytes.len() != 32 {
        return Err(format!("key must be 32 bytes, got {}", key_bytes.len()));
    }
    let cipher = Aes256Gcm::new_from_slice(&key_bytes).map_err(|e| format!("cipher init: {}", e))?;
    let mut nonce_bytes = [0u8; NONCE_SIZE];
    rand::thread_rng().fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);
    let ciphertext = cipher.encrypt(nonce, plaintext).map_err(|e| format!("encrypt: {}", e))?;
    let mut output = Vec::with_capacity(NONCE_SIZE + ciphertext.len());
    output.extend_from_slice(&nonce_bytes);
    output.extend_from_slice(&ciphertext);
    Ok(output)
}

pub fn decrypt(key_hex: &str, payload: &[u8]) -> Result<Vec<u8>, String> {
    if payload.len() < NONCE_SIZE + 16 {
        return Err("payload too short".to_string());
    }
    let key_bytes = hex::decode(key_hex).map_err(|e| format!("key hex decode: {}", e))?;
    if key_bytes.len() != 32 {
        return Err(format!("key must be 32 bytes, got {}", key_bytes.len()));
    }
    let cipher = Aes256Gcm::new_from_slice(&key_bytes).map_err(|e| format!("cipher init: {}", e))?;
    let nonce = Nonce::from_slice(&payload[..NONCE_SIZE]);
    let ciphertext = &payload[NONCE_SIZE..];
    cipher
        .decrypt(nonce, ciphertext)
        .map_err(|e| format!("decrypt (sai passphrase hoặc file corrupt): {}", e))
}

pub fn sha256_hex(data: &[u8]) -> String {
    use sha2::{Digest, Sha256};
    let mut hasher = Sha256::new();
    hasher.update(data);
    hex::encode(hasher.finalize())
}

/// Encrypt plaintext (vd bot_token, master_key) với password do user đặt cho share.
/// Output: hex string format `salt(16) | nonce(12) | ciphertext + tag`
pub fn encrypt_with_password(plaintext: &[u8], password: &str) -> Result<String, String> {
    use pbkdf2::pbkdf2_hmac;
    use sha2::Sha256;
    let mut salt = [0u8; 16];
    rand::thread_rng().fill_bytes(&mut salt);
    let mut key = [0u8; 32];
    pbkdf2_hmac::<Sha256>(password.as_bytes(), &salt, 100_000, &mut key);
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| format!("cipher: {}", e))?;
    let mut nonce_bytes = [0u8; NONCE_SIZE];
    rand::thread_rng().fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);
    let ciphertext = cipher.encrypt(nonce, plaintext).map_err(|e| format!("encrypt: {}", e))?;
    let mut output = Vec::with_capacity(16 + NONCE_SIZE + ciphertext.len());
    output.extend_from_slice(&salt);
    output.extend_from_slice(&nonce_bytes);
    output.extend_from_slice(&ciphertext);
    Ok(hex::encode(output))
}
