"""Font repository — scan curated folder, lưu vào SQLite, CRUD.

Phase 2:
- Folder-based grouping: gán `folder_group` = top-level folder relative tới root.
- AutoCAD .shx support: `font_kind='autocad'`, không Qt-load (vì .shx là vector
  font theo chuẩn riêng của Autodesk, không phải OpenType).
- Lưu `file_path` để install worker biết source file.
"""

from __future__ import annotations

from pathlib import Path

from PyQt6.QtGui import QFontDatabase

from trishteam_core.store import Database

from .models import Font, classify_font


# Font file extensions hỗ trợ — .shx là AutoCAD compiled shape font.
WINDOWS_FONT_EXTS = {".ttf", ".otf", ".ttc", ".otc"}
AUTOCAD_FONT_EXTS = {".shx"}
FONT_EXTENSIONS = WINDOWS_FONT_EXTS | AUTOCAD_FONT_EXTS


def _detect_vn_support(family: str) -> int:
    """Kiểm tra font có hỗ trợ glyph Tiếng Việt không."""
    try:
        systems = QFontDatabase.writingSystems(family)
        return 1 if QFontDatabase.WritingSystem.Vietnamese in systems else 0
    except Exception:
        return 0


def _folder_group(file: Path, root: Path) -> str:
    """Trả về tên top-level folder relative tới root.

    Ví dụ root=G:/FontLibrary, file=G:/FontLibrary/Sans Serif/Inter/Inter.ttf
    → "Sans Serif". File nằm thẳng root → "(Root)".
    """
    try:
        rel = file.relative_to(root)
        parts = rel.parts
        # parts[-1] là tên file; nếu chỉ 1 phần → file nằm thẳng root.
        if len(parts) <= 1:
            return "(Root)"
        return parts[0]
    except ValueError:
        return "(Root)"


class FontRepository:
    def __init__(self, db: Database) -> None:
        self.db = db

    def scan_folder(self, folder: Path) -> tuple[int, int, int]:
        """Scan folder (đệ quy) tìm font files, load vào Qt + upsert DB.

        Returns: (added, total_found, failed).
        """
        if not folder.exists() or not folder.is_dir():
            return (0, 0, 0)

        font_files = [
            p for p in folder.rglob("*")
            if p.is_file() and p.suffix.lower() in FONT_EXTENSIONS
        ]

        added = 0
        failed = 0
        # (family, folder_group, file_path, kind, vn_support, category)
        rows_to_upsert: list[tuple[str, str, str, str, int, str]] = []
        seen_keys: set[str] = set()

        for font_file in font_files:
            ext = font_file.suffix.lower()
            group = _folder_group(font_file, folder)
            full_path = str(font_file)

            if ext in AUTOCAD_FONT_EXTS:
                # .shx — không Qt-load, dùng filename làm "family"
                family = font_file.stem
                key = f"shx:{family}:{group}"
                if key in seen_keys:
                    continue
                seen_keys.add(key)
                rows_to_upsert.append(
                    (family, group, full_path, "autocad", 0, "autocad")
                )
                continue

            # Windows font (.ttf/.otf/.ttc/.otc) — load qua QFontDatabase
            font_id = QFontDatabase.addApplicationFont(full_path)
            if font_id == -1:
                failed += 1
                continue

            families = QFontDatabase.applicationFontFamilies(font_id)
            for family in families:
                key = f"win:{family}"
                if key in seen_keys:
                    continue
                seen_keys.add(key)
                vn = _detect_vn_support(family)
                category = classify_font(family)
                rows_to_upsert.append(
                    (family, group, full_path, "windows", vn, category)
                )

        # Bulk upsert — 1 transaction
        with self.db.transaction() as cur:
            for family, group, fpath, kind, vn, category in rows_to_upsert:
                cur.execute(
                    """
                    INSERT OR IGNORE INTO fonts
                        (family, category, vn_support, folder_group, file_path, font_kind)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (family, category, vn, group, fpath, kind),
                )
                if cur.rowcount > 0:
                    added += 1
                else:
                    # Family đã tồn tại — update folder_group + file_path nếu trống
                    cur.execute(
                        """
                        UPDATE fonts
                           SET folder_group = CASE WHEN folder_group = '' THEN ? ELSE folder_group END,
                               file_path    = CASE WHEN file_path    = '' THEN ? ELSE file_path    END,
                               font_kind    = CASE WHEN font_kind    = ''
                                                    OR font_kind IS NULL THEN ? ELSE font_kind END
                         WHERE family = ?
                        """,
                        (group, fpath, kind, family),
                    )

        return (added, len(font_files), failed)

    def clear(self) -> None:
        """Xóa toàn bộ font records."""
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
        sql += " ORDER BY folder_group ASC, family ASC"

        cur = self.db.conn.cursor()
        rows = cur.execute(sql, params).fetchall()
        return [self._row_to_font(r) for r in rows]

    def list_groups(self) -> list[tuple[str, int]]:
        """Trả về list (folder_group, count) — dùng để render CardGroup động.

        Sắp xếp: '(Root)' đầu tiên, còn lại alpha. Nếu folder_group rỗng thì
        gom vào '(Root)'.
        """
        cur = self.db.conn.cursor()
        rows = cur.execute(
            """
            SELECT COALESCE(NULLIF(folder_group, ''), '(Root)') AS g,
                   COUNT(*) AS n
              FROM fonts
             GROUP BY g
             ORDER BY (g = '(Root)') DESC, g ASC
            """
        ).fetchall()
        return [(r["g"], r["n"]) for r in rows]

    def list_by_group(self, group: str) -> list[Font]:
        """Liệt font theo folder_group (dùng khi render CardGroup)."""
        cur = self.db.conn.cursor()
        rows = cur.execute(
            """
            SELECT * FROM fonts
             WHERE COALESCE(NULLIF(folder_group, ''), '(Root)') = ?
             ORDER BY family ASC
            """,
            (group,),
        ).fetchall()
        return [self._row_to_font(r) for r in rows]

    def toggle_favorite(self, font_id: int) -> int:
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

    # ---------- Internal ----------

    def _row_to_font(self, r) -> Font:
        # Backward-compat: Phase 1 DB rows không có folder_group/file_path/font_kind.
        keys = r.keys()
        return Font(
            id=r["id"],
            family=r["family"],
            category=r["category"],
            vn_support=r["vn_support"],
            favorite=r["favorite"],
            created_at=r["created_at"],
            folder_group=r["folder_group"] if "folder_group" in keys else "",
            file_path=r["file_path"] if "file_path" in keys else "",
            font_kind=r["font_kind"] if "font_kind" in keys else "windows",
        )
