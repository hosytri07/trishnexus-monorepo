# Hướng dẫn publish Font Pack

Doc này mô tả cách Trí (hoặc bất kỳ maintainer nào) publish font pack cho TrishFont. App TrishFont trên máy user sẽ fetch `manifest.json` từ repo `trishnexus-fontpacks` → hiển thị list pack ở tab "Cập nhật" → user tải về + cài tự động.

Xem spec kỹ thuật đầy đủ ở `docs/ROADMAP.md` Phase 5. Doc này tập trung vào **workflow thực tế** cho người publish.

---

## 1. Setup lần đầu — tạo repo font packs

### 1.1. Tạo repo trên GitHub

```
Owner:        hosytri07
Name:         trishnexus-fontpacks
Visibility:   Public (khuyến nghị — user không cần auth để download)
Init README:  KHÔNG (sẽ copy từ template)
```

> Nếu chọn Private: user TrishFont sẽ cần đăng nhập GitHub và cấp Personal Access Token — phức tạp hơn. Public là đơn giản nhất vì fetch qua `raw.githubusercontent.com` không cần auth.

### 1.2. Clone về máy + copy template

```bash
cd C:\Users\<you>\Documents
git clone https://github.com/hosytri07/trishnexus-fontpacks.git
cd trishnexus-fontpacks

# Copy nội dung template từ monorepo
xcopy /E /I <path-to-trishnexus-monorepo>\templates\fontpacks-repo\* .
```

Sau khi copy, cấu trúc sẽ giống hệt template — xem `templates/fontpacks-repo/README.md` để chi tiết layout.

### 1.3. Commit initial skeleton + push

```bash
git add .
git commit -m "Initial skeleton — empty manifest"
git push -u origin main
```

Verify bằng cách mở:
```
https://raw.githubusercontent.com/hosytri07/trishnexus-fontpacks/main/manifest.json
```
Nếu thấy JSON `{"schema_version": 1, "updated_at": "", "packs": []}` → OK.

### 1.4. Cài `gh` CLI (GitHub Desktop CLI)

Để tạo release + upload zip bằng 1 lệnh thay vì phải upload tay qua web UI:

```bash
winget install --id GitHub.cli
gh auth login
```

---

## 2. Publish 1 pack mới

### 2.1. Chuẩn bị folder font

Folder font Trí đã tách sẵn (ví dụ `C:\Users\Tri\Fonts\VN-Essentials\` chứa các subfolder `Sans Serif/`, `Serif/`, `Display/`) → copy nguyên vào repo:

```
trishnexus-fontpacks/
└── packs/
    └── vietnamese-essentials/
        ├── pack.json          ← tạo mới
        └── fonts/
            ├── Sans Serif/    ← copy từ C:\Users\Tri\Fonts\VN-Essentials\Sans Serif\
            ├── Serif/
            └── Display/
```

**Quan trọng:** Giữ nguyên subfolder — TrishFont sẽ auto group theo folder cha (feature Phase 2 của TrishFont).

### 2.2. Viết `pack.json`

File `packs/vietnamese-essentials/pack.json`:

```json
{
  "id": "vietnamese-essentials",
  "name": "Tiếng Việt — Cơ bản",
  "description": "42 font Unicode hỗ trợ đầy đủ dấu tiếng Việt — dùng cho văn bản, thuyết trình, thiết kế cơ bản.",
  "version": "1.0.0",
  "kind": "windows",
  "tags": ["vietnamese", "unicode", "sans-serif", "serif", "essential"]
}
```

Các field:

| Field         | Ý nghĩa                                                     |
|---------------|-------------------------------------------------------------|
| `id`          | Slug URL-safe (lowercase, dash). Phải unique. Không đổi sau khi publish. |
| `name`        | Tên hiển thị trong UI, có tiếng Việt cũng OK.               |
| `description` | Mô tả ngắn 1-2 dòng, hiện bên dưới tên pack.                |
| `version`     | Semver `X.Y.Z`. Bump mỗi lần update pack.                    |
| `kind`        | `"windows"` / `"autocad"` / `"mixed"` — ảnh hưởng icon UI.   |
| `tags`        | List string, dùng filter/search.                             |

### 2.3. (Optional) Thêm preview thumbnail

Đặt file `packs/<pack-id>/preview.png` (khuyến nghị 640×360). Sẽ auto hiển thị trong UI pack card (Phase sau sẽ wire).

### 2.4. Build + upload

Từ root repo `trishnexus-fontpacks`:

```bash
# 1. Build zip + update manifest.json
python scripts/build-pack.py vietnamese-essentials

# Output example:
# 📦 Đóng gói 42 file font → vietnamese-essentials.zip…
# 🔐 Tính SHA256…
# ✅ Done.
#    pack:    vietnamese-essentials v1.0.0
#    size:    18,456,728 bytes (17.60 MB)
#    files:   42
#    sha256:  a3f8...
#    url:     https://github.com/hosytri07/.../vietnamese-essentials.zip

# 2. Commit + push manifest
git add .
git commit -m "vietnamese-essentials v1.0.0"
git push

# 3. Tạo Release + upload zip
gh release create vietnamese-essentials-v1.0.0 \
  packs/vietnamese-essentials/dist/vietnamese-essentials.zip \
  --title "Vietnamese Essentials v1.0.0" \
  --notes "42 font Unicode VN — initial release."
```

### 2.5. Verify

1. Mở `https://github.com/hosytri07/trishnexus-fontpacks/releases` — phải thấy release mới.
2. Mở TrishFont → tab **"Cập nhật"** → bấm **"🔄 Tải lại danh sách"** → pack mới hiện ra với button "⬇ Tải về".
3. Bấm "⬇ Tải về" → log panel hiển thị: progress → "✅ SHA256 verify OK" → "✅ extract xong N file" → button chuyển thành "✓ Đã cài".
4. Chuyển sang tab **"Thư viện"** → font trong pack tự xuất hiện (vì callback `on_installed` đã trigger rescan).

---

## 3. Update pack đã có

1. Thêm/bớt font trong `packs/<pack-id>/fonts/`.
2. Bump `version` trong `pack.json`:
   - `1.0.0` → `1.0.1` nếu **fix** (đổi file font hỏng).
   - `1.0.0` → `1.1.0` nếu **thêm** font mới.
   - `1.0.0` → `2.0.0` nếu **xoá/rename** font (breaking change).
3. Chạy lại:
   ```bash
   python scripts/build-pack.py <pack-id>
   git add .
   git commit -m "<pack-id> v1.1.0"
   git push
   gh release create <pack-id>-v1.1.0 packs/<pack-id>/dist/<pack-id>.zip --notes "..."
   ```
4. User TrishFont sẽ thấy button pack chuyển từ "✓ Đã cài" → "🔄 Cập nhật → v1.1.0". Bấm để tải bản mới.

---

## 4. FAQ

**Q: Có cần tạo release cho manifest.json không?**
A: Không. `manifest.json` chỉ được commit lên branch `main`, TrishFont fetch qua `raw.githubusercontent.com`. Release chỉ cần cho **file zip**.

**Q: Có thể có nhiều release cùng ngày không?**
A: Có, mỗi pack release độc lập. Tag `<pack-id>-v<version>` nên không collision.

**Q: Xoá pack thì sao?**
A: Xoá entry trong `manifest.json` (chạy lại build cho các pack còn lại, rồi edit tay), giữ folder packs/<id>/ lại trong history git nếu cần rollback. User đã cài pack đó vẫn có folder ở `%APPDATA%\TrishFont\packs\<pack-id>\` — chưa có auto-uninstall (TODO phase sau).

**Q: Manifest URL hardcoded ở đâu trong app?**
A: `apps/trishfont/src/trishfont/modules/fontpack/fetcher.py` → biến `MANIFEST_URL`. Hiện là:
```
https://raw.githubusercontent.com/hosytri07/trishnexus-fontpacks/main/manifest.json
```
Nếu đổi username GitHub thì sửa biến này + rebuild TrishFont.

**Q: Có giới hạn size file zip không?**
A: GitHub Release cho phép mỗi file tới 2 GB. Nên chia pack < 100 MB để tải nhanh + ít fail giữa chừng.

**Q: Đặt font bản quyền có sao không?**
A: Có — GitHub sẽ DMCA takedown. Chỉ dùng font có license redistribute được (OFL, Apache 2.0, MIT, Public Domain).

---

## 5. Status TrishFont side

Code client đã wire xong — xem `apps/trishfont/src/trishfont/modules/fontpack/`:

- `fetcher.py` — `fetch_manifest()` + `parse_manifest()`
- `downloader.py` — QThread download + SHA256 + zip-slip safe extract
- `repository.py` — SQLite cache `installed_packs` + `manifest_cache`
- `view.py` — `PackView` UI tab "Cập nhật"
- `models.py` — `FontPack`, `PackStatus`, `MIGRATION_004_FONTPACKS`

Tab "Cập nhật" đã được add vào sidebar + FooterBar quick nav của TrishFont. User bấm là vào ngay.
