"""build-app-tpack.py — đóng gói 1 app TrishTEAM thành file .tpack.

Dùng cho kiến trúc Platform + Apps (xem docs/PACKAGING.md).

Usage:
    python scripts/build-app-tpack.py <app-id> [--tier 1|2|3] [--output <path>]

Ví dụ:
    python scripts/build-app-tpack.py trishfont
    → dist/trishfont-1.0.0.tpack + in SHA256

Script sẽ:
    1. Đọc apps/<app-id>/pyproject.toml → id, version, entry.
    2. Đọc apps/<app-id>/tpack.toml (optional) → override manifest fields,
       protection tier, shortcuts, permissions.
    3. Copy source .py + resources vào staging folder.
    4. `py_compile` → .pyc, xoá .py gốc (Tier 1 protection — che source cơ bản).
    5. Tier 2/3: placeholder — hook cho compile-protected.py (task #61).
    6. Build manifest.json theo schema trong docs/PACKAGING.md.
    7. Zip staging → dist/<id>-<version>.tpack.
    8. SHA256 + size + file count.
    9. In ra block JSON để copy vào apps.json registry.

Build offline: không fetch network, không require internet.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import py_compile
import shutil
import sys
import tempfile
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

# tomllib built-in từ Python 3.11; fallback tomli cho 3.10.
try:
    import tomllib  # type: ignore[import-not-found]
except ImportError:  # pragma: no cover
    import tomli as tomllib  # type: ignore[import-not-found,no-redef]

# Tier 2/3 protection helpers (task #61)
sys.path.insert(0, str(Path(__file__).resolve().parent))
from packaging_tiers import (  # noqa: E402
    compile_tier2_cython,
    compile_tier3_pyarmor,
    encrypt_tier3_data,
)


SCHEMA_VERSION = 1
GITHUB_USER = "hosytri07"
MONOREPO = "trishnexus-monorepo"

DEFAULT_RUNTIME_REQ = {
    "python": ">=3.11,<3.12",
    "trishteam_core": ">=0.1.0,<1.0.0",
}

# Pattern skip khi copy source — không cần ship trong .tpack.
SKIP_DIRS = {"__pycache__", ".pytest_cache", ".mypy_cache"}
SKIP_PATTERNS = {".egg-info", ".DS_Store", "Thumbs.db"}


# ─────────────────────────── helpers ───────────────────────────

def _log(msg: str) -> None:
    print(msg, flush=True)


def _sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(64 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def _load_toml(path: Path) -> dict[str, Any]:
    with open(path, "rb") as f:
        return tomllib.load(f)


def _should_skip(p: Path) -> bool:
    if p.name in SKIP_DIRS:
        return True
    for pat in SKIP_PATTERNS:
        if pat in p.name:
            return True
    return False


def _copy_source_tree(src_root: Path, dest_root: Path) -> list[Path]:
    """Copy toàn bộ src/ vào staging, skip cache/egg-info. Return list .py đã copy."""
    copied_py: list[Path] = []
    for item in src_root.rglob("*"):
        if _should_skip(item):
            continue
        # Skip nested inside skipped parents
        if any(part in SKIP_DIRS for part in item.parts):
            continue
        rel = item.relative_to(src_root)
        target = dest_root / rel
        if item.is_dir():
            target.mkdir(parents=True, exist_ok=True)
        elif item.is_file():
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(item, target)
            if target.suffix == ".py":
                copied_py.append(target)
    return copied_py


def _compile_to_pyc(py_files: list[Path]) -> int:
    """py_compile từng file → xoá .py. Return số file compiled OK."""
    ok_count = 0
    for py in py_files:
        pyc = py.with_suffix(".pyc")
        try:
            # doraise=True để raise exception khi syntax error
            # cfile argument = compiled output path (không dùng __pycache__/)
            py_compile.compile(str(py), cfile=str(pyc), doraise=True, optimize=2)
            py.unlink()
            ok_count += 1
        except py_compile.PyCompileError as e:
            _log(f"   ⚠ Skip compile {py.name}: {e.msg.strip()}")
            # Giữ .py gốc nếu compile fail — ít nhất vẫn chạy được
    return ok_count


def _walk_all_files(root: Path) -> list[Path]:
    return [p for p in root.rglob("*") if p.is_file() and not _should_skip(p)]


def _make_zip(staging: Path, out_path: Path) -> None:
    """Zip toàn bộ staging → .tpack với DEFLATE."""
    if out_path.exists():
        out_path.unlink()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(out_path, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
        for f in sorted(_walk_all_files(staging)):
            arc = f.relative_to(staging)
            zf.write(f, arc)


# ─────────────────────────── manifest ───────────────────────────

def _derive_entry(pyproject: dict[str, Any], fallback: str) -> str:
    """Lấy entry từ [project.scripts] nếu có, else fallback."""
    scripts = pyproject.get("project", {}).get("scripts", {})
    if scripts:
        first_key = next(iter(scripts))
        return scripts[first_key]  # "module:func"
    return fallback


def _build_manifest(
    app_id: str,
    pyproject: dict[str, Any],
    tpack_cfg: dict[str, Any],
    tier: int,
    size_bytes: int,
    file_count: int,
    sha256: str,
) -> dict[str, Any]:
    project = pyproject.get("project", {})
    name = tpack_cfg.get("manifest", {}).get("name") or project.get("name", app_id)
    # Convention: display name viết hoa từ id nếu tpack.toml không set
    display_name = tpack_cfg.get("manifest", {}).get("display_name") or name.replace(
        "trish", "Trish"
    ).replace("-", " ").title()
    version = project.get("version", "0.0.0")
    description = tpack_cfg.get("manifest", {}).get("description") or project.get(
        "description", ""
    )
    tagline = tpack_cfg.get("manifest", {}).get("tagline", description.split(".")[0])
    entry = tpack_cfg.get("manifest", {}).get("entry") or _derive_entry(
        pyproject, f"{app_id}.app:main"
    )

    runtime_cfg = tpack_cfg.get("runtime", {}) or DEFAULT_RUNTIME_REQ
    # Ghi bytecode version thực tế để Launcher verify trước khi load
    runtime_cfg = dict(runtime_cfg)
    runtime_cfg["python_bytecode"] = _current_python_version()

    shortcuts = tpack_cfg.get("shortcuts", {}).get("windows", [])
    if not shortcuts:
        # Fallback: 1 shortcut default
        shortcuts = [
            {
                "name": display_name,
                "icon": "resources/app.ico",
                "args": f"launch {app_id}",
            }
        ]

    permissions = tpack_cfg.get("permissions", {})

    manifest = {
        "schema_version": SCHEMA_VERSION,
        "id": app_id,
        "name": display_name,
        "version": version,
        "tagline": tagline,
        "description": description,
        "entry": entry,
        "runtime": runtime_cfg,
        "protection_tier": tier,
        "size_bytes": size_bytes,
        "file_count": file_count,
        "sha256": sha256,
        "requires": {
            "platform": tpack_cfg.get("requires", {}).get("platform", "windows"),
            "admin": tpack_cfg.get("requires", {}).get("admin", False),
        },
        "bundled_data_packs": tpack_cfg.get("bundled_data_packs", []),
        "provides_shortcuts": shortcuts,
        "permissions": permissions,
        "built_at": datetime.now(timezone.utc).isoformat(),
    }
    return manifest


# ─────────────────────────── build ───────────────────────────

def _current_python_version() -> str:
    v = sys.version_info
    return f"{v.major}.{v.minor}"


def _warn_if_python_mismatch(runtime_cfg: dict[str, Any]) -> None:
    """Cảnh báo nếu Python đang chạy script khác major.minor với runtime target.

    .pyc bytecode không compatible giữa Python minor versions (3.10 ≠ 3.11).
    Runtime 3.11 không load được .pyc compile bởi 3.10 → fail to import.
    """
    spec = str(runtime_cfg.get("python", "")).strip()
    cur = _current_python_version()
    # Heuristic parse: spec ">=3.11,<3.12" → pin 3.11
    if ">=3.11" in spec and "<3.12" in spec:
        pinned = "3.11"
    elif ">=3.10" in spec and "<3.11" in spec:
        pinned = "3.10"
    elif ">=3.12" in spec and "<3.13" in spec:
        pinned = "3.12"
    else:
        return  # Không parse được spec → skip check
    if pinned != cur:
        _log(f"⚠  CẢNH BÁO: Python hiện tại {cur} KHÁC runtime target {pinned}.")
        _log(f"   .pyc compile bởi Python {cur} sẽ KHÔNG load được bởi "
             f"Runtime {pinned} (magic number khác).")
        _log(f"   Khi build production: chạy script bằng python{pinned}.exe.")


def build_tpack(app_dir: Path, tier: int, output: Path | None, compile_pyc: bool) -> Path:
    """Thực hiện build. Return path .tpack output."""
    if not app_dir.is_dir():
        raise SystemExit(f"❌ Không tìm thấy app directory: {app_dir}")

    pyproject_path = app_dir / "pyproject.toml"
    if not pyproject_path.is_file():
        raise SystemExit(f"❌ Thiếu pyproject.toml: {pyproject_path}")

    tpack_toml_path = app_dir / "tpack.toml"
    tpack_cfg: dict[str, Any] = {}
    if tpack_toml_path.is_file():
        tpack_cfg = _load_toml(tpack_toml_path)
        _log(f"📋 Dùng tpack.toml từ {tpack_toml_path}")
    else:
        _log(f"ℹ  Không có tpack.toml, auto-derive manifest từ pyproject.toml")

    pyproject = _load_toml(pyproject_path)
    project = pyproject.get("project", {})
    version = project.get("version")
    if not version:
        raise SystemExit("❌ pyproject.toml thiếu [project].version")

    # App id: ưu tiên tpack.toml, else pyproject project.name, else folder name
    app_id = (
        tpack_cfg.get("package", {}).get("id")
        or project.get("name")
        or app_dir.name
    ).lower()

    # Tier có thể override từ tpack.toml
    if "package" in tpack_cfg and "protection_tier" in tpack_cfg["package"]:
        tier = int(tpack_cfg["package"]["protection_tier"])

    _log(f"🔧 Build: {app_id} v{version} (Tier {tier})")
    _warn_if_python_mismatch(tpack_cfg.get("runtime", DEFAULT_RUNTIME_REQ))

    # --- Locate source ---
    # Pattern monorepo: apps/<id>/src/<pkg>/ — <pkg> có thể khác <id> nếu có dash
    src_dir = app_dir / "src"
    if not src_dir.is_dir():
        raise SystemExit(f"❌ Thiếu src/: {src_dir}")

    # Find package dir (first subdir không phải .egg-info)
    pkg_dirs = [
        d for d in src_dir.iterdir()
        if d.is_dir() and not d.name.endswith(".egg-info")
    ]
    if not pkg_dirs:
        raise SystemExit(f"❌ Không có package nào trong {src_dir}")
    if len(pkg_dirs) > 1:
        _log(f"⚠  Nhiều package trong src/: {[p.name for p in pkg_dirs]}, dùng cái đầu")
    pkg_dir = pkg_dirs[0]
    pkg_name = pkg_dir.name
    _log(f"   package: {pkg_name}")

    # --- Build trong staging temp dir ---
    with tempfile.TemporaryDirectory(prefix=f"tpack-{app_id}-") as tmp:
        staging = Path(tmp) / "staging"
        code_dir = staging / "code" / pkg_name
        resources_dir = staging / "resources"

        code_dir.mkdir(parents=True)
        resources_dir.mkdir(parents=True)

        # Copy source tree
        _log(f"📂 Copy source → staging…")
        copied_py = _copy_source_tree(pkg_dir, code_dir)

        # Tách resources ra folder riêng (theo spec)
        inner_resources = code_dir / "resources"
        if inner_resources.is_dir():
            for item in inner_resources.iterdir():
                shutil.move(str(item), str(resources_dir / item.name))
            inner_resources.rmdir()

        # Copy top-level data/ folder nếu có (templates, formulas, …). Không
        # phải app nào cũng dùng — chỉ các app có `[protection].encrypt_data`
        # hoặc bundle static data.
        app_data_dir = app_dir / "data"
        if app_data_dir.is_dir():
            staging_data = staging / "data"
            shutil.copytree(
                app_data_dir,
                staging_data,
                ignore=shutil.ignore_patterns(
                    "__pycache__", ".DS_Store", "Thumbs.db"),
            )
            _log(f"📂 Copy data/ ({sum(1 for _ in staging_data.rglob('*') if _.is_file())} file)")

        # --- Tier 2: Cython → .pyd/.so (chạy TRƯỚC py_compile để cython tìm
        #     được .py gốc).
        protection_cfg = tpack_cfg.get("protection", {}) or {}
        tier2_result: dict[str, Any] = {}
        tier3_result: dict[str, Any] = {}
        tier3_data_result: dict[str, Any] = {}

        if tier >= 2:
            cython_modules = protection_cfg.get("cython_modules", []) or []
            if cython_modules:
                tier2_result = compile_tier2_cython(
                    code_dir=code_dir,
                    pkg_name=pkg_name,
                    cython_modules=cython_modules,
                    log=_log,
                )
                # Refresh copied_py — bỏ file đã cythonize (đã unlink)
                copied_py = [p for p in copied_py if p.exists()]
            else:
                _log(f"ℹ  Tier {tier} nhưng tpack.toml không có "
                     f"[protection].cython_modules — không cythonize file nào")

        # --- Tier 3: PyArmor obfuscate + AES encrypt data ---
        if tier >= 3:
            pyarmor_modules = protection_cfg.get("pyarmor_modules", []) or []
            if pyarmor_modules:
                tier3_result = compile_tier3_pyarmor(
                    code_dir=code_dir,
                    pkg_name=pkg_name,
                    pyarmor_modules=pyarmor_modules,
                    log=_log,
                )
            encrypt_patterns = protection_cfg.get("encrypt_data", []) or []
            if encrypt_patterns:
                tier3_data_result = encrypt_tier3_data(
                    staging=staging,
                    patterns=encrypt_patterns,
                    app_id=app_id,
                    log=_log,
                )

        # --- Compile to .pyc (Tier 1 baseline — run SAU tier 2/3 để compile
        #     những file còn .py: fallback + module không được cythonize).
        if compile_pyc and tier >= 1:
            _log(f"🔐 Compile .py → .pyc (optimize=2, xoá source)…")
            ok = _compile_to_pyc(copied_py)
            _log(f"   {ok}/{len(copied_py)} file compiled OK")

        # --- Stats before manifest ---
        all_files = _walk_all_files(staging)
        # Nhưng chưa có manifest.json trong staging! Tính size sau khi zip xong.

        # --- Tạm zip 1 lần để tính sha256 & size tổng (bao gồm cả manifest)
        # Nhưng manifest chứa sha256 của chính mình thì circular. Thay vào đó
        # manifest ghi sha256 của zip final (sha256 này dùng bên apps.json để
        # verify integrity khi download — manifest bên trong zip không cần).
        # Cách làm: zip trước WITHOUT manifest → hash → rồi thêm manifest vào
        # có sha256 đó → rebuild zip final.

        # Lần zip 1: không có manifest → tính sha256 payload
        tmp_zip = Path(tmp) / f"{app_id}-payload.zip"
        _make_zip(staging, tmp_zip)
        payload_sha = _sha256_file(tmp_zip)
        payload_size = tmp_zip.stat().st_size
        payload_count = len(all_files)

        # Build manifest với sha256 = sha256 của payload (không bao gồm manifest)
        manifest = _build_manifest(
            app_id=app_id,
            pyproject=pyproject,
            tpack_cfg=tpack_cfg,
            tier=tier,
            size_bytes=payload_size,
            file_count=payload_count,
            sha256=payload_sha,
        )

        # Inject kết quả protection vào manifest (tier 2/3 audit trail)
        if tier2_result or tier3_result or tier3_data_result:
            prot_block: dict[str, Any] = {
                "built_on": sys.platform,
                "built_with_python": _current_python_version(),
            }
            if tier2_result:
                prot_block["cython"] = tier2_result
            if tier3_result:
                prot_block["pyarmor"] = tier3_result
            if tier3_data_result:
                prot_block["encrypted_data"] = tier3_data_result
                # Runtime cần salt để derive key — tách ra encryption block
                # riêng (stable path cho load_encrypted_json).
                salt_hex = tier3_data_result.get("salt")
                if salt_hex:
                    prot_block["encryption"] = {
                        "algorithm": tier3_data_result.get(
                            "algorithm", "AES-256-GCM"),
                        "key_derivation": tier3_data_result.get(
                            "key_derivation",
                            "HKDF-SHA256(app_id + salt)"),
                        "salt": salt_hex,
                    }
            manifest["protection"] = prot_block
        manifest_path = staging / "manifest.json"
        manifest_path.write_text(
            json.dumps(manifest, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )

        # --- Zip final (có manifest) ---
        dist_dir = (
            output.parent if output
            else app_dir.parent.parent / "dist"
        )
        out_path = output or (dist_dir / f"{app_id}-{version}.tpack")
        _log(f"📦 Đóng gói → {out_path}")
        _make_zip(staging, out_path)

        final_size = out_path.stat().st_size
        final_sha = _sha256_file(out_path)

        # --- Summary ---
        _log("")
        _log(f"✅ Done: {out_path.name}")
        _log(f"   id:           {app_id}")
        _log(f"   version:      {version}")
        _log(f"   tier:         {tier}")
        _log(f"   file count:   {payload_count} (trong payload)")
        _log(f"   size:         {final_size:,} bytes ({final_size / 1024 / 1024:.2f} MB)")
        _log(f"   sha256:       {final_sha}")
        _log(f"   payload sha:  {payload_sha}  (dùng cho apps.json.sha256)")
        _log("")

        # --- Block JSON cho apps.json registry ---
        download_url = (
            f"https://github.com/{GITHUB_USER}/{MONOREPO}/releases/download/"
            f"{app_id}-v{version}/{out_path.name}"
        )
        apps_json_entry = {
            "id": app_id,
            "name": manifest["name"],
            "version": version,
            "tagline": manifest["tagline"],
            "logo_url": (
                f"https://raw.githubusercontent.com/{GITHUB_USER}/"
                f"trishnexus-launcher-registry/main/logos/{manifest['name']}/icon-256.png"
            ),
            "download": {
                "windows_x64": {
                    "url": download_url,
                    "sha256": payload_sha,
                    "size_bytes": final_size,
                    "format": "tpack",
                }
            },
        }
        _log("📋 Block JSON cho apps.json (copy vào registry repo):")
        _log(json.dumps(apps_json_entry, indent=2, ensure_ascii=False))
        _log("")
        _log("Next:")
        _log(f"   git tag {app_id}-v{version}")
        _log(f"   gh release create {app_id}-v{version} {out_path} \\")
        _log(f"     --title '{manifest['name']} v{version}' --notes '...'")

        return out_path


# ─────────────────────────── CLI ───────────────────────────

def main() -> int:
    parser = argparse.ArgumentParser(
        description="Build TrishTEAM app .tpack package",
    )
    parser.add_argument(
        "app_id",
        help="App id (folder name under apps/, ví dụ: trishfont)",
    )
    parser.add_argument(
        "--tier",
        type=int,
        choices=[1, 2, 3],
        default=1,
        help="Protection tier 1/2/3 (xem docs/PACKAGING.md §4). Mặc định 1.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=None,
        help="Output path .tpack (default: dist/<id>-<version>.tpack)",
    )
    parser.add_argument(
        "--no-compile",
        action="store_true",
        help="Skip py_compile — giữ .py (debug / dev build)",
    )
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parent.parent
    app_dir = repo_root / "apps" / args.app_id
    if not app_dir.is_dir():
        _log(f"❌ App directory không tồn tại: {app_dir}")
        return 1

    try:
        build_tpack(
            app_dir=app_dir,
            tier=args.tier,
            output=args.output,
            compile_pyc=not args.no_compile,
        )
    except SystemExit:
        raise
    except Exception as e:
        _log(f"❌ Build fail: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
