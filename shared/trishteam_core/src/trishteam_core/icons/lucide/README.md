# Lucide icon subset — TrishTEAM

Icon pack cho `trishteam_core.icons.qicon()`. Source: https://lucide.dev (MIT license).

## Cách dùng

```python
from trishteam_core.icons import qicon, list_icons

btn.setIcon(qicon("settings"))                   # default
btn.setIcon(qicon("search", color="#667EEA"))    # tint màu accent
btn.setIcon(qicon("check", size=24))             # size custom

print(list_icons())   # danh sách tất cả icon
```

## Thêm icon mới

1. Vào https://lucide.dev/icons/
2. Tìm icon muốn (vd "trending-up"), click → "Copy SVG" hoặc download.
3. Save vào thư mục này với tên **kebab-case** giống Lucide: `trending-up.svg`.
4. Xong — `qicon("trending-up")` tự pick up.

## Convention

- Tên file = kebab-case, giống Lucide naming (`chevron-down.svg`, không `ChevronDown.svg`).
- SVG nguyên bản từ Lucide — **giữ `stroke="currentColor"`** để tint động được.
- Không edit path data thủ công; nếu cần stroke-width khác 2, download lại từ Lucide (web có slider điều chỉnh trước khi export).

## Subset hiện có

Mở Python console:

```python
from trishteam_core.icons import list_icons
print(list_icons())
```

## Attribution

Lucide ISC/MIT — <https://github.com/lucide-icons/lucide/blob/main/LICENSE>.
