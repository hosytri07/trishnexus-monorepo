"""Manifest fetcher — pull manifest.json từ GitHub raw + parse thành FontPack.

Endpoint: trishnexus-fontpacks/main/manifest.json
TODO: thay hosytri07 bằng username thật khi setup repo (hiện đang dùng
username của maintainer).
"""

from __future__ import annotations

import json
from typing import Any

import requests

from .models import FontPack


MANIFEST_URL = (
    "https://raw.githubusercontent.com/hosytri07/"
    "trishnexus-fontpacks/main/manifest.json"
)


def fetch_manifest(
    url: str = MANIFEST_URL,
    *,
    timeout: int = 10,
) -> tuple[list[FontPack], str]:
    """Fetch manifest.json → parse list[FontPack] + raw text (để cache).

    Returns: (packs, raw_json_text). Raise requests.RequestException nếu fail.
    """
    resp = requests.get(url, timeout=timeout)
    resp.raise_for_status()
    raw = resp.text
    data = resp.json()
    packs = parse_manifest(data)
    return packs, raw


def parse_manifest(data: dict[str, Any] | str) -> list[FontPack]:
    """Parse dict (hoặc JSON string) → list[FontPack]."""
    if isinstance(data, str):
        data = json.loads(data)

    packs: list[FontPack] = []
    for entry in data.get("packs", []):
        packs.append(
            FontPack(
                id=entry["id"],
                name=entry.get("name", entry["id"]),
                description=entry.get("description", ""),
                version=entry.get("version", "0.0.0"),
                size_bytes=int(entry.get("size_bytes", 0)),
                file_count=int(entry.get("file_count", 0)),
                kind=entry.get("kind", "windows"),
                tags=list(entry.get("tags", [])),
                download_url=entry.get("download_url", ""),
                sha256=entry.get("sha256", ""),
                preview_image=entry.get("preview_image", ""),
            )
        )
    return packs
