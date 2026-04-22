"""Install module — download .tpack → extract → shortcut → DB register."""

from __future__ import annotations

from .control_panel import (
    list_registered_apps,
    register_uninstall_entry,
    unregister_uninstall_entry,
)
from .locations import (
    app_install_path,
    apps_install_dir,
    desktop_shortcut_path,
    downloads_cache_dir,
    resolve_trishteam_root,
    start_menu_shortcut_path,
    trishteam_exe,
    user_data_dir,
)
from .shortcuts import (
    ShortcutError,
    create_shortcuts_for_app,
    remove_shortcuts_for_app,
)
from .worker import (
    InstallJob,
    InstallResult,
    InstallWorker,
    run_install_async,
    uninstall_app,
)

__all__ = [
    # locations
    "resolve_trishteam_root",
    "apps_install_dir",
    "app_install_path",
    "trishteam_exe",
    "desktop_shortcut_path",
    "start_menu_shortcut_path",
    "user_data_dir",
    "downloads_cache_dir",
    # shortcuts
    "ShortcutError",
    "create_shortcuts_for_app",
    "remove_shortcuts_for_app",
    # control_panel
    "register_uninstall_entry",
    "unregister_uninstall_entry",
    "list_registered_apps",
    # worker
    "InstallJob",
    "InstallResult",
    "InstallWorker",
    "run_install_async",
    "uninstall_app",
]
