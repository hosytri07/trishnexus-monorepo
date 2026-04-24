# TrishTEAM — Hệ thống Auth & Security

Spec Phase 10. Mục tiêu: 1 tài khoản duy nhất dùng cho cả **website** và
**desktop** (SSO), role-based access, token bảo mật, offline graceful.

> Stack chốt: **Firebase Authentication** + **Firestore** custom claims +
> **DPAPI** cho token storage trên Windows.

---

## 1. Scope

### App cần auth

| App           | Login required | Role cần             |
| ------------- | -------------- | -------------------- |
| TrishDesign   | ✅             | `user`+              |
| TrishLibrary  | ✅             | `user`+              |
| TrishNote     | ✅             | `user`+              |
| TrishSearch   | ✅             | `user`+              |
| TrishAdmin    | ✅             | `admin` hoặc `dev`   |
| TrishFont     | opt-in         | `user`+ (để sync)    |
| TrishLauncher | opt-in         | `user`+ (để sync)    |
| TrishType     | opt-in         | `user`+ (future)     |
| TrishCheck    | ❌             | —                    |
| TrishClean    | ❌             | —                    |
| TrishImage    | opt-in         | `user`+ (để backup)  |

### Non-goals Phase 10

- MFA (2FA) — deferred Phase 11+.
- OAuth providers khác Google (ví dụ GitHub, Apple) — deferred.
- Account deletion self-service — Phase 11 (hiện tại admin xoá manual).

---

## 2. Firebase project layout

1 Firebase project **`trishteam-prod`** (và `trishteam-staging` cho dev):

- **Authentication** — enable providers: Email/Password + Google.
- **Firestore** — databases cho Library / Note / Search / Admin + collection
  `users` quản lý profile + role.
- **Cloud Functions** — callable `setUserRole`, `deleteUserAccount` (chỉ admin
  gọi được).
- **Cloud Storage** — optional, cho TrishImage backup + TrishLibrary file upload.

### Firestore schema

```
/users/{uid}
  email: string
  display_name: string
  created_at: Timestamp
  role: "user" | "admin" | "dev"     // mirror custom claim cho query dễ
  avatar_url: string (optional)
  preferred_apps: ["trishdesign","trishlibrary",...]

/library/{uid}/items/{id}
  type: "pdf" | "docx" | "link" | "note"
  title, url_or_path, tags[], created_at, updated_at

/notes/{uid}/notes/{id}
  title, body (markdown), tags[], due_at, pinned, created_at, updated_at

/search_index/{uid}/documents/{id}
  app_id, doc_id, content (tokenized), updated_at

/auth_events                        // security log
  uid, event: "login"|"login_fail"|"role_change"|"token_refresh"
  ip, user_agent, timestamp

/admin_ops                          // chỉ admin/dev đọc được
  actor_uid, target_uid, op, payload, timestamp
```

### Firestore rules (excerpt)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {

    function isSignedIn() { return request.auth != null; }
    function isOwner(uid) { return request.auth.uid == uid; }
    function hasRole(r) { return request.auth.token.role == r; }
    function isAdmin()  { return hasRole("admin") || hasRole("dev"); }

    match /users/{uid} {
      allow read:  if isOwner(uid) || isAdmin();
      allow write: if isOwner(uid) && !(
                     "role" in request.resource.data.diff(resource.data).affectedKeys()
                   );   // user không self-set role
    }

    match /library/{uid}/{doc=**} {
      allow read, write: if isOwner(uid) || isAdmin();
    }
    match /notes/{uid}/{doc=**} {
      allow read, write: if isOwner(uid) || isAdmin();
    }
    match /search_index/{uid}/{doc=**} {
      allow read, write: if isOwner(uid);  // admin KHÔNG đọc search
    }

    match /auth_events/{id} {
      allow read:  if isAdmin();
      allow write: if false;   // chỉ Cloud Function ghi
    }
    match /admin_ops/{id} {
      allow read:  if isAdmin();
      allow write: if false;
    }
  }
}
```

### Setting custom claims

```javascript
// functions/src/setUserRole.ts
export const setUserRole = onCall({cors: true}, async (req) => {
  const caller = req.auth;
  if (!caller) throw new HttpsError("unauthenticated","login required");
  const callerClaims = (await admin.auth().getUser(caller.uid)).customClaims ?? {};
  if (callerClaims.role !== "dev") throw new HttpsError("permission-denied","dev only");

  const { uid, role } = req.data;
  if (!["user","admin","dev"].includes(role)) throw new HttpsError("invalid-argument","bad role");
  await admin.auth().setCustomUserClaims(uid, { role });
  await admin.firestore().collection("users").doc(uid).set({ role }, {merge:true});
  await admin.firestore().collection("auth_events").add({
    uid, event: "role_change", actor_uid: caller.uid, new_role: role,
    timestamp: FieldValue.serverTimestamp(),
  });
  return { ok: true };
});
```

Chỉ `dev` set được role — tránh tự phong admin.

---

## 3. Shared Auth SDK (trishteam_core.auth)

Module chung trong `shared/trishteam_core/src/trishteam_core/auth/`:

```
auth/
├─ __init__.py           ✅ shipped
├─ firebase_client.py    ✅ shipped  — HTTP wrapper requests thuần
├─ token_store.py        ✅ shipped  — DPAPI → keyring → plaintext fallback
├─ session.py            ✅ shipped  — singleton current user + auto-refresh
├─ role_guard.py         ✅ shipped  — @require_role(...) decorator
├─ offline.py            ✅ shipped  — OfflineChecker + make_qt_detector
└─ login_dialog.py       ✅ shipped  — QDialog email/pwd + worker thread + Vietnamese i18n
```

> Ghi chú refactor Phase 1.1 (2026-04-22): `manager.py` cũ đã xoá.
> API mới tách 3 file với separation of concerns rõ ràng — xem §9.

### `session.py` API

```python
from trishteam_core.auth import session

# Bootstrapping trong main() của app login-required
ok = session.require_login(parent=win)    # mở LoginDialog nếu chưa có token
if not ok:
    sys.exit(0)

# Sau đó dùng
user = session.current_user()             # SessionUser(uid, email, role, ...)
if session.has_role("admin"):
    show_admin_menu()

# Logout
session.logout()
```

`SessionUser` dataclass:
```python
@dataclass
class SessionUser:
    uid: str
    email: str
    display_name: str
    role: str            # "user"|"admin"|"dev"
    id_token: str
    refresh_token: str
    expires_at: datetime
    avatar_url: str = ""
```

### `token_store.py` — Windows DPAPI

```python
# Encrypt token bằng DPAPI — chỉ user hiện tại unlock được
import win32crypt  # pywin32

def save(user: SessionUser) -> Path:
    blob = json.dumps(asdict(user), default=str).encode("utf-8")
    encrypted = win32crypt.CryptProtectData(
        blob, "TrishTEAM-auth", None, None, None, 0
    )
    path = user_data_dir_for("TrishTEAM") / "auth" / "token.bin"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(encrypted)
    return path

def load() -> SessionUser | None:
    path = user_data_dir_for("TrishTEAM") / "auth" / "token.bin"
    if not path.is_file():
        return None
    encrypted = path.read_bytes()
    decrypted, _ = win32crypt.CryptUnprotectData(
        encrypted, None, None, None, 0
    )
    data = json.loads(decrypted.decode("utf-8"))
    return SessionUser(**data)
```

Không dùng plain-text JSON. DPAPI unlock tự động khi user windows login,
không ai ngoài user đó (trên máy đó) decrypt được.

### Token refresh flow

```
┌────────────────────┐    id_token expires in 60 min
│ App startup         │
└─────────┬───────────┘
          │
          ▼
    token_store.load()
          │
     ┌────┴─────┐
     │ has token?│
     └────┬─────┘
          │ yes
          ▼
  exp < now + 10min ?
     │          │
    yes         no
     │          │
     ▼          ▼
  POST /refresh   use as-is
     │
     ▼
  save new token ─────▶ session.set_user(...)
```

Background `QTimer` check mỗi 5 phút, refresh nếu token còn < 10 phút. Fail
→ mark session dirty, hiện banner "Token hết hạn, vui lòng đăng nhập lại".

---

## 4. Login UX

### Desktop LoginDialog

```
┌──────────────────────────────────────────┐
│ [TrishTEAM logo]                         │
│                                          │
│ Đăng nhập TrishTEAM                      │
│                                          │
│  Email     [_________________________]   │
│  Mật khẩu  [_________________________]   │
│                                          │
│  [ ☐ Nhớ tôi ]        [Quên mật khẩu?]   │
│                                          │
│  [ Đăng nhập ]                           │
│                                          │
│  ─── hoặc ───                            │
│                                          │
│  [ G  Tiếp tục với Google ]              │
│                                          │
│  Chưa có tài khoản? [Đăng ký]            │
└──────────────────────────────────────────┘
```

- Theme warm-dark match toàn hệ sinh thái.
- Email/password: gọi Firebase REST API
  `accounts:signInWithPassword` → nhận `idToken` + `refreshToken`.
- Google: mở browser → OAuth redirect về `http://localhost:<random>/cb` →
  exchange authorization code → Firebase signIn with credential.

### Website

Next.js app dùng `firebase/auth` JavaScript SDK:
- `/login` page với cùng UX email/password + Google.
- Session cookie set qua `firebase-admin.sessionCookies.create()` để SSR route
  Firestore authentication.

Vì dùng **cùng 1 Firebase project**, user đăng nhập web xong → desktop login
cùng email → nhận cùng uid → thấy cùng data.

---

## 5. Role guard

### Decorator

```python
from trishteam_core.auth import require_role

class AdminView(QWidget):
    @require_role("admin", "dev")      # else raise PermissionError + show dialog
    def export_all_users(self):
        ...
```

### TrishAdmin bootstrap

```python
# apps/trishadmin/src/trishadmin/app.py (future)
def main() -> int:
    app = QApplication(sys.argv)
    session.init(firebase_config=FIREBASE_CONFIG)

    if not session.require_login(roles=("admin","dev")):
        # Người dùng không có role → show error dialog và exit
        QMessageBox.critical(None, "Access denied",
            "Bạn cần role Admin hoặc Dev để mở TrishAdmin.")
        sys.exit(1)

    # ...tiếp tục bình thường
```

---

## 6. Offline mode

| App role           | Offline behaviour                                              |
| ------------------ | -------------------------------------------------------------- |
| Public (Font, …)   | Chạy bình thường, sync khi online lại                         |
| Login-required     | Token còn hạn → chạy, sync queue; hết hạn → block + banner    |
| TrishAdmin         | Read-only view cache local; write queued, hiện banner offline |

`OfflineDetector` QObject poll `trishteam.com/ping` mỗi 30s (nếu fail 3 lần
→ `offline_changed(True)` signal).

---

## 7. Security checklist (exit criteria Phase 10)

- [ ] Firebase project `trishteam-prod` + `trishteam-staging` tạo.
- [ ] Email/Password + Google provider enable.
- [ ] Firestore rules deploy + test với emulator (`firebase emulators:exec`).
- [x] Cloud Function `setUserRole` scaffold + lint + 30 unit test pass (deploy pending project creation).
- [x] Cloud Function `exchangeForWebToken` + `exchangeOneshotToken` scaffold cho SSO oneshot handoff.
- [x] `trishteam_core.auth` module implement + unit test mock Firebase REST (Phase 1.1, 63 test).
- [x] Token lưu DPAPI (Windows), fallback `keyring` (macOS/Linux) + plaintext (CI headless) (Phase 1.2).
- [x] LoginDialog với tokens v2 + Lucide icons + i18n tiếng Việt (Phase 1.5). Google OAuth loopback deferred → Phase 2.
- [x] Token refresh với `refresh_if_needed(buffer_sec)` — `is_stale` flag khi network flap (Phase 1.1).
- [x] `@require_role` decorator + `session.current_user()` / `has_role()` API (Phase 1.3).
- [x] Offline detector `OfflineChecker` pure-Python + `make_qt_detector` factory + banner (Phase 1.4).
- [x] SSO deep link `trishteam://` handler + oneshot exchange + Windows registry helpers (Phase 1.6, 37 test).
- [ ] 4 app login-required wire xong: Design / Library / Note / Search.
- [ ] TrishAdmin bootstrap với role gate + unit test unauthorized → exit 1.
- [ ] Website Next.js login flow share session với desktop (cùng uid).
- [ ] Audit log `auth_events` ghi đủ login / login_fail / role_change /
      token_refresh.
- [ ] Security review: không có `console.log(token)`, không commit
      serviceAccountKey.json, rate-limit login 5/phút/IP qua Cloud Function.
- [ ] Docs user-facing: `docs/USER-LOGIN.md` hướng dẫn đăng ký + quên mật khẩu.

---

## 8. Khoản rủi ro

1. **Firebase vendor lock-in** — nếu muốn chuyển → Supabase/Auth0 cần
   migration layer. Giảm rủi ro: SDK wrapper thin (firebase_client.py),
   không leak Firebase types ra ngoài.
2. **Google OAuth loopback trên Windows** — port conflict hiếm nhưng có;
   dùng `socket.bind(("",0))` để OS cấp port random.
3. **DPAPI only unlock trên cùng máy + user** — chuyển máy thì phải login
   lại. Đây là design choice có chủ ý.
4. **Offline token forgery** — không ngăn được hoàn toàn vì token sẵn ở
   local. Giảm rủi ro: TTL 60 phút + server-side claim re-check mỗi request.

---

## 9. Implementation status (Phase 1 refactor — 2026-04-22)

Phần này ghi lại **API thực tế** đã code trong `trishteam_core.auth`, để code + spec không bị drift. Nếu mâu thuẫn với §3/§5/§6 ở trên (là spec dự kiến), **phần này là nguồn sự thật**.

### 9.1 Module hiện có

| File | Status | Purpose |
| --- | --- | --- |
| `firebase_client.py` | ✅ | `FirebaseClient` class + `AuthError(code, message)`. 5 method: `sign_in_with_password`, `sign_up_with_password`, `send_password_reset_email`, `refresh_id_token`, `lookup_account`. Không lưu state. |
| `token_store.py` | ✅ | Module-level `save(dict)` / `load()` / `clear()` / `backend_name()`. Tự chọn DPAPI → keyring → plaintext fallback theo platform + dependency. |
| `session.py` | ✅ | `SessionUser` dataclass + singleton state. Public: `init`, `login_with_password`, `sign_up_with_password`, `send_password_reset_email`, `logout`, `refresh_if_needed`, `current_user`, `is_logged_in`, `has_role`, `load_from_disk`. |
| `role_guard.py` | ✅ | `@require_role(*roles, message=None, show_dialog=True)` decorator. Dialog lazy-import PyQt6 — headless CI vẫn work. |
| `offline.py` | ✅ | `ping(url)` one-shot + `OfflineChecker(on_change=...)` pure-Python thread + `make_qt_detector(parent=...)` factory cho QObject với signal `online_changed(bool)`. |
| `login_dialog.py` | ✅ | `LoginDialog(QDialog)` + `LoginWorker(QThread)` + `show_login_dialog(parent)`. Tokens v2 trishwarm QSS inline, Lucide icons (mail/lock/eye/eye-off/log-in), Vietnamese i18n error map, toggle login↔signup, forgot-password flow. Import lazy PyQt6 → module-level import không crash trên CI. |
| `sso_handler.py` | ✅ | Deep link parser + oneshot exchange + Windows registry helpers. Types: `DeepLinkAction` / `CloudConfig` / `WebHandoff` / `SSOError`. Public: `parse_deep_link_url(url)`, `exchange_oneshot_token(oneshot, cfg)`, `redeem_oneshot_to_session(oneshot, cfg)`, `mint_web_handoff(cfg)`, `register_windows_protocol_handler(exe_path)`, `unregister_windows_protocol_handler()`, `is_windows_protocol_registered()`. Không import PyQt6 — bootstrap-safe. |

### 9.2 Khác biệt so với §3 spec gốc

1. **`token_store` làm việc với `dict`, không phải `SessionUser`** — tránh circular import với `session.py`. Caller (`session.py`) serialize/deserialize.
2. **Fallback 3 cấp thay vì 2** — ngoài DPAPI (Windows) + keyring (non-Win), có thêm plaintext fallback cho headless CI (log warning rõ ràng). §3 chỉ spec 2 cấp.
3. **`SessionUser.is_stale: bool`** — flag runtime mới, set khi refresh fail vì network. UI đọc flag này để hiện banner "Token stale — kết nối lại để đồng bộ".
4. **`OfflineChecker` pure Python + `make_qt_detector` factory** — §6 chỉ có QObject. Tách 2 layer cho phép test headless + dùng từ background worker không cần Qt main thread.
5. **Custom attributes parsing** — `session.login_with_password` tự gọi `accounts:lookup` sau signIn để lấy `customAttributes` (JSON string) → extract `role`. Lookup fail (network flap) → giữ role default `"user"` + log warning, không block login.

### 9.3 Test coverage

`shared/trishteam_core/tests/` — **109 unit test** chạy headless qua `pytest` (107 pass + 2 skip: 1 Windows-registry, 1 PyQt6 offscreen).

| File | Số test | Cover |
| --- | --- | --- |
| `test_firebase_client.py` | 8 | success/error response, form vs json body, network exception, non-JSON error |
| `test_token_store.py` | 9 | roundtrip tất cả backend, fallback order, corrupt blob cleanup, backend_name |
| `test_session.py` | 21 | login flow, role enrichment, persist, refresh (3 case: fresh / expiring / network fail / auth error), logout, load_from_disk |
| `test_role_guard.py` | 12 | block/pass với role khác nhau, custom message, method on class, headless Qt, introspection |
| `test_offline.py` | 13 | ping edge cases, edge-trigger emit logic, reset counter, no-duplicate, callback exception isolation |
| `test_login_dialog.py` | 9 | import clean, `_friendly_error` i18n + firebase colon suffix, AST check worker chỉ gọi session API thật, icon names có trong lucide pool, __all__ stable, raise-without-Qt |
| `test_sso_handler.py` | 37 | `parse_deep_link_url` (12 case: all 5 kinds + invalid-scheme/kind/empty/url-encoded/case-insensitive), `CloudConfig.function_url` (production + emulator + trailing-slash), `exchange_oneshot_token` (7), `redeem_oneshot_to_session` (5: happy-path persists, lookup-fail graceful, signIn-fail → SSOError, missing api_key → RuntimeError, missing customToken → invalid_response), `mint_web_handoff` (4), `_build_session_from_signin` (3), Windows registry (1 skip + 2 non-Windows guard). |

Chạy:
```bash
cd shared/trishteam_core && python -m pytest tests/ -v
```

Fixture `conftest.py` auto-isolate user data dir (`tmp_path`) + reset singleton giữa test → không rò trạng thái, không chạm token thật trên máy dev.

### 9.5 Cloud Functions (Phase 1.7 — 2026-04-23)

Scaffold ở monorepo root `functions/` (ngang hàng `apps/`, `website/`).

| File | Status | Purpose |
| --- | --- | --- |
| `functions/src/setUserRole.ts` | ✅ | onCall, callerRole="dev" required. Validate input, `setCustomUserClaims`, merge `users/{uid}.role`, ghi `auth_events`. Region `asia-southeast1`. |
| `functions/src/exchangeForWebToken.ts` | ✅ | onCall, **MINT** oneshot. Input `{target:"web"\|"desktop"}`. Tạo doc `oneshot_tokens/{id}` TTL 2 phút, trả về `{oneshot, url, expiresAtMs}`. URL scheme `https://trishteam.com/sso?oneshot=...` hoặc `trishteam://sso?oneshot=...`. |
| `functions/src/exchangeOneshotToken.ts` | ✅ | onCall **unauthenticated**, **REDEEM**. Input `{oneshot, platform}`. Firestore transaction đọc + validate + mark used atomic, sau đó `admin.auth().createCustomToken(uid, {ssoOneshot:true})`. Client dùng `signInWithCustomToken`. |
| `functions/src/lib/authUtil.ts` | ✅ | Pure helpers: `generateOneshotId` (crypto randomBytes 32→base64url), `validateOneshotRecord`, `isValidRole`, `isValidUid`. |
| `functions/src/lib/errors.ts` | ✅ | HttpsError wrappers + `withInternalGuard` (HttpsError pass-through, unknown → "internal" + log). Message tiếng Việt. |

Test coverage: `src/lib/__tests__/` — **30 unit test** chạy qua `npm test` (ts-jest, không cần emulator):

| File | Số test | Cover |
| --- | --- | --- |
| `authUtil.test.ts` | 18 | role/uid validation, oneshot ID entropy + uniqueness, expiry math, record validation (ok/used/expired/malformed/bad platform) |
| `errors.test.ts` | 12 | `requireAuth` auth/no-auth/empty-uid, `badArg` message format, permission/not-found/precondition codes, `withInternalGuard` pass-through vs unknown-error conversion |

```bash
cd functions
npm install
npm run build      # tsc strict → lib/
npm run lint       # eslint 0 warning
npm test           # 30/30 pass
npm run serve      # emulator: functions + firestore + auth
```

Root-level config:
- `firebase.json` — functions source `functions/`, codebase `default`, runtime `nodejs20`, predeploy chạy `npm run lint` + `build`. Emulator ports: auth 9099, functions 5001, firestore 8080, UI 4000.
- `.firebaserc` — 3 alias: `default=trishteam-dev`, `staging=trishteam-staging`, `production=trishteam-prod`.

Oneshot flow ASCII diagram + security notes: xem `functions/README.md`.

### 9.6 SSO deep link handler (Phase 1.6 — 2026-04-23)

Wire desktop-side của SSO flow. Caller: `apps/trishlauncher/src/trishlauncher/bootstrap.py` command `handle-url`.

**URL schemes support** (§7.2 `WEB-DESKTOP-PARITY.md`):

| Kind | Trong Phase 1.6 | Thực hiện |
| --- | --- | --- |
| `trishteam://auth?token=<oneshot>` | ✅ | `_handle_auth_deeplink()` gọi `redeem_oneshot_to_session()` → Cloud Function `exchangeOneshotToken` → Firebase `signInWithCustomToken` → persist qua `token_store` → set `session._state.user`. Mở Launcher sau khi redeem. |
| `trishteam://library/item/<id>` | 🟡 | Parser OK, dispatcher forward sang Launcher (full jump-to-item là Phase 2). |
| `trishteam://note/<id>` | 🟡 | Parser OK, dispatch placeholder. |
| `trishteam://install?app=<id>&version=<v>` | 🟡 | Parser OK, dispatch placeholder. |
| `trishteam://admin/users/<uid>` | 🟡 | Parser OK, role check + mở TrishAdmin là Phase 2. |

**Ngược chiều desktop → web** (§6.3): `sso_handler.mint_web_handoff(cloud_config, target_platform="web", website_origin="https://trishteam.com")` → gọi `exchangeForWebToken` với `Authorization: Bearer <idToken>` → trả `WebHandoff(oneshot, url, expires_at_ms)` → caller desktop mở `url` bằng `QDesktopServices.openUrl(...)`.

**Windows protocol registration**: `register_windows_protocol_handler(exe_path, scheme="trishteam", scope="user")` ghi 4 key vào `HKCU\Software\Classes\trishteam` (hoặc `HKCR\trishteam` nếu `scope="machine"`): root `URL:<friendly_name>` + `URL Protocol`, `DefaultIcon`, `shell\open\command` = `"<exe>" handle-url "%1"`. Default scope `user` để installer MSI per-user không cần UAC. `unregister_windows_protocol_handler()` xoá sạch khi uninstall. `is_windows_protocol_registered()` trả bool để Settings UI hiện trạng thái.

**Bootstrap command `handle-url`** (`trishlauncher/bootstrap.py`):

```
TrishTEAM.exe handle-url "trishteam://auth?token=<oneshot>"
```

Được gọi bởi Windows shell khi user click link `trishteam://...`. Flow:
1. `parse_deep_link_url(url)` → `DeepLinkAction` hoặc raise `SSOError("invalid_scheme" | "invalid_kind")` → exit 5.
2. Dispatch theo `action.kind`. `auth`: gọi `_handle_auth_deeplink` → redeem oneshot. Các kind khác: fallback mở Launcher (Phase 2 sẽ implement full dispatch).
3. Nếu redeem fail (expired / used / wrong-platform), in error tiếng Việt + exit code 1 hoặc fallback Launcher để user login manual.

**Config**: `_load_cloud_config()` đọc env vars (production sẽ đọc từ `<install_root>/config/firebase.json`):
- `TRISHTEAM_FIREBASE_PROJECT_ID` (bắt buộc)
- `TRISHTEAM_FIREBASE_API_KEY` (bắt buộc)
- `TRISHTEAM_FIREBASE_REGION` (default `asia-southeast1`)
- `TRISHTEAM_FUNCTIONS_EMULATOR` (dev override, vd `http://localhost:5001`)

**Security**:
- Parse validate kind ⊆ `VALID_KINDS` → URL giả mạo bị reject trước khi chạm network.
- Oneshot length check 16–128 → reject obvious junk trước khi gọi Cloud Function (tiết kiệm quota + giảm attack surface).
- `redeem_oneshot_to_session` persist luôn qua `token_store.save` + set singleton trong cùng lock → không có window mà session tồn tại nhưng chưa persist.
- `platform="desktop"` cố định khi redeem từ desktop → oneshot mint cho `web` không dùng được từ desktop và ngược lại.

### 9.4 API quick reference (shipped)

```python
from trishteam_core.auth import (
    session, token_store, offline, sso_handler,   # submodules
    FirebaseClient, AuthError,                    # low-level
    SessionUser, SSOError,                        # types
    DeepLinkAction, CloudConfig, WebHandoff,      # SSO types
    require_role,                                 # decorators
    OfflineChecker, ping,                         # offline helpers
    parse_deep_link_url,                          # SSO helpers
)

# Bootstrap 1 lần
session.init(api_key="AIza...")

# Login
user = session.login_with_password("u@x.com", "pw")
if session.has_role("admin", "dev"):
    show_admin_menu()

# Refresh cycle — gọi từ QTimer mỗi 5 phút
session.refresh_if_needed(buffer_sec=600)
if session.current_user() and session.current_user().is_stale:
    show_stale_token_banner()

# Decorator
@require_role("admin")
def export_users(self): ...

# Offline
checker = OfflineChecker(on_change=lambda online: banner.set_visible(not online))
checker.start()

# SSO — web → desktop
from trishteam_core.auth import sso_handler
cfg = sso_handler.CloudConfig(
    project_id="trishteam-dev",
    region="asia-southeast1",
    api_key="AIza...",
)
# Windows shell gọi `TrishTEAM.exe handle-url "trishteam://auth?token=..."`
action = sso_handler.parse_deep_link_url(url)  # DeepLinkAction(kind="auth", ...)
if action.kind == "auth":
    user = sso_handler.redeem_oneshot_to_session(action.params["token"], cfg)
    # user đã login, token đã persist, session._state.user đã set

# SSO — desktop → web (caller phải đã login)
handoff = sso_handler.mint_web_handoff(cfg, website_origin="https://trishteam.com")
# QDesktopServices.openUrl(QUrl(handoff.url))
```

---

## Changelog

- **2026-04-23 v0.5** — Phase 1.6 ship: `sso_handler.py` (Phase 1.6, task #78) — deep link parser + oneshot exchange + Windows registry helpers. `bootstrap.py` thêm command `handle-url` để Windows protocol handler dispatch. `firebase_client.sign_in_with_custom_token()` method mới cho redeem flow. Test suite nâng lên 109 test (107 pass + 2 skip), trong đó `test_sso_handler.py` 37 case cover parse + exchange + redeem + mint handoff + registry guards. `__init__.py` export thêm `sso_handler` module + types (`DeepLinkAction`, `CloudConfig`, `WebHandoff`, `SSOError`) + `parse_deep_link_url`. Bổ sung `docs/DESIGN.md` (9-section Claude-Design brief) + `.claude/skills/trishteam-phase-ship/SKILL.md` (phase-ship workflow skill, pattern từ `obra/superpowers` + `alchaincyf/huashu-skills`).
- **2026-04-23 v0.4** — Phase 1.7 ship: Cloud Functions scaffold `functions/` (Firebase Functions V2 TypeScript, Node 20, region `asia-southeast1`). 3 callable: `setUserRole`, `exchangeForWebToken`, `exchangeOneshotToken`. Firestore TX để oneshot redeem atomic + replay-safe. 30 unit test ts-jest pass, eslint 0 warning, tsc strict clean. Root `firebase.json` + `.firebaserc` 3-project config.
- **2026-04-23 v0.3** — Phase 1.5 ship: `login_dialog.py` với QDialog + QThread worker + Lucide icons + Vietnamese i18n. Test suite nâng lên 72 test (71 pass, 1 skip vì PyQt6 cần display).
- **2026-04-22 v0.2** — Phase 1.1–1.4 refactor: `firebase_client.py`, `token_store.py`, `session.py`, `role_guard.py`, `offline.py` ship + 63 test pass. Xoá `manager.py` cũ. Thêm §9 Implementation status.
- **2026-04-22 v0.1** — spec ban đầu, Phase 10 TrishTEAM.
