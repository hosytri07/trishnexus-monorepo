"""QSS generator — đọc tokens.py rồi render stylesheet.

Default: DARK theme (giống Figma/VS Code/Photoshop) để đồng bộ với 6 app
desktop của TrishTeam. Accent & gradient lấy từ design/tokens.json →
match với website.

Font mặc định: Segoe UI — render Tiếng Việt cực tốt trên Windows.
(Be Vietnam Pro + DM Sans là webfont, không đảm bảo máy nào cũng có.)
"""

from __future__ import annotations

from PyQt6.QtGui import QFont
from PyQt6.QtWidgets import QApplication, QWidget

from .tokens import COLOR, DARK, FONT, RADIUS, SPACE


# Font stack — Segoe UI là primary cho Windows (render VN tốt).
# Fallback: Be Vietnam Pro (webfont, nếu máy có) → DM Sans → sans-serif mặc định.
FONT_STACK_BODY = '"Segoe UI", "Be Vietnam Pro", "DM Sans", Arial, sans-serif'
FONT_STACK_MONO = '"Cascadia Code", "JetBrains Mono", "Consolas", monospace'


def build_qss(dark: bool = True) -> str:
    """Sinh QSS stylesheet.

    dark=True (default): dark theme cho desktop app.
    dark=False: light theme (nếu sau này cần).
    """
    c = COLOR
    if dark:
        surf = DARK.surface
        txt = DARK.text
        bord = DARK.border
    else:
        surf = c.surface
        txt = c.text
        bord = c.border

    return f"""
/* ==================== BASE ==================== */
QWidget {{
    background-color: {surf.bg};
    color: {txt.primary};
    font-family: {FONT_STACK_BODY};
    font-size: {FONT.size.base};
}}
QMainWindow {{
    background-color: {surf.bg};
}}

/* ==================== BUTTONS ==================== */
/* Primary — gradient tím-xanh (match với website hero CTA) */
QPushButton {{
    background: qlineargradient(
        x1:0, y1:0, x2:1, y2:1,
        stop:0 {c.accent.primary},
        stop:1 {c.accent.secondary}
    );
    color: {c.text.inverse};
    border: none;
    border-radius: {RADIUS.md};
    padding: {SPACE.n2} {SPACE.n5};
    font-weight: 600;
    font-size: {FONT.size.sm};
    min-height: 28px;
}}
QPushButton:hover {{
    background: qlineargradient(
        x1:0, y1:0, x2:1, y2:1,
        stop:0 #7B92F0,
        stop:1 #8A5BBB
    );
}}
QPushButton:pressed {{
    background: qlineargradient(
        x1:0, y1:0, x2:1, y2:1,
        stop:0 #5268D0,
        stop:1 #633A8E
    );
}}
QPushButton:disabled {{
    background: {surf.muted};
    color: {txt.muted};
}}

/* Ghost variant — nền trong, viền mảnh (dùng cho secondary action) */
QPushButton[variant="ghost"] {{
    background: transparent;
    color: {txt.primary};
    border: 1px solid {bord.default};
}}
QPushButton[variant="ghost"]:hover {{
    background: {surf.hover};
    border-color: {bord.strong};
}}
QPushButton[variant="ghost"]:pressed {{
    background: {surf.muted};
}}

/* Subtle variant — chỉ text + hover bg (cho toolbar icon button) */
QPushButton[variant="subtle"] {{
    background: transparent;
    color: {txt.secondary};
    border: none;
    padding: {SPACE.n2} {SPACE.n3};
}}
QPushButton[variant="subtle"]:hover {{
    background: {surf.hover};
    color: {txt.primary};
}}

/* ==================== INPUTS ==================== */
QLineEdit, QTextEdit, QPlainTextEdit, QComboBox, QSpinBox, QDoubleSpinBox {{
    background-color: {surf.muted};
    color: {txt.primary};
    border: 1px solid {bord.default};
    border-radius: {RADIUS.sm};
    padding: {SPACE.n2} {SPACE.n3};
    selection-background-color: {c.accent.primary};
    selection-color: {c.text.inverse};
    min-height: 22px;
}}
QLineEdit:focus, QTextEdit:focus, QPlainTextEdit:focus,
QComboBox:focus, QSpinBox:focus, QDoubleSpinBox:focus {{
    border: 2px solid {bord.focus};
    padding: 7px 11px;
}}
QLineEdit::placeholder {{ color: {txt.muted}; }}

/* ==================== CHECKBOX ==================== */
QCheckBox {{
    color: {txt.secondary};
    spacing: 6px;
}}
QCheckBox::indicator {{
    width: 16px; height: 16px;
    border: 1px solid {bord.default};
    border-radius: 4px;
    background: {surf.muted};
}}
QCheckBox::indicator:hover {{
    border-color: {c.accent.primary};
}}
QCheckBox::indicator:checked {{
    background: {c.accent.primary};
    border-color: {c.accent.primary};
    image: url();  /* Qt tự vẽ dấu ✓ khi checked */
}}

/* ==================== CARDS ==================== */
QFrame[role="card"] {{
    background-color: {surf.card};
    border: 1px solid {bord.subtle};
    border-radius: {RADIUS.lg};
    padding: {SPACE.n4};
}}

/* ==================== SIDEBAR ==================== */
QFrame[role="sidebar"] {{
    background-color: {surf.bg_elevated};
    color: {txt.primary};
    border: none;
    border-right: 1px solid {bord.subtle};
}}
QFrame[role="sidebar"] QLabel {{
    color: {txt.primary};
    font-weight: 700;
}}
QFrame[role="sidebar"] QPushButton {{
    background: transparent;
    color: {txt.secondary};
    text-align: left;
    padding: {SPACE.n3} {SPACE.n4};
    border-radius: {RADIUS.md};
    font-weight: 500;
    min-height: 32px;
}}
QFrame[role="sidebar"] QPushButton:hover {{
    background: {surf.hover};
    color: {txt.primary};
}}
QFrame[role="sidebar"] QPushButton:checked {{
    background: qlineargradient(
        x1:0, y1:0, x2:1, y2:0,
        stop:0 {c.accent.primary},
        stop:1 {c.accent.secondary}
    );
    color: {c.text.inverse};
    font-weight: 600;
}}

/* ==================== TABLES ==================== */
QTableView, QTableWidget {{
    background-color: {surf.card};
    alternate-background-color: {surf.muted};
    gridline-color: {bord.subtle};
    border: 1px solid {bord.subtle};
    border-radius: {RADIUS.md};
    color: {txt.primary};
    selection-background-color: {c.accent.primary};
    selection-color: {c.text.inverse};
}}
QTableView::item, QTableWidget::item {{
    padding: {SPACE.n2} {SPACE.n3};
}}
QHeaderView::section {{
    background-color: {surf.bg_elevated};
    color: {txt.secondary};
    padding: {SPACE.n2} {SPACE.n3};
    border: none;
    border-bottom: 1px solid {bord.subtle};
    font-weight: 600;
    font-size: {FONT.size.sm};
}}

/* ==================== LISTS ==================== */
QListWidget {{
    background-color: {surf.card};
    border: 1px solid {bord.subtle};
    border-radius: {RADIUS.md};
    color: {txt.primary};
    padding: 4px;
    outline: none;
}}
QListWidget::item {{
    padding: {SPACE.n2} {SPACE.n3};
    border-radius: {RADIUS.sm};
    margin: 1px 0px;
}}
QListWidget::item:hover {{
    background-color: {surf.hover};
}}
QListWidget::item:selected {{
    background: qlineargradient(
        x1:0, y1:0, x2:1, y2:0,
        stop:0 {c.accent.primary},
        stop:1 {c.accent.secondary}
    );
    color: {c.text.inverse};
}}

/* ==================== SPLITTER ==================== */
QSplitter::handle {{
    background-color: {bord.subtle};
}}
QSplitter::handle:horizontal {{ width: 1px; }}
QSplitter::handle:vertical   {{ height: 1px; }}

/* ==================== SLIDER ==================== */
QSlider::groove:horizontal {{
    height: 4px;
    background: {surf.muted};
    border-radius: 2px;
}}
QSlider::handle:horizontal {{
    background: {c.accent.primary};
    width: 16px; height: 16px;
    margin: -6px 0;
    border-radius: 8px;
}}
QSlider::handle:horizontal:hover {{
    background: {c.accent.secondary};
}}

/* ==================== SCROLLBARS ==================== */
QScrollBar:vertical {{
    background: transparent;
    width: 10px;
    margin: 4px;
}}
QScrollBar::handle:vertical {{
    background: {bord.strong};
    border-radius: 5px;
    min-height: 30px;
}}
QScrollBar::handle:vertical:hover {{ background: {c.accent.primary}; }}
QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical {{ height: 0; }}
QScrollBar::add-page:vertical, QScrollBar::sub-page:vertical {{ background: transparent; }}

QScrollBar:horizontal {{
    background: transparent;
    height: 10px;
    margin: 4px;
}}
QScrollBar::handle:horizontal {{
    background: {bord.strong};
    border-radius: 5px;
    min-width: 30px;
}}
QScrollBar::handle:horizontal:hover {{ background: {c.accent.primary}; }}
QScrollBar::add-line:horizontal, QScrollBar::sub-line:horizontal {{ width: 0; }}

/* ==================== TOOLTIP ==================== */
QToolTip {{
    background-color: {surf.bg_elevated};
    color: {txt.primary};
    border: 1px solid {bord.default};
    border-radius: {RADIUS.sm};
    padding: 4px 8px;
}}
""".strip()


def apply_theme(target: QWidget | QApplication, dark: bool = True) -> None:
    """Gắn QSS + set global font cho app.

    target: QApplication (preferred — ảnh hưởng toàn app) hoặc QMainWindow.
    dark: True (default) → dark theme.
    """
    # 1. Set global font — KEY để render Tiếng Việt đẹp trên Windows
    app = target if isinstance(target, QApplication) else QApplication.instance()
    if app is not None:
        base_font = QFont("Segoe UI", 10)
        app.setFont(base_font)

    # 2. Apply QSS
    target.setStyleSheet(build_qss(dark=dark))
