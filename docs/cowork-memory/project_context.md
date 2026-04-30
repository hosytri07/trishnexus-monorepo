---
name: Project context — TrishTEAM monorepo
description: Hệ sinh thái phần mềm cho kỹ sư xây dựng/giao thông VN — website Next.js + 7 desktop Tauri 2 + Firebase + Cloudinary
type: project
---
TrishTEAM là hệ sinh thái phần mềm + tri thức + công cụ cho kỹ sư xây dựng/giao thông VN.

**Architecture:**
- **Website** (Next.js 14, https://trishteam.io.vn): dashboard, 6 database (biển báo / cầu / quy chuẩn / định mức / vật liệu / đường), 4 quiz (lái xe / chứng chỉ BXD 8081 câu / tin học VP / tiếng Anh), 11 công cụ (VN2000, pomodoro, BMI...), blog, admin panel
- **7 desktop app** (Tauri 2 + Rust + React 18): TrishLauncher v2.0.0-1 (hub), TrishLibrary v3.0.0 (gộp 4 module Thư viện/Note/Type/Image), TrishAdmin v1.1.0 (admin desktop), TrishFont/Check/Clean v2.0.0-1, TrishDesign (Phase 21 chưa start), TrishDrive Phase 23.7 (Telegram cloud storage)
- **Shared packages** (`packages/*`): core (pure TS domain logic), auth (Firebase + DPAPI), data (Firestore types), ui, adapters, telemetry (Phase 21 prep)

**Stack chốt:**
- Firebase project `trishteam-17c2d` (Spark plan free, Storage disabled)
- Firestore metadata + Cloudinary 25GB assets + GitHub Releases .exe
- Vercel deploy auto từ git push origin main
- pnpm workspace, không dùng npm/yarn

**Repo:** https://github.com/hosytri07/trishnexus-monorepo (branch main)

**Why nó quan trọng:** Tri là 1-người-team, dự án cá nhân nhưng quy mô lớn. Architecture chốt và stable — đừng đề xuất thay đổi (vd chuyển khỏi Tauri, thêm React Native, etc.) trừ khi Trí hỏi.

**How to apply:**
- Khi propose feature mới, ưu tiên dùng đúng stack hiện tại
- Database tra cứu + công cụ là thế mạnh — gắn TCVN/QCVN/AASHTO citation vào mọi feature
- TrishLauncher self-exclude khỏi list app hiển thị; TrishAdmin ẨN khỏi launcher (chỉ admin biết link)
- 4 app đã deprecated (TrishNote/Image/Search/Type) — gộp module trong Library 3.0, KHÔNG resurrect
- Phong thủy / tử vi: KHÔNG bao giờ thêm
