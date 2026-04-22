"""EmptyState — placeholder khi danh sách trống."""

from __future__ import annotations

from PyQt6.QtCore import Qt
from PyQt6.QtWidgets import QLabel, QVBoxLayout, QWidget


class EmptyState(QWidget):
    def __init__(
        self,
        icon: str = "📭",
        title: str = "Chưa có dữ liệu",
        subtitle: str = "Thêm mục mới để bắt đầu.",
        parent: QWidget | None = None,
    ) -> None:
        super().__init__(parent)
        # Đảm bảo có không gian thoáng để center khi nằm trong scroll lớn
        self.setMinimumHeight(280)

        layout = QVBoxLayout(self)
        layout.setAlignment(Qt.AlignmentFlag.AlignCenter)
        layout.setContentsMargins(20, 40, 20, 40)
        layout.setSpacing(10)

        self._icon_lbl = QLabel(icon)
        self._icon_lbl.setAlignment(Qt.AlignmentFlag.AlignCenter)
        # Tone warm match palette TrishFont (text muted)
        self._icon_lbl.setStyleSheet(
            "font-size: 56px; color: #a09890; background: transparent;"
        )
        layout.addWidget(self._icon_lbl)

        self._title_lbl = QLabel(title)
        self._title_lbl.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self._title_lbl.setStyleSheet(
            "font-size: 16px; font-weight: 600; color: #f5f2ed; "
            "background: transparent;"
        )
        layout.addWidget(self._title_lbl)

        self._sub_lbl = QLabel(subtitle)
        self._sub_lbl.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self._sub_lbl.setWordWrap(True)
        self._sub_lbl.setStyleSheet(
            "color: #a09890; font-size: 12px; background: transparent;"
        )
        layout.addWidget(self._sub_lbl)

    # Setters để update từng phần sau khi tạo
    def setIcon(self, icon: str) -> None:
        self._icon_lbl.setText(icon)

    def setTitle(self, title: str) -> None:
        self._title_lbl.setText(title)

    def setSubtitle(self, subtitle: str) -> None:
        self._sub_lbl.setText(subtitle)
