"""Test FirebaseClient — HTTP wrapper. Mock `requests.post` (không gọi net thật)."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
import requests

from trishteam_core.auth.firebase_client import AuthError, FirebaseClient


def _fake_response(status: int, payload: dict) -> MagicMock:
    r = MagicMock(spec=requests.Response)
    r.status_code = status
    r.json.return_value = payload
    r.text = str(payload)
    return r


# ---------- Sign in ----------

def test_sign_in_success_returns_raw_dict():
    client = FirebaseClient(api_key="AIza-test")
    payload = {"idToken": "id1", "refreshToken": "r1", "localId": "u1",
               "email": "u@x.com", "expiresIn": "3600"}

    with patch("requests.post", return_value=_fake_response(200, payload)) as mock_post:
        result = client.sign_in_with_password("u@x.com", "pw")

    assert result == payload
    # URL đúng + api_key qua query param
    call_kwargs = mock_post.call_args.kwargs
    assert call_kwargs["params"] == {"key": "AIza-test"}
    assert call_kwargs["json"]["email"] == "u@x.com"
    assert call_kwargs["json"]["returnSecureToken"] is True


def test_sign_in_raises_auth_error_on_firebase_error():
    client = FirebaseClient(api_key="AIza-test")
    err_body = {"error": {"code": 400, "message": "EMAIL_NOT_FOUND"}}

    with patch("requests.post", return_value=_fake_response(400, err_body)):
        with pytest.raises(AuthError) as exc:
            client.sign_in_with_password("x@x.com", "pw")

    assert exc.value.code == "EMAIL_NOT_FOUND"
    assert exc.value.message == "EMAIL_NOT_FOUND"


def test_sign_in_network_exception_propagates():
    client = FirebaseClient(api_key="AIza-test")
    with patch("requests.post", side_effect=requests.ConnectionError("boom")):
        with pytest.raises(requests.ConnectionError):
            client.sign_in_with_password("u@x.com", "pw")


# ---------- Refresh ----------

def test_refresh_token_uses_form_not_json():
    client = FirebaseClient(api_key="AIza-test")
    payload = {"id_token": "new_id", "refresh_token": "new_r",
               "expires_in": "3600", "user_id": "u1"}

    with patch("requests.post", return_value=_fake_response(200, payload)) as mock_post:
        result = client.refresh_id_token("old_r")

    assert result == payload
    # Form data, không phải JSON
    call_kwargs = mock_post.call_args.kwargs
    assert "data" in call_kwargs and "json" not in call_kwargs
    assert call_kwargs["data"]["grant_type"] == "refresh_token"


def test_refresh_token_expired_raises():
    client = FirebaseClient(api_key="AIza-test")
    err = {"error": {"code": 400, "message": "TOKEN_EXPIRED"}}
    with patch("requests.post", return_value=_fake_response(400, err)):
        with pytest.raises(AuthError) as exc:
            client.refresh_id_token("bad_r")
    assert exc.value.code == "TOKEN_EXPIRED"


# ---------- Send password reset ----------

def test_send_password_reset_posts_correct_body():
    client = FirebaseClient(api_key="AIza-test")
    with patch("requests.post", return_value=_fake_response(200, {"email": "x@x.com"})) as mock:
        client.send_password_reset_email("x@x.com")
    body = mock.call_args.kwargs["json"]
    assert body == {"requestType": "PASSWORD_RESET", "email": "x@x.com"}


# ---------- Lookup ----------

def test_lookup_account_passes_id_token():
    client = FirebaseClient(api_key="AIza-test")
    payload = {"users": [{"localId": "u1", "customAttributes": '{"role":"admin"}'}]}
    with patch("requests.post", return_value=_fake_response(200, payload)) as mock:
        result = client.lookup_account("id-token-xyz")
    assert result == payload
    assert mock.call_args.kwargs["json"] == {"idToken": "id-token-xyz"}


# ---------- Error shape edge cases ----------

def test_non_json_error_response_maps_to_http_code():
    client = FirebaseClient(api_key="AIza-test")
    r = MagicMock(spec=requests.Response)
    r.status_code = 502
    r.json.side_effect = ValueError("not json")
    r.text = "<html>Bad Gateway</html>"

    with patch("requests.post", return_value=r):
        with pytest.raises(AuthError) as exc:
            client.sign_in_with_password("u@x.com", "pw")
    assert exc.value.code == "HTTP_502"
