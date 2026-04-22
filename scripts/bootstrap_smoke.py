"""Smoke test — bootstrap dispatcher (cross-platform).

Test các command của `trishlauncher.bootstrap.main()` KHÔNG build PyInstaller:

    - `version` → in RUNTIME_VERSION
    - `--help`  → in docstring
    - `launch <app_id>` với app chưa cài → return 2 + msg hợp lệ
    - `launch <app_id>` với app FAKE (manifest + .pyc thật) → import + chạy
    - `apps` → in JSON (rỗng OK)
    - Command lạ → return 4

Không test:
    - GUI Launcher (cần QApplication — chạy tay)
    - PyInstaller freeze (cần Windows)
    - NSIS wizard (cần Windows + NSIS)

Chạy:
    python scripts/bootstrap_smoke.py
"""

from __future__ import annotations

import io
import json
import os
import py_compile
import sys
import tempfile
from contextlib import redirect_stdout, redirect_stderr
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "shared" / "trishteam_core" / "src"))
sys.path.insert(0, str(REPO_ROOT / "apps" / "trishlauncher" / "src"))

from trishlauncher.bootstrap import main as bootstrap_main  # noqa: E402


def _banner(t: str) -> None:
    print(f"\n{'═' * 60}\n {t}\n{'═' * 60}")


def _check(cond: bool, msg: str) -> None:
    sym = "✅" if cond else "❌"
    print(f"  {sym} {msg}")
    if not cond:
        raise AssertionError(msg)


def _run(argv: list[str]) -> tuple[int, str, str]:
    """Gọi bootstrap_main(argv), capture stdout + stderr, return (rc, out, err)."""
    out_buf, err_buf = io.StringIO(), io.StringIO()
    with redirect_stdout(out_buf), redirect_stderr(err_buf):
        try:
            rc = bootstrap_main(argv)
        except SystemExit as e:
            rc = int(e.code or 0)
    return rc, out_buf.getvalue(), err_buf.getvalue()


def test_version():
    _banner("1. bootstrap: `version` command")
    rc, out, _err = _run(["version"])
    _check(rc == 0, "rc == 0")
    _check("TrishTEAM Runtime" in out, f"output chứa runtime name: {out!r}")
    _check("0.1.0" in out, "output chứa version 0.1.0")


def test_help():
    _banner("2. bootstrap: `--help` command")
    rc, out, _err = _run(["--help"])
    _check(rc == 0, "rc == 0")
    _check("Bootstrap entry" in out or "dispatcher" in out, "in docstring")


def test_unknown_command():
    _banner("3. bootstrap: unknown command → rc=4")
    rc, _out, err = _run(["nonsense-command"])
    _check(rc == 4, f"rc == 4 (got {rc})")
    _check("không hợp lệ" in err or "invalid" in err.lower(), "err có msg hợp lệ")


def test_launch_not_installed(tmp_root: Path):
    _banner("4. bootstrap: `launch <unknown-app>` → rc=2")
    os.environ["TRISHTEAM_ROOT"] = str(tmp_root / "TrishTEAM")
    rc, _out, err = _run(["launch", "this-app-does-not-exist"])
    _check(rc == 2, f"rc == 2 (got {rc})")
    _check("chưa cài" in err, f"err nhắc 'chưa cài': {err!r}")


def test_launch_fake_app(tmp_root: Path):
    _banner("5. bootstrap: `launch fakeapp` với app giả hoàn chỉnh")
    os.environ["TRISHTEAM_ROOT"] = str(tmp_root / "TrishTEAM")

    # Build app giả: tmp_root/TrishTEAM/apps/fakeapp/
    from trishlauncher.modules.install.locations import app_install_path

    install_path = app_install_path("fakeapp")
    (install_path / "code" / "fakeapp").mkdir(parents=True, exist_ok=True)

    # Source file
    app_src = install_path / "code" / "fakeapp" / "app.py"
    app_src.write_text(
        "def main():\n"
        "    print('FAKEAPP_RAN_OK')\n"
        "    return 42\n",
        encoding="utf-8",
    )
    # Compile → .pyc (giả lập .tpack sau extract)
    py_compile.compile(str(app_src), cfile=str(app_src.with_suffix(".pyc")))
    app_src.unlink()

    # Viết manifest
    current_bytecode = f"{sys.version_info.major}.{sys.version_info.minor}"
    manifest = {
        "schema_version": 1,
        "id": "fakeapp",
        "name": "FakeApp",
        "version": "0.0.1",
        "entry": "fakeapp.app:main",
        "runtime": {
            "python_bytecode": current_bytecode,
        },
    }
    (install_path / "manifest.json").write_text(
        json.dumps(manifest, indent=2), encoding="utf-8"
    )

    rc, out, _err = _run(["launch", "fakeapp"])
    _check(rc == 42, f"rc == 42 (return value của fakeapp.main, got {rc})")
    _check("FAKEAPP_RAN_OK" in out, f"app đã chạy: {out!r}")


def test_launch_bytecode_mismatch(tmp_root: Path):
    _banner("6. bootstrap: `launch` với bytecode mismatch → rc=3")
    os.environ["TRISHTEAM_ROOT"] = str(tmp_root / "TrishTEAM")

    from trishlauncher.modules.install.locations import app_install_path

    install_path = app_install_path("oldapp")
    install_path.mkdir(parents=True, exist_ok=True)
    manifest = {
        "schema_version": 1,
        "id": "oldapp",
        "version": "0.0.1",
        "entry": "oldapp.app:main",
        "runtime": {"python_bytecode": "2.7"},  # Cực kỳ cũ
    }
    (install_path / "manifest.json").write_text(
        json.dumps(manifest, indent=2), encoding="utf-8"
    )

    rc, _out, err = _run(["launch", "oldapp"])
    _check(rc == 3, f"rc == 3 (got {rc})")
    _check("bytecode" in err.lower() or "Python 2.7" in err, f"err nói bytecode: {err!r}")


def test_launch_bad_manifest_entry(tmp_root: Path):
    _banner("7. bootstrap: manifest.entry sai format → rc=3")
    os.environ["TRISHTEAM_ROOT"] = str(tmp_root / "TrishTEAM")

    from trishlauncher.modules.install.locations import app_install_path

    install_path = app_install_path("badentry")
    install_path.mkdir(parents=True, exist_ok=True)
    (install_path / "manifest.json").write_text(
        json.dumps({"id": "badentry", "version": "0.0.1", "entry": "no_colon_format"}),
        encoding="utf-8",
    )

    rc, _out, err = _run(["launch", "badentry"])
    _check(rc == 3, f"rc == 3 (got {rc})")
    _check("format" in err.lower() or "module:function" in err, f"err đề cập format: {err!r}")


def main() -> int:
    print("🧪 TrishTEAM Runtime bootstrap smoke test\n")
    with tempfile.TemporaryDirectory(prefix="trishteam-bootstrap-") as tmp:
        tmp_root = Path(tmp)

        test_version()
        test_help()
        test_unknown_command()
        test_launch_not_installed(tmp_root)
        test_launch_fake_app(tmp_root)
        test_launch_bytecode_mismatch(tmp_root)
        test_launch_bad_manifest_entry(tmp_root)

    print("\n✅ All bootstrap smoke tests passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
