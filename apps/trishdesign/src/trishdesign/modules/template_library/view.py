"""Template Library view — danh mục + grid card templates Excel."""

from __future__ import annotations

from PyQt6.QtCore import Qt
from PyQt6.QtWidgets import (
    QComboBox,
    QFormLayout,
    QGridLayout,
    QHBoxLayout,
    QLabel,
    QPushButton,
    QScrollArea,
    QVBoxLayout,
    QWidget,
)

from trishteam_core.widgets import Card, EmptyState

from .models import DEFAULT_CATEGORIES


class TemplateCard(Card):
    """Card hiển thị 1 template, có nút tải về + mở."""

    def __init__(self, template_name: str, category: str, filename: str, is_downloaded: bool) -> None:
        super().__init__()
        body = self.layout_body()

        title = QLabel(template_name)
        title.setStyleSheet("font-size: 16px; font-weight: 600;")
        body.addWidget(title)

        meta = QLabel(f"{category} · {filename}")
        meta.setStyleSheet("color: #6B7280; font-size: 12px;")
        body.addWidget(meta)

        actions = QHBoxLayout()
        self.btn_download = QPushButton("Tải về" if not is_downloaded else "Tải lại")
        self.btn_open = QPushButton("Mở")
        self.btn_open.setProperty("variant", "ghost")
        self.btn_open.setEnabled(is_downloaded)
        actions.addWidget(self.btn_download)
        actions.addWidget(self.btn_open)
        body.addLayout(actions)


class TemplateLibraryView(QWidget):
    """Layout:
        ┌────────────┬──────────────────────────────────┐
        │ Categories │  Grid card templates             │
        │ (filter)   │  (scroll)                        │
        └────────────┴──────────────────────────────────┘
    """

    def __init__(self, parent: QWidget | None = None) -> None:
        super().__init__(parent)

        root = QHBoxLayout(self)
        root.setContentsMargins(24, 20, 24, 20)
        root.setSpacing(16)

        # Left: category filter
        left = QWidget()
        left.setFixedWidth(220)
        left_layout = QVBoxLayout(left)
        left_layout.setContentsMargins(0, 0, 0, 0)

        title = QLabel("Bảng tính kết cấu")
        title.setStyleSheet("font-size: 22px; font-weight: 700;")
        left_layout.addWidget(title)

        hint = QLabel("Template do admin upload. Tải về mở bằng Excel.")
        hint.setStyleSheet("color: #6B7280; font-size: 12px;")
        hint.setWordWrap(True)
        left_layout.addWidget(hint)
        left_layout.addSpacing(16)

        form = QFormLayout()
        self.cb_category = QComboBox()
        for key, label in DEFAULT_CATEGORIES:
            self.cb_category.addItem(label, key)
        form.addRow("Danh mục:", self.cb_category)
        left_layout.addLayout(form)

        self.btn_refresh = QPushButton("↻ Đồng bộ danh sách")
        self.btn_refresh.setProperty("variant", "ghost")
        left_layout.addWidget(self.btn_refresh)
        left_layout.addStretch(1)

        root.addWidget(left)

        # Right: grid
        right_scroll = QScrollArea()
        right_scroll.setWidgetResizable(True)
        right_scroll.setFrameShape(QScrollArea.Shape.NoFrame)

        self._grid_host = QWidget()
        self._grid = QGridLayout(self._grid_host)
        self._grid.setSpacing(16)
        self._grid.setContentsMargins(0, 0, 0, 0)

        right_scroll.setWidget(self._grid_host)
        root.addWidget(right_scroll, stretch=1)

        # Initial state: empty
        self._render_empty()

        # Wire refresh action (logic thật nối ở Sprint 7 khi có AuthManager)
        self.btn_refresh.clicked.connect(self._render_empty)

    def _render_empty(self) -> None:
        # Xoá grid cũ
        while self._grid.count():
            item = self._grid.takeAt(0)
            if item and item.widget():
                item.widget().deleteLater()

        empty = EmptyState(
            icon="📐",
            title="Chưa có template",
            subtitle="Bấm \"Đồng bộ danh sách\" để tải danh mục từ server.",
        )
        self._grid.addWidget(empty, 0, 0, 1, 3)

    def render_templates(self, items: list) -> None:
        """Gọi từ ngoài sau khi repo.list_local() trả về data."""
        while self._grid.count():
            item = self._grid.takeAt(0)
            if item and item.widget():
                item.widget().deleteLater()

        if not items:
            self._render_empty()
            return

        cols = 3
        for i, tpl in enumerate(items):
            card = TemplateCard(
                template_name=tpl.name,
                category=tpl.category,
                filename=tpl.filename,
                is_downloaded=bool(tpl.local_path),
            )
            self._grid.addWidget(card, i // cols, i % cols)
