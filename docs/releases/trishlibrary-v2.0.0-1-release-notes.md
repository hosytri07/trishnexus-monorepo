# TrishLibrary v2.0.0-1 — Document Library + AI Tags + Cite APA/IEEE

**TrishTEAM ecosystem · App 3/9 · 2026-04-25**

Quản lý thư viện sách / PDF / EPUB / Word local-first, gán tag tự động bằng AI heuristic, tạo trích dẫn APA 7 / IEEE chỉ với 1 click. Không cloud, không tracking, không tài khoản.

---

## Tải về

| Installer | File | SHA256 |
|---|---|---|
| **NSIS Installer (khuyên dùng)** | `TrishLibrary_2.0.0-1_x64-setup.exe` | _xem `SHA256SUMS.txt`_ |
| MSI English | `TrishLibrary_2.0.0-1_x64_en-US.msi` | _xem `SHA256SUMS.txt`_ |
| MSI Vietnamese | `TrishLibrary_2.0.0-1_x64_vi-VN.msi` | _xem `SHA256SUMS.txt`_ |

**Verify** (PowerShell):
```powershell
Get-FileHash TrishLibrary_2.0.0-1_x64-setup.exe -Algorithm SHA256
```

---

## Tính năng chính

### 1. Quét folder + auto enrich
- Chọn 1 thư mục bất kỳ → recursive scan (bỏ `node_modules`, `.git`, `target`, `$RECYCLE.BIN`)
- Whitelist 10 extension: PDF, DOCX, DOC, EPUB, TXT, MD, HTML, RTF, ODT
- Merge thông minh: path trùng → chỉ update size + mtime, giữ nguyên metadata user đã chỉnh

### 2. Tag AI auto-suggest
- 3 nguồn chấm điểm: keyword rules built-in (TCVN/luật/xây dựng/code/tiếng Việt/...), co-occurrence với tag đã có (log-scale), format fallback (PDF→pdf, EPUB→sách, ...)
- Tooltip hiện điểm + lý do gợi ý
- Click 1 phát để gắn

### 3. Cite generator APA 7 / IEEE
- Switch style bằng pill APA ↔ IEEE
- Bấm **Trích dẫn (N)** → modal liệt kê citation cho list đang lọc
- Copy cả block vào clipboard

### 4. 4 trạng thái đọc
- `Chưa đọc` / `Đang đọc` / `Đã đọc xong` / `Bỏ dở`
- Border-left màu theo status

### 5. Auto-save 400ms debounce
- Mọi thay đổi tự ghi file `library.json` local
- Atomic write tmp + rename, cap 20 MiB
- Indicator "đang lưu…" hiện ở topbar

### 6. Mở file bằng OS default app
- Bấm **🔗 Mở file** → tauri-plugin-opener gọi Acrobat / Word / Calibre / ...

### 7. Settings + i18n
- Theme: Sáng / Tối / Theo hệ thống
- Ngôn ngữ: Tiếng Việt (mặc định) / English
- Kiểm tra cập nhật phiên bản mới qua TrishTEAM registry

### 8. Storage
- Windows: `%LocalAppData%\TrishTEAM\TrishLibrary\library.json`
- macOS: `~/Library/Application Support/TrishTEAM/TrishLibrary/library.json`
- Linux: `~/.local/share/TrishTEAM/TrishLibrary/library.json`

---

## Yêu cầu hệ thống

- Windows 10/11 x64
- ~30 MB dung lượng (chưa kể file metadata)
- Không cần Internet (chỉ cần khi check update)

---

## Cài đặt

1. Tải `TrishLibrary_2.0.0-1_x64-setup.exe` ở mục Assets bên dưới
2. Chạy installer (Windows có thể cảnh báo SmartScreen — chọn "More info" → "Run anyway")
3. Mở app → bấm **📂 Quét thư mục…** → chọn folder chứa sách của anh

---

## Giới hạn hiện tại (sẽ mở rộng phase sau)

- **Chưa OCR PDF scan** — Tesseract WASM dời phase sau
- **Chưa full-text search** — search chỉ match substring (Lucene/Tantivy dời TrishSearch)
- **Chưa sync cloud** — thuần local
- **Chưa highlight/annotation** — phải mở file bằng app khác
- **Chưa cover image** — chỉ có format chip
- **Cite chỉ APA 7 + IEEE** — MLA/Chicago/TCVN dời phase sau
- **Không có nested folder/collection** — phẳng, filter bằng tag

---

## Changelog từ alpha

- **15.2.a** Bump version `2.0.0-alpha.1` → `2.0.0-1`, cleanup descriptions
- **15.2.b** Settings + i18n VN/EN (~80 keys)
- **15.2.c** SettingsModal component (theme + language + update check)
- **15.2.d** NSIS multi-language config (en-US + vi-VN installer)
- **15.2.e** Logo TrishLibrary + 6 desktop icon variants
- **15.2.f** Rust `fetch_text` command + `app_version` (update check qua ecosystem registry)
- **15.2.g** Build production + GitHub Release `trishlibrary-v2.0.0-1`
- **15.2.h** Update apps-registry.json + apps-seed.ts → 3/9 apps live

Logic core (tag-suggest, cite, validate, classify, aggregate, scan) đã hoàn thiện từ Phase 14.4.2 alpha (65 tests Vitest pass).

---

🛠 **Built with**: Tauri 2 · React 18 · TypeScript · Rust · @trishteam/core/library
🔗 **Source**: https://github.com/hosytri07/trishnexus-monorepo
🌐 **TrishTEAM**: https://trishteam.io.vn
