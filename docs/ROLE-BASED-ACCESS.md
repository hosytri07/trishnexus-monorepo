# Role-Based Access Model — TrishTEAM Phase 38

Phase 38 (10/05/2026) bỏ hoàn toàn key-activation system 16 ký tự, thay bằng role-based gắn vào tài khoản Firebase.

## 4 roles

| Role | Truy cập | Cấp quyền |
|---|---|---|
| `trial` | **Block toàn bộ** app | Mặc định khi đăng ký mới |
| `demo` | Full access trong thời hạn `demo_expires_at` | Admin set |
| `user` | Full access vĩnh viễn | Admin set |
| `admin` | Full access + bảng admin | Admin set bằng tay (Firestore) |

Hierarchy ranking: `trial(0) < demo(1) < user(2) < admin(3)`.

## Logic check

`packages/data/src/index.ts`:

```typescript
export function canAccessApp(
  user: { role: UserRole; demo_expires_at?: number } | null,
  now: number = Date.now(),
): { allowed: boolean; reason?: 'trial-blocked' | 'demo-expired' | 'no-user' } {
  if (!user) return { allowed: false, reason: 'no-user' };
  if (user.role === 'admin' || user.role === 'user') return { allowed: true };
  if (user.role === 'demo') {
    const exp = user.demo_expires_at ?? 0;
    if (exp > 0 && exp > now) return { allowed: true };
    return { allowed: false, reason: 'demo-expired' };
  }
  return { allowed: false, reason: 'trial-blocked' };
}
```

## Component flow

`<TierGate>` (packages/auth/src/tier-gate.tsx) wrap toàn bộ app sau login:

```
firebaseUser → useAuth() → canAccessApp(profile)
  → allowed: render children (app content)
  → reason='trial-blocked': render block screen "Liên hệ admin"
  → reason='demo-expired': render block screen "Hết hạn demo"
  → demo còn hạn ≤ 3 ngày: render banner cảnh báo
```

`<AuthApp>` (packages/auth/src/auth-app.tsx) wrap one-shot cho 4 standalone apps (Check/Font/Clean/Shortcut):

```
LoginScreen (chưa login)
  → AuthProvider → TierGate → app content (đã login + role >= demo còn hạn)
```

## Firestore schema

Collection `users/{uid}`:

```typescript
{
  display_name: string;
  email: string;
  role: 'trial' | 'demo' | 'user' | 'admin';
  // Chỉ có khi role='demo'
  demo_expires_at?: number;  // Unix ms timestamp
  demo_set_by_uid?: string;  // Admin uid set demo này
  demo_set_at?: number;
  created_at: number;
}
```

## Cấp role cho user

### Cách 1 — TrishAdmin app (UI)

1. Mở TrishAdmin → tab Users
2. Tìm user theo email
3. Dropdown role → chọn `user` / `demo` / `admin`
4. Nếu `demo`: nhập số ngày (mặc định 30)
5. Lưu → Firestore update + ghi audit log

### Cách 2 — Firebase Console (manual)

1. Mở Firestore Console → `users/{uid}`
2. Edit field `role` → set value mới
3. Nếu set `demo`: thêm `demo_expires_at` = Unix ms (vd `1735689600000` cho 1/1/2026)

## App nào yêu cầu role gì

Trong `apps-registry.json` mỗi app có field `login_required`:

| Value | App | Behavior |
|---|---|---|
| `none` | TrishLauncher | Free, không cần login |
| `user` | 10 app còn lại | Yêu cầu login + role >= demo còn hạn |

Launcher hiển thị badge:
- 🆓 Miễn phí (login_required="none")
- 👤 Cần đăng nhập (login_required="user")

## So với key system cũ

| Aspect | Key system (deprecated) | Role-based (Phase 38) |
|---|---|---|
| Cấp quyền | Key 16 ký tự admin tạo | Role trong Firestore |
| Bind | Machine ID (standalone) hoặc UID (account) | UID Firebase |
| Hết hạn | `expires_at` per-key | `demo_expires_at` per-user |
| Đa thiết bị | Concurrent control phức tạp | Nhiều device cùng UID OK |
| User flow | Đăng nhập → nhập key → activate | Đăng nhập → admin cấp role → dùng |
| Recovery | Mất key = mất quyền | Reset password = OK |

## Migration checklist (đã làm)

- [x] Bỏ `requires_key` + `key_type` khỏi `apps-registry.json` (schema v6)
- [x] Bỏ KeyGate component, thay bằng TierGate
- [x] Wave 5 standalone apps (Check/Font/Clean/Shortcut/Library) wrap AuthApp
- [x] Xóa Firestore collection `keys/` cũ
- [x] Xóa GitHub Releases cũ (key-system .exe)
- [x] Update docs (file này)

## Phase tiếp theo

- TrishAdmin /admin/users panel: UI set role + demo expiry (Phase 38.7)
- Email notification khi role change
- Demo reminder email khi còn ≤ 7 ngày
