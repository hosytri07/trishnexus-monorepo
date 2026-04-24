# TESTPLAN — TrishLibrary

**Phase 14.5.3 · 2026-04-24** · Port dev 1434 / HMR 1435 · Identifier `vn.trishteam.library`

App chức năng: quản lý thư viện PDF/docx/link — scan folder tài liệu → metadata (title/authors/year/publisher/tags/note/status) → tag auto-suggest + cite generator APA/IEEE.

App cần login → v1 alpha local-only, Firebase sync dời 14.4.2.c.

---

## 1. Tiền đề

- [ ] `pnpm qa:all` pass
- [ ] `cd apps-desktop/trishlibrary && cargo tauri dev` start OK
- [ ] Có folder test với ≥ 10 file PDF/DOCX/EPUB (gợi ý: ebook đã download, bài báo khoa học)
- [ ] Xoá `%LocalAppData%\TrishTEAM\TrishLibrary\library.json` để test fresh

## 2. Smoke test

1. **Mở app** — Title "TrishLibrary". Sidebar hiển thị "0 docs" (hoặc 6 seed nếu browser dev).
2. **Quét thư mục** — Topbar "Quét thư mục" → `plugin-dialog` → chọn folder tài liệu → `scan_library` qua `walkdir` 2 với whitelist 10 ext (pdf/docx/doc/epub/txt/md/html/rtf/odt/unknown).
3. **Scan result** — Stats: total docs / total bytes / byFormat / byStatus / elapsed_ms < 3 s cho 500 file.
4. **Merge policy** — Scan lại folder (sau đổi 1 file) → existing metadata title/authors/tags giữ nguyên, chỉ update `sizeBytes` + `mtimeMs`.
5. **Stable ID** — Check `doc_xxx` id (FNV-1a hash từ path) không đổi khi rescan.
6. **Sidebar filter** — Format pill (10 format) + Status pill (4 status: `unread/reading/done/abandoned`) + top tag pill + search.
7. **Search substring** — Gõ "react" → filter trên title+name+note+authors+tags.
8. **DocList sort** — Toggle recent / title (vi-locale) / size.
9. **DocRow** — Format chip + status-colored border-left + authors·year·size·status inline + tag row.
10. **Detail pane** — Click 1 doc → DetailPane editable:
   - title / authors csv / year / publisher / status pill / tag + AI suggest dashed tooltip `reason · score=X.YY` click-to-add
   - note textarea
   - nút "Mở file" → `plugin-opener` mở bằng app default OS (PDF → Adobe Reader / Preview)
   - nút "Xoá khỏi library" → hard delete
11. **Tag auto-suggest** — Path chứa "TCVN" → suggest tag "TCVN" score ~0.85. Path có "code" / "react" → suggest "code". Việt Nam Unicode chars → suggest "tiếng việt".
12. **Auto-save** — Sửa title → debounce 400 ms → file `library.json` update.
13. **Cite modal** — Topbar "Trích dẫn (N)" → modal pill APA ↔ IEEE toggle. APA: "Last, F. M., Last, F. M., & Last, F. M. (2024). *Title*. Publisher." IEEE: "[1] F. M. Last, F. M. Last, and F. M. Last, \"Title,\" 2024."
14. **Copy all** — Cite modal "Copy all" → clipboard chứa list `<ol>` numbered.
15. **et al. rule** — Có ≥ 8 author APA → "First, F. et al."; ≥ 7 author IEEE → "F. Last et al."
16. **Atomic save + cap 20 MiB** — Check file > 20 MiB reject, crash giữa save không corrupt.

## 3. Kết quả mong đợi

- ✅ 4 Tauri command register (`default_store_location`, `load_library`, `save_library`, `scan_library`).
- ✅ APP_SUBDIR = "TrishLibrary".
- ✅ AI tag suggest có score đúng theo weight matrix.
- ✅ Cite output đúng APA 7th + IEEE format.
- ✅ Memory < 200 MB cho 1000 doc.

## 4. Cleanup

- Data dir: `%LocalAppData%\TrishTEAM\TrishLibrary\library.json` (Windows), analog cho macOS/Linux.
- File tài liệu không bị modify (chỉ đọc metadata từ path/size/mtime — chưa đọc content).

## 5. Platform-specific notes

- **Windows:** path backslash normalize sang forward slash trong JSON (stable).
- **macOS:** Gatekeeper có thể chặn mở file lần đầu — Tauri `plugin-opener` sẽ trigger prompt.
- **Linux:** `xdg-open` làm default — PDF mở bằng Evince / Okular tuỳ DE.

## 6. Giới hạn v1

- **OCR content extract:** chưa wire (Tesseract dời 14.4.2.b) — search chỉ trên metadata.
- **Firebase sync:** chưa (14.4.2.c).
- **Cover thumbnail PDF:** chưa render — dời 14.4.2.d.
- **MLA / Chicago / TCVN 7115 citation style:** chưa — chỉ APA + IEEE.
- **Nested collection / folder:** không có — dùng tag để phân loại.
- **Full-text search:** không ở đây — dùng TrishSearch.
- **DOI / ISBN metadata auto-fetch:** chưa wire (cần network).

---

**Bug report format:** xem trishlauncher/TESTPLAN.md mục cuối.
