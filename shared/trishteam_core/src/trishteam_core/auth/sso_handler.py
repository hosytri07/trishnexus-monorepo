"""sso_handler.py — Deep link `trishteam://` parser + oneshot token exchange.

Phase 1.6 (task #78). Module này kết nối:

- Launcher bootstrap (command-line arg `handle-url`)
- Browser → `trishteam://...` → Windows registry → re-launch
  `TrishTEAM.exe handle-url <url>`
- Cloud Functions `exchangeOneshotToken` (redeem) + `exchangeForWebToken`
  (mint) — scaffold ở Phase 1.7 (task #79, functions/).

Public API:

    from trishteam_core.auth import sso_handler

    # Parse URL — pure, unit-testable
    action = sso_handler.parse_deep_link_url("trishteam://auth?token=abc123")
    if action.kind == "auth":
        token = action.params["token"]

    # Redeem oneshot (web → desktop) — gọi Cloud Function + signIn
    user = sso_handler.redeem_oneshot_to_session(
        oneshot=token,
        cloud_config=sso_handler.CloudConfig(
            project_id="trishteam-dev",
            region="asia-southeast1",
            api_key="AIza...",
        ),
    )

    # Mint oneshot (desktop → web) — yêu cầu caller đã login
    handoff = sso_handler.mint_web_handoff(
        cloud_config=...,
        target_platform="web",
        website_origin="https://trishteam.com",
    )
    # handoff.url mở ra https://trishteam.com/sso?oneshot=...

    # Đăng ký protocol handler (Windows) — 1 lần mỗi máy
    sso_handler.register_windows_protocol_handler(
        exe_path=Path(r"C:\Program Files\TrishTEAM\TrishTEAM.exe"),
    )

Reference: docs/WEB-DESKTOP-PARITY.md §6–7, docs/AUTH.md §2.3 + §9.5.
"""

from __future__ import annotations

import logging
import sys
import time
import urllib.parse
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional

import requests

from . import session as session_module
from . import token_store
from .firebase_client import AuthError, FirebaseClient
from .session import SessionUser

logger = logging.getLogger(__name__)


# ---------- Constants ----------

#: URL scheme desktop registers với Windows.
SCHEME = "trishteam"

#: Kinds hợp lệ — ứng với bảng §7.2 docs/WEB-DESKTOP-PARITY.md.
VALID_KINDS = {"auth", "library", "note", "install", "admin"}

#: Region mặc định của Cloud Functions TrishTEAM.
DEFAULT_REGION = "asia-southeast1"

#: Thời gian timeout ngắn cho gọi Cloud Function — UX phải nhanh, user
#: chờ deep link nên giữ dưới 10s.
DEFAULT_TIMEOUT_SEC = 8.0


# ---------- Data types ----------


@dataclass(frozen=True)
class DeepLinkAction:
    """Kết quả parse `trishteam://<kind>/<path>?<query>`.

    - `kind`: action root (auth / library / note / install / admin).
    - `subpath`: path tokens sau kind, đã split. Vd `note/abc/edit` → `["abc", "edit"]`.
    - `params`: query string parse, duplicate keys lấy value đầu.
    - `raw_url`: URL gốc — log forensic nếu sau này abuse.
    """

    kind: str
    subpath: tuple[str, ...]
    params: dict[str, str]
    raw_url: str


@dataclass(frozen=True)
class CloudConfig:
    """Config để gọi Cloud Functions. Khởi tạo 1 lần từ app bootstrap."""

    project_id: str
    region: str = DEFAULT_REGION
    api_key: str = ""             # Firebase Web API key — cần cho signInWithCustomToken
    emulator_origin: str = ""     # nếu set, override cloud URL (local dev)
    timeout_sec: float = DEFAULT_TIMEOUT_SEC

    def function_url(self, fn_name: str) -> str:
        """Tính URL callable Function. Respect emulator override."""
        if self.emulator_origin:
            # Emulator: http://localhost:5001/<project>/<region>/<fn>
            return f"{self.emulator_origin.rstrip('/')}/{self.project_id}/{self.region}/{fn_name}"
        return f"https://{self.region}-{self.project_id}.cloudfunctions.net/{fn_name}"


@dataclass(frozen=True)
class WebHandoff:
    """Trả từ mint_web_handoff — desktop dùng để mở browser."""

    oneshot: str
    url: str
    expires_at_ms: int


# ---------- Exceptions ----------


class SSOError(Exception):
    """Lỗi trong flow SSO — thường là parse fail hoặc server trả bất hợp lệ.

    `.code` mirror các code từ Cloud Function (không-hợp-lệ, hết-hạn, đã-dùng)
    để caller UI hiện message phù hợp.
    """

    def __init__(self, code: str, message: str = "") -> None:
        super().__init__(message or code)
        self.code = code
        self.message = message


# ---------- Parse deep link ----------


def parse_deep_link_url(url: str) -> DeepLinkAction:
    """Parse `trishteam://<kind>[/<sub>...][?k=v&...]` → DeepLinkAction.

    Raises SSOError("invalid_scheme") nếu không bắt đầu bằng `trishteam://`.
    Raises SSOError("invalid_kind") nếu kind không thuộc VALID_KINDS.
    Không throw khi query thiếu key — UX: caller check `params` rồi raise
    "invalid_payload" với message cụ thể.
    """
    if not isinstance(url, str) or not url.strip():
        raise SSOError("invalid_scheme", "URL rỗng.")

    # urllib không chấp nhận scheme custom một số version — workaround:
    # replace scheme để parse, rồi đọc lại.
    if not url.startswith(f"{SCHEME}://"):
        raise SSOError("invalid_scheme", f"URL không bắt đầu bằng {SCHEME}://")

    # Chuyển sang dạng http để urlparse parse path/query chuẩn hơn.
    stub_url = "http://_" + url[len(f"{SCHEME}:"):]   # http://_//kind/sub?q
    parsed = urllib.parse.urlparse(stub_url)

    # `parsed.netloc` sau khi replace sẽ là "_" (vì `//_/kind/...`) — thực ra
    # kind nằm ở segment đầu của `parsed.path`.
    # Robust hơn: ghép netloc + path bỏ "_", rồi split.
    combined = (parsed.netloc + parsed.path).lstrip("/")
    if combined.startswith("_/"):
        combined = combined[2:]
    elif combined.startswith("_"):
        combined = combined[1:]

    segments = [s for s in combined.split("/") if s]
    if not segments:
        raise SSOError("invalid_kind", "URL thiếu action kind.")

    kind = segments[0].lower()
    if kind not in VALID_KINDS:
        raise SSOError("invalid_kind", f"Kind '{kind}' không hợp lệ.")

    subpath = tuple(segments[1:])
    # parse_qs trả list; tiling về single value.
    params_raw = urllib.parse.parse_qs(parsed.query, keep_blank_values=False)
    params = {k: v[0] for k, v in params_raw.items() if v}

    return DeepLinkAction(kind=kind, subpath=subpath, params=params, raw_url=url)


# ---------- HTTP helper cho callable function ----------


def _call_function(
    cloud_config: CloudConfig,
    fn_name: str,
    data: dict[str, Any],
    *,
    id_token: Optional[str] = None,
) -> dict[str, Any]:
    """POST tới callable Cloud Function. Format khớp Firebase Functions V2:
    body `{"data": {...}}`, response `{"result": {...}}`.

    Raise SSOError với code đã normalize (từ HttpsError của server) —
    caller UI map ra message tiếng Việt.
    """
    url = cloud_config.function_url(fn_name)
    headers = {"Content-Type": "application/json"}
    if id_token:
        headers["Authorization"] = f"Bearer {id_token}"

    try:
        r = requests.post(
            url,
            json={"data": data},
            headers=headers,
            timeout=cloud_config.timeout_sec,
        )
    except requests.RequestException as e:
        logger.warning("Callable function %s network fail: %s", fn_name, e)
        raise SSOError("network", f"Không gọi được {fn_name}: {e}") from e

    if r.status_code == 200:
        body = _safe_json(r)
        result = body.get("result")
        if not isinstance(result, dict):
            raise SSOError("invalid_response", f"{fn_name} trả không có 'result'.")
        return result

    # Firebase callable error shape:
    # {"error": {"status": "UNAUTHENTICATED", "message": "...", "details": ...}}
    body = _safe_json(r)
    err = body.get("error", {}) if isinstance(body, dict) else {}
    server_code = (err.get("status") or f"HTTP_{r.status_code}").lower().replace("_", "-")
    message = err.get("message", "") or f"HTTP {r.status_code}"
    logger.info("Callable function %s fail: code=%s msg=%s", fn_name, server_code, message)
    raise SSOError(server_code, message)


def _safe_json(r: requests.Response) -> Any:
    try:
        return r.json()
    except ValueError:
        return {}


# ---------- Redeem oneshot (web → desktop) ----------


def exchange_oneshot_token(
    oneshot: str,
    cloud_config: CloudConfig,
    *,
    target_platform: str = "desktop",
) -> dict[str, Any]:
    """Gọi Cloud Function `exchangeOneshotToken` → trả {customToken, uid}.

    Caller không cần login (đây là điểm mấu chốt của oneshot). Validation:
    `oneshot` phải 16–128 ký tự khớp server check.

    Raise SSOError nếu server từ chối (already_used / expired / wrong-platform).
    """
    if not isinstance(oneshot, str) or not (16 <= len(oneshot) <= 128):
        raise SSOError("invalid_argument", "Oneshot token sai format.")

    return _call_function(
        cloud_config,
        "exchangeOneshotToken",
        {"oneshot": oneshot, "platform": target_platform},
    )


def redeem_oneshot_to_session(
    oneshot: str,
    cloud_config: CloudConfig,
    *,
    firebase_client: Optional[FirebaseClient] = None,
) -> SessionUser:
    """Full flow: oneshot → Firebase customToken → signIn → persist session.

    Sau khi hàm trả về, `session.current_user()` = user mới. Token đã persist
    qua `token_store` (DPAPI / keyring / fallback). Caller nên ngay lập tức
    call `session.refresh_if_needed()` hoặc show main UI.

    Args:
        oneshot: Oneshot ID 32-ký tự (hoặc dài hơn khi format đổi).
        cloud_config: Project + region + api_key.
        firebase_client: Optional — dùng trong test để inject mock client.
            Production caller để None; function tự tạo client từ cloud_config.api_key.

    Raise:
        SSOError: server reject oneshot hoặc signInWithCustomToken lỗi.
        RuntimeError: cloud_config thiếu api_key (không sign in được).
    """
    if not cloud_config.api_key:
        raise RuntimeError(
            "CloudConfig.api_key rỗng — cần Firebase Web API key để "
            "sign in sau khi redeem oneshot."
        )

    exchange_result = exchange_oneshot_token(
        oneshot,
        cloud_config,
        target_platform="desktop",
    )
    custom_token = exchange_result.get("customToken")
    uid_hint = exchange_result.get("uid", "")
    if not custom_token:
        raise SSOError("invalid_response", "Cloud Function không trả customToken.")

    client = firebase_client or FirebaseClient(
        api_key=cloud_config.api_key,
        timeout=cloud_config.timeout_sec,
    )

    try:
        signin_resp = client.sign_in_with_custom_token(custom_token)
    except AuthError as e:
        logger.error("signInWithCustomToken fail: %s", e.code)
        raise SSOError(e.code.lower(), e.message or "signIn fail") from e

    user = _build_session_from_signin(signin_resp, uid_hint=uid_hint)

    # Enrich với custom claims (role) — best-effort, không fail nếu network flap.
    try:
        lookup = client.lookup_account(user.id_token)
        user = _enrich_session_user(user, lookup)
    except (AuthError, requests.RequestException) as e:
        logger.warning("Lookup sau redeem oneshot fail: %s — giữ role 'user'.", e)

    # Persist + set singleton session.
    data = {
        "uid": user.uid,
        "email": user.email,
        "display_name": user.display_name,
        "role": user.role,
        "avatar_url": user.avatar_url,
        "id_token": user.id_token,
        "refresh_token": user.refresh_token,
        "expires_at": user.expires_at,
    }
    token_store.save(data)
    with session_module._state.lock:            # sử dụng lock của session
        session_module._state.user = user

    logger.info("redeem_oneshot_ok uid=%s role=%s", user.uid, user.role)
    return user


# ---------- Mint oneshot (desktop → web) ----------


def mint_web_handoff(
    cloud_config: CloudConfig,
    *,
    target_platform: str = "web",
    website_origin: str = "https://trishteam.com",
    sso_path: str = "/sso",
) -> WebHandoff:
    """Gọi Cloud Function `exchangeForWebToken` để tạo oneshot, trả URL handoff.

    Caller PHẢI đã login desktop — function dùng `session.current_user().id_token`
    làm Bearer để server trust UID.

    Returns:
        WebHandoff với `.url` = `<website_origin>/sso?oneshot=<id>` — desktop
        mở URL đó bằng QDesktopServices / webbrowser.open.

    Raise:
        RuntimeError: chưa login (session.current_user() is None).
        SSOError: server reject.
    """
    user = session_module.current_user()
    if user is None:
        raise RuntimeError("Chưa login — không mint được web handoff.")

    result = _call_function(
        cloud_config,
        "exchangeForWebToken",
        {"targetPlatform": target_platform},
        id_token=user.id_token,
    )
    oneshot = result.get("oneshot")
    expires_at = int(result.get("expiresAtMs") or 0)
    if not oneshot:
        raise SSOError("invalid_response", "exchangeForWebToken không trả oneshot.")

    # URL có thể do server trả, hoặc desktop tự build — desktop build an toàn hơn
    # vì server không biết website_origin của từng env (dev/staging/prod).
    query = urllib.parse.urlencode({"oneshot": oneshot})
    url = f"{website_origin.rstrip('/')}{sso_path}?{query}"

    logger.info("mint_web_handoff_ok uid=%s platform=%s", user.uid, target_platform)
    return WebHandoff(oneshot=oneshot, url=url, expires_at_ms=expires_at)


# ---------- Session builder helpers ----------


def _build_session_from_signin(resp: dict[str, Any], *, uid_hint: str = "") -> SessionUser:
    """Map signIn response → SessionUser. Giống logic trong session.py nhưng
    không gọi lookup (caller làm sau nếu muốn)."""
    uid = resp.get("localId") or uid_hint
    if not uid:
        raise SSOError("invalid_response", "signIn response thiếu localId/uid.")
    expires_in = int(resp.get("expiresIn", 3600))
    return SessionUser(
        uid=uid,
        email=resp.get("email", ""),
        display_name=resp.get("displayName", ""),
        role="user",
        id_token=resp["idToken"],
        refresh_token=resp["refreshToken"],
        expires_at=time.time() + expires_in,
    )


def _enrich_session_user(user: SessionUser, lookup_resp: dict[str, Any]) -> SessionUser:
    """Hoà role + displayName từ accounts:lookup response."""
    users = lookup_resp.get("users", [])
    if not users:
        return user
    me = users[0]

    import json

    role = user.role
    if ca := me.get("customAttributes"):
        try:
            claims = json.loads(ca)
            role = claims.get("role", role)
        except ValueError:
            pass

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


# ---------- Windows protocol handler registration ----------


def register_windows_protocol_handler(
    exe_path: Path,
    *,
    scheme: str = SCHEME,
    friendly_name: str = "TrishTEAM Protocol",
    scope: str = "user",
) -> None:
    """Đăng ký `trishteam://` scheme với Windows. Sau khi chạy, browser
    click `trishteam://...` sẽ launch `<exe_path> handle-url "<url>"`.

    Args:
        exe_path: Đường dẫn tuyệt đối tới TrishTEAM.exe (Launcher hoặc Runtime).
        scheme: Default "trishteam". Không hardcode để test dùng scheme khác.
        friendly_name: Hiển thị trong Windows "Default apps" dialog.
        scope: "user" (HKCU\\Software\\Classes — không cần admin) hoặc
            "machine" (HKCR — cần admin). Default "user" để installer MSI per-user
            không nổ UAC.

    Raise:
        RuntimeError: không chạy Windows.
        FileNotFoundError: `exe_path` không tồn tại.
        OSError: ghi registry fail (thường là permission denied với scope=machine).
    """
    if sys.platform != "win32":
        raise RuntimeError("register_windows_protocol_handler chỉ chạy Windows.")
    if not exe_path.is_file():
        raise FileNotFoundError(f"exe_path không tồn tại: {exe_path}")

    import winreg   # type: ignore

    if scope == "user":
        root = winreg.HKEY_CURRENT_USER
        base_path = fr"Software\Classes\{scheme}"
    elif scope == "machine":
        root = winreg.HKEY_CLASSES_ROOT
        base_path = scheme
    else:
        raise ValueError(f"scope không hợp lệ: {scope!r}")

    # HKxx\{scheme} — (default) = "URL:<friendly_name>", "URL Protocol" = ""
    with winreg.CreateKey(root, base_path) as key:
        winreg.SetValueEx(key, "", 0, winreg.REG_SZ, f"URL:{friendly_name}")
        winreg.SetValueEx(key, "URL Protocol", 0, winreg.REG_SZ, "")

    # HKxx\{scheme}\DefaultIcon → exe,0 (dùng icon embedded)
    with winreg.CreateKey(root, fr"{base_path}\DefaultIcon") as key:
        winreg.SetValueEx(key, "", 0, winreg.REG_SZ, f'"{exe_path}",0')

    # HKxx\{scheme}\shell\open\command → "<exe>" handle-url "%1"
    command = f'"{exe_path}" handle-url "%1"'
    with winreg.CreateKey(root, fr"{base_path}\shell\open\command") as key:
        winreg.SetValueEx(key, "", 0, winreg.REG_SZ, command)

    logger.info("Registered %s:// → %s (scope=%s)", scheme, exe_path, scope)


def unregister_windows_protocol_handler(
    *,
    scheme: str = SCHEME,
    scope: str = "user",
) -> None:
    """Xoá protocol handler khỏi registry — gọi trong uninstaller."""
    if sys.platform != "win32":
        raise RuntimeError("unregister_windows_protocol_handler chỉ chạy Windows.")

    import winreg   # type: ignore

    if scope == "user":
        root = winreg.HKEY_CURRENT_USER
        base_path = fr"Software\Classes\{scheme}"
    elif scope == "machine":
        root = winreg.HKEY_CLASSES_ROOT
        base_path = scheme
    else:
        raise ValueError(f"scope không hợp lệ: {scope!r}")

    # Xoá leaf → parent theo thứ tự, bỏ qua nếu đã không tồn tại.
    for subpath in (
        fr"{base_path}\shell\open\command",
        fr"{base_path}\shell\open",
        fr"{base_path}\shell",
        fr"{base_path}\DefaultIcon",
        base_path,
    ):
        try:
            winreg.DeleteKey(root, subpath)
        except FileNotFoundError:
            pass
        except OSError as e:
            logger.warning("Xoá key %s fail: %s", subpath, e)

    logger.info("Unregistered %s:// (scope=%s)", scheme, scope)


def is_windows_protocol_registered(*, scheme: str = SCHEME, scope: str = "user") -> bool:
    """True nếu registry có key `<scheme>\\shell\\open\\command`."""
    if sys.platform != "win32":
        return False

    import winreg   # type: ignore

    if scope == "user":
        root = winreg.HKEY_CURRENT_USER
        base_path = fr"Software\Classes\{scheme}\shell\open\command"
    else:
        root = winreg.HKEY_CLASSES_ROOT
        base_path = fr"{scheme}\shell\open\command"

    try:
        with winreg.OpenKey(root, base_path):
            return True
    except FileNotFoundError:
        return False


__all__ = [
    # Types
    "DeepLinkAction",
    "CloudConfig",
    "WebHandoff",
    "SSOError",
    # Constants
    "SCHEME",
    "VALID_KINDS",
    "DEFAULT_REGION",
    # Parse
    "parse_deep_link_url",
    # Exchange
    "exchange_oneshot_token",
    "redeem_oneshot_to_session",
    "mint_web_handoff",
    # Windows registry
    "register_windows_protocol_handler",
    "unregister_windows_protocol_handler",
    "is_windows_protocol_registered",
]
