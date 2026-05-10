# Scripts — TrishTEAM Release Wave Tooling

Bộ script tự động hóa quy trình release cho 11 app desktop trong ecosystem.

## Quy trình release 1 app (vd nâng TrishFont 1.0.0 → 1.0.1)

### Cách nhanh nhất — 3 bước:

```cmd
REM 1. Bump version trong 3 file (package.json + Cargo.toml + tauri.conf.json)
scripts\bump-version.bat trishfont 1.0.1

REM 2. Build production .exe (~5-10 phút)
cd apps-desktop\trishfont
pnpm tauri build
cd ..\..

REM 3. Release: SHA256 + update registry + tag GitHub + git push
scripts\release-app.bat trishfont 1.0.1 --auto
```

Sau bước 3:
- `apps-registry.json` đã update với SHA256 + size_bytes thật
- GitHub Release `trishfont-v1.0.1` đã tạo + .exe upload
- Git commit + push xong → Vercel deploy ~1 phút
- User mở TrishLauncher → bấm "Kiểm tra cập nhật" → thấy nút **"⬆ Cập nhật v1.0.1"**

### Cách an toàn — manual confirm từng bước:

```cmd
REM 3a. Compute SHA256 + update registry, in ra commands
scripts\release-app.bat trishfont 1.0.1

REM 3b. Trí copy paste 2 lệnh in ra (gh release create + git push) nếu OK
```

## App IDs hỗ trợ

`trishlauncher` `trishcheck` `trishfont` `trishclean` `trishshortcut`
`trishlibrary` `trishdrive` `trishfinance` `trishiso` `trishdesign`
`trishoffice`

## Yêu cầu môi trường

| Tool | Version | Cách cài |
|---|---|---|
| Python | 3.8+ | `py --version` (Windows có sẵn 3.x) |
| Node + pnpm | pnpm 8+ | `npm i -g pnpm` |
| Rust | 1.77+ | https://rustup.rs |
| `gh` CLI | latest | https://cli.github.com (yêu cầu cho `--auto`) |
| Git | any | đã có sẵn nếu Trí đã clone repo |

Lần đầu setup `gh`:
```cmd
gh auth login
```

## File trong scripts/

| File | Tác dụng |
|---|---|
| `bump-version.bat` / `.py` | Sửa version trong 3 file metadata trước khi build |
| `release-app.bat` / `publish-app.py` | SHA256 + update registry + tag GitHub Release |
| `fetch-tessdata.ps1` | Download Tesseract tessdata cho TrishLibrary build |

## Auto-update logic của Launcher

1. Launcher fetch `https://www.trishteam.io.vn/apps-registry.json`
2. Đọc `app.version` mỗi app (vd `1.0.1`)
3. Detect installed: Rust đọc PE FileVersion từ `.exe` đã cài
4. So sánh: nếu `installed_version < app.version` → button đổi từ **"Mở"** → **"⬆ Cập nhật v1.0.1"**
5. User click "Cập nhật" → tải installer mới + chạy → ghi đè version cũ

Vì vậy chỉ cần Trí push registry mới (qua `release-app.bat --auto`) là Launcher của tất cả user sẽ tự thấy có update sau lần "Kiểm tra cập nhật" tiếp theo (hoặc theo schedule auto-refresh trong Settings).

## Troubleshooting

**`gh: command not found`** → cài GitHub CLI từ https://cli.github.com

**`gh release create` fail with "tag already exists"** → tag đã có, xóa cũ:
```cmd
gh release delete trishfont-v1.0.1 --yes
git push origin :refs/tags/trishfont-v1.0.1
```

**`pnpm tauri build` fail "Found version mismatched Tauri packages"** → npm package + Rust crate version lệch. Fix bằng cách update `apps-desktop/<app>/package.json`:
```json
"@tauri-apps/api": "^2.11.0",
"@tauri-apps/cli": "^2.11.0"
```

**Vercel chưa deploy registry mới** → check Vercel dashboard, hoặc force redeploy bằng cách đẩy commit empty:
```cmd
git commit --allow-empty -m "trigger vercel redeploy"
git push
```
