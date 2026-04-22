"""Smoke test — tier 2/3 protection orchestration.

Test logic của packaging_tiers.py KHÔNG require Cython/PyArmor binary:
    - _module_to_path: resolve dotted → file path
    - compile_tier2_cython với Cython missing → fallback tier 1
    - compile_tier2_cython với Cython + module không tồn tại → skip
    - compile_tier3_pyarmor với PyArmor missing → fallback
    - encrypt_tier3_data stub: liệt kê file khớp glob pattern

Cython real compile test: chỉ chạy nếu Cython installed (optional).

Chạy:
    python scripts/tiers_smoke.py
"""

from __future__ import annotations

import importlib.util
import sys
import tempfile
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "scripts"))
sys.path.insert(0, str(REPO_ROOT / "shared" / "trishteam_core" / "src"))

from packaging_tiers import (  # noqa: E402
    _module_to_path,
    compile_tier2_cython,
    compile_tier3_pyarmor,
    encrypt_tier3_data,
)


def _banner(t: str) -> None:
    print(f"\n{'═' * 60}\n {t}\n{'═' * 60}")


def _check(cond: bool, msg: str) -> None:
    sym = "✅" if cond else "❌"
    print(f"  {sym} {msg}")
    if not cond:
        raise AssertionError(msg)


def _build_fake_pkg(tmp: Path, pkg_name: str = "fakelib") -> Path:
    """Tạo fake package staging để test resolver + cython/pyarmor."""
    pkg = tmp / "code" / pkg_name
    pkg.mkdir(parents=True)

    (pkg / "__init__.py").write_text("", encoding="utf-8")

    core = pkg / "core"
    core.mkdir()
    (core / "__init__.py").write_text("", encoding="utf-8")
    (core / "formulas.py").write_text(
        "def add(a, b): return a + b\n"
        "def mul(a, b): return a * b\n",
        encoding="utf-8",
    )
    (core / "templates.py").write_text(
        "TEMPLATE_VERSION = '1.0.0'\n",
        encoding="utf-8",
    )
    (pkg / "app.py").write_text("def main(): return 0\n", encoding="utf-8")
    return pkg


def test_module_to_path():
    _banner("1. _module_to_path: resolve dotted → file")
    with tempfile.TemporaryDirectory() as tmp:
        tmp_root = Path(tmp)
        _build_fake_pkg(tmp_root, "fakelib")
        code_dir = tmp_root / "code" / "fakelib"

        # Dotted không có pkg prefix
        p1 = _module_to_path(code_dir, "fakelib", "core.formulas")
        _check(p1 is not None and p1.name == "formulas.py",
               f"core.formulas → {p1}")

        # Dotted có pkg prefix (strip)
        p2 = _module_to_path(code_dir, "fakelib", "fakelib.core.templates")
        _check(p2 is not None and p2.name == "templates.py",
               f"fakelib.core.templates → {p2}")

        # Package __init__ fallback
        p3 = _module_to_path(code_dir, "fakelib", "core")
        _check(p3 is not None and p3.name == "__init__.py",
               f"core → {p3}")

        # Không tồn tại
        p4 = _module_to_path(code_dir, "fakelib", "core.nonexistent")
        _check(p4 is None, "core.nonexistent → None")


def test_cython_without_cython_installed():
    _banner("2. compile_tier2_cython: fallback khi Cython missing")
    if importlib.util.find_spec("Cython") is not None:
        print("  ⚠ Cython đã cài — skip negative test, chuyển test real compile")
        return

    with tempfile.TemporaryDirectory() as tmp:
        tmp_root = Path(tmp)
        pkg = _build_fake_pkg(tmp_root, "fakelib")

        result = compile_tier2_cython(
            code_dir=pkg,
            pkg_name="fakelib",
            cython_modules=["core.formulas", "core.templates"],
        )
        _check(result["backend"] == "fallback-pyc",
               f"backend == 'fallback-pyc' (got {result['backend']})")
        _check(len(result["skipped"]) == 2, f"2 module skipped")
        # Source .py vẫn còn (không unlink)
        _check((pkg / "core" / "formulas.py").exists(),
               "formulas.py vẫn còn (để tier 1 pyc handle)")


def test_cython_with_missing_module():
    _banner("3. compile_tier2_cython: module không tồn tại → skip riêng")
    with tempfile.TemporaryDirectory() as tmp:
        tmp_root = Path(tmp)
        pkg = _build_fake_pkg(tmp_root, "fakelib")

        result = compile_tier2_cython(
            code_dir=pkg,
            pkg_name="fakelib",
            cython_modules=["core.nonexistent", "core.formulas"],
        )
        # Dù Cython có hay không, module không tồn tại phải bị skip
        skipped_modules = {s["module"] for s in result["skipped"]}
        _check("core.nonexistent" in skipped_modules,
               f"core.nonexistent bị skip (got skipped={skipped_modules})")


def test_cython_real_compile_if_available():
    _banner("4. compile_tier2_cython: real compile (nếu Cython installed)")
    if importlib.util.find_spec("Cython") is None:
        print("  ⚠ Cython chưa cài — skip real compile test (OK)")
        return

    # Check C compiler
    import shutil
    if sys.platform == "win32":
        cc = shutil.which("cl.exe") or shutil.which("gcc.exe")
    else:
        cc = shutil.which("cc") or shutil.which("gcc")
    if not cc:
        print("  ⚠ C compiler không có — skip")
        return

    with tempfile.TemporaryDirectory() as tmp:
        tmp_root = Path(tmp)
        pkg = _build_fake_pkg(tmp_root, "fakelib")

        result = compile_tier2_cython(
            code_dir=pkg,
            pkg_name="fakelib",
            cython_modules=["core.formulas"],
        )
        _check(result["backend"] == "cython",
               f"backend == 'cython' (got {result['backend']})")
        # Nếu compiled, .py gốc bị xoá + có file .pyd/.so
        if "core.formulas" in result["compiled"]:
            _check(not (pkg / "core" / "formulas.py").exists(),
                   "formulas.py đã xoá sau cythonize")
            outputs = [
                p for p in (pkg / "core").iterdir()
                if p.name.startswith("formulas.") and p.suffix in (".pyd", ".so")
                or ("cpython-" in p.name and p.suffix == ".so")
            ]
            _check(len(outputs) > 0,
                   f"có .pyd/.so trong core/: {[p.name for p in outputs]}")
        else:
            print(f"  ⚠ Cython skip core.formulas — có thể do C compiler mismatch: "
                  f"{result['skipped']}")


def test_pyarmor_fallback():
    _banner("5. compile_tier3_pyarmor: fallback khi pyarmor missing")
    with tempfile.TemporaryDirectory() as tmp:
        tmp_root = Path(tmp)
        pkg = _build_fake_pkg(tmp_root, "fakelib")

        result = compile_tier3_pyarmor(
            code_dir=pkg,
            pkg_name="fakelib",
            pyarmor_modules=["app"],
        )
        # PyArmor thường không có trong sandbox → fallback
        if result["backend"] == "fallback-pyc":
            _check(True, "backend == fallback-pyc (PyArmor missing OK)")
            _check(len(result["skipped"]) == 1, "1 module skipped")
        else:
            # Có PyArmor — chỉ verify không crash
            _check(True, f"PyArmor có sẵn: result = {result}")


def test_encrypt_data_aes_roundtrip():
    _banner("6. encrypt_tier3_data: AES-GCM encrypt + decrypt roundtrip")
    import json

    from trishteam_core.crypto.aes import (
        build_salt_from_manifest,
        decrypt_bytes,
        decrypt_file,
        derive_app_key,
        encrypt_bytes,
        load_encrypted_json,
    )

    with tempfile.TemporaryDirectory() as tmp:
        tmp_root = Path(tmp)
        # Tạo fake data files
        data_dir = tmp_root / "data" / "templates"
        data_dir.mkdir(parents=True)
        payload_a = {"template": "xin chào", "value": 42, "list": [1, 2, 3]}
        payload_b = {"template": "hello", "id": "b"}
        (data_dir / "a.json").write_text(
            json.dumps(payload_a, ensure_ascii=False), encoding="utf-8")
        (data_dir / "b.json").write_text(
            json.dumps(payload_b, ensure_ascii=False), encoding="utf-8")
        (data_dir / "c.txt").write_text("plaintext", encoding="utf-8")

        result = encrypt_tier3_data(
            staging=tmp_root,
            patterns=["data/templates/*.json"],
            app_id="fakeapp",
        )
        _check(result["status"] == "ok",
               f"status == 'ok' (got {result['status']})")
        _check(result["algorithm"] == "AES-256-GCM", "algorithm tagged")
        _check(len(result["matched_files"]) == 2,
               f"2 file .json khớp (got {len(result['matched_files'])})")
        _check(not any("c.txt" in f for f in result["matched_files"]),
               ".txt không khớp *.json")
        _check(len(result["encrypted"]) == 2, "2 file đã encrypt")
        _check("salt" in result and len(result["salt"]) == 32,
               f"salt hex = 32 char (got {len(result.get('salt', ''))})")

        # Plaintext .json đã bị xoá, .enc tồn tại
        _check(not (data_dir / "a.json").exists(),
               "a.json plaintext đã xoá")
        _check((data_dir / "a.json.enc").exists(),
               "a.json.enc đã tạo")
        _check((data_dir / "c.txt").exists(),
               "c.txt (không match pattern) vẫn còn")

        # File .enc phải bắt đầu bằng magic TAEV
        enc_bytes = (data_dir / "a.json.enc").read_bytes()
        _check(enc_bytes[:4] == b"TAEV",
               f"magic header TAEV (got {enc_bytes[:4]!r})")
        _check(enc_bytes[4] == 0x01, "version byte 0x01")

        # Decrypt roundtrip
        salt = bytes.fromhex(result["salt"])
        key = derive_app_key("fakeapp", salt)
        decrypted = decrypt_file(data_dir / "a.json.enc", key)
        _check(json.loads(decrypted.decode("utf-8")) == payload_a,
               "decrypt a.json.enc == original payload_a")

        # Convenience load_encrypted_json
        manifest_stub = {
            "protection": {
                "encryption": {"salt": result["salt"]},
            },
        }
        salt_via_manifest = build_salt_from_manifest(manifest_stub)
        _check(salt_via_manifest == salt,
               "build_salt_from_manifest khớp")

        decoded_b = load_encrypted_json(
            data_dir / "b.json.enc", "fakeapp", salt)
        _check(decoded_b == payload_b,
               "load_encrypted_json b.json.enc == payload_b")

        # Key wrong → decrypt fail (AESGCM raises InvalidTag)
        wrong_key = derive_app_key("otherapp", salt)
        try:
            decrypt_file(data_dir / "a.json.enc", wrong_key)
            _check(False, "wrong key phải raise InvalidTag")
        except Exception as e:
            _check("InvalidTag" in type(e).__name__ or "InvalidTag" in str(e),
                   f"wrong key → {type(e).__name__} (ok)")

        # Raw bytes roundtrip
        ct = encrypt_bytes(b"secret123", key)
        _check(decrypt_bytes(ct, key) == b"secret123",
               "encrypt_bytes/decrypt_bytes roundtrip")


def test_encrypt_data_edge_cases():
    _banner("6b. encrypt_tier3_data: missing app_id / no matches / no crypto")
    with tempfile.TemporaryDirectory() as tmp:
        tmp_root = Path(tmp)
        data_dir = tmp_root / "data" / "templates"
        data_dir.mkdir(parents=True)
        (data_dir / "x.json").write_text("{}", encoding="utf-8")

        # Missing app_id
        r_noid = encrypt_tier3_data(
            staging=tmp_root,
            patterns=["data/templates/*.json"],
        )
        _check(r_noid["status"] == "missing-app-id",
               f"no app_id → status missing-app-id (got {r_noid['status']})")
        _check((data_dir / "x.json").exists(),
               "x.json vẫn plaintext khi missing-app-id")

        # No matches
        r_nomatch = encrypt_tier3_data(
            staging=tmp_root,
            patterns=["data/nonexistent/*.json"],
            app_id="fakeapp",
        )
        _check(r_nomatch["status"] == "no-matches",
               f"status no-matches (got {r_nomatch['status']})")

        # No patterns
        r_nopat = encrypt_tier3_data(
            staging=tmp_root,
            patterns=[],
            app_id="fakeapp",
        )
        _check(r_nopat["status"] == "no-patterns",
               f"status no-patterns (got {r_nopat['status']})")


def test_key_derivation_determinism():
    _banner("6c. derive_app_key: deterministic, app_id/salt-sensitive")
    from trishteam_core.crypto.aes import derive_app_key

    salt1 = bytes.fromhex("a" * 32)
    salt2 = bytes.fromhex("b" * 32)

    k1a = derive_app_key("appA", salt1)
    k1b = derive_app_key("appA", salt1)
    k2 = derive_app_key("appB", salt1)
    k3 = derive_app_key("appA", salt2)

    _check(k1a == k1b, "cùng (app_id, salt) → cùng key (deterministic)")
    _check(len(k1a) == 32, f"key length 32 byte (got {len(k1a)})")
    _check(k1a != k2, "app_id khác → key khác")
    _check(k1a != k3, "salt khác → key khác")


def test_empty_module_lists():
    _banner("7. Tier 2/3 với list rỗng → no-op")
    with tempfile.TemporaryDirectory() as tmp:
        tmp_root = Path(tmp)
        pkg = _build_fake_pkg(tmp_root, "fakelib")

        r2 = compile_tier2_cython(pkg, "fakelib", [])
        _check(r2["compiled"] == [] and r2["skipped"] == [],
               "tier2 list rỗng → return empty")

        r3 = compile_tier3_pyarmor(pkg, "fakelib", [])
        _check(r3["obfuscated"] == [] and r3["skipped"] == [],
               "tier3 list rỗng → return empty")

        r_data = encrypt_tier3_data(tmp_root, [])
        _check(r_data["matched_files"] == []
               and r_data["status"] == "no-patterns",
               f"encrypt_data list rỗng → status no-patterns "
               f"(got {r_data.get('status')})")


def main() -> int:
    print("🧪 Packaging tiers smoke test\n")
    test_module_to_path()
    test_cython_without_cython_installed()
    test_cython_with_missing_module()
    test_cython_real_compile_if_available()
    test_pyarmor_fallback()
    test_encrypt_data_aes_roundtrip()
    test_encrypt_data_edge_cases()
    test_key_derivation_determinism()
    test_empty_module_lists()
    print("\n✅ All tiers smoke tests passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
