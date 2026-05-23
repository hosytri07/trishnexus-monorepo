# 🧪 Phase 44 — Smoke Test Plan (Trí chạy sau khi pull về)

> **Đọc trước khi test:** Phase 44 gộp 12 app → 4 app + Admin. Code đã commit ngày 2026-05-23.
> Test này KHÔNG yêu cầu build .exe — chỉ test dev mode (`pnpm tauri:dev`).

## ⚙ Pre-flight

```powershell
cd C:\Users\TRI\Documents\Claude\Projects\TrishTEAM\trishnexus-monorepo
git pull origin main

# Install monorepo deps (chỉ 4 app + packages, _archive đã exclude)
pnpm install
```

Nếu `pnpm install` báo lỗi version peerDep React → bình thường, để `pnpm` resolve tự động.

## A. TrishWork (xanh lá)

```powershell
cd apps-desktop\trishwork
pnpm tauri:dev
```

**Expected:**
1. ⏳ Cửa sổ Tauri mở ra với title "TrishWork — Kỹ sư, Thư viện, ISO"
2. Hiện **LoginScreen** (Firebase Auth) — Google + Email/Password
3. Sign in bằng tài khoản admin Trí → hiện **AppShell** với 3 tab top: `Thiết kế / Thư viện / ISO`
4. Logo bên trái: chữ T **xanh lá** trên nền đen
5. Click tab "Thiết kế" → render **DesignModule** (copy từ TrishDesign cũ — sidebar 12 module: Dashboard / Documents / RoadDamage / ATGT / ...)
6. Click tab "Thư viện" → render **LibraryModule** (copy từ TrishLibrary cũ — 5 sub-tab: Thư viện / Ghi chú / Tài liệu / Ảnh / TrishTEAM)
7. Click tab "Hồ sơ ISO" → render **IsoModule** (copy từ TrishISO cũ)

**Nếu fail:**
- "Cannot find module @trishteam/design-system": chạy `pnpm install` lại ở root monorepo
- "AuthGate stuck loading": Firebase config thiếu → check `.env.local` có `VITE_FIREBASE_*`
- "Module not found './modules/engineer/...'": import path từ code copied chưa match cấu trúc mới — em đã rename `__submodules → modules` nên path phải đúng

## B. TrishUtilities (tím)

```powershell
cd apps-desktop\trishutilities
pnpm tauri:dev
```

**Expected:**
1. Cửa sổ "TrishUtilities — Tiện ích hệ thống"
2. Login → màn "Liên hệ admin" (vì chưa có quyền `trishutilities`)
3. AppShell với 5 tab: `Dọn dẹp / Kiểm tra / Cloud / Font / Shortcut`
4. Logo chữ T **tím**
5. Click tab → render module placeholder (logic migrate sau)

## C. TrishAdmin — Cấp quyền user

```powershell
cd apps-desktop\trishadmin
pnpm tauri:dev
```

1. Login admin → vào TrishAdmin shell
2. Sidebar trái → nhóm **"Người dùng"** → click **"🔑 Cấp quyền App (Phase 44)"**
3. Hiện bảng users với 4 cột app (Work / Utilities / Finance / Admin)
4. Tìm 1 user trial test → tick TrishWork → để default 365 ngày → bấm **💾 Lưu**
5. Toast: "✓ Đã lưu cho user@email.com"
6. Mở TrishWork → login bằng user đó → vào shell được (không còn màn "Liên hệ admin")

## D. Regression — TrishFinance + TrishAdmin

- TrishFinance: chưa refactor accent vàng — vẫn UI cũ. Chạy `pnpm tauri:dev` ở `apps-desktop/trishfinance` để verify còn build OK.
- TrishAdmin: ngoài AppAccessPanel mới, tất cả panel cũ phải vẫn chạy bình thường.

## ⚠ Vấn đề đã biết / DEFER

1. **TrishWork backend chỉ có commands của TrishDesign (AutoCAD COM)** — Library Tantivy/OCR + ISO commands cần migrate sau (Wave 44.3.B). Tab Library + ISO có thể fail khi gọi Rust backend cụ thể (search, OCR, ...).
2. **TrishUtilities backend chỉ có commands của TrishDrive (MTProto)** — Clean/Check/Font/Shortcut commands cần migrate sau (Wave 44.4.B).
3. **Sticky window của TrishLibrary** — không scaffold ở trishwork (chỉ 1 main window). Cần thêm sticky.html nếu Trí cần.
4. **Wave 16 pick polyline AutoCAD** — vẫn chưa test. Sau khi TrishWork chạy được, test luôn (Wave 44.8).

## 🐛 Nếu fail nặng

- Frontend không build: `pnpm install` lại, xóa `node_modules` + `pnpm-lock.yaml` rồi `pnpm install`
- Tauri build fail Rust: check Cargo.toml có thiếu deps không — em copy nguyên từ TrishDesign/TrishDrive, có thể thiếu deps của các module khác
- Rollback: 10 app cũ vẫn còn trong `apps-desktop/_archive/` — copy ngược lại nếu cần
