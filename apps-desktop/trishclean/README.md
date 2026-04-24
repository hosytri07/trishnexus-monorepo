# TrishClean (Tauri 2)

Công cụ dọn dẹp file/cache với **staged delete + undo 7 ngày**: không
xoá thật ngay, mà move sang trash folder riêng và chỉ commit sau
retention window. User có thể restore trong vòng 7 ngày nếu lỡ tay.

## Kiến trúc tách domain

Phân loại logic chạy **ở TypeScript** (`@trishteam/core/clean`), không
ở Rust. Lý do:

- Test nhanh bằng Vitest (86/86 pass), không cần restart Tauri.
- Reusable: website / Zalo Mini App có thể dùng cùng logic classify
  với data export từ máy.
- Rust chỉ trả raw `ScanStats { entries, total_size_bytes, ... }` —
  chỉ đụng filesystem, không biết gì về category.

## Commands backend (Rust)

| Command | Mô tả | Trả về |
| ------- | ----- | ------ |
| `scan_dir(path, max_entries?, max_depth?)` | Walk filesystem qua `walkdir`, đọc metadata (không open content) | `ScanStats` |
| `app_version` | `CARGO_PKG_VERSION` | string |

Hard cap: `max_entries` clamp 100..200 000 (default 20 000),
`max_depth` clamp 1..32 (default 6). Truncate flag báo UI khi chạm
cap — tránh user pick nhầm `/` treo app.

## Classification rule (priority, first match)

1. `empty_dir` — thư mục size=0
2. `cache` — chứa `/cache/`, `/.cache/`, `/appdata/local/cache`
3. `temp` — chứa `/tmp/`, `/temp/`, `/appdata/local/temp/`, `/var/folders/`
4. `download` — chứa `/downloads/`
5. `recycle` — chứa `$recycle.bin`, `.trash`, `trash`
6. `large` — size ≥ 100 MB
7. `old` — chưa access ≥ 180 ngày
8. `other` — còn lại

Path normalize: `\\` → `/` + lowercase.

## Age buckets (summarize)

recent (0-7d) · month (7-30d) · quarter (30-90d) · year (90-365d) ·
ancient (>365d).

## Dev

```bash
# Từ repo root
pnpm install
cd apps-desktop/trishclean

pnpm dev            # UI only (browser) — dùng DEV_FALLBACK_SCAN seed
pnpm tauri:dev      # Full Tauri window với filesystem thật
pnpm tauri:build    # Bundle msi/dmg/deb
```

## Phase hiện tại — 14.3.1 alpha

- ✅ Scan filesystem (readonly metadata)
- ✅ UI hiển thị category + size breakdown
- ❌ Staged delete (planned 14.3.1.b)
- ❌ Commit after retention (planned 14.3.1.c)

Cho phase alpha hiện tại, TrishClean **chưa xoá gì cả** — chỉ scan
để user review. Staged delete + undo sẽ thêm trong phase kế.

## Privacy

- Scan đọc metadata (size, mtime, atime) — không open content.
- Không upload path hay file lên server.
- Dialog `pickDirectory` là built-in OS file picker (qua
  `@tauri-apps/plugin-dialog`) → user chủ động chọn folder, không
  phải Tauri tự quét.
