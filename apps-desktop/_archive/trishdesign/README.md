# TrishDesign — Color palette &amp; design token (desktop)

**Phase 14.4.4 · 2026-04-24 · v2.0.0-alpha.1**

TrishDesign sinh và quản lý design token offline cho hệ sinh thái TrishTEAM:

1. **Color scale 50..950** kiểu Tailwind — từ 1 hex base.
2. **Contrast WCAG 2.1** — ma trận fg × bg với rating AAA / AA / AA-large / fail.
3. **Harmony** — complementary, triadic, analogous, split-complementary, tetradic, monochromatic.
4. **AI enhancement** — `suggestPalette(base, mode)` tự sinh palette hoàn chỉnh (primary + secondary + accent + neutral + success/warning/danger + semantic alias WCAG-compliant).
5. **Export** — CSS vars, Tailwind config, Figma Tokens JSON, SCSS map, JSON flat.

Toàn bộ color conversion / contrast / scale / harmony / token / export nằm ở
`@trishteam/core/design` (pure TS, 75 unit test). Rust chỉ làm file-IO an toàn.

---

## 🏛️ Kiến trúc 3 tầng

```
┌──────────────────────────────────────────────────────────────────┐
│ Tầng 1: @trishteam/core/design  (pure TS, cross-platform)        │
│   • types.ts     — RGB / HSL / ColorScale / DesignTokenSet       │
│   • convert.ts   — hex ↔ rgb ↔ hsl, parseColor                   │
│   • contrast.ts  — WCAG relLuminance + ratio + AA/AAA rating     │
│   • scale.ts     — Tailwind-style 50..950 tint/shade từ 1 base   │
│   • harmony.ts   — complementary / triadic / analogous / …       │
│   • tokens.ts    — DesignTokenSet validate + merge + resolve     │
│   • export.ts    — CSS vars + Tailwind + Figma + SCSS + JSON     │
│   • suggest.ts   — AI: suggestPalette(base, mode)                │
└──────────────────────────────────────────────────────────────────┘
                              ▲
                              │ import qua alias @trishteam/core/design
                              │
┌──────────────────────────────────────────────────────────────────┐
│ Tầng 2: apps-desktop/trishdesign/src/  (React 18 + Vite, TSX)    │
│   • App.tsx        — 3-cột UI: scale list, palette grid,         │
│                       contrast matrix + export dropdown          │
│   • tauri-bridge.ts — wrap invoke() + dev fallback palette       │
│   • styles.css     — theme violet/indigo, dark/light responsive  │
└──────────────────────────────────────────────────────────────────┘
                              ▲
                              │ invoke("default_store_location", …)
                              │
┌──────────────────────────────────────────────────────────────────┐
│ Tầng 3: src-tauri/  (Rust 1.77 + Tauri 2)                        │
│   • default_store_location → app data dir                         │
│   • load_design_file(path) → đọc JSON DesignTokenSet (cap 8 MiB) │
│   • save_design_file(path, payload) → atomic write (temp+rename) │
└──────────────────────────────────────────────────────────────────┘
```

---

## 🎨 Query DSL — không. Đây là UI app, không có DSL.

Thay vào đó có **3 interaction chính:**

| Tương tác | Kết quả |
|---|---|
| Sửa hex input / color picker | Regen toàn bộ palette |
| Đổi mode (Sáng / Tối / Brand) | Đổi background/surface/text semantic |
| Click swatch bất kỳ | Chọn làm active, xem ma trận contrast |

Vietnamese diacritics trong tên palette được fold tự động cho ID (slugify).

---

## 🧪 Formula

```
buildScale:
  baseHsl = rgbToHsl(base)
  Với mỗi key ∈ [50, 100, 200, …, 900, 950]:
    targetL = TARGET_LIGHTNESS[key]       // 97, 94, 86, …, 18, 10
    satMul  = SAT_MULTIPLIER[key]         // 0.35, 0.5, 0.7, …, 0.8
    l = clamp(targetL + lOffset · decay, 2, 98)
    s = clamp(baseSat · satMul, 0, 100)
    hex = hslToHex({ h: baseHsl.h, s, l })

Contrast:
  L = 0.2126·R_lin + 0.7152·G_lin + 0.0722·B_lin
  ratio = (L_light + 0.05) / (L_dark + 0.05)
  rating:  AAA ≥ 7   ·  AA ≥ 4.5   ·  AA-large ≥ 3   ·  fail < 3

suggestPalette(base, mode):
  primary   = buildScale('primary',   base)
  secondary = buildScale('secondary', rotate(base, 180, sat-15))
  accent    = buildScale('accent',    rotate(base, 120, sat+10))
  neutral   = buildScale('neutral',   hslToHex(hue=base.h, sat=8, l=50))
  status    = success(#16A34A) + warning(#EAB308) + danger(#DC2626)
  semantic  = {
    background: neutral.{50 | 950},      // theo mode
    text:       neutral.{900 | 50},
    primary.onBg = pickAccessibleSwatch(primary, bg, AA)
    …
  }
```

---

## 🚀 Commands

```bash
# Dev browser (không Tauri — dùng DEV_FALLBACK_SET)
cd apps-desktop/trishdesign
pnpm dev           # http://127.0.0.1:1438

# Typecheck
pnpm typecheck     # ../../node_modules/.bin/tsc --noEmit

# Dev Tauri (cần Rust)
pnpm tauri:dev

# Build Tauri release bundle (msi/nsis/dmg/deb/appimage)
pnpm tauri:build
```

Port 1438 (HMR 1439) — riêng cho TrishDesign, không đụng TrishSearch (1436) /
TrishLibrary (1434) / TrishNote (1432) / TrishLauncher (1420).

---

## 🛡️ Privacy &amp; limits

- **Không network, không upload.** Palette sống trong RAM app; muốn lưu thì Save JSON manual.
- **File IO caps:** `load_design_file` / `save_design_file` từ chối file/payload > 8 MiB.
- **Atomic write:** Ghi tempfile `.tmp-tsn` rồi rename để tránh nửa-vời nếu app crash.

---

## 🗺️ Roadmap con

| Sub | Mô tả | Trạng thái |
|---|---|---|
| 14.4.4 | Core/design engine + UI alpha + 5 export format | ✅ |
| 14.4.4.b | Firebase cross-device sync cho preset chung | ⏳ |
| 14.4.4.c | Token versioning + diff 2 phiên bản | ⏳ |
| 14.4.4.d | Import từ Adobe ASE / Sketch palette | ⏳ |
| 14.4.4.e | CSS `color(display-p3 …)` + OKLCH output | ⏳ |

---

## 👥 License &amp; attribution

© 2026 TrishTEAM. Alpha prototype — phân phối nội bộ.
WCAG 2.1 contrast formula theo W3C. Tailwind-style scale lấy cảm hứng từ
`tailwindcss/colors` của Tailwind Labs.
