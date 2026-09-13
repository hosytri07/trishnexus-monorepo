# TrishFinance — Build APK Android (Tauri 2) — hướng dẫn máy anh Trí

App Android dùng CHÍNH code TrishFinance hiện tại (identifier
vn.trishteam.finance). Dữ liệu đồng bộ qua đám mây theo tài khoản (đã làm
02-09: finance_sync/{uid}) — điện thoại và desktop thấy cùng một sổ.

## 0. Điều kiện MỘT LẦN (cài trên máy Windows)
1. **Android Studio** (https://developer.android.com/studio) — cài xong mở
   SDK Manager, tick: Android SDK Platform 34, SDK Build-Tools,
   **NDK (Side by side)**, **Android SDK Command-line Tools**, CMake.
2. Biến môi trường (PowerShell chạy Admin, sửa đường dẫn theo máy):
   ```powershell
   [Environment]::SetEnvironmentVariable('ANDROID_HOME', "$env:LOCALAPPDATA\Android\Sdk", 'User')
   [Environment]::SetEnvironmentVariable('NDK_HOME', "$env:LOCALAPPDATA\Android\Sdk\ndk\<phiên bản NDK>", 'User')
   ```
   (mở PowerShell mới sau khi đặt).
3. **Rust target Android** (một lần):
   ```powershell
   rustup target add aarch64-linux-android armv7-linux-androideabi x86_64-linux-android i686-linux-android
   ```
4. Java: Android Studio kèm JBR sẵn — nếu build kêu thiếu JAVA_HOME thì trỏ
   vào `...\Android Studio\jbr`.

## 1. Sinh project Android (MỘT LẦN)
```powershell
cd C:\Users\ADMIN\Documents\Claude\Projects\TrishTEAM\trishnexus-monorepo
pnpm --filter @trishteam/trishfinance tauri android init
```
→ sinh `apps-desktop/trishfinance/src-tauri/gen/android` (commit vào git).

## 2. Chạy thử trên điện thoại (cắm USB, bật Gỡ lỗi USB)
```powershell
pnpm --filter @trishteam/trishfinance tauri android dev
```

## 3. Build APK phát cho mình
```powershell
pnpm --filter @trishteam/trishfinance tauri android build --apk --target aarch64
```
→ APK ở `src-tauri/gen/android/app/build/outputs/apk/universal/release/`.
Bản release cần KÝ: lần đầu tạo keystore
```powershell
keytool -genkey -v -keystore $HOME\.android\trishfinance.keystore -alias trishfinance -keyalg RSA -keysize 2048 -validity 10000
```
rồi khai trong `gen/android/app/build.gradle.kts` (signingConfigs) hoặc build
`--apk --debug` để thử nhanh (APK debug cài được ngay, không cần keystore).

## 4. Cài lên điện thoại
Chép APK qua Zalo/USB → mở file → cho phép "cài từ nguồn không xác định".
Đăng nhập cùng tài khoản TrishFinance → app tự kéo dữ liệu về.

## Ghi chú
- Bản web PWA (Vercel, build:web) vẫn là đường dự phòng: mở trên điện thoại,
  đăng nhập là có cùng dữ liệu — không cần cài gì.
- Trước khi dùng đồng bộ: `firebase deploy --only firestore:rules` trong
  trishnexus-monorepo (rule finance_sync mới thêm 02-09).
