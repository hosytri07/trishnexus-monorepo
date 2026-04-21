# Session Handoff — TrishNexus

**Mục đích:** Claude ở session Cowork mới đọc file này để pick up công việc đúng chỗ.

**Ngôn ngữ giao tiếp với user:** Tiếng Việt. User là Trí (hosytri07 / hosytri77@gmail.com), không phải developer — cần giải thích đơn giản, tránh jargon khi không cần thiết.

---

## Trạng thái hiện tại (cuối session trước)

### Đã hoàn thành
- ✅ **Sprint 1 (website)**: `tokens.css` deployed lên production tại trishteam-website (Vercel). Accent color `#667EEA` live trên 11 trang HTML.
- ✅ **Sprint 2 part 1 (monorepo scaffold)**: trishnexus-monorepo pushed lên GitHub tại `hosytri07/trishnexus-monorepo`. Commit author đã sửa thành hosytri07.
- ✅ **shared/trishteam_core**: Package Python chung cho mọi desktop app. Đã install editable.
- ✅ **apps/trishdesign**: App mới, chạy được với 14 sidebar items (smoke test pass).
- ✅ **USB portability scripts** (scripts/START.bat, END.bat, SETUP.bat, README.txt): Cho phép user làm việc trên USB giữa 2 máy (nhà + cơ quan) chỉ bằng double-click.
- ✅ **Migration sang USB**: User đã clone monorepo sang `G:\4. Code\TrishNexus-New\` và switch Cowork workspace về đây.

### Đang dở — PICK UP TỪ ĐÂY
- 🔧 **TrishFont v0.1 đang buggy**: PreviewView hang app khi init vì tạo 500+ FontPreviewCard widgets cùng lúc cho tất cả system fonts.
- 🔧 **Architecture cần đổi**: User yêu cầu scan từ curated folder (`G:\4. Code\Data Code\FontLibrary` trên máy nhà, sẽ copy sang `G:\4. Code\TrishNexus-New\FontLibrary\` trên USB) thay vì scan system fonts.
- 🔧 **Font folder sẽ ship cùng .exe**: Sau này build PyInstaller → folder fonts đi kèm trong bundle. Path resolution cần tự chuyển dev ↔ prod.

---

## Việc cần làm tiếp (TrishFont Refactor)

### Step 1: Rewrite PreviewView — tránh freeze
- Bỏ grid layout với hàng trăm card
- Dùng **split view**: left = QListWidget (font families), right = single QLabel preview với sample text
- Chỉ render 1 font cùng lúc → không freeze
- Sample text mặc định: `"Tiếng Việt: huyền, sắc, hỏi, ngã, nặng — 0123456789"`

### Step 2: Đổi FontRepository.scan_system() → scan_folder(path)
- File: `apps/trishfont/src/trishfont/modules/library/repository.py`
- Dùng `QFontDatabase.addApplicationFont(file_path)` với từng .ttf/.otf trong folder (đệ quy)
- Extract family name từ font file để save vào SQLite
- Detect Vietnamese support qua `writingSystems(family)` như trước

### Step 3: Add settings table + folder picker
- Tạo migration `MIGRATION_002_SETTINGS`:
  ```sql
  CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
  );
  ```
- Key quan trọng: `font_library_path`
- Path resolution priority:
  1. SQLite `settings.font_library_path`
  2. Env var `TRISHFONT_FONT_DIR`
  3. Prod default: `Path(sys.executable).parent / "fonts"` (khi chạy từ .exe)
  4. Dev default: `G:\4. Code\TrishNexus-New\FontLibrary` (relative-ish)
- Nếu path chưa set → popup QFileDialog cho user chọn folder

### Step 4: InstallView (module install) — vẫn giữ EmptyState placeholder cho v0.2

---

## Cấu trúc project

```
G:\4. Code\TrishNexus-New\                  ← USB root (workspace folder của Cowork)
├── trishnexus-monorepo/                    ← git repo chính
│   ├── design/tokens.json                  ← nguồn sự thật design tokens
│   ├── scripts/
│   │   ├── gen-tokens.js                   ← regen tokens cho web + desktop
│   │   ├── START.bat / END.bat / SETUP.bat ← USB workflow
│   │   └── README.txt
│   ├── shared/trishteam_core/              ← package Python dùng chung
│   ├── apps/trishdesign/                   ← app đầu tiên (done scaffold)
│   ├── apps/trishfont/                     ← app buggy cần refactor
│   ├── website/assets/tokens.css           ← generated
│   └── docs/SESSION-HANDOFF.md             ← file này
└── FontLibrary/                            ← font curated của user (chưa có trên USB, cần copy)
    ├── Sans/
    ├── Serif/
    ├── Mono/
    └── Display/
```

## Các file code quan trọng (đường dẫn relative từ monorepo root)

- `apps/trishfont/src/trishfont/app.py` — entry point, dùng `user_data_dir_for`, `Database`, `migrate` từ trishteam_core
- `apps/trishfont/src/trishfont/modules/preview/view.py` — **FILE BUGGY, CẦN VIẾT LẠI**
- `apps/trishfont/src/trishfont/modules/library/models.py` — có MIGRATION_001_FONTS schema + CATEGORY_KEYWORDS
- `apps/trishfont/src/trishfont/modules/library/repository.py` — FontRepository, cần đổi scan_system → scan_folder
- `apps/trishfont/src/trishfont/modules/library/view.py` — QTableWidget list, giữ đa số, chỉ đổi nút Scan → Pick folder
- `apps/trishfont/src/trishfont/modules/favorites/view.py` — extends LibraryView, _only_favorite=True
- `apps/trishfont/src/trishfont/modules/install/view.py` — placeholder EmptyState

## API của trishteam_core (đã stable, dùng y nguyên)

- `trishteam_core.store.Database(path)` — SQLite wrapper, có `.conn`, `.transaction()`, `.close()`
- `trishteam_core.store.migrate(db, [(version, sql_str), ...])` — apply migrations based on PRAGMA user_version
- `trishteam_core.utils.user_data_dir_for(app_name)` — returns `platformdirs.user_data_dir(app, "TrishTeam")` as Path
- `trishteam_core.utils.ensure_dir(path)` — mkdir -p
- `trishteam_core.utils.get_logger(name, log_dir=)` — RotatingFileHandler logger
- `trishteam_core.ui.BaseWindow(title=)` — main window với sidebar, có `.sidebar.set_title()`, `.add_page(key, label, widget, icon=)`
- `trishteam_core.ui.apply_theme(app)` + `.build_qss()` — QSS generator
- `trishteam_core.ui.HoverSidebar` — sidebar hover animation
- `trishteam_core.widgets.Card`, `EmptyState`, `Toast`, `show_toast(widget, message)` — UI primitives

## User preferences đã biết

- Không phải developer, thích giải thích ngắn gọn tiếng Việt
- Ghét phải gõ lệnh git dài → dùng .bat double-click
- Làm việc ở 2 máy (nhà + cơ quan) qua USB — hiện tại Cowork trỏ vào USB tại `G:\4. Code\TrishNexus-New`
- Font folder curated riêng, KHÔNG scan system fonts
- Domain chính thức: `trishteam.io.vn` (đã mua ở TenTen, chưa cấu hình)
- Ưu tiên làm việc từng bước nhỏ, confirm trước khi làm bước tiếp
- Git config: name=`hosytri07`, email=`hosytri77@gmail.com`

---

## Chào user khi bắt đầu session mới

Gợi ý câu mở đầu:

> Chào Trí. Đã đọc handoff note xong — đang ở đoạn refactor TrishFont (PreviewView hang + đổi sang curated folder scan). Trước khi code, xác nhận 2 điều:
> 1. Folder `FontLibrary` đã copy sang USB tại `G:\4. Code\TrishNexus-New\FontLibrary\` chưa?
> 2. Bắt đầu từ Step 1 (rewrite PreviewView) luôn, hay muốn review kế hoạch trước?
