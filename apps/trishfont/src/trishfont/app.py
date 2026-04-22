"""TrishFont — entry point.

Chạy:
    python -m trishfont.app
hoặc sau khi `pip install -e .`:
    trishfont
"""

from __future__ import annotations

import sys

from PyQt6.QtWidgets import QApplication

from trishteam_core.ui import BaseWindow
from trishteam_core.store import Database, migrate
from trishteam_core.utils import get_logger, user_data_dir_for

from .modules.preview.view import PreviewView
from .modules.library.view import LibraryView
from .modules.library.models import MIGRATION_001_FONTS
from .modules.library.repository import FontRepository
from .modules.favorites.view import FavoritesView
from .modules.install.view import InstallView
from .modules.settings import (
    MIGRATION_002_SETTINGS,
    SettingsRepository,
    resolve_font_library_path,
)


APP_NAME = "TrishFont"
log = get_logger(APP_NAME, log_dir=user_data_dir_for(APP_NAME) / "logs")


def main() -> int:
    log.info("TrishFont v0.1 starting…")

    # --- Database setup ---
    db_path = user_data_dir_for(APP_NAME) / "data.db"
    db = Database(db_path)
    applied = migrate(db, [
        (1, MIGRATION_001_FONTS),
        (2, MIGRATION_002_SETTINGS),
    ])
    log.info("DB at %s — %d migration(s) applied", db_path, applied)

    # --- UI ---
    app = QApplication(sys.argv)
    win = BaseWindow(title="TrishFont — Font Library")
    win.sidebar.set_title("TrishFont")

    # Auto-scan font library nếu path đã được lưu (startup hydration)
    settings = SettingsRepository(db)
    saved_path = resolve_font_library_path(settings)
    if saved_path:
        try:
            repo = FontRepository(db)
            added, total, failed = repo.scan_folder(saved_path)
            log.info(
                "Auto-scan %s: %d file, +%d font mới, %d lỗi",
                saved_path, total, added, failed,
            )
        except Exception as e:
            log.warning("Auto-scan failed: %s", e)

    # Shared DB injected vào các view cần nó
    preview_view = PreviewView(db=db)
    library_view = LibraryView(db=db)
    favorites_view = FavoritesView(db=db)

    # Rescan từ library → reload preview list
    # Hook đơn giản: mỗi lần library scan xong thì preview_view.reload()
    _orig_scan = library_view._scan
    def _scan_and_reload(folder):
        _orig_scan(folder)
        preview_view.reload()
    library_view._scan = _scan_and_reload  # type: ignore[assignment]

    win.add_page("preview",   "Preview",      preview_view,   icon="🔤")
    win.add_page("library",   "Thư viện",     library_view,   icon="📚")
    win.add_page("favorites", "Yêu thích",    favorites_view, icon="⭐")
    win.add_page("install",   "Cài đặt font", InstallView(),  icon="📥")

    win.show()
    exit_code = app.exec()
    db.close()
    return exit_code


if __name__ == "__main__":
    sys.exit(main())
