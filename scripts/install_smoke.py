"""Smoke test — install worker non-network paths.

Test các helper của apps/trishlauncher/.../modules/install/:
    - locations: path resolution
    - shortcuts: tạo .desktop trên Linux (verify pattern, không cần pywin32)
    - worker._safe_extract_tpack: zip-slip + extract hợp lệ
    - worker._read_manifest_from_tpack + _verify_compat
    - uninstall_app: gỡ + xoá DB row

Không test network (.tpack download), phần đó phải test thủ công trên Windows.
Chạy:
    python scripts/install_smoke.py
"""

from __future__ import annotations

import os
import shutil
import sys
import tempfile
from pathlib import Path

# Wire module path để import được trishteam_core + trishlauncher mà không cần
# `pip install -e .`
REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "shared" / "trishteam_core" / "src"))
sys.path.insert(0, str(REPO_ROOT / "apps" / "trishlauncher" / "src"))

from trishteam_core.store import Database, migrate  # noqa: E402
from trishlauncher.modules.install.locations import (  # noqa: E402
    app_install_path,
    resolve_trishteam_root,
)
from trishlauncher.modules.install.worker import (  # noqa: E402
    _read_manifest_from_tpack,
    _safe_extract_tpack,
    _verify_compat,
    uninstall_app,
)
from trishlauncher.modules.install.shortcuts import (  # noqa: E402
    create_shortcuts_for_app,
    remove_shortcuts_for_app,
)
from trishlauncher.modules.registry.models import MIGRATION_001_LAUNCHER  # noqa: E402
from trishlauncher.modules.registry.repository import RegistryRepository  # noqa: E402


def _banner(t: str) -> None:
    print(f"\n{'═' * 60}\n {t}\n{'═' * 60}")


def _check(cond: bool, msg: str) -> None:
    sym = "✅" if cond else "❌"
    print(f"  {sym} {msg}")
    if not cond:
        raise AssertionError(msg)


def test_locations_resolve():
    _banner("1. locations: resolve paths")
    root = resolve_trishteam_root()
    print(f"  TrishTEAM root: {root}")
    _check(root.is_absolute(), "root phải là absolute path")
    ap = app_install_path("trishfont")
    _check(
        ap == root / "apps" / "trishfont",
        f"app_install_path('trishfont') = {ap}",
    )


def test_safe_extract_blocks_zip_slip():
    _banner("2. worker: _safe_extract_tpack block zip-slip")
    import zipfile

    with tempfile.TemporaryDirectory() as tmp:
        evil_zip = Path(tmp) / "evil.zip"
        target = Path(tmp) / "target"
        target.mkdir()
        # Tạo zip có entry "../outside.txt"
        with zipfile.ZipFile(evil_zip, "w") as zf:
            zf.writestr("../outside.txt", "malicious")
        try:
            _safe_extract_tpack(evil_zip, target)
            _check(False, "Phải raise ValueError cho entry '../outside.txt'")
        except ValueError as e:
            _check(True, f"block zip-slip '../' đúng: {e}")

        # Absolute path
        abs_zip = Path(tmp) / "abs.zip"
        with zipfile.ZipFile(abs_zip, "w") as zf:
            zf.writestr("/tmp/absolute.txt", "bad")
        try:
            _safe_extract_tpack(abs_zip, target)
            _check(False, "Phải raise ValueError cho absolute path")
        except ValueError as e:
            _check(True, f"block absolute path đúng: {e}")


def test_extract_real_tpack():
    _banner("3. worker: extract trishfont-0.1.0.tpack thật")
    tpack = REPO_ROOT / "dist" / "trishfont-0.1.0.tpack"
    if not tpack.is_file():
        print(f"  ⚠ Skip: không có {tpack} — chạy build-app-tpack.py trước")
        return False

    # Read + verify manifest
    manifest = _read_manifest_from_tpack(tpack)
    print(f"  manifest.id = {manifest.get('id')}")
    print(f"  manifest.version = {manifest.get('version')}")
    print(f"  manifest.file_count = {manifest.get('file_count')}")
    _check(manifest.get("id") == "trishfont", "manifest.id == 'trishfont'")

    # Verify compat — id/version phải match
    try:
        _verify_compat(manifest, "trishfont", "0.1.0")
        _check(True, "_verify_compat pass với id/version đúng")
    except ValueError as e:
        _check(False, f"_verify_compat fail: {e}")

    # Verify compat — wrong version nên raise
    try:
        _verify_compat(manifest, "trishfont", "9.9.9")
        _check(False, "Phải raise với version mismatch")
    except ValueError:
        _check(True, "block version mismatch đúng")

    # Extract vào temp dir
    with tempfile.TemporaryDirectory() as tmp:
        install_dir = Path(tmp) / "apps" / "trishfont"
        install_dir.mkdir(parents=True)
        _safe_extract_tpack(tpack, install_dir)
        _check(
            (install_dir / "manifest.json").is_file(),
            "manifest.json extracted",
        )
        _check(
            (install_dir / "code" / "trishfont" / "app.pyc").is_file(),
            "code/trishfont/app.pyc extracted",
        )
        _check(
            (install_dir / "resources" / "app.ico").is_file(),
            "resources/app.ico extracted",
        )
        # Không có file .py (đã compile sạch)
        py_files = list(install_dir.rglob("*.py"))
        _check(
            not py_files,
            f"Không còn .py source ({len(py_files)} found — mong 0)",
        )
    return True


def test_shortcut_create_and_remove(tmp_root: Path):
    _banner("4. shortcuts: tạo .desktop (Linux) / .lnk (Windows)")
    # Override HOME cho test an toàn — không đụng Desktop thật
    os.environ["HOME"] = str(tmp_root)
    os.environ.pop("USERPROFILE", None)
    os.environ.pop("APPDATA", None)

    # Tạo install_path giả có app.ico
    install_path = app_install_path("trishfont")
    install_path.mkdir(parents=True, exist_ok=True)
    (install_path / "resources").mkdir(exist_ok=True)
    (install_path / "resources" / "app.ico").write_bytes(b"fake icon")

    spec = [
        {
            "name": "TrishFont",
            "icon": "resources/app.ico",
            "args": "launch trishfont",
            "description": "Test shortcut",
        }
    ]

    if sys.platform == "win32":
        try:
            import win32com.client  # noqa: F401
        except ImportError:
            print("  ⚠ Skip: pywin32 không có — không test Windows shortcut")
            return

    created = create_shortcuts_for_app("trishfont", spec)
    _check(len(created) > 0, f"tạo được {len(created)} shortcut")
    for p in created:
        _check(p.exists(), f"shortcut tồn tại: {p.name}")

    # Remove
    removed = remove_shortcuts_for_app("trishfont", spec)
    _check(len(removed) == len(created), f"xoá {len(removed)}/{len(created)} shortcut")
    for p in removed:
        _check(not p.exists(), f"đã xoá: {p.name}")


def test_db_register_and_uninstall(tmp_root: Path):
    _banner("5. DB: mark_installed + uninstall_app")
    db_path = tmp_root / "launcher.db"
    db = Database(str(db_path))
    migrate(db, [(1, MIGRATION_001_LAUNCHER)])

    repo = RegistryRepository(db)
    repo.mark_installed("trishfont", "0.1.0", str(app_install_path("trishfont")))
    row = repo.get_installed("trishfont")
    _check(row is not None, "installed_apps có row sau mark_installed")
    _check(row[0] == "0.1.0", f"installed_version = 0.1.0 (got {row[0]})")

    # Fake install folder với manifest cho uninstall_app
    ip = app_install_path("trishfont")
    ip.mkdir(parents=True, exist_ok=True)
    (ip / "manifest.json").write_text(
        '{"provides_shortcuts": []}', encoding="utf-8"
    )

    ok, msg = uninstall_app(db, "trishfont")
    _check(ok, f"uninstall_app return OK: {msg}")
    _check(not ip.exists(), "folder install đã xoá")
    _check(repo.get_installed("trishfont") is None, "DB row đã xoá")

    db.close()


def main() -> int:
    print("🧪 Install worker smoke test\n")
    with tempfile.TemporaryDirectory(prefix="trishteam-smoke-") as tmp:
        tmp_root = Path(tmp)
        os.environ["TRISHTEAM_ROOT"] = str(tmp_root / "TrishTEAM")

        test_locations_resolve()
        test_safe_extract_blocks_zip_slip()
        tpack_ok = test_extract_real_tpack()
        test_shortcut_create_and_remove(tmp_root)
        test_db_register_and_uninstall(tmp_root)

    print("\n✅ All smoke tests passed.")
    if not tpack_ok:
        print("   (Note: .tpack extract test skipped — no dist/)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
