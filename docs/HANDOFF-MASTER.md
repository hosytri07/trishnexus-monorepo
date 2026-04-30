# 🧠 HANDOFF-MASTER.md — TrishTEAM Monorepo

> **ĐỌC FILE NÀY ĐẦU TIÊN MỌI PHIÊN MỚI.** Đây là file handoff DUY NHẤT của hệ sinh thái — gộp từ HANDOFF-WEBSITE-PHASE-19, HANDOFF-TRISHLIBRARY-3.0, SESSION-HANDOFF cũ.
>
> **Cập nhật:** 2026-04-29 (Phase 21 prep DONE — cleanup + telemetry + observability sẵn sàng cho TrishDesign)
> **Chủ dự án:** Trí (hosytri77@gmail.com / trishteam.official@gmail.com) — kỹ sư hạ tầng giao thông Đà Nẵng. Không phải dev. Giao tiếp tiếng Việt, tránh jargon.

---

## 🎯 MỤC TIÊU DỰ ÁN

TrishTEAM là **hệ sinh thái phần mềm + tri thức + công cụ** cho kỹ sư xây dựng / giao thông Việt Nam. 1 tài khoản duy nhất, đồng bộ giữa **website (trishteam.io.vn)** và **7 desktop apps** (Tauri 2 + Rust + React).

```
┌──────────────────────────────────────────────────────────┐
│  Website (Next.js 14) — trishteam.io.vn                  │
│    Dashboard + Database tra cứu + Quiz + Công cụ + Blog  │
│                                                           │
│  Desktop apps (Tauri 2)                                  │
│    TrishLauncher · TrishLibrary · TrishAdmin             │
│    TrishFont · TrishCheck · TrishClean · TrishDesign     │
│                                                           │
│  Shared:                                                  │
│    Firebase Auth + Firestore (project: trishteam-17c2d)  │
│    Cloudinary 25GB · GitHub Releases · Vercel deploy     │
└──────────────────────────────────────────────────────────┘
```

---

## 🔴 PICK UP TỪ ĐÂY (PHIÊN MỚI)

### Bước 1 — Sync máy
Double-click `scripts\START.bat` → tự pull GitHub + pnpm install + show status + nhận diện đang ở nhà / cơ quan.

### Bước 2 — Xác định việc tiếp

**Tình trạng cuối phiên (29/04/2026 — phiên Phase 21 prep):**
- ✅ Phase 19.22-19.24 + Phase 20 production deployed
- ✅ **Phase 21 prep DONE** — cleanup + telemetry + observability:
  - A. Cleanup: tạo `scripts\CLEANUP-PHASE21-PREP.bat` (Trí cần chạy thủ công)
  - B. Sync: apps-registry.json đồng bộ v2.0.0-1/3.0.0; .gitattributes chuẩn hóa CRLF; CHANGELOG + ROADMAP cập nhật
  - C. Telemetry: tạo `@trishteam/telemetry` + wire 7 desktop app + Errors/Vitals panel TrishAdmin + bump v1.1.0
  - D. Observability: workflow `backup-firestore.yml` weekly cron + doc Sentry setup + vitest threshold
- ⏳ Demo data Firestore — Trí xóa thủ công qua Firebase Console nếu chưa

**Việc Trí cần làm cuối phiên này:**
1. **Chạy `scripts\CLEANUP-PHASE21-PREP.bat`** — xóa 4 deprecated apps + apps/ legacy + 3 workflow legacy + move release-notes
2. **`pnpm install`** ở root — link `@trishteam/telemetry` workspace package vào 7 app
3. **Test 1 app** dev (vd `pnpm -C apps-desktop\trishlauncher tauri dev`) — confirm telemetry không crash
4. **Set GitHub secret** `FIREBASE_SERVICE_ACCOUNT_BASE64` để workflow backup chạy được
5. **Git renormalize** sau khi có .gitattributes mới: `git add --renormalize . && git commit -m "chore: normalize CRLF via .gitattributes"`
6. **Commit + push** — cleanup, telemetry, panels (~30 file)
7. **Build TrishAdmin local** (KHÔNG push tag — app private):
   `pnpm -C apps-desktop\trishadmin tauri build`
   File output: `apps-desktop\trishadmin\src-tauri\target\release\bundle\nsis\TrishAdmin_1.1.0_x64-setup.exe`
   Trí phân phối thủ công (USB/email/cloud private)

**Roadmap kế tiếp:**

```
✅ Phase 19.24  TrishAdmin desktop parity (DONE)
                - BackupPanel · DatabaseVnPanel · BulkImportPanel · StoragePanel

✅ Phase 20     TrishLauncher Sync + Web optimization (DONE 2026-04-29)
                ✅ 20.1 Audit + chốt scope
                ✅ 20.2 Fix schema/URL/version/CORS launcher + web /api/apps-registry
                ✅ 20.3 Manual update button (force fetch + per-app "Cập nhật")
                ✅ 20.4 /downloads sync Firestore (đã có từ 19.22)
                ✅ 20.5 SEO + sitemap dynamic blog + Vercel Analytics
                ✅ 20.6 PWA (đã có từ 11.9)
                ✅ 20.7 Audit Firestore rules (0 gap)
                ✅ 20.8 CI/CD release-app.yml + NSIS-only bundles
                — Phụ trợ:
                  • TrishLauncher: tray tooltip "Hệ sinh thái TrishTEAM",
                    minimize-to-tray toggle (mặc định OFF), bỏ nút "Đăng nhập",
                    ẩn 4 app deprecated, Việt hóa label
                  • Apps shown: 5 (TrishFont/Clean/Check/Library/Design),
                    TrishAdmin ẨN, TrishLauncher self-exclude
                  • Apps registry source: www.trishteam.io.vn/api/apps-registry
                    (live Firestore /apps_meta), fallback static JSON
                  • Bỏ apps-zalo/main scaffold (Trí ko cần, đã xóa folder)

✅ Phase 21 prep  Cleanup + Telemetry + Observability (DONE 2026-04-29)
                — A. Cleanup: scripts/CLEANUP-PHASE21-PREP.bat
                — B. Sync: apps-registry.json v2.0.0-1/3.0.0 + .gitattributes + CHANGELOG/ROADMAP
                — C. Telemetry: packages/telemetry + wire 7 app + Errors/Vitals panel TrishAdmin
                — D. Observability: backup-firestore.yml weekly + docs/SENTRY-SETUP.md + vitest threshold

🟡 Phase 22 IN PROGRESS — TrishISO + TrishFinance + TrishDrive (PRIORITY trước TrishDesign)
                ✅ 22.0 prep — folders + theme emerald + Plus Jakarta Sans + telemetry + logo riêng
                ✅ 22.4 TrishDrive backend — Tauri commands tg_test_bot/get_chat/creds_save/load + SetupWizard UI 4-step
                ✅ 22.4b Login Firebase trước (per-user creds, keyring username = telegram_creds_{uid})
                       — LoginScreen email + Google OAuth + Remember me + Quên mật khẩu + Đăng ký link
                       — User info + signOut button trong sidebar
                       — Cross-check uid trong creds load (defensive)
                ✅ 22.4c-d Logo PNG (taskbar transparent + UI keep white bg) + Settings 5 card features
                ✅ 22.5 Upload pipeline — crypto.rs AES-GCM + telegram.rs sendDocument + db insert (file < 48MB)
                ✅ 22.6 Download + Delete — getFile + decrypt + verify SHA256 + deleteMessage Telegram
                ✅ 22.7 UI Files page (table + sort + search + download/delete) + UploadPage (dialog + progress)
                ✅ 22.5d Streaming upload — read file 4MB chunk SHA pass 1 + 19MB chunk encrypt+upload pass 2
                       — Bỏ MAX_FILE_SIZE 2GB → file ≥ 5GB cũng OK (chỉ giới hạn bởi free disk space)
                       — Streaming write download (ghi từng chunk decrypted ra disk, không build full Vec RAM)
                ✅ 22.7e Manage Shares page — Web API list/manage + Tauri command share_list/revoke/extend
                       — Sidebar tab "Link share" với table status badge + action revoke/extend/copy URL
                       — Filter active/expired
                ✅ 22.5e Retry logic — upload + download chunk fail retry 3 lần exponential backoff (1s, 2s, 4s)
                ✅ 22.7j Dashboard page — replace Files default
                       — 4 stat card (Tổng files / Storage / Folders / Active shares)
                       — Recent uploads list + Top folders by size + Quick actions
                ✅ 22.7g Multi-select + bulk actions
                       — Checkbox column + select all + selection toolbar
                       — Bulk move folder + bulk delete (vào trash)
                ✅ 22.7f Trash bin (thùng rác)
                       — file_delete giờ là SOFT delete (set deleted_at = now)
                       — Tab "Thùng rác" mới với restore + xoá vĩnh viễn
                       — Auto-purge file > 30 ngày khi load Trash page
                       — DB schema migration: ALTER TABLE files ADD COLUMN deleted_at
                ✅ 22.7d Help page in-app — 7 section accordion (Setup / Upload / Download / Share / Folder / Security / Troubleshoot)
                       — Sidebar nav thêm "Hướng dẫn" với icon BookOpen
                ✅ 22.5c Progress bar % real-time upload + download
                       — Rust emit `drive-progress` event sau mỗi chunk (current/total + bytes_done/total + op)
                       — UploadPage: progress bar 8px gradient + chunk N/M + speed MB/s + ETA
                       — FilesPage: progress mini 4px ngay row đang download
                ✅ 22.5b Chunked upload — file ≤ 2GB, chia chunks 49MB, mỗi chunk encrypt + sendDocument riêng
                       — Tự động roll back delete file row nếu chunk fail giữa chừng
                       — Download tự loop chunks (đã có sẵn từ 22.6)
                ✅ 22.7c Folder + ghi chú — SQLite folders + note column
                       — UI: sidebar folder tree (Tất cả / Root / custom folders) + count per folder
                       — Folder CRUD: create / rename / delete (file fallback về root khi xoá folder)
                       — File: edit modal (rename / move folder / note) + show note inline trong table
                       — Upload: chọn folder + nhập note
                ✅ 22.7b Share link feature — Rust crypto.rs encrypt_with_password (PBKDF2 100k) + share_create command
                       — Web API /api/drive/share/{create, [token]/info, [token]/proxy} (Next.js Admin SDK)
                       — Web page /drive/share/[token] form password + decrypt client-side AES-GCM + verify SHA256
                       — TrishDrive UI ShareModal (password ≥ 8 ký tự, expires 1h-30d-không, max 1-50 lượt)
                       — Zero-knowledge: server không có password → không decrypt được content
                       — Firestore /trishdrive/{**} default deny (Admin SDK bypass rules)
                ✅ 22.8 Web admin routes /admin/trishiso /admin/trishfinance /admin/trishdrive
                — TrishISO 1.0.0   ⭐ Admin only ⭐  apps-desktop/trishiso/
                  React + Vite + Tailwind 4 + Plus Jakarta Sans + emerald TrishTEAM theme
                  Quản lý hồ sơ ISO + thiết bị nội bộ + lịch hiệu chuẩn/bảo trì
                  Sync route /admin/trishiso (Phase 22.7), KHÔNG public download
                  Build: pnpm tauri build → Trí phân phối thủ công
                  Phase 22.1-22.3: theme polish, telemetry, build NSIS

                — TrishFinance 1.0.0   ⭐ Admin only ⭐  apps-desktop/trishfinance/
                  HTML standalone + Tauri webview + emerald theme
                  Bán hàng (POS/sản phẩm/đơn hàng/kho/khách hàng) + Phòng trọ + Thu chi tổng hợp
                  Sync route /admin/trishfinance (Phase 22.7), KHÔNG public
                  Phase 22.1-22.3: như TrishISO + đổi font CDN → Plus Jakarta local

                — TrishDrive 0.1.0-alpha   apps-desktop/trishdrive/
                  Cloud Storage qua Telegram (tham khảo caamer20/Telegram-Drive)
                  React + Tauri + Rust backend (reqwest/rusqlite/aes-gcm)
                  Phase 22.4-22.7:
                    .4 Setup wizard (BotFather guide, DPAPI store BOT_TOKEN+CHANNEL_ID)
                    .5 Upload + chunk 49MB + AES-256-GCM encrypt + SQLite index
                    .6 Download + decrypt + assemble + verify SHA256
                    .7 List/search/folder/tag UI
                  Phase 23+: chuyển MTProto (grammers crate) cho file > 50MB

                — Phase 22.8: Web admin /admin/trishiso + /admin/trishfinance read-only data view

🟡 Phase 23 IN PROGRESS — TrishDrive MTProto migration (sau khi xong → roadmap TrishISO/Finance)
                ✅ 23.1 Scaffold — grammers-client crate + module mtproto.rs + command mtproto_status + Settings UI badge
                ⏳ 23.2 Login flow — phone + OTP + lưu session encrypted
                ⏳ 23.3 Upload file > 50MB qua MTProto (không chia Bot API chunk)
                ⏳ 23.4 Download streaming MTProto

⏳ Phase 24     TrishDesign desktop (sau khi xong TrishDrive MTProto)
                - AutoCAD plugin
                - AI RAG TCVN/AASHTO
                - Dự toán + bản vẽ kỹ sư

⏳ Còn lại (free, ưu tiên thấp hơn):
                - Sentry SDK wire thực sự (doc đã có, chờ Trí tạo Sentry account + DSN)
                - Rust panic hook setup_panic_hook() trong src-tauri/src/lib.rs của 10 app
                - TrishDrive MTProto upload file > 50MB (Phase 23+)
                - Code-signing (skip — không free, EV ~250$/năm)
```

**Phase 20 release flow** — `git tag <appid>-v<version> && git push --tags` →
GitHub Actions tự build NSIS .exe + tạo Release. Xem `docs/RELEASE-PROCESS.md`.

### Test checklist localhost:3000

```
1. /                       → 6 thẻ database showcase + footer 4 cột
2. /on-thi-chung-chi       → picker 3 step → quiz 25 câu → result review
3. /dinh-muc               → click 1 mã, F12 mobile 375px, table scroll ngang
4. /profile                → upload avatar Cloudinary
5. /settings               → section "Thông báo" có master toggle + 6 topic toggles
```

---

## 🏗️ HỆ SINH THÁI (TRẠNG THÁI THỰC)

| # | Thành phần | Loại | Status | Note |
|---|---|---|---|---|
| 0 | **Website** | Next.js 14 | ✅ DEPLOYED Phase 19.23 | https://trishteam.io.vn |
| 1 | **TrishLauncher** | Tauri 2 | ✅ Released v2.0.0-1 | Hub + tray + auto-update |
| 2 | **TrishLibrary 3.0** | Tauri 2 | ✅ Released v3.0.0 | **4 module gộp**: 📚 Thư viện · 📝 Ghi chú · 📄 Tài liệu · 🖼 Ảnh |
| 3 | **TrishAdmin v1.1** | Tauri 2 | ✅ Code done, build local | Private — không GitHub Release |
| 4 | **TrishFont v2.0.0-1** | Tauri 2 | ✅ Released | Font manager + Pair AI + AutoCAD .shx |
| 5 | **TrishCheck v2.0.0-1** | Tauri 2 | ✅ Released | System info + benchmark + GPU detect |
| 6 | **TrishClean v2.0.0-1** | Tauri 2 | ✅ Released | Cleaner + undo 7 ngày |
| 7 | **TrishISO v1.0.0** ⭐ | Tauri 2 + React | 🟢 Code done, chờ build | **Admin only** — quản lý hồ sơ ISO + thiết bị |
| 8 | **TrishFinance v1.0.0** ⭐ | Tauri 2 + HTML | 🟢 Code done, chờ build | **Admin only** — bán hàng + phòng trọ + thu chi |
| 9 | **TrishDrive v0.1-alpha** ⭐ | Tauri 2 + React + Rust | 🟡 Skeleton done | Cloud storage qua Telegram |
| 10 | **TrishDesign** | Tauri 2 | 🟡 Chưa scaffold | Phase 23+ (sau TrishISO/Finance/Drive) |

**4 app đã GỘP vào TrishLibrary 3.0** (đánh dấu deprecated trong `apps-registry.json`):
- ❌ TrishNote → module Ghi chú trong Library
- ❌ TrishImage → module Ảnh trong Library
- ❌ TrishSearch → built-in search trong Library (Tantivy)
- ❌ TrishType → module Tài liệu trong Library

→ **Folder source `apps-desktop/{trishnote,trishimage,trishsearch,trishtype}` có thể xóa** (giữ entries deprecated trong registry để hiển thị "đã gộp").

---

## 🔐 CONFIG KEYS (KEY ENV — KHÔNG COMMIT)

### Firebase project: `trishteam-17c2d`
```
Region:        asia-southeast1
Owner:         trishteam.official@gmail.com
Admins:        trishteam.official@gmail.com, hosytri77@gmail.com
Plan:          Spark (FREE — Storage disabled, dùng Cloudinary thay)
Service acct:  ./secrets/service-account.json (gitignored)
```

### `website/.env.local` (mẫu — copy paste khi setup máy mới)
```bash
# Firebase (project trishteam-17c2d)
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyBj3hf6kRsGf-_X_pLLJ2TpN_Br1x4b96s
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=trishteam-17c2d.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=trishteam-17c2d
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=trishteam-17c2d.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=487461805589
NEXT_PUBLIC_FIREBASE_APP_ID=1:487461805589:web:576e851228487f253a781c

# Cloudinary
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=trishteam
CLOUDINARY_API_KEY=995127162844417
CLOUDINARY_API_SECRET=EN6YTQYNGnzlwq12WOx0QjXXU5o

# Google AI (Gemini)
GOOGLE_AI_API_KEY=AIzaSyCnEenaSyKX2bGEbbBz63YfPVIfXbQSPyU

# Firebase Admin (server-side)
GOOGLE_APPLICATION_CREDENTIALS=../secrets/service-account.json

# Telegram (feedback bot)
TELEGRAM_BOT_TOKEN=<lấy từ @BotFather>
TELEGRAM_CHAT_ID=<lấy từ @userinfobot>
```

### Domain & Repo
```
Domain:    trishteam.io.vn (Tenten DNS → Vercel CNAME)
GitHub:    https://github.com/hosytri07/trishnexus-monorepo
Branch:    main (Vercel auto-deploy)
Registry:  https://trishteam.io.vn/apps-registry.json (contract với TrishLauncher)
```

---

## 🌐 WEBSITE — TRẠNG THÁI PHASE 19.22

### Database tra cứu (6 bộ)
| Route | Data | Size | Note |
|---|---|---|---|
| `/bien-bao` | 451 biển QC41:2024 | 36KB JSON | có loading skeleton |
| `/cau-vn` | 7,549 cầu | 1.8MB JSON | Leaflet map, lazy fetch |
| `/duong-vn` | 25 tuyến | inline TS | |
| `/quy-chuan` | 19 QCVN/TCVN | inline TS | Phase 19.20 |
| `/dinh-muc` | 17 mã QĐ 1776 | inline TS | Phase 19.20 + máy tính khối lượng |
| `/vat-lieu` | 25 vật liệu | inline TS | |

### Quiz ôn thi (4 bộ)
| Route | Data | Status |
|---|---|---|
| `/on-thi-lai-xe` | 30 câu mẫu | ⏳ chờ Trí cấp 600 câu thật có đáp án |
| `/on-thi-chung-chi` | **8,081 câu BXD 163/2025** | ✅ Phase 19.21 — 3.7MB lazy fetch, picker 3 step (chuyên ngành → hạng → chuyên đề), 25 câu/đề, 60 phút, đậu ≥18, resume localStorage |
| `/tin-hoc-vp` | 25 câu mẫu | Phase 19.20 |
| `/tieng-anh` | 23 câu mẫu | Phase 19.20 |

### Công cụ (11)
`/cong-cu/` + `pomodoro` · `may-tinh-tai-chinh` · `qr-code` · `don-vi` · `tinh-ngay` · `bmi` · `rut-gon-link` · `mat-khau` · `base64` · `hash` · `vn2000` (Helmert 7-param)

### Features đặc biệt
- **Auth:** Firebase Auth + Firestore role guest/trial/user/admin
- **Avatar:** Cloudinary signed upload, public_id `avatar/{uid}` (overwrite)
- **Notification prefs:** `lib/notification-prefs.ts` — 6 topics, save Firestore (signed-in) + localStorage (guest). FCM push CHƯA wire (Phase 20+)
- **Ctrl+K palette:** Universal search 16+ routes (`lib/search/static-sources.ts`)
- **Theme:** dark/light auto qua CSS variables `var(--color-*)`
- **PWA:** Service worker offline, Web Vitals reporter
- **Analytics:** Umami self-hosted
- **Sitemap:** `app/sitemap.ts` — 30+ routes priority matrix
- **404 page:** Custom với 6 quick-link database
- **Footer:** 4 cột (Học tập / Database / Công cụ / TrishTEAM) + 18 link

---

## 🛠 TECH STACK CHỐT

### Website
- Next.js 14 App Router · React 18 · Tailwind · TypeScript
- Firebase Web SDK (Auth + Firestore client) + firebase-admin (server actions)
- Cloudinary signed upload + 11 transform presets
- Vercel deploy auto từ `git push origin main`

### Desktop (Tauri 2)
- React 18 + Vite 5 + TS · Rust 1.77 + Tauri 2 commands
- `@trishteam/core` (pure TS, cross-platform domain logic)
- `@trishteam/auth` (Firebase REST + DPAPI Windows token store)
- Tantivy 0.22 (BM25 search), pdf-extract, lopdf 0.34, printpdf 0.6

### Storage strategy
- **Firestore:** metadata nhỏ (users, notes, posts, comments, audit) — Spark plan đủ
- **Cloudinary 25GB:** avatar, biển báo, cầu, blog hero
- **GitHub Releases:** desktop installers (.exe / .msi)
- **Vercel `/public/`:** static JSON lớn (cert-bxd163.json 3.7MB, bridges-vn.json 1.8MB)
- **Firebase Storage:** ❌ KHÔNG dùng (Spark disable)

---

## 🗂 MONOREPO STRUCTURE

```
trishnexus-monorepo/
├── apps-desktop/        7 app Tauri (sau khi xóa 4 app gộp)
│   ├── trishadmin/
│   ├── trishcheck/
│   ├── trishclean/
│   ├── trishdesign/     (placeholder)
│   ├── trishfont/
│   ├── trishlauncher/
│   └── trishlibrary/    ← 3.0 (4 module gộp)
├── website/             Next.js 14
│   ├── app/             (database/quiz/công cụ/admin/api routes)
│   ├── components/      50+ widgets
│   ├── data/            inline TS data (25-27 file)
│   ├── lib/             firebase, auth, cloudinary, search, vn2000, etc.
│   ├── public/          big JSON + icons + logos
│   └── .env.local       (gitignored — copy từ section CONFIG KEYS)
├── packages/            shared (auth, core, ui, data)
├── functions/           Cloud Functions TS (setUserRole, exchangeForWebToken)
├── shared/              shared Python/JS legacy
├── scripts/             START.bat, END.bat, CLEAN-BUILD-CACHE.bat, qa, firebase
├── secrets/             service-account.json (gitignored)
├── docs/                handoff (FILE NÀY) + roadmap + design + setup
├── design/              logos, tokens
├── firestore.rules
└── firestore.indexes.json
```

---

## ⚙️ WORKFLOW PHIÊN (NHÀ ↔ CƠ QUAN)

### Quy tắc luân chuyển
1. **Cuối phiên (bất kỳ máy):** Chạy `scripts\END.bat`
   - Commit + push GitHub
   - Update file handoff này (mark phase done, ghi pick-up cho phiên kế)
2. **Đầu phiên (máy mới):** Chạy `scripts\START.bat`
   - Pull GitHub + pnpm install
   - Show status + show máy đang ở nhà / cơ quan
3. **Deploy rules** (chỉ khi `firestore.rules` đổi): `scripts\DEPLOY-RULES.bat`

### .bat script đã có
| Script | Chức năng |
|---|---|
| `START.bat` | Đầu phiên — pull + install + status |
| `END.bat` | Cuối phiên — commit + push + (nhắc update HANDOFF) |
| `CLEAN-BUILD-CACHE.bat` | Xóa target/dist của apps-desktop (~64GB cache) |
| `DEPLOY-RULES.bat` | Deploy Firestore rules |
| `RUN-TRISHADMIN.bat` | Run TrishAdmin dev |
| `RUN-TRISHFONT.bat` | Run TrishFont dev |
| `SETUP.bat` | Setup máy mới (cài deps lần đầu) |

### Phân biệt máy
File `.machine-label` ở root project (gitignored) chứa `home` hoặc `office`. START.bat đọc và hiển thị label. Lần đầu chạy mỗi máy → tự hỏi và lưu.

---

## 🚦 RULES BẮT BUỘC CHO CLAUDE

### Khi bắt đầu phiên
1. Trí gõ "tiếp tục" / "pick up" / "đọc handoff" → đọc FILE NÀY trước khi làm gì khác
2. Tóm tắt 2-3 dòng "đang ở đâu" rồi propose action
3. **Lệnh terminal đưa 1 dòng copy-paste** (ghép `;` cho PowerShell, `&&` cho cmd) — không tách step-by-step

### Khi kết thúc phiên
Trước khi Trí bấm `END.bat`:
1. Update section "PICK UP TỪ ĐÂY" của file này
2. Mark phase đã xong / thêm phase mới ở section "LỊCH SỬ PHASE"
3. Cập nhật "Pending cho phiên kế"

### Giao tiếp
- **Tiếng Việt** mọi nơi
- Trí ngắn gọn ("ok", "tiếp tục", "được rồi") = confirm, cứ chạy tiếp
- Khi Trí hỏi "còn gì nữa" → liệt kê option theo độ ưu tiên
- Tránh emoji nhiều, tránh post-amble dài, tránh "sao chép câu hỏi rồi trả lời"

### Không tự ý làm
- Đừng deploy production khi chưa confirm
- Đừng xóa file legacy chưa hỏi
- Đừng sửa source data Trí cung cấp (PDF, JSON) — chỉ parse, không bịa
- Đừng commit secrets / API keys

### Design system (bất biến)
- **Font:** Be Vietnam Pro (Latin + Vietnamese subsets)
- **Color:** Theme variables CSS qua tokens (`var(--color-text-primary)`, etc.) — KHÔNG hard-code
- **Accent:** `#667eea → #764ba2` (gradient tím-indigo)
- **Theme:** Auto switch qua `data-theme="dark"|"light"` trên `<html>`

### Patterns / Gotchas
- **Cloudinary:** signed upload qua `/api/cloudinary/sign`, folder pattern (avatar/temp/sign/bridge/post)
- **Firestore rules:** Bắt buộc pass — deploy rules trước khi dùng query mới
- **Big JSON:** lazy fetch + `cache: 'force-cache'` + có `loading.tsx` skeleton
- **LocalStorage:** wrap `useEffect`, check `typeof window !== 'undefined'`
- **Static metadata:** Layout server component export `metadata`, không dùng trong `'use client'`
- **Mobile:** container `max-w-{N} mx-auto px-6`, grid `grid-cols-1 md:grid-cols-{N}`, table bọc `overflow-x-auto -mx-6 px-6` + `min-w-{N}px` + `whitespace-nowrap`
- **Vietnamese diacritics:** `foldVietnamese()` trong `@trishteam/core/search` cho fuzzy match

### Phong thủy / tử vi
**KHÔNG bao giờ** thêm. Đã loại vĩnh viễn.

---

## 📜 LỊCH SỬ PHASE (TÓM TẮT)

| Phase | Nội dung | Ngày |
|---|---|---|
| **14.x** | Monorepo + TrishLauncher v2 (Tauri 2) + 3 app đầu (Check/Clean/Font) | Đầu 04/2026 |
| **15.x** | Release Check/Font/Library v2.0.0-1 | 25/04 |
| **16.x** | Firebase Auth + Firestore role-based + TrishLibrary v2.1 sync 2 chiều | 26/04 |
| **17.x** | 5 app code mới: Clean/Note/Search/Image/Type | 27/04 |
| **18.6** | Build TrishLibrary 3.0.0 NSIS .exe + GitHub release | 27/04 |
| **18.7** | TrishAdmin scaffold | 27/04 |
| **18.8.a** | TrishAdmin v1.1 → 9 panel + audit log | 27/04 |
| **18.8.b/c** | Telemetry package + wire vào tất cả app | ⏳ TODO |
| **19.1-19.18** | Website slim layout, Firebase login, blog, admin panel, 404 custom, sidebar refactor | 27/04 |
| **19.20** | Website: 6 database + 4 quiz + công cụ VN2000 + sitemap + Ctrl+K | 28/04 cơ quan |
| **19.21** | Website: Cert exam BXD 163/2025 (8081 câu) — rewrite `/on-thi-chung-chi` | 28/04 cơ quan |
| **19.22** | Web admin hoàn thiện: /admin/users CRUD, /admin/databases, /admin/apps, /admin/library, blog ID sequence, countdown realtime, blog preview widget, URL shortener TrishTEAM, banner Firestore, logo bg trắng đồng nhất, Việt hóa | 28-29/04 |
| **19.23** | ✅ **DEPLOYED PRODUCTION** https://trishteam.io.vn (12 env vars Vercel, base64 service account, ENABLE_EXPERIMENTAL_COREPACK) | 29/04 nhà |
| **19.24** | ✅ TrishAdmin desktop parity — 4 panel mới: BackupPanel (export/import JSON, audit), DatabaseVnPanel (4 collection JSON editor), BulkImportPanel (CSV/TSV → Firestore batch), StoragePanel (Cloudinary quota + folders + top files). CSS bổ sung 459 dòng. | 29/04 nhà |
| **20.x** | ✅ TrishLauncher Sync + Web optimization (8 sub-task) | 29/04 |
| **21.prep** | ✅ Cleanup + Telemetry + Observability — packages/telemetry, ErrorsPanel + VitalsPanel TrishAdmin v1.1.0, backup-firestore.yml weekly, docs SENTRY-SETUP, .gitattributes CRLF | 29/04 |
| **21.x** | ⏳ TrishDesign desktop (AutoCAD + AI RAG TCVN/AASHTO) | TODO |

---

## 📋 VIỆC CÒN DANG DỞ

### Cần Trí cung cấp source
- **600 câu lái xe có đáp án** (PDF cũ image-based, sandbox không OCR được tiếng Việt)
- **250 câu moto có đáp án**
- **Ảnh thật biển báo QC41:2024** (upload qua admin panel sau)
- **Lat/lng GPS chính xác cho 7,549 cầu** (hiện jitter ±0.15° — geocoding Gemini API là Phase 21)

### Cần code (Phase 20+)
- FCM push notification thực sự (Cloud Function + service worker)
- Admin UI CRUD cho câu hỏi BXD 163 / định mức / quy chuẩn / vật liệu
- Bookmark / favorite biển báo + câu hỏi
- Lịch sử thi → Firestore `/users/{uid}/exam-history`
- Leaderboard tuần / tháng
- i18n vi/en (next-intl wire)

### Desktop pending
- Telemetry package + wire `reportError()` / `reportVital()` vào 7 app
- Errors panel + Vitals panel trong TrishAdmin
- TrishAdmin build + release
- TrishDesign scaffold

---

## 🔧 LỆNH HAY DÙNG (1 dòng)

```bash
# Test website local
cd 'C:\Users\TRI\Documents\Claude\Projects\TrishTEAM\trishnexus-monorepo\website'; pnpm dev

# Build website check (luôn chạy trước push)
cd 'C:\Users\TRI\Documents\Claude\Projects\TrishTEAM\trishnexus-monorepo\website'; pnpm build

# Lint
cd 'C:\Users\TRI\Documents\Claude\Projects\TrishTEAM\trishnexus-monorepo\website'; pnpm lint

# Run desktop app dev (ví dụ TrishLibrary)
cd 'C:\Users\TRI\Documents\Claude\Projects\TrishTEAM\trishnexus-monorepo\apps-desktop\trishlibrary'; pnpm tauri dev

# QA all (73 check)
cd 'C:\Users\TRI\Documents\Claude\Projects\TrishTEAM\trishnexus-monorepo'; pnpm qa:all

# Set admin role (sau khi tải service-account.json về secrets/)
cd 'C:\Users\TRI\Documents\Claude\Projects\TrishTEAM\trishnexus-monorepo'; $env:GOOGLE_APPLICATION_CREDENTIALS="./secrets/service-account.json"; npx ts-node scripts/firebase/seed-admin.ts --email trishteam.official@gmail.com

# Deploy Firestore rules
scripts\DEPLOY-RULES.bat

# Deploy production
git push origin main   # Vercel auto-deploy
```

---

## 📚 FILE DOCS GIỮ LẠI (REFERENCE)

| File | Mục đích |
|---|---|
| **HANDOFF-MASTER.md** | ← FILE NÀY — đọc đầu phiên |
| **PARITY-WEB-TRISHADMIN.md** | ★ Mới — gap analysis web vs desktop + roadmap deploy → Zalo → TrishDesign |
| `CHANGELOG.md` | Lịch sử release chi tiết |
| `ROADMAP.md` | Lộ trình phase 20+ |
| `DESIGN.md` + `design-spec.md` | Design system tokens |
| `FIREBASE-SETUP.md` | Setup Firebase project mới |
| `DEPLOY-VERCEL.md` | Deploy steps Vercel |
| `DOMAIN-TENTEN.md` | Setup domain Tenten DNS |
| `SETUP-HOME-PC.md` | Cài deps máy mới (Node, Rust, etc.) |
| `WEB-DESKTOP-PARITY.md` | Mapping feature web ↔ desktop |
| `STORAGE-STRATEGY.md` | Lý do chọn Cloudinary vs Firebase |
| `PACKAGING.md` | Build & sign NSIS installer |
| `RELEASE-CHECKLIST.md` | Pre-release sanity check |

### File đã merge vào MASTER → có thể XÓA
- ~~`HANDOFF-WEBSITE-PHASE-19.md`~~ (22KB)
- ~~`HANDOFF-TRISHLIBRARY-3.0.md`~~ (35KB)
- ~~`SESSION-HANDOFF.md`~~ (88KB) — archive Phase 14-16 cũ

→ Sau khi xác nhận MASTER đã đủ thông tin → xóa 3 file trên.

---

**End of HANDOFF-MASTER.md.**
