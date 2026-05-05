//! TrishOffice — HRM/ERP-light cho công ty (Phase 38.6 rebuilt scope).
//!
//! 7 module:
//!   1. Dashboard điều hành — overview KPI
//!   2. Nhân sự — hồ sơ + hợp đồng + bảo hiểm + nghỉ phép
//!   3. Chấm công — manual nhập giờ vào/ra (Phase 1)
//!   4. Tài sản công ty — laptop/máy in/xe/văn phòng phẩm
//!   5. Quy trình duyệt — workflow phê duyệt nhiều cấp
//!   6. Tài liệu nội bộ — quy định + biểu mẫu công ty
//!   7. Kế toán — lương + thuế TNCN + BHXH + báo cáo BCTC
//!
//! MVP scaffold ship 2 commands tối thiểu. Logic module sẽ implement dần
//! với mỗi module thêm Tauri command tương ứng.

#[tauri::command]
fn app_version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}

/// Phase 36.5 — Trả về machine_id 16 hex chars (stable cross-reboot).
/// Dùng cho key activation + concurrent session control.
#[tauri::command]
fn get_device_id() -> String {
    trishteam_machine_id::get_machine_id()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![app_version, get_device_id])
        .run(tauri::generate_context!())
        .expect("error while running TrishOffice");
}
