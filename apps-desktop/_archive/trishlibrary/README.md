# TrishLibrary — Thư viện tài liệu + Tag AI + Cite APA/IEEE

**Tauri 2** + **React 18** + **@trishteam/core/library**.

Quản lý thư viện sách/PDF/EPUB/Word local-first. Dữ liệu sống trong 1
file JSON nằm trong thư mục dữ liệu của hệ điều hành
(`%LocalAppData%/TrishTEAM/TrishLibrary/library.json` trên Windows,
`~/.local/share/TrishTEAM/TrishLibrary/library.json` trên Linux,
`~/Library/Application Support/TrishTEAM/TrishLibrary/library.json`
trên macOS). Không cloud, không tài khoản, không tracking. OCR Tesseract
sẽ bật ở **Phase 14.4.2.b**, sync Firebase ở **Phase 14.4.2.c**.

## Điểm đặc biệt

- **Tag auto-suggest (AI nhẹ)** — mỗi tài liệu được chấm điểm tag theo 3
  nguồn: (1) keyword rules (có từ `tcvn` → tag `tcvn`, có từ khóa tiếng
  Việt → tag `tiếng việt`, …), (2) co-occurrence log-scale với tag đã
  có trong library, (3) format fallback (PDF → `pdf`, EPUB → `sách`).
  Điểm và lý do hiển thị trong tooltip, bấm để gắn.
- **Cite generator APA 7 / IEEE** — bấm nút **Trích dẫn (N)** ở topbar
  để mở modal list citation cho các tài liệu đang lọc. Đổi style bằng
  pill APA ↔ IEEE. Copy cả block vào clipboard.
- **Scan folder** — chọn 1 thư mục, Rust backend `walkdir` quét đệ quy
  (bỏ `node_modules`, `.git`, `target`, `$RECYCLE.BIN`) và whitelist 10
  extension. Merge thông minh: `path` trùng → chỉ update `sizeBytes` +
  `mtimeMs`, giữ nguyên metadata user đã chỉnh.
- **Mở file bằng app mặc định** — bấm **Mở** sẽ gọi `tauri-plugin-opener`
  để OS mở bằng app liên kết (Acrobat, Word, Calibre, …).
- **Read status 4-enum** — `unread / reading / done / abandoned` thay
  cho GTD inbox/active của TrishNote. Border-left màu theo status.
- **Auto-save debounce 400 ms** — mọi thay đổi tự ghi file. Ghi nguyên
  tử bằng tmp + rename để không corrupt giữa chừng. Cap 20 MiB.
- **Dev fallback** — chạy `pnpm dev` (không có Tauri) sẽ load 6 doc
  giả phủ đủ format (PDF / EPUB / DOCX / MD) + đủ 4 read-status + pha
  trộn chủ đề VN / EN để UI test nhanh.

## Kiến trúc

```
┌──────────────────────────────────────────────────────────┐
│ @trishteam/core/library  — pure TS, Vitest (65 tests)     │
│   types.ts       LibraryDoc, DocFormat, ReadStatus,       │
│                   LibraryDraft, LibrarySummary            │
│   classify.ts    classifyFormat, defaultTitleFromName,    │
│                   stableIdForPath (FNV-1a), enrichRaw,    │
│                   mergeWithExisting                       │
│   tag-suggest    KEYWORD_TO_TAG rules + co-occurrence     │
│                   (log-scale) + format fallback +         │
│                   normalizeLibraryTag                     │
│   validate.ts    validateDraft (caps title 300, note      │
│                   5000, tag 50, 32 tags / doc)            │
│   cite.ts        APA 7 "Last, F. M." + "&"/et al. 7+,     │
│                   IEEE "F. M. Last" + "and"/et al. 6+,    │
│                   formatCitationList                      │
│   aggregate.ts   summarize, filterBy{Format,Status,Tag},  │
│                   searchDocs, sort{Recent,Size,Title},    │
│                   formatBytes                             │
└──────────────────────────────────────────────────────────┘
                         ▲ imported
                         │
┌──────────────────────────────────────────────────────────┐
│ apps-desktop/trishlibrary (React)                         │
│   App.tsx        3-column (sidebar filters / list /       │
│                   detail pane) + CiteModal                │
│   tauri-bridge   loadLibrary / saveLibrary / pickAndScan  │
│                   / export / import / openDocument +      │
│                   DEV_FALLBACK_DOCS                       │
│   styles.css     dark theme, teal accent (#22d3ee)        │
└──────────────────────────────────────────────────────────┘
                         ▲ invoke
                         │
┌──────────────────────────────────────────────────────────┐
│ src-tauri (Rust 1.77)                                     │
│   default_store_location  — dirs crate cross-platform     │
│   load_library(path?)     — seed `[]` nếu file chưa có    │
│   save_library(path?, c)  — validate JSON + atomic write  │
│                              (tmp + rename, 20 MiB cap)   │
│   scan_library(dir, …)    — walkdir recursive +           │
│                              ext whitelist + hidden skip  │
└──────────────────────────────────────────────────────────┘
```

## Domain model

```ts
interface LibraryDoc {
  id: string;              // 'doc_' + FNV-1a(path)
  path: string;            // absolute filesystem path
  name: string;            // basename đã chuẩn hóa
  ext: string;             // lowercase, không có dot
  format: DocFormat;       // pdf | docx | doc | epub | txt | md | html | rtf | odt | unknown
  sizeBytes: number;
  mtimeMs: number;         // từ filesystem
  addedAt: number;         // lần đầu enrich
  updatedAt: number;       // lần cuối user edit metadata

  // User metadata
  title: string;           // default = defaultTitleFromName(name)
  authors: string[];
  year: number | null;
  publisher: string | null;
  tags: string[];
  note: string;            // ghi chú cá nhân (Markdown thô, max 5000 char)
  status: ReadStatus;      // unread | reading | done | abandoned
}

type ReadStatus = 'unread' | 'reading' | 'done' | 'abandoned';
type DocFormat  = 'pdf' | 'docx' | 'doc' | 'epub' | 'txt' | 'md' |
                   'html' | 'rtf' | 'odt' | 'unknown';
```

### Tag suggestion logic

```
suggestTags(doc, tagIndex, limit = 8):
  scores = {}

  (1) Keyword rules — 7 rules built-in:
      tcvn, luật, xây dựng, học, nghiên cứu, code, tiếng việt
      (tiếng việt = Unicode Latin Supplement + Latin Extended A/B/Additional)
      match trong title | name | note | authors  →  score += 0.85

  (2) Co-occurrence với tag đã có:
      for mỗi tag trong library, nếu title/name có chứa chuỗi tag
      hoặc stem → score += 0.3 + 0.3 * log10(1 + count)

  (3) Format fallback:
      pdf → score 'pdf' += 0.4
      docx/doc → score 'word' += 0.4
      epub → score 'sách' += 0.4
      md → score 'markdown' += 0.3
      txt → score 'text' += 0.3

  Lọc: bỏ tag đã có trong doc.tags, sort desc theo score, cut limit.
  Mỗi suggestion kèm reason (human-readable) để hiển thị tooltip.
```

### Citation format

```
APA 7:
  Author, F. M. (YEAR). *Title*. Publisher.
  - 2 tác giả  → "A & B"
  - 3–7 tác giả → "A, B, & C"
  - 8+        → "A, B, C, D, E, F, G, … & Z"

IEEE:
  [n] F. M. Last, F. M. Last, and F. M. Last, "Title," Publisher, YEAR.
  - Dấu phẩy nối, dùng "and" trước tên cuối
  - 7+ tác giả → cắt và thêm "et al."
  - List đánh số [1], [2], ...

Thiếu year → bỏ "(YEAR)" hoặc ", YEAR".
Thiếu publisher → bỏ phần publisher.
```

### Merge policy

```
import JSON   → source of truth theo path (overwrite toàn bộ)
scan folder   → merge: chỉ update sizeBytes + mtimeMs nếu path đã có;
                giữ nguyên title, authors, year, publisher, tags, note,
                status mà user đã chỉnh
```

## Commands

```
pnpm dev          # Vite ở port 1434
pnpm build        # tsc --noEmit + vite build
pnpm tauri:dev    # Rust + Vite full stack
pnpm tauri:build  # production bundle
pnpm typecheck    # tsc chỉ
```

## Thao tác

1. Bấm **📂 Quét thư mục…** → chọn folder chứa sách/PDF → TrishLibrary
   sẽ recursive scan + enrich + merge.
2. Click vào 1 tài liệu bên giữa để mở detail pane bên phải.
3. Điền **Tác giả** (cách nhau dấu phẩy), **Năm**, **NXB**, chọn
   **Trạng thái**, thêm **tag** tay hoặc click suggestion **AI**.
4. Bấm **🔗 Mở file** để mở bằng app mặc định của OS.
5. Lọc nhanh ở sidebar: format, status, top tag. Gõ ở ô search để tìm
   theo title / author / tag.
6. Bấm **🔖 Trích dẫn (N)** ở topbar để copy citation APA/IEEE cho
   danh sách đang lọc.
7. Bấm **⬆ Xuất JSON** / **⬇ Nhập JSON** ở topbar để backup/restore.

## Giới hạn hiện tại (Phase 14.4.2 alpha)

- **Chưa OCR** — PDF scan chưa trích text. Tesseract WASM dời sang
  14.4.2.b.
- **Chưa full-text search** — search chỉ match substring trong
  title/name/note/authors/tags. Lucene/Tantivy dời sang 14.4.3
  (TrishSearch).
- **Chưa sync cloud** — bản alpha thuần local. Firebase sync dời sang
  14.4.2.c.
- **Chưa có highlight/annotation** — không đọc được trực tiếp trong app,
  phải bấm **Mở file** để OS xử lý.
- **Chưa có cover image** — mỗi row chỉ có format chip; cover thumbnail
  từ EPUB/PDF metadata dời sang 14.4.2.d.
- **Cite generator chỉ 2 style** — APA 7 + IEEE. MLA / Chicago / VN
  style (TCVN 7115) dời sang phase sau.
- **Không support nested folder / collection** — phẳng, filter bằng tag.

## Roadmap tiếp theo

- **14.4.2.b**: Tesseract OCR cho PDF scan (extract text để full-text
  search + tag suggest tốt hơn).
- **14.4.2.c**: Firebase Auth + Firestore sync 2-chiều (upsert by id,
  `updatedAt` wins).
- **14.4.2.d**: Cover thumbnail từ EPUB (OPF) / PDF (first page)
  + thumbnail cache.
- **14.4.3**: TrishSearch rebuild (Lucene/Tantivy full-text across
  TrishNote + TrishLibrary).
- **14.4.4**: TrishDesign rebuild (snippet/asset manager).
