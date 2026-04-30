# Phase 22 — TrishISO + TrishFinance + TrishDrive

> **Status**: Skeleton scaffold xong (2026-04-29). Trước Phase 23 TrishDesign.
> **Mục tiêu**: 3 app chính thức gia nhập TrishTEAM ecosystem (10 app), đồng bộ design system + telemetry + workspace pattern.

---

## 🎯 Mục tiêu chung

| Tiêu chí | TrishISO | TrishFinance | TrishDrive |
|---|---|---|---|
| Loại | Admin internal | Admin internal | Public (Phase 22.7) |
| Distribute | File .exe riêng | File .exe riêng | GitHub Release |
| Login | Firebase admin | Firebase admin | Firebase user |
| Stack | React 18 + Vite + TS | HTML standalone | React 18 + Vite + Rust backend |
| Frontend size | ~700KB | ~215KB | ~600KB |
| Rust deps | tauri | tauri | tauri + reqwest + rusqlite + aes-gcm |
| Storage local | localStorage | localStorage | SQLite |
| Cloud sync | Firestore (Phase 22.8) | Firestore (Phase 22.8) | Telegram channel |
| Web admin route | `/admin/trishiso` | `/admin/trishfinance` | `/admin/trishdrive` (admin tools) |

---

## 1️⃣ TrishISO — Quản lý hồ sơ ISO + thiết bị

### Hiện trạng
- Code base: Phase 1.10.1 (Trí tự tạo qua AI Studio)
- Dữ liệu mẫu: 3 hồ sơ công trình cầu đường (Phú Yên, Khánh Hoà), 30 mục lục con
- Module có: Dashboard / Hồ sơ tổng quát / Hồ sơ chi tiết / Mục lục con / Thiết bị nội bộ / Mượn-trả / Lưu trữ ISO (cây folder) / Liên kết BM-HS / Duyệt hồ sơ / Nhập Excel / Mẫu mục lục / Kho lưu trữ / Báo cáo / Cài đặt

### Phase 22.1 — UI polish (DONE 2026-04-29)
- ✅ Áp design system TrishTEAM (emerald + warm-tone neutral)
- ✅ Font Plus Jakarta Sans (uyển chuyển hơn Be Vietnam Pro)
- ✅ Card + button compact, weight max 600
- ✅ Dark/light theme toggle
- ✅ Backup/restore JSON đầy đủ
- ✅ Logo riêng (clipboard + ISO + gear, gradient navy/emerald)
- ✅ Telemetry wire `@trishteam/telemetry/tauri`

### Phase 22.2 — Tính năng cải thiện (TODO)
- **File upload thật** (hiện chỉ metadata): tích hợp Cloudinary giống TrishLibrary, folder `iso/{hoSoId}/{mucLucId}/`
- **OCR scan giấy → text** cho hồ sơ giấy: dùng Tesseract.js (đã có trong TrishLibrary)
- **PDF preview inline** cho file đính kèm: dùng pdf.js (đã có trong TrishLibrary)
- **Search fulltext** xuyên hồ sơ: index Tantivy (Rust backend) hoặc Lunr.js client-side
- **Cảnh báo lịch hiệu chuẩn/bảo trì**: notification system (browser API + Tauri tray notification)
- **Workflow duyệt 4-bước cải thiện**: thêm comment/reject reason + email notification (Phase 22.8)
- **Multi-user assign**: gán hồ sơ cho nhiều người, tracking ai làm gì
- **Audit log đầy đủ**: ghi mọi thao tác (create/update/delete) vào Firestore (Phase 22.8 sync)

### Phase 22.3 — Build + distribute
- `pnpm tauri build` → NSIS .exe ~12MB
- KHÔNG push GitHub tag (admin private), Trí copy file phân phối thủ công
- Bump version `1.1.0` mỗi lần release nội bộ

### Code quality issues nhận diện
- App.tsx 1351 dòng monolithic — nên split thành nhiều file:
  - `src/types.ts` (interface HoSoTong, MucLucItem, ThietBi, etc.)
  - `src/seed-data.ts` (data mẫu)
  - `src/utils.ts` (helper functions: today, dateVN, completion, etc.)
  - `src/pages/Dashboard.tsx`, `ProjectsPage.tsx`, etc.
  - `src/components/Modal.tsx`, `Input.tsx`, `StatCard.tsx`
- Type `any` rải rác → tighten với generics
- `useLocalState` không có error handling khi quota exceeded
- Không có test (Phase 22.4: thêm vitest cho utils + hooks)

---

## 2️⃣ TrishFinance — Tài chính phòng trọ + bán hàng

### Hiện trạng
- Code base: HTML standalone 2364 dòng (vanilla JS + Tailwind CDN)
- 3 module: **Bán hàng** (POS / Sản phẩm / Đơn hàng / Khách hàng / Kho / Nhân viên / Báo cáo / Khuyến mãi) + **Phòng trọ** + **Thu chi tổng hợp**
- Dữ liệu mẫu: 10 sản phẩm, 3 khách hàng, mock đơn hàng

### Phase 22.1 — UI polish (DONE 2026-04-29)
- ✅ Đổi color #1d4ed8 → #10b981 emerald TrishTEAM (87 occurrences)
- ✅ Dark/light theme toggle qua CSS variables
- ✅ Backup/restore JSON localStorage
- ✅ Print → window.print + Save as PDF
- ✅ Logo riêng (ví + nhà + đồng đ, gradient navy/emerald)
- ✅ Telemetry inline (báo lỗi tới /api/errors)

### Phase 22.2 — Tính năng cải thiện (TODO)
- **Convert HTML → React Vite** giống TrishISO để consistent codebase, dễ maintain
  - Modules → page components
  - Vanilla JS Store → React state hooks
  - Tailwind CDN → @tailwindcss/vite local build
  - Plus Jakarta Sans local thay Be Vietnam Pro CDN
- **POS thực sự**: bàn phím barcode scanner support, in hoá đơn nhiệt USB-POS-58/80mm (qua window.print + CSS @media print + Tauri shell exec lệnh in)
- **Báo cáo nâng cao**: chart Recharts (đã có trong website), filter ngày/tháng/quý, export Excel xlsx
- **Quản lý phòng trọ thực sự**: hợp đồng PDF, tiền điện nước theo công tơ, lịch thu tiền tự động báo trước 3 ngày
- **Multi-cửa hàng**: nếu Trí có nhiều cửa hàng/khu trọ, mỗi cái 1 workspace riêng + chuyển nhanh
- **Sync Firestore** (Phase 22.8): backup auto realtime, view trên web /admin/trishfinance

### Phase 22.3 — Build + distribute
- `pnpm tauri build` → NSIS .exe ~7MB (vì HTML nhẹ)
- KHÔNG push GitHub, Trí distribute thủ công

### Code quality issues
- Vanilla JS không type-safe — convert React + TS sẽ catch nhiều bug
- 2364 dòng inline trong 1 HTML — khó maintain, cần split
- Nhiều `<button onclick="...">` inline → React event handlers
- localStorage Store không có schema validation — rủi ro corrupt data

---

## 3️⃣ TrishDrive — Cloud Storage qua Telegram

### Tham khảo: [caamer20/Telegram-Drive](https://github.com/caamer20/Telegram-Drive)

### Phân tích repo gốc

Caamer20/Telegram-Drive là 1 web-based project dùng Telegram làm backend lưu trữ. Stack:
- **Frontend**: web HTML+JS (Tailwind CDN)
- **Backend**: Telegram Bot API (HTTP REST), không phải MTProto
- **Limit**: file < 50MB (Bot API document limit), không hỗ trợ file lớn streaming
- **Encrypt**: KHÔNG có (file lưu plain trên Telegram channel — admin Telegram đọc được)
- **Index**: lưu metadata trong file JSON local
- **UI**: list file + download link đơn giản

### Điểm mạnh
- Đơn giản, setup chỉ cần BotFather token + channel ID
- Free, không quota Telegram
- Tốc độ download decent qua Telegram CDN
- Không cần server (chạy thuần frontend + bot)

### Điểm yếu cần cải thiện cho TrishDrive
1. **Bảo mật yếu** → TrishDrive thêm AES-256-GCM encrypt mỗi chunk trước upload
2. **File 50MB limit** → Phase 23 chuyển MTProto (`grammers` Rust crate) để upload 2GB/file
3. **Web only** → TrishDrive là desktop Tauri, có file system native (drag-drop folder, sync 2 chiều)
4. **No index search** → SQLite local index + fulltext search filename/tag
5. **No folder structure** → TrishDrive có folder/tag/share link
6. **No resume upload** → chunk upload với retry + resume từ chunk dở

### TrishDrive Phase 22.4 — Setup wizard (TODO)
1. Trí mở app lần đầu → wizard 4 bước:
   - **Step 1**: Hướng dẫn tạo bot qua @BotFather (in-app screenshots + nút "Mở @BotFather")
   - **Step 2**: Paste BOT_TOKEN → app gọi `getMe` API verify
   - **Step 3**: Hướng dẫn tạo private channel + thêm bot làm admin → Trí paste channel ID hoặc forward tin nhắn từ channel cho bot để app tự lấy ID
   - **Step 4**: Tạo passphrase encrypt (PBKDF2-SHA256 100k rounds → AES-256 key) + verify
2. Lưu BOT_TOKEN + CHANNEL_ID + encrypted_master_key vào Tauri DPAPI store (Windows credential vault, không phải plain text)
3. Tauri command: `tg_test_bot(token)` → call `https://api.telegram.org/bot{token}/getMe`

### TrishDrive Phase 22.5 — Upload (TODO)
1. UI: drag-drop zone + multi-select file (Tauri dialog)
2. Pipeline mỗi file:
   - Read file → calc SHA-256 (deduplicate)
   - Generate random nonce 12 bytes per chunk
   - Chunk file thành các block 49MB (Bot API limit là 50MB, để buffer)
   - Encrypt mỗi chunk = AES-256-GCM(master_key, nonce, plaintext) → ciphertext + 16-byte auth tag
   - Upload chunk qua `sendDocument` API tới channel: `https://api.telegram.org/bot{token}/sendDocument`
   - Receive `message_id` cho mỗi chunk
3. Sau khi upload xong tất cả chunks:
   - Insert vào SQLite: `files (id, name, size, sha256, mime, created_at, total_chunks)`
   - Insert vào SQLite: `chunks (file_id, idx, message_id, byte_size, nonce_hex)`
4. UI hiển thị progress bar mỗi chunk + total speed (MB/s)
5. Concurrent upload max 3 chunk cùng lúc (tránh rate limit Telegram)

### TrishDrive Phase 22.6 — Download + decrypt (TODO)
1. UI: click file → show "Download" button
2. Pipeline:
   - Query SQLite chunks list theo `file_id`
   - For each chunk:
     - Call `https://api.telegram.org/bot{token}/getFile?file_id={file_id}` → get `file_path`
     - Download `https://api.telegram.org/file/bot{token}/{file_path}`
     - Decrypt = AES-256-GCM-decrypt(master_key, nonce, ciphertext)
     - Append vào output file (qua Tauri fs API)
   - Verify SHA-256 cuối cùng → match ban đầu
3. UI progress + download speed
4. Download cancel/pause/resume

### TrishDrive Phase 22.7 — UI hoàn thiện (TODO)
- File list view: grid hoặc table, sort name/size/date, filter type (image/video/doc/zip)
- Folder cây: drag file vào folder, auto-tag
- Search filename + tag (SQLite FTS5)
- Share link: tạo URL `trishteam.io.vn/drive/{token}` web admin trực tiếp download (Phase 22.8 web route)
- Storage stats: total used per channel, files count, dedup savings

### TrishDrive Phase 23 — MTProto upgrade
- Chuyển từ Bot API → MTProto qua `grammers` Rust crate
- Lý do:
  - Upload 1 file 2GB nguyên không cần chia chunk (vẫn chia chunk internal MTProto, nhưng API user đơn giản)
  - Download nhanh hơn (parallel + streaming)
  - Hỗ trợ user account thay vì bot (limit cao hơn)
- Migration: chunk format giữ nguyên, chỉ đổi transport layer

### TrishDrive — Code architecture
```
apps-desktop/trishdrive/
├── src/                           # React UI
│   ├── App.tsx                   # Shell + page routing
│   ├── pages/
│   │   ├── SetupWizard.tsx       # Phase 22.4
│   │   ├── FilesPage.tsx         # Phase 22.7
│   │   ├── UploadPage.tsx        # Phase 22.5
│   │   └── SettingsPage.tsx
│   ├── components/
│   │   ├── FileList.tsx
│   │   ├── UploadDropzone.tsx
│   │   └── ProgressBar.tsx
│   └── hooks/
│       ├── useUploadQueue.ts
│       └── useDownloadQueue.ts
├── src-tauri/
│   ├── src/
│   │   ├── lib.rs                # Tauri commands export
│   │   ├── telegram.rs           # Bot API client (reqwest)
│   │   ├── crypto.rs             # AES-256-GCM wrapper
│   │   ├── db.rs                 # SQLite schema + queries
│   │   └── upload.rs             # Pipeline orchestrator
│   └── Cargo.toml                # tauri + reqwest + rusqlite + aes-gcm + sha2
└── package.json
```

---

## 🛠 Đồng nhất với 7 app TrishTEAM ecosystem

### ✅ Đã làm
- Folder pattern: `apps-desktop/trishiso`, `apps-desktop/trishfinance`, `apps-desktop/trishdrive`
- Tauri identifier: `vn.trishteam.iso/finance/drive`
- Cargo binary name: `trishiso/trishfinance/trishdrive`
- Package name: `@trishteam/trishiso/trishfinance/trishdrive`
- Telemetry: wire `@trishteam/telemetry/tauri` (TrishISO+TrishDrive React) hoặc inline (TrishFinance HTML)
- Theme: emerald gradient `#10B981→#047857` light, `#4ADE80→#10B981` dark + warm-tone neutral
- Font: Plus Jakarta Sans (sẽ áp dụng cho Library/Admin sau khi Phase 22 done)
- CSP: cho phép `trishteam.io.vn` để sync Firestore + Telegram API (TrishDrive)
- apps-registry.json: thêm 3 entry, status `private` cho ISO+Finance, `scheduled` cho Drive
- HANDOFF-MASTER bảng app: 10 thành phần (cũ 7) + Phase 22 trước Phase 23 TrishDesign

### ⏳ Còn cần đồng nhất
- **Auth**: TrishISO+TrishFinance hiện chưa wire `@trishteam/auth`. Phase 22.2 add login Firebase + admin role guard giống TrishAdmin (`isAdminEmail` check).
- **TrishLauncher hiển thị**:
  - TrishDrive: SHOW (public)
  - TrishISO+TrishFinance: HIDE (giống TrishAdmin self-exclude)
  - Update `apps-registry.json` field `hide_in_launcher: true` cho 2 app private
- **Update workflow `release-app.yml`**: thêm `trishdrive` vào danh sách choice (TrishISO/TrishFinance không add vì private build local)
- **CSS variable bridge**: tách design tokens TrishTEAM thành package riêng `@trishteam/tokens` (Phase 23 prep) để 10 app share thay vì duplicate index.css
- **Rust panic hook** trong `src-tauri/src/lib.rs` của 3 app mới (chung pattern, áp dụng sau khi Trí Sentry account)
- **Tests**: vitest cho `@trishteam/core/iso`, `@trishteam/core/finance` (extract domain logic), `@trishteam/core/telegram-drive`

---

## 📋 Roadmap Phase 22 — Phân chia phiên

| Phiên | Sub-phase | Việc làm | Estimate |
|---|---|---|---|
| **N** (hiện tại) | 22.0 prep | Move folder + scaffold + theme + telemetry + logo + tài liệu này | ✅ Done |
| N+1 | 22.1 polish | Verify dev/build 3 app, fix lỗi nếu có, smoke test UI | ~30p/app |
| N+2 | 22.2 ISO features | Cloudinary upload + OCR + PDF preview + Tantivy search | 1-2 phiên |
| N+3 | 22.3 ISO Auth | Firebase login + admin guard + Firestore sync schema | 1 phiên |
| N+4 | 22.4 Drive setup wizard | UI 4-step + Tauri commands tg_test_bot + DPAPI key store | 1 phiên |
| N+5 | 22.5 Drive upload | Chunk + AES-GCM encrypt + Bot API + SQLite index | 2 phiên |
| N+6 | 22.6 Drive download | Download + decrypt + verify SHA + resume | 1 phiên |
| N+7 | 22.7 Drive UI | List/search/folder/tag/share link | 1 phiên |
| N+8 | 22.8 Web sync | Web admin /admin/trishiso /admin/trishfinance + share trishteam.io.vn/drive/{token} | 2 phiên |
| N+9 | 22.9 Finance React rewrite | HTML → React Vite, đồng bộ TrishISO codebase | 2-3 phiên |
| N+10 | 22.10 Release | Build NSIS + tag trishdrive-v0.2.0 (ISO+Finance build local) | 1 phiên |

**Tổng**: ~12-15 phiên cho Phase 22, sau đó chuyển Phase 23 TrishDesign.

---

## 🎨 Design tokens — bảng tổng hợp

| Token | Light | Dark | Note |
|---|---|---|---|
| `--color-accent-primary` | `#059669` | `#4ADE80` | Emerald — TrishTEAM brand |
| `--color-accent-gradient` | `linear-gradient(135deg, #10b981, #047857)` | `linear-gradient(135deg, #4ADE80, #10B981)` | Button primary |
| `--color-surface-bg` | `#f4f3f0` | `#0f0e0c` | Warm cream / black |
| `--color-surface-card` | `#ffffff` | `#1a1814` | Card |
| `--color-text-primary` | `#1c1b22` | `#f5f2ed` | High contrast |
| `--color-text-muted` | `#6b6877` | `#a09890` | Secondary |
| Font | `Plus Jakarta Sans` | same | Body 13px, max weight 600 |
| Radius | 10/14px | same | Compact |

---

## 🔗 Link nhanh

- Repo Telegram-Drive ref: https://github.com/caamer20/Telegram-Drive
- Telegram Bot API docs: https://core.telegram.org/bots/api#sending-files
- grammers (MTProto Rust): https://crates.io/crates/grammers-client
- AES-GCM Rust crate: https://crates.io/crates/aes-gcm
- TrishTEAM tokens chuẩn: `website/assets/tokens.css` (Phase 11.5.10)
