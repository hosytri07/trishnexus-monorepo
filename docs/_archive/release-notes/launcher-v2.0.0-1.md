# TrishLauncher v2.0.0-1 (alpha)

Bản alpha đầu tiên của **TrishLauncher** viết lại bằng Tauri 2 + React,
thay thế bản Qt/Python cũ. Launcher là cổng vào hệ sinh thái TrishTEAM —
cài đặt, cập nhật và khởi chạy 9 ứng dụng desktop trong một giao diện.

## Điểm chính

- Danh sách 9 app ecosystem (TrishFont, TrishNote, TrishClean, TrishCheck,
  TrishType, TrishImage, TrishLibrary, TrishSearch, TrishDesign).
- **System tray** với Quick Launch menu (pin tối đa 5 app).
- **Registry loader**: fetch `apps-registry.json` từ
  `https://trishteam.io.vn/apps-registry.json`, fallback SEED local khi
  offline.
- **Auto-update scheduler**: 5 / 15 / 60 phút hoặc tắt hoàn toàn.
- Dark / Light / Auto theme, i18n VN / EN, persist qua `localStorage`.
- Per-machine install (MSI) và per-user install (NSIS) cho Windows.

## Tải về

| File | Dùng cho |
| --- | --- |
| `TrishLauncher_2.0.0-1_x64-setup.exe` | **Khuyến nghị** — NSIS, có dialog chọn ngôn ngữ VN/EN |
| `TrishLauncher_2.0.0-1_x64_en-US.msi` | Enterprise deploy (GPO / SCCM) — tiếng Anh |
| `TrishLauncher_2.0.0-1_x64_vi-VN.msi` | Enterprise deploy — tiếng Việt |
| `SHA256SUMS.txt` | Checksum của cả 3 installer |

Xem thêm: https://trishteam.io.vn/downloads

## Checksum

```
d86089cd714ff11f8db9c3e8f1dfc6a60e83c2bc1bff0e6ff185439ed07f2b1f  TrishLauncher_2.0.0-1_x64-setup.exe
87503f938778f2a7d10a226e5df37f10bc11a398341942f1705af2844aed8196  TrishLauncher_2.0.0-1_x64_en-US.msi
1038224a91078ab8ecaa9a718f02a2cd5258b286648db32e69c35dcd883a4c3e  TrishLauncher_2.0.0-1_x64_vi-VN.msi
```

Verify:

```powershell
# Windows
Get-FileHash .\TrishLauncher_2.0.0-1_x64-setup.exe -Algorithm SHA256
```

```bash
# macOS / Linux
shasum -a 256 TrishLauncher_2.0.0-1_*.msi
```

## Đã biết

- **Chưa code-sign** → Windows SmartScreen sẽ cảnh báo "Windows protected
  your PC". Bấm _More info → Run anyway_ để tiếp tục. Đang cân nhắc mua EV
  Code Signing certificate cho bản stable.
- macOS / Linux build chưa có — sẽ bổ sung qua CI khi có runner tương ứng.
- Tất cả 9 app con đang ở trạng thái **"Sắp ra mắt"**. Nút Install/Launch
  trong Launcher hiển thị "Sắp ra mắt" và bị vô hiệu hoá — đây là chủ đích,
  không phải bug.
- Registry có thể show badge "Đang dùng bản seed" khi fetch
  `apps-registry.json` thất bại (offline, DNS, firewall). Launcher vẫn
  hoạt động bình thường.

## Phase kế tiếp

- 14.8 — CI macOS/Linux + auto-publish asset vào release này.
- 15.x — Phát hành app con đầu tiên (TrishFont 2.0.0), bật trạng thái
  "Đã phát hành" cho TrishFont trong registry.

---

_Build trên windows-latest (CI) hoặc máy local với Rust 1.77+ và pnpm
9.15. MSI yêu cầu pre-release identifier numeric-only, vì vậy version là
`2.0.0-1` thay vì `2.0.0-alpha.1`._
