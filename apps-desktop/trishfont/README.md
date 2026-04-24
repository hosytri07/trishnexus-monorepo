# TrishFont (Tauri 2)

Font library manager + **Pair AI** cho designer Việt. Quét thư mục
font, classify theo personality (serif/sans/slab/mono/display/script/
handwriting) và đề xuất cặp *heading + body* hợp nhau — có ưu tiên
hỗ trợ tiếng Việt.

## Kiến trúc tách domain

Parsing font metadata ở Rust (`ttf-parser` — zero-copy, pure Rust,
không đụng FreeType). Classify personality + pair scoring ở TS
(`@trishteam/core/fonts`). Lý do:

- **Rust chỉ đọc file**: name table, OS/2 weight/width, glyph table
  (check VN diacritics).
- **TS làm decision**: rule classify, matrix pair score, rationale
  tiếng Việt — testable qua Vitest (29 case), reusable cho website/
  Zalo Mini App.

## Commands backend (Rust)

| Command | Mô tả | Trả về |
| ------- | ----- | ------ |
| `scan_fonts(dir, max_entries?)` | Walk thư mục (.ttf/.otf/.ttc/.otc), parse metadata qua `ttf-parser` | `ScanFontsStats` |
| `read_font(path)` | Parse 1 file font | `FontMeta` |
| `app_version` | `CARGO_PKG_VERSION` | string |

Hard cap: `max_entries` clamp 10..10 000 (default 2 000). Depth 8.

## Pair AI matrix

Contrast score giữa 2 personality (0..1), vd:

- **serif + sans** = 0.9 (classic editorial)
- **sans + slab** = 0.75 (tech/UX)
- **display + sans** = 0.9 (poster)
- **same personality** = 0.25 (boring)

Score cuối (0..100) weighted: personality 60 + weight contrast 20 +
VN support body 20.

## VN support detection

Font coi là hỗ trợ tiếng Việt nếu có glyph cho ≥80% của tập 26 char
diacritic phổ biến (à á ả ã ạ ă ằ ắ ặ â ấ ầ ậ đ ê ề ế ệ ơ ờ ớ ợ ư
ừ ứ ự). Conservative — tránh false positive với font chỉ có ASCII.

## Dev

```bash
# Từ repo root
pnpm install
cd apps-desktop/trishfont

pnpm dev            # UI only (browser) — dùng 11 seed font fake
pnpm tauri:dev      # Full Tauri window với filesystem thật
pnpm tauri:build    # Bundle msi/dmg/deb
```

## Phase hiện tại — 14.3.2 alpha

- ✅ Scan folder (readonly, không cài)
- ✅ Classify personality (serif/sans/slab/mono/display/script/handwriting)
- ✅ Pair AI (matrix score + rationale tiếng Việt)
- ✅ Filter VN-only, fix heading để so sánh body candidates
- ❌ Install/uninstall font vào OS (planned 14.3.2.b)
- ❌ Font pack export/import TPack format (planned 14.3.2.c)

Preview dùng FontFace API — load font bytes qua `plugin-fs` vào
`new FontFace(family, ArrayBuffer)` rồi `add()` vào
`document.fonts`. Hiện alpha chưa wire — UI hiển thị sample text
với font name làm fontFamily, nên cần font đã cài trên OS mới
render đúng.

## Privacy

- Đọc metadata file font (name, weight, glyph coverage) — không
  upload path hay font bytes lên server.
- Không command nào cài font vào OS — user phải tự dùng công cụ hệ
  điều hành.
- Dialog `pickFontDirectory` là built-in OS file picker qua
  `@tauri-apps/plugin-dialog`.

## Capabilities

`core:default`, `dialog:default`, `dialog:allow-open`, `fs:default`,
`fs:allow-read-file`. CSP thêm `font-src 'self' data: asset:` cho
FontFace API.
