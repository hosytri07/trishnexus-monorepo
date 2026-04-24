# TrishTEAM — Firebase Cloud Functions

Callable functions (V2) phục vụ Auth admin + SSO oneshot token exchange
giữa desktop (PyQt6) và website (Next.js).

Spec nguồn: [docs/AUTH.md](../docs/AUTH.md) §2.3 + §4.

## Functions exported

| Name | Auth | Purpose |
|------|------|---------|
| `setUserRole`          | caller phải là `role=dev` | Set custom claim role cho 1 user, ghi audit log |
| `exchangeForWebToken`  | caller đã login           | MINT oneshot token (TTL 2 phút), trả về URL handoff |
| `exchangeOneshotToken` | không cần login           | REDEEM oneshot → Firebase custom token để `signInWithCustomToken` |

Region triển khai: `asia-southeast1` (Singapore).

## Scaffold layout

```
functions/
├── package.json          Firebase Functions V2 + Admin + TypeScript
├── tsconfig.json         Strict compile, output → lib/
├── tsconfig.test.json    Relaxed strict cho jest
├── jest.config.js
├── .eslintrc.js
├── .gitignore
└── src/
    ├── index.ts                   Init admin SDK + re-export
    ├── setUserRole.ts
    ├── exchangeForWebToken.ts     Mint oneshot
    ├── exchangeOneshotToken.ts    Redeem oneshot
    └── lib/
        ├── authUtil.ts            Pure helpers (oneshot id gen, validate)
        ├── errors.ts              HttpsError normalisers
        └── __tests__/
            ├── authUtil.test.ts
            └── errors.test.ts
```

## Setup lần đầu

```bash
cd functions
npm install
# (tuỳ chọn) bootstrap dev user role qua Firebase console:
# Auth → user → custom claims → { "role": "dev" }
```

Cần Node 20+ (Firebase Functions gen 2 runtime).

## Dev flow

```bash
npm run build        # tsc → lib/
npm run lint         # eslint src/
npm test             # jest — unit test cho lib/
npm run serve        # build + start functions + firestore + auth emulator
```

Emulator UI mặc định: <http://localhost:4000>. Khi emulator chạy, gọi thử:

```bash
curl -X POST http://localhost:5001/<project-id>/asia-southeast1/exchangeOneshotToken \
  -H "Content-Type: application/json" \
  -d '{"data":{"oneshot":"<32-char-id>","platform":"web"}}'
```

## Oneshot token flow

```
┌─ Desktop đã login (uid=U1) ──┐
│                               │
│  call exchangeForWebToken     │
│     target: "web"             │
└──────────┬────────────────────┘
           │
           ▼
    Firestore: oneshot_tokens/{id}
       uid: U1                   ← server-trusted
       expiresAtMs: now+2min
       used: false
       targetPlatform: "web"
           │
           ▼  trả về { oneshot, url }
┌─ Desktop mở browser ─────────────┐
│  https://trishteam.com/sso?      │
│    oneshot=<id>                  │
└──────────┬───────────────────────┘
           │
           ▼
┌─ Web SSO page ─────────────────────┐
│  call exchangeOneshotToken         │
│     oneshot: <id>, platform:"web"  │
└──────────┬─────────────────────────┘
           │
           ▼
    Firestore TX:
       read oneshot_tokens/{id}
       validate (not used, not expired, target match)
       mark used=true
           │
           ▼
    admin.auth().createCustomToken(U1)
           │
           ▼  trả về { customToken }
┌─ Web caller ─────────────────────┐
│  signInWithCustomToken(...)      │
│  → firebase user = U1            │
└──────────────────────────────────┘
```

Đối xứng cho chiều ngược lại (web → desktop) qua scheme `trishteam://sso?...`.
Desktop deep link handler (Phase 1.6 / Task #78) đọc oneshot, gọi fn này.

## Security notes

- **Transaction redeem**: `runTransaction` đảm bảo token dùng đúng 1 lần, 
  2 caller race-condition chỉ 1 win.
- **TTL 2 phút**: đủ cho browser redirect / deep-link, ngắn đủ giảm replay.
- **Audit log**: mọi mint/redeem/role_change ghi vào `auth_events` collection.
- **App Check (TODO)**: khi production, enable App Check để rate-limit 
  exchangeOneshotToken tránh brute-force ID space (2^256 nhưng vẫn nên).
- **IP logging**: redeem ghi `rawRequest.ip` vào audit — forensic nếu abuse.

## Error contract

Tất cả functions throw `HttpsError` với code chuẩn:

| Code                 | Khi nào                                              |
|----------------------|------------------------------------------------------|
| `unauthenticated`    | Thiếu `req.auth` (chỉ setUserRole / exchangeForWebToken) |
| `invalid-argument`   | Payload thiếu field / sai type                       |
| `permission-denied`  | Caller role không đủ                                 |
| `not-found`          | Oneshot ID không tồn tại                             |
| `failed-precondition`| Oneshot đã used / expired / sai targetPlatform      |
| `internal`           | Lỗi hệ thống không phân loại được — log chi tiết server |

Message tiếng Việt cho UX thân thiện, code dùng tiếng Anh để
khớp Firebase CLI + SDK.

## TODO (Phase 1.6 — Task #78)

- [ ] Desktop handler parse `trishteam://sso?oneshot=...` — Windows registry
- [ ] Website `/sso?oneshot=...` page — Next.js route gọi exchangeOneshotToken
- [ ] Integration test chạy qua Firebase emulator (E2E mint → redeem)
- [ ] App Check enforcement ở production
- [ ] firestore.rules cho `oneshot_tokens` — deny client read/write direct

## Checklist deploy production

- [ ] `firebase projects:create trishteam-prod` (+ staging)
- [ ] Enable Email/Password + Google provider ở Firebase Auth console
- [ ] `firebase deploy --only functions` (từ thư mục này)
- [ ] Bootstrap dev user đầu tiên: Firebase Auth → custom claims `{role:"dev"}`
      (vì setUserRole tự check caller=dev, cần manual 1 user đầu)
- [ ] `firebase deploy --only firestore:rules` — deny direct write oneshot_tokens
- [ ] Enable App Check với reCAPTCHA v3 (web) + Play Integrity (không áp dụng — 
      chỉ desktop, skip) → App Check chỉ enforce cho website caller
