# TrishSearch OCR Setup Guide

Layer 3 OCR cần 3 binary bundle. Trước khi build production, hoàn tất các bước dưới.

## 1. Download bundles

```powershell
cd apps-desktop\trishsearch
.\scripts\download-ocr-bundles.ps1
```

Script tự download:
- `src-tauri/resources/tessdata/vie.traineddata` (~30MB)
- `src-tauri/resources/tessdata/eng.traineddata` (~5MB)
- `src-tauri/resources/pdfium/pdfium.dll` (~7MB)

## 2. Tesseract.exe (manual)

Tesseract Windows portable phải làm tay vì UB-Mannheim chỉ phát hành installer:

1. Tải: https://github.com/UB-Mannheim/tesseract/wiki → bản `tesseract-ocr-w64-setup-*.exe`
2. Cài vào mặc định `C:\Program Files\Tesseract-OCR\`
3. Copy **TẤT CẢ** `.exe` + `.dll` (không copy folder `tessdata/`) từ `C:\Program Files\Tesseract-OCR\` vào `apps-desktop\trishsearch\src-tauri\binaries\`
4. Rename `tesseract.exe` → `tesseract-x86_64-pc-windows-msvc.exe` (Tauri sidecar naming)
5. Re-run `.\scripts\download-ocr-bundles.ps1` để verify

## 3. Enable trong tauri.conf.json

Sau khi tất cả bundles có mặt, mở `src-tauri/tauri.conf.json` và thêm vào `bundle` block (sau `"icon"`, trước `"category"`):

```json
"resources": [
  "resources/tessdata/*",
  "resources/pdfium/*"
],
"externalBin": [
  "binaries/tesseract"
],
```

## 4. Test

```powershell
pnpm tauri dev
```

Settings → OCR section phải hiện ✅ cả 3 status (Tesseract, vie.traineddata, pdfium.dll).

Bật toggle "Đang bật" → reindex location chứa PDF scan → search nội dung tiếng Việt.

## 5. Build production

```powershell
pnpm tauri build
```

NSIS installer sẽ bundle Tesseract + tessdata + pdfium → kích thước ~50MB.
