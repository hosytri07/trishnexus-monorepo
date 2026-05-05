# 🗺️ APPS-IDEAS-MAPPING — Phân tích kết hợp 72 ý tưởng vào hệ sinh thái

> **Ngày phân tích:** 2026-05-04 · Phase 35
> **Input:** `y_tuong_tool_tu_dong_hoa_autocad_pdf_office_xay_dung.md` (72 ý tưởng) + bảng 15 apps hiện tại
> **Mục tiêu:** Vạch lộ trình gộp ý tưởng vào apps đã có / tạo mới, fix lỗi, cải thiện ecosystem

---

## 1. TỔNG QUAN GỘP

### 🟢 KẾT LUẬN NHANH (đã update sau khi check TrishLibrary)

**3 app cần MỞ RỘNG**, **1 app MỚI**, **3 app CẮT BỎ**:

| Hành động | App | Lý do |
|---|---|---|
| 🔥 **MỞ RỘNG LỚN** | **TrishDesign** | 40 ý tưởng AutoCAD đã hợp với scope hiện tại |
| 🔥 **MỞ RỘNG LỚN** | **TrishLibrary** | Đã có 13 PDF tools (Phase 18.3.b) → thêm 4 PDF Pro module (Stamp, Binder, OCR, Compare) thay vì tạo TrishPDF mới |
| 🔥 **MỞ RỘNG** | **TrishOffice** (chưa có code) | = "BuildOffice Assistant" gom 18 ý tưởng VP |
| 🔥 **MỞ RỘNG** | **TrishISO** | Thêm Checklist hoàn công + QR truy xuất |
| ❌ **CẮT** | TrishPDF (MVP đã đề xuất) | TrishLibrary đã có 13 PDF tools — chỉ cần thêm 4 module nâng cao |
| ❌ **CẮT** | TrishStudy | Đã có quiz trên website |
| ❌ **CẮT** | TrishTool / TrishFleet | Out of scope |

**Sau gộp: 11 apps thay vì 15.**

---

## 2. MAPPING 72 Ý TƯỞNG → APPS

### A. TrishDesign (mở rộng) — 40 ý tưởng AutoCAD

Từ "công cụ Khảo sát-Thiết kế đường" → **TrishDesign Pro** với 8 nhóm tool:

#### A.1 — Batch Plot + Issue (10 ý tưởng) ⭐⭐⭐
- 4: Batch Plot CAD → PDF
- 42: CAD PDF Publisher
- 43: Issue PDF Maker (DRAFT/FOR REVIEW/AS BUILT)
- 44: CAD-PDF Checker (so sánh layout vs PDF folder)
- 64: Copy Page Setup tất cả layout
- 65: Auto Create Layout from Frame
- 66: Viewport Scale Checker
- 38: VLOCK khóa viewport hàng loạt
- 39: LAYIMG xuất ảnh preview layout

#### A.2 — Block + Attribute (5)
- 6: Extract block attribute → Excel
- 23: EXLIST xuất danh sách bản vẽ từ khung tên
- 24: TBU update khung tên hàng loạt từ Excel
- 53: Block Counter
- 26: Point Block Importer (Excel → block tọa độ)

#### A.3 — Quantity Takeoff (4) ⭐⭐
- 28: LLEN tính tổng chiều dài theo layer
- 29: Area Takeoff diện tích hatch/polyline
- 55: Polyline Quantity Tool
- 56: CAD BOQ Generator (map layer/block → BOQ Excel)

#### A.4 — Standard Checker + Cleaner (8) ⭐
- 5: CAD Checker (layer/text/dim/font)
- 21: CCLEAN (purge + audit + ByLayer)
- 22: FIXFONT đổi font hàng loạt
- 37: BYLAYERALL màu/linetype/lineweight về ByLayer
- 57: CAD Standard Inspector
- 58: Layer Translator (mapping layer)
- 59: Text Style Normalizer
- 60: Dimension Standardizer

#### A.5 — Excel ↔ CAD (4)
- 7: Excel to CAD Drawer
- 19: Excel to CAD Table
- 27: Coordinate Exporter (object → Excel)
- 30: CAD Table Generator

#### A.6 — Quick Tools / LISP nội bộ (8)
- 25: NUM đánh số thứ tự
- 31: LAYSTD tạo layer chuẩn
- 32: SLAY chọn theo layer
- 33: TOLAY chuyển layer
- 34: CTN copy text tăng dần
- 35: SUMTXT cộng tổng số
- 36: BSCALE scale block hàng loạt
- 40: TEXTCHK kiểm tra text bị che
- 62: Quick Align Text
- 63: Find & Replace nâng cao
- 41: REVCLOUDX revision cloud

#### A.7 — Revision Manager (3)
- 50: Drawing Revision Control
- 51: PDF Revision Compare
- 52: DWG Compare Assistant

#### A.8 — Layer Preset (1)
- 61: Layer Freeze/On-Off Preset

**→ TrishDesign hiện tại đã có: vẽ hư hỏng + ATGT + bão lũ. Module mới sẽ thêm 8 tab nữa qua sidebar.**

---

### B. TrishOffice (ý tưởng) — 18 ý tưởng văn phòng XD

Đây chính là **"BuildOffice Assistant"** ở Phần 9 file md. App lớn 6 module:

#### B.1 — Dự án (Project Launcher)
- 1: Project Launcher (folder structure chuẩn 10 thư mục)
- 17: Office Template Center

#### B.2 — Hồ sơ (Document Manager)
- 2: File Rename Pro
- 3: Folder Index Generator (xuất Excel danh mục)
- 15: Document QR Generator
- 20: Local Project Search (full-text search)
- 13: Drawing List Compare

#### B.3 — Office (Document Generator)
- 8: Auto Bien Ban Maker (Excel → Word biên bản)
- 10: Construction Report Maker (báo cáo tuần/tháng)
- 11: Site Photo Report Maker (chèn ảnh hiện trường)

#### B.4 — Công văn (Correspondence)
- 9: Cong Van Manager (đến/đi + scan)

#### B.5 — Excel BOQ
- 18: BOQ Checker (kiểm tra ô trống, công thức lỗi)

#### B.6 — Settings
- Đường dẫn AutoCAD, template plot, folder lưu trữ

---

### C. TrishPDF (TẠO MỚI) — 10 ý tưởng PDF

App độc lập tách khỏi TrishDesign cho user KHÔNG dùng AutoCAD:

- 14: PDF Stamp Pro (watermark + chữ ký + dấu)
- 45: PDF Binder (gộp PDF theo danh mục Excel)
- 46: PDF Page Numberer
- 47: PDF Stamp Pro (chi tiết)
- 48: PDF Split Smart (tách theo bookmark/trang)
- 49: PDF Title Reader OCR

**→ Đây là MVP1 trong file md. Không phụ thuộc AutoCAD, làm trước được.**

---

### D. TrishISO (đã có, mở rộng nhẹ) — 3 ý tưởng

Hiện tại quản lý hồ sơ ISO + thiết bị nội bộ. Thêm:

- 12: ISO Form Manager (đã 80% có)
- 16: Hoan Cong Checklist (theo loại công trình: đường/cầu/thoát nước/điện)
- 15: QR Generator (chia sẻ với TrishOffice)

---

### E. TrishLibrary (đã có, mở rộng nhẹ)

Hiện tại 4 module: Thư viện / Note / Type / Image. Thêm:

- 17: Template Center share với TrishOffice — quản lý mẫu Word/Excel

---

### F. CẮT BỎ

| App | Lý do | Thay thế |
|---|---|---|
| **TrishStudy** | Quiz đã có trên website (BXD 8081 câu, lái xe, tiếng Anh) | Tab "Học tập" trên website |
| **TrishTool** | Mẹo sửa Windows = blog | Section "Mẹo IT" trên blog website |
| **TrishFleet** | Out of scope (xe thuê không phải ngành XD core) | Bỏ hoặc giao 3rd-party |

---

## 3. ROADMAP TRIỂN KHAI

### Giai đoạn 1 (1-2 tháng): MVP TrishPDF + TrishDesign Quantity

**TrishPDF** (app mới, không phụ thuộc CAD):
- Sub 1.1: Gộp PDF + Đánh số trang + Đóng dấu (3 tool cơ bản)
- Sub 1.2: PDF Binder theo danh mục Excel
- Sub 1.3: PDF Split

**TrishDesign Quantity** (mở rộng TrishDesign):
- Sub 1.4: LLEN + Area Takeoff (28+29) — đây là "đánh đúng nỗi đau"
- Sub 1.5: Block Counter (53)
- Sub 1.6: BOQ Generator (56)

→ **Lý do:** Quantity takeoff là tool dân CAD VN xài hàng ngày, kiếm khách dễ. PDF tools là MVP độc lập, dùng được kể cả người không CAD.

---

### Giai đoạn 2 (2-3 tháng): TrishDesign Standard + Issue

**TrishDesign Standard Checker:**
- Sub 2.1: CCLEAN + FIXFONT + BYLAYERALL (21+22+37)
- Sub 2.2: CAD Standard Inspector (57) + Layer Translator (58)
- Sub 2.3: Block Attribute Extractor + EXLIST (6+23)

**TrishDesign Issue Center:**
- Sub 2.4: Batch Plot CAD → PDF (4+42)
- Sub 2.5: TBU update khung tên (24)
- Sub 2.6: CAD-PDF Checker (44)
- Sub 2.7: Revision Manager (50)

→ **Lý do:** Phase 2 wrap toàn bộ workflow phát hành bản vẽ. Đây là sản phẩm bán được.

---

### Giai đoạn 3 (3-4 tháng): TrishOffice MVP

**TrishOffice 6 module:**
- Sub 3.1: Project Launcher + Folder structure (1+17)
- Sub 3.2: File Rename Pro + Folder Index (2+3)
- Sub 3.3: Auto Bien Ban + Photo Report (8+11)
- Sub 3.4: Cong Van Manager (9)
- Sub 3.5: Local Search (20)

→ **Lý do:** App tổng hợp dài hạn, gắn kết toàn bộ ecosystem.

---

### Giai đoạn 4 (4-6 tháng): TrishISO mở rộng + integrations

- TrishISO + Hoan Cong Checklist (16)
- TrishOffice ↔ TrishISO link biểu mẫu
- TrishOffice ↔ TrishDesign link bản vẽ
- TrishOffice ↔ TrishDrive sync hồ sơ cloud

---

## 4. FIX LỖI / CẢI THIỆN APPS HIỆN CÓ

### TrishDesign (đang test) — 5 fix nhỏ
1. ✅ Modal "+ Đoạn" + "Sửa/Xóa" (đã fix Phase 28.4.G)
2. ✅ Mode bão lũ split 500m+500m (đã fix)
3. ✅ Inherit drawing settings giữa segments (đã fix)
4. ✅ Export/Import hồ sơ JSON (đã thêm)
5. 🔲 **Pending:** version mismatch tauri 2.11 vs @tauri-apps/api 2.10.1 — fix `pnpm install` reroute

### Website (trishteam.io.vn) — 3 cải thiện
1. 🔲 Tab "Hướng dẫn" cho từng app desktop (Phase 37 đã có roadmap)
2. 🔲 Blog tutorial: "Vẽ hư hỏng mặt đường với TrishDesign" + "Quản lý ISO với TrishISO"
3. 🔲 Section "Tải về" hiển thị 9 app + screenshot

### TrishAdmin — 2 fix
1. 🔲 BackupPanel: tự động backup Firestore weekly (đã có workflow GitHub, chưa wire UI)
2. 🔲 StoragePanel: hiển thị quota Cloudinary realtime (chưa wire API)

### TrishLauncher — 2 cải thiện
1. 🔲 Tích hợp Project Launcher từ ý tưởng 1 (link folder dự án)
2. 🔲 Tray menu thêm "Mở dự án gần đây"

### TrishFinance — 1 cải thiện
1. 🔲 Phase 24.3.C: convert HTML standalone → React+Vite (đã có roadmap)

### TrishDrive — 1 fix
1. 🔲 Share file MTProto qua web /proxy chưa support → cần Phase 26+

### TrishLibrary — 1 cải thiện
1. 🔲 Thêm tab "Thư viện TrishTEAM" public view (Phase 24.2 đã có roadmap)

### TrishFont / TrishCheck / TrishClean / TrishShortcut
✅ Stable, không cần thay đổi.

---

## 5. KHUYẾN NGHỊ FINAL

### 🎯 Top 3 việc làm NGAY (sau khi xong Phase 34 build wave):

1. **TrishPDF MVP** (4-6 tuần) — bắt đầu với PDF Binder + Đánh số + Đóng dấu. Tool dùng được liền kể cả không CAD.

2. **TrishDesign Quantity** (3-4 tuần) — thêm LLEN + Area + Block Counter + BOQ. Đây là "killer feature" cho dân CAD VN.

3. **Website Hướng dẫn** (2-3 tuần) — viết tutorial 3 app chính (TrishDesign, TrishISO, TrishDrive). Giúp user khám phá ecosystem.

### 🚫 Việc KHÔNG nên làm:

- ❌ TrishStudy / TrishTool / TrishFleet (out of scope, lãng phí công sức)
- ❌ Giai đoạn 4 trước khi xong giai đoạn 1+2 (over-engineering)
- ❌ Tích hợp Excel COM Windows-only (dùng openpyxl/xlsx-js đa nền tảng)

### ✅ Stack đề xuất cho app mới:

| App | Stack | Lý do |
|---|---|---|
| **TrishPDF** | Tauri 2 + React + Rust (`pdf` crate, `printpdf`) | Đồng bộ ecosystem |
| **TrishOffice** | Tauri 2 + React + Rust (`docx-rs`, `xlsx`) | Cùng pattern |
| **TrishDesign mở rộng** | Giữ Tauri 2 + LISP gen từ Rust commands | Hiện tại đã work |

---

**Tổng:** Hệ sinh thái sau gộp = 12 apps + Website + Admin = đủ nhỏ để 1 người maintain, đủ lớn để cover 70% workflow kỹ sư XD VN.
