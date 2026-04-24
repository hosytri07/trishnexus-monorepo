# TrishTEAM — Web ⇄ Desktop parity spec

Spec Phase 11 (task #65). Cách 2 nền tảng — **website** `trishteam.com` và
**desktop ecosystem** (Launcher + 10 app PyQt6) — chia sẻ data, auth, logic,
brand như thể là một; user chuyển qua lại mà không thấy lệch.

> Đây là doc **hợp đồng** giữa 2 platform — không duplicate nội dung schema
> (xem [`AUTH.md`](AUTH.md) §2) hoặc sitemap website (xem
> [`WEBSITE.md`](WEBSITE.md) §2). Doc này trả lời **"ai chịu trách nhiệm gì,
> merge theo thứ tự nào, lỗi xảy ra thì nền nào thắng"**.

## Mục lục

1. [Nguyên tắc parity](#1-nguyên-tắc-parity)
2. [Scope — app nào có parity, app nào không](#2-scope)
3. [Feature pairing matrix](#3-feature-pairing-matrix)
4. [Data model parity — Firestore ↔ SQLite cache](#4-data-model-parity)
5. [Schema versioning + migration flow](#5-schema-versioning)
6. [Auth SSO end-to-end flow](#6-auth-sso-end-to-end)
7. [Deep link protocol `trishteam://`](#7-deep-link-protocol)
8. [Offline handling + sync reconciliation](#8-offline-handling)
9. [Design token pipeline](#9-design-token-pipeline)
10. [Release cadence + version skew](#10-release-cadence)
11. [Parallel dev workflow — PR checklist](#11-parallel-dev-workflow)
12. [Testing matrix cross-platform](#12-testing-matrix)
13. [Failure modes + ai thắng](#13-failure-modes)

---

## 1. Nguyên tắc parity

Cam kết với user: **"Một tài khoản, một data, xài mọi nơi."** Cụ thể:

1. **Single source of truth**: Firestore là canonical store cho mọi data
   login-required. SQLite trên desktop chỉ là **cache** (read-through,
   write-through) — crash máy, reinstall → mở app login lại → data y nguyên
   từ cloud.
2. **Feature parity, không UI parity**: desktop dùng PyQt6 native widgets,
   web dùng React/Tailwind. UI khác nhau chuyên biệt cho mỗi platform —
   nhưng **feature set phải khớp**: web thêm field nào, desktop phải đọc
   được field đó (dù có thể không hiển thị chỉnh sửa nếu chưa support).
3. **Brand identical**: logo + palette + typography **phải** y nhau. Đây là
   điều duy nhất tuyệt đối không negotiate.
4. **Auth identical**: cùng Firebase Auth tenant (`trishteam-prod`), cùng
   custom claims schema. User login web → desktop biết. Không có "tài khoản
   riêng cho desktop".
5. **No silent divergence**: nếu 1 trong 2 platform thêm feature mà platform
   kia chưa có, phải có fallback graceful (desktop hiện badge "Chỉ trên
   web" chẳng hạn) — không được crash hoặc corrupt data.

## 2. Scope

Không phải app nào cũng có web counterpart. Phân loại:

| App          | Web counterpart                 | Data trên cloud? | Lý do                           |
|--------------|---------------------------------|------------------|---------------------------------|
| TrishLauncher| `/` + `/apps/*` + `/downloads`  | Read-only (apps.json) | Marketing + catalog chỉ     |
| TrishDesign  | ❌ (desktop-only)               | ✅ (projects)    | CAD/kết cấu cần desktop GPU     |
| TrishLibrary | ✅ `/library`                   | ✅               | Flagship parity app             |
| TrishNote    | ✅ `/note`                      | ✅               | Flagship parity app             |
| TrishSearch  | ✅ `/search`                    | ✅ (search index)| Index dùng chung                |
| TrishAdmin   | ✅ `/admin` (role-gated)        | ✅ (admin_ops)   | Quản trị đa phần làm qua web    |
| TrishFont    | ❌ (desktop-only)               | Opt-in (favorites) | Font system-level               |
| TrishType    | ❌                              | Opt-in (stats)   | Input device, desktop only      |
| TrishCheck   | ❌                              | ❌               | Standalone utility              |
| TrishClean   | ❌                              | ❌               | Standalone utility              |
| TrishImage   | ❌                              | Opt-in (backup)  | GPU-heavy, desktop only         |

**Parity apps**: Library / Note / Search / Admin (+ marketing hub).

**Cloud-sync opt-in apps** (Font / Type / Image): có Firestore record nhưng
**không** có web UI — web chỉ cho xem stats read-only trong `/account`.

**Offline-only apps** (Design / Check / Clean): không đụng Firestore. Nếu
sau này muốn sync, bump scope trong doc này.

## 3. Feature pairing matrix

Mỗi feature của 4 parity app có 1 row bắt buộc — desktop module path + web
route path + Firestore collection + schema version tối thiểu. Khi
implement, cả 2 PR phải tham chiếu đúng row này.

### 3.1 TrishLibrary

| Feature                | Desktop module                              | Web route              | Firestore              | Min schema |
|------------------------|---------------------------------------------|------------------------|------------------------|------------|
| List items             | `trishlibrary/modules/list/view.py`         | `app/library/page.tsx` | `library/{uid}/items`  | v1         |
| Add item (file)        | `trishlibrary/modules/add/file_picker.py`   | `app/library/add`      | `library/{uid}/items`  | v1         |
| Add item (link)        | `trishlibrary/modules/add/link_dialog.py`   | `app/library/add`      | `library/{uid}/items`  | v1         |
| Tag filter             | `trishlibrary/modules/filter/tags.py`       | `app/library?tag=...`  | `library/{uid}/items`  | v1         |
| Full-text search       | (delegate TrishSearch)                      | `app/search`           | `search_index`         | v2         |
| Item preview           | `trishlibrary/modules/preview/pane.py`      | `app/library/[id]`     | `library/{uid}/items`  | v1         |
| Bulk import            | `trishlibrary/modules/import/folder.py`     | ❌ (desktop-only)      | `library/{uid}/items`  | v1         |

### 3.2 TrishNote

| Feature                | Desktop module                              | Web route              | Firestore              | Min schema |
|------------------------|---------------------------------------------|------------------------|------------------------|------------|
| List notes             | `trishnote/modules/list/view.py`            | `app/note/page.tsx`    | `notes/{uid}/notes`    | v1         |
| Editor (markdown)      | `trishnote/modules/editor/markdown.py`      | `app/note/[id]`        | `notes/{uid}/notes`    | v1         |
| Tag + pin              | `trishnote/modules/tags/pins.py`            | in-editor sidebar      | `notes/{uid}/notes`    | v1         |
| Due date reminder      | `trishnote/modules/reminder/scheduler.py`   | `app/note?due=soon`    | `notes/{uid}/notes`    | v1         |
| Attachment (image)     | `trishnote/modules/attach/image.py`         | `app/note/[id]`        | Cloud Storage          | v2         |
| Offline draft          | `trishnote/modules/offline/queue.py`        | IndexedDB              | local only until sync  | v1         |

### 3.3 TrishSearch

| Feature                | Desktop module                              | Web route              | Firestore              | Min schema |
|------------------------|---------------------------------------------|------------------------|------------------------|------------|
| Query across apps      | `trishsearch/modules/query/engine.py`       | `app/search/page.tsx`  | `search_index/{uid}`   | v1         |
| Tag filter             | `trishsearch/modules/filter/tag.py`         | `app/search?tag=...`   | `search_index/{uid}`   | v1         |
| Source filter          | `trishsearch/modules/filter/source.py`      | `app/search?src=...`   | `search_index/{uid}`   | v1         |
| Semantic retrieval     | `trishsearch/modules/ai/embedder.py`        | ❌ (desktop-only v1)   | local sqlite-vec       | v3 (Phase 12) |
| Saved query            | `trishsearch/modules/saved/query.py`        | `app/search/saved`     | `search_saved/{uid}`   | v2         |

### 3.4 TrishAdmin

| Feature                | Desktop module                              | Web route              | Firestore              | Min schema |
|------------------------|---------------------------------------------|------------------------|------------------------|------------|
| User list              | `trishadmin/modules/users/list.py`          | `app/admin/users`      | `users`                | v1         |
| Set role               | `trishadmin/modules/users/set_role.py`      | `app/admin/users/[uid]`| Cloud Function `setUserRole` | v1   |
| Auth events log        | `trishadmin/modules/logs/auth.py`           | `app/admin/logs`       | `auth_events`          | v1         |
| Admin ops log          | `trishadmin/modules/logs/ops.py`            | `app/admin/logs?op=*`  | `admin_ops`            | v1         |
| Push font pack         | `trishadmin/modules/packs/push.py`          | `app/admin/packs`      | (GitHub Release API)   | v1         |
| Bump app version       | `trishadmin/modules/releases/bump.py`       | `app/admin/releases`   | trigger CI workflow    | v1         |

> **Quy tắc**: thêm row nào vào bảng này ⇒ mở đồng thời 2 PR (desktop + web)
> reference đúng row đó. Không cho phép merge 1 bên mà bên kia còn TODO.

## 4. Data model parity

### 4.1 Firestore (canonical)

Schema chi tiết trong [`AUTH.md §2`](AUTH.md). Tóm tắt 5 collection chính:

```
/users/{uid}                                    profile + role (mirror claim)
/library/{uid}/items/{itemId}                  TrishLibrary items
/notes/{uid}/notes/{noteId}                    TrishNote notes
/search_index/{uid}/documents/{docId}          TrishSearch index
/auth_events/{evtId}                           security log (admin-read)
/admin_ops/{opId}                              admin action log (admin-read)
/search_saved/{uid}/queries/{qId}              saved queries (v2)
```

### 4.2 SQLite cache (desktop)

Mỗi parity app có 1 SQLite DB trong `%LOCALAPPDATA%\TrishTEAM\<app-id>\cache.db`.

```
-- trishlibrary/cache.db
CREATE TABLE library_items (
  id            TEXT PRIMARY KEY,     -- Firestore docId
  uid           TEXT NOT NULL,
  type          TEXT,                  -- pdf/docx/link/note
  title         TEXT,
  url_or_path   TEXT,
  tags          TEXT,                  -- JSON array as string
  created_at    INTEGER,               -- Unix ms
  updated_at    INTEGER,
  sync_state    TEXT DEFAULT 'clean',  -- clean/dirty/pending/conflict
  local_version INTEGER DEFAULT 0,     -- bump khi edit offline
  remote_version INTEGER DEFAULT 0     -- Firestore updateTime epoch
);
CREATE INDEX idx_lib_tags   ON library_items(tags);
CREATE INDEX idx_lib_sync   ON library_items(sync_state);

-- trishnote/cache.db  — tương tự với notes
-- trishsearch/cache.db — tương tự với search_index
```

**3 field bổ sung ngoài Firestore** (desktop-only, không upload):

- `sync_state` — clean/dirty/pending/conflict (xem §8).
- `local_version` — monotonically increasing, bump sau mỗi edit offline.
- `remote_version` — Firestore `updateTime` epoch ms của record server.

### 4.3 Mapping rule

- Firestore field snake_case → SQLite column snake_case (nguyên văn).
- Firestore array/map → SQLite TEXT JSON (Python `json.dumps`/`loads`).
- Firestore `Timestamp` → SQLite INTEGER (Unix ms), không dùng SQLite DATETIME (múi giờ nhập nhằng).
- Field nào web dùng mà desktop không đọc vẫn phải được lưu nguyên bằng
  column `extra_json TEXT` (catch-all) — forward-compat khi web push schema
  trước desktop kịp update.

## 5. Schema versioning

### 5.1 Cơ chế

1 schema version cho toàn bộ Firestore (shared), bump khi thêm field hoặc
đổi kiểu. Lưu trong:

- Cloud: `/meta/schema/{ "version": 3 }` (doc duy nhất).
- Desktop: cột trong bảng `_meta` mỗi SQLite DB.
- Web: constant `SCHEMA_VERSION = 3` trong `lib/schema.ts`.

### 5.2 Migration flow bumping v(N) → v(N+1)

Không bao giờ migrate tự động trong production mà không qua 3 bước:

```
Bước 1. Cloud Function migrate batch cho tất cả doc Firestore hiện tại.
        Ghi /meta/schema.version = N+1.
        Deploy lên trishteam-staging → test 24h.

Bước 2. Web PR merge (reading N+1 schema, gracefully degrading cho N doc
        còn sót chưa migrate).
        Deploy lên staging domain test trước khi production.

Bước 3. Desktop release (.tpack) với min_schema_version = N+1. User chạy
        Launcher → update → app restart đọc schema mới.
        App cũ vẫn đọc được dữ liệu N+1 (forward-compat nhờ extra_json
        catch-all), nhưng không được ghi.
```

App desktop cũ khi detect `cloud.schema > local.min_schema` hiện banner:
"Có phiên bản mới. Hãy cập nhật qua Launcher trước khi chỉnh sửa."

### 5.3 Rollback

Nếu phát hiện bug sau bump schema:

1. Cloud Function revert batch (chạy lại với version N). Web tự động fallback.
2. Desktop user không cần hành động — app đọc schema N bình thường.
3. Post-mortem viết vào `docs/SCHEMA-CHANGELOG.md` (tạo khi cần lần đầu).

**Không bao giờ** bump major version 2 lần trong 1 tuần — user khó chịu.

## 6. Auth SSO end-to-end

### 6.1 Mục tiêu

User login 1 lần (web **hoặc** desktop) → dùng được bên kia mà không login lại.

### 6.2 Flow 1: Login trên web → mở desktop

```
1. User browser mở trishteam.com → /login → nhập email/password
2. Firebase Auth trả ID token + refresh token
3. Web session persist trong Firebase SDK (IndexedDB)
4. User click link "Mở trong app desktop" hoặc copy deep link
   trishteam://auth?token=<one-time-code>
5. Desktop protocol handler (xem §7) nhận token
6. trishteam_core.auth.session.redeem_oneshot(token)
   → Cloud Function "exchangeOneshotToken" trả ID + refresh token
7. token_store.save(...) — DPAPI encrypt lưu local
8. session.set_user(...) — app boot state logged-in
```

### 6.3 Flow 2: Login trên desktop → mở web

```
1. User mở app desktop login-required (vd TrishLibrary)
2. LoginDialog → Firebase REST → ID + refresh token
3. token_store.save(...) DPAPI
4. User click nút "Mở trên web" (icon góc phải toolbar)
5. Desktop POST Cloud Function "exchangeForWebToken(id_token)"
   → trả về URL dạng https://trishteam.com/auth/handoff?code=...
6. QDesktopServices.openUrl(...) mở browser default
7. Web page /auth/handoff đọc code → Firebase Auth signInWithCustomToken
8. Redirect user đến route tương ứng (vd /library)
```

### 6.4 Cloud Functions hỗ trợ

2 function callable bắt buộc (stub trong `functions/src/`):

- `exchangeOneshotToken(code)` — web tạo code → desktop redeem (one-time,
  TTL 5 phút).
- `exchangeForWebToken(id_token)` — desktop có id_token → trả custom token
  cho web `signInWithCustomToken`.

Chi tiết implement trong `docs/AUTH.md §5` (TODO khi scaffold Phase 10).

### 6.5 Logout

Logout ở **bất kỳ đâu** phải clear **cả 2 platform**:

- Desktop logout → gọi Firebase `signOut()` + `token_store.delete()` +
  revoke refresh token qua Cloud Function (propagate sang web session qua
  Firebase realtime).
- Web logout → revoke refresh token → desktop session tự detect
  refresh-fail trong 5 phút tới → hiện "Session expired, login lại".

Tolerance: user có thể thấy banner "Session expired" trên desktop lên đến
5 phút sau khi logout ở web — chấp nhận được. Aggressive revocation cần
push notification (defer Phase 11+).

## 7. Deep link protocol

Desktop đăng ký **URL scheme** `trishteam://` để web/email/Slack/... có thể
mở trực tiếp action trong desktop app.

### 7.1 Đăng ký protocol handler (Windows)

Launcher installer (NSIS) ghi registry:

```
HKCR\trishteam                   → "URL:TrishTEAM Protocol"
HKCR\trishteam\URL Protocol      → ""
HKCR\trishteam\shell\open\command
  → "<InstallDir>\TrishTEAM.exe" "handle-url" "%1"
```

### 7.2 Bootstrap xử lý URL

`TrishTEAM.exe handle-url <url>` dispatch:

| URL pattern                                    | Action                                   |
|------------------------------------------------|------------------------------------------|
| `trishteam://auth?token=<oneshot>`             | Redeem token, set session, mở Launcher   |
| `trishteam://library/item/<itemId>`            | Mở TrishLibrary, scroll tới item         |
| `trishteam://note/<noteId>`                    | Mở TrishNote, open editor                |
| `trishteam://install?app=<appId>&version=<v>`  | Launcher → install flow                  |
| `trishteam://admin/users/<uid>`                | Nếu user có role admin, mở TrishAdmin    |

### 7.3 Web → desktop link generator

`lib/deeplink.ts`:

```ts
export function trishlink(
  kind: "auth" | "library" | "note" | "install" | "admin-user",
  params: Record<string, string>,
) {
  const q = new URLSearchParams(params).toString();
  return `trishteam://${kind}?${q}`;
}
```

Mọi link trên web trỏ vào resource có counterpart desktop phải show
button "Mở trong app" → `trishlink(...)`.

### 7.4 Fallback khi desktop chưa install

Browser không mở được `trishteam://` → fallback route web
`/install-launcher?return_to=<encoded url>`. Trang này hướng dẫn user tải
Launcher, sau cài xong button nhấn lại tự động dispatch deep link.

## 8. Offline handling

Desktop phải chạy được **offline hoàn toàn** (trừ lần login đầu). Web dùng
IndexedDB cache nhẹ nhưng require internet cho thao tác mutating.

### 8.1 Sync state machine (desktop)

Mỗi row SQLite có `sync_state` một trong 4 giá trị:

```
clean    — local = remote_version, không cần sync
dirty    — user vừa edit offline, local_version > remote_version
pending  — đang upload lên Firestore (lock để tránh ghi đồng thời)
conflict — remote đổi sau khi local đổi → cần resolve
```

### 8.2 Sync daemon

`trishteam_core.sync.daemon` chạy background:

```
Mỗi 30s (hoặc khi network lên):
  1. Query `SELECT * FROM <table> WHERE sync_state='dirty'`
  2. For each row:
     a. Fetch server doc updateTime
     b. If remote_version == server.updateTime:
           → upload (Firestore set), bump remote_version
           → set sync_state='clean'
     c. Else (server thay đổi giữa chừng):
           → set sync_state='conflict'
  3. Listen Firestore onSnapshot → khi remote thay đổi & local clean:
        → overwrite local, update remote_version
```

### 8.3 Conflict resolution UI

Khi `sync_state='conflict'`:

- Hiện badge 🔀 đỏ trên item/note đó.
- Click → dialog 3 tab: **Local**, **Remote**, **Merge** (diff view).
- User pick 1 trong 3 → resolve → sync_state='pending' → upload → clean.

Auto-resolve được dùng **chỉ khi 2 bên edit cùng 1 field với cùng giá trị**
(idempotent) — silent merge.

### 8.4 Offline write ordering

Desktop ghi offline → bump `local_version` monotonically. Khi sync lên:

- Server dùng Firestore `serverTimestamp()` làm canonical timestamp.
- Nếu conflict, server timestamp thắng ưu tiên cho field
  `updated_at` — nhưng body content để user chọn (§8.3).

Web không có offline write (v1) — mọi action require network. Future v2 có
thể thêm IndexedDB queue nhưng không prioritize.

## 9. Design token pipeline

1 source, 2 platform output. Đã note nhẹ trong `WEBSITE.md §4` và
`PACKAGING.md §6.2`; chi tiết ở đây.

### 9.1 Source of truth

```
shared/trishteam_core/src/trishteam_core/ui/tokens.json
```

Schema tokens.json:

```json
{
  "version": 3,
  "colors": {
    "bg_darkest":   "#0f0e0c",
    "bg_dark":      "#1a1814",
    "fg_primary":   "#f5f2ed",
    "fg_muted":     "#a09890",
    "accent":       "#667EEA",
    "accent_hover": "#7B90EE",
    "border":       "#2a2720",
    "error":        "#e07a7a",
    "success":      "#7ab37a"
  },
  "spacing": { "xs": 4, "sm": 8, "md": 12, "lg": 16, "xl": 24, "xxl": 40 },
  "radius":  { "sm": 4, "md": 8, "lg": 12, "pill": 999 },
  "font": {
    "family_ui":   "Inter, system-ui, sans-serif",
    "family_mono": "JetBrains Mono, monospace",
    "size_body":   14,
    "size_h1":     22,
    "size_h2":     18,
    "size_h3":     15
  }
}
```

### 9.2 Export script

`scripts/export-tokens.py` (chạy trong CI + pre-commit hook):

```
Input:  shared/trishteam_core/src/trishteam_core/ui/tokens.json
Output 1: shared/trishteam_core/src/trishteam_core/ui/tokens.py  (Python dict)
Output 2: website/styles/tokens.css                              (CSS variables)
Output 3: website/tailwind.tokens.json                           (Tailwind theme extend)
```

3 output này đều commit (không gitignore). Pre-commit hook auto regenerate khi
tokens.json đổi → block commit nếu 3 file derivatives không đồng bộ (check
bằng hash).

### 9.3 Khi đổi tokens

1. Edit `tokens.json` → bump `version` nếu đổi tên/cấu trúc (không cần bump
   khi chỉ đổi giá trị màu/spacing).
2. Chạy `python scripts/export-tokens.py`.
3. Commit cả 4 file (`.json` + 3 output).
4. Desktop next build: đọc `tokens.py` → áp QSS.
5. Web next deploy: đọc `tokens.css` + Tailwind rebuild.

### 9.4 App-specific accent

Mỗi app có **1 màu accent riêng** (logo-derived) override token base. Lưu
trong `design/logos/Trish*/accent.txt` (1 dòng hex). Desktop: `AppHeader`
widget đọc file này khi render banner. Web: `lib/app-meta.ts` map
`{appId: accent}`.

## 10. Release cadence

### 10.1 Desktop

- Mỗi app release **độc lập** qua CI tag `<app-id>-v<ver>` (xem
  `PACKAGING.md §6.6`).
- Launcher check registry `apps.json` 1 lần/giờ (hoặc khi user mở tab App
  Store) → offer update.
- User tự quyết update (mặc định **không** auto-install — respect user).

### 10.2 Web

- Vercel continuous deploy từ `main` branch `trishteam-website` repo.
- Mỗi PR merge → production deploy trong 2-3 phút.
- Preview deploy tự động cho mỗi PR (ephemeral URL) để QA.

### 10.3 Version skew tolerance

```
  Web version  \  Desktop version  |  v1.0  |  v1.1  |  v1.2  |  v2.0  |
  -------------------------------------------------------------------  
  v1.0                             |   ✅   |   ✅   |   ⚠️   |   ❌   |
  v1.1                             |   ✅   |   ✅   |   ✅   |   ⚠️   |
  v1.2                             |   ⚠️   |   ✅   |   ✅   |   ⚠️   |
  v2.0                             |   ❌   |   ⚠️   |   ⚠️   |   ✅   |

  ✅ = full parity                  (no banner)
  ⚠️ = degraded (hiện suggest update) (banner nhẹ)
  ❌ = block critical action         (force update)
```

**Rules**:

- Cùng major (v1.x ↔ v1.y): luôn ✅ hoặc ⚠️, không bao giờ ❌.
- Chênh major (v1.x ↔ v2.y): ❌ cho critical mutating action. User vẫn
  read-only được data cũ.
- Min supported version shipped trong `/meta/schema.min_web_version` + `min_desktop_version`.

## 11. Parallel dev workflow

### 11.1 PR checklist — bắt buộc cho feature parity

Trước khi merge **bất kỳ** PR của feature cross-platform, checklist:

- [ ] Feature có trong `WEB-DESKTOP-PARITY.md §3` matrix — nếu chưa, PR này thêm row trước.
- [ ] Firebase Firestore rules PR merged trước (repo `trishteam-firebase/firestore.rules`).
- [ ] Schema version bump (nếu có) — document trong `SCHEMA-CHANGELOG.md`.
- [ ] Desktop PR có link tới Web PR (và ngược lại) trong description.
- [ ] Cả 2 PR đều reference cùng Firestore schema version.
- [ ] Manual smoke test checklist §12 run qua.
- [ ] 1 reviewer approve mỗi side (desktop + web).

### 11.2 Merge order (cứng)

```
T+0  Firebase rules PR merged + deployed to staging
T+1h Desktop PR merged (nhưng chưa release .tpack)
     Web PR merged (nhưng deploy paused)
T+2h Smoke test end-to-end trên staging (cross-platform)
T+3h Web deploy to prod
T+4h Desktop tag + release .tpack
T+5h Launcher registry PR auto-patch + merge
T+D  User next Launcher refresh → app update available
```

Nếu smoke test T+2h fail → revert cả 2 PR, không partial merge.

### 11.3 Hotfix flow

Bug chỉ 1 platform → PR chỉ cần 1 side, nhưng phải comment vào PR gốc của
feature (cross-ref). Bug cross-platform → vẫn theo flow §11.2 (không có
shortcut).

## 12. Testing matrix

Manual smoke test trước mỗi release — chưa auto hoá Phase 11. Checklist
template trong `docs/smoke-test-template.md` (TODO — tạo khi implement Phase 10).

### 12.1 Cross-platform checklist

Mỗi feature parity chạy qua 8 scenario:

1. **Web create → Desktop read**: Tạo item trên web → mở desktop → thấy ngay (≤10s).
2. **Desktop create → Web read**: Ngược lại.
3. **Web edit → Desktop read**: Edit title trên web → desktop auto refresh.
4. **Desktop edit offline → online → Web read**: Tắt wifi, edit, bật wifi, chờ sync → web thấy.
5. **Conflict**: 2 device cùng edit offline → online → conflict UI hiện đúng.
6. **Logout on web**: web signOut → desktop banner hiện trong 5 phút.
7. **Logout on desktop**: desktop signOut → web session drop trên refresh kế tiếp.
8. **Deep link**: click `trishteam://library/item/<id>` trên web → desktop mở đúng item.

### 12.2 Platform-specific checklist

**Desktop only** (không cần web):

- App startup offline (no network) — login cũ valid → phải boot được.
- Uninstall + reinstall — data cloud vẫn restore.

**Web only**:

- SSR cache — không được leak data user A cho user B.
- Service worker offline fallback — hiện "Offline" banner gracefully.

### 12.3 Regression — snapshot test

Mỗi Firestore schema bump, chụp snapshot 1 record sample → commit vào
`tests/fixtures/schema-v<N>.json`. Khi desktop/web đọc fixture này phải
parse thành công → chạy trong CI.

## 13. Failure modes

Danh sách tình huống lạ + platform nào "thắng" (authority):

| Tình huống                                         | Ai thắng      | Lý do                                  |
|----------------------------------------------------|---------------|----------------------------------------|
| Firestore schema vs SQLite cache chênh             | Firestore     | Cloud = canonical                      |
| User edit cùng field 2 device offline              | Latest write  | Server timestamp tiebreaker            |
| Custom claim vs Firestore `users/{uid}.role` chênh | Custom claim  | Rules đọc claim, Firestore copy cache  |
| Registry `apps.json` vs installed manifest chênh   | Manifest local| User đã cài version đó, respect        |
| Design token vs app-specific override              | App override  | App có quyền override accent per-app   |
| Web action vs desktop action cùng lúc              | Firestore serializes | Last writer wins (ms precision)|
| Deep link trishteam:// nhưng app chưa install      | Web fallback  | `/install-launcher?return_to=<url>`    |
| Session revoke từ admin                            | Cloud Function| Force logout mọi device ≤ 5 phút       |

---

## Changelog

| Date       | Author  | Change                                         |
|------------|---------|------------------------------------------------|
| 2026-04-22 | Claude  | Initial spec (task #65) — Phase 11 baseline.   |

---

**Liên quan:**
- [`PACKAGING.md`](PACKAGING.md) §6 — Parallel web + desktop overview
- [`AUTH.md`](AUTH.md) — Auth stack + Firestore schema chi tiết
- [`WEBSITE.md`](WEBSITE.md) — Website sitemap + routes
- [`ROADMAP.md`](ROADMAP.md) — Phase 10 (Auth) + Phase 11 (Website)
