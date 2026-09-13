# Handoff phiên 2026-07-30 — S-RETC rebrand + gộp app (v2)

> File handoff riêng cho phiên 2026-07-30. Đọc cùng `docs/HANDOFF-MASTER.md` (đã lạc hậu ~57 ngày).
>
> **Chủ đề phiên (cập nhật lần 2 sau khi Trí phản hồi):**
> - Đổi tên toàn bộ sang **S-RETC** (Software cho Road, Electronic, Transport, Civil).
> - Gộp 14 app cũ + mới vào **1 umbrella S-RETC.exe** chứa **Work** + **Utilities** + **Office** + **Admin** (ẩn theo role).
> - **TrishFinance KHÔNG thuộc S-RETC** — vẫn tách riêng, giữ nguyên tên.
> - Tối ưu hoá gộp app, **nổi bật tác giả Trí** (Trung tâm Kỹ thuật và Công nghệ Đường bộ phía Nam).
> - Module **Office** = quản lý công việc / hiệu suất **phòng ban nơi tác giả đang làm việc**, các nhân viên khác dùng app này để làm việc hằng ngày.
> - **Auth trong app** (sign-up / sign-in), không qua website.
> - **Website rút gọn**: chỉ landing page giới thiệu + download `.exe`, **không còn đăng nhập / đăng ký / Firebase / Cloudinary / quiz / database** như hiện tại.
> - Admin Trí muốn quản lý trên **Android** — đề xuất phương án khả thi.

Xem chi tiết: `audit-2026-07-30/ROADMAP-S-RETC-v2.md` và `audit-2026-07-30/ADMIN-MOBILE-DEXUAT.md`.

---

## 1. Trình bày dự án mới

### 1.1. Tên gọi

| Cũ | Mới |
|---|---|
| TrishTEAM / TrishNexus (umbrella) | **S-RETC** (Software · Road · Electronic · Transport · Civil) |
| TrishWork (gộp Design + Library + ISO) | **S-RETC Work** |
| TrishUtilities (gộp Clean + Check + Drive + Font + Shortcut) | **S-RETC Utilities** |
| TrishOffice (HRM 13 module — đang trong archive) | **S-RETC Office** ⭐ *mới — gộp lần này* |
| TrishAdmin | **S-RETC Admin** (ẩn theo role) |
| TrishFinance | **TrishFinance** — *giữ nguyên, không thuộc S-RETC* |

### 1.2. Logo

- **1 logo duy nhất**: huy hiệu tròn xanh dương Trung tâm Kỹ thuật và Công nghệ Đường bộ phía Nam (Trí cung cấp), chữ **S-RETC** ở dưới.
- **Xóa background** → PNG trong suốt.
- Thay cho 4 logo app con cũ + áp dụng cho **cả website** lẫn **app**.

### 1.3. Cấu trúc S-RETC sau khi gộp

```
┌──────────────────────────────────────────────────────────────┐
│  S-RETC.exe                ← umbrella duy nhất, 1 logo       │
│  ├── S-RETC Work           ← gộp Design + Library + ISO      │
│  │   ├── Khảo sát·Thiết kế (11 sub-feature)                  │
│  │   ├── Thư viện          (5 sub-feature)                   │
│  │   ├── Hồ sơ ISO         (13 sub-feature)                  │
│  │   └── Tiện ích kỹ thuật (mở rộng từ TrishDesign)         │
│  ├── S-RETC Utilities                                            │
│  │   ├── Dọn dẹp          (Clean)                            │
│  │   ├── Kiểm tra máy     (Check)                            │
│  │   ├── Tải xuống        (Drive / Downloader)               │
│  │   ├── Quản lý Font     (Font + DWG scanner)               │
│  │   └── Shortcut         (Sidebar nhóm + workspace)         │
│  ├── S-RETC Office ⭐ MỚI  ← module nội bộ cho phòng KT&CNĐB  │
│  │   ├── Dashboard KPI                                        │
│  │   ├── Hồ sơ dự án (BuildOffice Assistant)                  │
│  │   ├── Nhân sự + Chấm công                                  │
│  │   ├── Tài sản + Mượn/trả thiết bị                          │
│  │   ├── Quy trình duyệt (xin phép, công tác, mua sắm)        │
│  │   ├── Tài liệu nội bộ + Công văn                           │
│  │   ├── Kế toán (lương, thuế TNCN, BHXH)                     │
│  │   ├── Lịch + Báo cáo                                       │
│  │   ├── Biên bản tự động + Photo Report                     │
│  │   └── Người dùng + Phòng ban (admin IT/Owner)              │
│  └── S-RETC Admin          (ẩn, chỉ role ecosystem_admin)    │
│      └── toàn bộ panel Phase 78.13 (Schedules, Devices,       │
│          FontPacks, ATGT, Audit, Broadcasts, …)               │
└──────────────────────────────────────────────────────────────┘

TrishFinance.exe      ← tách riêng, không gộp, giữ nguyên.
```

### 1.4. Tác giả & branding nổi bật

- **About dialog trong app**: tab "Tác giả" với ảnh Trí (nếu có) + tiểu sử:
  > *"Phần mềm được phát triển bởi **Trí** — Kỹ sư hạ tầng giao thông, Trung tâm Kỹ thuật và Công nghệ Đường bộ phía Nam. Mọi tính năng trong S-RETC sinh ra từ nhu cầu thực tế hằng ngày của kỹ sư cầu đường Việt Nam."*
- **Splash screen** khi mở app: logo S-RETC + dòng chữ "Made by Trí · S-RETC v1.0.0".
- **About window** (cửa sổ phụ): credit "© 2026 Trí · Trung tâm KT&CNĐB phía Nam · MIT License".
- **Footer mỗi app con**: dòng nhỏ "Made with ♥ by Trí".

---

## 2. Tổng hợp 14 app archive + hiện tại

Đã rà xong 10 app archive + 4 app hiện tại. Bảng chi tiết:

| # | App archive / hiện tại | Phiên bản | Đã gộp vào | Module user-facing |
|---|---|---|---|---|
| 1 | `trishdesign/` | v2.1.0 | **Work › Khảo sát·Thiết kế** | Color palette / WCAG / Harmony / AI suggestPalette / Export tokens + Engineer panels (AtgtPanel, BoreHolePit, AutoLisp, Chatbot, BaoLu) |
| 2 | `trishlibrary/` | v1.0.0 | **Work › Thư viện** | PDF/EPUB/Word local + sync, OCR tesseract + VietOCR sidecar, Tag AI, Cite APA/IEEE, Tantivy full-text (đã port vào trishwork hiện tại) |
| 3 | `trishiso/` | v1.0.0 | **Work › Hồ sơ ISO** | Dashboard hồ sơ công trình, cảnh báo thiếu bản, mượn/trả giấy + thiết bị, QR code, Excel export (Phase 1.10) |
| 4 | `trishclean/` | v1.0.0 | **Utilities › Dọn dẹp** | Scan junk, classify domain (TypeScript), staged delete + undo 7 ngày |
| 5 | `trishcheck/` | v1.0.0 | **Utilities › Kiểm tra máy** | sysinfo, CPU/RAM benchmark, health score, MinSpec compare, GPU VRAM registry, speed test Cloudflare |
| 6 | `trishdrive/` | v1.0.0 | **Utilities › Tải xuống** | Telegram Cloud, MXH downloader, Google Drive bulk downloader (đã gộp) |
| 7 | `trishfont/` | v1.0.0 | **Utilities › Font** | Quét folder, classify personality (serif/sans/slab/mono/display/script/handwriting), Pair AI heading+body, ưu tiên VN, font-pack sync GitHub, DWG Font Detector (đã gộp) |
| 8 | `trishshortcut/` | v1.0.0 | **Utilities › Shortcut** | Quản lý `.lnk`, sidebar nhóm + workspace, dashboard widget, icon 72px |
| 9 | `trishoffice/` | v1.0.0 | **Office ⭐** | 13 module HRM/ERP-light — chi tiết ở §3 dưới |
| 10 | `trishlauncher/` | v1.0.0 | **S-RETC entry** | Launcher cũ, fetch `apps-registry.json`, mở app — không cần nữa vì giờ 1 installer |
| 11 | `trishwork/` (hiện tại) | v1.0.0 | **S-RETC Work** | Đã gộp Design + Library + ISO, UI WorkShell + Ctrl+K |
| 12 | `trishutilities/` (hiện tại) | v1.0.0 | **S-RETC Utilities** | Đã gộp 5 module, polish Phase 78.10-11 |
| 13 | `trishfinance/` (hiện tại) | v1.0.0 | **TrishFinance** *(tách riêng)* | Tài chính cá nhân — *không thuộc S-RETC, giữ nguyên* |
| 14 | `trishadmin/` (hiện tại) | v1.0.0 | **S-RETC Admin** | Đã polish Phase 78.13 — 30+ panel |

### Tối ưu hoá gộp app

1. **Giữ 1 installer `.exe`** thay vì 4 → user chỉ cài 1 lần, dung lượng ước tính 35-45 MB (gộp code + assets).
2. **SRETCShell đa-app** (refactor từ WorkShell + AdminShell hiện tại):
   - Sidebar trái cố định: 3 icon app con (Work / Utilities / Office) + 1 icon Admin (ẩn nếu không phải admin).
   - Click vào icon → load app con đó vào panel chính.
   - Sidebar phải: module list của app con đang chọn.
   - Topbar: logo S-RETC + tên app con + Ctrl+K palette (search xuyên 3 app).
3. **Lazy load** app con: `React.lazy()` theo app, chỉ tải code khi user mở.
4. **Shared packages** giữ nguyên (`packages/design-system`, `packages/auth`, `packages/data`, `packages/core`, `packages/ui`, `packages/adapters`, `packages/machine-id`, `packages/telemetry`).
5. **Rust backend** gộp vào 1 `src-tauri/`: tất cả 54+58+13 commands Library + 4 commands VietOCR + n commands Office backend → đăng ký trong 1 `lib.rs`. Dùng `mod` phân chia file theo nhóm chức năng (`clean`, `check`, `drive`, `font`, `shortcut`, `library`, `vietocr`, `office`, `acad_com`).
6. **State riêng từng app con**: mỗi app con có folder `state.ts` + `lib/` riêng, tránh global state leak.

---

## 3. Module Office — chi tiết (TrishOffice hiện archive)

### 3.1. Bối cảnh

> *"Module Office là module quản lý công việc hiệu suất của **phòng Kỹ thuật và Công nghệ đường bộ** nơi tác giả đang làm việc và **các nhân viên đang sử dụng app này làm việc**."*

Nghĩa là: S-RETC Office là **module nội bộ** của 1 tổ chức cụ thể (Trung tâm KT&CNĐB phía Nam), không phải SaaS đa tenant. Dùng để các nhân viên trong phòng ban dùng hằng ngày.

### 3.2. 13 module chính (từ code archive)

| # | Module | Mục đích | Phase hiện tại |
|---|---|---|---|
| 1 | **Dashboard KPI** | Tổng quan: KPI tài chính, pending workflows, deadline sắp tới | ✅ Phase 38.7 |
| 2 | **Nhân sự** | CRUD nhân viên (mã NV, hợp đồng, lương, BHXH, tài khoản NH) | ✅ Phase 38.6.2 |
| 3 | **Chấm công** | Manual giờ vào/ra, OT, ngày nghỉ | ✅ Phase 38.6 |
| 4 | **Tài sản** | Laptop, máy in, xe, cấp phát + thu hồi | ✅ Phase 38.6 |
| 5 | **Quy trình duyệt** | Yêu cầu mua sắm, xin phép, công tác phí — multi-step approval | ✅ Phase 38.7 |
| 6 | **Tài liệu nội bộ** | Quy định, quy chế, biểu mẫu | ✅ Phase 38.7 |
| 7 | **Kế toán** | Bảng lương, thuế TNCN, BHXH | ✅ Phase 38.7 |
| 8 | **Lịch** | Nghỉ phép, công tác, sinh nhật | ✅ Phase 38.7 |
| 9 | **Báo cáo** | P&L, Cash flow, KPI tài chính | ✅ Phase 38.7 |
| 10 | **Import/Export** | Backup, restore, Excel import/export | ✅ Phase 38.7 |
| 11 | **Người dùng** | Quản lý account + role + quyền (Admin IT + Owner) | ✅ Phase 38.7 |
| 12 | **Phòng ban** | CRUD phòng ban | ✅ Phase 38.7 |
| 13 | **Cài đặt cá nhân** | Mọi role | ✅ Phase 38.7 |

**Ngoài ra còn có:**
- **BuildOffice Assistant**: tự động tạo hồ sơ dự án từ template, file rename pro.
- **Biên bản tự động**: soạn biên bản nghiệm thu từ form.
- **Photo Report**: upload ảnh hiện trường + gắn metadata (GPS, ngày, dự án).
- **Công văn manager**: số hoá công văn đến/đi.

### 3.3. Auth & RBAC (9 role, đã có sẵn)

| Role | Level | Mô tả |
|---|---|---|
| `ecosystem_admin` | 999 | Admin S-RETC (Trí) — cross-company, set role mọi user |
| `owner` | 100 | Giám đốc 1 công ty — full trừ User Management |
| `vice_director` | 90 | Phó GĐ |
| `dept_manager` | 50 | Trưởng phòng — scope dept |
| `dept_deputy` | 45 | Phó phòng |
| `hr` | 40 | HR — full Nhân sự + Chấm công |
| `accountant` | 40 | Kế toán — full Kế toán |
| `admin_it` | 40 | Admin IT — User + Department |
| `staff` | 10 | Nhân viên — chỉ self |

Matrix 13 module × 9 role đã chốt (xem `audit-2026-07-30/PERMISSION-MATRIX-EXTRACT.md` để lấy đầy đủ).

### 3.4. Stack Office

- Frontend: React 18 + Vite 6 + TypeScript + Recharts + xlsx.
- Storage: `localStorage` key `trishoffice:*` (offline-first) + Firestore sync (qua `SyncContext`).
- Backend: Tauri commands cho file IO (Excel export, photo upload).
- Auth: hybrid Firebase + local password (Phase 38.13 — link Firebase uid tự động sau lần đăng nhập đầu).

### 3.5. Vì sao Office nổi bật tác giả

- **Trí là nhân viên phòng KT&CNĐB** → Office được thiết kế đúng cho bối cảnh Việt Nam: chấm công BHXH, thuế TNCN, biên bản nghiệm thu QCVN, công văn đến/đi.
- **Các nhân viên khác dùng hằng ngày** → mọi UX quyết định ưu tiên hiệu suất làm việc phòng ban thay vì "đẹp cho có".
- **Branding nhắc tác giả**: app About, splash screen, footer, README đều credit Trí + Trung tâm KT&CNĐB phía Nam.

---

## 4. Auth trong app (không qua website)

### 4.1. Flow mới

```
Mở S-RETC.exe lần đầu
  ├─→ Nếu chưa có account:
  │     Sign Up screen
  │     ├── Email + password
  │     ├── Tên hiển thị
  │     ├── SĐT (optional)
  │     └── Bấm "Tạo tài khoản"
  │        ↓
  │     Firebase Auth createUser + Firestore users/{uid} (role=trial)
  │        ↓
  │     Auto-login, vào S-RETC shell (3 app con + Admin ẩn)
  │
  └─→ Nếu đã có account:
        Sign In screen (email + password / Google)
           ↓
        Firebase Auth signIn
           ↓
        Check role → admin thấy thêm S-RETC Admin icon
```

### 4.2. AppAccessPanel (giữ nguyên)

- Admin (Trí, `ecosystem_admin`) vào S-RETC Admin → panel "Cấp quyền App" → tick app con cho user.
- User trial mặc định thấy S-RETC Work + Utilities + Office (vì Office là module nội bộ nên ai cũng dùng), Finance tách riêng.
- Admin có thể tắt/bật từng app con per-user.

### 4.3. Cached credentials

- Sau lần đầu login → lưu refresh token (DPAPI trên Windows, Keychain macOS, libsecret Linux).
- Auto-login lần mở app sau → không cần nhập lại.

### 4.4. Recovery

- Quên mật khẩu: email link qua Firebase Auth (gửi qua app, không qua web).
- Đổi mật khẩu: trong app Settings.
- Xoá account: trong app Settings (kèm xác nhận 2 bước).

### 4.5. Schema user (Firestore `users/{uid}`)

```ts
{
  uid: string;
  email: string;
  display_name: string;
  phone?: string;
  photo_url?: string;       // Cloudinary signed upload từ app
  role: 'guest' | 'trial' | 'user' | 'staff' | 'manager' | 'admin' | 'ecosystem_admin';
  app_access: {             // Phase 44.2 giữ nguyên
    'sretc-work': boolean;
    'sretc-utilities': boolean;
    'sretc-office': boolean;
    'sretc-admin': boolean;
  };
  office_role?: Role;       // ecosystem_admin/owner/hr/accountant/...
  office_company_id?: string;
  created_at: Timestamp;
  updated_at: Timestamp;
  last_active_at: Timestamp;
}
```

---

## 5. Website rút gọn

### 5.1. Cấu trúc mới (4 trang)

```
trishteam.io.vn (hoặc sretc.vn nếu Trí mua domain mới)
  ├── /              ← landing page giới thiệu S-RETC
  ├── /download      ← 1 card "S-RETC-Setup-v1.0.0.exe" + SHA256 + md5 + size + changelog link
  ├── /changelog     ← lịch sử phiên bản (đọc từ GitHub Release API)
  └── /contact       ← Telegram + FB Trí
```

### 5.2. Bỏ hết (so với website hiện tại)

- ❌ Đăng nhập / đăng ký (chuyển vào app).
- ❌ Firebase Web SDK (chỉ giữ Firebase Admin cho admin endpoints).
- ❌ Cloudinary upload (chuyển upload từ app lên Cloudinary qua API key riêng).
- ❌ 6 bộ database (biển báo, cầu VN, đường VN, QCVN, định mức, vật liệu) → **chuyển thành module trong S-RETC Work**.
- ❌ 4 bộ quiz (BXD 163/2025, lái xe, tin học VP, tiếng Anh) → **chuyển thành module trong S-RETC Work** ("Ôn thi chứng chỉ").
- ❌ 11 công cụ (pomodoro, BMI, vn2000, hash…) → **chuyển thành module S-RETC Utilities** ("Máy tính & Công cụ").
- ❌ Sitemap 30+ routes, blog, footer 4 cột, dark/light, PWA, Umami analytics.

### 5.3. Giữ lại

- ✅ Landing page (refactor từ `gemini-code-1785389851237.html` — đổi TrishTEAM → S-RETC, thêm logo).
- ✅ Download page (1 card duy nhất, đọc từ `apps-registry.json` hoặc hardcode GitHub Release URL).
- ✅ Trang /changelog.
- ✅ Trang /contact.

### 5.4. Stack website mới

- **Static site** thuần (Next.js vẫn ổn nhưng chỉ cần SSG, không SSR).
- Host Vercel free tier.
- Logo S-RETC + brand màu xanh dương `#1E3A8A`.
- Tiếng Việt, font Be Vietnam Pro.

---

## 6. Admin trên Android — đề xuất

Trí đang dùng Android, muốn quản lý S-RETC Admin khi đi công tác. **3 phương án**:

### Phương án A — Telegram bot (KHUYẾN NGHỊ, P0)

**Lý do chọn:** Android có sẵn Telegram, Trí đã có kênh Telegram (`t.me/+_f_Gqw2iy9M3Mjg1`), Firebase có thể trigger bot qua Cloud Functions.

**Cách hoạt động:**
1. Tạo Telegram bot `@SRETCAdminBot` qua BotFather, lưy token vào Cloud Functions secrets.
2. Cloud Function `onUserSignup` / `onPayment` / `onSchedule` → gửi message qua bot.
3. Admin (Trí) start chat với bot → `/approve <userId>` để cấp quyền app, `/broadcast <msg>` để gửi broadcast, `/users` để list user, `/schedules` để xem task scheduled.
4. Inline keyboard cho action nhanh: "Duyệt ✅" / "Từ chối ❌" / "Xem chi tiết".

**Ưu điểm:**
- Không cần build native app.
- Free, đã có sẵn Telegram.
- Notification realtime.
- Có thể gửi file (vd: user upload ảnh trong app → admin xem qua Telegram).

**Nhược điểm:**
- UX giới hạn (không bằng web UI đầy đủ).
- Phụ thuộc uptime Telegram.

### Phương án B — PWA (Progressive Web App) admin

**Cách hoạt động:**
- Tạo subdomain `admin.trishteam.io.vn` (hoặc `sretc.vn/admin`).
- 1 trang web React, login Firebase, hiển thị condensed version của S-RETC Admin.
- Thêm manifest.json + service worker → "Add to Home Screen" trên Android dùng như app native.

**Ưu điểm:**
- Code reuse từ S-RETC Admin frontend (~80%).
- UX đầy đủ như web.
- Free, Vercel free tier đủ.

**Nhược điểm:**
- Cần viết thêm 1 frontend riêng (rút gọn từ admin shell).
- Phải bypass AppAccessPanel check (admin web = full quyền).

### Phương án C — Native Android wrapper (Future)

**Khi nào:** Sau khi S-RETC ổn định v1.x, có thể build Android app bằng Capacitor hoặc Tauri Mobile (chưa chín muồi).

**Ưu điểm:** UX tốt nhất.

**Nhược điểm:** Tốn thời gian, hiện tại Tauri Mobile alpha chưa stable.

### Đề xuất

- **Ngắn hạn (1 tuần):** Phương án A — Telegram bot.
- **Trung hạn (1 tháng):** Phương án B — PWA admin cho ai cũng dùng được, không cần Telegram.
- **Dài hạn (sau launch v1.x):** Xét lại Phương án C.

Chi tiết ở `audit-2026-07-30/ADMIN-MOBILE-DEXUAT.md`.

---

## 7. Roadmap cập nhật (Phase 80-83)

### Phase 80 — Rebrand (1 tuần, P0)

1. Snapshot `git tag sretc-pre-rebrand` (trên Windows, **không từ Cowork**).
2. Logo S-RETC trong suốt → `design/logos/sretc/`.
3. Đổi tên file & folder 4 app desktop → 4 folder mới (hoặc giữ package name `@trishteam/*`, đổi `productName`).
4. Đổi `productName` + `bundle.icon` + `nsis.installerIcon` ở 4 `tauri.conf.json`.
5. Grep `Trish` → `S-RETC` trong user-facing (README, label, page title).
6. `scripts/CLEAN-BUILD-CACHE.bat` rồi smoke test 4 app.

### Phase 81 — Gộp app (3 tuần, P0)

7. Tạo `apps-desktop/sretc/` umbrella entry.
8. Refactor `WorkShell` + `AdminShell` → `SRETCShell` đa-app (sidebar 4 icon, lazy-load).
9. Import module từ 4 app hiện tại + 10 archive (theo bảng §2).
10. **Module Office** — port nguyên từ `_archive/trishoffice/` (13 module + 9 role RBAC + AuthContext + SyncContext + storage.ts + useCompanies.ts). Đây là module lớn nhất, ưu tiên sau Work.
11. Rust `src-tauri/src/lib.rs` đăng ký tất cả commands: `mod clean; mod check; mod drive; mod font; mod shortcut; mod library; mod vietocr; mod office; mod acad_com;`.
12. Viết `scripts/BUILD-PUBLISH-SRETC.ps1` (UTF-8 BOM) build 1 installer duy nhất.
13. Auth flow mới: sign-up/sign-in trong app (không qua web).
14. AppAccessPanel cập nhật `AppId` enum: `sretc-work` / `sretc-utilities` / `sretc-office` / `sretc-admin`.

### Phase 82 — Website rút gọn + Admin mobile (2 tuần, P1)

15. Tạo landing S-RETC (refactor `gemini-code-1785389851237.html`).
16. `/download` 1 card S-RETC-Setup.exe.
17. Xóa toàn bộ 6 bộ database + 4 bộ quiz + 11 công cụ + auth + Cloudinary khỏi web.
18. **Telegram bot admin** (`@SRETCAdminBot`) — Cloud Functions + Firebase trigger.
19. (Tuỳ chọn) PWA admin subdomain.

### Phase 83 — Polish & launch (1 tuần, P2)

20. Splash screen + About dialog + footer "Made by Trí".
21. Cached credentials + auto-login.
22. Test e2e: cài → sign-up → mở 3 app con + Office → admin duyệt qua Telegram.
23. Viết `docs/SRETC-ARCHITECTURE.md`, archive docs cũ.
24. `git tag sretc-v1.0.0`, public announce trên Telegram.

---

## 8. Quyết định cần Trí xác nhận

1. **Phương án kiến trúc:** 1 umbrella `S-RETC.exe` (3 app con + Admin ẩn) hay 3 app tách biệt + 1 launcher? *→ Em khuyến nghị 1 umbrella.*
2. **Tên user-facing app con:** `S-RETC Work` / `S-RETC Utilities` / `S-RETC Office` / `S-RETC Admin`? Hay lowercase phần sau (`S-RETC.work`)?
3. **Package name nội bộ:** giữ `@trishteam/*` hay đổi sang `@sretc/*`?
4. **Logo xóa background:** Trí tự xử lý hay em viết script `rembg`?
5. **Domain:** đổi `trishteam.io.vn` → `sretc.vn`?
6. **Telegram bot admin (Phương án A) có chấp nhận không?** Hay muốn PWA ngay (Phương án B)?
7. **TrishFinance tách riêng:** đúng không? Vẫn để Trí tự maintain, không liên quan S-RETC?
8. **Archive 10 app cũ:** xóa sau Phase 81 hay giữ thêm 1 tháng?

---

## 9. Handoff đã tạo (file này)

- `docs/HANDOFF-SRETC-2026-07-30.md` (file này) — copy vào repo để VS Code mở được.
- `audit-2026-07-30/ROADMAP-S-RETC-v2.md` — roadmap chi tiết (cập nhật lần 2).
- `audit-2026-07-30/ADMIN-MOBILE-DEXUAT.md` — 3 phương án admin Android + mã giả.
- `audit-2026-07-30/PERMISSION-MATRIX-EXTRACT.md` — trích RBAC 9 role × 13 module của Office.
- `audit-2026-07-30/MEMORY.md` + 4 file memory (user / feedback / project / reference).

**Không động đến code trong repo** — em không touch `apps-desktop/`, `website/`, `packages/` trong phiên này. Chờ Trí trả lời 8 câu hỏi trên trước khi bắt đầu Phase 80.

---

## 10. Cảnh báo

1. **Working tree đang bẩn** (~49 file modified + 1 deleted, logo.png). Khi bắt đầu Phase 80, chạy `scripts\START.bat` trên Windows trước.
2. **PowerShell `.ps1` UTF-8 BOM** (rule cũ, áp dụng cho `BUILD-PUBLISH-SRETC.ps1`).
3. **Tauri bundle cache** phải xóa khi đổi icon.
4. **Không chạy git từ Cowork** — mọi git qua Windows.
5. **Phase 81 mất 3 tuần** vì Office là module lớn, có 13 module + 9 role + storage phức tạp.
