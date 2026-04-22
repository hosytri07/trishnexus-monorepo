"""Location resolver — where to install apps + where shortcuts live.

Priority (highest first) để tìm TrishTEAM root:
    1. Env `TRISHTEAM_ROOT` (dev override).
    2. Registry HKLM\\Software\\TrishTEAM\\Runtime\\InstallLocation
       (do NSIS installer ghi khi cài Runtime — task #59).
    3. Registry HKCU\\Software\\TrishTEAM\\Runtime\\InstallLocation
       (per-user install, không cần admin).
    4. Fallback: C:\\Program Files\\TrishTEAM (nếu admin).
    5. Fallback: %LOCALAPPDATA%\\Programs\\TrishTEAM (per-user).

Shortcut paths:
    - Desktop:    %USERPROFILE%\\Desktop\\<name>.lnk
    - Start Menu: %APPDATA%\\Microsoft\\Windows\\Start Menu\\Programs\\TrishTEAM\\<name>.lnk
"""

from __future__ import annotations

import os
import sys
from pathlib import Path


REGISTRY_KEY_HKLM = r"Software\TrishTEAM\Runtime"
REGISTRY_KEY_HKCU = r"Software\TrishTEAM\Runtime"
REGISTRY_VALUE = "InstallLocation"


def _read_registry_value(hive_name: str, sub_key: str, value: str) -> str | None:
    """Đọc 1 REG_SZ value. Trả về None nếu không có key hoặc không phải Windows."""
    if sys.platform != "win32":
        return None
    try:
        import winreg  # type: ignore[import-not-found]
    except ImportError:
        return None
    hive = {
        "HKLM": winreg.HKEY_LOCAL_MACHINE,
        "HKCU": winreg.HKEY_CURRENT_USER,
    }.get(hive_name)
    if hive is None:
        return None
    try:
        with winreg.OpenKey(hive, sub_key, 0, winreg.KEY_READ) as k:
            val, _type = winreg.QueryValueEx(k, value)
            return str(val) if val else None
    except FileNotFoundError:
        return None
    except OSError:
        return None


def resolve_trishteam_root() -> Path:
    """Trả về folder TrishTEAM install (chỉ chắc chắn tồn tại nếu Runtime đã cài).

    Nếu chưa cài Runtime hoặc Launcher chạy dev mode → fallback per-user path
    để vẫn install được (không block user flow).
    """
    env = os.environ.get("TRISHTEAM_ROOT")
    if env:
        return Path(env)

    hklm = _read_registry_value("HKLM", REGISTRY_KEY_HKLM, REGISTRY_VALUE)
    if hklm:
        return Path(hklm)

    hkcu = _read_registry_value("HKCU", REGISTRY_KEY_HKCU, REGISTRY_VALUE)
    if hkcu:
        return Path(hkcu)

    # Fallback per-user location
    if sys.platform == "win32":
        local = os.environ.get("LOCALAPPDATA") or str(
            Path.home() / "AppData" / "Local"
        )
        return Path(local) / "Programs" / "TrishTEAM"

    # Linux/mac dev — không thực sự chạy prod ở đây, nhưng cho test
    return Path.home() / ".local" / "share" / "TrishTEAM"


def apps_install_dir() -> Path:
    """Folder chứa tất cả app đã cài: <TRISHTEAM_ROOT>/apps/."""
    return resolve_trishteam_root() / "apps"


def app_install_path(app_id: str) -> Path:
    """Folder đích của 1 app cụ thể: <TRISHTEAM_ROOT>/apps/<app_id>/."""
    return apps_install_dir() / app_id


def trishteam_exe() -> Path:
    """Path đến launcher bootstrap .exe — shortcut target."""
    return resolve_trishteam_root() / "TrishTEAM.exe"


def desktop_shortcut_path(name: str) -> Path:
    """%USERPROFILE%\\Desktop\\<name>.lnk."""
    if sys.platform == "win32":
        home = Path(os.environ.get("USERPROFILE", str(Path.home())))
        return home / "Desktop" / f"{name}.lnk"
    return Path.home() / "Desktop" / f"{name}.desktop"


def start_menu_shortcut_path(name: str) -> Path:
    """%APPDATA%\\Microsoft\\Windows\\Start Menu\\Programs\\TrishTEAM\\<name>.lnk."""
    if sys.platform == "win32":
        appdata = os.environ.get("APPDATA") or str(Path.home() / "AppData" / "Roaming")
        return (
            Path(appdata)
            / "Microsoft"
            / "Windows"
            / "Start Menu"
            / "Programs"
            / "TrishTEAM"
            / f"{name}.lnk"
        )
    # Linux: ~/.local/share/applications/
    return Path.home() / ".local" / "share" / "applications" / f"{name}.desktop"


def user_data_dir(app_id: str) -> Path:
    """%APPDATA%\\TrishTEAM\\<app_id>\\ — user data, không touch khi gỡ app."""
    if sys.platform == "win32":
        appdata = os.environ.get("APPDATA") or str(Path.home() / "AppData" / "Roaming")
        return Path(appdata) / "TrishTEAM" / app_id
    return Path.home() / ".config" / "TrishTEAM" / app_id


def downloads_cache_dir() -> Path:
    """%LOCALAPPDATA%\\TrishLauncher\\downloads\\ — cache .tpack tải về."""
    if sys.platform == "win32":
        local = os.environ.get("LOCALAPPDATA") or str(Path.home() / "AppData" / "Local")
        p = Path(local) / "TrishLauncher" / "downloads"
    else:
        p = Path.home() / ".cache" / "TrishLauncher" / "downloads"
    p.mkdir(parents=True, exist_ok=True)
    return p
