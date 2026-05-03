//! TrishISO — quản lý hồ sơ ISO + thiết bị nội bộ.
//!
//! Phase 22.4.A — Wire auto-update plugin (Tauri updater + process). Frontend
//! sẽ gọi `app_version` để hiển thị version, và dùng @tauri-apps/plugin-updater
//! `check()` để kiểm tra update qua endpoint `https://trishteam.io.vn/api/updates/trishiso/...`.
//!
//! Hiện chỉ ship 1 command duy nhất là `app_version` — toàn bộ logic ISO
//! (hồ sơ tổng quát, mục lục, thiết bị, mượn/trả, biểu mẫu, duyệt, calendar,
//! notification, lưu trữ ISO) đều chạy ở frontend với localStorage. Khi nào
//! cần backend (sync Firestore, upload file thật, audit log server-side) sẽ
//! mở thêm command sau.

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
        .expect("error while running TrishISO");
}
