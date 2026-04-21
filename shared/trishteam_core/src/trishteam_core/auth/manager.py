"""AuthManager — Firebase Auth wrapper dùng chung cho tất cả desktop app.

Features:
- Email/password login
- Refresh token trong keyring (không lưu plaintext)
- Tự auto-refresh trước khi hết hạn
- Offline fallback: nếu không có mạng, trả UserSession từ keyring nếu còn refresh_token
"""

from __future__ import annotations

import json
import time
from dataclasses import dataclass
from typing import Optional

import keyring
import requests


class AuthError(Exception):
    """Raised khi login/refresh thất bại."""


@dataclass
class UserSession:
    uid: str
    email: str
    id_token: str
    refresh_token: str
    expires_at: float  # unix timestamp

    def is_expired(self) -> bool:
        return time.time() >= self.expires_at - 60  # buffer 1 phút


class AuthManager:
    """Firebase Auth REST client.

    Args:
        api_key: Firebase Web API key.
        app_name: dùng làm keyring service name (mỗi desktop app có session riêng).
    """

    BASE_URL = "https://identitytoolkit.googleapis.com/v1"
    REFRESH_URL = "https://securetoken.googleapis.com/v1/token"

    def __init__(self, api_key: str, app_name: str = "trishteam") -> None:
        self.api_key = api_key
        self.keyring_service = f"{app_name}.auth"

    # ---------- Login / Logout ----------

    def login(self, email: str, password: str) -> UserSession:
        r = requests.post(
            f"{self.BASE_URL}/accounts:signInWithPassword",
            params={"key": self.api_key},
            json={"email": email, "password": password, "returnSecureToken": True},
            timeout=10,
        )
        if r.status_code != 200:
            raise AuthError(r.json().get("error", {}).get("message", "LOGIN_FAILED"))
        data = r.json()
        session = UserSession(
            uid=data["localId"],
            email=data["email"],
            id_token=data["idToken"],
            refresh_token=data["refreshToken"],
            expires_at=time.time() + int(data["expiresIn"]),
        )
        self._save(session)
        return session

    def logout(self) -> None:
        try:
            keyring.delete_password(self.keyring_service, "session")
        except keyring.errors.PasswordDeleteError:
            pass

    # ---------- Token refresh ----------

    def current_session(self, *, offline_ok: bool = True) -> Optional[UserSession]:
        """Trả session còn hạn, tự refresh nếu cần.

        offline_ok=True: nếu mất mạng, trả session cũ (dù token hết hạn) để app chạy offline.
        """
        session = self._load()
        if session is None:
            return None
        if not session.is_expired():
            return session
        try:
            return self._refresh(session.refresh_token)
        except (AuthError, requests.RequestException):
            if offline_ok:
                return session  # cho phép chạy offline với token cũ
            raise

    def _refresh(self, refresh_token: str) -> UserSession:
        r = requests.post(
            self.REFRESH_URL,
            params={"key": self.api_key},
            data={"grant_type": "refresh_token", "refresh_token": refresh_token},
            timeout=10,
        )
        if r.status_code != 200:
            raise AuthError("TOKEN_REFRESH_FAILED")
        data = r.json()
        # /token trả về field khác /signInWithPassword — note tên field
        session = UserSession(
            uid=data["user_id"],
            email="",  # refresh không trả email, lấy từ cache nếu cần
            id_token=data["id_token"],
            refresh_token=data["refresh_token"],
            expires_at=time.time() + int(data["expires_in"]),
        )
        # giữ email cũ nếu có
        old = self._load()
        if old:
            session.email = old.email
        self._save(session)
        return session

    # ---------- Keyring I/O ----------

    def _save(self, session: UserSession) -> None:
        payload = json.dumps(session.__dict__)
        keyring.set_password(self.keyring_service, "session", payload)

    def _load(self) -> Optional[UserSession]:
        raw = keyring.get_password(self.keyring_service, "session")
        if not raw:
            return None
        try:
            return UserSession(**json.loads(raw))
        except (ValueError, TypeError):
            return None
