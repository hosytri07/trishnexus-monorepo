# Session Handoff — TrishNexus

**Mục đích:** Claude ở session Cowork mới đọc file này để pick up công việc đúng chỗ.

**Ngôn ngữ giao tiếp với user:** Tiếng Việt. User là Trí (hosytri07 / hosytri07@gmail.com), không phải developer — cần giải thích đơn giản, tránh jargon khi không cần thiết.

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

## Trạng thái hiện tại (cuối session 2026-04-22 tối — máy nhà, **ROUND 2 align reference**)

### ⚠ Lý do round 2

User phản hồi screenshot round 1: *"Giao diện app hiện tại không giống tôi nói, tôi nói là các giao diện phải là giao diện như tôi gửi code python của 2 app trước đó tôi code không phải giao diện thế này. Đọc và viết lại cho chuẩn nhé"*.

User upload 2 file Python reference:
- `uploads/TrishFont_v1.py` (747 dòng, 32 KB) — source của app TrishFont v1.0 cũ, **palette warm-dark + layout single-page + log HTML**.
- `uploads/TrishLibrary.py` (870 dòng, 42 KB) — source của app Trish Library 1.0, QPalette-based dark theme với split view.

Sau khi **đọc kỹ cả 2 file** (không phải đoán từ screenshot), tôi phát hiện 6 sai lệch lớn so với code cũ:
1. **Palette sai tone**: dùng cool gray `#0F1419/#1F2937`, reference dùng **warm brown-dark** `#0f0e0c / #1a1814 / #1e1c18`.
2. **Text sai tone**: dùng `#F9FAFB/#9CA3AF`, reference dùng ấm `#f5f2ed / #a09890 / #d4cec4`.
3. **Card thiếu dải màu trái**: reference FontGroupCard có `border-left: 3px solid {group_color}` tạo điểm nhấn visual chính.
4. **LogPanel sai kiểu**: dùng QPlainTextEdit + timestamp mono, reference dùng QTextEdit + HTML colored span + emoji prefix (`✅/❌/⏭`), KHÔNG có timestamp.
5. **Font sai thứ tự**: primary Segoe UI, reference dùng **Be Vietnam Pro** primary.
6. **Button primary bị lạm dụng**: mọi QPushButton có gradient, reference phần lớn nút là secondary (bg `rgba(255,255,255,0.05)`), chỉ CTA install mới gradient.

### Đã hoàn thành round 2 (session 2026-04-22 tối)

- ✅ Đọc kỹ 2 file reference (TrishFont_v1.py + TrishLibrary.py).
- ✅ **`tokens.py` rewrite**: DARK namespace dùng warm palette match reference (`bg #0f0e0c`, `bg_elevated #1a1814`, `text.primary #f5f2ed`, etc.). Font stack đổi primary → Be Vietnam Pro. Thêm `COLOR.group` với 5 màu stripe.
- ✅ **`theme.py` rewrite**: QSS mới khớp reference patterns. Button default = secondary (muted bg + muted text + accent hover). Button primary chỉ khi set `variant="primary"`. Input bg `rgba(255,255,255,0.05)`. Card role có stripe variants qua property `stripe="primary|green|amber|cyan|blue|danger"` → QSS tô dải trái 3px. Log body styled qua QSS global (mono + border + radius).
- ✅ **`card_group.py` rewrite**: match FontGroupCard. Padding 14/12. Header: toggle ▼ màu stripe + icon + name bold 12pt màu stripe + badge "N file" muted. "Chọn tất cả N file trong nhóm" là QCheckBox màu stripe (inline style). HLine divider rgba(0.06). File checkboxes indent 0 với prefix "  " (spaces). API thêm `stripe="..."` param.
- ✅ **`log_panel.py` rewrite**: QTextEdit (không phải QPlainTextEdit) + HTML colored span. Emoji do caller tự gắn (`log_success("✅ xong")`). Không auto-timestamp (flag `show_timestamp=True` opt-in). Thêm `set_progress(done, total)` + QProgressBar 5px accent gradient. `log_separator()` vẽ dòng `═══`.
- ✅ **`app_header.py` rewrite**: cao 56px (thay 40), padding 20/16. Brand dùng `RichText` với flag `name_is_html=True` để render "Trish<b>Font</b>" (bold nửa sau). Version muted 11px. 2 nút ghost update/about cao 30px.
- ✅ **`inline_toolbar.py` tweak**: padding 18/10 spacing 10 match reference config bar. Label + icon dùng `#a09890 font-size: 12px`.
- ✅ **`action_bar.py` rewrite**: 2 secondary button (Chọn tất cả / Bỏ chọn) thay cho checkbox+button cũ. Counter label swap muted ↔ bold accent khi có count. CTA primary gradient 34px cao.
- ✅ **`library/view.py` update**: CATEGORY_STRIPE dict (sans_serif→primary, serif→amber, mono→green, display→cyan). Log messages dùng emoji prefix trực tiếp trong string.
- ✅ **`app.py` update**: AppHeader dùng `app_name="Trish<b>Font</b>"` + `name_is_html=True`.
- ✅ Syntax check `py_compile` 9 file OK.

### Đang dở — PICK UP TỪ ĐÂY sau round 2

**🧪 Vẫn là Bước A: Smoke test trên Windows với code round 2**

1. `cd C:\Users\TRI\Documents\Claude\Projects\TrishTEAM\trishnexus-monorepo`
2. `git pull` (nếu từ máy kia) hoặc `scripts\RUN-TRISHFONT.bat`
3. Kỳ vọng khi chạy `python -m trishfont.app`:
   - **Tone warm** (nâu đen ấm #0f0e0c), không còn lạnh xám.
   - Header 56px với `✨ Trish**Font**` + `v1.0.0` muted + 2 nút ghost `🔄 Cập nhật` + `ℹ Giới thiệu`.
   - Sidebar compact bên trái (180px).
   - Tab Thư viện: 2 InlineToolbar (path + search) → ActionBar (2 nút secondary + counter + CTA gradient) → CardGroup có dải màu trái (primary/amber/green/cyan) → LogPanel đáy.
   - Log hiển thị `✅ Quét xong: N file` bằng HTML color xanh lá, không có `[HH:MM:SS]` prefix.
4. Nếu vẫn lệch reference: screenshot cụ thể vùng lệch, mình fix targeted.

### Bối cảnh palette (cho session sau)

Source of truth = `/mnt/uploads/TrishFont_v1.py` constants:
```
ACCENT     = "#667eea"
ACCENT2    = "#764ba2"
BG_DARK    = "#0f0e0c"   ← warm black
BG_CARD    = "#1a1814"   ← warm card
BG_ROW     = "#1e1c18"   ← warm row
TEXT_MAIN  = "#f5f2ed"   ← warm off-white
TEXT_MUTED = "#a09890"   ← warm muted
GREEN = "#10b981"; AMBER = "#f59e0b"; RED = "#ef4444"; BLUE = "#3b82f6"
```
Group colors: Unicode=ACCENT, VNI=GREEN, TCVN3=AMBER, VietwareX=CYAN#06b6d4, AutoCAD=BLUE.

---

## Trạng thái hiện tại (cuối session 2026-04-22 chiều — máy nhà) [ROUND 1 — archived, các feedback đã handle ở round 2]

### Đã hoàn thành
- ✅ **Sprint 1 (website)**: `tokens.css` deployed Vercel, accent `#667EEA` live trên 11 trang.
- ✅ **Monorepo scaffold + GitHub**: `hosytri07/trishnexus-monorepo` pushed.
- ✅ **shared/trishteam_core**: package Python chung, editable install.
- ✅ **apps/trishdesign**: scaffold xong, 14 sidebar items smoke test pass.
- ✅ **USB/GitHub scripts**: START/END/SETUP.bat + README.txt (đã pivot từ USB sang GitHub sync).
- ✅ **CLAUDE.md + handoff mechanism**: Magic phrase `tiếp tục` / `chốt` / `bấm END.bat` hoạt động.
- ✅ **TrishFont refactor LOGIC xong** (session 2026-04-22 sáng):
    - Bug freeze fix: PreviewView rewrite thành split view (QListWidget + QLabel preview), chỉ render 1 font/thời điểm.
    - Curated folder scan: `FontRepository.scan_folder(path)` thay `scan_system()`, hỗ trợ .ttf/.otf/.ttc/.otc recursive.
    - Settings module mới: `modules/settings/{models,paths,repository,__init__}.py` với MIGRATION_002_SETTINGS + key `font_library_path`.
    - Path resolution 4 tầng: SQLite → env `TRISHFONT_FONT_DIR` → frozen exe `/fonts` → None (popup picker).
    - Auto-scan khi startup nếu path đã lưu.
    - App chạy được, **không freeze**, Tiếng Việt render tốt (Segoe UI global font).
    - Dark theme sơ bộ với accent gradient `#667EEA → #764BA2` match website.
- ✅ **UI Design System Sprint — Phase 1 + Phase 2 XONG** (session 2026-04-22 chiều):
    - `docs/design-spec.md` (24 KB, 559 dòng) — palette, typography, spacing, widget spec chi tiết, mô tả 2 app ref, layout TrishFont đích.
    - Feedback user đã áp: **bỏ Admin dot** (app public, không login) → thay bằng 2 nút ghost `[🔄 Cập nhật]` + `[ℹ Giới thiệu]` ở AppHeader.
    - 9 widget mới ở `shared/trishteam_core/widgets/`:
        - `app_header.py` — AppHeader với About + Update signals
        - `inline_toolbar.py` — InlineToolbar + ToolbarField dataclass
        - `action_bar.py` — ActionBar với counter realtime + CTA gradient disabled khi counter=0
        - `card_group.py` — CardGroup (collapsible, tristate select-all, filter API)
        - `log_panel.py` — LogPanel terminal-style (log_success/warn/error color-coded)
        - `footer_bar.py` — FooterBar branding + quick nav
        - `split_sidebar.py` — SplitSidebar tree + content area
        - `dialogs.py` — AboutDialog (tác giả + 6 app ecosystem) + UpdateDialog (tab App / Data)
        - `empty.py` — thêm setter setTitle/setSubtitle/setIcon
    - `ui/theme.py` mở rộng QSS cho roles mới (app-header, inline-toolbar, action-bar, log-panel, footer-bar).
    - `ui/base_window.py` thêm `set_header()` và `set_footer()` slot (optional, không break TrishDesign).
    - `apps/trishfont/src/trishfont/modules/library/view.py` **rewrite toàn diện**: InlineToolbar path + search → ActionBar bulk select → CardGroup group theo category (sans_serif/serif/mono/display) → LogPanel đáy với splitter vertical.
    - `apps/trishfont/src/trishfont/modules/favorites/view.py` fix lại để tương thích class mới (override `_reload_groups`, ẩn path toolbar + action bar).
    - `apps/trishfont/src/trishfont/app.py` wire AppHeader + FooterBar + About/Update dialog stubs.
    - **Test:** py_compile OK 9 widget + 4 file app, AST-parse toàn repo 2299 files OK. Runtime test phải chạy trên Windows (sandbox không có libEGL).

### Đang dở — PICK UP TỪ ĐÂY

**🧪 Bước tiếp — smoke test thật trên Windows + wire worker**

### Việc cần làm (tiếp theo)

**Bước A — Smoke test trên Windows (15-30 phút):**
1. Pull GitHub về máy (hoặc file mới từ session này).
2. `pip install -e shared/trishteam_core` + `pip install -e apps/trishfont` (hoặc setup xong rồi).
3. Chạy `python -m trishfont.app` → kỳ vọng:
    - AppHeader có logo ✨ + "TrishFont v1.0.0" + 2 nút `🔄 Cập nhật` `ℹ Giới thiệu` góc phải.
    - Sidebar trái vẫn hiển thị 4 trang: Thư viện / Xem trước / Yêu thích / Cài đặt font.
    - Tab Thư viện: 2 InlineToolbar (path + search) → ActionBar → scroll với CardGroup theo category → LogPanel đáy.
    - Click `ℹ Giới thiệu` → dialog hiện tác giả + 6 app ecosystem.
    - Click `🔄 Cập nhật` → dialog 2 tab (Ứng dụng / Dữ liệu font).
    - FooterBar đáy có `TrishFont v1.0.0 · Quản lý font chuyên nghiệp` trái + quick nav phải.
4. Test flow: chọn folder font → scan → check log → tick font → counter update → bấm CTA (sẽ log "worker chưa wire" — OK, Phase 3).
5. Nếu có lỗi Qt: báo lại để fix. Nếu UI lệch spec: screenshot + feedback.

**Bước B — Wire install worker + update checker thật (Phase 3, 2-3h):**
1. `apps/trishfont/src/trishfont/modules/install/worker.py` — threading worker copy file → `%LOCALAPPDATA%\Microsoft\Windows\Fonts\` + registry entry + broadcast `WM_FONTCHANGE`.
2. `shared/trishteam_core/src/trishteam_core/update/` — module check GitHub release API cho app + font pack CDN URL.
3. Connect UpdateDialog signals vào module update thật thay stub trong app.py.
4. Connect ActionBar `ctaClicked` vào install worker (hiện đang chỉ log warn).

**Bước C — Apply design language cho TrishDesign (khi TrishFont stable, xa hơn):**
- Copy pattern: AppHeader + InlineToolbar + SplitSidebar + FooterBar.
- Test: chạy cả 2 app cạnh nhau → visual consistency ≥ 90%.

### Bối cảnh design (giữ cho session sau đọc lại)

User đã gửi 2 screenshot app cũ của họ làm **design reference bắt buộc** cho cả 6 app TrishNexus:
1. **TrishFont v1.0.0 cũ** (screenshot attach trước) — có header logo ✨ + version + Admin dot, toolbar inline "Font: [path] [Quét lại] AutoCAD Fonts: [path] [Chọn]", bulk action "Chọn tất cả / Bỏ chọn / counter / ⚡ Cài đặt font đã chọn (gradient)", card groups có folder icon + tên accent + badge "4 file" + checkboxes, log panel đáy với monospace + màu xanh lá ghi "✓ Quét xong: 11 nhóm, 1716 file font".
2. **Trish Library 1.0** (screenshot attach sau) — header mảnh, toolbar inline "📍 Đang xem: [input]  🔍 Tìm kiếm: [input] | Tất cả (*.*)", 2-column split (sidebar "Các Thư Viện Của Bạn" + file explorer bên phải với cột Name/Size/Type/Date/Ghi chú/Link QR), footer "💾 Lưu Thông tin (gradient)" + action bar đáy "Gần đây / Báo cáo-Xuất Excel / Cài đặt / Giới thiệu".

**Phản hồi user:** *"tôi đã nói cái giao diện nó phải giống cái trước kể cả các app sau này... chỉnh lại sau này các app đều giống giao diện này ko phải chỉ đổi dark mode là xong"* + *"bạn đang vẽ các app nó quá xấu ko đạt mức kỳ vọng được của tôi"*.

**Feedback mới trong session này (đã áp):**
- Admin dot → thay bằng About + Update (app public, không login).
- About dialog có tác giả + thông tin hệ sinh thái 6 app TrishNexus.
- Update button cho phép tự update data fonts mới (stub UI đã xong, wire worker Phase 3).

### Files mới tạo/sửa session này (absolute, tham khảo)

**Shared widgets (mới):**
- `shared/trishteam_core/src/trishteam_core/widgets/app_header.py`
- `shared/trishteam_core/src/trishteam_core/widgets/inline_toolbar.py`
- `shared/trishteam_core/src/trishteam_core/widgets/action_bar.py`
- `shared/trishteam_core/src/trishteam_core/widgets/card_group.py`
- `shared/trishteam_core/src/trishteam_core/widgets/log_panel.py`
- `shared/trishteam_core/src/trishteam_core/widgets/footer_bar.py`
- `shared/trishteam_core/src/trishteam_core/widgets/split_sidebar.py`
- `shared/trishteam_core/src/trishteam_core/widgets/dialogs.py`

**Shared (đã sửa):**
- `shared/trishteam_core/src/trishteam_core/widgets/__init__.py` — export 9 widget + dialogs
- `shared/trishteam_core/src/trishteam_core/widgets/empty.py` — thêm setter
- `shared/trishteam_core/src/trishteam_core/ui/theme.py` — QSS cho roles mới
- `shared/trishteam_core/src/trishteam_core/ui/base_window.py` — thêm set_header/set_footer

**TrishFont (đã sửa):**
- `apps/trishfont/src/trishfont/app.py` — wire header + footer + dialogs
- `apps/trishfont/src/trishfont/modules/library/view.py` — rewrite toàn diện
- `apps/trishfont/src/trishfont/modules/favorites/view.py` — sync với library class mới

**Docs:**
- `docs/design-spec.md` — spec v0.1
- `docs/SESSION-HANDOFF.md` — file này

### 7 app kế thừa design language này (roadmap)
TrishFont, TrishLauncher, TrishDesign, TrishLibrary, TrishNote, TrishAdmin,
TrishType. Tất cả dùng chung `trishteam_core/widgets/` → sửa 1 nơi, 7 app đổi
theo + đồng bộ với website `trishteam.io.vn`. Logo chính thức đã xử lý ở
`design/logos/<AppName>/` (remove bg, multi-size PNG + .ico). Các app cũ
TrishVideo/Excel/PPT đã loại khỏi scope — chưa có logo, chưa có nhu cầu.

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
- Git config: name=`hosytri07`, email=`hosytri07@gmail.com`
- **Design language:** dark mode + gradient tím-xanh + compact + emoji có màu. Tham khảo TrishFont v1.0.0 cũ + Trish Library 1.0 của user. Không chấp nhận UI xấu/Material bloat.

---

## Chào user khi bắt đầu session mới

Gợi ý câu mở đầu:

> Chào Trí. Đã đọc handoff — UI Design System đã xong Phase 1 + 2: 9 widget core + TrishFont rewrite xong, AppHeader có About + Update (đã bỏ Admin dot), design-spec.md v0.1 đã ghi. Giờ cần Trí **chạy thử trên Windows** (`python -m trishfont.app`) để confirm UI đúng ý. Nếu ổn → sang Phase 3 wire worker cài font + update checker. Trí test xong báo feedback (screenshot hoặc mô tả) để mình fix tiếp nhé?
