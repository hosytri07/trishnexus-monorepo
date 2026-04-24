# TESTPLAN — TrishImage

**Phase 14.5.3 · 2026-04-24** · Port dev 1430 / HMR 1431 · Identifier `vn.trishteam.image`

App chức năng: scan folder ảnh → đọc EXIF (`kamadak-exif` 0.5) + dimensions (`imagesize` 0.13) → group theo sự kiện (gap 8h) + aspect ratio + face bucket heuristic.

---

## 1. Tiền đề

- [ ] `pnpm qa:all` pass
- [ ] `cd apps-desktop/trishimage && cargo tauri dev` start OK
- [ ] Folder test có ≥ 30 ảnh (mix jpg/png/webp), chụp nhiều ngày khác nhau, có ảnh có GPS + EXIF DateTimeOriginal (từ smartphone)
- [ ] Ít nhất 1 ảnh panorama (ratio ≥ 2.0) + 1 ảnh portrait + 1 ảnh square

## 2. Smoke test

1. **Mở app** — Title "TrishImage", topbar "Chọn thư mục".
2. **Dev fallback** — Chưa chọn folder → UI hiện 24 ảnh giả chia 3 event (để QA browser mode).
3. **Pick folder** — Dialog → chọn folder ảnh test → scan qua `scan_images`.
4. **Stats sidebar:**
   - Total files
   - Total bytes
   - With EXIF DateTimeOriginal
   - With GPS
   - Elapsed ms (< 5 s cho 500 ảnh)
   - Errors
5. **Aspect pill filter** — 5 enum: `landscape / portrait / square / panorama / unknown`. Click `panorama` → chỉ hiện ảnh ratio ≥ 2.0 hoặc ≤ 0.5.
6. **Face bucket stats** — v1 `face_count` luôn None → tất cả ảnh bucket `unknown`. Stat panel hiển thị "100% unknown" (OK cho alpha).
7. **View toggle — Events** — Group theo sự kiện (gap 8h), mỗi event có label "YYYY-MM-DD (N ảnh)", sort chronological.
8. **View toggle — Faces** — Group theo face bucket (solo / pair / group / none / unknown). v1 chỉ có `unknown` bucket.
9. **View toggle — Tất cả** — Flat list, sort theo `taken_ms` desc.
10. **Aspect badge** — Mỗi thumbnail có badge placeholder theo aspect: ▭ landscape / ▯ portrait / ◻ square / ━ panorama. Chưa có thumbnail thật (dời sau).
11. **Max entries cap** — Folder có ≥ 200k ảnh → `walkdir` dừng ở 200k + banner "Đã đạt giới hạn".
12. **Hidden skip** — `.git`, `node_modules`, `$RECYCLE.BIN` không scan.

## 3. Kết quả mong đợi

- ✅ 1 Tauri command `scan_images` register.
- ✅ EXIF date extract đúng: ảnh từ iPhone chụp 2024-03-15 14:30 → `taken_ms` khớp.
- ✅ GPS detect đúng: ảnh có `GPSLatitude` tag → `has_gps=true`.
- ✅ Aspect classify đúng: panorama 2.5:1 → `panorama`; 4:3 → `landscape`; 9:16 → `portrait`.
- ✅ Event grouping đúng: 2 ảnh cách nhau 9h → 2 event khác nhau; 2 ảnh cách 2h → 1 event.
- ✅ Memory resident < 400 MB cho 1000 ảnh (chỉ đọc header, không decode pixel).

## 4. Cleanup

- Data dir: **KHÔNG ghi file** → không cần xoá.
- Folder ảnh không bị modify (chỉ đọc).

## 5. Platform-specific notes

- **Windows:** `.heic` (iPhone) đọc được header qua `imagesize` nhưng EXIF `kamadak-exif` có thể fail — check banner errors.
- **macOS:** HEIC hỗ trợ tốt hơn (native codec).
- **Linux:** Thiếu libheif → HEIC fallback `imagesize` unknown.

## 6. Giới hạn v1

- **Thumbnail real:** chưa render — dời 14.3.4.b.
- **Full-screen viewer:** chưa wire.
- **Face detection ONNX:** `face_count` luôn None — model wiring dời 14.3.4.b.
- **RAW (CR2 / NEF / ARW / DNG):** chưa support.
- **Remember folder:** chưa persistent — mở lại app phải pick lại.
- **Geo map view (GPS pin):** chưa wire — dời Phase 15+.
- **Duplicate detection (perceptual hash):** chưa wire.

---

**Bug report format:** xem trishlauncher/TESTPLAN.md mục cuối.
