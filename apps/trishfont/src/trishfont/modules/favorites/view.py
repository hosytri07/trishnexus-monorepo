"""Favorites view — chỉ hiện font đã đánh dấu yêu thích.

Kế thừa LibraryView cho layout đồng nhất (InlineToolbar, CardGroup, LogPanel)
nhưng override để:
- Chỉ load font có `favorite=1`.
- Ẩn path picker (không cần chọn folder — dùng chung repo với Library).
- Giữ search + log để filter và báo trạng thái.

Phase 2 update: dùng folder-based grouping (icon_for_group + stripe_for_index)
như LibraryView mới — không còn 4 hardcoded categories.
"""

from __future__ import annotations

from PyQt6.QtWidgets import QWidget

from trishteam_core.store import Database
from trishteam_core.widgets import CardGroup, CardItem

from ..library.models import icon_for_group, stripe_for_index
from ..library.view import LibraryView


class FavoritesView(LibraryView):
    """Variant chỉ hiển thị font favorite."""

    def __init__(self, db: Database, parent: QWidget | None = None) -> None:
        super().__init__(db, parent)

        # Ẩn path picker + action bar install ở tab Favorites.
        # Layout root: [path_toolbar, search_toolbar, action_bar, body_splitter]
        root_layout = self.layout()
        if root_layout is not None and root_layout.count() >= 3:
            path_tb = root_layout.itemAt(0).widget()
            action_bar = root_layout.itemAt(2).widget()
            if path_tb is not None:
                path_tb.hide()
            if action_bar is not None:
                action_bar.hide()

        # Customize empty state cho tab này
        self.empty.setTitle("Chưa có font yêu thích")
        self.empty.setSubtitle(
            "Ở tab Xem trước, bấm ★ để đánh dấu font yêu thích."
        )

        # Re-render với filter favorite (super đã gọi 1 lần với all fonts)
        self._reload_groups()

    # ---------- Override ----------

    def _reload_groups(self) -> None:  # type: ignore[override]
        """Folder-based grouping nhưng chỉ font favorite=1."""
        for g in self._card_groups:
            g.setParent(None)
            g.deleteLater()
        self._card_groups.clear()

        fonts = self.repo.list_all(only_favorite=True)
        if not fonts:
            self.empty.show()
            return
        self.empty.hide()

        # Group theo folder_group (rỗng → '(Root)')
        by_group: dict[str, list] = {}
        for f in fonts:
            key = f.folder_group or "(Root)"
            by_group.setdefault(key, []).append(f)

        # Sort: '(Root)' trước, còn lại alpha
        ordered_keys = sorted(
            by_group.keys(),
            key=lambda k: (k != "(Root)", k.lower()),
        )

        insert_idx = 0
        for idx, key in enumerate(ordered_keys):
            bucket = by_group[key]
            items = []
            for f in bucket:
                if f.font_kind == "autocad":
                    meta = "SHX"
                elif f.vn_support:
                    meta = "VN"
                else:
                    meta = ""
                items.append(
                    CardItem(id=str(f.id), label=f.family, meta=meta)
                )
            group = CardGroup(
                name=key,
                items=items,
                icon=icon_for_group(key),
                stripe=stripe_for_index(idx),
                collapsed=False,   # ít font → mở hết
            )
            self.scroll_layout.insertWidget(insert_idx, group)
            self._card_groups.append(group)
            insert_idx += 1
