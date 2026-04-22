"""Install view — placeholder cho v0.2.

Kế hoạch v0.2:
    - Drag & drop file .ttf/.otf
    - Copy vào %LOCALAPPDATA%/Microsoft/Windows/Fonts/
    - Thêm registry entry ở HKCU\\Software\\Microsoft\\Windows NT\\CurrentVersion\\Fonts
    - Broadcast WM_FONTCHANGE để app đang mở nhận font mới
"""

from __future__ import annotations

from PyQt6.QtWidgets import QVBoxLayout, QWidget

from trishteam_core.widgets import EmptyState


class InstallView(QWidget):
    def __init__(self, parent: QWidget | None = None) -> None:
        super().__init__(parent)
        layout = QVBoxLayout(self)
        layout.setContentsMargins(20, 20, 20, 20)

        empty = EmptyState(
            icon="📥",
            title="Cài đặt font — v0.2",
            subtitle="Drag & drop file .ttf/.otf sẽ có ở phiên bản kế tiếp.",
        )
        layout.addWidget(empty)
