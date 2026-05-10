#!/usr/bin/env python3
"""
publish-app.py — Phase 38 helper script tự động hoá release wave.

Workflow một lần `python publish-app.py trishfont 1.0.1`:
  1. Tìm .exe production trong apps-desktop/<app>/src-tauri/target/release/bundle/nsis/
  2. Compute SHA256 + size_bytes
  3. Update website/public/apps-registry.json:
       - app.status = 'released'
       - app.version = <new_version>
       - app.size_bytes = <thực tế>
       - app.download.windows_x64.url = GitHub release URL
       - app.download.windows_x64.sha256 = SHA256 hash
       - app.changelog_url = GitHub release tag URL
  4. In ra lệnh `gh release create` để Trí copy paste chạy
  5. In ra lệnh `git add` + `git commit` + `git push`

Usage:
    python publish-app.py <app_id> <version> [--notes "..."]

Example:
    python publish-app.py trishfont 1.0.1 --notes "Phase 38 OCR speed-up"
    python publish-app.py trishlauncher 1.0.0

App IDs hỗ trợ:
    trishlauncher, trishcheck, trishfont, trishclean,
    trishshortcut, trishlibrary, trishdrive, trishfinance,
    trishiso, trishdesign, trishoffice
"""

import argparse
import hashlib
import json
import sys
from pathlib import Path
from typing import Optional

# App ID → directory name + display name + .exe filename pattern
APP_META = {
    "trishlauncher": ("trishlauncher", "TrishLauncher"),
    "trishcheck":    ("trishcheck",    "TrishCheck"),
    "trishfont":     ("trishfont",     "TrishFont"),
    "trishclean":    ("trishclean",    "TrishClean"),
    "trishshortcut": ("trishshortcut", "TrishShortcut"),
    "trishlibrary":  ("trishlibrary",  "TrishLibrary"),
    "trishdrive":    ("trishdrive",    "TrishDrive"),
    "trishfinance":  ("trishfinance",  "TrishFinance"),
    "trishiso":      ("trishiso",      "TrishISO"),
    "trishdesign":   ("trishdesign",   "TrishDesign"),
    "trishoffice":   ("trishoffice",   "TrishOffice"),
}

GITHUB_OWNER = "hosytri07"
GITHUB_REPO = "trishnexus-monorepo"


def sha256_of(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def find_exe(repo_root: Path, app_id: str, version: str) -> Optional[Path]:
    if app_id not in APP_META:
        return None
    dir_name, display_name = APP_META[app_id]
    bundle = (
        repo_root
        / "apps-desktop"
        / dir_name
        / "src-tauri"
        / "target"
        / "release"
        / "bundle"
        / "nsis"
    )
    candidates = [
        bundle / f"{display_name}_{version}_x64-setup.exe",
        bundle / f"{display_name}_{version}_x64_en-US.exe",
    ]
    for c in candidates:
        if c.exists():
            return c
    # Fallback: bất kỳ .exe nào trong nsis dir
    if bundle.exists():
        all_exes = list(bundle.glob("*.exe"))
        if all_exes:
            return sorted(all_exes, key=lambda p: p.stat().st_mtime, reverse=True)[0]
    return None


def update_registry(
    registry_path: Path,
    app_id: str,
    version: str,
    sha256: str,
    size_bytes: int,
    exe_filename: str,
) -> bool:
    data = json.loads(registry_path.read_text(encoding="utf-8"))
    found = False
    for app in data.get("apps", []):
        if app["id"] != app_id:
            continue
        found = True
        app["status"] = "released"
        app["version"] = version
        app["size_bytes"] = size_bytes
        app["changelog_url"] = (
            f"https://github.com/{GITHUB_OWNER}/{GITHUB_REPO}/releases/tag/{app_id}-v{version}"
        )
        if "download" not in app:
            app["download"] = {}
        if "windows_x64" not in app["download"]:
            app["download"]["windows_x64"] = {"url": "", "sha256": "", "installer_args": []}
        app["download"]["windows_x64"]["url"] = (
            f"https://github.com/{GITHUB_OWNER}/{GITHUB_REPO}/releases/download/"
            f"{app_id}-v{version}/{exe_filename}"
        )
        app["download"]["windows_x64"]["sha256"] = sha256
        # Bỏ release_at vì đã release rồi (optional cleanup)
        app.pop("release_at", None)
        break

    if not found:
        return False

    from datetime import datetime, timezone, timedelta
    tz_vn = timezone(timedelta(hours=7))
    data["updated_at"] = datetime.now(tz_vn).strftime("%Y-%m-%dT%H:%M+07:00")

    registry_path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return True


def main() -> int:
    ap = argparse.ArgumentParser(
        description="Publish 1 TrishTEAM app — update registry + in lệnh gh release.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    ap.add_argument("app_id", choices=sorted(APP_META.keys()), help="App ID")
    ap.add_argument("version", help="Phiên bản semver (vd 1.0.0, 1.0.1)")
    ap.add_argument(
        "--notes",
        default="",
        help="Release notes (optional, mặc định auto-gen)",
    )
    ap.add_argument(
        "--repo-root",
        default=str(Path(__file__).resolve().parent.parent),
        help="Path tới trishnexus-monorepo (mặc định auto-detect)",
    )
    ap.add_argument(
        "--auto",
        action="store_true",
        help="Tự động chạy gh release create + git commit/push (cần gh CLI + git auth)",
    )
    args = ap.parse_args()

    repo_root = Path(args.repo_root).resolve()
    if not (repo_root / "website").exists():
        print(f"ERROR: repo-root không hợp lệ: {repo_root}", file=sys.stderr)
        return 1

    # 1. Tìm .exe
    exe = find_exe(repo_root, args.app_id, args.version)
    if not exe:
        _, display_name = APP_META[args.app_id]
        print(
            f"ERROR: Không tìm thấy {display_name}_{args.version}_x64-setup.exe.\n"
            f"       Build trước bằng: pnpm tauri build trong apps-desktop/{args.app_id}/",
            file=sys.stderr,
        )
        return 1

    # 2. Compute hash + size
    print(f"[1/3] Computing SHA256 cho {exe.name} ({exe.stat().st_size:,} bytes)...")
    sha = sha256_of(exe)
    size = exe.stat().st_size
    print(f"      SHA256: {sha}")
    print(f"      Size:   {size:,} bytes ({size / 1_048_576:.1f} MB)")

    # 3. Update registry
    print(f"\n[2/3] Updating apps-registry.json...")
    registry = repo_root / "website" / "public" / "apps-registry.json"
    ok = update_registry(registry, args.app_id, args.version, sha, size, exe.name)
    if not ok:
        print(f"ERROR: app_id '{args.app_id}' không tìm thấy trong registry", file=sys.stderr)
        return 1
    print(f"      Updated: {args.app_id} → status=released, version={args.version}")

    # 4. In ra commands
    notes = args.notes or f"v{args.version} GA — release wave."
    tag = f"{args.app_id}-v{args.version}"
    _, display_name = APP_META[args.app_id]

    if args.auto:
        # Auto mode — chạy gh + git commands trực tiếp
        import subprocess
        print(f"\n[3/3] Auto mode — chạy gh + git...\n")
        gh_cmd = [
            "gh", "release", "create", tag,
            str(exe.relative_to(repo_root)),
            "--title", f"{display_name} {args.version}",
            "--notes", notes,
        ]
        print(f"  $ {' '.join(gh_cmd)}")
        r = subprocess.run(gh_cmd, cwd=str(repo_root))
        if r.returncode != 0:
            print(f"\nERROR: gh release create fail (exit {r.returncode})", file=sys.stderr)
            print("Có thể tag đã tồn tại — xóa bằng: gh release delete " + tag, file=sys.stderr)
            return 1

        for cmd in [
            ["git", "add", "website/public/apps-registry.json"],
            ["git", "commit", "-m", f"registry: {args.app_id} v{args.version} released"],
            ["git", "push"],
        ]:
            print(f"  $ {' '.join(cmd)}")
            r = subprocess.run(cmd, cwd=str(repo_root))
            if r.returncode != 0:
                print(f"\nWARNING: '{cmd[0]} {cmd[1]}' fail (exit {r.returncode})", file=sys.stderr)
                # Continue — git commit có thể fail nếu không có changes (idempotent)

        print(f"\n✅ Đã release {tag}. Vercel deploy ~1 phút → Launcher tự thấy fresh data.")
        return 0

    # Manual mode — in commands cho user copy paste
    print(f"\n[3/3] Lệnh tiếp theo (chạy thủ công):\n")
    print(f"# A) Tag GitHub Release + upload .exe:")
    print(
        f'gh release create {tag} "{exe.relative_to(repo_root)}" '
        f'--title "{display_name} {args.version}" --notes "{notes}"'
    )
    print()
    print(f"# B) Commit + push apps-registry.json:")
    print(f"cd {repo_root}")
    print(f"git add website/public/apps-registry.json")
    print(f'git commit -m "registry: {args.app_id} v{args.version} released"')
    print(f"git push")
    print()
    print("# Vercel deploy ~1 phút sau khi push → Launcher fetch fresh data.")
    print("# Tip: thêm --auto để tự động chạy bước A+B luôn.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
