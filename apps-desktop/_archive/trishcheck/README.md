# TrishCheck (Tauri 2)

Công cụ benchmark + kiểm tra phần cứng để user biết máy có đủ sức
chạy ecosystem TrishTEAM hay không (đặc biệt TrishImage, TrishFont
render — là hai app nặng CPU/memory nhất).

Đây cũng là smoke test đầu tiên khi Trí port sang platform mới: nếu
TrishCheck build + chạy được trên Windows/macOS/Linux, stack Tauri 2
sẵn sàng cho 9 app còn lại.

## Commands backend (Rust)

| Command | Mô tả | Trả về |
| ------- | ----- | ------ |
| `sys_report` | OS/CPU/RAM/swap/uptime qua crate `sysinfo` | JSON object |
| `cpu_benchmark` | SHA-256 lặp trên buffer 50 MB × N vòng | MB/s + elapsed |
| `memory_bandwidth` | Copy 64 MB source → dest × N vòng | MB/s + elapsed |
| `app_version` | `CARGO_PKG_VERSION` | string |

Tất cả chạy single-thread để reproducible. Dependency Rust: `tauri`,
`sysinfo`, `sha2`, `serde`. Không dùng `rand` để giảm bundle.

## Scoring

`src/scoring.ts` map raw MB/s → tier (Excellent / Good / Ok / Low /
Very Low) với baseline năm 2026:

- CPU SHA-256: ≥700 MB/s = excellent, ≥400 = good, ≥250 = ok, ≥120 = low.
- Memory copy: ≥20 GB/s = excellent, ≥12 = good, ≥7 = ok, ≥3.5 = low.

## Dev

```bash
# Từ repo root
pnpm install
cd apps-desktop/trishcheck

pnpm dev            # UI only (browser, no Rust) — benchmark sẽ trả 0
pnpm tauri:dev      # Full Tauri window với bench thật
pnpm tauri:build    # Bundle msi/dmg/deb
```

## Privacy

Tất cả benchmark chạy local. Không gửi lên server. Không collect
hostname trừ khi user share kết quả qua TrishLauncher "Report" (Phase
14.2.3 — sau).
