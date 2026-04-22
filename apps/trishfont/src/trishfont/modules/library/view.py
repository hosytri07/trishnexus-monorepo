"""Library view — table, search, filter, favorite toggle.

User workflow:
1. Bấm "📁 Chọn folder & scan" → chọn folder chứa font → scan
2. Folder được lưu vào SQLite settings → lần sau tự nhớ
3. Bấm "🔄 Scan lại" để refresh (khi thêm font mới vào folder)
"""

from __future__ import annotations

from pathlib import Path

from PyQt6.QtCore import Qt
from PyQt6.QtGui import QFont
from PyQt6.QtWidgets import (
    QCheckBox,
    QFileDialog,
    QHBoxLayout,
    QHeaderView,
    QLabel,
    QLineEdit,
    QPushButton,
    QTableWidget,
    QTableWidgetItem,
    QVBoxLayout,
    QWidget,
)

from trishteam_core.store import Database
from trishteam_core.widgets import EmptyState

from ..settings import (
    SettingsRepository,
    resolve_font_library_path,
    save_font_library_path,
)
from .repository import FontRepository


CATEGORY_LABEL = {
    "sans_serif": "Sans Serif",
    "serif":      "Serif",
    "mono":       "Monospace",
    "display":    "Display",
}


class LibraryView(QWidget):
    HEADERS = ["Font", "Loại", "VN", "★"]

    def __init__(self, db: Database, parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self.repo = FontRepository(db)
        self.settings = SettingsRepository(db)

        root = QVBoxLayout(self)
        root.setContentsMargins(20, 20, 20, 20)
        root.setSpacing(12)

        # --- Title ---
        title = QLabel("Thư viện Font")
        title.setStyleSheet("font-size: 22px; font-weight: 700;")
        root.addWidget(title)

        # --- Path display row (wrapped trong 1 widget để dễ show/hide) ---
        self.path_row = QWidget()
        path_row_layout = QHBoxLayout(self.path_row)
        path_row_layout.setContentsMargins(0, 0, 0, 0)
        path_icon = QLabel("📁")
        path_row_layout.addWidget(path_icon)
        self.path_lbl = QLabel("(chưa chọn folder)")
        self.path_lbl.setStyleSheet("color: #9CA3AF; font-size: 12px;")
        self.path_lbl.setWordWrap(True)
        path_row_layout.addWidget(self.path_lbl, stretch=1)
        root.addWidget(self.path_row)

        # --- Toolbar ---
        toolbar = QHBoxLayout()

        self.search = QLineEdit()
        self.search.setPlaceholderText("Tìm font theo tên…")
        self.search.textChanged.connect(self._refresh)
        toolbar.addWidget(self.search, stretch=3)

        self.filter_vn = QCheckBox("Hỗ trợ Tiếng Việt")
        self.filter_vn.stateChanged.connect(self._refresh)
        toolbar.addWidget(self.filter_vn)

        self.btn_pick = QPushButton("📁 Chọn folder & scan")
        self.btn_pick.clicked.connect(self._on_pick_folder)
        toolbar.addWidget(self.btn_pick)

        self.btn_rescan = QPushButton("🔄 Scan lại")
        self.btn_rescan.clicked.connect(self._on_rescan)
        toolbar.addWidget(self.btn_rescan)

        root.addLayout(toolbar)

        # --- Table ---
        self.table = QTableWidget(0, len(self.HEADERS))
        self.table.setHorizontalHeaderLabels(self.HEADERS)
        self.table.setAlternatingRowColors(True)
        self.table.verticalHeader().setVisible(False)
        self.table.setEditTriggers(QTableWidget.EditTrigger.NoEditTriggers)
        self.table.setSelectionBehavior(QTableWidget.SelectionBehavior.SelectRows)
        h = self.table.horizontalHeader()
        h.setSectionResizeMode(0, QHeaderView.ResizeMode.Stretch)
        for i in (1, 2, 3):
            h.setSectionResizeMode(i, QHeaderView.ResizeMode.ResizeToContents)
        self.table.cellClicked.connect(self._on_cell_clicked)
        root.addWidget(self.table, stretch=1)

        # --- Empty state ---
        self.empty = EmptyState(
            icon="🔤",
            title="Chưa có font nào",
            subtitle='Bấm "📁 Chọn folder & scan" để trỏ đến thư mục chứa font.',
        )
        root.addWidget(self.empty)

        # Load saved folder + update path label
        self._update_path_label()
        self._refresh()

    # ----- Path & scan -----

    def _update_path_label(self) -> None:
        p = resolve_font_library_path(self.settings)
        if p:
            self.path_lbl.setText(str(p))
            self.path_lbl.setStyleSheet("color: #D1D5DB; font-size: 12px;")
            self.btn_rescan.setEnabled(True)
        else:
            self.path_lbl.setText("(chưa chọn folder)")
            self.path_lbl.setStyleSheet("color: #9CA3AF; font-size: 12px; font-style: italic;")
            self.btn_rescan.setEnabled(False)

    def _on_pick_folder(self) -> None:
        # Start point: folder đã lưu hoặc home
        current = resolve_font_library_path(self.settings)
        start_dir = str(current) if current else ""

        folder = QFileDialog.getExistingDirectory(
            self,
            "Chọn folder chứa font (.ttf / .otf)",
            start_dir,
        )
        if not folder:
            return

        path = Path(folder)
        save_font_library_path(self.settings, path)
        self._update_path_label()
        self._scan(path)

    def _on_rescan(self) -> None:
        p = resolve_font_library_path(self.settings)
        if p:
            self._scan(p)

    def _scan(self, folder: Path) -> None:
        # Clear old records trước khi scan folder mới — tránh stale data
        self.repo.clear()
        added, total, failed = self.repo.scan_folder(folder)

        msg = f"Đã scan {total} file → thêm {added} font"
        if failed:
            msg += f" ({failed} file lỗi)"
        self.btn_rescan.setToolTip(msg)
        self.path_lbl.setToolTip(msg)

        self._refresh()

    # ----- Filters & data -----

    def _current_filters(self) -> dict:
        return {
            "search": self.search.text().strip(),
            "only_vn": self.filter_vn.isChecked(),
            "only_favorite": getattr(self, "_only_favorite", False),
        }

    def _refresh(self) -> None:
        fonts = self.repo.list_all(**self._current_filters())
        self._render(fonts)

    # ----- Rendering -----

    def _render(self, fonts: list) -> None:
        if not fonts:
            self.table.hide()
            self.empty.show()
            return

        self.empty.hide()
        self.table.show()
        self.table.setRowCount(len(fonts))

        for r, f in enumerate(fonts):
            # Tên font (hiển thị bằng chính font đó)
            name_item = QTableWidgetItem(f.family)
            preview_font = QFont(f.family)
            preview_font.setPointSize(14)
            name_item.setFont(preview_font)
            name_item.setData(Qt.ItemDataRole.UserRole, f.id)
            self.table.setItem(r, 0, name_item)

            # Category
            cat_item = QTableWidgetItem(CATEGORY_LABEL.get(f.category, f.category))
            self.table.setItem(r, 1, cat_item)

            # VN support
            vn_item = QTableWidgetItem("✓" if f.vn_support else "")
            vn_item.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
            self.table.setItem(r, 2, vn_item)

            # Favorite
            fav_item = QTableWidgetItem("★" if f.favorite else "☆")
            fav_item.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
            fav_item.setData(Qt.ItemDataRole.UserRole, f.id)
            self.table.setItem(r, 3, fav_item)

    # ----- Interaction -----

    def _on_cell_clicked(self, row: int, col: int) -> None:
        if col != 3:  # chỉ cột ★ là toggle
            return
        item = self.table.item(row, col)
        font_id = item.data(Qt.ItemDataRole.UserRole)
        if font_id is None:
            return
        self.repo.toggle_favorite(int(font_id))
        self._refresh()
