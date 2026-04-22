"""AppHeader — top bar 56px, match pattern TrishFont v1.0 reference.

Layout:
    [✨ TrishFont] [v1.0.0]          spacer    [🔄 Cập nhật] [ℹ Giới thiệu]
       brand bold   version muted              2 ghost buttons (no Admin dot)

Reference TrishFont dùng `✨ Trish<b>Font</b>` với font Be Vietnam Pro 14pt bold,
màu TEXT_MAIN, nền BG_CARD. App TrishNexus là public (no login) nên thay
Admin badge bằng 2 nút Update + About.

Xem docs/design-spec.md §6.1.
"""

from __future__ import annotations

from pathlib import Path

from PyQt6.QtCore import Qt, pyqtSignal
from PyQt6.QtGui import QFont, QPixmap
from PyQt6.QtWidgets import (
    QFrame,
    QHBoxLayout,
    QLabel,
    QPushButton,
    QWidget,
)


class AppHeader(QFrame):
    """Thanh header warm-dark 56px, compose brand + version + actions.

    Brand có 2 mode:
    - `logo_path` (ưu tiên): load PNG 32×32 (vd icon-64.png scale xuống) —
      phù hợp TrishNexus với logo chính thức đã xử lý ở `design/logos/<App>/`.
    - `logo_emoji` (fallback): emoji 1 ký tự, dùng khi chưa có asset.
    """

    updateRequested = pyqtSignal()
    aboutRequested  = pyqtSignal()

    def __init__(
        self,
        logo_emoji: str = "✨",
        app_name: str = "TrishApp",
        version: str = "v1.0.0",
        *,
        logo_path: str | Path | None = None,
        show_update: bool = True,
        show_about: bool = True,
        # Cho phép app wrap HTML trong name (vd "Trish<b>Font</b>")
        name_is_html: bool = False,
        parent: QWidget | None = None,
    ) -> None:
        super().__init__(parent)
        self.setProperty("role", "app-header")
        self.setFixedHeight(56)

        layout = QHBoxLayout(self)
        layout.setContentsMargins(16, 0, 16, 0)
        layout.setSpacing(10)

        # --- Logo: pixmap (preferred) hoặc emoji fallback ---
        self.logo_lbl: QLabel | None = None
        if logo_path is not None:
            p = Path(logo_path)
            if p.is_file():
                pix = QPixmap(str(p))
                if not pix.isNull():
                    self.logo_lbl = QLabel()
                    # 32×32 vừa với header 56px (padding 12px trên-dưới).
                    self.logo_lbl.setPixmap(
                        pix.scaled(
                            32, 32,
                            Qt.AspectRatioMode.KeepAspectRatio,
                            Qt.TransformationMode.SmoothTransformation,
                        )
                    )
                    self.logo_lbl.setStyleSheet("background: transparent;")
                    self.logo_lbl.setFixedSize(32, 32)
                    layout.addWidget(self.logo_lbl)

        # --- Brand: text-only nếu đã có pixmap, else kèm emoji ---
        if self.logo_lbl is not None:
            # Đã có logo image → chỉ cần text
            if name_is_html:
                brand_html = f"<b>{app_name}</b>" if "<b>" not in app_name else app_name
            else:
                brand_html = f"<b>{app_name}</b>"
        else:
            # Fallback emoji
            if name_is_html:
                brand_html = f"{logo_emoji} {app_name}"
            else:
                brand_html = f"{logo_emoji} <b>{app_name}</b>"
        self.brand_lbl = QLabel(brand_html)
        self.brand_lbl.setTextFormat(Qt.TextFormat.RichText)
        brand_font = QFont("Be Vietnam Pro", 13)
        brand_font.setWeight(QFont.Weight.Bold)
        self.brand_lbl.setFont(brand_font)
        self.brand_lbl.setProperty("role", "app-title")
        self.brand_lbl.setStyleSheet("background: transparent;")
        layout.addWidget(self.brand_lbl)

        # Version muted (11px)
        self.version_lbl = QLabel(version)
        self.version_lbl.setProperty("role", "app-version")
        self.version_lbl.setStyleSheet(
            "color: #a09890; font-size: 11px; background: transparent;"
        )
        layout.addWidget(self.version_lbl)

        layout.addStretch(1)

        # --- Action buttons (ghost variant) ---
        self.btn_update: QPushButton | None = None
        self.btn_about: QPushButton | None = None
        self._update_available = False

        if show_update:
            self.btn_update = QPushButton("🔄 Cập nhật")
            self.btn_update.setProperty("variant", "ghost")
            self.btn_update.setCursor(Qt.CursorShape.PointingHandCursor)
            self.btn_update.setFixedHeight(30)
            self.btn_update.setToolTip("Kiểm tra cập nhật ứng dụng và dữ liệu font mới")
            self.btn_update.clicked.connect(self.updateRequested.emit)
            layout.addWidget(self.btn_update)

        if show_about:
            self.btn_about = QPushButton("ℹ Giới thiệu")
            self.btn_about.setProperty("variant", "ghost")
            self.btn_about.setCursor(Qt.CursorShape.PointingHandCursor)
            self.btn_about.setFixedHeight(30)
            self.btn_about.setToolTip("Thông tin tác giả và hệ sinh thái TrishNexus")
            self.btn_about.clicked.connect(self.aboutRequested.emit)
            layout.addWidget(self.btn_about)

    # ---------- Public API ----------

    def setUpdateAvailable(self, has_update: bool) -> None:
        """Highlight nút Update khi có bản mới."""
        self._update_available = has_update
        if not self.btn_update:
            return
        if has_update:
            self.btn_update.setText("🔄 Cập nhật mới •")
            self.btn_update.setStyleSheet(
                "QPushButton { color: #F59E0B; border-color: #F59E0B; }"
                "QPushButton:hover { background: rgba(245,158,11,0.10); }"
            )
        else:
            self.btn_update.setText("🔄 Cập nhật")
            self.btn_update.setStyleSheet("")  # revert về theme default

    def setAppName(self, name: str, *, is_html: bool = False) -> None:
        if is_html:
            self.brand_lbl.setText(name)
        else:
            self.brand_lbl.setText(f"✨ <b>{name}</b>")

    def setVersion(self, version: str) -> None:
        self.version_lbl.setText(version)
