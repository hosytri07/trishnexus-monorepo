"""token_store.py — Persist Firebase auth token an toàn trên disk.

Phase 1.1 (task #74). Tách từ `auth/manager.py` cũ. Module này chỉ biết
cách serialize/encrypt/save/load 1 blob dict → file. Không biết gì về
Firebase, không biết gì về SessionUser dataclass.

Storage backend (chọn theo platform):

- **Windows**: DPAPI qua `win32crypt.CryptProtectData` → file
  `%APPDATA%/TrishTeam/TrishTEAM/auth/token.bin`. Chỉ user Windows hiện
  tại (trên máy đó) mới unlock được — không cần password, không leak khi
  copy ổ cứng.
- **macOS/Linux**: `keyring` (Keychain / SecretService) — save/load JSON
  string. Không mã hoá disk nhưng được OS bảo vệ quyền truy cập.
- **Fallback cuối**: nếu cả pywin32 lẫn keyring đều thiếu (CI headless),
  lưu plaintext JSON ở `auth/token.json` + log warning. **Không dùng ở
  production.**

Public API:

    from trishteam_core.auth import token_store

    token_store.save({"uid": "...", "id_token": "...", ...})
    data = token_store.load()          # dict | None
    token_store.clear()

Caller (session.py) chịu trách nhiệm serialize/deserialize dataclass.
"""

from __future__ import annotations

import json
import logging
import platform
import sys
from pathlib import Path
from typing import Any, Optional

from trishteam_core.utils.paths import user_data_dir_for

logger = logging.getLogger(__name__)

# Tên app dùng cho platformdirs + keyring service. Hardcode vì auth
# dùng chung cho cả hệ sinh thái (1 token / user).
_APP_NAME = "TrishTEAM"
_KEYRING_SERVICE = "trishteam.auth"
_KEYRING_USER = "session"  # chỉ 1 slot — logout thì xoá


def _token_dir() -> Path:
    """Thư mục `%APPDATA%/TrishTeam/TrishTEAM/auth/` (hoặc tương đương)."""
    d = user_data_dir_for(_APP_NAME) / "auth"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _dpapi_path() -> Path:
    return _token_dir() / "token.bin"


def _plaintext_fallback_path() -> Path:
    return _token_dir() / "token.json"


# ---------- Backend detection ----------

def _use_dpapi() -> bool:
    """True nếu đang chạy Windows + pywin32 đã cài."""
    if platform.system() != "Windows":
        return False
    try:
        import win32crypt  # noqa: F401
        return True
    except ImportError:
        return False


def _use_keyring() -> bool:
    """True nếu keyring import được (hầu hết môi trường non-Windows)."""
    try:
        import keyring  # noqa: F401
        return True
    except ImportError:
        return False


# ---------- Public API ----------

def save(data: dict[str, Any]) -> str:
    """Lưu dict vào store đã mã hoá. Trả tên backend đã dùng (debug).

    Raises:
        RuntimeError: nếu không backend nào hoạt động (rất hiếm).
    """
    blob = json.dumps(data, default=str, ensure_ascii=False).encode("utf-8")

    if _use_dpapi():
        _save_dpapi(blob)
        return "dpapi"
    if _use_keyring():
        try:
            _save_keyring(blob)
            return "keyring"
        except Exception as e:
            # keyring import được nhưng không có backend (vd sandbox Linux
            # không SecretService) → fallback plaintext
            logger.warning("keyring.set_password fail (%s) — fallback plaintext.", e)

    # Last resort — không lý tưởng, chỉ dùng CI/headless
    logger.warning(
        "Không có DPAPI (pywin32) lẫn keyring backend — lưu token plaintext tại %s. "
        "KHÔNG DÙNG TRÊN PRODUCTION.",
        _plaintext_fallback_path(),
    )
    _save_plaintext(blob)
    return "plaintext"


def load() -> Optional[dict[str, Any]]:
    """Đọc dict từ store. Trả None nếu chưa có token hoặc corrupt."""
    blob: Optional[bytes] = None
    if _use_dpapi() and _dpapi_path().is_file():
        blob = _load_dpapi()
    elif _use_keyring():
        try:
            blob = _load_keyring()
        except Exception as e:
            logger.warning("keyring.get_password fail (%s) — thử plaintext.", e)
            blob = None
        if blob is None and _plaintext_fallback_path().is_file():
            blob = _load_plaintext()
    elif _plaintext_fallback_path().is_file():
        blob = _load_plaintext()
    else:
        return None

    if blob is None:
        return None

    try:
        return json.loads(blob.decode("utf-8"))
    except (ValueError, UnicodeDecodeError) as e:
        logger.error("Token store parse lỗi (%s) — xoá token corrupt.", e)
        clear()
        return None


def clear() -> None:
    """Xoá token khỏi mọi backend (logout / session bị revoke)."""
    # Xoá cả 3 backend để chắc — silent nếu chưa có
    if _dpapi_path().is_file():
        try:
            _dpapi_path().unlink()
        except OSError as e:
            logger.warning("Xoá DPAPI token lỗi: %s", e)

    if _use_keyring():
        try:
            import keyring
            import keyring.errors
            try:
                keyring.delete_password(_KEYRING_SERVICE, _KEYRING_USER)
            except keyring.errors.PasswordDeleteError:
                pass  # chưa có gì để xoá
            except Exception as e:
                # NoKeyringError, backend lỗi, v.v. — bỏ qua im lặng
                logger.debug("keyring clear bỏ qua: %s", e)
        except ImportError:
            pass

    if _plaintext_fallback_path().is_file():
        try:
            _plaintext_fallback_path().unlink()
        except OSError as e:
            logger.warning("Xoá plaintext fallback lỗi: %s", e)


def backend_name() -> str:
    """Trả tên backend sẽ dùng cho save tiếp theo — debug / status bar."""
    if _use_dpapi():
        return "dpapi"
    if _use_keyring():
        return "keyring"
    return "plaintext"


# ---------- DPAPI backend ----------

def _save_dpapi(blob: bytes) -> None:
    import win32crypt  # type: ignore[import-untyped]
    encrypted = win32crypt.CryptProtectData(
        blob,
        "TrishTEAM-auth",  # description (hiển thị nếu dùng UI reveal)
        None, None, None, 0,
    )
    _dpapi_path().write_bytes(encrypted)


def _load_dpapi() -> Optional[bytes]:
    import win32crypt  # type: ignore[import-untyped]
    try:
        encrypted = _dpapi_path().read_bytes()
        decrypted, _ = win32crypt.CryptUnprotectData(
            encrypted, None, None, None, 0,
        )
        return decrypted
    except OSError as e:
        logger.error("Đọc DPAPI token lỗi: %s", e)
        return None
    except Exception as e:  # win32crypt ném pywintypes.error
        logger.error("Giải mã DPAPI lỗi (user key khác máy?): %s", e)
        return None


# ---------- Keyring backend ----------

def _save_keyring(blob: bytes) -> None:
    import keyring
    keyring.set_password(
        _KEYRING_SERVICE, _KEYRING_USER, blob.decode("utf-8"),
    )


def _load_keyring() -> Optional[bytes]:
    import keyring
    raw = keyring.get_password(_KEYRING_SERVICE, _KEYRING_USER)
    if not raw:
        return None
    return raw.encode("utf-8")


# ---------- Plaintext fallback ----------

def _save_plaintext(blob: bytes) -> None:
    path = _plaintext_fallback_path()
    path.write_bytes(blob)
    # Trên POSIX thu hẹp quyền xuống 600 — Windows bỏ qua (cần ACL riêng)
    if sys.platform != "win32":
        try:
            path.chmod(0o600)
        except OSError:
            pass


def _load_plaintext() -> Optional[bytes]:
    try:
        return _plaintext_fallback_path().read_bytes()
    except OSError as e:
        logger.error("Đọc plaintext token lỗi: %s", e)
        return None


__all__ = ["save", "load", "clear", "backend_name"]
