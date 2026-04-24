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
from PyQt6.QtGui import QAction, QActionGroup, QFont, QPixmap
from PyQt6.QtWidgets import (
    QFrame,
    QHBoxLayout,
    QLabel,
    QMenu,
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
    themeChanged    = pyqtSignal(str)  # theme_key — emit khi user pick từ menu

    def __init__(
        self,
        logo_emoji: str = "✨",
        app_name: str = "TrishApp",
        version: str = "v1.0.0",
        *,
        logo_path: str | Path | None = None,
        show_update: bool = True,
        show_about: bool = True,
        show_theme_picker: bool = True,
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
        self.btn_theme: QPushButton | None = None
        self._theme_menu: QMenu | None = None
        self._theme_actions: dict[str, QAction] = {}
        self._update_available = False

        if show_update:
            self.btn_update = QPushButton("🔄 Cập nhật")
            self.btn_update.setProperty("variant", "ghost")
            self.btn_update.setCursor(Qt.CursorShape.PointingHandCursor)
            self.btn_update.setFixedHeight(30)
            self.btn_update.setToolTip("Kiểm tra cập nhật ứng dụng và dữ liệu font mới")
            self.btn_update.clicked.connect(self.updateRequested.emit)
            layout.addWidget(self.btn_update)

        if show_theme_picker:
            self.btn_theme = QPushButton("🎨 Giao diện")
            self.btn_theme.setProperty("variant", "ghost")
            self.btn_theme.setCursor(Qt.CursorShape.PointingHandCursor)
            self.btn_theme.setFixedHeight(30)
            self.btn_theme.setToolTip("Đổi theme màu — áp dụng ngay, không restart")
            self.btn_theme.clicked.connect(self._open_theme_menu)
            layout.addWidget(self.btn_theme)

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

    # ---------- Theme picker ----------

    def _open_theme_menu(self) -> None:
        """Lazy-build + show menu đổi theme. Import theme_manager muộn để
        widget chạy được trong test env không có tokens.v2.json."""
        if self.btn_theme is None:
            return
        try:
            from trishteam_core.ui.theme_manager import theme_manager
            from trishteam_core.ui.theme_registry import list_themes
        except Exception:
            return  # module fail → im lặng (không crash)

        # Build menu lần đầu; các lần sau refresh check-state.
        if self._theme_menu is None:
            self._theme_menu = QMenu(self)
            self._theme_menu.setProperty("role", "theme-menu")
            group = QActionGroup(self._theme_menu)
            group.setExclusive(True)
            try:
                entries = list_themes()
            except Exception:
                entries = []
            for key, label in entries:
                act = QAction(label, self._theme_menu)
                act.setCheckable(True)
                act.setData(key)
                act.triggered.connect(lambda _=False, k=key: self._on_theme_picked(k))
                group.addAction(act)
                self._theme_menu.addAction(act)
                self._theme_actions[key] = act

        # Sync check state với current theme
        try:
            current = theme_manager.current
        except Exception:
            current = None
        for key, act in self._theme_actions.items():
            act.setChecked(key == current)

        # Popup ngay dưới button
        pos = self.btn_theme.mapToGlobal(self.btn_theme.rect().bottomLeft())
        self._theme_menu.exec(pos)

    def _on_theme_picked(self, key: str) -> None:
        """User chọn theme trong menu → delegate cho ThemeManager + emit.

        Phase 13.5 fix (2026-04-23): target = **top-level window** (self.window())
        thay vì QApplication. QMainWindow đã có stylesheet riêng (set từ
        BaseWindow.__init__ qua apply_theme) → ghi đè QApplication stylesheet.
        Muốn đổi màu thật sự thì phải setStyleSheet lên chính QMainWindow đó.

        Ngoài ra broadcast cho mọi top-level widget khác (nếu app có nhiều cửa
        sổ đang mở) qua QApplication.topLevelWidgets().
        """
        try:
            from trishteam_core.ui.theme_manager import theme_manager
            from trishteam_core.ui import theme_registry
            from PyQt6.QtWidgets import QApplication

            # 1. Apply lên top-level window chứa header này (chắc chắn nhìn thấy)
            top = self.window()
            theme_manager.set_theme(key, target=top)

            # 2. Broadcast cho mọi top-level window khác đang mở
            #    (AboutDialog, UpdateDialog, các subwindow) — re-apply stylesheet
            #    với qss hiện tại.
            resolved = theme_registry.resolve_alias(key)
            qss = theme_registry.build_qss_from_theme(resolved)
            app = QApplication.instance()
            if app is not None:
                for w in app.topLevelWidgets():
                    if w is top:
                        continue  # đã apply ở bước 1
                    if hasattr(w, "setStyleSheet"):
                        w.setStyleSheet(qss)
        except Exception:
            pass  # user thấy menu đóng — không crash
        self.themeChanged.emit(key)
