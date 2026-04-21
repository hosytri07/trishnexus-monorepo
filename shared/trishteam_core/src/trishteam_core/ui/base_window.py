"""BaseWindow — khung cửa sổ chung cho tất cả desktop app TrishNexus.

Layout:
    ┌────────────┬──────────────────────────┐
    │            │                          │
    │  Sidebar   │      Content Area        │
    │  (nav)     │      (QStackedWidget)    │
    │            │                          │
    └────────────┴──────────────────────────┘
"""

from __future__ import annotations

from PyQt6.QtCore import Qt
from PyQt6.QtWidgets import (
    QHBoxLayout,
    QMainWindow,
    QStackedWidget,
    QStatusBar,
    QWidget,
)

from .sidebar import HoverSidebar
from .theme import apply_theme


class BaseWindow(QMainWindow):
    """Chuẩn 1200×760, sidebar 220, content stack, statusbar."""

    def __init__(
        self,
        title: str = "TrishApp",
        *,
        width: int = 1200,
        height: int = 760,
    ) -> None:
        super().__init__()
        self.setWindowTitle(title)
        self.resize(width, height)
        self.setMinimumSize(960, 600)

        # Root container
        root = QWidget(self)
        self.setCentralWidget(root)

        layout = QHBoxLayout(root)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)

        # Sidebar
        self.sidebar = HoverSidebar(self)
        layout.addWidget(self.sidebar)

        # Content stack
        self.stack = QStackedWidget(self)
        layout.addWidget(self.stack, stretch=1)

        # Status bar
        self.setStatusBar(QStatusBar(self))

        # Wire up: click sidebar → switch stack
        self.sidebar.navClicked.connect(self._on_nav)

        # Apply theme
        apply_theme(self)

    # ---------- Public API ----------

    def add_page(self, key: str, label: str, widget: QWidget, icon: str = "●") -> None:
        """Thêm một trang vào stack + nav sidebar."""
        idx = self.stack.addWidget(widget)
        self.sidebar.add_item(key, label, idx, icon=icon)

    def set_current(self, key: str) -> None:
        self.sidebar.set_active(key)

    # ---------- Internal ----------

    def _on_nav(self, stack_index: int) -> None:
        self.stack.setCurrentIndex(stack_index)
