"""FontPack models — dataclass + migration 004.

Mỗi `FontPack` tương ứng 1 entry trong `manifest.json` top-level của repo
`trishnexus-fontpacks`. Xem docs/FONT-PACK-SYNC.md.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum


class PackStatus(str, Enum):
    """State của 1 pack trên máy user.

    - NOT_INSTALLED: manifest có pack, user chưa cài
    - INSTALLED:     bản cài giống version mới nhất
    - UPDATE:        bản cài cũ hơn version manifest
    """
    NOT_INSTALLED = "not_installed"
    INSTALLED     = "installed"
    UPDATE        = "update"


@dataclass
class FontPack:
    """1 font pack — tập hợp font đóng gói sẵn, download qua ZIP."""
    id: str                             # slug: "vietnamese-essentials"
    name: str                           # display: "Tiếng Việt — Cơ bản"
    description: str = ""
    version: str = "0.0.0"
    size_bytes: int = 0
    file_count: int = 0
    kind: str = "windows"               # "windows" | "autocad" | "mixed"
    tags: list[str] = field(default_factory=list)
    download_url: str = ""              # .zip URL
    sha256: str = ""
    preview_image: str = ""             # optional thumbnail URL

    # State local — fill khi load từ installed_packs table
    installed_version: str | None = None
    installed_at: str | None = None

    @property
    def status(self) -> PackStatus:
        if self.installed_version is None:
            return PackStatus.NOT_INSTALLED
        if self.installed_version != self.version:
            return PackStatus.UPDATE
        return PackStatus.INSTALLED


# SQL migration — lưu state pack đã cài local.
MIGRATION_004_FONTPACKS = """
CREATE TABLE IF NOT EXISTS installed_packs (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    pack_id           TEXT    NOT NULL UNIQUE,
    installed_version TEXT    NOT NULL,
    installed_at      TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    extract_path      TEXT    NOT NULL DEFAULT '',
    file_count        INTEGER NOT NULL DEFAULT 0,
    size_bytes        INTEGER NOT NULL DEFAULT 0,
    sha256            TEXT    NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_installed_packs_id ON installed_packs(pack_id);

CREATE TABLE IF NOT EXISTS manifest_cache (
    id          INTEGER PRIMARY KEY CHECK (id = 1),
    raw_json    TEXT    NOT NULL,
    fetched_at  TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
);
"""
