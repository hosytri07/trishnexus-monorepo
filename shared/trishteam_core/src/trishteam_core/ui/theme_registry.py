"""theme_registry — pure-Python loader cho `design/tokens.v2.json`.

Phase 13.3 / Task #69. Tách khỏi `theme.py` (PyQt-bound) để test/CI
headless không cần PyQt6, và để website hoặc tooling khác có thể dùng.

Workflow:

    from trishteam_core.ui import theme_registry as tr

    tr.list_themes()                  # [("trishwarm", "TrishWarm"), ...]
    palette = tr.get_theme("midnight")  # -> ThemePalette
    qss = tr.build_qss_from_theme("midnight")

Design quyết:

- Đọc JSON 1 lần, cache module-level. Dev thay đổi file → gọi
  `reload()` (test + dev mode dùng).
- Fallback: nếu key không có → raise `ThemeError("unknown_theme", key)`.
  Không silent-fallback về TrishWarm vì sẽ che bug UX (user chọn theme
  không tồn tại mà không biết).
- QSS sinh từ cùng 1 template như `theme.py` nhưng pull color từ theme
  được chọn thay vì hardcode DARK namespace.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from threading import RLock
from typing import Any


# ---------- Exceptions ----------

class ThemeError(Exception):
    """Domain error khi load / resolve theme."""

    def __init__(self, code: str, message: str = "") -> None:
        super().__init__(message or code)
        self.code = code
        self.message = message or code


# ---------- Dataclasses ----------

@dataclass(frozen=True)
class ThemePalette:
    """Snapshot theme đã resolve — pass vào QSS builder."""

    key: str
    label: str
    description: str
    mode: str  # "dark" | "light"
    accent: dict[str, str] = field(default_factory=dict)
    surface: dict[str, str] = field(default_factory=dict)
    text: dict[str, str] = field(default_factory=dict)
    border: dict[str, str] = field(default_factory=dict)


@dataclass(frozen=True)
class TokensBundle:
    """Cả tokens.v2.json parsed — dùng bởi theme manager + tooling."""

    default_theme: str
    themes: dict[str, ThemePalette]
    semantic: dict[str, str]
    group: dict[str, str]
    font: dict[str, Any]
    space: dict[str, str]
    radius: dict[str, str]
    # Phase 13.5 simplify (2026-04-23) — aliases cho backward compat. Persist
    # file cũ có thể chứa 'trishwarm'/'candy' → map sang 'dark'/'light'.
    aliases: dict[str, str] = field(default_factory=dict)


# ---------- Path resolution ----------

_DEFAULT_TOKENS_FILENAME = "tokens.v2.json"
_MONOREPO_ENV = "TRISHTEAM_MONOREPO_ROOT"
_TOKENS_OVERRIDE_ENV = "TRISHTEAM_TOKENS_PATH"

# Cache (module-level để tránh IO lặp — 1 file ~390 dòng, đọc 1 lần là đủ).
_cache_lock = RLock()
_cache: TokensBundle | None = None
_cache_path: Path | None = None


def _find_tokens_path() -> Path:
    """Resolve path tới tokens.v2.json.

    Ưu tiên:
    1. `TRISHTEAM_TOKENS_PATH` env (test + installer override)
    2. `<TRISHTEAM_MONOREPO_ROOT>/design/tokens.v2.json`
    3. Walk lên từ file này tìm `design/tokens.v2.json`

    Raise ThemeError("tokens_not_found") nếu không có.
    """
    override = os.environ.get(_TOKENS_OVERRIDE_ENV)
    if override:
        p = Path(override)
        if p.is_file():
            return p
        raise ThemeError("tokens_not_found", f"override path missing: {p}")

    monorepo = os.environ.get(_MONOREPO_ENV)
    if monorepo:
        p = Path(monorepo) / "design" / _DEFAULT_TOKENS_FILENAME
        if p.is_file():
            return p

    here = Path(__file__).resolve()
    for parent in [here, *here.parents]:
        candidate = parent / "design" / _DEFAULT_TOKENS_FILENAME
        if candidate.is_file():
            return candidate

    raise ThemeError("tokens_not_found", "design/tokens.v2.json not locatable")


# ---------- Load / reload ----------

def _parse_theme(key: str, node: dict[str, Any]) -> ThemePalette:
    color = node.get("color", {})
    return ThemePalette(
        key=key,
        label=node.get("label", key),
        description=node.get("description", ""),
        mode=node.get("mode", "dark"),
        accent=dict(color.get("accent", {})),
        surface=dict(color.get("surface", {})),
        text=dict(color.get("text", {})),
        border=dict(color.get("border", {})),
    )


def _parse_bundle(raw: dict[str, Any]) -> TokensBundle:
    themes_raw = raw.get("themes", {})
    if not themes_raw:
        raise ThemeError("invalid_tokens", "missing 'themes' block")
    themes = {k: _parse_theme(k, v) for k, v in themes_raw.items()}
    default = raw.get("default_theme") or next(iter(themes))
    if default not in themes:
        raise ThemeError("invalid_default", f"default_theme '{default}' unknown")
    # Aliases — bỏ qua `_comment` key + aliases chỉ tới theme thật.
    alias_raw = raw.get("theme_aliases", {})
    aliases = {
        k: v for k, v in alias_raw.items()
        if not k.startswith("_") and v in themes
    }
    return TokensBundle(
        default_theme=default,
        themes=themes,
        semantic=dict(raw.get("semantic", {})),
        group=dict(raw.get("group", {})),
        font=dict(raw.get("font", {})),
        space=dict(raw.get("space", {})),
        radius=dict(raw.get("radius", {})),
        aliases=aliases,
    )


def load(path: Path | None = None) -> TokensBundle:
    """Load tokens bundle (cached). `path=None` → auto-resolve.

    Nếu đã cache + caller không chỉ định `path` khác → trả cache ngay,
    không chạm disk (cho phép test xoá file gốc sau khi đã load một lần).
    """
    global _cache, _cache_path
    with _cache_lock:
        if path is None and _cache is not None:
            return _cache
        p = path or _find_tokens_path()
        if _cache is not None and _cache_path == p:
            return _cache
        try:
            raw = json.loads(p.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError) as err:
            raise ThemeError("tokens_parse_error", str(err)) from err
        bundle = _parse_bundle(raw)
        _cache = bundle
        _cache_path = p
        return bundle


def reload() -> TokensBundle:
    """Force reload khỏi disk — dev mode + test."""
    global _cache, _cache_path
    with _cache_lock:
        _cache = None
        _cache_path = None
    return load()


# ---------- Public API ----------

def list_themes() -> list[tuple[str, str]]:
    """Return `[(key, label), ...]` theo thứ tự declared trong JSON."""
    bundle = load()
    return [(k, p.label) for k, p in bundle.themes.items()]


def get_default_theme() -> str:
    return load().default_theme


def resolve_alias(key: str) -> str:
    """Map key legacy (vd 'trishwarm', 'candy') → key thật ('dark', 'light').

    Nếu `key` đã là key thật → return luôn. Nếu không có alias → return
    nguyên key (để caller raise `unknown_theme` downstream).
    """
    bundle = load()
    if key in bundle.themes:
        return key
    return bundle.aliases.get(key, key)


def get_theme(key: str) -> ThemePalette:
    bundle = load()
    # Hỗ trợ alias (Phase 13.5 — persist file cũ có thể chứa 'trishwarm').
    real_key = bundle.aliases.get(key, key) if key not in bundle.themes else key
    if real_key not in bundle.themes:
        raise ThemeError("unknown_theme", f"theme '{key}' not in registry")
    return bundle.themes[real_key]


def get_bundle() -> TokensBundle:
    return load()


# ---------- QSS builder từ palette ----------

# Font stack mirror với theme.py — giữ nguyên nếu user có Be Vietnam Pro.
FONT_STACK_BODY = '"Be Vietnam Pro", "Segoe UI", "DM Sans", Arial, sans-serif'
FONT_STACK_MONO = '"JetBrains Mono", "Consolas", "Cascadia Code", monospace'


def build_qss_from_palette(
    palette: ThemePalette,
    bundle: TokensBundle | None = None,
) -> str:
    """Sinh QSS stylesheet ĐẦY ĐỦ từ palette + bundle (Phase 13.4 expanded).

    Cover tất cả role-specific selector từ `theme.py` cũ:
    - base / QMainWindow / QStatusBar
    - Buttons (default/secondary, primary CTA gradient, ghost, subtle)
    - Inputs / QCheckBox (indicator)
    - Cards + 6 stripe variants (primary/green/amber/cyan/blue/danger)
    - Sidebar compact (selected = gradient pill)
    - Tables / Tree / List (selected = gradient)
    - Scrollbar / Splitter / Progress / Tooltip
    - Design-system roles: AppHeader / InlineToolbar / ActionBar / LogPanel /
      FooterBar / LogHeader / Badge

    `bundle` dùng để pull semantic/group colors (theme-independent). Nếu
    `None` → tự lấy từ `get_bundle()`.
    """
    if bundle is None:
        bundle = get_bundle()

    surf = palette.surface
    txt = palette.text
    bord = palette.border
    acc = palette.accent
    sem = bundle.semantic
    grp = bundle.group

    # Defensive defaults — đề phòng JSON thiếu field.
    def s(d: dict[str, str], key: str, default: str = "") -> str:
        return d.get(key, default)

    # --- surface ---
    bg = s(surf, "bg", "#0f0e0c")
    bg_elev = s(surf, "bg_elevated", "#1a1814")
    card = s(surf, "card", bg_elev)
    row = s(surf, "row", "#1e1c18")
    muted = s(surf, "muted", "rgba(255,255,255,0.05)")
    hover = s(surf, "hover", "rgba(102,126,234,0.10)")

    # --- text ---
    text_primary = s(txt, "primary", "#f5f2ed")
    text_secondary = s(txt, "secondary", "#d4cec4")
    text_muted = s(txt, "muted", "#a09890")
    text_inverse = s(txt, "inverse", "#ffffff")

    # --- border ---
    border_subtle = s(bord, "subtle", "rgba(255,255,255,0.06)")
    border_default = s(bord, "default", "rgba(255,255,255,0.08)")
    border_strong = s(bord, "strong", "rgba(255,255,255,0.12)")
    focus = s(bord, "focus", "#667EEA")

    # --- accent ---
    accent_primary = s(acc, "primary", "#667EEA")
    accent_secondary = s(acc, "secondary", "#764BA2")

    # --- semantic + group (theme-independent) ---
    sem_success = s(sem, "success", "#10B981")
    sem_warning = s(sem, "warning", "#F59E0B")
    sem_danger = s(sem, "danger", "#EF4444")
    sem_info = s(sem, "info", "#3B82F6")
    grp_cyan = s(grp, "cyan", "#06B6D4")

    # Font sizes từ bundle (theme-independent) — fallback nếu bundle thiếu.
    font_sizes = bundle.font.get("size", {}) if isinstance(bundle.font, dict) else {}
    fs_xs = font_sizes.get("xs", "11px")
    fs_sm = font_sizes.get("sm", "12px")
    fs_base = font_sizes.get("base", "13px")
    fs_lg = font_sizes.get("lg", "14px")

    # Accent-gradient hex with slight darken/brighten cho pressed/hover state.
    # Với pressed: mix 12% đen; hover: mix 12% trắng. Giữ simple — dùng accent
    # secondary làm anchor cho hover/pressed để mọi theme đều consistent.
    gradient_stop_0 = accent_primary
    gradient_stop_1 = accent_secondary

    return f"""
/* AUTO — theme_registry v2 (Phase 13.4 full) — theme: {palette.key} ({palette.label}) */

/* ==================== BASE ==================== */
QWidget {{
    background-color: {bg};
    color: {text_primary};
    font-family: {FONT_STACK_BODY};
    font-size: {fs_base};
}}
QMainWindow, QDialog {{ background-color: {bg}; }}
QStatusBar {{
    background-color: {bg_elev};
    color: {text_muted};
    border-top: 1px solid {border_subtle};
    font-size: {fs_xs};
}}

/* ==================== BUTTONS ==================== */
QPushButton {{
    background-color: {muted};
    color: {text_muted};
    border: 1px solid {border_default};
    border-radius: 6px;
    padding: 4px 12px;
    font-size: {fs_sm};
    font-weight: 500;
    min-height: 24px;
}}
QPushButton:hover {{
    border-color: {accent_primary};
    color: {accent_primary};
    background-color: {hover};
}}
QPushButton:pressed {{ background-color: {row}; }}
QPushButton:disabled {{ opacity: 0.5; color: {text_muted}; border-color: {border_subtle}; }}

QPushButton[variant="primary"] {{
    background: qlineargradient(x1:0, y1:0, x2:1, y2:0,
        stop:0 {gradient_stop_0}, stop:1 {gradient_stop_1});
    color: {text_inverse};
    border: none;
    border-radius: 8px;
    padding: 0 20px;
    font-weight: 700;
    font-size: {fs_lg};
    min-height: 34px;
}}
QPushButton[variant="primary"]:disabled {{
    background: {muted}; color: {text_muted};
}}

QPushButton[variant="ghost"] {{
    background: transparent;
    color: {text_secondary};
    border: 1px solid {border_default};
}}
QPushButton[variant="ghost"]:hover {{
    background: {hover}; color: {accent_primary}; border-color: {accent_primary};
}}

QPushButton[variant="subtle"] {{
    background: transparent;
    color: {text_secondary};
    border: none;
    padding: 4px 10px;
}}
QPushButton[variant="subtle"]:hover {{ background: {hover}; color: {text_primary}; }}

/* ==================== INPUTS ==================== */
QLineEdit, QTextEdit, QPlainTextEdit, QComboBox, QSpinBox, QDoubleSpinBox {{
    background-color: {muted};
    color: {text_primary};
    border: 1px solid {border_default};
    border-radius: 6px;
    padding: 4px 10px;
    selection-background-color: {accent_primary};
    selection-color: {text_inverse};
    font-size: {fs_sm};
    min-height: 22px;
}}
QLineEdit:focus, QTextEdit:focus, QPlainTextEdit:focus,
QComboBox:focus, QSpinBox:focus, QDoubleSpinBox:focus {{
    border: 1px solid {focus};
}}
QLineEdit::placeholder, QPlainTextEdit::placeholder {{ color: {text_muted}; }}
QLineEdit:read-only {{ background-color: {row}; color: {text_secondary}; }}

/* ==================== CHECKBOX ==================== */
QCheckBox {{
    color: {text_primary};
    spacing: 6px;
    padding: 2px 0;
    font-size: {fs_sm};
    background: transparent;
}}
QCheckBox::indicator {{
    width: 14px; height: 14px;
    border: 1.5px solid {border_strong};
    border-radius: 3px;
    background: transparent;
}}
QCheckBox::indicator:hover {{ border-color: {accent_primary}; }}
QCheckBox::indicator:checked, QCheckBox::indicator:indeterminate {{
    background: {accent_primary}; border-color: {accent_primary};
}}

/* ==================== CARDS ==================== */
QFrame[role="card"] {{
    background-color: {card};
    border: 1.5px solid {border_default};
    border-radius: 12px;
}}
QFrame[role="card"][stripe="primary"] {{ border-left: 3px solid {accent_primary}; }}
QFrame[role="card"][stripe="green"]   {{ border-left: 3px solid {sem_success}; }}
QFrame[role="card"][stripe="amber"]   {{ border-left: 3px solid {sem_warning}; }}
QFrame[role="card"][stripe="cyan"]    {{ border-left: 3px solid {grp_cyan}; }}
QFrame[role="card"][stripe="blue"]    {{ border-left: 3px solid {sem_info}; }}
QFrame[role="card"][stripe="danger"]  {{ border-left: 3px solid {sem_danger}; }}

QLabel[role="badge"] {{
    background-color: {muted};
    color: {text_muted};
    padding: 2px 8px;
    border-radius: 9999px;
    font-size: {fs_xs};
}}

/* ==================== SIDEBAR ==================== */
QFrame[role="sidebar"] {{
    background-color: {bg_elev};
    color: {text_primary};
    border: none;
    border-right: 1px solid {border_subtle};
}}
QFrame[role="sidebar"] QLabel {{ color: {text_primary}; }}
QFrame[role="sidebar"] QPushButton {{
    background: transparent;
    color: {text_secondary};
    text-align: left;
    padding: 6px 10px;
    border: none;
    border-radius: 6px;
    font-weight: 500;
    font-size: {fs_sm};
    min-height: 26px;
}}
QFrame[role="sidebar"] QPushButton:hover {{
    background: {hover}; color: {accent_primary}; border: none;
}}
QFrame[role="sidebar"] QPushButton:checked {{
    background: qlineargradient(x1:0, y1:0, x2:1, y2:0,
        stop:0 {gradient_stop_0}, stop:1 {gradient_stop_1});
    color: {text_inverse};
    font-weight: 600;
    border: none;
}}

/* ==================== TABLES / LISTS ==================== */
QTreeView, QTreeWidget, QTableView, QTableWidget {{
    background-color: {bg_elev};
    alternate-background-color: {row};
    gridline-color: {border_subtle};
    border: 1px solid {border_subtle};
    border-radius: 6px;
    color: {text_primary};
    selection-background-color: {accent_primary};
    selection-color: {text_inverse};
}}
QHeaderView::section {{
    background-color: {card};
    color: {text_secondary};
    padding: 4px 8px;
    border: none;
    border-bottom: 1px solid {border_subtle};
    font-weight: 600;
    font-size: {fs_sm};
}}
QListWidget {{
    background-color: {bg_elev};
    border: 1px solid {border_subtle};
    border-radius: 6px;
    color: {text_primary};
    padding: 4px;
    outline: none;
}}
QListWidget::item {{ padding: 4px 8px; border-radius: 6px; margin: 1px 0; }}
QListWidget::item:hover {{ background-color: {hover}; }}
QListWidget::item:selected {{
    background: qlineargradient(x1:0, y1:0, x2:1, y2:0,
        stop:0 {gradient_stop_0}, stop:1 {gradient_stop_1});
    color: {text_inverse};
}}

/* ==================== SPLITTER ==================== */
QSplitter::handle {{ background-color: {border_subtle}; }}
QSplitter::handle:horizontal {{ width: 1px; }}
QSplitter::handle:vertical   {{ height: 1px; }}

/* ==================== PROGRESS ==================== */
QProgressBar {{
    background: {muted};
    border: none;
    border-radius: 2px;
    min-height: 5px; max-height: 5px;
    text-align: center;
    color: {text_primary};
}}
QProgressBar::chunk {{
    background: qlineargradient(x1:0, y1:0, x2:1, y2:0,
        stop:0 {gradient_stop_0}, stop:1 {gradient_stop_1});
    border-radius: 2px;
}}

/* ==================== SCROLLBARS ==================== */
QScrollBar:vertical {{ background: transparent; width: 6px; margin: 0; }}
QScrollBar::handle:vertical {{
    background: {border_strong};
    border-radius: 3px;
    min-height: 30px;
}}
QScrollBar::handle:vertical:hover {{ background: {accent_primary}; }}
QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical {{ height: 0; }}
QScrollBar::add-page:vertical, QScrollBar::sub-page:vertical {{ background: transparent; }}
QScrollBar:horizontal {{ background: transparent; height: 6px; margin: 0; }}
QScrollBar::handle:horizontal {{
    background: {border_strong}; border-radius: 3px; min-width: 30px;
}}
QScrollBar::handle:horizontal:hover {{ background: {accent_primary}; }}
QScrollBar::add-line:horizontal, QScrollBar::sub-line:horizontal {{ width: 0; }}

/* ==================== TOOLTIP ==================== */
QToolTip {{
    background-color: {bg_elev};
    color: {text_primary};
    border: 1px solid {border_default};
    border-radius: 6px;
    padding: 4px 8px;
}}

/* ==================== DESIGN-SYSTEM ROLES ==================== */
QFrame[role="app-header"] {{
    background-color: {bg_elev};
    border: none;
    border-bottom: 1px solid {border_subtle};
}}
QFrame[role="app-header"] QLabel[role="app-title"] {{ color: {text_primary}; }}
QFrame[role="app-header"] QLabel[role="app-version"] {{ color: {text_muted}; }}

QFrame[role="inline-toolbar"] {{
    background-color: {row};
    border: none;
    border-bottom: 1px solid {border_subtle};
}}
QFrame[role="action-bar"] {{
    background-color: {bg};
    border: none;
    border-bottom: 1px solid {border_subtle};
}}

QFrame[role="log-panel"] {{
    background-color: {bg_elev};
    border: none;
    border-top: 1px solid {border_subtle};
}}
QFrame[role="log-header"] {{ background: transparent; border: none; }}
QFrame[role="log-panel"] QTextEdit {{
    background-color: {bg};
    color: {text_primary};
    border: 1px solid {border_subtle};
    border-radius: 8px;
    font-family: {FONT_STACK_MONO};
    font-size: {fs_sm};
    padding: 6px;
}}

QFrame[role="footer-bar"] {{
    background-color: {bg_elev};
    border: none;
    border-top: 1px solid {border_subtle};
}}

/* ==================== MENU ==================== */
QMenu {{
    background-color: {card};
    color: {text_primary};
    border: 1px solid {border_default};
    border-radius: 8px;
    padding: 4px;
}}
QMenu::item {{ padding: 6px 14px; border-radius: 5px; }}
QMenu::item:selected {{ background-color: {hover}; color: {accent_primary}; }}
QMenu::separator {{ height: 1px; background: {border_subtle}; margin: 4px 8px; }}

/* Label variants — tiện gọi ở widget code */
QLabel[variant="muted"] {{ color: {text_muted}; }}
QLabel[variant="secondary"] {{ color: {text_secondary}; }}
QLabel[variant="accent"] {{ color: {accent_primary}; }}
""".strip()


def build_qss_from_theme(theme_key: str) -> str:
    """Convenience — load palette rồi build QSS."""
    return build_qss_from_palette(get_theme(theme_key), get_bundle())


# ---------- Test helper ----------

def _reset_cache_for_tests() -> None:
    """Test-only — clear cache nếu fixture muốn load từ tokens file tạm."""
    global _cache, _cache_path
    with _cache_lock:
        _cache = None
        _cache_path = None


__all__ = [
    "ThemeError",
    "ThemePalette",
    "TokensBundle",
    "load",
    "reload",
    "list_themes",
    "get_default_theme",
    "get_theme",
    "get_bundle",
    "resolve_alias",
    "build_qss_from_palette",
    "build_qss_from_theme",
    "FONT_STACK_BODY",
    "FONT_STACK_MONO",
]
