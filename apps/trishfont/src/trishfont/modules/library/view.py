"""Library view — redesigned theo design-spec.md v0.1.

Layout (dark, compact, gradient accent):
    ┌─────────────────────────────────────────────────────┐
    │ InlineToolbar: 📁 Font folder: [.....] [Quét] [Chọn]│
    ├─────────────────────────────────────────────────────┤
    │                🔍 Tìm font: [............ search]   │
    ├─────────────────────────────────────────────────────┤
    │ ActionBar: ☑ Chọn tất cả ☐ Bỏ chọn  [⚡ Cài đặt N]  │
    ├─────────────────────────────────────────────────────┤
    │   ▼ 📁 Sans Serif (N file)      [☐ Chọn tất cả N]    │
    │      ☐ Font 1                                       │
    │      ☐ Font 2                                       │
    │   ▶ 📁 Serif (N file)           [☐ Chọn tất cả N]    │
    │   ...                                               │
    ├─────────────────────────────────────────────────────┤
    │ LogPanel 180px (terminal style)                     │
    └─────────────────────────────────────────────────────┘

Font được nhóm theo `category` (sans_serif / serif / mono / display).
Tick checkbox → counter ActionBar update realtime. Bấm CTA "Cài đặt" sẽ
gọi logic cài font — Phase này chỉ log vào LogPanel (install worker để sau).
"""

from __future__ import annotations

from pathlib import Path

from PyQt6.QtCore import QEvent, Qt
from PyQt6.QtGui import QFont
from PyQt6.QtWidgets import (
    QFileDialog,
    QLineEdit,
    QPushButton,
    QScrollArea,
    QSplitter,
    QVBoxLayout,
    QWidget,
)

from trishteam_core.store import Database
from trishteam_core.widgets import (
    ActionBar,
    CardGroup,
    CardItem,
    EmptyState,
    InlineToolbar,
    LogPanel,
    ToolbarField,
)

from ..settings import (
    SettingsRepository,
    resolve_font_library_path,
    save_font_library_path,
)
from .models import icon_for_group, stripe_for_index
from .repository import FontRepository


class LibraryView(QWidget):
    """Thư viện font — chọn folder, group theo category, bulk install."""

    def __init__(self, db: Database, parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self.repo = FontRepository(db)
        self.settings = SettingsRepository(db)

        # State
        self._card_groups: list[CardGroup] = []
        self._total_checked = 0

        # Layout root: toolbar / toolbar search / actionbar / scroll+log (splitter)
        root = QVBoxLayout(self)
        root.setContentsMargins(0, 0, 0, 0)
        root.setSpacing(0)

        # --- InlineToolbar 1: Font folder picker ---
        self.path_input = QLineEdit()
        self.path_input.setReadOnly(True)
        self.path_input.setPlaceholderText("(chưa chọn thư mục font)")

        self.btn_rescan = QPushButton("Quét lại")
        self.btn_rescan.setProperty("variant", "ghost")
        self.btn_rescan.clicked.connect(self._on_rescan)

        self.btn_pick = QPushButton("Chọn…")
        self.btn_pick.setProperty("variant", "ghost")
        self.btn_pick.clicked.connect(self._on_pick_folder)

        path_toolbar = InlineToolbar(
            fields=[
                ToolbarField(icon="📁", label="Thư mục font:", widget=self.path_input, stretch=1),
            ],
            actions=[self.btn_rescan, self.btn_pick],
        )
        root.addWidget(path_toolbar)

        # --- InlineToolbar 2: Search ---
        self.search_input = QLineEdit()
        self.search_input.setPlaceholderText("Lọc font theo tên…")
        self.search_input.textChanged.connect(self._on_search_changed)

        search_toolbar = InlineToolbar(
            fields=[
                ToolbarField(icon="🔍", label="Tìm font:", widget=self.search_input, stretch=1),
            ],
            actions=[],
        )
        root.addWidget(search_toolbar)

        # --- ActionBar: bulk select + install CTA ---
        self.action_bar = ActionBar(
            select_all_label="Chọn tất cả",
            deselect_all_label="Bỏ chọn",
            counter_template="Đã chọn: {n} font",
            cta_label="⚡ Cài đặt font đã chọn",
        )
        self.action_bar.selectAllRequested.connect(lambda: self._select_all(True))
        self.action_bar.deselectAllRequested.connect(lambda: self._select_all(False))
        self.action_bar.ctaClicked.connect(self._on_install_clicked)
        root.addWidget(self.action_bar)

        # --- Body splitter: scroll area (groups + empty inside) | log panel ---
        body_splitter = QSplitter(Qt.Orientation.Vertical)

        # Scroll area with cards
        self.scroll = QScrollArea()
        self.scroll.setWidgetResizable(True)
        self.scroll.setFrameShape(QScrollArea.Shape.NoFrame)
        self.scroll_content = QWidget()
        self.scroll_layout = QVBoxLayout(self.scroll_content)
        self.scroll_layout.setContentsMargins(10, 10, 10, 10)
        self.scroll_layout.setSpacing(6)

        # Empty state — đặt INSIDE scroll content (không phải splitter pane riêng)
        # → luôn có không gian hiển thị khi chưa có font, không bị splitter ép = 0
        self.empty = EmptyState(
            icon="🔤",
            title="Chưa có font nào",
            subtitle='Bấm "Chọn…" để trỏ đến thư mục chứa font (.ttf / .otf / .ttc).',
        )
        self.scroll_layout.addWidget(self.empty)
        self.scroll_layout.addStretch(1)  # push groups to top khi có font

        self.scroll.setWidget(self.scroll_content)
        body_splitter.addWidget(self.scroll)

        # Log panel
        self.log = LogPanel(title="Nhật ký", icon="📋")
        body_splitter.addWidget(self.log)

        body_splitter.setStretchFactor(0, 1)   # scroll stretch — chiếm hầu hết
        body_splitter.setStretchFactor(1, 0)   # log fixed
        body_splitter.setSizes([500, 130])
        # Log panel đã có setMaximumHeight nội tại → không bị kéo dãn

        root.addWidget(body_splitter, stretch=1)
        self._body_splitter = body_splitter

        # Initial load
        self._update_path_display()
        self._reload_groups()

    # ----- Path & scan -----

    def _update_path_display(self) -> None:
        p = resolve_font_library_path(self.settings)
        if p:
            self.path_input.setText(str(p))
            self.btn_rescan.setEnabled(True)
        else:
            self.path_input.clear()
            self.btn_rescan.setEnabled(False)

    def _on_pick_folder(self) -> None:
        current = resolve_font_library_path(self.settings)
        start_dir = str(current) if current else ""
        folder = QFileDialog.getExistingDirectory(
            self,
            "Chọn folder chứa font (.ttf / .otf / .ttc)",
            start_dir,
        )
        if not folder:
            return

        path = Path(folder)
        save_font_library_path(self.settings, path)
        self._update_path_display()
        self._scan(path)

    def _on_rescan(self) -> None:
        p = resolve_font_library_path(self.settings)
        if p:
            self._scan(p)
        else:
            self.log.log_warn("⚠  Chưa có thư mục font nào được lưu.")

    def _scan(self, folder: Path) -> None:
        self.log.log_info(f"i  Bắt đầu quét thư mục: {folder}")
        try:
            self.repo.clear()
            added, total, failed = self.repo.scan_folder(folder)
        except Exception as e:
            self.log.log_error(f"❌ Quét lỗi: {e}")
            return

        if failed:
            self.log.log_warn(f"⚠  Có {failed} file font load không được (sai định dạng / hỏng).")

        self.log.log_success(
            f"✅ Quét xong: {total} file, +{added} font mới. Đang dựng danh sách…"
        )
        self._reload_groups()
        # Count total families + groups rendered
        total_families = sum(len(g._items) for g in self._card_groups)
        n_groups = len(self._card_groups)
        self.log.log_success(
            f"✅ Hoàn tất: {total_families} font, {n_groups} nhóm folder."
        )

    # ----- Rendering -----

    def _reload_groups(self) -> None:
        """Xoá toàn bộ CardGroup cũ, tạo lại từ DB theo `folder_group`.

        Phase 2: group theo folder cha (user phân loại sẵn) thay vì heuristic
        category. AutoCAD .shx được hiển thị riêng group "AutoCAD" với badge
        meta=".shx". Stripe color round-robin theo index.
        """
        # Clear old groups
        for g in self._card_groups:
            g.setParent(None)
            g.deleteLater()
        self._card_groups.clear()

        groups_meta = self.repo.list_groups()   # [(group_name, count), ...]
        if not groups_meta:
            self.empty.show()
            self.action_bar.setCounter(0)
            return

        self.empty.hide()

        # Insert CardGroups at top of scroll_layout (before stretch)
        # Layout sau khi __init__: [empty, stretch] → insert ở index 0.
        insert_idx = 0
        for idx, (group_name, _count) in enumerate(groups_meta):
            fonts = self.repo.list_by_group(group_name)
            if not fonts:
                continue

            items = []
            for f in fonts:
                # Meta badge: .shx → "SHX", có VN support → "VN"
                if f.font_kind == "autocad":
                    meta = "SHX"
                elif f.vn_support:
                    meta = "VN"
                else:
                    meta = ""
                items.append(
                    CardItem(
                        id=str(f.id),
                        label=f.family,
                        checked=False,
                        meta=meta,
                    )
                )

            group = CardGroup(
                name=group_name,
                items=items,
                icon=icon_for_group(group_name),
                stripe=stripe_for_index(idx),
                collapsed=(idx > 0),   # mở sẵn group đầu tiên
            )
            group.itemToggled.connect(self._on_item_toggled)
            group.groupToggled.connect(self._on_group_toggled)
            self.scroll_layout.insertWidget(insert_idx, group)
            self._card_groups.append(group)
            insert_idx += 1

        self._recompute_counter()

    def _on_search_changed(self, text: str) -> None:
        needle = text.strip().lower()
        if not needle:
            # Reset all items visible
            for g in self._card_groups:
                g.apply_item_filter(lambda _item: True)
            return
        for g in self._card_groups:
            g.apply_item_filter(lambda item: needle in item.label.lower())

    # ----- Selection state -----

    def _on_item_toggled(self, _item_id: str, _checked: bool) -> None:
        self._recompute_counter()

    def _on_group_toggled(self, _checked: bool) -> None:
        self._recompute_counter()

    def _select_all(self, checked: bool) -> None:
        for g in self._card_groups:
            g.select_all(checked)
        self._recompute_counter()

    def _recompute_counter(self) -> None:
        total = sum(len(g.get_checked_ids()) for g in self._card_groups)
        self._total_checked = total
        self.action_bar.setCounter(total)
        self.action_bar.setCtaLabel(
            f"⚡ Cài đặt {total} font đã chọn" if total else "⚡ Cài đặt font đã chọn"
        )

    # ----- Install -----

    def _on_install_clicked(self) -> None:
        if self._total_checked == 0:
            return

        # Lazy import để LibraryView không phụ thuộc cứng vào worker module
        from pathlib import Path as _Path

        from ..install.worker import (
            InstallTask,
            discover_autocad_dirs,
            is_admin,
            run_install_async,
        )

        # --- Pre-flight: admin check ---
        if not is_admin():
            self.log.log_error(
                "❌ Cần chạy TrishFont với quyền Administrator để cài font vào "
                "C:\\Windows\\Fonts (và C:\\Program Files\\Autodesk\\... cho .shx)."
            )
            self.log.log_info(
                "i  Đóng app → chuột phải vào file chạy (hoặc shortcut) → "
                "'Run as administrator' → mở lại TrishFont → thử lại."
            )
            return

        # Gom font đã tick → InstallTask
        ids: list[str] = []
        for g in self._card_groups:
            ids.extend(g.get_checked_ids())

        cur = self.repo.db.conn.cursor()
        placeholders = ",".join("?" * len(ids))
        rows = cur.execute(
            f"SELECT id, family, file_path, font_kind FROM fonts WHERE id IN ({placeholders})",
            [int(i) for i in ids],
        ).fetchall()

        tasks: list[InstallTask] = []
        skipped_no_path = 0
        for r in rows:
            fpath = r["file_path"] or ""
            if not fpath:
                skipped_no_path += 1
                continue
            tasks.append(
                InstallTask(
                    source=_Path(fpath),
                    family=r["family"],
                    kind=r["font_kind"] or "windows",
                )
            )

        if not tasks:
            self.log.log_warn(
                "⚠  Các font đã chọn không có file_path (DB cũ?). "
                "Bấm 'Quét lại' để cập nhật."
            )
            return

        # AutoCAD detect — log để user biết
        acad_dirs = discover_autocad_dirs()
        n_shx = sum(1 for t in tasks if t.kind == "autocad")
        n_win = len(tasks) - n_shx

        self.log.log_info(
            f"i  Bắt đầu cài: {n_win} Windows font + {n_shx} AutoCAD .shx"
        )
        if n_shx:
            if acad_dirs:
                self.log.log_info(
                    f"i  AutoCAD detect: {len(acad_dirs)} folder → "
                    + ", ".join(str(p) for p in acad_dirs)
                )
            else:
                self.log.log_warn(
                    "⚠  Không tìm thấy AutoCAD — file .shx sẽ bị skip."
                )

        # CTA disable trong khi worker chạy
        self.action_bar.setCtaEnabled(False)

        # Spawn worker — giữ ref vào self để không bị GC
        # all_users=True → C:\Windows\Fonts + HKLM registry (cần admin, đã check)
        self._install_thread, self._install_worker = run_install_async(
            tasks,
            all_users=True,
            on_progress=self._on_install_progress,
            on_file=self._on_install_file,
            on_finished=self._on_install_finished,
        )
        self.log.log_info(
            "i  Đích cài: C:\\Windows\\Fonts (font thường) + AutoCAD Fonts (.shx)."
        )

    def _on_install_progress(self, done: int, total: int) -> None:
        self.log.set_progress(done, total)

    def _on_install_file(self, result) -> None:
        """result: InstallResult."""
        name = result.task.source.name
        if result.ok:
            self.log.log_success(f"✅ {name}  →  {result.message}")
        else:
            self.log.log_error(f"❌ {name}  — {result.message}")

    def _on_install_finished(self, n_ok: int, n_fail: int) -> None:
        self.log.reset_progress()
        if n_fail == 0:
            self.log.log_success(
                f"✅ Hoàn tất: {n_ok} font cài thành công."
            )
        else:
            self.log.log_warn(
                f"⚠  Hoàn tất: {n_ok} OK, {n_fail} thất bại — xem log chi tiết."
            )
        self.action_bar.setCtaEnabled(self._total_checked > 0)
