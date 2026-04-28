# TrishAdmin

**Phase 18.7.a — 2026-04-27**

App quản trị nội bộ cho hệ sinh thái TrishTEAM. Cho phép admin:
- 📊 Dashboard tổng quan: số users / signups / keys / broadcasts
- 👥 Quản lý users: list, đổi role (trial/user/admin), reset trial
- 🔑 Sinh activation keys: batch generate, list, revoke, copy
- 📢 Push broadcasts: thông báo tới user app (banner trong app)
- 📦 Apps Registry: edit `apps-registry.json` + `min-specs.json` local

## ⚠ Tính riêng tư

- App này **KHÔNG** phát hành public.
- **KHÔNG** có entry trong `website/public/apps-registry.json`.
- **KHÔNG** hiện trong TrishLauncher.
- Chỉ admin email trong `src/lib/admin-emails.ts` được login. Email khác login → block + force sign out.
- Admin tự build `pnpm tauri build` rồi cài tay file `.exe` từ `src-tauri/target/release/bundle/`.

## Tech stack

- Tauri 2 (Rust + React + TypeScript)
- Firebase Auth + Firestore (qua `@trishteam/auth`)
- Vite dev server port 1450

## Phát triển

```powershell
cd apps-desktop\trishadmin
pnpm install   # ở repo root để pnpm-workspace setup
pnpm tauri dev
```

## Build

```powershell
pnpm tauri build
```

Output: `src-tauri/target/release/bundle/nsis/TrishAdmin_1.0.0_x64-setup.exe`

## Firestore collections sử dụng

| Path | Mục đích |
|---|---|
| `users/{uid}` | TrishUser — quản lý role |
| `keys/{keyId}` | ActivationKey — sinh + revoke |
| `announcements/{id}` | Broadcast — push notification |

## Admin emails

Sửa `src/lib/admin-emails.ts` để add/remove admin. Cần rebuild + cài lại sau khi đổi.
Hiện tại:
- `trishteam.official@gmail.com`
- `hosytri77@gmail.com`

## Firestore Security Rules

Cần đảm bảo rules cho phép admin (role === 'admin') read/write các collection trên.
Xem `firestore.rules` ở repo root.
