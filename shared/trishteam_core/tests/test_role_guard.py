"""Test @require_role decorator — block vs pass + dialog fallback headless."""

from __future__ import annotations

import time

import pytest

from trishteam_core.auth import require_role, session
from trishteam_core.auth.session import SessionUser


def _login_as(role: str) -> None:
    session._state.user = SessionUser(
        uid="u1", email="e@x.com", id_token="t", refresh_token="r",
        expires_at=time.time() + 3600, role=role,
    )


# ---------- Not logged in ----------

def test_blocks_when_not_logged_in():
    @require_role("admin", show_dialog=False)
    def admin_action(): return "did_it"

    with pytest.raises(PermissionError, match="admin"):
        admin_action()


def test_message_defaults_to_vietnamese_label():
    @require_role("admin", "dev", show_dialog=False)
    def f(): pass

    with pytest.raises(PermissionError) as exc:
        f()
    assert "admin" in str(exc.value) and "dev" in str(exc.value)


# ---------- Logged in wrong role ----------

def test_blocks_when_role_mismatch():
    _login_as("user")

    @require_role("admin", show_dialog=False)
    def export_users(): return "ok"

    with pytest.raises(PermissionError):
        export_users()


# ---------- Logged in correct role ----------

def test_passes_when_role_matches():
    _login_as("admin")

    @require_role("admin", show_dialog=False)
    def export_users(): return "ok"

    assert export_users() == "ok"


def test_passes_when_role_in_allowed_set():
    _login_as("dev")

    @require_role("admin", "dev", show_dialog=False)
    def f(): return 42

    assert f() == 42


# ---------- No-arg variant = any logged in ----------

def test_no_args_requires_login_only():
    @require_role(show_dialog=False)
    def any_user_action(): return "x"

    # Not logged in → block
    with pytest.raises(PermissionError):
        any_user_action()

    _login_as("user")
    assert any_user_action() == "x"

    _login_as("admin")
    assert any_user_action() == "x"


# ---------- Custom message ----------

def test_custom_message_propagates():
    @require_role("dev", message="Chỉ dev flush được cache.", show_dialog=False)
    def debug_flush(): pass

    with pytest.raises(PermissionError) as exc:
        debug_flush()
    assert str(exc.value) == "Chỉ dev flush được cache."


# ---------- Introspection ----------

def test_decorator_exposes_required_roles():
    @require_role("admin", "dev", show_dialog=False)
    def f(): pass

    assert f.__require_roles__ == ("admin", "dev")


def test_empty_decorator_marks_none():
    @require_role(show_dialog=False)
    def f(): pass

    assert f.__require_roles__ is None


# ---------- Method on class (self as first arg) ----------

def test_decorator_on_method_preserves_self():
    class Obj:
        def __init__(self): self.called = 0

        @require_role("admin", show_dialog=False)
        def do(self, x):
            self.called += 1
            return x * 2

    _login_as("admin")
    o = Obj()
    assert o.do(5) == 10
    assert o.called == 1


def test_decorator_preserves_wrapped_metadata():
    @require_role("admin", show_dialog=False)
    def my_named_func():
        """Docstring giữ nguyên."""
        return 1

    assert my_named_func.__name__ == "my_named_func"
    assert my_named_func.__doc__ == "Docstring giữ nguyên."


# ---------- Headless fallback (no Qt) ----------

def test_show_dialog_true_does_not_crash_headless():
    """Dù show_dialog=True, headless (Qt import fail) chỉ skip dialog, không crash."""
    @require_role("admin", show_dialog=True)
    def f(): pass

    with pytest.raises(PermissionError):
        f()  # Không raise ImportError, AttributeError, v.v.
