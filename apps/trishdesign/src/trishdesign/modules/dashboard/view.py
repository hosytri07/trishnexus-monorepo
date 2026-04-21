"""Dashboard — stats overview, recent projects, quick actions."""

from __future__ import annotations

from PyQt6.QtCore import Qt
from PyQt6.QtWidgets import QGridLayout, QLabel, QVBoxLayout, QWidget

from trishteam_core.widgets import Card


class DashboardView(QWidget):
    def __init__(self, parent: QWidget | None = None) -> None:
        super().__init__(parent)

        root = QVBoxLayout(self)
        root.setContentsMargins(32, 24, 32, 24)
        root.setSpacing(20)

        title = QLabel("Dashboard")
        title.setStyleSheet("font-size: 28px; font-weight: 700;")
        root.addWidget(title)

        # 4-card grid (placeholders — nối data ở Sprint 5)
        grid = QGridLayout()
        grid.setSpacing(16)
        stats = [
            ("Dự án", "0",  "Tất cả dự án đã tạo"),
            ("Dự toán", "0", "Bảng dự toán đang làm"),
            ("Bảng tính KC", "0", "Template đã tải"),
            ("Hồ sơ export", "0", "File Word/Excel sinh ra"),
        ]
        for i, (label, value, hint) in enumerate(stats):
            card = Card()
            v = card.layout_body()
            lbl_value = QLabel(value)
            lbl_value.setStyleSheet("font-size: 36px; font-weight: 700; color: #667EEA;")
            lbl_label = QLabel(label)
            lbl_label.setStyleSheet("font-size: 14px; font-weight: 600; color: #4B5563;")
            lbl_hint = QLabel(hint)
            lbl_hint.setStyleSheet("color: #9CA3AF;")
            v.addWidget(lbl_value)
            v.addWidget(lbl_label)
            v.addWidget(lbl_hint)
            grid.addWidget(card, 0, i)

        root.addLayout(grid)
        root.addStretch(1)
