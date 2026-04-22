"""TrishFont — entry point.

Chạy:
    python -m trishfont.app
hoặc sau khi `pip install -e .`:
    trishfont
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
    UpdateDialog,
)

# Logo resources — bundled vào package để PyInstaller bắt được
_RES_DIR = Path(__file__).resolve().parent / "resources"
LOGO_PATH = _RES_DIR / "logo-64.png"
ICO_PATH  = _RES_DIR / "app.ico"

from .modules.favorites.view import FavoritesView
from .modules.fontpack import MIGRATION_004_FONTPACKS, PackView
from .modules.install.view import InstallView
from .modules.library.models import MIGRATION_001_FONTS, MIGRATION_003_FOLDER_KIND
from .modules.library.repository import FontRepository
from .modules.library.view import LibraryView
from .modules.preview.view import PreviewView
from .modules.settings import (
    MIGRATION_002_SETTINGS,
    SettingsRepository,
    resolve_font_library_path,
)


APP_NAME = "TrishFont"
APP_VERSION = "v1.0.0"
APP_LOGO = "✨"
APP_TAGLINE = "TrishFont v1.0.0 · Quản lý font chuyên nghiệp"

log = get_logger(APP_NAME, log_dir=user_data_dir_for(APP_NAME) / "logs")


def main() -> int:
    log.info("TrishFont %s starting…", APP_VERSION)

    # --- Database setup ---
    db_path = user_data_dir_for(APP_NAME) / "data.db"
    db = Database(db_path)
    applied = migrate(db, [
        (1, MIGRATION_001_FONTS),
        (2, MIGRATION_002_SETTINGS),
        (3, MIGRATION_003_FOLDER_KIND),   # Phase 2: folder_group + file_path + font_kind
        (4, MIGRATION_004_FONTPACKS),     # Phase 5: installed_packs + manifest_cache
    ])
    log.info("DB at %s — %d migration(s) applied", db_path, applied)

    # --- UI ---
    app = QApplication(sys.argv)

    # Window + taskbar icon (Windows dùng .ico, platform khác fallback PNG)
    if ICO_PATH.is_file():
        app.setWindowIcon(QIcon(str(ICO_PATH)))
    elif LOGO_PATH.is_file():
        app.setWindowIcon(QIcon(str(LOGO_PATH)))

    win = BaseWindow(title=f"TrishFont — {APP_TAGLINE}")
    win.sidebar.set_title("TrishFont")

    # AppHeader (top) — logo + version + Update + About buttons.
    # Brand dùng HTML "Trish<b>Font</b>" (bold nửa sau), match reference TrishFont v1.0.
    header = AppHeader(
        logo_path=LOGO_PATH if LOGO_PATH.is_file() else None,
        logo_emoji=APP_LOGO,
        app_name="Trish<b>Font</b>",
        version=APP_VERSION,
        show_update=True,
        show_about=True,
        name_is_html=True,
    )
    header.updateRequested.connect(lambda: _open_update_dialog(win, lambda: win.set_current("packs")))
    header.aboutRequested.connect(lambda: _open_about_dialog(win))
    win.set_header(header)

    # FooterBar (bottom)
    footer = FooterBar(
        left_text=APP_TAGLINE,
        quick_nav=[
            ("Thư viện",   "library"),
            ("Xem trước",  "preview"),
            ("Yêu thích",  "favorites"),
            ("Cập nhật",   "packs"),
            ("Giới thiệu", "_about"),
        ],
    )
    footer.navRequested.connect(lambda route: _on_footer_nav(win, header, route))
    win.set_footer(footer)

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
    _orig_scan = library_view._scan
    def _scan_and_reload(folder):
        _orig_scan(folder)
        preview_view.reload()
    library_view._scan = _scan_and_reload  # type: ignore[assignment]

    # PackView — tab "Cập nhật": sau khi pack extract OK, rescan library để
    # font mới xuất hiện trong Library/Preview.
    def _on_pack_installed(_pack_id: str) -> None:
        p = resolve_font_library_path(settings)
        if not p:
            return
        try:
            library_view._scan(p)
        except Exception as e:
            log.warning("Post-install rescan failed: %s", e)

    pack_view = PackView(db=db, on_installed=_on_pack_installed)

    win.add_page("library",   "Thư viện",     library_view,   icon="📚")
    win.add_page("preview",   "Xem trước",    preview_view,   icon="🔤")
    win.add_page("favorites", "Yêu thích",    favorites_view, icon="⭐")
    win.add_page("install",   "Cài đặt font", InstallView(),  icon="📥")
    win.add_page("packs",     "Cập nhật",     pack_view,      icon="🔄")

    win.set_current("library")

    win.show()
    exit_code = app.exec()
    db.close()
    return exit_code


# ---------- Dialogs ----------

def _open_about_dialog(parent) -> None:
    dlg = AboutDialog(
        app_name="TrishFont",
        version=APP_VERSION,
        logo_emoji=APP_LOGO,
        parent=parent,
    )
    dlg.exec()


def _open_update_dialog(parent, open_packs_tab) -> None:
    """Open update dialog. `open_packs_tab` is a callable to switch to the
    "Cập nhật" tab where PackView lives.
    """
    dlg = UpdateDialog(current_version=APP_VERSION, parent=parent)

    # App updates — stub (chưa có auto-update). Phase sau sẽ gọi GitHub release API.
    dlg.checkAppRequested.connect(
        lambda: dlg.setAppUpdateStatus(
            f"Bạn đang dùng phiên bản mới nhất ({APP_VERSION}).",
            has_update=False,
        )
    )
    # Font-pack updates — Phase 5: hướng user sang tab "Cập nhật" (PackView)
    # có đầy đủ list + progress + SHA verify.
    dlg.checkDataRequested.connect(
        lambda: dlg.setDataUpdateStatus(
            "Mở tab 'Cập nhật' để xem danh sách gói font và tải về.",
            has_update=True,
        )
    )

    def _goto_packs() -> None:
        try:
            open_packs_tab()
        finally:
            dlg.accept()

    dlg.downloadDataRequested.connect(_goto_packs)
    dlg.exec()


def _on_footer_nav(win, header, route: str) -> None:
    if route == "_about":
        _open_about_dialog(win)
        return
    try:
        win.set_current(route)
    except Exception:
        # Tab không tồn tại → fallback library
        win.set_current("library")


if __name__ == "__main__":
    sys.exit(main())
