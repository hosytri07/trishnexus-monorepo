"""FontPackRepository — quản lý state pack local trong SQLite.

Tách riêng khỏi fetcher để test dễ hơn — fetcher không cần DB.
"""

from __future__ import annotations

from pathlib import Path

from trishteam_core.store import Database

from .models import FontPack


class FontPackRepository:
    def __init__(self, db: Database) -> None:
        self.db = db

    # ----- Manifest cache -----

    def save_manifest_cache(self, raw_json: str) -> None:
        """Upsert cache row id=1."""
        with self.db.transaction() as cur:
            cur.execute(
                """
                INSERT INTO manifest_cache (id, raw_json, fetched_at)
                VALUES (1, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(id) DO UPDATE SET
                    raw_json = excluded.raw_json,
                    fetched_at = CURRENT_TIMESTAMP
                """,
                (raw_json,),
            )

    def load_manifest_cache(self) -> tuple[str, str] | None:
        """Trả về (raw_json, fetched_at) nếu có cache, else None."""
        cur = self.db.conn.cursor()
        row = cur.execute(
            "SELECT raw_json, fetched_at FROM manifest_cache WHERE id = 1"
        ).fetchone()
        if not row:
            return None
        return (row["raw_json"], row["fetched_at"])

    # ----- Installed packs -----

    def list_installed(self) -> dict[str, tuple[str, str]]:
        """Trả về dict {pack_id: (installed_version, installed_at)}."""
        cur = self.db.conn.cursor()
        rows = cur.execute(
            "SELECT pack_id, installed_version, installed_at FROM installed_packs"
        ).fetchall()
        return {
            r["pack_id"]: (r["installed_version"], r["installed_at"])
            for r in rows
        }

    def mark_installed(
        self,
        pack_id: str,
        version: str,
        *,
        extract_path: Path,
        file_count: int,
        size_bytes: int,
        sha256: str = "",
    ) -> None:
        """Upsert installed_packs cho pack vừa cài (hoặc update)."""
        with self.db.transaction() as cur:
            cur.execute(
                """
                INSERT INTO installed_packs
                    (pack_id, installed_version, extract_path,
                     file_count, size_bytes, sha256, installed_at)
                VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(pack_id) DO UPDATE SET
                    installed_version = excluded.installed_version,
                    extract_path      = excluded.extract_path,
                    file_count        = excluded.file_count,
                    size_bytes        = excluded.size_bytes,
                    sha256            = excluded.sha256,
                    installed_at      = CURRENT_TIMESTAMP
                """,
                (pack_id, version, str(extract_path), file_count, size_bytes, sha256),
            )

    def mark_uninstalled(self, pack_id: str) -> None:
        with self.db.transaction() as cur:
            cur.execute(
                "DELETE FROM installed_packs WHERE pack_id = ?",
                (pack_id,),
            )

    def get_extract_path(self, pack_id: str) -> Path | None:
        cur = self.db.conn.cursor()
        row = cur.execute(
            "SELECT extract_path FROM installed_packs WHERE pack_id = ?",
            (pack_id,),
        ).fetchone()
        if not row or not row["extract_path"]:
            return None
        return Path(row["extract_path"])

    # ----- Helpers -----

    def hydrate_packs(self, packs: list[FontPack]) -> list[FontPack]:
        """Fill installed_version + installed_at từ DB → packs (in-place + return)."""
        installed = self.list_installed()
        for pack in packs:
            if pack.id in installed:
                ver, at = installed[pack.id]
                pack.installed_version = ver
                pack.installed_at = at
        return packs
