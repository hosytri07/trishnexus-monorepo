# TESTPLAN — TrishType

**Phase 14.5.3 · 2026-04-24** · Port dev 1428 / HMR 1429 · Identifier `vn.trishteam.type`

App chức năng: text editor với CRDT multi-caret — insert/delete converging đồng thời từ nhiều "caret ảo" trong cùng 1 document, sẵn sàng cho collab P2P ở phase sau.

---

## 1. Tiền đề

- [ ] `pnpm qa:all` pass
- [ ] `cd apps-desktop/trishtype && cargo tauri dev` start OK
- [ ] Chuẩn bị 1 file text mẫu `test.txt` ~1 KB, encoding UTF-8 (có tiếng Việt)

## 2. Smoke test

1. **Mở app** — Title "TrishType", editor rỗng hiện dev fallback sample text (≥ 5 dòng).
2. **Actor ID + caret ban đầu** — Sidebar hiển thị actor ID (random UUID) + 1 caret ở vị trí 0.
3. **Typing** — Click vào editor → type "Xin chào thế giới" → CRDT insert từng ký tự → visualChars render đúng, caret anchor theo dõi ký tự cuối cùng.
4. **Thêm caret** — Form "+ thêm caret tại index 5" → click add → có 2 caret blink đồng thời. Type "X" → chèn "X" tại cả 2 vị trí (cả caret 0 và 5).
5. **Remove caret** — Nút "×" cạnh caret 1 → xoá → còn 1 caret.
6. **Backspace** — Lùi caret → xoá ký tự trước caret (dùng `backspaceAtCarets`).
7. **Arrow keys** — ← / → move caret ±1 visible position; Home/End chưa wire (v1).
8. **Enter** — Chèn `\n`; Tab → chèn 2 spaces.
9. **Mở file** — Ctrl+O → `plugin-dialog` `open` → pick `test.txt` → file load vào editor, content VN hiển thị đúng diacritic.
10. **Lưu file** — Ctrl+S → nếu filepath có sẵn thì overwrite; Ctrl+Shift+S → save-as.
11. **Dirty flag** — Sau typing mà chưa save, sidebar hiện "● unsaved". Save xong → clear.
12. **File cap** — Thử mở file > 5 MiB → command `read_text_file` từ chối (cap 5 MiB) + UI báo lỗi.

## 3. Kết quả mong đợi

- ✅ 2 Tauri command register (`read_text_file` + `write_text_file`).
- ✅ CRDT convergence: thử 2 actor insert cạnh tranh cùng index (dùng button "simulate concurrent" nếu có) → kết quả giống nhau trên cả 2 replica.
- ✅ Type 500 ký tự liên tục vẫn mượt (không lag > 50 ms).
- ✅ Memory resident < 200 MB cho file 1 MB.

## 4. Cleanup

- Data dir: **KHÔNG ghi file** (data_dir="none") — file text Trí tự chọn nơi lưu.

## 5. Platform-specific notes

- **Windows:** line ending CRLF — đọc file CRLF xong save giữ nguyên CRLF (không auto-convert LF).
- **macOS:** line ending LF.
- **Linux:** line ending LF. Character input method (IBus / fcitx) cho tiếng Việt gõ Telex hoạt động bình thường.

## 6. Giới hạn v1

- **Selection range:** chưa có — chỉ có caret điểm (dời Phase 15+).
- **Undo / Redo:** chưa wire (v1 CRDT có sẵn state lineage nhưng chưa expose).
- **Copy / Paste CRDT binding:** chưa wire — paste sẽ dùng clipboard native, không qua CRDT op stream.
- **P2P sync / WebRTC:** chưa wire — CRDT chỉ local đa-caret, chưa cross-machine.
- **Syntax highlighting / Markdown preview:** chưa plan (dùng TrishNote nếu cần rich text).
- **Encoding detect (UTF-16 BOM / Windows-1258):** chỉ đọc UTF-8.

---

**Bug report format:** xem trishlauncher/TESTPLAN.md mục cuối.
