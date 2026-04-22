"""ActionBar — row bulk select + CTA chính, match pattern TrishFont v1.0.

Reference layout (TrishFont toolbar):
    [☑ Chọn tất cả] [☐ Bỏ chọn]  [N file được chọn]  ─────  [⚡ Cài đặt font đã chọn]
       secondary       secondary     muted/accent label             primary gradient

Background: rgba(15,14,12,0.95) — sậm hơn inline-toolbar trên nó, tạo separator
visual mà không cần border-bottom mạnh.

Counter đổi style khi có item: muted → bold accent color (#667EEA).

Xem docs/design-spec.md §6.3.
"""

from __future__ import annotations

from PyQt6.QtCore import pyqtSignal
from PyQt6.QtWidgets import (
    QFrame,
    QHBoxLayout,
    QLabel,
    QPushButton,
    QWidget,
)


_ACCENT = "#667EEA"
_TEXT_MUTED = "#a09890"


class ActionBar(QFrame):
    """Thanh action bulk-select + CTA primary."""

    selectAllRequested   = pyqtSignal()
    deselectAllRequested = pyqtSignal()
    ctaClicked           = pyqtSignal()

    def __init__(
        self,
        select_all_label: str = "☑ Chọn tất cả",
        deselect_all_label: str = "☐ Bỏ chọn",
        counter_template: str = "{n} file được chọn",
        cta_label: str = "⚡  Cài đặt font đã chọn",
        *,
        parent: QWidget | None = None,
    ) -> None:
        super().__init__(parent)
        self.setProperty("role", "action-bar")

        self._counter_template = counter_template
        self._current_count = 0

        layout = QHBoxLayout(self)
        # Match reference padding: 18 horizontal, 7 vertical
        layout.setContentsMargins(18, 7, 18, 7)
        layout.setSpacing(8)

        # --- Bulk select buttons (2 secondary buttons, match reference) ---
        self.btn_select_all = QPushButton(select_all_label)
        self.btn_select_all.setFixedHeight(30)
        self.btn_select_all.clicked.connect(self.selectAllRequested.emit)
        layout.addWidget(self.btn_select_all)

        self.btn_deselect = QPushButton(deselect_all_label)
        self.btn_deselect.setFixedHeight(30)
        self.btn_deselect.clicked.connect(self.deselectAllRequested.emit)
        layout.addWidget(self.btn_deselect)

        # --- Counter (style swap khi có count) ---
        self.counter_lbl = QLabel(counter_template.format(n=0))
        self.counter_lbl.setStyleSheet(self._counter_style_muted())
        layout.addWidget(self.counter_lbl)

        layout.addStretch(1)

        # --- CTA primary gradient ---
        self.btn_cta = QPushButton(cta_label)
        self.btn_cta.setProperty("variant", "primary")
        self.btn_cta.setFixedHeight(34)
        self.btn_cta.clicked.connect(self.ctaClicked.emit)
        self.btn_cta.setEnabled(False)
        layout.addWidget(self.btn_cta)

    # ---------- Public slots ----------

    def setCounter(self, n: int) -> None:
        """Cập nhật counter. Swap style muted ↔ accent, disabled CTA khi n=0."""
        self._current_count = n
        self.counter_lbl.setText(self._counter_template.format(n=n))
        if n > 0:
            self.counter_lbl.setStyleSheet(self._counter_style_active())
        else:
            self.counter_lbl.setStyleSheet(self._counter_style_muted())
        self.btn_cta.setEnabled(n > 0)

    def setCtaLabel(self, label: str) -> None:
        self.btn_cta.setText(label)

    def setCtaEnabled(self, enabled: bool) -> None:
        self.btn_cta.setEnabled(enabled)

    def setSelectAllLabel(self, label: str) -> None:
        self.btn_select_all.setText(label)

    def setDeselectLabel(self, label: str) -> None:
        self.btn_deselect.setText(label)

    # ---------- Style helpers ----------

    def _counter_style_muted(self) -> str:
        return (
            f"QLabel {{ color: {_TEXT_MUTED}; font-size: 12px; "
            f"background: transparent; padding: 0 6px; }}"
        )

    def _counter_style_active(self) -> str:
        return (
            f"QLabel {{ color: {_ACCENT}; font-size: 12px; font-weight: 600; "
            f"background: transparent; padding: 0 6px; }}"
        )
