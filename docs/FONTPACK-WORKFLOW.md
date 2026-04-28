# FontPack Workflow — Hướng dẫn admin quản lý FontPack TrishTEAM

**Phiên bản**: 1.0 · **Cập nhật**: 2026-04-25 · **Người dùng**: Trí (admin) + future TrishAdmin app

Tài liệu này mô tả quy trình **publish 1 fontpack mới** cho user TrishFont tải được. Đọc xong là tự làm được. Tương lai TrishAdmin (Phase 16+) sẽ thay quy trình tay này bằng UI CRUD upload trực tiếp.

---

## 1. Cơ chế hoạt động (Big Picture)

```
┌─────────────────────────┐                ┌──────────────────────────────┐
│  Admin (Trí)            │                │  User mở TrishFont           │
│                         │                │                              │
│  1. Soạn pack ZIP       │                │  1. Tab "Fontpack TrishTEAM" │
│  2. Upload GitHub Rel   │                │  2. App fetch manifest.json  │
│  3. Update manifest.json│ ──fetch──────► │  3. Hiện list pack           │
│  4. Push lên main       │                │  4. User bấm "Tải pack"      │
│                         │                │  5. App download zip + verify│
│  Repo: trishnexus-      │                │  6. Extract vào %APPDATA%    │
│        fontpacks        │                │  7. User cài chọn lọc        │
└─────────────────────────┘                └──────────────────────────────┘
```

**Lưu ý:** Pack ZIP để ở **GitHub Release** (binary, dung lượng lớn). Còn `manifest.json` nằm ở **branch `main`** (text, đọc qua raw URL nhanh).

---

## 2. Repo cấu trúc

GitHub repo: `https://github.com/hosytri07/trishnexus-fontpacks`

```
trishnexus-fontpacks/
├── manifest.json          ← UI TrishFont fetch file này
├── packs/                 ← (optional) source font files để build pack
│   ├── trishfont-origin/
│   │   ├── Unicode/
│   │   ├── TCVN3/
│   │   └── VNI/
│   └── autocad-fonts/
└── README.md              ← Mô tả repo
```

**Manifest URL** (hardcoded trong app, không đổi):
```
https://raw.githubusercontent.com/hosytri07/trishnexus-fontpacks/main/manifest.json
```

---

## 3. Schema manifest.json

```json
{
  "schema_version": 1,
  "updated_at": "2026-04-25",
  "packs": [
    {
      "id": "trishfont-origin",
      "name": "TrishFont Origin Pack",
      "version": "1.0.0",
      "description": "Bộ font tiếng Việt + AutoCAD đầy đủ — Unicode, TCVN3, VNI, .shx",
      "kind": "mixed",
      "size_bytes": 52428800,
      "file_count": 187,
      "tags": ["tiếng-việt", "autocad", "unicode", "tcvn3", "vni"],
      "preview_image": "",
      "download_url": "https://github.com/hosytri07/trishnexus-fontpacks/releases/download/trishfont-origin-v1.0.0/trishfont-origin.zip",
      "sha256": "abc123def456..."
    }
  ]
}
```

### Giải thích từng field

| Field | Type | Bắt buộc | Mô tả |
|---|---|---|---|
| `id` | string | ✅ | ID duy nhất, dùng làm tên folder extract. Chỉ chữ thường + dấu gạch ngang. Vd `trishfont-origin`, `autocad-2024`. **Không được trùng** với pack khác. |
| `name` | string | ✅ | Tên hiển thị cho user. Vd "TrishFont Origin Pack" |
| `version` | string | ✅ | SemVer `MAJOR.MINOR.PATCH`. Tăng version khi cập nhật pack — user sẽ thấy nút "Cập nhật" |
| `description` | string | ✅ | Mô tả ngắn 1 dòng, hiện trong card pack |
| `kind` | enum | ✅ | `windows` (chỉ .ttf/.otf), `autocad` (chỉ .shx), `mixed` (cả 2) |
| `size_bytes` | number | ✅ | Kích thước file ZIP, đơn vị bytes. Dùng để hiện dung lượng + ước lượng tải |
| `file_count` | number | ✅ | Tổng số file font trong pack. Hiện trong card |
| `tags` | string[] | ✅ | Filter/search tags. Mảng có thể rỗng `[]` |
| `preview_image` | string | ❌ | URL ảnh preview pack. Có thể để `""` |
| `download_url` | string | ✅ | URL ZIP trên GitHub Release. Format: `https://github.com/<user>/<repo>/releases/download/<tag>/<file.zip>` |
| `sha256` | string | ✅ | SHA256 hash của ZIP, **lowercase**, không khoảng trắng. App sẽ verify trước khi extract |

---

## 4. Quy trình publish pack mới (step-by-step)

### Bước 1 — Soạn folder font

Gom font vào 1 folder gốc với cấu trúc subfolder rõ ràng:

```
trishfont-origin/
├── Unicode/              ← Subfolder = group hiển thị trong UI app
│   ├── Arial.ttf
│   ├── TimesNewRoman.ttf
│   └── ...
├── TCVN3/
│   ├── .vnArial.ttf
│   └── ...
├── VNI/
│   └── ...
└── AutoCAD/              ← Font .shx
    ├── Romans.shx
    └── ...
```

> 💡 **Lý do chia subfolder**: Khi user mở pack chi tiết, app group cards theo tên folder. Mỗi folder có nút "Chọn folder này" để cài hàng loạt.

### Bước 2 — Tạo ZIP

Trên Windows:
1. Click chuột phải vào folder gốc (`trishfont-origin`) → **Send to** → **Compressed (zipped) folder**
2. Đổi tên file ZIP thành `trishfont-origin.zip` (trùng với `id` trong manifest, để gọn)

> ⚠️ **Lưu ý quan trọng**: Khi extract ra, root file ZIP có thể là folder cha (`trishfont-origin/...`) hoặc trực tiếp file. Cả 2 đều OK — app dùng zip-slip safe walker để xử lý.

### Bước 3 — Tính SHA256

PowerShell:
```powershell
Get-FileHash trishfont-origin.zip -Algorithm SHA256 | Select-Object Hash
```

Copy hash output → **chuyển về lowercase** (vì chuẩn của app):
```powershell
(Get-FileHash trishfont-origin.zip -Algorithm SHA256).Hash.ToLower()
```

Vd output: `abc123def456789...`

### Bước 4 — Upload lên GitHub Release

1. Vào: `https://github.com/hosytri07/trishnexus-fontpacks/releases/new`
2. **Tag**: `<pack_id>-v<version>` — ví dụ `trishfont-origin-v1.0.0`
3. **Title**: tên pack + version, vd `TrishFont Origin Pack v1.0.0`
4. **Description**: mô tả ngắn nội dung pack (số font, font gì, license nếu có)
5. **Attach binaries**: kéo file `trishfont-origin.zip` vào
6. Bấm **Publish release**
7. **Copy download URL** từ release vừa tạo:
   - Click vào tên file ZIP trong Assets → URL đó là `download_url` cần paste vào manifest

### Bước 5 — Update manifest.json

Mở file `manifest.json` trong repo `trishnexus-fontpacks`. Thêm 1 entry vào array `packs`:

```json
{
  "schema_version": 1,
  "updated_at": "2026-04-25",
  "packs": [
    // ... pack cũ ...
    {
      "id": "trishfont-origin",
      "name": "TrishFont Origin Pack",
      "version": "1.0.0",
      "description": "Bộ font tiếng Việt + AutoCAD đầy đủ",
      "kind": "mixed",
      "size_bytes": 52428800,
      "file_count": 187,
      "tags": ["tiếng-việt", "autocad", "unicode"],
      "preview_image": "",
      "download_url": "https://github.com/hosytri07/trishnexus-fontpacks/releases/download/trishfont-origin-v1.0.0/trishfont-origin.zip",
      "sha256": "abc123def456..."
    }
  ]
}
```

**Đừng quên**: cập nhật `updated_at` thành ngày hôm nay.

### Bước 6 — Commit + push manifest

```powershell
cd <path tới folder local trishnexus-fontpacks>
git add manifest.json
git commit -m "feat: add trishfont-origin pack v1.0.0"
git push origin main
```

> ⏱ **Tốc độ live**: GitHub raw content cache 5 phút. User refresh trong 5 phút có thể vẫn thấy manifest cũ — bảo họ chờ thêm hoặc bấm nút "Tải lại" lần nữa.

### Bước 7 — User test

1. User mở TrishFont → tab "Fontpack TrishTEAM"
2. Bấm "⟳ Tải lại" — pack mới phải xuất hiện
3. Click "⬇ Tải pack" → app download + SHA verify + extract
4. Click vào pack → mở detail panel → tick font → "⬇ Cài đã tick"

---

## 5. Cập nhật pack đã publish

Nếu sửa lỗi 1 file font hoặc thêm font mới vào pack đã có:

1. Tăng `version` trong manifest (vd `1.0.0` → `1.0.1`)
2. Tạo ZIP mới + tính SHA256 mới
3. Tạo GitHub Release mới với tag `<pack_id>-v<new_version>`
4. Update `download_url` + `sha256` + `file_count` + `size_bytes` trong manifest
5. Push manifest

User mở app sẽ thấy nút **"↻ Cập nhật → v1.0.1"** thay nút "Đã tải".

---

## 6. Xóa pack khỏi danh sách

Mở `manifest.json` → xóa entry pack đó khỏi array `packs` → push.

> ⚠️ Pack đã extract trên máy user **không tự xóa**. User phải vào Settings → "Quản lý fontpack đã tải" → "Xóa tất cả" hoặc xóa thủ công.

---

## 7. Naming convention (chuẩn TrishTEAM)

| Loại | Format | Ví dụ |
|---|---|---|
| `id` | kebab-case, ngắn gọn | `vietnamese-classic`, `autocad-2024`, `latin-mono` |
| Tag GitHub Release | `<id>-v<version>` | `vietnamese-classic-v1.2.0` |
| File ZIP | `<id>.zip` (không có version trong tên) | `vietnamese-classic.zip` |
| Tags trong manifest | lowercase, có thể có dấu | `["tiếng-việt", "serif", "công-nghệ"]` |

---

## 8. Troubleshooting

### "SHA256 mismatch" khi user tải
→ Hash trong manifest không khớp file ZIP thật. Tính lại SHA256 (chú ý lowercase) và update manifest.

### "Không tải được manifest"
→ Check repo `trishnexus-fontpacks` có public không (Settings → General → Visibility). Branch phải là `main`. File phải tên đúng `manifest.json`.

### User không thấy pack mới sau push
→ Chờ 5 phút (GitHub raw cache) hoặc đổi raw URL có `?t=<timestamp>` (workaround). Nếu vẫn không, check JSON syntax — có thể bị thiếu dấu phẩy.

### App báo "Pack không hợp lệ"
→ JSON syntax sai. Test bằng https://jsonlint.com — paste manifest, fix lỗi báo.

### File ZIP quá lớn
→ GitHub Release giới hạn 2 GB/file. Nếu pack lớn hơn, chia nhỏ pack thành nhiều entry trong manifest.

---

## 9. Quy trình toàn ecosystem (general pattern)

Đây là pattern chung cho **mọi app trong ecosystem TrishTEAM** publish, không chỉ FontPack:

```
1. Build app local: pnpm tauri build (Run as administrator)
2. Tính SHA256 của installer (.exe / .msi)
3. Tạo GitHub Release ở repo trishnexus-monorepo:
   - Tag: <app_id>-v<version> (vd "trishcheck-v2.0.0-1")
   - Attach: installer + SHA256SUMS.txt
   - Description: copy từ docs/releases/<app>-v<version>-release-notes.md
4. Update apps-registry.json (website/public/) + apps-seed.ts (launcher fallback):
   - status: "released"
   - version, size_bytes, sha256, download URL
5. Commit + push lên main → Vercel auto-deploy ~2 phút
6. User mở launcher → bấm "Tải lại" → app mới hiện trạng thái released
```

**Files cần touch khi release 1 app:**
- `apps-desktop/<app>/src-tauri/tauri.conf.json` — version
- `apps-desktop/<app>/package.json` — version
- `apps-desktop/<app>/src-tauri/Cargo.toml` — version
- `website/public/apps-registry.json` — entry app đó
- `apps-desktop/trishlauncher/src/apps-seed.ts` — entry app đó
- `docs/releases/<app>-v<version>-release-notes.md` — release notes
- `docs/releases/<app>-v<version>-SHA256SUMS.txt` — checksum file
- `docs/SESSION-HANDOFF.md` — phase status

---

## 10. Future: TrishAdmin (Phase 16+)

Tương lai khi xây TrishAdmin app, các bước trên sẽ tự động hóa:

- **UI CRUD pack**: Form thêm/sửa/xóa pack với drag-drop ZIP
- **Auto-build manifest**: app tự gen JSON từ list pack
- **Auto SHA256**: tính + populate vào manifest
- **GitHub API integration**: tạo Release + upload binary qua API
- **Preview live**: thấy ngay manifest output trước khi push
- **Audit log**: ai sửa pack nào, khi nào

Lúc đó workflow rút từ 7 bước thủ công → 2 click trong UI.

---

## Phụ lục — Default fallback manifest

Nếu user không có internet, app dùng **DEV_FALLBACK_MANIFEST** trong code (hardcoded, 1 entry origin pack). Reference:
`apps-desktop/trishfont/src/tauri-bridge.ts` line ~264

---

🛠 **Maintainer**: Trí (hosytri07@gmail.com)
🔗 **Repo manifest**: https://github.com/hosytri07/trishnexus-fontpacks
🌐 **TrishTEAM**: https://trishteam.io.vn
