"""PackView — tab "Cập nhật" trong TrishFont.

Layout (dark, compact — match design-spec.md v0.1):
    ┌──────────────────────────────────────────────────────────┐
    │ InlineToolbar: 🔍 Tìm gói font  [...........]  [🔄 Tải..] │
    ├──────────────────────────────────────────────────────────┤
    │ ScrollArea với PackCard list:                             │
    │   ┌─────────────────────────────────────────────────────┐│
    │   │ 📦  Tiếng Việt — Cơ bản              v1.0.0          ││
    │   │     42 font Unicode hỗ trợ dấu VN đầy đủ             ││
    │   │     18.4 MB · 42 file · [VN] [basic]                 ││
    │   │                          [⬇ Tải về]                  ││
    │   └─────────────────────────────────────────────────────┘│
    │   ...                                                      │
    ├──────────────────────────────────────────────────────────┤
    │ LogPanel 130px (progress + SHA + extract)                 │
    └──────────────────────────────────────────────────────────┘

State button (mirror HubView.AppCard):
    - NOT_INSTALLED → "⬇ Tải về" primary
    - UPDATE        → "🔄 Cập nhật → vX.Y.Z" primary
    - INSTALLED     → "✓ Đã cài" disabled

Flow khi user bấm "Tải về":
    1. Disable button, log "Bắt đầu tải…"
    2. run_pack_download_async(job) spawn QThread
    3. progress → LogPanel.set_progress
    4. shaVerified(True) → log success; False → log error + button reset
    5. extracted(n, bytes) → log
    6. finished(ok, ...) → repo.mark_installed + card.set_installed_version +
       trigger library rescan (nếu có callback).
"""

from __future__ import annotations

from pathlib import Path
from typing import Callable

from PyQt6.QtCore import Qt, pyqtSignal
from PyQt6.QtWidgets import (
    QCheckBox,
    QFrame,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QPushButton,
    QScrollArea,
    QVBoxLayout,
    QWidget,
)

from trishteam_core.store import Database
from trishteam_core.widgets import (
    EmptyState,
    InlineToolbar,
    LogPanel,
    ToolbarField,
)

from ..settings import (
    SettingsRepository,
    is_cloud_sync_enabled,
    set_cloud_sync_enabled,
)
from .downloader import DownloadPackJob, run_pack_download_async
from .fetcher import fetch_manifest, parse_manifest
from .models import FontPack, PackStatus
from .repository import FontPackRepository


def _human_size(n: int) -> str:
    if n <= 0:
        return "?"
    val = float(n)
    for unit in ("B", "KB", "MB", "GB"):
        if val < 1024:
            return f"{val:.1f} {unit}" if unit != "B" else f"{int(val)} B"
        val /= 1024
    return f"{val:.1f} TB"


# Emoji fallback theo `kind` — không bundle logo riêng cho pack ở v1.
_KIND_EMOJI = {
    "windows": "🪟",
    "autocad": "📐",
    "mixed":   "📦",
}


class PackCard(QFrame):
    """1 pack entry — emoji + name + version + meta + button.

    Pattern copy từ HubView.AppCard nhưng đơn giản hơn:
    - Không load logo từ file (chưa bundle per-pack logo ở v1)
    - Button state dựa trên `pack.status` (property tính từ installed_version)
    """

    installRequested = pyqtSignal(object)   # FontPack

    def __init__(self, pack: FontPack, parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self.setProperty("role", "card")
        self.pack = pack

        self.setMinimumHeight(110)
        layout = QHBoxLayout(self)
        layout.setContentsMargins(16, 14, 16, 14)
        layout.setSpacing(14)

        # --- Logo emoji (per kind) ---
        logo = QLabel(_KIND_EMOJI.get(pack.kind, "📦"))
        logo.setStyleSheet(
            "font-size: 38px; background: transparent; padding-right: 8px;"
        )
        logo.setAlignment(Qt.AlignmentFlag.AlignCenter)
        logo.setFixedSize(64, 64)
        layout.addWidget(logo)

        # --- Center: name + version + description + meta ---
        center = QVBoxLayout()
        center.setSpacing(2)

        name_row = QHBoxLayout()
        name_row.setSpacing(8)
        name_lbl = QLabel(pack.name)
        name_lbl.setStyleSheet(
            "color: #f5f2ed; font-size: 15px; font-weight: 600; "
            "background: transparent;"
        )
        name_row.addWidget(name_lbl)

        ver_lbl = QLabel(f"v{pack.version}")
        ver_lbl.setStyleSheet(
            "color: #a09890; font-size: 11px; background: transparent;"
        )
        name_row.addWidget(ver_lbl)
        name_row.addStretch(1)
        center.addLayout(name_row)

        if pack.description:
            desc = QLabel(pack.description)
            desc.setStyleSheet(
                "color: #a09890; font-size: 12px; background: transparent;"
            )
            desc.setWordWrap(True)
            center.addWidget(desc)

        # Meta line: size · file_count · tags
        meta_parts: list[str] = [
            _human_size(pack.size_bytes),
            f"{pack.file_count} file" if pack.file_count else "",
        ]
        if pack.tags:
            meta_parts.append("[" + "] [".join(pack.tags) + "]")
        meta_parts = [p for p in meta_parts if p]
        meta_lbl = QLabel(" · ".join(meta_parts))
        meta_lbl.setStyleSheet(
            "color: #7c7670; font-size: 11px; background: transparent;"
        )
        center.addWidget(meta_lbl)
        center.addStretch(1)
        layout.addLayout(center, stretch=1)

        # --- Right: action button ---
        self.btn_action = QPushButton()
        self.btn_action.setProperty("variant", "primary")
        self.btn_action.setFixedHeight(36)
        self.btn_action.setMinimumWidth(160)
        self._refresh_button()
        self.btn_action.clicked.connect(
            lambda: self.installRequested.emit(self.pack)
        )
        layout.addWidget(self.btn_action, alignment=Qt.AlignmentFlag.AlignVCenter)

    def _refresh_button(self) -> None:
        st = self.pack.status
        if st is PackStatus.NOT_INSTALLED:
            self.btn_action.setText("⬇  Tải về")
            self.btn_action.setEnabled(True)
        elif st is PackStatus.UPDATE:
            self.btn_action.setText(f"🔄  Cập nhật → v{self.pack.version}")
            self.btn_action.setEnabled(True)
        else:  # INSTALLED
            self.btn_action.setText("✓  Đã cài")
            self.btn_action.setEnabled(False)

    def set_installed(self, version: str | None, installed_at: str | None = None) -> None:
        self.pack.installed_version = version
        if installed_at is not None:
            self.pack.installed_at = installed_at
        self._refresh_button()

    def set_busy(self, text: str) -> None:
        self.btn_action.setEnabled(False)
        self.btn_action.setText(text)


class PackView(QWidget):
    """Tab "Cập nhật" — list pack + download/install flow.

    Args:
        db: shared Database (để khởi tạo repository)
        on_installed: optional callback(pack_id) gọi sau khi extract OK
                      (để trigger library rescan trong app.py)
    """

    def __init__(
        self,
        db: Database,
        *,
        on_installed: Callable[[str], None] | None = None,
        parent: QWidget | None = None,
    ) -> None:
        super().__init__(parent)
        self.db = db
        self.repo = FontPackRepository(db)
        self.settings = SettingsRepository(db)
        self._on_installed = on_installed

        self._cards: list[PackCard] = []
        self._dl_thread = None
        self._dl_worker = None

        root = QVBoxLayout(self)
        root.setContentsMargins(0, 0, 0, 0)
        root.setSpacing(0)

        # --- Toolbar: search + refresh ---
        self.search = QLineEdit()
        self.search.setPlaceholderText("Lọc gói font theo tên…")
        self.search.textChanged.connect(self._on_search_changed)

        self.btn_refresh = QPushButton("🔄  Tải lại danh sách")
        self.btn_refresh.setProperty("variant", "ghost")
        self.btn_refresh.clicked.connect(self._on_refresh_manifest)

        toolbar = InlineToolbar(
            fields=[
                ToolbarField(
                    icon="🔍", label="Tìm gói:", widget=self.search, stretch=1,
                ),
            ],
            actions=[self.btn_refresh],
        )
        root.addWidget(toolbar)

        # --- Cloud-sync toggle row ---
        # User tắt nếu font đã bundled sẵn theo installer → không pull trùng.
        toggle_row = QFrame()
        toggle_row.setStyleSheet(
            "QFrame { background: transparent; border-top: 1px solid #2a2722; }"
        )
        toggle_layout = QHBoxLayout(toggle_row)
        toggle_layout.setContentsMargins(16, 8, 16, 8)
        self.chk_cloud_sync = QCheckBox("Tải font pack từ GitHub (cloud)")
        self.chk_cloud_sync.setToolTip(
            "Tắt nếu file cài đã kèm sẵn font data — tránh pull trùng từ cloud."
        )
        self.chk_cloud_sync.setChecked(is_cloud_sync_enabled(self.settings))
        self.chk_cloud_sync.stateChanged.connect(self._on_toggle_cloud_sync)
        toggle_layout.addWidget(self.chk_cloud_sync)
        toggle_layout.addStretch(1)
        hint = QLabel("Nguồn font = data bundled theo installer.")
        hint.setStyleSheet("color: #7c7670; font-size: 10pt;")
        toggle_layout.addWidget(hint)
        root.addWidget(toggle_row)

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
            title="Chưa có gói font nào",
            subtitle='Bấm "🔄 Tải lại danh sách" để fetch manifest từ GitHub.',
        )
        self.scroll_layout.addWidget(self.empty)
        self.scroll_layout.addStretch(1)

        self.scroll.setWidget(self.scroll_content)
        root.addWidget(self.scroll, stretch=1)

        # --- Log panel ---
        self.log = LogPanel(title="Nhật ký", icon="📋")
        root.addWidget(self.log)

        # --- Initial load: cache trước ---
        self._load_from_cache()

    # ----- Manifest load -----

    def _load_from_cache(self) -> None:
        cached = self.repo.load_manifest_cache()
        if not cached:
            self.log.log_info(
                "i  Chưa có cache manifest — bấm 'Tải lại' để fetch từ GitHub."
            )
            return
        raw, fetched_at = cached
        try:
            packs = parse_manifest(raw)
            packs = self.repo.hydrate_packs(packs)
            self._render_packs(packs)
            self.log.log_info(
                f"i  Đã load {len(packs)} gói từ cache (fetched: {fetched_at})."
            )
        except Exception as e:
            self.log.log_error(f"❌ Cache lỗi parse: {e}")

    def _on_refresh_manifest(self) -> None:
        # Gate theo toggle cloud-sync
        if not is_cloud_sync_enabled(self.settings):
            self.log.log_warn(
                "⚠  Đã tắt 'Tải font pack từ GitHub' — "
                "bật lại checkbox ở trên để fetch manifest."
            )
            return

        self.log.log_info("i  Đang fetch manifest từ GitHub…")
        self.btn_refresh.setEnabled(False)
        try:
            packs, raw = fetch_manifest()
            self.repo.save_manifest_cache(raw)
            packs = self.repo.hydrate_packs(packs)
            self._render_packs(packs)
            self.log.log_success(f"✅ Fetch OK — {len(packs)} gói font.")
        except Exception as e:
            self.log.log_error(
                f"❌ Fetch lỗi: {e}. "
                "Kiểm tra URL trong fetcher.MANIFEST_URL hoặc kết nối mạng."
            )
        finally:
            self.btn_refresh.setEnabled(True)

    def _on_toggle_cloud_sync(self, state: int) -> None:
        enabled = state == Qt.CheckState.Checked.value or state == 2
        set_cloud_sync_enabled(self.settings, enabled)
        self.btn_refresh.setEnabled(enabled)
        if enabled:
            self.log.log_info(
                "i  Đã bật cloud-sync — bấm 'Tải lại danh sách' để fetch."
            )
        else:
            self.log.log_info(
                "i  Đã tắt cloud-sync — font sẽ chỉ lấy từ data bundled với installer."
            )

    # ----- Rendering -----

    def _render_packs(self, packs: list[FontPack]) -> None:
        # Clear old cards
        for c in self._cards:
            c.setParent(None)
            c.deleteLater()
        self._cards.clear()

        if not packs:
            self.empty.show()
            return
        self.empty.hide()

        for idx, pack in enumerate(packs):
            card = PackCard(pack)
            card.installRequested.connect(self._on_install_requested)
            self.scroll_layout.insertWidget(idx, card)
            self._cards.append(card)

    def _on_search_changed(self, text: str) -> None:
        needle = text.strip().lower()
        for card in self._cards:
            visible = (
                not needle
                or needle in card.pack.name.lower()
                or needle in card.pack.id.lower()
                or any(needle in t.lower() for t in card.pack.tags)
            )
            card.setVisible(visible)

    # ----- Download + install -----

    def _find_card(self, pack_id: str) -> PackCard | None:
        for c in self._cards:
            if c.pack.id == pack_id:
                return c
        return None

    def _on_install_requested(self, pack: FontPack) -> None:
        if not pack.download_url:
            self.log.log_error(
                f"❌ {pack.name}: manifest không có download_url."
            )
            return

        job = DownloadPackJob(
            pack_id=pack.id,
            version=pack.version,
            url=pack.download_url,
            expected_sha256=pack.sha256,
        )

        self.log.log_info(
            f"i  Bắt đầu tải {pack.name} v{pack.version} "
            f"({_human_size(pack.size_bytes)})…"
        )

        card = self._find_card(pack.id)
        if card is not None:
            card.set_busy("⏳  Đang tải…")

        # Giữ ref để QThread + worker không bị GC giữa chừng
        self._dl_thread, self._dl_worker = run_pack_download_async(
            job,
            on_progress=self._on_dl_progress,
            on_sha=lambda ok, p=pack: self._on_dl_sha(p, ok),
            on_extracted=lambda n, b, p=pack: self._on_dl_extracted(p, n, b),
            on_finished=(
                lambda ok, n, b, msg, path, p=pack:
                    self._on_dl_finished(p, ok, n, b, msg, path)
            ),
        )

    def _on_dl_progress(self, done: int, total: int) -> None:
        self.log.set_progress(done, total)

    def _on_dl_sha(self, pack: FontPack, ok: bool) -> None:
        if ok:
            self.log.log_success(f"✅ {pack.name}: SHA256 verify OK.")
        else:
            self.log.log_error(
                f"❌ {pack.name}: SHA256 mismatch — file có thể bị hỏng."
            )

    def _on_dl_extracted(self, pack: FontPack, n_files: int, total_bytes: int) -> None:
        self.log.log_info(
            f"i  {pack.name}: extract xong {n_files} file "
            f"({_human_size(total_bytes)})."
        )

    def _on_dl_finished(
        self,
        pack: FontPack,
        ok: bool,
        n_files: int,
        total_bytes: int,
        msg: str,
        extract_path: str,
    ) -> None:
        self.log.reset_progress()
        card = self._find_card(pack.id)

        if not ok:
            self.log.log_error(f"❌ {pack.name}: {msg}")
            if card is not None:
                # Restore về state cũ
                card._refresh_button()
            return

        # Success: ghi DB + update card
        try:
            self.repo.mark_installed(
                pack.id,
                pack.version,
                extract_path=Path(extract_path) if extract_path else Path(""),
                file_count=n_files,
                size_bytes=total_bytes,
                sha256=pack.sha256,
            )
        except Exception as e:
            self.log.log_warn(f"⚠  DB update lỗi: {e}")

        self.log.log_success(f"✅ {pack.name}: {msg}")

        if card is not None:
            card.set_installed(pack.version)

        # Trigger rescan library (nếu caller provide callback)
        if self._on_installed is not None:
            try:
                self._on_installed(pack.id)
            except Exception as e:
                self.log.log_warn(f"⚠  Rescan callback lỗi: {e}")
