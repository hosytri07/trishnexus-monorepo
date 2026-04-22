"""emit_apps_json_entry.py — in ra JSON entry cho apps.json registry.

Gọi bởi `.github/workflows/build-tpack.yml` sau khi `.tpack` đã build xong.
Đọc các env var do workflow set, đọc `apps/<APP_ID>/pyproject.toml` +
`apps/<APP_ID>/tpack.toml` (nếu có), in JSON entry ra stdout.

Env vars (required):
    APP_ID       — ví dụ "trishfont"
    VERSION      — ví dụ "1.0.0"
    SHA256       — SHA-256 của .tpack (64 hex)
    SIZE_BYTES   — kích thước .tpack (bytes)
    REPO         — "<owner>/<repo>" (= github.repository)

Output stdout: 1 JSON object theo schema apps.json §4 trong PACKAGING.md.

Chạy local để test:
    APP_ID=trishfont VERSION=1.0.0 SHA256=abc…123 SIZE_BYTES=12345 \\
        REPO=hosytri07/trishnexus-monorepo \\
        python scripts/ci/emit_apps_json_entry.py
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

# tomllib là stdlib từ Python 3.11+ (CI dùng 3.11). Với dev local chạy 3.10
# thì fallback về `tomli` (drop-in; `pip install tomli`).
try:
    import tomllib  # type: ignore[import-not-found]
except ModuleNotFoundError:  # pragma: no cover - local dev fallback
    import tomli as tomllib  # type: ignore[no-redef]


def _env(name: str) -> str:
    val = os.environ.get(name, "").strip()
    if not val:
        print(f"::error::Missing required env var: {name}", file=sys.stderr)
        sys.exit(2)
    return val


def main() -> int:
    app_id = _env("APP_ID")
    version = _env("VERSION")
    sha256 = _env("SHA256")
    size_bytes = int(_env("SIZE_BYTES"))
    repo = _env("REPO")

    app_dir = Path("apps") / app_id
    pyproject = app_dir / "pyproject.toml"
    if not pyproject.exists():
        print(f"::error::{pyproject} not found", file=sys.stderr)
        return 2

    py = tomllib.loads(pyproject.read_text(encoding="utf-8"))
    project = py.get("project", {})

    manifest: dict = {}
    tpack_toml = app_dir / "tpack.toml"
    if tpack_toml.exists():
        manifest = tomllib.loads(tpack_toml.read_text(encoding="utf-8")).get(
            "manifest", {}
        )

    url = (
        f"https://github.com/{repo}/releases/download/"
        f"{app_id}-v{version}/{app_id}-{version}.tpack"
    )

    entry = {
        "id": app_id,
        "name": manifest.get("name") or project.get("name", app_id),
        "display_name": manifest.get("display_name"),
        "version": version,
        "tagline": manifest.get("tagline", project.get("description", "")),
        "size_bytes": size_bytes,
        "status": "released",
        "platforms": ["windows_x64"],
        "download": {
            "windows_x64": {
                "url": url,
                "sha256": sha256,
                "size_bytes": size_bytes,
                "format": "tpack",
            }
        },
    }
    # In ra stdout (workflow sẽ > dist/apps-json-entry.json)
    json.dump(entry, sys.stdout, indent=2, ensure_ascii=False)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
