"""build-pack.py — đóng gói 1 font pack thành .zip + cập nhật manifest.json.

Chạy từ root repo `trishnexus-fontpacks`:

    python scripts/build-pack.py <pack-id>

Ví dụ:

    python scripts/build-pack.py vietnamese-essentials

Script sẽ:
    1. Đọc packs/<pack-id>/pack.json → lấy id, version.
    2. Zip toàn bộ packs/<pack-id>/fonts/ → packs/<pack-id>/dist/<id>.zip.
    3. Tính SHA256 + size + file count.
    4. Update entry tương ứng trong manifest.json (top-level).
    5. In ra block JSON đã update.

Sau khi script chạy xong:
    git add . && git commit -m "<id> v<version>" && git push
    gh release create <id>-v<version> packs/<id>/dist/<id>.zip --notes "..."
"""

from __future__ import annotations

import hashlib
import json
import sys
import zipfile
from datetime import datetime, timezone
from pathlib import Path


GITHUB_USER = "hosytri07"        # TODO: thay bằng GitHub username thật
REPO_NAME = "trishnexus-fontpacks"


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: python scripts/build-pack.py <pack-id>")
        return 2
    pack_id = sys.argv[1]

    repo_root = Path(__file__).resolve().parent.parent
    pack_dir = repo_root / "packs" / pack_id
    if not pack_dir.is_dir():
        print(f"❌ Pack folder không tồn tại: {pack_dir}")
        return 1

    pack_json_path = pack_dir / "pack.json"
    if not pack_json_path.is_file():
        print(f"❌ Thiếu pack.json: {pack_json_path}")
        return 1

    pack_meta = json.loads(pack_json_path.read_text(encoding="utf-8"))
    version = pack_meta["version"]
    name = pack_meta.get("name", pack_id)
    description = pack_meta.get("description", "")
    kind = pack_meta.get("kind", "windows")
    tags = pack_meta.get("tags", [])

    fonts_dir = pack_dir / "fonts"
    if not fonts_dir.is_dir():
        print(f"❌ Thiếu folder fonts/: {fonts_dir}")
        return 1

    font_files = sorted(p for p in fonts_dir.rglob("*") if p.is_file())
    if not font_files:
        print(f"❌ Không có file font nào trong {fonts_dir}")
        return 1

    # --- Build .zip ---
    dist_dir = pack_dir / "dist"
    dist_dir.mkdir(exist_ok=True)
    zip_path = dist_dir / f"{pack_id}.zip"
    if zip_path.exists():
        zip_path.unlink()

    print(f"📦 Đóng gói {len(font_files)} file font → {zip_path.name}…")
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for f in font_files:
            arcname = f.relative_to(fonts_dir)
            zf.write(f, arcname)

    # --- Hash + size ---
    print("🔐 Tính SHA256…")
    h = hashlib.sha256()
    with open(zip_path, "rb") as f:
        for chunk in iter(lambda: f.read(64 * 1024), b""):
            h.update(chunk)
    sha = h.hexdigest()
    size = zip_path.stat().st_size

    download_url = (
        f"https://github.com/{GITHUB_USER}/{REPO_NAME}/releases/download/"
        f"{pack_id}-v{version}/{pack_id}.zip"
    )
    preview_image = (
        f"https://raw.githubusercontent.com/{GITHUB_USER}/{REPO_NAME}/main/"
        f"packs/{pack_id}/preview.png"
    ) if (pack_dir / "preview.png").exists() else ""

    new_entry = {
        "id": pack_id,
        "name": name,
        "version": version,
        "description": description,
        "kind": kind,
        "size_bytes": size,
        "file_count": len(font_files),
        "tags": tags,
        "preview_image": preview_image,
        "download_url": download_url,
        "sha256": sha,
    }

    # --- Update manifest.json ---
    manifest_path = repo_root / "manifest.json"
    if manifest_path.exists():
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    else:
        manifest = {"schema_version": 1, "updated_at": "", "packs": []}

    packs = manifest.setdefault("packs", [])
    # Replace nếu đã có pack id, else append
    found = False
    for i, p in enumerate(packs):
        if p.get("id") == pack_id:
            packs[i] = new_entry
            found = True
            break
    if not found:
        packs.append(new_entry)

    manifest["updated_at"] = datetime.now(timezone.utc).isoformat()
    manifest_path.write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    print(f"✅ Done.")
    print(f"   pack:    {pack_id} v{version}")
    print(f"   size:    {size:,} bytes ({size / 1024 / 1024:.2f} MB)")
    print(f"   files:   {len(font_files)}")
    print(f"   sha256:  {sha}")
    print(f"   url:     {download_url}")
    print()
    print("Next:")
    print(f"   git add . && git commit -m '{pack_id} v{version}' && git push")
    print(f"   gh release create {pack_id}-v{version} {zip_path} --notes '...'")
    return 0


if __name__ == "__main__":
    sys.exit(main())
