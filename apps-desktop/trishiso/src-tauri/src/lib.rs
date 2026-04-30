//! TrishISO — quản lý hồ sơ ISO + thiết bị nội bộ.
//! Part of TrishTEAM ecosystem. React + Vite frontend, Tauri 2 webview shell.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running TrishISO");
}
