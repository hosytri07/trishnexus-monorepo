# 🧠 HANDOFF-MASTER.md — TrishTEAM Monorepo

> **ĐỌC FILE NÀY ĐẦU TIÊN MỌI PHIÊN MỚI.** Đây là file handoff DUY NHẤT của hệ sinh thái.
>
> **Cập nhật:** 2026-05-03 cuối phiên (Phase 25.x → 33 DONE — toàn bộ ecosystem rebuild + TrishShortcut MỚI + apps-registry rewrite. Pending: build wave release v1.0.0.)
> **Chủ dự án:** Trí (hosytri77@gmail.com / trishteam.official@gmail.com) — kỹ sư hạ tầng giao thông Đà Nẵng. Không phải dev. Giao tiếp tiếng Việt, tránh jargon.

---

## 🎯 MỤC TIÊU DỰ ÁN

TrishTEAM là **hệ sinh thái phần mềm + tri thức + công cụ** cho kỹ sư xây dựng / giao thông Việt Nam. 1 tài khoản duy nhất, đồng bộ giữa **website (trishteam.io.vn)** và **10 desktop apps** (Tauri 2 + Rust + React).

```
┌──────────────────────────────────────────────────────────┐
│  Website (Next.js 14) — trishteam.io.vn                  │
│    Dashboard + Database tra cứu + Quiz + Công cụ + Blog  │
│                                                           │
│  Desktop apps (Tauri 2)                                  │
│    TrishLauncher · TrishLibrary · TrishAdmin (private)   │
│    TrishFont · TrishCheck · TrishClean                   │
│    TrishFinance (PWA + desktop) · TrishISO               │
│    TrishShortcut (NEW Phase 32) · TrishDesign (countdown)│
│                                                           │
│  Shared:                                                  │
│    Firebase Auth + Firestore (project: trishteam-17c2d)  │
│    Cloudinary 25GB · GitHub Releases · Vercel deploy     │
└──────────────────────────────────────────────────────────┘
```

---

## 🔴 PICK UP TỪ ĐÂY (PHIÊN MỚI 2026-05-05+)

### ⚠️ Cuối phiên 2026-05-04 (máy nhà) — Phase 35-36 progress

**Quyết định lớn 2026-05-04:**
- Bỏ ý tưởng tạo TrishPDF (TrishLibrary đã có 13 PDF tools, sẽ extend thay vì tạo mới)
- Bỏ TrishStudy / TrishTool / TrishFleet (out of scope)
- Hệ sinh thái cuối: **11 apps** thay vì 15
- Roadmap chốt thứ tự ưu tiên: Login/Key system → 7 apps cải thiện → TrishLauncher gom apps → Website → TrishDesign

**Spec key system v2 chốt (Trí confirm):**
- `max_concurrent` default = 1 (admin override per-key 1-99)
- Key expiry default = 365 ngày (admin override hoặc vô hạn)
- Kick mode = B (toast 5s + auto logout máy cũ qua Firestore listener)
- Permission = B (mỗi app key riêng: Finance/ISO/Office/Library/Drive/Design + key 'all' bundle)
- Migration = B (user nhập lại key cho từng app, admin cấp lại qua TrishAdmin, có quyền xóa keys cũ)
- Keys do admin cấp nội bộ — KHÔNG bán

**Việc đã xong session này:**
- ✅ Phase 35 — Maintenance landing trishteam.io.vn + countdown 09h 07/05/2026 + auto unlock + nhạc Bensound
- ✅ Phase 28.4.G — TrishDesign UI fix (Modal "+ Đoạn", Sửa/Xóa hồ sơ, Mode bão lũ split 500m+500m, inherit drawing settings, Export/Import JSON, Km label format)
- ✅ Phase 36.1 — Schema types (`packages/data/src/index.ts` v0.3.0):
  - AppId enum (12 apps + 'all')
  - AppKeyBinding, KeySession, DeviceActivation, AuditLog
  - TrishUser.app_keys map
  - ActivationKey mở rộng: type/app_id/bound_*/max_concurrent/recipient
  - Helpers: defaultKeyExpiresAt, normalizeActivationKey, isKeyValid, userHasAppAccess
- ✅ Phase 36.2 — Firestore rules cho keys + sessions subcollection + device_activations + audit_logs
- ✅ Phase 36.3 — Cloud Function registerKeySession + heartbeatKeySession + endKeySession (atomic, kick oldest, audit)
- ✅ Phase 36.4 — Cloud Function cleanupExpiredSessions (scheduled 10min)
- ✅ Docs mới:
  - `docs/APPS-IDEAS-MAPPING.md` — gộp 72 ý tưởng vào 11 apps
  - `docs/KEY-LICENSE-CONCURRENT-CONTROL.md` — architecture v2

**🚧 PENDING (tiếp tục phiên kế — bắt đầu từ Phase 37.3 wire apps):**

### ⚡ Quick context for next session:

**Đã DONE session 2026-05-04 (cực kỳ năng suất):**

### Phase 36 — Backend foundation
- 36.1 Schema types (`packages/data` v0.3.0): AppId / AppKeyBinding / KeySession / DeviceActivation / AuditLog + helpers
- 36.2 Firestore rules cho keys/sessions/audit/device
- 36.3-4 Vercel API routes (Functions v1 không deploy được do Spark, dùng Vercel API thay):
  - `/api/keys/register-session` (atomic transaction kick oldest)
  - `/api/keys/heartbeat`
  - `/api/keys/end-session`
  - Lazy cleanup expired sessions (no cron)
  - Đã deploy production
- 36.5 Rust crate `packages/machine-id/` (SHA256 hostname + MAC + WindowsGUID → 16 hex chars)
- 36.6 TS client `packages/auth/src/key-session.ts` (registerSession + heartbeat + listenSessionKick + activateAndStartSession)

### Phase 37 — UI + Wire 7 apps
- 37.1 React component `packages/auth/src/key-activation-modal.tsx` (form 16 chars, format auto, error VN)
- 37.3 KeyGate generic shared component + 7 apps wired:
  - **Account key** (3): TrishLibrary, TrishDrive, TrishISO
  - **Standalone key** (4): TrishShortcut, TrishCheck, TrishClean, TrishFont
  - Mỗi app: Cargo dep machine-id + Tauri command get_device_id + KeyGate.tsx wrapper + main.tsx wrap
- 37.5 TrishAdmin KeysPanel mở rộng (form: appId/maxConcurrent/recipient/keyType auto-derived) + helpers extendKeyExpiry + resetKeyBinding + listActiveSessions + kickSession
- 37.6 TrishAdmin ActiveSessionsPanel (mới): table + filter + force kick + auto-refresh 30s
- 37.7 Website `/admin/sessions` mirror với onSnapshot realtime collectionGroup query

### Phase 38.1 — TrishLauncher partial
- apps-seed.ts: 11 apps + 4 deprecated với metadata `requires_key` + `key_type`
- AppCard render badge `keyTypeBadge`: 🆓 Free / 🔒 Key máy / 🗝 Key tài khoản
- website/public/apps-registry.json schema v5: 11 apps + metadata key

### File mới session 2026-05-04:
- `packages/data/src/index.ts` (v0.3.0 — schema mới)
- `firestore.rules` (sessions/audit/device)
- `website/lib/keys-session.ts`
- `website/app/api/keys/{register-session,heartbeat,end-session}/route.ts`
- `packages/machine-id/Cargo.toml` + `src/lib.rs`
- `packages/auth/src/key-session.ts`
- `packages/auth/src/key-activation-modal.tsx`
- `packages/auth/src/key-gate.tsx`
- `packages/auth/src/use-key-session.ts`
- `apps-desktop/{trishlibrary,trishdrive,trishiso,trishshortcut,trishcheck,trishclean,trishfont}/src/KeyGate.tsx`
- `apps-desktop/trishadmin/src/components/ActiveSessionsPanel.tsx`
- `website/app/admin/sessions/page.tsx`
- `packages/core/src/apps/types.ts` (mở rộng schema)
- `apps-desktop/trishlauncher/src/apps-seed.ts` (11 apps + metadata)
- `website/public/apps-registry.json` (schema v5)
- `docs/APPS-IDEAS-MAPPING.md`
- `docs/KEY-LICENSE-CONCURRENT-CONTROL.md`

### ⏳ PENDING tiếp tục Phase 38+ (sau session 2026-05-04):

**Trước khi đi tiếp Phase 38, Trí cần làm:**

1. **Deploy Firestore rules:**
   ```powershell
   scripts\DEPLOY-RULES.bat
   ```

2. **Push code lên Vercel:**
   ```powershell
   cd C:\Users\ADMIN\Documents\Claude\Projects\TrishTEAM\trishnexus-monorepo; git add -A; git commit -m "feat: Phase 36+37 key system end-to-end + Phase 38.1 launcher metadata"; git push origin main
   ```

3. **Cài deps machine-id Rust crate** (1 lần, các app sẽ link path):
   ```powershell
   cd C:\Users\ADMIN\Documents\Claude\Projects\TrishTEAM\trishnexus-monorepo; pnpm install
   ```

4. **Build test 1 app** (vd TrishLibrary) để verify Tauri command machine_id work:
   ```powershell
   pnpm -C apps-desktop\trishlibrary tauri dev
   ```

5. **Test end-to-end**:
   - Mở TrishAdmin desktop → Keys panel → Generate key cho app `trishlibrary` (account)
   - Mở TrishLibrary → modal nhập key 16 chars
   - Activate → app chạy + heartbeat 5min + listener kick
   - Mở /dashboard website → thấy app_keys + active sessions
   - Mở /admin/sessions website → thấy session active + kick được

#### Phase 38 — Cải thiện apps theo thứ tự Trí chốt:

- **38.2 TrishLibrary PDF Pro** (4 module):
  - [x] **38.2.1 PDF Binder** ✅ DONE — gộp PDF + bookmark sidebar (Rust pdf_binder + UI ToolBinder)
  - [ ] 38.2.2 PDF Stamp Pro (image + QR + chữ ký scan) — extend pdf_add_watermark, embed image XObject
  - [ ] 38.2.3 PDF Title Reader OCR (auto rename file dựa khung tên) — extend pdf_ocr + regex parse
  - [ ] 38.2.4 PDF Revision Compare (highlight diff 2 PDF) — pixel diff hoặc text diff

- **38.3 TrishFinance convert HTML → React + tier gate** (~1 tuần)

- **38.4 TrishISO Hoan Cong Checklist** (theo loại công trình: đường/cầu/thoát nước/điện) + QR truy xuất (~3 ngày)

- **38.5 TrishDrive share workaround MTProto** (web /proxy implement bot.forwardMessage workaround) (~3 ngày)

- **38.6 TrishOffice MỚI** — BuildOffice Assistant (Project Launcher + File Rename + Biên bản + Photo Report + Công văn). Tạo app từ scratch (~2 tuần)

#### Phase 39 — Website (sau Phase 38):

- 39.1 Tab "Hướng dẫn" cho 11 apps
- 39.2 Section "Tải về" hiển thị 11 apps + screenshots
- 39.3 Blog tutorial 3 app chính
- 39.4 SEO + sitemap update

#### Phase 40 — TrishDesign Pro (sau cùng, ~6 tuần):

- 40.1 Refactor 8 nhóm tool sidebar
- 40.2 AutoCAD Batch Plot + PDF Publisher
- 40.3 Quantity tools (LLEN, Area, Block Counter, BOQ)
- 40.4 Standard Checker + Cleaner
- 40.5 Block + Attribute extractor

### File tạo/sửa session 2026-05-04:
- ✅ `packages/data/src/index.ts` v0.3.0 (schema mới)
- ✅ `firestore.rules` (sessions/audit/device rules)
- ✅ `website/lib/keys-session.ts` (logic atomic)
- ✅ `website/app/api/keys/register-session/route.ts`
- ✅ `website/app/api/keys/heartbeat/route.ts`
- ✅ `website/app/api/keys/end-session/route.ts`
- ✅ `packages/machine-id/Cargo.toml` + `src/lib.rs`
- ✅ `packages/auth/src/key-session.ts`
- ✅ `packages/auth/src/key-activation-modal.tsx`
- ✅ `packages/auth/src/index.ts` (re-export)
- ✅ `packages/auth/src/react.tsx` (re-export modal)
- ✅ `packages/core/src/apps/types.ts` (thêm requires_key + key_type)
- ✅ `apps-desktop/trishlauncher/src/apps-seed.ts` (11 apps + metadata)
- ⚠️ `functions/src/registerKeySession.ts` + `cleanupExpiredSessions.ts` — giữ làm reference, KHÔNG export (Spark plan không deploy được)

### Phase 37 — Activation UI + Wire apps (2-3 tuần)
- 37.1 Activation modal component (account key)
- 37.2 Activation modal component (standalone key)
- 37.3 Wire 7 apps gate logic (Library/Drive/Design/Finance/ISO/Office/Shortcut/Check/Clean/Font)
- 37.4 New login alert toast 5s + auto logout (Firestore listener)
- 37.5 TrishAdmin KeysPanel mở rộng (form tạo with type/app_id/expiry/concurrent/recipient + Delete + Reset binding)
- 37.6 TrishAdmin ActiveSessionsPanel (mới)
- 37.7 Website /admin/keys mở rộng + /admin/sessions + /admin/audit
- 37.8 User /dashboard hiện app_keys + active sessions

### Phase 38 — Migration + 7 apps cải thiện (theo thứ tự Trí chốt)
- 38.0 Migration script (iso_admin/finance_user → app_keys)
- 38.1 TrishLauncher: gom TẤT CẢ 11 apps vào hub (status: activated/trial/expired)
- 38.2 TrishLibrary PDF Pro 4 module (Stamp/Binder/OCR/Compare)
- 38.3 TrishFinance: convert HTML→React + tier gate
- 38.4 TrishISO: Hoan Cong Checklist + QR
- 38.5 TrishDrive: share workaround MTProto
- 38.6 TrishOffice: TẠO MỚI app (BuildOffice Assistant: Project Launcher / File Rename / Biên bản / Báo cáo / Công văn)
- 38.7 TrishFont/Check/Clean/Shortcut: standalone key gate

### Phase 39 — Website
- 39.1 Tab "Hướng dẫn" cho 11 apps
- 39.2 Section "Tải về" hiển thị 11 apps + screenshots
- 39.3 Blog tutorial 3 app chính
- 39.4 SEO + sitemap update

### Phase 40 — TrishDesign Pro (sau cùng, 4-6 tuần)
- 40.1 Refactor 8 nhóm tool sidebar (Batch Plot, Quantity, Standard, Block, Excel↔CAD, Quick LISP, Revision, Layer Preset)
- 40.2 AutoCAD Batch Plot + PDF Publisher
- 40.3 Quantity tools (LLEN, Area, Block Counter, BOQ Generator)
- 40.4 Standard Checker + Cleaner
- 40.5 Block + Attribute extractor

---

### ⚠️ Cuối phiên 2026-05-03 (máy nhà) — Phase 25.x → 33 DONE, build wave PENDING

**Quyết định lớn của Trí trong session này:**
- TrishOffice + TrishFleet **bỏ khỏi roadmap** (sẽ làm sau nếu cần)
- TrishDrive User app gộp vào hệ sinh thái (admin Drive trong TrishAdmin, user Drive standalone)
- Build TrishShortcut từ scratch — full features (favorite + workspace + hotkey + overlay + tray + backup)
- Apps-registry rewrite: 9 app released, TrishDesign countdown 7/5/2026
- Reset toàn bộ về v1.0.0 cho wave release đầu tiên

**Việc đã xong session này (~150 file thay đổi):**
- ✅ Phase 25.0.F → 25.2.A — TrishAdmin Share idempotent + TrishDrive concurrent download + parallel MTProto upload 3x + config fallback file + AUTH_RESTART auto-retry
- ✅ Phase 29 — Cleanup chữ "Phase X.Y" UI text 7 app
- ✅ Phase 30.1-30.4 — Rebuild Library/Font/Check/Clean design-system với theme-bridge.css
- ✅ Phase 31.2-31.3 — TrishISO verify, TrishAdmin bump 1.0.0
- ✅ Phase 32 — Build TrishShortcut full app (28 file mới: scaffold + form + scanner + favorite + workspace + hotkey + Quick Launcher Ctrl+Space + Settings modal + tray + Dashboard widget + drag-drop)
- ✅ Phase 33 — apps-registry.json rewrite gọn 9 app + TrishLauncher rebuild + bỏ tauri-plugin-updater 7 app + createUpdaterArtifacts:false

**🚧 PENDING (tiếp tục mai/máy cơ quan):**

#### Phase 34 — Wave release v1.0.0 (ĐANG BLOCK BUILD)

Bug đã fix code, Trí cần BUILD lại:

```powershell
cd C:\Users\TRI\Documents\Claude\Projects\TrishTEAM\trishnexus-monorepo

# 1. Reinstall NPM (TrishShortcut bumped api ^2.11.0)
pnpm install

# 2. Xoá Cargo.lock cũ để re-resolve
Get-ChildItem apps-desktop\*\src-tauri\Cargo.lock | Remove-Item -ErrorAction SilentlyContinue

# 3. Build 8 app lần lượt
pnpm -C apps-desktop\trishshortcut tauri build
pnpm -C apps-desktop\trishlauncher tauri build
pnpm -C apps-desktop\trishlibrary tauri build
pnpm -C apps-desktop\trishfont tauri build
pnpm -C apps-desktop\trishcheck tauri build
pnpm -C apps-desktop\trishclean tauri build
pnpm -C apps-desktop\trishfinance tauri build
pnpm -C apps-desktop\trishiso tauri build
```

Output `.exe` ở `apps-desktop\<app>\src-tauri\target\release\bundle\nsis\<App>_1.0.0_x64-setup.exe`. Dung lượng tổng ~30-40 phút build lần đầu.

Sau khi 8 app build xong → tạo GitHub Release tag rolling:
```powershell
git tag trishshortcut-v1.0.0 && git push origin trishshortcut-v1.0.0
git tag trishlauncher-v1.0.0 && git push origin trishlauncher-v1.0.0
# ... 6 tag còn lại
```

GitHub UI tạo Release cho từng tag → upload .exe.

#### Phase 35 — Commit lớn + Website redesign + countdown TrishDesign

Sau khi build OK → commit toàn bộ Phase 25.x → 34. Vuốt UI/UX website + add countdown widget 7/5/2026 cho TrishDesign trang chủ.

#### Phase 36 — TrishDesign release v1.0.0

Test `pnpm -C apps-desktop\trishdesign tauri build` trên máy có AutoCAD COM. Build NSIS → tag release.

#### Phase 37 — Viết hướng dẫn đầy đủ

User guide từng app + Config guide (Firebase/Cloudinary/MTProto). Đăng tab Hướng dẫn website.

---

### ✅ Đã làm trước session này (tóm tắt)

#### Cuối phiên 2026-04-30 (máy nhà) — Phase 24.1 DONE code-only

**Việc đã xong session này (máy nhà 2026-04-30):**
- ✅ **Phase 24.3 — Design system unify** (5/6 app done)
  - Tạo workspace package `packages/design-system/` với theme.css (Plus Jakarta + emerald + utility CSS) + fonts.ts + index.ts
  - Apply vào TrishAdmin (replace local drive-theme.css)
  - Apply vào TrishISO (bỏ @fontsource/tailwind, dùng package)
  - Apply vào 5 app rebuild (Launcher/Library/Font/Check/Clean): add design-system dep + import + bump version 1.0.0 toàn bộ (theo release_strategy memory)
  - Apply vào website Next.js: switch Be Vietnam Pro → Plus Jakarta Sans qua next/font/google
  - **Defer**: TrishFinance (HTML standalone, no React/Vite — cần approach khác Phase 24.3+)
  - Tất cả 5 app (Launcher/Library/Font/Check/Clean): Cargo.toml + tauri.conf.json + package.json đều bump 1.0.0
- ✅ Phase 24.1 — TrishDrive merged vào TrishAdmin + polish UI/font/theme (đã test build, chạy OK)
  - Polish bao gồm:
    - Bỏ Tailwind v4 framework (gây regression form login). Tự ship ~200 dòng utility CSS scope `.drive-panel`
    - Plus Jakarta Sans áp dụng TOÀN APP TrishAdmin (login + sidebar + panels + drive)
    - Drive panel light cream HARDCODED (vars `:root` của drive-theme.css), KHÔNG đụng html `data-theme`
    - TrishAdmin theme dark/light VẪN do Settings panel TrishAdmin quản lý độc lập
    - Layout Drive: bỏ nested sidebar, dùng top horizontal tabs (7 tab), bỏ duplicate user info/signout
    - Tab label: "TrishDrive (Telegram)" → "☁ Drive Cloud Telegram"
    - Bỏ card "Giao diện" trong Drive Settings (theme do TrishAdmin Settings)
- ✅ Phase 24.1 — TrishDrive merged vào TrishAdmin (code-only)
  - Backend Rust: 5 module copy (creds/crypto/db/mtproto/telegram) + 39 Tauri commands trong lib.rs
  - Cargo.toml: thêm 17 deps (reqwest/tokio/rusqlite/aes-gcm/sha2/keyring/pbkdf2/grammers-* etc.)
  - Frontend React: 7 page TSX + DriveContainer.tsx (rename App → TrishDrivePanel, strip AuthProvider/LoginScreen)
  - App.tsx: thêm Panel id `'drive'` + nav group "TrishDrive" + render TrishDrivePanel
  - package.json: lucide-react + plus-jakarta-sans + tailwindcss v4 + @tailwindcss/vite
  - vite.config.ts: thêm tailwindcss plugin
  - main.tsx: import drive-theme.css
  - tauri.conf.json: bump 1.1.0 → 1.2.0 + CSP api.telegram.org
  - apps-registry.json: TrishDrive status `scheduled` → `private` (đã merge admin)
  - TrishDrive standalone (apps-desktop/trishdrive/) GIỮ codebase, không xoá

**Việc tiếp (phiên kế ở máy nhà hoặc cơ quan):**
1. **Bước 1 — `pnpm install`** ở root để link `@trishteam/design-system` workspace + fetch @fontsource/plus-jakarta-sans (~30s)
2. **Bước 2 — Test build TrishAdmin local:**
   `pnpm -C apps-desktop\trishadmin tauri dev`
   Kiểm tra:
   - Rust compile OK (lần đầu lâu 5-10 phút vì keyring + grammers-* fresh build)
   - Frontend render OK (sidebar TrishAdmin có nav group "TrishDrive")
   - Click tab "☁ TrishDrive (Telegram)" → render setup wizard hoặc dashboard
   - Sub-nav 7 page (Dashboard / Files / Upload / Shares / Trash / Help / Settings) hoạt động
   - Login với uid Firebase admin → load creds từ keyring `vn.trishteam.drive` (re-use TrishDrive standalone setup)
3. **Bước 3 — Sửa lỗi nếu có:**
   - Tailwind v4 + styles.css legacy có thể conflict global (vd `*{box-sizing}`) → check console
   - Drive panel theme có thể lệch nếu Plus Jakarta Sans chưa load (check @fontsource CSS import)
   - Rust `unused import` warnings ở tg_test_bot/tg_get_chat (bot setup chỉ dùng frontend) → có thể `#[allow(dead_code)]`
4. **Sau khi build OK → đi tiếp:**
   - Phase 24.3 (PRIORITY mới) — Trí confirm 2026-04-30: áp dụng Plus Jakarta Sans + emerald theme + utility CSS cho TOÀN BỘ ecosystem.
     - Tạo workspace package `@trishteam/design-system` extract từ `apps-desktop/trishadmin/src/drive-theme.css`
     - Apply rebuild giao diện cho 6 app công khai: TrishLauncher, TrishLibrary, TrishFont, TrishCheck, TrishClean, (TrishDesign chưa scaffold)
     - Apply CHO 2 app đang code (Phase 22.x): **TrishFinance + TrishISO** — đảm bảo cùng font + theme từ đầu, KHÔNG để divergent
     - Website Next.js (trishteam.io.vn): cũng switch sang Plus Jakarta (đang Be Vietnam Pro)
   - Phase 24.2 — TrishLibrary thêm tab "Thư viện TrishTEAM" public view (read Firestore /trishdrive/_/shares is_public=true). Hoãn sau Phase 24.3 vì design system unify quan trọng hơn.

**Phase tiếp theo (priority order, phiên kế):**
- ✅ **Phase 26 Tier 1+2+3+5+6 progress** (cả phiên này, ~14 sub-phase):
  - **Tier 1 (Core User app)**: 26.1.A-G done (backend + DB + share_paste_and_download + UI 4 screen + logo + HelpPage rewrite + progress bar + drag&drop)
  - **Tier 2 (Download power)**: 26.2.A multi-link queue (paste N URL → tải tuần tự + UI queue list)
  - **Tier 3 (Browse/Organize)**: 26.3.B preview inline (%TEMP% + OS default viewer "Xem" button trong Library)
  - **Tier 4 (Sync/Offline)**: 26.4.D auto cleanup history > 90 ngày + manual button
  - **Tier 5 (Integration/UX)**: 26.5.A system tray (minimize to tray + click toggle + tray menu Mở/Lịch sử/Thoát)
  - **Tier 6 (Notification)**: 26.6 polling 60s + toast khi admin add file mới
- ✅ **Phase 26.0 + 26.1.E** — Web infrastructure:
  - /api/drive/share/[token]/proxy: MTProto forwardMessage workaround (Bot API forward channel→log → getFile)
  - /api/drive/share/create: thêm pipeline + is_public + folder_label
  - /api/drive/share/[token]/info: trả pipeline cho client
  - /api/drive/library/list: NEW endpoint với CORS + Bearer auth
- ✅ **Phase 26.1 Tier 1 DONE** — TrishDrive standalone rebuild thành User app (95%, chỉ còn 26.1.E):
  - **Backend Rust (26.1.A-C):**
    - 4 file Rust admin → stub (creds/mtproto/telegram) + db.rs mới với schema download_history
    - lib.rs: 6 commands (app_version, ping, history_list, history_clear, history_update_meta, share_paste_and_download)
    - share_paste_and_download đầy đủ: parse URL → fetch /info → decrypt creds (PBKDF2+AES-GCM) → loop chunks /proxy (cả Bot API + MTProto) → decrypt master_key → write file streaming → verify SHA256 → insert history
    - Cargo.toml: bỏ keyring + grammers-*; giữ aes-gcm/sha2/pbkdf2/hmac/rusqlite
  - **Frontend React (26.1.D):**
    - 3 page mới: DownloadScreen (paste URL + dest picker + decrypt), HistoryScreen (list + bookmark + tag/note + edit modal), LibraryScreen (placeholder Phase 26.1.E)
    - App.tsx rewrite: sub-nav 4 tab (Tải/Thư viện/Lịch sử/Hướng dẫn) + theme toggle + user info + signout
    - 6 pages cũ admin → stub minimal (DashboardPage, FilesPage, SetupWizard, SharesPage, TrashPage, UploadPage) để TS compile OK
  - **Còn lại Phase 26.1.E**: LibraryScreen Firestore listener — fetch /trishdrive/_/shares is_public=true, folder tree, click file → tự gọi share_paste_and_download
  - **Test ngay phiên kế:** `pnpm install; pnpm -C apps-desktop\trishdrive tauri dev` — login Firebase → tab "Tải" paste URL share → tải file. Lần đầu Rust build ~5-10 phút.
- ✅ **Phase 26.0 DONE** — Web /proxy MTProto workaround (forwardMessage)
  - **TRÍ CẦN SETUP TRÊN TELEGRAM + VERCEL TRƯỚC KHI TEST:**
    1. Telegram → New Channel "TrishDrive Log" → Private
    2. Channel Settings → Administrators → Add bot (@bot username) → grant "Post Messages" + "Delete Messages"
    3. Lấy chat_id: forward 1 msg vào channel + dùng @username_to_id_bot HOẶC `bot.getChat`
    4. Thêm vào Vercel env: `TRISHDRIVE_LOG_CHANNEL_ID=-1001xxxxxxxxxx`
    5. `git push origin main` để Vercel re-deploy
  - Server logic: bot.forwardMessage(channel→log) → response Message có document.file_id → bot.getFile + download → bot.deleteMessage cleanup async sau 60s
  - Rust share_create đã unblock MTProto + send pipeline + tg_message_id + channel_id
- **Phase 26 — TrishDrive standalone rebuild thành USER app** (Trí confirm 2026-04-30, 25 tính năng):
  - Tier 1 (P1, ~3-4 phiên): strip backend admin + DB mới + 4 UI screen (Login/Download/Library/History)
  - Tier 2-5 (P2-P3, ~9-13 phiên): 4 group features (download power, browse/organize, sync/offline, integration/UX)
  - Xem memory `phase_26_trishdrive_user.md` cho 25 task chi tiết
- Phase 24.2 — TrishLibrary tab "Thư viện TrishTEAM" (share component LibraryBrowser với Phase 26.F)
- Phase 24.3.C TrishFinance — convert HTML standalone sang React+Vite
- Phase 25+ — Multi-channel + Cross-machine sync

---

**Quick rollback nếu build fail nặng:**
- `git diff apps-desktop/trishadmin/` để xem thay đổi
- `git checkout apps-desktop/trishadmin/` để revert toàn bộ
- 5 file Rust mới (creds/crypto/db/mtproto/telegram.rs) sẽ untracked, xoá tay nếu cần

---

### 📌 Roadmap câu hỏi UX Drive Cloud Telegram (Trí raise 2026-04-30)

**Multi-channel** (admin muốn dùng nhiều channel phân biệt vd "Tài liệu / Form / Dự án X"):
- Hiện tại 1 channel/admin (single `creds.channel_id`)
- **Workaround Phase 24.1**: dùng FOLDER (đã có Phase 22.7c) — đủ phân biệt
- Phase 25+ thật sự multi-channel: schema DB thêm `channel_id` column vào `files` + UI dropdown chọn channel khi upload + filter Files theo channel + keyring lưu list channels

**Cross-machine sync** (login máy khác có nhớ creds + history?):
- Hiện tại KHÔNG. BOT_TOKEN + AES key + SQLite index lưu local Windows Credential Manager + AppData → mất khi đổi máy
- Login máy khác phải setup từ đầu + KHÔNG tải xuống được file đã upload (mất tg_message_id)
- 2 hướng giải Phase 24+:
  - **A. Cloud sync metadata (Firestore zero-knowledge)**: encrypt creds + index bằng passphrase user → upload Firestore. Máy mới login Firebase → fetch blob → nhập passphrase → decrypt restore. UX tốt nhưng phức tạp
  - **B. Export/Import JSON manual**: Drive Settings thêm nút "Export backup" → file `.tdb` encrypted bằng passphrase. Máy mới "Import backup" + paste passphrase → restore. Đơn giản, không cần backend, dùng tốt cho 1 admin solo
  - Recommend B trước, A sau nếu cần multi-admin






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
                ✅ 23.2 Login flow — api_id/hash + phone + OTP (3-step wizard) + 2FA password support + sign_out
                       — Fix: state machine enum AwaitingCode/Awaiting2FA, save_session_safe (bypass grammers save_to_file os error 2)
                ✅ 23.3 Upload/download/delete TEST commands trên Saved Messages
                       — mtproto::upload_to_saved / download_from_saved / delete_from_saved
                       — Settings → MtprotoTestPanel: 3 button verify SDK (Trí connected +84969580657 @hosytri07)
                ✅ 23.4 Wire MTProto vào pipeline file_upload_mtproto / file_download_mtproto / file_purge_mtproto
                       — DB: ALTER TABLE files ADD COLUMN pipeline TEXT NOT NULL DEFAULT 'botapi'
                       — MTPROTO_CHUNK_SIZE = 100MB (vs 19MB Bot API → file 2GB chỉ 20 chunks thay vì 108)
                       — Bot API commands có guard: refuse nếu file.pipeline == 'mtproto'
                       — Frontend Upload page: toggle "Dùng MTProto" (auto-disable nếu chưa setup), persist localStorage
                       — FilesPage: tự route download theo file.pipeline + badge "MT" emerald cạnh tên file
                       — TrashPage: tự route purge + emptyTrash + file_purge_old_trash auto theo pipeline
                ✅ 23.5 Polishes:
                       — Share link rút gọn `/s/{6-char}` (reuse short_links collection từ Phase 19.22)
                       — Share KHÔNG cần password: random key 32 hex chars nhúng URL fragment `#k=...`
                         (server vẫn zero-knowledge, người nhận click link tự tải)
                       — Block share cho MTProto file (chưa proxy qua web được)
                       — Settings: "Dữ liệu local" load real stats từ SQLite (total/storage/last upload)
                       — /admin/trishdrive: rewrite hiển thị share audit thay vì "chưa active"
                       — Auto-fix `share/list` Firestore index (bỏ orderBy server, sort client)
                       — Pre-check duplicate file_id (Bot API: f_{sha[..16]}, MTProto: f_{sha[..16]}_m → 2 entry riêng)
                ✅ 23.6 MTProto upload vào channel "Túi đựng dữ liệu" thay Saved Messages
                       — User account `+84969580657` đã được add làm admin channel (Trí confirm 2026-04-30)
                       — `bot_channel_to_mtproto_id()`: convert -1001234567890 → 1234567890
                       — `resolve_or_load_channel()`: lần đầu iter_dialogs (5-10s), cache PackedChat (id+access_hash+ty) JSON vào keyring
                       — `upload_bytes_to_channel` / `download_bytes_from_channel` / `delete_from_channel`
                       — file_upload_mtproto / file_download_mtproto / file_purge_mtproto / file_purge_old_trash
                         tất cả route qua channel
                       — Trí thấy đồng bộ: Bot API + MTProto file CÙNG nằm trong "Túi đựng dữ liệu"
                       — Share MTProto VẪN BLOCK (web /proxy chưa support forwardMessage workaround)
                ✅ 23.7 Progress callback cho MTProto upload — wrap AsyncRead với ProgressReader,
                       throttle emit drive-progress mỗi 1MB. UI thấy progress bar smooth thay vì
                       nhảy 0% → 100% mỗi 20s. Upload 100MB chunk @ 5MB/s = 20 progress points.

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
