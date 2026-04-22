# TrishNexus Design Spec — Desktop UI

**Version:** 0.1 (draft, 2026-04-22)
**Scope:** 7 app desktop của hệ sinh thái TrishTEAM — TrishFont, TrishLauncher, TrishDesign, TrishLibrary, TrishNote, TrishAdmin, TrishType.
**Nguồn cảm hứng:** 2 app cũ của user (TrishFont v1.0.0 + Trish Library 1.0) — xem mô tả ở §7.
**Nguồn tokens:** `design/tokens.json` (source of truth) → `shared/trishteam_core/ui/tokens.py` (auto-generated).

---

## 0. Triết lý

1. **Compact, không "Material bloat".** Padding nhỏ, line-height chặt. Mỗi pixel phải có lý do. Lấy cảm hứng từ Figma / VS Code / Photoshop hơn là Material Design mặc định.
2. **Dark-first.** App desktop luôn dark theme (giống IDE / design tool chuyên nghiệp). Light theme để dành, không ưu tiên.
3. **Accent = gradient tím-xanh.** Một màu nhận diện duy nhất `#667EEA → #764BA2`. Dùng ở: CTA chính, selection, sidebar item active, focus border. Không rải ra nhiều nơi.
4. **Emoji màu như icon.** Dùng emoji (✨ 📁 ⚡ ☑ 🗑 📋 ✓ ⚠ ✗) thay cho SVG icon set nặng. Giữ phong cách thân thiện của TrishFont v1.0.0 cũ.
5. **Tiếng Việt first.** Font global = Segoe UI 10pt (render VN tốt trên Windows). Không bao giờ dùng font không hỗ trợ dấu.
6. **Đồng bộ website.** Gradient, accent, semantic colors khớp `trishteam.io.vn` để user nhận ra ngay là cùng một thương hiệu.

---

## 1. Palette

### 1.1 Accent (dùng cho CTA, selection, focus)
| Token | Hex | Dùng ở |
|---|---|---|
| `accent.primary` | `#667EEA` | Focus border, selection bg, link |
| `accent.secondary` | `#764BA2` | Gradient stop thứ 2 |
| `accent.gradient` | `linear-gradient(135deg, #667EEA 0%, #764BA2 100%)` | CTA chính, sidebar active item, header emphasis |

### 1.2 Dark surface (nền)
| Token | Hex | Dùng ở |
|---|---|---|
| `DARK.surface.bg` | `#0F1419` | Nền chính toàn cửa sổ |
| `DARK.surface.bg_elevated` | `#151B23` | Title bar, header, footer, sidebar |
| `DARK.surface.card` | `#1F2937` | CardGroup body, nền các panel nổi |
| `DARK.surface.muted` | `#111827` | QLineEdit, ô nhập, nhóm item nested |
| `DARK.surface.hover` | `#263241` | Hover state cho button ghost / list item |
| `DARK.surface.overlay` | `rgba(0,0,0,0.6)` | Modal backdrop |

### 1.3 Dark text
| Token | Hex | Dùng ở |
|---|---|---|
| `DARK.text.primary` | `#F9FAFB` | Tiêu đề, text chính |
| `DARK.text.secondary` | `#D1D5DB` | Label, text phụ |
| `DARK.text.muted` | `#9CA3AF` | Placeholder, hint, counter, version label |
| `DARK.text.inverse` | `#111827` | Text trên nền gradient sáng |
| `DARK.text.link` | `#8FA5FF` | Link dark-mode-friendly |

### 1.4 Dark border
| Token | Hex | Dùng ở |
|---|---|---|
| `DARK.border.subtle` | `#1F2937` | Divider mảnh trong panel |
| `DARK.border.default` | `#374151` | Viền card, input, button ghost |
| `DARK.border.strong` | `#4B5563` | Viền nhấn, scrollbar handle |
| `DARK.border.focus` | `#667EEA` | Border khi focus input |

### 1.5 Semantic (trạng thái, dùng chung light/dark)
| Token | Hex | Dùng ở |
|---|---|---|
| `success` | `#10B981` | Log ✓, badge OK, progress done |
| `warning` | `#F59E0B` | Log ⚠, badge chưa cấu hình |
| `danger` | `#EF4444` | Log ✗, delete button, error border |
| `info` | `#3B82F6` | Log i, notification neutral |

---

## 2. Typography

| Token | Value | Dùng ở |
|---|---|---|
| `FONT_STACK_BODY` | `"Segoe UI", "Be Vietnam Pro", "DM Sans", Arial, sans-serif` | Toàn bộ UI |
| `FONT_STACK_MONO` | `"Cascadia Code", "JetBrains Mono", "Consolas", monospace` | LogPanel, code block, path display |
| Global base size | **10pt** (PyQt setFont), tương đương ~13px | Mọi widget |

### 2.1 Role → size/weight (dùng class QFont property, không hardcode từng nơi)

| Role | Size | Weight | Ghi chú |
|---|---|---|---|
| `app-title` | 13pt | 700 (bold) | AppHeader title, logo text |
| `app-version` | 9pt | 400 | Version label cạnh title |
| `h1` | 12pt | 700 | Section header trong panel lớn |
| `h2` | 11pt | 600 | Sub-section, card group header |
| `body` | 10pt | 400 | Default |
| `body-emphasis` | 10pt | 600 | Label quan trọng, file count |
| `caption` | 9pt | 400 | Footer, counter, hint |
| `button` | 10pt | 600 | Button label |
| `mono` | 9pt | 400 | Log entry, path display |

**Quy tắc:** KHÔNG dùng font-size inline ở QSS hay widget. Tạo helper `apply_role(widget, "h1")` trong `trishteam_core/ui/typography.py` (sẽ thêm ở Phase 2).

---

## 3. Spacing scale

Dùng lại `SPACE` từ `tokens.py` — giữ compact:

| Token | Value | Use case |
|---|---|---|
| `n1` | 4px | Gap nhỏ nhất (icon ↔ text) |
| `n2` | 8px | Gap trong row (button ↔ button) |
| `n3` | 12px | Padding button subtle, gap section ngắn |
| `n4` | 16px | Padding card nội dung, gap chuẩn |
| `n5` | 20px | Padding button primary trái-phải |
| `n6` | 24px | Margin giữa các khối lớn |
| `n8` | 32px | Margin giữa section khác chức năng |

**Quy tắc compact:**
- Padding ngoài cùng window: `n4` (không `n6` trở lên).
- Khoảng giữa label và input trong row: `n2`.
- Khoảng giữa 2 row trong form: `n3`.
- Button tối thiểu `min-height: 28px` (đã set trong theme.py), KHÔNG 40px kiểu Material.

---

## 4. Radius & shadow

| Token | Value | Dùng ở |
|---|---|---|
| `RADIUS.sm` (6px) | Input, checkbox, badge nhỏ |
| `RADIUS.md` (10px) | Button, sidebar item, toolbar |
| `RADIUS.lg` (14px) | Card, panel, log block |
| `RADIUS.xl` (20px) | Modal, AppHeader wrapper |
| `SHADOW.sm` | Card mặc định |
| `SHADOW.md` | Dropdown, popover |
| `SHADOW.lg` | Modal, toast |

Dark theme: shadow nhẹ tay hơn, KHÔNG dùng shadow xl cho card (dark bg + shadow đen sẽ không thấy).

---

## 5. Motion

| Token | Duration | Dùng ở |
|---|---|---|
| `fast` | 150ms | Hover, button press, checkbox toggle |
| `normal` | 240ms | Panel slide, accordion expand |
| `slow` | 360ms | Modal open/close, route transition |

Easing: `standard cubic-bezier(0.2, 0, 0, 1)` cho 90% trường hợp. Bounce chỉ dùng cho toast.

---

## 6. Widget spec (7 thành phần core)

Mỗi widget nằm ở `shared/trishteam_core/src/trishteam_core/widgets/<name>.py` và export qua `widgets/__init__.py`. API Python đều dùng PyQt6.

### 6.1 `AppHeader`
**Mục đích:** Thanh đầu mỗi app — logo + tên + version + 2 action ghost (Cập nhật, Giới thiệu). App public, không login → KHÔNG có status dot / Admin indicator.

**Layout (trái → phải):**
```
[emoji_logo 18pt] [app_name — bold 13pt] [version — muted 9pt]  ────spacer────  [🔄 Cập nhật]  [ℹ Giới thiệu]
```

**API:**
```python
AppHeader(
    logo_emoji: str = "✨",
    app_name: str = "TrishFont",
    version: str = "v1.0.0",
    show_update: bool = True,
    show_about: bool = True,
)
# Signals: updateRequested(), aboutRequested()
# Slots: setUpdateAvailable(has_update: bool)  → khi có update, thêm dot cam cạnh icon 🔄
```

**Spec visual:**
- Background: `DARK.surface.bg_elevated` (#151B23)
- Border-bottom: 1px `DARK.border.subtle`
- Height: 48px (fixed)
- Padding: 0 16px
- `emoji_logo`: 18pt, có thể thêm glow gradient primary khi hover (optional Phase 3)
- `app_name`: role `app-title`, color `text.primary`
- `version`: role `app-version`, color `text.muted`, đứng sát `app_name`
- Action button `🔄 Cập nhật` / `ℹ Giới thiệu`: variant `subtle` (nền trong, không border). Gap giữa 2 nút: `n2`.
- Khi có update mới (`setUpdateAvailable(True)`): chèn 1 dot 6px màu `semantic.warning` (#F59E0B) ở góc trên phải của icon 🔄.

**Behavior:**
- Click `🔄 Cập nhật` → emit `updateRequested()`. App sẽ:
  - Mở dialog `UpdateDialog` (Phase 2 sau) gồm 2 tab:
    1. **Ứng dụng:** check GitHub release mới cho app.
    2. **Dữ liệu font:** đồng bộ font packs mới (download từ cloud source / manual import từ folder).
  - Mỗi tab có button `[Kiểm tra]` / `[Tải xuống]` / `[Cài đặt]`.
- Click `ℹ Giới thiệu` → emit `aboutRequested()`. App sẽ mở dialog `AboutDialog` gồm:
  - Logo + tên app + version
  - Tác giả: **Trí (hosytri07)** · email hosytri07@gmail.com
  - Website: **trishteam.io.vn**
  - Hệ sinh thái TrishNexus: liệt kê 6 app + mô tả ngắn mỗi app (1 dòng).
  - Copyright © 2026 TrishTeam.
  - Button `[Đóng]`.

**Reference:** TrishFont v1.0.0 cũ có status dot `Admin` — bản mới bỏ vì app public, không login. Thay bằng 2 nút ghost ở cùng vị trí.

---

### 6.2 `InlineToolbar`
**Mục đích:** Row input + action, dùng cho path picker, search bar, filter.

**Layout mẫu (TrishFont — Font folder picker):**
```
[📁] [Font:] [_________ path stretch _________] [Quét lại] [Chọn...]
```

**Layout mẫu (Library — search):**
```
[📍 Đang xem:] [_______ path stretch _______]   [🔍 Tìm kiếm:] [______ stretch ______] [|] [Tất cả (*.*)  ▾]
```

**API:**
```python
InlineToolbar(
    fields: list[ToolbarField],  # mỗi field là icon + label + input/dropdown
    actions: list[QPushButton],  # button bên phải
    divider_before_last_field: bool = False,  # cho trường hợp Library
)

@dataclass
class ToolbarField:
    icon: str          # emoji "📁"
    label: str         # "Font:"
    widget: QWidget    # QLineEdit | QComboBox
    stretch: int = 1
```

**Spec visual:**
- Background: `DARK.surface.bg_elevated`
- Border-bottom: 1px `DARK.border.subtle`
- Padding: 8px 12px
- Gap giữa icon ↔ label: `n1` (4px)
- Gap giữa label ↔ input: `n2` (8px)
- Gap giữa field ↔ field: `n4` (16px)
- Gap giữa field cuối ↔ action: `n3` (12px)
- Action button: variant `ghost` (nền trong, viền mảnh), không gradient để không tranh focus với CTA chính.
- `divider_before_last_field=True` → chèn `|` text muted trước field cuối (kiểu Library cũ tách "Đang xem" và "Tìm kiếm").

---

### 6.3 `ActionBar`
**Mục đích:** Row action đáy panel — bulk select + CTA chính.

**Layout:**
```
[☑ Chọn tất cả] [☐ Bỏ chọn] [Đã chọn: N file]  ────spacer────  [⚡ Cài đặt N font đã chọn (gradient)]
```

**API:**
```python
ActionBar(
    select_all_label: str = "Chọn tất cả",
    deselect_all_label: str = "Bỏ chọn",
    counter_template: str = "Đã chọn: {n} file",
    cta_label: str = "⚡ Cài đặt font đã chọn",
    cta_icon: str = "⚡",
)
# Signals: selectAllRequested, deselectAllRequested, ctaClicked
# Slots: setCounter(n: int), setCtaEnabled(enabled: bool)
```

**Spec visual:**
- Background: `DARK.surface.bg_elevated`
- Border-top: 1px `DARK.border.subtle`
- Padding: 12px 16px
- 2 nút select là checkbox styled (không phải button)
- Counter: role `caption`, màu `text.muted`, update realtime khi user tick
- CTA: QPushButton default (đã gradient sẵn trong theme.py). Disabled khi counter = 0 → màu `surface.muted` + text `text.muted`.

**Reference:** TrishFont v1.0.0 cũ — nút "⚡ Cài đặt 123 font đã chọn" full gradient ở góc phải đáy panel.

---

### 6.4 `CardGroup`
**Mục đích:** Thay cho QTableWidget truyền thống — nhóm file theo folder/category, collapsible.

**Layout (collapsed):**
```
[▶] [📁] [Tên nhóm — accent bold] [badge "4 file"]  ────spacer────  [☐ Chọn tất cả 4 file]
```

**Layout (expanded):**
```
[▼] [📁] [Tên nhóm — accent bold] [badge "4 file"]  ────spacer────  [☑ Chọn tất cả]
    ├── [☑] filename_001.ttf
    ├── [☐] filename_002.ttf
    ├── [☑] filename_003.ttf
    └── [☐] filename_004.ttf
```

**API:**
```python
CardGroup(
    name: str,
    items: list[CardItem],      # file con
    icon: str = "📁",
    collapsed: bool = False,
)

@dataclass
class CardItem:
    id: str
    label: str              # tên file
    checked: bool = False
    meta: str = ""          # size, type — phụ, nhỏ

# Signals: itemToggled(id, checked), groupToggled(checked_all)
```

**Spec visual:**
- Container: QFrame role=`card` (đã có style trong theme.py). Background `surface.card`, border `border.subtle`, radius `lg`, padding `n4`.
- Header row:
    - Toggle arrow (`▶`/`▼`): QToolButton kiểu subtle, 16px.
    - Icon folder: emoji 14pt.
    - Name: role `h2`, color = `accent.primary` (#667EEA) — match TrishFont cũ.
    - Badge: pill nhỏ, bg `surface.muted`, text `text.secondary`, padding 2px 8px, radius `full`, font `caption`.
    - Checkbox "Chọn tất cả N": tri-state (unchecked / partial / checked).
- Body (khi expanded):
    - Indent 24px trái (thẳng hàng với icon).
    - Mỗi row: checkbox + label + spacer + meta (muted).
    - Row height: 28px.
    - Hover: bg `surface.hover`.

**Reference:** TrishFont v1.0.0 cũ — các nhóm "📁 AutoCAD Standard (4 file)", "📁 Vietnamese Serif (52 file)" với tên màu accent.

---

### 6.5 `LogPanel`
**Mục đích:** Terminal đen hiển thị log realtime — quét, cài đặt, lỗi.

**Layout:**
```
╔═════════════════════════════════╗
║ 📋 Nhật ký cài đặt    [🗑 Xóa log] ║  ← header
╠═════════════════════════════════╣
║ [10:23:04] ✓ Quét xong: 11 nhóm, 1716 file   ║
║ [10:23:15] ⚡ Bắt đầu cài đặt 23 font...      ║  ← body monospace
║ [10:23:17] ✓ Cài đặt: Roboto-Regular.ttf     ║
║ [10:23:18] ⚠ Bỏ qua (đã tồn tại): Arial.ttf  ║
║ [10:23:20] ✗ Lỗi: không có quyền ghi         ║
╚═════════════════════════════════╝
```

**API:**
```python
LogPanel(title: str = "Nhật ký", icon: str = "📋")

# Methods
log_info(msg: str)
log_success(msg: str)   # prefix ✓, màu success
log_warn(msg: str)      # prefix ⚠, màu warning
log_error(msg: str)     # prefix ✗, màu danger
clear()
```

**Spec visual:**
- Header: height 32px, bg `surface.bg_elevated`, border-bottom `border.subtle`
- Header title trái: icon + role `body-emphasis`
- Header action phải: "🗑 Xóa log" — button variant `subtle`
- Body: QPlainTextEdit, read-only
    - Background: `#0A0F14` (tối hơn bg chính một chút cho cảm giác "terminal")
    - Font: FONT_STACK_MONO 9pt
    - Padding: 8px 12px
    - Color per level:
        - success `#10B981` (xanh lá)
        - warning `#F59E0B` (vàng)
        - danger `#EF4444` (đỏ)
        - info `#D1D5DB` (secondary — xám sáng)
    - Timestamp prefix `[HH:MM:SS]` màu `text.muted`
- Auto-scroll xuống khi có log mới.
- Radius bao ngoài: `RADIUS.md`, border `border.subtle` 1px.

**Reference:** TrishFont v1.0.0 cũ — panel đáy với dòng "✓ Quét xong: 11 nhóm, 1716 file font" màu xanh lá monospace.

---

### 6.6 `FooterBar`
**Mục đích:** Thanh đáy app — branding trái + quick nav phải.

**Layout:**
```
[TrishFont v1.0.0 · Công cụ quản lý font chuyên nghiệp]  ────spacer────  [Gần đây] [Báo cáo] [Cài đặt] [Giới thiệu]
```

**API:**
```python
FooterBar(
    left_text: str = "TrishApp v1.0.0 · Tagline",
    quick_nav: list[tuple[str, str]] = [],  # [(label, route_name)]
)
# Signals: navRequested(route_name: str)
```

**Spec visual:**
- Background: `DARK.surface.bg_elevated`
- Border-top: 1px `DARK.border.subtle`
- Height: 36px
- Padding: 0 16px
- `left_text`: role `caption`, color `text.muted`
- Quick nav: button variant `subtle`, gap `n2` giữa nút

**Reference:** Trish Library 1.0 — đáy có "Gần đây · Báo cáo-Xuất Excel · Cài đặt · Giới thiệu".

---

### 6.7 `SplitSidebar`
**Mục đích:** Layout 2 cột — sidebar trái (tree/list) + content panel phải. Dùng cho các app có navigation ngang hàng (Library, Design, Excel).

**Layout:**
```
┌─────────────────┬────────────────────────────────────────────┐
│ 📚 Thư viện     │                                            │
│ ├ Font          │                                            │
│ ├ Vector        │          [Content panel]                   │
│ └ Ảnh           │                                            │
│                 │                                            │
│ [+ Thêm] [- Gỡ] │                                            │
└─────────────────┴────────────────────────────────────────────┘
```

**API:**
```python
SplitSidebar(
    title: str = "Các Thư Viện Của Bạn",
    icon: str = "📚",
    items: list[SidebarItem],
    show_add_remove: bool = True,
)

@dataclass
class SidebarItem:
    id: str
    label: str
    icon: str = ""
    children: list[SidebarItem] = field(default_factory=list)

# Signals: itemSelected(id), addRequested(), removeRequested(id)
# Access: .contentArea -> QWidget để bên app dùng setLayout()
```

**Spec visual:**
- QSplitter horizontal, handle 1px `border.subtle`.
- Sidebar width mặc định: 240px (min 180, max 360).
- Sidebar bg: `surface.bg_elevated` (cùng role `sidebar` đã có QSS).
- Title row: role `h2`, padding 12px 16px.
- Tree items dùng QTreeWidget styled (borderless, row height 28, hover `surface.hover`, selected gradient).
- Action row dưới: 2 button ghost nhỏ `[+ Thêm]` `[- Gỡ]`, gap `n2`.
- Content area phải: `surface.bg` mặc định, padding 0 (để app tự quyết).

**Reference:** Trish Library 1.0 — sidebar trái "Các Thư Viện Của Bạn" + file explorer phải.

---

## 7. Mô tả 2 screenshot reference (user đã gửi trong chat, không attach vào repo)

### 7.1 TrishFont v1.0.0 (app cũ user làm)

**Từ trên xuống dưới:**

1. **Header row:** `✨ TrishFont v1.0.0` bên trái + `[🔄 Cập nhật] [ℹ Giới thiệu]` bên phải. Nền tối, cao ~48px. (Bản cũ có dot `Admin` — **bản mới bỏ** vì app public, không login.)

2. **InlineToolbar (path input):**
   - `📁 Font: [D:\TRI\FONTS .........................] [Quét lại] [Chọn...]`
   - `🎯 AutoCAD Fonts: [C:\Program Files\AutoCAD\Fonts ...] [Chọn]`
   - 2 row, mỗi row 1 path + button ghost.

3. **ActionBar (bulk select) nằm trên nội dung:**
   - `[☑ Chọn tất cả] [☐ Bỏ chọn]   Đã chọn: 23 file     [⚡ Cài đặt 23 font đã chọn]` (nút gradient lớn).

4. **Scroll area nội dung — nhiều CardGroup:**
   - Mỗi nhóm là 1 card expandable:
     - `▼ 📁 AutoCAD Standard (4 file)                        [☑ Chọn tất cả 4 file]`
     - Tên nhóm "AutoCAD Standard" in **màu accent `#667EEA`**, bold.
     - Body list 4 file mỗi dòng có checkbox đầu dòng.
   - Các nhóm tiếp theo: `📁 Vietnamese Serif (52 file)`, `📁 Display Modern (18 file)` v.v.

5. **LogPanel đáy:**
   - Header: `📋 Nhật ký cài đặt` — bên phải `[🗑 Xóa log]`.
   - Body monospace đen:
     - `[10:22:15] ✓ Quét xong: 11 nhóm, 1716 file font` (xanh lá)
     - `[10:23:04] ⚡ Bắt đầu cài đặt 23 font đã chọn...` (trắng)

### 7.2 Trish Library 1.0 (app cũ user làm)

**Từ trên xuống dưới:**

1. **Header mảnh:** `📚 Trish Library 1.0  ·  1.0.0` (header thấp hơn TrishFont, không có status dot).

2. **InlineToolbar (2 field cùng row):**
   - `📍 Đang xem: [D:\Thư viện\Font Việt] | 🔍 Tìm kiếm: [_________]  [Tất cả (*.*)  ▾]`
   - Divider `|` giữa 2 field.

3. **Body = SplitSidebar:**
   - **Trái (sidebar ~240px):** title `📚 Các Thư Viện Của Bạn`, list thư viện đã thêm. Đáy có 2 nút nhỏ `[+ Thêm]` `[- Gỡ]`.
   - **Phải (content):** file explorer dạng bảng với các cột: `Name | Size | Type | Date | Ghi chú | Link QR`.
   - Row trong bảng có hover subtle.

4. **Footer action bar (trên FooterBar chính):**
   - `💾 Lưu Thông tin` — button gradient lớn chính giữa đáy content area.

5. **FooterBar cuối cùng:**
   - `Trish Library 1.0 · Quản lý thư viện cá nhân`  —  `[Gần đây] [Báo cáo-Xuất Excel] [Cài đặt] [Giới thiệu]`

---

## 8. Áp dụng cho TrishFont (layout đích Phase 2)

```
┌─────────────────────────────────────────────────────────────────┐
│ AppHeader:  ✨ TrishFont v1.0.0       [🔄 Cập nhật] [ℹ Giới thiệu]│
├─────────────────────────────────────────────────────────────────┤
│ InlineToolbar: 📁 Font: [.....path.....] [Quét lại] [Chọn...]   │
│                🎯 AutoCAD: [.....path.....]           [Chọn]    │
├─────────────────────────────────────────────────────────────────┤
│ ActionBar:  ☑ Tất cả  ☐ Bỏ chọn   Đã chọn: 0   [⚡ Cài đặt]    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ▼ 📁 AutoCAD Standard (4 file)        [☑ Chọn tất cả 4]        │
│     ☐ iso.shx                                                   │
│     ☐ romans.shx                                                │
│     ...                                                         │
│                                                                 │
│  ▶ 📁 Vietnamese Serif (52 file)       [☐ Chọn tất cả 52]       │
│  ▶ 📁 Display Modern (18 file)         [☐ Chọn tất cả 18]       │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│ LogPanel (180px):                                               │
│   📋 Nhật ký cài đặt                              [🗑 Xóa log]  │
│   [10:23:04] ✓ Quét xong: 11 nhóm, 1716 file font               │
├─────────────────────────────────────────────────────────────────┤
│ FooterBar: TrishFont v1.0.0 · Quản lý font chuyên nghiệp        │
│                           [Gần đây] [Cài đặt] [Giới thiệu]      │
└─────────────────────────────────────────────────────────────────┘
```

Preview view (khi user chọn 1 font để xem) mở trong **split pane riêng hoặc tab mới**, không overlay lên layout này — giữ bản rewrite session trước (QListWidget + QLabel preview) nhưng wrap trong `AppHeader` + `FooterBar` để đồng nhất.

---

## 9. Mapping token → QSS property (reference nhanh khi code)

| Context | Property | Token |
|---|---|---|
| Window bg | `background-color` | `DARK.surface.bg` |
| Header/Footer/Toolbar bg | `background-color` | `DARK.surface.bg_elevated` |
| Card bg | `background-color` | `DARK.surface.card` |
| Input bg | `background-color` | `DARK.surface.muted` |
| Hover bg | `background-color` | `DARK.surface.hover` |
| Primary text | `color` | `DARK.text.primary` |
| Secondary text | `color` | `DARK.text.secondary` |
| Muted text | `color` | `DARK.text.muted` |
| Card border | `border: 1px solid` | `DARK.border.subtle` |
| Input border | `border: 1px solid` | `DARK.border.default` |
| Focus border | `border: 2px solid` | `DARK.border.focus` |
| Primary CTA bg | `background: qlineargradient(...)` | accent primary → secondary |
| Selection bg | `selection-background-color` | `accent.primary` |
| Log success | `color` | `semantic.success` |
| Log warning | `color` | `semantic.warning` |
| Log danger | `color` | `semantic.danger` |

---

## 10. Non-goals (session này KHÔNG làm)

- Light theme — dời sau.
- Animation framework riêng — dùng QPropertyAnimation từng chỗ khi cần.
- Custom title bar (frameless window + drag) — Phase sau, giữ native title bar.
- Icon SVG set — tiếp tục dùng emoji cho đến khi user muốn upgrade.
- Responsive / mobile — TrishNexus là desktop-only.

---

## 11. Checklist trước khi bước sang Phase 2

- [ ] User đọc spec, confirm palette + layout 2 app ref mô tả đúng.
- [ ] User confirm 7 widget cover đủ nhu cầu (hoặc bổ sung thêm).
- [ ] User confirm emoji-as-icon vẫn ổn (thay vì SVG set).
- [ ] Sau confirm → tạo file widget khung (stub) + rewrite TrishFont views.
