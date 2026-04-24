"""Test sso_handler — deep link parse + oneshot exchange + Windows registry.

Mock `requests.post` để không hit Cloud Function thật. Registry test chạy
conditionally (skip khi không phải Windows).
"""

from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
import requests

from trishteam_core.auth import session as session_module
from trishteam_core.auth.firebase_client import AuthError, FirebaseClient
from trishteam_core.auth.session import SessionUser
from trishteam_core.auth.sso_handler import (
    DEFAULT_REGION,
    SCHEME,
    CloudConfig,
    DeepLinkAction,
    SSOError,
    WebHandoff,
    _build_session_from_signin,
    exchange_oneshot_token,
    is_windows_protocol_registered,
    mint_web_handoff,
    parse_deep_link_url,
    redeem_oneshot_to_session,
    register_windows_protocol_handler,
    unregister_windows_protocol_handler,
)


# ---------- Helpers ----------


def _fake_response(status: int, payload: dict) -> MagicMock:
    r = MagicMock(spec=requests.Response)
    r.status_code = status
    r.json.return_value = payload
    r.text = str(payload)
    return r


def _cloud_config(**over) -> CloudConfig:
    base = dict(
        project_id="trishteam-dev",
        region="asia-southeast1",
        api_key="AIza-fake",
    )
    base.update(over)
    return CloudConfig(**base)


# ---------- parse_deep_link_url ----------


class TestParseDeepLink:
    def test_auth_token_basic(self):
        url = "trishteam://auth?token=" + "a" * 32
        act = parse_deep_link_url(url)
        assert isinstance(act, DeepLinkAction)
        assert act.kind == "auth"
        assert act.subpath == ()
        assert act.params["token"] == "a" * 32
        assert act.raw_url == url

    def test_library_item_with_subpath(self):
        url = "trishteam://library/item/abc123"
        act = parse_deep_link_url(url)
        assert act.kind == "library"
        assert act.subpath == ("item", "abc123")

    def test_install_with_multiple_query(self):
        url = "trishteam://install?app=trishfont&version=1.2.3"
        act = parse_deep_link_url(url)
        assert act.kind == "install"
        assert act.params == {"app": "trishfont", "version": "1.2.3"}

    def test_admin_subpath(self):
        act = parse_deep_link_url("trishteam://admin/users/u-42")
        assert act.kind == "admin"
        assert act.subpath == ("users", "u-42")

    def test_invalid_scheme_rejected(self):
        with pytest.raises(SSOError) as exc:
            parse_deep_link_url("https://trishteam.com/auth?token=x")
        assert exc.value.code == "invalid_scheme"

    def test_empty_url_rejected(self):
        with pytest.raises(SSOError):
            parse_deep_link_url("")

    def test_unknown_kind_rejected(self):
        with pytest.raises(SSOError) as exc:
            parse_deep_link_url("trishteam://malicious?x=1")
        assert exc.value.code == "invalid_kind"

    def test_missing_kind_rejected(self):
        with pytest.raises(SSOError):
            parse_deep_link_url("trishteam://")

    def test_duplicate_query_keys_take_first(self):
        act = parse_deep_link_url("trishteam://auth?token=a&token=b")
        assert act.params["token"] in {"a", "b"}

    def test_url_encoded_params(self):
        # Nếu web gửi oneshot có ký tự đặc biệt (thực tế không có, nhưng test
        # để chắc urllib unescape đúng).
        act = parse_deep_link_url("trishteam://auth?token=ab%20c")
        assert act.params["token"] == "ab c"

    def test_raw_url_preserved(self):
        url = "trishteam://auth?token=xyz&foo=bar"
        act = parse_deep_link_url(url)
        assert act.raw_url == url

    def test_case_insensitive_kind(self):
        # Windows shell đôi khi lowercase URL — làm parser tolerate.
        act = parse_deep_link_url("trishteam://AUTH?token=abc1234567890123")
        assert act.kind == "auth"


# ---------- CloudConfig.function_url ----------


class TestCloudConfigUrl:
    def test_production_url(self):
        cfg = _cloud_config(emulator_origin="")
        url = cfg.function_url("exchangeOneshotToken")
        assert url == (
            "https://asia-southeast1-trishteam-dev.cloudfunctions.net/exchangeOneshotToken"
        )

    def test_emulator_override(self):
        cfg = _cloud_config(emulator_origin="http://localhost:5001")
        url = cfg.function_url("exchangeOneshotToken")
        assert url == (
            "http://localhost:5001/trishteam-dev/asia-southeast1/exchangeOneshotToken"
        )

    def test_emulator_origin_trailing_slash_tolerant(self):
        cfg = _cloud_config(emulator_origin="http://localhost:5001/")
        url = cfg.function_url("fn")
        # Không được sinh ra double slash sau port: "5001//trishteam-dev"
        assert "5001//" not in url
        assert url == "http://localhost:5001/trishteam-dev/asia-southeast1/fn"


# ---------- exchange_oneshot_token ----------


class TestExchangeOneshotToken:
    def test_success_returns_custom_token(self):
        cfg = _cloud_config()
        expected = {"customToken": "ct-abc", "uid": "u1"}
        with patch(
            "trishteam_core.auth.sso_handler.requests.post",
            return_value=_fake_response(200, {"result": expected}),
        ):
            result = exchange_oneshot_token("a" * 32, cfg)
        assert result == expected

    def test_empty_oneshot_rejected(self):
        with pytest.raises(SSOError) as exc:
            exchange_oneshot_token("", _cloud_config())
        assert exc.value.code == "invalid_argument"

    def test_short_oneshot_rejected(self):
        with pytest.raises(SSOError) as exc:
            exchange_oneshot_token("too-short", _cloud_config())
        assert exc.value.code == "invalid_argument"

    def test_server_error_mapped_to_sso_error(self):
        cfg = _cloud_config()
        err = {"error": {"status": "FAILED_PRECONDITION", "message": "đã dùng"}}
        with patch(
            "trishteam_core.auth.sso_handler.requests.post",
            return_value=_fake_response(400, err),
        ):
            with pytest.raises(SSOError) as exc:
                exchange_oneshot_token("a" * 32, cfg)
        assert exc.value.code == "failed-precondition"
        assert "đã dùng" in exc.value.message

    def test_network_error_wrapped(self):
        cfg = _cloud_config()
        with patch(
            "trishteam_core.auth.sso_handler.requests.post",
            side_effect=requests.ConnectionError("boom"),
        ):
            with pytest.raises(SSOError) as exc:
                exchange_oneshot_token("a" * 32, cfg)
        assert exc.value.code == "network"

    def test_malformed_response_rejected(self):
        cfg = _cloud_config()
        # status 200 nhưng thiếu "result"
        with patch(
            "trishteam_core.auth.sso_handler.requests.post",
            return_value=_fake_response(200, {"data": "garbage"}),
        ):
            with pytest.raises(SSOError) as exc:
                exchange_oneshot_token("a" * 32, cfg)
        assert exc.value.code == "invalid_response"

    def test_targets_desktop_platform_by_default(self):
        cfg = _cloud_config()
        with patch(
            "trishteam_core.auth.sso_handler.requests.post",
            return_value=_fake_response(200, {"result": {"customToken": "ct"}}),
        ) as mock_post:
            exchange_oneshot_token("a" * 32, cfg)
        sent_body = mock_post.call_args.kwargs["json"]
        assert sent_body["data"]["platform"] == "desktop"


# ---------- redeem_oneshot_to_session ----------


class TestRedeemOneshotToSession:
    def test_happy_path_persists_session(self):
        cfg = _cloud_config()
        mock_client = MagicMock(spec=FirebaseClient)
        mock_client.sign_in_with_custom_token.return_value = {
            "idToken": "id-new",
            "refreshToken": "r-new",
            "localId": "u1",
            "email": "u@x.com",
            "expiresIn": "3600",
        }
        mock_client.lookup_account.return_value = {
            "users": [
                {
                    "email": "u@x.com",
                    "displayName": "User Một",
                    "customAttributes": '{"role":"admin"}',
                }
            ]
        }

        with patch(
            "trishteam_core.auth.sso_handler.requests.post",
            return_value=_fake_response(
                200,
                {"result": {"customToken": "ct-abc", "uid": "u1"}},
            ),
        ):
            user = redeem_oneshot_to_session(
                "a" * 32, cfg, firebase_client=mock_client,
            )

        assert user.uid == "u1"
        assert user.role == "admin"
        assert user.id_token == "id-new"
        # Session singleton đã set
        assert session_module.current_user() is user
        # Token store đã persist
        from trishteam_core.auth import token_store
        data = token_store.load()
        assert data is not None
        assert data["uid"] == "u1"
        assert data["role"] == "admin"

    def test_lookup_failure_keeps_session_with_default_role(self):
        cfg = _cloud_config()
        mock_client = MagicMock(spec=FirebaseClient)
        mock_client.sign_in_with_custom_token.return_value = {
            "idToken": "id-new",
            "refreshToken": "r-new",
            "localId": "u1",
            "expiresIn": "3600",
        }
        mock_client.lookup_account.side_effect = requests.ConnectionError("flap")

        with patch(
            "trishteam_core.auth.sso_handler.requests.post",
            return_value=_fake_response(
                200,
                {"result": {"customToken": "ct", "uid": "u1"}},
            ),
        ):
            user = redeem_oneshot_to_session(
                "a" * 32, cfg, firebase_client=mock_client,
            )
        assert user.role == "user"

    def test_sign_in_fail_bubbles_as_sso_error(self):
        cfg = _cloud_config()
        mock_client = MagicMock(spec=FirebaseClient)
        mock_client.sign_in_with_custom_token.side_effect = AuthError(
            "INVALID_CUSTOM_TOKEN", "token sai"
        )

        with patch(
            "trishteam_core.auth.sso_handler.requests.post",
            return_value=_fake_response(
                200, {"result": {"customToken": "ct", "uid": "u1"}},
            ),
        ):
            with pytest.raises(SSOError) as exc:
                redeem_oneshot_to_session(
                    "a" * 32, cfg, firebase_client=mock_client,
                )
        assert exc.value.code == "invalid_custom_token"

    def test_missing_api_key_rejected(self):
        cfg = _cloud_config(api_key="")
        with pytest.raises(RuntimeError, match="api_key"):
            redeem_oneshot_to_session("a" * 32, cfg)

    def test_missing_custom_token_rejected(self):
        cfg = _cloud_config()
        mock_client = MagicMock(spec=FirebaseClient)
        with patch(
            "trishteam_core.auth.sso_handler.requests.post",
            return_value=_fake_response(200, {"result": {"uid": "u1"}}),  # thiếu customToken
        ):
            with pytest.raises(SSOError) as exc:
                redeem_oneshot_to_session(
                    "a" * 32, cfg, firebase_client=mock_client,
                )
        assert exc.value.code == "invalid_response"


# ---------- mint_web_handoff ----------


class TestMintWebHandoff:
    def _set_user(self):
        session_module._state.user = SessionUser(
            uid="u1",
            email="u@x.com",
            id_token="id-abc",
            refresh_token="r-abc",
            expires_at=9999999999.0,
            display_name="User Một",
            role="admin",
        )

    def test_happy_path_builds_url(self):
        self._set_user()
        cfg = _cloud_config()
        with patch(
            "trishteam_core.auth.sso_handler.requests.post",
            return_value=_fake_response(
                200,
                {"result": {"oneshot": "abc123456789ABCD", "expiresAtMs": 1700000000000}},
            ),
        ) as mock_post:
            handoff = mint_web_handoff(cfg, website_origin="https://trishteam.com")

        assert isinstance(handoff, WebHandoff)
        assert handoff.oneshot == "abc123456789ABCD"
        assert handoff.url == "https://trishteam.com/sso?oneshot=abc123456789ABCD"
        # Header Bearer đã đính kèm
        headers = mock_post.call_args.kwargs["headers"]
        assert headers["Authorization"] == "Bearer id-abc"

    def test_not_logged_in_rejected(self):
        # reset_session_state fixture đã set user=None
        cfg = _cloud_config()
        with pytest.raises(RuntimeError, match="Chưa login"):
            mint_web_handoff(cfg)

    def test_custom_website_origin_respected(self):
        self._set_user()
        cfg = _cloud_config()
        with patch(
            "trishteam_core.auth.sso_handler.requests.post",
            return_value=_fake_response(
                200,
                {"result": {"oneshot": "xyz456789012ABCD"}},
            ),
        ):
            handoff = mint_web_handoff(
                cfg, website_origin="https://staging.trishteam.com"
            )
        assert handoff.url.startswith("https://staging.trishteam.com/sso?")

    def test_server_invalid_response_raises(self):
        self._set_user()
        cfg = _cloud_config()
        with patch(
            "trishteam_core.auth.sso_handler.requests.post",
            return_value=_fake_response(200, {"result": {}}),
        ):
            with pytest.raises(SSOError) as exc:
                mint_web_handoff(cfg)
        assert exc.value.code == "invalid_response"


# ---------- _build_session_from_signin ----------


class TestBuildSessionFromSignin:
    def test_happy_path(self):
        resp = {
            "idToken": "id",
            "refreshToken": "r",
            "localId": "u1",
            "email": "u@x.com",
            "displayName": "U",
            "expiresIn": "3600",
        }
        u = _build_session_from_signin(resp)
        assert u.uid == "u1"
        assert u.email == "u@x.com"
        assert u.id_token == "id"
        assert u.role == "user"

    def test_uid_hint_used_when_local_id_missing(self):
        resp = {
            "idToken": "id",
            "refreshToken": "r",
            "expiresIn": "3600",
        }
        u = _build_session_from_signin(resp, uid_hint="u-from-function")
        assert u.uid == "u-from-function"

    def test_missing_uid_entirely_raises(self):
        resp = {"idToken": "id", "refreshToken": "r"}
        with pytest.raises(SSOError):
            _build_session_from_signin(resp)


# ---------- Windows registry (skip khi không Windows) ----------


pytestmark_windows_only = pytest.mark.skipif(
    sys.platform != "win32",
    reason="Registry tests chỉ chạy trên Windows.",
)


@pytestmark_windows_only
class TestWindowsRegistry:
    def test_register_then_query_then_unregister(self, tmp_path):
        # Dùng scheme test riêng để không đạp lên trishteam:// thật của dev.
        test_scheme = "trishteam-test-sso"
        exe_path = tmp_path / "fake.exe"
        exe_path.write_bytes(b"MZ")  # stub

        try:
            register_windows_protocol_handler(
                exe_path=exe_path,
                scheme=test_scheme,
                scope="user",
            )
            assert is_windows_protocol_registered(scheme=test_scheme, scope="user")
        finally:
            unregister_windows_protocol_handler(scheme=test_scheme, scope="user")
            assert not is_windows_protocol_registered(
                scheme=test_scheme, scope="user"
            )


class TestWindowsRegistryCrossPlatformGuard:
    def test_register_raises_on_non_windows(self, tmp_path, monkeypatch):
        if sys.platform == "win32":
            pytest.skip("Chỉ test guard trên non-Windows.")
        exe = tmp_path / "exe"
        exe.write_bytes(b"x")
        with pytest.raises(RuntimeError, match="Windows"):
            register_windows_protocol_handler(exe_path=exe)

    def test_is_registered_returns_false_on_non_windows(self):
        if sys.platform == "win32":
            pytest.skip("Chỉ test guard trên non-Windows.")
        assert is_windows_protocol_registered() is False
