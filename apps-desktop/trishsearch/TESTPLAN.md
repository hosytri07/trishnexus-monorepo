# TESTPLAN — TrishSearch

**Phase 14.5.3 · 2026-04-24** · Port dev 1436 / HMR 1437 · Identifier `vn.trishteam.search`

App chức năng: full-text search BM25 trên 3 source đồng thời — notes (từ TrishNote JSON) + library (từ TrishLibrary JSON) + file text rời (scan folder). Tokenize VN diacritic fold + stopword + Porter stem lite.

App cần login → v1 alpha local-only, Firebase rerank dời 14.4.3.c.

---

## 1. Tiền đề

- [ ] `pnpm qa:all` pass
- [ ] `cd apps-desktop/trishsearch && cargo tauri dev` start OK
- [ ] Chuẩn bị: (a) `notes.json` export từ TrishNote, (b) `library.json` từ TrishLibrary, (c) folder text rời ≥ 20 file `.txt/.md/.html` có nội dung VN + EN
- [ ] Xoá `%LocalAppData%\TrishTEAM\TrishSearch\` để test fresh

## 2. Smoke test

1. **Mở app** — Title "TrishSearch", search-bar ở giữa, 4 source pill (Tất cả / Ghi chú / Thư viện / File rời) phía trên.
2. **Dev fallback** — Ngoài Tauri → 5 seed doc (2 note + 2 library + 2 file) auto-index.
3. **Nạp notes.json** — Topbar "Nạp notes.json" → dialog → pick file → `load_json_file` (cap 40 MiB) → parse JSON → adapter `noteToFulltextDoc` (skip deleted) → rebuild index. Status pill "Ghi chú N".
4. **Nạp library.json** — Tương tự, adapter `libraryDocToFulltextDoc` (body = authors·year·publisher·note).
5. **Scan folder text** — Nút "Scan folder text" → pick folder → `scan_text_folder` walk max_depth 24 cap 20k default 2k → whitelist 7 ext (txt/md/markdown/rst/org/html/htm/rtf) + truncate file ≥ 2 MiB lossy-utf8. Status pill "File rời N".
6. **Search "react hook"** — Trong search-bar → kết quả hit-list sort score desc. Expected: note/library có title "React hook" xếp cao nhất vì title weighted ×3.
7. **Phrase query** — `"react hook"` (quote) → chỉ match exact phrase → bonus ×1.4.
8. **Negate** — `react -native` → exclude docs chứa "native".
9. **Prefix** — `react*` → match `react`, `reactive`, `reactor`, ...
10. **Source prefix** — `note:typescript` → chỉ search trong source `note`. `library:tcvn` → chỉ library. `file:readme` → chỉ file rời.
11. **VN diacritic fold** — `ghi chu` (không dấu) → match "ghi chú" trong note.
12. **Stopword** — `the the the` → empty query (tất cả stopword).
13. **Recency boost** — 2 doc score BM25 bằng nhau nhưng doc A mtime 3 ngày trước, doc B 400 ngày → A xếp trên (HOT→1 / COLD→0, alpha 0.2).
14. **Hit detail pane** — Click 1 hit → source-tag + title + path + nút "Mở bằng OS" (plugin-opener) + score + matched terms + mtime + tags + body full.
15. **Snippet highlight** — Trong hit-list snippet có `<mark>` wrap matched terms, fold-insensitive, HTML escape anti-injection (`<>"'&`).
16. **Ctrl+K focus search** — Phím tắt focus search input.
17. **Esc clear** — Esc trong search-bar → clear query.
18. **Index stats sidebar** — totalDocs / totalTerms / avgDocLen / build_ms / search_ms / top 12 term df.
19. **Hint DSL** — Sidebar hiển thị cú pháp `"phrase"` / `-negate` / `prefix*` / `source:` để hướng dẫn user.
20. **Read text file** — Thử `read_text_file` 1 file HTML lớn ~3 MiB → truncate về 2 MiB + `truncated: true` flag.
21. **Scan cap** — Folder > 20k file → dừng ở 20k + `max_entries_reached: true`.

## 3. Kết quả mong đợi

- ✅ 4 Tauri command register (`default_store_location`, `load_json_file`, `read_text_file`, `scan_text_folder`).
- ✅ APP_SUBDIR = "TrishSearch".
- ✅ BM25 k1=1.2, b=0.75 — ranking khớp test case Vitest.
- ✅ Index in-memory: 5000 doc tổng body ~10 MB build < 2 s.
- ✅ Search < 50 ms cho query 2-3 term.
- ✅ Memory resident < 500 MB cho index 5000 doc.

## 4. Cleanup

- Data dir: `%LocalAppData%\TrishTEAM\TrishSearch\` (empty — app chỉ info env, không ghi gì).
- Cache: app KHÔNG persist index → restart phải re-load + re-scan.

## 5. Platform-specific notes

- **Windows:** Path `$RECYCLE.BIN` và `System Volume Information` skip đúng (is_hidden check).
- **macOS:** `.DS_Store` trong folder scan sẽ bị `is_hidden` filter (dot-prefix).
- **Linux:** Socket file / FIFO gặp trong scan sẽ bị `walkdir` skip — check errors list.

## 6. Giới hạn v1

- **Tantivy WASM (persistent index):** chưa wire — dời 14.4.3.b. Index hiện tại reset mỗi khi start app.
- **Firebase semantic rerank (cosine embedding):** chưa — dời 14.4.3.c. Code `@trishteam/core/search/cosine` đã có, chưa pipe.
- **PDF / DOCX text extract:** chưa — dời 14.4.3.d. File PDF không searchable v1.
- **Incremental mtime-diff index:** chưa — dời 14.4.3.e. Mỗi lần load phải rebuild full.
- **Pagination:** chưa — mặc định limit 60 hit.
- **Highlight trong detail-body (full):** chưa — chỉ trong snippet.
- **Suggest / autocomplete:** chưa wire.

---

**Bug report format:** xem trishlauncher/TESTPLAN.md mục cuối.
