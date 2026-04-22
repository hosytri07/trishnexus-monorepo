"""Favorites view — extend LibraryView với filter chỉ hiện font favorite.

Tái dùng LibraryView, bật cờ _only_favorite = True, ẩn control scan/path.
"""

from __future__ import annotations

from PyQt6.QtWidgets import QLabel, QWidget

from trishteam_core.store import Database

from ..library.view import LibraryView


class FavoritesView(LibraryView):
    def __init__(self, db: Database, parent: QWidget | None = None) -> None:
        super().__init__(db, parent)
        self._only_favorite = True

        # Đổi title + ẩn control scan/folder (không cần ở favorites)
        # Item đầu tiên trong layout là title QLabel
        title_lbl = self.layout().itemAt(0).widget()
        if isinstance(title_lbl, QLabel):
            title_lbl.setText("⭐ Font yêu thích")

        self.btn_pick.hide()
        self.btn_rescan.hide()
        self.filter_vn.hide()
        self.path_row.hide()

        self._refresh()
