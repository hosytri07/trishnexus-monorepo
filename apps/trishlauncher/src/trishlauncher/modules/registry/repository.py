"""Registry repository — CRUD installed_apps + cache."""

from __future__ import annotations

from datetime import datetime

from trishteam_core.store import Database


class RegistryRepository:
    def __init__(self, db: Database) -> None:
        self.db = db

    # ----- registry_cache -----

    def save_cache(self, raw_json: str) -> None:
        with self.db.transaction() as cur:
            cur.execute(
                """
                INSERT INTO registry_cache (id, raw_json, fetched_at)
                VALUES (1, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    raw_json   = excluded.raw_json,
                    fetched_at = excluded.fetched_at
                """,
                (raw_json, datetime.utcnow().isoformat()),
            )

    def load_cache(self) -> tuple[str, str] | None:
        cur = self.db.conn.cursor()
        row = cur.execute(
            "SELECT raw_json, fetched_at FROM registry_cache WHERE id = 1"
        ).fetchone()
        if not row:
            return None
        return (row["raw_json"], row["fetched_at"])

    # ----- installed_apps -----

    def get_installed(self, app_id: str) -> tuple[str, str] | None:
        cur = self.db.conn.cursor()
        row = cur.execute(
            "SELECT installed_version, install_path FROM installed_apps WHERE app_id = ?",
            (app_id,),
        ).fetchone()
        if not row:
            return None
        return (row["installed_version"], row["install_path"])

    def mark_installed(
        self,
        app_id: str,
        version: str,
        install_path: str = "",
    ) -> None:
        with self.db.transaction() as cur:
            cur.execute(
                """
                INSERT INTO installed_apps (app_id, installed_version, install_path)
                VALUES (?, ?, ?)
                ON CONFLICT(app_id) DO UPDATE SET
                    installed_version = excluded.installed_version,
                    install_path      = excluded.install_path,
                    last_check_at     = CURRENT_TIMESTAMP
                """,
                (app_id, version, install_path),
            )

    def mark_uninstalled(self, app_id: str) -> None:
        with self.db.transaction() as cur:
            cur.execute("DELETE FROM installed_apps WHERE app_id = ?", (app_id,))

    def list_installed(self) -> dict[str, str]:
        """Return {app_id: installed_version}."""
        cur = self.db.conn.cursor()
        rows = cur.execute(
            "SELECT app_id, installed_version FROM installed_apps"
        ).fetchall()
        return {r["app_id"]: r["installed_version"] for r in rows}
