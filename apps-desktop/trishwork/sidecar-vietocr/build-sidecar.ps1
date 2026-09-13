# =============================================================================
# build-sidecar.ps1 — Build VietOCR sidecar thành 1 file .exe (Windows).
#
# Chạy trên máy Windows đã cài Python 3.10/3.11 (KHÔNG dùng 3.13+ vì torch/một
# số dep chưa hỗ trợ đầy đủ). Từ thư mục này:
#
#     powershell -ExecutionPolicy Bypass -File .\build-sidecar.ps1
#
# Kết quả:
#   dist\vietocr-sidecar.exe   → copy vào src-tauri\resources\vietocr\
#
# Sau đó tải weights VietOCR (.pth) đặt cùng chỗ (xem README), và thêm mục
# resources trong tauri.conf.json (xem README) trước khi `tauri build`.
# =============================================================================

$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $here

Write-Host "==> Tạo venv (.venv-sidecar)" -ForegroundColor Cyan
if (-not (Test-Path ".venv-sidecar")) {
    python -m venv .venv-sidecar
}
$py = ".\.venv-sidecar\Scripts\python.exe"

Write-Host "==> Cài dependencies" -ForegroundColor Cyan
& $py -m pip install --upgrade pip
& $py -m pip install -r requirements.txt

Write-Host "==> Tải weights VietOCR pretrained về (cần mạng 1 lần)" -ForegroundColor Cyan
# VietOCR tự tải weights về cache khi nạp config lần đầu. Ta nạp 1 lần để cache,
# rồi copy file .pth ra resources cho bản offline.
& $py -c @"
from vietocr.tool.config import Cfg
from vietocr.tool.predictor import Predictor
cfg = Cfg.load_config_from_name('vgg_transformer')
cfg['device'] = 'cpu'
p = Predictor(cfg)
print('weights cached at:', cfg['weights'])
"@

Write-Host "==> PyInstaller build (one-file)" -ForegroundColor Cyan
# collect-all để gom data/hidden-import của vietocr, torch, cv2.
& $py -m PyInstaller --noconfirm --onefile --name vietocr-sidecar `
    --collect-all vietocr `
    --collect-all torch `
    --collect-submodules cv2 `
    --hidden-import PIL `
    ocr_service.py

Write-Host ""
Write-Host "XONG. File: $here\dist\vietocr-sidecar.exe" -ForegroundColor Green
Write-Host "Tiếp theo: làm theo README.md mục 'Đóng gói vào app'." -ForegroundColor Yellow
