"""login_dialog.py — QDialog đăng nhập / đăng ký Firebase cho mọi desktop app.

Phase 1.5 (task #77). Dialog modal dùng tokens v2 (trishwarm) + Lucide icons.
Không block main UI — login HTTP call chạy trong `LoginWorker` (QThread).

Public entry:

    from trishteam_core.auth.login_dialog import LoginDialog, show_login_dialog

    # Cách 1: Dùng trực tiếp
    dlg = LoginDialog(parent=main_window)
    dlg.logged_in.connect(lambda user: print("hi", user.email))
    dlg.exec()

    # Cách 2: Helper chặn tới khi login xong hoặc user đóng
    user = show_login_dialog(parent=main_window)
    if user is None:
        sys.exit(0)   # user huỷ

Ghi chú:

- Dialog dùng `session.login_with_password` đã tạo ở task #73 — tokens v2
  chỉ ảnh hưởng QSS styling, logic auth không đổi.
- Google OAuth button hiển thị nhưng disable + tooltip "Sắp có" — wire ở
  task #78 (SSO deep link handler + loopback port).
- Không tự apply theme global; caller chịu `apply_theme(app)` trước khi
  show dialog nếu muốn dialog pick up theme.
- Module import Qt lazy — chỉ khi instantiate class. Cho phép
  `from trishteam_core.auth import login_dialog` trong unit test headless.
"""

from __future__ import annotations

import logging
from typing import Optional

from . import session
from .firebase_client import AuthError
from .session import SessionUser

logger = logging.getLogger(__name__)


# Import Qt ở top-level OK — module này thuộc auth UI, caller phải có PyQt6.
# Nhưng wrap trong try để `from trishteam_core.auth import login_dialog` không
# crash trên máy CI headless (caller sẽ crash lúc instantiate).
try:
    from PyQt6.QtCore import Qt, QThread, pyqtSignal
    from PyQt6.QtGui import QFont, QKeySequence, QShortcut
    from PyQt6.QtWidgets import (
        QApplication,
        QCheckBox,
        QDialog,
        QFrame,
        QHBoxLayout,
        QInputDialog,
        QLabel,
        QLineEdit,
        QMessageBox,
        QPushButton,
        QVBoxLayout,
        QWidget,
    )
    _QT_AVAILABLE = True
except ImportError:  # pragma: no cover — handled ở class level
    _QT_AVAILABLE = False


# Colors từ tokens.v2.json → themes.trishwarm. Hardcode ở đây để không
# phụ thuộc theme loader (sẽ thay khi task #70 ship `apply_theme` chuẩn).
_COLORS = {
    "bg":        "#0f0e0c",
    "bg_elev":   "#1a1814",
    "card":      "#1a1814",
    "row":       "#1e1c18",
    "border":    "rgba(255,255,255,0.12)",
    "border_focus": "#667EEA",
    "text":      "#f5f2ed",
    "text_muted":"#a09890",
    "text_link": "#8FA5FF",
    "accent":    "#667EEA",
    "accent_2":  "#764BA2",
    "danger":    "#EF4444",
}


_QSS = f"""
QDialog {{
    background: {_COLORS['bg']};
    color: {_COLORS['text']};
}}
QLabel#brand {{
    color: {_COLORS['text']};
    font-size: 22px;
    font-weight: 600;
}}
QLabel#subtitle {{
    color: {_COLORS['text_muted']};
    font-size: 12px;
}}
QLabel#error {{
    color: {_COLORS['danger']};
    font-size: 12px;
    padding: 6px 10px;
    background: rgba(239,68,68,0.08);
    border-radius: 8px;
}}
QLineEdit {{
    background: {_COLORS['row']};
    border: 1px solid {_COLORS['border']};
    border-radius: 8px;
    padding: 10px 12px;
    color: {_COLORS['text']};
    font-size: 13px;
    selection-background-color: {_COLORS['accent']};
}}
QLineEdit:focus {{
    border: 1px solid {_COLORS['border_focus']};
}}
QCheckBox {{
    color: {_COLORS['text_muted']};
    font-size: 12px;
}}
QPushButton#primary {{
    background: {_COLORS['accent']};
    color: #ffffff;
    border: none;
    border-radius: 8px;
    padding: 11px 18px;
    font-size: 13px;
    font-weight: 600;
}}
QPushButton#primary:hover {{
    background: #7a92f0;
}}
QPushButton#primary:disabled {{
    background: rgba(102,126,234,0.35);
    color: rgba(255,255,255,0.55);
}}
QPushButton#secondary {{
    background: transparent;
    color: {_COLORS['text']};
    border: 1px solid {_COLORS['border']};
    border-radius: 8px;
    padding: 10px 16px;
    font-size: 13px;
}}
QPushButton#secondary:hover {{
    border: 1px solid {_COLORS['border_focus']};
}}
QPushButton#secondary:disabled {{
    color: {_COLORS['text_muted']};
    border: 1px solid {_COLORS['border']};
}}
QPushButton#link {{
    background: transparent;
    color: {_COLORS['text_link']};
    border: none;
    padding: 2px 4px;
    font-size: 12px;
    text-align: left;
}}
QPushButton#link:hover {{
    text-decoration: underline;
}}
QFrame#divider {{
    background: {_COLORS['border']};
    max-height: 1px;
    min-height: 1px;
}}
"""


# ---------- Worker thread ----------

if _QT_AVAILABLE:

    class LoginWorker(QThread):
        """Chạy login/signup/reset trong background, không block UI."""

        succeeded = pyqtSignal(object)  # SessionUser
        failed = pyqtSignal(str, str)   # (code, message)

        MODE_LOGIN = "login"
        MODE_SIGNUP = "signup"
        MODE_RESET = "reset"

        def __init__(self, mode: str, email: str, password: str = "") -> None:
            super().__init__()
            self.mode = mode
            self.email = email
            self.password = password

        def run(self) -> None:
            try:
                if self.mode == self.MODE_LOGIN:
                    user = session.login_with_password(self.email, self.password)
                    self.succeeded.emit(user)
                elif self.mode == self.MODE_SIGNUP:
                    user = session.sign_up_with_password(self.email, self.password)
                    self.succeeded.emit(user)
                elif self.mode == self.MODE_RESET:
                    session.send_password_reset_email(self.email)
                    self.succeeded.emit(None)
                else:
                    self.failed.emit("UNKNOWN_MODE", f"Unknown mode: {self.mode}")
            except AuthError as e:
                self.failed.emit(e.code, e.message or e.code)
            except Exception as e:  # noqa: BLE001 — catch-all network/unexpected
                logger.exception("LoginWorker lỗi: %s", e)
                self.failed.emit("NETWORK_ERROR", str(e))


# ---------- Dialog ----------

if _QT_AVAILABLE:

    class LoginDialog(QDialog):
        """Modal login dialog với email + password + Google (future).

        Signal `logged_in(SessionUser)` emit khi login thành công. Caller
        thường connect tới main window để enable features theo role.
        """

        logged_in = pyqtSignal(object)  # SessionUser

        _MODE_LOGIN = "login"
        _MODE_SIGNUP = "signup"

        def __init__(self, parent: Optional[QWidget] = None) -> None:
            super().__init__(parent)
            self._mode = self._MODE_LOGIN
            self._worker: Optional[LoginWorker] = None
            self._user: Optional[SessionUser] = None

            self.setWindowTitle("Đăng nhập TrishTEAM")
            self.setModal(True)
            self.setMinimumWidth(420)
            self.setStyleSheet(_QSS)

            self._build_ui()
            self._wire_events()

        # ----- UI construction -----

        def _build_ui(self) -> None:
            root = QVBoxLayout(self)
            root.setContentsMargins(32, 28, 32, 24)
            root.setSpacing(14)

            # Brand block
            self.lbl_brand = QLabel("Đăng nhập <b>TrishTEAM</b>", self)
            self.lbl_brand.setObjectName("brand")
            self.lbl_brand.setTextFormat(Qt.TextFormat.RichText)
            root.addWidget(self.lbl_brand)

            self.lbl_subtitle = QLabel(
                "Tài khoản dùng chung cho toàn hệ sinh thái 10+ app.", self,
            )
            self.lbl_subtitle.setObjectName("subtitle")
            root.addWidget(self.lbl_subtitle)
            root.addSpacing(6)

            # Email field
            self.input_email = QLineEdit(self)
            self.input_email.setPlaceholderText("Email")
            self.input_email.setClearButtonEnabled(True)
            self._attach_leading_icon(self.input_email, "mail")
            root.addWidget(self.input_email)

            # Password field + eye toggle
            self.input_password = QLineEdit(self)
            self.input_password.setPlaceholderText("Mật khẩu")
            self.input_password.setEchoMode(QLineEdit.EchoMode.Password)
            self._attach_leading_icon(self.input_password, "lock")
            self._attach_password_toggle(self.input_password)
            root.addWidget(self.input_password)

            # Remember + Forgot row
            row = QHBoxLayout()
            row.setSpacing(8)
            self.chk_remember = QCheckBox("Ghi nhớ đăng nhập", self)
            self.chk_remember.setChecked(True)
            row.addWidget(self.chk_remember)
            row.addStretch(1)
            self.btn_forgot = QPushButton("Quên mật khẩu?", self)
            self.btn_forgot.setObjectName("link")
            self.btn_forgot.setCursor(Qt.CursorShape.PointingHandCursor)
            self.btn_forgot.setFlat(True)
            row.addWidget(self.btn_forgot)
            root.addLayout(row)

            # Error banner
            self.lbl_error = QLabel("", self)
            self.lbl_error.setObjectName("error")
            self.lbl_error.setWordWrap(True)
            self.lbl_error.hide()
            root.addWidget(self.lbl_error)

            # Primary button
            self.btn_primary = QPushButton("Đăng nhập", self)
            self.btn_primary.setObjectName("primary")
            self.btn_primary.setCursor(Qt.CursorShape.PointingHandCursor)
            self.btn_primary.setDefault(True)
            root.addWidget(self.btn_primary)

            # Divider
            divider_row = QHBoxLayout()
            divider_row.setSpacing(10)
            divider_row.addWidget(self._divider())
            lbl_or = QLabel("hoặc", self)
            lbl_or.setObjectName("subtitle")
            lbl_or.setAlignment(Qt.AlignmentFlag.AlignCenter)
            divider_row.addWidget(lbl_or)
            divider_row.addWidget(self._divider())
            root.addLayout(divider_row)

            # Google button (disabled — wired ở #78)
            self.btn_google = QPushButton("  Tiếp tục với Google", self)
            self.btn_google.setObjectName("secondary")
            self._try_set_icon(self.btn_google, "log-in")
            self.btn_google.setEnabled(False)
            self.btn_google.setToolTip("Sắp có — đang hoàn thiện SSO deep link.")
            root.addWidget(self.btn_google)

            # Switch login/signup
            sw = QHBoxLayout()
            sw.setSpacing(6)
            self.lbl_switch_text = QLabel("Chưa có tài khoản?", self)
            self.lbl_switch_text.setObjectName("subtitle")
            sw.addWidget(self.lbl_switch_text)
            self.btn_switch = QPushButton("Đăng ký", self)
            self.btn_switch.setObjectName("link")
            self.btn_switch.setCursor(Qt.CursorShape.PointingHandCursor)
            self.btn_switch.setFlat(True)
            sw.addWidget(self.btn_switch)
            sw.addStretch(1)
            root.addLayout(sw)

        def _divider(self) -> QFrame:
            f = QFrame(self)
            f.setObjectName("divider")
            f.setFrameShape(QFrame.Shape.HLine)
            return f

        def _try_set_icon(self, widget: QWidget, name: str) -> None:
            """Thử gán icon Lucide — nếu icons module thiếu, bỏ qua im lặng."""
            try:
                from trishteam_core.icons import qicon
                icon = qicon(name, color=_COLORS["text"], size=16)
                if hasattr(widget, "setIcon") and not icon.isNull():
                    widget.setIcon(icon)
            except Exception as e:  # noqa: BLE001
                logger.debug("Icon '%s' set fail (bỏ qua): %s", name, e)

        def _attach_leading_icon(self, edit: QLineEdit, name: str) -> None:
            """Gắn icon lucide vào leading position của QLineEdit (text action)."""
            try:
                from trishteam_core.icons import qicon
                icon = qicon(name, color=_COLORS["text_muted"], size=16)
                if not icon.isNull():
                    edit.addAction(icon, QLineEdit.ActionPosition.LeadingPosition)
            except Exception as e:  # noqa: BLE001
                logger.debug("Leading icon fail: %s", e)

        def _attach_password_toggle(self, edit: QLineEdit) -> None:
            """Thêm action eye/eye-off để toggle echo mode."""
            try:
                from trishteam_core.icons import qicon
                icon_show = qicon("eye", color=_COLORS["text_muted"], size=16)
                icon_hide = qicon("eye-off", color=_COLORS["text_muted"], size=16)
            except Exception:
                return

            action = edit.addAction(icon_show, QLineEdit.ActionPosition.TrailingPosition)

            def toggle():
                if edit.echoMode() == QLineEdit.EchoMode.Password:
                    edit.setEchoMode(QLineEdit.EchoMode.Normal)
                    action.setIcon(icon_hide)
                else:
                    edit.setEchoMode(QLineEdit.EchoMode.Password)
                    action.setIcon(icon_show)

            action.triggered.connect(toggle)

        # ----- Event wiring -----

        def _wire_events(self) -> None:
            self.btn_primary.clicked.connect(self._on_submit)
            self.btn_switch.clicked.connect(self._toggle_mode)
            self.btn_forgot.clicked.connect(self._on_forgot)
            # Enter in email → focus password; in password → submit
            self.input_email.returnPressed.connect(self.input_password.setFocus)
            self.input_password.returnPressed.connect(self._on_submit)
            # Esc to close
            QShortcut(QKeySequence("Esc"), self, activated=self.reject)

        # ----- Actions -----

        def _on_submit(self) -> None:
            email = self.input_email.text().strip()
            password = self.input_password.text()
            if not email or "@" not in email:
                self._show_error("Email không hợp lệ.")
                return
            if len(password) < 6:
                self._show_error("Mật khẩu tối thiểu 6 ký tự.")
                return

            self._hide_error()
            self._set_busy(True)

            mode = (LoginWorker.MODE_LOGIN if self._mode == self._MODE_LOGIN
                    else LoginWorker.MODE_SIGNUP)
            self._worker = LoginWorker(mode, email, password)
            self._worker.succeeded.connect(self._on_success)
            self._worker.failed.connect(self._on_fail)
            self._worker.finished.connect(self._worker.deleteLater)
            self._worker.start()

        def _on_success(self, user: Optional[SessionUser]) -> None:
            self._set_busy(False)
            self._user = user
            self.logged_in.emit(user)
            self.accept()

        def _on_fail(self, code: str, message: str) -> None:
            self._set_busy(False)
            self._show_error(_friendly_error(code, message))

        def _on_forgot(self) -> None:
            email, ok = QInputDialog.getText(
                self,
                "Quên mật khẩu",
                "Nhập email của bạn, hệ thống sẽ gửi link đặt lại mật khẩu:",
                text=self.input_email.text().strip(),
            )
            if not ok or not email.strip():
                return
            email = email.strip()
            if "@" not in email:
                QMessageBox.warning(self, "Email không hợp lệ", "Mời nhập email đúng.")
                return
            self._set_busy(True)
            worker = LoginWorker(LoginWorker.MODE_RESET, email)
            worker.succeeded.connect(lambda _: self._reset_ok(email))
            worker.failed.connect(self._reset_fail)
            worker.finished.connect(worker.deleteLater)
            self._worker = worker
            worker.start()

        def _reset_ok(self, email: str) -> None:
            self._set_busy(False)
            QMessageBox.information(
                self, "Đã gửi email",
                f"Link đặt lại mật khẩu đã gửi tới {email}. "
                f"Kiểm tra hộp thư (kể cả Spam) để làm tiếp.",
            )

        def _reset_fail(self, code: str, message: str) -> None:
            self._set_busy(False)
            self._show_error(_friendly_error(code, message))

        def _toggle_mode(self) -> None:
            if self._mode == self._MODE_LOGIN:
                self._mode = self._MODE_SIGNUP
                self.lbl_brand.setText("Đăng ký <b>TrishTEAM</b>")
                self.btn_primary.setText("Tạo tài khoản")
                self.lbl_switch_text.setText("Đã có tài khoản?")
                self.btn_switch.setText("Đăng nhập")
                self.btn_forgot.hide()
            else:
                self._mode = self._MODE_LOGIN
                self.lbl_brand.setText("Đăng nhập <b>TrishTEAM</b>")
                self.btn_primary.setText("Đăng nhập")
                self.lbl_switch_text.setText("Chưa có tài khoản?")
                self.btn_switch.setText("Đăng ký")
                self.btn_forgot.show()
            self._hide_error()

        # ----- Helpers -----

        def _set_busy(self, busy: bool) -> None:
            self.btn_primary.setEnabled(not busy)
            self.btn_switch.setEnabled(not busy)
            self.btn_forgot.setEnabled(not busy)
            self.input_email.setEnabled(not busy)
            self.input_password.setEnabled(not busy)
            if busy:
                self.btn_primary.setText("Đang xử lý…")
            else:
                self.btn_primary.setText(
                    "Đăng nhập" if self._mode == self._MODE_LOGIN else "Tạo tài khoản",
                )

        def _show_error(self, message: str) -> None:
            self.lbl_error.setText(message)
            self.lbl_error.show()

        def _hide_error(self) -> None:
            self.lbl_error.clear()
            self.lbl_error.hide()

        # ----- Public getter -----

        def user(self) -> Optional[SessionUser]:
            """SessionUser vừa login, hoặc None nếu chưa thành công."""
            return self._user


# ---------- Convenience entry ----------

def show_login_dialog(parent: object = None) -> Optional[SessionUser]:
    """Blocking convenience — show dialog, trả SessionUser | None.

    Caller đảm bảo `session.init(api_key=...)` đã chạy. Nếu user huỷ
    (đóng dialog hoặc Esc) → trả None.
    """
    if not _QT_AVAILABLE:
        raise RuntimeError(
            "PyQt6 chưa cài — login_dialog chỉ chạy trong desktop app."
        )
    # Đảm bảo có QApplication (trong app chính đã có; test script thì chưa).
    app = QApplication.instance()
    if app is None:
        import sys
        app = QApplication(sys.argv)  # noqa: F841

    dlg = LoginDialog(parent=parent)  # type: ignore[arg-type]
    if dlg.exec() == QDialog.DialogCode.Accepted:
        return dlg.user()
    return None


# ---------- Error message translation ----------

_ERROR_I18N = {
    "EMAIL_NOT_FOUND":         "Email này chưa đăng ký. Nhấn 'Đăng ký' để tạo mới.",
    "INVALID_PASSWORD":        "Mật khẩu không đúng. Thử lại hoặc bấm 'Quên mật khẩu'.",
    "INVALID_LOGIN_CREDENTIALS": "Email hoặc mật khẩu không đúng.",
    "USER_DISABLED":           "Tài khoản đã bị khoá. Liên hệ quản trị viên.",
    "EMAIL_EXISTS":            "Email này đã có tài khoản. Chuyển sang 'Đăng nhập' nhé.",
    "WEAK_PASSWORD":           "Mật khẩu quá yếu (tối thiểu 6 ký tự).",
    "INVALID_EMAIL":           "Email không hợp lệ.",
    "TOO_MANY_ATTEMPTS_TRY_LATER": "Bạn thử quá nhiều lần. Chờ vài phút rồi quay lại.",
    "NETWORK_ERROR":           "Không kết nối được máy chủ. Kiểm tra Internet rồi thử lại.",
}


def _friendly_error(code: str, fallback: str) -> str:
    """Map Firebase error code → tiếng Việt user-friendly."""
    # Firebase đôi khi trả dạng "WEAK_PASSWORD : Password should be at least 6..."
    code_clean = code.split(":")[0].strip()
    return _ERROR_I18N.get(code_clean, fallback or code_clean or "Lỗi chưa rõ.")


__all__ = ["LoginDialog", "LoginWorker", "show_login_dialog"]
