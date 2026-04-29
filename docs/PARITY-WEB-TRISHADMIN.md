# 🔄 Parity Web ↔ TrishAdmin Desktop + Roadmap tiếp theo

> **Cập nhật:** 2026-04-29 (sau Phase 19.22)
>
> Doc này so sánh chức năng quản trị giữa **website (`/admin/*`)** và **TrishAdmin desktop (Tauri 2)**.
> Mục tiêu: parity (cả 2 bên cùng làm được mọi việc admin cần).

---

## 🎯 Roadmap tiếp theo (theo thứ tự Trí muốn)

```
PHASE 19.22 (đang làm) ─── Web admin hoàn thiện
       │
       ▼
PHASE 19.23 ─────────── DEPLOY website lên Vercel production
       │
       ▼
PHASE 19.24 ─────────── Bổ sung chức năng còn thiếu cho TrishAdmin desktop
                        (parity với web)
       │
       ▼
PHASE 20 ─────────────── Zalo MiniApp (React + ZMP SDK)
                         - Login Zalo OA
                         - View blog + database VN
                         - Push notification
       │
       ▼
PHASE 21 ─────────────── TrishDesign desktop
                         - AutoCAD plugin
                         - AI RAG TCVN
                         - Dự toán + bản vẽ kỹ sư
```

---

## 📊 Bảng so sánh chức năng admin

### ✅ Cả 2 bên ĐÃ CÓ

| Chức năng | Web `/admin/*` | TrishAdmin desktop |
|---|---|---|
| Dashboard tổng quan | `/admin` | dashboard panel |
| Quản lý user | `/admin/users` (Phase 19.22 rewrite full) | users panel |
| Activation keys | `/admin/keys` | keys panel |
| Bài blog | `/admin/posts` | posts panel |
| Thông báo (announcements) | `/admin/announcements` | broadcasts panel |
| Audit log | `/admin/audit` | audit panel |
| Thư viện TrishTEAM (folder + link) | `/admin/library` (Phase 19.22 mới) | library panel |

### ⚠️ CHỈ WEB CÓ (TrishAdmin desktop CHƯA có)

| Chức năng | Web | Cần đưa qua TrishAdmin? |
|---|---|---|
| **Database VN** (Quy chuẩn / Định mức / Vật liệu / Đường VN) | `/admin/databases` | ✅ Nên có — kỹ sư offline cần edit lúc không có net |
| **Apps Desktop** (sửa metadata 10 app) | `/admin/apps` | ✅ Cần — admin desktop quản lý ngay máy mình |
| **Ảnh biển báo** (upload Cloudinary) | `/admin/signs` | ⚠️ Optional — desktop có thể bulk import |
| **Ảnh cầu** (upload Cloudinary) | `/admin/bridges` | ⚠️ Optional |
| **Vitals** (Web Vitals analytics) | `/admin/vitals` | ❌ Không cần (chỉ web) |
| **Errors** (error logs) | `/admin/errors` | ❌ Không cần (chỉ web) |
| **Storage** (Cloudinary usage) | `/admin/storage` | ⚠️ Optional |
| **Semantic reindex** | `/admin/reindex` | ❌ Không cần (server-side job) |

### ⚠️ CHỈ TrishAdmin CÓ (Web CHƯA có)

| Chức năng | TrishAdmin | Cần đưa qua web? |
|---|---|---|
| **Settings** (config local) | settings panel | ❌ Không cần (config riêng từng máy) |
| **Feedback inbox** (đọc Telegram bot) | feedback panel | ✅ Nên có — admin remote duyệt feedback |
| **Bulk import dữ liệu** (Excel/CSV) | desktop có quyền filesystem | ⚠️ Web khó làm — có thể dùng admin SDK |

---

## 🔧 Việc cần đưa qua TrishAdmin desktop (Phase 19.24)

Theo thứ tự ưu tiên:

### 1. Database VN editor (CAO) ⭐
**Lý do:** Kỹ sư cầu đường thường không có net khi đi field. Cần edit định mức / vật liệu offline rồi sync khi online.

**Spec:**
- 4 panel mới: Quy chuẩn / Định mức / Vật liệu / Đường VN
- CRUD card list giống web `/admin/databases`
- Sync với Firestore qua `firebase-rs` crate
- Local SQLite cache khi offline → push lên cloud khi có net

### 2. Apps Desktop CRUD (CAO) ⭐
**Lý do:** Trí build app desktop ngay tại máy → cần update version + URL exe ngay.

**Spec:**
- Panel mới: Apps Desktop  
- List 10 app từ Firestore `/apps_meta/`
- Sửa: version, release_at, status, URL .exe, SHA256, features
- Auto-fill SHA256 khi drop file .exe vào (Rust hash trên local)

### 3. Feedback inbox (TRUNG BÌNH)
**Lý do:** Hiện feedback chạy qua Telegram bot. Admin muốn xem trong dashboard.

**Spec:**
- Panel mới: Feedback
- Subscribe Firestore `/feedback/*` (đã có collection)
- List + reply + đánh dấu đã đọc
- Notification khi có feedback mới

### 4. Bulk import Excel (TRUNG BÌNH)
**Lý do:** Trí có Excel 7,549 cầu, 838 câu lái xe... Cần import nhanh.

**Spec:**
- File picker → parse Excel với crate `calamine`
- Map column → schema Firestore
- Preview + confirm trước khi push lên cloud

### 5. Storage usage panel (THẤP)
- Hiện Cloudinary quota dùng / 25GB
- Top file lớn nhất
- Auto-delete file orphan (không có ref trong Firestore)

---

## 🌐 Việc cần đưa qua Website (đối ứng)

### 1. Feedback inbox web
Mirror panel TrishAdmin — admin có thể duyệt feedback ở bất cứ máy nào không cần cài desktop.

**Path:** `/admin/feedback`
**Schema:** Firestore `/feedback/{id}` (đã có)

### 2. Storage usage web
Hiện Cloudinary usage trên web để admin nắm quota.

**Path:** `/admin/storage`
**API:** `/api/admin/cloudinary-usage` gọi Cloudinary Admin API

---

## 🚀 Phase 19.23 — Deploy website production

### Pre-deploy checklist

```
[ ] pnpm build pass (không có TS error)
[ ] Test 5 chỗ chính ở localhost:
    - /                  (homepage)
    - /admin             (admin gate)
    - /downloads         (countdown realtime)
    - /blog              (list + detail)
    - /quy-chuan         (database từ Firestore)
[ ] Firestore rules đã deploy (firebase deploy --only firestore:rules)
[ ] /admin/databases đã "Nạp tất cả"
[ ] /admin/apps đã "Nạp app mới"
[ ] secrets/service-account.json đã có (cho Vercel set env FIREBASE_SERVICE_ACCOUNT)
```

### Vercel env vars cần set production

```
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
GOOGLE_AI_API_KEY
FIREBASE_SERVICE_ACCOUNT          ← BASE64 encode service-account.json
NEXT_PUBLIC_SITE_URL=https://trishteam.io.vn
```

**Convert service-account.json → base64:**
```powershell
# Windows PowerShell
[Convert]::ToBase64String([System.IO.File]::ReadAllBytes("secrets/service-account.json"))
```
Copy output → paste vào Vercel env `FIREBASE_SERVICE_ACCOUNT`.

### Deploy steps

```
git push origin main   # → Vercel auto deploy
```

Sau deploy:
- Vào https://vercel.com/dashboard → check build log
- Test https://trishteam.io.vn:
  - Trang chủ load
  - Login Firebase
  - `/downloads` countdown
  - `/admin` (cần login admin)
  - `/blog`

---

## 📱 Phase 20 — Zalo MiniApp

### Spec sơ bộ (chốt sau)

**Tech stack:**
- React 18 + ZMP SDK (Zalo Mini App framework)
- Reuse `@trishteam/core` (search, apps catalog, qr, ...)
- Login qua Zalo OA → mapping với Firebase user (link account)

**Features dự kiến:**
- Đọc blog từ Firestore (read-only)
- Database VN (biển báo, cầu, định mức) — read-only
- Quiz lái xe + chứng chỉ XD
- QR code generator
- Push notification qua Zalo OA (FCM proxy)
- Liên kết tài khoản Zalo với account TrishTEAM (key activation)

**Folder:** `apps-zalo/main/` (placeholder đã có trong pnpm-workspace.yaml)

**Effort dự kiến:** 2-3 tuần (phụ thuộc Zalo OA approval)

---

## 🏗️ Phase 21 — TrishDesign desktop

### Spec sơ bộ

**Mục tiêu:** Bộ công cụ thiết kế hạ tầng giao thông cho kỹ sư XD-GT.

**Features:**
1. **Quản lý dự án + hồ sơ KS/TK/HC/NT/TT**
2. **AutoCAD plugin** (vẽ hiện trạng MĐ + ATGT trực tiếp)
3. **OCR Khảo sát** (PDF sổ hiện trạng → AI OCR → Excel)
4. **Tính kết cấu** (dầm/móng/cọc/dự toán theo định mức)
5. **AutoLISP library** + Chatbot AI vẽ CAD (MCP)
6. **Tiện ích GIS:** VN2000 ↔ WGS84, quản lý mốc tọa độ
7. **AI RAG TCVN/AASHTO** (MaxKB tích hợp)

**Tech stack:**
- Tauri 2 + React + Rust
- pyautocad bridge (Windows COM)
- llama-cpp-python local cho RAG
- ONNX cho OCR

**Effort dự kiến:** 2-3 tháng (phức tạp nhất ecosystem)

---

## 📋 Action items NGAY

### Trí cần làm
1. ✅ Test localhost xong tất cả phase 19.22
2. ⏳ Deploy production website (push origin main)
3. ⏳ Set Vercel env `FIREBASE_SERVICE_ACCOUNT` (base64)
4. ⏳ Verify https://trishteam.io.vn/admin sau deploy

### Em (Claude) sẵn sàng làm khi Trí gọi
1. Phase 19.24 — Wire 5 chức năng vào TrishAdmin desktop (database VN, apps, feedback, bulk import, storage)
2. Phase 20 — Scaffold `apps-zalo/main/` với ZMP SDK + login Zalo
3. Phase 21 — Scaffold TrishDesign Tauri 2

**Quy ước:** Phiên sau Trí nhắn "deploy website" / "TrishAdmin parity" / "Zalo miniapp" / "TrishDesign" → em pick đúng task.
