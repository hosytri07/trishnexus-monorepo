# Session Handoff — TrishNexus

**Mục đích:** Claude ở session Cowork mới đọc file này để pick up công việc đúng chỗ.

**Ngôn ngữ giao tiếp với user:** Tiếng Việt. User là Trí (hosytri07 / hosytri77@gmail.com), không phải developer — cần giải thích đơn giản, tránh jargon khi không cần thiết.

---

## 🚨 RULES BẮT BUỘC CHO CLAUDE

### Khi bắt đầu session
- Nếu user gõ `tiếp tục`, `tiếp tục từ handoff`, `pick up`, hoặc chỉ nói `tiếp tục` → đọc file này ngay, không hỏi gì thêm trước.
- Tóm tắt 2-3 dòng cho user biết "đang ở bước nào" rồi mới đề xuất action tiếp theo.

### Trước khi kết thúc session (QUAN TRỌNG)
- Luôn update section **"Trạng thái hiện tại"** ở dưới trước khi user đóng chat.
- Cụ thể: đánh dấu ✅ việc đã xong, cập nhật section "Đang dở — PICK UP TỪ ĐÂY", thêm file code quan trọng mới tạo.
- Nếu user nói kiểu "xong hôm nay rồi" / "chốt" / "để mai làm tiếp" / "bấm END.bat" → trigger update handoff TRƯỚC khi chào tạm biệt.
- Lý do: máy kia (nhà ↔ cơ quan) sẽ đọc file này khi mở chat mới — nếu handoff cũ, Claude sẽ làm trùng việc hoặc bỏ sót.

---

## Workflow đổi máy (Plan B — GitHub sync, đã chốt)

**Quy trình mỗi máy:** `START.bat` → mở Cowork chat mới → gõ `tiếp tục` → làm việc → `END.bat`

- Repo chính: Windows local (không USB). Path trên máy nhà: `C:\Users\TRI\Documents\Claude\Projects\TrishTEAM\trishnexus-monorepo\`
- Đồng bộ qua GitHub: `hosytri07/trishnexus-monorepo`
- **Máy cơ quan lần đầu (bootstrap):** mở PowerShell → `cd Documents\Claude\Projects` → `git clone https://github.com/hosytri07/trishnexus-monorepo.git TrishTEAM\trishnexus-monorepo` → chạy `SETUP.bat` 1 lần duy nhất. Từ đó dùng START/END bình thường.

---

## Trạng thái hiện tại (cuối session 2026-04-22 sáng — máy nhà)

### Đã hoàn thành
- ✅ **Sprint 1 (website)**: `tokens.css` deployed Vercel, accent `#667EEA` live trên 11 trang.
- ✅ **Monorepo scaffold + GitHub**: `hosytri07/trishnexus-monorepo` pushed.
- ✅ **shared/trishteam_core**: package Python chung, editable install.
- ✅ **apps/trishdesign**: scaffold xong, 14 sidebar items smoke test pass.
- ✅ **USB/GitHub scripts**: START/END/SETUP.bat + README.txt (đã pivot từ USB sang GitHub sync).
- ✅ **CLAUDE.md + handoff mechanism**: Magic phrase `tiếp tục` / `chốt` / `bấm END.bat` hoạt động.
- ✅ **TrishFont refactor LOGIC xong** (session 2026-04-22):
    - Bug freeze fix: PreviewView rewrite thành split view (QListWidget + QLabel preview), chỉ render 1 font/thời điểm.
    - Curated folder scan: `FontRepository.scan_folder(path)` thay `scan_system()`, hỗ trợ .ttf/.otf/.ttc/.otc recursive.
    - Settings module mới: `modules/settings/{models,paths,repository,__init__}.py` với MIGRATION_002_SETTINGS + key `font_library_path`.
    - Path resolution 4 tầng: SQLite → env `TRISHFONT_FONT_DIR` → frozen exe `/fonts` → None (popup picker).
    - Auto-scan khi startup nếu path đã lưu.
    - App chạy được, **không freeze**, Tiếng Việt render tốt (Segoe UI global font).
    - Dark theme sơ bộ với accent gradient `#667EEA → #764BA2` match website.

### Đang dở — PICK UP TỪ ĐÂY

**🎨 UI Design System Sprint (ƯU TIÊN CAO — user vừa feedback mạnh)**

User đã gửi 2 screenshot app cũ của họ làm **design reference bắt buộc** cho cả 6 app TrishNexus:
1. **TrishFont v1.0.0 cũ** (screenshot attach trước) — có header logo ✨ + version + Admin dot, toolbar inline "Font: [path] [Quét lại] AutoCAD Fonts: [path] [Chọn]", bulk action "Chọn tất cả / Bỏ chọn / counter / ⚡ Cài đặt font đã chọn (gradient)", card groups có folder icon + tên accent + badge "4 file" + checkboxes, log panel đáy với monospace + màu xanh lá ghi "✓ Quét xong: 11 nhóm, 1716 file font".
2. **Trish Library 1.0** (screenshot attach sau) — header mảnh, toolbar inline "📍 Đang xem: [input]  🔍 Tìm kiếm: [input] | Tất cả (*.*)", 2-column split (sidebar "Các Thư Viện Của Bạn" + file explorer bên phải với cột Name/Size/Type/Date/Ghi chú/Link QR), footer "💾 Lưu Thông tin (gradient)" + action bar đáy "Gần đây / Báo cáo-Xuất Excel / Cài đặt / Giới thiệu".

**Phản hồi user:** *"tôi đã nói cái giao diện nó phải giống cái trước kể cả các app sau này... chỉnh lại sau này các app đều giống giao diện này ko phải chỉ đổi dark mode là xong"* + *"bạn đang vẽ các app nó quá xấu ko đạt mức kỳ vọng được của tôi"*.

**Vấn đề hiện tại:** TrishFont chạy được logic nhưng UI mới chỉ dark mode basic, chưa match design language của 2 app ref. Cần rebuild UI toàn diện.

### Việc cần làm (2 phase, tổng 2-3h)

**Phase 1 — docs/design-spec.md (30 phút):**
- Viết file `docs/design-spec.md` mô tả chi tiết:
    - Palette (accent gradient, neutral dark scale, text, border) — đã có trong `design/tokens.json` + `DARK` namespace ở `trishteam_core/ui/tokens.py`.
    - Typography (Segoe UI 10pt base, weights 400/500/600/700, monospace Cascadia Code cho log).
    - Spacing scale + compact philosophy (không Material padding bloat).
    - Widget spec từng thành phần:
        - `AppHeader` — logo emoji + app name + version label + optional status dot (Admin/Cloud/Offline).
        - `InlineToolbar` — row `[icon] Label: [QLineEdit stretch] [Button...]`, dùng cho path input, search.
        - `ActionBar` — bulk select row `[☑ Chọn tất cả] [☐ Bỏ chọn] [counter "N file được chọn"] [spacer] [gradient CTA button]`.
        - `CardGroup` — collapsible, header `[▶ folder_icon accent_name (N file) ☐Chọn tất cả N file trong nhóm]`, body là list items với checkbox + tên file.
        - `LogPanel` — dark terminal block, header "📋 Nhật ký cài đặt" + "🗑 Xóa log" button, body QPlainTextEdit monospace với color-coded entries (✓ xanh lá, ⚠ vàng, ✗ đỏ).
        - `FooterBar` — left `"TrishApp v1.0.0 · Brand tagline"`, right quick nav buttons ghost style.
        - `SplitSidebar` (cho Library-style) — left panel với tree + "+Thêm" / "-Gỡ" button row, right panel list view.
- Screenshot tham khảo mô tả bằng lời trong spec (user không gửi file ảnh lên repo, chỉ screenshot trong chat — mô tả kỹ).
- User confirm spec trước khi Phase 2.

**Phase 2 — build widgets + rebuild TrishFont (2h):**
- Tạo file: `shared/trishteam_core/src/trishteam_core/widgets/{app_header,inline_toolbar,action_bar,card_group,log_panel,footer_bar,split_sidebar}.py`.
- Export ở `widgets/__init__.py`.
- Rewrite TrishFont views:
    - `modules/library/view.py` — dùng InlineToolbar cho path + ActionBar cho bulk select; thay QTableWidget bằng CardGroup có folder structure (nhóm theo category hoặc subfolder).
    - `modules/preview/view.py` — giữ split view nhưng dùng AppHeader component.
    - App root: thêm AppHeader + FooterBar vào BaseWindow (hoặc override cho từng app).
- `trishteam_core/ui/base_window.py` — có thể cần thêm slot cho header/footer.
- Smoke test: chạy TrishFont → visual match ~80% với TrishFont v1.0.0 cũ.

### 6 app kế thừa design language này (roadmap xa)
TrishFont, TrishDesign, TrishLibrary, TrishVideo, TrishExcel, TrishPPT. Tất cả dùng chung `trishteam_core/widgets/` → sửa 1 nơi, 6 app đổi theo + đồng bộ với website `trishteam.io.vn`.

---

## Cấu trúc project (hiện tại sau pivot)

```
C:\Users\TRI\Documents\Claude\Projects\TrishTEAM\trishnexus-monorepo\
├── CLAUDE.md
├── docs/SESSION-HANDOFF.md             ← file này
├── docs/design-spec.md                  ← CẦN TẠO (Phase 1)
├── design/tokens.json                   ← source of truth
├── scripts/
│   ├── gen-tokens.js
│   ├── START.bat / END.bat / SETUP.bat
│   └── README.txt
├── shared/trishteam_core/
│   └── src/trishteam_core/
│       ├── ui/{base_window,sidebar,theme,tokens}.py
│       └── widgets/{card,empty,toast}.py  ← SẼ thêm 7 widget mới Phase 2
├── apps/
│   ├── trishdesign/                     ← scaffold xong
│   └── trishfont/
│       └── src/trishfont/
│           ├── app.py
│           └── modules/
│               ├── library/{models,repository,view}.py    ← CẦN redesign UI Phase 2
│               ├── preview/view.py                        ← CẦN redesign UI Phase 2
│               ├── favorites/view.py
│               ├── install/view.py
│               └── settings/{models,paths,repository,__init__}.py  ← NEW, OK
└── website/assets/tokens.css
```

## File code quan trọng (relative từ monorepo root)

### Logic (đã stable, không đụng ở Phase 2)
- `apps/trishfont/src/trishfont/modules/settings/*` — SettingsRepository + path resolver
- `apps/trishfont/src/trishfont/modules/library/models.py` — MIGRATION_001_FONTS, Font dataclass
- `apps/trishfont/src/trishfont/modules/library/repository.py` — FontRepository.scan_folder

### UI (sẽ redesign Phase 2)
- `shared/trishteam_core/src/trishteam_core/ui/theme.py` — QSS generator dark mode + Segoe UI global (đã basic, sẽ expand ở Phase 2)
- `shared/trishteam_core/src/trishteam_core/ui/tokens.py` — có `COLOR` (light) + `DARK` namespaces
- `shared/trishteam_core/src/trishteam_core/ui/base_window.py` — có thể cần slot cho AppHeader/FooterBar
- `apps/trishfont/src/trishfont/modules/library/view.py` — rewrite theo design spec
- `apps/trishfont/src/trishfont/modules/preview/view.py` — rewrite theo design spec

## API của trishteam_core (stable, dùng y nguyên)

- `trishteam_core.store.Database(path)` — SQLite wrapper, có `.conn`, `.transaction()`, `.close()`
- `trishteam_core.store.migrate(db, [(version, sql_str), ...])` — PRAGMA user_version
- `trishteam_core.utils.user_data_dir_for(app_name)` — platformdirs Path
- `trishteam_core.utils.get_logger(name, log_dir=)` — RotatingFileHandler
- `trishteam_core.ui.BaseWindow(title=)` — main window
- `trishteam_core.ui.apply_theme(app, dark=True)` — set Segoe UI + QSS dark
- `trishteam_core.ui.build_qss(dark=True)` — QSS string
- `trishteam_core.widgets.Card, EmptyState, Toast, show_toast(widget, message)`

## User preferences đã biết

- Không phải developer, thích giải thích ngắn gọn tiếng Việt
- Ghét gõ lệnh git dài → dùng .bat double-click
- Làm việc 2 máy (nhà + cơ quan) qua GitHub sync (đã pivot từ USB)
- Font folder curated riêng, KHÔNG scan system fonts
- Domain chính thức: `trishteam.io.vn` (TenTen, chưa cấu hình)
- Ưu tiên làm từng bước nhỏ, confirm trước khi bước tiếp
- Git config: name=`hosytri07`, email=`hosytri77@gmail.com`
- **Design language:** dark mode + gradient tím-xanh + compact + emoji có màu. Tham khảo TrishFont v1.0.0 cũ + Trish Library 1.0 của user. Không chấp nhận UI xấu/Material bloat.

---

## Chào user khi bắt đầu session mới

Gợi ý câu mở đầu:

> Chào Trí. Đã đọc handoff — đang ở sprint UI Design System, session trước đã xong LOGIC của TrishFont (không freeze, scan curated folder OK, Tiếng Việt đẹp) nhưng UI còn cơ bản, chưa match design language của TrishFont v1.0.0 + Library 1.0 của Trí. Session này có 2 phase (30 phút + 2h). Bắt đầu Phase 1 luôn (viết design-spec.md) hay Trí muốn xem lại plan?
