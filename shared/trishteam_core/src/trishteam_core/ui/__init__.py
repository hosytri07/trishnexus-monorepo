"""trishteam_core.ui — Base window, theme, sidebar, QSS generator."""

from .base_window import BaseWindow
from .theme import apply_theme, build_qss
from .sidebar import HoverSidebar

__all__ = ["BaseWindow", "apply_theme", "build_qss", "HoverSidebar"]
