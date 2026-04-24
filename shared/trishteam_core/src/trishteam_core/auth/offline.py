"""offline.py — Phát hiện offline + graceful degrade cho app login-required.

Phase 1.4 (task #76). Module này cung cấp 2 công cụ:

1. `ping(url, timeout)` — one-shot check, dùng cho CLI / unit test.
2. `OfflineDetector(QObject)` — poll định kỳ qua QTimer, emit signal
   `online_changed(bool)` khi state đổi. App dùng signal này để hiện
   banner hoặc khoá tính năng cloud.

Policy mặc định (theo AUTH.md §6):

- Poll URL `https://trishteam.com/ping` mỗi 30s.
- Fail 3 lần liên tiếp → state=offline (tránh blip 1 request).
- Thành công lại 1 lần → state=online (khôi phục nhanh, tránh lag UX).

Qt optional: nếu PyQt6 chưa import được thì vẫn dùng được `ping()` +
`OfflineChecker` (thread polling pure Python, callback thay vì signal).
"""

from __future__ import annotations

import logging
import threading
import time
from typing import Callable, Optional

import requests

logger = logging.getLogger(__name__)

DEFAULT_PING_URL = "https://trishteam.com/ping"
DEFAULT_INTERVAL_SEC = 30
DEFAULT_FAIL_THRESHOLD = 3
DEFAULT_TIMEOUT_SEC = 5.0


def ping(url: str = DEFAULT_PING_URL, timeout: float = DEFAULT_TIMEOUT_SEC) -> bool:
    """One-shot HEAD request. Trả True nếu HTTP < 500.

    HEAD thay vì GET để rẻ bandwidth. Server CDN (Firebase / Vercel) hay
    redirect 301/302 HEAD — vẫn coi là online. Chỉ 5xx hoặc exception
    mới coi là offline.
    """
    try:
        r = requests.head(url, timeout=timeout, allow_redirects=True)
        return r.status_code < 500
    except requests.RequestException as e:
        logger.debug("Ping %s fail: %s", url, e)
        return False


class OfflineChecker:
    """Polling thread pure Python — không cần Qt. Dùng cho CLI / headless.

    Gọi callback `on_change(is_online: bool)` khi state đổi (edge-triggered,
    không spam theo mỗi poll).
    """

    def __init__(
        self,
        on_change: Callable[[bool], None],
        *,
        url: str = DEFAULT_PING_URL,
        interval_sec: int = DEFAULT_INTERVAL_SEC,
        fail_threshold: int = DEFAULT_FAIL_THRESHOLD,
        timeout_sec: float = DEFAULT_TIMEOUT_SEC,
    ) -> None:
        self._on_change = on_change
        self._url = url
        self._interval = interval_sec
        self._fail_threshold = fail_threshold
        self._timeout = timeout_sec

        self._fail_count = 0
        self._is_online = True
        self._stop_event = threading.Event()
        self._thread: Optional[threading.Thread] = None

    @property
    def is_online(self) -> bool:
        return self._is_online

    def start(self) -> None:
        if self._thread and self._thread.is_alive():
            return
        self._stop_event.clear()
        self._thread = threading.Thread(
            target=self._run, name="OfflineChecker", daemon=True,
        )
        self._thread.start()

    def stop(self) -> None:
        self._stop_event.set()
        if self._thread:
            self._thread.join(timeout=self._interval + 1)

    def check_once(self) -> bool:
        """Ping 1 lần, update state + trigger callback nếu đổi. Return new state."""
        ok = ping(self._url, timeout=self._timeout)
        if ok:
            was_offline = not self._is_online
            self._fail_count = 0
            self._is_online = True
            if was_offline:
                self._fire(True)
        else:
            self._fail_count += 1
            if self._fail_count >= self._fail_threshold and self._is_online:
                self._is_online = False
                self._fire(False)
        return self._is_online

    def _run(self) -> None:
        # Check ngay 1 phát lúc start, rồi chờ interval
        self.check_once()
        while not self._stop_event.wait(self._interval):
            self.check_once()

    def _fire(self, online: bool) -> None:
        try:
            self._on_change(online)
        except Exception as e:  # noqa: BLE001
            logger.exception("OfflineChecker.on_change callback lỗi: %s", e)


def make_qt_detector(
    parent: object = None,
    *,
    url: str = DEFAULT_PING_URL,
    interval_sec: int = DEFAULT_INTERVAL_SEC,
    fail_threshold: int = DEFAULT_FAIL_THRESHOLD,
    timeout_sec: float = DEFAULT_TIMEOUT_SEC,
) -> object:
    """Factory trả về `OfflineDetector(QObject)` — lazy import để module
    load được mà không cần PyQt6.

    Signal exposed:
        online_changed(bool): emit khi state đổi (True=online / False=offline).

    Usage:
        det = make_qt_detector(parent=main_window)
        det.online_changed.connect(on_net_change)
        det.start()
    """
    from PyQt6.QtCore import QObject, QTimer, pyqtSignal

    class OfflineDetector(QObject):
        online_changed = pyqtSignal(bool)

        def __init__(self, parent: Optional[QObject] = None) -> None:
            super().__init__(parent)
            self._fail_count = 0
            self._is_online = True
            self._timer = QTimer(self)
            self._timer.setInterval(interval_sec * 1000)
            self._timer.timeout.connect(self._tick)

        @property
        def is_online(self) -> bool:
            return self._is_online

        def start(self) -> None:
            self._tick()  # kiểm tra ngay
            self._timer.start()

        def stop(self) -> None:
            self._timer.stop()

        def _tick(self) -> None:
            ok = ping(url, timeout=timeout_sec)
            if ok:
                was_offline = not self._is_online
                self._fail_count = 0
                self._is_online = True
                if was_offline:
                    self.online_changed.emit(True)
            else:
                self._fail_count += 1
                if self._fail_count >= fail_threshold and self._is_online:
                    self._is_online = False
                    self.online_changed.emit(False)

    return OfflineDetector(parent)  # type: ignore[arg-type]


__all__ = [
    "ping",
    "OfflineChecker",
    "make_qt_detector",
    "DEFAULT_PING_URL",
    "DEFAULT_INTERVAL_SEC",
    "DEFAULT_FAIL_THRESHOLD",
]
