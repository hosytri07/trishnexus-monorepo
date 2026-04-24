# TrishTEAM Design Spec — Desktop + Agent Brief

**Version:** 2.0 (2026-04-23, Phase 13.6 — single source of truth sau khi merge `DESIGN.md`)
**Scope:** 11 app desktop TrishTEAM (TrishLauncher / TrishFont / TrishDesign / TrishLibrary / TrishNote / TrishAdmin / TrishCheck / TrishSearch / TrishClean / TrishImage + placeholder 11) + website `trishteam.io.vn`.
**Nguồn:**
- **Source of truth:** `design/tokens.v2.json` (v2.1.0 — 2 theme `dark` + `light` + `theme_aliases` backward compat).
- **QSS builder:** `shared/trishteam_core/ui/theme_registry.py` — `build_qss_from_theme(key)`.
- **Runtime switcher:** `shared/trishteam_core/ui/theme_manager.py` — singleton `theme_manager` + signal `theme_changed(str)`.
- **Inspiration:** 2 app Python cũ của user (`TrishFont_v1.py` + `TrishLibrary.py` trong `/mnt/uploads`).

**Audience:** designer, AI agents (Claude Code / Copilot / Cursor), và dev mới vào team. Khi conflict giữa file này và code: **tokens.v2.json > theme_registry.py > file này**.

**Changelog ngắn:**
- `v2.0` (2026-04-23) — Phase 13.6. Merge `DESIGN.md` (agent brief) vào đây thành 1 file duy nhất. Rewrite palette section match warm-dark thật (bỏ cool-gray cũ v0.1). Rút 7 theme → 2 theme. Update list 11 app. Fix AppHeader 56px (không phải 48). LogPanel bỏ timestamp, dùng HTML emoji prefix.
- `v0.1` (2026-04-22) — draft initial, cool-gray palette sai. **Archived — không dùng nữa.**

---

## 0. Triết lý

1. **Compact, không "Material bloat".** Padding nhỏ, line-height chặt. Lấy cảm hứng Figma / VS Code / Photoshop hơn Material Design. Mỗi pixel phải có lý do.
2. **Warm-dark first, light phụ.** Tone nâu-đen ấm `#0f0e0c / #1a1814 / #1e1c18` — không chói mắt khi làm việc 8 tiếng. User Việt làm engineering nhìn code/bảng tính hàng giờ. Light mode là alternative cho ngoài trời / in ấn / user preference, **không phải design-first**.
3. **Accent = gradient tím-xanh bất biến.** `#667EEA → #764BA2` ở cả dark + light. Dùng duy nhất cho: CTA chính, sidebar active, focus ring, selection. Không rải màu — giữ identity mạnh.
4. **Tiếng Việt first.** Font primary **Be Vietnam Pro** (render VN không vỡ nét khi bold), fallback Segoe UI. KHÔNG dùng font không hỗ trợ dấu.
5. **Lucide icons, không emoji cho icon chức năng.** Button / sidebar / toolbar dùng `qicon("settings")` từ `trishteam_core.icons`. Emoji chỉ dùng làm **prefix log message** (✅ ⚠ ❌ ℹ) + wordmark brand (`✨ TrishFont`).
6. **Đồng bộ website.** Gradient + accent + semantic colors xuất sang `tokens.css` (CSS vars) + `tailwind.config.theme.mjs` để `trishteam.io.vn` dùng identical palette.

---

## 1. Palette — 2 theme

Hệ có **2 theme** (Phase 13.5 rút từ 7):

| Key | Label VN | Mode | Default |
|---|---|---|---|
| `dark` | Tối (Dark) | dark | ✅ |
| `light` | Sáng (Light) | light | — |

**Legacy aliases (backward compat):** persist file cũ chứa `trishwarm` / `midnight` / `aurora` / `sunset` / `ocean` / `forest` auto-map sang `dark`; `candy` → `light`. User upgrade từ Phase 13.3/13.4 không crash. Alias table trong `design/tokens.v2.json#theme_aliases`.

### 1.1 Accent — shared giữa 2 theme

| Token | Hex | Dùng ở |
|---|---|---|
| `accent.primary` | `#667EEA` | Focus border, selection bg, link, icon stroke |
| `accent.secondary` | `#764BA2` | Gradient stop thứ 2 |
| `accent.gradient` | `linear-gradient(135deg, #667EEA 0%, #764BA2 100%)` | CTA chính, sidebar active, AppHeader emphasis |

### 1.2 Dark theme (default)

| Token | Hex | Dùng ở |
|---|---|---|
| `surface.bg` | `#0f0e0c` | Nền chính window (warm black) |
| `surface.bg_elevated` | `#1a1814` | Card, dialog, header, sidebar (warm card) |
| `surface.row` | `#1e1c18` | List row, nested group, input bg (warm row) |
| `surface.muted` | rgba(255,255,255,0.05) | Input muted, disabled bg |
| `surface.hover` | rgba(255,255,255,0.08) | Button ghost hover, row hover |
| `text.primary` | `#f5f2ed` | Tiêu đề, body chính (warm off-white) |
| `text.secondary` | `#d4cec4` | Subtitle, label |
| `text.muted` | `#a09890` | Placeholder, version label, counter |
| `border.default` | rgba(255,255,255,0.08) | Card edge, divider |
| `border.subtle` | rgba(255,255,255,0.04) | Row separator |
| `border.focus` | `#667EEA` | Focus ring 2px |

### 1.3 Light theme

| Token | Hex | Dùng ở |
|---|---|---|
| `surface.bg` | `#f7f6f3` | Nền chính window (warm off-white) |
| `surface.bg_elevated` | `#ffffff` | Card, dialog, header |
| `surface.row` | `#f0eee9` | List row, nested group |
| `surface.muted` | rgba(0,0,0,0.04) | Input muted |
| `surface.hover` | rgba(0,0,0,0.06) | Button hover |
| `text.primary` | `#1a1814` | Body text (warm charcoal) |
| `text.secondary` | `#4a4540` | Subtitle |
| `text.muted` | `#8a8280` | Placeholder, hint |
| `border.default` | rgba(0,0,0,0.08) | Card edge |
| `border.subtle` | rgba(0,0,0,0.04) | Row separator |
| `border.focus` | `#667EEA` | Focus ring |

**Contrast:** dark text/bg = ~15:1 (WCAG AAA), light text/bg = ~14:1 (WCAG AAA). Không giảm dưới 4.5:1 (AA minimum) cho bất kỳ text-on-surface pair nào.

### 1.4 Semantic — theme-independent

| Token | Hex | Dùng ở |
|---|---|---|
| `success` | `#10B981` | Log ✅, badge OK, progress done |
| `warning` | `#F59E0B` | Log ⚠, badge pending |
| `danger` | `#EF4444` | Log ❌, delete button, error border |
| `info` | `#3B82F6` | Log ℹ, notification neutral |

### 1.5 Group colors — theme-independent (CardGroup stripe)

| Variant | Hex | Dùng cho |
|---|---|---|
| `primary` | `#667EEA` | Unicode font group, default category |
| `green` | `#10B981` | VNI, success category |
| `amber` | `#F59E0B` | TCVN3, warning category |
| `cyan` | `#06B6D4` | VietwareX, info category |
| `blue` | `#3B82F6` | AutoCAD, technical category |
| `danger` | `#EF4444` | Error, restricted category |

**Quy tắc:** stripe color KHÔNG thay đổi khi đổi theme — user cần recognize nhóm file dù ở dark hay light.

---

## 2. Typography

- **Family:** Be Vietnam Pro (display + body — test VN bold OK), JetBrains Mono / Cascadia Code (mono). Global base: `QFont("Be Vietnam Pro", 10)` = ~13px, StyleHint `SansSerif` fallback.
- **Scale (px):** 11 / 12 / **13 (base)** / 14 / 16 / 20 / 24 / 32 / 40.
- **Weights:** 400 (regular) / 500 (medium) / 600 (semibold) / 700 (bold).
- **Line-height:** 1.25 heading, 1.5 body, 1.625 long-form markdown.
- **Brand wordmark:** `✨ Trish<b>Xxxx</b>` — emoji + nửa sau bold. Render HTML-aware qua `AppHeader(name_is_html=True)`.

### 2.1 Roles (dùng QSS property `role` hoặc helper function)

| Role | Size | Weight | Dùng ở |
|---|---|---|---|
| `app-title` | 13pt | 700 | AppHeader brand text |
| `app-version` | 11px | 400 | Version label (muted) |
| `h1` | 16pt | 700 | Section header panel lớn |
| `h2` | 13pt | 600 | Card group header |
| `body` | 10pt | 400 | Default text |
| `body-emphasis` | 10pt | 600 | Label quan trọng, file count |
| `caption` | 9pt | 400 | Footer, counter, hint |
| `button` | 10pt | 600 | Button label |
| `mono` | 9pt | 400 | Log entry, path display |

**Quy tắc:** KHÔNG hardcode `font-size: Npx` trong QSS widget code. Dùng token `FONT.size.*` từ `tokens.py` hoặc `setProperty("role", "...")` + QSS rule.

---

## 3. Spacing scale

| Token | Value | Use case |
|---|---|---|
| `n1` | 4px | Gap nhỏ nhất (icon ↔ text) |
| `n2` | 8px | Gap trong row (button ↔ button) |
| `n3` | 12px | Padding button subtle, section gap ngắn |
| `n4` | 16px | Padding card, gap chuẩn |
| `n5` | 20px | Padding button primary trái-phải |
| `n6` | 24px | Margin khối lớn |
| `n8` | 32px | Margin section khác chức năng |

**Quy tắc compact:**
- Padding window ngoài cùng: `n4` (không `n6+`).
- Khoảng label ↔ input trong row: `n2`.
- Khoảng 2 row trong form: `n3`.
- Button min-height **30px** (không 40px Material).

---

## 4. Radius & shadow

| Token | Value | Dùng ở |
|---|---|---|
| `radius.sm` | 6px | Input, checkbox, badge nhỏ |
| `radius.md` | 10px | Button, sidebar item, toolbar |
| `radius.lg` | 14px | Card, panel, log block |
| `radius.xl` | 20px | Modal, AppHeader wrapper |
| `radius.full` | 9999px | Pill badge, avatar |

**Shadow (dark-ready — alpha cao vì nền tối cần contrast):**

| Token | Value | Dùng |
|---|---|---|
| `shadow.xs` | `0 1px 2px rgba(0,0,0,0.20)` | Button pressed |
| `shadow.sm` | `0 1px 3px rgba(0,0,0,0.30)` | Card default, header |
| `shadow.md` | `0 4px 8px rgba(0,0,0,0.35)` | Card hover, dropdown |
| `shadow.lg` | `0 8px 20px rgba(0,0,0,0.45)` | Modal, toast |
| `shadow.xl` | `0 20px 40px rgba(0,0,0,0.55)` | Overlay heavy |

Trên light theme, alpha giảm (~0.08-0.20) — `theme_registry.build_qss_from_theme()` tự chọn.

---

## 5. Motion

| Token | Duration | Dùng |
|---|---|---|
| `fast` | 150ms | Hover, button press, checkbox toggle |
| `normal` | 240ms | Panel slide, accordion expand |
| `slow` | 360ms | Modal open/close, route transition |

Easing: `standard cubic-bezier(0.2, 0, 0, 1)` cho 90% case. Bounce chỉ dùng cho toast.

---

## 6. Widget spec — 9 thành phần core

Code ở `shared/trishteam_core/src/trishteam_core/widgets/<name>.py`. Export qua `widgets/__init__.py`. Luôn ưu tiên widget trong đây — **không re-implement** ở app code.

### 6.1 `AppHeader`

Thanh đầu mỗi app — logo + wordmark + version + action ghost. App public (không login) → KHÔNG có status dot / Admin indicator.

**Layout:** `[logo 32×32 hoặc emoji ✨] [Trish<b>Xxx</b> 13pt bold] [v1.0.0 muted 11px] ── spacer ── [🔄 Cập nhật] [🎨 Giao diện] [ℹ Giới thiệu]`

**API** (rút gọn — xem `app_header.py` docstring đầy đủ):
```python
AppHeader(
    logo_emoji: str = "✨",
    app_name: str = "TrishApp",
    version: str = "v1.0.0",
    *,
    logo_path: str | Path | None = None,   # PNG 32×32, ưu tiên hơn emoji
    show_update: bool = True,
    show_about: bool = True,
    show_theme_picker: bool = True,         # Phase 13.3+
    name_is_html: bool = False,             # để "Trish<b>Font</b>" render bold nửa sau
)
# Signals: updateRequested(), aboutRequested(), themeChanged(str)
# Slots: setUpdateAvailable(has_update: bool)
```

**Spec visual:**
- Height: **56px** (fixed). Background `surface.bg_elevated`. Border-bottom `border.subtle`.
- Padding: 0 × 16px. Layout spacing: 10px.
- Logo image 32×32 scaled KeepAspectRatio + SmoothTransformation. Nếu không có `logo_path` → emoji 14pt.
- Wordmark: `QFont("Be Vietnam Pro", 13, Bold)`, color `text.primary`. Render `Qt.TextFormat.RichText` nếu `name_is_html=True`.
- Version: role `app-version`, color `#a09890` (muted warm), 11px.
- Action buttons: `variant="ghost"`, height 30px, cursor pointer. Gap: 10px.
- **"🎨 Giao diện" menu:** QMenu với 2 QAction exclusive-group — "Tối (Dark)" + "Sáng (Light)". Click → `theme_manager.set_theme(key, target=self.window())` (target **top-level QMainWindow**, KHÔNG phải QApplication — xem Gotcha §11.1). Broadcast stylesheet cho các top-level widget khác qua `QApplication.topLevelWidgets()`.
- **Update pending:** `setUpdateAvailable(True)` → đổi text "🔄 Cập nhật mới •" + border `#F59E0B`.

### 6.2 `InlineToolbar`

Row input + action — path picker, search bar, filter.

**Layout:** `[📁] [Font:] [_____ path stretch _____] [Quét lại] [Chọn...]`

**API:**
```python
InlineToolbar(
    fields: list[ToolbarField],
    actions: list[QPushButton],
    divider_before_last_field: bool = False,
)

@dataclass
class ToolbarField:
    icon: str                # emoji "📁"
    label: str               # "Font:"
    widget: QWidget          # QLineEdit | QComboBox
    stretch: int = 1
```

**Visual:**
- Background `surface.bg_elevated`. Border-bottom `border.subtle`.
- Padding: 10 × 18px. Gap icon↔label 4px, label↔input 8px, field↔field 16px, field↔action 12px.
- Action button `variant="ghost"` — không gradient (tránh tranh focus với CTA).

### 6.3 `ActionBar`

Row action đáy panel — bulk select + CTA chính.

**Layout:** `[Chọn tất cả] [Bỏ chọn]  [Đã chọn: N file]  ── spacer ──  [⚡ Cài đặt N font đã chọn]`

**API:**
```python
ActionBar(
    select_all_label: str = "Chọn tất cả",
    deselect_all_label: str = "Bỏ chọn",
    counter_template: str = "Đã chọn: {n} file",
    cta_label: str = "⚡ Cài đặt font đã chọn",
)
# Signals: selectAllRequested, deselectAllRequested, ctaClicked
# Slots: setCounter(n), setCtaEnabled(enabled)
```

**Visual:**
- Background `surface.bg_elevated`. Border-top `border.subtle`.
- Padding: 10 × 16px.
- 2 nút secondary (ghost + padding compact, không checkbox).
- Counter: role `caption`, muted khi n=0, swap sang `accent.primary` bold khi n>0.
- CTA: height 34px, gradient `accent.primary → accent.secondary`, disabled khi `counter=0` → bg `surface.muted` + text `text.muted`.

### 6.4 `CardGroup`

Nhóm file collapsible — thay QTableWidget truyền thống. Dùng cho font list, file list, category tree.

**Layout (expanded):**
```
▼ 📁 AutoCAD Standard (4 file)                 [☑ Chọn tất cả 4 file]
  ├─ ☐ iso.shx
  ├─ ☐ romans.shx
  ├─ ☑ simplex.shx
  └─ ☐ complex.shx
```

**API:**
```python
CardGroup(
    name: str,
    items: list[CardItem],
    icon: str = "📁",
    stripe: str = "primary",    # primary|green|amber|cyan|blue|danger
    collapsed: bool = False,
)

@dataclass
class CardItem:
    id: str
    label: str
    checked: bool = False
    meta: str = ""
# Signals: itemToggled(id, checked), groupToggled(checked_all)
```

**Visual:**
- Container: `QFrame role="card"`, bg `surface.bg_elevated`, border-left **3px solid `group.<stripe>`**, radius `lg`, padding 12 × 14px.
- Header: toggle arrow (▼/▶) màu stripe, icon 14pt, name **color stripe bold 12pt**, badge "N file" pill muted.
- "Chọn tất cả N file" QCheckBox tristate (unchecked / partial / checked), color stripe.
- HLine divider rgba(255,255,255,0.06) giữa header và body.
- Body: indent 0, item dùng prefix `"  "` (2 spaces). Row height ~26px. Hover `surface.hover`.

### 6.5 `LogPanel`

Terminal đáy panel — log realtime scan/install/error.

**Layout:**
```
📋 Nhật ký cài đặt                                      [🗑 Xóa log]
────────────────────────────────────────────────────────────────
✅ Quét xong: 11 nhóm, 1716 file
⚡ Bắt đầu cài đặt 23 font...
✅ Cài đặt: Roboto-Regular.ttf
⚠ Bỏ qua (đã tồn tại): Arial.ttf
❌ Lỗi: không có quyền ghi
```

**API:**
```python
LogPanel(title: str = "Nhật ký", icon: str = "📋", show_timestamp: bool = False)
# Methods: log_info, log_success, log_warn, log_error, log_separator, clear
# Progress: set_progress(done, total) — optional QProgressBar
```

**Visual:**
- Widget: `QTextEdit` (read-only, HTML rich text) — KHÔNG phải QPlainTextEdit.
- Body bg `surface.row` (slightly darker than card để feel terminal), font `FONT_STACK_MONO` 9pt, padding 8 × 12px, radius `md`, border `border.subtle` 1px.
- Color per level (HTML span): `success #10B981` / `warning #F59E0B` / `danger #EF4444` / `info text.secondary`.
- **KHÔNG auto-timestamp.** Prefix emoji do caller gắn (`log_success("✅ xong")`). `show_timestamp=True` là opt-in khi debug.
- Auto-scroll xuống khi log mới.

### 6.6 `FooterBar`

Thanh đáy — branding trái + quick nav phải.

**Layout:** `[TrishFont v1.0.0 · Công cụ quản lý font]  ── spacer ──  [Gần đây] [Cài đặt] [Giới thiệu]`

**API:**
```python
FooterBar(
    left_text: str = "TrishApp v1.0.0 · Tagline",
    quick_nav: list[tuple[str, str]] = [],   # [(label, route_name)]
)
# Signals: navRequested(route_name)
```

**Visual:** Background `surface.bg_elevated`, border-top `border.subtle`, height 36px, padding 0×16px. Left text role `caption` color `text.muted` (có viền đen nhẹ quanh text để dễ đọc — Task #55). Quick nav button `variant="subtle"`, gap 8px.

### 6.7 `SplitSidebar` / `HoverSidebar`

Layout 2 cột — sidebar trái (tree) + content phải. Dùng cho Library/Design/Admin.

**API:** `SplitSidebar(title, icon, items: list[SidebarItem], show_add_remove=True)` — signals `itemSelected/addRequested/removeRequested`. Access `.contentArea` để gắn layout phải.

**Visual:** QSplitter horizontal. Sidebar width 200px (min 180, max 360), bg `surface.bg_elevated`. Tree item height 28px, hover `surface.hover`, selected = accent gradient pill.

### 6.8 `AboutDialog` / `UpdateDialog`

Modal chuẩn hoá ở `widgets/dialogs.py`.

- **AboutDialog:** logo + tên app + version + tác giả (Trí, hosytri07@gmail.com) + website trishteam.io.vn + list 11 app eco-system + nút Đóng.
- **UpdateDialog:** 2 tab (Ứng dụng / Dữ liệu font) — check GitHub release + download fontpacks. Button `[Kiểm tra]` / `[Tải xuống]` / `[Cài đặt]`.

### 6.9 `BaseWindow`

Container chính — wrap AppHeader + content + (optional) FooterBar. Subclass QMainWindow. `BaseWindow.__init__` tự gọi `apply_theme(self)` để set stylesheet lên QMainWindow (quan trọng cho theme switch — xem §11.1).

---

## 7. Layout reference — TrishFont

```
┌─────────────────────────────────────────────────────────────────┐
│ AppHeader 56px: ✨ Trish**Font** v1.0.0  [🔄] [🎨] [ℹ]          │
├─────────────────────────────────────────────────────────────────┤
│ InlineToolbar: 📁 Font: [...] [Quét lại] [Chọn...]              │
│                🎯 AutoCAD: [...] [Chọn]                         │
├─────────────────────────────────────────────────────────────────┤
│ ActionBar: [Chọn tất cả] [Bỏ chọn]  Đã chọn: 0  [⚡ Cài đặt]    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ▼ 📁 AutoCAD Standard (4 file)     [☑ Chọn tất cả 4]           │
│     ☐ iso.shx        ☐ romans.shx                              │
│     ☑ simplex.shx    ☐ complex.shx                             │
│                                                                 │
│  ▶ 📁 Vietnamese Serif (52 file)    [☐ Chọn tất cả 52]          │
│  ▶ 📁 Display Modern (18 file)      [☐ Chọn tất cả 18]          │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│ LogPanel 140px:                                                 │
│   📋 Nhật ký cài đặt                              [🗑 Xóa log]  │
│   ✅ Quét xong: 11 nhóm, 1716 file                              │
├─────────────────────────────────────────────────────────────────┤
│ FooterBar 36px: TrishFont v1.0.0 · Quản lý font chuyên nghiệp  │
│                               [Gần đây] [Cài đặt] [Giới thiệu]  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 8. Token → QSS mapping (reference nhanh)

| Context | CSS Property | Token path |
|---|---|---|
| Window bg | `background-color` | `surface.bg` |
| Header / Toolbar / Sidebar bg | `background-color` | `surface.bg_elevated` |
| Input / Row bg | `background-color` | `surface.row` |
| Hover bg | `background-color` | `surface.hover` |
| Primary text | `color` | `text.primary` |
| Secondary text | `color` | `text.secondary` |
| Muted text | `color` | `text.muted` |
| Card border | `border: 1px solid` | `border.default` |
| Divider | `border-top: 1px solid` | `border.subtle` |
| Focus ring | `border: 2px solid` | `border.focus` (= `accent.primary`) |
| Primary CTA bg | `background: qlineargradient(...)` | `accent.primary → accent.secondary` |
| Selection bg | `selection-background-color` | `accent.primary` |
| Log success / warn / error / info | `color` | `semantic.success/warning/danger/info` |
| CardGroup stripe | `border-left: 3px solid` | `group.<variant>` |

---

## 9. Do's & Don'ts

### Do

- Luôn dùng token refs (`text.primary`, không hardcode `#f5f2ed`).
- Giữ wordmark `Trish<b>Xxxx</b>` consistent ở mọi AppHeader.
- Text tiếng Việt có dấu — đã test Be Vietnam Pro render OK, KHÔNG escape.
- Error message tiếng Việt (UX), error code tiếng Anh (khớp Firebase/SDK).
- Log prefix emoji, **không timestamp** (chiếm chỗ không cần).
- Semantic colors (success/warning/danger/info) + group colors giữ nguyên cross-theme.
- Khi thêm UI mới có conditional style → đọc `theme_manager.current` thay vì assume dark.

### Don't

- Đừng re-implement widget đã có trong `trishteam_core.widgets`.
- Đừng hardcode hex color — vỡ khi đổi theme.
- Đừng dùng Lucide-react trong desktop (chỉ website). Desktop dùng `from trishteam_core.icons import qicon`.
- Đừng dùng emoji thay icon **chức năng** (button/toolbar) — Lucide. Emoji chỉ cho log prefix + brand wordmark.
- Đừng force theme cho user — default là `dark`, để user tự đổi.
- Đừng tạo màu mới ngoài palette — thêm vào `tokens.v2.json` + bump version.
- Đừng set stylesheet lên `QApplication.instance()` khi BaseWindow đã set lên QMainWindow — widget-level priority cao hơn, stylesheet app-level sẽ bị ghi đè. Luôn target `self.window()` hoặc loop `topLevelWidgets()`.

---

## 10. Agent prompt guide (khi sinh UI mới)

Khi Claude / Copilot / Cursor sinh component hoặc page:

1. **Đọc trước:** `design/tokens.v2.json` + file này. Nếu component đã tồn tại trong `trishteam_core.widgets` → **dùng lại**, không re-implement.
2. **Tokens:** `from trishteam_core.ui.tokens import TOKENS` — không hardcode color. Nếu cần palette động: `from trishteam_core.ui import theme_registry; theme_registry.get_theme("dark")`.
3. **Icons:** `from trishteam_core.icons import qicon` — truyền name Lucide (`"settings"`, `"download"`). KHÔNG dùng emoji cho icon button.
4. **Brand:** AppHeader `app_name="Trish<b>Font</b>", name_is_html=True`.
5. **Theme-aware:** conditional style đọc `theme_manager.current` — đừng assume dark.
6. **Apply theme:** `theme_manager.set_theme(key, target=self.window())` — target top-level QMainWindow, broadcast qua `QApplication.topLevelWidgets()` cho sub-window.
7. **Error copy:** tiếng Việt, ngắn, không prefix "Error:"/"Lỗi:" — context đủ.
8. **Log:** `trishteam_core.utils.get_logger(__name__)` + Vietnamese messages + emoji prefix.
9. **Acceptance:** `py_compile` + smoke test `python -m <app>.app` (headless dùng `QT_QPA_PLATFORM=offscreen` nếu CI).

### Không làm

- Không wildcard import `from PyQt6.QtCore import Qt, *`.
- Không call `session.login_with_password()` trong GUI thread — dùng QThread.
- Không persist credential ngoài `token_store` (DPAPI Windows / Fernet macOS-Linux).
- Không reference `TrishType` (app không còn trong registry — xoá khỏi Phase 13).
- Không reference 7 theme (`midnight/aurora/sunset/ocean/forest/candy`) — đã rút Phase 13.5. Nếu gặp persist file cũ, `theme_manager` auto resolve qua alias.

---

## 11. Gotcha — dev must-know

### 11.1 QMainWindow stylesheet priority

Qt rule: stylesheet set lên **widget** (QMainWindow, QDialog, ...) thắng stylesheet set lên **QApplication**. `BaseWindow.__init__` đã gọi `apply_theme(self)` set lên QMainWindow. Nếu muốn đổi theme runtime phải target chính widget đó (`self.window()`), không phải `QApplication.instance()`. Bug Phase 13.3-13.4 fail chính vì violation rule này — fix ở Phase 13.5.

### 11.2 Theme alias là 1-way

Alias chỉ map `legacy → canonical` (trishwarm → dark). Persist file luôn ghi canonical (`{"theme": "dark"}`). Đừng thử reverse lookup — 6 alias đều map về `dark` gây ambiguity.

### 11.3 Stripe colors theme-independent

CardGroup stripe (primary/green/amber/cyan/blue/danger) lấy từ `bundle.semantic.*` + `bundle.group.primary`, **không** từ `palette.accent`. Đổi theme dark↔light stripe không đổi — user cần recognize nhóm file.

### 11.4 Lazy import `theme_manager` trong widget code

Trong `app_header.py`, `_open_theme_menu()` lazy-import `theme_manager` để widget test được headless (không có PyQt6 libEGL). KHÔNG chuyển sang eager import ở top.

### 11.5 WCAG contrast floor

Khi thêm text/bg pair mới, kiểm tra contrast ratio. Floor: 4.5:1 (AA). Hiện dark + light đều ~14-15:1 (AAA). Không ship regression xuống AA dưới.

### 11.6 Candy light không hardcode rgba white

`theme.py` cũ dùng `rgba(255,255,255,0.05)` cho input bg — vô hình trên nền trắng light mode. Phase 13.4 fix bằng palette tokens (`surface.muted`, `surface.row`). Widget mới phải dùng token, KHÔNG hardcode.

---

## 12. Responsive

- **Website:** Tailwind breakpoints (`sm` 640 / `md` 768 / `lg` 1024 / `xl` 1280 / `2xl` 1536). Mobile-first. Sidebar collapse ở `md-`.
- **Desktop:** PyQt6 — resize handler dùng `QSplitter` cho main + sidebar. Min window 960×640. Không fullscreen kiosk mode Phase 1.
- **Density:** comfortable default. Compact mode deferred — Phase ≥14.

---

## 13. Non-goals (Phase 13)

- Custom title bar (frameless + drag) — deferred.
- Animation framework riêng — dùng QPropertyAnimation ad-hoc khi cần.
- Icon SVG set mở rộng beyond Lucide — giữ subset Lucide hiện có.
- Mobile native app — website mobile-responsive đủ.
- Thêm theme thứ 3 (sepia/high-contrast/pastel) — deferred. Nếu cần, thêm vào `tokens.v2.json#themes` + update list_themes, không break API.

---

## 14. Checklist cho Phase sau

- [ ] Khi thêm app thứ 12+ — update list app ở §scope + AboutDialog list.
- [ ] Khi đổi palette — bump `tokens.v2.json` version + run contrast check.
- [ ] Khi thêm widget mới vào `trishteam_core.widgets` — document trong §6, add vào `widgets/__init__.py` export.
- [ ] Khi đổi API widget đã có — thêm deprecation warning, giữ backward compat tối thiểu 1 Phase.
- [ ] Khi thêm semantic/group color — update §1.4/1.5 + QSS builder + theme registry test.

---

## Appendix — Archived v0.1 cool-gray palette

File cũ `v0.1 (2026-04-22)` dùng cool-gray `#0F1419 / #151B23 / #F9FAFB` — **sai**, đã thay thế bằng warm palette ở v2.0. Không tham chiếu nữa. Lý do đổi: user Trí feedback "tone lạnh xám không match TrishFont v1.0 cũ (warm brown-dark)" — Phase round-2 2026-04-22 tối, xem SESSION-HANDOFF.md.
