"""Registry module — fetch + parse apps.json từ GitHub."""

from .models import AppEntry, DownloadInfo, MIGRATION_001_LAUNCHER
from .repository import RegistryRepository
from .fetcher import fetch_apps_registry, REGISTRY_URL

__all__ = [
    "AppEntry",
    "DownloadInfo",
    "MIGRATION_001_LAUNCHER",
    "RegistryRepository",
    "fetch_apps_registry",
    "REGISTRY_URL",
]
