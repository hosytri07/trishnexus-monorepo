# TrishAdmin v1.1.0 — Backup, Database VN, Bulk Import, Storage, Errors, Vitals

**Phase 19.24 + 21 prep · 2026-04-29**

Bản v1.1.0 thêm 6 panel mới + telemetry tự động.

## ✨ Mới

### 4 panel desktop parity với web admin (Phase 19.24)
- **💾 Backup / Restore** — Export Firestore → JSON bundle, import từ JSON, audit log
- **🇻🇳 Database VN** — JSON editor 4 collection (biển báo / cầu / quy chuẩn / định mức)
- **📥 Bulk Import** — CSV/TSV → Firestore batch (max 500 doc/batch)
- **☁ Storage** — Cloudinary quota + folders + top files

### 2 panel quan sát (Phase 21 prep)
- **🐞 Errors** — Tự động báo từ 7 desktop app + website. Group theo fingerprint (FNV-1a hash). Top 20 issue + 300 sample gần nhất + filter app/severity + modal stack trace.
- **📊 Vitals** — Web Vitals + STARTUP time desktop. Metric card LCP/INP/CLS/TTFB/FCP/STARTUP với percentile p50/p75/p95 + rating bar good/NI/poor.

### Telemetry tích hợp
Tự động cài `window.onerror` + `unhandledrejection` + listener Tauri panic event. Mọi lỗi gửi tới `https://trishteam.io.vn/api/errors`. Không cần config thêm.

## 📦 Cài đặt

- **Windows x64** — tải `TrishAdmin_1.1.0_x64-setup.exe` (NSIS)
- ⚠️ **CHỈ DÀNH CHO ADMIN** — Login với email admin (`hosytri77@gmail.com` / `trishteam.official@gmail.com`). User thường login sẽ thấy AdminBlocked screen.

## 🔧 Chạy thử local trước khi release

```cmd
cd apps-desktop\trishadmin
pnpm tauri dev
```

## 🚀 Release

Sau khi pnpm install link telemetry workspace + smoke test OK:

```cmd
git tag trishadmin-v1.1.0
git push --tags
```

Workflow `release-app.yml` (Phase 20.8) tự build NSIS + tạo GitHub Release. Theo dõi tại Actions tab.
