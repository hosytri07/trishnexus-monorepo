"""Path utilities — chuẩn platformdirs cho tất cả desktop app."""

from __future__ import annotations

from pathlib import Path

from platformdirs import user_data_dir


def user_data_dir_for(app_name: str) -> Path:
    p = Path(user_data_dir(app_name, appauthor="TrishTeam"))
    p.mkdir(parents=True, exist_ok=True)
    return p


def ensure_dir(path: str | Path) -> Path:
    p = Path(path)
    p.mkdir(parents=True, exist_ok=True)
    return p
