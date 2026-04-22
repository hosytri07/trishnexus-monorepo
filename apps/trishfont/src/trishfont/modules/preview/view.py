"""Preview view — split layout, chỉ render 1 font cùng lúc (tránh freeze).

Layout:
    ┌──────────────────────────────────────────────────────┐
    │ [Sample text]                      [Size: 24 pt]     │
    ├──────────────────┬───────────────────────────────────┤
    │ Font list        │  Font family (header)             │
    │  • Arial         │                                   │
    │  • Be Vietnam ●  │  Tiếng Việt: huyền, sắc, hỏi,     │
    │  • Cambria       │  ngã, nặng — 0123456789           │
    │  • Georgia       │                                   │
    │  • ...           │  AaBbCcDd 1234567890              │
    └──────────────────┴───────────────────────────────────┘

Thay vì tạo 500+ FontPreviewCard cùng lúc (freeze app), chỉ render 1 font
được chọn. Font list đọc từ DB (đã scan từ curated folder) thay vì system.
"""

from __future__ import annotations

from PyQt6.QtCore import Qt
from PyQt6.QtGui import QFont
from PyQt6.QtWidgets import (
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QListWidget,
    QListWidgetItem,
    QSlider,
    QSplitter,
    QVBoxLayout,
    QWidget,
)

from trishteam_core.store import Database
from trishteam_core.widgets import EmptyState

from ..library.repository import FontRepository


# Pangram tiếng Việt — chứa đầy đủ 6 dấu (huyền, sắc, hỏi, ngã, nặng, không dấu)
DEFAULT_SAMPLE = "Tiếng Việt: huyền, sắc, hỏi, ngã, nặng — 0123456789"

# Secondary sample — chữ in hoa + số (mỗi ô preview 2 dòng)
DEFAULT_SECONDARY = "AaBbCcDdEeFf 1234567890"


class PreviewView(QWidget):
    """Split view preview — 1 font render tại mỗi thời điểm."""

    def __init__(self, db: Database, parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self.repo = FontRepository(db)

        root = QVBoxLayout(self)
        root.setContentsMargins(20, 20, 20, 20)
        root.setSpacing(12)

        # --- Title ---
        title = QLabel("Xem trước font")
        title.setStyleSheet("font-size: 22px; font-weight: 700;")
        root.addWidget(title)

        # --- Toolbar (sample text + size slider) ---
        toolbar = QHBoxLayout()

        self.sample_input = QLineEdit(DEFAULT_SAMPLE)
        self.sample_input.setPlaceholderText("Nhập text để preview…")
        self.sample_input.textChanged.connect(self._refresh_preview)
        toolbar.addWidget(self.sample_input, stretch=3)

        size_lbl = QLabel("Cỡ:")
        toolbar.addWidget(size_lbl)

        self.size_slider = QSlider(Qt.Orientation.Horizontal)
        self.size_slider.setRange(10, 72)
        self.size_slider.setValue(24)
        self.size_slider.valueChanged.connect(self._refresh_preview)
        toolbar.addWidget(self.size_slider, stretch=1)

        self.size_value = QLabel("24 pt")
        self.size_value.setFixedWidth(50)
        toolbar.addWidget(self.size_value)

        root.addLayout(toolbar)

        # --- Split view ---
        splitter = QSplitter(Qt.Orientation.Horizontal)

        # Left: font list
        self.font_list = QListWidget()
        self.font_list.currentItemChanged.connect(self._on_font_selected)
        splitter.addWidget(self.font_list)

        # Right: preview panel
        preview_panel = QWidget()
        preview_layout = QVBoxLayout(preview_panel)
        preview_layout.setContentsMargins(16, 16, 16, 16)
        preview_layout.setSpacing(16)

        self.family_header = QLabel("")
        self.family_header.setStyleSheet(
            "font-size: 13px; color: #6b7280; font-weight: 500;"
        )
        preview_layout.addWidget(self.family_header)

        self.sample_primary = QLabel("")
        self.sample_primary.setWordWrap(True)
        self.sample_primary.setAlignment(
            Qt.AlignmentFlag.AlignTop | Qt.AlignmentFlag.AlignLeft
        )
        preview_layout.addWidget(self.sample_primary)

        self.sample_secondary = QLabel(DEFAULT_SECONDARY)
        self.sample_secondary.setWordWrap(True)
        self.sample_secondary.setStyleSheet("color: #374151;")
        self.sample_secondary.setAlignment(
            Qt.AlignmentFlag.AlignTop | Qt.AlignmentFlag.AlignLeft
        )
        preview_layout.addWidget(self.sample_secondary)

        preview_layout.addStretch(1)

        splitter.addWidget(preview_panel)

        # Tỉ lệ: list 1 : preview 3
        splitter.setStretchFactor(0, 1)
        splitter.setStretchFactor(1, 3)
        splitter.setSizes([240, 720])

        root.addWidget(splitter, stretch=1)

        # --- Empty state (khi chưa scan font nào) ---
        self.empty = EmptyState(
            icon="🔤",
            title="Chưa có font nào để preview",
            subtitle='Vào "Thư viện" để chọn folder & scan font trước.',
        )
        root.addWidget(self.empty)

        # Initial load
        self.reload()

    # ----- Public API -----

    def reload(self) -> None:
        """Load font list từ DB. Gọi lại sau khi scan xong."""
        fonts = self.repo.list_all()
        self.font_list.clear()

        if not fonts:
            self.font_list.hide()
            self.empty.show()
            self._set_preview_text("", "")
            self.family_header.setText("")
            return

        self.empty.hide()
        self.font_list.show()

        for f in fonts:
            item = QListWidgetItem(f.family)
            # Hiển thị tên font bằng chính font đó (visual cue)
            preview_font = QFont(f.family)
            preview_font.setPointSize(12)
            item.setFont(preview_font)
            self.font_list.addItem(item)

        # Auto-select first
        self.font_list.setCurrentRow(0)

    # ----- Internal -----

    def _current_family(self) -> str:
        item = self.font_list.currentItem()
        return item.text() if item else ""

    def _on_font_selected(self, *_args) -> None:
        family = self._current_family()
        self.family_header.setText(family)
        self._refresh_preview()

    def _refresh_preview(self) -> None:
        family = self._current_family()
        sample = self.sample_input.text() or DEFAULT_SAMPLE
        size = self.size_slider.value()
        self.size_value.setText(f"{size} pt")

        if not family:
            self._set_preview_text("", "")
            return

        # Primary sample — kích cỡ user chọn
        primary_font = QFont(family)
        primary_font.setPointSize(size)
        self.sample_primary.setFont(primary_font)
        self.sample_primary.setText(sample)

        # Secondary sample — cỡ nhỏ hơn 40%
        secondary_size = max(10, int(size * 0.6))
        secondary_font = QFont(family)
        secondary_font.setPointSize(secondary_size)
        self.sample_secondary.setFont(secondary_font)
        self.sample_secondary.setText(DEFAULT_SECONDARY)

    def _set_preview_text(self, primary: str, secondary: str) -> None:
        self.sample_primary.setText(primary)
        self.sample_secondary.setText(secondary)
