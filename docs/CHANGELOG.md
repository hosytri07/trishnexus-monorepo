# Changelog — TrishTEAM

Định dạng dựa trên [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
và [Semantic Versioning](https://semver.org/).

Mọi entry viết theo góc nhìn end-user: **điều gì đổi với họ**, không
phải implementation detail.

---

## [Unreleased] — Phase 14.0–14.5.5.c.1 — Monorepo + Vitest + TrishLauncher + TrishCheck + TrishClean + TrishFont + TrishType + TrishImage + TrishNote + TrishLibrary + TrishSearch + TrishDesign + QA doctor + Rust audit + TESTPLAN × 10 + Batch compile matrix + Windows setup fixes + Rust borrow-checker fix + TrishLauncher v1 (10 app + logo real 256×256) + App Detail Modal + Launch detection + Dev-mode detection

### Added (Phase 14.0)
- Bốn shared package TypeScript (`packages/{core,ui,data,adapters}/`) làm
  nền cho rebuild 10 desktop app + Zalo Mini App với ~75% code reuse.
  - `@trishteam/core` — pure TS domain logic: apps catalog merge, search
    fold tiếng Việt + tokenize, notes model + validate, QR classify +
    filename suggest.
  - `@trishteam/ui` — React component scaffold (sẽ populate Phase 14.1).
  - `@trishteam/data` — Firestore collection path constants.
  - `@trishteam/adapters` — platform abstraction: router/storage/notify/
    clipboard interface.
- Root `package.json` + `pnpm-workspace.yaml` + `tsconfig.base.json`.
- `packages/README.md` — triết lý, coverage matrix, quy tắc code.

### Added (Phase 14.1)
- Vitest 1.6.1 + @vitest/coverage-v8 cho `@trishteam/core` — 55 test
  case pass (5 file: fold + cosine + validate + classify + select).
- Next.js adapter layer trong `website/lib/adapters/`:
  - `next-router.ts` — wrap `useRouter` + `usePathname` thành
    `RouterAdapter` (hook `useNextRouterAdapter`).
  - `web-storage.ts` — `localStorage` adapter với SSR guard + try/catch
    cho quota exceeded.
  - `web-clipboard.ts` — Clipboard API + `execCommand` fallback cho
    browser cũ.

### Added (Phase 14.2 — bản alpha TrishLauncher v2)
- `apps-desktop/trishlauncher/` — bản rebuild Tauri 2 thay thế bản
  Qt/Python cũ. Stack mới: Rust 1.77 backend + React 18/Vite 5 UI,
  reuse `@trishteam/core/apps` cho catalog logic (không duplicate).
- Rust commands: `sys_info` (OS/arch/CPU/RAM/hostname qua crate
  `sysinfo`) + `app_version` + opener plugin để mở download URL.
- UI launcher: card grid responsive, auto-detect platform từ sys
  info để filter app tương thích, graceful fallback khi chạy `pnpm
  dev` trong browser thuần (không cần Tauri runtime để iterate UI).
- CSP strict mặc định chỉ cho `*.firebaseio.com`, `*.googleapis.com`,
  `*.trishteam.io.vn`. Capabilities minimal — chỉ `opener:allow-open-url`.
- README `apps-desktop/trishlauncher/README.md` hướng dẫn
  prerequisites (Rust, WebView2, Xcode, webkit2gtk), dev workflow
  (`pnpm dev` vs `pnpm tauri:dev`), và build release (msi/dmg/deb).

### Added (Phase 14.2.1 — TrishCheck alpha)
- `apps-desktop/trishcheck/` — benchmark tool cho user kiểm tra máy
  trước khi tải ứng dụng nặng. Stack giống TrishLauncher nhưng tối
  giản hơn.
- Rust commands: `sys_report` (OS/CPU/RAM/swap/uptime), `cpu_benchmark`
  (SHA-256 trên 50 MB buffer, throughput MB/s), `memory_bandwidth`
  (copy 64 MB source → dest, MB/s).
- UI tách logic scoring ra `src/scoring.ts` (5 tier excellent/good/ok/
  low/very_low với baseline CPU ≥700/≥400/≥250/≥120 MB/s, memory ≥20/
  ≥12/≥7/≥3.5 GB/s) → dễ unit test sau này.
- Capabilities tối thiểu: chỉ `core:default`. CSP không cho network
  bên ngoài. Benchmark 100% local — không gửi telemetry.

### Added (Phase 14.3.1 — TrishClean alpha)
- `apps-desktop/trishclean/` — bản rebuild Tauri 2 của TrishClean.
  Dọn dẹp file/cache với **staged delete + undo 7 ngày**: không xoá
  thật ngay, chỉ scan + stage sang trash folder riêng, commit sau
  retention window (user restore được nếu lỡ tay).
- `@trishteam/core/clean` — domain logic pure TS (không chạm
  filesystem, testable). Rule phân loại theo priority: folder rỗng →
  cache (`.cache`, `AppData\Local\Cache`) → temp (`/tmp`,
  `/var/folders`) → downloads → recycle bin → file lớn ≥100 MB →
  file cũ chưa mở ≥180 ngày → other. Age bucket: recent/month/
  quarter/year/ancient. Cross-platform path normalize (`\` → `/`).
- Vitest +31 test case (20 aggregate + 11 classify) — total core
  86/86 pass (lên từ 55/55 của Phase 14.1).
- Rust backend chỉ `scan_dir` (readonly metadata qua `walkdir`) với
  hard cap max_entries (100..200 000, default 20k) + max_depth
  (1..32, default 6) để tránh user pick nhầm `/` treo app. Truncate
  flag báo UI khi chạm cap.
- UI: pick dir qua `@tauri-apps/plugin-dialog`, category pill filter,
  file list sort theo size (top 200), banner warning truncate, dev
  fallback seed cho `pnpm dev` browser mode.
- Capabilities minimal: `core:default` + `dialog:default` +
  `dialog:allow-open`. Không network. Phase alpha chỉ scan — staged
  delete + commit dời sang 14.3.1.b sau khi UI review ổn định.

### Added (Phase 14.3.2 — TrishFont alpha + Pair AI)
- `apps-desktop/trishfont/` — bản rebuild Tauri 2 của TrishFont.
  Quản lý + preview font với tính năng mới: **Pair AI** — đề xuất
  cặp heading + body hợp nhau theo matrix contrast personality
  (serif + sans = 0.9, sans + slab = 0.75, ...), ưu tiên font hỗ
  trợ tiếng Việt cho body.
- `@trishteam/core/fonts` — domain logic pure TS. 8 personality
  (serif/sans/slab/mono/display/script/handwriting/unknown) classify
  heuristic từ family name. `buildCollection` nhóm style theo
  family (pick Regular làm representative). `scorePair` matrix 0-100
  với rationale tiếng Việt theo contrast tier. `recommendPairs`
  top N với option `fixHeading` + `requireVnBody`.
- Vitest +29 test case (12 classify + 17 pair) — total core
  **115/115 pass** (lên từ 86/86 của Phase 14.3.1).
- Rust backend qua `ttf-parser` 0.20 — zero-copy, không đụng
  FreeType. `scan_fonts` walk folder cho .ttf/.otf/.ttc/.otc với
  hard cap max_entries 10..10 000 (default 2k). `read_font` parse
  single file. Name table ưu tiên English (langID 0x0409). VN
  detection qua glyph coverage ≥80% của 26 char diacritic.
- UI: picker folder, personality pill filter, toggle VN-only,
  family grid với "Pin heading" để cố định heading cho pair AI,
  pair list top 12 với 3 preview sample (pangram EN + dấu tiếng
  Việt + brand name), score tier excellent/good/ok/low/bad,
  rationale tiếng Việt.
- Capabilities: `core:default` + `dialog` + `fs:allow-read-file`
  (FontFace preview load sẽ wire ở 14.3.2.b). CSP bổ sung
  `font-src 'self' data: asset:`.
- Phase alpha **không cài font vào OS** — chỉ đọc metadata và
  preview. Install/uninstall + font pack TPack export/import dời
  sang 14.3.2.b/c.

### Added (Phase 14.3.3 — TrishType alpha + CRDT multi-caret)
- `apps-desktop/trishtype/` — bản rebuild Tauri 2 của TrishType.
  Text editor với **multi-caret**: gõ nhiều vị trí cùng lúc, mỗi
  phím được insert ở tất cả caret đồng thời. Carets anchor vào
  `CharId` nên không bị shift khi actor khác insert/delete ở chỗ
  khác trong cùng doc.
- `@trishteam/core/type` — RGA-style text CRDT pure TS, không phụ
  thuộc DOM/Node runtime (reusable cho website + Zalo Mini App).
  Merge offline an toàn: 2 replica edit song song (ví dụ laptop +
  tablet cùng gõ), áp dụng cùng tập ops theo thứ tự bất kỳ vẫn ra
  cùng text. Insert sau đẩy char cũ sang phải theo RGA rule
  `clock desc, actor asc`. Delete chỉ flip tombstone → commutative
  với insert. Serialize/deserialize v1 JSON cho save to file.
- Vitest +23 test case (11 crdt + 12 multicaret) — total core
  **138/138 pass** (lên từ 115/115 của Phase 14.3.2). Key test
  convergence: 2 actors insert cạnh tranh cùng vị trí hội tụ,
  tie-break clock desc, delete + insert commute, serialize
  roundtrip.
- Rust backend **tối giản**: chỉ 2 command `read_text_file` +
  `write_text_file` (cap 5 MiB). Toàn bộ CRDT + caret logic sống
  ở TS, test bằng Vitest thay vì integration test qua IPC.
- UI: top bar Mở/Lưu/Lưu Dưới Tên, sidebar info panel (actor ID,
  ký tự count, file path, dirty flag) + danh sách carets với nút
  remove và form "+ thêm caret" tại visual index, editor render
  visibleChars với caret markers inline blink 1s. Keyboard:
  printable → typeAtCarets, Backspace → backspaceAtCarets, Enter
  → '\n', Tab → 2 spaces, ←/→ → moveCarets (tất cả caret ±1),
  Ctrl+O/Ctrl+S shortcut. Dev fallback load sample text khi chưa
  start Tauri.
- Capabilities: `core:default` + `dialog:default` + `dialog:allow-open`
  + `dialog:allow-save` + `fs:default` + `fs:allow-read-file` +
  `fs:allow-write-file`. Không shell, không network.
- Phase alpha v1 chưa có: selection range (chỉ caret điểm), undo/redo
  (CRDT undo tricky — dời 14.3.3+), copy/paste CRDT binding (mặc
  kệ default browser), IME composition, P2P sync giữa 2 replica
  thật (dời Phase 14.5+ — hiện chỉ demo local + verify qua test).

### Added (Phase 14.3.4 — TrishImage alpha + event/face/aspect grouping)
- `apps-desktop/trishimage/` — bản rebuild Tauri 2 của TrishImage.
  Photo organizer quét thư mục ảnh, nhóm thành **event theo time
  gap** (ảnh cách nhau >8h bị split), phân loại **aspect ratio**
  (landscape/portrait/square/panorama) và **face bucket** (solo/pair/
  group/none/unknown). Tối ưu cho gallery cá nhân 10 000+ ảnh.
- **Không decode pixel** → scan cực nhanh. Rust đọc header image
  ≤512 byte qua `imagesize` 0.13 (cho width/height) + EXIF qua
  `kamadak-exif` 0.5 (pure Rust, không cần libexif) — lấy
  DateTimeOriginal, Model camera, GPSLatitude detection. Ảnh
  không EXIF time fallback về mtime.
- `@trishteam/core/images` — domain logic pure TS. `classifyAspect`
  với thresholds panorama ≥2.0 hoặc ≤0.5, landscape >1.15, portrait
  <0.87, còn lại square. `groupByEvent` sort theo taken_ms + split
  khi gap >`DEFAULT_EVENT_GAP_MS` (8h). `groupByDay`/`groupByMonth`
  UTC-based ISO keys. `FaceBucket` 5-enum heuristic từ face_count
  (null→unknown, 0→none, 1→solo, 2→pair, 3+→group). Aggregates:
  total files/bytes, with EXIF time/GPS count, by aspect/extension
  distribution, formatBytes B/KB/MB/GB.
- Vitest +40 test case (12 classify + 12 group + 5 aggregate + 11
  faces) — total core **178/178 pass** (lên từ 138/138 của Phase
  14.3.3).
- Rust backend `scan_images(dir, max_entries?, max_depth?)` qua
  `walkdir` với hard cap max_entries 100..200 000 (default 5k) +
  max_depth 1..32 (default 8). Whitelist extension jpg/jpeg/png/
  webp/gif/bmp/tif/tiff/heic/heif. Bỏ qua hidden folder
  (node_modules, .git, dot-prefix). Civil epoch algorithm (Hinnant)
  cho parse EXIF datetime → ms. `face_count` v1 luôn trả `None` —
  wire ONNX BlazeFace ở Phase 14.3.4.b.
- UI: top bar pick folder, sidebar stats (ảnh/dung lượng/EXIF time
  coverage/GPS count/elapsed ms/lỗi) + aspect pill filter có badge
  màu theo aspect + face bucket stats coverage + view toggle
  Events/Faces/Tất cả, content pane render EventGroup với thumb
  grid responsive auto-fill 160 px, ImageCard có placeholder badge
  theo aspect (▭ landscape / ▯ portrait / ◻ square / ━ panorama).
  Dev fallback 24 ảnh giả chia 3 events cho `pnpm dev` browser.
- Capabilities tối thiểu: `core:default` + `dialog:default` +
  `dialog:allow-open`. **Không cần fs plugin** vì Rust tự đọc qua
  `std::fs`. CSP không cho network bên ngoài — scan 100% local.
- Phase alpha v1 chưa có: thumbnail thật (chỉ placeholder), viewer
  full-size modal, nhớ folder đã scan, hỗ trợ RAW format (CR2/ARW/
  NEF). Roadmap: ONNX face detect ở 14.3.4.b, thumbnail cache LRU
  + viewer ở 14.3.4.c.

### Added (Phase 14.4.1 — TrishNote alpha + daily review + kanban)
- `apps-desktop/trishnote/` — bản rebuild Tauri 2 của TrishNote. Ghi
  chú cá nhân **local-only** cho alpha — Firebase Auth + Firestore sync
  dời Phase 14.4.1.b để ship enhancement (Daily Review + Kanban) trước.
  Data sống trong 1 file JSON tại thư mục dữ liệu OS (`%LocalAppData%/
  TrishTEAM/TrishNote/notes.json` Windows, `~/.local/share/TrishTEAM/
  TrishNote/notes.json` Linux, `~/Library/Application Support/TrishTEAM/
  TrishNote/notes.json` macOS).
- **Daily Review mode** — mỗi note có `lastReviewedAt`. Sau 7 ngày
  (`DEFAULT_REVIEW_INTERVAL_MS`) không review → vào hàng đợi review
  hôm nay. Modal cursor qua từng note due, bấm "Đã review" sẽ
  `markReviewed` (immutable, set `lastReviewedAt = now`). Streak
  badge đếm số ngày liên tục (UTC day bucket) bạn review ≥1 note —
  gián đoạn 1 ngày → reset.
- **Age bucket chip** — mỗi note gắn chip màu theo tuổi review:
  `fresh` (xanh, <3.5 ngày) / `stale` (vàng, <7 ngày) / `overdue`
  (cam, <28 ngày) / `ancient` (đỏ, ≥28 ngày).
- **Kanban board** — 4 lane mặc định `Inbox → Đang làm → Chờ → Xong`
  (+ tuỳ chọn lane thứ 5 `Lưu trữ`), drag-drop giữa lane bằng HTML5
  DnD native, không cần thư viện ngoài. Mỗi lane sort theo
  `updatedAt` giảm dần. Move note sang `done` từ status khác sẽ tự
  set `lastReviewedAt = now` (tránh phải review riêng).
- `@trishteam/core/notes` — tách thành 4 submodule: `types.ts`
  (Note thêm optional `status?: NoteStatus` 5-enum inbox/active/
  waiting/done/archived + `lastReviewedAt?: number | null` +
  `dueAt?: number | null` — optional để backward-compat schema
  Firestore cũ Phase 11.7), `validate.ts` (validateDraft +
  normalizeTag + check dueAt finite), `review.ts` (notesDueForReview
  bỏ qua deleted/archived/done + sort lastReviewedAt null-first,
  countDueForReview, markReviewed, computeReviewStreak,
  reviewAgeBucket 4-tier, filterByStatus), `kanban.ts` (KanbanLane,
  statusLabel VN, groupByKanban, moveNote guard lastReviewedAt,
  countByStatus Record).
- Vitest +37 test case (24 review + 13 kanban) — total core
  **215/215 pass** (lên từ 178/178 của Phase 14.3.4).
- Rust backend: `default_store_location` dùng crate `dirs` 5 với
  fallback `data_local_dir → data_dir → home_dir` để resolve path
  cross-platform. `load_notes(path?)` seed `[]` nếu file chưa có.
  `save_notes(path?, content)` validate JSON parse + cap 10 MiB +
  atomic write qua `.json.tmp` + rename (an toàn nếu crash giữa
  chừng). Không có fs plugin — Rust tự đọc/ghi qua `std::fs`.
- UI: topbar (+ Note mới / Review hôm nay (N) / Xuất JSON / Nhập
  JSON), sidebar (status filter + tag filter + search + streak
  badge), content List/Kanban toggle, NoteRow với status-colored
  border-left + age chip + tag pill, DetailPane editable title/
  body/status + nút review + nút xoá soft `deletedAt`,
  ReviewModal cursor qua queue, ComposerModal có validate. Auto-
  save debounce 400 ms mọi thay đổi.
- Dev fallback 5 seed note phủ đủ 4 status + 2 mức review age
  (active 2d/1d reviewed, waiting 5d, inbox 14d never reviewed,
  done 3d, inbox 30d) cho `pnpm dev` browser thuần.
- Capabilities tối thiểu: `core:default` + `dialog:default` +
  `dialog:allow-open` + `dialog:allow-save`. Không có fs plugin,
  không có shell, không có http.
- Phase alpha v1 chưa có: sync cloud (14.4.1.b), reminder toast/
  Telegram cho `dueAt` (14.4.1.c, field đã có trong schema),
  export PDF/Markdown bundle (14.4.1.d), rich text, attachment,
  encryption (dựa OS-level file permission — nếu cần mã hoá, đặt
  máy trong ổ BitLocker/FileVault).

### Added (Phase 14.4.2 — TrishLibrary alpha + tag auto-suggest + cite APA/IEEE)
- `apps-desktop/trishlibrary/` — bản rebuild Tauri 2 của TrishLibrary.
  Quản lý thư viện sách/PDF/EPUB/Word **local-only** cho alpha — OCR
  Tesseract dời Phase 14.4.2.b, Firebase sync dời Phase 14.4.2.c để
  ship enhancement (Tag auto-suggest + Cite generator) trước. Data
  sống trong 1 file JSON tại thư mục dữ liệu OS (`%LocalAppData%/
  TrishTEAM/TrishLibrary/library.json` Windows / `~/.local/share/
  TrishTEAM/TrishLibrary/library.json` Linux / `~/Library/Application
  Support/TrishTEAM/TrishLibrary/library.json` macOS).
- **Tag auto-suggest (AI nhẹ)** — mỗi tài liệu được chấm điểm tag
  theo 3 nguồn: (1) keyword rules 7 cái (`tcvn` / `luật` / `xây dựng` /
  `học` / `nghiên cứu` / `code` / `tiếng việt`) — match trong title/
  name/note/authors → score += 0.85, (2) co-occurrence với tag đã có
  trong library → score += 0.3 + 0.3*log10(1+count), (3) format
  fallback pdf→`pdf`/docx→`word`/epub→`sách`/md→`markdown` → score
  += 0.4. Hiển thị top 8 suggestion với tooltip kèm `reason` + `score`,
  click để gắn. Regex tiếng Việt dùng Unicode block `[\u00C0-\u024F
  \u1E00-\u1EFF]` để bắt composed chars như `ế` / `ệ` / `ị` không bị
  miss khi match base ASCII.
- **Cite generator APA 7 + IEEE** — nút **🔖 Trích dẫn (N)** trên
  topbar mở modal list citation cho các tài liệu đang lọc. Pill
  APA↔IEEE đổi style realtime. APA format `Last, F. M.` + joinAuthors
  theo rule "&" (2 tác giả "A & B", 3-7 "A, B, & C"), cắt et al. ở
  tác giả thứ 8 trở đi, italic title. IEEE format `F. M. Last` +
  "and" trước tên cuối, et al. từ 7 tác giả, quoted title, đánh số
  `[1]`..`[n]`. Copy all clipboard trong 1 click.
- **Scan folder đệ quy** — chọn 1 thư mục, Rust backend `walkdir` 2.5
  quét với max_entries clamp 100..200k (default 5k) + max_depth clamp
  1..32 (default 8), bỏ `node_modules` / `target` / `.git` /
  `$RECYCLE.BIN`, whitelist 10 ext (pdf/docx/doc/epub/txt/md/html/rtf/
  odt/unknown). Merge thông minh: path trùng → chỉ update `sizeBytes`
  + `mtimeMs`, giữ nguyên title/authors/year/publisher/tags/note/
  status mà user đã chỉnh.
- **Read status 4-enum** — `unread / reading / done / abandoned` với
  border-left màu theo status. Filter nhanh ở sidebar.
- **Mở file bằng app mặc định OS** — bấm **🔗 Mở file** sẽ gọi
  `tauri-plugin-opener` 2.0 → Acrobat / Word / Calibre / ... mở file
  mà không cần shell permission.
- `@trishteam/core/library` — tách thành 6 submodule: `types.ts`
  (LibraryDoc với id/path/name/ext/format/sizeBytes/mtimeMs/addedAt/
  updatedAt + metadata title/authors/year/publisher/tags/note/status,
  DocFormat 10-enum, ReadStatus 4-enum, LibraryDraft, LibrarySummary,
  TagSuggestion), `classify.ts` (classifyFormat whitelist,
  defaultTitleFromName strip ext + underscore→space, stableIdForPath
  FNV-1a hash → `doc_` prefix, enrichRaw, mergeWithExisting preserve
  user metadata), `tag-suggest.ts` (KEYWORD_TO_TAG 7 rules +
  FORMAT_FALLBACK + buildTagIndex + suggestTags 3-source scoring +
  normalizeLibraryTag), `validate.ts` (caps MAX_TITLE 300 / MAX_NOTE
  5000 / MAX_AUTHOR 200 / MAX_TAG 50 / MAX_TAGS_PER_DOC 32, year
  0-3000), `cite.ts` (CiteStyle + formatAuthorApa/Ieee +
  joinAuthorsApa/Ieee + formatCitation + formatCitationList +
  citeStyleLabel + CITE_STYLES readonly), `aggregate.ts`
  (summarizeLibrary + filterByFormat/Status/Tag null passthrough +
  searchDocs substring multi-field + sortRecent/BySize/ByTitle
  vi-locale + formatBytes B/KB/MB/GB).
- Vitest +65 test case (11 classify + 15 tag-suggest + 7 validate +
  15 cite + 17 aggregate) — total core **280/280 pass** (lên từ
  215/215 của Phase 14.4.1).
- Rust backend: 4 command — `default_store_location` (dirs crate
  cross-platform), `load_library(path?)` (seed `[]`), `save_library
  (path?, content)` (validate JSON + cap 20 MiB + atomic write qua
  `.json.tmp` + rename), `scan_library(dir, max_entries?, max_depth?)`
  (walkdir recursive + ext whitelist + hidden skip + ScanSummary với
  elapsed_ms / errors / max_entries_reached).
- UI 3-column: topbar (Quét thư mục / Nhập JSON / Xuất JSON / Trích
  dẫn (N) + saving-flash), sidebar (search + stats tổng quan +
  format filter pill + status filter pill với border màu + top-tag
  pill + store location), content pane (banner error/info +
  content-toolbar sort recent/title/size + DocList với format-chip
  + status-colored border-left + meta authors·year·bytes·status +
  tag-row). DetailPane editable title/authors csv/year/publisher/
  status pill-row/tag suggestion dashed tooltip `reason · score=X.YY`
  click-to-add + note textarea + Mở file / Xoá. CiteModal pill
  APA↔IEEE + Copy all + `<ol>` cite-list monospace.
- Dev fallback 6 seed docs cho `pnpm dev` browser thuần: TCVN 5574
  PDF reading, React Handbook PDF done, TypeScript Patterns EPUB
  unread, Ghi chú khảo sát MD reading, Luận văn ThS DOCX abandoned,
  IEEE paper PDF unread. Phủ đủ 4 format + 4 read-status + chủ đề
  VN/EN để test tag suggest + cite generator không cần Tauri runtime.
- Capabilities tối thiểu: `core:default` + `dialog:default` +
  `dialog:allow-open` + `dialog:allow-save` + `opener:default` +
  `opener:allow-open-path`. Không có fs plugin (Rust tự đọc qua
  `std::fs`), không có shell, không có http.
- Phase alpha v1 chưa có: OCR Tesseract cho PDF scan (14.4.2.b),
  sync cloud Firebase (14.4.2.c), cover thumbnail từ EPUB/PDF
  (14.4.2.d), full-text search Lucene/Tantivy (dời 14.4.3
  TrishSearch), cite style MLA/Chicago/TCVN 7115 (dời phase sau),
  nested collection/folder (dùng tag thay thế), annotation/highlight
  trong app (phải Mở file ra OS app).

### Added (Phase 14.4.3 — TrishSearch alpha + BM25 full-text engine)
- `apps-desktop/trishsearch/` — bản rebuild Tauri 2 của TrishSearch.
  Tìm kiếm **xuyên 3 nguồn** trong hệ sinh thái (Ghi chú TrishNote,
  Thư viện TrishLibrary, file text rời user pick) bằng **BM25 ranking
  offline**. Alpha local-only — Tantivy WASM cho index bền GB-scale
  dời 14.4.3.b, Firebase semantic rerank cross-device dời 14.4.3.c,
  PDF text extraction dời 14.4.3.d. Chạy port 1436 (HMR 1437), tách
  khỏi TrishNote (1432) / TrishLibrary (1434).
- **BM25 engine thuần TS** trong `@trishteam/core/fulltext` — tách
  7 submodule: `types`, `tokenize`, `index-build`, `query`, `rank`,
  `adapters`, `aggregate`. Tham số kinh điển k1=1.2, b=0.75. Recency
  boost tuyến tính α=0.2 (doc ≤7 ngày → 1, ≥365 ngày → 0). Title ×3,
  tag ×2, body ×1 (gộp sẵn vào TF khi index). Phrase bonus ×1.4 khi
  match cụm sát. Tokenize fold tiếng Việt (dùng lại `foldVietnamese`
  từ `@trishteam/core/search/fold`) + stopword EN 25 từ + VN 20 từ
  (đã fold) + lite Porter stem (-ing ≥5, -ed ≥4, -ies→-y ≥5, -es,
  -s không -ss). Skip token <2 chars.
- **Query DSL** — parse qua regex `/"([^"]+)"|(\S+)/g`. Hỗ trợ:
  AND ngầm giữa các clause; `-loại` (negate exclude); `*prefix`
  (startsWith match qua Object.keys scan); `"cụm từ"` (phrase, phải
  match sát liên tiếp để ăn bonus); `note:`/`library:`/`file:` (lọc
  nguồn — sourceFilter propagate xuống `searchIndex`, unknown prefix
  fallback thành token thường). Tất cả nhận fold tiếng Việt.
- **Snippet highlight an toàn** — `buildSnippet(body, terms)` tìm
  first match trên body đã fold, cắt ±100 chars quanh, HTML-escape
  `& < > " '` rồi wrap `<mark>…</mark>` fold-insensitive. Test case
  cover injection `<script>alert(1)</script>` → render thành
  `&lt;script&gt;alert(1)&lt;/script&gt;` không chạy script.
- Vitest +66 test case (13 tokenize + 9 index-build + 9 query + 18
  rank + 11 adapters + 6 aggregate) — total core **346/346 pass**
  (280 trước → 346). Key test: ranks title > body match, AND cross
  clauses, exclude negated term, prefix `typ*` match `typescript`,
  source prefix `library:react` chỉ trả doc library, recency boost
  đẩy doc mới lên dù BM25 bằng nhau, merge 2 index last-wins dup id,
  snippet `<mark>` wrap + XSS escape.
- Rust backend `apps-desktop/trishsearch/src-tauri/`: 4 command.
  `default_store_location` chỉ trả `data_dir + exists` cho status
  bar (không ghi gì vào disk). `load_json_file(path)` cap 40 MiB +
  `serde_json` validate — dùng chung cho `notes.json` +
  `library.json`. `read_text_file(path)` whitelist 7 ext (txt/md/
  markdown/rst/org/html/rtf) + truncate ≥2 MiB (lossy UTF-8) +
  `truncated` flag. `scan_text_folder(dir, max_entries?, max_depth?)`
  walk `walkdir` 2.5, clamp max_entries [50..20k] default 2k +
  max_depth [1..24] default 8, `is_hidden` lọc dot-prefix / `.git` /
  `node_modules` / `target` / `$RECYCLE.BIN` / `System Volume
  Information`, đọc content bounded kèm mỗi file → `ScanTextSummary`
  với `files[]` + `total_files_visited` + `elapsed_ms` + `errors[]`.
- UI 3-cột amber/ember theme (khác teal Library, green Note, tím
  Type): topbar 4 nút (Nạp notes.json / Nạp library.json / Scan
  folder text / ↺ Dùng demo), search bar với placeholder giới thiệu
  DSL `-loại *prefix "cụm từ" note:/library:/file:`, source pill
  (Tất cả N / Ghi chú N / Thư viện N / File rời N với counts
  realtime từ `summarizeIndex`), status bar (data_dir code +
  notes/library/files counts + index stats totalDocs/totalTerms/
  avgDocLen + build ms + search ms + demo chip khi dùng fallback).
  Sidebar (cú pháp hint + top 12 term df + error scan list nếu có).
  Results (hit card gradient source-tag 3 màu + title + score
  float2 + snippet với `<mark>` highlight + path code + tag pill
  + mtime vi-VN). Detail pane (source-tag + title + path + Mở
  bằng OS button qua `plugin-opener` + score·matched·mtime meta +
  full tags + body pre-wrap scroll).
- Keyboard: `Ctrl+K`/`Cmd+K` focus ô tìm kiếm, `Esc` xoá query +
  unselect. Auto-select hit đầu tiên. Debounce 400 ms đã có sẵn
  do React memo chain (build index + search đều via `useMemo`).
- Dev fallback `DEV_FALLBACK_DOCS` cho `pnpm dev` browser — 5 doc
  đã qua `collectFulltextDocs`: 2 note (React hook / TCVN 5574) +
  1 deleted note bị filter + 2 library (React Handbook / IEEE
  Semantic Retrieval) + 2 file rời (readme.md / changelog.txt).
  Chạy ngay được để demo tính năng không cần build Tauri.
- Capabilities tối thiểu: `core:default` + `dialog:default` +
  `dialog:allow-open` + `opener:default` + `opener:allow-open-path`.
  Không có fs plugin (Rust tự đọc qua `std::fs`), không shell,
  không http, không telemetry.
- Phase alpha v1 chưa có: index persist lên disk (mất khi tắt
  app — dời 14.4.3.b Tantivy WASM), semantic rerank bằng Firebase
  embedding (14.4.3.c, cosine đã có sẵn trong
  `@trishteam/core/search` nhưng chưa wire), PDF/DOCX/EPUB text
  extraction (14.4.3.d), incremental mtime-diff index (14.4.3.e),
  per-field boost runtime (hiện gộp sẵn vào TF khi index),
  pagination beyond 60, highlight trong detail body full (hiện
  chỉ trong snippet).

### Added (Phase 14.4.4 — TrishDesign alpha + color palette + design token engine)
- `apps-desktop/trishdesign/` — bản rebuild Tauri 2 của TrishDesign. Công
  cụ sinh **color palette + design token** offline cho cả hệ sinh thái
  TrishTEAM. Chạy port 1438 (HMR 1439), tách khỏi TrishSearch (1436) /
  TrishLibrary (1434) / TrishNote (1432) / TrishLauncher (1420). Alpha
  local-only — Firebase preset sync cross-device dời 14.4.4.b, token
  versioning + diff 2 phiên bản 14.4.4.c, import Adobe ASE/Sketch
  palette 14.4.4.d, CSS `color(display-p3)` + OKLCH output 14.4.4.e.
- **Color scale Tailwind-style 50..950** — từ 1 hex base sinh 11 swatch
  theo `TARGET_LIGHTNESS` curve (97/94/86/77/66/55/46/36/27/18/10) +
  `SAT_MULTIPLIER` bell (0.35→0.5→0.7→0.85→0.95→1→1→0.95→0.9→0.85→
  0.8). Offset lightness cho base tinh tế: `targetL + lOffset · (1 −
  |targetL − 55|/55)` — base ở bất kỳ vị trí trên curve (không chỉ 500)
  vẫn cho kết quả cân đối. Mỗi swatch đi kèm contrast ratio sẵn với
  `#FFFFFF` và `#000000` để UI tô màu text tự động.
- **WCAG 2.1 contrast matrix** — `relativeLuminance` piecewise sRGB
  (`c≤0.03928 ? c/12.92 : ((c+0.055)/1.055)^2.4`), `contrastRatio` làm
  tròn 2 chữ số, `ratingFor` 4-tier (AAA ≥7, AA ≥4.5, AA-large ≥3,
  fail <3). `meetsAA`/`meetsAAA` phân biệt normal vs large text.
  `buildContrastMatrix` N×N cho toàn bộ swatch — UI render bảng nhìn
  phát biết cặp nào AA/AAA. `bestForegroundOn(bg, candidates)` chọn
  swatch có ratio cao nhất → dùng cho `semantic.text` alias.
- **Harmony 6 kiểu** — `monochromatic` (±25%L, ±12%L, 0), `complementary`
  (180°), `analogous` (-30°, 0°, +30°), `triadic` (0°, 120°, 240°),
  `splitComplementary` (0°, 150°, 210°), `tetradic` (0°, 90°, 180°,
  270°) qua helper `rotate(hex, deltaH, deltaL, deltaS)`. Dùng cho
  UI preview "Đổi kiểu phối màu" khi user chưa chắc muốn gì.
- **AI enhancement `suggestPalette(base, mode)`** — sinh palette hoàn
  chỉnh WCAG-compliant tự động: `primary` = scale từ base, `secondary`
  = scale từ rotate(base, 180°, sat -15%) (complementary dịu), `accent`
  = scale từ rotate(base, 120°, sat +10%) (triadic tươi), `neutral` =
  scale từ hsl(h=base.h, s=8%, l=50%) (xám nhẹ ấm), `success` `#16A34A`
  / `warning` `#EAB308` / `danger` `#DC2626` status canonical. Semantic
  alias theo `mode` 3-enum: `light` → bg=neutral.50, text=neutral.900;
  `dark` → bg=neutral.950, text=neutral.50; `brand` → bg=primary.50,
  text=primary.900. `primary.onBg` chọn swatch trong primary scale ăn
  AA với bg → dùng làm button background mà không lo trắng-trên-vàng.
- **Export 5 format** — `toCssVars` sinh `:root { --color-primary-500:
  #...; }` cho web thuần; `toTailwindConfigJs` sinh `module.exports = {
  theme: { extend: { colors: { primary: { 50: '#...', ... } } } } }`
  cho Tailwind config; `toFigmaTokensJson` W3C Tokens Studio format
  cho Figma Tokens plugin; `toScssMap` `$primary: (50: #..., ...)` cho
  SCSS; `scaleToPlainJson` flat JSON cho tool khác. Mỗi format có
  button "📋 Sao chép" + preview pre-code trong UI.
- `@trishteam/core/design` — tách thành 8 submodule: `types.ts`
  (RGB/HSL với alpha, ColorSwatch, ColorScale, HarmonyKind 6-enum,
  ContrastRating 4-enum, DesignTokenSet id/name/scales/semantic/spacing/
  radius/shadow/typography, PaletteMode 3-enum), `convert.ts` (HEX_RE
  hỗ trợ #RGB/#RGBA/#RRGGBB/#RRGGBBAA, hexToRgb/rgbToHex/rgbToHsl/
  hslToRgb theo CSS Color Module Level 3, parseColor cho hex/rgb()/
  rgba()/hsl()/hsla(), normalizeHex → #RRGGBB uppercase, clamp NaN→min),
  `contrast.ts` (relativeLuminance + contrastRatio + ratingFor +
  meetsAA/AAA + buildContrastMatrix + bestForegroundOn), `scale.ts`
  (SCALE_KEYS 11 readonly, TARGET_LIGHTNESS + SAT_MULTIPLIER maps,
  buildScale + swatchByKey + pickAccessibleSwatch AA/AAA fallback +
  countAccessible), `harmony.ts` (rotate helper + buildHarmony cho 6
  kiểu + buildAllHarmonies), `tokens.ts` (createEmptyTokenSet defaults
  spacing 0-16 / radius none-full / shadow sm-lg / typography body
  14px 1.5 400, validateTokenSet + resolveSemantic alias→hex +
  mergeTokenSets scalesMap last-wins), `export.ts` (5 format emitter +
  kebab helper), `suggest.ts` (suggestPalette AI core).
- Vitest +75 test case (13 convert + 13 contrast + 11 scale + 9 harmony
  + 12 tokens + 11 export + 6 suggest) — total core **421/421 pass**
  (lên từ 346/346 của Phase 14.4.3). Key test: hexToRgb 3-digit
  expansion, hsl→rgb saturation 0 = gray, relativeLuminance white=1
  black=0, ratio 21 white-on-black, scale base ở mid trả 11 swatch
  monotonic lightness giảm dần, buildScale preserve hue base, harmony
  complementary ±180°, triadic 3 nhánh lệch 120°, suggestPalette trả
  đủ primary/secondary/accent/neutral/success/warning/danger + semantic
  alias WCAG AA compliant với bg/text.
- Rust backend `apps-desktop/trishdesign/src-tauri/`: 3 command.
  `default_store_location` trả `EnvLocation { data_dir, exists }` qua
  crate `dirs` 5 (fallback `data_local_dir → data_dir → home_dir`).
  `load_design_file(path)` cap 8 MiB + `serde_json` parse validate →
  `DesignLoadResult { path, bytes, text, valid_json }` — trả text
  thô để UI parse thành `DesignTokenSet` TS-side (schema owner bên
  TS, tránh duplicate struct Rust). `save_design_file(path, payload)`
  cap 8 MiB + validate JSON parse trước ghi, **atomic write** ghi
  tempfile `.tmp-tsn` rồi `rename` — không để file palette nửa-vời
  nếu crash giữa chừng.
- UI 3-cột violet/indigo theme (khác amber TrishSearch, teal
  TrishLibrary, green TrishNote, tím TrishType): topbar (base hex
  input + color picker realtime sync + mode Sáng/Tối/Brand pill +
  "🔀 Sinh lại AI" / Nhập JSON / Xuất JSON / Tên palette input),
  sidebar trái (list 4+ scale primary/secondary/accent/neutral với
  badge swatch count + AI notes list dẫn giải tại sao palette ra như
  vậy + semantic alias table background/surface/text/primary.onBg với
  chip màu resolve), main center (palette grid 11×N swatches — click
  chọn active, hover hiện hex + lightness + saturation), detail phải
  (active swatch ô to 120px + hex copy button + rgb/hsl dump +
  contrast matrix N×N so với các swatch cùng scale, AAA=xanh/AA=xanh
  nhạt/AA-large=vàng/fail=đỏ + export dropdown 5 format với pre-code
  preview + "📋 Sao chép" / "💾 Lưu .css" button).
- Keyboard: đổi base hex bất kỳ → debounce 150ms regenerate full set;
  click swatch bất kỳ → set active; mode pill → đổi semantic alias
  realtime không cần sinh lại scale (giữ bảng màu cố định).
- Dev fallback `DEV_FALLBACK_SET = suggestPalette('#7C3AED', 'light',
  'Palette mẫu').set` — UI browser mode có palette violet mẫu phủ đủ
  4 scale + semantic + status để test mọi tính năng mà không cần
  build Tauri.
- Capabilities tối thiểu: `core:default` + `dialog:default` +
  `dialog:allow-open` + `dialog:allow-save` + `opener:default` +
  `opener:allow-open-path`. Không có fs plugin (Rust tự đọc qua
  `std::fs`), không shell, không http, không telemetry.
- Phase alpha v1 chưa có: preset sync Firebase cross-device
  (14.4.4.b), versioning + diff 2 phiên bản palette side-by-side
  (14.4.4.c), import Adobe ASE / Sketch `.sketchpalette` / `.clr`
  macOS (14.4.4.d), output `color(display-p3 …)` gam rộng +
  OKLCH/OKLAB perceptual color space (14.4.4.e), font pairing tích
  hợp với TrishFont (dời Phase 14.5+), accessibility simulator
  color-blindness (deuteranopia/protanopia/tritanopia, dời 14.5+).

### Added (Phase 14.5.1 — QA doctor preflight + consistency audit)
- `scripts/qa/doctor.mjs` — node ESM zero-deps (~380 dòng) chạy offline
  kiểm **16 nhóm check** cho ecosystem 10 desktop app + 4 shared
  package, bắt config drift trước khi chạy `cargo tauri dev` hay
  `tauri build` (Rust build mất vài phút, tránh compile xong mới
  phát hiện hai app cùng port 1432).
- **Kiểm cấu hình:** (1) dev port + HMR port khớp bảng canonical
  (1420/1421 launcher → 1438/1439 design, không app nào trùng nhau),
  (2) Tauri identifier `vn.trishteam.<app>` đúng format + không trùng,
  (3) 14 file bắt buộc mỗi app (package.json / vite.config.ts /
  tsconfig.json / index.html / src/{main,App}.tsx + styles.css /
  README.md / src-tauri/{Cargo.toml, tauri.conf.json, build.rs,
  src/{main,lib}.rs, capabilities/default.json} + icons/ dir).
- **Kiểm bảo mật:** (4) capability whitelist — **cấm** 6 permission
  nhạy cảm `shell:default`, `shell:allow-execute`, `shell:allow-kill`,
  `shell:allow-spawn`, `http:default`, `http:allow-http-request`,
  (5) CSP không chứa `'unsafe-eval'` + `connect-src` (nếu có)
  whitelist firebaseio / googleapis / trishteam.io.vn / `'self'`.
- **Kiểm dependency:** (6) package.json có đủ 4 script
  `dev`/`typecheck`/`tauri:dev`/`tauri:build`, (7) React major = 18.x
  (regex `/^[~^]?18\./`), (8) Vite major = 5.x, (9) `@trishteam/core`
  có khai báo, (10) `@tauri-apps/api` có khai báo.
- **Kiểm build:** (11) `tsc --noEmit` EXIT=0 cho 14 workspace
  (4 package + 10 app), (12) `vitest run packages/core` pass count
  extract từ output (hiện **421/421**).
- CLI flags: `--quick` (skip tsc + vitest, ~0.5 s) cho pre-commit hook,
  `--json` (machine-readable output) cho CI. Mặc định in report
  dạng bảng với icon ✅ / ⚠️  / ❌, block FAIL ở cuối với path +
  expected/actual rõ ràng để đi sửa. Exit 0 = pass, exit 1 =
  có fail entry.
- Root `package.json` thêm 2 script NPM: `pnpm qa:doctor`
  (full) + `pnpm qa:doctor:quick`. `scripts/qa/README.md` chú thích
  bảng port canonical 10 app + 16 check table + quy trình cấp port
  mới (cần app thứ 11 → 1440/1441 và update registry trong
  `doctor.mjs`).
- **Kết quả chạy baseline:** 49 pass, 0 warn, 0 fail — toàn ecosystem
  sạch drift, sẵn sàng cho smoke test thực tế trên máy Trí
  (Phase 14.5.2+).

### Added (Phase 14.5.2 — Rust-side audit + placeholder icon generator)
- `scripts/qa/rust-audit.mjs` — node ESM zero-deps (~300 dòng) bù
  chỗ `doctor.mjs` chưa chạm tới: Rust layer 10 app. Kiểm **6 nhóm
  check**, exit 0/1, hỗ trợ `--json` cho CI.
- **(1) Cargo deps consistency:** parser gộp `[dependencies]` +
  `[build-dependencies]` + `[target.*.dependencies]` (vì `tauri-build`
  thường nằm trong `[build-dependencies]`) → audit `tauri` +
  `tauri-build` major 2.x, `serde`/`serde_json` major 1, optional
  `walkdir` major 2, `dirs` major 5, `sysinfo` 0.30, `kamadak-exif`
  0.5, `imagesize` 0.13, `ttf-parser` 0.20 — accept `~`/`^` prefix.
- **(2) invoke_handler surface:** regex `#[tauri::command]` → fn name,
  đối chiếu với list trong `tauri::generate_handler![…]` — báo
  orphan (`#[command]` nhưng không register) + unknown (register
  nhưng không có fn). Kết quả 10 app: 28 command đều register đúng.
- **(3) Data-dir isolation:** extract `APP_SUBDIR: &str = "…"` const
  trong `lib.rs` (4 app: TrishNote / TrishLibrary / TrishSearch /
  TrishDesign), fallback detect `app.path().app_data_dir()` + đọc
  Tauri `identifier` cho Tauri-auto-isolate path. Collision map
  key=`kind:value.toLowerCase()` — 10 app không trùng nhau.
- **(4) Icon files:** require 5 file `32x32.png` ≥200 B / `128x128.png`
  ≥1.5 KB / `128x128@2x.png` ≥3 KB / `icon.ico` ≥1 KB / `icon.icns`
  ≥5 KB trong `src-tauri/icons/`. Audit ban đầu phát hiện **toàn bộ
  10 app thiếu cả 5 file** — nếu để chạy `cargo tauri build` sẽ fail
  ngay. Giải quyết bằng generator mới (xem dưới).
- **(5) Window config:** `app.windows[0].minWidth ≥480`, `minHeight ≥320`,
  warn khi `resizable: false`. 10 app đều pass.
- **(6) Bundle targets:** whitelist `all`/`msi`/`nsis`/`app`/`dmg`/
  `deb`/`rpm`/`appimage`. 10 app đều dùng `"all"`.

- `scripts/qa/gen-icons.py` — Pillow + custom ICNS writer (~220 dòng)
  sinh placeholder icon set cho 10 app, mỗi app theme riêng:
  - **TrishLauncher** slate `#334155→#64748B` glyph `L`
  - **TrishCheck** cyan `#0891B2→#06B6D4` glyph `K`
  - **TrishClean** red `#DC2626→#F87171` glyph `C`
  - **TrishFont** amber `#D97706→#FBBF24` glyph `F`
  - **TrishType** purple `#9333EA→#C084FC` glyph `Y`
  - **TrishImage** pink `#DB2777→#F472B6` glyph `I`
  - **TrishNote** green `#16A34A→#4ADE80` glyph `N`
  - **TrishLibrary** teal `#0D9488→#2DD4BF` glyph `B`
  - **TrishSearch** orange `#EA580C→#FB923C` glyph `S`
  - **TrishDesign** violet `#7C3AED→#4F46E5` glyph `D`
  - Compose: linear gradient TL→BR, rounded corner 22% radius, inner
    glow outline, DejaVu Sans Bold glyph 55% size với shadow blur.
  - Output mỗi app: `icon.png` 1024×1024, `32x32.png`, `128x128.png`,
    `128x128@2x.png` (256×256), `icon.ico` multi-size 16/32/48/64/
    128/256, `icon.icns` (OSType `ic07`/`ic08`/`ic09`/`ic10` + BE u32
    size + PNG payload — viết thủ công vì Pillow không write ICNS).
  - CLI: `python3 gen-icons.py` (all 10) hoặc
    `python3 gen-icons.py trishdesign` (1 app).
- **Canonicalize `tauri.conf.json` bundle.icon array:** 9/10 app đã
  drift khỏi chuẩn (4-entry, thiếu `128x128@2x.png`) — chỉ trishlauncher
  đúng. Đưa cả 10 về đúng thứ tự 5-entry:
  ```json
  ["icons/32x32.png", "icons/128x128.png",
   "icons/128x128@2x.png", "icons/icon.icns", "icons/icon.ico"]
  ```
- Root `package.json` thêm 2 script: `pnpm qa:rust` + `pnpm qa:all`
  (chạy `doctor.mjs --quick` + `rust-audit.mjs` liên tục,
  recommended preflight trước `tauri dev`).
- **Kết quả chạy baseline sau fix:** 24 pass, 0 warn, 0 fail — Rust
  layer sạch drift, sẵn sàng `cargo tauri build` khi Trí chạy máy
  thật (Phase 14.5.3 + 14.6).

### Added (Phase 14.5.3 — TESTPLAN.md smoke test checklist × 10 app)
- **10 file `apps-desktop/<app>/TESTPLAN.md`** — viết sẵn bộ checklist
  click-through cho từng app để khi Trí chạy `cargo tauri dev` trên
  máy thật (Windows/macOS/Linux) chỉ cần tick ✅ từng bước, không
  phải tự nghĩ step từ đầu. Mỗi file chuẩn hoá 6 section:
  - **Tiền đề** (prerequisites): qa:all pass / Rust toolchain /
    folder test mẫu / xoá data-dir cũ để test fresh.
  - **Smoke test** step-by-step 7-23 bước (tuỳ độ phức tạp app) —
    bao phủ mọi Tauri command đã register (**28 command tổng cho
    10 app**), mọi UI pane / modal / dev fallback / edge case
    (cap file size, hidden folder skip, VN diacritic fold, atomic
    rename, HTML escape snippet anti-injection).
  - **Kết quả mong đợi** với số đo cụ thể: memory resident
    ceiling, elapsed bound, BM25 parameter (k1=1.2, b=0.75),
    contrast rating threshold (AAA ≥7, AA ≥4.5, AA-large ≥3),
    face bucket threshold, scan max_entries cap.
  - **Cleanup** — data-dir path chính xác cho 3 OS:
    Windows `%LocalAppData%\TrishTEAM\<App>\`, macOS
    `~/Library/Application Support/TrishTEAM/<App>/`, Linux
    `~/.local/share/TrishTEAM/<App>/`.
  - **Platform-specific notes** — line ending CRLF↔LF, sysinfo
    WMI/sysctl/procfs, HEIC codec availability, APFS vs NTFS
    atomic rename, xdg-open/Finder/plugin-opener behavior,
    Windows `%TEMP%` vs macOS `/var/folders` vs Linux `~/.cache`,
    dot-prefix hidden folder skip.
  - **Giới hạn v1** — liệt kê tường minh mọi feature CHƯA wire để
    QA không test (tránh bug report "missing feature"): ví dụ
    TrishNote chưa Firebase sync / chưa push notification; TrishSearch
    chưa Tantivy persistent / chưa PDF extract; TrishDesign chưa
    sync / chưa import ASE / chưa OKLCH / chưa color-blind simulator;
    etc.
- **`apps-desktop/TESTPLAN.md`** master index: bảng thứ tự chạy 10
  app theo port dev tăng dần (app không-login trước: launcher/check/
  clean/font/type/image → app cần-login sau: note/library/search/
  design), quy trình 5-bước preflight→build→checklist→bug-report→
  fix, format BUG `yyyy-mm-dd #N` chuẩn (App/Bước/OS/Expected/Actual/
  Log/Screenshot).
- **Criteria chấp nhận ship v2.0.0-alpha** (ghi trong master index):
  - 10/10 app chạy `cargo tauri dev` không lỗi compile
  - 10/10 app render UI tree đầu tiên ≤ 5 s rebuild
  - 10/10 app smoke test mục 2 pass
  - 0 DevTools console error đỏ ở trạng thái idle
  - Memory resident < 500 MB mỗi app độc lập
  - `pnpm qa:all` pass 100%
  - `vitest run packages/core` pass 421/421
  - Process Monitor / opensnoop / strace xác nhận không app nào
    ghi ra ngoài data-dir của chính nó
  - Không HTTP leak khi offline (đóng WiFi → app vẫn render được)
- Kết thúc Phase 14.5 config-first. Phase 14.5 (✅) đánh dấu hoàn tất
  preflight layer — sẵn sàng cho Phase 14.6 (Release v2.0.0 bundle
  installer + code-sign). Smoke test thực tế + bug-fix sẽ ghi dưới
  dạng sub-phase `.b`/`.c` cho từng app khi phát hiện.

### Added (Phase 14.5.4 — Batch compile matrix + fix Vite alias subpath bug)
- **`scripts/qa/build-all.mjs`** (~300 dòng Node ESM, zero deps) —
  chạy `cargo check --manifest-path src-tauri/Cargo.toml --message-format
  short` + `vite build --mode production` cho cả 10 app theo thứ tự port
  dev tăng dần (1420 → 1438). Dùng chung một `CARGO_TARGET_DIR=<root>/
  target-desktop/` để tái dùng incremental cache giữa các app — từ ~50+
  phút (nếu mỗi app 1 target dir riêng) rút xuống ~20-25 phút lần đầu,
  ~3-5 phút rebuild.
  - CLI flags: `--only=app1,app2` (subset), `--skip-cargo` / `--skip-vite`
    (chạy lẻ), `--json` (machine-readable cho CI), `--quiet` (không stream
    stdout realtime).
  - Pre-flight check: `cargo` có trong PATH + binary `vite` tồn tại
    trong `node_modules/.bin/` (Windows auto-thử `vite.cmd`); thiếu →
    exit 2 không chạy nữa.
  - Mỗi step stream stdout realtime (passthrough), capture stderr tail
    ≤4 KiB để in ở Summary fail-detail.
  - Exit code: 0 all pass / 1 any fail / 2 prereq missing.
  - Output cuối cùng: bảng matrix 10×2 cột (APP × {cargo check, vite
    build}) với status ✅/❌ + elapsed giây + wall-time tổng.
- **Phát hiện bug thật ngay lần chạy đầu tiên** (chính lý do viết script
  này trước khi Trí chạy `cargo tauri dev` máy thật):
  - 10 file `apps-desktop/<app>/vite.config.ts` có alias
    `'@trishteam/core': path.resolve(__dirname, '../../packages/core/src/index.ts')`.
  - Alias prefix-match nên `import { X } from '@trishteam/core/apps'`
    bị Vite replace thành `/…/packages/core/src/index.ts/apps` → **ENOTDIR**.
  - tsc pass được vì dùng tsconfig `paths` mapping độc lập (compile time
    không resolve physically) — bug chỉ lộ khi `vite build`.
- **Fix triệt để:** Gỡ hoàn toàn alias `@trishteam/core` khỏi 10
  `vite.config.ts`. pnpm workspace đã symlink `node_modules/@trishteam/
  core -> packages/core/`, Vite tự dùng `exports` field trong
  `packages/core/package.json` (13 subpath: `.`, `./apps`, `./search`,
  `./notes`, `./qr`, `./clean`, `./fonts`, `./type`, `./images`,
  `./library`, `./fulltext`, `./design`) resolve đúng cho cả root và
  subpath.
- **Kết quả sau fix baseline:**
  - `pnpm qa:build-all:vite` → **10/10 vite build pass** trong ~13 giây
    wall time, 0 fail, bundle ~148–164 KiB JS gzip ~48–53 KiB mỗi app.
  - `vitest run packages/core` → 421/421 pass không đổi.
  - `pnpm qa:all` → 49 + 24 = 73 pass / 0 fail / 0 warn không đổi.
- **`.gitignore`** bổ sung `target/`, `target-desktop/`, `*.rs.bk`,
  `Cargo.lock.bk` — tránh commit cache Cargo ~3-5 GiB sau lần đầu chạy
  build-all.
- **Root `package.json`** thêm 2 script:
  - `pnpm qa:build-all` — batch compile full matrix
  - `pnpm qa:build-all:vite` — chỉ vite (nhanh ~13s cho rebuild loop
    khi thay đổi UI không đụng Rust)
- **`scripts/qa/README.md`** bổ sung section `build-all.mjs` với ví dụ
  output bảng matrix + flag table + thời gian reference cho Windows
  Ryzen 7 5800H (lần đầu ~18-22 phút, rebuild ~3-5 phút).
- Sandbox không có Rust toolchain nên cargo check không verify được
  trong session này — Trí sẽ chạy `pnpm qa:build-all` lần đầu trên máy
  thật để verify cả 2 step × 10 app. Sau 14.5.4 → chuyển qua spot-check
  UI test 3 app đại diện (trishlauncher + trishfont + trishnote) theo kế
  hoạch Phase 14.5.

### Fixed (Phase 14.5.4.b — Windows setup fixes khi chạy trên máy Trí lần đầu)

Khi Trí chạy `pnpm qa:build-all` lần đầu trên Windows 11 (PowerShell)
đã phát lộ 3 bug mà Linux sandbox không thấy:

1. **Windows path bug `C:\C:\...`** — `new URL(import.meta.url).pathname`
   trên Windows trả về `/C:/Users/ADMIN/...` (có leading slash + forward
   slash). Khi `path.resolve` xử lý sẽ nested drive letter thành
   `C:\C:\Users\ADMIN\...`, làm QA script không tìm được vite binary.
   Fix: thay `new URL().pathname` bằng `fileURLToPath(import.meta.url)`
   trong 3 QA script:
   - `scripts/qa/doctor.mjs`
   - `scripts/qa/rust-audit.mjs`
   - `scripts/qa/build-all.mjs`

2. **pnpm workspace protocol bug** — 14 `package.json` khai báo
   `"@trishteam/core": "*"` (npm cho phép ở workspace root) nhưng pnpm
   sẽ fetch từ registry → `ERR_PNPM_FETCH_404`. Fix: đổi sang
   `"@trishteam/core": "workspace:*"` ở:
   - 10 app trong `apps-desktop/` (trishlauncher có thêm 3 dep:
     `@trishteam/ui`, `@trishteam/adapters`, `@trishteam/core`)
   - `packages/ui/package.json`
   - `packages/data/package.json`
   - Cập nhật `apps-desktop/trishlauncher/README.md` (architecture
     note cũ nói "No workspace:* protocol" giờ đã lỗi thời, viết lại
     để phản ánh đúng pnpm behavior)

3. **Doctor vitest path** — pnpm isolate-symlink mode để vitest trong
   `packages/core/node_modules/.bin/` thay vì root (npm behavior).
   Fix: `scripts/qa/doctor.mjs` thử cả 2 vị trí:
   ```
   packages/core/node_modules/.bin/vitest  (pnpm)
   node_modules/.bin/vitest                (npm)
   ```
   + đổi cwd khi chạy về `packages/core` cho đúng working directory.

**Verify sau fix (sandbox):**
- `pnpm install` → resolved 765 deps, 0 error.
- `pnpm qa:doctor` → 49 pass, 0 fail (421 vitest pass).
- `pnpm qa:rust` → 24 pass, 0 fail.
- `pnpm qa:build-all:vite` → 10/10 app pass, ~13.2s.

**Next cho Trí trên Windows:**
```powershell
Remove-Item -Recurse -Force node_modules
pnpm install
pnpm qa:build-all      # full matrix cargo check + vite × 10 app
```

### Fixed (Phase 14.5.4.c — Rust borrow checker bug trong trishclean/scan_dir)

Lần đầu chạy `pnpm qa:build-all` trên máy thật, cargo check đi qua 9/10
app pass, vite build 10/10 pass. Chỉ fail 1 chỗ thật:

```
trishclean · cargo check · exit=101
src\lib.rs:89:17: error[E0506]: cannot assign to `errors` because
                  it is borrowed: `errors` is assigned to here but
                  it was already borrowed
src\lib.rs:89:26: error[E0503]: cannot use `errors` because it was
                  mutably borrowed: use of borrowed `errors`
```

**Root cause:** trong hàm `scan_dir`, code dùng `filter_map(|e| match e
{ Ok(ent) => Some(ent), Err(_) => { errors += 1; None } })` để đếm
WalkDir error. Closure capture `&mut errors` suốt lifetime iterator, đâm
với assign `errors += 1` ở nhánh `entry.metadata()` trong loop body →
E0503/E0506. Code này từ Phase 14.3.1 (TrishClean rebuild) — tsc không
thấy vì tsc chỉ check TS; clippy cũng không thấy vì cargo check chưa
từng chạy trong sandbox (thiếu Rust toolchain).

**Fix:** gỡ closure `filter_map`, thay bằng `match entry_result` inline
trong loop body (pattern giống `entry.metadata()` ngay dưới). Iterator
thành `WalkDir::new(...).into_iter()` raw; 2 nhánh `Err` cùng pattern
`errors = errors.saturating_add(1); continue;` → borrow check sạch, hành
vi y hệt (WalkDir error không được tính vào entries, metadata error
cũng vậy).

Sau fix Trí re-run `pnpm qa:build-all` sẽ thấy 20/20 pass (10 cargo + 10
vite). Đây là bug thật Phase 14.5.4 batch compile matrix đã bắt được —
đúng lý do viết script này trước khi chạy `cargo tauri dev` trên máy
thật.

**File thay đổi:** `apps-desktop/trishclean/src-tauri/src/lib.rs:70-107`.

### Added (Phase 14.5.5.a — TrishLauncher v1: 10 app + logo 1024×1024)

Trí chạy `pnpm tauri dev` lần đầu trên Windows 11 sau Phase 14.5.4.c, phát
hiện launcher chỉ hiển thị 4 app (trishfont + trishnote + trishclean +
trishimage) và không có logo nào — topbar là hình tam giác `▲`
placeholder, card không có icon. Mục tiêu Phase 14.5.5.a là **chốt bộ
mặt launcher v1**: 10 app đủ với icon PNG 1024×1024 đã thiết kế sẵn.

**Seed registry mở rộng — `apps-desktop/trishlauncher/src/apps-seed.ts`:**

Từ 4 app → 9 app (launcher không show chính nó trong grid). Bổ sung
trishcheck, trishtype, trishlibrary, trishsearch, trishdesign với shape
`AppRegistry` đầy đủ (id/name/tagline/version/size_bytes/status/
login_required/platforms/download). Tagline soạn ngắn gọn 1 dòng:

- **TrishCheck** — "System info + benchmark máy"
- **TrishType** — "Text editor CRDT multi-caret"
- **TrishLibrary** — "Thư viện PDF/epub + cite APA/IEEE"
- **TrishSearch** — "Full-text search BM25 offline"
- **TrishDesign** — "Color palette WCAG + design tokens"

Đồng thời promote **TrishImage** từ `beta` → `released` (đã rebuild xong
Phase 14.3.4), chỉnh **TrishNote** login_required `user` → `none` (khớp
với thiết kế offline-first Phase 14.4.1), tagline thống nhất giữa các
app.

**Icon registry — `apps-desktop/trishlauncher/src/icons/index.ts` (mới):**

Static import 10 PNG 1024×1024 vào Vite bundle — tổng ~780 KiB (chấp
nhận được vì launcher là desktop app, không phải SPA web cần
first-paint nhanh). Vite hash từng file → cache-bust tự động khi thay
icon. Export:

- `APP_ICONS: Record<string, string>` — map `appId → hashed URL` cho 10 app.
- `LAUNCHER_ICON` — alias cho trishlauncher (dùng ở topbar brand).
- `iconFor(appId): string | undefined` — defensive fallback, trả
  undefined nếu app không có icon (v1 không xảy ra, để đó cho v2+).

**vite-env.d.ts (mới):** `/// <reference types="vite/client" />` để TS
nhận module type cho `.png` import.

**UI thay đổi — `apps-desktop/trishlauncher/src/App.tsx`:**

- Topbar brand: `<span className="logo">▲</span>` → `<img
  className="brand-logo" src={LAUNCHER_ICON} alt="" aria-hidden
  width={40} height={40} />`. Không còn tam giác placeholder.
- AppCard: thêm icon 48×48 bên trái card-head, text (h3 + badge) flex
  column bên phải. Fallback `<div className="app-icon
  app-icon-fallback">` hiển thị chữ đầu tên app nếu thiếu PNG —
  defensive, không xảy ra ở v1.

**CSS — `apps-desktop/trishlauncher/src/styles.css`:**

- `.brand .logo` → `.brand .brand-logo` — width/height 40×40,
  border-radius 10px, object-fit cover.
- `.card-head` chuyển sang flex-row gap 12px align center (trước là
  flex-column). Thêm `.card-head-text` flex-column gap 4px min-width 0
  để tên app dài không đẩy layout.
- `.app-icon` — 48×48, border-radius 12px, object-fit cover,
  flex-shrink 0 để icon không bị méo khi card hẹp.
- `.app-icon-fallback` — border 1px, font 22px bold accent color, hiển
  thị chữ đầu tên app căn giữa.

**Tổng kết Phase 14.5.5.a:**
- 10 PNG icon thật (256×256 RGBA alpha, tổng ~345 KiB) được bundle
  static qua Vite — reuse từ `apps/trishlauncher/src/trishlauncher/
  resources/logos/` (bản Qt legacy), đây là những logo Trí đã xóa
  background (navy T + motif trên nền trong suốt). Placeholder gradient
  + chữ cái generate bằng `scripts/qa/gen-icons.py` đã bị thay thế hoàn
  toàn — user không còn thấy ô F/N/C/K/Y/I/B/S/D nữa.
- Seed registry đầy đủ 9 app + launcher tự xem icon qua `LAUNCHER_ICON`.
- Dark theme fix: icon alpha với navy đậm bị "chìm" trên card tối, nên
  `.app-icon` + `.brand-logo` giờ có nền trắng cố định (`#ffffff`) +
  padding nhẹ + inset border 1px — pattern App Store / Play Store, tile
  trắng không đổi theo theme để logo luôn đọc được. `object-fit` đổi
  `cover` → `contain` để không crop góc motif.
- Sau khi user pull + `pnpm tauri dev`, launcher v1 hiển thị đúng 9
  card app với logo thật + topbar brand có icon launcher. Badge
  released/beta/coming_soon giữ nguyên như cũ.

**File thay đổi:**
- `apps-desktop/trishlauncher/src/apps-seed.ts` — 9 app (không phải 4).
- `apps-desktop/trishlauncher/src/App.tsx` — brand logo img + AppCard
  icon + fallback.
- `apps-desktop/trishlauncher/src/styles.css` — .brand-logo, .app-icon,
  .app-icon-fallback, .card-head-text, .card-head adjust. White tile +
  padding + inset border cho dark theme contrast fix.
- `apps-desktop/trishlauncher/src/icons/index.ts` (mới).
- `apps-desktop/trishlauncher/src/vite-env.d.ts` (mới).
- `apps-desktop/trishlauncher/src/icons/*.png` × 10 (mới, 256×256 RGBA
  từ Qt legacy folder).

### Added (Phase 14.5.5.b — App Detail Modal)

**Vấn đề:**
Launcher Phase 14.5.5.a chỉ hiện card tóm tắt (name + tagline + status
+ 3 meta: version/size/login). Click nút "Tải về / Mở" mở URL ngay —
user không biết app làm gì cụ thể, nền tảng nào support, changelog ra
sao. Trí yêu cầu: "Tôi muốn thể hiện 10 app và mỗi app sẽ hiện popup
của từng app... Tôi muốn chuẩn từng app chốt sổ luôn."

**Giải pháp:** App Detail Modal — click card bất kỳ đâu → popup chi
tiết, giữ nút "Tải về / Mở" là primary CTA duy nhất.

**File mới:**
- `apps-desktop/trishlauncher/src/apps-meta.ts` — `APP_META:
  Record<string, AppMeta>` cho 10 app. Mỗi app có 5 `features` bullet
  + 1 `accent` hex. **Features phản ánh đúng implementation Phase
  14.3/14.4** (không dùng marketing copy của `website/data/apps-meta.
  ts`). Ví dụ TrishCheck: "CPU benchmark SHA-256 trên buffer 50 MB",
  TrishClean: "Staged delete + undo 7 ngày", TrishType: "CRDT RGA text
  merge". Accent color chọn theo tâm trạng app: TrishClean đỏ
  (#DC2626), TrishCheck xanh lá (#16A34A), TrishType hồng (#EC4899),
  TrishDesign tím (#6D28D9)…
- `apps-desktop/trishlauncher/src/components/AppDetailModal.tsx` — full
  modal component. Props: `app`, `currentPlatform`, `onClose`,
  `onInstall`, `onOpenExternal`. Layout:
  - Header: icon 72×72 (cùng white tile pattern) + name H2 + tagline +
    badge status. Top border 4px accent color từ APP_META.
  - Section "Tính năng chính": 5 bullet từ `app.features` với dot
    accent color.
  - Section "Thông tin phát hành": grid 4 cell (Phiên bản / Dung
    lượng / Truy cập / Phát hành nếu có release_date).
  - Section "Nền tảng hỗ trợ": chip list tất cả platform support, chip
    current platform highlight accent + tag "máy này". Nhãn VN:
    "Windows (x64)", "macOS (Apple Silicon)", "Zalo Mini App"…
  - Section "Changelog" (nếu `app.changelog_url` tồn tại): link mở
    browser qua `onOpenExternal`.
  - Footer: "Đóng" (ghost) + primary CTA giống AppCard ("Tải về / Mở"
    / "Sắp ra mắt" / "Chưa hỗ trợ máy này").
  - A11y: `role="dialog"`, `aria-modal="true"`, `aria-labelledby`,
    click-overlay-to-close, Esc key global listener.

**File sửa:**
- `apps-desktop/trishlauncher/src/App.tsx`:
  - Import `APP_META` + `AppDetailModal`.
  - Thêm `useState<string | null>` cho `selectedAppId`.
  - `mergeRegistry(SEED_REGISTRY, APP_META)` (không còn `{}` rỗng).
  - `selectedApp` useMemo lookup theo id.
  - Helper `handleInstall(app)` dùng chung cho card CTA + modal CTA.
  - AppCard restructure: `card-head` + `tagline` bọc trong button
    `.card-head-btn` click → `setSelectedAppId(app.id)`. Thêm row
    `.card-actions` 2 nút flex 1: "Chi tiết" (ghost) + "Tải về / Mở"
    (primary).
  - Render `<AppDetailModal>` conditional khi `selectedApp` truthy.
- `apps-desktop/trishlauncher/src/styles.css` — thêm block CSS modal:
  - `.card-head-btn`: reset button styling, width 100%, hover bg accent
    mờ 4%, focus-visible outline accent.
  - `.card-actions`: flex gap 8px, buttons flex 1 chia đều.
  - `.modal-overlay`: fixed inset 0, rgba(0,0,0,0.55) + backdrop-filter
    blur 2px, flex center, z-index 1000, `modal-overlay-in` animation
    fade 150ms.
  - `.modal-dialog`: 640px max-width, max-height viewport-48px, border
    radius 16px, shadow 0 20px 60px rgba(0,0,0,0.35), entry animation
    `modal-dialog-in` fade + translateY 8px + scale 0.98 → 1, 180ms.
  - `.modal-close`: absolute top-right, 32×32 button ×.
  - `.modal-head`: border-top 4px accent (inline style override từ
    prop), icon + text 2-col flex, padding 24 24 20.
  - `.modal-icon`: 72×72 white tile + padding 6 + inset border (cùng
    pattern với card icon).
  - `.modal-body`: flex col gap 20.
  - `.modal-features`: list không dấu, bullet custom `::before` dot
    6×6 accent color.
  - `.modal-meta`: grid auto-fit minmax 140px, bg var(--bg), border
    radius 10.
  - `.modal-platforms` + `.platform-chip`: chip inline-flex border
    var(--border), `.platform-chip-current` accent outline + bg 8%.
    `.platform-current-tag` pill solid accent trắng chữ.
  - `.modal-link`: button style như text-link accent.
  - `.modal-foot`: flex end gap 10, padding 16 24 20, border-top.

**Kết quả:**
- Click bất kỳ đâu trên card → mở modal chi tiết.
- Click nút "Chi tiết" ghost → mở modal (alias explicit).
- Click nút "Tải về / Mở" primary → mở URL download trực tiếp
  (hành vi Phase 14.5.5.a giữ nguyên).
- Trong modal: click "Tải về / Mở" mở URL + auto-close modal.
- Esc hoặc click ngoài dialog → close modal.
- Accent color mỗi app phản chiếu ở border top modal + bullet dot
  features + chip current platform → tạo identity riêng cho từng app.

### Added (Phase 14.5.5.c — Launch detection)

**Vấn đề:**
Launcher Phase 14.5.5.b có modal chi tiết nhưng nút primary vẫn luôn
là "Tải về / Mở" mở URL download — cho dù user đã cài app rồi. User
muốn "Mở" để chạy app ngay, không cần qua browser + download page
nữa. Check installed state cũng giúp user biết mình đang có app nào
trong máy mà không phải mở Start menu / Launchpad.

**Giải pháp:** Path probe — với mỗi app × platform, lưu list candidate
path (install location mặc định Tauri), check exists() trong Rust,
button primary đổi label theo state.

**File mới:**
- `apps-desktop/trishlauncher/src/install-types.ts` — local types:
  `InstallCandidates` (`Partial<Record<Platform, string[]>>`),
  `InstallState` ('installed' | 'not_installed'), `InstallDetection`
  ({id, state, path: string | null}), `InstallProbe` ({id,
  candidates}).
- `apps-desktop/trishlauncher/src/install-candidates.ts` —
  `INSTALL_CANDIDATES: Record<string, InstallCandidates>` cho 9 app
  (launcher tự exclude). Mỗi app × 5 platform × 2-3 candidate path:
  - Windows: `%LOCALAPPDATA%\Programs\<App>\<App>.exe` (NSIS
    current-user) + `%PROGRAMFILES%\<App>\<App>.exe` (NSIS all-users).
  - macOS: `/Applications/<App>.app` + `~/Applications/<App>.app`.
  - Linux: `~/.local/share/applications/vn.trishteam.<id>.desktop` +
    `/usr/share/applications/...` + `/usr/bin/<id>`.
  App name PascalCase (TrishCheck, TrishClean…) theo Tauri
  `productName` convention.
- `apps-desktop/trishlauncher/src/cta.ts` — shared CTA helper
  `resolveCta(app, platform, detect)` trả `{label, disabled}` theo
  4 state: installed → "Mở" | coming_soon → "Sắp ra mắt" disabled |
  released no download → "Chưa hỗ trợ máy này" disabled | default →
  "Tải về". Tách file riêng để AppCard + AppDetailModal reuse, không
  bị circular import (modal import từ parent component).

**File sửa:**
- `apps-desktop/trishlauncher/src-tauri/src/lib.rs` — 2 Tauri command
  mới + helper:
  - `expand_path(raw)` → expand `~/`, `%VAR%` (Windows), `$VAR` +
    `${VAR}` (Unix) cross-platform. Guard 8 iteration chống infinite
    loop với env var chứa `%`. Char-based iteration cho Unix expansion
    để an toàn với username unicode.
  - `#[tauri::command] detect_install(probes: Vec<InstallProbe>) ->
    Vec<InstallDetection>` — probe từng app, path đầu tiên
    `Path::exists()` = installed với full resolved path, không thì
    not_installed.
  - `#[tauri::command] launch_path(path: String) -> Result<String,
    String>` — guard empty + exists check + `std::process::Command`
    spawn: Windows `cmd /c start "" <path>`, macOS `open -a <path>`,
    Linux `xdg-open <path>`. Fallback cfg cho OS lạ. Return "ok" khi
    spawn thành công, Err cho UI toast.
  - Register 2 command trong `generate_handler![...]`.
  - KHÔNG cần thêm capability — Tauri custom command luôn callable
    không qua plugin permission system (khác `opener:allow-open-url`).
- `apps-desktop/trishlauncher/src/tauri-bridge.ts` — 2 wrapper:
  - `detectInstall(probes)` trả array not_installed trong browser
    dev mode (không có Tauri) → UI vẫn render "Tải về" cho tất cả.
    Trong Tauri catch lỗi invoke, fallback same default an toàn.
  - `launchPath(path)` — throw để caller fallback download URL
    (`handleInstall` catch → openExternal).
- `apps-desktop/trishlauncher/src/App.tsx`:
  - Import `INSTALL_CANDIDATES` + `InstallDetection`/`Probe` types +
    `detectInstall`/`launchPath` bridge + `resolveCta`.
  - `useState<Map<string, InstallDetection>>` cho `installMap`.
  - `buildProbes(apps, platform)` filter chỉ app có candidate cho
    platform hiện tại.
  - `useEffect` probe install khi `compatApps` hoặc `platform` đổi
    (sau khi sys detect xong). Cancellation flag để tránh stale
    setState khi unmount giữa chừng.
  - `handleInstall` rewrite: nếu installed + có path → `launchPath`
    với catch fallback `openExternal(download.url)`; không → normal
    download flow. App không tồn tại nữa (user xoá giữa chừng) →
    download URL như Phase 14.5.5.b.
  - AppCard thêm `detect: InstallDetection | null` prop, class
    `card-installed` khi installed, badge "✓ Đã cài" bên cạnh badge
    status (wrap trong `.card-head-badges`).
  - AppDetailModal nhận thêm `detect` prop, truyền xuống CTA resolver.
- `apps-desktop/trishlauncher/src/components/AppDetailModal.tsx`:
  - Import `resolveCta` từ `../cta.js` (không từ `../App.js` để tránh
    circular).
  - Prop `detect: InstallDetection | null`.
  - Header wrap badge status + "Đã cài" trong `.modal-head-badges`.
  - Section mới "Đường dẫn cài đặt" khi installed — hiển thị full
    resolved path trong `<code>` monospace, word-break để không tràn
    dialog.
  - CTA footer dùng `resolveCta().label` (không còn hardcode) và
    `.disabled` flag.
- `apps-desktop/trishlauncher/src/styles.css` — 3 block CSS mới:
  - `.badge-installed` — bg accent solid trắng chữ, weight 600, dấu
    ✓ trong text (React), để scan nhanh trong card grid.
  - `.card-head-badges` + `.modal-head-badges` — flex wrap gap 6px
    để 2 badge (status + installed) nằm chung 1 dòng, tự xuống dòng
    khi card hẹp.
  - `.card-installed` — viền trái 3px accent để user scan cả grid
    biết app nào đã cài mà không phải đọc badge.
  - `.modal-install-path` — monospace 12px, bg var(--bg), border
    var(--border), word-break break-all cho Windows path dài.

**Kết quả:**
- Launcher mở → sys_info detect platform → useEffect build probes
  cho 9 app → `detect_install` Rust check từng candidate path ~10ms
  tổng → installMap populated.
- Card nào đã cài: viền trái accent, badge "✓ Đã cài" xanh đậm,
  primary CTA đổi từ "Tải về" → "Mở".
- Click "Mở" → Rust `launch_path` spawn process → app khởi động.
- Modal chi tiết: badge "Đã cài" cạnh status, section "Đường dẫn
  cài đặt" show full path user dễ check install location, CTA đồng
  nhất với card.
- Fallback: nếu `launch_path` fail (app bị user xoá giữa phiên dev,
  path corrupt) → catch → mở download URL → user tải lại từ đầu.
- Browser dev mode (`pnpm dev` không Tauri): `detectInstall` trả
  all not_installed → UI hiện "Tải về" cho 9 app (không crash).

### Added (Phase 14.5.5.c.1 — Dev-mode detection via `%EXE_DIR%`)

**Vấn đề (Trí feedback):**
Sau khi ship 14.5.5.c, Trí chạy `pnpm tauri dev` trong launcher và vẫn
thấy cả 9 app đều hiện "Tải về" — không có badge "Đã cài" nào. Lý do:
path probe chỉ check production install location (`%LOCALAPPDATA%\
Programs\<App>\<App>.exe`), trong khi Trí đang dev nên các app chỉ có
binary tại `target-desktop/debug/trishnote.exe` (sibling của launcher
binary) — không nằm ở bất kỳ production path nào. Phase 14.5.5.c hoạt
động đúng theo spec nhưng UX không verify được trong dev.

**Giải pháp:**
Thêm token đặc biệt `%EXE_DIR%` cho `expand_path()` — resolve về
`current_exe().parent()` (thư mục chứa launcher binary đang chạy).
Trong dev mode, launcher ở `<repo>/target-desktop/debug/trishlauncher
.exe` nên sibling `trishnote.exe` sẽ tồn tại nếu Trí đã từng chạy
`pnpm tauri dev` cho trishnote. Trong production, launcher ở
`%LOCALAPPDATA%\Programs\TrishLauncher\` — thư mục này chỉ có
`TrishLauncher.exe`, không có sibling nào → không false-positive,
probe tiếp tục check path production như cũ.

**File sửa:**
- `apps-desktop/trishlauncher/src-tauri/src/lib.rs` — `expand_path()`
  check `%EXE_DIR%` token trước mọi expansion khác. Resolve qua
  `std::env::current_exe()?.parent()` → `replace("%EXE_DIR%", ...)`.
  Nếu `current_exe()` fail (permission, symlink bị gỡ), giữ token
  nguyên để `Path::exists()` fail sạch.
- `apps-desktop/trishlauncher/src/install-candidates.ts` — thêm path
  `%EXE_DIR%\<appid>.exe` (Windows) / `%EXE_DIR%/<appid>` (Unix) đầu
  list candidate cho mỗi app × mỗi platform. Binary name lowercase
  theo `Cargo.toml` package name (khác với production PascalCase).

**Kết quả:**
- Dev mode: sau khi Trí chạy `pnpm tauri dev` cho trishnote + trishcheck
  (v.v.), các exe đó nằm sibling với launcher exe trong
  `target-desktop/debug/`. Khi mở launcher → `detect_install` check
  `%EXE_DIR%\trishnote.exe` → exists → installed state. Card hiện
  viền trái + badge "Đã cài" + CTA "Mở".
- Production: sau khi cài qua installer, launcher ở
  `%LOCALAPPDATA%\Programs\TrishLauncher\`, các app ở thư mục riêng.
  Sibling check fail → fallback sang path production → detect đúng.
- Click "Mở" dev binary: spawn hoạt động nhưng dev binary cần Vite dev
  server đang chạy để render frontend (HMR pipeline). Không có Vite
  thì window blank. Production binary embed frontend nên chạy clean.

---

### Changed
- `website/lib/apps.ts` dùng helper từ `@trishteam/core/apps` thay vì
  re-implement (mergeRegistry, statusLabel, formatSize, findAppById).
  Public API website giữ nguyên — callsite không phải đổi.
- `website/lib/search/static-sources.ts` + `embeddings.ts` + `types.ts`
  dùng lại `foldVietnamese` + `cosine` từ `@trishteam/core/search` thay
  vì duplicate logic. `rerankByCosine` giữ API cũ để không phá callsite.

---

## [1.0.0] — 2026-04-23 · Go-live

**Phát hành lần đầu** TrishTEAM website + dashboard sinh thái 10 app
desktop đồng bộ mây. Domain chính thức `trishteam.io.vn`.

### Added — Dashboard & widgets
- Dashboard home với 6 widget layout grid: Ecosystem (10 app card),
  QuickNotes, QR Generator, Announcement, Weather, Activity.
- Dark mode mặc định + toggle light mode (ghi nhớ localStorage).
- Ambient gradient decoration (3 blob mờ, emerald/amber/sky).

### Added — Apps
- `/apps` — catalog 10 ứng dụng (ôn thi lái xe, chứng chỉ XD, biển báo
  QC41:2024, cầu VN, TrishNotes, TrishLibrary, TrishFont, TrishQR...).
- Mỗi app có card với logo thật + mô tả + CTA "Tải về" (trỏ
  `/downloads`).

### Added — Auth & user
- Firebase Authentication: email/password + Google OAuth.
- Form đăng ký thu thập Họ tên + Số điện thoại (validate VN format).
- Firestore profile ở `/users/{uid}` với `role: 'user'|'admin'`.
- QuickNotes sync Firestore realtime (offline-first qua IndexedDB).

### Added — Admin
- `/admin` layout với sidebar + role guard (non-admin thấy trang 403).
- `/admin/users` — list user + toggle role (qua API route Admin SDK).
- `/admin/announcements` — composer thông báo toàn site.
- `/admin/reindex` — semantic reindex apps/announcements qua Gemini
  embedding (fallback FNV hash nếu không có API key).
- `/admin/vitals` — Core Web Vitals dashboard (p50/p75/p95 per metric,
  rating distribution, top slow paths).
- `/admin/errors` — error triage với group theo fingerprint + stack
  trace modal.
- `/admin/audit` — activity feed collection-group query toàn hệ thống.

### Added — Search
- `/search` — universal search Fuse.js fuzzy + VN diacritic fold.
- Semantic toggle (40% fuzzy + 60% cosine similarity) qua Gemini
  text-embedding-004.
- Command Palette mở nhanh bằng `Cmd/Ctrl + K`.

### Added — PWA & offline
- Manifest 192/512/maskable icon, theme color emerald + amber.
- Service worker với precache shell + runtime cache fonts/images.
- `/offline` fallback page khi mất mạng.

### Added — SEO & social
- `sitemap.xml` với 5 URL ưu tiên + `robots.txt` opt-out AI crawler
  (GPTBot, ClaudeBot, anthropic-ai...).
- Open Graph + Twitter card với ảnh 1200×630 brand.
- `metadataBase` + canonical URL.

### Added — Observability
- Core Web Vitals telemetry (sendBeacon → `/api/vitals` → Firestore).
- Runtime error tracking (global error + unhandledrejection + React
  ErrorBoundary → `/api/errors`).
- Umami privacy-first analytics self-host ở
  `analytics.trishteam.io.vn` (cookie-less, tôn trọng DNT).

### Infrastructure
- Firestore security rules v2 với helpers `signedIn()`, `isSelf()`,
  `isAdmin()`.
- Firestore indexes cho collection-group `events` + `feedback` +
  `announcements`.
- Firebase Admin SDK server route cho set-role + vitals ingest +
  errors ingest + admin queries.
- Caddyfile mẫu cho Umami reverse proxy (auto Let's Encrypt).

### Known limitations
- 10 app desktop vẫn dùng build pre-v1 (sẽ rebuild ở Phase 14, ~2026-Q3).
- Zalo Mini App ecosystem chưa có (Phase 15).
- Desktop installer chưa sign EV certificate (Phase 17.2).
- Onboarding video chưa quay (Phase 17.3).

---

## Upgrade notes

### Từ pre-release → 1.0.0

Nếu đã chạy preview environment:

1. Bump `NEXT_PUBLIC_APP_VERSION=1.0.0` ở Vercel env.
2. Firebase: chuyển sang project `trishteam-prod` (khác dev).
3. Firestore: deploy lại rules + indexes.
4. Seed admin: `pnpm -C scripts tsx seed-admin.ts --email hosytri77@gmail.com`.
5. Redeploy Vercel production.

---

## [0.9.x] — Preview (2026-04)

Các phase 11.6 → 16.6 đã hoàn tất ở môi trường preview. Xem
`docs/ROADMAP.md` cho chi tiết theo sub-phase.

---

## [1.x] — Phase 17-20 PRODUCTION (2026-04-25 → 2026-04-29)

> **Source of truth chi tiết**: `docs/HANDOFF-MASTER.md` (cập nhật mỗi phiên).
> File này chỉ ghi tóm tắt phase đã release.

### Phase 17 — Desktop apps Tauri 2 release (25-27/04/2026)
- **TrishLauncher v2.0.0-1** — Hub Tauri 2 + tray + auto-update + per-app "Cập nhật"
- **TrishCheck v2.0.0-1** — System info + benchmark + GPU detect
- **TrishClean v2.0.0-1** — Cleaner + undo 7 ngày + staged delete
- **TrishFont v2.0.0-1** — Font manager + Pair AI + AutoCAD .shx
- **TrishLibrary v3.0.0** — All-in-one gộp 4 module (Thư viện · Ghi chú · Tài liệu · Ảnh) + 13 PDF Tools + Tantivy search + Tesseract OCR + cross-module Ctrl+K
- 4 app cũ (TrishNote, TrishImage, TrishSearch, TrishType) deprecated → gộp vào TrishLibrary 3.0

### Phase 18 — TrishAdmin v1.1 (27/04/2026, code done, chưa release)
- 9 panel: Dashboard / Users / Keys / Posts / Audit / Library / Broadcasts / Registry / Settings
- 4 panel mới Phase 19.24: Backup / DatabaseVn / BulkImport / Storage

### Phase 19 — Website production (27-29/04/2026)
- 19.1-19.18: Slim layout, Firebase login, blog, admin panel, 404 custom
- 19.20: 6 database (biển báo 451 / cầu 7549 / đường / quy chuẩn / định mức / vật liệu) + 4 quiz + công cụ VN2000 + Ctrl+K + sitemap
- 19.21: Cert exam BXD 163/2025 (8081 câu, 3.7MB lazy fetch, 25 câu/đề, 60 phút, đậu ≥18)
- 19.22: Web admin hoàn thiện (CRUD users, databases, apps, library, blog ID sequence, countdown realtime, URL shortener TrishTEAM, banner Firestore)
- **19.23: ✅ DEPLOYED PRODUCTION https://trishteam.io.vn** (12 env vars Vercel, base64 service account, ENABLE_EXPERIMENTAL_COREPACK)
- 19.24: TrishAdmin desktop parity — 4 panel mới (Backup/DatabaseVn/BulkImport/Storage), CSS bổ sung 459 dòng

### Phase 20 — TrishLauncher Sync + Web optimization (29/04/2026)
- 20.1 Audit + chốt scope
- 20.2 Fix schema/URL/version/CORS launcher + web /api/apps-registry
- 20.3 Manual update button (force fetch + per-app "Cập nhật")
- 20.4 /downloads sync Firestore (đã có từ 19.22)
- 20.5 SEO + sitemap dynamic blog + Vercel Analytics
- 20.6 PWA (đã có từ 11.9)
- 20.7 Audit Firestore rules (0 gap)
- 20.8 CI/CD release-app.yml + NSIS-only bundles
- Phụ trợ Launcher: tray tooltip, minimize-to-tray toggle (mặc định OFF), bỏ "Đăng nhập", ẩn 4 app deprecated, Việt hóa, self-exclude

### Phase 21 prep — cleanup + observability (29/04/2026)
- A. Cleanup: xóa 4 deprecated apps folder + apps/ Python legacy + 3 workflow .tpack legacy + move release-notes
- B. Sync: apps-registry.json static fallback đồng bộ version v2.0.0-1 / 3.0.0; .gitattributes chuẩn hóa CRLF; CHANGELOG + ROADMAP cập nhật Phase 17-20
- C. Telemetry: tạo @trishteam/telemetry package + wire 7 app + Errors/Vitals panel TrishAdmin
- D. Observability: backup Firestore weekly cron + Sentry wire + vitest coverage baseline

### Pending sau Phase 21 prep
- Phase 21 TrishDesign (AutoCAD plugin + AI RAG TCVN/AASHTO)
- TrishAdmin tag + release v1.1.0 (sau khi telemetry wire)
