# 🧠 HANDOFF-MASTER.md — TrishTEAM Monorepo

> **ĐỌC FILE NÀY ĐẦU TIÊN MỌI PHIÊN MỚI.** Đây là file handoff DUY NHẤT của hệ sinh thái.
>
> **🔴 ĐỌC SECTION `📍 PHIÊN HIỆN TẠI` NGAY DƯỚI — TẤT CẢ SECTION CŨ PHÍA DƯỚI LÀ LỊCH SỬ ARCHIVE, ĐỪNG NHẦM!**
>
> **Cập nhật:** 2026-05-23 (chiều) — **Phase 44 plan: gộp 12 app desktop → 4 app mới** (TrishWork / TrishUtilities / TrishFinance / TrishAdmin). Bỏ Launcher + Office. Đổi auth: bỏ KeyGate key tay → Firebase login + role admin cấp.
> **Chủ dự án:** Trí (hosytri77@gmail.com / trishteam.official@gmail.com) — kỹ sư hạ tầng giao thông Đà Nẵng. Không phải dev. Giao tiếp tiếng Việt, tránh jargon.

---

## 📍 PHIÊN HIỆN TẠI — 2026-05-23 (chiều) — Phase 44 ECOSYSTEM REFACTOR: 12 → 4 app

### 🎯 Quyết định lớn (Trí chốt 2026-05-23 chiều)

Gộp 10 app desktop hiện tại (trừ Admin) thành 3 app, tổng cộng còn **4 app + Admin**:

| App mới | Gộp từ | Accent color | Logo |
|---|---|---|---|
| **TrishWork** | TrishDesign + TrishLibrary + TrishISO | 🟢 `#34D399` xanh lá | Chữ T xanh lá + swoosh, nền `#0E1A1A` |
| **TrishUtilities** | TrishClean + TrishCheck + TrishDrive + TrishFont + TrishShortcut | 🟣 `#A78BFA` tím | Chữ T tím + swoosh, nền `#0E1A1A` |
| **TrishFinance** | (giữ nguyên, refactor đồng bộ giao diện) | 🟡 `#FBBF24` vàng cam | Chữ T vàng cam + swoosh, nền `#0E1A1A` |
| **TrishAdmin** | (giữ nguyên, refactor đồng bộ giao diện + thêm panel cấp quyền user) | 🔴 `#F87171` đỏ | Chữ T đỏ + swoosh, nền `#0E1A1A` |

**Bỏ hẳn:** TrishLauncher, TrishOffice (Office không gộp vào đâu — bỏ luôn).

**Auth flow MỚI (thay KeyGate cũ):**
- Bỏ cơ chế nhập key tay trong app.
- Mở app → Firebase Auth (Google Sign-In + email/password).
- Signup mới → role `trial` → bị block hết app, hiện màn "Liên hệ admin cấp quyền".
- Admin (TrishAdmin) có panel mới "Cấp quyền user": chọn user trial → tick app cho phép → save → user mở được app.
- Firestore `/users/{uid}` schema: `role` (trial/free/pro/admin), `apps[]` (work/utilities/finance), `keyIssuedAt`.

**Design system thống nhất:** Cả 4 app đều dùng `<AppShell>` chung (extract từ TrishLibrary lên `packages/design-system`). Khác nhau chỉ ở: accent color (token), danh sách module (config), nội dung main. Sidebar trái + Topbar + Statusbar dưới giống nhau.

### 📋 Lộ trình Phase 44 — 7 wave (đã setup task list)

```
44.1 Design system (AppShell + 4 token màu)         [IN PROGRESS]
   ↓
44.2 AuthGate Firebase (thay KeyGate cũ)
   ↓
44.3 TrishWork    44.4 TrishUtilities    44.5 Finance+Admin
   ↓                ↓                       ↓
                44.6 Archive 10 app cũ vào apps-desktop/_archive/
                       ↓
                44.7 Build .exe 4 app + smoke test + Release v2.0.0
                       ↓
                44.8 Test Wave 16 pick polyline (DEFER từ Phase 43 wave 16)
```

### 🚧 Phase 43 wave 16 — DEFER

Wave 16 code đã commit `abb07ba` (pick polyline AutoCAD + textPrefs/FontPicker). **Chưa test thực tế trong AutoCAD.** Trí chốt: bỏ qua test này, test lại sau khi gộp xong vào TrishWork.Design (task 44.8). Code Wave 16 sẽ được move vào `apps-desktop/trishwork/src/modules/design/` ở wave 44.3.

### 📝 Quy ước cấu trúc app mới

```
apps-desktop/trishwork/        ← NEW
  src/
    App.tsx                    ← gọi <AppShell appId="work">
    main.tsx
    modules/
      design/                  ← code từ trishdesign cũ
      library/                 ← code từ trishlibrary cũ
      iso/                     ← code từ trishiso cũ
    auth/
      AuthGate.tsx             ← Firebase login
  src-tauri/
    src/
      lib.rs                   ← merge commands từ 3 Tauri backend cũ

apps-desktop/trishutilities/   ← NEW (tương tự, 5 module)
apps-desktop/_archive/         ← NEW (move 10 app cũ vào đây làm backup)
  trishdesign/
  trishlibrary/
  trishiso/
  trishclean/
  trishcheck/
  trishdrive/
  trishfont/
  trishshortcut/
  trishlauncher/
  trishoffice/

packages/design-system/        ← MỞ RỘNG
  src/
    AppShell.tsx               ← extract từ trishlibrary
    Sidebar.tsx
    Topbar.tsx
    tokens.ts                  ← export 4 accent
```

### 🔧 Tiến độ Phase 44 — phiên 2026-05-23 (chiều)

**✅ Wave 44.1 — Design system DONE**
- `design/tokens.json` — thêm `color.apps` (work/utilities/finance/admin) + `color.brand`
- `website/assets/tokens.css` + `shared/trishteam_core/.../tokens.py` regenerated
- `packages/design-system/src/theme.css` — append 8 rules accent per-app × light/dark
- `packages/design-system/src/AppLogo.tsx` **NEW** — SVG chữ T + swoosh, 4 màu
- `packages/design-system/src/AppShell.tsx` **NEW** — generic shell + Ctrl+1..9 + accent auto-apply
- `packages/design-system/src/applyAppAccent.ts` **NEW** — `applyAppAccent(id)` + `shellToLicenseAppId()` map
- `packages/design-system/src/index.ts` — re-export tất cả
- `packages/design-system/package.json` — bump v1.1.0 + react peerDep
- TypeScript syntax: 4/4 file pass esbuild check

**✅ Wave 44.2 — AuthGate Firebase DONE**
- `packages/data/src/index.ts` — thêm `'trishwork'` + `'trishutilities'` vào `AppId` enum (giữ legacy IDs cho migration)
- `packages/auth/src/auth-gate.tsx` **NEW** ~280 dòng — replace KeyGate:
  - Dùng `useAuth()` lấy profile auto-loaded
  - Admin bypass tất cả
  - Check `userHasAppAccess(profile, appId)` (đã có helper sẵn trong data)
  - Trial / chưa có quyền → màn "Liên hệ admin"
  - KHÔNG có input nhập key tay
- `packages/auth/src/react.tsx` — re-export `AuthGate` + `AuthGateProps`

**✅ Wave 44.4 — TrishUtilities scaffold DONE, logic migrate DEFER**

Y hệt Wave 44.3 nhưng accent tím + 5 module (clean/check/drive/font/shortcut). Port dev 1442. Identifier `vn.trishteam.utilities`. 17 file scaffold, syntax 7/7 pass.

**✅ Wave 44.5 — TrishAdmin AppAccessPanel DONE (refactor giao diện DEFER)**

- `apps-desktop/trishadmin/src/lib/firestore-admin.ts` — thêm 2 helper:
  - `grantAppAccess(uid, appId, durationDays, actor, email)` → set `app_keys[appId] = { key_id, activated_at, expires_at }`
  - `revokeAppAccess(uid, appId, actor, email)` → delete field
- `apps-desktop/trishadmin/src/components/AppAccessPanel.tsx` **NEW** ~310 dòng:
  - Bảng users với 4 cột app (Work/Utilities/Finance/Admin)
  - Checkbox enable + input số ngày + nút Lưu mỗi row
  - Filter search by email/tên/uid
  - Audit log tự ghi
- `apps-desktop/trishadmin/src/App.tsx` — thêm Panel type `'app_access'` + nav item "🔑 Cấp quyền App (Phase 44)" trong nhóm Người dùng + render case

**DEFER:** Refactor TrishFinance + TrishAdmin sang AppShell unified (có thể giữ layout cũ vì 2 app này đã có UI tốt — chỉ cần đổi accent color qua `applyAppAccent`).

**🚧 Wave 44.3 — TrishWork scaffold DONE, logic migrate DEFER**

Đã tạo `apps-desktop/trishwork/` với 15 file scaffold:

```
apps-desktop/trishwork/
  package.json              ← @trishteam/trishwork v2.0.0
  vite.config.ts            ← port 1440 (Library = 1434)
  tsconfig.json
  index.html                ← <html data-app="work">
  src/
    main.tsx                ← applyAppAccent('work') + AuthProvider
    App.tsx                 ← <AuthGate appId="trishwork"><AppShell appId="work">
    modules/
      design/DesignModule.tsx   ← PLACEHOLDER
      library/LibraryModule.tsx ← PLACEHOLDER
      iso/IsoModule.tsx         ← PLACEHOLDER
  src-tauri/
    Cargo.toml              ← trishwork crate, Tauri 2 minimal
    build.rs
    tauri.conf.json         ← identifier vn.trishteam.work
    capabilities/main.json
    src/main.rs
    src/lib.rs              ← invoke_handler[app_version] (skeleton)
```

App skeleton COMPILE OK (esbuild syntax 5/5). Sau khi Trí pull về, có thể:
- `cd apps-desktop/trishwork && pnpm install`
- `pnpm tauri:dev` → mở app TrishWork với màn login (Firebase Auth)
- Login → màn "Liên hệ admin" (vì chưa cấp app_keys.trishwork)
- Vào TrishAdmin → cấp quyền → reload → vào shell với 3 module placeholder

**DEFER (Wave 44.3.x sau):**
- 44.3.1: Migrate code từ `apps-desktop/trishdesign/src/` → `apps-desktop/trishwork/src/modules/design/`
- 44.3.2: Migrate code từ `apps-desktop/trishlibrary/src/` → `apps-desktop/trishwork/src/modules/library/`
- 44.3.3: Migrate code từ `apps-desktop/trishiso/src/` → `apps-desktop/trishwork/src/modules/iso/`
- 44.3.B: Merge Rust backend commands từ 3 lib.rs cũ vào `trishwork/src-tauri/src/lib.rs`

### 📦 Files đụng đến trong phiên này

**Modified:**
- `design/tokens.json`
- `website/assets/tokens.css` (regen)
- `shared/trishteam_core/.../tokens.py` (regen)
- `packages/design-system/package.json`
- `packages/design-system/src/index.ts`
- `packages/design-system/src/theme.css`
- `packages/data/src/index.ts`
- `packages/auth/src/react.tsx`

**NEW (4 file design-system + 1 file auth):**
- `packages/design-system/src/AppLogo.tsx`
- `packages/design-system/src/AppShell.tsx`
- `packages/design-system/src/applyAppAccent.ts`
- `packages/auth/src/auth-gate.tsx`

**NEW folder (15 file scaffold trishwork):**
- `apps-desktop/trishwork/` (toàn bộ)

### ✅ Wave 44.3.x — TrishWork logic migration DONE (best-effort copy)

- `apps-desktop/trishwork/src/modules/design/` — copy nguyên `apps-desktop/trishdesign/src/` (trừ App/Root/main/KeyGate). Rename App.tsx → `DesignModule.tsx` (`export function DesignModule()`). Submodules folder `__submodules` rename → `modules` để giữ import path đúng. **55 file**.
- `apps-desktop/trishwork/src/modules/library/` — copy `apps-desktop/trishlibrary/src/` (trừ main). AppShell.tsx → `LibraryModule.tsx`, App.tsx → `App.tsx` (sub-app library). **50 file**.
- `apps-desktop/trishwork/src/modules/iso/` — copy `apps-desktop/trishiso/src/`. App.tsx → `IsoModule.tsx`. **10 file**.
- `apps-desktop/trishwork/package.json` — merge 53 deps + 10 devDeps từ 3 app gốc.
- `apps-desktop/trishwork/src-tauri/` — Rust base copy từ TrishDesign (có `acad_com.rs` + `lib.rs` + resources/SRETC_HuHong.pat). Cargo.toml rename `trishdesign → trishwork`. **DEFER:** merge thêm Rust commands từ TrishLibrary (Tantivy/OCR) + TrishISO ở Wave 44.3.B.

### ✅ Wave 44.4.x — TrishUtilities logic migration DONE (best-effort copy)

- Copy `apps-desktop/{trishclean,trishcheck,trishdrive,trishfont,trishshortcut}/src/` → `apps-desktop/trishutilities/src/modules/{clean,check,drive,font,shortcut}/`. App.tsx mỗi app → `{Mod}Module.tsx`. Tổng **~70 file**.
- `apps-desktop/trishutilities/package.json` — merge 19 deps + 6 devDeps.
- `apps-desktop/trishutilities/src-tauri/` — Rust base copy từ TrishDrive (8 .rs MTProto Telegram). Cargo.toml rename `trishdrive → trishutilities`. **DEFER:** merge Rust commands từ Clean/Check/Font/Shortcut ở Wave 44.4.B.

### ✅ Wave 44.6 — Archive 10 app cũ DONE

```
apps-desktop/_archive/
├── trishdesign/      (→ migrated vào trishwork/modules/design)
├── trishlibrary/     (→ migrated vào trishwork/modules/library)
├── trishiso/         (→ migrated vào trishwork/modules/iso)
├── trishclean/       (→ migrated vào trishutilities/modules/clean)
├── trishcheck/       (→ migrated vào trishutilities/modules/check)
├── trishdrive/       (→ migrated vào trishutilities/modules/drive)
├── trishfont/        (→ migrated vào trishutilities/modules/font)
├── trishshortcut/    (→ migrated vào trishutilities/modules/shortcut)
├── trishlauncher/    (BỎ HẲN — không gộp vào đâu)
└── trishoffice/      (BỎ HẲN — không gộp vào đâu)
```

`pnpm-workspace.yaml` đã update — explicit list 4 app + admin, exclude `_archive`.
`CLAUDE.md` đã update cấu trúc mới.

### 🧪 Wave 44.7 — Smoke test plan READY

Đọc **`docs/PHASE44-SMOKE-TEST.md`** trước khi test. Trí pull về + `pnpm install` + chạy `pnpm tauri:dev` ở 4 app.

### ⚠ Defer sang phiên sau

1. **Wave 44.3.B + 44.4.B:** Merge Rust commands còn lại từ TrishLibrary (Tantivy/OCR) / TrishISO / Clean / Check / Font / Shortcut vào lib.rs của 2 app mới. Hiện tại chỉ AutoCAD COM (work) + MTProto (utilities) hoạt động đầy đủ.
2. **TrishFinance refactor accent vàng** (cosmetic — UI vẫn chạy được như cũ).
3. **TrishLibrary sticky window** (defer — không scaffold ở trishwork).
4. **Build + sign + Release .exe** (wave 44.7 phần build thật — defer cho khi test pass).
5. **Wave 44.8** — Test Wave 16 polyline AutoCAD trong TrishWork.Design.

### 📋 Sau khi test xong

- Nếu fail: rollback bằng cách restore 10 folder từ `_archive` lên 1 level, hoặc fix imports cụ thể (xem PHASE44-SMOKE-TEST.md mục "Nếu fail").
- Nếu OK: tiếp Wave 44.8 test polyline AutoCAD + 44.3.B/44.4.B migrate Rust commands còn lại.

### ⚠ Lưu ý cho máy bên kia (cơ quan / nhà) khi pull về

- 10 app cũ trong `apps-desktop/` vẫn chạy được bình thường cho tới khi Wave 44.6 (archive). Không ảnh hưởng workflow hiện tại.
- Phải pull `packages/design-system` mới sau wave 44.1.
- Phase 44 dự kiến nhiều phiên — đọc section này để biết đang ở wave nào.

---

## 📍 PHIÊN CŨ — 2026-05-23 (sáng) — Phase 43 wave 16 (pick polyline + textPrefs/FontPicker) — ĐÃ COMMIT, DEFER TEST

### ⚠ TRƯỚC KHI MỞ LẠI MÁY NHÀ — đọc kỹ

**Phiên này (máy cơ quan, 2026-05-23) đang code dở Phase 43 wave 16.** Code đã commit hay chưa tuỳ END.bat có thành công không (xem bên dưới).

Nếu pull về máy nhà mà KHÔNG thấy các file `polyline-curve.ts`, `FontPicker.tsx`, hoặc thấy `acad_pick_polyline` thiếu trong `acad_com.rs` → tức commit cuối thất bại, máy nhà cần kéo lại từ máy cơ quan thủ công (xem section "🛟 Nếu END.bat máy cơ quan fail" cuối).

### 🚨 BƯỚC ĐẦU TIÊN máy nhà

```powershell
cd C:\Users\TRI\Documents\Claude\Projects\TrishTEAM\trishnexus-monorepo
START.bat
```

Sau khi pull xong:

```powershell
cd apps-desktop\trishdesign
pnpm tauri dev
```

(TrishAdmin chỉ cần test nếu muốn upload .dwg lên GitHub Release — không bắt buộc đầu phiên.)

### 🆕 Đã làm thêm sau handoff cũ 2026-05-18

**Đã commit (3 commit ngày 2026-05-18, sau handoff cũ):**

| Commit | Wave | Nội dung |
|---|---|---|
| `ef95166` | docs | Update HANDOFF Phase 43 wave 15 (test plan đầy đủ) |
| `529aaae` | 15.4 | AtgtBlocksPanel dùng CSS var đúng prefix `--bg/--accent/--fg/--border` (KHÔNG `--ts-*`) + nút Upload .dwg auto-mở Upload ZIP/files khi thiếu PAT (thay vì disable im lặng) |
| `e8e011b` | 15.5 | 4 fix tiếp: (1) CSS var, (2) auto-mở upload ZIP, (3) split path Windows `\` và Unix `/` cho đúng basename (trước save full path `G:\TrishTEAM\...` vào Firestore), (4) cột ZIP hiện ✓/✗ cả khi có per-file metadata |

**Đang code dở Phase 43 wave 16 (CHƯA commit ở thời điểm viết handoff này — END.bat phía dưới sẽ commit):**

Wave 16 chính là làm **defer item #1 của wave 15** ("TrishDesign mode 'Theo polyline AutoCAD' — cần Rust `acad_get_point_on_polyline`") + thêm **textPrefs/FontPicker giống HHMĐ**.

| Sub-wave | Nội dung | Files |
|---|---|---|
| 16.1 | Bỏ `handlePasteTsv` legacy 9-category (gây clipboard permission popup) | `AtgtPanel.tsx` |
| **16.2** | **Rust `acad_pick_polyline` LISP integration**: gửi LISP file `%TEMP%/trishdesign_pick_polyline.lsp` → user click polyline trong AutoCAD → đọc handle + length + coords về Tauri. Hỗ trợ LWPOLYLINE 2D + POLYLINE 2D (KHÔNG 3D). Result struct: `PolylineInfo { handle, length, vertices: Vec<[f64;2]> }` | `acad_com.rs` +136 dòng |
| **16.3** | **`polyline-curve.ts` NEW (108 dòng)** — Polyline arc-length parameterization. Cho `vertices + station_m` → trả về `{ x, y, tangentAngle, normal }`. Dùng để map block ATGT vào polyline cong. Có `posFn(station, offset, side, isMep)` thay rectangle SCALE_X cũ | `polyline-curve.ts` NEW |
| 16.4 | Engine vẽ ATGT đọc folder block đã sync, truyền vào INSERT command | `AtgtPanel.tsx` |
| **16.6** | **`AtgtTextPrefs` interface mới + `defaultAtgtTextPrefs()`** — text style cho project ATGT giống HHMĐ TEXT_HH: `styleName, fontFile, widthFactor, stationHeight, blockTextHeight, blockScale, lyTrinhBlockOffset, lyTrinhBlockLength, bienBaoHeight`. Engine vẽ chạy `_-STYLE` trước. Modal "🔠 Cài đặt Text Style" mở từ AtgtPanel | `atgt-types.ts`, `AtgtPanel.tsx` |
| **16.7** | **`FontPicker.tsx` NEW (121 dòng)** — Scan font 3 nguồn: System TTF qua `queryLocalFonts`, AutoCAD SHX qua Tauri (Program Files\Autodesk\AutoCAD\Fonts\), Preset (`AUTOCAD_SHX_FONTS` + `VN_COMMON_TTF`) | `FontPicker.tsx` NEW |
| 16.9 | Modal Save flow + verify | `AtgtPanel.tsx` |
| 16.10 | `blockScale` field — fix block design size cố định: polyline lớn → tăng scale | `atgt-types.ts`, `atgt-draw-script.ts` |
| 16.11 | `lyTrinhBlockOffset` + `lyTrinhBlockLength` — vị trí + chiều dài block 0.LT cọc lý trình | `atgt-types.ts`, `atgt-draw-script.ts` |
| 16.13 | `bienBaoHeight` — chiều cao block biển báo (Y axis) cho side='right' để cột mọc xuống mép | `atgt-types.ts`, `atgt-draw-script.ts` |
| 16.17 | Cọc 0.LT đặt TẠI vị trí cách tim của tài sản (baseOffset = cachTim/cachMep) | `atgt-draw-script.ts` |
| 16.23 | Leader = SOLID arrow + PLINE 3 đỉnh (group 1 object) + MTEXT riêng | `atgt-draw-script.ts` |
| 16.24 | Debug log textPrefs giá trị engine đang dùng + verify save | `AtgtPanel.tsx` |

**Tổng diff Wave 16:** 9 file modified (+868/-358 dòng) + 2 file NEW (`polyline-curve.ts` 108 dòng, `FontPicker.tsx` 121 dòng).

### 🧪 TEST PLAN máy nhà — Phase 43 wave 16

**A. AtgtSidebar — nút Pick polyline mới (Wave 16.2):**
1. TrishDesign → tạo project ATGT → tạo đoạn → mở sidebar trái
2. Section "Chế độ vẽ" → chọn radio **"🛣 Theo polyline AutoCAD"**
3. Hiện nút xanh "**🎯 Chọn polyline trong AutoCAD**" thay cho input "Chiều dài polyline" cũ
4. Mở AutoCAD trước, vẽ 1 polyline cong/thẳng bất kỳ
5. Bấm nút → app gửi LISP vào AutoCAD → message "🖱 Chuyển sang AutoCAD và click vào polyline..."
6. Chuyển sang AutoCAD → click polyline → app nhận: "✓ Đã pick: N đỉnh, L=XX.XXm"
7. Sidebar hiện handle + chiều dài + số đỉnh

**B. AtgtPanel — Modal Cài đặt Text Style (Wave 16.6 + 16.7):**
1. AtgtPanel → tìm nút "🔠 Cài đặt text" (tooltip "Cài đặt font, width, chiều cao text trước khi vẽ (giống HHMĐ)")
2. Modal hiện: Tên style / Font file / Width factor / Cao text lý trình / Cao text leader / Scale block / Vị trí block 0.LT / Chiều dài block 0.LT / Chiều cao block biển báo
3. Field **Font file** = `FontPicker`: dropdown 3 tab (System TTF / SHX / Preset) → chọn `romans.shx` mặc định
4. Bấm "Save" → console log textPrefs đã save + reload modal phải giữ giá trị

**C. Engine vẽ AutoCAD — mode 'polyline' (Wave 16.3 + 16.10-16.23):**
1. Sau khi pick polyline + cài text + nhập tài sản (9 tab) → bấm "📐 Vẽ AutoCAD"
2. Engine chạy `_-STYLE` tạo style ATGT_TEXT → INSERT 0.LT cọc lý trình tại baseOffset (cách tim của tài sản) + scale `blockScale`
3. Vẽ biển báo bên RIGHT phải offset thêm `bienBaoHeight` (cột mọc xuống mép)
4. Leader = SOLID arrow + PLINE 3 đỉnh + MTEXT (không phải LEADER lệnh ACAD, để có thể group/edit từng object)
5. Block 0.LT (cọc lý trình) đặt tại `lyTrinhBlockOffset` + extend `lyTrinhBlockLength`

**D. Regression — Wave 15 vẫn chạy:**
- TrishAdmin AtgtBlocksPanel: bulk import 415 dòng / sort header / nút Upload .dwg / cột ZIP ✓/✗
- TrishDesign 9 tab tài sản / Vẽ AutoCAD (mode duỗi thẳng cũ) / Excel 9 sheet / Sync block

### ⚠ Còn dở (defer Wave 17):

- **Mode 'polyline'** đang code engine vẽ nhưng chưa test thực tế trong AutoCAD (chỉ test compile). Cần Trí mở AutoCAD vẽ polyline → pick → vẽ tài sản → verify block đặt đúng vị trí trên đường cong.
- Excel export cho mode 'polyline' (hiện chỉ duỗi thẳng có Excel)
- Upload block .dwg thật từ máy cơ quan để test full flow upload + sync (defer từ Wave 15)
- Build .exe release wave 2 (Drive/Finance/Office/ISO/Launcher)

### 🛟 Nếu END.bat máy cơ quan FAIL (gặp lỗi `.git/index.lock`)

Phiên này máy cơ quan có file `.git/index.lock` còn sót từ Claude tool (size 0, không xoá được qua bash). Nếu chạy `END.bat` báo lỗi "Another git process seems to be running":

```powershell
cd C:\Users\TRI\Documents\Claude\Projects\TrishTEAM\trishnexus-monorepo
del .git\index.lock
END.bat
```

Nếu vẫn fail, push thủ công:

```powershell
git add .
git commit -m "wip(wave16): pick polyline + textPrefs + FontPicker"
git push origin main
```

### ⚠ Lỗi có thể gặp & cách fix (mới Wave 16)

- **Pick polyline timeout 60s** → user chưa click polyline trong AutoCAD, hoặc click vào object không phải polyline/LWPOLYLINE/POLYLINE 2D. 3D polyline KHÔNG hỗ trợ (lỗi vlax-get).
- **`acad_pick_polyline` báo "ERR|..."** → LISP đọc coords lỗi. Mở `%TEMP%\trishdesign_pick_polyline.txt` xem nội dung.
- **FontPicker không load TTF system** → browser cũ không hỗ trợ `queryLocalFonts` API (Tauri WebView2 thường OK).
- **Block ATGT vẽ ra quá nhỏ/lớn** → chỉnh `blockScale` trong Modal text. Polyline 144 unit → blockScale 10-50 thường OK.

### 📁 Files thay đổi/tạo Phase 43 wave 16 (11 files):

**Modified (9):**
- `apps-desktop/trishadmin/src-tauri/src/lib.rs` (+36 dòng — chỉnh nhỏ)
- `apps-desktop/trishadmin/src/components/AtgtBlocksPanel.tsx` (+11)
- `apps-desktop/trishdesign/src-tauri/src/acad_com.rs` (+136 — Wave 16.2)
- `apps-desktop/trishdesign/src-tauri/src/lib.rs` (+2 — register command)
- `apps-desktop/trishdesign/src/lib/atgt-draw-script.ts` (+431/-... — engine vẽ refactor cho polyline)
- `apps-desktop/trishdesign/src/lib/atgt-script.ts` (+290 — posFn mode-aware)
- `apps-desktop/trishdesign/src/lib/atgt-types.ts` (+45 — AtgtTextPrefs + polylineVertices)
- `apps-desktop/trishdesign/src/modules/engineer/AtgtPanel.tsx` (+207 — Modal text + FontPicker integration)
- `apps-desktop/trishdesign/src/modules/engineer/AtgtSidebar.tsx` (+68 — nút Pick polyline)

**New (2):**
- `apps-desktop/trishdesign/src/lib/polyline-curve.ts` (108 dòng — arc-length param)
- `apps-desktop/trishdesign/src/modules/engineer/FontPicker.tsx` (121 dòng — font scanner)

---

## 📍 PHIÊN CŨ — 2026-05-18 (Phase 43 wave 15 — ATGT toàn bộ, CHƯA TEST MÁY CƠ QUAN)

### 🚨 BƯỚC ĐẦU TIÊN máy cơ quan

```powershell
cd C:\Users\TRI\Documents\Claude\Projects\TrishTEAM\trishnexus-monorepo
START.bat
```

Sau đó chọn app cần test:

```powershell
cd apps-desktop\trishadmin
pnpm tauri dev
```

hoặc:

```powershell
cd apps-desktop\trishdesign
pnpm tauri dev
```

Nếu Firestore báo "Missing or insufficient permissions" → deploy rules 1 lần:

```powershell
cd C:\Users\TRI\Documents\Claude\Projects\TrishTEAM\trishnexus-monorepo
firebase deploy --only firestore:rules
```

### 🧪 TEST PLAN sau khi START.bat lên

**A. TrishAdmin → "🚸 ATGT Blocks (DB + ZIP)" (panel merged Wave 13):**
1. Bấm "**Bulk import**" → modal textarea hiện ra (KHÔNG phải browser popup)
2. Mở Excel `database-c41a296c.xlsx` → sheet "Database" → Ctrl+A + Ctrl+C → paste → Import (415 dòng)
3. Click header cột bất kỳ (Label / File / Nhóm / Ý nghĩa) để sort ASC/DESC
4. Nút "📁 **Upload .dwg**" (Wave 15.2) — nhập GitHub PAT (scope `repo`, lưu localStorage) + tag `trishdesign-blocks-atgt-v1.0.0` → chọn nhiều file .dwg → app upload tuần tự từng file lên GitHub Release + ghi Firestore `/atgt_files/{slug}` per file
5. Sau upload, cột "ZIP" trong table hiện ✓ cho file đã upload, ✗ cho file chưa có, — nếu chưa upload zip nào
6. Filter dropdown "Tất cả ZIP status / ✓ Có / ✗ Thiếu" để tìm nhanh file cần bổ sung
7. Nút "**Sửa / Xóa**" mỗi row (Wave 14.3) — clickable, có border + padding

**B. TrishDesign → Panel "🚸 Vẽ hiện trạng ATGT" (refactor Wave 10):**
1. Tạo dự án + đoạn mới → thấy **layout 2-col**: Sidebar trái (khuôn đường + chế độ vẽ) + Main phải (9 tab tài sản)
2. Nút "**📋 Xem database**" (Wave 14.2) → mở modal hiện 415 block — read-only, có search/filter/sort
3. Nút "**🔄 Đồng bộ block**" (Wave 15.3) → fetch `/atgt_files` Firestore + Rust `list_local_atgt_files` + diff → download chỉ file mới/cập nhật, save vào `%APPDATA%\vn.trishteam.design\blocks\ATGT`
   - Toast realtime: "Đồng bộ 5/12: 2.BB.dwg"
   - Summary cuối: "+3 mới · ↻2 cập nhật · ✓10 đã có"
4. **9 tab tài sản** (Wave 10.2): BienBao / VachSon / DenTinHieu / HoLanMem / CocTieu / RanhDoc / CongNgang / TieuPhanQuang / GuongCauLoi — mỗi tab có bảng nhập riêng với cột đúng schema Excel
5. Tab "🛑 Biển báo" → ➕ Thêm dòng → gõ "P.101" → datalist autocomplete + tự fill "Ý nghĩa" + icon ✓ verify từ database (Wave 11.3 + 12.2)
6. Nút "**📐 Vẽ AutoCAD**" (Wave 10.3): vẽ trục tuyến + 0.LT block lý trình + INSERT block tài sản + LEADER hiện trạng
7. Nút "**📊 Xuất Excel**" (Wave 10.4): file 9 sheet đúng format database-c41a296c.xlsx

**C. TrishDesign → Panel "🛣 Vẽ hư hỏng mặt đường" (Wave 8.2):**
1. Cuộn xuống dưới grid hư hỏng → thấy section "🔵 Lỗ khoan" + "🟧 Hố đào"
2. ➕ Thêm → ô TRỐNG (không default LK1) → tự nhập số hiệu + lý trình + cách tim + vị trí
3. "📚 Lớp" expand → thêm các lớp (BTN/CPDD/Đất sét...)
4. Nút "**📊 Xuất Excel**" (TOP toolbar HHMĐ — 1 nút duy nhất) → file 5 sheet bao gồm Lỗ khoan + Hố đào theo lớp
5. Nút "**📐 Vẽ AutoCAD**" → vẽ DONUT lỗ khoan + RECTANG hố đào + bảng thống kê CAD merge cells

**D. TrishDesign → Panel "🌊 Vẽ mặt cắt hốt sạt — BaoLu" (Wave 8.1):**
1. Section "Diện tích đất sụt" có **dropdown 4 nguồn**: AI Vision / Polygon AutoCAD / Hình học / Nhập tay
2. Chọn "Hình học" → hiện input "Chiều sâu sụt trung bình (m)" → ô diện tích tự tính readonly
3. 1 nút "**📐 Vẽ AutoCAD**" duy nhất (gộp từ 2 nút cũ)

**E. App.tsx → admin thấy "📂 Mẫu hồ sơ" (Wave 8.1):**
- Admin login → sidebar "📂 Mẫu hồ sơ" hiển thị DocumentsPanel với 5 tab (KHÔNG phải banner Locked)

### ⚠ Lỗi có thể gặp & cách fix

- **"Missing or insufficient permissions"** → deploy Firestore rules (xem bước đầu)
- **TrishAdmin upload .dwg 401 Unauthorized** → GitHub PAT sai/hết hạn, tạo mới ở github.com/settings/tokens (scope `repo`)
- **TrishDesign sync 0 file** → Firestore `/atgt_files` rỗng, admin chưa upload .dwg qua TrishAdmin
- **AutoCAD không nhận block khi vẽ ATGT** → bấm "🔄 Đồng bộ block" trước
- **Vite esbuild lỗi "Unexpected" hoặc JSX no closing** → linter cắt file, `git checkout HEAD -- <file>` restore

### 📁 Tổng kết Phase 42-43 (đã commit + push):

| Phase/Wave | Nội dung chính | Files chính |
|---|---|---|
| **42 wave 8** | RoadDamage thêm lỗ khoan + hố đào + bảng thống kê đa lớp · BaoLu 4 nguồn diện tích · Admin bypass Mẫu hồ sơ | types.ts · state.ts · BoreHolePitSection.tsx (NEW) · BaoLuPanel.tsx · App.tsx |
| **42 wave 9** | ATGT block động Firestore + bảng đa năng + admin /admin/atgt-blocks + Excel + draw straight | AtgtBlockTable.tsx (NEW) · admin/atgt-blocks/page.tsx · atgt-placement-script.ts · atgt-excel-export.ts |
| **43 wave 10** | Refactor ATGT 9 loại tài sản theo `database-c41a296c.xlsx` · Sidebar khuôn đường · 9 tab · Engine vẽ + Excel 9 sheet | atgt-items-types.ts (NEW) · AtgtSidebar.tsx (NEW) · AtgtItemsTabs.tsx (NEW 833 dòng) · atgt-draw-script.ts (NEW) |
| **43 wave 11** | TrishAdmin upload zip lên GitHub Release · nút Tải block trong AtgtPanel · datalist autocomplete | trishadmin/AtgtZipUploadPanel.tsx (deprecated) · Rust github_upload_release_asset |
| **43 wave 12** | TrishAdmin panel CRUD database 415 block (bulk import TSV) + auto-fill yNghia · Bỏ web /atgt-blocks-zip | trishadmin/AtgtDatabasePanel.tsx (deprecated) · findBlockByLabel + BlockStatusBadge |
| **43 wave 13** | Merge 2 panel thành 1 (Database + ZIP) · custom modal textarea bulk import (bỏ window.prompt) · Rust read_zip_entries · check ZIP vs database | trishadmin/AtgtBlocksPanel.tsx (NEW MERGED) |
| **43 wave 14** | Sort header click · cột ZIP pill ✓/✗/— · TrishDesign AtgtDatabaseViewer modal read-only · table-layout fixed | AtgtDatabaseViewer.tsx (NEW) |
| **43 wave 15** | Per-file upload .dwg lên GitHub (multi-pick) · Firestore `/atgt_files` per file metadata · TrishDesign incremental sync (chỉ file mới/cập nhật) · UI table colors explicit · Rust list_local + download_atgt_file | atgt-sync.ts (NEW) · Rust 3 command mới |

### Defer (chưa làm):
- TrishDesign mode "Theo polyline AutoCAD" (Wave 9.3b) — cần Rust `acad_get_point_on_polyline` đọc polyline curve
- Upload block .dwg thật từ máy cơ quan để test full flow upload + sync
- Build .exe release wave 2 (Drive/Finance/Office/ISO/Launcher) — defer sau khi test xong ATGT

### 📚 Workflow nhắc lại:
- **Đầu phiên:** `START.bat` (auto pull + install)
- **Cuối phiên:** `END.bat` (auto commit + push)
- **2 máy nhà ↔ cơ quan:** luân phiên qua GitHub
- **Files NOT in git:** `.env.local`, `scripts/service-account.json`, `.machine-label` (copy USB nếu thiếu)

---

## 📍 PHIÊN CŨ — 2026-05-17 (Phase 42 wave 8 — 6 góp ý mới TrishDesign)

### 🚨 BƯỚC ĐẦU TIÊN

```powershell
cd C:\Users\TRI\Documents\Claude\Projects\TrishTEAM\trishnexus-monorepo
git pull
pnpm install
cd apps-desktop\trishdesign
pnpm tauri dev
```

### Trạng thái Phase 42 wave 8 (3 commit lần lượt)

**Wave 8.1 — BaoLu + Mẫu hồ sơ admin bypass** (commit 2026-05-17):
1. ✅ `App.tsx` — admin thấy được "Mẫu hồ sơ" (DocumentsPanel), user thường vẫn Locked
2. ✅ `BaoLuPanel.tsx` — gộp 2 nút "Vẽ AutoCAD" + "Vẽ A3+bảng" → 1 nút "📐 Vẽ AutoCAD" (gọi handleDrawSlideEventA3)
3. ✅ `BaoLuPanel.tsx` — Diện tích đất sụt 4 nguồn (`areaSource`):
   - 🤖 **AI Vision** (default) — auto-fill khi đo ảnh xong (prompt mới yêu cầu `areaDatSut` + `depthSut`)
   - 📐 **Polygon AutoCAD** — nút "Mở lệnh AREA" gửi `_AREA O` vào CAD, user click polygon → copy số từ CAD command line → paste vào input
   - 📏 **Hình học** — auto tính qua `computeAreaFromGeometry()` từ road geometry + `depthSut` (3 công thức theo crossType)
   - ✏ **Nhập tay**
4. ✅ SectionsSummary + ExportExcel update schema mới (bỏ L/B/H legacy)

**Wave 8.2 — RoadDamage lỗ khoan + hố đào đa lớp** (commit 2026-05-17):
- `types.ts` thêm 3 interface (`BorePitLayer`, `BoreHole`, `ExcavationPit`) + 2 field optional vào `RoadSegment`
- `state.ts` thêm 8 CRUD methods
- `BoreHolePitSection.tsx` (NEW ~570 dòng): UI 2 bảng "🔵 Lỗ khoan" + "🟧 Hố đào", cột Số hiệu / Lý trình / Cách tim / Vị trí / Số lớp; nút ➕ Thêm / 📋 Dán TSV / 🗑 Xóa multi / ♻ Xóa bảng; expand row → LayerEditor con với cột Lớp # / Tên / Chiều dày / Ghi chú + ▲▼🗑; 2 bảng thống kê tự sinh dưới
- `RoadDamageModule.tsx` import + render `<BoreHolePitSection />` dưới `<HuHongRightSide />`
- ⏳ **Defer Wave 8.4:** AutoCAD draw circle/square hatch + Excel export 2 bảng thống kê

**Wave 8.3 — ATGT block động + bảng đa năng** (commit 2026-05-17):
- `website/app/admin/atgt-blocks/page.tsx` (NEW) — CRUD danh mục block giống GIS Markers; schema `/atgt_blocks/{id}`: label, fileName, category, colorIndex, hatchName, defaultScale
- `website/app/admin/layout.tsx` — nav link "🚸 ATGT Blocks" + import `Shapes`
- `firestore.rules` — `/atgt_blocks/{blockId}` public read + admin write
- `lib/atgt-blocks-fetch.ts` (NEW) — hook `useAtgtBlocks()` fetch Firestore + cache localStorage
- `lib/atgt-types.ts` — thêm `AtgtBlockPlacement` + extend `AtgtSegment.blockPlacements?`
- `modules/engineer/AtgtBlockTable.tsx` (NEW ~400 dòng): bảng đa năng dropdown chọn block; cột Block / Lý trình / Cách tim / Vị trí / Tình trạng / Ghi chú; nút ➕ / 📋 Dán Excel / 📥 Import file / 🗑 / ♻; filter nhóm; summary chip
- `AtgtPanel.tsx` — render `<AtgtBlockTable />` giữa SegmentEditor và ItemForm (song song UI 9-category cũ)
- ⏳ **Defer Wave 8.4:** AutoCAD INSERT block .dwg từ AtgtBlockPlacement + Excel export

### 🧪 TEST PLAN Phase 42 wave 8

**1. Mẫu hồ sơ — admin bypass**
- Login admin (Trí) → sidebar "📂 Mẫu hồ sơ" → hiển thị 5 tab DocumentsPanel thay vì banner Locked
- Login user thường → vẫn banner "🚧 Đang phát triển"

**2. BaoLu — Diện tích 4 nguồn**
- Mặt cắt → tab "Nhập số liệu" → dropdown "📥 Nguồn diện tích đất sụt"
- 4 mode: AI Vision (readonly + hint) / Polygon (nút mở AREA, editable) / Hình học (input depthSut + readonly area) / Nhập tay
- Test 3 crossType với mode 'geometry' → 3 công thức khác nhau

**3. BaoLu — 1 nút Vẽ AutoCAD**
- Toolbar chỉ còn 1 nút (gộp), bấm → A3 scale 0.2 + bảng thống kê

**4. RoadDamage — Lỗ khoan + Hố đào**
- Đoạn đường → cuộn xuống → 2 section
- ➕ Thêm → nhập LK1 / 50 / 2 / Phải
- 📚 Lớp → expand → 3 lớp (BTN 0.05 / CPDD 0.20 / Đất sét 0.40) → tổng 0.65m
- 📋 Dán TSV / 🗑 Xóa multi / ♻ Xóa bảng

**5. ATGT — Block động Firestore**
- `trishteam.io.vn/admin/atgt-blocks` → "+ Thêm block": `bb_w210` / "Biển báo W210" / `W210.dwg` / "Biển báo"
- Reload TrishDesign ATGT → "1 block khả dụng"
- ➕ Thêm dòng → dropdown hiện block → chọn → nhập lý trình
- 📋 Dán Excel: `bb_w210\t100\t2\tphải\ttốt`

### ⏳ Defer Wave 8.4 (sau khi Trí test 8.1–8.3):
- AutoCAD draw cho BoreHole/Pit (circle + square hatch)
- Excel export 2 bảng thống kê BoreHole/Pit đa lớp
- AutoCAD INSERT block .dwg từ AtgtBlockPlacement
- Rust command `acad_get_polygon_area` (2-way pick — hiện 1-way)
- Deploy Firestore rules: `firebase deploy --only firestore:rules`
- Deploy website lên Vercel

### 🔑 Lưu ý quan trọng:
- ⚠ **Linter ẩn tự cắt file** — nếu thấy file cụt giữa hàm/JSX → restore git HEAD + reapply patches qua bash heredoc thay vì Edit tool
- AtgtPanel hiện có 2 UI song song (9-category cũ + AtgtBlockTable mới) — sau khi Trí confirm OK, wave sau sẽ xóa UI cũ
- ATGT Firestore deploy lần đầu cần Trí (admin) thêm vài block test trước, sau đó user mới thấy dropdown
- Block .dwg cho ATGT vẫn cần upload qua GitHub Release `trishdesign-blocks-atgt-v1.0.0`

---

## 📍 PHIÊN CŨ — 2026-05-13 (TrishDesign Phase 42 wave 7 — chuyển máy nhà)

### 🚨 BƯỚC ĐẦU TIÊN máy nhà sau khi pull code:

```powershell
cd C:\Users\TRI\Documents\Claude\Projects\TrishTEAM\trishnexus-monorepo
git pull
pnpm install
cd apps-desktop\trishdesign
pnpm tauri dev
```

### Trạng thái Phase 42 (TrishDesign — 9 góp ý của Trí, 7 wave code)

✅ **8/9 góp ý đã code** (TrishDesign):

| # | Góp ý | Status |
|---|-------|--------|
| 1 | RoadDamage nút 🧹 Xóa bảng | ✅ DONE (`RoadDamageModule.tsx:1295`) |
| 2 | ATGT — block insert + Leader nếu có Hiện trạng + att lý trình GHICHUBIENBAO | ⚙ HELPERS done. Wire vào `generateAtgtCommands` defer Wave 8 (sau khi Trí cấp folder block + test schema mới) |
| 3 | BaoLu hốt sạt — refactor schema (areaDatSut + road geometry) + 2 tab Số liệu/AI Vision + Vẽ A3 khung scale 0.2 + bảng thống kê | ✅ DONE |
| 4 | Chatbot — Trí skip | — |
| 5 | OCR — AI prompt phân biệt 6 trường | ✅ DONE |
| 6 | "Mẫu hồ sơ" Locked + đang phát triển | ✅ DONE |
| 7 | AutoLISP Cloud — đã có sẵn Phase 28.14 | ✅ |
| 8 | GIS Markers Firestore + admin web CRUD + fetch panel | ✅ DONE |
| 9 | Dự toán + Kết cấu Locked | ✅ |

✅ **Cộng thêm:**
- Rust command `download_extract_blocks_atgt(url)` + nút **📥 Tải block ATGT** trong Settings (tự download zip từ GitHub + PowerShell extract về `%APPDATA%\vn.trishteam.design\blocks\ATGT`)

### 🧪 TEST PLAN (làm tuần tự khi mở app):

1. **Khởi động** — `pnpm tauri dev` → không còn lỗi compile (đã fix backtick + null bytes + JSX closing)
2. **RoadDamage** → nhập 3 miếng → bấm **🧹 Xóa bảng** → confirm dialog → bảng rỗng (AutoCAD không bị xóa)
3. **Mẫu hồ sơ** → banner "🚧 Đang phát triển"
4. **GIS-MAP** → cuối panel có section "📍 Mốc tọa độ TrishTEAM" (rỗng nếu admin chưa thêm)
5. **Web admin → 📍 GIS Markers** (https://trishteam.io.vn/admin/gis-markers) → thêm 3 mốc thử → reload TrishDesign GIS-MAP thấy filled
6. **Settings → 📦 Thư mục Block ATGT → 📥 Tải block** → (CẦN GitHub Release `trishdesign-blocks-atgt-v1.0.0` đã upload trước)
7. **Vẽ mặt cắt hốt sạt → mặt cắt mới**:
   - 2 tab rõ ràng: 📝 **Nhập số liệu** (lý trình + areaDatSut + road geometry) | 🤖 **AI Vision đo ảnh** (upload + AI đo)
   - Thêm 3-4 mặt cắt với station_m tăng dần + areaDatSut > 0
   - Bấm **🖨 Vẽ A3 + bảng** → AutoCAD vẽ khung A3 + grid mặt cắt + bảng thống kê
8. **Khảo sát OCR** → upload ảnh → AI chuẩn hóa với prompt mới (6 trường)

### ⏸ Defer Wave 8 (sau khi Trí test wave 7):

- AtgtPanel wire `insertBienBaoWithStation` + `generateBlockInsertCmd` vào `generateAtgtCommands` main flow (cần Trí cấp folder block thực tế)
- GitHub Release `trishdesign-blocks-atgt-v1.0.0` với file zip chứa block .dwg (`GC.31a.dwg`, `GHICHUBIENBAO.dwg`, `COC_TIEU_1.dwg`, ...)
- BaoLu — Tab "Điểm sụt" UI (tạo SlideEvent + assign sections)
- Polygon đất sụt thực thay rectangle placeholder
- AI Vision đo diện tích đất sụt — implement gọi Gemini/Groq Vision với prompt JSON `{ area_m2 }`

### 📁 Files thay đổi/tạo trong Phase 42 (12 files):

- `apps-desktop/trishdesign/src/App.tsx` — "Danh mục hồ sơ" → "Mẫu hồ sơ" Locked
- `apps-desktop/trishdesign/src/modules/engineer/RoadDamageModule.tsx` — 🧹 Xóa bảng
- `apps-desktop/trishdesign/src/modules/engineer/BaoLuPanel.tsx` — schema mới + 2 tab + Vẽ A3
- `apps-desktop/trishdesign/src/modules/engineer/SettingsPanel.tsx` — 📦 Block ATGT folder
- `apps-desktop/trishdesign/src/modules/engineer/SurveyPanel.tsx` — AI prompt mới
- `apps-desktop/trishdesign/src/modules/engineer/GISMapPanel.tsx` — wire GisMarkersTab
- `apps-desktop/trishdesign/src/modules/engineer/GisMarkersTab.tsx` — **NEW**
- `apps-desktop/trishdesign/src/lib/atgt-types.ts` — leaderTextFor field
- `apps-desktop/trishdesign/src/lib/atgt-script.ts` — `generateBlockInsertCmd`, `insertBienBaoWithStation`, `getAtgtBlocksFolder`, `leaderTextFor`
- `apps-desktop/trishdesign/src/lib/baolu-script.ts` — **NEW** generateSlideEventCommands
- `apps-desktop/trishdesign/src-tauri/src/lib.rs` — `download_extract_blocks_atgt`
- `website/app/admin/gis-markers/page.tsx` — **NEW** CRUD GIS markers
- `website/app/admin/layout.tsx` — link 📍 GIS Markers
- `firestore.rules` — `/gis_markers` + `/apps_catalog` rules

### 🔑 Lưu ý quan trọng:

- App đã sạch lỗi compile khi Trí pull về máy nhà — chỉ cần `pnpm install` + `pnpm tauri dev`
- Schema BaoLu mới có deprecated fields (`name`, `L`, `B`, `H`, `alpha`) giữ backward compat — data cũ không mất
- Block folder default: `%APPDATA%\vn.trishteam.design\blocks\ATGT` — auto-create khi user bấm Tải
- GitHub Release block ATGT: Trí chưa upload, bấm Tải sẽ fail HTTP 404 — bình thường

---

## 📍 PHIÊN CŨ (ARCHIVE Phase 41) — 2026-05-13 sáng

## 📍 PHIÊN HIỆN TẠI — 2026-05-13 (đọc TRƯỚC NHẤT, override mọi history phía dưới)

### Trạng thái Phase 40 + 41 (5 app SẴN SÀNG BUILD v1.0.0 wave 2)

**5 app cần build + release:** TrishDrive, TrishFinance, TrishOffice, TrishLauncher, TrishAdmin (TrishAdmin build only, KHÔNG public release).

✅ **Phase 40 — Drive yt-dlp pipeline + Finance modules + Office multi-tenant:**
- TrishDrive: yt-dlp + ffmpeg + Deno auto-install, n-sig bypass (Phase 40.22), playlist range + skip duplicates + subtitle vi/en (Phase 40.23)
- TrishFinance: 7 modules ngành mới (Sân TT/Karaoke/Spa/Cafe/Gym/Kho/Photocopy) + Dashboard + Bank CSV + Payment QR VietQR
- TrishOffice: multi-tenant data scoping per-company (Phase 40.3) — switch company trong sidebar → data tách hoàn toàn. CompanyContext + storage.ts scope key thành `co_<companyId>__<collection>`. Auto-migrate data cũ vào company đầu tiên.

✅ **Phase 41 — TrishAdmin 4 panel mới:**
- 📦 **App Catalog (Firestore)** — `/apps_catalog/{appId}` source of truth mới, add app NGOÀI hệ sinh thái (Photoshop/AutoCAD/OBS) với logo + link tải
- 🏢 **Office Multi-tenant** — cross-company browser cho admin debug
- 📋 **ISO Projects** — browse `/HoSoTong` cross-user
- 💵 **Finance Telemetry** — view key activations (Finance local-only nên không view được DB)

✅ **Phase 41.1 — Wire:**
- Firestore rules: `/apps_catalog/{appId}` public read + admin write
- TrishLauncher `registry-loader.ts` fetch Firestore TRƯỚC, fallback static JSON
- Fix collection names: `'users'` (không phải `'TrishUser'`), `/keys` filter `app_id`

✅ **Phase 41.2 — Launcher external app support:**
- `packages/core/types.ts`: thêm `category` (ecosystem/external/utility), `homepage_url`, `publisher` vào `AppRegistryEntry`
- External app: badge **🔵 Đối tác**, nút **"🌐 Mở trang chủ"** → mở browser homepage thay vì cài đặt qua Tauri

### 🚀 BƯỚC TIẾP — BUILD + RELEASE

**Lệnh duy nhất:**
```powershell
cd C:\Users\TRI\Documents\Claude\Projects\TrishTEAM\trishnexus-monorepo
if (Test-Path .git\index.lock) { Remove-Item .git\index.lock -Force }
git add -A
git commit -m "feat: Phase 40-41 wave 2 - 5 app v1.0.0 ready to ship"
git push

# Build + release tự động:
.\scripts\BUILD-RELEASE-v1.0.ps1
```

Script `scripts/BUILD-RELEASE-v1.0.ps1`:
1. Pre-flight: check pnpm + Rust + gh CLI
2. `pnpm install` + build shared packages
3. Build 5 app theo thứ tự: TrishLauncher → TrishAdmin → TrishOffice → TrishDrive → TrishFinance
4. Tính SHA256 + size mỗi .exe
5. GitHub Release 4 app public (skip TrishAdmin)
6. In ra section apps-registry.json cần update

**Sau khi script chạy xong:**
1. Mở `apps/website/public/apps-registry.json`
2. Update URL + SHA256 + size_bytes cho 5 app từ output script
3. Commit + push → Vercel auto-deploy ~2 phút
4. TrishLauncher tự detect update khi user mở app

**Deploy Firestore rules (nếu chưa làm Phase 41.1):**
```powershell
firebase deploy --only firestore:rules
```

### ⏭ Phase 42 — TrishDesign v1.0 AutoCAD COM (sau khi wave 2 release xong)

Deadline cũ 2026-05-07 đã trễ. Làm sau khi 5 app release.

---

## 📍 PHIÊN CŨ (ARCHIVE) — 2026-05-10 (đọc TRƯỚC NHẤT, override mọi history phía dưới)

### Trạng thái wave v1.0.0 (Phase 38 chính)

✅ **6 app .exe đã release GitHub:** TrishLauncher 1.0.0 (4.7 MB), TrishCheck (3.3), TrishClean (3.4), TrishFont (3.7), TrishShortcut (3.3), TrishLibrary (30.2)

✅ **Hạ tầng Phase 38 DONE:**
- Role-based access (trial/demo/user/admin) thay key system 16-char
- apps-registry schema v6 (bỏ requires_key/key_type)
- Auto-update detection qua PE FileVersion (Launcher tự hiện nút "⬆ Cập nhật")
- Scripts auto-publish 3 lệnh (`bump-version.bat` + `release-app.bat <app> <ver> --auto`)
- Website polish: header h-20, 5 ambient orbs, 11 logo PNG tile trắng đồng nhất, /downloads slim, /huong-dan 11 guides theme sync
- 4 docs Phase 38 (PHASE38-SUMMARY, RELEASE-V1-WORKFLOW, ROLE-BASED-ACCESS, TROUBLESHOOTING-PHASE38)

### 🚧 Phase 38.7 — TrishAdmin /admin/users (CHƯA TEST, chưa build)

**Code xong 2026-05-10 chiều, đang ở máy CƠ QUAN test tiếp.**

3 file đã sửa (commit `082450d wip: end of session`):

1. `apps-desktop/trishadmin/src/components/UsersPanel.tsx` (~650 dòng)
   - Thêm role `demo` vào ROLE_OPTIONS + ROLE_LABEL (4 role: trial/demo/user/admin)
   - Cột "Demo expiry" trong table: xám > 7 ngày, vàng ≤ 7, đỏ "Hết hạn"
   - EditRoleModal: chọn demo → input số ngày + 5 preset chip 7/14/30/60/90d + preview ngày hết hạn
   - Bỏ tất cả `window.confirm`/`window.prompt` → custom `ConfirmModal` (support `requireText` cho delete)

2. `apps-desktop/trishadmin/src/lib/firestore-admin.ts` (1511 dòng)
   - `setUserRole()` thêm param `demoDays?: number` (param thứ 5)
   - `byRole` Record thêm key `demo: 0`

3. `website/app/api/admin/set-role/route.ts` (160 dòng)
   - Accept role `demo` + body `demoDays` (default 30, max 365)
   - Set Firestore `demo_expires_at` + `demo_set_by_uid` + `demo_set_at`
   - Khi đổi sang non-demo → `FieldValue.delete()` xóa 3 field demo

### ⏳ Bước tiếp NGAY (đang chờ)

```powershell
cd C:\Users\TRI\Documents\Claude\Projects\TrishTEAM\trishnexus-monorepo
Remove-Item .git\index.lock -ErrorAction SilentlyContinue
cd apps-desktop\trishadmin
pnpm tauri dev
```

Test checklist trong memory `phase_38_7_progress.md` — đại ý:
- Mở user → bấm `✏ Role` → 4 option, chọn Demo → box vàng + preset chip
- Cột "Demo expiry" 3 màu theo daysLeft
- Đổi demo → user thì 3 field Firestore phải bị xóa
- Custom modal thay window.confirm khi bấm ISO/Finance/Trial/Delete
- Delete modal: gõ email mới active được nút Xóa

**SAU KHI TEST OK** → `pnpm tauri build` (chỉ local, TrishAdmin private — KHÔNG gh release).

### 📋 Roadmap sau Phase 38.7 (đã chốt với Trí)

1. ✅ Phase 38.7 TrishAdmin /admin/users (đang test)
2. Build 4 app pending: TrishDrive / TrishFinance / TrishISO / TrishOffice → `pnpm tauri build` + `release-app.bat`
3. TrishFinance Vercel PWA deploy `finance.trishteam.io.vn` (5 module: POS / nhà trọ / sân thể thao / kho điện tử / photocopy — xem memory `trishfinance_modules.md`)
4. TrishDesign v1.0 (AutoCAD COM, deadline đã trễ 7/5/2026)
5. Email notification (role change + demo còn ≤ 7 ngày)

### ⚠️ Cảnh báo khi tiếp tục code

- Linter máy nhà Trí từng cắt file dài khi có nhiều emoji (✓ ⏳ 🗑 →) — verify `wc -l` trước/sau khi sửa file Phase 38.7
- VS Code auto-revert: đóng VS Code TRƯỚC khi `git commit` (memory `feedback_vscode_autorevert.md`)
- PowerShell không hiểu `&&`: dùng `;` hoặc 2 dòng (memory `feedback_powershell_separator.md`)
- KHÔNG dùng browser popup (`alert`/`prompt`/`confirm`) — Trí ghét — luôn dùng inline UI / toast / custom modal

---

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

## 📚 LỊCH SỬ SESSION CŨ (archive — đã được override bởi section `📍 PHIÊN HIỆN TẠI` ở trên)

> ⚠️ **Mọi thông tin dưới đây là LỊCH SỬ.** Nội dung mới nhất ở section `📍 PHIÊN HIỆN TẠI`. Đọc dưới đây chỉ khi cần tra lịch sử Phase 33-38.2.

### ⚡ Cuối phiên 2026-05-08 (máy nhà) — Phase 38.2.0 DONE (code-only, chưa test build)

**Trí cần làm bước tiếp ở phiên kế:**

1. **Build + verify Phase 38.2.0:**
   ```powershell
   cd C:\Users\TRI\Documents\Claude\Projects\TrishTEAM\trishnexus-monorepo
   pnpm install   # similar crate sẽ resolve khi cargo fetch
   pnpm -C apps-desktop\trishlibrary fetch:tessdata   # tải ~70MB tessdata vie+eng
   pnpm -C apps-desktop\trishlibrary tauri dev        # test mở app, vào Settings → Công cụ ngoài
   ```
2. Test wizard `INSTALL-TOOLS.bat` (Settings → Công cụ ngoài → Mở wizard cài đặt) — chọn cài Tesseract + qpdf + LibreOffice qua winget
3. Sau khi verify OK → tiếp Phase 38.2.2 PDF Stamp Pro

**Đã làm session 2026-05-08:**

- ✅ Phase 38.2.0a — Bundle tessdata best (vie + eng) vào NSIS installer
  - `scripts/fetch-tessdata.ps1` — tải tessdata từ tessdata_best GitHub vào `apps-desktop/trishlibrary/src-tauri/resources/tessdata_best/` (gitignored)
  - `package.json` script `tauri:build` chạy `fetch:tessdata` trước khi build
  - `tauri.conf.json` thêm `bundle.resources` cho tessdata + INSTALL-TOOLS.bat
- ✅ Phase 38.2.0b — Tools wizard installer
  - `apps-desktop/trishlibrary/src-tauri/resources/INSTALL-TOOLS.bat` — menu cài Tesseract / qpdf / LibreOffice qua winget (silent install + check sau cài)
- ✅ Phase 38.2.0c — Rust commands + UI Settings
  - `lib.rs` thêm `ensure_tessdata_first_run` (setup hook copy bundle → AppData), `open_install_tools_wizard`, `check_external_tools`
  - `AppSettingsModal.tsx` thêm section "🛠 Công cụ ngoài" (5 row trạng thái + nút mở wizard)
- ✅ Phase 38.2.4 prep — Thêm crate `similar = "2.6"` vào `Cargo.toml` (cho text diff)

**File mới:**
- `scripts/fetch-tessdata.ps1`
- `apps-desktop/trishlibrary/src-tauri/resources/.gitkeep`
- `apps-desktop/trishlibrary/src-tauri/resources/INSTALL-TOOLS.bat`

**File sửa:** `.gitignore`, `package.json` (trishlibrary), `Cargo.toml` (trishlibrary), `tauri.conf.json` (trishlibrary), `lib.rs` (trishlibrary), `AppSettingsModal.tsx` (trishlibrary)

---

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
   cd C:\Users\TRI\Documents\Claude\Projects\TrishTEAM\trishnexus-monorepo; git add -A; git commit -m "feat: Phase 36+37 key system end-to-end + Phase 38.1 launcher metadata"; git push origin main
   ```

3. **Cài deps machine-id Rust crate** (1 lần, các app sẽ link path):
   ```powershell
   cd C:\Users\TRI\Documents\Claude\Projects\TrishTEAM\trishnexus-monorepo; pnpm install
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

- **38.4 TrishISO Hoan Cong Checklist** ✅ DONE
  - File `pages/HoanCongPage.tsx` (~480 lines)
  - 4 preset: Đường (14 items) / Cầu (12 items) / Thoát nước (9 items) / Điện (10 items)
  - Status: ✓ Đủ / ⏳ Đang chuẩn bị / ✗ Thiếu + % progress + localStorage persist
  - Wire vào sidebar TrishISO

- **38.5 TrishDrive share workaround** ✅ DONE từ Phase 26.0 trước (web /api/drive/share/[token]/proxy implement bot.forwardMessage)

- **39.1 Website Hướng dẫn 11 apps** ✅ DONE
  - `/huong-dan` index page (11 cards)
  - `/huong-dan/[slug]` dynamic detail (intro + features + sections)
  - Content array `lib/huong-dan-content.ts`

- **39.2 Seed apps Firestore** ✅ DONE
  - Script `scripts/seed-apps-meta.ts` bulk import apps-registry.json → /apps_meta
  - Chạy: `npx ts-node scripts/seed-apps-meta.ts` (cần GOOGLE_APPLICATION_CREDENTIALS)
  - /downloads page tự refresh sau ~5 phút (Vercel CDN cache)

- **Phase 35 update countdown** ✅ DONE — đổi 07/05/2026 → 11/05/2026 9h (middleware.ts + coming-soon page)

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
File `.machine-label` ở root project (gitignored) chứa `home` hoặc `office`. START.ba