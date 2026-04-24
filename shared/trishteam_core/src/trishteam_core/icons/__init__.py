"""trishteam_core.icons — Lucide icon registry + QIcon loader helper.

Phase 13.2 (task #68). Cung cấp 1 hàm duy nhất `qicon(name, color=None, size=None)`
trả về `QIcon` sẵn sàng dùng cho PyQt6. Icon source: Lucide (https://lucide.dev),
MIT license, shipped static trong `lucide/` folder.

Usage cơ bản:

    from trishteam_core.icons import qicon

    btn = QPushButton()
    btn.setIcon(qicon("settings"))              # default color/size
    btn.setIcon(qicon("search", color="#667EEA"))  # tint specific color
    btn.setIcon(qicon("check", size=24))        # custom pixel size

Thiết kế:

- Lazy Qt import — module load được ngay cả khi PyQt6 chưa sẵn sàng (headless
  CI, unit test, v.v.). Qt chỉ import lần đầu gọi `qicon()`.
- Cache QIcon theo key `(name, color, size)` để tránh re-render SVG mỗi frame.
- Fallback graceful — icon không tồn tại → trả QIcon rỗng + log warning 1 lần;
  không raise exception làm crash app.
- Tint màu: replace `stroke="currentColor"` trong SVG thành màu cần → render
  qua `QSvgRenderer` → `QPixmap` → `QIcon`.

Naming convention:

- File SVG đặt tên kebab-case khớp Lucide: `settings.svg`, `chevron-down.svg`,
  `alert-circle.svg`.
- Khi gọi `qicon("settings")` tìm `lucide/settings.svg`.

Thêm icon mới:

1. Tải SVG từ https://lucide.dev/icons/<name>
2. Bỏ vào `shared/trishteam_core/icons/lucide/<name>.svg`
3. Xong — `qicon("name")` tự pick up.

Web side (Next.js) dùng `lucide-react` package — không chia sẻ file SVG. Tên
icon giống nhau để 1 designer có thể đọc cả 2 code base mà không lẫn.
"""

from __future__ import annotations

import logging
from functools import lru_cache
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

# Thư mục chứa SVG (shipped với package, không config từ ngoài được)
_ICONS_DIR = Path(__file__).parent / "lucide"

# Cache đơn giản theo tuple key — QIcon immutable nên share được
_ICON_CACHE: dict[tuple[str, Optional[str], int], "object"] = {}

# Một lần log "missing icon" cho mỗi tên thiếu — tránh spam log
_MISSING_LOGGED: set[str] = set()


def list_icons() -> list[str]:
    """Trả danh sách icon có sẵn (kebab-case, không bao gồm `.svg`)."""
    if not _ICONS_DIR.exists():
        return []
    return sorted(p.stem for p in _ICONS_DIR.glob("*.svg"))


def _load_svg_bytes(name: str, color: Optional[str]) -> Optional[bytes]:
    """Đọc SVG file, nếu có color thì replace currentColor → color.

    Trả None nếu icon không tồn tại.
    """
    path = _ICONS_DIR / f"{name}.svg"
    if not path.is_file():
        if name not in _MISSING_LOGGED:
            _MISSING_LOGGED.add(name)
            logger.warning(
                "Lucide icon '%s' not found in %s. "
                "Download from https://lucide.dev/icons/%s and drop SVG into folder.",
                name, _ICONS_DIR, name,
            )
        return None

    content = path.read_text(encoding="utf-8")
    if color:
        # Lucide SVG có stroke="currentColor" — replace bằng màu user yêu cầu
        content = content.replace('stroke="currentColor"', f'stroke="{color}"')
    return content.encode("utf-8")


def qicon(
    name: str,
    color: Optional[str] = None,
    size: int = 18,
):  # return type QIcon but avoid importing at module level
    """Trả về `QIcon` từ tên Lucide icon.

    Args:
        name: Tên icon kebab-case (vd "settings", "chevron-down"). Không kèm `.svg`.
        color: Hex color "#RRGGBB" hoặc None → dùng màu mặc định "currentColor"
               (thường là text color của widget parent).
        size: Pixel size cho pixmap render. Default 18px khớp `tokens.v2.json`
              → `icons.default_size`.

    Returns:
        QIcon — rỗng nếu icon không tồn tại (không raise).

    Lần đầu gọi sẽ import PyQt6 + QtSvg. Caller chịu trách nhiệm PyQt6 đã cài.
    """
    key = (name, color, size)
    if key in _ICON_CACHE:
        return _ICON_CACHE[key]

    # Lazy Qt imports — không require PyQt6 lúc module load
    try:
        from PyQt6.QtCore import QByteArray, QSize, Qt
        from PyQt6.QtGui import QIcon, QPainter, QPixmap
        from PyQt6.QtSvg import QSvgRenderer
    except ImportError as e:
        logger.error("PyQt6/QtSvg chưa cài: %s. qicon() cần PyQt6 + PyQt6-Qt6.", e)
        # Trả đối tượng dummy để không break caller
        class _DummyIcon:
            def isNull(self): return True
            def addPixmap(self, *_): pass
        return _DummyIcon()

    svg_bytes = _load_svg_bytes(name, color)
    if svg_bytes is None:
        # Missing icon → QIcon rỗng
        empty = QIcon()
        _ICON_CACHE[key] = empty
        return empty

    renderer = QSvgRenderer(QByteArray(svg_bytes))
    pixmap = QPixmap(QSize(size, size))
    pixmap.fill(Qt.GlobalColor.transparent)
    painter = QPainter(pixmap)
    renderer.render(painter)
    painter.end()

    icon = QIcon(pixmap)
    _ICON_CACHE[key] = icon
    return icon


def clear_cache() -> None:
    """Xóa icon cache — gọi khi runtime đổi theme (icon render với màu mới)."""
    _ICON_CACHE.clear()
    logger.debug("Lucide icon cache cleared (%d entries)", len(_ICON_CACHE))


__all__ = ["qicon", "list_icons", "clear_cache"]
