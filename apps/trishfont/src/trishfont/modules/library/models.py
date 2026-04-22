"""Library models — Font dataclass + SQL migrations.

Phase 2 update: thêm `folder_group`, `file_path`, `font_kind` để hỗ trợ:
- Folder-based categorization (user phân loại sẵn theo folder)
- AutoCAD .shx (font_kind='autocad')
- Install worker đọc file_path để biết source khi copy
"""

from __future__ import annotations

from dataclasses import dataclass


# Heuristic phân loại font category từ tên family — fallback khi folder_group rỗng.
CATEGORY_KEYWORDS = {
    "mono":    ["mono", "code", "consolas", "courier", "jetbrains", "fira"],
    "serif":   ["serif", "times", "georgia", "cambria", "garamond", "merriweather"],
    "display": ["display", "black", "script", "handwriting", "decorative"],
}
# Mặc định: sans_serif


def classify_font(family: str) -> str:
    """Trả về category heuristic: mono / serif / display / sans_serif.

    Chỉ dùng làm fallback khi không có folder_group (file nằm thẳng root).
    """
    lower = family.lower()
    for category, keywords in CATEGORY_KEYWORDS.items():
        for kw in keywords:
            if kw in lower:
                return category
    return "sans_serif"


# Heuristic chọn icon cho 1 folder_group dựa trên tên folder.
def icon_for_group(name: str) -> str:
    n = name.lower()
    if "shx" in n or "autocad" in n or "cad" in n:
        return "🛠"
    if "vni" in n or "tcvn" in n or "vietnam" in n or "việt" in n.lower():
        return "🇻🇳"
    if "sans" in n:
        return "🔤"
    if "serif" in n:
        return "📖"
    if "mono" in n or "code" in n:
        return "⌨"
    if "display" in n or "script" in n or "handwriting" in n:
        return "🎨"
    if "icon" in n or "symbol" in n:
        return "✨"
    return "📁"


# Stripe color rotation — đảm bảo nhiều folder vẫn đủ màu.
STRIPE_PALETTE = ["primary", "amber", "green", "cyan", "blue", "pink"]


def stripe_for_index(idx: int) -> str:
    return STRIPE_PALETTE[idx % len(STRIPE_PALETTE)]


@dataclass
class Font:
    id: int | None
    family: str
    category: str = "sans_serif"        # heuristic (fallback)
    vn_support: int = 0                 # 0/1 — có hỗ trợ glyph Tiếng Việt
    favorite: int = 0                   # 0/1
    created_at: str = ""
    folder_group: str = ""              # Phase 2: folder cha relative tới root scan
    file_path: str = ""                 # Phase 2: full path tới file (cho install)
    font_kind: str = "windows"          # 'windows' | 'autocad'


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


# Phase 2 — folder-aware + .shx support.
# SQLite không hỗ trợ ALTER nhiều cột trong 1 statement, tách 3 lệnh.
MIGRATION_003_FOLDER_KIND = """
ALTER TABLE fonts ADD COLUMN folder_group TEXT NOT NULL DEFAULT '';
ALTER TABLE fonts ADD COLUMN file_path    TEXT NOT NULL DEFAULT '';
ALTER TABLE fonts ADD COLUMN font_kind    TEXT NOT NULL DEFAULT 'windows';
CREATE INDEX IF NOT EXISTS idx_fonts_folder ON fonts(folder_group);
CREATE INDEX IF NOT EXISTS idx_fonts_kind   ON fonts(font_kind);
"""
