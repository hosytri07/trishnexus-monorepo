"""patch_apps_json.py — in-place patch apps.json registry.

Gọi bởi `.github/workflows/update-apps-json.yml`. Đọc env vars do workflow
set, rewrite entry khớp APP_ID với version/sha256/size_bytes/url mới.

Usage:
    python scripts/ci/patch_apps_json.py <path-to-apps.json>

Env vars (required):
    APP_ID       — ví dụ "trishfont"
    VERSION      — ví dụ "1.0.0"
    SHA256       — SHA-256 của .tpack (64 hex)
    SIZE_BYTES   — kích thước .tpack (bytes)
    REPO         — "<owner>/<repo>" chứa .tpack release
                   (ví dụ "hosytri07/trishnexus-monorepo")

Exit codes:
    0  — patched hoặc không có gì để làm (soft-skip)
    2  — missing env / file not found

Không fail hard khi entry chưa tồn tại trong apps.json — chỉ in warning
để admin biết cần thêm entry template trước.
"""

from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path


def _env(name: str) -> str:
    val = os.environ.get(name, "").strip()
    if not val:
        print(f"::error::Missing required env var: {name}", file=sys.stderr)
        sys.exit(2)
    return val


def main(argv: list[str]) -> int:
    if len(argv) < 2:
        print("Usage: patch_apps_json.py <path-to-apps.json>", file=sys.stderr)
        return 2

    apps_path = Path(argv[1])
    if not apps_path.exists():
        print(f"::error::{apps_path} not found", file=sys.stderr)
        return 2

    app_id = _env("APP_ID")
    version = _env("VERSION")
    sha256 = _env("SHA256")
    size_bytes = int(_env("SIZE_BYTES"))
    repo = _env("REPO")

    data = json.loads(apps_path.read_text(encoding="utf-8"))
    apps = data.get("apps", [])

    found = False
    for app in apps:
        if app.get("id") != app_id:
            continue
        found = True
        app["version"] = version
        app["size_bytes"] = size_bytes
        app["status"] = "released"
        dl = app.setdefault("download", {})
        win = dl.setdefault("windows_x64", {})
        win["url"] = (
            f"https://github.com/{repo}/releases/download/"
            f"{app_id}-v{version}/{app_id}-{version}.tpack"
        )
        win["sha256"] = sha256
        win["size_bytes"] = size_bytes
        win["format"] = "tpack"
        break

    if not found:
        print(
            f"::warning::app_id={app_id} chưa tồn tại trong {apps_path} — "
            "cần admin thêm entry template thủ công trước.",
            file=sys.stderr,
        )
        return 0

    data["updated_at"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    apps_path.write_text(
        json.dumps(data, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    sha_short = sha256[:12]
    print(f"Patched {app_id} -> v{version} sha256={sha_short}...")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
