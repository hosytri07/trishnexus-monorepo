"""Worker — chạy function bất kỳ trên QThread, emit finished(result) hoặc failed(err)."""

from __future__ import annotations

from typing import Any, Callable

from PyQt6.QtCore import QObject, QThread, pyqtSignal


class _Payload(QObject):
    finished = pyqtSignal(object)
    failed = pyqtSignal(Exception)


class Worker(QThread):
    def __init__(self, fn: Callable[..., Any], *args, **kwargs) -> None:
        super().__init__()
        self._fn = fn
        self._args = args
        self._kwargs = kwargs
        self.signals = _Payload()

    def run(self) -> None:
        try:
            result = self._fn(*self._args, **self._kwargs)
            self.signals.finished.emit(result)
        except Exception as e:  # noqa: BLE001
            self.signals.failed.emit(e)


def run_in_thread(
    fn: Callable[..., Any],
    *args,
    on_done: Callable[[Any], None] | None = None,
    on_error: Callable[[Exception], None] | None = None,
    parent: QObject | None = None,
    **kwargs,
) -> Worker:
    w = Worker(fn, *args, **kwargs)
    if parent is not None:
        w.setParent(parent)
    if on_done:
        w.signals.finished.connect(on_done)
    if on_error:
        w.signals.failed.connect(on_error)
    w.start()
    return w
