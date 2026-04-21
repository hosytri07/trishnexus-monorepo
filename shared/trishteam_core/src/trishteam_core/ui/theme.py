"""QSS generator — đọc tokens.py rồi render stylesheet."""

from __future__ import annotations

from PyQt6.QtWidgets import QWidget

from .tokens import COLOR, FONT, RADIUS, SPACE


def build_qss() -> str:
    c = COLOR
    return f"""
/* ---------- Base ---------- */
QWidget {{
    background-color: {c.surface.bg};
    color: {c.text.primary};
    font-family: "{FONT.family.body}", "Segoe UI", sans-serif;
    font-size: {FONT.size.base};
}}

QMainWindow {{
    background-color: {c.surface.bg};
}}

/* ---------- Buttons ---------- */
QPushButton {{
    background-color: {c.accent.primary};
    color: {c.text.inverse};
    border: none;
    border-radius: {RADIUS.md};
    padding: {SPACE.n2} {SPACE.n4};
    font-weight: 600;
}}
QPushButton:hover   {{ background-color: {c.accent.secondary}; }}
QPushButton:pressed {{ background-color: {c.neutral.n800}; }}
QPushButton:disabled {{
    background-color: {c.neutral.n300};
    color: {c.text.muted};
}}

QPushButton[variant="ghost"] {{
    background-color: transparent;
    color: {c.text.primary};
    border: 1px solid {c.border.default};
}}
QPushButton[variant="ghost"]:hover {{
    background-color: {c.surface.muted};
}}

/* ---------- Inputs ---------- */
QLineEdit, QTextEdit, QPlainTextEdit, QComboBox, QSpinBox, QDoubleSpinBox {{
    background-color: {c.surface.card};
    border: 1px solid {c.border.default};
    border-radius: {RADIUS.sm};
    padding: {SPACE.n2} {SPACE.n3};
    selection-background-color: {c.accent.primary};
    selection-color: {c.text.inverse};
}}
QLineEdit:focus, QTextEdit:focus, QPlainTextEdit:focus,
QComboBox:focus, QSpinBox:focus, QDoubleSpinBox:focus {{
    border: 2px solid {c.border.focus};
    padding: {int(SPACE.n2.replace("px","")) - 1}px {int(SPACE.n3.replace("px","")) - 1}px;
}}

/* ---------- Cards ---------- */
QFrame[role="card"] {{
    background-color: {c.surface.card};
    border: 1px solid {c.border.subtle};
    border-radius: {RADIUS.lg};
    padding: {SPACE.n4};
}}

/* ---------- Sidebar ---------- */
QFrame[role="sidebar"] {{
    background-color: {c.neutral.n900};
    color: {c.text.inverse};
    border: none;
}}
QFrame[role="sidebar"] QPushButton {{
    background-color: transparent;
    color: {c.neutral.n200};
    text-align: left;
    padding: {SPACE.n3} {SPACE.n4};
    border-radius: {RADIUS.md};
    font-weight: 500;
}}
QFrame[role="sidebar"] QPushButton:hover {{
    background-color: {c.neutral.n800};
    color: {c.text.inverse};
}}
QFrame[role="sidebar"] QPushButton:checked {{
    background-color: {c.accent.primary};
    color: {c.text.inverse};
}}

/* ---------- Tables ---------- */
QTableView {{
    background-color: {c.surface.card};
    alternate-background-color: {c.surface.muted};
    gridline-color: {c.border.subtle};
    border: 1px solid {c.border.subtle};
    border-radius: {RADIUS.md};
}}
QHeaderView::section {{
    background-color: {c.surface.muted};
    color: {c.text.secondary};
    padding: {SPACE.n2} {SPACE.n3};
    border: none;
    border-bottom: 1px solid {c.border.subtle};
    font-weight: 600;
}}

/* ---------- ScrollBar ---------- */
QScrollBar:vertical {{
    background: transparent;
    width: 10px;
    margin: 4px;
}}
QScrollBar::handle:vertical {{
    background: {c.neutral.n300};
    border-radius: 5px;
    min-height: 30px;
}}
QScrollBar::handle:vertical:hover {{ background: {c.neutral.n400}; }}
QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical {{ height: 0; }}
""".strip()


def apply_theme(widget: QWidget) -> None:
    """Gắn QSS vào widget (thường là QMainWindow hoặc QApplication)."""
    widget.setStyleSheet(build_qss())
