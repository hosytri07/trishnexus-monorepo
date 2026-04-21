"""Toast — notification tự ẩn sau N ms (PyQt6)."""

from __future__ import annotations

from PyQt6.QtCore import QPropertyAnimation, Qt, QTimer
from PyQt6.QtWidgets import QApplication, QGraphicsOpacityEffect, QLabel, QWidget


class Toast(QLabel):
    def __init__(
        self,
        text: str,
        *,
        variant: str = "info",
        duration_ms: int = 2500,
        parent: QWidget | None = None,
    ) -> None:
        super().__init__(text, parent, Qt.WindowType.ToolTip | Qt.WindowType.FramelessWindowHint)
        self.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground, False)

        colors = {
            "info":    ("#3B82F6", "#FFFFFF"),
            "success": ("#10B981", "#FFFFFF"),
            "warning": ("#F59E0B", "#111827"),
            "danger":  ("#EF4444", "#FFFFFF"),
        }
        bg, fg = colors.get(variant, colors["info"])
        self.setStyleSheet(
            f"background-color: {bg}; color: {fg};"
            f"padding: 12px 20px; border-radius: 10px; font-weight: 600;"
        )

        self._fx = QGraphicsOpacityEffect(self)
        self._fx.setOpacity(0.0)
        self.setGraphicsEffect(self._fx)
        self._anim = QPropertyAnimation(self._fx, b"opacity", self)

        self._duration = duration_ms

    def show_anchored(self, anchor: QWidget) -> None:
        self.adjustSize()
        top_level = anchor.window()
        geo = top_level.geometry()
        x = geo.center().x() - self.width() // 2
        y = geo.bottom() - self.height() - 32
        self.move(x, y)
        self.show()

        self._anim.stop()
        self._anim.setDuration(180)
        self._anim.setStartValue(0.0)
        self._anim.setEndValue(1.0)
        self._anim.start()

        QTimer.singleShot(self._duration, self._fade_out)

    def _fade_out(self) -> None:
        self._anim.stop()
        self._anim.setDuration(240)
        self._anim.setStartValue(1.0)
        self._anim.setEndValue(0.0)
        self._anim.finished.connect(self.close)
        self._anim.start()


def show_toast(parent: QWidget, text: str, variant: str = "info") -> None:
    t = Toast(text, variant=variant, parent=parent)
    t.show_anchored(parent)
