# Handoff WEBSITE — TrishTEAM Phase 19.20 → 19.22

> **⚡ ĐỌC FILE NÀY ĐẦU TIÊN khi vào phiên mới ở máy nhà.**
>
> Đây là handoff CHỈ cho phần WEBSITE (`website/`). Nếu cần context TrishLibrary / TrishAdmin desktop apps thì đọc thêm `docs/HANDOFF-TRISHLIBRARY-3.0.md`.
>
> **Ngày cập nhật:** 2026-04-28 (cuối phiên cơ quan, sau Phase 19.22)
> **User:** Trí (hosytri77@gmail.com) — không phải dev, giao tiếp tiếng Việt, không dùng jargon trừ khi cần.

---

## 🎯 TRẠNG THÁI TỔNG QUAN

Website TrishTEAM (`trishteam.io.vn`) là dashboard hệ sinh thái + portal học tập + tra cứu cho kỹ sư xây dựng – giao thông Việt Nam. Đã có toàn bộ:

- **Auth:** Firebase Auth + Firestore role-based (guest/trial/user/admin)
- **Storage:** Cloudinary 25GB (avatar, biển báo, cầu, blog hero) + `/public/` static + GitHub release
- **Database tra cứu:** 6 bộ — biển báo (451 từ QC41:2024), cầu VN (7,549), đường VN (25), quy chuẩn (19), định mức (17 mã QĐ 1776), vật liệu (25)
- **Quiz ôn thi:** 4 — bằng lái xe (30 câu mẫu), chứng chỉ XD (8,081 câu thật từ BXD 163/2025), tin học VP (25 mẫu), tiếng Anh (23 mẫu)
- **Công cụ (11):** pomodoro, máy tính tài chính, QR, đơn vị, tính ngày, BMI, rút gọn link, mật khẩu, base64, hash, VN2000↔WGS84
- **Khác:** blog (admin post + user read), ủng hộ 4 quỹ từ thiện VN có VietQR, admin panel, Ctrl+K command palette, custom ConfirmModal, ImageLightbox, theme dark/light, PWA offline, Web Vitals reporter, Umami analytics, sitemap đầy đủ

**Phiên cuối ở cơ quan đã làm xong Phase 19.20 → 19.22, commit + push GitHub.** Sang nhà chỉ cần `START.bat` để pull.

---

## 🔴 PICK UP TỪ ĐÂY (PHIÊN MỚI Ở MÁY NHÀ)

### Bước 1 — Sync máy
```
scripts\START.bat
```
Tự pull từ GitHub + pnpm install + show status.

### Bước 2 — Test 1 lần trước khi deploy

Trí muốn test thật trước khi deploy lên Vercel. Vào folder `website/`:
```
cd website
pnpm dev
```
Mở `http://localhost:3000` rồi check 5 chỗ:

| Test case | Đường dẫn | Kỳ vọng |
|---|---|---|
| 1. Build pass | (terminal show "Compiled successfully") | Không có lỗi TS / import |
| 2. Cert exam BXD 163 | `/on-thi-chung-chi` | Loading skeleton → picker 3 bước (chọn chuyên ngành → hạng → chuyên đề) → quiz 25 câu → result review |
| 3. Định mức table mobile | `/dinh-muc` → click 1 mã → modal | Table có scroll ngang trên mobile (375px) |
| 4. Avatar upload | `/profile` → click avatar | Upload PNG ≤10MB, hiện ngay sau upload |
| 5. Notification prefs | `/settings` → section "Thông báo" | Master toggle + 6 topic toggles, lưu vào Firestore |

**Lưu ý fetch JSON 3.8MB:**
- `/on-thi-chung-chi` lazy fetch `/cert-bxd163.json` (3.8MB)
- Lần đầu mở có thể hơi chậm 1-2s; lần 2 sẽ instant nhờ `cache: 'force-cache'`
- Loading skeleton hiện trong lúc fetch

### Bước 3 — Sau khi pass test → deploy
```
git push origin main
```
(Vercel auto-deploy từ branch main. Nếu Vercel không tự deploy, vào dashboard Vercel → Deployments → Redeploy.)

Kiểm tra sau deploy:
- `https://trishteam.io.vn/on-thi-chung-chi` — load nhanh không
- `https://trishteam.io.vn/sitemap.xml` — có route mới (quy-chuan, dinh-muc, vat-lieu, duong-vn, tin-hoc-vp, tieng-anh, vn2000, ung-ho)
- Mobile responsive trên iPhone thật

---

## 📦 PHASE 19.20 — DATABASE + STUDY APPS (HOÀN THÀNH)

Mục tiêu: chuyển 6 placeholder ComingSoon thành tính năng thật.

### File mới (data + page):
- `website/data/standards-vn.ts` — 19 văn bản QCVN/TCVN/Thông tư/Nghị định/Quyết định
- `website/app/quy-chuan/page.tsx` + `layout.tsx` — catalog filter + modal
- `website/data/dinh-muc.ts` — 17 mã QĐ 1776/2007 (đào đắp, bê tông, cốt thép, xây trát, cốp pha, mặt đường, cọc móng) kèm hao phí vật liệu/nhân công/máy
- `website/app/dinh-muc/page.tsx` + `layout.tsx` — catalog + máy tính khối lượng × định mức
- `website/data/it-questions.ts` — 25 câu Tin học VP mẫu (Word/Excel/PPT/Mạng)
- `website/app/tin-hoc-vp/page.tsx` + `layout.tsx` — quiz state machine có resume
- `website/data/english-questions.ts` — 23 câu English mẫu (Grammar/Vocab/Reading/Business)
- `website/app/tieng-anh/page.tsx` + `layout.tsx` — quiz có reading passage
- `website/app/cong-cu/vn2000/layout.tsx` — metadata cho công cụ chuyển toạ độ (page đã có từ trước)
- `website/app/cau-vn/loading.tsx` — skeleton (vì fetch 1.8MB JSON)
- `website/app/bien-bao/loading.tsx` — skeleton

### File modified:
- `website/lib/nav-data.tsx` — flip 7 mục từ `wip` → `available`: tin-hoc-vp, tieng-anh, duong-vn, quy-chuan, dinh-muc, vat-lieu, vn2000
- `website/lib/search/static-sources.ts` — thêm 16 NAV_ITEMS mới để Ctrl+K tìm được toàn bộ trang
- `website/app/sitemap.ts` — thêm 10 routes mới, gỡ `/anh`
- `website/app/robots.ts` — disallow `/anh` + `/dl/`

### File data nguồn (đã có sẵn trước đó):
- `website/data/materials.ts` (25 vật liệu)
- `website/data/roads-vn.ts` (25 tuyến đường)
- `website/data/bridges-vn.ts` (loader cho 7,549 cầu)
- `website/lib/vn2000.ts` (Helmert 7-param VN2000↔WGS84)
- `website/public/bridges-vn.json` (1.8MB)
- `website/public/qc41-signs.json` (36KB)

---

## 📦 PHASE 19.21 — CERT EXAM BXD 163/2025 (HOÀN THÀNH)

Mục tiêu: thay 20 câu mẫu của /on-thi-chung-chi bằng ngân hàng câu hỏi chính thức của Bộ Xây dựng.

### Nguồn dữ liệu:
- File `BXD_163-QD_BXD_18022025.pdf` (1829 trang, có đáp án đầy đủ)
- Trí upload trong phiên cơ quan (đã xử lý)
- Parsed bằng pdftotext + Python state machine

### Kết quả parse:
- **8,081 câu hỏi** từ 72 section (16 chuyên ngành × 3 chuyên đề × 3 hạng)
- 16 chuyên ngành chia 3 nhóm:
  - **Khảo sát (1.1, 1.2):** địa hình, địa chất công trình
  - **Thiết kế (3.1 → 3.12):** kết cấu, dân dụng, công nghiệp, giao thông, cầu-hầm, hạ tầng, nông nghiệp, cấp-thoát nước, xử lý chất thải, cơ-điện 3 loại
  - **Giám sát (4.1, 4.2):** XD công trình, lắp đặt thiết bị
- Mỗi câu tag: hạng I/II/III + chuyên đề Chuyên môn / Pháp luật chung / Pháp luật riêng

### File mới:
- `website/public/cert-bxd163.json` (3.8MB, lazy fetch khi user mở /on-thi-chung-chi)
- `website/lib/cert-bxd163.ts` — loader + types + `buildExam()` (round-robin sample đều giữa các chuyên đề + shuffle) + `evaluateExam()` + `groupTopicsByChapter()`
- `website/app/on-thi-chung-chi/page.tsx` (rewrite hoàn toàn) — flow 3 bước picker → quiz → result, localStorage resume
- `website/app/on-thi-chung-chi/loading.tsx` — skeleton

### File giữ nguyên (legacy):
- `website/data/cert-questions.ts` — 20 câu mẫu cũ, không dùng nữa nhưng chưa xóa (phòng cần fallback)

### Flow user:
1. Mount → fetch cert-bxd163.json (force-cache) → restore exam state nếu có
2. Picker bước 1: chọn chuyên ngành (16 thẻ chia 3 nhóm)
3. Picker bước 2: chọn hạng (I/II/III) — kèm mô tả ý nghĩa từng hạng
4. Picker bước 3: chọn chuyên đề (mặc định trộn cả 3, có thể bỏ chọn)
5. Click "Bắt đầu thi" → 25 câu random, 60 phút, đậu ≥ 18/25
6. Auto-save state mỗi answer, resume được sau reload
7. Submit → result với review chi tiết kèm category badge

---

## 📦 PHASE 19.22 — POLISH (HOÀN THÀNH)

### Avatar upload:
- Đã sẵn từ Phase 19.12. `/profile` có `<AvatarUploader>` dùng Cloudinary signed upload (folder=avatar, public_id=avatar/{uid}). Save `cloudinary_avatar_id` + `photo_url` vào Firestore. Test bằng cách bấm vào avatar trên /profile.

### Notification preferences:
- `website/lib/notification-prefs.ts` — types, `loadPrefs()`, `savePrefs()`, `requestPushPermission()`, 6 topics
- 6 topics: blog mới, comment phản hồi, cập nhật cert XD, cập nhật QCVN/TCVN, thông báo hệ thống, nhắc ôn thi
- Lưu vào Firestore `users/{uid}.preferences.notifications` cho user đăng nhập, fallback localStorage cho guest
- `website/app/settings/page.tsx` updated — section "Thông báo" có: status box xin browser permission + master toggle + 6 topic toggles + autosave indicator + note "Đăng nhập để đồng bộ"
- **Chưa wire** FCM thực sự gửi push — Phase 20+ (cần Firebase Functions service worker)

### Homepage:
- `website/app/page.tsx` thêm `<DatabaseShowcase>` — 6 thẻ quick link (biển báo / cầu VN / đường VN / quy chuẩn / định mức / vật liệu) đặt giữa Blog CTA và QR Generator
- `<SiteFooter>` — footer 4 cột thật (Học tập / Database / Công cụ / TrishTEAM) với 18 link, copyright, source data credit. Thay note "Phase 19.1" cũ.

### 404 page:
- `website/app/not-found.tsx` — thêm 6 quick link database VN (biển báo, cầu, quy chuẩn, định mức, ôn lái xe, ôn chứng chỉ XD) bên cạnh 4 link chính.

### Mobile fix:
- `/dinh-muc` modal: table 4 cột không có overflow → fix bọc `<div className="overflow-x-auto -mx-6 px-6">` quanh table + `min-w-[480px]` + `whitespace-nowrap` cho cột số.

---

## 🗂 BẢN ĐỒ FILE WEBSITE (THỰC TRẠNG)

```
website/
├── app/
│   ├── (database — đã đầy đủ)
│   │   ├── bien-bao/        loading + page (QC41:2024 — 451 biển)
│   │   ├── cau-vn/          loading + page (Leaflet map + 7549 cầu)
│   │   ├── duong-vn/        layout + page (25 tuyến)
│   │   ├── quy-chuan/       layout + page (19 văn bản) ← PHASE 19.20
│   │   ├── dinh-muc/        layout + page (17 mã + máy tính) ← PHASE 19.20
│   │   └── vat-lieu/        layout + page (25 vật liệu)
│   ├── (quiz — đã đầy đủ)
│   │   ├── on-thi-lai-xe/   page (30 câu mẫu — chờ source 600 câu thật)
│   │   ├── on-thi-chung-chi/ page + loading + layout (8081 câu BXD 163) ← PHASE 19.21 REWRITE
│   │   ├── tin-hoc-vp/      layout + page (25 câu) ← PHASE 19.20
│   │   └── tieng-anh/       layout + page (23 câu) ← PHASE 19.20
│   ├── (công cụ — đầy đủ)
│   │   └── cong-cu/{pomodoro,may-tinh-tai-chinh,qr-code,don-vi,tinh-ngay,bmi,rut-gon-link,mat-khau,base64,hash,vn2000,thoi-tiet,lich,ghi-chu-nhanh}
│   ├── (đồng bộ apps)
│   │   ├── thu-vien/  ghi-chu/  tai-lieu/
│   │   └── anh/  ← KEEP placeholder, marked as desktop-only
│   ├── (admin)
│   │   └── admin/{users,keys,announcements,posts,audit,storage,registry-keys}
│   ├── api/
│   │   ├── cloudinary/sign/  (signed upload)
│   │   ├── vitals/  errors/  events/
│   │   └── unsubscribe/  upgrade/
│   ├── ung-ho/         page (4 quỹ từ thiện VN có VietQR)
│   ├── blog/           list + tag/[slug] + [slug]
│   ├── downloads/      apps/  profile/  settings/  search/
│   ├── login/          dl/[appId]/  offline/  not-found.tsx
│   ├── layout.tsx  page.tsx  sitemap.ts  robots.ts  globals.css
│
├── components/         (50+ widgets, panels, nav, theme-provider, confirm-modal, image-lightbox, cau-map, avatar-uploader, cloudinary-uploader)
│
├── data/
│   ├── apps-meta.ts            (10 desktop apps registry)
│   ├── announcements.ts        (admin announcements)
│   ├── traffic-signs.ts        (loader for qc41-signs.json)
│   ├── bridges-vn.ts           (loader for bridges-vn.json)
│   ├── driving-questions.ts    (30 câu lái xe mẫu)
│   ├── cert-questions.ts       (20 câu cert mẫu — LEGACY)
│   ├── standards-vn.ts         ← PHASE 19.20 (19 QCVN/TCVN)
│   ├── dinh-muc.ts             ← PHASE 19.20 (17 mã)
│   ├── materials.ts            (25 vật liệu)
│   ├── roads-vn.ts             (25 tuyến)
│   ├── it-questions.ts         ← PHASE 19.20 (25 IT mẫu)
│   └── english-questions.ts    ← PHASE 19.20 (23 EN mẫu)
│
├── lib/
│   ├── auth-context.tsx        (Firebase Auth + Firestore session)
│   ├── firebase.ts  firebase-admin.ts
│   ├── cloudinary.ts           (11 transform presets + buildImageUrl)
│   ├── nav-data.tsx            (sidebar groups — single source)
│   ├── apps.ts  app-icons.ts  brand-icons.tsx
│   ├── blog.ts                 (firebase-admin server-side fetch)
│   ├── search/                 (universal search + fuse + semantic)
│   ├── vn2000.ts               (Helmert 7-param)
│   ├── cert-bxd163.ts          ← PHASE 19.21 (BXD 163 loader)
│   ├── notification-prefs.ts   ← PHASE 19.22 (notif prefs)
│   ├── activity-log.ts  analytics.ts  error-report.ts  vn-calendar.ts  ...
│
└── public/
    ├── bridges-vn.json         (1.8MB)
    ├── qc41-signs.json         (36KB)
    ├── cert-bxd163.json        ← PHASE 19.21 (3.8MB)
    └── icons/  fonts/  og/  manifest.json  service-worker.js
```

---

## 🛠 LỆNH HAY DÙNG

```bash
cd website

# Dev local
pnpm dev          # localhost:3000

# Build kiểm tra (luôn chạy trước khi push)
pnpm build

# Lint
pnpm lint

# Deploy Vercel (auto từ git push main)
git push origin main
```

Deploy Firestore rules / indexes (chỉ admin):
```
scripts\DEPLOY-RULES.bat
```

---

## ⏳ TASK CÒN LẠI (DEPEND VÀO TRÍ)

### Cần Trí cung cấp source:
- **600 câu lái xe có đáp án:** PDF Trí gửi là image-based, sandbox không OCR được tiếng Việt. Cần file Word / Excel / TXT có đáp án. Hoặc Trí kiếm bộ JSON ở trang gplx.app.vn / tracuuphapluat.info.
- **250 câu moto:** Có text rồi, nhưng PDF không có đáp án. Cần file đáp án riêng.
- **Tiếng Anh chuẩn TOEIC/IELTS:** Trí đã thống nhất tạm để demo.
- **Ảnh thật biển báo QC41:2024:** Trí sẽ upload sau qua admin panel (pattern Cloudinary signed đã có).
- **Lat/lng GPS chính xác cho 7,549 cầu:** Hiện jitter quanh trung tâm 63 tỉnh ±0.15°. Geocoding với Gemini API (key đã có) là phase sau.

### Cần code (Phase 20+ — chưa làm):
- **FCM thực sự gửi push notification:** notification-prefs đã lưu vào Firestore, chưa có Cloud Function đọc + push. Cần `firebase-tools` + service worker `firebase-messaging-sw.js` + Functions.
- **Admin UI CRUD:** thêm câu hỏi BXD 163 mới khi BQĐ ban hành QĐ bổ sung; thêm định mức / quy chuẩn / vật liệu mới qua admin panel (hiện tất cả đang hard-code TS files).
- **Bookmark/favorite:** lưu biển báo / câu hỏi để ôn lại.
- **Lịch sử thi:** lưu kết quả các lần thi vào Firestore `/users/{uid}/exam-history`.
- **Leaderboard:** tuần / tháng cho mỗi loại đề.
- **i18n (vi/en):** placeholder ở /settings rồi, chưa wire next-intl.

---

## 📐 PATTERN + GOTCHAS QUAN TRỌNG

### Cloudinary upload
- Folder `avatar` / `temp` cho mọi user signed-in
- Folder `sign` / `bridge` / `post` chỉ admin
- Avatar tự `public_id = avatar/{uid}` để overwrite (không tốn quota)
- 11 transform presets ở `lib/cloudinary.ts`

### Firestore rules
- Mọi mutate qua Firestore phải pass `firestore.rules` đã deploy
- Indexes ở `firestore.indexes.json` — có 1 fieldOverride cho events.createdAt (COLLECTION_GROUP ASC + DESC) để fix admin dashboard
- Firebase Storage **không dùng** (Spark plan disable Storage). Toàn bộ ảnh qua Cloudinary.

### Static client pages cần metadata
- File `'use client'` không được export `metadata`
- Solution: tạo `layout.tsx` server component cùng folder, export metadata ở đó, return `{children}`
- Đã làm cho 7 routes mới (Phase 19.20)

### LocalStorage trong Next.js 14
- Không gọi `window.localStorage` ở module-scope hoặc render đầu (sẽ lỗi SSR)
- Luôn wrap trong `useEffect` hoặc event handler
- Pattern check `typeof window === 'undefined'` cho lazy init useState

### Big JSON data
- `bridges-vn.json` (1.8MB), `cert-bxd163.json` (3.8MB), `qc41-signs.json` (36KB)
- Đặt ở `/public/`, lazy fetch với `cache: 'force-cache'`
- Có `loading.tsx` skeleton cho `/cau-vn` + `/bien-bao` + `/on-thi-chung-chi`
- Vercel tự gzip/Brotli, nhưng request đầu vẫn ~1-2s trên 3G

### Mobile responsive checklist
- Container: `max-w-{size} mx-auto px-6`
- Grid: `grid-cols-1 md:grid-cols-2/3` (đừng để `grid-cols-3` không có prefix)
- Filter chips: `flex flex-wrap gap-2`
- Modal: `max-w-xl w-full max-h-[85vh] overflow-y-auto`
- Table: bọc `<div className="overflow-x-auto -mx-6 px-6">` + `min-w-{N}px` + `whitespace-nowrap` cho cột số
- Button height ≥ 36px (h-9, h-10)

### Vietnamese font + diacritics
- Be Vietnam Pro qua Next.js font với subsets `['latin', 'vietnamese']`
- Helper `foldVietnamese()` ở `@trishteam/core/search` để bỏ dấu cho fuzzy match

### Theme variables (KHÔNG hard-code màu)
- `var(--color-text-primary)` `var(--color-text-secondary)` `var(--color-text-muted)`
- `var(--color-surface-card)` `var(--color-surface-bg_elevated)` `var(--color-surface-muted)`
- `var(--color-accent-primary)` `var(--color-accent-soft)` `var(--color-accent-gradient)`
- `var(--color-border-default)` `var(--color-border-subtle)`
- Auto đổi theo `data-theme="dark"` / `"light"` ở `<html>`

---

## 🔑 ENV VARS (đã có ở `.env.local`)

```
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=trishteam
CLOUDINARY_API_KEY=995127162844417
CLOUDINARY_API_SECRET=EN6YTQYNGnzlwq12WOx0QjXXU5o
NEXT_PUBLIC_FIREBASE_*= (6 keys)
GOOGLE_APPLICATION_CREDENTIALS=../secrets/service-account.json
GOOGLE_AI_API_KEY=AIzaSyCnEenaSyKX2bGEbbBz63YfPVIfXbQSPyU
TELEGRAM_BOT_TOKEN=...  TELEGRAM_CHAT_ID=...
```

---

## 🚦 RULES BẮT BUỘC

### Đầu phiên mới
1. Trí gõ `tiếp tục` hoặc `pick up` → đọc file này TRƯỚC, không hỏi gì khác
2. Tóm tắt 2-3 dòng "đang ở đâu" rồi propose action

### Cuối phiên
1. Trước khi Trí bấm `END.bat` → update lại file này:
   - Mark task hoàn thành ở Phase 19.22 nếu Trí test xong → đổi tiêu đề thêm "DEPLOYED"
   - Thêm Phase mới (19.23, 20.0, ...) nếu có
   - Cập nhật "PICK UP TỪ ĐÂY" cho phiên kế

### Giao tiếp
- **Luôn dùng tiếng Việt**
- Trí không phải dev — tránh jargon dồn dập, giải thích "tại sao" trước khi giải thích "làm thế nào"
- Trí thường ngắn gọn, dùng "tiếp tục", "ok rồi" — đó là confirm, cứ chạy tiếp
- Khi Trí hỏi "còn gì nữa không" → liệt kê option theo độ ưu tiên cho Trí chọn

### Không tự ý làm
- Đừng tự deploy production khi chưa được confirm
- Đừng xóa file legacy mà chưa hỏi
- Đừng tự sửa source data Trí cung cấp (PDF, JSON) — chỉ parse, không bịa

---

## 📝 LỊCH SỬ PHASE 19 NGẮN GỌN

| Phase | Nội dung | Ngày |
|---|---|---|
| 19.1 | Slim homepage, đổi sidebar, gỡ 8 widget | trước |
| 19.5 | Quiz lái xe MVP (30 câu) | trước |
| 19.6 | Quiz cert XD MVP (20 câu) | trước |
| 19.10 | Custom 404 + sidebar refactor + nav-data | trước |
| 19.12 | Migrate ảnh từ Storage → Cloudinary, avatar uploader | trước |
| 19.15 | Hide sidebar khi guest, block trial users | trước |
| 19.17 | TopNav: bỏ blog/download/ung-ho khỏi sidebar | trước |
| 19.18 | Admin button trên TopNav | trước |
| 19.20 | **6 database + study apps** (quy-chuan, dinh-muc, vat-lieu, duong-vn, tin-hoc-vp, tieng-anh + vn2000 + cert/bridge loading + sitemap + metadata layouts + Ctrl+K index) | 28/04 cơ quan |
| 19.21 | **BXD 163/2025 cert exam** (parse 8081 câu, lib/cert-bxd163, rewrite /on-thi-chung-chi) | 28/04 cơ quan |
| 19.22 | **Polish** (homepage Database showcase + SiteFooter, 404 quick links, notification preferences UI, mobile dinh-muc table fix, code review pass) | 28/04 cơ quan |

---

## 🧪 TEST CHECKLIST CUỐI PHIÊN (cho phiên nhà)

Phiên này deploy thì đánh ✅:

- [ ] `pnpm build` pass không lỗi TS
- [ ] `/on-thi-chung-chi` picker 3 bước hiển thị đúng + chọn được + start exam được
- [ ] `/on-thi-chung-chi` quiz state machine: trả lời, jump dot, prev/next, submit
- [ ] `/on-thi-chung-chi` resume: làm dở, F5, vẫn còn state
- [ ] `/dinh-muc` modal table mobile (Chrome devtools 375px) scroll ngang được
- [ ] `/profile` upload avatar PNG/JPG → hiện ngay
- [ ] `/settings` notification toggle → save vào Firestore (kiểm tra Firebase console)
- [ ] Homepage `/` hiện DatabaseShowcase 6 thẻ + footer 4 cột
- [ ] `/quy-chuan` `/vat-lieu` `/duong-vn` `/tin-hoc-vp` `/tieng-anh` mở được, search hoạt động
- [ ] Ctrl+K mở command palette → search "định mức" / "QCVN" / "VN2000" có kết quả
- [ ] `/sitemap.xml` có route mới
- [ ] Vercel deploy thành công sau git push

Sau khi pass hết → bấm `END.bat` → kết phiên.
