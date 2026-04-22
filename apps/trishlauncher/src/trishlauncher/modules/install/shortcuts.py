"""Shortcut creation — Windows .lnk qua COM (WScript.Shell), .desktop trên Linux.

Dùng `pywin32` (`win32com.client.Dispatch`) — không dùng `winshell` (stale,
tendency to break với PyQt6 event loop).

Spec shortcut format trong manifest.json:

    {
      "name": "TrishFont",
      "icon": "resources/app.ico",
      "args": "launch trishfont",
      "description": "Quản lý font chuyên nghiệp"
    }

Resolve paths:
    - target  = <TRISHTEAM_ROOT>/TrishTEAM.exe
    - args    = shortcut.args (ví dụ "launch trishfont")
    - icon    = <app_install_path>/resources/app.ico
    - workdir = <app_install_path>
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

from .locations import (
    app_install_path,
    desktop_shortcut_path,
    start_menu_shortcut_path,
    trishteam_exe,
)


class ShortcutError(Exception):
    """Raised khi không tạo được shortcut (COM fail, permission denied…)."""


def _create_windows_lnk(
    lnk_path: Path,
    target: Path,
    args: str,
    icon: Path,
    description: str,
    workdir: Path,
) -> None:
    """Tạo 1 file .lnk qua WScript.Shell COM."""
    try:
        from win32com.client import Dispatch  # type: ignore[import-not-found]
    except ImportError as e:
        raise ShortcutError(
            "pywin32 chưa cài — `pip install pywin32` trong môi trường Runtime."
        ) from e

    lnk_path.parent.mkdir(parents=True, exist_ok=True)

    shell = Dispatch("WScript.Shell")
    shortcut = shell.CreateShortCut(str(lnk_path))
    shortcut.Targetpath = str(target)
    shortcut.Arguments = args
    shortcut.WorkingDirectory = str(workdir)
    if icon.exists():
        # Format "path,index" — index 0 là icon mặc định
        shortcut.IconLocation = f"{icon},0"
    if description:
        shortcut.Description = description
    shortcut.save()


def _create_linux_desktop(
    desktop_path: Path,
    target: Path,
    args: str,
    icon: Path,
    name: str,
    description: str,
    workdir: Path,
) -> None:
    """Tạo 1 file .desktop cho Linux (dev/test only)."""
    desktop_path.parent.mkdir(parents=True, exist_ok=True)
    exec_line = f'"{target}" {args}' if args else str(target)
    content = (
        "[Desktop Entry]\n"
        f"Name={name}\n"
        f"Comment={description}\n"
        f"Exec={exec_line}\n"
        f"Icon={icon}\n"
        f"Path={workdir}\n"
        "Terminal=false\n"
        "Type=Application\n"
        "Categories=Utility;\n"
    )
    desktop_path.write_text(content, encoding="utf-8")
    try:
        desktop_path.chmod(0o755)
    except OSError:
        pass


def create_shortcuts_for_app(
    app_id: str,
    shortcuts_spec: list[dict],
    *,
    desktop: bool = True,
    start_menu: bool = True,
) -> list[Path]:
    """Tạo shortcut cho 1 app đã extract. Return list path đã tạo thành công.

    Args:
        app_id: id app (đã lowercased).
        shortcuts_spec: list từ manifest.provides_shortcuts — mỗi item có
            keys: name, icon, args, description.
        desktop: có tạo Desktop shortcut không.
        start_menu: có tạo Start Menu shortcut không.
    """
    created: list[Path] = []
    target = trishteam_exe()
    install_dir = app_install_path(app_id)

    for spec in shortcuts_spec:
        name = spec.get("name") or app_id
        args = spec.get("args") or f"launch {app_id}"
        description = spec.get("description", "")
        icon_rel = spec.get("icon", "resources/app.ico")
        icon_path = install_dir / icon_rel
        workdir = install_dir

        if desktop:
            lnk = desktop_shortcut_path(name)
            if sys.platform == "win32":
                try:
                    _create_windows_lnk(
                        lnk, target, args, icon_path, description, workdir
                    )
                    created.append(lnk)
                except Exception as e:
                    raise ShortcutError(f"Tạo Desktop shortcut fail: {e}") from e
            else:
                _create_linux_desktop(
                    lnk, target, args, icon_path, name, description, workdir
                )
                created.append(lnk)

        if start_menu:
            lnk = start_menu_shortcut_path(name)
            if sys.platform == "win32":
                try:
                    _create_windows_lnk(
                        lnk, target, args, icon_path, description, workdir
                    )
                    created.append(lnk)
                except Exception as e:
                    raise ShortcutError(f"Tạo Start Menu shortcut fail: {e}") from e
            else:
                _create_linux_desktop(
                    lnk, target, args, icon_path, name, description, workdir
                )
                created.append(lnk)

    return created


def remove_shortcuts_for_app(app_id: str, shortcuts_spec: list[dict]) -> list[Path]:
    """Xoá các shortcut đã tạo cho 1 app. Return list path đã xoá."""
    removed: list[Path] = []
    for spec in shortcuts_spec:
        name = spec.get("name") or app_id
        for lnk in (desktop_shortcut_path(name), start_menu_shortcut_path(name)):
            if lnk.exists():
                try:
                    lnk.unlink()
                    removed.append(lnk)
                except OSError:
                    pass  # Không fail hard nếu 1 shortcut không xoá được
    return removed
