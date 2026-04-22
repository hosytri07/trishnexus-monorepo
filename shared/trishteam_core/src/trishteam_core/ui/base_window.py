"""BaseWindow — khung cửa sổ chung cho tất cả desktop app TrishNexus.

Layout đầy đủ (header + footer optional):
    ┌─────────────────────────────────────────────────┐
    │ AppHeader (optional — set via set_header)       │
    ├────────────┬────────────────────────────────────┤
    │            │                                    │
    │  Sidebar   │       Content Area                 │
    │  (nav)     │       (QStackedWidget)             │
    │            │                                    │
    ├────────────┴────────────────────────────────────┤
    │ FooterBar (optional — set via set_footer)       │
    └─────────────────────────────────────────────────┘

Header/footer do từng app tự tạo và truyền vào, BaseWindow chỉ lo slot.
"""

from __future__ import annotations

from PyQt6.QtCore import Qt
from PyQt6.QtWidgets import (
    QHBoxLayout,
    QMainWindow,
    QStackedWidget,
    QStatusBar,
    QVBoxLayout,
    QWidget,
)

from .sidebar import HoverSidebar
from .theme import apply_theme


class BaseWindow(QMainWindow):
    """Chuẩn 1200×760, sidebar 220, content stack, header/footer optional."""

    def __init__(
        self,
        title: str = "TrishApp",
        *,
        width: int = 1200,
        height: int = 760,
        show_status_bar: bool = False,
    ) -> None:
        super().__init__()
        self.setWindowTitle(title)
        self.resize(width, height)
        self.setMinimumSize(960, 600)

        # Root container — vertical stack: [header?] [body] [footer?]
        root = QWidget(self)
        self.setCentralWidget(root)

        self._vstack = QVBoxLayout(root)
        self._vstack.setContentsMargins(0, 0, 0, 0)
        self._vstack.setSpacing(0)

        # Slot header (index 0 — insert trước body khi có)
        self._header: QWidget | None = None

        # Body row (sidebar + content)
        self._body = QWidget(root)
        body_layout = QHBoxLayout(self._body)
        body_layout.setContentsMargins(0, 0, 0, 0)
        body_layout.setSpacing(0)

        # Sidebar
        self.sidebar = HoverSidebar(self._body)
        body_layout.addWidget(self.sidebar)

        # Content stack
        self.stack = QStackedWidget(self._body)
        body_layout.addWidget(self.stack, stretch=1)

        self._vstack.addWidget(self._body, stretch=1)

        # Slot footer (append cuối)
        self._footer: QWidget | None = None

        # Status bar (optional)
        if show_status_bar:
            self.setStatusBar(QStatusBar(self))

        # Wire up: click sidebar → switch stack
        self.sidebar.navClicked.connect(self._on_nav)

        # Apply theme
        apply_theme(self)

    # ---------- Public API ----------

    def set_header(self, widget: QWidget) -> None:
        """Cắm AppHeader (hoặc widget tương tự) vào slot đầu window.

        Gọi 1 lần duy nhất. Gọi lại sẽ replace header cũ.
        """
        if self._header is not None:
            self._header.setParent(None)
            self._vstack.removeWidget(self._header)
        self._header = widget
        self._vstack.insertWidget(0, widget)

    def set_footer(self, widget: QWidget) -> None:
        """Cắm FooterBar vào slot cuối window."""
        if self._footer is not None:
            self._footer.setParent(None)
            self._vstack.removeWidget(self._footer)
        self._footer = widget
        self._vstack.addWidget(widget)

    def add_page(self, key: str, label: str, widget: QWidget, icon: str = "●") -> None:
        """Thêm một trang vào stack + nav sidebar."""
        idx = self.stack.addWidget(widget)
        self.sidebar.add_item(key, label, idx, icon=icon)

    def set_current(self, key: str) -> None:
        self.sidebar.set_active(key)

    # ---------- Internal ----------

    def _on_nav(self, stack_index: int) -> None:
        self.stack.setCurrentIndex(stack_index)
