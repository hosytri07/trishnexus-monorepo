# Font-pack sync — Workflow đầu cuối

User → push font lên repo GitHub → Tóc app TrishFont bấm "Cập nhật" → app tự
download & cài. Không browser, không thao tác thủ công.

## Repo: `trishnexus-fontpacks`

```
trishnexus-fontpacks/                  (public hoặc private — public nhanh hơn)
├─ manifest.json                       ← top-level: liệt kê tất cả pack + version
├─ packs/
│   ├─ vietnamese-essentials/
│   │   ├─ pack.json                   ← metadata pack-level
│   │   ├─ preview.png                 ← optional, dùng làm thumbnail
│   │   └─ fonts/
│   │       ├─ Inter-Regular.ttf
│   │       ├─ Inter-Bold.ttf
│   │       └─ Roboto-Regular.ttf
│   ├─ autocad-classic/
│   │   ├─ pack.json
│   │   └─ fonts/
│   │       ├─ romans.shx
│   │       └─ vnsimplex.shx
│   └─ display-decorative/
│       ├─ pack.json
│       └─ fonts/
│           └─ ...
├─ scripts/
│   └─ build-pack.py                   ← script local: zip + checksum + update manifest
└─ README.md
```

## `manifest.json` (top-level) — schema

```json
{
  "schema_version": 1,
  "updated_at": "2026-04-22T10:00:00Z",
  "packs": [
    {
      "id": "vietnamese-essentials",
      "name": "Tiếng Việt — Cơ bản",
      "version": "1.2.0",
      "description": "10 font Sans/Serif hỗ trợ tốt Tiếng Việt.",
      "kind": "windows",
      "size_bytes": 2400000,
      "file_count": 10,
      "tags": ["vietnamese", "sans-serif", "essential"],
      "preview_image": "https://raw.githubusercontent.com/<user>/trishnexus-fontpacks/main/packs/vietnamese-essentials/preview.png",
      "download_url": "https://github.com/<user>/trishnexus-fontpacks/releases/download/vietnamese-essentials-v1.2.0/vietnamese-essentials.zip",
      "sha256": "abc123def456..."
    },
    {
      "id": "autocad-classic",
      "name": "AutoCAD — Font cổ điển",
      "version": "1.0.0",
      "kind": "autocad",
      "size_bytes": 350000,
      "file_count": 8,
      "download_url": "https://github.com/<user>/trishnexus-fontpacks/releases/download/autocad-classic-v1.0.0/autocad-classic.zip",
      "sha256": "..."
    }
  ]
}
```

## `pack.json` (pack-level) — schema

Đặt trong `packs/<pack-id>/pack.json`. Script `build-pack.py` đọc file này để
generate entry trong `manifest.json` top-level + tạo .zip.

```json
{
  "id": "vietnamese-essentials",
  "name": "Tiếng Việt — Cơ bản",
  "version": "1.2.0",
  "description": "10 font Sans/Serif hỗ trợ tốt Tiếng Việt.",
  "kind": "windows",
  "tags": ["vietnamese", "sans-serif"]
}
```

## Workflow publisher (Trí)

### Lần đầu setup

1. Tạo repo `trishnexus-fontpacks` trên GitHub (public).
2. Clone về máy.
3. Copy `scripts/build-pack.py` từ `trishnexus-monorepo/scripts/` vào.
4. Tạo cấu trúc folder `packs/<pack-id>/fonts/` + `pack.json`.

### Mỗi lần publish 1 pack

```powershell
# 1. Thả font vào folder
cp G:\font-collection\inter\*.ttf packs\vietnamese-essentials\fonts\

# 2. Bump version trong pack.json (vd 1.2.0 → 1.3.0)

# 3. Run script: tạo zip + checksum + update manifest.json
python scripts/build-pack.py vietnamese-essentials

# 4. Commit + push
git add .
git commit -m "vietnamese-essentials v1.3.0: thêm 5 font Inter"
git push

# 5. Tạo GitHub Release với tag = "<pack-id>-v<version>"
gh release create vietnamese-essentials-v1.3.0 \
  packs/vietnamese-essentials/dist/vietnamese-essentials.zip \
  --title "vietnamese-essentials v1.3.0" \
  --notes "Thêm 5 font Inter."
```

Script `build-pack.py` sẽ:
- Đọc `pack.json` → lấy id, version.
- Zip toàn bộ `packs/<id>/fonts/` → `packs/<id>/dist/<id>.zip`.
- Tính SHA256.
- Update entry trong `manifest.json` top-level.
- In ra block JSON để copy nếu cần.

## Workflow user (TrishFont)

App định kỳ (hoặc khi user bấm "🔄 Cập nhật" ở Update dialog):

1. `requests.get("https://raw.githubusercontent.com/<user>/trishnexus-fontpacks/main/manifest.json")`.
2. Parse JSON → list pack với version mới nhất.
3. So với `installed_packs` table local:
   - Pack chưa cài → "Mới"
   - Pack đã cài, version local < version remote → "Cập nhật"
   - Pack đã cài, version trùng → "✓"
4. Hiển thị danh sách trong UpdateDialog → user tick các pack muốn cài.
5. Mỗi pack:
   - Download `download_url` → `%TEMP%\trishfont-pack-<id>.zip`.
   - Verify SHA256.
   - Extract vào `%APPDATA%\TrishFont\packs\<pack-id>\`.
   - Update DB `installed_packs(pack_id, version, installed_at)`.
6. Trigger rescan folder library → font mới xuất hiện.

## Schema DB (TrishFont, migration 004)

```sql
CREATE TABLE IF NOT EXISTS installed_packs (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    pack_id       TEXT    NOT NULL UNIQUE,
    version       TEXT    NOT NULL,
    kind          TEXT    NOT NULL DEFAULT 'windows',
    extracted_to  TEXT    NOT NULL,
    installed_at  TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

## Tích hợp với folder-aware library

Vì pack được extract vào `%APPDATA%\TrishFont\packs\<id>\`, folder này cũng
trở thành "font library" — chỉ cần thêm path vào FontRepository scan list.

Auto-flow:
- Khi user cài pack `vietnamese-essentials`:
  - Extract vào `%APPDATA%\TrishFont\packs\vietnamese-essentials\`.
  - Trigger `repo.scan_folder(packs_root)` (packs_root = `%APPDATA%\TrishFont\packs`).
  - Folder-group sẽ là `"vietnamese-essentials"` (tên pack folder).
  - Library tab tự thêm 1 CardGroup mới.

→ User không cần làm gì ngoài bấm "Cập nhật" + tick.

## Implement plan

- Phase 5.1: `scripts/build-pack.py` — local tool cho publisher.
- Phase 5.2: `trishfont/modules/packs/fetcher.py` — pull manifest.
- Phase 5.3: `trishfont/modules/packs/installer.py` — download + verify + extract.
- Phase 5.4: Wire vào UpdateDialog (tab thứ 2).
- Phase 5.5: Migration 004 + rescan auto-trigger.

Status: spec done, implement Phase 5.
