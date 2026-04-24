# Packaging & Distribution — TrishTEAM

Kiến trúc đóng gói, bảo mật code/data và phân phối cho hệ sinh thái TrishTEAM.
Viết 2026-04-22, cùng dịp Trí chốt hướng "Platform + Apps" thay cho "mỗi app 1
installer standalone".

## 1. Mô hình tổng — Platform + Apps

Inspiration: Adobe Creative Cloud, JetBrains Toolbox, Steam, Unity Hub, VS Code
+ Extensions. Một **Runtime** duy nhất được cài 1 lần, các **Apps** là gói payload
nhẹ cắm vào runtime đó.

```
┌──────────────────────────────────────────────────────────────┐
│ C:\Program Files\TrishTEAM\                                   │
│ ├─ runtime\                     ← cài 1 lần qua NSIS          │
│ │   ├─ python\                  (Python 3.11 embedded)        │
│ │   ├─ Qt\                      (PyQt6 + Qt shared libs)      │
│ │   └─ core\                    (trishteam_core compiled)     │
│ ├─ TrishTEAM.exe                ← entry launcher + bootstrap  │
│ ├─ apps\                        ← cài theo nhu cầu            │
│ │   ├─ trishfont\               (extract từ trishfont.tpack)  │
│ │   │   ├─ manifest.json                                      │
│ │   │   ├─ code\                (.pyc / .pyd đã compile)      │
│ │   │   ├─ resources\           (icons, images)               │
│ │   │   └─ data\                (optional, lớn: font pack…)   │
│ │   ├─ trishnote\                                             │
│ │   └─ ...                                                    │
│ └─ uninstall.exe                                              │
│                                                                │
│ %APPDATA%\TrishTEAM\            ← user data, không touch khi  │
│ ├─ auth\                         gỡ app                       │
│ ├─ db\trishfont.db                                            │
│ └─ logs\                                                      │
└──────────────────────────────────────────────────────────────┘
```

## 2. TrishTEAM Runtime — installer tầng nền

Tên file: **`TrishTEAM-Setup-1.0.0.exe`** (NSIS compile). Kích thước mục tiêu
~60-80MB compressed.

### 2.1 Nội dung runtime

| Thành phần             | Nguồn                                       | Size   |
|------------------------|---------------------------------------------|--------|
| Python 3.11 embedded   | python-3.11.x-embed-amd64.zip từ python.org | ~15MB  |
| PyQt6 + Qt libs        | PyQt6 wheel extracted, stripped plugins     | ~40MB  |
| `trishteam_core`       | compiled (.pyc / Cython .pyd)                | ~2MB   |
| TrishLauncher app      | compiled payload                            | ~3MB   |
| Third-party libs       | requests, sqlite3 (built-in), fontTools…    | ~5MB   |
| **Total**              |                                             | ~65MB  |

Embedded Python = không interfere với Python system user đã cài, không vào PATH,
tách biệt hoàn toàn.

### 2.2 NSIS installer spec

Script: `build/nsis/trishteam-runtime.nsi`.

Các tác vụ NSIS chạy khi user chạy installer:

1. Yêu cầu admin (runas) — cài vào Program Files.
2. Check version cũ trong registry `HKLM\Software\TrishTEAM\Runtime\Version` →
   nếu >= bản mới thì abort, nếu < thì upgrade (giữ folder `apps\` + user data).
3. Extract runtime vào `$INSTDIR`.
4. Tạo shortcut:
   - Desktop: `TrishTEAM.lnk` → `$INSTDIR\TrishTEAM.exe` (launcher).
   - Start Menu → Programs → TrishTEAM → `TrishTEAM.lnk`.
5. Ghi registry Uninstall:
   ```
   HKLM\Software\Microsoft\Windows\CurrentVersion\Uninstall\TrishTEAM
     DisplayName      = "TrishTEAM"
     DisplayVersion   = "1.0.0"
     Publisher        = "TrishTEAM"
     InstallLocation  = $INSTDIR
     UninstallString  = $INSTDIR\uninstall.exe
     DisplayIcon      = $INSTDIR\TrishTEAM.exe
     NoModify         = 1
     NoRepair         = 1
     EstimatedSize    = 80000
   ```
   → xuất hiện trong **Settings → Apps → Installed apps** của Windows.
6. Register file association `.tpack` → mở bằng TrishTEAM (option, để double-click
   `.tpack` trong File Explorer sẽ prompt cài).

### 2.3 Bootstrap `TrishTEAM.exe`

Executable thật sự là PyInstaller onedir build của TrishLauncher app, với custom
bootstrap:

```python
# apps/trishlauncher/src/trishlauncher/bootstrap.py
import os, sys
from pathlib import Path

# Inject embedded Python + Qt paths
ROOT = Path(sys.executable).parent
sys.path.insert(0, str(ROOT / "runtime" / "core"))
os.environ["PATH"] = f"{ROOT / 'runtime' / 'python'};{ROOT / 'runtime' / 'Qt' / 'bin'};" + os.environ["PATH"]
os.environ["QT_PLUGIN_PATH"] = str(ROOT / "runtime" / "Qt" / "plugins")

# Parse cli: TrishTEAM.exe [launch <app-id>]
if len(sys.argv) >= 3 and sys.argv[1] == "launch":
    from trishteam_core.launcher import launch_app
    launch_app(sys.argv[2])
else:
    from trishlauncher.app import main
    main()
```

Shortcut "TrishFont" trên Desktop trỏ về `TrishTEAM.exe launch trishfont` →
bootstrap sẽ spawn `runtime\python\pythonw.exe -m trishfont` trong process con
với env đúng.

## 3. `.tpack` — format đóng gói app

`.tpack` là ZIP archive (có thể đổi extension thành `.zip` để mở bằng WinRAR
kiểm tra). Content:

```
trishfont.tpack
├─ manifest.json               ← REQUIRED, đọc đầu tiên
├─ code/                       ← Python source hoặc compiled
│  └─ trishfont/
│     ├─ __init__.py           (hoặc .pyc)
│     ├─ app.py
│     ├─ modules/
│     │  ├─ library/*.py
│     │  ├─ install/*.py
│     │  └─ ...
│     └─ _private/             ← Tier 2/3: compiled .pyd / PyArmor
│        └─ formulas.pyd
├─ resources/                  ← không có Python, chỉ asset
│  ├─ logo-64.png
│  ├─ app.ico
│  └─ icons/*.svg
├─ data/                       ← optional, lớn (ví dụ font bundled)
│  └─ fonts/*.ttf
└─ sig.json                    ← optional: chữ ký GPG của manifest (tương lai)
```

### 3.1 `manifest.json` schema

```json
{
  "schema_version": 1,
  "id": "trishfont",
  "name": "TrishFont",
  "version": "1.0.0",
  "tagline": "Quản lý font chuyên nghiệp",
  "entry": "trishfont.app:main",
  "runtime": {
    "python": ">=3.11,<3.12",
    "python_bytecode": "3.11",
    "trishteam_core": ">=0.2.0,<1.0.0"
  },
  "protection_tier": 1,
  "size_bytes": 2400000,
  "file_count": 52,
  "sha256": "abc123...",
  "signatures": {
    "code": "sha256:...",
    "data": "sha256:..."
  },
  "requires": {
    "platform": "windows",
    "admin": false
  },
  "bundled_data_packs": [],
  "provides_shortcuts": [
    { "name": "TrishFont", "icon": "resources/app.ico", "args": "launch trishfont" }
  ],
  "permissions": {
    "fs_write": ["%LOCALAPPDATA%/TrishTEAM/trishfont", "C:\\Windows\\Fonts"],
    "registry": ["HKLM\\Software\\Microsoft\\Windows NT\\CurrentVersion\\Fonts"],
    "network": ["raw.githubusercontent.com", "github.com/releases"]
  }
}
```

Key fields giải thích:

- `entry`: function `module:function` launcher gọi sau khi sys.path được setup.
- `runtime.python_bytecode`: version Python đã compile `.pyc` (auto-set bởi
  build script từ `sys.version_info`). **Phải match với Python version của
  Runtime installed** — Python 3.10 và 3.11 khác magic number, `.pyc` compile
  bởi 3.10 Runtime 3.11 không load được. Launcher verify field này trước khi
  install, abort nếu mismatch.
- `protection_tier`: 1 (public) / 2 (obfuscated) / 3 (encrypted + license). Ảnh
  hưởng cách install + runtime load.
- `bundled_data_packs`: list pack (ví dụ font pack) ship kèm installer để user
  offline vẫn có content. Kèm id + version để tránh duplicate với manifest
  cloud.
- `permissions`: declaration mục đích — Launcher hiển thị trước install (tương
  lai cho phép revoke).

### 3.2 Build script `scripts/build-app-tpack.py`

Input: `--app apps/trishfont`, `--tier 1|2|3`, `--output dist/trishfont-1.0.0.tpack`.

Flow:

1. Đọc `apps/trishfont/pyproject.toml` + custom `tpack.toml` (nếu có) để biết
   metadata.
2. Copy source vào staging folder.
3. Nếu `tier >= 2`: gọi `compile-protected.py` — Cython build các module listed
   trong `tpack.toml [protect]` sang `.pyd`.
4. Nếu `tier == 3`: PyArmor wrap toàn bộ code/.
5. Compile `.py` → `.pyc` cho các file còn lại (che source cơ bản).
6. Zip staging folder → `.tpack`.
7. SHA256 → cập nhật `manifest.json` + print ra stdout (cho CI ghi vào
   `apps.json` registry).

### 3.3 Install flow trong Launcher

```
User bấm "Tải về TrishFont"
  ↓
Launcher.install_worker:
  1. Fetch apps.json → lấy download_url + sha256 expected
  2. Download .tpack → streaming vào %TEMP%\trishfont-1.0.0.tpack
  3. Verify SHA256 — abort nếu fail
  4. Kiểm tra runtime.python + runtime.trishteam_core version match
  5. Nếu Tier 3: prompt Firebase login để lấy license token, verify
  6. Extract vào $TRISHTEAM\apps\trishfont\
  7. Nếu Tier 2/3: install runtime decrypt hook (shared helper)
  8. Đọc provides_shortcuts → tạo Desktop + Start Menu shortcut qua winshell
  9. Ghi installed_apps SQLite (id, version, installed_at, tier, size_bytes)
  10. Emit installed(trishfont, 1.0.0) → HubView refresh
```

## 4. Tiered code/data protection

Không phải app nào cũng cần bảo mật ngang nhau. Dùng bảo vệ mạnh cho tất cả →
build chậm + debug khó + có thể chậm startup. Phân tầng theo giá trị IP:

### 4.1 Tier 1 — Public utilities

**Apps**: TrishFont, TrishLauncher, TrishType, TrishCheck, TrishClean, TrishImage.

**Protection**:
- Source compile sang `.pyc` (default PyInstaller/`py_compile`).
- Không Cython, không PyArmor.
- Assets clear-text.

**Lý do**: logic chủ yếu là UI + wrapper API OS, không phải know-how độc quyền.
User technically có thể decompile `.pyc` ra source gần giống → vẫn chấp nhận
vì build đơn giản, startup nhanh, dễ debug. Giá trị IP thấp.

### 4.2 Tier 2 — Cloud-synced apps

**Apps**: TrishLibrary, TrishNote, TrishSearch.

**Protection**:
- UI layer: `.pyc` như Tier 1.
- Core modules (auth flow, sync engine, schema mapping): **Cython compile sang
  `.pyd`** (native C extension).
- DB encryption at rest: SQLite với SEE/SQLCipher hoặc per-row AES cho field
  nhạy cảm.
- Firestore rules: strict per-user isolation (`owner_uid == request.auth.uid`).

**Lý do**: logic sync + schema là giá trị integration, không muốn competitor
clone lại dễ dàng. Cython `.pyd` yêu cầu reverse-engineer binary ARM/x64 → tăng
rào cản đáng kể.

Spec module cần Cython-protect cho Tier 2:
```toml
# apps/trishlibrary/tpack.toml
[protect]
cython_modules = [
  "trishlibrary.sync.engine",
  "trishlibrary.sync.schema_map",
  "trishlibrary.auth.token_handler",
]
```

### 4.3 Tier 3 — Proprietary IP

**Apps**: TrishDesign (KC formulas, dự toán templates, AutoLisp library),
TrishAdmin (role logic, audit trail).

**Protection**:
- UI layer: `.pyc`.
- Core engine: **Cython `.pyd`** + **PyArmor obfuscation** (license required).
- Templates/formulas: **AES-256-GCM encrypted blob** — key derive từ:
  - User Firebase UID (không copy máy khác chạy được cùng license).
  - Hardware fingerprint (WMI: motherboard serial + CPU ID hash).
  - License nonce từ server mỗi 30 ngày (force re-auth).
- **License check on launch**: Firebase Function callable `verify_license(appId,
  version, hwFingerprint)` → return signed token valid 24h. App refuse start
  nếu token invalid/expired.
- **Anti-debug**: PyArmor `--runtime-anti-debug` flag, check `sys.gettrace()`,
  abort nếu có debugger attach.
- **Stream decrypt**: template decrypt vào memory buffer, không bao giờ write
  plaintext ra disk. Process exit → memory wiped.

**Lý do**: đây là know-how kỹ sư cầu đường của Trí + logic quyền admin hệ
sinh thái. Nếu leak → competitor build clone + user có thể bypass phân quyền.
Bảo mật ngang commercial engineering software (Midas, Revit).

Cấu hình Tier 3:
```toml
# apps/trishdesign/tpack.toml
[protect]
tier = 3
cython_modules = ["trishdesign.kc.*", "trishdesign.duantoan.*"]
pyarmor_obfuscate = true
encrypted_data_dirs = ["templates/", "formulas/"]
require_license = true
license_check_function = "verify_trishdesign_license"
```

### 4.4 Build pipeline tổng

```
source .py
    ↓
[Tier 1 path]   py_compile → .pyc ─┐
[Tier 2 path]   Cython → .pyd    ─┼─→ zip → .tpack
[Tier 3 path]   Cython+PyArmor   ─┘       (encrypt data/)
                    ↓
                 SHA256
                    ↓
            apps.json manifest
                    ↓
        GitHub Release asset
```

CI GitHub Actions (B.7): đơn giản hoá bằng matrix build `{tier: [1,2,3]}` cho
mỗi tag push.

## 5. Runtime decrypt hook

Shared helper trong `trishteam_core` cung cấp:

- `trishteam_core.loader.import_encrypted(path, key_provider)` — load .pyd/.pyc
  từ encrypted blob, decrypt vào memory-only.
- `trishteam_core.license.verify(app_id)` — gọi Firebase Function, cache token.
- `trishteam_core.hwid.fingerprint()` — tính motherboard+CPU fingerprint.

Tier 2/3 apps import 3 helper này trong entry point trước khi load module chính.

## 6. Parallel web + desktop — đồng bộ từ đầu

Để website `trishteam.app` và desktop app không divergent, **share 4 thứ ngay
từ Phase này**:

### 6.1 Firebase schema (single source of truth)

Tất cả collection Firestore có counterpart SQLite table. Chi tiết trong
[`docs/WEB-DESKTOP-PARITY.md`](WEB-DESKTOP-PARITY.md) §4. Sneak peek:

```
Firestore collection      ←→      Desktop SQLite table
users/{uid}                      auth_local (cached)
users/{uid}/library/{docId}      library_items
users/{uid}/notes/{noteId}       notes
users/{uid}/projects/{pid}       trishdesign_projects
apps_installed/{uid}             installed_apps
```

Schema version tăng khi add field — cả 2 nền tảng bump cùng lúc qua migration
scripts.

### 6.2 Design tokens export

`shared/trishteam_core/src/trishteam_core/design/tokens.json` là single source.
Script `scripts/export-tokens.py` xuất 2 target:

- Desktop: `tokens.py` (Python dict dùng trong QSS).
- Web: `tokens.css` (CSS custom properties dùng trong Tailwind theme extend).

Update tokens → chạy 1 script → 2 nơi sync.

### 6.3 Logo assets

Upload `design/logos/` lên repo `trishnexus-launcher-registry`. Cả desktop
(bundle vào `resources/`) lẫn web (reference qua `raw.githubusercontent.com`)
đọc cùng file → 1 bộ logo, đảm bảo branding identical.

### 6.4 Auth Firebase

`shared/trishteam_core/auth/` dùng Firebase Admin SDK (web) hoặc pyrebase
(desktop). Token format + custom claims identical → user login web 1 lần, mở
desktop app không cần login lại (token sync qua Firebase auth persistence hoặc
deep link flow).

### 6.5 Parallel development workflow

Mỗi feature login-required mở **2 track song song**:

| Feature       | Desktop PR              | Web PR                    |
|---------------|-------------------------|---------------------------|
| Library list  | `trishlibrary/modules`  | `website/app/library`     |
| Note editor   | `trishnote/modules`     | `website/app/note`        |
| Search        | `trishsearch/modules`   | `website/app/search`      |

Merge order: Firebase schema + rules PR **trước**, sau đó desktop + web merge
song song cùng Firestore schema. Tránh case desktop ghi field mới mà web chưa
biết đọc.

### 6.6 CI/CD — GitHub Actions pipeline

Từ task #64 trở đi, release `.tpack` và Runtime đều qua **GitHub Actions**.
Workflow sống trong `.github/workflows/` của monorepo này; helper scripts
trong `scripts/ci/`.

**3 workflow chính:**

| File | Trigger | Runner | Output |
|------|---------|--------|--------|
| `build-tpack.yml`        | tag `<app-id>-v<ver>` (vd `trishfont-v1.0.0`) | `ubuntu-latest`  | `.tpack` + `apps-json-entry.json` → GitHub Release |
| `build-runtime.yml`      | tag `runtime-v<ver>` (vd `runtime-v0.1.0`)    | `windows-latest` | `TrishTEAM-Setup-<ver>.exe` → GitHub Release       |
| `update-apps-json.yml`   | `workflow_dispatch` (auto từ `build-tpack.yml`) | `ubuntu-latest` | PR sang `trishnexus-launcher-registry` patch `apps.json` |

**`build-tpack.yml` — flow:**

1. Parse tag `<app-id>-v<ver>` → `APP_ID` + `VERSION`.
2. Verify `apps/<APP_ID>/pyproject.toml` version khớp tag.
3. `pip install cryptography + -e shared/trishteam_core` (editable core để
   script import `trishteam_core.crypto`).
4. `python scripts/build-app-tpack.py <APP_ID>` → `dist/<APP_ID>-<VER>.tpack`.
5. SHA-256 + size → step outputs.
6. `python scripts/ci/emit_apps_json_entry.py` → `dist/apps-json-entry.json`.
7. `softprops/action-gh-release@v2` tạo/patch GitHub Release, upload cả 2
   asset.
8. Job `propagate` dispatch `update-apps-json.yml` với inputs
   `(app_id, version, sha256, size_bytes)`.

**`build-runtime.yml` — flow:**

1. `windows-latest` runner, Python 3.11 (match .pyc bytecode của mọi .tpack).
2. `pip install -r packaging/requirements-build.txt` + editable core +
   launcher.
3. `pyinstaller --clean -y packaging/trishteam.spec` → `dist/TrishTEAM/`.
4. `choco install nsis` → `makensis /DPRODUCT_VERSION=<ver>
   packaging/trishteam-installer.nsi` →
   `packaging/build/TrishTEAM-Setup-<ver>.exe`.
5. SHA-256 + size → GitHub Release attach.

**`update-apps-json.yml` — flow:**

1. Checkout `trishnexus-launcher-registry` bằng `REGISTRY_REPO_TOKEN`
   (Personal Access Token scope `repo`, lưu trong repo secrets).
   *Nếu token chưa set*, workflow chỉ preview diff và không fail —
   admin chạy patch thủ công.
2. Checkout monorepo vào path `monorepo/` để load `scripts/ci/patch_apps_json.py`.
3. `python monorepo/scripts/ci/patch_apps_json.py registry/apps.json` —
   cập nhật version/sha256/size_bytes/url cho entry khớp `app_id`.
   Nếu entry chưa tồn tại, warn-and-skip (admin phải thêm entry template
   trước khi CI tự update được).
4. `peter-evans/create-pull-request@v7` tạo PR branch
   `auto/update-<app-id>-v<ver>` → base `main` để admin review trước khi merge.
   → Launcher fetch registry lần kế tiếp → user thấy app phiên bản mới.

**Secrets cần cấu hình:**

- `GITHUB_TOKEN` — builtin, dùng cho Release assets. Không cần setup.
- `REGISTRY_REPO_TOKEN` — **cần tạo thủ công**. PAT scope `repo` hoặc
  fine-grained token có quyền `contents: write` + `pull-requests: write` trên
  `hosytri07/trishnexus-launcher-registry`. Lưu vào
  `Settings → Secrets and variables → Actions → New repository secret`.

**Helper scripts (`scripts/ci/`):**

- `emit_apps_json_entry.py` — đọc env vars (`APP_ID`, `VERSION`, `SHA256`,
  `SIZE_BYTES`, `REPO`), đọc `apps/<APP_ID>/pyproject.toml` + `tpack.toml`,
  in JSON entry đúng schema apps.json §4 ra stdout.
- `patch_apps_json.py` — in-place patch `apps.json` với version/sha256/
  size_bytes/url mới; soft-skip nếu entry chưa tồn tại.

Cả hai chạy được **local** để test trước khi push tag:

```bash
APP_ID=trishfont VERSION=1.0.0 \
SHA256=<hash> SIZE_BYTES=<bytes> REPO=hosytri07/trishnexus-monorepo \
python scripts/ci/emit_apps_json_entry.py
```

**Release workflow (admin):**

```bash
# 1. Chuẩn bị: bump version trong apps/<app>/pyproject.toml + tpack.toml
# 2. Tag + push
git tag trishfont-v1.0.1
git push origin trishfont-v1.0.1
# 3. Chờ Actions chạy ~3-5 phút → kiểm tra GitHub Release đã có .tpack
# 4. Review PR auto trên trishnexus-launcher-registry → merge
# 5. Launcher user → App Store → Làm mới → thấy phiên bản mới
```

## 7. Distribution & hosting

| Asset                          | Repo                          | Host thật                                |
|--------------------------------|-------------------------------|------------------------------------------|
| `TrishTEAM-Setup-x.y.z.exe`    | `trishnexus-launcher`         | GitHub Release                           |
| `trishfont-x.y.z.tpack`        | `trishnexus-monorepo` (tag)   | GitHub Release asset (trishfont-vx.y.z)  |
| Font pack `.zip`               | `trishnexus-fontpacks`        | GitHub Release (đã có)                   |
| `apps.json` registry           | `trishnexus-launcher-registry`| raw.githubusercontent.com                |
| Logo PNG/ICO                   | `trishnexus-launcher-registry`| raw.githubusercontent.com                |
| Website                        | `trishnexus-website`          | Vercel (custom domain trishteam.app)     |

GitHub Release free unlimited bandwidth cho asset < 2GB/file. Đủ thừa cho mọi
`.tpack`. Nếu GitHub chậm ở VN (có vài ISP routing kém) → fallback jsDelivr:
`https://cdn.jsdelivr.net/gh/<user>/<repo>@<tag>/<path>` tự động mirror.

Google Drive không recommend làm primary vì rate limit + không stable cho
automation, chỉ dùng backup manual.

## 8. Versioning & compatibility matrix

- Runtime bump (Python/Qt major) = force user tải lại installer. Registry check
  blocker `min_runtime_version` trong `manifest.json` của mỗi app.
- `trishteam_core` bump minor = backward-compatible, app không cần rebuild.
- `trishteam_core` bump major = break API widget/schema → tất cả app rebuild
  `.tpack`.
- App bump patch/minor/major = độc lập.

## 9. Lộ trình triển khai (tương ứng task #56-65)

1. **#56** ✅ — Spec này (đang viết).
2. **#57** — `scripts/build-app-tpack.py` + schema manifest.
3. **#58** — Verify TrishFont → `.tpack` size, chạy extract stub.
4. **#59** — TrishTEAM Runtime installer (PyInstaller + embedded Python + NSIS).
5. **#60** — Launcher install worker + shortcut creation + installed_apps DB.
6. **#61** — Code protection pipeline (Cython/PyArmor).
7. **#62** — AES data encryption helper trong `trishteam_core.crypto`.
8. **#63** — NSIS uninstaller đồng bộ Control Panel.
9. **#64** ✅ — GitHub Actions CI build `.tpack` + auto-update apps.json (xem §6.6).
10. **#65** ✅ — `WEB-DESKTOP-PARITY.md` spec chi tiết (xem [`WEB-DESKTOP-PARITY.md`](WEB-DESKTOP-PARITY.md)).

Order đề xuất: 57 → 58 → 60 → 59 → 63 → 61 → 62 → 64 → 65. Lý do: build +
verify `.tpack` trước khi dựng Runtime lớn, vì `.tpack` là đơn vị cơ bản phải
chạy được đã rồi mới có cái để cài qua Launcher. Security tier (61, 62) làm sau
khi nền `.tpack` + Launcher ổn, apply dần cho TrishDesign/Admin khi bắt đầu
Phase 7+.
