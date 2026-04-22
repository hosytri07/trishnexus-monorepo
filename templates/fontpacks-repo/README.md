# trishnexus-fontpacks

Repo chứa **font pack** cho TrishFont — mỗi pack = 1 bộ font đóng gói ZIP để TrishFont tải về tự động.

Repo này chỉ chứa **metadata + font file nguồn**. TrishFont app (desktop) đọc `manifest.json` ở branch `main`, hiển thị list pack trong tab "Cập nhật", và download ZIP từ GitHub Release của repo này.

---

## Cấu trúc

```
trishnexus-fontpacks/
├── manifest.json                 ← INDEX top-level, TrishFont fetch file này
├── scripts/
│   └── build-pack.py             ← script đóng gói 1 pack
└── packs/
    ├── vietnamese-essentials/    ← 1 pack = 1 folder
    │   ├── pack.json             ← metadata: id, name, version, tags
    │   ├── preview.png           ← optional, hiển thị trong UI
    │   ├── dist/                 ← (gitignored) output zip sau khi build
    │   │   └── vietnamese-essentials.zip
    │   └── fonts/                ← font file thực tế
    │       ├── Sans Serif/
    │       │   ├── Inter-Regular.ttf
    │       │   └── Roboto-Regular.ttf
    │       └── Serif/
    │           └── Merriweather-Regular.ttf
    └── autocad-classic/
        ├── pack.json
        └── fonts/
            ├── romans.shx
            └── vnsimplex.shx
```

Subfolder trong `fonts/` được giữ nguyên trong zip → TrishFont tự động group font theo folder cha (Phase 2 feature của TrishFont).

---

## Workflow publish 1 pack mới

### Lần đầu setup repo

1. Tạo repo `trishnexus-fontpacks` trên GitHub (public hoặc private).
2. Clone về máy:
   ```bash
   git clone https://github.com/hosytri07/trishnexus-fontpacks.git
   cd trishnexus-fontpacks
   ```
3. Copy nội dung template này vào.

### Thêm pack mới

1. Tạo folder `packs/<pack-id>/`:
   ```bash
   mkdir -p packs/my-new-pack/fonts
   ```
2. Copy font file vào `packs/my-new-pack/fonts/` (có thể chia subfolder).
3. Tạo `packs/my-new-pack/pack.json`:
   ```json
   {
     "id": "my-new-pack",
     "name": "Tên hiển thị",
     "description": "Mô tả 1-2 dòng",
     "version": "1.0.0",
     "kind": "windows",
     "tags": ["tag1", "tag2"]
   }
   ```
   - `kind`: `"windows"` | `"autocad"` | `"mixed"`
   - `tags`: list string, dùng để filter/search trong UI.
4. (Optional) Thêm `packs/my-new-pack/preview.png` làm thumbnail — sẽ được serve qua raw.githubusercontent.

### Build + publish

```bash
# 1. Build zip + cập nhật manifest.json
python scripts/build-pack.py my-new-pack

# 2. Commit + push
git add .
git commit -m "my-new-pack v1.0.0"
git push

# 3. Tạo GitHub Release + upload zip (cần `gh` CLI)
gh release create my-new-pack-v1.0.0 \
  packs/my-new-pack/dist/my-new-pack.zip \
  --title "my-new-pack v1.0.0" \
  --notes "Pack mới: ..."
```

Sau bước 3, `download_url` trong `manifest.json` sẽ match với release asset thật. User TrishFont bấm "🔄 Tải lại danh sách" trong tab "Cập nhật" là thấy pack mới.

---

## Workflow update pack có sẵn

1. Thêm/bớt font trong `packs/<pack-id>/fonts/`.
2. Bump `version` trong `packs/<pack-id>/pack.json` (theo semver: `1.0.0` → `1.0.1` nếu fix, `1.1.0` nếu thêm font, `2.0.0` nếu đổi tên/xoá font).
3. Chạy lại:
   ```bash
   python scripts/build-pack.py <pack-id>
   ```
   Script sẽ tự tính lại `size_bytes`, `file_count`, `sha256`, `download_url` và update entry trong `manifest.json`.
4. Commit + push + tạo release với tag mới:
   ```bash
   git add .
   git commit -m "<pack-id> v1.1.0"
   git push
   gh release create <pack-id>-v1.1.0 packs/<pack-id>/dist/<pack-id>.zip --notes "..."
   ```

User TrishFont sẽ thấy status pack chuyển từ "✓ Đã cài" → "🔄 Cập nhật → v1.1.0".

---

## Quy ước

- **Tag release**: `<pack-id>-v<version>` — VD `vietnamese-essentials-v1.2.0`.
- **Tên zip**: `<pack-id>.zip` (không kèm version) — version đã nằm trong tag release.
- **Semver**: bắt buộc format `X.Y.Z` — TrishFont so sánh string equality để detect update.
- **Encoding**: `pack.json` + `manifest.json` dùng UTF-8, support tiếng Việt trong field `name` và `description`.

---

## Debug

Nếu user bấm "🔄 Tải lại danh sách" trong TrishFont mà không thấy pack:

1. Kiểm tra manifest URL truy cập được: mở browser vào `https://raw.githubusercontent.com/hosytri07/trishnexus-fontpacks/main/manifest.json` — phải load ra JSON.
2. Kiểm tra JSON valid: `python -c "import json; print(json.load(open('manifest.json')))"`.
3. Kiểm tra `download_url` mỗi pack là link release asset thật (vào GitHub Releases page kiểm).

Nếu tải về nhưng báo "SHA256 mismatch":

- Rebuild: `python scripts/build-pack.py <pack-id>` → commit lại manifest → push.
- Lý do thường là zip đã upload lên release khác với bản local đang build.

---

## License

Font trong packs phải có license cho phép redistribute (OFL, Apache 2.0, MIT, Public Domain, …). Không commit font bản quyền (Adobe, Monotype commercial). Nếu dùng `.shx` từ AutoCAD, chỉ redistribute được file do user tạo hoặc font free.
