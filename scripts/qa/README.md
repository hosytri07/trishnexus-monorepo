# scripts/qa — Quality assurance preflight

**Phase 14.5.1 + 14.5.2 + 14.5.4 · 2026-04-24**

Gói kiểm tra offline cho ecosystem TrishTEAM trước khi Trí chạy
`cargo tauri dev` hoặc `tauri build` trên máy thật. Mục đích: bắt
config drift (port trùng, identifier sai, CSP hở, capability thừa,
tauri-build thiếu, icon file thiếu) càng sớm càng tốt — Rust build mất
vài phút, không nên để compile xong mới phát hiện hai app cùng port
1432 hay thiếu `icon.icns`.

4 script chính:

| Script | Mục đích | Thời gian |
|---|---|---|
| `doctor.mjs` | Preflight JS/TS/config (16 check) | ~0.5 s quick, ~60 s full |
| `rust-audit.mjs` | Audit Rust-side (Cargo, invoke_handler, icons, window) | ~0.3 s |
| `build-all.mjs` | Batch compile 10 app (cargo check + vite build, shared target dir) | ~13 s vite-only; ~20-25 phút lần đầu có cargo |
| `gen-icons.py` | Sinh icon set placeholder (PNG/ICO/ICNS) cho 10 app | ~5 s |

---

## Chạy

```bash
# Preflight nhanh (~0.5 s) — kiểm cấu hình + file layout, skip tsc/vitest
pnpm qa:doctor:quick
# hoặc: node scripts/qa/doctor.mjs --quick

# Preflight đầy đủ (~60 s) — kèm tsc 14 workspace + vitest core
pnpm qa:doctor
# hoặc: node scripts/qa/doctor.mjs

# Rust-side audit (~0.3 s)
pnpm qa:rust
# hoặc: node scripts/qa/rust-audit.mjs

# Chạy cả hai (quick doctor + rust-audit) — recommended preflight
pnpm qa:all

# Batch compile matrix — chạy cargo check + vite build 10 app với
# CARGO_TARGET_DIR share để tái dùng cache (lần đầu ~20-25 phút,
# rebuild vitedrift ~13 s). Báo matrix pass/fail kèm stderr tail.
pnpm qa:build-all                # cả cargo check + vite build
pnpm qa:build-all:vite           # chỉ vite build (nhanh ~13 s)
node scripts/qa/build-all.mjs --only=trishnote,trishfont    # chọn lọc
node scripts/qa/build-all.mjs --skip-cargo --json            # CI mode
node scripts/qa/build-all.mjs --skip-vite                    # chỉ rust

# Sinh icon set cho 10 app (chỉ chạy khi cần reset icon)
python3 scripts/qa/gen-icons.py                # all 10 apps
python3 scripts/qa/gen-icons.py trishdesign    # chỉ 1 app

# JSON cho CI
node scripts/qa/doctor.mjs --json > qa-doctor.json
node scripts/qa/rust-audit.mjs --json > qa-rust.json
```

Exit code: **0** = pass, **1** = có fail entry.

---

## Kiểm tra gì

| # | Check | Mô tả |
|---|-------|-------|
| 1 | `app.port` | Mỗi app có dev port đúng bảng canonical (1420/1422/…/1438). |
| 2 | `app.port.unique` | Không 2 app trùng dev port. |
| 3 | `app.hmr` | HMR port = dev + 1 (nếu khai báo riêng). |
| 4 | `app.hmr.unique` | Không 2 app trùng HMR port. |
| 5 | `app.identifier` | Tauri identifier đúng format `vn.trishteam.<app>`. |
| 6 | `app.identifier.unique` | Không 2 app trùng identifier. |
| 7 | `app.files` | Đủ 14 file bắt buộc: package.json, vite.config.ts, tsconfig.json, index.html, src/{main,App}.tsx, src/styles.css, README.md, src-tauri/{Cargo.toml, tauri.conf.json, build.rs, src/{main,lib}.rs, capabilities/default.json}. |
| 8 | `app.capabilities.forbidden` | Capability không chứa `shell:*` hoặc `http:*`. |
| 9 | `app.csp` | CSP (nếu có) không `'unsafe-eval'`, connect-src whitelist. |
| 10 | `app.scripts` | package.json có đủ `dev` / `typecheck` / `tauri:dev` / `tauri:build`. |
| 11 | `app.deps.core` | Dep `@trishteam/core` có khai báo. |
| 12 | `app.deps.react` | React major = 18. |
| 13 | `app.deps.vite` | Vite major = 5. |
| 14 | `app.deps.tauri-api` | `@tauri-apps/api` có khai báo. |
| 15 | `tsc` | Mỗi workspace `tsc --noEmit` EXIT=0. |
| 16 | `vitest` | `vitest run packages/core` pass (hiện tại 421 test). |

---

## Bảng port canonical

| App | Dev | HMR | Identifier |
|---|---|---|---|
| trishlauncher | 1420 | 1421 | vn.trishteam.launcher |
| trishcheck    | 1422 | 1423 | vn.trishteam.check    |
| trishclean    | 1424 | 1425 | vn.trishteam.clean    |
| trishfont     | 1426 | 1427 | vn.trishteam.font     |
| trishtype     | 1428 | 1429 | vn.trishteam.type     |
| trishimage    | 1430 | 1431 | vn.trishteam.image    |
| trishnote     | 1432 | 1433 | vn.trishteam.note     |
| trishlibrary  | 1434 | 1435 | vn.trishteam.library  |
| trishsearch   | 1436 | 1437 | vn.trishteam.search   |
| trishdesign   | 1438 | 1439 | vn.trishteam.design   |

Cần app mới → cấp tiếp **1440 / 1441** và update cả registry trong
`doctor.mjs`.

---

## Output mẫu

```
────────────────────────────────────────────────────────────────────────
 TrishTEAM QA doctor — Phase 14.5.1
────────────────────────────────────────────────────────────────────────
✅ [app.port] trishlauncher port=1420
✅ [app.hmr] trishlauncher hmr=1421
…
✅ [tsc] apps-desktop/trishdesign EXIT=0
✅ [vitest] 421 tests passed
────────────────────────────────────────────────────────────────────────
 Pass:  49    Warn: 0    Fail: 0
────────────────────────────────────────────────────────────────────────
```

Khi có fail, entry sẽ liệt kê dưới cùng với path rõ ràng để Trí đi
sửa — ví dụ `app.port: trishdesign: declared 1436, expected 1438`.

---

## `build-all.mjs` — Batch compile matrix

Chạy `cargo check --manifest-path src-tauri/Cargo.toml` + `vite build
--mode production` cho cả 10 app theo thứ tự port. Dùng một
`CARGO_TARGET_DIR` chung ở `<root>/target-desktop/` để tái dùng cache →
lần đầu ~20-25 phút (thay vì 50+ phút nếu mỗi app 1 target dir riêng),
rebuild incremental ~2-5 phút.

**Output:**

```
────────────────────────────────────────────────────────────────────────
 TrishTEAM build-all matrix — Phase 14.5.4
 Apps:  10
 Steps: cargo check · vite build
 CARGO_TARGET_DIR = /…/trishnexus-monorepo/target-desktop
────────────────────────────────────────────────────────────────────────

📦 trishlauncher
  → cargo check --manifest-path src-tauri/Cargo.toml
  ✅ cargo check · 182.4s · exit=0
  → vite build --mode production
  ✅ vite build  · 1.4s  · exit=0
…

────────────────────────────────────────────────────────────────────────
 Summary matrix
────────────────────────────────────────────────────────────────────────
APP              │ cargo check      │ vite build
─────────────────┼──────────────────┼───────────────
trishlauncher    │ ✅ 182.4s         │ ✅ 1.4s
trishcheck       │ ✅ 45.2s          │ ✅ 1.3s
…
────────────────────────────────────────────────────────────────────────
 Total: 20 pass, 0 fail · wall time ~N phút
────────────────────────────────────────────────────────────────────────
```

**Flag:**

| Flag | Ý nghĩa |
|---|---|
| `--only=app1,app2` | Chỉ chạy subset app (mặc định: tất cả 10). |
| `--skip-cargo` | Bỏ `cargo check`, chỉ vite build. |
| `--skip-vite` | Bỏ vite build, chỉ `cargo check`. |
| `--json` | Output JSON thay vì bảng text (CI dùng). |
| `--quiet` | Không stream stdout realtime (phù hợp CI). |

**Exit code:**
- `0` — 10 app đều pass cả 2 step
- `1` — có ít nhất 1 fail (matrix hiển thị app nào + stderr tail ≤4 KiB)
- `2` — prereq thiếu (cargo chưa cài, vite binary không tìm thấy)

**Thời gian** (Windows 11, Ryzen 7 5800H, SSD NVMe):
- `--skip-cargo` (chỉ vite): ~13 s cho 10 app
- Lần đầu có `cargo check`: ~18-22 phút (biên dịch Tauri + 10 crate bin)
- Rebuild incremental: ~3-5 phút

Lưu ý: `target-desktop/` share cho cargo cache ~3-5 GiB sau lần đầu,
không commit — đã có `.gitignore` ở root chặn.
