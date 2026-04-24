"""trishteam_core.ui — Base window, theme, sidebar, QSS generator.

PyQt6-bound exports (BaseWindow, apply_theme, build_qss, HoverSidebar,
ThemeManager) được import lazily để test/CI headless không crash khi
libEGL vắng. Import trực tiếp từ submodule nếu cần eager load.
"""

from __future__ import annotations

# Pure-Python — luôn safe để eager import (không cần PyQt6).
from . import theme_registry

__all__ = [
    "BaseWindow",
    "HoverSidebar",
    "apply_theme",
    "build_qss",
    "theme_registry",
    "ThemeManager",
    "theme_manager",
]


def __getattr__(name: str):
    """Lazy load PyQt6-dependent symbols — fail chỉ khi caller thực sự dùng."""
    if name == "BaseWindow":
        from .base_window import BaseWindow

        return BaseWindow
    if name == "HoverSidebar":
        from .sidebar import HoverSidebar

        return HoverSidebar
    if name in ("apply_theme", "build_qss"):
        from . import theme as _theme

        return getattr(_theme, name)
    if name == "ThemeManager":
        from .theme_manager import ThemeManager

        return ThemeManager
    if name == "theme_manager":
        from .theme_manager import theme_manager

        return theme_manager
    raise AttributeError(f"module 'trishteam_core.ui' has no attribute {name!r}")
