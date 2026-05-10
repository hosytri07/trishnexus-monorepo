#!/usr/bin/env python3
"""
bump-version.py — Update version trong 3 file (package.json + Cargo.toml + tauri.conf.json).

Usage:
    python bump-version.py <app_id> <new_version>

Example:
    python bump-version.py trishfont 1.0.1
"""

import argparse
import json
import re
import sys
from pathlib import Path

APP_DIR = {
    "trishlauncher": "trishlauncher",
    "trishcheck":    "trishcheck",
    "trishfont":     "trishfont",
    "trishclean":    "trishclean",
    "trishshortcut": "trishshortcut",
    "trishlibrary":  "trishlibrary",
    "trishdrive":    "trishdrive",
    "trishfinance":  "trishfinance",
    "trishiso":      "trishiso",
    "trishdesign":   "trishdesign",
    "trishoffice":   "trishoffice",
}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("app_id", choices=sorted(APP_DIR.keys()))
    ap.add_argument("new_version", help="Phiên bản mới, vd 1.0.1")
    ap.add_argument(
        "--repo-root",
        default=str(Path(__file__).resolve().parent.parent),
    )
    args = ap.parse_args()

    repo_root = Path(args.repo_root).resolve()
    app_root = repo_root / "apps-desktop" / APP_DIR[args.app_id]
    if not app_root.exists():
        print(f"ERROR: app dir không tồn tại: {app_root}", file=sys.stderr)
        return 1

    files_changed = []

    # 1. package.json
    pkg = app_root / "package.json"
    if pkg.exists():
        data = json.loads(pkg.read_text(encoding="utf-8"))
        old = data.get("version", "?")
        data["version"] = args.new_version
        pkg.write_text(
            json.dumps(data, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        files_changed.append(f"package.json: {old} -> {args.new_version}")

    # 2. Cargo.toml
    cargo = app_root / "src-tauri" / "Cargo.toml"
    if cargo.exists():
        src = cargo.read_text(encoding="utf-8")
        # Match the [package] block's version (first occurrence after [package])
        new_src, n = re.subn(
            r'(\[package\][^\[]*?\nversion\s*=\s*")[^"]*(")',
            rf'\g<1>{args.new_version}\g<2>',
            src,
            count=1,
            flags=re.DOTALL,
        )
        if n > 0:
            cargo.write_text(new_src, encoding="utf-8")
            files_changed.append(f"Cargo.toml: package version -> {args.new_version}")

    # 3. tauri.conf.json
    conf = app_root / "src-tauri" / "tauri.conf.json"
    if conf.exists():
        data = json.loads(conf.read_text(encoding="utf-8"))
        old = data.get("version", "?")
        data["version"] = args.new_version
        conf.write_text(
            json.dumps(data, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        files_changed.append(f"tauri.conf.json: {old} -> {args.new_version}")

    print(f"=== Bumped {args.app_id} to v{args.new_version} ===")
    for c in files_changed:
        print(f"  {c}")

    print(f"\nTiếp theo:")
    print(f"  cd apps-desktop\\{APP_DIR[args.app_id]}")
    print(f"  pnpm tauri build")
    print(f"  cd ..\\..")
    print(f"  scripts\\release-app.bat {args.app_id} {args.new_version} --auto")

    return 0


if __name__ == "__main__":
    sys.exit(main())
