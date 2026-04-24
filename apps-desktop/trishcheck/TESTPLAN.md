# TESTPLAN — TrishCheck

**Phase 14.5.3 · 2026-04-24** · Port dev 1422 / HMR 1423 · Identifier `vn.trishteam.check`

App chức năng: đọc thông số phần cứng (CPU/RAM/disk/OS) qua `sysinfo` 0.30 + chạy benchmark ngắn để so sánh với yêu cầu app TrishTEAM khác.

---

## 1. Tiền đề

- [ ] `pnpm qa:all` pass
- [ ] `cd apps-desktop/trishcheck && cargo tauri dev` start OK
- [ ] DevTools Console sạch
- [ ] Quyền đọc `sysinfo` không cần admin

## 2. Smoke test

1. **Mở app** — Title "TrishCheck", status "Đang quét hệ thống…" 1-2 s.
2. **System info panel** — CPU name (ví dụ "AMD Ryzen 5 5600H"), số core logic + physical, RAM total (≥ 8 GB máy test), disk list có ít nhất 1 entry `C:\` (Windows) hoặc `/` (Unix) + mount point + fs.
3. **OS info** — Đúng name + version + kernel (`Windows 11 Pro 23H2` / `macOS 14.2.1` / `Ubuntu 24.04 LTS`).
4. **Benchmark button** (nếu có) — Click → chạy 2-5 s → trả về score CPU đơn luồng + đa luồng.
5. **Yêu cầu app check** — Drop-down chọn 1 trong 10 app (trishfont / trishdesign / …). Mỗi app có yêu cầu RAM/CPU tối thiểu → so sánh với máy user → hiển thị ✅ (đủ) hoặc ⚠️ (chưa đủ).
6. **Export report** — Nút "Xuất JSON" → file `trishcheck-report-<date>.json` chứa toàn bộ specs. Không chứa PII (hostname/username) trừ khi user opt-in.
7. **Refresh** — Nút "Quét lại" → re-run sysinfo, memory usage update trong real-time.

## 3. Kết quả mong đợi

- ✅ Reading từ `sysinfo` khớp với Task Manager (Windows) / `top` (Unix).
- ✅ 4 Tauri command (`get_system_info`, `run_benchmark`, `list_disks`, `export_report` hoặc tương đương) đều register đúng — `rust-audit.mjs` báo **4 command register**.
- ✅ Không có request HTTP — app 100% offline.
- ✅ Memory resident < 120 MB.

## 4. Cleanup

- Data dir: **KHÔNG ghi file** → không cần xoá.
- Export JSON nằm trong folder user chọn (mặc định Downloads) — tự dọn nếu cần.

## 5. Platform-specific notes

- **Windows:** `sysinfo` đọc WMI cho GPU name. Fallback nếu WMI timeout.
- **macOS:** `sysinfo` đọc `sysctl`. Apple Silicon (M1/M2/M3) đọc đúng tên chip.
- **Linux:** `sysinfo` đọc `/proc/cpuinfo` + `/proc/meminfo`. NVIDIA GPU cần driver để đọc đúng.

## 6. Giới hạn v1

- **GPU benchmark:** chỉ đọc name, chưa benchmark shader — dời Phase 15+.
- **Network speed test:** chưa wire (Phase 15+).
- **Battery health (laptop):** chưa wire — dời 14.6.
- **Monitor info (resolution/refresh rate):** chưa wire.

---

**Bug report format:** xem trishlauncher/TESTPLAN.md mục cuối.
