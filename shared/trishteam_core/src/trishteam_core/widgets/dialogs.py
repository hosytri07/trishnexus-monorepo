"""Dialogs dùng chung: AboutDialog + UpdateDialog.

- AboutDialog: thông tin tác giả + hệ sinh thái TrishNexus.
- UpdateDialog: kiểm tra cập nhật app + dữ liệu font mới.

Được AppHeader gọi khi user bấm 🔄 Cập nhật hoặc ℹ Giới thiệu.
"""

from __future__ import annotations

from PyQt6.QtCore import Qt, pyqtSignal
from PyQt6.QtGui import QFont
from PyQt6.QtWidgets import (
    QDialog,
    QHBoxLayout,
    QLabel,
    QPushButton,
    QTabWidget,
    QTextBrowser,
    QVBoxLayout,
    QWidget,
)


# ==================== AboutDialog ====================

# Hệ sinh thái TrishTEAM — 10 app public + 1 umbrella (TrishTEAM)
# TrishAdmin ẩn khỏi About dialog public; chỉ admin/dev biết.
# Logo chính thức: design/logos/<AppName>/icon-*.png
ECOSYSTEM: list[tuple[str, str, str]] = [
    ("✨",  "TrishFont",     "Quản lý, xem trước và cài đặt font chuyên nghiệp"),
    ("🚀", "TrishLauncher", "Launcher tổng thể — hub của hệ sinh thái"),
    ("🎨", "TrishDesign",   "Khảo sát & Thiết kế — engineer toolkit"),
    ("📚", "TrishLibrary",  "Thư viện PDF/docx/link — local + cloud sync"),
    ("📝", "TrishNote",     "Ghi chú dự án / deadline / cá nhân / học tập"),
    ("✍",  "TrishType",     "Trình soạn thảo mọi định dạng + PDF tools"),
    ("🩺", "TrishCheck",    "Kiểm tra cấu hình máy so với yêu cầu phần mềm"),
    ("🔎", "TrishSearch",   "Tìm kiếm thông tin / file / note — local + cloud"),
    ("🧹", "TrishClean",    "Dọn file rác — .bak, .tmp, cache"),
    ("🖼",  "TrishImage",    "Quản lý thư viện ảnh — local + cloud backup"),
]


class AboutDialog(QDialog):
    """Dialog thông tin tác giả + hệ sinh thái."""

    def __init__(
        self,
        app_name: str = "TrishApp",
        version: str = "v1.0.0",
        logo_emoji: str = "✨",
        *,
        parent: QWidget | None = None,
    ) -> None:
        super().__init__(parent)
        self.setWindowTitle(f"Giới thiệu — {app_name}")
        self.setMinimumSize(520, 560)

        root = QVBoxLayout(self)
        root.setContentsMargins(24, 24, 24, 20)
        root.setSpacing(16)

        # --- Header (logo + name + version) ---
        header = QHBoxLayout()
        header.setSpacing(12)

        logo = QLabel(logo_emoji)
        logo_font = QFont()
        logo_font.setPointSize(28)
        logo.setFont(logo_font)
        header.addWidget(logo)

        name_col = QVBoxLayout()
        name_col.setSpacing(2)
        name_lbl = QLabel(app_name)
        nf = QFont()
        nf.setPointSize(16)
        nf.setWeight(QFont.Weight.Bold)
        name_lbl.setFont(nf)
        name_col.addWidget(name_lbl)
        ver_lbl = QLabel(version)
        ver_lbl.setStyleSheet("color: #9CA3AF;")
        name_col.addWidget(ver_lbl)
        header.addLayout(name_col)
        header.addStretch(1)

        root.addLayout(header)

        # --- Author info ---
        author_block = QTextBrowser()
        author_block.setOpenExternalLinks(True)
        author_block.setHtml(_build_author_html())
        author_block.setMaximumHeight(140)
        author_block.setStyleSheet(
            "QTextBrowser { background: #1F2937; border: 1px solid #374151; "
            "border-radius: 10px; padding: 12px; }"
        )
        root.addWidget(author_block)

        # --- Ecosystem section ---
        eco_title = QLabel("Hệ sinh thái TrishNexus")
        eco_font = QFont()
        eco_font.setPointSize(11)
        eco_font.setWeight(QFont.Weight.DemiBold)
        eco_title.setFont(eco_font)
        root.addWidget(eco_title)

        eco_browser = QTextBrowser()
        eco_browser.setHtml(_build_ecosystem_html())
        eco_browser.setStyleSheet(
            "QTextBrowser { background: #1F2937; border: 1px solid #374151; "
            "border-radius: 10px; padding: 12px; }"
        )
        root.addWidget(eco_browser, stretch=1)

        # --- Footer ---
        footer = QHBoxLayout()
        copyright_lbl = QLabel("© 2026 TrishTeam. Made with ♥ in Việt Nam.")
        copyright_lbl.setStyleSheet("color: #9CA3AF; font-size: 9pt;")
        footer.addWidget(copyright_lbl)
        footer.addStretch(1)
        btn_close = QPushButton("Đóng")
        btn_close.clicked.connect(self.accept)
        footer.addWidget(btn_close)
        root.addLayout(footer)


def _build_author_html() -> str:
    return """
    <div style="color:#F9FAFB; line-height:1.6;">
        <p style="margin:0;"><b>Tác giả:</b> Trí (hosytri07)</p>
        <p style="margin:0;"><b>Email:</b>
            <a href="mailto:hosytri07@gmail.com" style="color:#8FA5FF;">hosytri07@gmail.com</a>
        </p>
        <p style="margin:0;"><b>Website:</b>
            <a href="https://trishteam.io.vn" style="color:#8FA5FF;">trishteam.io.vn</a>
        </p>
        <p style="margin:6px 0 0 0; color:#D1D5DB;">
            Dự án cá nhân — xây bộ công cụ desktop gọn, thân thiện, dùng tiếng Việt tốt.
        </p>
    </div>
    """


def _build_ecosystem_html() -> str:
    rows = "".join(
        f'''<tr>
            <td style="padding:6px 12px 6px 0; font-size:14pt;">{icon}</td>
            <td style="padding:6px 12px 6px 0; color:#F9FAFB; font-weight:600;">{name}</td>
            <td style="padding:6px 0; color:#D1D5DB;">{desc}</td>
        </tr>'''
        for icon, name, desc in ECOSYSTEM
    )
    return f'<table style="color:#F9FAFB;">{rows}</table>'


# ==================== UpdateDialog ====================

class UpdateDialog(QDialog):
    """Dialog kiểm tra cập nhật ứng dụng + dữ liệu font mới.

    2 tab:
        1. Ứng dụng   — check GitHub release mới cho app.
        2. Dữ liệu font — đồng bộ font packs mới từ cloud source / folder.

    Phase hiện tại: chỉ là khung UI, logic check/download chưa wire.
    Signal `checkAppRequested` / `checkDataRequested` / `downloadDataRequested`
    sẽ được app concrete connect vào worker thực.
    """

    checkAppRequested = pyqtSignal()
    checkDataRequested = pyqtSignal()
    downloadDataRequested = pyqtSignal()

    def __init__(
        self,
        current_version: str = "v1.0.0",
        *,
        parent: QWidget | None = None,
    ) -> None:
        super().__init__(parent)
        self.setWindowTitle("Kiểm tra cập nhật")
        self.setMinimumSize(520, 420)

        self._current_version = current_version

        root = QVBoxLayout(self)
        root.setContentsMargins(24, 20, 24, 20)
        root.setSpacing(16)

        title = QLabel("🔄 Cập nhật")
        tf = QFont()
        tf.setPointSize(14)
        tf.setWeight(QFont.Weight.Bold)
        title.setFont(tf)
        root.addWidget(title)

        tabs = QTabWidget()
        tabs.addTab(self._build_app_tab(), "Ứng dụng")
        tabs.addTab(self._build_data_tab(), "Dữ liệu font")
        root.addWidget(tabs, stretch=1)

        # Close button
        footer = QHBoxLayout()
        footer.addStretch(1)
        btn_close = QPushButton("Đóng")
        btn_close.setProperty("variant", "ghost")
        btn_close.clicked.connect(self.accept)
        footer.addWidget(btn_close)
        root.addLayout(footer)

    # ---------- Public API (app gọi khi check xong) ----------

    def setAppUpdateStatus(self, message: str, has_update: bool) -> None:
        self.app_status_lbl.setText(message)
        color = "#F59E0B" if has_update else "#10B981"
        self.app_status_lbl.setStyleSheet(f"color: {color};")

    def setDataUpdateStatus(self, message: str, has_update: bool) -> None:
        self.data_status_lbl.setText(message)
        color = "#F59E0B" if has_update else "#10B981"
        self.data_status_lbl.setStyleSheet(f"color: {color};")

    # ---------- Tab builders ----------

    def _build_app_tab(self) -> QWidget:
        tab = QWidget()
        v = QVBoxLayout(tab)
        v.setContentsMargins(16, 16, 16, 16)
        v.setSpacing(12)

        ver_row = QLabel(f"Phiên bản hiện tại: <b>{self._current_version}</b>")
        v.addWidget(ver_row)

        self.app_status_lbl = QLabel("Chưa kiểm tra.")
        self.app_status_lbl.setStyleSheet("color: #9CA3AF;")
        v.addWidget(self.app_status_lbl)

        btn_row = QHBoxLayout()
        btn_check = QPushButton("Kiểm tra phiên bản mới")
        btn_check.clicked.connect(self.checkAppRequested.emit)
        btn_row.addWidget(btn_check)
        btn_row.addStretch(1)
        v.addLayout(btn_row)

        hint = QLabel(
            "Cập nhật ứng dụng sẽ tải bản mới từ kho GitHub của TrishTeam "
            "và chạy lại app sau khi cài đặt."
        )
        hint.setWordWrap(True)
        hint.setStyleSheet("color: #9CA3AF; font-size: 9pt;")
        v.addWidget(hint)
        v.addStretch(1)
        return tab

    def _build_data_tab(self) -> QWidget:
        tab = QWidget()
        v = QVBoxLayout(tab)
        v.setContentsMargins(16, 16, 16, 16)
        v.setSpacing(12)

        title_lbl = QLabel("Đồng bộ gói font mới nhất")
        v.addWidget(title_lbl)

        self.data_status_lbl = QLabel("Chưa kiểm tra.")
        self.data_status_lbl.setStyleSheet("color: #9CA3AF;")
        v.addWidget(self.data_status_lbl)

        btn_row = QHBoxLayout()
        btn_check = QPushButton("Kiểm tra gói mới")
        btn_check.clicked.connect(self.checkDataRequested.emit)
        btn_row.addWidget(btn_check)

        btn_dl = QPushButton("Tải & đồng bộ")
        btn_dl.clicked.connect(self.downloadDataRequested.emit)
        btn_row.addWidget(btn_dl)
        btn_row.addStretch(1)
        v.addLayout(btn_row)

        hint = QLabel(
            "Gói font sẽ được tải từ nguồn chính thức của TrishTeam và bổ sung "
            "vào thư mục font hiện tại. Font đã có sẽ không bị ghi đè."
        )
        hint.setWordWrap(True)
        hint.setStyleSheet("color: #9CA3AF; font-size: 9pt;")
        v.addWidget(hint)
        v.addStretch(1)
        return tab
