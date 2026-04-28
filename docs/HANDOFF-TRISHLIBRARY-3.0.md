# Handoff TỔNG — TrishNexus Monorepo (Phase 14 → 18.8.a)

**Ngày cập nhật:** 2026-04-27 (rev4 — sau Phase 18.8.a — TrishAdmin v1.1)
**Session trước:** Phase 18.5 (UX polish TrishLibrary) → 18.6 (release v3.0.0) → 18.7 (scaffold TrishAdmin) → 18.8.a (mở rộng TrishAdmin 9 panel)
**User:** Trí (hosytri77@gmail.com) — không phải dev, giải thích đơn giản, **luôn dùng tiếng Việt**
**Repo chính:** `hosytri07/trishnexus-monorepo` (sync GitHub giữa 2 máy nhà ↔ cơ quan)
**Domain:** `trishteam.io.vn` (Vercel + Tenten DNS)
**Workflow chuyển máy:** chạy `END.bat` ở USB/scripts/ trước khi rời máy → `START.bat` khi đến máy mới.

---

## ⚡ TÓM TẮT SIÊU NHANH

Hệ sinh thái **TrishTEAM**: TrishLauncher (hub) + 9 app (8 user + 1 admin private). TrishLibrary 3.0 đã RELEASE GitHub (`trishlibrary-v3.0.0` NSIS .exe 7.24MB). TrishAdmin v1.1 đang ở giai đoạn test (9 panel: Dashboard/Users/Keys/LibraryCurator/Posts/Broadcasts/Feedback/Audit/Registry/Settings) — **chưa release**, hidden distribution (admin tự build + cài tay).

### 🔴 PICK UP TỪ ĐÂY (cho session máy CƠ QUAN sau khi switch)

User vừa rời máy NHÀ sau Phase 18.8.a. Đã commit + push toàn bộ. Trên máy CƠ QUAN làm:

**1. Pull + cài deps + deploy rules:**
```powershell
# Cách dễ — chạy 1 .bat file:
scripts\START.bat            # pull + pnpm install + status
scripts\DEPLOY-RULES.bat     # deploy firestore.rules (chỉ chạy nếu chưa deploy)

# Hoặc thủ công:
git pull
pnpm install
firebase deploy --only firestore:rules
```

**2. Test TrishAdmin:**
```powershell
scripts\RUN-TRISHADMIN.bat   # tự cd + pnpm tauri dev
```

**3. Login admin** (`trishteam.official@gmail.com` hoặc `hosytri77@gmail.com`) → check 9 panel + 5 nhóm sidebar.

**4. Sau khi pass test → tiếp Phase 18.8.b** (Telemetry):
- Tạo `packages/telemetry/` package mới
- Wire vào TrishLibrary 3.0 pilot
- Thêm panel Errors + Vitals trong TrishAdmin
- Reindex Cloud Function

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

### Phase 18.6 — Build + Release `trishlibrary-v3.0.0` ✅ DONE
- Fix 15 TS errors trước build:
  - `AppSettingsModal.tsx:15` — bỏ unused import `loadSettings`
  - `InputModal.tsx:212` — bỏ unused generic `<T>`
  - `formats.ts:12` — `@ts-expect-error` cho `turndown-plugin-gfm` (no types)
  - `formats.ts:73` — chuyển `@ts-ignore` vào trong import expression Vite ?url
  - `formats.ts:141` — `margin` → `margins` (sai tên field html-docx-js-typescript)
  - `formats.ts:153` — `@ts-ignore` cho `html2pdf.js`
  - `PdfTools.tsx:14` — thêm `useEffect` vào import
  - `NoteModule.tsx:1579-1604` — thêm `if (!editor) return;` guard cho 4 hàm (setColor/setHighlight/setLink/setFont) — 7 chỗ editor possibly null
- `pnpm tauri build` thành công → 3 file:
  - `TrishLibrary_3.0.0_x64-setup.exe` (NSIS, multi-lang) — **MAIN file release** (7,239,739 bytes ~ 6.91 MB)
  - SHA256: `814cea1f80e9744999f5149c1d94adf16124bbd11167c19c1054f0674deee0f9`
  - `TrishLibrary_3.0.0_x64_en-US.msi` + `TrishLibrary_3.0.0_x64_vi-VN.msi` (WiX 2 ngôn ngữ)
- `apps-registry.json`: TrishLibrary 3.0.0 set status `released` + sha256 + size 7239739. TrishImage đánh dấu deprecated (đã merge vào TrishLibrary 3.0).
- Tag GitHub Release `trishlibrary-v3.0.0` đã push qua `gh release create` (Cách 1).
- Vercel auto-deploy registry mới sau khi push.

### Phase 18.7 — TrishAdmin scaffold MVP ✅ DONE
**Mục tiêu**: app admin nội bộ quản lý Firestore + apps-registry.json. **HIDDEN distribution** — không lên website, không lên TrishLauncher, admin tự build .exe + cài tay. Chỉ admin email trong allowlist mới login được.

**Path:** `apps-desktop/trishadmin/` (Tauri 2 + React + TypeScript + Firebase). Đã xóa Python placeholder cũ ở `apps/trishadmin/`.

**Files chính** (~2700 dòng + ~700 dòng CSS):
- `package.json` — deps `firebase ^10.14.1`, `@trishteam/auth/data/core` workspace, `@tauri-apps/plugin-dialog/opener`. Vite port 1450 / 1451.
- `tsconfig.json` — paths cho `@trishteam/data` + `auth/react`
- `vite-env.d.ts` — declare module *.png/jpg/svg
- `src-tauri/Cargo.toml` — `tauri 2.0` features `["devtools"]`, `tauri-plugin-dialog/opener`, `serde`, `serde_json`, `dirs`
- `src-tauri/tauri.conf.json` — `productName: TrishAdmin`, version 1.0.0, identifier `vn.trishteam.admin`, port 1450, CSP allow Firebase + GitHub, bundle target msi+nsis
- `src-tauri/src/lib.rs` — 4 commands: `app_version` / `default_data_dir` / `read_text_file` / `write_text_file` / `check_path_exists` (cap 16 MiB cho registry edit)
- `src-tauri/capabilities/default.json` — core + dialog + opener
- `src-tauri/icons/` — 32/128/256/512 PNG + ICO multi-resolution (sinh từ `apps/trishlauncher/src/.../resources/logos/trishadmin.png` 128x128 RGBA dùng Pillow Lanczos)
- `src/main.tsx` — `<ErrorBoundary><AuthProvider><Root/>` + window error handlers + apply theme từ settings local
- `src/Root.tsx` — auth gate 3 tầng: loading → AdminLogin → AdminBlocked (nếu email không phải admin) → App
- `src/App.tsx` — sidebar 5 nhóm + main panel switcher + Ctrl+1..9 quick switch
- `src/lib/admin-emails.ts` — hardcoded allowlist (`trishteam.official@gmail.com`, `hosytri77@gmail.com`)
- `src/lib/firestore-admin.ts` — Firestore CRUD users/keys/broadcasts + new collections (~430 dòng)
- `src/lib/key-gen.ts` — generate `TRISH-XXXX-XXXX-XXXX` qua Web Crypto getRandomValues
- `src/tauri-bridge.ts` — wrapper Tauri commands + dialog
- `src/settings.ts` — theme (dark/light/system) + language (vi/en) + applyTheme đặt `data-theme` attribute trên `<html>`
- `src/styles.css` — toàn bộ theme dark + light + components (~1100 dòng)

**Components** (`src/components/`):
- `AdminLogin.tsx` — Email + password form gọi `signInWithEmail`
- `AdminBlocked.tsx` — màn hình block + auto signOut sau 4s
- `ErrorBoundary.tsx` — catch React errors, surface stack trace
- `DashboardPanel.tsx` — 4 stat cards + role bars (gọi `fetchStats()` aggregate)
- `UsersPanel.tsx` — table users + filter role + edit role modal + reset trial + **delete user 2-step confirm** (xóa Firestore doc only)
- `KeysPanel.tsx` — table activation keys + filter status + generate batch modal + revoke + delete + copy
- `BroadcastsPanel.tsx` — list broadcasts + compose modal (severity/audience/expires)
- `RegistryPanel.tsx` — load/save 2 file local: `apps-registry.json` + `min-specs.json`. Save xong show git push commands.
- `SettingsPanel.tsx` — theme + language pills + about app

**Auth flow**:
1. User mở app → AuthProvider check Firebase Auth state.
2. `firebaseUser === null` → `<AdminLogin>` → email/password.
3. Login OK → `firebaseUser.email` check vs `ADMIN_EMAILS`. Match → `<App>`. Không match → `<AdminBlocked>` + auto signOut sau 4s.
4. Email khác login lần nữa thấy lại `<AdminLogin>`.

**Firestore collections sử dụng**:
| Path | Mục đích | Rules đã có |
|---|---|---|
| `users/{uid}` | TrishUser, role | admin read all + update bất kỳ ✓ |
| `keys/{keyId}` | ActivationKey | admin CRUD ✓ |
| `announcements/{id}` | Broadcast | admin CRUD ✓ |

### Phase 18.7 issues đã fix trong session
- `slice undefined` ở UsersPanel/KeysPanel — Firestore docs cũ không có field `id` → defensive `(u.id ?? '').slice()` + inject `data.id ?? doc.id` ở mọi list function.
- `Function setDoc() called with invalid data. Unsupported field value: undefined (note)` — Firestore reject undefined → thêm helper `stripUndefined()` + conditional spread `...(input.note ? { note: input.note } : {})`.
- Logo bị chìm dark mode → `--logo-bg: #ffffff` ở dark theme, `transparent` ở light. Logo wrap rounded 8px padding 4px.
- Bỏ icon emoji + bỏ `^1..^5` kbd hint trong sidebar nav theo yêu cầu user.
- Sidebar dùng image `<img src={logoUrl}>` thay emoji 🛡.

### Phase 18.8.a — TrishAdmin v1.1 mở rộng ✅ DONE

**Mục tiêu**: thêm 4 panel content + audit auto-log + sidebar group navigation.

**4 panel mới**:

#### LibraryCuratorPanel (`src/components/LibraryCuratorPanel.tsx`)
- Layout 2-pane: trái list folders (320px), phải list links của folder đang chọn.
- CRUD folder: name + description + icon (emoji) + sort_order auto.
- CRUD link: title + url + description + icon + link_type (web/pdf/docs/video/other).
- Delete folder cascade xóa subcollection links trước.
- Firestore: `trishteam_library/{folderId}` + subcollection `links/{linkId}`.
- TrishLibrary 3.0 module Thư viện section "TrishTEAM" sẽ hiển thị các folder + link này (read-only qua subscribe Firestore).

#### FeedbackPanel (`src/components/FeedbackPanel.tsx`)
- List `feedback/{id}`, click card mở detail modal.
- Filter: status (new/read/in_progress/resolved/wontfix) + category (bug/feature/question/praise/other) + search.
- Counter ở header: số mới, đang xử lý, đã xử lý, tổng.
- Auto-mark `read` khi click 1 feedback đang ở status `new`.
- Detail modal: full message + admin note input + 5 nút status pill + reply via mailto.
- Delete feedback (cascade).
- Cần data thực — chưa có app nào ghi vào collection này. Sẽ làm Phase 18.8.b (telemetry + feedback widget).

#### AuditPanel (`src/components/AuditPanel.tsx`)
- Read-only list `audit/{id}`, filter by action type + search.
- Action types đã định nghĩa label + color (`ACTION_LABEL` map): `user.set_role`, `user.reset_trial`, `user.delete_doc`, `key.create_batch`, `key.revoke`, `key.delete`, `broadcast.create`, `broadcast.activate`, `broadcast.deactivate`, `broadcast.delete`.
- Table 5 cột: time + action badge + actor + target + details (JSON snippet).

#### PostsPanel (`src/components/PostsPanel.tsx`)
- Grid post cards (auto-fill 360px) với border-left color theo status.
- CRUD post: title + body_md (markdown) + excerpt + hero_url + tags (CSV) + status (draft/published) + slug auto-generate.
- Toggle Publish/Unpublish 1 click.
- Filter status + search title/body/tags.
- Editor modal: textarea markdown 14 rows + form row 3 cột (hero/tags/status).

**Audit auto-log** — `firestore-admin.ts` thêm:
- Type `ActorContext { uid, email? }`
- Helper `writeAudit(input)` — addDoc vào `audit/` (Firestore tự sinh ID), append-only, fail-safe (không block action chính nếu ghi audit lỗi).
- Wire `actor` parameter vào 9 function: `setUserRole`, `resetUserToTrial`, `deleteUserDoc`, `createKeys`, `revokeKey`, `deleteKey`, `createBroadcast`, `setBroadcastActive`, `deleteBroadcast`.
- 4 panel (UsersPanel/KeysPanel/BroadcastsPanel) lấy actor từ `useAuth().firebaseUser` rồi pass vào các call.

**Sidebar group navigation** (`src/App.tsx`):
- 5 nhóm:
  1. **Tổng quan** → Dashboard
  2. **Người dùng** → Users · Keys
  3. **Nội dung** → TrishTEAM Library · Posts/News · Broadcasts
  4. **Inbox** → Feedback · Audit log
  5. **Hệ thống** → Apps Registry · Cài đặt
- `NAV_GROUPS` array driving render. `ALL_NAV_ITEMS = NAV_GROUPS.flatMap(g => g.items)` cho persist + Ctrl+1..9.
- CSS mới: `.admin-nav-group` + `.admin-nav-group-label` (uppercase 10px muted).

**Firestore rules update** (`firestore.rules`):
```
match /audit/{id} {
  allow read: if isAdmin();
  allow create: if isAdmin();   // <-- mới (trước đó allow write: if false)
  allow update, delete: if false;
}
```
**Phải `firebase deploy --only firestore:rules`** để TrishAdmin write audit được.

**Issue gặp + đã fix**:
- Logo background cho dark mode (đã làm Phase 18.7 issue) — bonus thêm light theme support qua `[data-theme='light']` selector.
- Settings panel apply theme ngay khi đổi qua `applyTheme(value)` đặt `data-theme` attribute trên `<html>`.

### Phase 18.8.b — NEXT (chưa bắt đầu)
- Tạo `packages/telemetry/` package mới — `reportError(err, context)` + `reportVital(name, value)` + auto-init `window.onerror` + `unhandledrejection` + throttle + batch.
- Wire vào TrishLibrary 3.0 (pilot) trong `main.tsx`.
- Thêm panel **Errors** trong TrishAdmin đọc `errors/{env}/samples/{id}` (group by error message + count).
- Thêm panel **Vitals** đọc `vitals/{env}/samples/{id}` (chart + filter).
- Thêm panel **Reindex** + Cloud Function HTTP endpoint trigger reindex `semantic/apps/` + `semantic/announcements/`.

### Phase 18.8.c — Wire telemetry vào 8 apps Tauri
- TrishLauncher · TrishCheck · TrishFont · TrishClean · TrishLibrary · TrishDesign · TrishAdmin · TrishType (sau khi build)
- Thêm `import '@trishteam/telemetry'; init({ app: 'trishlibrary' })` vào `main.tsx` mỗi app.

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

## 🔴 PICK UP TỪ ĐÂY (cập nhật cho session máy cơ quan)

User vừa rời máy NHÀ sau Phase 18.8.a. Trên máy CƠ QUAN cần:

1. **Pull code mới**:
   ```powershell
   cd C:\<đường dẫn repo trên máy cơ quan>\trishnexus-monorepo
   git pull
   ```
2. **Cài deps mới** (TrishAdmin có deps `firebase`, `@trishteam/data` mới):
   ```powershell
   pnpm install
   ```
3. **Deploy firestore.rules** (audit collection mới allow admin create):
   ```powershell
   firebase deploy --only firestore:rules
   ```
4. **Test TrishAdmin**:
   ```powershell
   cd apps-desktop\trishadmin
   pnpm tauri dev
   ```
5. Login email admin → check 9 panel + 5 nhóm sidebar.

Sau khi test pass → tiếp **Phase 18.8.b** (Telemetry package + Errors + Vitals + Reindex):
- Tạo `packages/telemetry/` — wrapper `reportError(err, ctx)` + `reportVital(name, value)` + auto-init `window.onerror` + `unhandledrejection` + throttle/batch.
- Wire vào TrishLibrary 3.0 (pilot) trước khi roll-out 7 app còn lại.
- Thêm panel Errors + Vitals đọc collection `errors/{env}/samples` + `vitals/{env}/samples`.
- Reindex panel + Cloud Function HTTP endpoint.

Sau Phase 18.8.b → 18.8.c (wire telemetry vào TrishLauncher/Check/Font/Clean/Type/Design/Admin/Library).

---

## 📋 PHASE 18.7 + 18.8.a — TRISHADMIN ĐÃ DONE (REFERENCE)

1. **Test dev mode** — Trí chạy:
   ```
   cd apps-desktop\trishadmin
   pnpm install         # cài deps mới
   pnpm tauri dev
   ```
2. Login với email admin (hardcode trong `src/lib/admin-emails.ts`):
   - `trishteam.official@gmail.com`
   - `hosytri77@gmail.com`
3. Test 5 panel:
   - 📊 Dashboard — số stats
   - 👥 Users — list + đổi role + reset trial
   - 🔑 Keys — sinh + revoke + copy
   - 📢 Broadcasts — soạn + push notification
   - 📦 Apps Registry — load + edit JSON local
4. Lỗi runtime → paste cho mình fix
5. Pass test → build production: `pnpm tauri build` → file `.exe` ở `src-tauri/target/release/bundle/nsis/`. Cài tay (KHÔNG release public).

### Architecture TrishAdmin
- **Auth**: Firebase Auth check email vs `ADMIN_EMAILS` allowlist. Email khác → `<AdminBlocked>` + force signOut.
- **Firestore collections**: `users/{uid}` · `keys/{keyId}` · `announcements/{id}`.
- **Tauri commands**: `read_text_file` / `write_text_file` / `check_path_exists` / `default_data_dir` (cho Apps Registry editor).
- **Distribution**: hidden — không trong registry, không trên Launcher. Trí build + cài tay.

### File chính TrishAdmin
- `src/Root.tsx` — auth gate 3 tầng (loading / login / blocked / app)
- `src/App.tsx` — sidebar 5 panel + Ctrl+1..5
- `src/lib/admin-emails.ts` — allowlist
- `src/lib/firestore-admin.ts` — Firestore CRUD users/keys/broadcasts + stats
- `src/lib/key-gen.ts` — sinh `TRISH-XXXX-XXXX-XXXX` (Web Crypto)
- `src/components/{Dashboard,Users,Keys,Broadcasts,Registry}Panel.tsx`

---

## 📋 PREVIOUS PHASE 18.6 BUILD + RELEASE (ARCHIVE)

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
- ✅ Phase 18.5 — UX polish + per-user data — DONE 2026-04-27
- ✅ Phase 18.6 — Build + GitHub Release `trishlibrary-v3.0.0` — DONE 2026-04-27 (NSIS .exe 7.24 MB · sha256 `814cea1f...e0f9`)
- ✅ Phase 18.7 — TrishAdmin scaffold MVP (5 panel: Dashboard/Users/Keys/Broadcasts/Registry) — DONE 2026-04-27
- ✅ Phase 18.8.a — TrishAdmin v1.1 mở rộng — DONE 2026-04-27
  - Thêm 4 panel: LibraryCurator, Feedback, Audit, Posts
  - Thêm Settings panel (theme dark/light/system + language vi/en)
  - Thêm xóa user (UsersPanel) + 2-step confirm
  - Sidebar group nav (5 nhóm thay vì list phẳng)
  - Logo TrishAdmin shield + light theme support
  - Auto audit log từ 9 admin actions
  - Update firestore.rules cho audit collection (allow admin create)
- 🔨 Phase 18.8.b — Telemetry + ErrorsPanel + VitalsPanel + Reindex — **NEXT** (chưa bắt đầu)
- ⏳ Phase 18.8.c — Wire telemetry vào 8 apps Tauri
- ⏳ Phase 16.4 — Roll out Auth tới TrishCheck/TrishFont/TrishLauncher (deferred)
- ⏳ Phase 17.4 — TrishDesign build + release (code có sẵn ~550 dòng)

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
- Firebase Console: project ID **`trishteam-17c2d`** (display name `trishTEAM`, region asia-southeast1)
- **Firebase project OWNER (quản lý / billing / deploy rules)**: `trishteam.official@gmail.com` — login Firebase CLI bằng email này khi deploy
- **Admin user của app (login user role=admin trong app)**: `trishteam.official@gmail.com` (chính chủ) + `hosytri77@gmail.com` (Trí cá nhân)
- `.firebaserc` đã sửa về `trishteam-17c2d` (trước đó từng có placeholder `trishteam-dev` gây deploy nhầm)
- ⚠ Lưu ý: KHÔNG login Firebase CLI bằng `nerwin.underbox@gmail.com` — email đó owner 1 project khác (`trishteam-e3ae4`) không liên quan

---

## 📚 LỊCH SỬ CHI TIẾT (PHASE 14-16)

Xem file `docs/SESSION-HANDOFF.md` (835 dòng) — chứa toàn bộ chi tiết Phase 14.5 → 16.2 với code snippets, file paths, build configs, SHA256 checksums, gotchas. File này là **historical record** không update nữa, chỉ giữ làm reference.

Nếu Phase 17/18 cần debug ngược về dependency cũ → grep `SESSION-HANDOFF.md` theo phase number (vd `Phase 15.1.k`).
