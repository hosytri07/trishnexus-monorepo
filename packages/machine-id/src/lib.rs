//! TrishTEAM Phase 36.5 — Stable device fingerprint cho key concurrent control.
//!
//! Tính machine_id = SHA256(hostname + MAC + Platform-specific GUID), lấy 16 hex chars.
//!
//! Đặc tính:
//! - **Stable** cross-reboot, cross-network change.
//! - **Đổi** khi user format Windows / reinstall macOS / `dbus-uuidgen` reset Linux.
//! - Mỗi component có fallback nếu lib fail (best-effort).
//!
//! Dùng từ Tauri:
//! ```rust,ignore
//! #[tauri::command]
//! fn get_device_id() -> String {
//!     trishteam_machine_id::get_machine_id()
//! }
//! ```

use sha2::{Digest, Sha256};

/// Tính machine_id ổn định 16 hex chars (8 bytes đầu của SHA256).
///
/// Component:
/// 1. Hostname (NetBIOS name trên Windows)
/// 2. Primary MAC address (NIC đầu tiên active)
/// 3. Platform GUID:
///    - Windows: HKLM\SOFTWARE\Microsoft\Cryptography\MachineGuid (sinh tự động lúc cài Windows)
///    - Linux:   /etc/machine-id (systemd) hoặc /var/lib/dbus/machine-id
///    - macOS:   IOPlatformUUID (TODO — fallback empty)
///    - Fallback: empty string nếu không đọc được
///
/// Concat với separator `|`, hash SHA256, lấy 8 bytes đầu = 16 hex chars.
pub fn get_machine_id() -> String {
    let hostname = read_hostname();
    let mac = read_primary_mac();
    let platform_guid = read_platform_guid();

    let mut hasher = Sha256::new();
    hasher.update(hostname.as_bytes());
    hasher.update(b"|");
    hasher.update(mac.as_bytes());
    hasher.update(b"|");
    hasher.update(platform_guid.as_bytes());

    let hash = hasher.finalize();
    // 8 bytes → 16 hex chars
    hash.iter()
        .take(8)
        .map(|b| format!("{:02x}", b))
        .collect::<String>()
}

/// Trả raw components (debug). KHÔNG share với server (privacy).
pub fn get_machine_id_debug() -> MachineIdDebug {
    MachineIdDebug {
        hostname: read_hostname(),
        mac: read_primary_mac(),
        platform_guid: read_platform_guid(),
        machine_id: get_machine_id(),
    }
}

#[derive(Debug, Clone)]
pub struct MachineIdDebug {
    pub hostname: String,
    pub mac: String,
    pub platform_guid: String,
    pub machine_id: String,
}

// ============================================================
// Internal — components
// ============================================================

fn read_hostname() -> String {
    hostname::get()
        .ok()
        .and_then(|h| h.into_string().ok())
        .unwrap_or_default()
}

fn read_primary_mac() -> String {
    mac_address::get_mac_address()
        .ok()
        .flatten()
        .map(|m| m.to_string())
        .unwrap_or_default()
}

#[cfg(target_os = "windows")]
fn read_platform_guid() -> String {
    use winreg::enums::HKEY_LOCAL_MACHINE;
    use winreg::RegKey;

    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    hklm.open_subkey("SOFTWARE\\Microsoft\\Cryptography")
        .ok()
        .and_then(|key| key.get_value::<String, _>("MachineGuid").ok())
        .unwrap_or_default()
}

#[cfg(target_os = "linux")]
fn read_platform_guid() -> String {
    // systemd primary
    if let Ok(s) = std::fs::read_to_string("/etc/machine-id") {
        let trimmed = s.trim();
        if !trimmed.is_empty() {
            return trimmed.to_string();
        }
    }
    // dbus fallback
    if let Ok(s) = std::fs::read_to_string("/var/lib/dbus/machine-id") {
        return s.trim().to_string();
    }
    String::new()
}

#[cfg(target_os = "macos")]
fn read_platform_guid() -> String {
    // TODO: read IOPlatformUUID via system_profiler subprocess
    // ioreg -d2 -c IOPlatformExpertDevice | awk -F\" '/IOPlatformUUID/{print $(NF-1)}'
    String::new()
}

#[cfg(not(any(target_os = "windows", target_os = "linux", target_os = "macos")))]
fn read_platform_guid() -> String {
    String::new()
}

// ============================================================
// Tests
// ============================================================
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn machine_id_is_16_hex_chars() {
        let id = get_machine_id();
        assert_eq!(id.len(), 16, "machine_id must be 16 chars");
        assert!(
            id.chars().all(|c| c.is_ascii_hexdigit()),
            "machine_id must be all hex"
        );
    }

    #[test]
    fn machine_id_is_stable() {
        let id1 = get_machine_id();
        let id2 = get_machine_id();
        assert_eq!(id1, id2, "machine_id must be deterministic");
    }

    #[test]
    fn debug_returns_components() {
        let d = get_machine_id_debug();
        assert_eq!(d.machine_id.len(), 16);
        // hostname có thể empty trong CI sandbox, không assert
    }
}
