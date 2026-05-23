# TESTPLAN — TrishFont

**Phase 14.5.3 · 2026-04-24** · Port dev 1426 / HMR 1427 · Identifier `vn.trishteam.font`

App chức năng: scan folder `.ttf/.otf/.ttc/.otc` → parse metadata qua `ttf-parser` 0.20 → classify personality (serif/sans/…) → recommend font pair AI với scoring heading + body + VN diacritic.

---

## 1. Tiền đề

- [ ] `pnpm qa:all` pass
- [ ] `cd apps-desktop/trishfont && cargo tauri dev` start OK
- [ ] Có sẵn folder font (gợi ý: `C:\Windows\Fonts`, `/System/Library/Fonts`, `/usr/share/fonts` hoặc folder user tải về ≥ 10 font)
- [ ] Ít nhất 1 font có glyph tiếng Việt (Arial / Times New Roman / Roboto / Be Vietnam Pro)

## 2. Smoke test

1. **Mở app** — Title "TrishFont", topbar "Chọn thư mục".
2. **Pick font folder** — `plugin-dialog` → chọn `C:\Windows\Fonts` (Windows) hoặc `/System/Library/Fonts` (macOS).
3. **Scan** — Stats panel hiển thị:
   - Family count (Windows: ~150-300 family tuỳ máy)
   - File count (.ttf + .otf + .ttc + .otc)
   - Total size
   - Elapsed ms (< 5 s)
   - Errors (nếu font corrupt)
4. **Personality filter pills** — 8 filter: `serif / sans / slab / mono / display / script / handwriting / unknown`. Click `serif` → chỉ hiện Times New Roman / Cambria / Georgia.
5. **VN support toggle** — Bật → filter chỉ font có ≥ 80% coverage 26 diacritic. Arial / Roboto / Be Vietnam Pro phải còn; Webdings bị ẩn.
6. **Font family grid** — Mỗi card: family name, representative style (Regular ưu tiên), preview "The quick brown fox" + "Nhà hàng Đông Dương" (26 diacritic).
7. **Pin heading** — Click nút "📌" trên 1 card → cố định làm heading cho pair scoring.
8. **Pair list** — Sidebar bên phải hiển thị top 12 pair score từ heading đã pin. Mỗi pair: heading name + body name + 3 preview sample + score tier pill (excellent / good / ok / low / bad) + rationale tiếng Việt.
9. **Score sanity check** — Heading display font (Playfair Display) + body sans (Inter) phải có tier ≥ good; heading mono + body mono tier ≤ low.
10. **Scan performance** — Folder 2000+ font, scan ≤ 10 s. `max_entries` cap 10k default 2k — check banner khi đạt cap.

## 3. Kết quả mong đợi

- ✅ `scan_fonts` + `read_font` + 1 helper command register (3 command total).
- ✅ Stats khớp số file thực tế.
- ✅ VN detection chính xác: Arial = ✅, Webdings = ❌.
- ✅ Memory resident < 300 MB (lazy parse, chỉ extract name table + OS/2 khi scan).

## 4. Cleanup

- Data dir: **KHÔNG ghi file** → không cần xoá.

## 5. Platform-specific notes

- **Windows:** `C:\Windows\Fonts` là hardlink folder đặc biệt — `walkdir` đi qua được.
- **macOS:** `/System/Library/Fonts` + `/Library/Fonts` + `~/Library/Fonts`. ApFS case-sensitive flag cần test.
- **Linux:** `/usr/share/fonts` + `~/.local/share/fonts`. `.ttc` (collection) có ít font hơn Windows.

## 6. Giới hạn v1

- **FontFace preview CSS load:** chưa wire (dời 14.3.2.b) — v1 dùng system font render preview.
- **Install font từ app:** chưa plan (OS restriction).
- **Font pair sync với TrishDesign tokens:** chưa wire (dời Phase 14.5+).
- **WOFF/WOFF2 web font:** chưa parse (ttf-parser 0.20 chỉ hỗ trợ TrueType/OpenType binary).
- **Variable font axis (wght, wdth, opsz):** chưa expose ra UI — dời Phase 15+.

---

**Bug report format:** xem trishlauncher/TESTPLAN.md mục cuối.
