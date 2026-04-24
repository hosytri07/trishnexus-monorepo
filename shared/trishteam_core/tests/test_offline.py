"""Test offline detection — ping + OfflineChecker edge-trigger."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
import requests

from trishteam_core.auth import offline
from trishteam_core.auth.offline import OfflineChecker, ping


# ---------- ping() ----------

def test_ping_returns_true_on_2xx():
    r = MagicMock(status_code=200)
    with patch("requests.head", return_value=r):
        assert ping("https://x.test") is True


def test_ping_returns_true_on_redirect():
    r = MagicMock(status_code=302)
    with patch("requests.head", return_value=r):
        assert ping("https://x.test") is True


def test_ping_returns_false_on_5xx():
    r = MagicMock(status_code=503)
    with patch("requests.head", return_value=r):
        assert ping("https://x.test") is False


def test_ping_returns_false_on_exception():
    with patch("requests.head", side_effect=requests.ConnectionError("no net")):
        assert ping("https://x.test") is False


def test_ping_returns_false_on_timeout():
    with patch("requests.head", side_effect=requests.Timeout("slow")):
        assert ping("https://x.test") is False


# ---------- OfflineChecker edge-trigger ----------

def _make_checker(pings: list[bool], threshold: int = 3):
    """Helper — build checker with queued ping results."""
    events = []
    idx = {"i": 0}

    def fake_ping(url, timeout=5.0):
        i = idx["i"]
        idx["i"] += 1
        if i >= len(pings):
            return pings[-1]
        return pings[i]

    checker = OfflineChecker(
        on_change=lambda online: events.append(online),
        fail_threshold=threshold,
    )
    return checker, events, fake_ping


def test_initial_state_is_online():
    checker = OfflineChecker(on_change=lambda _: None)
    assert checker.is_online is True


def test_single_fail_does_not_emit_offline(monkeypatch):
    checker, events, fake = _make_checker([False, False], threshold=3)
    monkeypatch.setattr(offline, "ping", fake)

    checker.check_once()
    checker.check_once()  # mới fail 2/3
    assert events == []
    assert checker.is_online is True


def test_threshold_reached_emits_offline(monkeypatch):
    checker, events, fake = _make_checker([False, False, False], threshold=3)
    monkeypatch.setattr(offline, "ping", fake)

    for _ in range(3):
        checker.check_once()

    assert events == [False]
    assert checker.is_online is False


def test_recovery_emits_online(monkeypatch):
    checker, events, fake = _make_checker([False, False, False, True], threshold=3)
    monkeypatch.setattr(offline, "ping", fake)

    for _ in range(4):
        checker.check_once()

    assert events == [False, True]
    assert checker.is_online is True


def test_success_resets_fail_counter(monkeypatch):
    """Fail 2 → success → fail 2 không được trigger offline (đã reset)."""
    checker, events, fake = _make_checker(
        [False, False, True, False, False], threshold=3,
    )
    monkeypatch.setattr(offline, "ping", fake)

    for _ in range(5):
        checker.check_once()

    assert events == []  # không đủ 3 fail liên tiếp
    assert checker.is_online is True


def test_no_duplicate_online_events(monkeypatch):
    """Stay online qua nhiều ping → chỉ 0 event (không emit mỗi lần)."""
    checker, events, fake = _make_checker([True] * 10, threshold=3)
    monkeypatch.setattr(offline, "ping", fake)

    for _ in range(10):
        checker.check_once()

    assert events == []


def test_no_duplicate_offline_events(monkeypatch):
    """Đã offline, fail thêm nữa không emit thêm."""
    checker, events, fake = _make_checker([False] * 10, threshold=3)
    monkeypatch.setattr(offline, "ping", fake)

    for _ in range(10):
        checker.check_once()

    assert events == [False]


# ---------- Callback exception handling ----------

def test_callback_exception_does_not_break_checker(monkeypatch):
    """Callback ném exception — checker vẫn tiếp tục hoạt động."""
    def bad_callback(online):
        raise RuntimeError("boom")

    monkeypatch.setattr(offline, "ping", lambda url, timeout=5.0: False)
    checker = OfflineChecker(on_change=bad_callback, fail_threshold=2)

    # Trigger offline — callback raise — không propagate
    checker.check_once()
    checker.check_once()  # hit threshold → fire callback
    assert checker.is_online is False  # state vẫn update đúng
