"""Test fixtures cho trishteam_core — isolate mỗi test khỏi real user data dir.

Fixture chính:
- `isolate_user_data_dir` (auto): point `platformdirs.user_data_dir` sang
  tempdir riêng mỗi test → token_store không động vào file thật của dev.
- `reset_session` (auto): clear singleton state giữa các test — tránh
  leak user login từ test này sang test khác.
"""

from __future__ import annotations

import os
import tempfile
from pathlib import Path

import pytest


@pytest.fixture(autouse=True)
def isolate_user_data_dir(monkeypatch, tmp_path: Path) -> Path:
    """Đặt env var platformdirs dùng để tính user_data_dir() → tempdir."""
    monkeypatch.setenv("XDG_DATA_HOME", str(tmp_path))
    monkeypatch.setenv("APPDATA", str(tmp_path))  # Windows platformdirs
    monkeypatch.setenv("LOCALAPPDATA", str(tmp_path))
    return tmp_path


@pytest.fixture(autouse=True)
def reset_session_state():
    """Clear module-level state giữa các test."""
    from trishteam_core.auth import session
    session._state.user = None
    session._state.client = None
    yield
    session._state.user = None
    session._state.client = None
