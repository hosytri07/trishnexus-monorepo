"""
export-tokens.py — sync design/tokens.v2.json sang web artefact.

Đọc:  design/tokens.v2.json
Xuất:
    website/assets/tokens.css         (:root = dark default + [data-theme='light'] override)
    website/assets/tailwind.theme.cjs (Tailwind theme object để import trong tailwind.config.cjs)

Chạy:
    python scripts/export-tokens.py                   # xuất tokens mặc định
    python scripts/export-tokens.py --check           # chỉ verify output hiện tại match JSON (CI)
    python scripts/export-tokens.py --out website/assets   # chỉ định thư mục out khác

Rule:
- 2 theme duy nhất: dark (default) + light. Alias (trishwarm/midnight/...) được giữ trong
  theme_manager.py phía desktop — web không cần biết.
- Theme-independent tokens (font/space/radius/shadow/motion/zIndex/semantic/group) nằm :root,
  dùng mọi theme.
- Theme-dependent tokens (color.accent/surface/text/border) có 2 block: :root cho dark,
  [data-theme='light'] cho light.
- Mọi file output có header AUTO-GENERATED — dev không edit tay.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_TOKENS = REPO_ROOT / "design" / "tokens.v2.json"
DEFAULT_OUT_DIR = REPO_ROOT / "website" / "assets"

CSS_HEADER = """\
/* ======================================================================
 * AUTO-GENERATED from design/tokens.v2.json — DO NOT EDIT BY HAND.
 * Regen: python scripts/export-tokens.py
 *
 * Dark theme (default)      : :root
 * Light theme               : [data-theme='light'] on <html> or <body>
 * Theme-independent tokens  : always in :root (font/space/radius/shadow/motion/zIndex/
 *                             semantic colors, group colors, icon config)
 * ====================================================================== */
"""

JS_HEADER = """\
/* ======================================================================
 * AUTO-GENERATED from design/tokens.v2.json — DO NOT EDIT BY HAND.
 * Regen: python scripts/export-tokens.py
 *
 * Usage (tailwind.config.cjs):
 *   const tokens = require('./assets/tailwind.theme.cjs');
 *   module.exports = {
 *     darkMode: 'class',
 *     content: ['./app/**\\/*.{ts,tsx}', './components/**\\/*.{ts,tsx}'],
 *     theme: { extend: tokens },
 *   };
 * ====================================================================== */
"""


# ------------------- CSS serialization helpers ------------------- #

def _kv(key: str, value: Any) -> str:
    return f"  --{key}: {value};"


def _flatten_css(prefix: str, obj: dict, out: list[str]) -> None:
    """Recursively flatten nested dict into CSS --a-b-c: value lines.

    Skips keys starting with '_' (reserved for metadata like _comment).
    """
    for k, v in obj.items():
        if k.startswith("_"):
            continue
        full = f"{prefix}-{k}" if prefix else k
        if isinstance(v, dict):
            _flatten_css(full, v, out)
        else:
            out.append(_kv(full, v))


def _emit_root_block(tokens: dict) -> list[str]:
    """Build :root block = dark theme colors + all theme-independent tokens."""
    dark = tokens["themes"]["dark"]["color"]

    lines: list[str] = []
    lines.append(":root {")
    lines.append("  color-scheme: dark;")
    lines.append("")
    lines.append("  /* === COLOR (dark theme — default) === */")
    _flatten_css("color", dark, lines)

    lines.append("")
    lines.append("  /* === SEMANTIC (theme-independent) === */")
    for k, v in tokens["semantic"].items():
        if k.startswith("_"):
            continue
        lines.append(_kv(f"semantic-{k}", v))

    lines.append("")
    lines.append("  /* === GROUP colors (theme-independent) === */")
    for k, v in tokens["group"].items():
        if k.startswith("_"):
            continue
        lines.append(_kv(f"group-{k}", v))

    lines.append("")
    lines.append("  /* === FONT (theme-independent) === */")
    _flatten_css("font", tokens["font"], lines)

    lines.append("")
    lines.append("  /* === SPACE (theme-independent) === */")
    for k, v in tokens["space"].items():
        if k.startswith("_"):
            continue
        lines.append(_kv(f"space-{k}", v))

    lines.append("")
    lines.append("  /* === RADIUS (theme-independent) === */")
    for k, v in tokens["radius"].items():
        if k.startswith("_"):
            continue
        lines.append(_kv(f"radius-{k}", v))

    lines.append("")
    lines.append("  /* === SHADOW (theme-independent) === */")
    for k, v in tokens["shadow"].items():
        if k.startswith("_"):
            continue
        lines.append(_kv(f"shadow-{k}", v))

    lines.append("")
    lines.append("  /* === MOTION (theme-independent) === */")
    _flatten_css("motion", tokens["motion"], lines)

    lines.append("")
    lines.append("  /* === Z-INDEX (theme-independent) === */")
    for k, v in tokens["zIndex"].items():
        if k.startswith("_"):
            continue
        lines.append(_kv(f"zIndex-{k}", v))

    lines.append("")
    lines.append("  /* === ICON config (theme-independent) === */")
    for k, v in tokens["icons"].items():
        if k.startswith("_"):
            continue
        lines.append(_kv(f"icon-{k}", v))

    lines.append("}")
    return lines


def _emit_light_block(tokens: dict) -> list[str]:
    """Build [data-theme='light'] override = light theme colors only."""
    light = tokens["themes"]["light"]["color"]

    lines: list[str] = []
    lines.append("[data-theme='light'] {")
    lines.append("  color-scheme: light;")
    lines.append("")
    lines.append("  /* === COLOR (light theme — override dark defaults) === */")
    _flatten_css("color", light, lines)
    lines.append("}")
    return lines


def render_css(tokens: dict) -> str:
    parts: list[str] = [CSS_HEADER, ""]
    parts.extend(_emit_root_block(tokens))
    parts.append("")
    parts.extend(_emit_light_block(tokens))
    parts.append("")  # trailing newline
    return "\n".join(parts)


# ------------------- Tailwind theme serialization ------------------- #

def _js_val(v: Any) -> str:
    """Serialize a Python value to a JS literal (single-quoted strings, numbers as-is)."""
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return str(v)
    if isinstance(v, str):
        # escape backslash + single quote
        s = v.replace("\\", "\\\\").replace("'", "\\'")
        return f"'{s}'"
    if isinstance(v, list):
        return "[" + ", ".join(_js_val(x) for x in v) + "]"
    raise TypeError(f"cannot serialize {type(v)}: {v!r}")


def _js_obj(obj: dict, indent: int = 2) -> str:
    """Serialize a dict to a JS object literal (recursively), skipping '_comment' keys."""
    pad = " " * indent
    inner_pad = " " * (indent + 2)
    lines: list[str] = ["{"]
    items = [(k, v) for k, v in obj.items() if not k.startswith("_")]
    for i, (k, v) in enumerate(items):
        trailing = "," if i < len(items) - 1 else ","
        # Quote key if it has non-ident chars or starts with digit
        key = k if (k.replace("_", "").isalnum() and not k[0].isdigit()) else f"'{k}'"
        if isinstance(v, dict):
            sub = _js_obj(v, indent + 2)
            lines.append(f"{inner_pad}{key}: {sub}{trailing}")
        else:
            lines.append(f"{inner_pad}{key}: {_js_val(v)}{trailing}")
    lines.append(f"{pad}}}")
    return "\n".join(lines)


def render_tailwind(tokens: dict) -> str:
    """Build a Tailwind `theme.extend` object as a CommonJS module."""
    dark = tokens["themes"]["dark"]["color"]
    light = tokens["themes"]["light"]["color"]

    theme_obj: dict[str, Any] = {
        # Colors: expose both raw dark/light for component-level hacks,
        # plus semantic/group/surface so Tailwind classes like bg-surface-card work.
        "colors": {
            "accent": dark["accent"],         # accent is theme-independent (same in dark + light)
            "surface": dark["surface"],       # dark as base; light overridden via :root data-theme in CSS
            "text": dark["text"],
            "border": dark["border"],
            "semantic": {k: v for k, v in tokens["semantic"].items() if not k.startswith("_")},
            "group": {k: v for k, v in tokens["group"].items() if not k.startswith("_")},
            "dark": dark,                      # full dark palette scoped
            "light": light,                    # full light palette scoped
        },
        "fontFamily": {
            "display": [tokens["font"]["family"]["display"], "sans-serif"],
            "body": [tokens["font"]["family"]["body"], "sans-serif"],
            "mono": [tokens["font"]["family"]["mono"], "monospace"],
        },
        "fontSize": {k: v for k, v in tokens["font"]["size"].items() if not k.startswith("_")},
        "fontWeight": {k: v for k, v in tokens["font"]["weight"].items() if not k.startswith("_")},
        "lineHeight": {k: v for k, v in tokens["font"]["lineHeight"].items() if not k.startswith("_")},
        "spacing": {k: v for k, v in tokens["space"].items() if not k.startswith("_")},
        "borderRadius": {k: v for k, v in tokens["radius"].items() if not k.startswith("_")},
        "boxShadow": {k: v for k, v in tokens["shadow"].items() if not k.startswith("_")},
        "transitionDuration": {
            k: v for k, v in tokens["motion"]["duration"].items() if not k.startswith("_")
        },
        "transitionTimingFunction": {
            k: v for k, v in tokens["motion"]["easing"].items() if not k.startswith("_")
        },
        "zIndex": {k: str(v) for k, v in tokens["zIndex"].items() if not k.startswith("_")},
    }

    body = _js_obj(theme_obj, indent=0)
    return f"{JS_HEADER}\nmodule.exports = {body};\n"


# ------------------- Main ------------------- #

def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Export design tokens v2 → web CSS + Tailwind theme.")
    ap.add_argument(
        "--tokens",
        type=Path,
        default=DEFAULT_TOKENS,
        help=f"Path to tokens JSON (default: {DEFAULT_TOKENS.relative_to(REPO_ROOT)})",
    )
    ap.add_argument(
        "--out",
        type=Path,
        default=DEFAULT_OUT_DIR,
        help=f"Output directory (default: {DEFAULT_OUT_DIR.relative_to(REPO_ROOT)})",
    )
    ap.add_argument(
        "--check",
        action="store_true",
        help="Compare generated output with existing files; exit 1 if drift (for CI).",
    )
    args = ap.parse_args(argv)

    if not args.tokens.exists():
        print(f"[ERROR] tokens file not found: {args.tokens}", file=sys.stderr)
        return 2

    tokens = json.loads(args.tokens.read_text(encoding="utf-8"))
    css_text = render_css(tokens)
    tw_text = render_tailwind(tokens)

    css_path = args.out / "tokens.css"
    tw_path = args.out / "tailwind.theme.cjs"

    if args.check:
        drift = False
        for path, expected in [(css_path, css_text), (tw_path, tw_text)]:
            if not path.exists():
                print(f"[CHECK] missing: {path}")
                drift = True
                continue
            actual = path.read_text(encoding="utf-8")
            if actual != expected:
                print(f"[CHECK] drift: {path}")
                drift = True
        if drift:
            print("Run: python scripts/export-tokens.py", file=sys.stderr)
            return 1
        print("[CHECK] tokens in sync.")
        return 0

    args.out.mkdir(parents=True, exist_ok=True)
    css_path.write_text(css_text, encoding="utf-8")
    tw_path.write_text(tw_text, encoding="utf-8")
    print(f"[OK] wrote {_pretty(css_path)} ({len(css_text)} bytes)")
    print(f"[OK] wrote {_pretty(tw_path)} ({len(tw_text)} bytes)")
    return 0


def _pretty(path: Path) -> str:
    """Pretty-print path — relative to repo if possible, else absolute."""
    try:
        return str(path.relative_to(REPO_ROOT))
    except ValueError:
        return str(path)


if __name__ == "__main__":
    sys.exit(main())
