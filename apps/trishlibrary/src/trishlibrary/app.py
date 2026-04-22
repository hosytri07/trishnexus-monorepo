"""TrishLibrary — entry point placeholder.

App này đang ở giai đoạn coming-soon. Đã có logo + scaffold để chạy được
smoke-test và xuất hiện nhất quán trong TrishLauncher.

Chạy:
    python -m trishlibrary.app
"""

from __future__ import annotations

import sys
from pathlib import Path

from PyQt6.QtCore import Qt
from PyQt6.QtGui import QIcon
from PyQt6.QtWidgets import QApplication, QLabel, QVBoxLayout, QWidget

from trishteam_core.ui import BaseWindow
from trishteam_core.utils import get_logger, user_data_dir_for
from trishteam_core.widgets import AppHeader


APP_NAME = "TrishLibrary"
APP_VERSION = "v0.1.0"
APP_TAGLINE = "Quản lý thư viện file, link, ghi chú"
APP_LOGO = "📚"

_RES_DIR = Path(__file__).resolve().parent / "resources"
LOGO_PATH = _RES_DIR / "logo-64.png"
ICO_PATH  = _RES_DIR / "app.ico"

log = get_logger(APP_NAME, log_dir=user_data_dir_for(APP_NAME) / "logs")


def _coming_soon_page() -> QWidget:
    w = QWidget()
    layout = QVBoxLayout(w)
    layout.setContentsMargins(40, 60, 40, 60)
    layout.setSpacing(16)

    title = QLabel(f"{APP_NAME} — coming soon")
    title.setAlignment(Qt.AlignmentFlag.AlignCenter)
    title.setStyleSheet(
        "color: #f5f2ed; font-size: 22px; font-weight: 700; "
        "background: transparent;"
    )
    layout.addWidget(title)

    sub = QLabel(APP_TAGLINE)
    sub.setAlignment(Qt.AlignmentFlag.AlignCenter)
    sub.setStyleSheet("color: #a09890; font-size: 13px; background: transparent;")
    sub.setWordWrap(True)
    layout.addWidget(sub)

    hint = QLabel(
        "Module đang được phát triển. Logo + scaffold đã sẵn sàng — "
        "chi tiết xem docs/ROADMAP.md."
    )
    hint.setAlignment(Qt.AlignmentFlag.AlignCenter)
    hint.setStyleSheet("color: #7c7670; font-size: 12px; background: transparent;")
    hint.setWordWrap(True)
    layout.addWidget(hint)
    layout.addStretch(1)
    return w


def main() -> int:
    log.info("%s %s starting…", APP_NAME, APP_VERSION)
    app = QApplication(sys.argv)

    if ICO_PATH.is_file():
        app.setWindowIcon(QIcon(str(ICO_PATH)))
    elif LOGO_PATH.is_file():
        app.setWindowIcon(QIcon(str(LOGO_PATH)))

    win = BaseWindow(title=f"{APP_NAME} — {APP_TAGLINE}")
    win.sidebar.set_title(APP_NAME)

    header = AppHeader(
        logo_path=LOGO_PATH if LOGO_PATH.is_file() else None,
        logo_emoji=APP_LOGO,
        app_name="Trish<b>Library</b>",
        version=APP_VERSION,
        show_update=False,
        show_about=False,
        name_is_html=True,
    )
    win.set_header(header)

    win.add_page("home", "Trang chủ", _coming_soon_page(), icon="🏠")
    win.set_current("home")
    win.show()
    return app.exec()


if __name__ == "__main__":
    sys.exit(main())
