"""role_guard.py — @require_role decorator cho PyQt6 view handler.

Phase 1.3 (task #75). Giúp wrap method nhạy cảm (export, delete, admin-only…)
để nếu user không có role phù hợp sẽ:

1. Log warning (có uid + method name + required roles).
2. Hiện `QMessageBox.warning` nếu caller là QWidget (lấy parent hợp lý).
3. Raise `PermissionError` để caller upstream (nếu có) xử lý thêm.

Thiết kế:

- Chỉ dùng cho **method** (sync). Function module-level vẫn work nhưng sẽ
  không có dialog (không có self làm parent). Async coroutine chưa support.
- Qt import lazy — import lỗi (headless CI) thì skip dialog, giữ log + raise.
- **Không silently swallow**. Nếu block, luôn raise để bug nổ sớm — tránh
  case admin UI trông bình thường mà hành động không chạy.

Usage:

    from trishteam_core.auth import require_role

    class AdminView(QWidget):
        @require_role("admin", "dev")
        def export_all_users(self):
            ...

    # Custom thông báo
    @require_role("admin", message="Chỉ Admin mới xoá được user khác.")
    def delete_user(self, uid): ...

    # Bỏ dialog (ví dụ background task)
    @require_role("dev", show_dialog=False)
    def debug_flush(self): ...
"""

from __future__ import annotations

import functools
import logging
from typing import Any, Callable, Optional

from . import session

logger = logging.getLogger(__name__)


def require_role(
    *roles: str,
    message: Optional[str] = None,
    show_dialog: bool = True,
) -> Callable:
    """Decorator factory. Chặn method nếu user không có role phù hợp.

    Args:
        *roles: Tên role được phép. Vd `"admin"`, `"dev"`. Rỗng = yêu cầu
                đã login (role nào cũng ok).
        message: Text hiển thị trong QMessageBox. Default generate từ roles.
        show_dialog: True → show QMessageBox.warning nếu có Qt + self.

    Raises:
        PermissionError: Khi user không đủ quyền (luôn raise, kể cả sau
        khi đã show dialog — để caller dễ trace).
    """
    if not roles:
        # Require login bất kỳ
        allowed = None
    else:
        allowed = tuple(roles)

    def decorator(fn: Callable) -> Callable:
        @functools.wraps(fn)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            user = session.current_user()
            # Case 1: chưa login
            if user is None:
                _deny(fn, args, reason="not_logged_in", allowed=allowed,
                      message=message, show_dialog=show_dialog)
            # Case 2: login nhưng role không match
            if allowed is not None and user.role not in allowed:
                _deny(fn, args, reason="role_mismatch", allowed=allowed,
                      message=message, show_dialog=show_dialog, user=user)
            # OK — gọi thật
            return fn(*args, **kwargs)
        # Đánh dấu để introspect/test
        wrapper.__require_roles__ = allowed  # type: ignore[attr-defined]
        return wrapper

    return decorator


# ---------- Internals ----------

def _deny(
    fn: Callable,
    args: tuple,
    *,
    reason: str,
    allowed: Optional[tuple[str, ...]],
    message: Optional[str],
    show_dialog: bool,
    user: Any = None,
) -> None:
    """Log + optional dialog + raise PermissionError."""
    required_txt = "login" if allowed is None else " hoặc ".join(allowed)
    uid = getattr(user, "uid", "<anonymous>") if user else "<anonymous>"
    logger.warning(
        "@require_role chặn %s (reason=%s, required=%s, uid=%s)",
        fn.__qualname__, reason, required_txt, uid,
    )

    if show_dialog:
        _try_show_dialog(
            args=args,
            required_txt=required_txt,
            reason=reason,
            message=message,
        )

    raise PermissionError(
        message
        or f"Cần quyền {required_txt} để thực hiện {fn.__name__}."
    )


def _try_show_dialog(
    args: tuple,
    required_txt: str,
    reason: str,
    message: Optional[str],
) -> None:
    """Show QMessageBox.warning nếu Qt có + args[0] là QWidget khả dụng."""
    try:
        from PyQt6.QtWidgets import QMessageBox, QWidget
    except ImportError:
        # Headless / unit test — bỏ qua dialog
        return

    parent = None
    if args and isinstance(args[0], QWidget):
        parent = args[0]

    if reason == "not_logged_in":
        title = "Chưa đăng nhập"
        text = message or (
            f"Chức năng này yêu cầu đăng nhập tài khoản TrishTEAM "
            f"(quyền: {required_txt}). Mời bạn đăng nhập rồi thử lại."
        )
    else:
        title = "Không đủ quyền"
        text = message or (
            f"Chức năng này dành cho tài khoản có quyền {required_txt}. "
            f"Liên hệ quản trị viên nếu bạn nghĩ đây là nhầm lẫn."
        )

    try:
        QMessageBox.warning(parent, title, text)
    except Exception as e:  # noqa: BLE001 — dialog fail không nên crash caller
        logger.debug("QMessageBox show lỗi (bỏ qua): %s", e)


__all__ = ["require_role"]
