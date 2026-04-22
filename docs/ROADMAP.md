# TrishNexus — Roadmap

Phiên bản tổng cho cả monorepo. Cập nhật lần cuối: 2026-04-22.

> **Quan trọng** — Kiến trúc đóng gói & bảo mật: xem [`PACKAGING.md`](PACKAGING.md).
> Đồng bộ web + desktop: xem [`WEB-DESKTOP-PARITY.md`](WEB-DESKTOP-PARITY.md)
> (Phase B.8). Mô hình chốt: **Platform (Runtime) + Apps (.tpack)** — 1 lần cài
> runtime Python/Qt, các app là gói payload nhẹ ~2-5MB cắm vào. Tier 1/2/3
> protection tuỳ giá trị IP (Font = tier 1, Library/Note/Search = tier 2,
> Design/Admin = tier 3 — Cython + PyArmor + AES + license).

## Hệ sinh thái TrishTEAM — 11 app + 1 umbrella

Scope chốt (2026-04-22): **11 app chức năng + 1 logo umbrella TrishTEAM**.
Toàn bộ logo đã có (bg transparent, multi-size PNG, `.ico` Windows). Tất cả
logo phải được áp dụng đồng bộ cho **website** và **desktop app**.

### Bảng app chính thức

| #  | App           | Tagline                                                    | Login     | Hiển thị Launcher | Scaffold | Logo |
| -- | ------------- | ---------------------------------------------------------- | --------- | ----------------- | -------- | ---- |
| ★  | **TrishTEAM** | Logo umbrella — toàn hệ sinh thái                          | —         | umbrella only     | —        | ✅   |
| 1  | TrishFont     | Quản lý, xem trước và cài đặt font chuyên nghiệp           | không     | ✅                | ✅       | ✅   |
| 2  | TrishLauncher | Launcher giới thiệu + tải các app (trừ TrishAdmin)         | không     | self              | ✅       | ✅   |
| 3  | TrishDesign   | Khảo sát & Thiết kế — toolkit engineer                     | bắt buộc  | ✅                | ✅       | ✅   |
| 4  | TrishLibrary  | Thư viện PDF/docx/link — local + cloud sync                | bắt buộc  | ✅                | ✅       | ✅   |
| 5  | TrishNote     | Ghi chú dự án / deadline / cá nhân / học tập               | bắt buộc  | ✅                | ✅       | ✅   |
| 6  | TrishAdmin    | Administrator toàn bộ hệ sinh thái                         | bắt buộc  | ❌ (ẩn)           | ✅       | ✅   |
| 7  | TrishType     | Trình soạn thảo mọi định dạng + PDF tools                  | không     | ✅                | ✅       | ✅   |
| 8  | TrishCheck    | Kiểm tra cấu hình máy so với yêu cầu phần mềm              | không     | ✅                | ⏳       | ✅   |
| 9  | TrishSearch   | Tìm kiếm thông tin / file / note — local + cloud           | bắt buộc  | ✅                | ⏳       | ✅   |
| 10 | TrishClean    | Dọn file rác, `.bak`, junk, temp                           | không     | ✅                | ⏳       | ✅   |
| 11 | TrishImage    | Quản lý thư viện ảnh — local + cloud                       | không     | ✅                | ⏳       | ✅   |

> **TrishAdmin ẩn khỏi Launcher** — chỉ Admin và Dev có thể cài + truy cập
> (gated bằng role check trong Auth service, không expose trong registry
> public `apps.json`).

### Ma trận Auth (chi tiết trong `docs/AUTH.md` — Phase 10)

| App           | Public | Login user | Login admin | Login dev |
| ------------- | ------ | ---------- | ----------- | --------- |
| TrishFont     | ✅     | opt        | —           | —         |
| TrishLauncher | ✅     | opt        | —           | —         |
| TrishType     | ✅     | opt        | —           | —         |
| TrishCheck    | ✅     | opt        | —           | —         |
| TrishClean    | ✅     | opt        | —           | —         |
| TrishImage    | ✅     | opt        | —           | —         |
| TrishDesign   | ❌     | ✅         | —           | —         |
| TrishLibrary  | ❌     | ✅         | —           | —         |
| TrishNote     | ❌     | ✅         | —           | —         |
| TrishSearch   | ❌     | ✅         | —           | —         |
| TrishAdmin    | ❌     | ❌         | ✅          | ✅        |

- **Public**: chạy được không cần tài khoản.
- **Login user**: cần Firebase Auth để dùng sync cloud / share / save lên
  server.
- **Login admin/dev**: role trong custom claims của Firebase token.

### Share design token giữa Website và Desktop

| Asset                              | Nguồn gốc                    | Dùng ở                                                 |
| ---------------------------------- | ---------------------------- | ------------------------------------------------------ |
| `design/logos/<App>/icon-256.png`  | monorepo `design/logos/`     | Desktop (AppHeader + taskbar), Website (grid hero)     |
| `design/logos/<App>/app.ico`       | monorepo                     | Desktop window icon + PyInstaller build                |
| `docs/launcher-registry/apps.json` | monorepo                     | Launcher (desktop) + Website (trang Downloads)         |
| `design/tokens.py` / `tokens.json` | `shared/trishteam_core/`     | Desktop QSS + Website CSS variables (export)           |

Website đọc logo trực tiếp từ raw GitHub của repo `trishnexus-launcher-registry`
để không cần copy duplicate.

### Mục lục

- [Phase 0 — Done](#phase-0--done)
- [Phase 1 — UI/UX core](#phase-1--uiux-core)
- [Phase 2 — Folder-aware library + AutoCAD .shx](#phase-2--folder-aware-library--autocad-shx)
- [Phase 3 — Install worker thật](#phase-3--install-worker-thật)
- [Phase 4 — Scan performance](#phase-4--scan-performance)
- [Phase 5 — Font-pack sync (GitHub-driven)](#phase-5--font-pack-sync-github-driven)
- [Phase 6 — TrishLauncher](#phase-6--trishlauncher)
- [Phase 7 — TrishDesign (engineer toolkit)](#phase-7--trishdesign)
- [Phase 8 — Logo / branding integration](#phase-8--logo--branding-integration)
- [Phase 9 — Scaffold 4 app mới (Check / Search / Clean / Image)](#phase-9--scaffold-4-app-mới)
- [Phase 10 — Auth hệ sinh thái (Firebase SSO)](#phase-10--auth-hệ-sinh-thái)
- [Phase 11 — Website TrishTEAM](#phase-11--website-trishteam)
- [Phase 12 — AI augmentation (semantic retrieval VN)](#phase-12--ai-augmentation-semantic-retrieval-vn)
- [Mô tả chi tiết 11 app](#mô-tả-chi-tiết-11-app)
- [External AI / ML resources](#external-ai--ml-resources)

---

## Phase 0 — Done

- Monorepo scaffold (`apps/`, `shared/`, `docs/`, `design/`).
- `trishteam_core`: store (SQLite + migrate), ui (BaseWindow, theme, tokens), 11 widget cơ bản.
- TrishFont v1.0.0 chạy được: AppHeader / Sidebar / FooterBar / 4 tab.

## Phase 1 — UI/UX core

- Warm-dark palette (#0f0e0c / #1a1814 / #f5f2ed / #a09890) — match 2 reference Python.
- CardGroup color-stripe (primary / amber / green / cyan).
- ActionBar với CTA gradient + bulk select.
- LogPanel HTML colored (success/warn/error/info), compact.
- EmptyState tone warm, hiển thị inline trong scroll area.

## Phase 2 — Folder-aware library + AutoCAD .shx

Mục tiêu: Tôn trọng cấu trúc folder của user. User đã phân loại sẵn theo loại
font / kiểu gõ (Unicode / VNI / TCVN3 / .shx AutoCAD…) thì app phải hiển thị
group theo đúng cấu trúc đó, không ép vào 4 nhóm hardcoded.

### Schema thay đổi

Migration 003: bổ sung cột vào bảng `fonts`.

```sql
ALTER TABLE fonts ADD COLUMN folder_group TEXT NOT NULL DEFAULT '';
ALTER TABLE fonts ADD COLUMN file_path    TEXT NOT NULL DEFAULT '';
ALTER TABLE fonts ADD COLUMN font_kind    TEXT NOT NULL DEFAULT 'windows';
                                                         -- 'windows' | 'autocad'
CREATE INDEX IF NOT EXISTS idx_fonts_folder ON fonts(folder_group);
CREATE INDEX IF NOT EXISTS idx_fonts_kind   ON fonts(font_kind);
```

`folder_group` = tên folder cha trực tiếp chứa file font, **relative tới root
scan**. Ví dụ root = `G:\4. Code\TrishNexus-New\FontLibrary` thì:

```
FontLibrary/
├─ Sans Serif/
│   ├─ Inter-Regular.ttf        → folder_group="Sans Serif"
│   └─ Roboto-Regular.ttf       → folder_group="Sans Serif"
├─ Serif/
│   └─ Merriweather-Regular.ttf → folder_group="Serif"
├─ VNI/
│   └─ VNI-Times.ttf            → folder_group="VNI"
├─ TCVN3/
│   └─ .VnTime.ttf              → folder_group="TCVN3"
└─ AutoCAD/
    ├─ romans.shx               → folder_group="AutoCAD", font_kind="autocad"
    └─ vnsimplex.shx            → folder_group="AutoCAD", font_kind="autocad"
```

Nếu file nằm thẳng tại root → `folder_group="(Root)"`.

### Scanner thay đổi

`FontRepository.scan_folder(root)`:

1. `root.rglob("*")` lọc theo `FONT_EXTENSIONS = {".ttf", ".otf", ".ttc", ".otc", ".shx"}`.
2. Với mỗi file:
   - `font_kind = "autocad" if suffix == ".shx" else "windows"`.
   - `folder_group = file.parent.relative_to(root).parts[0]` (top-level folder).
     Nếu file nằm sâu hơn (ví dụ `Sans Serif/Inter/Inter-Regular.ttf`) → vẫn
     gán `"Sans Serif"`. Nếu nằm thẳng root → `"(Root)"`.
   - `font_kind == "windows"`: load metadata → upsert family + path.
   - `font_kind == "autocad"`: chỉ upsert path + tên file (không load Qt vì .shx
     không phải vector font theo chuẩn OpenType).
3. Bulk insert 1 transaction.

### View thay đổi

`LibraryView._reload_groups()`:

- Đọc `SELECT DISTINCT folder_group FROM fonts ORDER BY folder_group`.
- Tạo CardGroup động — mỗi `folder_group` 1 group.
- Stripe color: round-robin từ palette `[primary, amber, green, cyan, blue,
  pink]` để không bao giờ thiếu màu khi user có nhiều folder.
- Icon: heuristic — chứa "AutoCAD" / "shx" → 🛠, "VNI" / "TCVN" → 🇻🇳, "Sans" →
  🔤, "Serif" → 📖, "Mono" / "Code" → ⌨, "Display" / "Script" → 🎨, mặc định 📁.

### Status

- [x] Roadmap viết.
- [ ] Migration 003 + repository update.
- [ ] View dynamic groups.
- [ ] Smoke test với folder thật của user.

## Phase 3 — Install worker thật

`apps/trishfont/src/trishfont/modules/install/worker.py` — `QThread` async để
không block UI khi cài hàng nghìn font.

### Windows fonts (.ttf / .otf / .ttc)

1. Source path từ `fonts.file_path`.
2. Dest: `Path(os.environ["LOCALAPPDATA"]) / "Microsoft/Windows/Fonts"`
   (per-user, không cần admin) — fallback sang `C:\Windows\Fonts` nếu user
   chọn "Cài cho mọi user" (cần admin).
3. Copy file (skip nếu đã tồn tại + cùng size+mtime).
4. Đăng ký registry:
   - Per-user: `HKEY_CURRENT_USER\Software\Microsoft\Windows NT\CurrentVersion\Fonts`.
   - All-user: `HKEY_LOCAL_MACHINE\Software\Microsoft\Windows NT\CurrentVersion\Fonts`.
   - Value name: `"<Family Name> (TrueType)"`, value data: full path.
5. Broadcast `WM_FONTCHANGE` (`HWND_BROADCAST = 0xffff`) để app đang mở thấy
   font mới mà không cần restart Windows.

### AutoCAD .shx

1. Auto-detect AutoCAD install:
   - Scan `HKEY_LOCAL_MACHINE\SOFTWARE\Autodesk\AutoCAD\<Rxx.x>\<lang>\AcadLocation`.
   - Fallback: tìm `C:\Program Files\Autodesk\AutoCAD <year>\Fonts`.
   - Multiple version: list cho user chọn (combo box trong dialog) hoặc cài cho
     tất cả version detect được.
2. Copy đè `.shx` vào folder `Fonts` của AutoCAD.
3. Không có registry, không có broadcast — AutoCAD đọc folder mỗi lần startup.

### Progress + log

- `worker.progressChanged(done, total)` → `LogPanel.set_progress(...)`.
- Mỗi file: emit `installed(file, ok, msg)` → log success/error tương ứng.
- Fail-soft: lỗi 1 file không huỷ toàn batch.

## Phase 4 — Scan performance

Vấn đề: `QFontDatabase.addApplicationFont(path)` rất chậm — mỗi file ~5-30ms,
1000 file = 5-30 giây. Block UI thread.

### Giải pháp

1. **Đọc metadata bằng `fontTools`** (pure-Python, không cần Qt):
   ```python
   from fontTools.ttLib import TTFont
   ft = TTFont(path, lazy=True, fontNumber=0)
   name_record = ft["name"].getBestFamilyName()
   ```
   - Nhanh hơn 10x vì không decode glyph.
   - Không phụ thuộc QFontDatabase → có thể chạy trong worker thread.

2. **`QFontDatabase.addApplicationFont` chỉ khi cần**:
   - Vào tab Preview → load các font hiển thị trên màn hình (lazy).
   - Library list không cần Qt-load — chỉ cần family name.

3. **QThread scanner** → progress bar realtime trong LogPanel.

4. **Cache dựa trên size+mtime** — file không đổi thì skip metadata read.

### Status: deferred to Phase 4 (sau khi Phase 2-3 ổn).

## Phase 5 — Font-pack sync (GitHub-driven)

Mục tiêu: User gom font sẵn → push lên GitHub repo → user TrishFont bấm "Cập
nhật" → app tự pull về.

### Repo layout

```
trishnexus-fontpacks/                  (repo riêng, public hoặc private)
├─ manifest.json                       (file metadata top-level)
├─ packs/
│   ├─ vietnamese-essentials/
│   │   ├─ pack.json                   (manifest pack-level)
│   │   ├─ Inter-Regular.ttf
│   │   └─ Roboto-Regular.ttf
│   ├─ autocad-classic/
│   │   ├─ pack.json
│   │   ├─ romans.shx
│   │   └─ vnsimplex.shx
│   └─ display-decorative/
│       ├─ pack.json
│       └─ ...
└─ README.md
```

### `manifest.json` format

```json
{
  "schema_version": 1,
  "updated_at": "2026-04-22T10:00:00Z",
  "packs": [
    {
      "id": "vietnamese-essentials",
      "name": "Tiếng Việt — Cơ bản",
      "version": "1.2.0",
      "description": "10 font Sans/Serif hỗ trợ tốt Tiếng Việt.",
      "size_bytes": 2400000,
      "file_count": 10,
      "kind": "windows",
      "tags": ["vietnamese", "sans-serif", "essential"],
      "download_url": "https://github.com/<user>/trishnexus-fontpacks/releases/download/v1.2.0/vietnamese-essentials.zip",
      "sha256": "abc123...",
      "preview_image": "https://raw.githubusercontent.com/<user>/trishnexus-fontpacks/main/packs/vietnamese-essentials/preview.png"
    }
  ]
}
```

### Workflow user

1. App định kỳ (hoặc bấm Update) fetch
   `https://raw.githubusercontent.com/<user>/trishnexus-fontpacks/main/manifest.json`.
2. So sánh `version` từng pack với DB local (`installed_packs` table).
3. Hiển thị danh sách pack có update + pack mới.
4. User tick → download .zip từ `download_url`.
5. Verify SHA256.
6. Extract vào `%APPDATA%\TrishFont\packs\<pack-id>\`.
7. Trigger rescan → tự xuất hiện ở tab Library.

### Workflow Trí (publisher)

1. Thêm font vào `packs/<pack-id>/`.
2. Update `pack.json` (bump version).
3. Chạy script `scripts/build-fontpack.py` → tạo .zip + SHA256 + cập nhật
   `manifest.json` top-level.
4. `git push` → tạo GitHub Release với tag `v<version>` + upload .zip làm
   release asset.
5. Done — user app sẽ thấy update next refresh.

### Status: ✅ **Implemented** — `apps/trishfont/src/trishfont/modules/fontpack/`

Module `fontpack` gồm 6 file:

| File              | Nội dung                                                              |
|-------------------|-----------------------------------------------------------------------|
| `models.py`       | `FontPack` dataclass, `PackStatus` enum, `MIGRATION_004_FONTPACKS`.   |
| `fetcher.py`      | `fetch_manifest()` + `parse_manifest()` — pull + parse manifest.json. |
| `repository.py`   | `FontPackRepository` — cache manifest + track installed_packs trong SQLite. |
| `downloader.py`   | `PackDownloadWorker` (QThread) — stream download → SHA256 → zip-slip safe extract. |
| `view.py`         | `PackView` — tab "Cập nhật" UI: scroll list `PackCard` + LogPanel.    |
| `__init__.py`     | Module exports.                                                       |

Wired vào `app.py`:
- Thêm migration 4 (`MIGRATION_004_FONTPACKS`).
- Thêm tab "Cập nhật" (icon 🔄) vào sidebar + FooterBar quick nav.
- `UpdateDialog.downloadDataRequested` → chuyển thẳng sang tab Cập nhật.
- Sau khi extract pack OK → callback `_on_pack_installed` rescan library tự động.

Smoke test đã chạy OK (`scripts-internal/fontpack_smoke.py`): parse stub manifest,
status transitions, zip-slip blocked cho cả `../evil.txt` và `/tmp/evil_abs.txt`,
SHA256 verify case-insensitive + empty-skip.

## Phase 6 — TrishLauncher

App thứ 7 — hub launcher cho cả 6 app TrishNexus.

### UI

Layout 3 cột:

```
┌──────────────┬─────────────────────────────────────────┬──────────────┐
│ Sidebar       │ Main: app selected                       │ Optional     │
│ - Tất cả     │  ┌──────────────────────────────────┐   │ panel        │
│ - Đã cài     │  │ ✨ TrishFont                v1.0 │   │ (changelog   │
│ - Có update  │  │ Quản lý font chuyên nghiệp        │   │  full text)  │
│              │  │ ┌────────────────────────────┐   │   │              │
│              │  │ │ [screenshot 16:9]           │   │   │              │
│              │  │ └────────────────────────────┘   │   │              │
│              │  │ Changelog v1.0:                   │   │              │
│              │  │ + 4 tab Library/Preview/...        │   │              │
│              │  │ + Folder-aware grouping            │   │              │
│              │  │                                    │   │              │
│              │  │ [⬇ Tải về]  [🔄 Cập nhật]        │   │              │
│              │  └──────────────────────────────────┘   │              │
└──────────────┴─────────────────────────────────────────┴──────────────┘
```

### Apps registry

```
trishnexus-launcher-registry/          (repo riêng, public)
└─ apps.json
```

`apps.json` (thật — xem `docs/launcher-registry/apps.json`):

```json
{
  "schema_version": 1,
  "ecosystem": {
    "name": "TrishTEAM",
    "tagline": "Hệ sinh thái ứng dụng cá nhân",
    "logo_url": "https://raw.githubusercontent.com/<user>/trishnexus-launcher-registry/main/logos/TrishTEAM/icon-256.png"
  },
  "apps": [
    {
      "id": "trishfont",
      "name": "TrishFont",
      "tagline": "Quản lý, xem trước và cài đặt font chuyên nghiệp",
      "logo_url": "https://raw.githubusercontent.com/<user>/trishnexus-launcher-registry/main/logos/TrishFont/icon-256.png",
      "version": "1.0.0",
      "status": "released",
      "download": {
        "windows_x64": {
          "url": "https://github.com/<user>/trishnexus/releases/download/trishfont-v1.0.0/TrishFont-Setup-1.0.0.exe",
          "sha256": "...",
          "installer_args": ["/S"]
        }
      }
    },
    { "id": "trishlauncher", "status": "released", ... },
    { "id": "trishdesign",   "status": "coming_soon", ... },
    { "id": "trishlibrary",  "status": "coming_soon", ... },
    { "id": "trishnote",     "status": "coming_soon", ... },
    { "id": "trishadmin",    "status": "coming_soon", ... },
    { "id": "trishtype",     "status": "coming_soon", ... }
  ]
}
```

Thay `logo_emoji` cũ bằng `logo_url` trỏ đến PNG transparent 256×256 trong
`design/logos/<AppName>/icon-256.png` (upload lên repo registry).

### Auto-install workflow

1. Bấm "Tải về" → download .exe vào `%LOCALAPPDATA%\TrishLauncher\downloads\`.
2. Verify SHA256.
3. Spawn process: `subprocess.Popen([exe_path, *installer_args])` — `/S` cho
   silent install (NSIS), `/quiet` cho MSI, etc.
4. Track install: poll dest exe path tồn tại + version match.
5. Cập nhật `installed_apps` table (sqlite local).
6. Hiển thị nút thành "✓ Đã cài" + show "Mở" + "Gỡ".

### Tech stack

- PyQt6 (đồng bộ với 6 app khác).
- Reuse `trishteam_core` (theme, widgets, store).
- Build with PyInstaller → 1 file `TrishLauncher.exe` ~50MB.
- NSIS installer ngoài cùng để cài Launcher (entry point).

### Status: scaffold tạo Phase 6.

## Phase 7 — TrishDesign

Engineer toolkit — tổ hợp các tool phục vụ công việc Khảo sát & Thiết kế cầu
đường của dân xây dựng giao thông. Phase 7 implement các module chính (xem
`apps/trishdesign/src/trishdesign/modules/`):

1. **Dashboard + Thư viện dự án** (sprint 5-6) — landing + project list.
2. **Bảng tính kết cấu** (sprint 6-7) — thư viện spreadsheet excel có sẵn
   (dầm, móng, mố trụ…).
3. **Dự toán** (sprint 7) — nhập khối lượng → xuất bảng dự toán.
4. **Office Export** (sprint 8) — xuất báo cáo Word từ template.
5. **Hư hỏng mặt đường** (sprint 9) — khảo sát field → bản đồ hư hỏng.
6. **ATGT** (sprint 9) — an toàn giao thông — khảo sát + báo cáo.
7. **Map VN2000** (sprint 9) — xử lý toạ độ hệ Việt Nam 2000.
8. **PDF → Excel** (sprint 10) — trích bảng từ PDF scan.
9. **AutoLisp manager** (sprint 10) — quản lý lisp autocad thông dụng.
10. **PDF tools** (sprint 11) — merge/split/OCR/sign.
11. **Danh mục HS** (sprint 11) — danh mục hồ sơ dự án.
12. **Chatbot RAG** (sprint 12) — hỏi đáp trên thư viện dự án.
13. **OCR** (sprint 12) — OCR tiếng Việt.

TrishDesign **bắt buộc login** vì lưu/chia sẻ dự án qua cloud và các phép tính
KC có thể là know-how riêng của user → phải có account quản lý access.

## Phase 8 — Logo / branding integration

Status: logo pipeline done (bg removal + multi-size + .ico), hoàn thiện round
2 với 11 app + 1 umbrella.

### Output từ `process_logos.py`

```
design/logos/
├─ TrishTEAM/         (umbrella — Launcher About + website banner)
├─ TrishFont/
├─ TrishLauncher/
├─ TrishDesign/
├─ TrishLibrary/
├─ TrishNote/
├─ TrishAdmin/        (ẩn khỏi launcher public, vẫn có logo cho app nội bộ)
├─ TrishType/
├─ TrishCheck/
├─ TrishSearch/
├─ TrishClean/
└─ TrishImage/
    ├─ full.png          (logo + text gốc, transparent bg)
    ├─ icon.png          (chỉ icon, transparent bg)
    ├─ text.png          (chỉ phần text — nếu có layout tách được)
    ├─ icon-16.png ... icon-512.png
    └─ app.ico           (multi-size Windows icon)
```

Preview toàn bộ 12 logo: `design/logos/_preview-grid.png` (4×3 grid).

### Integration checklist

- [x] Pipeline `process_logos.py` chạy được cho horizontal + vertical layout.
- [x] `AppHeader` accept `logo_path` → render 32×32 QPixmap (fallback emoji).
- [x] 7 app đầu: copy `icon-64.png` + `app.ico` vào `apps/<id>/src/<id>/resources/`.
- [x] `main()` của 7 app đầu: `QApplication.setWindowIcon(...)` + truyền
      `logo_path=LOGO_PATH` vào AppHeader.
- [x] Launcher `HubView.AppCard` — load logo bundled thay vì emoji.
- [x] `pyproject.toml` từng app thêm `[tool.setuptools.package-data]`.
- [ ] Scaffold + wire logo cho 4 app mới (Check/Search/Clean/Image) — **Phase 9**.
- [ ] Launcher hide TrishAdmin — filter `id != "trishadmin"` trong HubView.
- [ ] Bundle lại 11 logo (trừ admin) vào `apps/trishlauncher/.../resources/logos/`.
- [ ] Website / README — dùng `TrishTEAM/full.png` làm header banner.
- [ ] Upload toàn bộ `design/logos/` lên repo `trishnexus-launcher-registry`
      để `apps.json` reference được qua `raw.githubusercontent.com`.

## Phase 9 — Scaffold 4 app mới

Tạo cấu trúc tối thiểu cho 4 app thêm vào scope round 2: TrishCheck,
TrishSearch, TrishClean, TrishImage. Pattern giống Library/Note/Admin/Type:

```
apps/<id>/
  pyproject.toml              (dependencies: trishteam-core + PyQt6)
  src/<id>/
    __init__.py
    app.py                    (main() + AppHeader + coming-soon page)
    resources/
      logo-64.png             (copy từ design/logos/<Name>/icon-64.png)
      app.ico
```

Mỗi app:

- Có `AppHeader(logo_path=LOGO_PATH, app_name="Trish<b>{Suffix}</b>", …)`.
- Có 1 tab Home với coming-soon placeholder + tagline từ docx.
- `QApplication.setWindowIcon(QIcon(ICO_PATH))` để window + taskbar hiển thị
  icon đúng.

Sau scaffold → chạy smoke test (launch QApplication, hide ngay) để confirm
import + resource path hợp lệ.

### Status

- [ ] Chạy `scaffold_apps.py` với 4 app mới (reuse script cũ, chỉ thay APPS
      list).
- [ ] `pip install -e .` từng app → verify entry point `trishcheck`,
      `trishsearch`, `trishclean`, `trishimage` hoạt động.
- [ ] Thêm entry tương ứng vào `docs/launcher-registry/apps.json`.

## Phase 10 — Auth hệ sinh thái

SSO cho 4 app bắt buộc login (Design / Library / Note / Search) + TrishAdmin
(admin/dev only). Chi tiết đầy đủ trong `docs/AUTH.md` (sẽ tạo Phase 10).

### Tech stack

- **Firebase Authentication** — email/password + Google Sign-In.
- **Firestore custom claims** — role: `user` | `admin` | `dev`.
- **ID token** cache ở `%APPDATA%\TrishTEAM\auth\token.json` (DPAPI encrypted
  trên Windows).
- **Refresh token** tự động refresh 50 phút/lần (token expires 60 phút).
- **Offline mode** — app public vẫn chạy được; app login-required báo lỗi
  "cần kết nối để xác thực" nếu token expired và no internet.

### Role matrix

| Role   | Source                          | Dùng cho                              |
| ------ | ------------------------------- | ------------------------------------- |
| user   | Firebase email verified         | Design / Library / Note / Search      |
| admin  | Custom claim `role=admin`       | + TrishAdmin (full read/write all)    |
| dev    | Custom claim `role=dev`         | + TrishAdmin (read all + dev tools)   |

### Shared Auth SDK

`shared/trishteam_core/src/trishteam_core/auth/`:

- `firebase_client.py` — wrapper thin trên `pyrebase` hoặc `firebase-admin`.
- `token_store.py` — DPAPI encrypt + save/load.
- `login_dialog.py` — QDialog email/password + Google button.
- `role_guard.py` — decorator `@require_role("admin")` cho view/action.
- `session.py` — singleton cache current user + role.

Mỗi app login-required gọi `session.require_login(parent)` ở `main()` trước
khi show BaseWindow. Nếu user huỷ → `sys.exit(0)`.

### Security checklist

- [ ] Token stored with DPAPI, not plain text.
- [ ] Firestore rules: user chỉ đọc/sửa document có `owner_uid == request.auth.uid`.
- [ ] Admin claims set qua Cloud Function callable, không cho user tự set.
- [ ] Rate limit login 5 lần/phút per IP.
- [ ] HTTPS pin cert (optional, nếu cần tăng bảo mật).
- [ ] Log security events (login fail, role escalation attempt) vào
      `auth_events` collection.

## Phase 11 — Website TrishTEAM

Website marketing + hub download cho toàn hệ sinh thái, đồng bộ song song với
desktop app. Chi tiết trong `docs/WEBSITE.md` (sẽ tạo Phase 11).

### Stack đề xuất

- **Next.js 14 App Router** — React, server components, SSG cho các trang app.
- **Tailwind CSS** — đọc token từ `shared/trishteam_core/.../tokens.json`
  export sang CSS variables.
- **shadcn/ui** — component library, match dark warm palette.
- **Firebase Auth** share với desktop → 1 lần login dùng cả 2 nơi.
- **Firestore** — Library / Note / Search đồng bộ 2 chiều giữa web và desktop.
- **Vercel** hosting — preview per PR.

### Sitemap

```
/                         Landing — hero umbrella + 10 app grid (trừ admin)
/apps/trishfont           Detail page từng app (screenshots, changelog, download)
/apps/trishdesign
/apps/trishlibrary
/apps/trishnote
/apps/trishtype
/apps/trishcheck
/apps/trishsearch
/apps/trishclean
/apps/trishimage
/apps/trishlauncher
/downloads                Latest version từng app (đọc apps.json)
/library                  Web UI cho TrishLibrary (sau login)
/note                     Web UI cho TrishNote (sau login)
/search                   Web UI cho TrishSearch (sau login)
/admin                    Portal TrishAdmin (role-gated, hidden from nav)
/login                    Firebase Auth UI
/account                  Profile + settings
```

### Song song desktop

| Tính năng              | Desktop                   | Website                  | Sync      |
| ---------------------- | ------------------------- | ------------------------ | --------- |
| Library                | PyQt6 view + SQLite local | Next.js + Firestore      | 2 chiều   |
| Note                   | PyQt6 editor + SQLite     | Next.js editor + Firestore | 2 chiều |
| Search                 | Local FTS5 + cloud query  | Firestore full-text      | cloud-first |
| Admin                  | PyQt6 dashboard           | Next.js dashboard        | cloud-only |
| Design / Font / Type…  | Desktop chuyên dụng       | Trang giới thiệu + tải    | —         |

### Status

- [ ] Init repo `trishnexus-website/` hoặc thư mục `website/` trong monorepo.
- [ ] Design token export script: `scripts/export-tokens-css.py`.
- [ ] Landing page với 10 app grid + logo từ `raw.githubusercontent.com/…/design/logos/`.
- [ ] Auth flow Firebase share với desktop.
- [ ] CI: build + deploy Vercel per PR.

## Phase 12 — AI augmentation (semantic retrieval VN)

Optional layer cho TrishSearch / TrishLibrary / TrishDesign: embed document +
query bằng Vietnamese sentence-transformer, cosine similarity top-K thay cho
keyword FTS5-only. Model đầu tiên ứng cử:
[`mainguyen9/vietlegal-harrier-0.6b`](https://huggingface.co/mainguyen9/vietlegal-harrier-0.6b)
(chi tiết §External AI/ML resources).

### Module mới `trishteam_core.ai` (optional)

```
shared/trishteam_core/src/trishteam_core/ai/
    __init__.py
    embedder.py       # SentenceTransformer wrapper, lazy-load
    vector_store.py   # sqlite-vec (ưu tiên) hoặc chromadb backend
    ingest.py         # chunk .pdf/.docx/.md → embed → upsert
    retrieve.py       # query → embed → top-K cosine
    models.py         # @dataclass: Embedding, Chunk, SearchHit
```

Dependencies thêm (optional, không bắt buộc Runtime base):

```toml
[project.optional-dependencies]
ai = [
  "sentence-transformers>=2.7",
  "torch>=2.2",                 # CPU hoặc CUDA theo wheel
  "sqlite-vec>=0.1",            # vector extension cho SQLite
]
```

### UX

- Installer NSIS có option "Cài AI pack (~1.8GB, Vietnamese semantic)" —
  checkbox mặc định OFF.
- Lần đầu user bật semantic search trong app: download model qua HuggingFace
  Hub API vào `%LOCALAPPDATA%\TrishTEAM\models\vietlegal-harrier-0.6b\`.
- Fallback: nếu model chưa có → app dùng FTS5 + label "Kết quả keyword (AI
  chưa cài)".

### Yêu cầu hệ thống

- **RAM**: ≥ 8GB (model load ~2GB khi chạy CPU fp32, ~1GB fp16).
- **Disk**: ~2GB cho model + ~1GB torch runtime.
- **GPU**: nice-to-have (NVIDIA CUDA) — tăng tốc embed corpus lớn; CPU-only
  vẫn OK cho corpus <10K docs.
- **Offline**: sau khi download model 1 lần, toàn bộ flow offline (không
  gọi HuggingFace Hub nữa).

### Status

- [ ] Scaffold `trishteam_core.ai` module (task #66).
- [ ] Viết `download_model.py` CLI để TrishLauncher gọi lúc opt-in.
- [ ] Wire TrishSearch UI: toggle "Semantic mode" khi model ready.
- [ ] Benchmark NDCG@10 trên corpus thật của Trí (tài liệu KC / dự toán /
      TCVN) — so sánh với FTS5 baseline.
- [ ] Docs: `docs/AI.md` — cài đặt, threat model (model checksum), cách
      thay model (e.g. nếu Trí muốn dùng embedding khác chuyên engineering).

---

## Mô tả chi tiết 11 app

Nguồn: file docx `TrishTEAM-apps.docx` do user cung cấp 2026-04-22.

### 1. TrishFont — Quản lý font

Quản lý, xem trước và cài đặt font chuyên nghiệp. Hỗ trợ Windows font
(`.ttf/.otf/.ttc`) và AutoCAD font (`.shx`), folder-aware grouping, font-pack
sync từ GitHub. Không cần login.

### 2. TrishDesign — Khảo sát & Thiết kế

Engineer toolkit cho dân xây dựng giao thông. 13 module chính: Dashboard,
Thư viện dự án, Bảng tính KC, Dự toán, Office Export, Hư hỏng mặt đường, ATGT,
Map VN2000, PDF→Excel, AutoLisp manager, PDF tools, Danh mục HS, Chatbot RAG,
OCR. **Login bắt buộc** vì dữ liệu dự án + bảng tính KC là know-how riêng.

Phase 12+ có thể wire **vietlegal-harrier-0.6b** cho Chatbot RAG (tra
Nghị định / TCVN / QCVN xây dựng theo ngữ nghĩa, không chỉ từ khóa) —
xem §External AI/ML resources.

### 3. TrishLibrary — Thư viện tài liệu

Thư viện cá nhân quản lý PDF / docx / link / ghi chú tham khảo. Local SQLite +
Firebase Firestore sync. Share dùng giữa **website và desktop**. **Login bắt
buộc** để sync.

Phase 12+ có option bật semantic retrieval (vietlegal-harrier-0.6b hoặc
embedding model Vietnamese khác) — search "tìm tài liệu về dự toán cầu
bê tông" trả về doc có nội dung gần nghĩa, không cần khớp từ chính xác.

### 4. TrishNote — Ghi chú

Ghi chú dự án, deadline, cá nhân, học tập. Markdown editor, tag, due date,
reminder. Firebase sync. **Website + desktop đồng bộ**. **Login bắt buộc**.

### 5. TrishAdmin — Administrator

Quản lý quyền Administrator toàn bộ hệ sinh thái TrishTEAM:

- Xem danh sách user đã đăng ký (qua Firebase Auth + Firestore).
- Set/revoke role: user / admin / dev.
- Xem logs security events.
- Push font-pack mới / bump version app.
- Moderate Library + Note shared content.

**Không public** — ẩn khỏi Launcher. Chỉ Admin và Dev được cài + truy cập.
Có cả **website version** (`/admin`) lẫn **desktop app**, cùng Firestore backend.

### 6. TrishLauncher — Launcher

Launcher tổng thể — hiển thị + cho phép tải/cập nhật **tất cả app trừ
TrishAdmin**. Feedback button gửi message qua **Telegram bot** → admin nhận
được trực tiếp trên Telegram. Không cần login để browse; opt-in login để sync
apps đã cài giữa máy (nếu user muốn).

### 7. TrishType — Soạn thảo đa định dạng

Trình soạn thảo **mọi định dạng** (txt, md, docx, odt, rtf, html, json, yaml,
csv…) + convert qua lại + PDF tools (merge, split, sign, watermark). Không
cần login.

### 8. TrishCheck — Kiểm tra hệ thống

Kiểm tra **cấu hình máy tính** (CPU, RAM, GPU, disk, OS version) so với yêu
cầu tối thiểu của các phần mềm phổ biến (AutoCAD, Revit, Photoshop, các app
TrishTEAM…). Báo pass/fail + gợi ý upgrade. Không cần login.

### 9. TrishSearch — Tìm kiếm tổng

Tìm thông tin / file / note / ghi chú trên cả **local và cloud**. Sử dụng
SQLite FTS5 cho local + Firestore cho cloud. Tích hợp TrishLibrary và
TrishNote để search across. **Login bắt buộc** để search cloud.

**Phase 12 (AI augmentation):** Bổ sung lớp semantic retrieval dùng
[mainguyen9/vietlegal-harrier-0.6b](https://huggingface.co/mainguyen9/vietlegal-harrier-0.6b)
(600M params, 1024-dim, Apache 2.0, SOTA trên Vietnamese legal retrieval
NDCG@10=0.7813). User query → embed → cosine sim top-K trên vector store
local (sqlite-vec / chromadb). Fallback FTS5 nếu model chưa cài. Xem
§External AI/ML resources để biết yêu cầu hệ thống + workflow cài.

### 10. TrishClean — Dọn file rác

Quét và xoá `.bak`, `.tmp`, `.cache`, `Thumbs.db`, temp IDE (`.pyc`,
`node_modules` orphan), log cũ, Recycle Bin. Preview trước khi xoá, undo
trong session. Không cần login.

### 11. TrishImage — Thư viện ảnh

Quản lý thư viện ảnh — browse theo folder, tag, metadata EXIF, face grouping
cơ bản. Local + cloud backup (Firestore / Storage optional). Không cần login
để dùng local; login để backup cloud.

---

## External AI / ML resources

Registry các model / dataset / repo bên ngoài được đánh giá để tích hợp vào hệ
sinh thái TrishTEAM. Khi Trí gửi link repo mới (HuggingFace, GitHub, v.v.),
Claude sẽ **tự động research + cập nhật bảng dưới đây**:

- đọc model card / README để ghi nhận: kích thước, license, language,
  benchmark, yêu cầu hệ thống;
- đề xuất app nào trong hệ sinh thái dùng được và dùng như thế nào;
- nếu fit → tạo task mới ở Phase 12+ (AI augmentation) hoặc phase liên quan;
- nếu không fit → ghi lý do ngắn gọn trong cột `Status` để khỏi cân nhắc lại.

### Quy ước ô `Fit`

- ✅ **Đã chốt** — có task / đã wire vào code.
- 🟡 **Cân nhắc** — phù hợp về kỹ thuật, chờ Trí confirm.
- ⛔ **Loại** — không phù hợp hệ sinh thái hoặc license incompatible.

### Bảng registry

| Nguồn | Dạng | License | Kích thước | Fit | App liên quan | Ghi chú |
| --- | --- | --- | --- | --- | --- | --- |
| [mainguyen9/vietlegal-harrier-0.6b](https://huggingface.co/mainguyen9/vietlegal-harrier-0.6b) | Sentence embedding (Qwen3-base, 1024-dim) | Apache 2.0 | 600M params (~1.2GB) | 🟡 | TrishSearch (chính), TrishLibrary, TrishDesign (Chatbot RAG) | SOTA Vietnamese legal retrieval NDCG@10=0.7813. Task #66 (Phase 12). Strength: legal/admin text; cần benchmark thêm trên engineering corpus (TCVN/KC). Download ~1.8GB bao gồm torch runtime. |

### Workflow khi Trí gửi repo mới

1. Trí paste URL (HuggingFace, GitHub, arXiv…) vào chat.
2. Claude web_fetch repo → tóm tắt model card / README.
3. Đánh giá fit cho từng app (Font / Design / Library / Note / Admin /
   Launcher / Type / Check / Search / Clean / Image).
4. Update bảng này (thêm row + cập nhật cột `Fit`).
5. Nếu fit ✅ hoặc 🟡 → tạo task mới (TaskCreate) với scope rõ ràng.
6. Trí confirm → wire code trong phase tương ứng.

---

## Versioning

- Mỗi app phiên bản semver độc lập.
- `trishteam_core` bump khi có breaking change widget API.
- Launcher bump theo schema apps.json.
- Font pack bump theo SemVer (major = breaking, minor = thêm font, patch = fix metadata).
- Website deploy theo commit SHA (Vercel preview) + tag release khi stable.
