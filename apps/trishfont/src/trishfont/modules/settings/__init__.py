"""Settings module — SQLite-backed key-value store + font library path resolver."""

from __future__ import annotations

from .models import MIGRATION_002_SETTINGS
from .paths import (
    FONT_LIBRARY_KEY,
    resolve_font_library_path,
    save_font_library_path,
)
from .repository import SettingsRepository

__all__ = [
    "MIGRATION_002_SETTINGS",
    "FONT_LIBRARY_KEY",
    "resolve_font_library_path",
    "save_font_library_path",
    "SettingsRepository",
]
