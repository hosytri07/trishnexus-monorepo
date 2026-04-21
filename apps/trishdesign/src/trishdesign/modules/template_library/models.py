"""Models + SQLite migrations cho Template Library."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Optional


@dataclass
class Template:
    id: str                   # Firebase key hoặc uuid
    category: str             # "dam", "cot", "mong", "san", "cau_thang", ...
    name: str
    filename: str             # "DamBT_DƯL.xlsx"
    size_bytes: int
    remote_url: str           # URL Firebase Storage
    local_path: Optional[str] # null nếu chưa tải
    version: int              # tăng khi admin re-upload
    uploaded_at: datetime
    downloaded_at: Optional[datetime]
    description: str = ""


# Migration 1 — bảng chính
MIGRATION_001_TEMPLATES = """
CREATE TABLE IF NOT EXISTS templates (
    id           TEXT PRIMARY KEY,
    category     TEXT NOT NULL,
    name         TEXT NOT NULL,
    filename     TEXT NOT NULL,
    size_bytes   INTEGER NOT NULL,
    remote_url   TEXT NOT NULL,
    local_path   TEXT,
    version      INTEGER NOT NULL DEFAULT 1,
    uploaded_at  TEXT NOT NULL,
    downloaded_at TEXT,
    description  TEXT DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_templates_category ON templates(category);
"""

# Các category gợi ý (hiển thị trong sidebar filter)
DEFAULT_CATEGORIES = [
    ("all",       "Tất cả"),
    ("dam",       "Dầm"),
    ("cot",       "Cột"),
    ("mong",      "Móng"),
    ("san",       "Sàn"),
    ("cau_thang", "Cầu thang"),
    ("tuong",     "Tường chắn"),
    ("cong",      "Cống"),
    ("cau",       "Cầu"),
    ("khac",      "Khác"),
]
