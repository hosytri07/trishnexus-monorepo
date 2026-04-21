"""Repository — đọc/ghi Template giữa SQLite local và Firebase Storage."""

from __future__ import annotations

import os
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import Iterable, Optional

import requests

from trishteam_core.store import Database

from .models import Template


class TemplateRepository:
    def __init__(self, db: Database, storage_url_base: str, download_dir: Path) -> None:
        self.db = db
        self.storage_url_base = storage_url_base.rstrip("/")
        self.download_dir = download_dir
        self.download_dir.mkdir(parents=True, exist_ok=True)

    # ---------- Local queries ----------

    def list_local(self, category: str = "all") -> list[Template]:
        cur = self.db.conn.cursor()
        if category == "all":
            rows = cur.execute("SELECT * FROM templates ORDER BY category, name").fetchall()
        else:
            rows = cur.execute(
                "SELECT * FROM templates WHERE category = ? ORDER BY name",
                (category,),
            ).fetchall()
        return [self._row_to_template(r) for r in rows]

    def upsert(self, tpl: Template) -> None:
        with self.db.transaction() as cur:
            cur.execute(
                """
                INSERT INTO templates (id, category, name, filename, size_bytes,
                    remote_url, local_path, version, uploaded_at, downloaded_at, description)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    category=excluded.category,
                    name=excluded.name,
                    filename=excluded.filename,
                    size_bytes=excluded.size_bytes,
                    remote_url=excluded.remote_url,
                    version=excluded.version,
                    uploaded_at=excluded.uploaded_at,
                    description=excluded.description
                """,
                (
                    tpl.id, tpl.category, tpl.name, tpl.filename, tpl.size_bytes,
                    tpl.remote_url, tpl.local_path, tpl.version,
                    tpl.uploaded_at.isoformat(),
                    tpl.downloaded_at.isoformat() if tpl.downloaded_at else None,
                    tpl.description,
                ),
            )

    # ---------- Remote sync ----------

    def refresh_catalog(self, id_token: str) -> int:
        """Gọi Firebase RTDB để lấy metadata tất cả templates admin đã upload.

        Giả định cấu trúc:
            /structural_templates/{id} = {category, name, filename, ...}
        """
        url = f"{self.storage_url_base}/structural_templates.json"
        r = requests.get(url, params={"auth": id_token}, timeout=15)
        r.raise_for_status()
        payload = r.json() or {}

        count = 0
        for tid, data in payload.items():
            tpl = Template(
                id=tid,
                category=data.get("category", "khac"),
                name=data.get("name", data.get("filename", "Untitled")),
                filename=data["filename"],
                size_bytes=int(data.get("size_bytes", 0)),
                remote_url=data["remote_url"],
                local_path=None,
                version=int(data.get("version", 1)),
                uploaded_at=datetime.fromisoformat(data["uploaded_at"]),
                downloaded_at=None,
                description=data.get("description", ""),
            )
            # Nếu đã có bản local cũ hơn → giữ local_path, chỉ update metadata
            existing = self._get(tpl.id)
            if existing and existing.local_path and existing.version >= tpl.version:
                tpl.local_path = existing.local_path
                tpl.downloaded_at = existing.downloaded_at
            self.upsert(tpl)
            count += 1
        return count

    def download(self, tpl: Template) -> Path:
        """Tải file Excel về local, lưu đường dẫn vào SQLite."""
        target = self.download_dir / tpl.filename
        r = requests.get(tpl.remote_url, stream=True, timeout=60)
        r.raise_for_status()
        with open(target, "wb") as f:
            for chunk in r.iter_content(chunk_size=8192):
                f.write(chunk)

        tpl.local_path = str(target)
        tpl.downloaded_at = datetime.now()
        self.upsert(tpl)
        return target

    # ---------- Open file bằng app OS mặc định ----------

    @staticmethod
    def open_with_system(path: Path) -> None:
        if sys.platform == "win32":
            os.startfile(path)  # type: ignore[attr-defined]
        elif sys.platform == "darwin":
            subprocess.run(["open", str(path)], check=False)
        else:
            subprocess.run(["xdg-open", str(path)], check=False)

    # ---------- Helpers ----------

    def _get(self, tid: str) -> Optional[Template]:
        row = self.db.conn.cursor().execute(
            "SELECT * FROM templates WHERE id = ?", (tid,)
        ).fetchone()
        return self._row_to_template(row) if row else None

    @staticmethod
    def _row_to_template(row) -> Template:
        return Template(
            id=row["id"],
            category=row["category"],
            name=row["name"],
            filename=row["filename"],
            size_bytes=row["size_bytes"],
            remote_url=row["remote_url"],
            local_path=row["local_path"],
            version=row["version"],
            uploaded_at=datetime.fromisoformat(row["uploaded_at"]),
            downloaded_at=datetime.fromisoformat(row["downloaded_at"]) if row["downloaded_at"] else None,
            description=row["description"] or "",
        )
