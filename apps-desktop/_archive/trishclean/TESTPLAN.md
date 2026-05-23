# TESTPLAN — TrishClean

**Phase 14.5.3 · 2026-04-24** · Port dev 1424 / HMR 1425 · Identifier `vn.trishteam.clean`

App chức năng: scan folder tìm file junk/cache/temp/old/large → hiển thị để user review + xoá (staged delete với undo 7 ngày — alpha v1 chỉ scan, delete để 14.3.1.b).

---

## 1. Tiền đề

- [ ] `pnpm qa:all` pass
- [ ] `cd apps-desktop/trishclean && cargo tauri dev` start OK
- [ ] Có sẵn 1 folder test có nhiều file (gợi ý: `~/Downloads` hoặc folder tạo script)
- [ ] **Folder test KHÔNG chứa file quan trọng** (app alpha chỉ scan nhưng tránh nhầm lẫn)

## 2. Smoke test

1. **Mở app** — Title "TrishClean", topbar có nút "Chọn thư mục".
2. **Pick folder** — Click "Chọn thư mục" → dialog `plugin-dialog` hiện → chọn `~/Downloads` → status "Đang quét… (N files)".
3. **Scan complete** — Hiển thị stats panel:
   - Total files / total bytes
   - Elapsed ms (< 3 s cho folder < 10k files)
   - Errors count (quyền truy cập)
4. **Category filter pills** — 9 category: `cache / temp / download / recycle / large / old / empty_dir / other`. Click 1 pill → filter file list.
5. **File list** — Sort desc theo size, hiển thị top 200 rows. Mỗi row có: path (truncate giữa), category badge, size formatted (MB/GB), last modified.
6. **Category logic check:**
   - File `.tmp` / `.bak` / `~` → category `temp`
   - File trong `AppData/Local/Temp` (Win) hoặc `~/.cache` → `cache`
   - File ≥ 100 MB → `large`
   - File mtime ≥ 180 ngày trước → `old`
   - Folder rỗng → `empty_dir`
7. **Max entries cap** — Nếu folder có ≥ 200k file, `walkdir` dừng ở 200k + hiển thị banner "Đã đạt giới hạn quét".
8. **Hidden folder skip** — `.git`, `node_modules` không xuất hiện trong kết quả.

## 3. Kết quả mong đợi

- ✅ Stats match với `dir /s` (Windows) hoặc `du -s` (Unix).
- ✅ 2 Tauri command register (`scan_dir` + 1 helper).
- ✅ Không ghi hay xoá file gì — alpha v1 **scan only**.
- ✅ Memory resident < 200 MB ngay cả khi kết quả có 200k rows (chỉ render top 200).

## 4. Cleanup

- Data dir: **KHÔNG ghi file** → không cần xoá.
- Folder scan không bị modify.

## 5. Platform-specific notes

- **Windows:** `%TEMP%`, `%LOCALAPPDATA%\Temp`, `$Recycle.Bin` detect đúng.
- **macOS:** `~/Library/Caches`, `/tmp`, `/var/folders/*/T` detect đúng. APFS snapshot không quét.
- **Linux:** `~/.cache`, `/tmp`, `/var/tmp` detect đúng. `~/.local/share/Trash` detect đúng.

## 6. Giới hạn v1

- **Staged delete:** chưa wire (dời 14.3.1.b) — v1 không xoá được.
- **Undo 7 ngày:** schema `StagedDelete` có `commit_after_ms` nhưng chưa có command `commit_delete` / `undo_delete`.
- **Cloud sync:** không plan.
- **Preview file trước khi xoá:** chưa wire (dời sau).
- **Duplicate file detection (SHA256):** chưa wire (dời Phase 15+).

---

**Bug report format:** xem trishlauncher/TESTPLAN.md mục cuối.
