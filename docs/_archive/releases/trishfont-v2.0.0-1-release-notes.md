# TrishFont v2.0.0-1 — Font Manager + FontPack

**TrishTEAM ecosystem · App 2/9 · 2026-04-25**

Quản lý + cài đặt font tiếng Việt + AutoCAD + Unicode chuyên nghiệp. Tải nhanh các bộ font đã được TrishTEAM kiểm tra qua FontPack remote (1 click — tự download + giải nén + cài).

---

## Tải về

| Installer | File | SHA256 |
|---|---|---|
| **NSIS Installer (khuyên dùng)** | `TrishFont_2.0.0-1_x64-setup.exe` | `1944c3a7c8f584cba0ac9cce9f22326ffc071318f2ebcf5808b6de8c27c830b3` |
| MSI English | `TrishFont_2.0.0-1_x64_en-US.msi` | `c4801b79f42995edad608441738a5b82de1c54a93a032d855a452e6b83fa11b0` |
| MSI Vietnamese | `TrishFont_2.0.0-1_x64_vi-VN.msi` | `2c10d1274297d0d7e8de113042efe4e553d554b2595ad7fc6829dd53923a9240` |

**Verify** (PowerShell):
```powershell
Get-FileHash TrishFont_2.0.0-1_x64-setup.exe -Algorithm SHA256
```

---

## Tính năng chính

### 1. FontPack TrishTEAM (tab mặc định)
- Fetch manifest từ repo `trishnexus-fontpacks` trên GitHub
- 1 click tải pack → tự download zip → SHA256 verify → giải nén ra folder cá nhân
- Pack chứa cả font Windows (`.ttf` / `.otf` / `.ttc`) lẫn AutoCAD (`.shx`)
- Detail panel: tick từng file hoặc cả folder để cài chọn lọc

### 2. Cài font thủ công
- Quét folder bất kỳ → preview font live (FontFace API browser)
- Filter theo: VN-support / Serif / Sans / Mono
- Search theo tên family
- **Cài hàng loạt**: tick các font → bấm `⬇ Cài đã tick` → cài batch (.ttf vào Windows, .shx vào AutoCAD)
- **Export ra folder**: copy file font ra folder bất kỳ để chia sẻ team

### 3. Font hệ thống
- Auto-scan `C:\Windows\Fonts` (+ user fonts)
- Hiện dạng compact list 2000+ font không lag
- Export ra folder để backup hoặc chia sẻ

### 4. Cài đặt thực sự (system-wide)
- Copy font vào `C:\Windows\Fonts` (cài cho mọi user)
- Đăng ký trong registry `HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Fonts`
- Broadcast `WM_FONTCHANGE` để các app đang chạy refresh
- Font `.shx` AutoCAD: tự copy vào `C:\Program Files\Autodesk\AutoCAD <ver>\Fonts\` (auto-detect version)
- **Yêu cầu Administrator** — nếu chưa, đóng app rồi chuột phải → Run as administrator

### 5. Settings
- Theme: Light / Dark / System
- Ngôn ngữ: Tiếng Việt (mặc định) / English
- Quản lý folder fontpack đã tải (size + clear button)
- Kiểm tra cập nhật phiên bản mới

### 6. Process log terminal-style
- Cố định cuối app, hiển thị tiến trình cài/export từng file
- Timestamp + level (✓ ok / ✗ fail / · info)
- Clear log thủ công

---

## Yêu cầu hệ thống

- Windows 10/11 x64
- Administrator privilege khi muốn cài font hệ thống
- ~30 MB dung lượng (chưa kể fontpack)
- Internet (cho FontPack feature + check update)

---

## Cài đặt

1. Tải `TrishFont_2.0.0-1_x64-setup.exe` ở mục Assets bên dưới
2. Chạy installer (Windows có thể cảnh báo SmartScreen — chọn "More info" → "Run anyway")
3. Sau khi cài, **chuột phải shortcut → Run as administrator** để có quyền ghi `C:\Windows\Fonts`
4. Topbar sẽ hiện badge `🛡 Admin` nếu có quyền, hoặc `⚠ Không Admin` nếu chưa

---

## Changelog từ alpha

- **15.1.a-f** Setup base: Tauri 2 + React, Rust install_font command, scan folder + system fonts, FontFace preview, i18n VN/EN
- **15.1.h-i** FontPack feature: manifest fetch, zip download + SHA verify + extract, file list selective install
- **15.1.j-k** UX polish: compact cards, color theme, file lock retry, process log
- **15.1.l-m** Sticky header, log layout, export to folder, **system-wide install** (HKLM), folder grouping
- **15.1.n** Window 1280×900, topbar redesign (admin badge), folder select-all
- **15.1.o** Log fixed bottom, Settings pack management, update check
- **15.1.p** Bulk install button cho tab Library, fix confirm dialog message

---

## Known issues

- Bạn cần Run as administrator để cài font hệ thống (yêu cầu Windows, không khắc phục được)
- macOS / Linux build chưa available — focus Windows trước
- AutoCAD detect tự động qua registry: nếu không tìm thấy AutoCAD, font `.shx` sẽ không cài

---

## Verify checksum

Tải file `SHA256SUMS.txt` và chạy:

```powershell
Get-Content SHA256SUMS.txt
Get-FileHash *.exe,*.msi -Algorithm SHA256 | ForEach-Object { "$($_.Hash.ToLower())  $($_.Path | Split-Path -Leaf)" }
```

So sánh 2 output — phải khớp.

---

🛠 **Built with**: Tauri 2 · React · TypeScript · Rust · ttf-parser · winreg
🔗 **Source**: https://github.com/hosytri07/trishnexus-monorepo
🌐 **TrishTEAM**: https://trishteam.io.vn
