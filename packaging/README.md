# TrishTEAM Runtime — Build Guide

Tài liệu này hướng dẫn build `TrishTEAM-Setup-<version>.exe` từ source repo.
End-user chỉ cần chạy file `.exe` này 1 lần — sau đó Launcher tự tải các app.

---

## 1. Tổng quan

```
┌────────────────────────────────────────────────────────────────┐
│                     End-user flow (1 lần)                       │
├────────────────────────────────────────────────────────────────┤
│  1. Tải TrishTEAM-Setup-0.1.0.exe (~35 MB, GitHub Releases)    │
│  2. Double-click → NSIS wizard → Install to Program Files       │
│  3. Tự mở TrishLauncher → chọn app → click "Cài"                │
│  4. Launcher tải .tpack (~100–500 KB) → install vào apps/       │
│  5. Desktop shortcut ví dụ "TrishFont" → chạy ngay              │
└────────────────────────────────────────────────────────────────┘
```

**Kết quả:** 1 Runtime duy nhất + N app nhẹ = tiết kiệm ~80% dung lượng so với
mỗi app đóng gói thành .exe riêng.

---

## 2. Kiến trúc build

```
source/
  apps/trishlauncher/src/trishlauncher/bootstrap.py   ← entry TrishTEAM.exe
  shared/trishteam_core/                               ← shared runtime
  packaging/
    trishteam.spec               ← PyInstaller onedir config
    version-info.txt             ← Windows PE version resource
    requirements-build.txt       ← build deps (PyInstaller, PyQt6, …)
    trishteam-installer.nsi      ← NSIS wizard script
    README.md                    ← (file này)
                        │
                        ▼
dist/TrishTEAM/         ← PyInstaller output (onedir ~65 MB)
  TrishTEAM.exe
  _internal/
    python311.dll
    PyQt6/ …
                        │
                        ▼
packaging/build/        ← NSIS output
  TrishTEAM-Setup-0.1.0.exe   ← single installer binary ~35 MB (LZMA)
```

---

## 3. Prerequisites

Trên **Windows 10/11 x64** (build phải chạy trên Windows để có PE format):

| Tool        | Version   | Mục đích                           | Nguồn                        |
|-------------|-----------|------------------------------------|------------------------------|
| Python      | **3.11.x EXACT** | Interpreter bundle — phải khớp bytecode `.tpack` | python.org               |
| PyInstaller | ≥ 6.0     | Freeze Python → onedir             | pip                          |
| NSIS        | ≥ 3.09    | Đóng gói wizard installer          | nsis.sourceforge.io          |
| UPX         | ≥ 4.0 (optional) | Nén binaries                 | upx.github.io                |

**Quan trọng — Python version:** Runtime phải dùng EXACT cùng minor version
(3.11) với Python dùng build `.tpack`. Python 3.10 và 3.12 có magic number
bytecode khác nhau, Runtime sẽ reject khi load `.pyc`.

---

## 4. Build step-by-step

### 4.1 Set up build environment

```powershell
# Từ repo root
python -m venv build-env
build-env\Scripts\activate

pip install --upgrade pip
pip install -r packaging\requirements-build.txt
pip install -e shared\trishteam_core
pip install -e apps\trishlauncher
```

### 4.2 Build TrishTEAM.exe (PyInstaller)

```powershell
pyinstaller --clean -y packaging\trishteam.spec
```

Verify output:
```
dist\TrishTEAM\
  TrishTEAM.exe          ~2 MB
  _internal\
    python311.dll        ~5 MB
    PyQt6\               ~40 MB (Qt6 DLLs + plugins)
    ...
```

Smoke test runtime:
```powershell
dist\TrishTEAM\TrishTEAM.exe version
# Output: TrishTEAM Runtime 0.1.0 / Python 3.11.x / Bytecode 3.11
```

### 4.3 Build installer (NSIS)

```powershell
cd packaging
makensis trishteam-installer.nsi
```

Output: `packaging\build\TrishTEAM-Setup-0.1.0.exe` (~35 MB sau LZMA).

### 4.4 Test installer trên máy sạch

Nên test trên VM sạch (Windows 10 Sandbox / Hyper-V):

1. Chạy `TrishTEAM-Setup-0.1.0.exe`
2. Check wizard: Welcome → License → Directory → Install → Finish
3. Verify registry:
   ```
   reg query HKCU\Software\TrishTEAM\Runtime /v InstallLocation
   ```
4. Verify Control Panel: Settings → Apps → "TrishTEAM Runtime" có mặt
5. Chạy Launcher, cài TrishFont — verify tạo shortcut + chạy được

### 4.5 Uninstall flow (task #63)

Control Panel → Apps & Features hiển thị nhiều entry TrishTEAM:

- **TrishTEAM Runtime** — gỡ Runtime chính
- **TrishFont** — gỡ riêng app TrishFont
- **TrishLauncher** — gỡ riêng app TrishLauncher
- … (mỗi app cài xong Launcher ghi 1 entry)

**Gỡ 1 app đơn lẻ:** Click Uninstall → Windows chạy `TrishTEAM.exe uninstall <app_id>`
→ bootstrap gọi `worker.uninstall_app()` → xoá shortcut + folder + DB row + Control Panel entry.

**Gỡ Runtime:** Click Uninstall trên entry "TrishTEAM Runtime" → mở NSIS wizard:

1. **Welcome / Confirm** — standard MUI2 pages
2. **Custom options page** (task #63) — 2 checkbox:
   - ☐ Gỡ tất cả app đã cài (TrishFont, TrishLauncher, …)
   - ☐ Xoá cả user data trong `%APPDATA%\TrishTEAM`
3. **Install** page thực thi:
   - Nếu tick ô 1: iterate `$INSTDIR\apps\*`, gọi `TrishTEAM.exe uninstall <id> --quiet` cho từng folder, rồi `RMDir /r $INSTDIR\apps`
   - Xoá `_internal/`, `TrishTEAM.exe`, `uninstall.exe`
   - Xoá Desktop + Start Menu shortcuts
   - Xoá registry `Software\TrishTEAM\Runtime` + `Uninstall\TrishTEAM`
   - Nếu tick ô 2: `RMDir /r $APPDATA\TrishTEAM` + `$LOCALAPPDATA\TrishLauncher`

**Default behaviour (cả 2 ô unchecked):** Gỡ Runtime, giữ apps + user data —
khi user cài lại Runtime, các app vẫn chạy ngay mà không mất settings.

**Verify sau khi gỡ:**

| Checkbox state                      | `$INSTDIR`          | `%APPDATA%\TrishTEAM` | Apps & Features      |
|-------------------------------------|---------------------|------------------------|----------------------|
| Cả 2 unchecked (default)            | Chỉ còn `apps/`     | Giữ nguyên             | Chỉ còn per-app entry |
| "Gỡ app" checked, user data unchecked| Xoá sạch           | Giữ nguyên             | Trống                |
| Cả 2 checked                        | Xoá sạch            | Xoá sạch               | Trống                |

---

## 5. Ký số (code signing) — production

Cho bản release chính thức, cần ký exe để Windows SmartScreen không block:

```powershell
# Ký bằng signtool.exe (Windows SDK)
signtool sign /fd SHA256 /a /tr http://timestamp.digicert.com /td SHA256 `
    dist\TrishTEAM\TrishTEAM.exe

# Ký luôn installer sau khi NSIS compile
signtool sign /fd SHA256 /a /tr http://timestamp.digicert.com /td SHA256 `
    packaging\build\TrishTEAM-Setup-0.1.0.exe
```

Cần: EV Code Signing Certificate (DigiCert / Sectigo). Bản v1 có thể tạm skip,
user sẽ thấy SmartScreen warning "Run anyway".

---

## 6. CI build (task #64)

Sẽ wire GitHub Actions trong `.github/workflows/build-runtime.yml`:

```yaml
on: push: tags: ['runtime-v*']
jobs:
  build:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: {python-version: '3.11.x'}
      - run: pip install -r packaging/requirements-build.txt
      - run: pyinstaller --clean -y packaging/trishteam.spec
      - run: makensis packaging/trishteam-installer.nsi
      - uses: softprops/action-gh-release@v2
        with: {files: 'packaging/build/TrishTEAM-Setup-*.exe'}
```

---

## 7. Troubleshooting

| Lỗi                                              | Nguyên nhân                                   | Fix                                              |
|--------------------------------------------------|-----------------------------------------------|--------------------------------------------------|
| `app.tpack compile bởi Python 3.10`              | Build tpack với Python khác Runtime            | Rebuild tpack bằng Python 3.11                   |
| `ModuleNotFoundError: trishteam_core`            | Hidden import miss trong spec                  | Thêm vào `hiddenimports=[...]`                   |
| NSIS: `!include "..\LICENSE" error`              | Repo chưa có file LICENSE                      | Tạo LICENSE hoặc comment dòng PAGE_LICENSE       |
| SmartScreen "Unknown publisher"                  | Exe chưa ký                                    | Ký với EV Code Signing Cert                      |
| Installer fail "Directory already exists"        | Upgrade trên version cũ                        | Uninstall bản cũ trước, hoặc thêm upgrade logic  |

---

## 8. Release checklist

Trước khi push tag `runtime-v0.X.Y`:

- [ ] Bump version trong `bootstrap.py`, `version-info.txt`, `trishteam-installer.nsi`
- [ ] Update CHANGELOG.md
- [ ] Run smoke test cục bộ: `dist\TrishTEAM\TrishTEAM.exe version`
- [ ] Run installer trên VM sạch
- [ ] Verify uninstall flow giữ lại `apps/` + `%APPDATA%`
- [ ] Ký exe (production)
- [ ] Push tag → CI auto-build + attach to GitHub Release
