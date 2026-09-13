# 📍 TRẠNG THÁI TRISHWORK — cập nhật 2026-06-17

Bản đồ toàn bộ module + việc còn lại, để khỏi mông lung. ✅ xong · 🟡 làm dở/chờ data · ⬜ chưa đụng.

---

## A. Nhóm KHẢO SÁT · THIẾT KẾ

| Module | Trạng thái | Còn phải làm |
|---|---|---|
| Vẽ hư hỏng mặt đường | ✅ XONG | (Trí xác nhận xong — không tính nữa) |
| Vẽ hiện trạng ATGT | 🟡 | Cũ, đang chạy. Phiên này chỉ fix UI (tab nổi rõ, lỗi chevron). Cần Trí rà lại nội dung 9 loại đối tượng. |
| Vẽ mặt cắt hốt sạt | ⬜ | Module cũ, **chưa rà lại phiên này**. Cần Trí kiểm tra còn chạy đúng không. |
| Chatbot AutoCAD | ⬜ | Cũ, chưa đụng. Cần API key AI (set trong Settings/TrishAdmin). |
| Tiện ích PDF · Quét sổ hiện trạng (OCR) | 🟡 | UI + 2 tab xong. **VietOCR: chờ Trí test lần đầu** (tải weights cần net 1 lần) + (tuỳ chọn) copy file .pth để offline hẳn. |
| Tra cứu biển báo · vạch (QC 41:2024) | 🟡 | Khung UI xong, **rỗng dữ liệu**. Chờ Trí gửi ảnh biển + Excel kích thước → mình nhồi. |
| Tạo khung tên bản vẽ | 🟡 | Form xong. Chờ Trí gửi **file .dwg mẫu** → mình tạo block ATTRIBUTE + nối "Chèn vào AutoCAD". |
| Thư viện bản vẽ | 🟡 | UI người dùng + panel upload (TrishAdmin) xong. **Rỗng dữ liệu** → chờ Trí gửi file DWG/PDF chi tiết + bản vẽ mẫu (hoặc tự upload qua TrishAdmin). |
| Quản lý Autolisp | ⬜ | Cũ, chưa đụng phiên này. |
| Bảng tính kết cấu | 🟡 | Gắn nhãn **"Sắp có"** — panel thật chưa làm. |
| GIS – MAP | ⬜ | Cũ, chưa đụng phiên này. |

**Đã bỏ khỏi nhóm:** Dashboard & Dự án, Dự toán, Mẫu hồ sơ (Trí yêu cầu gỡ).

---

## B. Nhóm THƯ VIỆN

| Module | Trạng thái | Ghi chú |
|---|---|---|
| Thư viện (quản lý file) | 🟡 | Cũ. Phiên này chỉ **fix lỗi treo spinner** (load nhanh lại). Cần rà nội dung. |
| Ghi chú | ✅ | Đã fix treo "Đang load notes". Chạy ổn. |
| Soạn thảo văn bản | 🟡 | Tách ra từ Tài liệu·PDF. Cũ, chạy được. |
| Ảnh | ⬜ | Cũ, chưa rà phiên này. |
| Thư viện TrishTEAM (cloud) | ⬜ | Cũ, chưa rà phiên này. |

> "Chuyển đổi · PDF" cũ đã **chuyển sang nhóm Khảo sát·Thiết kế** (gộp vào panel OCR).

---

## C. Nhóm HỒ SƠ ISO (13 công cụ)

- Trạng thái: ⬜ module cũ, **chưa rà lại nội dung phiên này**.
- Phiên này chỉ thêm **phân quyền PKTCNĐB**: chỉ admin hoặc user được bật cờ mới thấy nhóm này; trial/demo bị ẩn.
- **Cần test:** đăng nhập bằng 1 tài khoản user chưa bật cờ → phải không thấy nhóm ISO.

---

## D. VIỆC CODE MÌNH LÀM TIẾP (không cần chờ data)

1. **D2** — Nối thật lệnh "Chèn vào AutoCAD" cho: biển báo, khung tên, chi tiết điển hình (qua acad_com khi đã có block_id map).
2. **D3** — Nối nút "Lấy thông tin từ ISO" ở panel khung tên (lấy tên công trình/hạng mục từ module ISO).
3. (sau) Nối VietOCR detector tốt hơn (PaddleOCR) nếu cần độ chính xác chữ tay cao.

## E. CHỜ TRÍ GỬI DATA

- **C1** — Ảnh biển báo/vạch + Excel kích thước (QC 41:2024).
- **C2** — File .dwg mẫu khung tên (1+ khổ giấy).
- **C3** — File DWG/PDF chi tiết điển hình + bản vẽ mẫu.

## F. CẦN CHẠY LỆNH (khi tiện)

- `firebase deploy --only firestore:rules` — cho Footer credit (sửa từ TrishAdmin), Thư viện bản vẽ, app_config hoạt động.
- (Tuỳ chọn) copy weights `.pth` VietOCR vào `src-tauri/resources/vietocr/` để OCR offline hẳn.

## G. TỒN ĐỌNG CŨ (chưa làm, từ handoff trước)

- Build + publish TrishWork & TrishAdmin v1.0.0.
- Dọn Firestore `apps_meta` (15 app cũ trong /admin/apps).
- Refactor trang downloads website (đang hardcode).
- Xoá file rác `apps-desktop/trishadmin/src/lib/firestore-admin.ts.new`.
- TrishAdmin email notification (Trí đã hoãn).

---

## 👉 ĐANG Ở BƯỚC NÀO

Vừa xong: panel upload Thư viện bản vẽ (TrishAdmin). 
Kế tiếp gợi ý: làm **D2 + D3** (nối AutoCAD + ISO) trong lúc chờ Trí gom data (C1/C2/C3). Khi có data thì nhồi vào 2-3 panel đang rỗng là chúng "sống".
