"""Font library path resolution.

Priority (highest first):
  1. SQLite settings.font_library_path (user-set qua UI)
  2. Env var TRISHFONT_FONT_DIR (dev override)
  3. Prod default: Path(sys.executable).parent / "fonts"  (PyInstaller bundle)
  4. None → caller trigger folder picker UI
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

from .repository import SettingsRepository


FONT_LIBRARY_KEY = "font_library_path"


def resolve_font_library_path(settings: SettingsRepository) -> Path | None:
    """Return Path tới folder chứa font curated, hoặc None nếu chưa set."""
    # 1. User setting từ SQLite
    val = settings.get(FONT_LIBRARY_KEY)
    if val:
        p = Path(val)
        if p.exists() and p.is_dir():
            return p

    # 2. Env var override (dev mode)
    env = os.environ.get("TRISHFONT_FONT_DIR")
    if env:
        p = Path(env)
        if p.exists() and p.is_dir():
            return p

    # 3. Prod default — font folder cạnh exe (khi build PyInstaller)
    if getattr(sys, "frozen", False):
        p = Path(sys.executable).parent / "fonts"
        if p.exists() and p.is_dir():
            return p

    return None


def save_font_library_path(settings: SettingsRepository, path: Path) -> None:
    """Lưu path user chọn vào SQLite."""
    settings.set(FONT_LIBRARY_KEY, str(path))
