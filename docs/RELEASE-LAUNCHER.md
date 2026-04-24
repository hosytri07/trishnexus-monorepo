# Release TrishLauncher — quy trình phát hành

Tài liệu này hướng dẫn phát hành bản mới của **TrishLauncher** (Tauri 2) lên
GitHub Releases, đồng bộ với trang `/downloads` của website.

URL mà trang `/downloads` trỏ tới:

```
https://github.com/hosytri07/trishnexus-monorepo/releases/download/launcher-v<VERSION>/<FILE>
```

Với `VERSION = 2.0.0-1` và các file:

- `TrishLauncher_2.0.0-1_x64-setup.exe` (NSIS, khuyến nghị)
- `TrishLauncher_2.0.0-1_x64_en-US.msi` (MSI, enterprise EN)
- `TrishLauncher_2.0.0-1_x64_vi-VN.msi` (MSI, enterprise VI)
- `SHA256SUMS.txt` (checksum)

---

## Phương án 1 — CI tự build + publish (khuyến nghị)

Workflow: `.github/workflows/build-launcher.yml`. Chỉ cần push tag, CI chạy
trên `windows-latest` rồi tự tạo release + upload asset.

```bash
# Đảm bảo version trong tauri.conf.json / Cargo.toml / package.json đồng bộ
# (hiện tại đều 2.0.0-1). Sau khi bump:

git add apps-desktop/trishlauncher/
git commit -m "chore(launcher): bump 2.0.0-1"

# Tạo tag + push
git tag launcher-v2.0.0-1
git push origin main
git push origin launcher-v2.0.0-1
```

CI sẽ:

1. `pnpm install --frozen-lockfile`
2. `pnpm -r --filter './packages/*' build`
3. `pnpm tauri build` trong `apps-desktop/trishlauncher`
4. Sinh `SHA256SUMS.txt`
5. Tạo release `launcher-v2.0.0-1` (pre-release) và upload 3 file + checksum

> Lần đầu build CI có thể tốn **~20-25 phút** (cold Rust cache). Các lần sau
> ~10-15 phút nhờ `Swatinem/rust-cache@v2`.

### Trigger thủ công (không cần tag)

Vào tab **Actions → Build TrishLauncher → Run workflow**, nhập `version =
2.0.0-1`. Hữu ích cho test dry-run.

---

## Phương án 2 — Upload thủ công bản build local

Dùng khi bạn đã build sẵn trên máy (`pnpm tauri build` local) và chỉ muốn đẩy
lên GitHub, không chạy CI.

### Bước 1 — Kiểm tra file output

Đường dẫn sau khi `pnpm tauri build` trong `apps-desktop/trishlauncher/`:

```
src-tauri/target/release/bundle/nsis/TrishLauncher_2.0.0-1_x64-setup.exe
src-tauri/target/release/bundle/msi/TrishLauncher_2.0.0-1_x64_en-US.msi
src-tauri/target/release/bundle/msi/TrishLauncher_2.0.0-1_x64_vi-VN.msi
```

Kích thước hiện tại (đã verify):

| File | Size | SHA256 |
| --- | --- | --- |
| `TrishLauncher_2.0.0-1_x64-setup.exe` | 5.3 MB | `d86089cd714ff11f8db9c3e8f1dfc6a60e83c2bc1bff0e6ff185439ed07f2b1f` |
| `TrishLauncher_2.0.0-1_x64_en-US.msi` | 3.4 MB | `87503f938778f2a7d10a226e5df37f10bc11a398341942f1705af2844aed8196` |
| `TrishLauncher_2.0.0-1_x64_vi-VN.msi` | 3.4 MB | `1038224a91078ab8ecaa9a718f02a2cd5258b286648db32e69c35dcd883a4c3e` |

> Nếu rebuild thì SHA256 sẽ đổi — tính lại bằng PowerShell:
> `Get-FileHash <path> -Algorithm SHA256`

### Bước 2 — Tạo SHA256SUMS.txt

Trong thư mục `src-tauri/target/release/bundle/`:

```powershell
$out = "SHA256SUMS.txt"
Remove-Item $out -ErrorAction SilentlyContinue

Get-ChildItem -Recurse -Include "TrishLauncher_2.0.0-1_*.exe","TrishLauncher_2.0.0-1_*.msi" |
  ForEach-Object {
    $sha = (Get-FileHash $_.FullName -Algorithm SHA256).Hash.ToLower()
    "${sha}  $($_.Name)" | Out-File $out -Append -Encoding utf8
  }

Get-Content $out
```

### Bước 3 — Tạo tag + push

```bash
git tag launcher-v2.0.0-1
git push origin launcher-v2.0.0-1
```

### Bước 4 — Tạo GitHub Release qua `gh` CLI

```bash
gh release create launcher-v2.0.0-1 \
  --title "TrishLauncher v2.0.0-1" \
  --prerelease \
  --notes-file docs/release-notes/launcher-v2.0.0-1.md \
  apps-desktop/trishlauncher/src-tauri/target/release/bundle/nsis/TrishLauncher_2.0.0-1_x64-setup.exe \
  apps-desktop/trishlauncher/src-tauri/target/release/bundle/msi/TrishLauncher_2.0.0-1_x64_en-US.msi \
  apps-desktop/trishlauncher/src-tauri/target/release/bundle/msi/TrishLauncher_2.0.0-1_x64_vi-VN.msi \
  apps-desktop/trishlauncher/src-tauri/target/release/bundle/SHA256SUMS.txt
```

### Hoặc upload qua web UI

1. Vào https://github.com/hosytri07/trishnexus-monorepo/releases/new
2. Tag: `launcher-v2.0.0-1` (create new tag — chọn branch `main`)
3. Title: `TrishLauncher v2.0.0-1`
4. Đánh dấu **Set as a pre-release**
5. Kéo-thả 4 file (exe + 2 msi + SHA256SUMS.txt) vào vùng assets
6. **Publish release**

---

## Checklist sau khi publish

- [ ] Mở `https://github.com/hosytri07/trishnexus-monorepo/releases/tag/launcher-v2.0.0-1`
  → thấy 4 asset.
- [ ] Copy URL của `TrishLauncher_2.0.0-1_x64-setup.exe` → mở trên browser
  khác → download chạy được.
- [ ] Deploy website (Next.js) → `https://trishteam.io.vn/downloads` hiện card
  "Windows — Installer (.exe)" và nút **Tải về** mở được file.
- [ ] Website public `https://trishteam.io.vn/apps-registry.json` → trả JSON
  9 apps với `status: "coming_soon"`.

---

## Template release notes — `docs/release-notes/launcher-v2.0.0-1.md`

```markdown
# TrishLauncher v2.0.0-1 (alpha)

Bản alpha đầu tiên của TrishLauncher viết lại bằng **Tauri 2 + React**,
thay thế bản Qt/Python cũ.

## Tính năng

- Danh sách 9 app ecosystem (TrishFont, TrishNote, TrishClean, …)
- System tray với Quick Launch menu
- Registry loader: fetch `apps-registry.json` từ CDN, fallback SEED local
- Auto-update interval (5 / 15 / 60 phút, tắt)
- Dark / Light / Auto theme
- i18n VN / EN

## Tải về

Xem bảng phía trên hoặc https://trishteam.io.vn/downloads.

## Đã biết

- Chưa code-sign → SmartScreen cảnh báo. Bấm _More info → Run anyway_.
- macOS / Linux chưa có build — sẽ phát hành qua CI khi bổ sung runner.
- Tất cả 9 app con đang ở trạng thái "Sắp ra mắt".

## Checksum

Xem file `SHA256SUMS.txt` kèm release.
```

---

## Bump version cho bản tiếp theo

Cần đồng bộ **3 file**:

- `apps-desktop/trishlauncher/package.json` → `"version": "2.0.0-2"`
- `apps-desktop/trishlauncher/src-tauri/Cargo.toml` → `version = "2.0.0-2"`
- `apps-desktop/trishlauncher/src-tauri/tauri.conf.json` → `"version": "2.0.0-2"`

> **MSI yêu cầu pre-release numeric-only** (`-1`, `-2`, `-3`, …), KHÔNG nhận
> `-alpha.1`. Đây là lý do version hiện tại là `2.0.0-1` thay vì
> `2.0.0-alpha.1`.

Cập nhật `website/app/downloads/DownloadCards.tsx`:

```ts
const RELEASE_TAG = 'launcher-v2.0.0-2';
const RELEASE_VERSION = '2.0.0-2';
```

Rồi push tag `launcher-v2.0.0-2` — CI lo phần còn lại.
