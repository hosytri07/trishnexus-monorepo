# 🔄 HANDOFF — Phiên 2026-06-02 (máy NHÀ → máy CƠ QUAN)

> File bàn giao riêng cho phiên này. Đọc cùng `HANDOFF-MASTER.md`.
> **Chủ đề phiên:** (A) Port backend Library cho TrishWork, (B) Redesign UI TrishWork (Dashboard nhóm + tab browser).

---

## ✅ ĐÃ LÀM XONG (đã/đang ở máy nhà — cần push qua END.bat)

### A. Port backend Library → TrishWork (Wave 44.3.B) — DONE, cargo check XANH
- Tạo `apps-desktop/trishwork/src-tauri/src/library.rs` (~3740 dòng) = port nguyên từ `_archive/trishlibrary` (58 lệnh: PDF tools, OCR tesseract, convert LibreOffice/MSWord, Tantivy full-text search, thumbnail/EXIF ảnh, scan/load/save library).
- `src/lib.rs`: thêm `mod library;` + đăng ký 54 lệnh (4 lệnh trùng tên `default_store_location`/`list_system_fonts`/`read_text_string`/`write_text_string` → gỡ `#[tauri::command]` trong library.rs, dùng bản TrishWork sẵn có).
- `Cargo.toml`: thêm lopdf, tantivy, image, printpdf, pdf-extract, kamadak-exif, ttf-parser, walkdir, similar, trishteam-machine-id; bật feature `protocol-asset`; tokio +`sync`.
- `tauri.conf.json`: bật `assetProtocol` (thumbnail), version 1.0.0, thêm `nsis.installerIcon`.
- `library.rs` có `#![allow(dead_code, unused_imports, unused_mut, unused_variables)]` đầu file (helper toggle_sticky_window... của run() cũ không dùng).
- **Trạng thái:** `cd apps-desktop/trishwork/src-tauri && cargo check` → 0 error. ✅

### B. Redesign UI TrishWork (Dashboard nhóm + tab kiểu browser)
- Mới: `src/components/WorkShell.tsx` + `work-shell.css`. Bỏ AppShell sidebar cũ.
  - Topbar slim + nút Ctrl+K. Tab bar kiểu browser (Home ghim + tab feature, viền màu nhóm, đóng ×).
  - Home = Dashboard nhóm 3 module (Khảo sát·Thiết kế 11 / Thư viện 5 / Hồ sơ ISO 13), grid panel sub-feature, ô tìm kiếm, hàng Ghim/Gần đây (localStorage), nhóm gập/mở.
  - Command palette Ctrl+K mở nhanh mọi feature.
- `App.tsx`: viết lại, registry 29 feature (mỗi feature render module với `initialPanel`/`initialPage` + `hideNav`). Truyền `theme` xuống WorkShell.
- Sửa 3 module nhận prop `initialPanel`/`initialPage` + `hideNav` (ẩn sidebar nội bộ):
  - `design/DesignModule.tsx`, `library/LibraryModule.tsx`, `iso/IsoModule.tsx` (luồn qua AppGate→MainApp).
- **Fix đã làm sau khi test trên máy nhà:**
  - Card to hơn (ô icon 60px, icon lucide size 46), Dashboard bỏ max-width (lấp full ngang), grid minmax 296px.
  - Design panel bị bóp hẹp: `.td-shell` grid `240px 1fr` → ép `grid-template-columns:1fr` khi hideNav (class `td-shell-nonav`).
  - Theme kẹt sáng khi mở Tài liệu/ISO: bỏ `applyTheme` tự động trong `library/App.tsx` (dòng ~121) + thêm re-assert `data-theme` ở WorkShell `useEffect([active, theme])`.
  - CSS ép module mở fit chiều cao khung tab (override `min-h-screen`/`100vh`).

---

## ⚠ CẦN LÀM/KIỂM TRA Ở MÁY CƠ QUAN (theo thứ tự)

1. **`scripts\START.bat`** (pull code + pnpm install). Nếu Rust/crate mới → lần đầu `cargo`/`tauri:dev` build lâu (tantivy, lopdf nặng).
2. **Build + test frontend redesign** (chưa verify vite build, mới chỉ cargo check phần Rust):
   ```
   pnpm --filter=@trishteam/trishwork tauri:dev
   ```
   - Kiểm tra Dashboard nhóm, mở panel mỗi nhóm (Design/Thư viện/ISO) không sidebar, tab browser, Ctrl+K, ghim, search.
   - Kiểm tra theme dark giữ được khi mở Tài liệu/ISO rồi quay lại.
   - Nếu lỗi TS/vite build → copy log, fix (có thể vài chỗ type của initialPanel/prop).
3. **Test backend Library thật**: vào tab Thư viện / Tài liệu·PDF → thử PDF merge/split, OCR, scan thư viện, full-text search (các lệnh vừa port).
4. Nếu còn panel lệch layout (CSS nội bộ riêng) → tinh chỉnh `.ws-module-pane` / từng module.

---

## 📌 TODO TỒN ĐỌNG (chưa làm phiên này)
- **TrishWork + TrishAdmin CHƯA build/publish v1.0.0** — còn code thêm tính năng (Trí xác nhận chưa build). Script sẵn: `scripts\BUILD-PUBLISH-WORK-ADMIN.ps1` (đã tạo phiên này, có BOM, version 1.0.0). TrishWork config đã version 1.0.0 + installerIcon.
- TrishAdmin: email notification (đổi role + demo ≤7 ngày), test /admin/users role demo, UI polish.
- Dọn Firestore `apps_meta` (15 app cũ) — xem HANDOFF-MASTER.
- Website downloads page hardcode (`app/downloads/page.tsx`) — refactor đọc registry (xem HANDOFF-MASTER).

---

## 🗂 FILE ĐỘNG PHIÊN NÀY (để review/diff)
- `apps-desktop/trishwork/src-tauri/`: `Cargo.toml`, `tauri.conf.json`, `src/lib.rs`, `src/library.rs` (mới)
- `apps-desktop/trishwork/src/`: `App.tsx`, `components/WorkShell.tsx` (mới), `components/work-shell.css` (mới)
- `apps-desktop/trishwork/src/modules/`: `design/DesignModule.tsx`, `library/LibraryModule.tsx`, `library/App.tsx`, `iso/IsoModule.tsx`
- `scripts/BUILD-PUBLISH-WORK-ADMIN.ps1` (mới)
- `docs/HANDOFF-MASTER.md` (cập nhật), file này (mới)

**⚠ Bài học giữ nguyên:** KHÔNG chạy git từ Cowork sandbox (corrupt index). Mọi git làm trên Windows qua END.bat/START.bat.
