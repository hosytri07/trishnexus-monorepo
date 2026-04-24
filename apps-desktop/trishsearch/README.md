# TrishSearch — Full-text search xuyên nguồn (desktop)

**Phase 14.4.3 · 2026-04-24 · v2.0.0-alpha.1**

TrishSearch index và query offline **3 nguồn dữ liệu** của hệ sinh thái TrishTEAM
bằng BM25 thuần TypeScript:

1. **Ghi chú** từ TrishNote (`notes.json`)
2. **Tài liệu** từ TrishLibrary (`library.json`)
3. **File text rời** (`.md`, `.txt`, `.html`, `.rtf`, …) trong folder user chọn

Toàn bộ tokenize / index / rank / snippet highlight nằm ở
`@trishteam/core/fulltext` (pure TS, 66 unit test). Rust chỉ làm file-IO an toàn.

---

## 🏛️ Kiến trúc 3 tầng

```
┌──────────────────────────────────────────────────────────────────┐
│ Tầng 1: @trishteam/core/fulltext  (pure TS, cross-platform)      │
│   • tokenize.ts  — fold VN + stopwords (EN+VN) + lite stem       │
│   • index-build.ts — inverted index, title×3 / tag×2 / body×1   │
│   • query.ts   — parse DSL: AND, -neg, *prefix, "phrase", src:   │
│   • rank.ts    — BM25 (k1=1.2, b=0.75) + recency boost           │
│   • aggregate.ts — summary stats + sourceLabel VN                │
│   • adapters.ts — Note → FulltextDoc, LibraryDoc → FulltextDoc   │
└──────────────────────────────────────────────────────────────────┘
                              ▲
                              │ import qua alias @trishteam/core/fulltext
                              │
┌──────────────────────────────────────────────────────────────────┐
│ Tầng 2: apps-desktop/trishsearch/src/  (React 18 + Vite, TSX)    │
│   • App.tsx        — 3-cột UI: sidebar hint/stats, results,      │
│                      detail pane; Ctrl+K focus; Esc clear        │
│   • tauri-bridge.ts — wrap invoke() + dev fallback docs          │
│   • styles.css     — theme amber/ember, source tag 3 màu         │
└──────────────────────────────────────────────────────────────────┘
                              ▲
                              │ invoke("default_store_location", …)
                              │
┌──────────────────────────────────────────────────────────────────┐
│ Tầng 3: src-tauri/  (Rust 1.77 + Tauri 2)                        │
│   • default_store_location → app data dir (thông tin env)        │
│   • load_json_file(path)   → nạp notes.json / library.json       │
│   • read_text_file(path)   → đọc 1 file text (whitelist ext)     │
│   • scan_text_folder(dir)  → walk folder → list file text +      │
│                              content bounded (2 MiB / file,      │
│                              2000 file mặc định, depth 8)        │
└──────────────────────────────────────────────────────────────────┘
```

Toàn bộ UI dev được **trong browser** (không cần Tauri) nhờ
`DEV_FALLBACK_DOCS` — bộ 5 doc demo (2 note + 2 library + 2 file) đã qua adapter.

---

## 🔎 Query DSL

| Cú pháp | Ý nghĩa |
|---|---|
| `react hook` | AND ngầm — cả 2 term |
| `react -legacy` | Loại trừ doc chứa `legacy` |
| `typ*` | Prefix match (typ, typing, typography, …) |
| `"kết cấu bê tông"` | Cụm từ (match sát, bonus ×1.4) |
| `note:todo` | Chỉ tìm trong nguồn ghi chú |
| `library:react` | Chỉ tìm trong thư viện |
| `file:setup` | Chỉ tìm file rời |
| `library:react -legacy typ*` | Kết hợp tự do |

Vietnamese diacritics được **fold** — gõ `tieng viet` cũng match
`tiếng Việt`. Stopword EN + VN bị loại bỏ.

---

## 🧪 Ranking formula

```
score(doc) = Σ_clause  idf(term) · bm25_tf(term, doc)
           · (phrase_bonus  if phrase match else 1)
           + recency_boost(doc.mtime)

bm25_tf = tf · (k1+1) / (tf + k1·(1 - b + b·len/avgLen))     k1=1.2, b=0.75
idf     = ln((N - df + 0.5) / (df + 0.5) + 1)
recency = clip01( (HOT - age) / (HOT - COLD) ) · α           α=0.2
           với HOT = 7 ngày, COLD = 365 ngày
phrase_bonus = 1.4
```

Title ×3, tag ×2, body ×1 **trong TF** (gộp sẵn khi index).

---

## 🚀 Commands

```bash
# Dev browser (không Tauri — dùng DEV_FALLBACK_DOCS)
cd apps-desktop/trishsearch
pnpm dev           # http://127.0.0.1:1436

# Typecheck
pnpm typecheck     # ../../node_modules/.bin/tsc --noEmit

# Dev Tauri (cần Rust)
pnpm tauri:dev

# Build Tauri release bundle (msi/nsis/dmg/deb/appimage)
pnpm tauri:build
```

Port 1436 (HMR 1437) — riêng cho TrishSearch, không đụng TrishNote (1432) /
TrishLibrary (1434) / TrishLauncher (1420).

---

## 🛡️ Privacy & limits

- **Không network, không upload.** Tất cả index nằm trong RAM của process
  desktop đang chạy. Nếu tắt app, index biến mất.
- **File IO caps:** `load_json_file` từ chối file > 40 MiB;
  `read_text_file` truncate > 2 MiB; `scan_text_folder` mặc định 2 000 file,
  depth 8 (có thể điều chỉnh).
- **Hidden dir:** `.git`, `node_modules`, `target`, `$RECYCLE.BIN`,
  `System Volume Information` bị bỏ qua khi walk.

---

## 🗺️ Roadmap con

| Sub | Mô tả | Trạng thái |
|---|---|---|
| 14.4.3 | BM25 TS engine + 3-source adapter + UI alpha | ✅ |
| 14.4.3.b | Tantivy WASM cho on-disk index bền (GB-scale) | ⏳ |
| 14.4.3.c | Firebase cross-device cache semantic rerank | ⏳ |
| 14.4.3.d | PDF text extraction (pdftotext binding) | ⏳ |
| 14.4.3.e | Incremental index (upsert khi file mtime đổi) | ⏳ |

---

## 👥 License & attribution

© 2026 TrishTEAM. Alpha prototype — phân phối nội bộ.
BM25 formula inspired by Robertson & Zaragoza (2009).
