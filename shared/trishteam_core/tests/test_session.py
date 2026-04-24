"""Test session singleton — login, refresh, logout, role lookup."""

from __future__ import annotations

import time
from unittest.mock import MagicMock

import pytest
import requests

from trishteam_core.auth import session, token_store
from trishteam_core.auth.firebase_client import AuthError, FirebaseClient
from trishteam_core.auth.session import SessionUser


# ---------- Fixture: fake FirebaseClient injected vào singleton ----------

class FakeClient:
    """Controllable fake for session tests."""
    def __init__(self):
        self.refresh_calls = 0
        self.sign_in_payload = {
            "localId": "u1", "email": "u@x.com", "idToken": "id1",
            "refreshToken": "r1", "expiresIn": "3600", "displayName": "Alice",
        }
        self.lookup_payload = {
            "users": [{
                "email": "u@x.com",
                "displayName": "Alice",
                "customAttributes": '{"role":"admin"}',
                "photoUrl": "",
            }]
        }
        self.refresh_payload = {
            "user_id": "u1", "id_token": "id2",
            "refresh_token": "r2", "expires_in": "3600",
        }
        self.sign_in_error = None  # nếu set → raise
        self.lookup_error = None
        self.refresh_error = None

    def sign_in_with_password(self, email, password):
        if self.sign_in_error:
            raise self.sign_in_error
        return self.sign_in_payload

    def sign_up_with_password(self, email, password):
        return self.sign_in_payload

    def send_password_reset_email(self, email):
        return {"email": email}

    def lookup_account(self, id_token):
        if self.lookup_error:
            raise self.lookup_error
        return self.lookup_payload

    def refresh_id_token(self, refresh_token):
        self.refresh_calls += 1
        if self.refresh_error:
            raise self.refresh_error
        return self.refresh_payload


@pytest.fixture
def fake_client():
    client = FakeClient()
    session._state.client = client  # bypass init()
    yield client


# ---------- SessionUser dataclass ----------

def test_session_user_expired_check():
    u = SessionUser(
        uid="u", email="e", id_token="t", refresh_token="r",
        expires_at=time.time() + 3600,
    )
    assert not u.is_expired()
    u.expires_at = time.time() - 10
    assert u.is_expired()


def test_session_user_default_role_is_user():
    u = SessionUser(uid="u", email="e", id_token="t", refresh_token="r", expires_at=1.0)
    assert u.role == "user"
    assert u.is_stale is False


# ---------- init() ----------

def test_init_creates_client_with_api_key():
    session.init(api_key="AIza-xyz")
    assert session._state.client is not None
    assert session._state.client.api_key == "AIza-xyz"


def test_require_client_raises_if_init_not_called():
    # fixture `reset_session_state` đã clear rồi
    with pytest.raises(RuntimeError, match="session.init"):
        session.login_with_password("u@x.com", "pw")


# ---------- login flow ----------

def test_login_with_password_returns_session_user(fake_client):
    user = session.login_with_password("u@x.com", "pw")
    assert isinstance(user, SessionUser)
    assert user.uid == "u1"
    assert user.email == "u@x.com"
    assert user.display_name == "Alice"


def test_login_enriches_role_from_custom_claims(fake_client):
    user = session.login_with_password("u@x.com", "pw")
    assert user.role == "admin"  # from customAttributes JSON


def test_login_persists_token_to_disk(fake_client):
    session.login_with_password("u@x.com", "pw")
    saved = token_store.load()
    assert saved is not None
    assert saved["uid"] == "u1"
    assert saved["role"] == "admin"
    # is_stale không được persist
    assert "is_stale" not in saved


def test_login_with_lookup_fail_falls_back_to_default_role(fake_client):
    fake_client.lookup_error = requests.ConnectionError("net flap")
    user = session.login_with_password("u@x.com", "pw")
    assert user.uid == "u1"
    assert user.role == "user"  # default khi không lookup được


def test_login_firebase_error_propagates(fake_client):
    fake_client.sign_in_error = AuthError("INVALID_PASSWORD", "...")
    with pytest.raises(AuthError) as exc:
        session.login_with_password("u@x.com", "wrong")
    assert exc.value.code == "INVALID_PASSWORD"


def test_login_malformed_custom_attrs_keeps_default_role(fake_client):
    fake_client.lookup_payload = {"users": [{"customAttributes": "not-json"}]}
    user = session.login_with_password("u@x.com", "pw")
    assert user.role == "user"


# ---------- current_user / is_logged_in / has_role ----------

def test_has_role_returns_false_when_not_logged_in():
    assert not session.is_logged_in()
    assert not session.has_role("admin")
    assert session.current_user() is None


def test_has_role_matches_on_multiple(fake_client):
    session.login_with_password("u@x.com", "pw")  # role=admin
    assert session.has_role("admin")
    assert session.has_role("admin", "dev")
    assert not session.has_role("dev")


# ---------- refresh_if_needed ----------

def test_refresh_noop_when_token_fresh(fake_client):
    session.login_with_password("u@x.com", "pw")
    session._state.user.expires_at = time.time() + 3600
    fake_client.refresh_calls = 0

    session.refresh_if_needed(buffer_sec=60)
    assert fake_client.refresh_calls == 0


def test_refresh_triggers_when_close_to_expiry(fake_client):
    session.login_with_password("u@x.com", "pw")
    session._state.user.expires_at = time.time() + 30  # sắp expire
    fake_client.refresh_calls = 0

    refreshed = session.refresh_if_needed(buffer_sec=60)
    assert fake_client.refresh_calls == 1
    assert refreshed.id_token == "id2"
    assert refreshed.refresh_token == "r2"
    # Role phải preserve qua refresh
    assert refreshed.role == "admin"


def test_refresh_network_fail_marks_stale_not_logout(fake_client):
    session.login_with_password("u@x.com", "pw")
    session._state.user.expires_at = time.time() + 10
    fake_client.refresh_error = requests.ConnectionError("offline")

    result = session.refresh_if_needed(buffer_sec=60)
    assert result is not None              # vẫn còn session
    assert result.is_stale is True         # mark stale
    assert session.is_logged_in()          # KHÔNG logout


def test_refresh_auth_error_logs_out(fake_client):
    session.login_with_password("u@x.com", "pw")
    session._state.user.expires_at = time.time() + 10
    fake_client.refresh_error = AuthError("TOKEN_EXPIRED")

    with pytest.raises(AuthError):
        session.refresh_if_needed(buffer_sec=60)
    assert not session.is_logged_in()
    assert token_store.load() is None


def test_refresh_returns_none_when_no_user(fake_client):
    assert session.refresh_if_needed() is None


# ---------- logout ----------

def test_logout_clears_memory_and_disk(fake_client):
    session.login_with_password("u@x.com", "pw")
    assert session.is_logged_in()
    assert token_store.load() is not None

    session.logout()
    assert not session.is_logged_in()
    assert token_store.load() is None


def test_logout_idempotent(fake_client):
    session.logout()
    session.logout()  # không raise


# ---------- load_from_disk ----------

def test_load_from_disk_restores_session():
    # Save token manually
    token_store.save({
        "uid": "u1", "email": "e@x.com", "id_token": "t", "refresh_token": "r",
        "expires_at": time.time() + 3600, "display_name": "", "role": "dev",
        "avatar_url": "",
    })
    user = session.load_from_disk()
    assert user is not None
    assert user.role == "dev"
    assert session.is_logged_in()


def test_load_from_disk_wipes_corrupt_shape():
    token_store.save({"garbage": "field"})
    user = session.load_from_disk()
    assert user is None
    assert token_store.load() is None  # bị wipe vì shape lạ
