//! VietOCR sidecar bridge — Wave 45.x.
//!
//! Quản lý tiến trình Python `vietocr-sidecar.exe` (đóng gói trong resources)
//! và cho frontend gọi OCR offline qua HTTP localhost.
//!
//! Vòng đời:
//!   - `vietocr_available`  : kiểm tra đã có file sidecar .exe trong resources chưa.
//!   - `vietocr_start`      : spawn sidecar (idempotent), đợi dòng "VIETOCR_READY".
//!   - `vietocr_ocr`        : POST ảnh base64 → nhận text.
//!   - tự tắt khi app thoát (Drop của state).
//!
//! Service script: `apps-desktop/trishwork/sidecar-vietocr/ocr_service.py`.

use std::io::{BufRead, BufReader};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::Duration;

use serde::Serialize;
use tauri::{AppHandle, Manager, State};

/// Cổng localhost cố định cho sidecar. Đổi nếu trùng cổng máy khác.
const PORT: u16 = 39127;

#[derive(Default)]
pub struct VietOcrState {
    child: Mutex<Option<Child>>,
}

impl Drop for VietOcrState {
    fn drop(&mut self) {
        if let Ok(mut guard) = self.child.lock() {
            if let Some(mut c) = guard.take() {
                let _ = c.kill();
            }
        }
    }
}

#[derive(Serialize)]
pub struct VietOcrResult {
    pub ok: bool,
    pub text: String,
    pub lines: Vec<String>,
    pub count: usize,
}

/// Đường dẫn tới sidecar .exe trong resources.
fn sidecar_exe(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = app
        .path()
        .resource_dir()
        .map_err(|e| format!("resource_dir lỗi: {e}"))?;
    Ok(dir.join("vietocr").join("vietocr-sidecar.exe"))
}

/// Đường dẫn weights .pth (nếu có) trong resources.
fn weights_path(app: &AppHandle) -> Option<std::path::PathBuf> {
    let dir = app.path().resource_dir().ok()?;
    let p = dir.join("vietocr").join("vgg_transformer.pth");
    if p.is_file() {
        Some(p)
    } else {
        None
    }
}

/// Kiểm tra đã đóng gói sidecar chưa (để UI biết bật/tắt nút VietOCR).
#[tauri::command]
pub fn vietocr_available(app: AppHandle) -> bool {
    sidecar_exe(&app).map(|p| p.is_file()).unwrap_or(false)
}

/// Gọi /health xem sidecar đã sống + nạp model chưa.
async fn health_ok() -> bool {
    let url = format!("http://127.0.0.1:{PORT}/health");
    match reqwest::Client::new()
        .get(&url)
        .timeout(Duration::from_millis(800))
        .send()
        .await
    {
        Ok(resp) => match resp.json::<serde_json::Value>().await {
            Ok(v) => v.get("ready").and_then(|b| b.as_bool()).unwrap_or(false),
            Err(_) => false,
        },
        Err(_) => false,
    }
}

/// Lõi spawn — nhận tham chiếu để 2 command cùng gọi được (không move State).
async fn ensure_started(app: &AppHandle, state: &VietOcrState) -> Result<bool, String> {
    // Đã sẵn sàng rồi → khỏi spawn.
    if health_ok().await {
        return Ok(true);
    }

    let exe = sidecar_exe(app)?;
    if !exe.is_file() {
        return Err(format!(
            "Chưa có sidecar VietOCR. Hãy build & đóng gói (xem sidecar-vietocr/README.md). Thiếu: {}",
            exe.display()
        ));
    }

    let mut cmd = Command::new(&exe);
    cmd.arg("--port")
        .arg(PORT.to_string())
        .arg("--device")
        .arg("cpu")
        .arg("--config")
        .arg("vgg_transformer")
        .stdout(Stdio::piped())
        .stderr(Stdio::null());
    if let Some(w) = weights_path(app) {
        cmd.arg("--weights").arg(w);
    }
    // Windows: ẩn cửa sổ console của sidecar.
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    let mut child = cmd.spawn().map_err(|e| format!("Không spawn được sidecar: {e}"))?;

    // Đọc stdout đợi "VIETOCR_READY" (model có thể nạp vài giây).
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "Không lấy được stdout sidecar".to_string())?;
    let ready = tauri::async_runtime::spawn_blocking(move || {
        let reader = BufReader::new(stdout);
        for line in reader.lines().map_while(Result::ok) {
            if line.starts_with("VIETOCR_READY") {
                return Ok(());
            }
            if line.starts_with("VIETOCR_ERROR") {
                return Err(line);
            }
        }
        Err("Sidecar thoát trước khi sẵn sàng".to_string())
    })
    .await
    .map_err(|e| format!("join lỗi: {e}"))?;

    match ready {
        Ok(()) => {
            *state.child.lock().unwrap() = Some(child);
            Ok(true)
        }
        Err(e) => {
            let _ = child.kill();
            Err(format!("Sidecar lỗi khởi động: {e}"))
        }
    }
}

/// Spawn sidecar nếu chưa chạy. Idempotent — gọi nhiều lần an toàn.
#[tauri::command]
pub async fn vietocr_start(app: AppHandle, state: State<'_, VietOcrState>) -> Result<bool, String> {
    ensure_started(&app, state.inner()).await
}

/// OCR 1 ảnh (base64 data-url hoặc base64 thuần) → text.
#[tauri::command]
pub async fn vietocr_ocr(
    app: AppHandle,
    state: State<'_, VietOcrState>,
    image_base64: String,
) -> Result<VietOcrResult, String> {
    // Đảm bảo sidecar đang chạy.
    ensure_started(&app, state.inner()).await?;

    let url = format!("http://127.0.0.1:{PORT}/ocr");
    let resp = reqwest::Client::new()
        .post(&url)
        .json(&serde_json::json!({ "image_base64": image_base64 }))
        .timeout(Duration::from_secs(120))
        .send()
        .await
        .map_err(|e| format!("Gọi sidecar lỗi: {e}"))?;

    let v: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Đọc kết quả lỗi: {e}"))?;

    if !v.get("ok").and_then(|b| b.as_bool()).unwrap_or(false) {
        let err = v
            .get("error")
            .and_then(|s| s.as_str())
            .unwrap_or("không rõ");
        return Err(format!("OCR lỗi: {err}"));
    }

    let lines: Vec<String> = v
        .get("lines")
        .and_then(|l| l.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|s| s.as_str().map(|x| x.to_string()))
                .collect()
        })
        .unwrap_or_default();

    Ok(VietOcrResult {
        ok: true,
        text: v.get("text").and_then(|s| s.as_str()).unwrap_or("").to_string(),
        count: lines.len(),
        lines,
    })
}

/// Tắt sidecar (giải phóng RAM model). Gọi khi user tắt tính năng.
#[tauri::command]
pub async fn vietocr_stop(state: State<'_, VietOcrState>) -> Result<(), String> {
    let url = format!("http://127.0.0.1:{PORT}/shutdown");
    let _ = reqwest::Client::new()
        .post(&url)
        .timeout(Duration::from_millis(500))
        .send()
        .await;
    if let Some(mut c) = state.child.lock().unwrap().take() {
        let _ = c.kill();
    }
    Ok(())
}
