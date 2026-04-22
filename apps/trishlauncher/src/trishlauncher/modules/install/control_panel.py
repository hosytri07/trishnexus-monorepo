"""Control Panel integration — ghi/xoá entry "Apps & Features" cho từng app.

Khi Launcher install 1 app, ngoài việc tạo shortcut + DB row, còn ghi 1 entry
vào registry Uninstall của Windows để user thấy app trong "Apps & Features"
(Settings → Apps → Installed apps) giống mọi phần mềm chuyên nghiệp khác.

Registry layout (per-user install):

    HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\TrishTEAM-<app_id>
        DisplayName      = "TrishFont"
        DisplayVersion   = "0.1.0"
        Publisher        = "TrishTEAM"
        DisplayIcon      = "<install_path>\\resources\\app.ico"
        InstallLocation  = "<install_path>"
        UninstallString  = '"<TrishTEAM.exe>" uninstall trishfont'
        QuietUninstallString = '"<TrishTEAM.exe>" uninstall trishfont --quiet'
        EstimatedSize    = <KB>
        NoModify         = 1
        NoRepair         = 1
        URLInfoAbout     = "https://trishteam.app/apps/trishfont"
        Comments         = "<tagline>"

Trên non-Windows (dev/test) các hàm đây no-op (log + return False).
"""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any

from .locations import trishteam_exe

UNINSTALL_KEY_BASE = r"Software\Microsoft\Windows\CurrentVersion\Uninstall"
ENTRY_PREFIX = "TrishTEAM-"  # Prefix tránh đụng với app khác trên máy
PUBLISHER = "TrishTEAM"


def _uninstall_subkey(app_id: str) -> str:
    return rf"{UNINSTALL_KEY_BASE}\{ENTRY_PREFIX}{app_id}"


def _folder_size_kb(path: Path) -> int:
    """Tính tổng size folder theo KB (để hiển thị trong Apps & Features)."""
    total = 0
    if not path.exists():
        return 0
    try:
        for p in path.rglob("*"):
            if p.is_file():
                try:
                    total += p.stat().st_size
                except OSError:
                    pass
    except OSError:
        pass
    return total // 1024


def register_uninstall_entry(
    app_id: str,
    manifest: dict[str, Any],
    install_path: Path,
) -> bool:
    """Ghi per-user Uninstall entry. Return True nếu ghi được.

    Nếu không phải Windows → return False (no-op).
    """
    if sys.platform != "win32":
        return False
    try:
        import winreg  # type: ignore[import-not-found]
    except ImportError:
        return False

    key_path = _uninstall_subkey(app_id)
    try:
        hkey = winreg.CreateKey(winreg.HKEY_CURRENT_USER, key_path)
    except OSError:
        return False

    display_name = manifest.get("name", app_id)
    version = manifest.get("version", "0.0.0")
    tagline = manifest.get("tagline", "")
    icon_rel = "resources/app.ico"
    # Lấy icon path — prefer resources/app.ico, fallback TrishTEAM.exe
    icon_path = install_path / icon_rel
    if not icon_path.is_file():
        icon_path = trishteam_exe()

    runtime_exe = trishteam_exe()
    uninstall_cmd = f'"{runtime_exe}" uninstall {app_id}'
    size_kb = _folder_size_kb(install_path)

    try:
        with hkey:
            winreg.SetValueEx(hkey, "DisplayName",          0, winreg.REG_SZ, display_name)
            winreg.SetValueEx(hkey, "DisplayVersion",       0, winreg.REG_SZ, version)
            winreg.SetValueEx(hkey, "Publisher",            0, winreg.REG_SZ, PUBLISHER)
            winreg.SetValueEx(hkey, "DisplayIcon",          0, winreg.REG_SZ, str(icon_path))
            winreg.SetValueEx(hkey, "InstallLocation",      0, winreg.REG_SZ, str(install_path))
            winreg.SetValueEx(hkey, "UninstallString",      0, winreg.REG_SZ, uninstall_cmd)
            winreg.SetValueEx(hkey, "QuietUninstallString", 0, winreg.REG_SZ, f"{uninstall_cmd} --quiet")
            winreg.SetValueEx(hkey, "EstimatedSize",        0, winreg.REG_DWORD, size_kb)
            winreg.SetValueEx(hkey, "NoModify",             0, winreg.REG_DWORD, 1)
            winreg.SetValueEx(hkey, "NoRepair",             0, winreg.REG_DWORD, 1)
            if tagline:
                winreg.SetValueEx(hkey, "Comments", 0, winreg.REG_SZ, tagline)
            winreg.SetValueEx(
                hkey, "URLInfoAbout", 0, winreg.REG_SZ,
                f"https://trishteam.app/apps/{app_id}",
            )
        return True
    except OSError:
        return False


def unregister_uninstall_entry(app_id: str) -> bool:
    """Xoá per-user Uninstall entry. Return True nếu xoá được hoặc không tồn tại."""
    if sys.platform != "win32":
        return False
    try:
        import winreg  # type: ignore[import-not-found]
    except ImportError:
        return False

    key_path = _uninstall_subkey(app_id)
    try:
        winreg.DeleteKey(winreg.HKEY_CURRENT_USER, key_path)
        return True
    except FileNotFoundError:
        return True  # Không có sẵn = coi như đã xoá
    except OSError:
        return False


def list_registered_apps() -> list[str]:
    """Liệt kê app_id đã đăng ký Uninstall entry (bắt đầu với ENTRY_PREFIX).

    Dùng bởi NSIS uninstaller khi user chọn "Xoá tất cả app đã cài".
    """
    if sys.platform != "win32":
        return []
    try:
        import winreg  # type: ignore[import-not-found]
    except ImportError:
        return []

    apps: list[str] = []
    try:
        with winreg.OpenKey(
            winreg.HKEY_CURRENT_USER, UNINSTALL_KEY_BASE, 0, winreg.KEY_READ
        ) as k:
            i = 0
            while True:
                try:
                    sub = winreg.EnumKey(k, i)
                except OSError:
                    break
                if sub.startswith(ENTRY_PREFIX):
                    apps.append(sub[len(ENTRY_PREFIX):])
                i += 1
    except OSError:
        return []
    return apps
