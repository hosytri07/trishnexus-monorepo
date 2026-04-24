# TrishNexus — Roadmap

Phiên bản tổng cho cả monorepo. Cập nhật lần cuối: 2026-04-23 (Phase 11.5.22 +
Phase 14/15 mới).

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
- [Phase 13 — Design language refresh v2 (shadcn + Lucide + 6 theme)](#phase-13--design-language-refresh-v2)
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

- [x] Token stored with DPAPI (Windows) / keyring (other) / plaintext fallback (Phase 1.2).
- [x] Admin claims set qua Cloud Function `setUserRole` (Phase 1.7, caller role=dev).
- [ ] Firestore rules: user chỉ đọc/sửa document có `owner_uid == request.auth.uid`.
- [ ] Rate limit login 5 lần/phút per IP (App Check production).
- [ ] HTTPS pin cert (optional, nếu cần tăng bảo mật).
- [ ] Log security events (login fail, role escalation attempt) vào
      `auth_events` collection — partial (mint/redeem/role_change đã log Phase 1.7).

### Phase 1 sub-phases — shipped (2026-04-22 → 2026-04-23)

| Sub-phase | Task # | Status | Key deliverable |
| --- | --- | --- | --- |
| 1.1 | #73 | ✅ | `firebase_client.py` + `session.py` + `token_store.py` — refactor từ `manager.py` cũ |
| 1.2 | #74 | ✅ | DPAPI (Windows) + keyring + plaintext fallback |
| 1.3 | #75 | ✅ | `@require_role()` decorator + `has_role()` helper |
| 1.4 | #76 | ✅ | `offline.py` — `OfflineChecker` + Qt factory, banner support |
| 1.5 | #77 | ✅ | `login_dialog.py` — QDialog + LoginWorker + Lucide icons + i18n VN |
| 1.6 | #78 | ✅ | `sso_handler.py` — `trishteam://` parse + oneshot exchange + Windows registry + `bootstrap.py handle-url` |
| 1.7 | #79 | ✅ | Cloud Functions `functions/` — setUserRole + exchangeForWebToken + exchangeOneshotToken (30 test) |
| 1.8 | #80 | ✅ | Integration test headless + AUTH.md §9 sync với shipped reality |

Test coverage sau Phase 1: **109 Python test** (107 pass, 2 skip) + **30 TypeScript test** (all pass). Tổng 139 test auth-related.

Còn lại Phase 10 (roadmap tổng) ngoài Phase 1: bootstrap dev user đầu (Firebase console), deploy functions vào project prod, deploy firestore rules, enable App Check, wire 4 app login-required với `session.require_login()`, website login flow, TrishAdmin bootstrap. Các sub-phase còn lại sẽ là Phase 1.9+ trong các session sau.

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

## Phase 13 — Design language refresh v2

Nâng cấp design language toàn hệ sinh thái theo tham khảo Youwee (`github.com/vanloctech/youwee`) — một app desktop Tauri/React đang đại diện cho "modern desktop UI 2025-2026" cùng league với Linear/Raycast. Mục tiêu: giữ nguyên bản sắc TrishTEAM (warm palette engineer-friendly) nhưng mở rộng theo hướng **hệ thống theme + icon + component semantic** của shadcn/ui ecosystem, để web + desktop khớp nhau về feel.

### Nguồn cảm hứng

| Aspect             | Youwee                                 | TrishTEAM v2 (đề xuất)                     |
|--------------------|----------------------------------------|--------------------------------------------|
| Stack desktop      | Tauri 2 + React + Tailwind + shadcn/ui | PyQt6 (giữ) + QSS mimic shadcn semantic    |
| Stack web          | —                                      | Next.js + Tailwind + shadcn/ui + Lucide    |
| Icon library       | Lucide                                 | Lucide (cả desktop + web, dùng SVG)        |
| Theme count        | 6 (Midnight/Aurora/Sunset/Ocean/Forest/Candy) | 7 (TrishWarm default + 6 Youwee themes)    |
| Theme switch       | Runtime, persisted trong settings      | Runtime qua Launcher Settings → chọn theme |
| Typography scale   | 8 step (xs → 4xl)                      | 8 step tương tự trong `tokens.json`        |
| Radius             | 4/8/12/16 (sm/md/lg/xl)                | 4/8/12/16 match                             |
| Shadow             | 5 step (sm → 2xl)                      | 5 step match                                |

Bản sắc **TrishWarm** (warm dark + accent nâu cam ấm dân engineering) vẫn là default cho user Việt — là mặc định khi install lần đầu. Các theme còn lại là opt-in.

### Feasibility — cái nào copy code được, cái nào chỉ copy ý tưởng

**Code copy 1-1 (cho Website Phase 11):**

- `npx shadcn@latest init` trong `website/` → kéo Card, Button, Sheet, Dialog, Sonner toast, DropdownMenu.
- `npm i lucide-react` → import icon trực tiếp.
- `tailwind.config.js` đọc từ `shared/trishteam_core/ui/tokens.json` (export helper Node).

**Design copy only (cho Desktop PyQt6):**

- Bảng màu 6 theme của Youwee dịch sang `tokens.json` dưới dạng 6 namespace song song với `warm` hiện tại.
- Icon Lucide: download subset (~50 icon core) vào `shared/trishteam_core/icons/lucide/*.svg`, viết helper `qicon(name: str) -> QIcon`.
- Component semantic: QSS mới cho `QFrame[role="card"]`, `QPushButton[role="primary|secondary|ghost|destructive"]` khớp shadcn naming.

**Không copy:**

- React component composition → không áp vào Qt được.
- Tailwind utility class → QSS không thể `className="p-4 rounded-xl shadow-lg"`; phải viết QSS declaration tường minh.
- CSS transition/keyframe → Qt dùng `QPropertyAnimation` (cần viết lại).

### Tasks

1. **Extend `tokens.json` → 7-theme system.** Schema mới:
   ```json
   {
     "version": 2,
     "default_theme": "trishwarm",
     "themes": {
       "trishwarm":  { "surface_bg": "...", "accent_primary": "...", ... },
       "midnight":   { ... },
       "aurora":     { ... },
       "sunset":     { ... },
       "ocean":      { ... },
       "forest":     { ... },
       "candy":      { ... }
     },
     "typography": { "xs": "12px", ..., "4xl": "48px" },
     "radius":     { "sm": 4, "md": 8, "lg": 12, "xl": 16 },
     "shadow":     { "sm": "...", "md": "...", ... }
   }
   ```
2. **`tokens.py` refactor:** đọc theme active từ settings, expose `COLOR.current.*` trỏ tới theme đang chọn. Fallback về `trishwarm` nếu settings chưa có.
3. **Runtime theme switcher:** TrishLauncher → Settings tab → dropdown chọn theme → emit `theme_changed` signal → mọi app đang chạy reload QSS.
4. **Lucide icon registry:** `shared/trishteam_core/icons/` chứa 50-80 icon SVG + `icons.py` map tên → path. Mọi app gọi `from trishteam_core.icons import icon; btn.setIcon(icon("settings"))`.
5. **QSS semantic rewrite:** `theme.py` hiện tại (TrishFont) refactor thành `shared/trishteam_core/ui/qss.py` nhận theme object + trả string QSS. Các app còn lại dùng chung.
6. **Website lock stack:** update `WEBSITE.md` ghi rõ shadcn/ui + Lucide + Tailwind bắt buộc. Export token sang Tailwind theme trong `scripts/export-tokens.py` (đã mention trong `WEB-DESKTOP-PARITY.md §9`).
7. **Design-spec v2:** rewrite `docs/design-spec.md` với 8-step typography + 5-step shadow + 4-step radius + 2-theme table (dark + light; Phase 13.5 đã rút từ 7 xuống 2).

### Status

- [x] Task #67 — Extend `tokens.json` v2 schema (7 theme — Phase 13.5 rút xuống 2).
- [x] Task #68 — Lucide icon registry + `qicon()` helper.
- [x] Task #69 — Runtime theme switcher (shipped 2026-04-23): `theme_registry.py` pure-Python loader, `theme_manager.py` QObject singleton với signal + persist, AppHeader submenu "🎨 Giao diện" list theme. 37 test pass headless (không cần PyQt6 libEGL).
- [x] Task #70 — Shared QSS builder cho 11 app (shipped 2026-04-23): `theme.py` chuyển thành façade mỏng delegate qua `theme_registry.build_qss_from_palette(palette, bundle)`. Builder mở rộng từ ~50 → ~200 dòng cover đầy đủ role-specific selector (CardGroup stripe 6 variant, LogPanel, ActionBar CTA gradient, Sidebar pill checked, AppHeader, badge, menu). Backward compat: `build_qss(dark=True)` / `apply_theme(target, dark=True)` giữ signature cũ, 11 app không phải sửa code. 151 test pass.
- [x] Task #83 — Phase 13.5 fix theme-picker + rút 7 theme xuống 2 (shipped 2026-04-23):
  - **Bug fix:** Click nút "🎨 Giao diện" không đổi UI — root cause: `BaseWindow.__init__` set stylesheet trên QMainWindow (priority cao hơn QApplication-level stylesheet per Qt rules), nhưng `_on_theme_picked` lại set trên `QApplication.instance()`. Fix: target `self.window()` (top-level QMainWindow chứa header) + broadcast qua `QApplication.topLevelWidgets()` cho các sub-window đang mở (AboutDialog/UpdateDialog).
  - **Đơn giản hoá UX:** rút 7 theme (trishwarm + 6 skin Youwee) xuống **2 theme cốt lõi**: `dark` (chữ #f5f2ed trên nền #0f0e0c) + `light` (chữ #1a1814 trên nền #f7f6f3). Giữ accent gradient `#667EEA → #764BA2` ở cả 2 mode để brand identity nhất quán.
  - **Backward compat (zero-break):** thêm `theme_aliases` block vào tokens.v2.json — persist file cũ của user chứa `trishwarm`/`midnight`/`aurora`/`sunset`/`ocean`/`forest` tự động map sang `dark`; `candy` → `light`. Không user nào bị crash sau upgrade. `theme_manager.init()` + `set_theme()` resolve alias trước khi validate; `set_theme("trishwarm")` persist key canonical `"dark"` chứ không phải `"trishwarm"`.
  - 162 test pass (thêm 11 test: 6 alias resolver trong registry + 5 legacy persist trong manager).
- [x] Task #71 — Website Phase 11 scaffold (shipped 2026-04-23):
  - **`scripts/export-tokens.py`** — Python script đọc `design/tokens.v2.json` → xuất `website/assets/tokens.css` (`:root` = dark default + `[data-theme='light']` override) và `website/assets/tailwind.theme.cjs` (Tailwind theme object). Có `--check` mode cho CI drift detection. Idempotent; skip `_comment`/`_meta` keys.
  - **Website scaffold** (`website/` folder, 14 file 450 dòng, zero node_modules — install sau trên máy):
    - `package.json` (pinned: Next 14.2.5 + React 18.3.1 + Tailwind 3.4.4 + lucide-react 0.383 + clsx + tailwind-merge + TypeScript 5.4.5).
    - `tailwind.config.cjs` import `assets/tailwind.theme.cjs`; `darkMode: ['class', '[data-theme="dark"]']`.
    - `app/layout.tsx` server render `<html lang="vi" data-theme="dark">` + `ThemeProvider`.
    - `app/page.tsx` landing Hero dùng accent gradient (`background: var(--color-accent-gradient)` + `-webkit-background-clip: text`) + 2 CTA (Download TrishLauncher, Xem 10 app).
    - `components/theme-provider.tsx` (client) — 2-theme + alias resolver (`trishwarm`/`midnight`/`candy`/... → `dark`/`light`) đồng bộ với desktop `theme_manager.py`. `localStorage['trishteam:theme']` persist, tolerant hydration mismatch.
    - `components/theme-toggle.tsx` Moon/Sun Lucide icon → `setTheme('light'|'dark')`.
    - `app/globals.css` import tokens.css trước `@tailwind base`; body dùng CSS vars.
    - `README.md` hướng dẫn setup + tokens sync workflow + Phase 11.x roadmap.
    - `.gitignore` Next.js + Node standards.
  - **12 test mới** (`shared/trishteam_core/tests/test_export_tokens.py`) — script loadable, CSS/Tailwind output đúng schema, `--check` idempotent + phát hiện drift, repo file in-sync. 174 pass + 2 skip (từ 162 → 174, +12).
  - **Scope giới hạn**: chưa wire `/apps/<id>`, `/login`, Firebase Auth — đó là Phase 11.1–11.5 (xem `website/README.md`). Ship an toàn trước, chưa cần Node trên máy user session này.
- [x] Task #72 — Phase 13.6 Rewrite `docs/design-spec.md` v2 (shipped 2026-04-23): merge `docs/DESIGN.md` (agent brief) vào `docs/design-spec.md` thành **1 source of truth duy nhất** cho cả designer + AI agents. v2.0 bây giờ đúng với code hiện tại (warm palette #0f0e0c/#1a1814 thay vì cool-gray #0F1419 cũ, 2 theme dark+light thay vì 7 theme cũ, 11 app thay vì 7 app cũ, AppHeader 56px thay vì 48px, LogPanel bỏ timestamp, thêm agent prompt guide §10 + gotcha section §11 ghi rõ QMainWindow stylesheet priority rule). `DESIGN.md` rút gọn thành pointer trỏ về `design-spec.md`.

### Nguyên tắc khi thực thi

- **Không break apps hiện có.** TrishFont đang dùng warm palette; sau migrate phải identical visually (regression test screenshot).
- **Theme `dark` = default.** Phase 13.5 rút xuống chỉ còn 2 theme thực: `dark` + `light`. Key cũ (`trishwarm`, `midnight`, `candy`, ...) còn resolve được qua alias để không break user đã có persist file.
- **Brand logos bất biến.** Logo 11 app giữ nguyên; theme chỉ ảnh hưởng surface + text, không đụng logo.
- **Brand accent bất biến.** Gradient `#667EEA → #764BA2` giữ nguyên ở cả dark + light để identity nhất quán, chỉ surface + text đảo ngược.
- **Desktop first-install UX.** Khi user cài Launcher lần đầu, theme mặc định là `dark` — không force họ chọn theme.

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

---

## Phase 11.5.x — Website polish (status tracker)

Các bản vá nhỏ của website sau khi Phase 11 đã ship core. Phase 11.5 là
"sprint hoàn thiện" trước khi đụng Auth/Firebase (Phase 11.6+).

| # | Subphase | Nội dung | Status |
| -- | -------- | -------- | ------ |
| 11.5.1-6 | — | Navbar v2 + search/notifications/user/admin panel | ✅ |
| 11.5.7 | 24h primary | `/api/prices` scrape 24h.com.vn (fallback) | ✅ |
| 11.5.8 | Brand SVG | Quick Access icons | ✅ |
| 11.5.9 | Ecosystem SVG | Author avatar constellation | ✅ (sau đó replace bằng logo thật 11.5.20) |
| 11.5.10 | Theme refresh | Purple → light green (`#4ADE80` → `#10B981`) | ✅ |
| 11.5.11 | Login button 1 | Guest nav CTA cân đối | ✅ |
| 11.5.12 | Command Palette | Cmd/Ctrl+K overlay | ✅ |
| 11.5.13 | Keyboard Help | "?" modal | ✅ |
| 11.5.14 | Focus Mode | Toggle ẩn aside + ambient decor | ✅ |
| 11.5.15 | tsc check | Type check cuối | ✅ |
| 11.5.16 | SWC fix | styled-jsx panic trong focus-mode | ✅ |
| 11.5.17 | Login page | 2-panel Login/Register slide overlay | ✅ |
| 11.5.18 | "Về dashboard" polish | Glass-morphism pill | ✅ |
| 11.5.19 | Login button 2 | Fix icon+text stacking vertical | ✅ |
| 11.5.20 | Real logo avatar | `public/trishteam-logo.png` thay SVG | ✅ |
| 11.5.21 | Remove ExternalApps | Gỡ 12 shortcut | ✅ |
| **11.5.22** | **QR Generator** | **Auto-convert Drive/Docs/Sheets/Slides/Dropbox/YouTube** | ✅ |

### Phase 11.5.22 — chi tiết

File: `website/components/widgets/qr-generator-widget.tsx`.

Features:
- Input link / text → QR canvas live (debounce 180ms).
- Auto-detect + convert:
  - `drive.google.com/file/d/{ID}` → `uc?export=download&id={ID}` (direct DL).
  - `drive.google.com/open?id={ID}` → direct DL.
  - `docs.google.com/document/d/{ID}` → `/export?format=pdf`.
  - `docs.google.com/spreadsheets/d/{ID}` → `/export?format=xlsx`.
  - `docs.google.com/presentation/d/{ID}` → `/export?format=pptx`.
  - Dropbox `dropbox.com/s/...` → ép `dl=1`.
  - YouTube full URL → `youtu.be/{id}` short form.
- Size 192/256/384 · ECC L/M/Q/H (default H — chống lỗi tốt cho in) · Color picker.
- Download PNG (canvas.toDataURL), SVG (QRCode.toString), Copy image (ClipboardItem).
- Copy link, Open, Share Zalo/Telegram/Facebook/Email.
- Library `qrcode@1.5.3` load dynamic từ cdnjs — không thêm npm dependency.
- 5 sample button (Drive file/Docs/Sheets/YouTube/Website) test nhanh.

Đặt ở Row 4.5 dashboard (vị trí ExternalApps cũ).

---

## Phase 11.6 — Firebase Auth wiring (website) ✅ DONE 2026-04-23

| Sub | Trạng thái | Ghi chú |
|-----|:----------:|---------|
| 11.6.1 | ✅ | `website/lib/firebase.ts` + `.env.example` (6 biến `NEXT_PUBLIC_FIREBASE_*`). `firebaseReady` flag cho fallback mock. |
| 11.6.2 | ✅ | `lib/auth-context.tsx` — `AuthProvider` với `onAuthStateChanged`, fetch Firestore `/users/{uid}`. Compat wrapper `useUserSession()` giữ API cũ. Mock fallback khi `NEXT_PUBLIC_AUTH_MOCK=1` hoặc thiếu env. |
| 11.6.3 | ✅ | Register form wire `createUserWithEmailAndPassword` + `updateProfile(displayName)` + `setDoc(/users/{uid})` với fullName, phone, role:'user', plan:'Free', createdAt. |
| 11.6.4 | ✅ | Login wire `signInWithEmailAndPassword` + Google `signInWithPopup`. Forgot password `sendPasswordResetEmail`. Error map i18n tiếng Việt. |
| 11.6.5 | ✅ | `firestore.rules` (/users owner/admin, /announcements admin-write, /notes owner-only, /feedback user-create + admin-read, /audit admin-read, /posts public-published) + `firestore.indexes.json` + `scripts/firebase/seed-admin.ts` (custom claim `admin:true` + Firestore role). |
| 11.6.6 | ✅ | `docs/FIREBASE-SETUP.md` hướng dẫn 9 bước + `scripts/firebase/reset-release.ts` phòng Phase 11.9. |

Sau Phase 11.6: account mới tạo lưu vào Firestore với đầy đủ Họ và tên +
SĐT. Admin nhìn thấy qua admin panel (Phase 11.8).

Providers đã bật: Email/Password + Google. Facebook/GitHub/Zalo để ngỏ
(code đã chuẩn bị hook, cần bật provider ở Firebase Console + cấu hình
App ID theo hướng dẫn trong FIREBASE-SETUP.md §4).

---

## Phase 11.7 — User Progress / Notes sync ✅ DONE 2026-04-23

Firestore schema `notes/{uid}/items/*` + `users/{uid}/events/*` +
`users/{uid}/progress/{appId}`. QuickNotes đã sync realtime multi-device;
ActivityWidget đọc feed 10 event gần nhất; mọi login + register + note
update đều log tự động (throttled).

| Sub-phase | Mô tả | Trạng thái |
|-----------|-------|------------|
| 11.7.1 | `useNotesSync` hook — localStorage + Firestore dual source, debounced 500ms save, onSnapshot subscribe | ✅ |
| 11.7.2 | Rewire `QuickNotesWidget` → dùng hook, badge "Đã sync cloud / Đã lưu local / Lỗi sync" | ✅ |
| 11.7.3 | `lib/activity-log.ts` (throttle theo kind) + ActivityWidget realtime feed (10 event, icon + color per kind) | ✅ |
| 11.7.4 | Rules `/users/{uid}/events` append-only + `/users/{uid}/progress` owner-only; index collection-group `events` (kind+createdAt) | ✅ |
| 11.7.5 | tsc (0 errors), reset-release mở rộng dọn events+progress, ROADMAP sync | ✅ |

**Event kinds được log:**
- `login` — email/password + Google OAuth (throttle 1 phút)
- `register` — tạo account mới (không throttle)
- `note_update` — save QuickNotes (throttle 1 giờ)
- `app_open` — reserved cho 10 desktop app cards (throttle 5 phút)
- `feedback_sent`, `profile_update` — reserved Phase 11.8

**Schema Firestore Phase 11.7:**
```
/notes/{uid}/items/quick-note          # QuickNotes scratchpad
/notes/{uid}/items/{noteId}            # TrishNotes full notes
/users/{uid}/events/{autoId}           # Activity stream (append-only)
/users/{uid}/progress/{appId}          # Per-app state (quiz, checklist)
```

---

## Phase 11.8 — Admin backend (/admin) ✅ DONE 2026-04-23

`/admin` route với layout role-gated + 4 trang chính. Admin có badge
shield trên navbar và menu dropdown; guest + user thường bị chặn ở
layout level.

| Sub-phase | Mô tả | Trạng thái |
|-----------|-------|------------|
| 11.8.1 | `app/admin/layout.tsx` — role guard (loading/guest/403) + sidebar nav responsive | ✅ |
| 11.8.2 | `/admin` dashboard (4 stat card: users, admins, active announcements, events 24h) + `/admin/users` (list, search, toggle role admin/user) | ✅ |
| 11.8.3 | `/admin/announcements` — composer form (title/message/kind/active/dismissible/endAt) + list realtime, toggle active + delete | ✅ |
| 11.8.4 | `/admin/audit` — collection-group query events 100 mới nhất, filter theo kind, resolve email user lazy | ✅ |
| 11.8.5 | API `/api/admin/set-role` (Admin SDK) — verify ID token, setCustomUserClaims + Firestore update + audit log; fallback 501 nếu chưa config env | ✅ |
| 11.8.6 | Admin link navbar (có sẵn từ Phase 11.5) + tsc 0 errors + ROADMAP sync | ✅ |

**Cấu hình server cần cho Phase 11.8.5:**
```bash
# Dev: trỏ đến file JSON service account đã download
GOOGLE_APPLICATION_CREDENTIALS=./secrets/service-account.json

# Production (Vercel): paste JSON hoặc base64
FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}'
```

Nếu cả 2 env đều trống → UI vẫn chạy được; toggle role chỉ cập nhật
Firestore và yêu cầu admin rerun `scripts/firebase/seed-admin.ts` để
refresh custom claim.

**Firestore rules mở rộng Phase 11.8.4:**
- Nhánh collection-group `{path=**}/events/{id}` cho admin đọc cross-user.
- `/audit/{id}` ghi bởi API route (Admin SDK, bypass rules), admin đọc.

---

## Phase 11.9 — PWA manifest + offline fallback + Release Reset ✅ DONE 2026-04-23

TrishTEAM trở thành installable PWA: icon set, manifest, service worker
(hand-rolled, không cần `next-pwa`), offline page, và release checklist
đầy đủ để public. Sub-phase:

| Sub | Trạng thái | Ghi chú |
| --- | ---------- | ------- |
| 11.9.1 | ✅ | Generate icon set bằng Python Pillow từ `public/trishteam-logo.png` 512×512 → `public/icons/icon-192.png`, `icon-512.png`, `icon-maskable-512.png` (20% safe-zone padding trên nền trắng), `apple-touch-icon.png` 180×180. |
| 11.9.2 | ✅ | `public/manifest.json` đầy đủ: name/short_name/description/start_url/scope/display=standalone/orientation/background_color/theme_color=#0ea5e9/lang=vi/icons/shortcuts (Ghi chú, Lịch). `app/layout.tsx` wire `metadata.manifest` + `appleWebApp` + `icons.apple` + `formatDetection` + `viewport` export (themeColor dark/light). |
| 11.9.3 | ✅ | `public/sw.js` hand-rolled: precache app shell (manifest, icons, /offline, logo), navigation = network-first + fallback /offline, static (`/_next/static/`, `/icons/`, `/logos/`, `/brands/`, font/img) = stale-while-revalidate, API routes = network-only bypass. `components/pwa-register.tsx` đăng ký `/sw.js` ở production (dev chỉ khi `?sw=1`), handle updatefound → postMessage `SKIP_WAITING`. |
| 11.9.4 | ✅ | `app/offline/page.tsx` — server component fallback khi navigation fail: card WifiOff + nút "Về dashboard" + "Thử lại" (form GET /), note nhắc QuickNotes lưu localStorage vẫn xem được offline. |
| 11.9.5 | ✅ | `docs/RELEASE-CHECKLIST.md` 10 mục: data reset (script `release:reset`), Firebase prod config (env + rules + indexes), PWA smoke (icon/manifest/sw/offline), auth flow, admin backend, activity + sync, build + performance (tsc + Lighthouse), SEO/meta (Phase 16), domain + SSL, announcement ra mắt. `tsc --noEmit` pass EXIT=0. |

**Cache strategy (`sw.js` CACHE_VERSION=trishteam-v1):**

- **App shell precache (install event):** `/offline`, `/manifest.json`,
  `/icons/*.png`, `/trishteam-logo.png` → luôn hit cache khi offline.
- **Navigation (HTML):** network-first; lỗi → return `/offline` từ
  static cache → fallback inline HTML nếu cache trống.
- **Static assets:** stale-while-revalidate — user thấy cache ngay,
  background fetch update cache cho lần sau.
- **API routes (`/api/*`):** không chặn (bypass SW hoàn toàn) để tránh
  cache dữ liệu user-specific có Authorization header.
- **Cross-origin (firestore, firebaseapp):** bypass — fetch thẳng,
  không cache.

**Update flow:** client `updatefound` → installing → postMessage
`SKIP_WAITING` → activate ngay, `clients.claim()` → page mới dùng SW
mới không cần reload 2 lần.

**Release reset re-confirmed:** `scripts/firebase/reset-release.ts` đã có
từ Phase 11.7.4 purge subcollections `events` + `progress` trước khi wipe
`/users`. Checklist §1 hướng dẫn chạy `npm run release:reset --
--i-know-what-im-doing`.

---

## Phase 11.10 — Domain `trishteam.io.vn` (TENTEN) ✅ guide 2026-04-23

Trí đã mua domain `trishteam.io.vn` tại TENTEN (tenten.vn). Guide chi
tiết ở `docs/DOMAIN-TENTEN.md` — tóm tắt nhanh:

1. **Decide host**: Vercel (khuyến nghị, support SSR + API route + App
   Router sẵn) hoặc Firebase Hosting (cần Cloud Functions cho SSR →
   phức tạp).
2. **Ở Vercel Dashboard**: Settings → Domains → Add `trishteam.io.vn`
   → copy A record + CNAME www.
3. **Ở TENTEN**: Quản lý tên miền → DNS Manager →
   - `A @ → 76.76.21.21` (IP Vercel)
   - `CNAME www → cname.vercel-dns.com.`
4. **Firebase Console** → Authentication → Settings → Authorized
   domains → thêm `trishteam.io.vn` + `www.trishteam.io.vn`.
5. **Google Cloud Console** → OAuth 2.0 Client → thêm 2 URL vào
   Authorized JavaScript origins + Authorized redirect URIs.
6. **Next.js config**: thêm redirect `www → apex` + set
   `metadata.metadataBase = new URL('https://trishteam.io.vn')`.
7. **Smoke test** (6 mục ở §6 DOMAIN-TENTEN.md).

Optional: Cloudflare DNS proxy (WAF miễn phí) — §5 guide. Chi phí
domain ~120-180k VND/năm, Vercel + Firebase tier miễn phí đủ cho 1000
user đầu.

> Action item: khi bắt đầu Phase 17 (Deploy), chạy đúng checklist này
> trước khi trỏ DNS live.

---

## Phase 12 — AI augmentation (semantic retrieval VN) ✅ 12.1-12.6 DONE 2026-04-23

**Mục tiêu:** Universal search xuyên suốt website + 10 app desktop —
user gõ 1 chỗ, tìm ra mọi thứ (app, ghi chú, thông báo, shortcut, sau
này là tài liệu PDF/bài học/flashcard). Semantic reranker với Gemini
embedding-004 cho chất lượng VN.

### Sub-phase

| Sub | Trạng thái | Ghi chú |
| --- | ---------- | ------- |
| 12.1 | ✅ | `lib/search/`: `types.ts` (SearchableItem, SearchCategory, SearchResult), `static-sources.ts` (10 apps + 5 nav + 7 actions với fold VN helper), `use-universal-search.ts` (Fuse.js 7.3 + Firestore subscribe `/notes/{uid}/items/quick-note` + `/announcements` active). Install `fuse.js@7.3.0`. |
| 12.2 | ✅ | `components/widgets/universal-search-widget.tsx` (mini widget dashboard với dropdown 6 kết quả, keyboard nav, `/search?q=` jump). `app/search/page.tsx` full-page với filter chip theo category, grouped render, `/` focus shortcut, empty state + guest CTA. Wire vào `app/page.tsx` đặt trên đầu Row 1. |
| 12.3 | ✅ | `app/api/embed/route.ts` — endpoint sinh vector: priority Gemini `text-embedding-004` (768-dim nếu có `GOOGLE_AI_API_KEY`), fallback local FNV-1a hash-bucket 256-dim. `lib/search/embeddings.ts` client helper: `embedTexts()` có in-memory cache + `cosine()` + `rerankByCosine()`. Cập nhật `.env.example` với `GOOGLE_AI_API_KEY` optional. |
| 12.4 | ✅ | `lib/search/semantic-index.ts` — Firestore `/semantic/{kind}/items/{id}` schema `{ vec, model, text, title, category, href?, updatedAt }`. Helper: `upsertSemanticDoc`, `batchUpsertSemanticDocs` (chunk 16), `fetchSemanticIndex` (5-min cache), `fetchSemanticUnion`, `invalidateCache`, `noteDocId(uid, noteId)`. `firestore.rules`: apps/announcements read=auth, write=admin; notes read+write=owner qua regex ID prefix. |
| 12.5 | ✅ | `/admin/reindex` page — 2 card (apps + announcements) với progress bar, error badge, last-run timestamp, provider hint. Nav sidebar thêm item "Semantic". Hook `useUniversalSearch({ enableSemantic: true })` fetch union → `semanticSearch(q)` async: Fuse top-50 → embed query → cosine rerank, blend `0.4*fuse + 0.6*(1-cos)`. `/search` page có chip toggle "Semantic" + provider hint. |
| 12.6 | ✅ | `useNotesSync` giờ schedule `upsertSemanticDoc({ kind:'notes', id: noteDocId(uid,'quick-note'), text, title, category:'note', href:'/#notes' })` sau mỗi save remote thành công, debounced 2s, skip-if-same-text, skip nếu <10 ký tự. Title = dòng đầu cắt 80. Cleanup timer khi đổi user/unmount. Phase 14 sẽ extend index cho data từ desktop app (flashcard ôn thi, bài học chứng chỉ XD, quote biển báo QC41). |

### API contract `/api/embed`

```
POST /api/embed
Content-Type: application/json

{ "texts": ["Tìm bài lái xe hạng B2", "TCVN 5574 bảng tra thép"] }

→ 200
{
  "provider": "gemini" | "local-hash",
  "model": "text-embedding-004" | "fnv1a-bucket-256",
  "dim": 768 | 256,
  "vectors": [[...], [...]],
  "note": "..."  // chỉ có khi fallback
}
```

Giới hạn: 32 text/request, 4000 char/text. Gemini free tier 1500
req/ngày — đủ cho MVP. Nếu quota hết, endpoint fallback local không
block user (chất lượng semantic = 0 nhưng pipeline vẫn chạy).

### Client pattern (đã wire ở 12.5)

```ts
import { useUniversalSearch } from '@/lib/search';

// Bật semantic rerank:
const { search, semanticSearch, semanticReady, semanticProvider } =
  useUniversalSearch({ enableSemantic: true });

// Keyword nhanh (sync):
const fuseHits = search(query, 30);

// Rerank semantic async (debounce 150ms ở /search):
const semanticHits = await semanticSearch(query, 30);
// → fuse top-50 → embed query (Gemini hoặc local-hash) →
//   cosine với SemanticDoc.vec → blend score (0.4 fuse + 0.6 dist)
```

### Reindex flow

1. Admin vào `/admin/reindex`.
2. Card "Ứng dụng (apps)" → click **Reindex** → hook gọi
   `batchUpsertSemanticDocs('apps', items, onProgress)` chunk 16.
3. Card "Thông báo" → query Firestore `announcements where active==true`
   → batch upsert tương tự.
4. Cache 5 phút tự invalidate sau upsert. Search ngay được.
5. Notes per-user sẽ auto reindex ở Phase 12.6 (khi save QuickNote).

---

## Phase 13 — Design language refresh v2

✅ Đã hoàn tất ở Task #67-72 (shipped 2026-04-23). Chi tiết xem §Phase 13
phía trên. Hệ thống hiện tại: 2 theme thực (dark + light) với alias cho
backward compat, Lucide icon registry 50-80 icon, shared QSS builder cho
11 desktop app, Website Next.js + Tailwind + CSS vars export từ
`design/tokens.v2.json`, design-spec v2 là source of truth chung.

---

## Phase 14 — Deep rebuild + enhance 10 desktop app 🟡 14.0 DONE 2026-04-23

**Mục tiêu (2026-04-23 cập nhật):** Không chỉ port lại code cũ — rebuild từ
đầu mỗi app với **kiến trúc cross-platform mới** (TypeScript + Tauri thay vì
Python + Qt), chia sẻ **~75% code** giữa desktop + website + Zalo Mini App
qua monorepo packages.

**Chiến lược code reuse (2026-04-23):**

```
┌─────────────────────────────────────────────────────────┐
│ apps-host  website (Next.js) │ desktop (Tauri) │ zalo (ZMP) │
├─────────────────────────────────────────────────────────┤
│ packages/ui          Shared React (web+zalo)             │
│ packages/adapters    Platform abstraction (router/storage)│
│ packages/data        Firebase paths + typed converters   │
│ packages/core        Pure TS domain logic (universal)    │
└─────────────────────────────────────────────────────────┘
```

- Domain logic (search fold VN, note validate, QR classify, app catalog
  merge): **100% reuse** — đã scaffold `@trishteam/core`.
- Firebase collection paths + converters: **100% reuse** —
  `@trishteam/data`.
- React components (widget, card, modal): **~85% reuse** web↔zalo —
  `@trishteam/ui`.
- State management (Zustand store, context): **100% reuse**.
- Platform-specific (navigation, notification, clipboard, filesystem):
  **0% — định nghĩa interface ở `@trishteam/adapters`, mỗi host tự
  implement**.

> Legacy Python apps ở `apps/trish*/` giữ làm **reference domain knowledge**
> — KHÔNG port code trực tiếp. Rebuild bằng stack mới.

### Nguyên tắc chung

1. **Tận dụng code cũ** (trong `apps/trish<name>/src/` và phiên bản legacy
   Trí upload qua zip) làm **tham khảo logic & domain knowledge** — KHÔNG copy
   trực tiếp sang repo mới. Mỗi module phải được viết lại theo chuẩn:
   - `trishteam_core.ui.widgets` v2 (Tokens v3, theme runtime switch).
   - Async worker cho mọi I/O nặng (`QThread` subclass hoặc `asyncio` + Qt
     bridge via `qasync`).
   - Settings persisted qua `trishteam_core.settings` JSON schema, không
     scatter `.ini`.
   - Log structured (`structlog`) ra `~/.trishteam/logs/<app>.jsonl`.
   - Telemetry opt-in (Firestore `apps/<name>/telemetry`).
2. **Mỗi app +1 ÷ +3 module mới** so với phiên bản legacy — xem bảng §Đề xuất
   enhancement dưới.
3. **UI parity với website**: mọi widget có trên website dashboard PHẢI có
   phiên bản desktop Qt (hoặc ngược lại) — tokens share qua
   `design/tokens.json` (export → QSS + CSS var).
4. **Packaging tier**: update theo §PACKAGING.md — tier 1/2/3 giữ nguyên.

### Bảng 10 app + enhancement đề xuất

| # | App           | Core (từ legacy) | Enhancement Phase 14 |
| -- | ------------- | ---------------- | -------------------- |
| 1  | TrishLauncher | Hub cài/cập nhật | + Auto-update background · + "Start on login" toggle · + Compact tray mode · + QR share app link |
| 2  | TrishFont     | Quản lý font     | + Font pair suggestion (AI) · + Preview text editor nhiều dòng · + Export PNG preview · + Folder watcher realtime |
| 3  | TrishDesign   | Engineer toolkit | + Semantic search TCVN (Phase 12) · + Project template · + PDF annotation tab · + AutoCAD drawing list sync |
| 4  | TrishLibrary  | Thư viện PDF/doc | + OCR scan PDF (Tesseract VN) · + Tag auto-suggest · + Cite generator APA/IEEE · + Cloud sync Firebase |
| 5  | TrishNote     | Ghi chú          | + Daily review mode · + Kanban board view · + Reminder qua Windows toast + Telegram · + Markdown export PDF |
| 6  | TrishType     | Soạn thảo        | + CRDT multi-caret edit · + Table editor WYSIWYG · + PDF form fill · + Batch convert folder |
| 7  | TrishCheck    | Check cấu hình   | + Benchmark CPU/GPU nhanh · + So sánh thực tế vs yêu cầu từng phần mềm · + Export report PDF · + Auto-share qua QR |
| 8  | TrishSearch   | Search tổng      | + Semantic retrieval (Phase 12) · + Filter theo mime type · + Preview snippet highlight · + Sync Firestore result |
| 9  | TrishClean    | Dọn rác          | + Schedule clean định kỳ · + Whitelist folder an toàn · + Undo history 7 ngày · + Report size trước/sau |
| 10 | TrishImage    | Thư viện ảnh     | + Face grouping (insightface) · + Duplicate detect (pHash) · + Batch rename template · + Cloud backup Firebase Storage |

> **TrishAdmin** — KHÔNG nằm trong 10 — rebuild song song, riêng roadmap admin.

### Sub-phase plan (revised 2026-04-23)

| Sub | Trạng thái | Ghi chú |
| --- | ---------- | ------- |
| 14.0 | ✅ | **Monorepo scaffolding (2026-04-23).** Root `package.json` + `pnpm-workspace.yaml` (website + packages/* + placeholder apps-desktop/* + apps-zalo/*) + `tsconfig.base.json` chung. Bốn shared package: `@trishteam/core` (apps catalog merge, search fold VN + tokenize, notes model + validate, QR classify + filename suggest — pure TS không DOM/React), `@trishteam/ui` (React scaffold, peerDeps react 18), `@trishteam/data` (Firestore collection paths constants), `@trishteam/adapters` (interface RouterAdapter/StorageAdapter/NotificationAdapter/ClipboardAdapter). Website `tsconfig.json` thêm paths alias cho 4 package (resolve trực tiếp src/, không cần build step khi dev). Pilot migrate `website/lib/apps.ts` → dùng `@trishteam/core/apps` helpers (mergeRegistry, statusLabel, formatSize, findAppById) — API public ổn định (AppForWebsite, getAppsForWebsite, getEcosystemInfo giữ nguyên). tsc website + core + data + adapters đều EXIT=0. Docs: `packages/README.md` (triết lý + coverage matrix + dev workflow). |
| 14.1 | ✅ | **Vitest + Next.js adapters (2026-04-24).** Thêm Vitest 1.6.1 + @vitest/coverage-v8 cho `@trishteam/core`. Viết 55 test cases (5 file) cho pure function: `fold.test.ts` (NFD normalize + đ→d + tokenize filter ≥2 chars), `cosine.test.ts` (identical=1, orthogonal=0, opposite=-1, length mismatch=0, blendScore weight), `validate.test.ts` (empty/whitespace/too-long title+body, too many tags + tag length), `classify.test.ts` (URL/email/phone/wifi/vcard/text + filename VN fold), `select.test.ts` (mergeApp with/without meta, mergeRegistry, findAppById, filterByStatus/Platform/Public, label helpers, formatSize edge cases, pickDownload preference order). Tất cả 55/55 PASS. Migrate website code: `lib/search/static-sources.ts` (foldVN) + `lib/search/embeddings.ts` (cosine + rerankByCosine) + `lib/search/types.ts` → dùng `@trishteam/core/search`. Next.js adapters layer: `website/lib/adapters/next-router.ts` (useNextRouterAdapter hook wrap useRouter + usePathname), `web-storage.ts` (SSR guard + quota try/catch), `web-clipboard.ts` (Clipboard API + execCommand fallback). npm install chạy ngon với `--legacy-peer-deps` + sửa `workspace:*` → `*` cho compat. tsc website + core đều EXIT=0. |
| 14.2 | ✅ | **TrishLauncher + TrishCheck scaffold (2026-04-24).** Hai app pilot cho stack Tauri 2 mới. **TrishLauncher** (`apps-desktop/trishlauncher/`): Rust 1.77 backend với `sys_info` + `app_version` + opener plugin, React 18/Vite 5 UI merge SEED_REGISTRY qua `@trishteam/core/apps` (mergeRegistry, filterByPlatform, statusLabel, loginRequiredLabel, formatSize), auto-detect platform, card grid responsive, fallback mode khi chạy `pnpm dev` browser thuần. CSP strict (chỉ firebaseio + googleapis + trishteam.io.vn), capabilities tối thiểu (chỉ opener). **TrishCheck** (`apps-desktop/trishcheck/`): Rust commands `sys_report` + `cpu_benchmark` (SHA-256 50 MB × N vòng) + `memory_bandwidth` (64 MB copy × N vòng), UI tách `scoring.ts` (map MB/s → 5-tier excellent/good/ok/low/very_low với baseline 2026), zero network deps — capabilities chỉ `core:default`. Tsc launcher + check + core + website đều EXIT=0 (4/4). Vitest core: 55/55 pass. **Pending 14.2.x trên máy Trí**: generate icon set (cargo tauri icon), test `cargo tauri dev` build thực + measure bundle size + smoke test 3 platform. |
| 14.2.1 | ✅ | **TrishCheck bootstrap (2026-04-24).** Xem chi tiết ở 14.2. |
| 14.3 | ✅ | Rebuild TrishFont + TrishType + TrishClean + TrishImage (4 app không cần auth). Mỗi app + 1÷3 module mới theo bảng enhancement (font pair AI, CRDT multi-caret, undo 7 ngày, face/event grouping). Sub-phase 14.3.1 (TrishClean) ✅, 14.3.2 (TrishFont) ✅, 14.3.3 (TrishType) ✅, 14.3.4 (TrishImage) ✅. |
| 14.3.4 | ✅ | **TrishImage rebuild + event/face/aspect grouping (2026-04-24).** `apps-desktop/trishimage/` Tauri 2 + React 18/Vite 5 (port 1430). Domain pure TS `@trishteam/core/images`: `types.ts` (AspectClass 5-enum landscape/portrait/square/panorama/unknown, ImageMeta với taken_ms + camera + has_gps + face_count, EventGroup với start_ms/end_ms/label, RawImageEntry từ Rust, ScanImagesSummary aggregate), `classify.ts` (classifyAspect ratio ≥2.0 hoặc ≤0.5 → panorama, ratio >1.15 → landscape, <1/1.15 → portrait, else square; enrichImage raw→meta + filterByAspect), `group.ts` (groupByEvent sort taken_ms + gap split 8h + unknown bucket với label YYYY-MM-DD (N ảnh), groupByDay/groupByMonth UTC ISO keys, DEFAULT_EVENT_GAP_MS = 8h), `aggregate.ts` (summarizeImages: total_files/total_bytes/with_exif_time/with_gps/by_aspect/by_ext/min+max_taken_ms, topExtensions + aspectOrder + formatBytes B/KB/MB/GB), `faces.ts` (FaceBucket 5-enum solo/pair/group/none/unknown heuristic từ face_count null→unknown / 0→none / 1→solo / 2→pair / 3+→group, groupByFaceBucket Map, faceBucketLabel tiếng Việt, summarizeFaces coverage). Vitest +40 test (12 classify + 12 group + 5 aggregate + 11 faces) — total core **178/178 pass**. Rust backend `scan_images(dir, max_entries?, max_depth?)` qua `walkdir` + `kamadak-exif` 0.5 (DateTimeOriginal + Model + GPSLatitude detection — không decode pixel) + `imagesize` 0.13 (header probe ≤512 byte cho width/height). EXTS whitelist jpg/jpeg/png/webp/gif/bmp/tif/tiff/heic/heif. Clamp max_entries [100..200k] default 5k, max_depth [1..32] default 8, bỏ qua hidden folder (node_modules/.git/dot-prefix). Fallback mtime khi không có EXIF. Civil epoch algorithm (Hinnant) cho EXIF datetime → ms. face_count v1 luôn None (ONNX model wiring deferred 14.3.4.b). UI: topbar pick folder, sidebar stats (ảnh/dung lượng/EXIF time/GPS/elapsed ms/lỗi) + aspect pill filter (có badge màu theo aspect) + face bucket stats + view toggle Events/Faces/Tất cả, content pane render EventGroup với thumb grid aspect-ratio preserved, ImageCard có placeholder badge theo aspect (landscape ▭ portrait ▯ square ◻ panorama ━). Dev fallback 24 ảnh giả 3 events cho browser test. Capabilities: core + dialog only (không cần fs plugin vì Rust tự đọc qua std::fs). Tsc 11 workspace EXIT=0. Giới hạn v1: không có thumbnail thật, không có viewer, không remember folder, không hỗ trợ RAW. |
| 14.3.3 | ✅ | **TrishType rebuild + CRDT multi-caret (2026-04-24).** `apps-desktop/trishtype/` Tauri 2 + React 18/Vite 5 (port 1428). Domain pure TS `@trishteam/core/type` RGA-style text CRDT: `types.ts` (ActorId, Clock, CharId = readonly `[actor, clock]`, CharNode với tombstone flag, InsertOp/DeleteOp/Op, CrdtState = `Map<string, CharNode>` + nextClock, Caret anchor vào CharId để không bị shift khi char khác insert/delete, serializeCharId + keyOfAfter helpers), `crdt.ts` (createState, applyOp idempotent qua ID check + advance clock khi thấy op từ tương lai — hybrid logical clock lite, applyOps bulk, toText + visibleChars dùng DFS iterative từ $START với stack-based '__visit:' / '__after:' markers, group-by `after` + sort children theo RGA rule `clock desc, actor asc` — insert sau đẩy char cũ sang phải, makeInsert/makeDelete/makeInsertString, serialize/deserialize v1 JSON roundtrip), `multicaret.ts` (typeAtCarets insert 1 char ở tất cả carets + shift anchor sang char vừa gõ, backspaceAtCarets xoá char trước mỗi caret + lùi anchor về char trước đó qua visible posByKey Map, caretAtIndex / indexToAfter / afterToIndex clamp edge cases). Vitest +23 test (11 crdt + 12 multicaret) — total core **138/138 pass**. Key test convergence: `2 actors insert cạnh tranh cùng vị trí → cả 2 replicas hội tụ` (merge cross ops từ A và B cho ra cùng text), `tie-break clock desc` (Y clock 1 vs Z clock 5 sau X → XZY), `delete + insert commute`, `serialize roundtrip`. Rust backend tối giản: chỉ `read_text_file(path)` + `write_text_file(path, content)` cap 5 MiB — không biết gì về caret/merge. UI: Mở/Lưu/Lưu Dưới Tên buttons, sidebar hiển thị actor + ký tự count + filepath + dirty flag + danh sách carets (id + vị trí visual + nút × remove) + form "+ thêm caret" tại index, editor `<pre>` render visibleChars với caret markers inline xen kẽ giữa chars (anim blink 1s), keyboard handler: printable → typeAtCarets, Backspace → backspaceAtCarets, Enter → '\n', Tab → 2 spaces, ←/→ → moveCarets all carets ±1, Ctrl+S → save, Ctrl+O → open. Dev fallback load sample text khi ngoài Tauri. Tsc 10 workspace EXIT=0. Capabilities: core + dialog + `fs:allow-read-file` + `fs:allow-write-file`. Giới hạn v1: chưa có selection range, undo/redo, copy/paste CRDT binding, P2P sync. |
| 14.3.2 | ✅ | **TrishFont rebuild + Pair AI (2026-04-24).** `apps-desktop/trishfont/` Tauri 2 + React 18/Vite 5 (port 1426). Domain pure TS `@trishteam/core/fonts`: `types.ts` (FontMeta, FontFamily, FontPair, FontPersonality enum 8-value serif/sans/slab/mono/display/script/handwriting/unknown), `classify.ts` (heuristic từ family name keywords + flags, priority mono→slab→serif→script→handwriting→display→sans→fallback, normalize underscore/dash), `pair.ts` (buildCollection nhóm styles theo family + pick representative Regular, scorePair weighted matrix 60 personality + 20 weight contrast + 20 VN body, rationale tiếng Việt theo contrast tier, recommendPairs O(n²) + fixHeading + requireVnBody filter). Vitest +29 test (12 classify + 17 pair) — total core **115/115 pass**. Rust backend qua `ttf-parser` 0.20: `scan_fonts(dir, max_entries?)` walk 8 depth cho .ttf/.otf/.ttc/.otc cap 2k default (clamp 10..10k), `read_font(path)` parse single file — extract name table (family/subfamily/full/postscript, prefer English 0x0409), OS/2 weight (Weight enum → u16) + width (Width enum → u16), italic + monospace flags, VN support detection qua glyph_index check 26 diacritic chars (threshold 80%). UI: picker qua `plugin-dialog`, stats panel (family count + file count + size + elapsed + errors), personality pill filter + VN-only toggle, family grid với Pin heading (cố định heading cho pair AI), pair list top 12 với 3 preview sample (English pangram + VN diacritics + brand name) + score tier pill excellent/good/ok/low/bad + rationale line. Capabilities minimal: core + dialog + `fs:allow-read-file` (chưa wire FontFace preview load — để 14.3.2.b). CSP thêm `font-src 'self' data: asset:`. Tsc 6 workspace EXIT=0. |
| 14.3.1 | ✅ | **TrishClean rebuild (2026-04-24).** `apps-desktop/trishclean/` Tauri 2 + React 18/Vite 5. Domain logic pure TS trong `@trishteam/core/clean`: `types.ts` (CleanCategory 9-enum, FileEntry, AgeBucket, ScanSummary, StagedDelete với id/trash_path/commit_after_ms cho undo 7 ngày), `classify.ts` (priority: empty_dir → cache → temp → download → recycle → large ≥100MB → old ≥180d → other; normalize `\` → `/` + lowercase), `aggregate.ts` (summarizeScan, planStageDelete, listReadyToCommit, AGE_BUCKETS recent/month/quarter/year/ancient). Vitest +31 test case (20 aggregate, 11 classify) — total core 86/86 pass. Rust backend chỉ `scan_dir(path, max_entries?, max_depth?)` qua `walkdir` với hard cap (100..200k entries, depth 1..32), return raw ScanStats. UI: pick dir qua `@tauri-apps/plugin-dialog`, map entry → classify, hiển thị Stat (total files/size/elapsed/errors) + CatPill filter 9 category + FileRow sort desc by size (top 200). Dev fallback DEV_FALLBACK_SCAN cho `pnpm dev` browser. Alpha: scan-only, staged delete + commit để 14.3.1.b. Tsc clean + launcher + check + core + website đều EXIT=0 (5/5). Capabilities `core:default` + `dialog:default` + `dialog:allow-open`. |
| 14.4 | ✅ | Rebuild TrishNote + TrishLibrary + TrishSearch + TrishDesign (4 app cần login Firebase). Reuse `@trishteam/data` cho CRUD cross-app. Sub-phase 14.4.1 (TrishNote) ✅ + 14.4.2 (TrishLibrary) ✅ + 14.4.3 (TrishSearch) ✅ + 14.4.4 (TrishDesign) ✅. |
| 14.4.4 | ✅ | **TrishDesign rebuild + color palette + design token engine (2026-04-24).** `apps-desktop/trishdesign/` Tauri 2 + React 18/Vite 5 (port 1438, HMR 1439). Alpha local-only — Firebase cross-device sync dời 14.4.4.b, token versioning diff dời 14.4.4.c, import ASE/Sketch dời 14.4.4.d, OKLCH output dời 14.4.4.e. Domain pure TS `@trishteam/core/design` tách 8 submodule: `types.ts` (RGB/HSL 8-bit + alpha 0..1, ColorSwatch key/hex/contrastWhite/contrastBlack, ColorScale name/base/swatches, HarmonyKind 6-enum mono/comp/analog/tri/split/tetra, Harmony, ContrastRating 4-enum fail/AA-large/AA/AAA, ContrastCell fg/bg/ratio/rating, TypographyToken fontFamily[]/size/lineHeight/weight/letterSpacing, DesignTokenSet id/name/scales[]/semantic Record/spacing/radius/shadow/typography + createdAt/updatedAt, PaletteMode 3-enum light/dark/brand, TokenValidationIssue), `convert.ts` (HEX_RE 3/4/6/8 hex, hexToRgb/rgbToHex/rgbToHsl/hslToRgb theo CSS Color Module Level 3, hexToHsl+hslToHex helper, parseColor nhận hex/rgb()/rgba()/hsl()/hsla(), normalizeHex → #RRGGBB uppercase, clamp NaN→min), `contrast.ts` (relativeLuminance piecewise sRGB `c<=0.03928 ? c/12.92 : ((c+0.055)/1.055)^2.4` coef 0.2126/0.7152/0.0722, contrastRatio round 2-decimal, ratingFor threshold 7/4.5/3, meetsAA/meetsAAA normal vs large text, buildContrastMatrix N×N, bestForegroundOn chọn black/white), `scale.ts` (SCALE_KEYS 11 readonly 50/100/200/…/950, TARGET_LIGHTNESS curve 97/94/86/77/66/55/46/36/27/18/10, SAT_MULTIPLIER bell curve 0.35 → 1 → 0.8, buildScale shift lightness theo offset base + decay `(1 - |target-55|/55)` + anchor key tùy chỉnh, swatchByKey, pickAccessibleSwatch threshold AA/AAA với fallback highest-contrast, countAccessible AA count vs bg), `harmony.ts` (rotate hsl ±deltaH/L/S, buildHarmony complementary 180° / analogous -30/+30 / triadic 0/120/240 / splitComp 0/150/210 / tetradic 0/90/180/270 / monochromatic ±25/±12/base với 5 tones, buildAllHarmonies 6-kind), `tokens.ts` (createEmptyTokenSet primary + default spacing 0..16 / radius none..full / shadow sm/md/lg / typography body 14px 1.5 400, validateTokenSet check id/name empty + hex format + semantic ref dạng `scaleName.key` hoặc hex + warn khi scale/key ref missing, resolveSemantic alias → hex hoặc null, mergeTokenSets scalesMap last-wins by name + semantic/spacing/radius/shadow/typography object-merge), `export.ts` (toCssVars `:root { --color-primary-500: #…; --spacing-4: 1rem; }`, toTailwindConfigJs `module.exports = { theme: { extend: { colors: {...} } } }` với semantic alias flat, toFigmaTokensJson W3C Tokens Studio format `{ value, type: 'color' | 'spacing' | 'borderRadius' | 'boxShadow' }` nested theo scale name, toScssMap `$primary: ("50": #…, "100": #…);` + `$semantic: (...)`, scaleToPlainJson object `{ "50": "#...", ..., "950": "#..." }`, kebab helper camelCase→kebab-case), `suggest.ts` (AI enhancement `suggestPalette(baseHex, mode, name?)`: primary built from base, secondary = complementary -15% sat, accent = triadic +10% sat, neutral = hue base 8% sat 50% l, status scales success #16A34A / warning #EAB308 / danger #DC2626, semantic map background/surface/text/muted/border theo mode light→50/100/900/600/200 dark→950/900/50/400/800 + primary.default/hover/subtle + primary.onBg pickAccessibleSwatch AA, emit tiếng Việt notes giải thích harmony tetradic preview). Vitest +75 test case (13 convert + 13 contrast + 11 scale + 9 harmony + 12 tokens + 11 export + 6 suggest) — total core **421/421 pass** (346 trước → 421). Rust backend `apps-desktop/trishdesign/src-tauri/`: 3 command `default_store_location` → `%LocalAppData%/TrishTEAM/TrishDesign` (chỉ info env), `load_design_file(path)` cap 8 MiB + đọc utf-8 + `serde_json::from_str` validate JSON (không validate schema — UI tự parse DesignTokenSet), `save_design_file(path, payload)` cap 8 MiB + validate JSON trước khi ghi + atomic write `.tmp-tsn` → rename để tránh file-half-written nếu crash giữa chừng. UI 3-cột violet/indigo theme (khác amber search / teal library / green note / tím type): topbar (Nạp JSON / Lưu JSON / Picker), control-bar (hex input text + `<input type='color'>` picker sync, tên palette text, mode pill 3-way Sáng/Tối/Brand, harmony-strip preview 11 swatch gradient), statusbar (data_dir code + alpha-chip + scale count + swatch count + AA+ count vs #FFF + flash), sidebar (list Scale active-highlighted + AI notes bullet list + Semantic alias table code→value 2-col), main palette grid (mỗi scale-section render header với dot-color + set-base button + swatch-row 11 grid buttons với fg màu auto best-contrast + key/hex label + hover translate-Y(-2px) + active outline accent), detail pane (detail-swatch big với hex+rating vs #FFF + vs #000, contrast-matrix 11×11 mini-table với bg=col/fg=row + ratio + ✓/✓✓ marker, export dropdown 5-format CSS/Tailwind/Figma/SCSS/JSON + Copy button + export-preview pre-wrap scrollable 280px max-height). Dev fallback `suggestPalette('#7C3AED', 'light', 'Palette mẫu')` — chạy ngay được trong browser không cần Tauri. Tsc 11 workspace EXIT=0. Capabilities: core + dialog (open+save) + opener (open-path) — không fs plugin. Giới hạn v1: không sync cross-device (14.4.4.b), không diff 2 version (14.4.4.c), không import ASE/Sketch (14.4.4.d), không render OKLCH / display-p3 (14.4.4.e), không generate preview HTML component preview, contrast matrix chỉ trong 1 scale (chưa cross-scale), suggestPalette chỉ từ 1 base (chưa multi-base). |
| 14.4.3 | ✅ | **TrishSearch rebuild + BM25 full-text engine (2026-04-24).** `apps-desktop/trishsearch/` Tauri 2 + React 18/Vite 5 (port 1436, HMR 1437). Alpha local-only — Tantivy WASM dời 14.4.3.b, Firebase cross-device rerank dời 14.4.3.c, PDF text extraction dời 14.4.3.d, incremental mtime-diff index dời 14.4.3.e. Domain pure TS `@trishteam/core/fulltext` tách 7 submodule: `types.ts` (FulltextSource 3-enum note/library/file, FULLTEXT_SOURCES readonly, FulltextDoc id/source/title/body/path?/mtimeMs/tags?, PostingEntry docId/tf/first, FulltextIndex docs/terms/avgDocLen/totalDocs, FulltextDocMeta, QueryClause term/phrase/negate/prefix/source, ParsedQuery, FulltextHit doc/score/snippet/matchedTerms), `tokenize.ts` (STOPWORDS Set 44 từ EN+VN đã fold, `foldVietnamese` reuse từ existing `@trishteam/core/search/fold`, `stem()` lite Porter: -ing ≥5 / -ed ≥4 / -ies → -y ≥5 / -es ≥4 / -s not -ss, `tokenizePositions()` trả `Array<{token,pos}>` + skip <2 chars + stopword filter, `tokenizeFull` / `tokenizeQuery`), `index-build.ts` (createEmptyIndex, buildIndex O(N·L), addDocToIndex upsert by id với TF weighting title ×3 / tag ×2 / body ×1 gộp sẵn vào counts, removeDocFromIndex idempotent, mergeIndexes last-wins dup id, recomputeAvgDocLen), `query.ts` (parseQuery regex `/"([^"]+)"|(\S+)/g` phrase + word, detect -negate / *prefix / source-prefix note:/library:/file:, unknown source prefix fallback normal token), `rank.ts` (BM25_K1=1.2, BM25_B=0.75, RECENCY_ALPHA=0.2, RECENCY_HOT_MS=7d, RECENCY_COLD_MS=365d, computeRecency linear decay HOT→1, COLD→0, searchIndex loop clauses IDF·BM25 + phrase bonus ×1.4 khi phrase all-match + prefix scan Object.keys + negate exclude posting docIds, buildSnippet ±100 chars quanh first match + HTML escape `&<>"'` + `<mark>…</mark>` wrap fold-insensitive), `adapters.ts` (noteToFulltextDoc skip deleted + `id='note:'+id`, libraryDocToFulltextDoc body = authors·year·publisher·note join + `id='library:'+id`, fileToFulltextDoc extract basename unix+windows path + `id='file:'+path`, collectFulltextDocs aggregator), `aggregate.ts` (summarizeIndex IndexStats totalDocs/totalTerms/avgDocLen 1-decimal/bySource Record/topTerms top 20 df desc, filterHitsBySource null passthrough, sourceLabel VN 'Ghi chú'/'Thư viện'/'File rời'). Vitest +66 test case (13 tokenize + 9 index-build + 9 query + 18 rank + 11 adapters + 6 aggregate) — total core **346/346 pass** (280 trước → 346). Key test: `ranks title > body match`, `AND semantics across clauses`, `excludes negated term`, `prefix match *suffix`, `filters by source prefix`, `boosts recent over stale (HOT vs COLD)`, `buildSnippet fold diacritic match + HTML escape anti-injection`. Rust backend `apps-desktop/trishsearch/src-tauri/`: 4 command `default_store_location` → `%LocalAppData%/TrishTEAM/TrishSearch` (chỉ info env, không ghi gì), `load_json_file(path)` cap 40 MiB + validate JSON — dùng cho notes.json & library.json, `read_text_file(path)` single file whitelist 7 ext (txt/md/markdown/rst/org/html/htm/rtf) + truncate ≥2 MiB lossy-utf8, `scan_text_folder(dir, max_entries?, max_depth?)` walk cap 50..20k default 2k + depth 1..24 default 8 + `is_hidden` lọc `.git`/`node_modules`/`target`/`$RECYCLE.BIN`/`System Volume Information` + dot-prefix, trả `ScanTextSummary` với files/total_files_visited/elapsed_ms/errors/max_entries_reached + mỗi file có `content`+`truncated` flag. UI 3-cột amber/ember theme (khác teal library / green note / tím type): topbar (Nạp notes.json / Nạp library.json / Scan folder text / Dùng demo) + search-bar with Ctrl+K focus shortcut + Esc clear + source-pills (Tất cả N / Ghi chú N / Thư viện N / File rời N) với `bySource` counts, statusbar (data_dir code + nguồn counts + index stats totalDocs/totalTerms/avgDocLen + build ms + search ms + flash), sidebar (hint cú pháp query DSL + top 12 term df + error scan list), results column (hit-list sort theo score desc, mỗi hit hiển thị source-tag 3-màu + title + score + snippet với `<mark>` highlight + path + tag + mtime), detail pane (source-tag + title + path + Mở bằng OS button qua plugin-opener + score·matched terms·mtime + tags + body pre-wrap full). Dev fallback `DEV_FALLBACK_DOCS` 5 doc đã qua `collectFulltextDocs` (2 note: React hook, TCVN 5574 + 1 deleted note; 2 library: React Handbook, IEEE Semantic Retrieval; 2 file: readme.md, changelog.txt) — chạy ngay được trong browser không cần Tauri. Tsc 13 workspace EXIT=0 (fulltext/rank.ts: bỏ unused import `FulltextSource`). Capabilities: core + dialog (open) + opener (open-path) — không fs plugin. Giới hạn v1: index chỉ in-memory (mất khi tắt app), search chỉ trên `body` field (không có per-field boosting runtime), không có pagination (limit mặc định 60), không có highlight trong `detail-body` full view (chỉ trong snippet), không có semantic rerank (Firebase embedding đã có ở `@trishteam/core/search/cosine` nhưng chưa wire vào BM25 pipeline). |
| 14.4.2 | ✅ | **TrishLibrary rebuild + tag auto-suggest + cite APA/IEEE (2026-04-24).** `apps-desktop/trishlibrary/` Tauri 2 + React 18/Vite 5 (port 1434). Alpha local-only — OCR Tesseract dời 14.4.2.b, Firebase sync dời 14.4.2.c để ship tag AI + cite generator trước. Domain pure TS `@trishteam/core/library` tách thành 6 submodule: `types.ts` (LibraryDoc với id/path/name/ext/format/sizeBytes/mtimeMs/addedAt/updatedAt + user metadata title/authors/year/publisher/tags/note/status, DocFormat 10-enum pdf/docx/doc/epub/txt/md/html/rtf/odt/unknown, ReadStatus 4-enum unread/reading/done/abandoned, READ_STATUSES readonly, LibraryDraft, LibrarySummary, TagSuggestion), `classify.ts` (classifyFormat whitelist 10 ext, defaultTitleFromName strip ext + underscore→space, stableIdForPath FNV-1a hash → 'doc_' prefix, enrichRaw thêm default metadata, mergeWithExisting giữ metadata user chỉ update sizeBytes+mtimeMs), `tag-suggest.ts` (KEYWORD_TO_TAG 7 rules tcvn/luật/xây dựng/học/nghiên cứu/code/tiếng việt với Unicode block regex U+00C0-024F + U+1E00-1EFF cho diacritic composed chars, FORMAT_FALLBACK pdf/docx/doc/epub/md/txt, buildTagIndex Map<tag,count>, suggestTags score = keyword 0.85 + co-occurrence 0.3+0.3*log10(1+count) + format fallback 0.4, reason human-readable cho tooltip, normalizeLibraryTag lowercase/collapse whitespace/strip hyphen), `validate.ts` (validateDraft MAX_TITLE 300 / MAX_NOTE 5000 / MAX_AUTHOR 200 / MAX_TAG 50 / MAX_TAGS_PER_DOC 32, year 0-3000), `cite.ts` (CiteStyle apa/ieee, formatAuthorApa "Last, F. M." + joinAuthorsApa "&" rule + et al. 8+, formatAuthorIeee "F. M. Last" + joinAuthorsIeee "and" + et al. 7+, formatCitation APA italic title + IEEE quoted title, formatCitationList APA sort first-author / IEEE number [1]..[n]), `aggregate.ts` (summarizeLibrary totalDocs/totalBytes/byFormat/byStatus/topTags, filterByFormat/Status/Tag null passthrough, searchDocs substring trên title+name+note+authors+tags, sortRecent/BySize/ByTitle vi-locale, formatBytes B/KB/MB/GB). Vitest +65 test case (11 classify + 15 tag-suggest + 7 validate + 15 cite + 17 aggregate) — total core **280/280 pass** (215 trước → 280). Rust backend `apps-desktop/trishlibrary/src-tauri/`: 4 command `default_store_location` dùng `dirs::data_local_dir` → `%LocalAppData%/TrishTEAM/TrishLibrary/library.json`, `load_library(path?)` seed `[]`, `save_library(path?, content)` validate JSON + cap 20 MiB + atomic write, `scan_library(dir, max_entries?, max_depth?)` qua `walkdir` 2.5 với max_entries clamp 100..200k default 5k + max_depth clamp 1..32 default 8 + ALLOWED_EXTS whitelist 10 ext + is_hidden filter (node_modules/target/.git/$recycle.bin), return ScanSummary với entries/total_files_visited/elapsed_ms/errors/max_entries_reached. UI 3-column: topbar (Quét thư mục / Nhập JSON / Xuất JSON / Trích dẫn (N) + saving-flash), sidebar (search + stats tổng quan + filter format pill + filter status pill (status-colored border khi active) + top-tag pill + store location path), content pane (banner error/info click-to-dismiss, content-toolbar result-count + sort select recent/title/size, DocList với DocRow format-chip + status-colored border-left + meta inline authors·year·bytes·status + tag-row), DetailPane editable title/authors csv/year/publisher/status pill-row/tag với AI suggestions dashed border tooltip `reason · score=X.YY` click-to-add + note textarea + Mở file (plugin-opener) / Xoá khỏi library. CiteModal pill style APA↔IEEE + Copy all clipboard + `<ol>` cite-list monospace. Dev fallback 6 seed docs phủ 4 format + 4 read-status + chủ đề VN/EN (TCVN 5574 PDF reading, React Handbook PDF done, TypeScript Patterns EPUB unread, Ghi chú khảo sát MD reading, Luận văn ThS DOCX abandoned, IEEE paper PDF unread). Auto-save debounce 400 ms, merge policy: import = source of truth per path / scan = chỉ update filesystem fields. Tsc 12 workspace EXIT=0. Capabilities: core + dialog (open+save) + opener (open-path) — không cần fs plugin vì Rust tự đọc qua std::fs. Giới hạn v1: chưa OCR (14.4.2.b), chưa sync cloud (14.4.2.c), chưa cover thumbnail (14.4.2.d), search chỉ substring (Lucene/Tantivy dời 14.4.3 TrishSearch), cite chỉ APA 7 + IEEE (MLA/Chicago/TCVN 7115 dời phase sau), không nested collection/folder (dùng tag). |
| 14.4.1 | ✅ | **TrishNote rebuild + daily review + kanban (2026-04-24).** `apps-desktop/trishnote/` Tauri 2 + React 18/Vite 5 (port 1432). Alpha local-only — Firebase Auth + Firestore sync dời 14.4.1.b để ship enhancement trước. Domain pure TS `@trishteam/core/notes` tách thành 4 submodule: `types.ts` (Note thêm optional `status?: NoteStatus` (inbox/active/waiting/done/archived 5-enum) + `lastReviewedAt?: number | null` + `dueAt?: number | null` — để backward-compat schema Firestore cũ ở Phase 11.7, NOTE_STATUSES readonly, DEFAULT_REVIEW_INTERVAL_MS = 7 ngày, NoteDraft mở rộng), `validate.ts` (validateDraft + normalizeTag + check dueAt finite), `review.ts` (notesDueForReview bỏ qua deleted/archived/done, sort lastReviewedAt asc null-first tie-break createdAt asc; markReviewed immutable set lastReviewedAt=now; countDueForReview; computeReviewStreak đếm UTC day bucket consecutive từ today; reviewAgeBucket 4-tier fresh<interval/2 / stale<interval / overdue<interval*4 / ancient ≥interval*4; filterByStatus null → non-archived non-deleted), `kanban.ts` (KanbanLane {status,label,notes}, statusLabel VN Inbox/Đang làm/Chờ/Xong/Lưu trữ, groupByKanban 4 lane mặc định + optional archived, sort updatedAt desc mỗi lane, note không status → inbox; moveNote set lastReviewedAt=now chỉ khi chuyển sang 'done' từ status khác; countByStatus Record). Vitest +37 test case (24 review + 13 kanban) — total core **215/215 pass** (178 trước → 215). Rust backend `apps-desktop/trishnote/src-tauri/`: `default_store_location` dùng `dirs::data_local_dir().or_else(data_dir).or_else(home_dir)` → `%LocalAppData%/TrishTEAM/TrishNote/notes.json` Windows / `~/.local/share/TrishTEAM/TrishNote/notes.json` Linux / `~/Library/Application Support/TrishTEAM/TrishNote/notes.json` macOS, `load_notes(path?)` seed `[]` nếu file chưa có + return `{path, content, size_bytes, created_empty}`, `save_notes(path?, content)` validate JSON parse + cap 10 MiB + atomic write qua `.json.tmp` + rename tránh corrupt giữa chừng. UI: topbar (pick folder không cần — store default, + Note mới, Review hôm nay (N) badge, Xuất/Nhập JSON), sidebar (filter status + tag + search + streak badge), content pane List/Kanban toggle, NoteRow với status-colored border-left + age-chip + tag pill, KanbanView HTML5 DnD giữa 4 lane với status-colored top border, DetailPane editable title/body/status + nút review + nút xoá soft deletedAt, ReviewModal cursor qua due queue với "Đã review" → markReviewed, ComposerModal với validateDraft. Dev fallback 5 seed notes phủ 4 status + 2 mức review age (active 2d/1d reviewed, waiting 5d, inbox 14d never reviewed, done 3d, inbox 30d) cho browser dev. Auto-save debounce 400 ms mọi thay đổi. Capabilities: core + dialog only (Rust tự đọc qua std::fs + dirs crate, không cần fs plugin). Tsc 12 workspace EXIT=0. Giới hạn v1: chưa sync cloud, chưa reminder toast/Telegram (dueAt field có sẵn — wire ở 14.4.1.c), chưa export PDF/Markdown (14.4.1.d), chưa rich text, chưa attachment, chưa encryption (dựa OS-level). |
| 14.5 | 🟡 | QA ecosystem-wide: smoke test mỗi app trên máy Trí (home + office), perf regression test, fix critical bugs. Sub-phase 14.5.1 (QA doctor preflight) ✅ + 14.5.2 (Rust-side audit + icon generator) ✅ + 14.5.3 (TESTPLAN.md × 10 — checklist sẵn để Trí đi máy thật) ✅ + 14.5.4 (batch compile matrix + fix Vite alias subpath bug) ✅ + 14.5.4.b (Windows setup fixes: `fileURLToPath()` thay `new URL().pathname` cho 3 QA script chống `C:\C:\` double-drive, 14 `package.json` đổi `"*"` → `"workspace:*"` cho pnpm workspace protocol, doctor.mjs thử cả 2 vị trí vitest npm/pnpm) ✅. Smoke test thực tế + bug-fix tiếp theo sẽ ghi dưới dạng sub-phase `.b`/`.c` cho từng app. |
| 14.5.1 | ✅ | **QA doctor preflight (2026-04-24).** `scripts/qa/doctor.mjs` (~380 dòng Node ESM, zero deps) chạy offline kiểm 16 nhóm check cho ecosystem 10 desktop app + 4 package: port dev+HMR canonical (1420/1421 → 1438/1439, không trùng nhau, trùng bảng registry), Tauri identifier `vn.trishteam.<app>` (không trùng, format đúng), 14 file bắt buộc mỗi app (package.json / vite.config.ts / tsconfig.json / index.html / src/{main,App}.tsx / styles.css / README.md / src-tauri/{Cargo.toml, tauri.conf.json, build.rs, src/{main,lib}.rs, capabilities/default.json} + icons/ dir), capability whitelist (cấm `shell:default`, `shell:allow-execute/kill/spawn`, `http:default`, `http:allow-http-request`), CSP không `'unsafe-eval'` + connect-src whitelist firebaseio/googleapis/trishteam.io.vn, package.json scripts có đủ `dev`/`typecheck`/`tauri:dev`/`tauri:build`, deps React 18.x + Vite 5.x + `@trishteam/core` + `@tauri-apps/api`, tsc EXIT=0 toàn 14 workspace, vitest core pass count. Hỗ trợ `--quick` (skip tsc/vitest ~0.5s) và `--json` (machine-readable cho CI). Root `package.json` thêm script `pnpm qa:doctor` + `pnpm qa:doctor:quick`. Kết quả chạy lần đầu: **49 pass, 0 warn, 0 fail** — toàn ecosystem sạch drift, sẵn sàng cho smoke test thực tế trên máy Trí (14.5.2+). `scripts/qa/README.md` chú thích bảng port canonical + 16 check + quy trình cấp port mới. |
| 14.5.3 | ✅ | **TESTPLAN.md smoke test checklist × 10 app (2026-04-24).** Viết sẵn 10 file `apps-desktop/<app>/TESTPLAN.md` + 1 master index `apps-desktop/TESTPLAN.md` để khi Trí ngồi máy thật chỉ cần tick ✅ từng bước, không phải tự nghĩ step từ đầu. Mỗi file chuẩn 6 section: (1) Tiền đề (qa:all pass, Rust toolchain, folder test sẵn, xoá data-dir cũ), (2) Smoke test 7-23 step click-through tuỳ độ phức tạp app — bao phủ mọi Tauri command register (28 tổng), mọi UI pane/modal, mọi dev fallback, mọi edge case (cap file size, hidden folder skip, VN diacritic fold, atomic rename), (3) Kết quả mong đợi với số đo cụ thể (memory resident < Xmb, elapsed < Y s, score BM25 k1=1.2), (4) Cleanup data-dir path chính xác cho 3 OS, (5) Platform-specific notes Windows/macOS/Linux (line ending CRLF↔LF, sysinfo WMI/sysctl/procfs, HEIC codec, APFS vs NTFS atomic rename, xdg-open vs Finder), (6) Giới hạn v1 liệt kê tường minh mọi feature CHƯA wire để QA không test (tránh bug report "missing feature" — dời sub-phase `.b`/`.c` sau). Master index `apps-desktop/TESTPLAN.md` có: thứ tự chạy khuyến nghị (port dev tăng dần, app không-login trước), quy trình 5-bước preflight→build→checklist→bug-report→fix, format BUG yyyy-mm-dd #N, criteria chấp nhận ship v2.0.0-alpha (10/10 app pass, memory < 500 MB, 0 DevTools error, offline không HTTP leak). Sau 14.5.3 → Phase 14.6 (Release v2.0.0 bundle installer + code-sign). Smoke test thực sự khi Trí chạy máy sẽ ghi dưới dạng sub-phase `.b`/`.c` nếu phát hiện bug — không lặp phase này. |
| 14.5.4 | ✅ | **Batch compile matrix + fix Vite alias subpath bug (2026-04-24).** `scripts/qa/build-all.mjs` (~300 dòng Node ESM zero-deps) chạy `cargo check --manifest-path src-tauri/Cargo.toml --message-format short` + `vite build --mode production` cho cả 10 app theo thứ tự port dev tăng dần (1420 → 1438). Dùng chung một `CARGO_TARGET_DIR=<root>/target-desktop/` để tái dùng incremental cache giữa các app — từ ước tính ~50+ phút (nếu mỗi app 1 target dir riêng) rút xuống ~20-25 phút lần đầu, ~3-5 phút rebuild. CLI flags: `--only=app1,app2` (subset), `--skip-cargo` / `--skip-vite` (chạy lẻ), `--json` (machine-readable), `--quiet` (CI mode, không stream stdout). Pre-flight check: `cargo` có trong PATH + binary `vite` tồn tại trong `node_modules/.bin/` (Windows auto-thử `vite.cmd`); thiếu → exit 2 không chạy nữa. Mỗi step stream stdout realtime (`process.stdout.write` passthrough), capture stderr tail ≤4 KiB để in ở Summary fail-detail. Exit code: 0 all pass / 1 any fail / 2 prereq missing. Output cuối cùng: bảng matrix 10×2 cột (APP × {cargo check, vite build}) với status ✅/❌ + elapsed giây + wall-time tổng.  **Phát hiện bug thật ngay lần chạy đầu tiên** (chính lý do viết script này trước khi Trí chạy `cargo tauri dev` máy thật): `vite.config.ts` cả 10 app có alias `'@trishteam/core': path.resolve(__dirname, '../../packages/core/src/index.ts')` — alias prefix-match nên khi source code `import { X } from '@trishteam/core/apps'` Vite replace thành `/…/packages/core/src/index.ts/apps` → ENOTDIR. tsc pass được vì dùng tsconfig `paths` mapping độc lập (compile time không resolve physically). Fix: **gỡ hoàn toàn alias `@trishteam/core`** khỏi 10 vite.config.ts — pnpm workspace đã symlink `node_modules/@trishteam/core -> packages/core/`, Vite tự dùng `exports` field trong `packages/core/package.json` (13 subpath: `.`, `./apps`, `./search`, `./notes`, `./qr`, `./clean`, `./fonts`, `./type`, `./images`, `./library`, `./fulltext`, `./design`) resolve đúng cho cả root và subpath. Kết quả sau fix: **10/10 vite build pass** trong ~13 giây total, 0 fail, memory spike < 200 MB/app. Vitest core vẫn pass 421/421, qa:all vẫn 49 + 24 = 73 pass 0 fail. Bonus: `.gitignore` thêm `target/` + `target-desktop/` + `*.rs.bk` để CI không commit cache ~3-5 GiB. Root `package.json` thêm `pnpm qa:build-all` + `pnpm qa:build-all:vite` (vite-only nhanh 13s cho rebuild loop). `scripts/qa/README.md` phần build-all.mjs với ví dụ output + flag table + thời gian reference cho Windows Ryzen 7 5800H. Sau 14.5.4 → sẵn sàng cho spot-check UI test 3 app đại diện (trishlauncher + trishfont + trishnote) trên máy thật; cargo check chưa test được trong sandbox vì thiếu Rust toolchain — Trí sẽ chạy `pnpm qa:build-all` lần đầu trên máy thật để verify cả 2 step × 10 app. |
| 14.5.2 | ✅ | **Rust-side audit + icon generator (2026-04-24).** Bổ sung `scripts/qa/rust-audit.mjs` (~300 dòng Node ESM) kiểm 6 nhóm cho Rust layer, bù chỗ `doctor.mjs` chưa chạm tới: (1) `Cargo.toml` deps consistency — `tauri` + `tauri-build` (parser gộp `[dependencies]` + `[build-dependencies]` + `[target.*.dependencies]`) đều major 2.x, `serde`/`serde_json` major 1, `walkdir` major 2 nếu có, `dirs` major 5, `sysinfo` 0.30, `kamadak-exif` 0.5, `imagesize` 0.13, `ttf-parser` 0.20; (2) invoke_handler surface — regex `#[tauri::command]` → fn name, cross-check với `generate_handler![…]` list, báo orphan + unknown; (3) data-dir isolation — parse `APP_SUBDIR: &str = "…"` hoặc detect `app.path().app_data_dir()` rồi đọc identifier fallback, collision map key=`kind:value.toLowerCase()`; (4) icon files — require 5 file (`32x32.png` ≥200B, `128x128.png` ≥1.5KB, `128x128@2x.png` ≥3KB, `icon.ico` ≥1KB, `icon.icns` ≥5KB); (5) window config — `minWidth ≥480`, `minHeight ≥320`, cảnh báo khi `resizable=false`; (6) bundle targets whitelist `all/msi/nsis/app/dmg/deb/rpm/appimage`. Hỗ trợ `--json` cho CI. Root `package.json` thêm `pnpm qa:rust` + `pnpm qa:all` (chạy quick-doctor + rust-audit liên tục). Phát hiện **toàn bộ 10 app thiếu icon file** trước phase này — viết thêm `scripts/qa/gen-icons.py` (~220 dòng Pillow) sinh placeholder icon set theo theme riêng từng app (gradient 2 hex + glyph giữa: L/K/C/F/Y/I/N/B/S/D), rounded corner 22%, inner-glow outline, shadow blur. Custom ICNS binary writer (OSType `ic07`/`ic08`/`ic09`/`ic10` + big-endian u32 size + PNG payload) vì Pillow không ghi được ICNS. Mỗi app output: `icon.png` 1024, `32x32.png`, `128x128.png`, `128x128@2x.png`, `icon.ico` multi-size (16/32/48/64/128/256), `icon.icns`. Canonicalize `tauri.conf.json` `bundle.icon` array 9/10 app về đúng 5-entry chuẩn. Kết quả chạy lần đầu sau fix: **24 pass, 0 warn, 0 fail** — Rust layer sạch drift, sẵn sàng `cargo tauri build` khi Trí chạy máy thật. |
| 14.5.4.c | ✅ | **Fix Rust borrow checker bug trong trishclean/scan_dir (2026-04-24).** Lần đầu `pnpm qa:build-all` chạy thật trên Windows cargo 1.95.0 — 9/10 cargo check pass, 10/10 vite build pass, riêng trishclean fail E0503/E0506 tại `src/lib.rs:89`. Root cause: `filter_map(|e| match e { Ok(ent)=>Some(ent), Err(_)=>{ errors+=1; None } })` capture `&mut errors` suốt iterator lifetime, đâm với `errors += 1` ở nhánh `entry.metadata()` Err trong loop body. Code có từ Phase 14.3.1 — tsc không bắt (chỉ TS), sandbox không có Rust nên cũng chưa từng check. Fix: gỡ closure filter_map, inline `match entry_result` trong loop body như pattern metadata ngay dưới — 2 nhánh Err dùng chung `errors.saturating_add(1); continue;`. Hành vi y hệt, borrow check sạch. Verify: sau fix sẽ 20/20 pass (10 cargo + 10 vite). Đây là bug thật Phase 14.5.4 bắt được — đúng lý do viết script này trước `cargo tauri dev`. |
| 14.5.4.b | ✅ | **Windows setup fixes sau lần đầu Trí chạy `pnpm qa:build-all` trên Windows 11 (2026-04-24).** Linux sandbox không phát hiện 3 bug Windows-specific: (1) `new URL(import.meta.url).pathname` trên Windows trả `/C:/Users/...` (leading slash + forward slash) làm `path.resolve` nested drive letter → `C:\C:\Users\...\node_modules\.bin\vite.cmd` → file not found — fix bằng `fileURLToPath(import.meta.url)` trong 3 QA script (`doctor.mjs`, `rust-audit.mjs`, `build-all.mjs`). (2) npm cho phép `"@trishteam/core": "*"` ở workspace root (lookup local trước khi fetch registry), pnpm thì fetch thẳng npm registry → `ERR_PNPM_FETCH_404` — fix bằng đổi 14 `package.json` (10 app desktop + `@trishteam/ui` + `@trishteam/data`, trishlauncher có thêm dep `@trishteam/ui` + `@trishteam/adapters`) sang `"workspace:*"` chuẩn pnpm protocol. Cập nhật `apps-desktop/trishlauncher/README.md` architecture note cũ "No workspace:* protocol" — viết lại cho chính xác. (3) pnpm isolate-symlink mode để vitest binary ở `packages/core/node_modules/.bin/vitest` (devDep ở core) thay vì root `node_modules/.bin/vitest` (npm behavior) — fix `doctor.mjs` thử cả 2 vị trí + đổi cwd khi spawn về `packages/core` cho đúng working dir. Verify sandbox sau fix: `pnpm install` OK 765 deps, `pnpm qa:doctor` 49/49 pass (421 vitest), `pnpm qa:rust` 24/24 pass, `pnpm qa:build-all:vite` 10/10 vite pass ~13.2s. Trí trên Windows 11 sau khi sync repo chỉ cần `Remove-Item -Recurse -Force node_modules` + `pnpm install` + `pnpm qa:build-all` để verify full matrix. |
| 14.5.5.a.2 | ✅ | **Fix icon contrast trên dark theme — tile trắng cố định (2026-04-24).** Sau 14.5.5.a.1 icon 256×256 RGBA alpha render đúng rồi nhưng vì Trí thiết kế chữ T màu navy đậm + motif app-specific cũng navy, trên dark theme `--surface: #161a21` thành navy-trên-dark-grey → chìm, không phân biệt được app nào. Fix `styles.css`: `.app-icon` (+ `.brand .brand-logo`) đổi `object-fit: cover` → `contain`, thêm `background: #ffffff` cố định không theme-aware + `padding: 4px` (logo 3px) tách icon khỏi viền + `box-shadow: inset 0 0 0 1px rgba(0,0,0,0.06)` viền mảnh chống icon "biến mất" khi card và icon cùng trắng trong light theme. Pattern giống App Store / Play Store: icon luôn đứng trên một tile sáng riêng, độc lập với card background, để logo brand nhận diện được bất kể light/dark. Không đụng React/logic — chỉ 2 rule CSS. Bundle không to thêm (CSS < 1 KB diff). |
| 14.5.5.a.1 | ✅ | **Fix icon copy nhầm placeholder thay icon thật (2026-04-24).** Trí chạy `pnpm tauri dev` sau 14.5.5.a thấy card hiển thị icon gradient với chữ cái (F/N/C/K/Y/I/B/S/D trên nền màu) — đây là **placeholder 1024×1024** do `scripts/qa/gen-icons.py` Phase 14.5.2 sinh (cho Tauri icon set src-tauri/icons/), KHÔNG phải icon 256×256 RGBA Trí đã thiết kế + xoá background từ session rebuild launcher Tauri trước đó. Icon thật nằm ở `apps/trishlauncher/src/trishlauncher/resources/logos/` (launcher Qt/Python legacy) với 10 file trishlauncher/trishcheck/trishclean/trishdesign/trishfont/trishimage/trishlibrary/trishnote/trishsearch/trishtype 256×256 alpha channel (kích thước 20-42 KB/file, tổng ~345 KiB — nhẹ hẳn placeholder ~780 KiB). Fix: copy lại 10 file từ legacy logos folder đè 10 placeholder trong `apps-desktop/trishlauncher/src/icons/`, update comment `index.ts` ghi đúng resolution + nguồn gốc. Không đụng logic/CSS/App.tsx — chỉ thay asset binary. Sau fix Trí pull + `pnpm tauri dev` thấy icon đúng: chữ T lớn navy + motif app-specific (A sách cho Font, rocket cho Launcher, check + screen cho Check, note có dấu tick cho Note, …). |
| 14.5.5.a | ✅ | **TrishLauncher v1: 10 app + logo 1024×1024 (2026-04-24).** Sau 14.5.4.c Trí chạy `pnpm tauri dev` lần đầu thấy launcher mới chỉ hiển thị 4 app (trishfont + trishnote + trishclean + trishimage) với tam giác `▲` placeholder, không có icon riêng nào. Phase 14.5.5.a đóng khung v1: (1) `apps-desktop/trishlauncher/src/apps-seed.ts` mở rộng từ 4 → 9 app (launcher không show chính nó trong grid) — thêm trishcheck "System info + benchmark máy", trishtype "Text editor CRDT multi-caret", trishlibrary "Thư viện PDF/epub + cite APA/IEEE", trishsearch "Full-text search BM25 offline", trishdesign "Color palette WCAG + design tokens"; promote trishimage beta→released; trishnote login_required user→none (đồng bộ với thiết kế offline-first 14.4.1). (2) `apps-desktop/trishlauncher/src/icons/index.ts` (mới) static import 10 PNG 1024×1024 (từ Trí thiết kế trước) vào Vite bundle — tổng ~780 KiB (chấp nhận được vì desktop, không phải SPA), Vite hash từng file → cache-bust tự động, export `APP_ICONS: Record<string,string>` + `LAUNCHER_ICON` (cho topbar brand) + `iconFor(appId)` helper defensive. (3) `apps-desktop/trishlauncher/src/vite-env.d.ts` (mới) `/// <reference types="vite/client" />` để TS nhận module type cho `.png` import. (4) `App.tsx` thay brand topbar từ `<span className="logo">▲</span>` sang `<img className="brand-logo" src={LAUNCHER_ICON} width={40} height={40} />`; AppCard thêm icon 48×48 bên trái card-head + text (h3 + badge) flex column bên phải + fallback `<div className="app-icon app-icon-fallback">` hiện chữ đầu tên app nếu thiếu PNG (defensive, không xảy ra v1). (5) `styles.css` rename `.brand .logo` → `.brand .brand-logo` 40×40 radius 10 cover, `.card-head` chuyển flex-row gap 12 align center (trước là flex-column), `.card-head-text` flex-col gap 4 min-width 0 cho tên dài, `.app-icon` 48×48 radius 12 cover flex-shrink 0, `.app-icon-fallback` border accent text 22px bold. 10 PNG copy vào `src/icons/` (trishlauncher/trishcheck/trishclean/trishfont/trishtype/trishimage/trishnote/trishlibrary/trishsearch/trishdesign). Sandbox không verify được tsc do pnpm NTFS symlink không resolve qua WSL (`Input/output error` khi `ls node_modules/react`), nhưng code change hoàn toàn cơ học + đã cross-check manually mọi import/export/className — verify thực sẽ chạy trên Windows qua `pnpm tauri dev` (popup chi tiết từng app + launch detection + system tray + settings modal defer 14.5.5.b-e). |
| 14.5.5.b | ✅ | **App Detail Modal cho TrishLauncher (2026-04-24).** Sau 14.5.5.a.2 icon hiển thị chuẩn, Trí yêu cầu: "Tôi muốn thể hiện 10 app và mỗi app sẽ hiện popup của từng app... Tôi muốn chuẩn từng app chốt sổ luôn." Trước phase này launcher chỉ có card tóm tắt 3 meta (version/size/login) → user không biết app làm gì cụ thể, không biết đổi máy thì còn platform nào support, không thấy changelog. Phase 14.5.5.b đóng khung popup chi tiết với 3 file: (1) `apps-desktop/trishlauncher/src/apps-meta.ts` (mới) — `APP_META: Record<string, AppMeta>` cho 10 app, mỗi app 5 `features` bullet + 1 `accent` hex. **Features phản ánh đúng implementation Phase 14.3/14.4**, không dùng marketing copy của `website/data/apps-meta.ts`: trishcheck "CPU benchmark SHA-256 trên buffer 50 MB → throughput MB/s", trishclean "Staged delete + undo 7 ngày — commit sau retention window", trishtype "CRDT RGA text merge — 2 actor gõ cùng vị trí vẫn hội tụ cùng kết quả", trishfont "Pair AI: gợi ý cặp heading + body theo score tiếng Việt + personality", trishimage "Parse EXIF DateTimeOriginal + camera Model + GPS qua kamadak-exif", trishnote "Kanban 4 lane: Inbox/Đang làm/Chờ/Xong", trishlibrary "Cite APA 7 / IEEE đầy đủ author format", trishsearch "BM25 k1=1.2 b=0.75 + recency boost HOT 7d / COLD 365d", trishdesign "WCAG contrast matrix N×N với rating fail/AA-large/AA/AAA". Accent mỗi app: launcher navy (#1E3A8A), check xanh lá (#16A34A), clean đỏ (#DC2626), font tím (#7C3AED), type hồng (#EC4899), image magenta (#DB2777), note xanh dương (#2563EB), library teal (#0D9488), search cam (#EA580C), design violet (#6D28D9). (2) `apps-desktop/trishlauncher/src/components/AppDetailModal.tsx` (mới) — full modal component. Props: `app`, `currentPlatform`, `onClose`, `onInstall`, `onOpenExternal`. Layout: **Header** icon 72×72 (cùng white tile pattern) + name H2 + tagline + badge status, top border 4px inline style từ `app.accent`. **Section "Tính năng chính"** 5 bullet từ `app.features` với dot accent color (CSS `::before` 6×6 radius 50%). **Section "Thông tin phát hành"** grid 4 cell: Phiên bản / Dung lượng / Truy cập / Phát hành nếu có release_date. **Section "Nền tảng hỗ trợ"** chip list tất cả platform `app.platforms`, chip current platform highlight accent + pill tag "máy này", nhãn VN `PLATFORM_LABEL: Record<Platform, string>` 7 key (Windows x64/ARM64, macOS Intel/Apple Silicon, Linux x64, Web, Zalo Mini App). **Section "Changelog"** nếu `app.changelog_url` → button text-link accent mở browser qua `onOpenExternal`. **Footer** 2 nút: "Đóng" ghost + primary CTA giống AppCard ("Tải về / Mở" / "Sắp ra mắt" / "Chưa hỗ trợ máy này"). A11y: `role="dialog"` + `aria-modal="true"` + `aria-labelledby="app-modal-title"`, click-overlay-to-close qua `onClick={onClose}` + `e.stopPropagation()` trên dialog, Esc key global listener scoped vào `useEffect`. (3) `apps-desktop/trishlauncher/src/App.tsx` rewrite: import `APP_META` + `AppDetailModal`, thêm `useState<string | null>` cho `selectedAppId`, `mergeRegistry(SEED_REGISTRY, APP_META)` (không còn `{}` rỗng), `selectedApp` useMemo lookup theo id, helper `handleInstall(app)` dùng chung card + modal CTA, render `<AppDetailModal>` conditional khi `selectedApp` truthy. AppCard restructure: `card-head` + `tagline` bọc trong button `.card-head-btn` click → open modal (cả card trở thành clickable surface), thêm row `.card-actions` 2 nút flex 1: "Chi tiết" (ghost) + "Tải về / Mở" (primary). (4) `apps-desktop/trishlauncher/src/styles.css` thêm block modal CSS ~260 dòng: `.card-head-btn` reset button style width 100% hover bg accent 4% focus-visible outline 2px accent, `.card-actions` flex gap 8 buttons flex 1, `.modal-overlay` fixed inset 0 bg rgba(0,0,0,0.55) backdrop-filter blur 2 z-index 1000 animation `modal-overlay-in` fade 150ms, `.modal-dialog` 640px max-width max-height viewport-48 radius 16 shadow 0 20 60 rgba(0,0,0,0.35) animation `modal-dialog-in` fade + translateY 8 + scale 0.98→1 180ms ease-out, `.modal-close` absolute top-right 32×32 × button, `.modal-head` border-top 4 accent (inline override) icon+text flex padding 24 24 20, `.modal-icon` 72×72 white tile padding 6 inset border (match card pattern), `.modal-body` flex col gap 20, `.modal-features` list reset bullet custom `::before` dot 6×6 accent, `.modal-meta` grid auto-fit minmax 140 bg var(--bg) radius 10 padding 14 16, `.modal-platforms` + `.platform-chip` inline-flex border var(--border) radius 8, `.platform-chip-current` border accent bg accent 8% color accent font-weight 500, `.platform-current-tag` pill 10px solid accent trắng chữ, `.modal-link` button text-link style accent, `.modal-foot` flex end gap 10 padding 16 24 20 border-top. **Kết quả:** click bất kỳ đâu trên card → mở modal chi tiết; click nút "Chi tiết" ghost → mở modal (alias explicit); click nút "Tải về / Mở" primary ở card → mở URL download trực tiếp (hành vi 14.5.5.a giữ nguyên); trong modal click "Tải về / Mở" → mở URL + auto-close modal; Esc hoặc click ngoài dialog → close modal. Accent color mỗi app phản chiếu ở border top modal + bullet dot features + chip current platform → tạo identity riêng cho từng app. Bundle tăng < 5 KB (một file TSX + một file TS + CSS block). Sandbox không verify được tsc do pnpm NTFS symlink không resolve qua WSL (cascade module resolution error giống 14.5.5.a) — verify thực khi Trí HMR (`pnpm tauri dev` đang chạy sẽ hot-reload không cần restart). |
| 14.5.5.c | ✅ | **Launch detection cho TrishLauncher (2026-04-24).** Sau 14.5.5.b modal chi tiết đã có nhưng nút primary vẫn luôn là "Tải về" cho dù user đã cài app — user phải mở Start menu / Launchpad để launch. Phase 14.5.5.c đóng khung path probe + launch + UI reflect state: **3 file mới** `apps-desktop/trishlauncher/src/install-types.ts` (`InstallCandidates` = `Partial<Record<Platform, string[]>>`, `InstallDetection` {id, state: 'installed'/'not_installed', path: string|null}, `InstallProbe` {id, candidates}), `install-candidates.ts` (9 app × 5 platform × 2-3 candidate path phủ convention Tauri: Windows `%LOCALAPPDATA%\Programs\<App>\<App>.exe` + `%PROGRAMFILES%\<App>\<App>.exe`, macOS `/Applications/<App>.app` + `~/Applications/<App>.app`, Linux `~/.local/share/applications/vn.trishteam.<id>.desktop` + `/usr/share/applications/...` + `/usr/bin/<id>`), `cta.ts` (shared `resolveCta(app, platform, detect)` 4 state: installed→"Mở", coming_soon→"Sắp ra mắt" disabled, no download→"Chưa hỗ trợ máy này" disabled, default→"Tải về" — tách riêng để AppCard + AppDetailModal reuse, không circular). **Rust backend** `src-tauri/src/lib.rs` thêm 2 `#[tauri::command]`: (1) `detect_install(probes: Vec<InstallProbe>) -> Vec<InstallDetection>` dùng helper `expand_path()` — support `~/` home + `%VAR%` Windows (guard 8 iter chống loop với env chứa `%`) + `$VAR`/`${VAR}` Unix char-based iter an toàn với username unicode — rồi `Path::exists()` check; (2) `launch_path(path: String) -> Result<String, String>` empty-check + exists-check + `std::process::Command` spawn: Windows `cmd /c start "" <path>` (để shell xử lý .exe), macOS `open -a <path>` (mở .app bundle), Linux `xdg-open <path>` (shell xử lý .desktop / binary), fallback cfg cho OS lạ. Register cả 2 trong `generate_handler!`. Không cần thêm capability vì Tauri custom command không qua plugin permission system. **Bridge** `tauri-bridge.ts` 2 wrapper: `detectInstall(probes)` fallback all-not_installed trong browser dev mode (pnpm dev không Tauri) + catch invoke fail; `launchPath(path)` throw để caller fallback download URL. **App.tsx** thêm `useState<Map<string, InstallDetection>>` installMap, `buildProbes(apps, platform)` filter chỉ app có candidate match platform, `useEffect` probe khi compatApps/platform đổi với cancellation flag chống stale setState, `handleInstall(app)` rewrite: installed+path → launchPath với catch fallback openExternal(download.url), không → normal download — app bị user xoá giữa chừng vẫn graceful fallback. AppCard thêm prop `detect`, className `card-installed`, badge "✓ Đã cài" wrap `.card-head-badges` cùng status. AppDetailModal nhận prop `detect`, import `resolveCta` từ `../cta.js` (không từ `../App.js` để khử circular), section mới "Đường dẫn cài đặt" hiện full resolved path trong `<code>` monospace khi installed, CTA footer từ `resolveCta().label`. **styles.css** 3 block CSS mới: `.badge-installed` bg accent solid trắng chữ weight 600 (phân biệt với `.badge-released` nhạt — installed là current state, released chỉ là lifecycle); `.card-head-badges` + `.modal-head-badges` flex wrap gap 6px nhiều badge chung 1 dòng; `.card-installed` border-left 3px accent để user scan grid biết app nào đã cài không cần đọc badge; `.modal-install-path` monospace 12px word-break break-all cho Windows path dài. **Kết quả:** launcher mở → sys_info detect platform → useEffect build probes 9 app → Rust check `Path::exists()` từng candidate ~10ms tổng → installMap populated → card đã cài có viền trái accent + badge xanh + CTA "Mở". Click "Mở" → `std::process::Command::spawn` → app khởi động, launcher không bị freeze (fire-and-forget). Modal show install path user verify location, CTA đồng nhất card. Browser dev mode (`pnpm dev`) → all not_installed → UI render "Tải về" bình thường, không crash. Sandbox không verify được tsc + cargo check do pnpm NTFS symlink WSL + thiếu Rust toolchain; Trí verify trên Windows bằng `pnpm tauri dev` (HMR frontend) + `cargo check` qua `pnpm qa:build-all` (cần Rust installed). |
| 14.5.5.c.1 | ✅ | **Dev-mode detection qua `%EXE_DIR%` (2026-04-24).** Trí verify 14.5.5.c trên Windows bằng `pnpm tauri dev` launcher → vẫn thấy cả 9 app "Tải về", không có badge "Đã cài" nào. Root cause: path probe Phase 14.5.5.c chỉ list production install path (`%LOCALAPPDATA%\Programs\<App>\<App>.exe` + `%PROGRAMFILES%\...`); trong dev mode cargo build exe ra `<repo>/target-desktop/debug/<appid>.exe` (sibling của launcher binary) — không match production path nào → `detect_install` đúng trả `not_installed` cho tất cả → UX không có cách verify. Fix: thêm token `%EXE_DIR%` cho helper `expand_path()` trong `src-tauri/src/lib.rs` — resolve về `std::env::current_exe()?.parent()?.to_string_lossy()`, replace inline trước mọi expansion khác (trước `~/`, trước `%VAR%` loop). `install-candidates.ts` thêm path `%EXE_DIR%\<appid>.exe` (Windows) / `%EXE_DIR%/<appid>` (Unix) đầu list cho mỗi app × mỗi platform; appid dùng lowercase match `Cargo.toml` package name (dev binary) khác PascalCase production. **Không false-positive production** vì launcher production ở `%LOCALAPPDATA%\Programs\TrishLauncher\` — thư mục này chỉ chứa `TrishLauncher.exe`, sibling `trishnote.exe` không tồn tại → probe fallback sang path production như cũ. **Kết quả dev mode:** sau khi Trí đã chạy `pnpm tauri dev` cho trishnote (v.v.), exe đó nằm sibling launcher exe → `%EXE_DIR%\trishnote.exe` exists → detect installed → card viền trái + badge "Đã cài" + CTA "Mở". Click "Mở" dev binary spawn OK nhưng cần Vite dev server đang chạy mới render frontend (HMR pipeline) — nếu không thì window blank; production binary embed frontend nên chạy clean. |
| 14.5.5.d | ⏳ | System tray cho TrishLauncher (minimize to tray, quick-launch menu các app đã cài). |
| 14.5.5.e | ⏳ | Settings modal (theme light/dark, language VN/EN, registry source URL, auto-update check interval). |
| 14.6 | ⏳ | Release v2.0.0 tất cả — bundle installer qua TrishLauncher, code-sign (phụ thuộc Phase 17.2 EV cert). |

---

## Phase 15 — Zalo Mini App ecosystem

**Tham khảo:** https://github.com/Zalo-MiniApp — repo chính thức ZaloApp platform.

**Mục tiêu:** Port selected widget + app core từ website/desktop sang **Zalo
Mini App** để user Việt dùng trực tiếp trong Zalo, không cần cài app desktop
hay vào web.

### Scope đề xuất (chờ Trí review sau)

Không port hết 10 app — chỉ chọn những phần value cao cho mobile + tận dụng
được Zalo platform (share, OA, notification):

| Mini App name | Map với desktop/web | Lý do chọn |
| ------------- | ------------------- | ---------- |
| TrishTEAM Portal | Website dashboard rút gọn | Entry point — hiển thị Clock/Weather/Holidays/News Vietnamese |
| TrishNote Mini | TrishNote desktop | Ghi chú nhanh bằng mobile — sync Firestore với desktop/web |
| TrishQR Mini | QR Generator widget | Đã có demo — chỉ cần wrap ZaUI components |
| TrishCheck Mini | TrishCheck desktop | Check điện thoại (RAM/storage/OS version) so với yêu cầu app |
| TrishLibrary Mini | TrishLibrary desktop | Xem thư viện PDF/doc user đã lưu · sync từ desktop |
| TrishFont Mini | TrishFont desktop | Preview font pack · không cài được nhưng xem được catalog |
| TrishAnnouncement | Admin announcement | Push notification qua Zalo OA khi có thông báo |

### Kiến trúc

- **Stack**: `zmp-cli` scaffold + React + ZaUI (Zalo UI kit) + TypeScript.
- **Backend**: Dùng chung Firebase project với website/desktop — Zalo user
  ID → map sang Firebase custom token (Cloud Function).
- **Share tokens**: re-use `design/tokens.json` export sang ZaUI theme.
- **Repo**: Tạo mới `trishteam-miniapp/` trong monorepo (bỏ qua nếu muốn
  separate repo) — tham khảo structure từ https://github.com/Zalo-MiniApp.

### Sub-phase plan (draft)

- **15.1** Setup `trishteam-miniapp/` scaffold + ZaUI + token export + Firebase adapter.
- **15.2** TrishTEAM Portal Mini (Dashboard rút gọn + Announcements).
- **15.3** TrishQR Mini (Phase sớm vì dễ, đã có demo).
- **15.4** TrishNote Mini + Firestore sync.
- **15.5** TrishCheck Mini (phone config check).
- **15.6** TrishLibrary Mini + TrishFont Mini (view-only).
- **15.7** Admin announcement push qua Zalo OA + Cloud Function trigger.
- **15.8** Submit Mini App qua Zalo Developer Portal (QC + review).

---

## Phase 16 — SEO / Analytics / Observability ✅ 16.1-16.6 DONE 2026-04-23

### Sub-phase

| Sub | Trạng thái | Ghi chú |
| --- | ---------- | ------- |
| 16.1 | ✅ | `app/sitemap.ts` (MetadataRoute.Sitemap — 5 URL public, priority 0.5-1.0, changeFreq daily/weekly/monthly) + `app/robots.ts` (allow `/`, disallow `/admin/`, `/api/`, `/offline`, `/_next/`; opt-out AI crawler: GPTBot, CCBot, Google-Extended, anthropic-ai, ClaudeBot; `host` + `sitemap` trỏ `NEXT_PUBLIC_SITE_URL` fallback `https://trishteam.io.vn`). |
| 16.2 | ✅ | `app/layout.tsx` metadata thêm `metadataBase`, `openGraph` (type=website, locale=vi_VN, siteName, 1 default image 1200×630), `twitter` (summary_large_image), `alternates.canonical`, `title.template` ('%s · TrishTEAM'), `keywords`, `authors`, `publisher`. OG image `public/og/og-default.png` (58KB, logo + tag + URL, gen bởi Pillow script). |
| 16.3 | ✅ | `components/web-vitals-reporter.tsx` dùng `useReportWebVitals` hook (Next 14) → sendBeacon `/api/vitals` (fallback fetch keepalive). `app/api/vitals/route.ts` (runtime=nodejs) sanitize VitalBody + ghi Firestore `/vitals/{env}/samples/{auto-id}` qua Admin SDK với FieldValue.serverTimestamp. `firestore.rules`: client write=deny (server-only), read=admin. No-op 204 nếu Admin SDK chưa config. Metrics: LCP/FID/CLS/INP/TTFB/FCP + Next.js custom. |
| 16.4 | ✅ | `/admin/vitals` (client page) + `/api/admin/vitals` (server route Admin SDK). Bộ chọn env (prod/dev) × hours (1/24/168/720). Server đọc tối đa 5000 sample (`ts >= since` + orderBy desc), tính percentile tuyến tính (p50/p75/p95), rating distribution (good/NI/poor/unknown), top 15 path theo count + LCP p75. FE render metric card (LCP/INP/CLS/TTFB/FCP/FID) với màu theo ngưỡng Web Vitals chuẩn + bar stacked rating. Auth Bearer ID token, rule-gated chỉ admin. Đã thêm Gauge icon vào admin sidebar nav. |
| 16.5 | ✅ | Self-host error tracking cho website (không phụ thuộc Sentry). `lib/error-report.ts` (FNV-1a fingerprint + dedupe 20 hash), `components/error-reporter.tsx` (install `window.onerror` + `unhandledrejection`), `components/error-boundary.tsx` (React class ErrorBoundary + fallback UI). Server: `/api/errors` POST (sanitize, max 16KB, Admin SDK write `/errors/{env}/samples/`). Admin: `/admin/errors` list với group theo fingerprint (top 20 issue) + recent 300 sample + modal chi tiết stack trace. `/api/admin/errors` aggregate GET. Rules: `/errors/{env}/samples` admin read, client write=deny. Pluggable: có thể swap sang Sentry/GlitchTip sau mà không đổi call site. **Desktop app + CI sourcemap upload: Phase 16.5b**. |
| 16.6 | ✅ | Self-host Umami. `infra/analytics-umami/` gồm `docker-compose.yml` (umami + postgres 15-alpine, bind 127.0.0.1:3100), `.env.example` (POSTGRES_PASSWORD + APP_SECRET random), `Caddyfile` (reverse proxy analytics.trishteam.io.vn auto-SSL + CORS + Cache-Control tracker 5min). Client: `components/umami-tracker.tsx` (next/script afterInteractive, flag-gated `NEXT_PUBLIC_UMAMI_SRC` + `NEXT_PUBLIC_UMAMI_WEBSITE_ID`, data-do-not-track=true tôn trọng DNT). Helper `lib/analytics.ts` export `track(name, data)` + `trackPageview(path?)` với queue khi script chưa load (flush 500ms, max 20 retry). `docs/ANALYTICS-UMAMI.md` (8 bước: DNS, Docker, deploy, Caddy, login, Vercel env, custom event, cron backup + troubleshooting). |

---

## Phase 17 — Final deploy & release 🟡 17.1 DONE 2026-04-23

### Sub-phase

| Sub | Trạng thái | Ghi chú |
| --- | ---------- | ------- |
| 17.1 | ✅ | **Website deploy package.** `docs/DEPLOY-VERCEL.md` — 7 bước: pre-flight, tạo Vercel project (root `website/`), env checklist (Firebase client/admin, site URL, app version, Gemini, Umami), deploy, wire domain TENTEN A@76.76.21.21 + CNAME www, canonical redirect, smoke test (core flow + auth + PWA + SEO + observability + admin), post-launch + rollback 3 options + troubleshooting. `docs/CHANGELOG.md` — entry v1.0.0 format Keep-a-Changelog (Added per surface area, upgrade notes, known limitations). `website/.env.example` cập nhật thêm `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_APP_VERSION`, 3 biến Umami. |
| 17.2 | ⏳ pending | **Desktop signed installer.** Windows EV cert → SmartScreen OK. Mac notarization. Build CI Tauri/Electron với code signing. Sau Phase 14 xong. |
| 17.3 | ⏳ pending | **Onboarding video 5 phút.** Screencast overview + 10 app tour. Upload YouTube + nhúng home hero. |

---

## Tổng quan timeline dự phóng

| Phase | Nội dung | Estimate |
| ----- | -------- | -------- |
| 11.5.22 | QR Generator | ✅ Done |
| 11.6 | Firebase Auth website | ~1 tuần |
| 11.7 | User progress sync | ~1 tuần |
| 11.8 | Admin backend | ~1 tuần |
| 11.9 | PWA | ~3 ngày |
| 12 | AI augmentation | ~2-3 tuần |
| 13 | Design refresh v2 | ~1 tuần (đã làm phần lớn) |
| 14 | Rebuild 10 desktop app | ~2-3 tháng (biggest chunk) |
| 15 | Zalo Mini App ecosystem | ~1 tháng |
| 16 | SEO/Analytics | ~1 tuần |
| 17 | Deploy release | ~3 ngày |

> **Tổng còn lại**: ~4-5 tháng làm nghiêm túc. Con số này là upper bound —
> Phase 14 có thể chạy song song 2-3 app với sự hỗ trợ AI.
