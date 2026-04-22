"""QSS generator — v1.1, align với reference apps.

Reference: TrishFont v1.0 + Trish Library 1.0 (Hồ Sỹ Trí, 2026).

Palette: **warm dark** (nâu đen ấm #0f0e0c / #1a1814 / #1e1c18), không phải
cool gray. Accent gradient #667EEA → #764BA2 giữ nguyên. Radius card 12px,
button 7–8px. Font stack ưu tiên Be Vietnam Pro (fallback Segoe UI).

Philosophy:
- Secondary buttons/inputs dùng `rgba(255,255,255,0.05)` bg → blend vào body,
  không "float" như card. Hover → accent tint (`rgba(102,126,234,0.10)`).
- Border mọi nơi dùng rgba(255,255,255,0.06-0.12) tuỳ mức nhấn → mềm, không
  cứng như border hex solid.
- Text ấm: #f5f2ed (primary) / #d4cec4 (secondary) / #a09890 (muted).
"""

from __future__ import annotations

from PyQt6.QtGui import QFont
from PyQt6.QtWidgets import QApplication, QWidget

from .tokens import COLOR, DARK, FONT, RADIUS, SPACE


# Font stack — Be Vietnam Pro primary (reference app dùng cái này), fallback
# Segoe UI cho Windows máy nào cũng có, DM Sans + sans-serif cuối.
FONT_STACK_BODY = '"Be Vietnam Pro", "Segoe UI", "DM Sans", Arial, sans-serif'
FONT_STACK_MONO = '"Consolas", "Cascadia Code", "JetBrains Mono", monospace'


def build_qss(dark: bool = True) -> str:
    """Sinh QSS stylesheet. dark=True mặc định (6 app desktop)."""
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
QStatusBar {{
    background-color: {surf.bg_elevated};
    color: {txt.muted};
    border-top: 1px solid {bord.subtle};
    font-size: {FONT.size.xs};
}}

/* ==================== BUTTONS ==================== */
/* Default = secondary/ghost: blend với body, muted text, hover → accent tint.
   Primary CTA phải set property variant="primary" để lấy gradient (tránh mọi
   QPushButton rò rỉ gradient như bản cũ — reference cho thấy 99% nút app
   là secondary, chỉ Install CTA là primary). */
QPushButton {{
    background-color: {surf.muted};
    color: {txt.muted};
    border: 1px solid {bord.default};
    border-radius: {RADIUS.sm};
    padding: 4px 12px;
    font-size: {FONT.size.sm};
    font-weight: 500;
    min-height: 24px;
}}
QPushButton:hover {{
    border-color: {c.accent.primary};
    color: {c.accent.primary};
    background-color: {surf.hover};
}}
QPushButton:pressed {{
    background-color: rgba(102,126,234,0.18);
}}
QPushButton:disabled {{
    opacity: 0.5;
    color: {txt.muted};
    border-color: {bord.subtle};
}}

/* Primary CTA — gradient horizontal (match reference install button) */
QPushButton[variant="primary"] {{
    background: qlineargradient(
        x1:0, y1:0, x2:1, y2:0,
        stop:0 {c.accent.primary},
        stop:1 {c.accent.secondary}
    );
    color: {c.text.inverse};
    border: none;
    border-radius: {RADIUS.md};
    padding: 0 20px;
    font-weight: 700;
    font-size: {FONT.size.lg};
    min-height: 34px;
}}
QPushButton[variant="primary"]:hover {{
    background: qlineargradient(
        x1:0, y1:0, x2:1, y2:0,
        stop:0 #7388EE, stop:1 #8256B1
    );
}}
QPushButton[variant="primary"]:pressed {{
    background: qlineargradient(
        x1:0, y1:0, x2:1, y2:0,
        stop:0 #5B74E0, stop:1 #653D94
    );
}}
QPushButton[variant="primary"]:disabled {{
    background: {surf.muted};
    color: {txt.muted};
}}

/* Ghost — nền trong, chỉ viền mảnh */
QPushButton[variant="ghost"] {{
    background: transparent;
    color: {txt.secondary};
    border: 1px solid {bord.default};
}}
QPushButton[variant="ghost"]:hover {{
    background: {surf.hover};
    color: {c.accent.primary};
    border-color: {c.accent.primary};
}}

/* Subtle — chỉ text, không viền, hover bg mờ */
QPushButton[variant="subtle"] {{
    background: transparent;
    color: {txt.secondary};
    border: none;
    padding: 4px 10px;
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
    padding: 4px 10px;
    selection-background-color: {c.accent.primary};
    selection-color: {c.text.inverse};
    font-size: {FONT.size.sm};
    min-height: 22px;
}}
QLineEdit:focus, QTextEdit:focus, QPlainTextEdit:focus,
QComboBox:focus, QSpinBox:focus, QDoubleSpinBox:focus {{
    border: 1px solid {bord.focus};
}}
QLineEdit::placeholder, QPlainTextEdit::placeholder {{
    color: {txt.muted};
}}
QLineEdit:read-only {{
    background-color: rgba(255,255,255,0.03);
    color: {txt.secondary};
}}

/* ==================== CHECKBOX ==================== */
QCheckBox {{
    color: {txt.primary};
    spacing: 6px;
    padding: 2px 0;
    font-size: {FONT.size.sm};
    background: transparent;
}}
QCheckBox::indicator {{
    width: 14px; height: 14px;
    border: 1.5px solid {bord.strong};
    border-radius: 3px;
    background: transparent;
}}
QCheckBox::indicator:hover {{
    border-color: {c.accent.primary};
}}
QCheckBox::indicator:checked {{
    background: {c.accent.primary};
    border-color: {c.accent.primary};
}}
QCheckBox::indicator:indeterminate {{
    background: {c.accent.primary};
    border-color: {c.accent.primary};
}}

/* ==================== CARDS ==================== */
QFrame[role="card"] {{
    background-color: {surf.card};
    border: 1.5px solid {bord.default};
    border-radius: {RADIUS.lg};
}}
/* Card variants với left-stripe accent — set property
   `stripe="primary"|"green"|"amber"|"cyan"|"blue"` để tô dải trái.
   Fallback = accent.primary khi không set. */
QFrame[role="card"][stripe="primary"] {{ border-left: 3px solid {c.accent.primary}; }}
QFrame[role="card"][stripe="green"]   {{ border-left: 3px solid {c.semantic.success}; }}
QFrame[role="card"][stripe="amber"]   {{ border-left: 3px solid {c.semantic.warning}; }}
QFrame[role="card"][stripe="cyan"]    {{ border-left: 3px solid {c.group.cyan}; }}
QFrame[role="card"][stripe="blue"]    {{ border-left: 3px solid {c.semantic.info}; }}
QFrame[role="card"][stripe="danger"]  {{ border-left: 3px solid {c.semantic.danger}; }}

/* Inline chip / badge (dùng cho count "N file") */
QLabel[role="badge"] {{
    background-color: rgba(255,255,255,0.06);
    color: {txt.muted};
    padding: 2px 8px;
    border-radius: 9999px;
    font-size: {FONT.size.xs};
}}

/* ==================== SIDEBAR (compact) ==================== */
QFrame[role="sidebar"] {{
    background-color: {surf.bg_elevated};
    color: {txt.primary};
    border: none;
    border-right: 1px solid {bord.subtle};
}}
QFrame[role="sidebar"] QLabel {{
    color: {txt.primary};
}}
QFrame[role="sidebar"] QPushButton {{
    background: transparent;
    color: {txt.secondary};
    text-align: left;
    padding: 6px 10px;
    border: none;
    border-radius: {RADIUS.sm};
    font-weight: 500;
    font-size: {FONT.size.sm};
    min-height: 26px;
}}
QFrame[role="sidebar"] QPushButton:hover {{
    background: {surf.hover};
    color: {c.accent.primary};
    border: none;
}}
QFrame[role="sidebar"] QPushButton:checked {{
    background: qlineargradient(
        x1:0, y1:0, x2:1, y2:0,
        stop:0 {c.accent.primary},
        stop:1 {c.accent.secondary}
    );
    color: {c.text.inverse};
    font-weight: 600;
    border: none;
}}
QFrame[role="sidebar"] QPushButton:disabled {{
    background: transparent;
    color: {txt.primary};
    opacity: 1.0;
}}

/* ==================== TABLES / TREE ==================== */
QTreeView, QTreeWidget, QTableView, QTableWidget {{
    background-color: {surf.bg_elevated};
    alternate-background-color: rgba(255,255,255,0.02);
    gridline-color: {bord.subtle};
    border: 1px solid {bord.subtle};
    border-radius: {RADIUS.sm};
    color: {txt.primary};
    selection-background-color: {c.accent.primary};
    selection-color: {c.text.inverse};
}}
QTreeView::item, QTreeWidget::item, QTableView::item, QTableWidget::item {{
    padding: 4px 8px;
}}
QHeaderView::section {{
    background-color: {surf.card};
    color: {txt.secondary};
    padding: 4px 8px;
    border: none;
    border-bottom: 1px solid {bord.subtle};
    font-weight: 600;
    font-size: {FONT.size.sm};
}}

/* ==================== LISTS ==================== */
QListWidget {{
    background-color: {surf.bg_elevated};
    border: 1px solid {bord.subtle};
    border-radius: {RADIUS.sm};
    color: {txt.primary};
    padding: 4px;
    outline: none;
}}
QListWidget::item {{
    padding: 4px 8px;
    border-radius: {RADIUS.sm};
    margin: 1px 0;
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
QSplitter::handle {{ background-color: {bord.subtle}; }}
QSplitter::handle:horizontal {{ width: 1px; }}
QSplitter::handle:vertical   {{ height: 1px; }}

/* ==================== PROGRESS ==================== */
QProgressBar {{
    background: rgba(255,255,255,0.06);
    border: none;
    border-radius: 2px;
    min-height: 5px; max-height: 5px;
    text-align: center;
    color: {txt.primary};
}}
QProgressBar::chunk {{
    background: qlineargradient(
        x1:0, y1:0, x2:1, y2:0,
        stop:0 {c.accent.primary},
        stop:1 {c.accent.secondary}
    );
    border-radius: 2px;
}}

/* ==================== SCROLLBARS ==================== */
QScrollBar:vertical {{
    background: transparent;
    width: 6px;
    margin: 0;
}}
QScrollBar::handle:vertical {{
    background: rgba(255,255,255,0.12);
    border-radius: 3px;
    min-height: 30px;
}}
QScrollBar::handle:vertical:hover {{ background: {c.accent.primary}; }}
QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical {{ height: 0; }}
QScrollBar::add-page:vertical, QScrollBar::sub-page:vertical {{ background: transparent; }}

QScrollBar:horizontal {{
    background: transparent;
    height: 6px;
    margin: 0;
}}
QScrollBar::handle:horizontal {{
    background: rgba(255,255,255,0.12);
    border-radius: 3px;
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

/* ==================== DESIGN-SYSTEM ROLES ==================== */

/* AppHeader — top bar 56px, BG_CARD (blend với card), hairline bottom */
QFrame[role="app-header"] {{
    background-color: {surf.bg_elevated};
    border: none;
    border-bottom: 1px solid {bord.subtle};
}}
QFrame[role="app-header"] QLabel[role="app-title"] {{
    color: {txt.primary};
}}
QFrame[role="app-header"] QLabel[role="app-version"] {{
    color: {txt.muted};
}}

/* InlineToolbar — config row, semi-transparent overlay trên body */
QFrame[role="inline-toolbar"] {{
    background-color: rgba(26,24,20,0.7);
    border: none;
    border-bottom: 1px solid {bord.subtle};
}}

/* ActionBar — toolbar hàng 2, nền sậm hơn */
QFrame[role="action-bar"] {{
    background-color: rgba(15,14,12,0.95);
    border: none;
    border-bottom: 1px solid {bord.subtle};
}}

/* LogPanel — card nâu BG_CARD, border-top mỏng */
QFrame[role="log-panel"] {{
    background-color: {surf.bg_elevated};
    border: none;
    border-top: 1px solid {bord.subtle};
}}
QFrame[role="log-header"] {{
    background: transparent;
    border: none;
}}

/* Body QTextEdit bên trong log-panel — darker, mono, bordered */
QFrame[role="log-panel"] QTextEdit {{
    background-color: {surf.bg};
    color: {txt.primary};
    border: 1px solid {bord.subtle};
    border-radius: {RADIUS.md};
    font-family: {FONT_STACK_MONO};
    font-size: {FONT.size.sm};
    padding: 6px;
}}

/* FooterBar */
QFrame[role="footer-bar"] {{
    background-color: {surf.bg_elevated};
    border: none;
    border-top: 1px solid {bord.subtle};
}}
""".strip()


def apply_theme(target: QWidget | QApplication, dark: bool = True) -> None:
    """Gắn QSS + set global font cho app.

    target: QApplication (preferred — ảnh hưởng toàn app) hoặc QMainWindow.
    dark: True (default) → dark theme warm-dark.
    """
    app = target if isinstance(target, QApplication) else QApplication.instance()
    if app is not None:
        # Be Vietnam Pro primary, Segoe UI fallback qua font-family trong QSS
        base_font = QFont("Be Vietnam Pro", 10)
        # StyleHint giúp Qt chọn font thay thế nếu không có Be Vietnam Pro
        base_font.setStyleHint(QFont.StyleHint.SansSerif)
        app.setFont(base_font)

    target.setStyleSheet(build_qss(dark=dark))
