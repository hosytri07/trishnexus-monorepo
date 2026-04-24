# TESTPLAN — TrishLauncher

**Phase 14.5.3 · 2026-04-24** · Port dev 1420 / HMR 1421 · Identifier `vn.trishteam.launcher`

Checklist click-through cho smoke test **thủ công trên máy thật** (Windows / macOS / Linux) trước khi ship v2.0.0-alpha. Trí ngồi máy, mỗi bước tick ✅ hoặc ghi lại bug.

---

## 1. Tiền đề

- [ ] `pnpm qa:all` pass (doctor 49/0/0 + rust-audit 24/0/0)
- [ ] Rust toolchain 1.77+, Tauri CLI 2.x
- [ ] `cd apps-desktop/trishlauncher && cargo tauri dev` start không lỗi compile
- [ ] Cửa sổ Tauri bật lên trong ≤ 30 s (lần đầu), ≤ 5 s (rebuild)
- [ ] Dev URL `http://localhost:1420` load React tree (DevTools F12 xem Console không error đỏ)

## 2. Smoke test (thứ tự bắt buộc)

1. **Splash / first render** — Window title = "TrishTEAM Launcher", size mặc định ≥ 960×640, có topbar + grid app.
2. **Grid 10 app hiển thị** — Mỗi card có icon (gradient theo theme — xem `gen-icons.py`), tên VN chính thức, tagline ngắn.
3. **Hover card** — Có transform/shadow hover hint (UX feedback), không flicker.
4. **TrishAdmin ẩn** — Card "TrishAdmin" **KHÔNG** xuất hiện (ẩn khỏi launcher theo matrix Auth trong ROADMAP).
5. **Click card "TrishNote"** — Nếu đã cài, mở app TrishNote; nếu chưa cài, hiển thị trang download / hướng dẫn install.
6. **Topbar search** (nếu có) — Gõ "note" → lọc card còn 1 card TrishNote.
7. **Footer / status** — Version v2.0.0-alpha.1, link GitHub `trishnexus-monorepo`.
8. **Close + re-open** — Đóng window, chạy lại `cargo tauri dev`, state load lại được (nếu có persistence).

## 3. Kết quả mong đợi

- ✅ Không có `console.error` ở DevTools khi load trang đầu.
- ✅ CPU idle < 2% sau khi render xong (sysinfo crate chạy lazy).
- ✅ Memory resident < 150 MB (baseline webview + React tree).
- ✅ Không request HTTP nào ra internet ở trạng thái offline (đóng WiFi → app vẫn render toàn bộ grid).

## 4. Cleanup sau test

- Data dir: launcher **KHÔNG ghi file** (`rust.data-dir` = `none`) → không cần xoá gì.
- Dev build cache: `apps-desktop/trishlauncher/src-tauri/target/` có thể xoá để reset rebuild.

## 5. Platform-specific notes

- **Windows:** `.ico` load đúng (icon góc trái window + taskbar). Tray icon (nếu wire) hiển thị đủ 16/32.
- **macOS:** `.icns` load đúng (Dock icon + Cmd+Tab switcher). Notarization chưa làm → Gatekeeper sẽ cảnh báo.
- **Linux:** `128x128.png` load đúng (titlebar GNOME/KDE). AppImage build chưa test ở phase này.

## 6. Giới hạn v1 (không test ở phase này)

- **Auto-update:** chưa wire — dời Phase 14.6.
- **Push notification từ TrishAdmin:** chưa wire — dời Phase 14.6.
- **Localization EN:** chỉ VN — dời sau v2.0.0-stable.
- **Keyboard shortcut (Cmd+K open app nhanh):** dời Phase 15+.

---

**Định dạng bug report (khi phát hiện lỗi):**

```
## BUG <yyyy-mm-dd> #<N>
- **Bước:** <số trong mục 2>
- **OS:** Windows 11 / macOS 14 / Ubuntu 24.04
- **Expected:** …
- **Actual:** …
- **Log / screenshot:** …
```

Sau khi ship tất cả bug fix → đánh dấu Phase 14.5.3 ✅ trong ROADMAP.
