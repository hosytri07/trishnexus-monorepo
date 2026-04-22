"""Preview view — compact font list, mỗi item render tên font bằng typeface của nó.

Đơn giản hoá từ split layout cũ (có panel phải) → chỉ còn font list duy nhất.
Mỗi row hiển thị tên font rendered bằng chính font file đó (preview-by-name).
Font chưa install hệ thống → load qua `QFontDatabase.addApplicationFont` để
Qt biết typeface. `.shx` (AutoCAD) không preview được → hiển thị badge "SHX"
trong tên font, typeface giữ default.

Lợi ích:
- Không cần logic preview đồ họa phức tạp.
- 1000+ font vẫn scroll nhanh vì mỗi item chỉ là QListWidgetItem text.
- Font load lazy khi item scroll vào view (lazy batch).
"""

from __future__ import annotations

from pathlib import Path

from PyQt6.QtCore import Qt
from PyQt6.QtGui import QFont, QFontDatabase
from PyQt6.QtWidgets import (
    QHBoxLayout,
    QLabel,
    QListWidget,
    QListWidgetItem,
    QVBoxLayout,
    QWidget,
)

from trishteam_core.store import Database
from trishteam_core.widgets import EmptyState

from ..library.models import Font
from ..library.repository import FontRepository


class PreviewView(QWidget):
    """List view — mỗi row là 1 tên font rendered bằng typeface đó."""

    def __init__(self, db: Database, parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self.repo = FontRepository(db)

        # family (DB) → list[family_qt] sau khi addApplicationFont load.
        # Cache để khỏi load lại file.
        self._loaded_families: dict[str, list[str]] = {}

        root = QVBoxLayout(self)
        root.setContentsMargins(20, 20, 20, 20)
        root.setSpacing(10)

        # --- Title ---
        title = QLabel("Xem trước font")
        title.setStyleSheet(
            "font-size: 20px; font-weight: 700; background: transparent; border: none;"
        )
        root.addWidget(title)

        subtitle = QLabel("Mỗi dòng là tên font hiển thị bằng chính font đó.")
        subtitle.setStyleSheet(
            "color: #9CA3AF; font-size: 11px; background: transparent; border: none;"
        )
        root.addWidget(subtitle)

        # --- Font list: compact, 1 row = 1 item ---
        self.font_list = QListWidget()
        self.font_list.setStyleSheet(
            "QListWidget { background: transparent; border: 1px solid #2a2722; "
            "border-radius: 6px; padding: 2px; }"
            "QListWidget::item { padding: 3px 10px; border: none; }"
            "QListWidget::item:selected { background: rgba(139,92,246,0.25); "
            "color: #f5f2ed; border-radius: 3px; }"
            "QListWidget::item:hover:!selected { background: rgba(255,255,255,0.04); }"
        )
        self.font_list.setUniformItemSizes(True)
        self.font_list.setSpacing(0)
        # Lazy load typeface khi scroll
        self.font_list.verticalScrollBar().valueChanged.connect(self._on_scroll)
        root.addWidget(self.font_list, stretch=1)

        # --- Empty state ---
        self.empty = EmptyState(
            icon="🔤",
            title="Chưa có font nào để preview",
            subtitle='Vào "Thư viện" để chọn folder & scan font trước.',
        )
        root.addWidget(self.empty)

        self.reload()

    # ----- Public API -----

    def reload(self) -> None:
        """Load font list từ DB. Gọi lại sau khi scan xong."""
        fonts = self.repo.list_all()
        self.font_list.clear()

        if not fonts:
            self.font_list.hide()
            self.empty.show()
            return

        self.empty.hide()
        self.font_list.show()

        for f in fonts:
            if f.font_kind == "autocad":
                # .shx không preview được — chỉ hiện tên + badge SHX, font default
                label_text = f"{f.family}   · SHX (AutoCAD)"
            else:
                label_text = f.family
            item = QListWidgetItem(label_text)
            # Lưu Font object để lazy load sau
            item.setData(Qt.ItemDataRole.UserRole, f)
            # Đặt font size nhỏ hơn (10pt) — sẽ update typeface sau khi load file
            preview_font = QFont()
            preview_font.setPointSize(10)
            item.setFont(preview_font)
            self.font_list.addItem(item)

        # Load typeface cho batch đầu tiên (những item hiện trên viewport)
        self._load_visible_items()

    # ----- Lazy typeface load -----

    def _on_scroll(self, *_args) -> None:
        self._load_visible_items()

    def _load_visible_items(self) -> None:
        """Load typeface cho item đang hiển thị trong viewport (lazy)."""
        vp = self.font_list.viewport()
        if vp is None:
            return
        count = self.font_list.count()
        for i in range(count):
            item = self.font_list.item(i)
            if item is None:
                continue
            rect = self.font_list.visualItemRect(item)
            # Chỉ load item nằm trong (hoặc gần) viewport
            if rect.bottom() < -50 or rect.top() > vp.height() + 50:
                continue
            f = item.data(Qt.ItemDataRole.UserRole)
            if not isinstance(f, Font):
                continue
            # Skip nếu đã load
            if f.family in self._loaded_families:
                qt_families = self._loaded_families[f.family]
                if qt_families:
                    qf = QFont(qt_families[0])
                    qf.setPointSize(10)
                    item.setFont(qf)
                continue
            # Skip .shx (không render được)
            if f.font_kind == "autocad" or not f.file_path:
                self._loaded_families[f.family] = []
                continue
            path = Path(f.file_path)
            if not path.is_file():
                self._loaded_families[f.family] = []
                continue
            font_id = QFontDatabase.addApplicationFont(str(path))
            if font_id < 0:
                self._loaded_families[f.family] = []
                continue
            qt_families = QFontDatabase.applicationFontFamilies(font_id)
            self._loaded_families[f.family] = qt_families
            if qt_families:
                qf = QFont(qt_families[0])
                qf.setPointSize(10)
                item.setFont(qf)
