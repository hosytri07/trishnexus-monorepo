"""InlineToolbar — row 'icon + label + input/dropdown + actions'.

Dùng cho path picker, search bar, filter — bất kỳ nơi nào cần 1 dòng
compact kết hợp input với action button.

Ví dụ TrishFont:
    [📁] [Font:] [.........path stretch.........] [Quét lại] [Chọn...]

Ví dụ Library (2 field cùng row):
    [📍] [Đang xem:] [.....path.....] │ [🔍] [Tìm kiếm:] [.....input.....] [Loại▾]

Xem docs/design-spec.md §6.2.
"""

from __future__ import annotations

from dataclasses import dataclass

from PyQt6.QtWidgets import (
    QFrame,
    QHBoxLayout,
    QLabel,
    QPushButton,
    QWidget,
)


@dataclass
class ToolbarField:
    """Một field trong InlineToolbar — icon + label + widget input."""
    icon: str           # emoji "📁"
    label: str          # "Font:"
    widget: QWidget     # QLineEdit | QComboBox | bất kỳ input nào
    stretch: int = 1    # stretch factor cho widget


class InlineToolbar(QFrame):
    """Toolbar 1 dòng, compact, linh hoạt nhiều field + nhiều action."""

    def __init__(
        self,
        fields: list[ToolbarField] | None = None,
        actions: list[QPushButton] | None = None,
        *,
        divider_before_last_field: bool = False,
        parent: QWidget | None = None,
    ) -> None:
        super().__init__(parent)
        self.setProperty("role", "inline-toolbar")

        self._layout = QHBoxLayout(self)
        # Match reference TrishFont config bar: padding 18 horizontal, 10 vertical
        self._layout.setContentsMargins(18, 10, 18, 10)
        self._layout.setSpacing(10)

        fields = fields or []
        actions = actions or []

        # --- Fields ---
        for i, field in enumerate(fields):
            # Divider trước field cuối (kiểu Library cũ: "Đang xem | Tìm kiếm")
            if divider_before_last_field and i == len(fields) - 1 and i > 0:
                divider = QLabel("│")
                divider.setStyleSheet("color: #4B5563;")  # border.strong
                self._layout.addWidget(divider)

            self._add_field(field)

        self._layout.addStretch(1)

        # --- Actions (button bên phải) ---
        for btn in actions:
            self._layout.addWidget(btn)

    # ---------- Helpers ----------

    def _add_field(self, field: ToolbarField) -> None:
        """Thêm 1 field vào layout: icon + label + input."""
        if field.icon:
            icon_lbl = QLabel(field.icon)
            icon_lbl.setStyleSheet(
                "color: #a09890; font-size: 12px; background: transparent;"
            )
            self._layout.addWidget(icon_lbl)

        if field.label:
            label = QLabel(field.label)
            label.setStyleSheet(
                "color: #a09890; font-size: 12px; background: transparent;"
            )
            self._layout.addWidget(label)

        self._layout.addWidget(field.widget, stretch=field.stretch)

    def add_field(self, field: ToolbarField) -> None:
        """API public để thêm field sau khi đã tạo toolbar."""
        # Insert trước stretch — tìm stretch item để chèn trước nó
        # Đơn giản hơn: chèn ngay trước action button cuối cùng
        insert_idx = self._find_stretch_index()
        if field.icon:
            self._layout.insertWidget(insert_idx, QLabel(field.icon))
            insert_idx += 1
        if field.label:
            lbl = QLabel(field.label)
            lbl.setStyleSheet(
                "color: #a09890; font-size: 12px; background: transparent;"
            )
            self._layout.insertWidget(insert_idx, lbl)
            insert_idx += 1
        self._layout.insertWidget(insert_idx, field.widget, stretch=field.stretch)

    def add_action(self, btn: QPushButton) -> None:
        """Thêm action button vào cuối toolbar."""
        self._layout.addWidget(btn)

    def _find_stretch_index(self) -> int:
        """Tìm index của stretch item trong layout."""
        for i in range(self._layout.count()):
            item = self._layout.itemAt(i)
            if item is not None and item.spacerItem() is not None:
                return i
        return self._layout.count()
