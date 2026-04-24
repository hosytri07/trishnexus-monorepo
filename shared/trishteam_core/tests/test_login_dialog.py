"""Test login_dialog — chỉ những phần không cần QApplication chạy thật.

Toàn bộ UI hành vi (click, submit, focus) test qua PyQt6 offscreen cần
libEGL native — không khả thi trong sandbox CI của monorepo hiện tại.
Test này cover:
- Module import được (lazy Qt).
- `_friendly_error` i18n mapping.
- AST-level: worker gọi đúng session API, icon names có trong pool.
- Contract: `LoginWorker` và `LoginDialog` expose đúng public API.
"""

from __future__ import annotations

import ast
import pathlib

import pytest


_MODULE_PATH = (
    pathlib.Path(__file__).parent.parent
    / "src" / "trishteam_core" / "auth" / "login_dialog.py"
)


def test_module_imports_cleanly():
    """Import không crash kể cả khi PyQt6 chưa cài/chưa chạy được."""
    from trishteam_core.auth import login_dialog  # noqa: F401
    assert hasattr(login_dialog, "show_login_dialog")


def test_friendly_error_translates_common_firebase_codes():
    from trishteam_core.auth.login_dialog import _friendly_error

    msg = _friendly_error("EMAIL_NOT_FOUND", "raw firebase text")
    assert "đăng ký" in msg.lower() or "email" in msg.lower()

    msg = _friendly_error("INVALID_PASSWORD", "")
    assert "mật khẩu" in msg.lower()

    msg = _friendly_error("WEAK_PASSWORD : Password too short", "")
    assert "yếu" in msg.lower() or "6 ký tự" in msg


def test_friendly_error_falls_back_to_raw_for_unknown_code():
    from trishteam_core.auth.login_dialog import _friendly_error
    assert _friendly_error("SOMETHING_WEIRD", "raw fallback") == "raw fallback"
    assert _friendly_error("", "") == "Lỗi chưa rõ."


def test_friendly_error_handles_firebase_colon_suffix():
    """Firebase đôi khi trả 'CODE : description' — split đúng."""
    from trishteam_core.auth.login_dialog import _friendly_error
    msg = _friendly_error("EMAIL_EXISTS: already in use", "fallback")
    # Sau khi strip 'EMAIL_EXISTS' sẽ map ra i18n Việt
    assert "đã có tài khoản" in msg.lower()


def test_worker_only_uses_existing_session_api():
    """AST check: LoginWorker chỉ gọi API thật sự tồn tại trong session.py."""
    tree = ast.parse(_MODULE_PATH.read_text())
    calls = {
        node.attr
        for node in ast.walk(tree)
        if (isinstance(node, ast.Attribute)
            and isinstance(node.value, ast.Name)
            and node.value.id == "session")
    }
    from trishteam_core.auth import session
    for name in calls:
        assert hasattr(session, name), f"session.{name} không tồn tại"


def test_referenced_icons_exist_in_lucide_pool():
    """AST check: mọi tên icon truyền vào qicon(...) / _attach_leading_icon /
    _try_set_icon phải có file SVG trong lucide/ folder."""
    src = _MODULE_PATH.read_text()
    tree = ast.parse(src)

    icon_names = set()
    # Thu thập từ qicon("name", ...)
    for node in ast.walk(tree):
        if (isinstance(node, ast.Call)
                and isinstance(node.func, ast.Name)
                and node.func.id == "qicon"
                and node.args
                and isinstance(node.args[0], ast.Constant)):
            icon_names.add(node.args[0].value)
        # Thu thập từ self._attach_leading_icon(..., "name") và _try_set_icon
        elif (isinstance(node, ast.Call)
              and isinstance(node.func, ast.Attribute)
              and node.func.attr in ("_attach_leading_icon", "_try_set_icon")):
            # arg cuối cùng hoặc thứ 2 là tên icon
            for arg in node.args:
                if isinstance(arg, ast.Constant) and isinstance(arg.value, str):
                    icon_names.add(arg.value)

    icons_dir = _MODULE_PATH.parent.parent / "icons" / "lucide"
    available = {p.stem for p in icons_dir.glob("*.svg")}

    missing = icon_names - available
    assert not missing, f"Icon missing trong lucide/: {missing}"


def test_public_exports_stable():
    """Guard regression: __all__ phải chứa 3 symbol chính."""
    from trishteam_core.auth import login_dialog
    assert set(login_dialog.__all__) >= {"LoginDialog", "LoginWorker", "show_login_dialog"}


def test_worker_modes_defined():
    """LoginWorker phải có 3 mode constant (login/signup/reset)."""
    from trishteam_core.auth import login_dialog
    if not login_dialog._QT_AVAILABLE:
        pytest.skip("PyQt6 không có — skip class-level test")
    assert login_dialog.LoginWorker.MODE_LOGIN == "login"
    assert login_dialog.LoginWorker.MODE_SIGNUP == "signup"
    assert login_dialog.LoginWorker.MODE_RESET == "reset"


def test_show_login_dialog_raises_without_qt(monkeypatch):
    """show_login_dialog() trên máy không có PyQt6 phải raise rõ ràng."""
    from trishteam_core.auth import login_dialog
    monkeypatch.setattr(login_dialog, "_QT_AVAILABLE", False)
    with pytest.raises(RuntimeError, match="PyQt6"):
        login_dialog.show_login_dialog()
