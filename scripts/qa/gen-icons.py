#!/usr/bin/env python3
"""scripts/qa/gen-icons.py — Phase 14.5.2

Generate placeholder icon set cho 10 desktop app dùng Pillow.

Mỗi app có color theme riêng (gradient 2 hex) + 1 glyph text giữa.
Output vào `apps-desktop/<app>/src-tauri/icons/`:

  - icon.png           — 1024×1024 source
  - 32x32.png
  - 128x128.png
  - 128x128@2x.png     — 256×256
  - icon.ico           — multi-size Windows (16/32/48/64/128/256)
  - icon.icns          — macOS (format ICNS sinh thủ công, 32/64/128/256/512)

Có thể rerun — file cũ bị overwrite.

Usage:
  python3 scripts/qa/gen-icons.py                # all 10 apps
  python3 scripts/qa/gen-icons.py trishdesign    # 1 app
"""

import os
import struct
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[2]

# ─────────────────────────────────────────────────────────────────────────────
# Theme registry: mỗi app 1 gradient (top-left → bottom-right) + glyph.
# ─────────────────────────────────────────────────────────────────────────────

THEMES = {
    "trishlauncher": {"c1": "#334155", "c2": "#64748B", "glyph": "L"},
    "trishcheck":    {"c1": "#0891B2", "c2": "#06B6D4", "glyph": "K"},
    "trishclean":    {"c1": "#DC2626", "c2": "#F87171", "glyph": "C"},
    "trishfont":     {"c1": "#D97706", "c2": "#FBBF24", "glyph": "F"},
    "trishtype":     {"c1": "#9333EA", "c2": "#C084FC", "glyph": "Y"},
    "trishimage":    {"c1": "#DB2777", "c2": "#F472B6", "glyph": "I"},
    "trishnote":     {"c1": "#16A34A", "c2": "#4ADE80", "glyph": "N"},
    "trishlibrary":  {"c1": "#0D9488", "c2": "#2DD4BF", "glyph": "B"},
    "trishsearch":   {"c1": "#EA580C", "c2": "#FB923C", "glyph": "S"},
    "trishdesign":   {"c1": "#7C3AED", "c2": "#4F46E5", "glyph": "D"},
}


def hex_to_rgb(h: str) -> tuple[int, int, int]:
    h = h.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


def lerp_color(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def build_gradient(size: int, c1_hex: str, c2_hex: str) -> Image.Image:
    """Linear gradient top-left → bottom-right, radius corner."""
    c1 = hex_to_rgb(c1_hex)
    c2 = hex_to_rgb(c2_hex)
    img = Image.new("RGB", (size, size), c1)
    px = img.load()
    for y in range(size):
        for x in range(size):
            t = (x + y) / (2 * size)
            px[x, y] = lerp_color(c1, c2, t)
    return img


def rounded_mask(size: int, radius_frac: float = 0.22) -> Image.Image:
    """Mask bo góc mềm để icon không vuông cứng."""
    mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(mask)
    r = int(size * radius_frac)
    draw.rounded_rectangle([0, 0, size - 1, size - 1], radius=r, fill=255)
    return mask


def find_bold_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    """Tìm 1 font bold có sẵn; fallback default nếu không."""
    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
        "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf",
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "/Windows/Fonts/arialbd.ttf",
    ]
    for p in candidates:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size=size)
            except Exception:
                pass
    return ImageFont.load_default()


def compose_icon(theme: dict, size: int = 1024) -> Image.Image:
    """Compose 1 icon vuông size×size RGBA."""
    gradient = build_gradient(size, theme["c1"], theme["c2"])
    mask = rounded_mask(size)
    rgba = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    rgba.paste(gradient, (0, 0), mask=mask)

    # Inner glow mềm
    glow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    gdraw = ImageDraw.Draw(glow)
    pad = int(size * 0.08)
    r = int(size * 0.18)
    gdraw.rounded_rectangle(
        [pad, pad, size - pad - 1, size - pad - 1],
        radius=r,
        outline=(255, 255, 255, 48),
        width=max(2, size // 80),
    )
    rgba = Image.alpha_composite(rgba, glow)

    # Glyph center
    draw = ImageDraw.Draw(rgba)
    font_size = int(size * 0.55)
    font = find_bold_font(font_size)
    glyph = theme["glyph"]
    # Dùng textbbox để căn giữa chính xác (hỗ trợ ở Pillow 9+).
    try:
        bbox = draw.textbbox((0, 0), glyph, font=font)
        tw = bbox[2] - bbox[0]
        th = bbox[3] - bbox[1]
        x = (size - tw) / 2 - bbox[0]
        y = (size - th) / 2 - bbox[1] - int(size * 0.02)
    except AttributeError:
        tw, th = draw.textsize(glyph, font=font)
        x = (size - tw) / 2
        y = (size - th) / 2
    # Shadow subtle
    shadow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    sdraw = ImageDraw.Draw(shadow)
    sdraw.text((x + size * 0.008, y + size * 0.008), glyph, font=font, fill=(0, 0, 0, 90))
    shadow = shadow.filter(ImageFilter.GaussianBlur(radius=size * 0.01))
    rgba = Image.alpha_composite(rgba, shadow)

    draw = ImageDraw.Draw(rgba)
    draw.text((x, y), glyph, font=font, fill=(255, 255, 255, 255))
    return rgba


# ─────────────────────────────────────────────────────────────────────────────
# ICNS writer — ICNS format Apple.
# Mỗi block: OSType (4 bytes ASCII) + size (u32 BE, bao gồm 8-byte header) + data.
# File header: "icns" + total size (u32 BE).
# Chúng ta dùng các OSType không-retina là128/256/512/1024 PNG payloads.
# ─────────────────────────────────────────────────────────────────────────────

ICNS_TYPES = [
    ("ic07", 128),   # 128×128
    ("ic08", 256),   # 256×256
    ("ic09", 512),   # 512×512
    ("ic10", 1024),  # 1024×1024
]


def write_icns(src_1024: Image.Image, out_path: Path) -> None:
    blocks = b""
    for ostype, sz in ICNS_TYPES:
        resized = src_1024.resize((sz, sz), Image.Resampling.LANCZOS)
        import io

        buf = io.BytesIO()
        resized.save(buf, format="PNG")
        payload = buf.getvalue()
        block_size = len(payload) + 8
        blocks += ostype.encode("ascii") + struct.pack(">I", block_size) + payload
    total_size = len(blocks) + 8
    with open(out_path, "wb") as f:
        f.write(b"icns" + struct.pack(">I", total_size) + blocks)


# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────


def gen_app(app: str) -> None:
    if app not in THEMES:
        raise SystemExit(f"App không rõ theme: {app}")
    theme = THEMES[app]
    icons_dir = ROOT / "apps-desktop" / app / "src-tauri" / "icons"
    icons_dir.mkdir(parents=True, exist_ok=True)

    src = compose_icon(theme, size=1024)
    src.save(icons_dir / "icon.png", format="PNG")

    for fname, size in [
        ("32x32.png", 32),
        ("128x128.png", 128),
        ("128x128@2x.png", 256),
    ]:
        src.resize((size, size), Image.Resampling.LANCZOS).save(
            icons_dir / fname, format="PNG"
        )

    # .ico multi-size
    ico_sizes = [(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    src.save(icons_dir / "icon.ico", format="ICO", sizes=ico_sizes)

    # .icns
    write_icns(src, icons_dir / "icon.icns")

    print(f"✅ {app}: icon.png icon.ico icon.icns + 32/128/256 PNG")


def main() -> None:
    targets = sys.argv[1:] or list(THEMES.keys())
    for app in targets:
        gen_app(app)
    print(f"\nDone — generated icons cho {len(targets)} app.")


if __name__ == "__main__":
    main()
