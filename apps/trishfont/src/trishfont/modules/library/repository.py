"""Font repository — scan curated folder, lưu vào SQLite, CRUD.

Đổi sang curated folder scan (thay vì system font scan) để:
- Tránh scan hàng trăm font hệ thống (chậm + nhiều font rác)
- Cho phép ship font folder kèm .exe sau này (offline + portable)
- User tự chọn thư mục chứa font sạch đã curate
"""

from __future__ import annotations

from pathlib import Path

from PyQt6.QtGui import QFontDatabase

from trishteam_core.store import Database

from .models import Font, classify_font


# Font file extensions hỗ trợ
FONT_EXTENSIONS = {".ttf", ".otf", ".ttc", ".otc"}


def _detect_vn_support(family: str) -> int:
    """Kiểm tra font có hỗ trợ glyph Tiếng Việt không.

    QFontDatabase.writingSystems(family) trả về list WritingSystem.
    Vietnamese là WritingSystem.Vietnamese.
    """
    try:
        systems = QFontDatabase.writingSystems(family)
        return 1 if QFontDatabase.WritingSystem.Vietnamese in systems else 0
    except Exception:
        return 0


class FontRepository:
    def __init__(self, db: Database) -> None:
        self.db = db

    def scan_folder(self, folder: Path) -> tuple[int, int, int]:
        """Scan folder (đệ quy) tìm font files, load vào Qt + upsert DB.

        Returns: (added, total_found, failed) — số font mới thêm, tổng file, số lỗi.
        """
        if not folder.exists() or not folder.is_dir():
            return (0, 0, 0)

        # Tìm tất cả font files đệ quy
        font_files = [
            p for p in folder.rglob("*")
            if p.is_file() and p.suffix.lower() in FONT_EXTENSIONS
        ]

        added = 0
        failed = 0
        families_seen: set[str] = set()

        for font_file in font_files:
            # Load font vào Qt application font database
            font_id = QFontDatabase.addApplicationFont(str(font_file))
            if font_id == -1:
                failed += 1
                continue

            # Mỗi file có thể chứa nhiều family (đặc biệt .ttc/.otc)
            families = QFontDatabase.applicationFontFamilies(font_id)
            for family in families:
                families_seen.add(family)

        # Upsert vào DB — 1 transaction cho tất cả
        with self.db.transaction() as cur:
            for family in families_seen:
                category = classify_font(family)
                vn = _detect_vn_support(family)
                # INSERT OR IGNORE để không override favorite state nếu đã có
                cur.execute(
                    "INSERT OR IGNORE INTO fonts (family, category, vn_support) VALUES (?, ?, ?)",
                    (family, category, vn),
                )
                if cur.rowcount > 0:
                    added += 1

        return (added, len(font_files), failed)

    def clear(self) -> None:
        """Xóa toàn bộ font records khỏi DB (giữ lại favorite? — không, reset hết).

        Dùng khi đổi folder scan hoặc rescan.
        """
        with self.db.transaction() as cur:
            cur.execute("DELETE FROM fonts")

    def list_all(
        self,
        *,
        search: str = "",
        category: str | None = None,
        only_favorite: bool = False,
        only_vn: bool = False,
    ) -> list[Font]:
        sql = "SELECT * FROM fonts WHERE 1=1"
        params: list = []
        if search:
            sql += " AND family LIKE ?"
            params.append(f"%{search}%")
        if category:
            sql += " AND category = ?"
            params.append(category)
        if only_favorite:
            sql += " AND favorite = 1"
        if only_vn:
            sql += " AND vn_support = 1"
        sql += " ORDER BY family ASC"

        cur = self.db.conn.cursor()
        rows = cur.execute(sql, params).fetchall()
        return [
            Font(
                id=r["id"],
                family=r["family"],
                category=r["category"],
                vn_support=r["vn_support"],
                favorite=r["favorite"],
                created_at=r["created_at"],
            )
            for r in rows
        ]

    def toggle_favorite(self, font_id: int) -> int:
        """Toggle favorite flag. Returns new favorite value (0 or 1)."""
        with self.db.transaction() as cur:
            cur.execute(
                "UPDATE fonts SET favorite = 1 - favorite WHERE id = ?",
                (font_id,),
            )
            row = cur.execute(
                "SELECT favorite FROM fonts WHERE id = ?", (font_id,)
            ).fetchone()
            return row["favorite"] if row else 0

    def count(self) -> int:
        cur = self.db.conn.cursor()
        return cur.execute("SELECT COUNT(*) FROM fonts").fetchone()[0]
