# Phase 38 — Summary & Master Index

Wave release v1.0.0 hệ sinh thái TrishTEAM, hoàn tất ngày **10/05/2026**.

## Đã release

| App | Version | Size | Trạng thái |
|---|---|---|---|
| TrishLauncher | 1.0.0 | 4.7 MB | ✅ Hub trung tâm — free, không login |
| TrishCheck | 1.0.0 | 3.3 MB | ✅ System info + benchmark + Tools/Phần mềm tab |
| TrishClean | 1.0.0 | 3.4 MB | ✅ Dọn cache + undo 7 ngày |
| TrishFont | 1.0.0 | 3.7 MB | ✅ Quản lý font tiếng Việt + AutoCAD .shx |
| TrishShortcut | 1.0.0 | 3.3 MB | ✅ Shortcut + workspace + hotkey |
| TrishLibrary | 1.0.0 | 30.2 MB | ✅ Thư viện+Note+Tài liệu+Ảnh + 13 PDF tools |

## Sắp ra mắt (chưa release)

- TrishDrive — Cloud storage qua Telegram
- TrishFinance — POS + nhà trọ + thu chi
- TrishISO — Hồ sơ ISO + bảo trì
- TrishOffice — HRM-light (Phase 38.6)
- TrishDesign — CAD generator (đếm ngược 7/5/2026)

## Thay đổi kiến trúc lớn

### 1. Bỏ key system → Role-based access

Xem **[ROLE-BASED-ACCESS.md](./ROLE-BASED-ACCESS.md)**.

- Xóa hoàn toàn key 16 ký tự + activation flow
- Thay bằng Firebase Auth + role (`trial`/`demo`/`user`/`admin`)
- 4 standalone apps (Check/Font/Clean/Shortcut) bây giờ yêu cầu login (trước đó là free)

### 2. apps-registry.json schema v6

- Bỏ field `requires_key` + `key_type` (deprecated)
- `login_required`: chỉ còn `none` (Launcher) hoặc `user` (10 app khác)
- TrishLauncher reject schema v5 cũ → fallback seed v6

### 3. Auto-update detection

- Rust `read_exe_version()` đọc PE FileVersion qua Win32 `GetFileVersionInfoW`
- Launcher so sánh `installed_version` < `app.version` → button **"⬆ Cập nhật v1.x.x"**
- User click → tải installer mới + ghi đè version cũ

### 4. Auto-publish scripts

- `scripts/bump-version.bat` — sửa version 3 file metadata 1 lệnh
- `scripts/release-app.bat <app> <version> --auto` — full pipeline:
  - Compute SHA256 + size
  - Update apps-registry.json
  - `gh release create` upload .exe
  - `git commit + push`

### 5. Website polish

- Bỏ landing/coming-soon countdown vĩnh viễn (`MAINTENANCE_MODE` mặc định OFF)
- /downloads chỉ hiển thị TrishLauncher (10 app khác cài qua Launcher)
- /huong-dan: 11 app guides với logo PNG + theme sync dark/light
- Header h-16 → h-20, logo sparkles 20→24px
- Sidebar bỏ "có" badge (chỉ giữ "Sắp"/"Đang xây" cho status quan trọng)
- Ambient effects: 5 orbs gradient + animation pulse 6-15s
- Ecosystem widget: 11 logos PNG đồng nhất kích thước trên tile trắng

## Master docs index

### Release & deployment

- **[RELEASE-V1-WORKFLOW.md](./RELEASE-V1-WORKFLOW.md)** ⭐ — Quy trình release v1.x mới (3 lệnh)
- **[ROLE-BASED-ACCESS.md](./ROLE-BASED-ACCESS.md)** — Auth flow + Firestore schema
- **[TROUBLESHOOTING-PHASE38.md](./TROUBLESHOOTING-PHASE38.md)** — Common errors + fixes
- **[../scripts/README.md](../scripts/README.md)** — Script tooling reference

### Existing infra (giữ nguyên Phase 38)

- [HANDOFF-MASTER.md](./HANDOFF-MASTER.md) — Đầu phiên đọc cái này
- [SETUP-HOME-PC.md](./SETUP-HOME-PC.md) — Máy mới cài gì
- [DEPLOY-VERCEL.md](./DEPLOY-VERCEL.md) — Vercel website
- [FIREBASE-SETUP.md](./FIREBASE-SETUP.md) — Firebase project config
- [PACKAGING.md](./PACKAGING.md) — Tauri NSIS bundler
- [DESIGN.md](./DESIGN.md) — Design system tokens

### Deprecated (tham khảo lịch sử)

- [KEY-LICENSE-CONCURRENT-CONTROL.md](./KEY-LICENSE-CONCURRENT-CONTROL.md) — System key cũ, bỏ Phase 38
- [RELEASE-PROCESS.md](./RELEASE-PROCESS.md) — Quy trình thủ công Phase 30, thay bằng RELEASE-V1-WORKFLOW.md

## Phase tiếp theo (post v1.0)

1. **TrishAdmin /admin/users** — UI set role + demo expiry (Phase 38.7)
2. **Email notification** khi role change / demo còn ≤ 7 ngày
3. **TrishDrive v1.0** — Cloud storage qua Telegram Bot
4. **TrishFinance v1.0** — POS + nhà trọ
5. **TrishISO v1.0** — Hồ sơ ISO
6. **TrishOffice v1.0** — HRM-light
7. **TrishDesign v1.0** — CAD generator (deadline 7/5/2026 → đã trễ, planning lại)

## Thống kê wave v1.0

- **6 .exe** đã release lên GitHub
- **40+ logo PNG** chuẩn hóa size 256×256
- **30+ task** hoàn thành trong wave
- **20+ Vercel deploy** trong 1 ngày
- **9 tips category × 29 tips** trong TrishCheck Tools tab
- **5 standalone apps** chuyển từ no-login → AuthApp wrapped
