"""firebase_client.py — Thin wrapper cho Firebase Auth REST API.

Phase 1.1 (task #73). Tách từ `auth/manager.py` cũ để mỗi module 1 trách
nhiệm. File này chỉ chứa HTTP calls thuần — không biết gì về token storage,
offline mode, hay UI.

Endpoints dùng:
- signIn:       /v1/accounts:signInWithPassword
- signUp:       /v1/accounts:signUp
- sendOobCode:  /v1/accounts:sendOobCode (password reset email)
- refresh:      https://securetoken.googleapis.com/v1/token
- lookup:       /v1/accounts:lookup (lấy profile + custom claims)
- verifyIdToken: server-side chỉ; desktop không dùng.

API design:
- Raise `AuthError` khi server trả error code.
- Raise `requests.RequestException` khi network fail (caller quyết offline).
- Return raw dict từ Firebase (không wrap thành dataclass — caller làm).

Reference: https://firebase.google.com/docs/reference/rest/auth
"""

from __future__ import annotations

from typing import Any

import requests


class AuthError(Exception):
    """Raised khi Firebase trả HTTP non-200 có error code rõ ràng.

    `.code` là mã Firebase (vd EMAIL_NOT_FOUND, INVALID_PASSWORD, TOKEN_EXPIRED).
    `.message` là message gốc từ Firebase.
    """

    def __init__(self, code: str, message: str = "") -> None:
        super().__init__(message or code)
        self.code = code
        self.message = message


class FirebaseClient:
    """Firebase Auth REST client. 1 instance / 1 Firebase project.

    Args:
        api_key: Firebase Web API key (từ Firebase console → Project settings →
                 General → Your apps → Web app → "apiKey"). Không phải service
                 account key. Có thể public — dùng rules + custom claims để bảo
                 vệ data.
        timeout: HTTP timeout mặc định cho mọi call (seconds).
    """

    BASE_URL = "https://identitytoolkit.googleapis.com/v1"
    REFRESH_URL = "https://securetoken.googleapis.com/v1/token"

    def __init__(self, api_key: str, timeout: float = 10.0) -> None:
        self.api_key = api_key
        self.timeout = timeout

    # ---------- Sign in / up ----------

    def sign_in_with_password(self, email: str, password: str) -> dict[str, Any]:
        """Login với email + password. Trả dict chứa idToken/refreshToken/localId."""
        return self._post(
            f"{self.BASE_URL}/accounts:signInWithPassword",
            {"email": email, "password": password, "returnSecureToken": True},
        )

    def sign_up_with_password(self, email: str, password: str) -> dict[str, Any]:
        """Tạo account mới. Trả dict tương tự signIn."""
        return self._post(
            f"{self.BASE_URL}/accounts:signUp",
            {"email": email, "password": password, "returnSecureToken": True},
        )

    # ---------- Password reset ----------

    def send_password_reset_email(self, email: str) -> dict[str, Any]:
        """Gửi email reset password tới địa chỉ cho trước."""
        return self._post(
            f"{self.BASE_URL}/accounts:sendOobCode",
            {"requestType": "PASSWORD_RESET", "email": email},
        )

    # ---------- Token refresh ----------

    def refresh_id_token(self, refresh_token: str) -> dict[str, Any]:
        """Đổi refresh_token lấy id_token mới. Dùng khi id_token sắp hết hạn."""
        # Note: endpoint này trả field snake_case (id_token) khác endpoint
        # signIn (idToken). Caller chịu map.
        return self._post_form(
            self.REFRESH_URL,
            {"grant_type": "refresh_token", "refresh_token": refresh_token},
        )

    # ---------- Lookup profile + custom claims ----------

    def lookup_account(self, id_token: str) -> dict[str, Any]:
        """Lấy profile đầy đủ + custom claims. Dùng để refresh role sau login."""
        return self._post(
            f"{self.BASE_URL}/accounts:lookup",
            {"idToken": id_token},
        )

    # ---------- Custom-token sign in (dùng cho SSO oneshot redeem) ----------

    def sign_in_with_custom_token(self, custom_token: str) -> dict[str, Any]:
        """Đổi Firebase custom token (mint từ Cloud Function) → id/refresh token.

        Dùng trong SSO flow: desktop redeem oneshot → Cloud Function trả
        customToken → gọi hàm này → có idToken để set session.

        Trả dict tương tự signIn: {idToken, refreshToken, localId, expiresIn, ...}.
        """
        return self._post(
            f"{self.BASE_URL}/accounts:signInWithCustomToken",
            {"token": custom_token, "returnSecureToken": True},
        )

    # ---------- Internal ----------

    def _post(self, url: str, json_body: dict[str, Any]) -> dict[str, Any]:
        r = requests.post(
            url,
            params={"key": self.api_key},
            json=json_body,
            timeout=self.timeout,
        )
        return self._handle_response(r)

    def _post_form(self, url: str, form_data: dict[str, Any]) -> dict[str, Any]:
        r = requests.post(
            url,
            params={"key": self.api_key},
            data=form_data,
            timeout=self.timeout,
        )
        return self._handle_response(r)

    @staticmethod
    def _handle_response(r: requests.Response) -> dict[str, Any]:
        if r.status_code == 200:
            return r.json()
        # Firebase error shape: {"error": {"code": 400, "message": "EMAIL_NOT_FOUND", "errors": [...]}}
        try:
            err = r.json().get("error", {})
            code = err.get("message", "").split(":")[0].strip() or f"HTTP_{r.status_code}"
            raise AuthError(code, err.get("message", ""))
        except ValueError:
            # Response không parse được JSON
            raise AuthError(f"HTTP_{r.status_code}", r.text[:200])


__all__ = ["FirebaseClient", "AuthError"]
