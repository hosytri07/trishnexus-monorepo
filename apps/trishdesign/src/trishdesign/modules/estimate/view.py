"""Estimate view — UI lập dự toán công trình TT11/2021.

Layout 3-panel:
    ┌──────────────┬─────────────────────────────┬────────────────┐
    │ Projects     │ Work items table            │ Summary card   │
    │ (list)       │ (+ toolbar add/edit/delete) │ (T, GT, TL,    │
    │              │                             │  VAT, G_xd)    │
    └──────────────┴─────────────────────────────┴────────────────┘
"""

from __future__ import annotations

from PyQt6.QtCore import Qt
from PyQt6.QtWidgets import (
    QHBoxLayout,
    QHeaderView,
    QLabel,
    QListWidget,
    QPushButton,
    QTableWidget,
    QTableWidgetItem,
    QVBoxLayout,
    QWidget,
)

from trishteam_core.widgets import Card, EmptyState


def _fmt_vnd(v: float) -> str:
    """12345678 → '12.345.678 ₫'"""
    return f"{int(round(v)):,}".replace(",", ".") + " ₫"


class SummaryCard(Card):
    """Card tổng hợp chi phí bên phải."""

    def __init__(self) -> None:
        super().__init__()
        body = self.layout_body()

        title = QLabel("Tổng hợp dự toán")
        title.setStyleSheet("font-size: 16px; font-weight: 700;")
        body.addWidget(title)

        # Các dòng (label, key)
        self._labels: dict[str, QLabel] = {}
        rows = [
            ("T",     "Chi phí trực tiếp"),
            ("GT",    "Chi phí gián tiếp (6.5%)"),
            ("TL",    "TN chịu thuế (5.5%)"),
            ("NT",    "Nhà tạm (1%)"),
            ("VAT",   "Thuế GTGT (10%)"),
        ]
        for key, label in rows:
            row = QHBoxLayout()
            lbl = QLabel(label)
            lbl.setStyleSheet("color: #4B5563;")
            val = QLabel("—")
            val.setAlignment(Qt.AlignmentFlag.AlignRight)
            # Dùng font monospace để số thẳng hàng (QSS không có font-variant-numeric)
            val.setStyleSheet("font-family: 'JetBrains Mono', 'Consolas', monospace;")
            row.addWidget(lbl)
            row.addWidget(val, stretch=1)
            body.addLayout(row)
            self._labels[key] = val

        # Divider
        sep = QLabel()
        sep.setFixedHeight(1)
        sep.setStyleSheet("background-color: #E5E7EB;")
        body.addWidget(sep)

        # Grand total
        grand_row = QHBoxLayout()
        lbl_g = QLabel("G_xd")
        lbl_g.setStyleSheet("font-weight: 700; font-size: 18px;")
        self._labels["G_xd"] = QLabel("—")
        self._labels["G_xd"].setAlignment(Qt.AlignmentFlag.AlignRight)
        self._labels["G_xd"].setStyleSheet(
            "font-weight: 700; font-size: 18px; color: #667EEA;"
        )
        grand_row.addWidget(lbl_g)
        grand_row.addWidget(self._labels["G_xd"], stretch=1)
        body.addLayout(grand_row)

    def update_summary(self, summary) -> None:
        self._labels["T"].setText(_fmt_vnd(summary.T))
        self._labels["GT"].setText(_fmt_vnd(summary.GT))
        self._labels["TL"].setText(_fmt_vnd(summary.TL))
        self._labels["NT"].setText(_fmt_vnd(summary.NT))
        self._labels["VAT"].setText(_fmt_vnd(summary.VAT))
        self._labels["G_xd"].setText(_fmt_vnd(summary.G_xd))


class WorkItemTable(QTableWidget):
    HEADERS = ["STT", "Hạng mục", "Mã hiệu", "ĐVT", "KL", "Đơn giá", "Thành tiền"]

    def __init__(self) -> None:
        super().__init__(0, len(self.HEADERS))
        self.setHorizontalHeaderLabels(self.HEADERS)
        self.setAlternatingRowColors(True)
        self.verticalHeader().setVisible(False)
        h = self.horizontalHeader()
        h.setSectionResizeMode(1, QHeaderView.ResizeMode.Stretch)
        for i in (0, 2, 3, 4, 5, 6):
            h.setSectionResizeMode(i, QHeaderView.ResizeMode.ResizeToContents)

    def render_items(self, items: list) -> None:
        self.setRowCount(len(items))
        for r, w in enumerate(items):
            cells = [
                str(w.order),
                w.description_override or w.unit_price_code,
                w.unit_price_code,
                w.snapshot_unit,
                f"{w.quantity:,.3f}",
                _fmt_vnd(w.unit_total),
                _fmt_vnd(w.total_cost),
            ]
            for c, txt in enumerate(cells):
                item = QTableWidgetItem(txt)
                if c in (4, 5, 6):
                    item.setTextAlignment(Qt.AlignmentFlag.AlignRight | Qt.AlignmentFlag.AlignVCenter)
                self.setItem(r, c, item)


class EstimateView(QWidget):
    def __init__(self, parent: QWidget | None = None) -> None:
        super().__init__(parent)

        root = QHBoxLayout(self)
        root.setContentsMargins(20, 20, 20, 20)
        root.setSpacing(16)

        # --- Left: project list ---
        left = QWidget()
        left.setFixedWidth(220)
        left_layout = QVBoxLayout(left)
        left_layout.setContentsMargins(0, 0, 0, 0)

        title = QLabel("Dự toán")
        title.setStyleSheet("font-size: 22px; font-weight: 700;")
        left_layout.addWidget(title)

        self.project_list = QListWidget()
        left_layout.addWidget(self.project_list, stretch=1)

        self.btn_new = QPushButton("+ Dự án mới")
        left_layout.addWidget(self.btn_new)

        root.addWidget(left)

        # --- Center: work items ---
        center = QWidget()
        center_layout = QVBoxLayout(center)
        center_layout.setContentsMargins(0, 0, 0, 0)

        toolbar = QHBoxLayout()
        self.btn_add = QPushButton("+ Hạng mục")
        self.btn_remove = QPushButton("− Xoá")
        self.btn_remove.setProperty("variant", "ghost")
        self.btn_export = QPushButton("Xuất Excel/Word")
        self.btn_export.setProperty("variant", "ghost")
        toolbar.addWidget(self.btn_add)
        toolbar.addWidget(self.btn_remove)
        toolbar.addStretch(1)
        toolbar.addWidget(self.btn_export)
        center_layout.addLayout(toolbar)

        self.table = WorkItemTable()
        center_layout.addWidget(self.table, stretch=1)

        # Empty state placeholder khi chưa có project
        self.empty = EmptyState(
            icon="💰",
            title="Chưa có dự án dự toán",
            subtitle='Bấm "+ Dự án mới" để tạo công trình đầu tiên theo TT11/2021.',
        )
        center_layout.addWidget(self.empty)
        self.table.hide()

        root.addWidget(center, stretch=1)

        # --- Right: summary ---
        self.summary_card = SummaryCard()
        self.summary_card.setFixedWidth(280)
        root.addWidget(self.summary_card)
