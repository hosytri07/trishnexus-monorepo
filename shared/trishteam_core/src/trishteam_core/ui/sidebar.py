"""HoverSidebar — sidebar compact (180px), click để chuyển trang."""

from __future__ import annotations

from PyQt6.QtCore import pyqtSignal
from PyQt6.QtWidgets import QButtonGroup, QFrame, QPushButton, QVBoxLayout


class HoverSidebar(QFrame):
    """Emit navClicked(stack_index) khi user click nav item.

    Width mặc định 180px (compact). App có thể override qua setFixedWidth().
    """

    navClicked = pyqtSignal(int)

    def __init__(self, parent=None, *, width: int = 180) -> None:
        super().__init__(parent)
        self.setProperty("role", "sidebar")
        self.setFixedWidth(width)

        self._layout = QVBoxLayout(self)
        self._layout.setContentsMargins(8, 12, 8, 8)
        self._layout.setSpacing(2)

        # App title — nhỏ gọn hơn, không dùng button flat (tránh padding mặc định)
        self._title = QPushButton("TrishApp")
        self._title.setStyleSheet(
            "QPushButton { font-weight: 700; font-size: 13px; padding: 6px 10px; "
            "color: #F9FAFB; background: transparent; text-align: left; border: none; }"
        )
        self._title.setFlat(True)
        self._title.setEnabled(False)   # không click vào title
        self._layout.addWidget(self._title)
        self._layout.addSpacing(8)

        # Group để chỉ 1 nav active
        self._group = QButtonGroup(self)
        self._group.setExclusive(True)

        self._items: dict[str, tuple[QPushButton, int]] = {}

        self._layout.addStretch(1)

    def set_title(self, text: str) -> None:
        self._title.setText(text)

    def add_item(self, key: str, label: str, stack_index: int, *, icon: str = "●") -> None:
        btn = QPushButton(f"  {icon}  {label}")
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
