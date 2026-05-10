# Release Workflow v1.x — TrishTEAM Phase 38+

Quy trình day-to-day để Trí release phiên bản mới của 1 app trong hệ sinh thái.

## TL;DR — 3 lệnh cho v1.0.1

```powershell
cd C:\Users\TRI\Documents\Claude\Projects\TrishTEAM\trishnexus-monorepo

REM 1. Bump version (3 file: package.json + Cargo.toml + tauri.conf.json)
scripts\bump-version.bat trishfont 1.0.1

REM 2. Build production .exe (~5-10 phút)
cd apps-desktop\trishfont
pnpm tauri build
cd ..\..

REM 3. Release: SHA256 + update registry + tag GitHub + push
scripts\release-app.bat trishfont 1.0.1 --auto
```

Sau ~1 phút Vercel deploy → user mở TrishLauncher → bấm "Kiểm tra cập nhật" → thấy nút **"⬆ Cập nhật v1.0.1"** ngay.

---

## Chi tiết từng bước

### Bước 1 — Bump version

`scripts\bump-version.bat <app_id> <new_version>` sửa 3 file metadata:

- `apps-desktop/<app>/package.json` — field `version`
- `apps-desktop/<app>/src-tauri/Cargo.toml` — `[package] version`
- `apps-desktop/<app>/src-tauri/tauri.conf.json` — `version`

Phải đồng bộ 3 file vì:
- `package.json` quyết định npm workspace version
- `Cargo.toml` build Rust binary với version đó
- `tauri.conf.json` tạo NSIS installer .exe có DisplayVersion đúng

### Bước 2 — Build production

```powershell
cd apps-desktop\<app>
pnpm tauri build
```

Output: `src-tauri\target\release\bundle\nsis\<AppName>_<version>_x64-setup.exe`

Lần đầu mỗi máy mất ~10-15 phút (Rust compile từ đầu). Lần sau ~3-5 phút (cached).

**TrishLibrary lâu nhất** vì có Tesseract OCR + tessdata download. Lần đầu ~15-20 phút.

### Bước 3 — Release wave

`scripts\release-app.bat <app_id> <version> --auto` thực hiện:

1. Tìm `.exe` vừa build trong `target/release/bundle/nsis/`
2. Compute SHA256 + size_bytes
3. Update `website/public/apps-registry.json`:
   - `status` → `"released"`
   - `version` → version mới
   - `size_bytes` → kích thước thật
   - `download.windows_x64.url` → URL GitHub Release
   - `download.windows_x64.sha256` → hash
   - `changelog_url` → tag URL
   - `updated_at` → timestamp hiện tại
4. `gh release create <app>-v<version> <exe_path> --title "..." --notes "..."`
5. `git add website/public/apps-registry.json`
6. `git commit -m "registry: <app> v<version> released"`
7. `git push`

Nếu không thêm `--auto` thì script chỉ in ra commands — Trí copy paste chạy thủ công.

---

## App ID hợp lệ

`trishlauncher` `trishcheck` `trishfont` `trishclean` `trishshortcut`
`trishlibrary` `trishdrive` `trishfinance` `trishiso` `trishdesign`
`trishoffice`

---

## Auto-update detection từ Launcher

Mỗi launcher người dùng cài (kể cả version cũ) sẽ:

1. Mỗi lần mở app, tự fetch `https://www.trishteam.io.vn/apps-registry.json`
2. So sánh `app.version` (registry) với PE FileVersion của `.exe` đã cài (Rust đọc qua `GetFileVersionInfoW` Win32 API)
3. Nếu installed_version < registry → button **"Mở"** đổi thành **"⬆ Cập nhật v1.0.x"**
4. User click → tải installer mới + chạy → ghi đè version cũ

**Không cần publish thông báo manual.** Push registry là user nhận update tự động.

---

## Yêu cầu môi trường

| Tool | Version | Cài đặt |
|---|---|---|
| Python | 3.8+ | Có sẵn Windows 10/11 |
| pnpm | 8+ | `npm i -g pnpm` |
| Rust | 1.77+ | https://rustup.rs |
| `gh` CLI | latest | https://cli.github.com — `gh auth login` lần đầu |
| Git | any | Phải set user.name + user.email |

Lần đầu setup máy mới: xem `docs/SETUP-HOME-PC.md`.

---

## Trường hợp cần fix khẩn

### Build fail: TS error

Nếu `pnpm tauri build` fail với TypeScript error:

1. Xem error message → fix code trực tiếp
2. Common: type mismatch giữa Tauri 2.10 vs 2.11 — đảm bảo `package.json` dùng `^2.11.0` cho `@tauri-apps/api` + `@tauri-apps/cli`
3. Fix xong commit lại + chạy lại Bước 2

### Build fail: Rust crate version mismatch

Lỗi `Found version mismatched Tauri packages: tauri (v2.11.0) : @tauri-apps/api (v2.10.1)`:

1. Mở `apps-desktop/<app>/package.json`
2. Đổi `"@tauri-apps/api": "^2.0.0"` → `"^2.11.0"`
3. Đổi `"@tauri-apps/cli": "^2.0.0"` → `"^2.11.0"`
4. `cd ..\..` rồi `pnpm install` để pull npm packages mới
5. Quay lại Bước 2 build lại

### `gh release create` báo "tag already exists"

Tag đã tồn tại — xóa cũ rồi tạo mới:

```powershell
gh release delete <app>-v<version> --yes
git push origin :refs/tags/<app>-v<version>
```

Sau đó chạy lại Bước 3.

### Vercel chưa deploy registry mới

Vercel auto-deploy khi push. Nếu chậm:

1. Kiểm tra Vercel dashboard → deploy mới nhất phải "Ready"
2. Nếu "Building" thì đợi 1-2 phút
3. Nếu "Error" → click vào xem build log, fix lỗi rồi push lại
4. Force redeploy: push commit empty
   ```powershell
   git commit --allow-empty -m "trigger vercel redeploy"
   git push
   ```

---

## Wave release v1.0.0 đã hoàn tất (10/05/2026)

Tham khảo lịch sử:

| App | Version | SHA256 | Size |
|---|---|---|---|
| TrishLauncher | 1.0.0 | `5f878ebf...b76c2b80` | 4.7 MB |
| TrishCheck | 1.0.0 | `b79dff8d...e9023838` | 3.3 MB |
| TrishFont | 1.0.0 | `ee1ac9e5...a7d8eb7d` | 3.7 MB |
| TrishClean | 1.0.0 | `f13fd8a4...46482f62` | 3.4 MB |
| TrishShortcut | 1.0.0 | `58862ee9...97ef41e9` | 3.3 MB |
| TrishLibrary | 1.0.0 | `a7446cf5...7ad62d45` | 30.2 MB |

App `trishdrive` / `trishfinance` / `trishiso` / `trishoffice` / `trishdesign` chưa release — registry mark `coming_soon` / `scheduled`.
