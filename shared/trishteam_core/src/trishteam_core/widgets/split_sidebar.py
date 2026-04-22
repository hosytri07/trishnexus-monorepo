"""SplitSidebar — layout 2 cột: tree sidebar trái + content panel phải.

Dùng cho các app có nhiều 'bucket' đồng cấp (Library: nhiều thư viện,
Design: nhiều project).

Layout:
    ┌─────────────────┬────────────────────────────────────────────┐
    │ 📚 Title        │                                            │
    │ ├ Item 1        │                                            │
    │ ├ Item 2        │           [Content panel]                  │
    │ └ Item 3        │                                            │
    │                 │                                            │
    │ [+ Thêm] [-Gỡ]  │                                            │
    └─────────────────┴────────────────────────────────────────────┘

Xem docs/design-spec.md §6.7.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from PyQt6.QtCore import Qt, pyqtSignal
from PyQt6.QtGui import QFont
from PyQt6.QtWidgets import (
    QFrame,
    QHBoxLayout,
    QLabel,
    QPushButton,
    QSplitter,
    QTreeWidget,
    QTreeWidgetItem,
    QVBoxLayout,
    QWidget,
)


@dataclass
class SidebarItem:
    """Một item trong sidebar — có thể có children (cho tree nested)."""
    id: str
    label: str
    icon: str = ""
    children: list["SidebarItem"] = field(default_factory=list)


class SplitSidebar(QSplitter):
    """Splitter 2 cột với sidebar có tree + content area tự do."""

    itemSelected = pyqtSignal(str)       # item_id
    addRequested = pyqtSignal()
    removeRequested = pyqtSignal(str)    # current selected item_id (hoặc "")

    def __init__(
        self,
        title: str = "Thư Viện",
        items: list[SidebarItem] | None = None,
        *,
        icon: str = "📚",
        show_add_remove: bool = True,
        sidebar_width: int = 240,
        parent: QWidget | None = None,
    ) -> None:
        super().__init__(Qt.Orientation.Horizontal, parent)

        # --- Sidebar (left) ---
        sidebar = QFrame()
        sidebar.setProperty("role", "sidebar")
        sb_layout = QVBoxLayout(sidebar)
        sb_layout.setContentsMargins(0, 0, 0, 0)
        sb_layout.setSpacing(0)

        # Title row
        title_row = QFrame()
        tr_layout = QHBoxLayout(title_row)
        tr_layout.setContentsMargins(16, 12, 16, 12)
        tr_layout.setSpacing(8)

        title_lbl = QLabel(f"{icon} {title}" if icon else title)
        title_font = QFont()
        title_font.setPointSize(11)
        title_font.setWeight(QFont.Weight.DemiBold)
        title_lbl.setFont(title_font)
        tr_layout.addWidget(title_lbl)
        tr_layout.addStretch(1)
        sb_layout.addWidget(title_row)

        # Tree
        self.tree = QTreeWidget()
        self.tree.setHeaderHidden(True)
        self.tree.setRootIsDecorated(True)
        self.tree.setIndentation(16)
        self.tree.setStyleSheet(
            "QTreeWidget { border: none; background: transparent; }"
            "QTreeWidget::item { padding: 4px 8px; border-radius: 6px; margin: 1px 4px; }"
            "QTreeWidget::item:hover { background: #263241; }"
            "QTreeWidget::item:selected { background: qlineargradient("
            "x1:0, y1:0, x2:1, y2:0, stop:0 #667EEA, stop:1 #764BA2); color: #FFFFFF; }"
        )
        self.tree.itemSelectionChanged.connect(self._on_selection_changed)
        sb_layout.addWidget(self.tree, stretch=1)

        # Populate items
        if items:
            self.set_items(items)

        # Action row (add/remove)
        if show_add_remove:
            action_row = QFrame()
            ar_layout = QHBoxLayout(action_row)
            ar_layout.setContentsMargins(12, 8, 12, 12)
            ar_layout.setSpacing(8)

            self.btn_add = QPushButton("+ Thêm")
            self.btn_add.setProperty("variant", "ghost")
            self.btn_add.clicked.connect(self.addRequested.emit)
            ar_layout.addWidget(self.btn_add)

            self.btn_remove = QPushButton("− Gỡ")
            self.btn_remove.setProperty("variant", "ghost")
            self.btn_remove.clicked.connect(self._on_remove_clicked)
            ar_layout.addWidget(self.btn_remove)

            ar_layout.addStretch(1)
            sb_layout.addWidget(action_row)

        self.addWidget(sidebar)

        # --- Content area (right) ---
        self.contentArea = QWidget()
        self.addWidget(self.contentArea)

        # Stretch + sizing
        self.setStretchFactor(0, 0)
        self.setStretchFactor(1, 1)
        self.setSizes([sidebar_width, 960])
        self.setCollapsible(0, False)

    # ---------- Public API ----------

    def set_items(self, items: list[SidebarItem]) -> None:
        self.tree.clear()
        for item in items:
            self.tree.addTopLevelItem(self._build_tree_item(item))
        self.tree.expandAll()

    def current_item_id(self) -> str:
        item = self.tree.currentItem()
        return item.data(0, Qt.ItemDataRole.UserRole) if item else ""

    def setContentWidget(self, widget: QWidget) -> None:
        """Thay content area bằng widget mới (thay thế, không append)."""
        # Remove old layout contents
        old_layout = self.contentArea.layout()
        if old_layout is None:
            layout = QVBoxLayout(self.contentArea)
            layout.setContentsMargins(0, 0, 0, 0)
        else:
            # Clear existing widgets
            while old_layout.count():
                item = old_layout.takeAt(0)
                w = item.widget()
                if w is not None:
                    w.setParent(None)
            layout = old_layout
        layout.addWidget(widget)

    # ---------- Internal ----------

    def _build_tree_item(self, item: SidebarItem) -> QTreeWidgetItem:
        label = f"{item.icon} {item.label}" if item.icon else item.label
        ti = QTreeWidgetItem([label])
        ti.setData(0, Qt.ItemDataRole.UserRole, item.id)
        for child in item.children:
            ti.addChild(self._build_tree_item(child))
        return ti

    def _on_selection_changed(self) -> None:
        item_id = self.current_item_id()
        if item_id:
            self.itemSelected.emit(item_id)

    def _on_remove_clicked(self) -> None:
        self.removeRequested.emit(self.current_item_id())
