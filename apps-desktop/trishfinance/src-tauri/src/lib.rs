//! TrishFinance — quản lý tài chính phòng trọ + bán hàng.
//! Part of TrishTEAM ecosystem. Pure HTML+JS app, Tauri webview shell.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running TrishFinance");
}
