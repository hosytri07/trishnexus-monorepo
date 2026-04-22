"""LogPanel — nhật ký cài đặt/thực thi, match pattern TrishFont v1.0.

Reference (TrishFont._log):
    colors = {"ok": GREEN, "err": RED, "skip": AMBER, "info": TEXT_MUTED}
    color  = colors.get(level, TEXT_MUTED)
    log_edit.append(f'<span style="color:{color}">{msg}</span>')

API:
    log_panel.log_success("✅ font.ttf  →  C:/Windows/Fonts")
    log_panel.log_error("❌ font.ttf  — Access denied")
    log_panel.log_warn("⚠ 3 file sai định dạng")
    log_panel.log_skip("⏭  font.ttf  — chưa chọn AutoCAD dir")
    log_panel.log_info("Bắt đầu quét…")

Note: message thường tự gắn emoji prefix (✅ ❌ ⚠ ⏭ i) như reference —
LogPanel KHÔNG tự gắn prefix hay timestamp. User tự control icon → cleaner.
Nếu muốn timestamp, set `show_timestamp=True` khi init.

Layout:
    ┌──────────────────────────────────────────────────────────┐
    │ 📋 Nhật ký                                    [🗑 Xóa]    │   header
    │ ┌──────────────────────────────────────────────────────┐ │
    │ │ ✅ file1.ttf  →  C:/Windows/Fonts                    │ │   QTextEdit
    │ │ ❌ file2.ttf  — Access denied                        │ │
    │ └──────────────────────────────────────────────────────┘ │
    │ ▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░  (progress bar 5px, accent)      │
    └──────────────────────────────────────────────────────────┘
"""

from __future__ import annotations

from datetime import datetime
from html import escape

from PyQt6.QtCore import pyqtSignal
from PyQt6.QtGui import QFont
from PyQt6.QtWidgets import (
    QFrame,
    QHBoxLayout,
    QLabel,
    QProgressBar,
    QPushButton,
    QTextEdit,
    QVBoxLayout,
    QWidget,
)


# Màu semantic — khớp tokens.DARK + tokens.COLOR.semantic
_COLOR_SUCCESS = "#10B981"
_COLOR_WARNING = "#F59E0B"
_COLOR_DANGER  = "#EF4444"
_COLOR_INFO    = "#a09890"   # muted (neutral info, không highlight)
_COLOR_ACCENT  = "#8FA5FF"   # link-like, cho hyperlinks trong log
_COLOR_MUTED   = "#7c7670"   # timestamp mờ hơn


class LogPanel(QFrame):
    """Log panel HTML-based — reference match TrishFont v1.0."""

    progressChanged = pyqtSignal(int, int)   # (done, total)
    cleared         = pyqtSignal()

    def __init__(
        self,
        title: str = "Nhật ký",
        *,
        icon: str = "📋",
        clear_label: str = "🗑 Xóa log",
        show_progress: bool = True,
        show_timestamp: bool = False,
        max_body_height: int = 110,
        min_body_height: int = 60,
        parent: QWidget | None = None,
    ) -> None:
        super().__init__(parent)
        self.setProperty("role", "log-panel")
        self._show_timestamp = show_timestamp

        # Frame-level constraint: header(~28) + body(max) + progress(5) + margins(12) + spacing
        # Cap toàn bộ panel để splitter không kéo dãn ra cao chiếm chỗ
        self.setMaximumHeight(max_body_height + 60)

        root = QVBoxLayout(self)
        root.setContentsMargins(12, 6, 12, 6)
        root.setSpacing(3)

        # --- Header ---
        header = QHBoxLayout()
        header.setSpacing(6)

        self.title_lbl = QLabel(f"{icon} {title}")
        self.title_lbl.setStyleSheet(
            "color: #a09890; font-size: 12px; background: transparent;"
        )
        header.addWidget(self.title_lbl)
        header.addStretch(1)

        self.btn_clear = QPushButton(clear_label)
        self.btn_clear.setProperty("variant", "subtle")
        self.btn_clear.setFixedHeight(22)
        self.btn_clear.setStyleSheet(
            "QPushButton { font-size: 10px; padding: 0 8px; background: transparent; "
            "color: #a09890; border: none; }"
            "QPushButton:hover { color: #f5f2ed; background: rgba(255,255,255,0.05); "
            "border-radius: 4px; }"
        )
        self.btn_clear.clicked.connect(self.clear)
        header.addWidget(self.btn_clear)

        root.addLayout(header)

        # --- Body (QTextEdit, HTML-rendered) ---
        self.body = QTextEdit()
        self.body.setReadOnly(True)
        self.body.setMinimumHeight(min_body_height)
        self.body.setMaximumHeight(max_body_height)
        # Font fallback — QSS override tự áp nếu có theme global
        mono_font = QFont()
        mono_font.setFamilies(["Consolas", "Cascadia Code", "JetBrains Mono"])
        mono_font.setPointSize(9)
        self.body.setFont(mono_font)
        root.addWidget(self.body)

        # --- Progress bar (optional) ---
        self.progress_bar: QProgressBar | None = None
        if show_progress:
            self.progress_bar = QProgressBar()
            self.progress_bar.setFixedHeight(5)
            self.progress_bar.setTextVisible(False)
            self.progress_bar.hide()
            root.addWidget(self.progress_bar)

    # ---------- Logging API (emoji + HTML color) ----------

    def log_info(self, msg: str) -> None:
        self._append(msg, _COLOR_INFO)

    def log_success(self, msg: str) -> None:
        self._append(msg, _COLOR_SUCCESS)

    def log_warn(self, msg: str) -> None:
        self._append(msg, _COLOR_WARNING)

    def log_error(self, msg: str) -> None:
        self._append(msg, _COLOR_DANGER)

    def log_skip(self, msg: str) -> None:
        """Skip items (emoji ⏭) — màu amber muted."""
        self._append(msg, _COLOR_WARNING)

    def log_plain(self, msg: str) -> None:
        self._append(msg, _COLOR_INFO)

    def log_separator(self, char: str = "═", width: int = 50) -> None:
        self._append(char * width, _COLOR_MUTED)

    def clear(self) -> None:
        self.body.clear()
        if self.progress_bar is not None:
            self.progress_bar.hide()
        self.cleared.emit()

    # ---------- Progress API ----------

    def set_progress(self, done: int, total: int) -> None:
        if self.progress_bar is None:
            return
        if total <= 0:
            self.progress_bar.hide()
            return
        if not self.progress_bar.isVisible():
            self.progress_bar.show()
        self.progress_bar.setMaximum(total)
        self.progress_bar.setValue(done)
        self.progressChanged.emit(done, total)

    def reset_progress(self) -> None:
        if self.progress_bar is not None:
            self.progress_bar.hide()
            self.progress_bar.setValue(0)

    # ---------- Internal ----------

    def _append(self, msg: str, color: str) -> None:
        safe_msg = escape(msg)
        if self._show_timestamp:
            ts = datetime.now().strftime("[%H:%M:%S]")
            html = (
                f'<span style="color:{_COLOR_MUTED}">{ts}</span> '
                f'<span style="color:{color}">{safe_msg}</span>'
            )
        else:
            html = f'<span style="color:{color}">{safe_msg}</span>'

        self.body.append(html)

        # Auto-scroll
        sb = self.body.verticalScrollBar()
        sb.setValue(sb.maximum())
