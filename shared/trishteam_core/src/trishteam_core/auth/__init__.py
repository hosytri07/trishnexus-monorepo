"""trishteam_core.auth — Firebase login + token persist + session lifecycle.

Module được refactor ở Phase 1.1 (task #73). Phân tách:

- `firebase_client` — HTTP wrapper quanh Firebase Auth REST API
- `token_store`    — Persist encrypted token (DPAPI / keyring / fallback)
- `session`        — Singleton user session + auto-refresh + role helpers

Quick import:

    from trishteam_core.auth import session, AuthError, SessionUser

    session.init(api_key="...")
    user = session.login_with_password("u@x.com", "pw")
    if session.has_role("admin"):
        ...
"""

from __future__ import annotations

from . import offline, session, sso_handler, token_store
from .firebase_client import AuthError, FirebaseClient
from .offline import OfflineChecker, ping
from .role_guard import require_role
from .session import SessionUser
from .sso_handler import (
    CloudConfig,
    DeepLinkAction,
    SSOError,
    WebHandoff,
    parse_deep_link_url,
)

# login_dialog require PyQt6 — import lazy để test/CI headless không crash.
# Caller muốn dùng: `from trishteam_core.auth.login_dialog import LoginDialog`

__all__ = [
    # Submodules hay dùng
    "session",
    "token_store",
    "offline",
    "sso_handler",
    # Types
    "FirebaseClient",
    "AuthError",
    "SessionUser",
    "SSOError",
    "DeepLinkAction",
    "CloudConfig",
    "WebHandoff",
    # Decorators
    "require_role",
    # Offline helpers
    "OfflineChecker",
    "ping",
    # SSO helpers hay dùng
    "parse_deep_link_url",
]
