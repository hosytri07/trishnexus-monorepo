//! TrishFinance — quản lý tài chính phòng trọ + bán hàng + tài chính cá nhân.
//!
//! Phase 23.1.A — Tauri 2 backend chỉ ship 1 command `app_version` + auto-update plugin.
//! Toàn bộ logic (database, accounts, room, invoices, POS, expenses) chạy ở frontend
//! với localStorage + sync Firestore /finance_database/{uid}. Ảnh paste link share
//! từ TrishDrive User app (không upload trực tiếp).

#[tauri::command]
fn app_version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![app_version])
        .run(tauri::generate_context!())
        .expect("error while running TrishFinance");
}
