"""HubView — list 6 app cards với version + Tải/Cập nhật button.

Layout:
    ┌───────────────────────────────────────────────────────────┐
    │ InlineToolbar: 🔄 Cập nhật danh sách     [Refresh]         │
    ├───────────────────────────────────────────────────────────┤
    │ ScrollArea với AppCard list:                               │
    │   ┌────────────────────────────────────────────────────┐ │
    │   │ ✨ TrishFont                          v1.0.0        │ │
    │   │ Quản lý font chuyên nghiệp                          │ │
    │   │ [screenshot 16:9]                                    │ │
    │   │ Changelog: + folder-aware grouping...               │ │
    │   │                          [⬇ Tải về 25 MB]            │ │
    │   └────────────────────────────────────────────────────┘ │
    │   ...                                                       │
    └───────────────────────────────────────────────────────────┘

State button:
    - Chưa cài → "⬇ Tải về" primary gradient
    - Đã cài, version mới hơn → "🔄 Cập nhật" primary
    - Đã cài, version trùng → "✓ Đã cài" disabled
"""

from __future__ import annotations

from pathlib import Path
from typing import Callable

from PyQt6.QtCore import Qt, pyqtSignal
from PyQt6.QtGui import QPixmap
from PyQt6.QtWidgets import (
    QFrame,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QPushButton,
    QScrollArea,
    QVBoxLayout,
    QWidget,
)

# Logos bundled theo app id (lowercase filename). Không có → fallback emoji.
_LOGOS_DIR = Path(__file__).resolve().parent.parent / "resources" / "logos"

from trishteam_core.store import Database
from trishteam_core.widgets import (
    EmptyState,
    InlineToolbar,
    LogPanel,
    ToolbarField,
)

from ..modules.download import DownloadWorker, run_download_async
from ..modules.download.worker import DownloadJob
from ..modules.registry import (
    AppEntry,
    RegistryRepository,
    fetch_apps_registry,
    parse_cached_registry,
)
from ..modules.registry.fetcher import parse_cached_registry as _parse_cached  # noqa


_ACCENT = "#667EEA"


def _human_size(n: int) -> str:
    if n <= 0:
        return "?"
    for unit in ("B", "KB", "MB", "GB"):
        if n < 1024:
            return f"{n:.1f} {unit}" if unit != "B" else f"{n} B"
        n /= 1024
    return f"{n:.1f} TB"


class AppCard(QFrame):
    """1 app entry — emoji + name + version + tagline + button."""

    installRequested = pyqtSignal(object)   # AppEntry

    def __init__(self, app: AppEntry, installed_version: str | None = None,
                 parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self.setProperty("role", "card")
        self.app = app
        self.installed_version = installed_version

        self.setMinimumHeight(120)
        layout = QHBoxLayout(self)
        layout.setContentsMargins(16, 14, 16, 14)
        layout.setSpacing(14)

        # --- Logo: ưu tiên PNG bundled theo app id, fallback emoji ---
        logo = QLabel()
        logo_set = False
        logo_png = _LOGOS_DIR / f"{app.id}.png"
        if logo_png.is_file():
            pix = QPixmap(str(logo_png))
            if not pix.isNull():
                logo.setPixmap(
                    pix.scaled(
                        64, 64,
                        Qt.AspectRatioMode.KeepAspectRatio,
                        Qt.TransformationMode.SmoothTransformation,
                    )
                )
                logo.setFixedSize(64, 64)
                logo.setStyleSheet("background: transparent;")
                logo_set = True
        if not logo_set:
            logo.setText(app.logo_emoji)
            logo.setStyleSheet(
                "font-size: 40px; background: transparent; padding-right: 8px;"
            )
        logo.setAlignment(Qt.AlignmentFlag.AlignCenter)
        layout.addWidget(logo)

        # --- Center: name + version + tagline ---
        center = QVBoxLayout()
        center.setSpacing(2)

        name_row = QHBoxLayout()
        name_row.setSpacing(8)
        name_lbl = QLabel(app.name)
        name_lbl.setStyleSheet(
            "color: #f5f2ed; font-size: 15px; font-weight: 600; "
            "background: transparent;"
        )
        name_row.addWidget(name_lbl)

        ver_lbl = QLabel(f"v{app.version}")
        ver_lbl.setStyleSheet(
            "color: #a09890; font-size: 11px; background: transparent;"
        )
        name_row.addWidget(ver_lbl)
        name_row.addStretch(1)
        center.addLayout(name_row)

        tagline = QLabel(app.tagline or "")
        tagline.setStyleSheet(
            "color: #a09890; font-size: 12px; background: transparent;"
        )
        tagline.setWordWrap(True)
        center.addWidget(tagline)

        size_lbl = QLabel(_human_size(app.size_bytes))
        size_lbl.setStyleSheet(
            "color: #7c7670; font-size: 11px; background: transparent;"
        )
        center.addWidget(size_lbl)
        center.addStretch(1)
        layout.addLayout(center, stretch=1)

        # --- Right: action button ---
        self.btn_action = QPushButton()
        self.btn_action.setProperty("variant", "primary")
        self.btn_action.setFixedHeight(36)
        self.btn_action.setMinimumWidth(140)
        self._refresh_button()
        self.btn_action.clicked.connect(
            lambda: self.installRequested.emit(self.app)
        )
        layout.addWidget(self.btn_action, alignment=Qt.AlignmentFlag.AlignVCenter)

    def _refresh_button(self) -> None:
        if self.installed_version is None:
            self.btn_action.setText("⬇  Tải về")
            self.btn_action.setEnabled(True)
        elif self.installed_version != self.app.version:
            self.btn_action.setText(f"🔄  Cập nhật → v{self.app.version}")
            self.btn_action.setEnabled(True)
        else:
            self.btn_action.setText("✓  Đã cài")
            self.btn_action.setEnabled(False)

    def set_installed_version(self, v: str | None) -> None:
        self.installed_version = v
        self._refresh_button()


class HubView(QWidget):
    """Hub — danh sách app + handle download."""

    def __init__(
        self,
        db: Database,
        registry: RegistryRepository,
        parent: QWidget | None = None,
    ) -> None:
        super().__init__(parent)
        self.db = db
        self.registry = registry
        self._cards: list[AppCard] = []
        self._dl_thread = None
        self._dl_worker = None

        root = QVBoxLayout(self)
        root.setContentsMargins(0, 0, 0, 0)
        root.setSpacing(0)

        # --- Toolbar: refresh registry ---
        self.btn_refresh = QPushButton("🔄  Tải lại danh sách")
        self.btn_refresh.setProperty("variant", "ghost")
        self.btn_refresh.clicked.connect(self._on_refresh_registry)

        self.search = QLineEdit()
        self.search.setPlaceholderText("Lọc theo tên app…")
        self.search.textChanged.connect(self._on_search_changed)

        toolbar = InlineToolbar(
            fields=[
                ToolbarField(
                    icon="🔍", label="Tìm app:", widget=self.search, stretch=1,
                ),
            ],
            actions=[self.btn_refresh],
        )
        root.addWidget(toolbar)

        # --- Scroll area cho cards ---
        self.scroll = QScrollArea()
        self.scroll.setWidgetResizable(True)
        self.scroll.setFrameShape(QScrollArea.Shape.NoFrame)
        self.scroll_content = QWidget()
        self.scroll_layout = QVBoxLayout(self.scroll_content)
        self.scroll_layout.setContentsMargins(14, 14, 14, 14)
        self.scroll_layout.setSpacing(10)

        self.empty = EmptyState(
            icon="📦",
            title="Chưa có dữ liệu app",
            subtitle='Bấm "🔄 Tải lại danh sách" để fetch registry từ GitHub.',
        )
        self.scroll_layout.addWidget(self.empty)
        self.scroll_layout.addStretch(1)

        self.scroll.setWidget(self.scroll_content)
        root.addWidget(self.scroll, stretch=1)

        # --- Log panel ---
        self.log = LogPanel(title="Nhật ký", icon="📋")
        root.addWidget(self.log)

        # --- Filter mode (cho proxy view) ---
        self._filter_mode: str = "all"   # 'all' | 'installed' | 'updates'

        # --- Initial load: cache trước, sau đó async refresh ---
        self._load_from_cache()

    # ----- Proxy views -----

    def installed_only_proxy(self) -> "HubView":
        """Trả về self với filter mode 'installed'."""
        proxy = HubView.__new__(HubView)
        # Vì BaseWindow giữ ref riêng từng page, đơn giản hơn là tạo wrapper
        # nhưng tốn nhiều effort. Tạm thời reuse self và filter qua _on_search.
        return self

    def updates_only_proxy(self) -> "HubView":
        return self

    # ----- Registry load -----

    def _load_from_cache(self) -> None:
        cached = self.registry.load_cache()
        if not cached:
            self.log.log_info(
                "i  Chưa có cache registry — bấm 'Tải lại' để fetch từ GitHub."
            )
            return
        raw, fetched_at = cached
        try:
            apps = parse_cached_registry(raw)
            self._render_apps(apps)
            self.log.log_info(
                f"i  Đã load {len(apps)} app từ cache (fetched: {fetched_at})."
            )
        except Exception as e:
            self.log.log_error(f"❌ Cache lỗi parse: {e}")

    def _on_refresh_registry(self) -> None:
        self.log.log_info("i  Đang fetch registry từ GitHub…")
        self.btn_refresh.setEnabled(False)
        try:
            apps, raw = fetch_apps_registry()
            self.registry.save_cache(raw)
            self._render_apps(apps)
            self.log.log_success(f"✅ Fetch OK — {len(apps)} app.")
        except Exception as e:
            self.log.log_error(
                f"❌ Fetch lỗi: {e}. "
                "Kiểm tra URL trong fetcher.REGISTRY_URL hoặc kết nối mạng."
            )
        finally:
            self.btn_refresh.setEnabled(True)

    # ----- Rendering -----

    def _render_apps(self, apps: list[AppEntry]) -> None:
        # Clear old cards
        for c in self._cards:
            c.setParent(None)
            c.deleteLater()
        self._cards.clear()

        if not apps:
            self.empty.show()
            return
        self.empty.hide()

        installed_map = self.registry.list_installed()

        # Insert ở index 0, push empty + stretch xuống
        for idx, app in enumerate(apps):
            installed_v = installed_map.get(app.id)
            card = AppCard(app, installed_version=installed_v)
            card.installRequested.connect(self._on_install_requested)
            self.scroll_layout.insertWidget(idx, card)
            self._cards.append(card)

    def _on_search_changed(self, text: str) -> None:
        needle = text.strip().lower()
        for card in self._cards:
            visible = (not needle) or (needle in card.app.name.lower())
            card.setVisible(visible)

    # ----- Install -----

    def _on_install_requested(self, app: AppEntry) -> None:
        # Pick platform — chỉ hỗ trợ Windows x64 ở v0.1
        dl = app.downloads.get("windows_x64")
        if not dl:
            self.log.log_error(f"❌ {app.name}: chưa có installer cho Windows x64.")
            return

        file_name = f"{app.id}-{app.version}-setup.exe"
        job = DownloadJob(
            app_id=app.id,
            url=dl.url,
            file_name=file_name,
            expected_sha256=dl.sha256,
            installer_args=dl.installer_args or ["/S"],   # NSIS silent default
        )

        self.log.log_info(
            f"i  Bắt đầu tải {app.name} v{app.version} "
            f"({_human_size(app.size_bytes)})…"
        )

        # Disable button trong khi tải
        for card in self._cards:
            if card.app.id == app.id:
                card.btn_action.setEnabled(False)
                card.btn_action.setText("⏳  Đang tải…")
                break

        self._dl_thread, self._dl_worker = run_download_async(
            job,
            on_progress=self._on_dl_progress,
            on_status=self._on_dl_status,
            on_sha=self._on_dl_sha,
            on_install_started=lambda p: self.log.log_info(f"i  Chạy installer: {p}"),
            on_finished=lambda ok, msg: self._on_dl_finished(app, ok, msg),
        )

    def _on_dl_progress(self, done: int, total: int) -> None:
        self.log.set_progress(done, total)

    def _on_dl_status(self, msg: str) -> None:
        self.log.log_info(f"i  {msg}")

    def _on_dl_sha(self, ok: bool) -> None:
        if ok:
            self.log.log_success("✅ SHA256 verify OK.")
        else:
            self.log.log_error("❌ SHA256 mismatch — file có thể bị hỏng.")

    def _on_dl_finished(self, app: AppEntry, ok: bool, msg: str) -> None:
        self.log.reset_progress()
        if ok:
            self.log.log_success(f"✅ {app.name}: {msg}")
            self.registry.mark_installed(app.id, app.version)
            for card in self._cards:
                if card.app.id == app.id:
                    card.set_installed_version(app.version)
                    break
        else:
            self.log.log_error(f"❌ {app.name}: {msg}")
            for card in self._cards:
                if card.app.id == app.id:
                    card.set_installed_version(card.installed_version)
                    break
