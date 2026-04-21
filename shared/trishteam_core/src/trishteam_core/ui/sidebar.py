"""HoverSidebar — sidebar 220px, click để chuyển trang, tự đánh dấu active."""

from __future__ import annotations

from PyQt6.QtCore import pyqtSignal
from PyQt6.QtWidgets import QButtonGroup, QFrame, QPushButton, QVBoxLayout


class HoverSidebar(QFrame):
    """Emit navClicked(stack_index) khi user click nav item."""

    navClicked = pyqtSignal(int)

    def __init__(self, parent=None) -> None:
        super().__init__(parent)
        self.setProperty("role", "sidebar")
        self.setFixedWidth(220)

        self._layout = QVBoxLayout(self)
        self._layout.setContentsMargins(16, 24, 16, 16)
        self._layout.setSpacing(4)

        # App title (app tự đặt bằng set_title)
        self._title = QPushButton("TrishApp")
        self._title.setStyleSheet(
            "QPushButton { font-weight: 700; font-size: 18px; padding: 8px 12px; }"
        )
        self._title.setFlat(True)
        self._layout.addWidget(self._title)
        self._layout.addSpacing(24)

        # Group để chỉ 1 nav active
        self._group = QButtonGroup(self)
        self._group.setExclusive(True)

        self._items: dict[str, tuple[QPushButton, int]] = {}

        self._layout.addStretch(1)

    def set_title(self, text: str) -> None:
        self._title.setText(text)

    def add_item(self, key: str, label: str, stack_index: int, *, icon: str = "●") -> None:
        btn = QPushButton(f"  {icon}   {label}")
        btn.setCheckable(True)
        btn.clicked.connect(lambda: self.navClicked.emit(stack_index))

        # Insert trước stretch (phần tử cuối)
        insert_at = self._layout.count() - 1
        self._layout.insertWidget(insert_at, btn)

        self._group.addButton(btn)
        self._items[key] = (btn, stack_index)

        # Auto-activate item đầu tiên
        if len(self._items) == 1:
            btn.setChecked(True)

    def set_active(self, key: str) -> None:
        if key in self._items:
            btn, _ = self._items[key]
            btn.setChecked(True)
            self.navClicked.emit(self._items[key][1])
