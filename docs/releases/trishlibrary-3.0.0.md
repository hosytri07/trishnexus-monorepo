# TrishLibrary 3.0.0 — All-in-one app văn bản

Bản gộp 4 app **TrishLibrary + TrishNote + TrishDocument + TrishImage** thành 1 app duy nhất với cross-module workflows.

## ✨ Highlights

### 4 module tích hợp
- 📚 **Thư viện** — quản lý PDF/EPUB/Word + tag + cite + full-text search (Tantivy) + OCR (Tesseract) + LAN/UNC
- 📝 **Ghi chú** — TipTap rich editor + folders + tasks + tags + daily note + backlinks + 10 templates
- 📄 **Tài liệu** — multi-tab editor + 22 templates + chuyển đổi đa định dạng + 13 PDF tools
- 🖼 **Ảnh** — 5 view modes + thumbnail cache + EXIF + lightbox + batch rename + LAN UNC

### Cross-module
- **Ctrl+K** — global search xuyên 4 module
- **Ctrl+/** — phím tắt help
- **Ctrl+Shift+N** — sticky note quick capture
- **💾 Backup + Auto-backup** — JSON bundle với interval 1/6/24h

### PDF Tools (offline 100%)
PDF Info / Merge / Split / Extract / Delete / Rotate / Images→PDF / Watermark / Page numbers / Encrypt AES-256 (qpdf) / Decrypt / OCR (Tesseract) / Trích ảnh

### Per-user data
Mỗi user trên cùng máy có dữ liệu riêng (Note + Image + Library annotations + reading meta). Admin shared TrishTEAM Library qua Firestore.

## 📦 Installation
- **Windows x64** — tải `TrishLibrary_3.0.0_x64-setup.exe` (NSIS multi-language EN/VI, ~7 MB)
- Hoặc 1 trong 2 file `.msi` (WiX) cho install qua nhóm chính sách

## 🔑 Login
Cần login Firebase Auth. Tạo tài khoản từ trong app hoặc tại https://trishteam.io.vn/login. Free trial mặc định, key kích hoạt từ admin.

## 🛠 Yêu cầu hệ thống
- Windows 10/11 x64
- ~150 MB RAM khi idle, ~500 MB khi index full-text + OCR
- Tùy chọn: `qpdf` để encrypt PDF + `tesseract` để OCR (tự download nếu cần)

## 📋 Changelog gọn

**Phase 18 (gộp 4 module)**: cross-module communication qua module-bus.ts, unified Ctrl+K search, sticky note widget, backup/auto-backup JSON bundle, annotation per-file, export bundle JSON, focus mode (Ctrl+Shift+F).

**Phase 18.5 (UX polish)**: bỏ duplicate user panel, thu nhỏ Bảng điều khiển 40%, gộp PDF Tools + File Convert thành 1 card grid 1.5x size, per-user data isolation cho Note/Image/Library annotations + reading meta.

**Phase 18.6 (build)**: fix 15 TS errors (unused imports, missing useEffect, null guards), bump version 3.0.0.

## 🐛 Known limitations
- TrishType (markdown editor) sẽ build sau như app riêng
- TrishDesign (color palette WCAG) chưa scaffold

---

🌐 Website: https://trishteam.io.vn  
📚 Docs: trong app (Ctrl+/)  
🐞 Báo lỗi: https://github.com/hosytri07/trishnexus-monorepo/issues
