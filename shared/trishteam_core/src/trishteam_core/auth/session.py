"""session.py — Singleton user session + auto-refresh token.

Phase 1.1 (task #73 bis). Đây là facade chính mà app gọi. Bên dưới nó ghép:

- `firebase_client.FirebaseClient` — HTTP calls thuần
- `token_store` — persist encrypted
- logic dataclass `SessionUser` + auto-refresh khi sắp hết hạn

Public API (đủ cho 99% call site):

    from trishteam_core.auth import session

    # Bootstrap 1 lần ở main()
    session.init(api_key="AIza...")

    # Login (ví dụ LoginDialog gọi)
    user = session.login_with_password("user@x.com", "secret")

    # Truy xuất hiện tại
    u = session.current_user()          # SessionUser | None
    if session.has_role("admin"):
        ...

    # Logout
    session.logout()

    # Refresh nếu gần hết hạn — gọi định kỳ trong QTimer
    session.refresh_if_needed()

Thiết kế:

- **Singleton process-wide**: 1 process chỉ 1 user đang login. Không
  multi-tenant — đúng tinh thần desktop app. State giữ trong module-level
  `_state`.
- **Offline-aware**: nếu refresh fail vì network, giữ session hiện tại +
  mark `is_stale=True`. Caller (UI) đọc flag để hiện banner.
- **Role từ custom claims** — không decode JWT (tránh phụ thuộc
  pyjwt). Gọi `accounts:lookup` sau login để lấy `customAttributes` (là
  JSON string chứa `role`).
"""

from __future__ import annotations

import json
import logging
import threading
import time
from dataclasses import asdict, dataclass, field
from typing import Any, Optional

import requests

from . import token_store
from .firebase_client import AuthError, FirebaseClient

logger = logging.getLogger(__name__)


# ---------- Data types ----------

@dataclass
class SessionUser:
    """Snapshot của user đang login. Immutable trong lifetime của 1 session;
    refresh tạo instance mới.
    """

    uid: str
    email: str
    id_token: str
    refresh_token: str
    expires_at: float       # unix timestamp (giây)
    display_name: str = ""
    role: str = "user"      # "user" | "admin" | "dev"
    avatar_url: str = ""

    # Flag runtime — không persist
    is_stale: bool = field(default=False, metadata={"persist": False})

    def is_expired(self, buffer_sec: int = 60) -> bool:
        return time.time() >= self.expires_at - buffer_sec

    def seconds_until_expiry(self) -> float:
        return max(0.0, self.expires_at - time.time())


# ---------- Module-level singleton state ----------

class _State:
    def __init__(self) -> None:
        self.client: Optional[FirebaseClient] = None
        self.user: Optional[SessionUser] = None
        self.lock = threading.RLock()


_state = _State()


# ---------- Init / bootstrap ----------

def init(api_key: str, timeout: float = 10.0, *, auto_load: bool = True) -> None:
    """Khởi tạo singleton với Firebase project config.

    Gọi 1 lần ở main() trước bất kỳ auth call nào. Idempotent — gọi lại
    OK (thay client cũ, giữ user nếu đã login).

    Args:
        api_key: Firebase Web API key.
        timeout: HTTP timeout cho mọi call.
        auto_load: True → đọc token từ disk (nếu có) để restore session
                   ngay. Muốn lazy thì False rồi gọi `load_from_disk()`.
    """
    with _state.lock:
        _state.client = FirebaseClient(api_key=api_key, timeout=timeout)
        if auto_load and _state.user is None:
            load_from_disk()


def _require_client() -> FirebaseClient:
    if _state.client is None:
        raise RuntimeError(
            "session.init(api_key=...) chưa được gọi. "
            "Gọi ở main() trước khi dùng auth API."
        )
    return _state.client


# ---------- Persistence ----------

def _persist(user: SessionUser) -> None:
    """Serialize user → token_store. Không persist `is_stale`."""
    data = asdict(user)
    data.pop("is_stale", None)
    backend = token_store.save(data)
    logger.debug("Session saved (backend=%s, user=%s)", backend, user.email)


def load_from_disk() -> Optional[SessionUser]:
    """Đọc token_store, set singleton user nếu hợp lệ. Không refresh."""
    data = token_store.load()
    if not data:
        return None
    try:
        user = SessionUser(**data)
    except TypeError as e:
        logger.warning("Token format cũ / lạ (%s) — xoá và login lại.", e)
        token_store.clear()
        return None

    with _state.lock:
        _state.user = user
    return user


# ---------- Login / Logout ----------

def login_with_password(email: str, password: str) -> SessionUser:
    """Login bằng email + password, lưu token, trả SessionUser."""
    client = _require_client()
    resp = client.sign_in_with_password(email, password)
    user = _build_user_from_signin(resp, fallback_email=email)

    # Lookup để lấy custom claims (role) — nếu lookup fail (vd network
    # flap giữa signIn và lookup), vẫn giữ session với role mặc định.
    try:
        user = _enrich_with_claims(client, user)
    except (AuthError, requests.RequestException) as e:
        logger.warning("Lookup claims sau login fail: %s — dùng role 'user'.", e)

    with _state.lock:
        _state.user = user
        _persist(user)
    return user


def sign_up_with_password(email: str, password: str) -> SessionUser:
    """Tạo account mới + auto-login. Server set role mặc định 'user'."""
    client = _require_client()
    resp = client.sign_up_with_password(email, password)
    user = _build_user_from_signin(resp, fallback_email=email)
    with _state.lock:
        _state.user = user
        _persist(user)
    return user


def send_password_reset_email(email: str) -> None:
    """Gửi email reset. Không thay state — chỉ wrap tiện gọi từ UI."""
    _require_client().send_password_reset_email(email)


def logout() -> None:
    """Xoá session khỏi memory + disk. Idempotent."""
    with _state.lock:
        _state.user = None
    token_store.clear()


# ---------- Refresh ----------

def refresh_if_needed(buffer_sec: int = 600) -> Optional[SessionUser]:
    """Refresh nếu id_token sắp hết hạn (< buffer_sec). Gọi định kỳ từ
    QTimer. Trả SessionUser mới (nếu refresh) hoặc session hiện tại.

    Network fail → mark `is_stale=True`, trả session cũ (offline mode).
    Refresh API fail với error code → clear session + raise AuthError.
    """
    with _state.lock:
        user = _state.user
    if user is None:
        return None
    if not user.is_expired(buffer_sec=buffer_sec):
        return user

    client = _require_client()
    try:
        resp = client.refresh_id_token(user.refresh_token)
    except requests.RequestException as e:
        logger.info("Refresh fail (network): %s — dùng token cũ (stale).", e)
        with _state.lock:
            if _state.user:
                _state.user.is_stale = True
        return _state.user
    except AuthError as e:
        logger.error("Refresh fail (auth): %s — logout.", e.code)
        logout()
        raise

    # refresh endpoint trả snake_case khác signIn → map lại
    refreshed = SessionUser(
        uid=resp.get("user_id", user.uid),
        email=user.email,
        display_name=user.display_name,
        role=user.role,
        avatar_url=user.avatar_url,
        id_token=resp["id_token"],
        refresh_token=resp.get("refresh_token", user.refresh_token),
        expires_at=time.time() + int(resp.get("expires_in", 3600)),
    )
    with _state.lock:
        _state.user = refreshed
        _persist(refreshed)
    return refreshed


# ---------- Read helpers ----------

def current_user() -> Optional[SessionUser]:
    """Snapshot user hiện tại (không refresh, không lookup)."""
    with _state.lock:
        return _state.user


def is_logged_in() -> bool:
    return current_user() is not None


def has_role(*roles: str) -> bool:
    """True nếu user login và role khớp 1 trong các role truyền vào."""
    u = current_user()
    if u is None:
        return False
    return u.role in roles


# ---------- Internals ----------

def _build_user_from_signin(resp: dict[str, Any], fallback_email: str) -> SessionUser:
    return SessionUser(
        uid=resp["localId"],
        email=resp.get("email", fallback_email),
        display_name=resp.get("displayName", ""),
        role="user",  # sẽ được override bởi _enrich_with_claims
        id_token=resp["idToken"],
        refresh_token=resp["refreshToken"],
        expires_at=time.time() + int(resp.get("expiresIn", 3600)),
    )


def _enrich_with_claims(client: FirebaseClient, user: SessionUser) -> SessionUser:
    """Gọi accounts:lookup để lấy customAttributes.role + displayName."""
    resp = client.lookup_account(user.id_token)
    users = resp.get("users", [])
    if not users:
        return user
    me = users[0]
    role = user.role
    # Firebase trả customAttributes là JSON string: '{"role":"admin"}'
    if ca := me.get("customAttributes"):
        try:
            claims = json.loads(ca)
            role = claims.get("role", role)
        except ValueError:
            logger.warning("customAttributes không phải JSON hợp lệ: %r", ca)
    return SessionUser(
        uid=user.uid,
        email=me.get("email", user.email),
        display_name=me.get("displayName", user.display_name),
        role=role,
        avatar_url=me.get("photoUrl", user.avatar_url),
        id_token=user.id_token,
        refresh_token=user.refresh_token,
        expires_at=user.expires_at,
    )


__all__ = [
    "SessionUser",
    "init",
    "login_with_password",
    "sign_up_with_password",
    "send_password_reset_email",
    "logout",
    "refresh_if_needed",
    "current_user",
    "is_logged_in",
    "has_role",
    "load_from_disk",
]
