// Ẩn cửa sổ console (terminal đen) ở MỌI bản build trên Windows — kể cả --debug.
// Log dev vẫn xem được qua terminal chạy `tauri dev`.
#![cfg_attr(target_os = "windows", windows_subsystem = "windows")]

fn main() {
    trishwork_lib::run();
}
