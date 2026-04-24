# TrishTEAM shared packages

Phase 14.0 (2026-04-23) — scaffold 4 package chia sẻ code giữa 3 nền tảng
(website + desktop + Zalo Mini App).

## Triết lý

**~75% code reuse** qua layering rõ ràng:

```
┌─────────────────────────────────────────────────────────┐
│ apps-host  website (Next.js) │ desktop (Tauri) │ zalo (ZMP) │
├─────────────────────────────────────────────────────────┤
│ packages/ui          Shared React components (web+zalo)  │
│ packages/adapters    Platform abstraction (router, ...)  │
│ packages/data        Firebase collection paths + types   │
│ packages/core        Pure TS domain logic (universal)    │
└─────────────────────────────────────────────────────────┘
```

- **`@trishteam/core`** — Pure TS. Không DOM, không React, không Node
  runtime cụ thể. Dùng được ở **mọi** nơi: server, client, web worker,
  Zalo Mini App runtime, Tauri WebView.
- **`@trishteam/data`** — Firebase wrappers + collection path constants.
  Centralize để fix một chỗ khi đổi schema.
- **`@trishteam/ui`** — React components dùng được trên website + Zalo.
  Desktop app render bằng Tauri WebView (React) hoặc Qt — tùy app.
- **`@trishteam/adapters`** — Interface cho router/storage/notify. Host
  cung cấp implementation.

## Cross-platform coverage hiện tại

| Module | Website | Desktop (Tauri) | Zalo Mini App |
|--------|---------|-----------------|---------------|
| `core/apps` (catalog) | ✅ integrated | ⏳ Phase 14.2 | ⏳ Phase 15.2 |
| `core/search` (fold + tokenize) | ⏳ Phase 14.1 | ⏳ Phase 14.2 | ⏳ Phase 15.3 |
| `core/notes` (model + validate) | ⏳ Phase 14.1 | ⏳ Phase 14.4 | ⏳ Phase 15.4 |
| `core/qr` (classify + filename) | ⏳ Phase 14.1 | ⏳ Phase 14.3 | ⏳ Phase 15.3 |
| `ui/*` | scaffold | n/a (native) | ⏳ Phase 15.2 |
| `data/paths` | ⏳ Phase 14.1 | ⏳ Phase 14.4 | ⏳ Phase 15.4 |
| `adapters/*` | ⏳ Phase 14.1 | ⏳ Phase 14.2 | ⏳ Phase 15.1 |

## Dev workflow

Từ root monorepo:

```bash
pnpm install         # cài toàn bộ workspace
pnpm -r typecheck    # tsc --noEmit mọi package
pnpm build:packages  # build packages/* ra dist/
```

Website vẫn chạy độc lập (không cần `pnpm` workspace ở dev time vì
tsconfig paths resolve trực tiếp src của packages).

## Thêm package mới

1. `mkdir packages/<name>/src && cd packages/<name>`
2. Copy `packages/core/{package.json,tsconfig.json}` làm template, đổi
   `name` và `description`.
3. Thêm paths vào `website/tsconfig.json` để website có thể import.
4. Document ở bảng Cross-platform coverage trên.

## Quy tắc viết code trong package

- **Core** không được `import 'react'` hay `import 'next'`. Nếu thấy,
  đổi sang dùng adapter.
- **Không dùng `process.env`** trong `core` — đưa config vào function
  argument để caller (host) inject.
- **Không side effect ở module top-level** — chỉ khai báo type, constant,
  pure function. Module phải tree-shakeable.
- **Path import dùng `.js` extension** (ES module strict) — TS compile ra
  vẫn resolve đúng.
- **Unit test** cho mỗi pure function (Phase 14.1 thêm Vitest).
