"""TrishDesign — entry point.

Chạy:
    python -m trishdesign.app
hoặc sau khi `pip install -e .`:
    trishdesign
"""

from __future__ import annotations

import sys
from pathlib import Path

from PyQt6.QtGui import QIcon
from PyQt6.QtWidgets import QApplication, QLabel, QVBoxLayout, QWidget

from trishteam_core.ui import BaseWindow
from trishteam_core.utils import get_logger, user_data_dir_for
from trishteam_core.widgets import AppHeader

from .modules.dashboard.view import DashboardView
from .modules.library.view import LibraryView
from .modules.template_library.view import TemplateLibraryView
from .modules.estimate.view import EstimateView


APP_NAME = "TrishDesign"
APP_VERSION = "v0.1.0"
log = get_logger(APP_NAME, log_dir=user_data_dir_for(APP_NAME) / "logs")

_RES_DIR = Path(__file__).resolve().parent / "resources"
LOGO_PATH = _RES_DIR / "logo-64.png"
ICO_PATH  = _RES_DIR / "app.ico"


def _placeholder(text: str) -> QWidget:
    w = QWidget()
    layout = QVBoxLayout(w)
    lbl = QLabel(text)
    lbl.setStyleSheet("font-size: 20px; padding: 40px;")
    layout.addWidget(lbl)
    return w


def main() -> int:
    log.info("TrishDesign starting…")
    app = QApplication(sys.argv)

    if ICO_PATH.is_file():
        app.setWindowIcon(QIcon(str(ICO_PATH)))
    elif LOGO_PATH.is_file():
        app.setWindowIcon(QIcon(str(LOGO_PATH)))

    win = BaseWindow(title="TrishDesign — Engineer Toolkit")
    win.sidebar.set_title("TrishDesign")

    header = AppHeader(
        logo_path=LOGO_PATH if LOGO_PATH.is_file() else None,
        app_name="Trish<b>Design</b>",
        version=APP_VERSION,
        show_update=False,
        show_about=False,
        name_is_html=True,
    )
    win.set_header(header)

    # ---- Module chính (Sprint 5-12) ----
    win.add_page("dashboard",        "Dashboard",       DashboardView(),         icon="🏠")
    win.add_page("library",          "Thư viện dự án",   LibraryView(),           icon="📚")
    win.add_page("template_library", "Bảng tính KC",    TemplateLibraryView(),   icon="📐")
    win.add_page("estimate",         "Dự toán",         EstimateView(),          icon="💰")
    win.add_page("office",           "Office Export",   _placeholder("Office (S8)"), icon="📄")
    win.add_page("road_damage",      "Hư hỏng mặt đường", _placeholder("Road Damage (S9)"), icon="🛣")
    win.add_page("traffic_safety",   "ATGT",            _placeholder("Traffic Safety (S9)"), icon="🚦")
    win.add_page("map_vn2000",       "Map VN2000",      _placeholder("Map VN2000 (S9)"), icon="🗺")
    win.add_page("pdf_extract",      "PDF → Excel",     _placeholder("PDF Extract (S10)"), icon="📑")
    win.add_page("lisp_manager",     "AutoLisp",        _placeholder("Lisp Manager (S10)"), icon="⚙"),
    win.add_page("pdf_tools",        "PDF Tools",       _placeholder("PDF Tools (S11)"), icon="🔧")
    win.add_page("doc_category",     "Danh mục HS",     _placeholder("Doc Category (S11)"), icon="🗂")
    win.add_page("chatbot",          "Chatbot RAG",     _placeholder("Chatbot (S12)"), icon="🤖")
    win.add_page("ocr",              "OCR",             _placeholder("OCR (S12)"), icon="🔍")

    win.show()
    return app.exec()


if __name__ == "__main__":
    sys.exit(main())
