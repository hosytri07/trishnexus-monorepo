# 🔄 HANDOFF — Phiên 2026-06-03 (máy CƠ QUAN)

> Đọc cùng `HANDOFF-MASTER.md` + `HANDOFF-2026-06-02-TRISHWORK.md`.
> **Chủ đề phiên:** (A) Tách widget Tài liệu·PDF, (B) Tích hợp VietOCR offline cho Khảo sát.

---

## ✅ A. Tách "Tài liệu · PDF" thành 2 widget (DONE — code)

Trên Dashboard nhóm Thư viện, feature `library:document` cũ (1 widget, 2 sub-tab
Soạn thảo + Chuyển đổi) đã tách thành **2 widget riêng**:
- `library:doc-edit` — **✏ Soạn thảo văn bản** (chỉ editor)
- `library:doc-convert` — **⇄ Chuyển đổi · PDF** (chỉ convert + PDF tools)

Thanh sub-tab nội bộ bị ẩn khi mở dạng widget. Nút "mở trong trình soạn thảo"
bên Chuyển đổi → tự mở tab Soạn thảo + nạp file (qua event `trishwork:open-feature`).

**File sửa:**
- `apps-desktop/trishwork/src/App.tsx` — 2 entry mới + import `FilePen`, `Replace`.
- `src/components/WorkShell.tsx` — listener `trishwork:open-feature` → openFeature.
- `src/modules/library/LibraryModule.tsx` — prop `documentTab`, truyền xuống.
- `src/modules/library/modules/document/DocumentModule.tsx` — prop `initialSubTab`
  + `hideSubNav`; cross-open qua localStorage `pending_open_path` + event.

**Test khi chạy tauri:dev:** Dashboard Thư viện hiện 2 card mới ("6 công cụ");
mở mỗi cái không còn thanh sub-tab; bên Chuyển đổi → convert file → "mở trong
trình soạn thảo" phải nhảy sang tab Soạn thảo và mở file.

---

## ⚙ B. VietOCR sidecar offline (SCAFFOLD xong — cần build trên Windows)

Trí chọn hướng **sidecar Python offline**. Đã dựng toàn bộ khung; phần còn lại
là build `.exe` + fine-tune trên máy Windows (Cowork sandbox không build được torch).

**Đã tạo:**
- `apps-desktop/trishwork/sidecar-vietocr/`
  - `ocr_service.py` — service HTTP localhost:39127. Pipeline: ảnh → cắt dòng
    (OpenCV projection) → VietOCR rec từng dòng → text. In `VIETOCR_READY <port>`.
  - `requirements.txt`, `build-sidecar.ps1` (PyInstaller one-file), `README.md`.
- `src-tauri/src/vietocr.rs` — quản lý child process + 4 command:
  `vietocr_available` / `vietocr_start` / `vietocr_ocr` / `vietocr_stop`.
  Spawn sidecar từ `resources/vietocr/vietocr-sidecar.exe`, đợi READY, gọi /ocr
  qua reqwest. Tự kill khi app thoát.
- `src-tauri/src/lib.rs` — `mod vietocr;` + `.manage(VietOcrState::default())` +
  đăng ký 4 command.
- `src/modules/design/modules/engineer/SurveyPanel.tsx` — nút **🇻🇳 Chạy VietOCR**
  cạnh Tesseract (Advanced). Tự ẩn/disable nếu chưa cài sidecar (`vietocr_available`).

**⚠ CHƯA làm (cần máy Windows — theo thứ tự, xem `sidecar-vietocr/README.md`):**
1. `build-sidecar.ps1` → ra `dist/vietocr-sidecar.exe` (cần Python 3.10/3.11).
2. Copy exe + weights `.pth` vào `src-tauri/resources/vietocr/`.
3. Thêm mục `resources` trong `tauri.conf.json` (CHỈ sau khi exe tồn tại, nếu
   không `tauri build` báo thiếu resource):
   ```json
   "resources": { "resources/vietocr/*": "vietocr/" }
   ```
4. `tauri:dev` → vào Khảo sát (OCR) → Advanced → nút VietOCR sẽ bật.
5. (Nâng cấp) fine-tune trên dataset `5CD-AI/Viet-Handwriting-OCR-v2` cho chữ
   viết tay → thay weights. Detector nâng cấp PaddleOCR DB nếu layout phức tạp.

**Lưu ý kỹ thuật:**
- Không thêm plugin/capability mới — dùng `reqwest`+`tokio` đã có trong Cargo.
- Cổng cố định 39127. Model nạp 1 lần lúc start (lần đầu OCR hơi lâu vì spawn).
- Build offline: BẮT BUỘC truyền `--weights` (đã tải sẵn) — README mục B.

---

## 📌 TODO TỒN ĐỌNG (từ phiên trước, chưa đụng)
- TrishWork + TrishAdmin chưa build/publish v1.0.0.
- TrishAdmin: email notification (Trí hoãn — chọn "để sau").
- Dọn Firestore `apps_meta` (15 app cũ).
- Website downloads page hardcode → refactor đọc registry.
- File rác `apps-desktop/trishadmin/src/lib/firestore-admin.ts.new` nên xoá.

**⚠ Bài học giữ nguyên:** KHÔNG chạy git từ Cowork sandbox. Mọi git qua END.bat/START.bat.
