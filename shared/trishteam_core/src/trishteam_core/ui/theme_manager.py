"""theme_manager — runtime theme switcher singleton.

Phase 13.3 / Task #69. Wrap `theme_registry` bằng 1 QObject singleton để
các app PyQt6 có thể:

    from trishteam_core.ui.theme_manager import theme_manager

    theme_manager.init()                         # load persisted + default
    theme_manager.apply(QApplication.instance())  # reapply current theme
    theme_manager.theme_changed.connect(on_changed)
    theme_manager.set_theme("midnight")

Design quyết:

- **Không** dùng QSettings — persist qua plain JSON file dưới
  platformdirs user_config_dir. Lý do: QSettings khác path per-app (tên
  app), nhưng theme choice phải **share across 11 app**. User đổi theme
  ở TrishLauncher → TrishFont mở sau cũng thấy theme mới.
- Fallback persist chỗ lỗi: nếu write file fail → log + skip silently
  (user vẫn thấy theme mới trong session hiện tại, lần sau revert
  default). Đừng crash app chỉ vì không ghi được 1 dòng JSON.
- PyQt6 import guard: nếu PyQt6 chưa install (test headless) → class
  vẫn dùng được nhưng signal là no-op stub. Test logic không cần Qt.

Persist path: `<user_config_dir>/TrishTEAM/theme.json`
  { "theme": "midnight" }
"""

from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from threading import RLock
from typing import Callable

from . import theme_registry

_log = logging.getLogger(__name__)

# ---------- Qt import guard ----------

try:
    from PyQt6.QtCore import QObject, pyqtSignal
    from PyQt6.QtWidgets import QApplication, QWidget

    _QT_AVAILABLE = True

    class _ThemeSignalBus(QObject):
        """Separate QObject vì QObject init cần QApplication cho signal."""

        theme_changed = pyqtSignal(str)  # theme_key
except ImportError:  # pragma: no cover — headless
    _QT_AVAILABLE = False
    QApplication = None  # type: ignore[assignment]
    QWidget = None  # type: ignore[assignment]

    class _ThemeSignalBus:  # type: ignore[no-redef]
        """Stub — khi PyQt6 không có thì signal chỉ là callable list."""

        def __init__(self) -> None:
            self._slots: list[Callable[[str], None]] = []

        class _Signal:
            def __init__(self, bus: "_ThemeSignalBus") -> None:
                self._bus = bus

            def connect(self, slot: Callable[[str], None]) -> None:
                self._bus._slots.append(slot)

            def disconnect(self, slot: Callable[[str], None] | None = None) -> None:
                if slot is None:
                    self._bus._slots.clear()
                else:
                    self._bus._slots = [s for s in self._bus._slots if s is not slot]

            def emit(self, value: str) -> None:
                for slot in list(self._bus._slots):
                    try:
                        slot(value)
                    except Exception:  # pragma: no cover — defensive
                        _log.exception("theme_changed slot raised")

        @property
        def theme_changed(self) -> "_ThemeSignalBus._Signal":
            if not hasattr(self, "_signal"):
                self._signal = _ThemeSignalBus._Signal(self)
            return self._signal


# ---------- Persist helpers ----------

_APP_DIR_NAME = "TrishTEAM"
_PERSIST_FILENAME = "theme.json"
_ENV_OVERRIDE = "TRISHTEAM_THEME_CONFIG_DIR"


def _config_dir() -> Path:
    """Tìm dir persist theme.json.

    Ưu tiên:
    1. Env `TRISHTEAM_THEME_CONFIG_DIR` (test + installer override).
    2. `platformdirs.user_config_dir("TrishTEAM")` nếu có.
    3. `~/.trishteam` fallback.
    """
    override = os.environ.get(_ENV_OVERRIDE)
    if override:
        return Path(override)

    try:
        import platformdirs

        return Path(platformdirs.user_config_dir(_APP_DIR_NAME))
    except ImportError:  # pragma: no cover
        return Path.home() / ".trishteam"


def _persist_path() -> Path:
    return _config_dir() / _PERSIST_FILENAME


def _load_persisted() -> str | None:
    p = _persist_path()
    if not p.is_file():
        return None
    try:
        data = json.loads(p.read_text(encoding="utf-8"))
        val = data.get("theme")
        return val if isinstance(val, str) and val else None
    except (json.JSONDecodeError, OSError):
        _log.warning("theme persist file corrupt at %s — ignored", p)
        return None


def _save_persisted(theme_key: str) -> bool:
    p = _persist_path()
    try:
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(
            json.dumps({"theme": theme_key}, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        return True
    except OSError as err:
        _log.warning("failed to persist theme to %s: %s", p, err)
        return False


# ---------- ThemeManager singleton ----------

class ThemeManager:
    """Singleton — canonical source cho current theme qua runtime.

    Thread-safe (lock bảo vệ _current). Signal emit vẫn chạy trên thread
    gọi `set_theme` — caller responsibility để gọi từ GUI thread.
    """

    def __init__(self) -> None:
        self._lock = RLock()
        self._current: str | None = None
        self._bus = _ThemeSignalBus()

    # -- Lifecycle --

    def init(self, fallback: str | None = None) -> str:
        """Nạp theme từ persist hoặc default bundle. Trả về theme_key áp dụng.

        Phase 13.5 (2026-04-23): thêm alias resolver — persist file cũ chứa
        'trishwarm'/'candy'/'midnight'/... auto-map sang 'dark'/'light' theo
        `bundle.aliases`.
        """
        with self._lock:
            bundle = theme_registry.get_bundle()
            chosen = _load_persisted() or fallback or bundle.default_theme
            # Resolve alias trước khi check tồn tại (legacy 7-theme → 2-theme)
            if chosen not in bundle.themes and chosen in bundle.aliases:
                chosen = bundle.aliases[chosen]
            if chosen not in bundle.themes:
                _log.warning(
                    "persisted theme '%s' unknown — fallback to default '%s'",
                    chosen,
                    bundle.default_theme,
                )
                chosen = bundle.default_theme
            self._current = chosen
            return chosen

    # -- Signal access --

    @property
    def theme_changed(self):
        """Signal `pyqtSignal(str)` — emit khi `set_theme` đổi value."""
        return self._bus.theme_changed

    # -- State --

    @property
    def current(self) -> str:
        """Theme key hiện tại. Nếu chưa init → auto-init về default."""
        with self._lock:
            if self._current is None:
                self.init()
            return self._current  # type: ignore[return-value]

    def list_themes(self) -> list[tuple[str, str]]:
        return theme_registry.list_themes()

    # -- Mutate --

    def set_theme(
        self,
        theme_key: str,
        *,
        persist: bool = True,
        target: "QApplication | QWidget | None" = None,
    ) -> bool:
        """Đổi theme. Return True nếu thật sự đổi (khác current).

        - theme_key: key trong tokens.v2.json.
        - persist: ghi xuống file để session sau nhớ (default True).
        - target: nếu cho QApplication/QWidget, tự áp stylesheet luôn.

        Raise ThemeError("unknown_theme") nếu key không tồn tại.
        """
        theme_registry.get_theme(theme_key)  # validate — raise nếu sai
        # Phase 13.5: resolve alias để persist key canonical ('dark' chứ
        # không phải 'trishwarm' dù user click từ menu có alias).
        theme_key = theme_registry.resolve_alias(theme_key)
        with self._lock:
            if self._current == theme_key:
                # Vẫn reapply nếu target được truyền — tiện cho smoke.
                if target is not None:
                    self._apply_to(target, theme_key)
                return False
            self._current = theme_key

        if persist:
            _save_persisted(theme_key)
        if target is not None:
            self._apply_to(target, theme_key)

        self._bus.theme_changed.emit(theme_key)
        return True

    def apply(self, target: "QApplication | QWidget") -> None:
        """Re-apply current stylesheet to target — dùng khi mở window mới."""
        self._apply_to(target, self.current)

    @staticmethod
    def _apply_to(target: "QApplication | QWidget", theme_key: str) -> None:
        qss = theme_registry.build_qss_from_theme(theme_key)
        # Nếu target là QApplication → set default font Be Vietnam Pro
        # (Qt StyleHint.SansSerif fallback). Bảo đảm runtime switch không
        # reset font về default hệ thống.
        if _QT_AVAILABLE:
            try:
                from PyQt6.QtGui import QFont

                if hasattr(target, "setFont"):
                    f = QFont("Be Vietnam Pro", 10)
                    f.setStyleHint(QFont.StyleHint.SansSerif)
                    target.setFont(f)
            except Exception:  # pragma: no cover — defensive
                pass
        if hasattr(target, "setStyleSheet"):
            target.setStyleSheet(qss)

    # -- Test helper --

    def _reset_for_tests(self) -> None:
        with self._lock:
            self._current = None
        self._bus.theme_changed.disconnect()


# Singleton — module-level. Import là có.
theme_manager = ThemeManager()


__all__ = ["ThemeManager", "theme_manager"]
