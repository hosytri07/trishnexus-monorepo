"""Registry fetcher — pull apps.json từ GitHub raw.

Endpoint: trishnexus-launcher-registry/main/apps.json
TODO: thay <user> bằng GitHub username thật khi setup repo.
"""

from __future__ import annotations

import json
from typing import Any

import requests

from .models import AppEntry, DownloadInfo


# TODO: thay bằng URL thật sau khi tạo repo registry trên GitHub
REGISTRY_URL = (
    "https://raw.githubusercontent.com/hosytri07/"
    "trishnexus-launcher-registry/main/apps.json"
)

# Local fallback (dùng khi offline lần đầu, hoặc dev) — đặt trong package
EMBEDDED_FALLBACK_PATH = "embedded_apps.json"


def fetch_apps_registry(
    url: str = REGISTRY_URL,
    *,
    timeout: int = 10,
) -> tuple[list[AppEntry], str]:
    """Fetch apps.json từ URL, parse thành list[AppEntry].

    Returns: (apps, raw_json_text). Raise requests.RequestException nếu fail.
    """
    resp = requests.get(url, timeout=timeout)
    resp.raise_for_status()
    raw = resp.text
    data = resp.json()
    apps = _parse_apps(data)
    return apps, raw


def parse_cached_registry(raw_json: str) -> list[AppEntry]:
    """Parse JSON đã cache trong DB → list[AppEntry]."""
    data = json.loads(raw_json)
    return _parse_apps(data)


def _parse_apps(data: dict[str, Any]) -> list[AppEntry]:
    apps: list[AppEntry] = []
    for entry in data.get("apps", []):
        downloads = {}
        for platform, dl in (entry.get("download") or {}).items():
            downloads[platform] = DownloadInfo(
                url=dl.get("url", ""),
                sha256=dl.get("sha256", ""),
                installer_args=list(dl.get("installer_args", [])),
            )
        apps.append(
            AppEntry(
                id=entry["id"],
                name=entry["name"],
                tagline=entry.get("tagline", ""),
                logo_emoji=entry.get("logo_emoji", "📦"),
                logo_url=entry.get("logo_url", ""),
                status=entry.get("status", "released"),
                version=entry.get("version", "0.0.0"),
                size_bytes=int(entry.get("size_bytes", 0)),
                login_required=entry.get("login_required", "none"),
                platforms=list(entry.get("platforms", ["windows_x64"])),
                screenshots=list(entry.get("screenshots", [])),
                changelog_url=entry.get("changelog_url", ""),
                downloads=downloads,
            )
        )
    # Defensive filter — nếu registry public vô tình chứa trishadmin,
    # launcher vẫn không hiển thị (chỉ admin-registry.json mới được có).
    apps = [a for a in apps if a.id != "trishadmin"]
    return apps
