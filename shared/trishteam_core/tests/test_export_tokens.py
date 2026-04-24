"""Test cho scripts/export-tokens.py — JSON → CSS + Tailwind theme.

Mục tiêu:
1. Script chạy thành công trên tokens.v2.json thật.
2. Output CSS có đúng :root (dark) + [data-theme='light'] block.
3. Output Tailwind cjs là JS syntactic hợp lệ (module.exports = { ... }).
4. --check mode idempotent — chạy 2 lần liên tiếp phải exit 0.
5. Drift detect — sửa JSON → check mode phải exit 1.
"""
from __future__ import annotations

import importlib.util
import json
import re
import subprocess
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[3]
SCRIPT_PATH = REPO_ROOT / "scripts" / "export-tokens.py"
TOKENS_PATH = REPO_ROOT / "design" / "tokens.v2.json"


def _load_script():
    """Import export-tokens.py as module (hyphen trong tên file → dùng importlib)."""
    spec = importlib.util.spec_from_file_location("export_tokens", SCRIPT_PATH)
    assert spec and spec.loader, "cannot load script"
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


@pytest.fixture
def tokens() -> dict:
    return json.loads(TOKENS_PATH.read_text(encoding="utf-8"))


def test_script_exists():
    assert SCRIPT_PATH.is_file(), f"{SCRIPT_PATH} missing"


def test_render_css_contains_both_themes(tokens):
    mod = _load_script()
    css = mod.render_css(tokens)
    # Header marker
    assert "AUTO-GENERATED" in css
    # :root block with dark defaults
    assert ":root {" in css
    assert "color-scheme: dark;" in css
    # Dark surface bg
    assert "--color-surface-bg: #0f0e0c;" in css
    # Light theme override block
    assert "[data-theme='light'] {" in css
    assert "color-scheme: light;" in css
    # Light surface bg (overridden) — dùng [-1] vì "[data-theme='light']" cũng
    # xuất hiện 1 lần trong header comment.
    light_block = css.split("[data-theme='light']")[-1]
    assert "--color-surface-bg: #f7f6f3;" in light_block


def test_render_css_has_theme_independent_tokens(tokens):
    mod = _load_script()
    css = mod.render_css(tokens)
    # Semantic
    assert "--semantic-success: #10B981;" in css
    # Group
    assert "--group-primary: #667EEA;" in css
    # Font
    assert "--font-family-display: Be Vietnam Pro;" in css
    # Space
    assert "--space-4: 10px;" in css
    # Radius
    assert "--radius-md: 8px;" in css
    # Motion
    assert "--motion-duration-fast: 150ms;" in css
    # zIndex
    assert "--zIndex-modal: 400;" in css


def test_render_css_skips_comment_keys(tokens):
    """_comment / _meta fields không được lọt vào CSS."""
    mod = _load_script()
    css = mod.render_css(tokens)
    assert "_comment" not in css
    assert "_meta" not in css


def test_render_tailwind_is_module_exports(tokens):
    mod = _load_script()
    tw = mod.render_tailwind(tokens)
    assert "AUTO-GENERATED" in tw
    assert "module.exports = {" in tw
    # Ends with };\n
    assert tw.rstrip().endswith("};")


def test_render_tailwind_has_expected_keys(tokens):
    mod = _load_script()
    tw = mod.render_tailwind(tokens)
    # Tailwind theme keys
    for key in (
        "colors:",
        "fontFamily:",
        "fontSize:",
        "spacing:",
        "borderRadius:",
        "boxShadow:",
        "transitionDuration:",
        "zIndex:",
    ):
        assert key in tw, f"missing {key} in tailwind theme"
    # Nested palette
    assert "surface:" in tw
    assert "accent:" in tw
    # Known value
    assert "'#667EEA'" in tw


def test_render_tailwind_balanced_braces(tokens):
    """Quick sanity: { count == } count → JS structure balanced."""
    mod = _load_script()
    tw = mod.render_tailwind(tokens)
    opens = tw.count("{")
    closes = tw.count("}")
    assert opens == closes, f"brace mismatch: {opens} open vs {closes} close"


def test_render_tailwind_quotes_numeric_keys(tokens):
    """Keys như '2xl' / '0' cần quote để JS parse đúng."""
    mod = _load_script()
    tw = mod.render_tailwind(tokens)
    # '2xl' is a valid tailwind key with a digit prefix
    assert "'2xl':" in tw
    # Numeric-only space keys too
    assert "'0':" in tw


def test_cli_writes_files(tmp_path, tokens):
    mod = _load_script()
    out_dir = tmp_path / "out"
    rc = mod.main(["--out", str(out_dir)])
    assert rc == 0
    assert (out_dir / "tokens.css").is_file()
    assert (out_dir / "tailwind.theme.cjs").is_file()


def test_cli_check_mode_succeeds_after_write(tmp_path):
    """Write → --check phải pass (exit 0)."""
    mod = _load_script()
    out_dir = tmp_path / "out"
    assert mod.main(["--out", str(out_dir)]) == 0
    assert mod.main(["--out", str(out_dir), "--check"]) == 0


def test_cli_check_mode_detects_drift(tmp_path):
    """--check phát hiện drift khi output bị sửa tay."""
    mod = _load_script()
    out_dir = tmp_path / "out"
    assert mod.main(["--out", str(out_dir)]) == 0

    # Corrupt the CSS
    css_path = out_dir / "tokens.css"
    css_path.write_text("/* hand-edited */\n", encoding="utf-8")

    rc = mod.main(["--out", str(out_dir), "--check"])
    assert rc == 1


def test_repo_tokens_css_in_sync():
    """website/assets/tokens.css phải luôn sync với tokens.v2.json (regen trước commit)."""
    mod = _load_script()
    rc = mod.main(["--check"])
    assert rc == 0, (
        "website/assets/tokens.css hoặc tailwind.theme.cjs bị drift — "
        "chạy: python scripts/export-tokens.py"
    )
