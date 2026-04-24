"""Test token_store — persist encrypted token qua multiple backend."""

from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import patch

import pytest

from trishteam_core.auth import token_store


SAMPLE = {
    "uid": "u1",
    "email": "u@x.com",
    "id_token": "id-token-xxx",
    "refresh_token": "r-token-yyy",
    "expires_at": 1234567890.0,
    "display_name": "Alice",
    "role": "admin",
    "avatar_url": "",
}


# ---------- Roundtrip (whatever backend is picked) ----------

def test_save_and_load_roundtrip():
    """Save → load phải trả đúng dict (dù backend nào)."""
    backend = token_store.save(SAMPLE)
    assert backend in {"dpapi", "keyring", "plaintext"}

    loaded = token_store.load()
    assert loaded == SAMPLE


def test_load_without_any_saved_returns_none():
    assert token_store.load() is None


def test_clear_removes_token():
    token_store.save(SAMPLE)
    assert token_store.load() is not None
    token_store.clear()
    assert token_store.load() is None


def test_clear_idempotent_when_empty():
    # Không raise kể cả chưa có gì
    token_store.clear()
    token_store.clear()


# ---------- Plaintext fallback backend ----------

def test_plaintext_fallback_when_no_backend(monkeypatch):
    """Nếu không có DPAPI + keyring thì dùng plaintext + warning."""
    monkeypatch.setattr(token_store, "_use_dpapi", lambda: False)
    monkeypatch.setattr(token_store, "_use_keyring", lambda: False)

    backend = token_store.save(SAMPLE)
    assert backend == "plaintext"
    # File phải tồn tại đúng vị trí
    assert token_store._plaintext_fallback_path().is_file()

    loaded = token_store.load()
    assert loaded == SAMPLE


def test_plaintext_file_has_valid_json(monkeypatch):
    monkeypatch.setattr(token_store, "_use_dpapi", lambda: False)
    monkeypatch.setattr(token_store, "_use_keyring", lambda: False)
    token_store.save(SAMPLE)
    raw = token_store._plaintext_fallback_path().read_bytes()
    # Phải parse được JSON
    assert json.loads(raw.decode("utf-8")) == SAMPLE


# ---------- Keyring backend with fake ----------

class _FakeKeyring:
    """Mock keyring with in-memory dict store."""
    def __init__(self): self._store = {}

    def set_password(self, service, user, pw):
        self._store[(service, user)] = pw

    def get_password(self, service, user):
        return self._store.get((service, user))

    def delete_password(self, service, user):
        if (service, user) not in self._store:
            import keyring.errors
            raise keyring.errors.PasswordDeleteError("not found")
        del self._store[(service, user)]


def test_keyring_backend_roundtrip(monkeypatch):
    """Keyring backend hoạt động khi available."""
    fake = _FakeKeyring()

    import sys
    import types
    fake_mod = types.ModuleType("keyring")
    fake_mod.set_password = fake.set_password
    fake_mod.get_password = fake.get_password
    fake_mod.delete_password = fake.delete_password

    fake_errors = types.ModuleType("keyring.errors")

    class PasswordDeleteError(Exception): pass
    fake_errors.PasswordDeleteError = PasswordDeleteError
    fake_mod.errors = fake_errors

    monkeypatch.setitem(sys.modules, "keyring", fake_mod)
    monkeypatch.setitem(sys.modules, "keyring.errors", fake_errors)
    monkeypatch.setattr(token_store, "_use_dpapi", lambda: False)
    monkeypatch.setattr(token_store, "_use_keyring", lambda: True)

    backend = token_store.save(SAMPLE)
    assert backend == "keyring"

    # Plaintext file KHÔNG được tạo
    assert not token_store._plaintext_fallback_path().is_file()

    loaded = token_store.load()
    assert loaded == SAMPLE


def test_corrupt_blob_returns_none_and_clears(monkeypatch):
    """Token bị corrupt → load() trả None + tự xoá."""
    monkeypatch.setattr(token_store, "_use_dpapi", lambda: False)
    monkeypatch.setattr(token_store, "_use_keyring", lambda: False)

    token_store._plaintext_fallback_path().parent.mkdir(parents=True, exist_ok=True)
    token_store._plaintext_fallback_path().write_bytes(b"\xff\xfe not-json garbage")

    assert token_store.load() is None
    # Sau load phát hiện corrupt → file bị clear
    assert not token_store._plaintext_fallback_path().is_file()


# ---------- backend_name reporting ----------

def test_backend_name_reports_current_pick(monkeypatch):
    monkeypatch.setattr(token_store, "_use_dpapi", lambda: False)
    monkeypatch.setattr(token_store, "_use_keyring", lambda: False)
    assert token_store.backend_name() == "plaintext"

    monkeypatch.setattr(token_store, "_use_keyring", lambda: True)
    assert token_store.backend_name() == "keyring"

    monkeypatch.setattr(token_store, "_use_dpapi", lambda: True)
    assert token_store.backend_name() == "dpapi"
