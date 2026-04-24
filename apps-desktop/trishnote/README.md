# TrishNote — Ghi chú cá nhân với Daily Review + Kanban

**Tauri 2** + **React 18** + **@trishteam/core/notes**.

Ghi chú local-first. Dữ liệu sống trong 1 file JSON nằm trong thư mục
dữ liệu của hệ điều hành (`%LocalAppData%/TrishTEAM/TrishNote/notes.json`
trên Windows, `~/.local/share/TrishTEAM/TrishNote/notes.json` trên Linux,
`~/Library/Application Support/TrishTEAM/TrishNote/notes.json` trên macOS).
Không cloud, không tài khoản, không tracking. Sync Firebase sẽ bật ở
**Phase 14.4.1.b**.

## Điểm đặc biệt

- **Daily Review mode** — mỗi note có `lastReviewedAt`. Sau 7 ngày không
  review sẽ vào hàng đợi review hôm nay. Streak đếm số ngày liên tục
  bạn review (ít nhất 1 note/ngày).
- **Kanban board** — 5 lane `inbox → active → waiting → done → archived`,
  drag-drop giữa lane bằng HTML5 DnD, không cần thư viện ngoài.
- **Age bucket** — mỗi note được gắn chip màu theo tuổi review:
  `fresh` (xanh, <3.5 ngày) / `stale` (vàng, <7 ngày) / `overdue` (cam,
  <28 ngày) / `ancient` (đỏ, ≥28 ngày).
- **Auto-save debounce 400 ms** — mọi thay đổi tự ghi file. Ghi
  nguyên tử bằng tmp + rename để không corrupt giữa chừng.
- **Dev fallback** — chạy `pnpm dev` (không có Tauri) sẽ load 5 note
  giả phủ đủ 4 status + 2 mức review age để UI test nhanh.
- **Export/Import JSON** — user có thể backup hoặc move sang máy khác.

## Kiến trúc

```
┌──────────────────────────────────────────────────────────┐
│ @trishteam/core/notes  — pure TS, Vitest (46 tests)       │
│   types.ts       Note, NoteStatus, NoteDraft              │
│   validate.ts    validateDraft, normalizeTag              │
│   review.ts      notesDueForReview, computeReviewStreak,  │
│                   reviewAgeBucket, markReviewed           │
│   kanban.ts      groupByKanban, moveNote, statusLabel     │
└──────────────────────────────────────────────────────────┘
                         ▲ imported
                         │
┌──────────────────────────────────────────────────────────┐
│ apps-desktop/trishnote (React)                            │
│   App.tsx        list / kanban view, review modal,        │
│                   composer modal, detail pane             │
│   tauri-bridge   loadNotes / saveNotes / export / import  │
│                   + DEV_FALLBACK_NOTES                    │
│   styles.css     dark theme, purple accent                │
└──────────────────────────────────────────────────────────┘
                         ▲ invoke
                         │
┌──────────────────────────────────────────────────────────┐
│ src-tauri (Rust 1.77)                                     │
│   default_store_location  — dirs crate cross-platform     │
│   load_notes(path?)       — seed `[]` nếu file chưa có    │
│   save_notes(path?, json) — validate JSON + atomic write  │
│                              (tmp + rename, 10 MiB cap)   │
└──────────────────────────────────────────────────────────┘
```

## Domain model

```ts
interface Note {
  id: string;
  title: string;
  body: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
  // 14.4.1 additions — optional để backward-compat
  // với schema Firestore ở Phase 11.7:
  status?: NoteStatus;          // inbox | active | waiting | done | archived
  lastReviewedAt?: number | null;
  dueAt?: number | null;
}

type NoteStatus = 'inbox' | 'active' | 'waiting' | 'done' | 'archived';
```

### Review logic

```
DEFAULT_REVIEW_INTERVAL_MS = 7 ngày

notesDueForReview(notes, now):
  - bỏ qua deletedAt, status='archived', status='done'
  - một note `due` khi: lastReviewedAt == null
                    HOẶC (now - lastReviewedAt) >= interval
  - sort lastReviewedAt tăng dần, null trước, tie-break createdAt tăng dần
```

### Age bucket

```
ref = lastReviewedAt ?? createdAt
age = now - ref

fresh    : age < interval / 2        (~< 3.5 ngày)
stale    : age < interval            (~< 7 ngày)
overdue  : age < interval * 4        (~< 28 ngày)
ancient  : age >= interval * 4       (≥ 28 ngày)
```

### Review streak

Đếm số ngày liên tục (theo UTC day bucket) tính từ hôm nay ngược về quá
khứ mà có ≥ 1 note với `lastReviewedAt` rơi vào ngày đó. Gián đoạn 1
ngày → streak reset.

### Kanban

```
groupByKanban(notes, { includeArchived }):
  - 4 lane mặc định: inbox → active → waiting → done
  - includeArchived = true → thêm lane 'archived'
  - note không có status → vào 'inbox'
  - mỗi lane sort updatedAt giảm dần

moveNote(note, status, now):
  - set status mới, updatedAt = now
  - nếu chuyển sang 'done' từ status khác → set lastReviewedAt = now
    (tránh clobber history nếu đã done sẵn)
```

## Commands

```
pnpm dev          # Vite ở port 1432
pnpm build        # tsc --noEmit + vite build
pnpm tauri:dev    # Rust + Vite full stack
pnpm tauri:build  # production bundle
pnpm typecheck    # tsc chỉ
```

## Thao tác

1. Bấm **+ Note mới** hoặc phím tắt trong composer.
2. Điền tiêu đề + nội dung + chọn status + tag (cách nhau dấu phẩy).
3. Đổi view bằng nút **List / Kanban** ở topbar.
4. Bấm **Review hôm nay (N)** khi có note đến hạn — cursor lướt qua
   từng note, bấm **Đã review** để mark done cho note đó.
5. Bấm **Xuất JSON** / **Nhập JSON** ở topbar để backup/restore.

## Giới hạn hiện tại (Phase 14.4.1 alpha)

- **Chưa sync cloud** — bản alpha thuần local. Firebase Auth +
  Firestore sync dời sang 14.4.1.b.
- **Chưa có reminder** — `dueAt` field có trong schema nhưng chưa wire
  toast/Telegram (14.4.1.c).
- **Chưa export PDF/Markdown** — chỉ export JSON (14.4.1.d).
- **Chưa có encryption** — JSON plaintext, dựa vào OS-level file
  permission. Nếu cần mã hóa, bạn tự đặt máy trong ổ BitLocker/FileVault.
- **Không support rich text** — body thuần text.
- **Không có attachment** — chỉ lưu trong JSON nên tránh blob to.

## Roadmap tiếp theo

- **14.4.1.b**: Firebase Auth (email/password) + Firestore sync 2-chiều
  (upsert by id, `updatedAt` wins).
- **14.4.1.c**: Reminder toast (cross-platform notification) + Telegram
  bot integration cho `dueAt`.
- **14.4.1.d**: Export PDF / Markdown bundle (zip tất cả note thành
  folder `.md`).
- **14.4.2**: TrishLibrary rebuild (book tracker).
- **14.4.3**: TrishSearch rebuild (full-text search across TrishTEAM apps).
- **14.4.4**: TrishDesign rebuild (snippet/asset manager).
