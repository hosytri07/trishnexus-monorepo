"""Library — quản lý dự án local + sync cloud (sẽ nối sau khi có SyncEngine)."""

from __future__ import annotations

from PyQt6.QtWidgets import QVBoxLayout, QWidget

from trishteam_core.widgets import EmptyState


class LibraryView(QWidget):
    def __init__(self, parent: QWidget | None = None) -> None:
        super().__init__(parent)
        layout = QVBoxLayout(self)
        layout.addWidget(EmptyState(
            icon="📚",
            title="Chưa có dự án",
            subtitle="Tạo dự án mới để bắt đầu lập hồ sơ thiết kế.",
        ))
