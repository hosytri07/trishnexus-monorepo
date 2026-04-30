---
name: TrishAdmin private — không upload GitHub Release
description: TrishAdmin desktop app chỉ build .exe local để admin tự phân phối riêng, KHÔNG push tag để GitHub Actions tạo public release
type: feedback
---
TrishAdmin là app NỘI BỘ ADMIN. Build NSIS .exe local rồi Trí phân phối thủ công (USB/email/cloud private), KHÔNG public lên GitHub Release.

**Why:** TrishAdmin có quyền truy cập dữ liệu nhạy cảm (CRUD users, Firebase rules, audit log, backup). Public installer trên GitHub = exposure surface không cần thiết, dù có Firebase Auth gate. Trí muốn rõ ràng: app này không cho public download.

**How to apply:**
- KHÔNG chạy `git tag trishadmin-v*` cho bất kỳ version TrishAdmin nào
- KHÔNG add TrishAdmin vào workflow `release-app.yml` choice options (đã có sẵn nhưng để dùng workflow_dispatch khi cần debug)
- Build local: `pnpm -C apps-desktop\trishadmin tauri build` → file ra ở `src-tauri/target/release/bundle/nsis/TrishAdmin_<version>_x64-setup.exe`
- TrishAdmin cũng đã ẨN khỏi TrishLauncher (apps-registry không show) và website /downloads
- 6 app công khai khác (Launcher/Library/Font/Check/Clean/Design) vẫn dùng tag → GitHub Actions release bình thường
- Phase 24+: TrishDrive sẽ được merge vào TrishAdmin (admin tool) → cũng giữ private theo cùng quy tắc
