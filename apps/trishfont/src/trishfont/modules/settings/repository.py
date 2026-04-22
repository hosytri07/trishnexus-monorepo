"""Settings repository — generic key-value get/set backed by SQLite."""

from __future__ import annotations

from trishteam_core.store import Database


class SettingsRepository:
    def __init__(self, db: Database) -> None:
        self.db = db

    def get(self, key: str, default: str | None = None) -> str | None:
        cur = self.db.conn.cursor()
        row = cur.execute(
            "SELECT value FROM settings WHERE key = ?", (key,)
        ).fetchone()
        return row["value"] if row else default

    def set(self, key: str, value: str) -> None:
        with self.db.transaction() as cur:
            cur.execute(
                "INSERT INTO settings (key, value) VALUES (?, ?) "
                "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                (key, value),
            )

    def delete(self, key: str) -> None:
        with self.db.transaction() as cur:
            cur.execute("DELETE FROM settings WHERE key = ?", (key,))
