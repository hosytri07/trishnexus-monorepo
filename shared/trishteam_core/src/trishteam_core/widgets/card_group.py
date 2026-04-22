"""CardGroup — nhóm item có checkbox, match pattern FontGroupCard của
TrishFont v1.0 reference app.

Layout (expanded):
    ┌───────────────────────────────────────────────────────────┐
    │▌ 🔤  Sans Serif                             [N file]       │   ← header: icon + name (colored bold) + count badge muted
    │▌ ☑ Chọn tất cả N file trong nhóm                          │   ← "select all" checkbox, color = group accent
    │▌ ───────────────────────────────────────────────────────── │   ← HLine divider rgba(0.06)
    │▌   ☐ font_item_1.ttf                                      │
    │▌   ☑ font_item_2.ttf                                      │
    └───────────────────────────────────────────────────────────┘
    ↑ border-left 3px màu group (accent / green / amber / cyan / blue)

Style rules copy từ reference:
- BG: surf.card (#1a1814), border 1.5px rgba(255,255,255,0.08)
- border-left 3px solid {group_color} — điểm nhấn visual chính
- border-radius 12px
- Header name: bold 13pt, color = group_color
- "N file" badge: nền rgba(255,255,255,0.06), pill radius 9999px
- Checkbox "Chọn tất cả": indicator colored theo group, text 12px bold
- File checkboxes: 12px, indicator 14x14, fill = accent khi checked

Dùng property `stripe=` để áp mã màu qua QSS global (xem theme.py).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

from PyQt6.QtCore import Qt, pyqtSignal
from PyQt6.QtGui import QFont
from PyQt6.QtWidgets import (
    QCheckBox,
    QFrame,
    QHBoxLayout,
    QLabel,
    QToolButton,
    QVBoxLayout,
    QWidget,
)


# Map stripe name → hex màu để style header/checkbox group theo đúng tone
_STRIPE_COLORS = {
    "primary": "#667EEA",
    "green":   "#10B981",
    "amber":   "#F59E0B",
    "cyan":    "#06B6D4",
    "blue":    "#3B82F6",
    "danger":  "#EF4444",
}


@dataclass
class CardItem:
    """Một item trong CardGroup — thường là 1 file hoặc 1 entity."""
    id: str
    label: str
    checked: bool = False
    meta: str = ""              # Tooltip / hiển thị phụ bên phải (ví dụ "VN", "28KB")


class CardGroup(QFrame):
    """Card group collapsible — match FontGroupCard reference.

    Params:
        name: Tên group (hiển thị header bold).
        items: List[CardItem].
        icon: Emoji icon (🔤, 📖, ⌨, 🎨...).
        stripe: "primary" | "green" | "amber" | "cyan" | "blue" | "danger".
        collapsed: True → mặc định ẩn body (chỉ hiển thị header).
    """

    itemToggled     = pyqtSignal(str, bool)    # (item_id, checked)
    groupToggled    = pyqtSignal(bool)         # check/uncheck all trong group
    expandedChanged = pyqtSignal(bool)

    def __init__(
        self,
        name: str,
        items: list[CardItem] | None = None,
        *,
        icon: str = "📁",
        stripe: str = "primary",
        collapsed: bool = False,
        parent: QWidget | None = None,
    ) -> None:
        super().__init__(parent)
        self.setProperty("role", "card")
        self.setProperty("stripe", stripe)

        self._name = name
        self._items: list[CardItem] = list(items) if items else []
        self._item_checkboxes: dict[str, QCheckBox] = {}
        self._expanded = not collapsed
        self._stripe_color = _STRIPE_COLORS.get(stripe, _STRIPE_COLORS["primary"])

        root = QVBoxLayout(self)
        root.setContentsMargins(14, 12, 14, 12)
        root.setSpacing(6)

        # --- Header row ---
        header = QHBoxLayout()
        header.setSpacing(8)

        # Toggle arrow ▼/▶ — flat toolbutton, không nền
        self.toggle_btn = QToolButton()
        self.toggle_btn.setText("▼" if self._expanded else "▶")
        self.toggle_btn.setStyleSheet(
            "QToolButton { border: none; background: transparent; "
            f"color: {self._stripe_color}; font-size: 11px; padding: 0 2px; }}"
            "QToolButton:hover { color: #f5f2ed; }"
        )
        self.toggle_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        self.toggle_btn.clicked.connect(self._toggle_expanded)
        header.addWidget(self.toggle_btn)

        # Name bold màu stripe
        name_text = f"{icon}  {name}" if icon else name
        self.name_lbl = QLabel(name_text)
        name_font = QFont("Be Vietnam Pro", 12)
        name_font.setWeight(QFont.Weight.Bold)
        self.name_lbl.setFont(name_font)
        self.name_lbl.setStyleSheet(
            f"color: {self._stripe_color}; background: transparent;"
        )
        self.name_lbl.setCursor(Qt.CursorShape.PointingHandCursor)
        self.name_lbl.mousePressEvent = lambda _e: self._toggle_expanded()  # type: ignore[method-assign]
        header.addWidget(self.name_lbl)

        header.addStretch(1)

        # Badge "N file"
        self.badge = QLabel(f"{len(self._items)} file")
        self.badge.setProperty("role", "badge")
        self.badge.setStyleSheet(
            "QLabel { background: rgba(255,255,255,0.06); color: #a09890; "
            "padding: 2px 8px; border-radius: 9999px; font-size: 11px; }"
        )
        header.addWidget(self.badge)

        root.addLayout(header)

        # --- Select all ---
        self.select_all_cb = QCheckBox(
            f"Chọn tất cả {len(self._items)} file trong nhóm"
        )
        self.select_all_cb.setStyleSheet(self._stripe_checkbox_style(self._stripe_color))
        self.select_all_cb.stateChanged.connect(self._on_select_all)
        root.addWidget(self.select_all_cb)

        # --- Divider ---
        div = QFrame()
        div.setFrameShape(QFrame.Shape.HLine)
        div.setStyleSheet("background: rgba(255,255,255,0.06); max-height: 1px; border: none;")
        root.addWidget(div)

        # --- Body (items list) ---
        self.body = QWidget()
        body_layout = QVBoxLayout(self.body)
        body_layout.setContentsMargins(0, 2, 0, 0)
        body_layout.setSpacing(2)

        for item in self._items:
            cb = QCheckBox("  " + self._format_item_text(item))
            cb.setChecked(item.checked)
            cb.setProperty("itemid", item.id)
            if item.meta:
                cb.setToolTip(item.meta)
            cb.stateChanged.connect(
                lambda state, item_id=item.id: self._on_item_toggled(item_id, state == 2)
            )
            body_layout.addWidget(cb)
            self._item_checkboxes[item.id] = cb

        root.addWidget(self.body)
        self.body.setVisible(self._expanded)

    # ---------- Public API ----------

    def get_checked_ids(self) -> list[str]:
        """Trả về list id của các item đang được tick."""
        return [
            item.id for item in self._items
            if self._item_checkboxes[item.id].isChecked()
        ]

    def set_item_checked(self, item_id: str, checked: bool) -> None:
        cb = self._item_checkboxes.get(item_id)
        if cb is not None:
            cb.blockSignals(True)
            cb.setChecked(checked)
            cb.blockSignals(False)
            self._sync_select_all_state()

    def select_all(self, checked: bool) -> None:
        for cb in self._item_checkboxes.values():
            cb.blockSignals(True)
            cb.setChecked(checked)
            cb.blockSignals(False)
        for item in self._items:
            item.checked = checked
        self._sync_select_all_state()

    def set_expanded(self, expanded: bool) -> None:
        if expanded == self._expanded:
            return
        self._toggle_expanded()

    def apply_item_filter(self, predicate: Callable[[CardItem], bool]) -> int:
        """Ẩn/hiện từng item theo predicate. Trả về số item visible."""
        visible_count = 0
        for item in self._items:
            cb = self._item_checkboxes[item.id]
            visible = predicate(item)
            cb.setVisible(visible)
            if visible:
                visible_count += 1
        self.badge.setText(f"{visible_count} file")
        self.setVisible(visible_count > 0)
        return visible_count

    # ---------- Internal ----------

    def _format_item_text(self, item: CardItem) -> str:
        if item.meta and len(item.meta) <= 6:
            return f"{item.label}    {item.meta}"
        return item.label

    def _toggle_expanded(self) -> None:
        self._expanded = not self._expanded
        self.toggle_btn.setText("▼" if self._expanded else "▶")
        self.body.setVisible(self._expanded)
        self.expandedChanged.emit(self._expanded)

    def _on_item_toggled(self, item_id: str, checked: bool) -> None:
        for item in self._items:
            if item.id == item_id:
                item.checked = checked
                break
        self.itemToggled.emit(item_id, checked)
        self._sync_select_all_state()

    def _on_select_all(self, state: int) -> None:
        if state == 1:
            return
        checked = state == 2
        for item in self._items:
            cb = self._item_checkboxes[item.id]
            cb.blockSignals(True)
            cb.setChecked(checked)
            cb.blockSignals(False)
            item.checked = checked
            self.itemToggled.emit(item.id, checked)
        self.groupToggled.emit(checked)

    def _sync_select_all_state(self) -> None:
        total = len(self._item_checkboxes)
        if total == 0:
            return
        checked = sum(1 for cb in self._item_checkboxes.values() if cb.isChecked())

        self.select_all_cb.blockSignals(True)
        if checked == 0:
            self.select_all_cb.setTristate(False)
            self.select_all_cb.setChecked(False)
        elif checked == total:
            self.select_all_cb.setTristate(False)
            self.select_all_cb.setChecked(True)
        else:
            self.select_all_cb.setTristate(True)
            self.select_all_cb.setCheckState(Qt.CheckState.PartiallyChecked)
        self.select_all_cb.blockSignals(False)

    def _stripe_checkbox_style(self, color: str) -> str:
        """QSS riêng cho checkbox 'Chọn tất cả' — indicator + text = màu stripe."""
        return (
            f"QCheckBox {{ color: {color}; font-size: 12px; font-weight: 600; "
            f"background: transparent; padding: 2px 0; }}"
            f"QCheckBox::indicator {{ width: 14px; height: 14px; border-radius: 3px; "
            f"border: 1.5px solid {color}; background: transparent; }}"
            f"QCheckBox::indicator:checked {{ background: {color}; border-color: {color}; }}"
            f"QCheckBox::indicator:indeterminate {{ background: {color}; border-color: {color}; }}"
        )
