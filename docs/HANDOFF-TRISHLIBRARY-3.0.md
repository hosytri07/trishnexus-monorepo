# Handoff TỔNG — TrishNexus Monorepo (Phase 14 → 18.5)

**Ngày cập nhật:** 2026-04-27 (rev2 — sau Phase 18.5)
**Session trước:** Phase 18.5 — UX polish cho TrishLibrary 3.0 (per-user data + card grid + nhỏ dashboard + gộp PDF Tools)
**User:** Trí (hosytri77@gmail.com) — không phải dev, giải thích đơn giản, **luôn dùng tiếng Việt**
**Repo chính:** `hosytri07/trishnexus-monorepo` (sync GitHub giữa 2 máy nhà ↔ cơ quan)
**Domain:** `trishteam.io.vn` (Vercel + Tenten DNS)

---

## ⚡ TÓM TẮT SIÊU NHANH

Hệ sinh thái **TrishTEAM** gồm **TrishLauncher (hub) + 8 app con**, deploy qua GitHub Releases + website Vercel. **TrishLibrary 3.0** đã code + UX polish xong (Phase 18.5). User confirm "app đã xong rồi" → chuyển Phase 18.6 = build production + GitHub Release `trishlibrary-v3.0.0`.

### 🔴 PICK UP TỪ ĐÂY

App đã pass test runtime. Đang vào **Phase 18.6 (Build + Release v3.0.0)**:
1. Bump version trong `package.json` + `tauri.conf.json` + `Cargo.toml` về `3.0.0`
2. Trí chạy `pnpm tauri build` ở `apps-desktop/trishlibrary/` → tạo .msi + .exe
3. Cập nhật `apps-registry.json` trên website (URL release + sha256)
4. Push tag `trishlibrary-v3.0.0` + upload artifacts lên GitHub Releases
5. Update website footer X/Y phần mềm đã phát hành

---

## 🗺 LỘ TRÌNH PHASE 14 → 18 (NGẮN GỌN)

### Phase 14 — TrishLauncher v2.0.0-1 ✅ RELEASED
- Tauri 2 desktop hub fetch registry từ `trishteam.io.vn/apps-registry.json`
- Tray icon + auto-update scheduler (off/daily/weekly) + multi-language NSIS (en/vi)
- Custom domain `trishteam.io.vn` qua Vercel + Tenten DNS
- Website `/downloads` page với OS detect
- GitHub Release `launcher-v2.0.0-1` (.exe 5.3MB + 2 .msi 3.4MB)
- Footer launcher hiện "X/9 phần mềm đã phát hành"

### Phase 15 — 3 app con đầu tiên ✅ RELEASED
- **15.0 TrishCheck v2.0.0-1** — System checker (CPU/RAM/Disk bench + GPU detect + battery + top 5 processes + min-spec compare 25 software từ remote JSON)
- **15.1 TrishFont v2.0.0-1** — Quản lý font VN + AutoCAD .shx + Fontpack remote downloader (manifest + zip + SHA256 verify), system-wide install HKLM
- **15.2 TrishLibrary v2.0.0-1** — Quản lý tài liệu (scan folder + table 5 cột + QR auto-gen + Online Library section + PDF preview iframe)

### Phase 16 — Firebase Auth + paid-tier 2-way sync ✅ DONE
- Firebase project `trishteam-17c2d` (asia-southeast1) — 4 roles: admin/user/trial/guest
- `packages/auth` shared (Firebase Auth wrapper + React provider + auto-create Firestore doc role='trial')
- Website login + profile + activate key flow (16-char XXXX-XXXX-XXXX-XXXX) + Admin Keys Panel
- **TrishLibrary v2.1.0** wired Firebase: per-UID local file `library.{uid}.json` + sync 2-way `users/{uid}/trishlibrary/online_folders` + read-only TrishTEAM section khi !isAdmin + TrialBlockedScreen
- Phase 16.4 (rollout Auth tới TrishCheck/TrishFont/TrishLauncher) — **DEFERRED**

### Phase 17 — 5 app mới ✅ ALL DONE/RELEASED
- **17.1 TrishClean** — System cleaner với undo 7 ngày
- **17.2 TrishNote** — Rich text note + pinned + deadline highlight + Trash bin + system fonts
- **17.3 TrishSearch** — Full-text BM25 offline (Tantivy) + PDF/DOCX/XLSX extractors + Tesseract OCR + PDFium render
- **17.5 TrishImage** — Photo manager (3-col + 5 view modes + thumbnail + video support + rename + note + similar photos)
- **17.6 TrishType** — Markdown editor (Monaco + tabs + file tree + split preview) — login required, build pending

### Phase 18 — TrishLibrary 3.0 (gộp 4 module) ✅ CODE DONE
- Gộp **TrishLibrary + TrishNote + TrishDoc + TrishImage** thành 1 app v3.0.0
- 4 module: 📚 Thư viện · 📝 Ghi chú · 📄 Tài liệu · 🖼 Ảnh
- Cross-module: Ctrl+K · Ctrl+/ · 🗒 Sticky · 💾 Backup + Auto-backup
- Đã fix 7 lỗi cargo compile (printpdf smask + tantivy as_str + lopdf borrow checker)

### Phase 18.5 — UX polish + per-user data ✅ DONE
**18.5.a — Bỏ duplicate user panel**
- `App.tsx` (Library module): bỏ `<UserPanel>` + version-badge ở topbar inner — đã có ở AppShell ngoài cùng.

**18.5.b — Per-user data isolation**
- **Image module** (`modules/image/tauri-bridge.ts`): `loadImageStore(uid)` / `saveImageStore(store, uid)` → key `trishlibrary.image.store.v1::{uid}` + migration legacy.
- **Library annotations** (`components/AnnotationModal.tsx`): per-UID key `trishlibrary.annotations.v1::{uid}` + migration. `DetailPanel` + `exportFileBundle` nhận uid.
- **Library reading meta** (`components/LibraryDashboard.tsx`): per-UID key `trishlibrary.lib_meta.v1::{uid}` + migration. `recordFileOpened(path, uid)` được gọi với uid.
- **Document module** (`modules/document/DocumentModule.tsx`): tabs in-memory + clear khi uid đổi (login/logout/switch).
- **Note module**: đã per-UID từ Phase 18.2 (file `notes.{uid}.json`). Giữ nguyên.
- **Library file list**: vẫn per-UID qua Rust `library.{uid}.json`. **TrishTEAM admin shared** vẫn read-only qua Firestore subscribe.

**18.5.c — Thu nhỏ Bảng điều khiển**
- `components/LibraryDashboard.tsx` + `styles.css`: padding 16→8px, icon 26→18px, strong 18→14px, reading col min-h 100→50px, recently viewed limit 10→5, starred 12→6. Card chiếm ~40% chiều cao so với trước → file list hiện được nhiều hơn.

**18.5.d — Gộp PDF Tools + File Convert thành 1 card grid**
- `modules/document/DocConvertPanel.tsx`: rewrite — bỏ 2 sub-sub-tab + bỏ layout 2-section. Render 1 unified card grid:
  - 1 thẻ "📑 Chuyển đổi định dạng" (highlighted accent border + label "⇄ Chuyển đổi") → click mở `FileConvertModal`.
  - 13 thẻ PDF Tools (qua `<PdfTools variant="grid-only">`) → click mở modal riêng.
- `modules/document/PdfTools.tsx`: thêm prop `variant?: 'full' | 'grid-only'`. Khi `grid-only` → render chỉ 13 card (không header/wrapper).
- `styles.css`: thêm `.doc-convert-grid`, `.doc-convert-grid-head`, `.doc-convert-tools-grid` (responsive auto-fill 320px), `.doc-convert-file-card` (accent badge), `.convert-tips-details` (collapsible tips trong modal).
- Card size 1.5x: padding 22px, icon 42px, title 17px, min-height 96px, gap 14px, min-w 320px.

---

## 🎯 CURRENT FOCUS — PHASE 18 (CHI TIẾT)

---

## 📦 4 MODULE TRONG TRISHLIBRARY 3.0

### 📚 Thư viện
- Scan folder + dashboard (stats + recently viewed + 3-col reading list)
- **Tantivy 0.22 full-text search** + pdf-extract cho PDF text
- Hỗ trợ **LAN/UNC paths** (mạng nội bộ)
- 3 scopes: Cá nhân / TrishTEAM / Online links
- **Annotation** per-file (highlight/note/question/todo) — localStorage
- **Export bundle** JSON (file metadata + annotations + related notes)

### 📝 Ghi chú
- TipTap editor (StarterKit + 17 extensions)
- Folders + tasks + tags
- **Daily note** (Ctrl+Shift+D)
- **Backlinks panel** + wiki-link `[[note title]]`
- **10 templates**: meeting/daily/kickoff/weekly/decision/brainstorm/todo/okr/1-on-1/bug
- **Sticky note widget** (floating draggable panel + auto-save draft)
- **HTML export** (standalone với inline CSS + dark mode media query)
- **Stats modal**: 8 cards + top 30 word frequency + 7 active days + longest note

### 📄 Tài liệu
- TipTap multi-tab editor + 22 templates (báo cáo/biên bản/hợp đồng…)
- **DocOutlineSidebar** LEFT 240px với active heading highlight
- **13 PDF tools**: info / merge / split / extract / delete / rotate / images-to-pdf / watermark / page-numbers / encrypt (qpdf) / decrypt / OCR (tesseract) / extract-images
- **Auto ToC** / Copy outline / Math wrap / Timestamp
- **Focus mode** (Ctrl+Shift+F) — ẩn outline + properties

### 🖼 Ảnh
- 5 view modes (grid/list/details/medium/large)
- **Thumbnail cache Rust** (resize 240px JPEG q75 + disk cache + atomic tmp+rename)
- **Progress bar preload** (X/Y % + filename + Cancel) — fix crash 186 JPGs
- **LAN folder support** (UNC \\\\server\\share)
- **Logical rename** (đổi tên hiển thị, không đổi tên file thực)
- **Bulk select + batch rename pattern** ({n}, {n:3}, {date}, {datetime}, {folder}, {orig}, {ext})
- **Keyboard navigation** (←→↑↓ + Enter mở lightbox)
- **EXIF metadata viewer** (kamadak-exif) + GPS parser
- **Lightbox fullscreen** (prev/next, autoplay 3s, F fit, +/- zoom 25-400%)

### 🔍 Cross-module
- **Ctrl+K** global search across 4 module (qua localStorage mirror pattern)
- **Ctrl+/** shortcuts help (7 group + filter realtime)
- **🗒 Sticky note** quick capture (Ctrl+Shift+N)
- **💾 Backup + Restore** single JSON file
- **Auto-backup periodic** (1/6/24h interval)
- **Module bus** CustomEvent + localStorage hint pattern (Library/Image → Note)

---

## 🛠 TECH STACK

- **Tauri 2** (Rust + React/TypeScript)
- **Vietnamese i18n** (VI + EN dictionaries)
- **Firebase Auth + Firestore** (paid + admin only)
- **Tantivy 0.22** + pdf-extract cho text search
- **lopdf 0.34** (PDF manipulation)
- **printpdf 0.6** ⚠ (PINNED — 0.7 có breaking changes ImageXObject API)
- **kamadak-exif 0.5** (EXIF)
- **image 0.25** (thumbnail)
- **qpdf** subprocess (PDF AES-256 encrypt/decrypt)
- **tesseract** subprocess (OCR scanned PDF)
- **IntersectionObserver** lazy mount
- **convertFileSrc** asset protocol cho Tauri

---

## 📁 FILE QUAN TRỌNG (đường dẫn tương đối từ `apps-desktop/trishlibrary/`)

### Rust backend
- `src-tauri/Cargo.toml` — deps: image 0.25 / lopdf 0.34 / printpdf 0.6 / pdf-extract 0.7 / kamadak-exif 0.5 / tantivy 0.22
- `src-tauri/src/lib.rs` — ~25 commands: list_image_files / get_thumbnail / pdf_info / pdf_merge / pdf_split / pdf_extract_pages / pdf_delete_pages / pdf_rotate_pages / images_to_pdf / pdf_add_watermark / pdf_add_page_numbers / check_qpdf / check_tesseract / pdf_set_password / pdf_remove_password / pdf_ocr / pdf_extract_images / read_image_exif / library_index_build / library_search / library_index_status / library_index_clear / copy_file / check_folder_exists

### Frontend
- `src/AppShell.tsx` — wired Ctrl+K, Ctrl+/, Ctrl+Shift+N/F, auto-backup interval 5min
- `src/lib/backup.ts` — buildBackupBundle / restoreBackup / runAutoBackupIfDue
- `src/lib/module-bus.ts` — requestSwitchModule / requestCreateNoteAbout / requestLibrarySearch / requestOpenImage
- `src/components/GlobalSearchModal.tsx` — Ctrl+K
- `src/components/ShortcutsHelpModal.tsx` — Ctrl+/
- `src/components/BackupModal.tsx` — 4 mode: menu/backup/restore-confirm/auto
- `src/components/StickyNotePanel.tsx` — floating panel
- `src/components/AnnotationModal.tsx` — per-file annotation
- `src/components/LibraryDashboard.tsx` — stats + reading list
- `src/components/LibrarySearchModal.tsx` — Tantivy search
- `src/components/DetailPanel.tsx` — 📝 Note / 📝 Chú thích / 📦 Export bundle
- `src/modules/image/ImageModule.tsx` — 3-col + 5 view + LazyThumbTile
- `src/modules/image/ImageLightbox.tsx`
- `src/modules/image/BatchRenameModal.tsx`
- `src/modules/image/tauri-bridge.ts` — getThumbnail queue MAX_PARALLEL=6 / preloadThumbnails với progress
- `src/modules/note/NoteModule.tsx` — daily / backlinks / 10 templates / sticky / HTML export / stats
- `src/modules/note/note-templates.ts`
- `src/modules/note/NoteTemplatePicker.tsx`
- `src/modules/note/note-html-export.ts` — exportNoteToHtml + STYLES const
- `src/modules/note/NoteStatsModal.tsx` — VI_EN_STOPWORDS Set 110+ từ
- `src/modules/document/PdfTools.tsx` — 13 tool modal
- `src/modules/document/DocumentModule.tsx` — focus mode + default format dropdown
- `src/modules/document/DocEditorPanel.tsx` — DocOutlineSidebar + ToC/Copy/Math/Timestamp
- `src/styles.css` — ~1500+ dòng cho components mới

---

## 🩹 LỖI ĐÃ FIX (cuối session 2026-04-27)

User chạy `pnpm tauri dev` → cargo báo 7 lỗi compile. Đã fix:

1. **E0560** `ImageXObject has no field smask` (line 1175)
   - Xóa `smask: None,` — printpdf 0.6 không có field này

2. **E0599** × 4 lỗi `as_str() not found for &OwnedValue` (line 2013/2018/2023/2028)
   - Thêm `use tantivy::schema::Value;` trong fn `library_search` (line 1975)

3. **E0502** × 2 borrow conflict (line 1376, 1503)
   - Watermark + page-numbers function: tách thành 2 phase
     - **Phase 1**: đọc Resources qua `doc.get_object(...)` (immutable, drop sau clone)
     - **Phase 2**: mutate page_dict qua `doc.get_object_mut(...)`
   - Trước đó: gọi `doc.get_object(rid)` BÊN TRONG block đang giữ `page_dict` mutable → conflict

---

## 🔥 GOTCHAS & PATTERN CẦN NHỚ

- **`Test chạy app chứ ko phải build`** — User dặn rõ. Chạy `pnpm tauri dev` để test, không `pnpm tauri build`.
- **Memory crash 186 JPGs** đã fix bằng: thumbnail cache Rust + IntersectionObserver lazy mount + concurrency queue MAX_PARALLEL=6 + progress bar preload
- **Cross-module communication**: dùng `module-bus.ts` CustomEvent + localStorage hint, KHÔNG ref trực tiếp
- **PDF encrypt/OCR**: shell out qpdf/tesseract subprocess + check_qpdf/check_tesseract trước khi gọi (báo install hint nếu thiếu)
- **Library annotation**: pure frontend localStorage `trishlibrary.annotations.v1` — không lưu Rust
- **Library export bundle**: scan note store tìm reference theo tên/path, không cần explicit link
- **Bash truncate vs Read** khác nhau — luôn tin Read tool, không tin bash `wc -l`
- **printpdf 0.6 PIN** — 0.7 đổi API ImageXObject + add_to_layer breaking
- **lopdf encryption** không dùng — shell ra qpdf reliable hơn (AES-256)

---

## 🎯 NEXT STEPS — PHASE 18.6 BUILD + RELEASE

1. **Bump version** về `3.0.0`:
   - `apps-desktop/trishlibrary/package.json` → `"version": "3.0.0"`
   - `apps-desktop/trishlibrary/src-tauri/tauri.conf.json` → `version: "3.0.0"`
   - `apps-desktop/trishlibrary/src-tauri/Cargo.toml` → `version = "3.0.0"`
2. **Build production** (Trí chạy trên Windows):
   ```
   cd apps-desktop/trishlibrary
   pnpm tauri build
   ```
   → output: `src-tauri/target/release/bundle/msi/*.msi` + `nsis/*.exe`
3. **Compute SHA256** của file .msi/.exe (PowerShell `Get-FileHash`)
4. **Update `apps-registry.json`** trong website + `min-specs.json` nếu cần
5. **Push tag** `trishlibrary-v3.0.0` lên GitHub + upload .msi + .exe lên Release
6. **Update Launcher footer** sẽ tự refetch registry → "X/9 phần mềm"

## 🎯 SAU KHI RELEASE V3.0.0

- **Phase 17.6**: Build TrishType v2.0.0-1 (Markdown editor, code xong, build pending)
- **Phase 16.4 (deferred)**: Roll out Auth Firebase tới TrishCheck/TrishFont/TrishLauncher với TrialBlockedScreen format
- **Phase 17.4**: Scaffold TrishDesign (chưa có)

---

## 🗒 LỆNH VẶT

```bash
# Test app dev mode
cd apps-desktop/trishlibrary
pnpm tauri dev

# Type check frontend riêng
pnpm tsc --noEmit

# Cargo check riêng (chỉ type-check Rust, không build full)
cd src-tauri
cargo check

# Khi cần chỗ qpdf/tesseract:
# qpdf: https://github.com/qpdf/qpdf/releases (Windows binary)
# tesseract: https://github.com/UB-Mannheim/tesseract/wiki (Windows installer)
```

---

## 📊 TIẾN ĐỘ TỔNG

- ✅ Phase 14 — TrishLauncher v2.0.0-1 (registry + tray + custom domain trishteam.io.vn)
- ✅ Phase 15 — TrishCheck + TrishFont + TrishLibrary v2.0.0-1 (released GitHub)
- ✅ Phase 16 — Firebase Auth + TrishLibrary v2.1.0 sync 2-way (admin scan đã fix)
- ✅ Phase 17 — TrishClean + TrishNote + TrishSearch + TrishImage v2.0.0-1 (released)
- ⏳ Phase 17.6 — TrishType v2.0.0-1 build/release pending
- ✅ Phase 18 — TrishLibrary 3.0 (gộp 4 module + cross-features) — code done
- ✅ Phase 18.5 — UX polish + per-user data (4 fix sau test) — **DONE 2026-04-27**
- ⏳ Phase 18.6 — Build + GitHub Release `trishlibrary-v3.0.0` — **đang làm**
- ⏳ Phase 16.4 — Roll out Auth tới TrishCheck/TrishFont/TrishLauncher (deferred)
- ⏳ Phase 17.4 — TrishDesign (chưa scaffold)

---

## 📦 APP ĐÃ RELEASE (TÍNH ĐẾN 2026-04-27)

| App | Version | Status | GitHub Release Tag |
|---|---|---|---|
| TrishLauncher | 2.0.0-1 | ✅ released (alpha) | `launcher-v2.0.0-1` |
| TrishCheck | 2.0.0-1 | ✅ released | `trishcheck-v2.0.0-1` |
| TrishFont | 2.0.0-1 | ✅ released | `trishfont-v2.0.0-1` |
| TrishLibrary | 2.1.0 | ✅ released (Auth) | sau Phase 16.2.c |
| TrishClean | 2.0.0-1 | ✅ released | `trishclean-v2.0.0-1` |
| TrishNote | 2.0.0-1 | ✅ released | `trishnote-v2.0.0-1` |
| TrishSearch | 2.0.0-1 | ✅ released (full Layer 1-4) | `trishsearch-v2.0.0-1` |
| TrishImage | 2.0.0-1 | ✅ released | `trishimage-v2.0.0-1` |
| TrishType | 2.0.0-alpha | ⏳ build pending | — |
| TrishLibrary 3.0 | 3.0.0 | ⏳ test pending | — |
| TrishDesign | — | ⏳ chưa scaffold | — |

Footer launcher hiện: **X/9 phần mềm đã phát hành** (auto-count từ `apps-registry.json`).

---

## 🔗 LIÊN KẾT QUAN TRỌNG

- Repo: https://github.com/hosytri07/trishnexus-monorepo
- Website: https://trishteam.io.vn
- Registry JSON: https://trishteam.io.vn/apps-registry.json
- Min-specs JSON: https://trishteam.io.vn/min-specs.json
- Firebase Console: project `trishteam-17c2d` (asia-southeast1)
- Admin email: trishteam.official@gmail.com (UID `YiJa3yRtQmM5sSK8vqgTC4Zfzex2`)

---

## 📚 LỊCH SỬ CHI TIẾT (PHASE 14-16)

Xem file `docs/SESSION-HANDOFF.md` (835 dòng) — chứa toàn bộ chi tiết Phase 14.5 → 16.2 với code snippets, file paths, build configs, SHA256 checksums, gotchas. File này là **historical record** không update nữa, chỉ giữ làm reference.

Nếu Phase 17/18 cần debug ngược về dependency cũ → grep `SESSION-HANDOFF.md` theo phase number (vd `Phase 15.1.k`).
