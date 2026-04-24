"""theme.py — QSS generator (façade, Phase 13.4 refactored).

Phase 13.4 (Task #70): nội dung QSS đã dời sang `theme_registry.py` để
11 app share 1 builder duy nhất và 7 theme trong `tokens.v2.json` đều
cover đầy đủ role-specific selector (CardGroup stripe, LogPanel,
ActionBar CTA, Sidebar pill, …).

File này giữ lại cho **backward compatibility**:

    from trishteam_core.ui.theme import apply_theme, build_qss

vẫn hoạt động giống trước. Dưới capô:

- `build_qss(dark=True)` → delegate `theme_registry.build_qss_from_theme(key)`
  với `key = theme_manager.current` nếu đã init, else default bundle.
- `dark=False` → map về theme light duy nhất hiện có (`candy`) để khỏi
  crash các caller legacy.

App mới nên gọi trực tiếp:

    from trishteam_core.ui.theme_manager import theme_manager
    theme_manager.init()
    theme_manager.apply(QApplication.instance())

Lý do giữ façade thay vì xoá: 11 app hiện đang import từ đây — Task #70
không được phép breaking change (theo ROADMAP §13 "Không break apps hiện có").
"""

from __future__ import annotations

from PyQt6.QtGui import QFont
from PyQt6.QtWidgets import QApplication, QWidget

from . import theme_registry

# Giữ export FONT_STACK để caller legacy (vd debug script) vẫn xài được.
FONT_STACK_BODY = theme_registry.FONT_STACK_BODY
FONT_STACK_MONO = theme_registry.FONT_STACK_MONO


def _resolve_legacy_theme_key(dark: bool) -> str:
    """Map từ legacy `dark` flag sang theme key mới.

    - `dark=True` (mặc định) → dùng theme_manager.current nếu đã init,
      else bundle default (trishwarm).
    - `dark=False` → `candy` (theme light duy nhất trong v2 bundle).
      Nếu bundle không có `candy` (bundle custom) → trả về default.
    """
    bundle = theme_registry.get_bundle()
    if dark:
        # Ưu tiên current từ theme_manager nếu có; lazy import để file này
        # không buộc phải load theme_manager (tránh vòng import).
        try:
            from .theme_manager import theme_manager

            key = theme_manager.current
            if key in bundle.themes:
                return key
        except Exception:
            pass
        return bundle.default_theme

    # Legacy light-mode — fallback về theme light đầu tiên tìm thấy.
    for key, palette in bundle.themes.items():
        if palette.mode == "light":
            return key
    return bundle.default_theme


def build_qss(dark: bool = True) -> str:
    """Sinh QSS stylesheet (Phase 13.4 — delegate qua theme_registry).

    Giữ signature cũ `(dark: bool = True)` cho backward compat.
    """
    key = _resolve_legacy_theme_key(dark)
    return theme_registry.build_qss_from_theme(key)


def apply_theme(target: QWidget | QApplication, dark: bool = True) -> None:
    """Gắn QSS + set global font cho app.

    target: QApplication (preferred — ảnh hưởng toàn app) hoặc QMainWindow.
    dark: True (default) → theme dark hiện tại. False → theme light
    (thường là candy) nếu có.

    Phase 13.4 note: Nếu app muốn runtime theme switch, nên gọi
    `theme_manager.apply(target)` thay vì hàm này.
    """
    app = target if isinstance(target, QApplication) else QApplication.instance()
    if app is not None:
        base_font = QFont("Be Vietnam Pro", 10)
        base_font.setStyleHint(QFont.StyleHint.SansSerif)
        app.setFont(base_font)

    target.setStyleSheet(build_qss(dark=dark))
