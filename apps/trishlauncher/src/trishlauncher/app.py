"""TrishLauncher — entry point.

Hub app cho TrishNexus suite. Hiển thị 6 app cards với version, screenshot,
changelog, và button Tải/Cập nhật. Auto-install — không bao giờ mở browser.

Chạy:
    python -m trishlauncher.app
"""

from __future__ import annotations

import sys
from pathlib import Path

from PyQt6.QtGui import QIcon
from PyQt6.QtWidgets import QApplication

from trishteam_core.store import Database, migrate
from trishteam_core.ui import BaseWindow
from trishteam_core.utils import get_logger, user_data_dir_for
from trishteam_core.widgets import (
    AboutDialog,
    AppHeader,
    FooterBar,
)

from .modules.registry import MIGRATION_001_LAUNCHER, RegistryRepository
from .ui.hub_view import HubView


APP_NAME = "TrishLauncher"
APP_VERSION = "v0.1.0"
APP_LOGO = "🚀"
APP_TAGLINE = "TrishLauncher v0.1.0 · Hub trung tâm cho TrishNexus suite"

# Logo resources — bundled vào package
_RES_DIR = Path(__file__).resolve().parent / "resources"
LOGO_PATH = _RES_DIR / "logo-64.png"
ICO_PATH  = _RES_DIR / "app.ico"


log = get_logger(APP_NAME, log_dir=user_data_dir_for(APP_NAME) / "logs")


def main() -> int:
    log.info("TrishLauncher %s starting…", APP_VERSION)

    # --- Database ---
    db_path = user_data_dir_for(APP_NAME) / "data.db"
    db = Database(db_path)
    applied = migrate(db, [
        (1, MIGRATION_001_LAUNCHER),
    ])
    log.info("DB at %s — %d migration(s) applied", db_path, applied)

    registry = RegistryRepository(db)

    # --- UI ---
    app = QApplication(sys.argv)

    if ICO_PATH.is_file():
        app.setWindowIcon(QIcon(str(ICO_PATH)))
    elif LOGO_PATH.is_file():
        app.setWindowIcon(QIcon(str(LOGO_PATH)))

    win = BaseWindow(title=f"TrishLauncher — {APP_TAGLINE}")
    win.sidebar.set_title("TrishLauncher")

    header = AppHeader(
        logo_path=LOGO_PATH if LOGO_PATH.is_file() else None,
        logo_emoji=APP_LOGO,
        app_name="Trish<b>Launcher</b>",
        version=APP_VERSION,
        show_update=False,        # launcher tự update qua channel khác
        show_about=True,
        name_is_html=True,
    )
    header.aboutRequested.connect(lambda: _open_about(win))
    win.set_header(header)

    footer = FooterBar(
        left_text=APP_TAGLINE,
        quick_nav=[
            ("Tất cả",     "all"),
            ("Đã cài",      "installed"),
            ("Có cập nhật", "updates"),
            ("Giới thiệu",  "_about"),
        ],
    )
    footer.navRequested.connect(lambda r: _on_footer_nav(win, hub_view, r))
    win.set_footer(footer)

    hub_view = HubView(db=db, registry=registry)

    win.add_page("all",        "Tất cả",      hub_view,           icon="📦")
    win.add_page("installed",  "Đã cài",      hub_view.installed_only_proxy(), icon="✅")
    win.add_page("updates",    "Có cập nhật", hub_view.updates_only_proxy(),   icon="🔄")

    win.set_current("all")

    win.show()
    exit_code = app.exec()
    db.close()
    return exit_code


def _open_about(parent) -> None:
    dlg = AboutDialog(
        app_name="TrishLauncher",
        version=APP_VERSION,
        logo_emoji=APP_LOGO,
        parent=parent,
    )
    dlg.exec()


def _on_footer_nav(win, hub_view, route: str) -> None:
    if route == "_about":
        _open_about(win)
        return
    try:
        win.set_current(route)
    except Exception:
        win.set_current("all")


if __name__ == "__main__":
    sys.exit(main())
