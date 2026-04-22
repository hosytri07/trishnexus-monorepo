"""Library models — Font dataclass + SQL migrations."""

from __future__ import annotations

from dataclasses import dataclass


# Heuristic phân loại font category từ tên family
CATEGORY_KEYWORDS = {
    "mono":    ["mono", "code", "consolas", "courier", "jetbrains", "fira"],
    "serif":   ["serif", "times", "georgia", "cambria", "garamond", "merriweather"],
    "display": ["display", "black", "script", "handwriting", "decorative"],
}
# Mặc định: sans_serif


def classify_font(family: str) -> str:
    """Trả về category: mono / serif / display / sans_serif."""
    lower = family.lower()
    for category, keywords in CATEGORY_KEYWORDS.items():
        for kw in keywords:
            if kw in lower:
                return category
    return "sans_serif"


@dataclass
class Font:
    id: int | None
    family: str
    category: str = "sans_serif"
    vn_support: int = 0           # 0/1 — có hỗ trợ glyph Tiếng Việt
    favorite: int = 0             # 0/1
    created_at: str = ""


MIGRATION_001_FONTS = """
CREATE TABLE IF NOT EXISTS fonts (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    family     TEXT    NOT NULL UNIQUE,
    category   TEXT    NOT NULL DEFAULT 'sans_serif',
    vn_support INTEGER NOT NULL DEFAULT 0,
    favorite   INTEGER NOT NULL DEFAULT 0,
    created_at TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fonts_family    ON fonts(family);
CREATE INDEX IF NOT EXISTS idx_fonts_favorite  ON fonts(favorite);
CREATE INDEX IF NOT EXISTS idx_fonts_category  ON fonts(category);
"""
