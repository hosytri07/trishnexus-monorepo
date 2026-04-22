"""FooterBar — thanh đáy app, branding + quick nav.

Layout:
    [Branding text muted]       spacer        [Gần đây] [Cài đặt] [Giới thiệu]

Xem docs/design-spec.md §6.6.
"""

from __future__ import annotations

from PyQt6.QtCore import Qt, pyqtSignal
from PyQt6.QtWidgets import (
    QFrame,
    QHBoxLayout,
    QLabel,
    QPushButton,
    QWidget,
)


class FooterBar(QFrame):
    """Footer branding + quick nav."""

    navRequested = pyqtSignal(str)   # route_name

    def __init__(
        self,
        left_text: str = "TrishApp v1.0.0",
        *,
        quick_nav: list[tuple[str, str]] | None = None,  # [(label, route_name)]
        parent: QWidget | None = None,
    ) -> None:
        super().__init__(parent)
        self.setProperty("role", "footer-bar")
        self.setFixedHeight(36)

        layout = QHBoxLayout(self)
        layout.setContentsMargins(14, 4, 12, 4)
        layout.setSpacing(2)

        self.left_lbl = QLabel(left_text)
        self.left_lbl.setStyleSheet(
            "color: #9CA3AF; font-size: 9pt; background: transparent; border: none;"
        )  # text.muted, no border to avoid theme QSS leaking a dark frame outline
        layout.addWidget(self.left_lbl)

        layout.addStretch(1)

        # Quick nav buttons — dùng flat button + padding đều, căn giữa theo chiều đứng
        self._nav_buttons: dict[str, QPushButton] = {}
        for i, (label, route) in enumerate(quick_nav or []):
            btn = QPushButton(label)
            btn.setProperty("variant", "subtle")
            btn.setFlat(True)
            btn.setCursor(Qt.CursorShape.PointingHandCursor)
            btn.setStyleSheet(
                "QPushButton { color: #D1D5DB; font-size: 9pt; padding: 4px 10px; "
                "border: none; background: transparent; }"
                "QPushButton:hover { color: #FFFFFF; background: rgba(255,255,255,0.06); "
                "border-radius: 4px; }"
            )
            btn.clicked.connect(
                lambda _=False, r=route: self.navRequested.emit(r)
            )
            layout.addWidget(btn)
            self._nav_buttons[route] = btn

            # Separator '·' giữa các button (trừ cái cuối)
            if i < len(quick_nav or []) - 1:
                sep = QLabel("·")
                sep.setStyleSheet(
                    "color: #4B5563; font-size: 10pt; "
                    "background: transparent; border: none;"
                )
                layout.addWidget(sep)

    # ---------- Public API ----------

    def setLeftText(self, text: str) -> None:
        self.left_lbl.setText(text)

    def addNavButton(self, label: str, route: str) -> None:
        btn = QPushButton(label)
        btn.setProperty("variant", "subtle")
        btn.clicked.connect(lambda _=False, r=route: self.navRequested.emit(r))
        self.layout().addWidget(btn)
        self._nav_buttons[route] = btn
