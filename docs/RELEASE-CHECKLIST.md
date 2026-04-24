# Release Checklist — TrishTEAM (Phase 11.9)

Checklist chạy tuần tự trước khi public trishteam.vercel.app (hoặc domain
riêng). Mỗi mục là một pass/fail rõ ràng — đánh dấu khi hoàn tất.

---

## 1. Data reset (wipe test users)

- [ ] Đã backup Firestore (gcloud firestore export hoặc Firebase Console).
- [ ] Chạy script reset từ `scripts/firebase/`:
  ```bash
  cd scripts/firebase
  GOOGLE_APPLICATION_CREDENTIALS=../../secrets/service-account.json \
    npm run release:reset -- --i-know-what-im-doing
  ```
- [ ] Confirm 2 account keep-list vẫn đăng nhập được:
  - `hosytri77@gmail.com` (role admin)
  - `trishteam.official@gmail.com` (role admin)
- [ ] Firestore Console kiểm tra:
  - `/users/` chỉ còn 2 doc keep-list.
  - `/users/{uid}/events` và `/users/{uid}/progress` đã rỗng.
  - `/announcements/` có đúng 1 welcome announcement.
  - `/feedback`, `/audit`, `/posts`, `/notes/*` rỗng.

## 2. Firebase production config

- [ ] `.env` production đã set 6 biến `NEXT_PUBLIC_FIREBASE_*`.
- [ ] `FIREBASE_SERVICE_ACCOUNT` (base64 hoặc JSON) set trên Vercel/host.
- [ ] Authorized domains thêm domain production trong Firebase Auth settings.
- [ ] Firestore rules đã deploy bản mới nhất:
  ```bash
  firebase deploy --only firestore:rules,firestore:indexes
  ```
- [ ] Indexes `events` (kind + createdAt DESC) + `announcements` (active +
      startAt DESC) đã build xong (Firebase Console → Indexes).

## 3. PWA + icon + manifest

- [ ] `public/icons/icon-192.png`, `icon-512.png`, `icon-maskable-512.png`,
      `apple-touch-icon.png` render đúng.
- [ ] `/manifest.json` reachable, Chrome DevTools → Application → Manifest
      không còn warning (name, short_name, icons, theme_color).
- [ ] Install dialog xuất hiện ở Chrome/Edge desktop + Android.
- [ ] iOS Safari: "Add to Home Screen" hiển thị apple-touch-icon.
- [ ] `sw.js` activate thành công (Application → Service Workers → status
      "activated and running").
- [ ] Offline test: DevTools → Network → Offline → reload `/` → rơi vào
      `/offline` page + nút "Thử lại" hoạt động khi online lại.

## 4. Auth flow smoke test

- [ ] Guest → `/` hiển thị full dashboard, Activity widget pre-auth CTA.
- [ ] Register (email/password) → profile doc tạo đủ fullName + phone.
- [ ] Login email/password → redirect về dashboard, avatar hiện.
- [ ] Login Google OAuth → profile auto-create khi new user.
- [ ] Password reset email gửi thành công.
- [ ] Logout → state reset về guest.

## 5. Admin backend smoke test

- [ ] Login bằng admin → navbar có badge shield + link "/admin".
- [ ] `/admin` dashboard hiển thị đủ 4 stat card (users, admins,
      announcements active, events 24h).
- [ ] `/admin/users`:
  - Search hoạt động.
  - Toggle role user → admin (gọi API `/api/admin/set-role`) thành công,
    target user logout-login sẽ thấy `/admin` accessible.
  - Self-demote bị chặn 422.
- [ ] `/admin/announcements`: compose + publish → banner xuất hiện ở
      dashboard cho tất cả user.
- [ ] `/admin/audit`: lọc theo kind, resolve email lazy load.
- [ ] User thường truy cập `/admin` → 403 page (không crash).

## 6. Activity + Sync smoke test

- [ ] Login event ghi vào `/users/{uid}/events`.
- [ ] QuickNotes: đánh trên device A → device B (cùng account) hiện
      cùng nội dung sau ~1s.
- [ ] Activity widget hiển thị event mới realtime (không cần reload).
- [ ] Throttle note_update: chỉnh sửa liên tục không spam event (max
      1 event/giờ).

## 7. Build + performance

- [ ] `npm run build` ở `website/` success, 0 warning.
- [ ] `npx tsc --noEmit -p website/` pass.
- [ ] `npm run lint` pass (nếu có eslint config).
- [ ] Lighthouse PWA audit > 90 (installable, theme-color, icons).
- [ ] Lighthouse Performance > 80 mobile, > 90 desktop.
- [ ] Bundle analyzer: không có dep lớn bất thường (>500KB gz).

## 8. SEO + meta

- [ ] `metadata.title` + `description` ở layout.tsx đúng branding.
- [ ] Open Graph image có (Phase 16 nếu chưa).
- [ ] `robots.txt` + `sitemap.xml` (Phase 16).
- [ ] Favicon hiển thị ở mọi browser tab.

## 9. Domain + SSL

- [ ] Custom domain (nếu có) đã verify trong Vercel + Firebase Auth.
- [ ] HTTPS redirect hoạt động, HSTS enable.
- [ ] DNS CAA record trỏ đúng provider (nếu dùng).

## 10. Announcement ra mắt

- [ ] Soạn 1 announcement "Chào mừng đến TrishTEAM" ở `/admin/announcements`.
- [ ] Post Facebook/Zalo link dashboard.
- [ ] Gửi email cho friends list từ `/trishteam.official@gmail.com`.

---

**Kí release:** _______ (Trí)   **Ngày:** _______
