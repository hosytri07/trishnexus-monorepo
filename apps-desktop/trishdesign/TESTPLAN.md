# TESTPLAN — TrishDesign

**Phase 14.5.3 · 2026-04-24** · Port dev 1438 / HMR 1439 · Identifier `vn.trishteam.design`

App chức năng: color palette + design token engine — nhập 1 hex base → AI suggest palette 4-scale (primary/secondary/accent/neutral) + status (success/warning/danger) + semantic token + harmony preview + contrast matrix + export CSS/Tailwind/Figma/SCSS/JSON.

App cần login → v1 alpha local-only, Firebase sync dời 14.4.4.b.

---

## 1. Tiền đề

- [ ] `pnpm qa:all` pass
- [ ] `cd apps-desktop/trishdesign && cargo tauri dev` start OK
- [ ] Data dir Windows `%LocalAppData%\TrishTEAM\TrishDesign\` (Tauri auto-isolate qua identifier `vn.trishteam.design`)
- [ ] Xoá data dir cũ nếu có

## 2. Smoke test

1. **Mở app** — Title "TrishDesign". Dev fallback chạy `suggestPalette('#7C3AED', 'light', 'Palette mẫu')` → UI load ngay palette violet mặc định.
2. **Statusbar** — Code data_dir hiển thị đúng đường dẫn OS. Alpha-chip "v1 alpha". Scale count = 4 (primary/secondary/accent/neutral). Swatch count = 4×11 = 44. AA+ count vs `#FFF`.
3. **Hex input + color picker sync** — Topbar input text "#7C3AED" và `<input type="color">` picker. Đổi picker → text update; gõ hex → picker update.
4. **Mode toggle** — Pill 3-way Sáng / Tối / Brand. Click `Tối` → semantic alias đổi: background=`neutral.950`, text=`neutral.50`, muted=`neutral.400`. Click `Brand` → background=`primary.50`, text=`primary.900`.
5. **Tên palette** — Đổi "Palette mẫu" → "Theme CNXD" → auto-save update JSON.
6. **Harmony strip** — 11 swatch gradient tính từ harmony tetradic + monochromatic preview (dưới topbar).
7. **Main palette grid** — 4 scale section, mỗi section:
   - Header có dot màu base + button "Set base" (chọn swatch nào làm base)
   - Swatch row 11 button grid với key (50/100/200/.../950) + hex + fg auto-pick black hoặc white theo contrast tốt nhất
   - Hover swatch → translate-Y(-2px)
   - Active swatch → outline accent
8. **Click swatch** — Detail pane bên phải hiển thị:
   - Big swatch preview với hex + rating vs `#FFF` (AAA/AA/AA-large/fail) + vs `#000`
   - Contrast matrix 11×11 mini-table (bg=col, fg=row, ratio + ✓/✓✓ marker)
   - Export dropdown 5-format + Copy button + export-preview pre-wrap scrollable 280 px max-height
9. **Contrast rating sanity** — Swatch `primary.500` vs `#FFF`:
   - Nếu hex là violet `#7C3AED` → ratio ~5.9 → AA (không AAA)
   - Rating chuẩn: ≥ 7 AAA, ≥ 4.5 AA, ≥ 3 AA-large, else fail
10. **Export CSS** — Dropdown "CSS" → preview `:root { --color-primary-500: #7C3AED; --spacing-4: 1rem; ... }`. Copy → clipboard.
11. **Export Tailwind** — Dropdown "Tailwind" → preview `module.exports = { theme: { extend: { colors: { primary: { ... } } } } }`.
12. **Export Figma Tokens** — Dropdown "Figma" → W3C Tokens Studio JSON format `{ "primary": { "50": { "value": "#...", "type": "color" } } }`.
13. **Export SCSS** — `$primary: ("50": #..., ..., "950": #...); $semantic: (...)`.
14. **Export JSON (scale)** — Object `{ "50": "#...", ..., "950": "#..." }`.
15. **Semantic alias sidebar** — Table 2-col code → value. `background.default` / `text.default` / `border.subtle` / `primary.hover` etc.
16. **AI notes sidebar** — Bullet list tiếng Việt giải thích harmony tetradic + Why chose this palette.
17. **Scale switch** — Click `accent` trong sidebar → highlight + palette grid scroll xuống.
18. **Lưu JSON** — Topbar "Lưu JSON" → `plugin-dialog` save → file `design-tokens.json` → call `save_design_file(path, payload)` cap 8 MiB + validate JSON + atomic write `.tmp-tsn` → rename.
19. **Nạp JSON** — Topbar "Nạp JSON" → `load_design_file(path)` cap 8 MiB + utf-8 + JSON validate → parse DesignTokenSet → load vào UI.
20. **Picker folder** — `default_store_location` → `plugin-opener` `open-path` mở File Explorer / Finder tại folder đó.
21. **Invalid JSON** — Thử load file rác (không JSON) → backend reject + UI báo lỗi.
22. **Cap 8 MiB** — Thử save > 8 MiB → reject.
23. **Schema validation** — `validateTokenSet` chặn khi id empty / name empty / hex format sai / semantic alias trỏ tới scale/key không tồn tại.

## 3. Kết quả mong đợi

- ✅ 3 Tauri command register (`default_store_location`, `load_design_file`, `save_design_file`).
- ✅ Data dir Tauri auto-isolate qua identifier — không cần APP_SUBDIR.
- ✅ Vitest core 421/421 pass (bao gồm 75 test TrishDesign).
- ✅ Harmony tetradic 4 màu cách 90° HSL đúng.
- ✅ Contrast WCAG relativeLuminance coef 0.2126/0.7152/0.0722 khớp.
- ✅ Memory resident < 200 MB cho palette 4-scale × 11 swatch.

## 4. Cleanup

- Data dir: `%LocalAppData%\TrishTEAM\TrishDesign\` — app chỉ info env, save file Trí tự chọn nơi.
- File JSON tự delete khi không cần.

## 5. Platform-specific notes

- **Windows:** Atomic write dùng `rename(tmp, dest)` — NTFS hỗ trợ (không cần `MoveFileEx`).
- **macOS:** `rename(2)` là atomic trên HFS+ và APFS.
- **Linux:** `rename(2)` atomic POSIX-guaranteed.

## 6. Giới hạn v1

- **Sync cross-device (Firebase):** chưa — dời 14.4.4.b.
- **Version diff (2 version palette):** chưa — dời 14.4.4.c.
- **Import ASE (Adobe) / Sketch palette:** chưa — dời 14.4.4.d.
- **OKLCH / display-p3 gam rộng:** chưa — dời 14.4.4.e.
- **Component preview HTML:** chưa — chỉ có palette preview.
- **Contrast matrix cross-scale:** chỉ trong 1 scale (primary×primary) — chưa primary×neutral.
- **`suggestPalette` multi-base:** chỉ 1 base — chưa hỗ trợ pin 2-3 màu cố định.
- **Color-blind simulator (deuter/protan/tritan):** chưa — dời Phase 14.5+.
- **Font pairing tích hợp với TrishFont:** chưa — dời Phase 14.5+.

---

**Bug report format:** xem trishlauncher/TESTPLAN.md mục cuối.
