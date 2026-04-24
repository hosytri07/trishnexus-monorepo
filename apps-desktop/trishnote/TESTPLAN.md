# TESTPLAN — TrishNote

**Phase 14.5.3 · 2026-04-24** · Port dev 1432 / HMR 1433 · Identifier `vn.trishteam.note`

App chức năng: ghi chú dự án / deadline / cá nhân với daily review (Spaced Repetition lite) + kanban 4 lane (inbox / active / waiting / done) + soft delete + tag.

App cần login → v1 alpha local-only, Firebase sync dời 14.4.1.b.

---

## 1. Tiền đề

- [ ] `pnpm qa:all` pass
- [ ] `cd apps-desktop/trishnote && cargo tauri dev` start OK
- [ ] Xoá data dir cũ (nếu có) để test fresh: Windows `%LocalAppData%\TrishTEAM\TrishNote\`, macOS `~/Library/Application Support/TrishTEAM/TrishNote/`, Linux `~/.local/share/TrishTEAM/TrishNote/`

## 2. Smoke test

1. **Mở app** — Title "TrishNote". Lần đầu: `default_store_location` trả về path → `load_notes` → file chưa có → return `created_empty=true` → seed `[]`. Sidebar hiển thị "0 notes".
2. **Dev fallback** — Ngoài Tauri (browser) UI show 5 seed notes demo (active/waiting/inbox/done).
3. **Note mới** — Click "+ Note mới" → ComposerModal → nhập title "Thử ghi chú" + body "Nội dung thử" + tag "test" + status `inbox` → Lưu → note xuất hiện trong list + auto-save (debounce 400 ms).
4. **File persist** — Mở `%LocalAppData%\TrishTEAM\TrishNote\notes.json` → JSON array có entry mới + `createdAt` + `updatedAt`.
5. **Sidebar filter** — Filter status pill (inbox/active/waiting/done/archived) + tag pill + search input. Gõ "ghi chú" → filter còn 1 note.
6. **Review mode** — Nút "Review hôm nay (N)" → ReviewModal xếp note chưa review hoặc stale ≥ 7 ngày. Click "Đã review" → `markReviewed` set `lastReviewedAt=now` → remove khỏi queue.
7. **Streak badge** — Sidebar hiển thị streak consecutive review days (UTC bucket). Review 3 ngày liên tiếp → "🔥 3 day streak".
8. **Kanban view** — Toggle List ↔ Kanban → 4 lane hiện ngang, mỗi lane status-colored border top.
9. **DnD** — Kéo note từ lane `inbox` → `active` (HTML5 DnD) → `moveNote` update status + updatedAt. Kéo sang `done` → thêm `lastReviewedAt=now`.
10. **Tag** — Thêm tag "deadline" vào note → filter tag pill "deadline" hiển thị trong sidebar.
11. **Soft delete** — Nút 🗑 → set `deletedAt=now` → note biến mất khỏi list nhưng file vẫn còn trong JSON (backward-compat).
12. **Export / Import JSON** — Topbar nút Xuất → dialog save → file `trishnote-backup-<date>.json`. Nút Nhập → dialog open → load file → overwrite hoặc merge (tuỳ chọn).
13. **Atomic save** — Trong lúc save (400 ms debounce), tắt ngang app → mở lại → file không bị corrupt (atomic rename `.json.tmp` → `.json`).
14. **Cap 10 MiB** — Thêm note có body > 10 MiB → `save_notes` reject → UI báo "Dữ liệu quá lớn".

## 3. Kết quả mong đợi

- ✅ 3 Tauri command register (`default_store_location`, `load_notes`, `save_notes`).
- ✅ APP_SUBDIR = "TrishNote" (kiểm qua `rust-audit.mjs`).
- ✅ Data dir Windows = `%LocalAppData%\TrishTEAM\TrishNote\notes.json`, đọc đúng.
- ✅ Memory resident < 150 MB cho 1000 notes.

## 4. Cleanup

- Data dir Windows: `%LocalAppData%\TrishTEAM\TrishNote\notes.json`
- Data dir macOS: `~/Library/Application Support/TrishTEAM/TrishNote/notes.json`
- Data dir Linux: `~/.local/share/TrishTEAM/TrishNote/notes.json`
- Xoá file để reset hoặc giữ backup trước khi test.

## 5. Platform-specific notes

- **Windows:** `dirs::data_local_dir()` trả `%LocalAppData%` — không cần roaming.
- **macOS:** trả `~/Library/Application Support/` — theo convention Apple.
- **Linux:** XDG_DATA_HOME fallback `~/.local/share/`.

## 6. Giới hạn v1

- **Firebase sync:** chưa wire (dời 14.4.1.b).
- **Push notification / Telegram reminder:** `dueAt` field có nhưng chưa wire trigger (dời 14.4.1.c).
- **Export PDF / Markdown:** chưa wire (dời 14.4.1.d).
- **Rich text editor:** v1 chỉ plain text + tag.
- **Attachment (ảnh / file):** chưa wire.
- **Encryption at rest:** chưa — dựa OS-level ACL.
- **Conflict resolution khi multi-device:** chưa cần vì chưa sync.

---

**Bug report format:** xem trishlauncher/TESTPLAN.md mục cuối.
