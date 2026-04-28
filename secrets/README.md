# secrets/

Folder chứa credentials nhạy cảm — KHÔNG commit ra GitHub (xem `.gitignore`).

## Files cần thiết

### `service-account.json`
Firebase Admin SDK service account.

**Cách lấy**:
1. Vào Firebase Console: https://console.firebase.google.com/project/trishteam-17c2d/settings/serviceaccounts/adminsdk
2. Click **"Generate new private key"**
3. Download file JSON
4. Đổi tên → `service-account.json`
5. Đặt vào folder này

**Dùng để**: server-side verify Firebase ID token trong `/api/cloudinary/sign`,
`/api/admin/*`, `/api/errors`, `/api/vitals`.

## Production (Vercel)

Trên Vercel KHÔNG dùng file này — paste **toàn bộ nội dung JSON** vào env var
`FIREBASE_SERVICE_ACCOUNT` (raw JSON hoặc base64). Xem `lib/firebase-admin.ts`.
