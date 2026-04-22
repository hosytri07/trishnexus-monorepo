"""Smoke test — uninstall flow (cross-platform).

Test các hàm của task #63:
    - control_panel.register/unregister/list_registered_apps (no-op trên Linux)
    - bootstrap `uninstall <app> --quiet` flag
    - worker.uninstall_app vẫn chạy đúng sau khi thêm control_panel wire

NSIS custom page + sweep logic phải test trên Windows thật (không automated).

Chạy:
    python scripts/uninstall_smoke.py
"""

from __future__ import annotations

import io
import json
import os
import sys
import tempfile
from contextlib import redirect_stdout, redirect_stderr
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "shared" / "trishteam_core" / "src"))
sys.path.insert(0, str(REPO_ROOT / "apps" / "trishlauncher" / "src"))

from trishteam_core.store import Database, migrate  # noqa: E402

from trishlauncher.bootstrap import main as bootstrap_main  # noqa: E402
from trishlauncher.modules.install.control_panel import (  # noqa: E402
    list_registered_apps,
    register_uninstall_entry,
    unregister_uninstall_entry,
)
from trishlauncher.modules.install.locations import app_install_path  # noqa: E402
from trishlauncher.modules.install.worker import uninstall_app  # noqa: E402
from trishlauncher.modules.registry.models import MIGRATION_001_LAUNCHER  # noqa: E402
from trishlauncher.modules.registry.repository import RegistryRepository  # noqa: E402


def _banner(t: str) -> None:
    print(f"\n{'═' * 60}\n {t}\n{'═' * 60}")


def _check(cond: bool, msg: str) -> None:
    sym = "✅" if cond else "❌"
    print(f"  {sym} {msg}")
    if not cond:
        raise AssertionError(msg)


def _run_bootstrap(argv: list[str]) -> tuple[int, str, str]:
    out_buf, err_buf = io.StringIO(), io.StringIO()
    with redirect_stdout(out_buf), redirect_stderr(err_buf):
        try:
            rc = bootstrap_main(argv)
        except SystemExit as e:
            rc = int(e.code or 0)
    return rc, out_buf.getvalue(), err_buf.getvalue()


def test_control_panel_noop_on_linux():
    _banner("1. control_panel: no-op trên non-Windows")
    # Tất cả hàm phải return False / [] thay vì crash
    ok_reg = register_uninstall_entry("trishfont", {"name": "TrishFont"}, Path("/tmp"))
    _check(ok_reg is False, "register_uninstall_entry trả False trên Linux")

    ok_un = unregister_uninstall_entry("trishfont")
    _check(ok_un is False, "unregister_uninstall_entry trả False trên Linux")

    apps = list_registered_apps()
    _check(apps == [], f"list_registered_apps trả [] trên Linux (got {apps})")


def test_folder_size_helper():
    _banner("2. control_panel: _folder_size_kb tính đúng")
    from trishlauncher.modules.install.control_panel import _folder_size_kb

    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp) / "fakeapp"
        root.mkdir()
        (root / "a.pyc").write_bytes(b"x" * 2048)  # 2 KB
        (root / "b.ico").write_bytes(b"y" * 3072)  # 3 KB
        (root / "sub").mkdir()
        (root / "sub" / "c.json").write_bytes(b"z" * 1024)  # 1 KB

        size = _folder_size_kb(root)
        # 6144 bytes / 1024 = 6 KB (exact; phụ thuộc FS block khác không)
        _check(size == 6, f"size tính tổng 3 file = 6 KB (got {size})")

    _check(_folder_size_kb(Path("/nonexistent-path-xyz")) == 0,
           "folder không tồn tại → 0")


def test_uninstall_quiet_flag(tmp_root: Path):
    _banner("3. bootstrap: `uninstall <app> --quiet` → không in stdout")
    os.environ["TRISHTEAM_ROOT"] = str(tmp_root / "TrishTEAM")

    # Tạo fake app để uninstall
    install_path = app_install_path("quietapp")
    install_path.mkdir(parents=True, exist_ok=True)
    (install_path / "manifest.json").write_text(
        json.dumps({"id": "quietapp", "version": "0.0.1", "provides_shortcuts": []}),
        encoding="utf-8",
    )

    # Register DB row để uninstall_app có gì xoá
    from trishteam_core.utils import user_data_dir_for
    db_path = user_data_dir_for("TrishLauncher") / "data.db"
    # Redirect user_data_dir_for bằng cách set env (nếu có) hoặc cleanup trước
    db = Database(db_path)
    migrate(db, [(1, MIGRATION_001_LAUNCHER)])
    repo = RegistryRepository(db)
    repo.mark_installed("quietapp", "0.0.1", str(install_path))
    db.close()

    # Test --quiet: không in stdout
    rc, out, err = _run_bootstrap(["uninstall", "quietapp", "--quiet"])
    _check(rc == 0, f"rc == 0 (got {rc}, err={err!r})")
    _check(out.strip() == "", f"stdout rỗng khi --quiet (got {out!r})")


def test_uninstall_verbose(tmp_root: Path):
    _banner("4. bootstrap: `uninstall <app>` (no --quiet) → in thông báo")
    os.environ["TRISHTEAM_ROOT"] = str(tmp_root / "TrishTEAM")

    install_path = app_install_path("verboseapp")
    install_path.mkdir(parents=True, exist_ok=True)
    (install_path / "manifest.json").write_text(
        json.dumps({"id": "verboseapp", "version": "0.0.1", "provides_shortcuts": []}),
        encoding="utf-8",
    )

    from trishteam_core.utils import user_data_dir_for
    db_path = user_data_dir_for("TrishLauncher") / "data.db"
    db = Database(db_path)
    migrate(db, [(1, MIGRATION_001_LAUNCHER)])
    repo = RegistryRepository(db)
    repo.mark_installed("verboseapp", "0.0.1", str(install_path))
    db.close()

    rc, out, _err = _run_bootstrap(["uninstall", "verboseapp"])
    _check(rc == 0, f"rc == 0 (got {rc})")
    _check("Đã gỡ verboseapp" in out, f"stdout có msg (got {out!r})")


def test_uninstall_app_with_control_panel_wire(tmp_root: Path):
    _banner("5. worker.uninstall_app: wire control_panel không crash trên Linux")
    os.environ["TRISHTEAM_ROOT"] = str(tmp_root / "TrishTEAM")

    install_path = app_install_path("wiredapp")
    install_path.mkdir(parents=True, exist_ok=True)
    (install_path / "manifest.json").write_text(
        json.dumps({
            "id": "wiredapp",
            "version": "0.0.1",
            "provides_shortcuts": [
                {"name": "WiredApp", "args": "launch wiredapp"},
            ],
        }),
        encoding="utf-8",
    )

    db = Database(str(tmp_root / "wire.db"))
    migrate(db, [(1, MIGRATION_001_LAUNCHER)])
    repo = RegistryRepository(db)
    repo.mark_installed("wiredapp", "0.0.1", str(install_path))

    ok, msg = uninstall_app(db, "wiredapp")
    _check(ok, f"uninstall_app OK: {msg}")
    _check(not install_path.exists(), "install folder đã xoá")
    _check(repo.get_installed("wiredapp") is None, "DB row đã xoá")
    db.close()


def main() -> int:
    print("🧪 Uninstall flow smoke test\n")
    with tempfile.TemporaryDirectory(prefix="trishteam-uninst-") as tmp:
        tmp_root = Path(tmp)

        # Override HOME để user_data_dir_for không đụng thật
        os.environ["HOME"] = str(tmp_root)
        os.environ["XDG_DATA_HOME"] = str(tmp_root / "xdg-data")
        os.environ["XDG_CONFIG_HOME"] = str(tmp_root / "xdg-config")

        test_control_panel_noop_on_linux()
        test_folder_size_helper()
        test_uninstall_quiet_flag(tmp_root)
        test_uninstall_verbose(tmp_root)
        test_uninstall_app_with_control_panel_wire(tmp_root)

    print("\n✅ All uninstall smoke tests passed.")
    print("   (NSIS custom page + sweep logic phải test trên Windows thật)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
