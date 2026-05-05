# 🔐 KEY LICENSE + CONCURRENT CONTROL — Architecture Plan v2

> **Phase 36-38** · Update 2026-05-04 với confirm của Trí
>
> Mục tiêu:
> 1. Per-app key activation (Finance/ISO/Office mỗi app key riêng)
> 2. 2 loại key: account-bound (apps có login) + standalone (apps không login)
> 3. Admin flex: per-key expiry + per-key max_concurrent
> 4. New login alert máy cũ + auto logout

---

## 1. CONFIRM CỦA TRÍ (2026-05-04)

| Câu hỏi | Trả lời |
|---|---|
| `max_concurrent` mặc định | **1** (admin override per-key được, linh hoạt 1-99) |
| Kick mode | **B — Cảnh báo máy cũ + auto logout** (toast 5s trước khi logout) |
| Key expiry mặc định | **365 ngày kể từ activate** (admin override per-key, có thể vô hạn) |
| Permission strict | **B — Mỗi app key riêng** (Finance / ISO / Office / Library / Drive / Design key bán riêng); admin có thể tạo "all-apps" key |
| Migration keys cũ | **B — User nhập lại key cho từng app**; admin cấp key mới qua TrishAdmin |
| Admin xóa key đã used | **YES** — KeysPanel có nút Delete (audit log) |
| Pricing | **N/A** — Keys do admin cấp nội bộ, KHÔNG bán. Bỏ field `buyer_email` |

---

## 2. CURRENT STATUS (đã xác minh code)

### ✅ ĐÃ CÓ
- 4 user roles: `guest` / `trial` / `user` / `admin`
- Key format: `XXXX-XXXX-XXXX-XXXX` (16 chars alphanumeric, no prefix) — **đã match yêu cầu**
- `ActivationKey` doc trong Firestore với `code`, `status`, `expires_at`
- Validate: uppercase + strip dash + Firestore query
- Website `/profile` activate UI
- TrishAdmin `KeysPanel` (list/filter/revoke)
- 2 apps no-login: TrishLauncher, TrishShortcut
- 2 apps login + key: TrishAdmin, TrishLibrary

### ❌ CHƯA CÓ
- Per-app key (hiện chỉ có 1 loại key chung set role=user)
- Standalone key cho apps không login
- IP / device fingerprint
- Active session tracking
- Per-key max_concurrent + expiry config UI
- New login alert máy cũ
- TrishFinance/ISO/Office key gate

---

## 3. SCHEMA MỚI

### 3.1 — Bảng phân loại keys (2 loại)

| Type | Dùng cho | Bound to | Format |
|---|---|---|---|
| **Account Key** | Apps có login (Library/Drive/Design/Finance/ISO/Office...) | `user.uid` (sau activate) | `XXXX-XXXX-XXXX-XXXX` |
| **Standalone Key** | Apps no-login (Shortcut/Check/Clean/Font...) | `device.machine_id` (sau activate) | `XXXX-XXXX-XXXX-XXXX` |

### 3.2 — Firestore: `keys/{keyId}`

```ts
interface ActivationKey {
  // Identity
  id: string;
  code: string;                    // "XXXX-XXXX-XXXX-XXXX" (16 chars no dash internally)

  // 🆕 Type + Scope
  type: 'account' | 'standalone';  // account-bound vs device-bound
  app_id: string;                  // 🆕 'trishfinance' | 'trishiso' | 'trishoffice' | 'trishlibrary' | ...
                                   //     'all' = unlock toàn bộ apps trả phí (key đặc biệt)

  // Status
  status: 'active' | 'used' | 'revoked';
  created_at: number;
  created_by_uid: string;

  // 🆕 Activation
  activated_at?: number;
  bound_uid?: string;              // type=account → user uid
  bound_machine_id?: string;       // type=standalone → device hash

  // 🆕 Admin-controlled flexibility
  expires_at: number;              // 0 = vô thời hạn, otherwise unix ms (default = activated_at + 365d)
  max_concurrent: number;          // số session đồng thời (default 1, admin override 1-99)
  notes?: string;                  // admin ghi chú nội bộ (vd "Cấp cho tester X 2026-05")
  recipient?: string;              // optional — tên người nhận key (vd "Anh Nam - Cty XYZ")
}

// Keys do admin cấp nội bộ, KHÔNG bán. Bỏ `buyer_email` / pricing.
```

### 3.3 — Firestore: `users/{uid}` (mở rộng)

```ts
interface TrishUser {
  // hiện tại
  uid: string;
  email: string;
  role: 'guest' | 'trial' | 'user' | 'admin';

  // 🆕 Per-app key activation map
  app_keys?: {
    trishlibrary?: { key_id: string; activated_at: number; expires_at: number };
    trishdrive?: { key_id: string; activated_at: number; expires_at: number };
    trishdesign?: { key_id: string; activated_at: number; expires_at: number };
    trishfinance?: { key_id: string; activated_at: number; expires_at: number };
    trishiso?: { key_id: string; activated_at: number; expires_at: number };
    trishoffice?: { key_id: string; activated_at: number; expires_at: number };
    // ...
  };
}
```

→ User có thể có Library Key + Finance Key nhưng KHÔNG có ISO Key. Mỗi app check riêng.

### 3.4 — Firestore: `device_activations/{machine_id}` (mới — cho standalone keys)

Dành cho apps không login (TrishShortcut, TrishCheck, TrishClean, TrishFont):

```ts
interface DeviceActivation {
  machine_id: string;              // hash(hostname + MAC + WindowsGUID)
  app_id: string;                  // 'trishshortcut' | 'trishcheck' | ...
  key_id: string;                  // reference key
  activated_at: number;
  expires_at: number;              // copy từ key tại thời điểm activate

  // Device info (audit)
  hostname?: string;
  os?: string;
  ip_first_seen?: string;
}
```

→ Composite key: `{machine_id}_{app_id}` (1 máy có thể activate nhiều app khác nhau).

### 3.5 — Firestore subcollection: `keys/{keyId}/sessions/{sessionId}` (active sessions per key)

```ts
interface KeySession {
  session_id: string;              // UUID
  key_id: string;
  app_id: string;
  machine_id: string;
  ip_address: string;
  ip_country?: string;
  uid?: string;                    // nếu account key
  user_agent?: string;
  started_at: number;
  last_heartbeat: number;          // update mỗi 5min
  expires_at: number;              // last_heartbeat + 15min
}
```

→ Concurrent control: query `keys/{keyId}/sessions where expires_at > now()` count vs `key.max_concurrent`.

### 3.6 — Firestore: `audit_logs/{logId}`

```ts
interface AuditLog {
  type:
    | 'key_created' | 'key_revoked' | 'key_activated'
    | 'key_used'   | 'key_expired'
    | 'session_start' | 'session_kicked' | 'session_blocked'
    | 'permission_change' | 'role_change';
  key_id?: string;
  uid?: string;
  machine_id?: string;
  ip?: string;
  app_id?: string;
  actor_uid?: string;              // ai thực hiện (admin force kick)
  details: Record<string, any>;
  timestamp: number;
}
```

---

## 4. LOGIN + ACTIVATION FLOW

### 4.1 — Apps CÓ LOGIN (Library/Drive/Design/Finance/ISO/Office)

```
Mở app → Firebase login → success
       ↓
   user.app_keys[appId] tồn tại + chưa expire?
       ↓ NO              ↓ YES
       ↓                 ↓
   ┌──────────┐    ┌────────────────────────┐
   │ Hiện UI  │    │ registerKeySession()   │
   │ "Nhập    │    │ - Check active count   │
   │ key cho  │    │   < key.max_concurrent │
   │ {App}"   │    │ - Tạo session          │
   └──────────┘    │ - Heartbeat loop 5min  │
       ↓           └────────────────────────┘
   ┌──────────────────────────┐
   │ User nhập key →          │
   │ Validate:                │
   │  - status === 'active'   │
   │  - app_id === current    │
   │  - expires_at > now()    │
   │  - bound_uid empty hoặc  │
   │    === user.uid          │
   ├──────────────────────────┤
   │ Activate:                │
   │  - bound_uid = user.uid  │
   │  - activated_at = now()  │
   │  - status = 'used'       │
   │  - user.app_keys[appId]  │
   │    = {key_id,...}        │
   │  - audit: key_activated  │
   └──────────────────────────┘
```

### 4.2 — Apps KHÔNG LOGIN (Shortcut/Check/Clean/Font/Launcher)

```
Mở app lần đầu → check device_activations/{machine_id}_{appId}
       ↓ KHÔNG có      ↓ Có + expires_at > now()
       ↓               ↓
   ┌──────────┐    ┌────────────────────────┐
   │ UI nhập  │    │ Tự động OK,            │
   │ standalone│    │ registerKeySession    │
   │ key      │    └────────────────────────┘
   └──────────┘
       ↓
   ┌─────────────────────────────────┐
   │ Validate key:                   │
   │  - type === 'standalone'        │
   │  - app_id matches               │
   │  - status === 'active'          │
   │  - bound_machine_id empty hoặc  │
   │    === current machine_id       │
   ├─────────────────────────────────┤
   │ Activate:                       │
   │  - bound_machine_id = current   │
   │  - status = 'used'              │
   │  - device_activations doc tạo   │
   └─────────────────────────────────┘
```

### 4.3 — New Login Alert + Auto Logout (Câu 2 = B)

```
Khi user/device đăng nhập máy MỚI:
  1. registerKeySession() detect đã có session active TRÊN MÁY KHÁC
  2. Nếu < max_concurrent: tạo session mới song song (cho phép multi)
  3. Nếu = max_concurrent: cần kick session cũ:
       a. Push notification tới session cũ qua Firestore listener
       b. Session cũ nhận event → show toast 5s:
          "⚠️ Tài khoản vừa đăng nhập trên máy khác.
           Phiên này sẽ tự động đăng xuất sau 5 giây."
       c. Sau 5s, session cũ:
          - Cleanup local data
          - Firebase signOut() / clear key
          - Audit: session_kicked
       d. Session mới được tạo
       e. User máy mới thấy toast: "Phiên cũ đã bị thay thế."
```

→ **Realtime sync** qua Firestore `onSnapshot` listener trên `keys/{keyId}/sessions`. App detect mất session → trigger logout flow.

---

## 5. APPS APPLY MATRIX

| App | Login? | Key required? | Key type | App ID |
|---|---|---|---|---|
| **TrishLauncher** | ❌ | ❌ | — | — |
| **TrishShortcut** | ❌ | ✅ | Standalone | `trishshortcut` |
| **TrishCheck** | ❌ | ✅ | Standalone | `trishcheck` |
| **TrishClean** | ❌ | ✅ | Standalone | `trishclean` |
| **TrishFont** | ❌ | ✅ | Standalone | `trishfont` |
| **TrishLibrary** | ✅ | ✅ | Account | `trishlibrary` |
| **TrishDrive** | ✅ | ✅ | Account | `trishdrive` |
| **TrishDesign** | ✅ | ✅ | Account | `trishdesign` |
| **TrishFinance** | ✅ | ✅ | Account | `trishfinance` |
| **TrishISO** | ✅ | ✅ | Account | `trishiso` |
| **TrishOffice** (future) | ✅ | ✅ | Account | `trishoffice` |
| **TrishAdmin** | ✅ | — | Role check | role=admin |

**Special:** Admin có thể tạo **"All-Apps Key"** với `app_id = 'all'` → user/device activate 1 lần dùng được tất cả apps trong ecosystem (giá cao hơn, bán cho công ty).

---

## 6. UI ADMIN FLEXIBILITY (Câu 1 + 3)

### 6.1 — TrishAdmin → KeysPanel mở rộng

```
┌─ Tạo Keys mới ─────────────────────────────────────────────┐
│ Số lượng:     [5]  keys                                     │
│ App:          [▾ trishfinance]  hoặc [▾ All apps]          │
│ Type:         (•) Account  ( ) Standalone                   │
│ Hết hạn:      [▾ 365 ngày] [Custom: ___ ngày] [Vô hạn]    │
│ Max IP/máy:   [1] đồng thời  (1-99)                         │
│ Recipient:    [Optional, vd "Cấp cho Anh Nam - Cty XYZ"]    │
│ Notes:        [Optional, ghi chú admin nội bộ]              │
│                                                              │
│                          [Tạo & xuất CSV]                    │
└─────────────────────────────────────────────────────────────┘

┌─ Danh sách keys ───────────────────────────────────────────────┐
│ Code              | App     | Type   | Status | Expires  | Max │
│ ABCD-1234-EFGH-5678| Finance| Acct   | Used   | 2027-05  | 1   │
│ XYZA-9876-MNOP-1357| ISO    | Acct   | Active | None     | 5   │
│ QWER-1111-ASDF-2222| All    | Acct   | Used   | 2026-12  | 3   │
│ ...                                                              │
│ [Search] [Filter app/status/type]                              │
│ [Revoke] [Extend expiry] [Delete] [Reset binding] [Audit log] │
└────────────────────────────────────────────────────────────────┘
```

**Admin actions per key (NEW):**
- **Revoke** — đổi `status='revoked'`, session sẽ tự kick lần heartbeat tiếp theo
- **Extend expiry** — nâng `expires_at`, app tự reload
- **Delete** — xóa hẳn key khỏi DB (chỉ dùng cho keys đã used + cần dọn dẹp), audit log lưu lại snapshot
- **Reset binding** — xóa `bound_uid` / `bound_machine_id` khi user reset máy / mất key, key về `status='active'` để cấp lại

### 6.2 — TrishAdmin → ActiveSessionsPanel (mới)

```
┌─ Active sessions ──────────────────────────────────────────────┐
│ Filter: [App ▾] [User/Device ▾] [Search]                      │
├────────────────────────────────────────────────────────────────┤
│ Key            | App     | User/Machine    | IP        | Last  │
│ ABCD-1234-...  | Finance | tri@x.com       | 1.2.3.4   | 2 min │
│ ABCD-1234-...  | Finance | tri@x.com       | 5.6.7.8   | 30s   │
│ XYZA-9876-...  | ISO     | (machine: abc..)| 10.0.0.1  | 4 min │
├────────────────────────────────────────────────────────────────┤
│ [Force kick selected] [Audit log]                              │
└────────────────────────────────────────────────────────────────┘
```

### 6.3 — Website Admin Panel mirror

- `/admin/keys` — quản lý keys (đã có cơ bản, mở rộng theo schema mới)
- `/admin/sessions` — mới
- `/admin/audit` — audit logs viewer
- `/admin/users` — đã có, thêm cột `app_keys` summary

### 6.4 — User Dashboard `/dashboard`

Hiển thị cho user:
- Danh sách apps đã activate (Library/Drive/Finance/...) + ngày hết hạn
- Active sessions hiện tại (IP + machine + last_seen)
- Nút "Logout máy khác"
- Form nhập key activate

---

## 7. SECURITY + EDGE CASES

| Scenario | Behavior |
|---|---|
| User mất key (vd reset máy) | Key bound máy cũ. Liên hệ admin → admin reset `bound_machine_id` qua KeysPanel |
| Key hết hạn | App detect `expires_at < now()` → block UI, hiện modal "Key hết hạn, gia hạn tại..." |
| Admin gia hạn key đã hết hạn | Update `expires_at`, audit log, app tự reload |
| User VPN spoof IP | machine_id ổn định hơn → block theo machine + IP audit |
| User format Windows | machine_id đổi → cần admin reset binding hoặc reactivate |
| Race condition (2 login đồng thời cùng key) | Firestore transaction atomic check `count < max_concurrent` |
| Offline > 15min | Session expired auto, app re-auth khi online lại |
| Admin abuse | Mọi action audit log + actor_uid lưu lại |

---

## 8. ROADMAP CHI TIẾT

### Phase 36 — Schema + Concurrent Control (2-3 tuần)

- **36.1** Update Firestore types (`packages/data`): `ActivationKey` v2 + `KeySession` + `DeviceActivation` + `AuditLog`
- **36.2** Firestore rules: keys read only owner+admin, sessions write only via Cloud Function
- **36.3** Cloud Function `registerKeySession` (atomic transaction)
- **36.4** Cloud Function `cleanupExpiredSessions` (scheduled mỗi 10min)
- **36.5** Rust `machine_id` lib + IP detection (ipify.org)
- **36.6** Heartbeat 5min loop trong app

### Phase 37 — Per-app Key Activation UI (2 tuần)

- **37.1** Activation modal component (account key — apps có login)
- **37.2** Activation modal component (standalone key — apps no-login)
- **37.3** Wire 7 apps: gate by `app_keys[appId]` hoặc `device_activations[machine_id_appId]`
- **37.4** New login alert + auto logout với toast 5s
- **37.5** TrishAdmin KeysPanel mở rộng (form tạo + filter + extend expiry)
- **37.6** TrishAdmin ActiveSessionsPanel (mới)
- **37.7** Website /admin/keys mirror, /admin/sessions, /admin/audit
- **37.8** User /dashboard hiện app_keys + sessions

### Phase 38 — Migration + TrishLibrary PDF Pro (2 tuần)

- **38.1** Migration script: convert `iso_admin` flag + `key_activated_at` → `app_keys` map
- **38.2** Backward-compat: keys cũ (16 chars XXXX-XXXX-XXXX-XXXX) treat như `app_id='all', type='account'`
- **38.3** TrishLibrary PDF Pro: Stamp/Binder/OCR/Compare (4 module mới)

---

## 9. CONFIRM TRƯỚC KHI CODE PHASE 36.1

- [ ] **Default values:**
  - `max_concurrent` mặc định khi admin tạo key = ?  (1 / 3 / 5)
  - `expires_at` mặc định khi admin tạo key = ?  (1 năm / 6 tháng / không hạn)
- [ ] **Migration backward-compat:**
  - Keys cũ đã activated cho user (role=user) → tự convert thành `app_keys.all` (full access tất cả apps trả phí)?
  - Hoặc gọi user nhập lại key cho từng app?
- [ ] **App "all" key giá cao bao nhiêu** vs key riêng từng app? (ảnh hưởng UI tạo key)
- [ ] **Migration period:** trong bao lâu vẫn accept key cũ format không có `app_id` field?

→ Đợi Trí confirm 4 việc này trước khi code Phase 36.1.
