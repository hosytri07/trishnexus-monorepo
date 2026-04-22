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
├─ __init__.py
├─ firebase_client.py    # thin wrapper pyrebase4 / requests
├─ token_store.py        # DPAPI encrypt + save/load
├─ session.py            # singleton current user + role
├─ login_dialog.py       # QDialog email+password + Google button
├─ role_guard.py         # @require_role(...) decorator
└─ offline.py            # detect offline + graceful degrade
```

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
- [ ] Cloud Function `setUserRole` deploy, test với user dev account.
- [ ] `trishteam_core.auth` module implement + unit test mock Firebase REST.
- [ ] Token lưu DPAPI (Windows), fallback `keyring` (macOS/Linux future).
- [ ] LoginDialog + Google OAuth loopback flow.
- [ ] Token refresh timer background — test với token TTL ép ngắn.
- [ ] `@require_role` decorator + `session.current_user()` API.
- [ ] Offline detector + banner "Bạn đang offline".
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

## Changelog

- **2026-04-22 v0.1** — spec ban đầu, Phase 10 TrishTEAM.
