# Firebase Auth + Firestore — Setup Guide (Phase 11.6)

Tài liệu hướng dẫn Trí cấu hình Firebase cho TrishTEAM website. Làm theo
lần lượt từng phần — mất khoảng 15 phút.

---

## 1. Tạo Firebase project

1. Vào <https://console.firebase.google.com/> → **Add project**.
2. Đặt tên `trishteam-prod` (hoặc tuỳ ý). Chọn region gần Việt Nam nhất:
   `asia-southeast1` (Singapore) hoặc `asia-east1` (Đài Loan).
3. Bật Google Analytics: có thể bỏ (không cần cho MVP).

## 2. Thêm Web app

1. Trong project → icon bánh răng → **Project settings** → tab **General**.
2. Cuộn xuống **Your apps** → bấm icon `</>` để add Web app.
3. Nickname: `trishteam-website`. KHÔNG tick "Firebase Hosting".
4. Copy `firebaseConfig` snippet xuất hiện — chỉ cần 6 giá trị.

## 3. Điền `.env.local` ở `website/`

```bash
cp website/.env.example website/.env.local
```

Mở `website/.env.local` và điền:

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=trishteam-prod.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=trishteam-prod
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=trishteam-prod.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=1234567890
NEXT_PUBLIC_FIREBASE_APP_ID=1:1234567890:web:abcdef1234
```

Restart `npm run dev` để Next.js reload env.

## 4. Bật Authentication providers

Firebase Console → **Authentication** → tab **Sign-in method**:

| Provider | Bật | Ghi chú |
|----------|-----|---------|
| Email/Password | ✅ | Bật cả "Email link (passwordless)" nếu muốn |
| Google | ✅ | Project support email: `hosytri77@gmail.com` |
| Facebook | tuỳ chọn | Cần App ID + App Secret từ Facebook Developers |
| GitHub | tuỳ chọn | Cần OAuth app ở github.com/settings/developers |

Trên tab **Settings → Authorized domains**, thêm:
- `localhost` (sẵn có)
- Domain Vercel production (ví dụ `trishteam.vercel.app`)
- Custom domain nếu có (`trishteam.vn`)

## 5. Deploy Firestore rules + indexes

Cần Firebase CLI: `npm install -g firebase-tools`.

```bash
cd trishnexus-monorepo
firebase login
firebase use --add        # chọn project trishteam-prod
firebase deploy --only firestore:rules,firestore:indexes
```

File rules nằm ở `firestore.rules`, indexes ở `firestore.indexes.json`.

## 6. Tạo admin account đầu tiên

1. Vào web TrishTEAM bằng trình duyệt → `/login` → Đăng ký với email
   của Trí (`hosytri77@gmail.com`). Lúc này role mặc định là `user`.
2. Download service account key:
   - Firebase Console → Project settings → tab **Service accounts** →
     **Generate new private key** → lưu file JSON vào
     `./secrets/service-account.json` (KHÔNG commit lên git).
3. Cài deps cho scripts:

```bash
cd scripts/firebase
npm install
```

4. Chạy seed:

```bash
GOOGLE_APPLICATION_CREDENTIALS=../../secrets/service-account.json \
  npm run seed:admin -- --email hosytri77@gmail.com
```

5. Logout rồi login lại trên web → account đã là admin (custom claim
   `admin:true` + Firestore `role:'admin'`).

## 7. Kiểm tra

- Vào web `/login`: thử đăng ký user mới, check Firestore có doc mới
  trong `/users/{uid}` với đủ fullName + phone.
- Vào navbar: avatar Admin có badge shield → menu admin hiện ra.
- Từ chế độ mock (role switcher): set `NEXT_PUBLIC_AUTH_MOCK=1` ở
  `.env.local` để bypass Firebase — dev offline vẫn chạy.

## 7.5. (Tuỳ chọn) Admin SDK cho API route `/api/admin/set-role`

Nếu muốn đổi role user trực tiếp từ UI `/admin/users` thay vì chạy CLI
`seed-admin.ts`, cần cấp service account JSON cho server Next.js.

**Dev local:** đã có file `./secrets/service-account.json` sau bước 6,
set biến `GOOGLE_APPLICATION_CREDENTIALS=./secrets/service-account.json`
trong `website/.env.local` là chạy được.

**Vercel / Firebase Hosting:** paste nội dung JSON (hoặc base64 của nó)
vào env var `FIREBASE_SERVICE_ACCOUNT`:

```bash
# Bash: convert sang 1-line rồi paste vào Vercel dashboard
cat ./secrets/service-account.json | base64 -w 0
```

Nếu 2 env này không có → API route trả về 501, UI tự fallback chỉ update
Firestore doc (custom claim cần rerun seed CLI).

## 8. Release reset (Phase 11.9, trước khi public)

Khi chuẩn bị release chính thức, wipe data test:

```bash
cd scripts/firebase
GOOGLE_APPLICATION_CREDENTIALS=../../secrets/service-account.json \
  npm run release:reset -- --i-know-what-im-doing
```

Script sẽ:
- Xoá toàn bộ Firebase Auth users (trừ `hosytri77@gmail.com` +
  `trishteam.official@gmail.com`).
- Truncate các collection `/users`, `/announcements`, `/feedback`,
  `/audit`, `/posts`, và toàn bộ `/notes/{uid}/items`.
- Re-seed profile admin cho các keep-list.
- Seed 1 welcome announcement.

Flag `--i-know-what-im-doing` + prompt xác nhận "yes" là hai rào chặn
để tránh chạy nhầm.

## 9. Sự cố thường gặp

| Triệu chứng | Nguyên nhân | Fix |
|-------------|-------------|-----|
| Login báo "Chưa cấu hình Firebase" | thiếu `.env.local` | Làm lại bước 3, restart dev |
| Không gửi được password reset | chưa bật Email provider | Bước 4 |
| 403 Permission denied khi ghi /users | role rule sai | `firebase deploy --only firestore:rules` lại |
| Google OAuth popup đóng ngay | domain chưa auth | Thêm domain vào "Authorized domains" bước 4 |
| Custom claim `admin` không có hiệu lực | chưa logout-login lại | Logout + login, token sẽ refresh |
