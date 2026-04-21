"""Database — SQLite wrapper với migration tuần tự.

Chuẩn: mỗi app đặt DB file vào platformdirs.user_data_dir("TrishApp"), chạy `migrate()` lúc start.
"""

from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Iterable

from platformdirs import user_data_dir


def default_db_path(app_name: str, filename: str = "data.db") -> Path:
    base = Path(user_data_dir(app_name, appauthor="TrishTeam"))
    base.mkdir(parents=True, exist_ok=True)
    return base / filename


class Database:
    def __init__(self, db_path: str | Path):
        self.path = Path(db_path)
        self._conn: sqlite3.Connection | None = None

    @property
    def conn(self) -> sqlite3.Connection:
        if self._conn is None:
            self._conn = sqlite3.connect(self.path)
            self._conn.row_factory = sqlite3.Row
            self._conn.execute("PRAGMA foreign_keys = ON;")
            self._conn.execute("PRAGMA journal_mode = WAL;")
        return self._conn

    @contextmanager
    def transaction(self):
        cur = self.conn.cursor()
        try:
            yield cur
            self.conn.commit()
        except Exception:
            self.conn.rollback()
            raise
        finally:
            cur.close()

    def close(self) -> None:
        if self._conn:
            self._conn.close()
            self._conn = None


def migrate(db: Database, migrations: Iterable[tuple[int, str]]) -> int:
    """Chạy các migration theo thứ tự version tăng dần.

    `migrations` là iterable các tuple (version:int, sql:str).
    Giữ version hiện tại trong PRAGMA user_version.
    """
    cur = db.conn.cursor()
    current = cur.execute("PRAGMA user_version;").fetchone()[0]
    applied = 0
    for version, sql in sorted(migrations):
        if version <= current:
            continue
        with db.transaction() as c:
            c.executescript(sql)
            c.execute(f"PRAGMA user_version = {version};")
        applied += 1
    return applied
