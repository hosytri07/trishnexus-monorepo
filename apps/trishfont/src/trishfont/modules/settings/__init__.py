"""Settings module — SQLite-backed key-value store + font library path resolver."""

from __future__ import annotations

from .models import MIGRATION_002_SETTINGS
from .paths import (
    FONT_LIBRARY_KEY,
    FONTPACK_CLOUD_SYNC_KEY,
    is_cloud_sync_enabled,
    resolve_font_library_path,
    save_font_library_path,
    set_cloud_sync_enabled,
)
from .repository import SettingsRepository

__all__ = [
    "MIGRATION_002_SETTINGS",
    "FONT_LIBRARY_KEY",
    "FONTPACK_CLOUD_SYNC_KEY",
    "is_cloud_sync_enabled",
    "set_cloud_sync_enabled",
    "resolve_font_library_path",
    "save_font_library_path",
    "SettingsRepository",
]
