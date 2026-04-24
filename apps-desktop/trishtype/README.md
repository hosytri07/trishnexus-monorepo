# TrishType — Multi-caret editor với CRDT merge

**Tauri 2** + **React 18** + **@trishteam/core/type** (RGA-style text CRDT).

## Điểm đặc biệt

- **Multi-caret**: gõ nhiều vị trí cùng lúc. Carets anchor vào `CharId`
  (không phải visual index), nên khi actor khác insert/delete ở chỗ
  khác, caret không bị lệch.
- **CRDT merge an toàn offline**: 2 replica (ví dụ laptop + tablet)
  edit song song → cùng tập ops, mọi thứ tự apply đều hội tụ cùng 1
  text. Xem test `packages/core/src/type/__tests__/crdt.test.ts`.
- **Rust backend tối giản**: chỉ `read_text_file` + `write_text_file`
  (cap 5 MiB). Caret/merge logic ở TS, testable bằng Vitest.
- **Dev fallback**: khi chưa start Tauri, app tự load sample text để
  dev UI nhanh trong browser.

## Kiến trúc

```
┌──────────────────────────────────────────────────────────┐
│ @trishteam/core/type  — pure TS, Vitest                  │
│   types.ts       ActorId, CharId, Caret, Op               │
│   crdt.ts        RGA insert/delete, visibleChars, serde   │
│   multicaret.ts  typeAtCarets, backspaceAtCarets          │
└──────────────────────────────────────────────────────────┘
                         ▲ imported
                         │
┌──────────────────────────────────────────────────────────┐
│ apps-desktop/trishtype (React)                            │
│   App.tsx        key handler → ops, render visible chars  │
│   tauri-bridge   pickAndReadFile / saveAs / saveTo        │
└──────────────────────────────────────────────────────────┘
                         ▲ invoke
                         │
┌──────────────────────────────────────────────────────────┐
│ src-tauri (Rust 1.77)                                     │
│   read_text_file / write_text_file — cap 5 MiB            │
└──────────────────────────────────────────────────────────┘
```

## CRDT model (tóm tắt)

Mỗi char có ID `(actor, clock)` duy nhất. Insert ghi `after = CharId`
của char đứng trước (hoặc `null` nếu đầu doc). Delete chỉ flip
tombstone — char không bị xoá khỏi state để merge commutative.

Khi render:

1. Group các char theo `after`.
2. Trong mỗi group, sort: `clock desc` → `actor asc` (RGA rule — insert
   mới hơn đẩy char cũ sang phải).
3. DFS từ `$START`.

Hai actor insert đồng thời vào cùng vị trí → cả hai replicas cho cùng
1 chuỗi nhờ sort deterministic. Convergence được verify bằng test
`2 actors insert cạnh tranh cùng vị trí → cả 2 replicas hội tụ`.

## Commands

```
pnpm dev          # Vite ở port 1428
pnpm build        # tsc --noEmit + vite build
pnpm tauri:dev    # Rust + Vite full stack
pnpm tauri:build  # production bundle (msi/nsis/dmg/deb/appimage)
pnpm typecheck    # tsc chỉ
```

## Phím tắt

| Phím | Hành động |
|------|-----------|
| Ctrl+O | Mở file |
| Ctrl+S | Lưu (Save As nếu chưa có path) |
| ←/→    | Di chuyển tất cả caret |
| Enter  | Newline |
| Tab    | 2 khoảng trắng |
| Backspace | Xoá char trước mỗi caret |

## Giới hạn hiện tại (Phase 14.3.3)

- Chưa có selection range (chỉ caret điểm).
- Chưa có undo/redo (CRDT làm undo hơi tricky — dự kiến Phase 14.3.3+).
- Chưa bind copy/paste với CRDT ops.
- Chưa có P2P sync giữa 2 replica thật — hiện chỉ demo local + test.

## Roadmap tiếp theo

- **14.3.3+**: undo/redo history qua op reverse + IME composition.
- **14.5**: P2P sync qua WebRTC hoặc Firestore doc.
- **15.x**: Port CRDT ra Zalo Mini App cho collab note.
