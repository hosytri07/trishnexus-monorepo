"""Card — khung trắng có viền + bo góc dùng chung."""

from __future__ import annotations

from PyQt6.QtWidgets import QFrame, QVBoxLayout, QWidget


class Card(QFrame):
    def __init__(self, parent: QWidget | None = None, *, padding: int = 16) -> None:
        super().__init__(parent)
        self.setProperty("role", "card")
        self._layout = QVBoxLayout(self)
        self._layout.setContentsMargins(padding, padding, padding, padding)

    def add(self, widget: QWidget) -> None:
        self._layout.addWidget(widget)

    def layout_body(self) -> QVBoxLayout:
        return self._layout
