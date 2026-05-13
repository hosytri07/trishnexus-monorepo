# TrishAdmin — Admin Tool cho Hệ Sinh Thái TrishTEAM

**Internal tool** — chỉ dành cho admin TrishTEAM (Trí + Anthropic team).

## Cài đặt

1. Tải `.exe` từ [trishteam.io.vn/admin/trishadmin-download](https://trishteam.io.vn/admin/trishadmin-download) (cần đăng nhập admin)
2. Chạy NSIS installer → cài vào `Program Files`
3. Đăng nhập bằng tài khoản admin Firebase (vd: trishteam.official@gmail.com)

## Quyền cần thiết

- Firebase Auth: role = 'admin' (set qua Firebase Console hoặc UsersPanel)
- Firestore: full read/write các collection /users, /keys, /promo_codes, /apps_catalog, /audit, ...
- Firebase Storage: full read TrishDrive bot uploads

## Panel chính

| Panel | Chức năng |
|-------|----------|
| Dashboard | KPI tổng (users, sessions, audit count) |
| 👥 Users | List + role + delete + reset trial |
| 🔑 Keys | Sinh + revoke key 16-char per-app |
| 🎟 Promo Codes | TRIAL2026 và codes tùy chỉnh |
| 📦 App Catalog | Firestore-backed apps_catalog (thêm app external) |
| 🏢 Office Multi-tenant | Cross-company browser |
| 📋 ISO Projects | Hồ sơ ISO 9001 cross-user |
| 💵 Finance Telemetry | Key activations Finance |
| ☁ TrishDrive | Shares + requests Cloud Telegram |
| 📊 Vitals / 🐞 Errors / Audit | Observability |

## Build

```powershell
cd apps-desktop/trishadmin
pnpm tauri build
```

`.exe` output: `src-tauri/target/release/bundle/nsis/TrishAdmin_X.X.X_x64-setup.exe`

## Phiên bản

- v1.0.0 (2026-05-13) — Phase 41: AppCatalog Firestore + Office/ISO/Finance panels
