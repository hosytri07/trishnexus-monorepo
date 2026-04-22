"""Bootstrap entry — dispatcher cho TrishTEAM.exe.

TrishTEAM.exe là binary duy nhất chạy mọi app trong suite. Được gọi bởi:

    - Double-click Launcher shortcut (no args) → mở GUI Launcher
    - Double-click app shortcut "launch trishfont" → mở app TrishFont đã cài
    - CLI admin (uninstall, apps list, version)

Flow khi gọi `TrishTEAM.exe launch <app_id>`:

    1. Resolve install root (registry / env / fallback) qua locations.py
    2. Mở `<root>/apps/<app_id>/manifest.json`, parse `entry` = "module:func"
    3. Thêm `<root>/apps/<app_id>/code/` vào sys.path
    4. `importlib.import_module(module).func()` — app chạy trong process này
    5. App dùng chung `trishteam_core` + `PyQt6` đã bundle trong `_internal/`

Tại sao dispatcher 1 binary thay vì mỗi app 1 .exe:

    - Tiết kiệm 60MB/app (PyQt6 + Python runtime dùng chung)
    - Update Python/PyQt6 centralized, app chỉ cần ship .pyc
    - Consistent registry + shortcut scheme

Args:
    (no args)                 — mở GUI Launcher
    launcher                  — tương đương no args
    launch <app_id> [args]    — chạy app đã cài
    uninstall <app_id>        — gỡ app
    apps                      — liệt kê app đã cài (JSON out)
    version                   — in TrishTEAM Runtime version
    --help | -h               — in usage

Exit codes:
    0   — thành công
    1   — error chung
    2   — app chưa cài / không tìm thấy
    3   — manifest hỏng / bytecode incompat
    4   — args sai
"""

from __future__ import annotations

import argparse
import importlib
import json
import sys
from pathlib import Path
from typing import Any

# ─────────────────── Runtime metadata ───────────────────

RUNTIME_VERSION = "0.1.0"
RUNTIME_NAME = "TrishTEAM Runtime"


# ─────────────────── Helpers ───────────────────


def _current_bytecode_version() -> str:
    return f"{sys.version_info.major}.{sys.version_info.minor}"


def _print_err(msg: str) -> None:
    print(f"[TrishTEAM] {msg}", file=sys.stderr)


def _load_manifest(app_id: str) -> tuple[Path, dict[str, Any]]:
    """Return (install_path, manifest_dict). Raise FileNotFoundError nếu chưa cài."""
    # Lazy import để tránh load PyQt6/requests cho path resolve
    from trishlauncher.modules.install.locations import app_install_path

    install_path = app_install_path(app_id)
    manifest_file = install_path / "manifest.json"
    if not manifest_file.is_file():
        raise FileNotFoundError(
            f"App '{app_id}' chưa cài. Mở Launcher để cài."
        )
    manifest = json.loads(manifest_file.read_text(encoding="utf-8"))
    return install_path, manifest


def _verify_bytecode_compat(manifest: dict[str, Any]) -> None:
    """Raise RuntimeError nếu manifest.runtime.python_bytecode khác runtime."""
    runtime = manifest.get("runtime", {}) or {}
    bytecode = runtime.get("python_bytecode")
    current = _current_bytecode_version()
    if bytecode and bytecode != current:
        raise RuntimeError(
            f"App '{manifest.get('id')}' compile bởi Python {bytecode}, "
            f"Runtime hiện tại {current}. Cài lại app hoặc upgrade Runtime."
        )


# ─────────────────── Commands ───────────────────


def cmd_launcher(argv: list[str]) -> int:
    """Mở GUI Launcher — dispatch sang `trishlauncher.app:main`."""
    # Lazy import để launch app khác không phải load QApplication
    from trishlauncher.app import main as launcher_main
    return launcher_main()


def cmd_launch(argv: list[str]) -> int:
    """Chạy 1 app đã cài: `TrishTEAM.exe launch <app_id> [extra args...]`."""
    parser = argparse.ArgumentParser(prog="TrishTEAM launch")
    parser.add_argument("app_id", help="App id (ví dụ: trishfont)")
    parser.add_argument("rest", nargs=argparse.REMAINDER,
                        help="Args truyền tiếp cho app")
    ns = parser.parse_args(argv)

    try:
        install_path, manifest = _load_manifest(ns.app_id)
    except FileNotFoundError as e:
        _print_err(str(e))
        return 2
    except json.JSONDecodeError as e:
        _print_err(f"manifest.json hỏng: {e}")
        return 3

    try:
        _verify_bytecode_compat(manifest)
    except RuntimeError as e:
        _print_err(str(e))
        return 3

    entry = manifest.get("entry")
    if not entry or ":" not in entry:
        _print_err(f"manifest.entry sai format, cần 'module:function', got '{entry}'")
        return 3
    module_path, func_name = entry.split(":", 1)

    # Thêm code/ vào sys.path để import được module của app
    code_dir = install_path / "code"
    if code_dir.is_dir():
        sys.path.insert(0, str(code_dir))

    # Thay sys.argv để app parse args chính nó
    sys.argv = [f"{ns.app_id}", *ns.rest]

    try:
        mod = importlib.import_module(module_path)
    except ImportError as e:
        _print_err(f"Không import được {module_path}: {e}")
        return 1

    func = getattr(mod, func_name, None)
    if not callable(func):
        _print_err(f"{module_path}.{func_name} không callable")
        return 1

    try:
        rc = func()
    except SystemExit as e:
        return int(e.code or 0)
    except Exception as e:
        _print_err(f"App '{ns.app_id}' crash: {type(e).__name__}: {e}")
        return 1

    return int(rc or 0)


def cmd_uninstall(argv: list[str]) -> int:
    """Gỡ 1 app: `TrishTEAM.exe uninstall <app_id> [--quiet]`.

    --quiet: không in thông báo stdout (dùng khi NSIS gọi batch).
    """
    parser = argparse.ArgumentParser(prog="TrishTEAM uninstall")
    parser.add_argument("app_id")
    parser.add_argument("--quiet", action="store_true",
                        help="Không in thông báo, chỉ return code")
    ns = parser.parse_args(argv)

    from trishteam_core.store import Database, migrate
    from trishteam_core.utils import user_data_dir_for

    from trishlauncher.modules.install.worker import uninstall_app
    from trishlauncher.modules.registry.models import MIGRATION_001_LAUNCHER

    db_path = user_data_dir_for("TrishLauncher") / "data.db"
    db = Database(db_path)
    migrate(db, [(1, MIGRATION_001_LAUNCHER)])

    ok, msg = uninstall_app(db, ns.app_id)
    db.close()
    if not ns.quiet:
        print(msg)
    return 0 if ok else 1


def cmd_apps(argv: list[str]) -> int:
    """In JSON danh sách app đã cài."""
    from trishteam_core.store import Database, migrate
    from trishteam_core.utils import user_data_dir_for

    from trishlauncher.modules.registry.models import MIGRATION_001_LAUNCHER
    from trishlauncher.modules.registry.repository import RegistryRepository

    db_path = user_data_dir_for("TrishLauncher") / "data.db"
    db = Database(db_path)
    migrate(db, [(1, MIGRATION_001_LAUNCHER)])
    repo = RegistryRepository(db)
    installed = repo.list_installed()
    db.close()
    print(json.dumps(installed, indent=2, ensure_ascii=False))
    return 0


def cmd_version(argv: list[str]) -> int:
    print(f"{RUNTIME_NAME} {RUNTIME_VERSION}")
    print(f"  Python {sys.version.split()[0]}")
    print(f"  Bytecode {_current_bytecode_version()}")
    return 0


def cmd_help(argv: list[str]) -> int:
    print(__doc__ or "TrishTEAM Runtime")
    return 0


# ─────────────────── Dispatch ───────────────────


COMMANDS = {
    "launcher":  cmd_launcher,
    "launch":    cmd_launch,
    "uninstall": cmd_uninstall,
    "apps":      cmd_apps,
    "version":   cmd_version,
    "--version": cmd_version,
    "-v":        cmd_version,
    "help":      cmd_help,
    "--help":    cmd_help,
    "-h":        cmd_help,
}


def main(argv: list[str] | None = None) -> int:
    if argv is None:
        argv = sys.argv[1:]

    # No args → mở Launcher GUI
    if not argv:
        return cmd_launcher([])

    cmd = argv[0]
    rest = argv[1:]
    handler = COMMANDS.get(cmd)
    if handler is None:
        _print_err(f"Lệnh không hợp lệ: '{cmd}'. Gõ 'TrishTEAM --help' để xem usage.")
        return 4
    return handler(rest)


if __name__ == "__main__":
    sys.exit(main())
