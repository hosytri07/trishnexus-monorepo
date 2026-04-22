"""packaging_tiers.py — Tier 2/3 code protection helpers.

Import bởi `scripts/build-app-tpack.py` khi build với `--tier 2` hoặc `--tier 3`.

Tier 1 (basline, 100% app):
    .py → py_compile → .pyc (optimize=2, xoá source)

Tier 2 (Library/Note/Search — core modules):
    - Core modules chỉ định trong tpack.toml `[protection].cython_modules`:
        .py → Cython cythonize → .c → compile → .pyd (Windows) / .so (Linux)
    - Module còn lại → .pyc như Tier 1.
    - Source code thành machine code, reverse-engineer khó hơn nhiều so với .pyc.

Tier 3 (Design/Admin — IP cao, data sensitive):
    - Tất cả của Tier 2, cộng thêm:
    - PyArmor obfuscate các module trong `[protection].pyarmor_modules`:
        .py → pyarmor gen --obf-code 2 → wrapped .pyc với bytecode encrypted
    - Data files trong `[protection].encrypt_data` → AES-GCM (task #62)
    - Runtime key derivation: HW fingerprint + license token (task #62)

Cross-platform note:
    - Cython .pyd chỉ load trên Windows; .so chỉ load trên Linux.
      → Production build phải chạy trên Windows 3.11 để ra đúng .pyd.
      Trên Linux dev: tạo .so như sanity check, nhưng .tpack bị đánh dấu
      `protection.built_on = "linux"` để Launcher cảnh báo.
    - PyArmor free tier có giới hạn — license commercial cho production.
      Nếu không có PyArmor binary → tier 3 fallback tier 2 + warning.

Cấu trúc tpack.toml (ví dụ):

    [protection]
    tier = 2
    cython_modules = [
        "trishlibrary.core.formulas",
        "trishlibrary.core.templates",
        "trishlibrary.auth.license_check",
    ]
    # Tier 3 only:
    pyarmor_modules = [
        "trishdesign.core.renderer",
    ]
    encrypt_data = [
        "data/templates/*.json",
        "data/formulas/*.yml",
    ]
"""

from __future__ import annotations

import importlib.util
import os
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any


# ─────────────────────────── Module resolution ───────────────────────────


def _module_to_path(code_dir: Path, pkg_name: str, dotted: str) -> Path | None:
    """Convert 'trishlibrary.core.formulas' → code_dir/trishlibrary/core/formulas.py.

    Return None nếu file không tồn tại.
    """
    parts = dotted.split(".")
    # Nếu dotted start với pkg_name, strip prefix (vì code_dir = staging/code/<pkg>)
    if parts and parts[0] == pkg_name:
        parts = parts[1:]
    if not parts:
        return None
    candidate = code_dir.joinpath(*parts).with_suffix(".py")
    if candidate.is_file():
        return candidate
    # Package __init__: trishlibrary.core → trishlibrary/core/__init__.py
    pkg_candidate = code_dir.joinpath(*parts) / "__init__.py"
    if pkg_candidate.is_file():
        return pkg_candidate
    return None


# ─────────────────────────── Tier 2 — Cython ───────────────────────────


def _cython_available() -> bool:
    return importlib.util.find_spec("Cython") is not None


def _c_compiler_available() -> bool:
    """Check nếu có cc/gcc/cl.exe để compile .c → .pyd/.so.

    PyInstaller's setuptools sẽ lo chuyện này, nhưng dev mode thì check thủ công.
    """
    if sys.platform == "win32":
        # cl.exe hoặc gcc/clang qua PATH
        for exe in ("cl.exe", "gcc.exe", "clang.exe"):
            if shutil.which(exe):
                return True
        return False
    for exe in ("cc", "gcc", "clang"):
        if shutil.which(exe):
            return True
    return False


def compile_tier2_cython(
    code_dir: Path,
    pkg_name: str,
    cython_modules: list[str],
    *,
    log=print,
) -> dict[str, Any]:
    """Cythonize các module được chỉ định + compile ra .pyd (Win) hoặc .so (Linux).

    Return dict:
        {
          "requested": ["trishlibrary.core.formulas", ...],
          "compiled":  ["trishlibrary/core/formulas"],     # subset thành công
          "skipped":   [{"module": "...", "reason": "..."}],
          "backend":   "cython" | "fallback-pyc",
        }

    Bất kỳ module nào fail → giữ .py gốc cho `_compile_to_pyc` xử lý ở tầng
    trên (tier 1 fallback).
    """
    result: dict[str, Any] = {
        "requested": list(cython_modules),
        "compiled": [],
        "skipped": [],
        "backend": "cython",
    }

    if not cython_modules:
        return result

    if not _cython_available():
        log("⚠  Cython không cài — fallback tier 2 về tier 1 (.pyc). "
            "Cài bằng: pip install cython")
        result["backend"] = "fallback-pyc"
        for m in cython_modules:
            result["skipped"].append({"module": m, "reason": "cython-missing"})
        return result

    if not _c_compiler_available():
        log("⚠  Không tìm thấy C compiler (cc/gcc/cl.exe). "
            "Cython cần C compiler để build .pyd/.so. Fallback tier 1 (.pyc).")
        result["backend"] = "fallback-pyc"
        for m in cython_modules:
            result["skipped"].append({"module": m, "reason": "c-compiler-missing"})
        return result

    # Lazy import Cython
    try:
        from Cython.Build import cythonize  # type: ignore[import-not-found]
        from setuptools import Extension  # type: ignore[import-not-found]
    except ImportError as e:
        log(f"⚠  Import Cython/setuptools fail: {e}. Fallback tier 1.")
        result["backend"] = "fallback-pyc"
        for m in cython_modules:
            result["skipped"].append({"module": m, "reason": "import-fail"})
        return result

    # Resolve module → file paths
    module_files: list[tuple[str, Path]] = []
    for m in cython_modules:
        src = _module_to_path(code_dir, pkg_name, m)
        if src is None:
            log(f"   ⚠ Không tìm thấy module '{m}' — skip")
            result["skipped"].append({"module": m, "reason": "module-not-found"})
            continue
        module_files.append((m, src))

    if not module_files:
        return result

    log(f"🔐 Tier 2: Cythonize {len(module_files)} module…")

    # Cython compile inline dùng setuptools build_ext
    # Tạo extension cho mỗi module
    extensions = []
    src_to_module = {}
    for dotted, src in module_files:
        ext_name = dotted  # Ext name = dotted path → .pyd đặt đúng location
        ext = Extension(
            name=ext_name,
            sources=[str(src)],
            # Optimize flags
            extra_compile_args=(
                ["-O2", "-fPIC"] if sys.platform != "win32" else ["/O2"]
            ),
        )
        extensions.append(ext)
        src_to_module[str(src)] = dotted

    # Build
    from distutils.core import setup  # type: ignore[import-not-found]

    orig_argv = sys.argv
    orig_cwd = os.getcwd()
    try:
        os.chdir(code_dir)
        sys.argv = ["setup.py", "build_ext", "--inplace", "--quiet"]
        setup(
            name=f"{pkg_name}-tier2",
            ext_modules=cythonize(
                extensions,
                language_level=3,
                compiler_directives={
                    "language_level": 3,
                    "embedsignature": False,   # Ẩn docstring signature
                    "annotation_typing": False,
                },
                quiet=True,
            ),
            script_args=["build_ext", "--inplace"],
        )
    except SystemExit as e:
        if e.code not in (0, None):
            log(f"   ⚠ Cython build exit={e.code}")
    except Exception as e:
        log(f"   ⚠ Cython build fail: {type(e).__name__}: {e}")
        # Mark tất cả module fail
        for dotted, _src in module_files:
            result["skipped"].append({"module": dotted, "reason": f"build-fail: {e}"})
        return result
    finally:
        sys.argv = orig_argv
        os.chdir(orig_cwd)

    # Verify + cleanup .py gốc cho module đã cythonize thành công
    ext_suffix = ".pyd" if sys.platform == "win32" else ".so"
    for dotted, src in module_files:
        # Cython output có suffix dài kiểu foo.cpython-311-x86_64-linux-gnu.so
        # Check bất kỳ extension matching trong cùng folder
        folder = src.parent
        stem = src.stem
        matching = [
            p for p in folder.iterdir()
            if p.name.startswith(stem + ".") and p.suffix in (".pyd", ".so")
            or (p.name.startswith(stem + ".") and ext_suffix in p.name)
        ]
        if matching:
            # Xoá .py gốc + .c intermediate
            try:
                src.unlink()
            except OSError:
                pass
            c_file = src.with_suffix(".c")
            if c_file.exists():
                c_file.unlink()
            result["compiled"].append(dotted)
            log(f"   ✓ {dotted} → {matching[0].name}")
        else:
            result["skipped"].append({"module": dotted, "reason": "no-output"})
            log(f"   ⚠ {dotted}: không tìm thấy .pyd/.so output")

    # Xoá build/ folder của setuptools nếu tạo
    build_folder = code_dir / "build"
    if build_folder.is_dir():
        shutil.rmtree(build_folder, ignore_errors=True)

    return result


# ─────────────────────────── Tier 3 — PyArmor ───────────────────────────


def _pyarmor_available() -> bool:
    return shutil.which("pyarmor") is not None


def compile_tier3_pyarmor(
    code_dir: Path,
    pkg_name: str,
    pyarmor_modules: list[str],
    *,
    log=print,
) -> dict[str, Any]:
    """Obfuscate các module nhạy cảm bằng PyArmor.

    PyArmor wrap .py thành runtime-encrypted bytecode. Cần binary `pyarmor`
    (cài bằng `pip install pyarmor`). Free tier giới hạn — cho production
    thì mua license.

    Return dict tương tự compile_tier2_cython.
    """
    result: dict[str, Any] = {
        "requested": list(pyarmor_modules),
        "obfuscated": [],
        "skipped": [],
        "backend": "pyarmor",
    }
    if not pyarmor_modules:
        return result

    if not _pyarmor_available():
        log("⚠  PyArmor không cài — skip tier 3 obfuscation. "
            "Cài bằng: pip install pyarmor (cần license cho production)")
        result["backend"] = "fallback-pyc"
        for m in pyarmor_modules:
            result["skipped"].append({"module": m, "reason": "pyarmor-missing"})
        return result

    # Resolve module paths
    module_files: list[tuple[str, Path]] = []
    for m in pyarmor_modules:
        src = _module_to_path(code_dir, pkg_name, m)
        if src is None:
            result["skipped"].append({"module": m, "reason": "module-not-found"})
            continue
        module_files.append((m, src))

    if not module_files:
        return result

    log(f"🛡  Tier 3: PyArmor obfuscate {len(module_files)} module…")
    # Output dir tạm cho PyArmor (nó ghi vào `dist/` theo default)
    pyarmor_out = code_dir / "_pyarmor_out"
    pyarmor_out.mkdir(exist_ok=True)

    for dotted, src in module_files:
        # `pyarmor gen --output <dir> --obf-code 2 <file>`
        # --obf-code 2: strongest obfuscation level
        cmd = [
            "pyarmor", "gen",
            "--output", str(pyarmor_out),
            "--obf-code", "2",
            str(src),
        ]
        try:
            proc = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        except subprocess.TimeoutExpired:
            result["skipped"].append({"module": dotted, "reason": "pyarmor-timeout"})
            continue
        except FileNotFoundError:
            result["skipped"].append({"module": dotted, "reason": "pyarmor-missing"})
            continue

        if proc.returncode != 0:
            log(f"   ⚠ PyArmor fail {dotted}: {proc.stderr.strip()}")
            result["skipped"].append({
                "module": dotted,
                "reason": f"pyarmor-exit-{proc.returncode}",
            })
            continue

        # Copy output .py (obfuscated wrapper) back vào src location, xoá source
        obf_out = pyarmor_out / src.name
        if obf_out.is_file():
            shutil.copy2(obf_out, src)
            result["obfuscated"].append(dotted)
            log(f"   ✓ {dotted} obfuscated")
        else:
            result["skipped"].append({"module": dotted, "reason": "no-output"})

    # PyArmor sinh pyarmor_runtime_<id>/ folder — copy vào code_dir
    runtime_folders = [p for p in pyarmor_out.iterdir()
                       if p.is_dir() and p.name.startswith("pyarmor_runtime")]
    for rf in runtime_folders:
        target = code_dir / rf.name
        if not target.exists():
            shutil.copytree(rf, target)

    # Cleanup output dir
    shutil.rmtree(pyarmor_out, ignore_errors=True)

    return result


# ─────────────────────────── Tier 3 — AES data encryption ───────────────────────────


def _crypto_available() -> bool:
    return importlib.util.find_spec("cryptography") is not None


def encrypt_tier3_data(
    staging: Path,
    patterns: list[str],
    *,
    app_id: str | None = None,
    build_salt: bytes | None = None,
    log=print,
) -> dict[str, Any]:
    """Encrypt data files trùng patterns bằng AES-GCM-256.

    Dùng `trishteam_core.crypto.aes` để derive key từ (app_id, build_salt) rồi
    encrypt từng file → ghi ra `<file>.enc` và xoá plaintext gốc.

    Param:
        staging: staging folder (root chứa code/, data/, resources/, …).
        patterns: danh sách glob tương đối so với `staging` (vd
            "data/templates/*.json").
        app_id: cần thiết khi patterns non-empty. KDF ikm prefix.
        build_salt: 16 byte random. Nếu None và có patterns → tự sinh.

    Return:
        {
          "requested_patterns": [...],
          "matched_files":      [...relative paths...],
          "encrypted":          [{"src": "data/a.json", "dst": "data/a.json.enc",
                                  "size_in": 120, "size_out": 150}, ...],
          "skipped":            [{"file": "...", "reason": "..."}],
          "salt":               <hex str>  (chỉ nếu có encrypt thật),
          "algorithm":          "AES-256-GCM",
          "key_derivation":     "HKDF-SHA256(app_id + salt)",
          "status":             "ok" | "no-patterns" | "no-matches"
                                 | "crypto-missing" | "missing-app-id",
        }

    Plaintext xoá SAU khi encrypt thành công; nếu fail 1 file → giữ plaintext
    + thêm vào `skipped` + các file đã encrypt vẫn giữ.
    """
    result: dict[str, Any] = {
        "requested_patterns": list(patterns),
        "matched_files": [],
        "encrypted": [],
        "skipped": [],
        "algorithm": "AES-256-GCM",
        "key_derivation": "HKDF-SHA256(app_id + salt)",
        "status": "ok",
    }

    if not patterns:
        result["status"] = "no-patterns"
        return result

    if not _crypto_available():
        log("⚠  cryptography chưa cài — skip encrypt data. "
            "Cài bằng: pip install cryptography")
        result["status"] = "crypto-missing"
        for pat in patterns:
            for f in staging.rglob(pat):
                if f.is_file():
                    result["skipped"].append({
                        "file": str(f.relative_to(staging)),
                        "reason": "crypto-missing",
                    })
        return result

    if not app_id:
        log("⚠  encrypt_tier3_data gọi mà không có app_id — skip.")
        result["status"] = "missing-app-id"
        return result

    # Match files
    matched: list[Path] = []
    seen: set[Path] = set()
    for pat in patterns:
        for f in staging.rglob(pat):
            if f.is_file() and f not in seen:
                matched.append(f)
                seen.add(f)

    result["matched_files"] = [str(f.relative_to(staging)) for f in matched]

    if not matched:
        log("ℹ  encrypt_data: 0 file khớp patterns — skip.")
        result["status"] = "no-matches"
        return result

    # Generate build salt nếu chưa có
    if build_salt is None:
        build_salt = os.urandom(16)
    result["salt"] = build_salt.hex()

    # Lazy import để không bắt buộc cài crypto khi không dùng tier 3
    try:
        from trishteam_core.crypto.aes import (  # type: ignore[import-not-found]
            derive_app_key,
            encrypt_file,
        )
    except ImportError:
        # Fallback: import trực tiếp từ shared path (khi build script chạy
        # mà trishteam_core chưa `pip install -e`).
        shared_src = Path(__file__).resolve().parent.parent / (
            "shared/trishteam_core/src"
        )
        sys.path.insert(0, str(shared_src))
        try:
            from trishteam_core.crypto.aes import (  # type: ignore[import-not-found]  # noqa: E501
                derive_app_key,
                encrypt_file,
            )
        except ImportError as e:
            log(f"⚠  Import trishteam_core.crypto fail: {e}")
            result["status"] = "crypto-import-fail"
            return result

    key = derive_app_key(app_id, build_salt)

    log(f"🔐 Tier 3: AES-GCM encrypt {len(matched)} data file "
        f"(app_id={app_id}, salt={build_salt.hex()[:8]}…)")

    for f in matched:
        rel = f.relative_to(staging)
        dst = f.with_suffix(f.suffix + ".enc")
        try:
            size_in = f.stat().st_size
            size_out = encrypt_file(f, dst, key)
            f.unlink()  # Xoá plaintext sau khi encrypt thành công
            result["encrypted"].append({
                "src": str(rel),
                "dst": str(rel) + ".enc",
                "size_in": size_in,
                "size_out": size_out,
            })
            log(f"   ✓ {rel} → {rel.name}.enc ({size_in}→{size_out}B)")
        except Exception as e:
            log(f"   ⚠ Encrypt fail {rel}: {type(e).__name__}: {e}")
            result["skipped"].append({
                "file": str(rel),
                "reason": f"{type(e).__name__}: {e}",
            })
            # Cleanup .enc dở dang nếu có
            if dst.exists():
                try:
                    dst.unlink()
                except OSError:
                    pass

    return result
