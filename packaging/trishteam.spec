# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller spec — TrishTEAM.exe bootstrap.

Build (trên Windows với Python 3.11 match target):

    python -m venv build-env
    build-env\\Scripts\\activate
    pip install -r packaging/requirements-build.txt
    pip install -e shared/trishteam_core
    pip install -e apps/trishlauncher
    pyinstaller --clean -y packaging/trishteam.spec

Output:

    dist/TrishTEAM/
      ├── TrishTEAM.exe           # bootstrap (~2MB)
      ├── _internal/
      │   ├── python311.dll
      │   ├── base_library.zip
      │   ├── PyQt6/              # ~40MB shared runtime
      │   ├── requests/
      │   ├── trishteam_core/
      │   └── trishlauncher/
      └── resources/app.ico

Sau đó chạy NSIS compile `packaging/trishteam-installer.nsi` để tạo
`TrishTEAM-Setup-0.1.0.exe` — installer pro cho end-user.

Chú ý:
    - Dùng Python 3.11 EXACTLY khớp với bytecode của các .tpack.
      Python 3.10/3.12 sẽ reject khi load .pyc (magic number khác).
    - `console=False` ẩn cửa sổ console khi double-click.
    - `uac_admin=False` — per-user install mặc định không cần admin.
      User có thể chọn install machine-wide trong NSIS (lúc đó Launcher sẽ
      request UAC elevation khi install app vào Program Files).
"""

import sys
from pathlib import Path

# Resolve repo root từ spec file location
SPEC_DIR = Path(SPECPATH).resolve()
REPO_ROOT = SPEC_DIR.parent

# Package roots
CORE_SRC = REPO_ROOT / "shared" / "trishteam_core" / "src"
LAUNCHER_SRC = REPO_ROOT / "apps" / "trishlauncher" / "src"
LAUNCHER_RES = LAUNCHER_SRC / "trishlauncher" / "resources"

# ─────────────────── Analysis ───────────────────

a = Analysis(
    # Entry point — bootstrap dispatcher
    [str(LAUNCHER_SRC / "trishlauncher" / "bootstrap.py")],
    pathex=[str(CORE_SRC), str(LAUNCHER_SRC)],
    binaries=[],
    datas=[
        # Logo + icon bundle
        (str(LAUNCHER_RES / "app.ico"), "trishlauncher/resources"),
        (str(LAUNCHER_RES / "logo-64.png"), "trishlauncher/resources"),
    ],
    # Hidden imports: modules import dynamically mà PyInstaller không detect
    hiddenimports=[
        "trishteam_core.store",
        "trishteam_core.store.database",
        "trishteam_core.ui",
        "trishteam_core.utils",
        "trishteam_core.widgets",
        # Crypto (tier 3 .enc data load — cryptography backend)
        "trishteam_core.crypto",
        "trishteam_core.crypto.aes",
        "cryptography",
        "cryptography.hazmat.primitives.ciphers.aead",
        "cryptography.hazmat.primitives.kdf.hkdf",
        "cryptography.hazmat.primitives.hashes",
        "trishlauncher.app",
        "trishlauncher.bootstrap",
        "trishlauncher.modules.install",
        "trishlauncher.modules.install.control_panel",
        "trishlauncher.modules.install.locations",
        "trishlauncher.modules.install.shortcuts",
        "trishlauncher.modules.install.worker",
        "trishlauncher.modules.registry",
        "trishlauncher.modules.registry.models",
        "trishlauncher.modules.registry.repository",
        "trishlauncher.ui.hub_view",
        # Win32 COM cho shortcut
        "win32com.client",
        "pywintypes",
        "pythoncom",
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    # Exclude modules không cần — giảm size
    excludes=[
        "tkinter",
        "unittest",
        "pydoc",
        "doctest",
        "test",
        "distutils",
        "setuptools",
        "pip",
        "IPython",
        "matplotlib",
        "numpy",   # (chỉ exclude nếu không app nào dùng — trishfont không dùng)
        "pandas",
    ],
    noarchive=False,
    optimize=2,  # -OO: strip docstrings + assert
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="TrishTEAM",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,           # UPX compress exe (tuỳ chọn — cần cài UPX)
    upx_exclude=["vcruntime140.dll", "python311.dll"],
    console=False,      # Ẩn console cửa sổ (GUI mode)
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=str(LAUNCHER_RES / "app.ico"),
    version=str(SPEC_DIR / "version-info.txt"),
    uac_admin=False,    # Không force admin — NSIS chọn per-user vs machine
    manifest=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=["vcruntime140.dll", "python311.dll", "PyQt6*.dll"],
    name="TrishTEAM",
)
