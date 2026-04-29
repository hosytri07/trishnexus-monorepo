# Quy trình release app desktop — Phase 20.8

GitHub Actions tự động build NSIS `.exe` + tạo Release khi push tag.

## 1. Cập nhật version

Sửa version trong 2 chỗ của app cần release:

**`apps-desktop/<app-id>/package.json`:**
```json
{ "version": "1.0.0" }
```

**`apps-desktop/<app-id>/src-tauri/tauri.conf.json`:**
```json
{ "version": "1.0.0" }
```

**`apps-desktop/<app-id>/src-tauri/Cargo.toml`:**
```toml
version = "1.0.0"
```

## 2. Commit + tag + push

```
git add -A
git commit -m "release(<app-id>): v1.0.0"
git tag <app-id>-v1.0.0
git push origin main --tags
```

Ví dụ:
```
git tag trishlauncher-v1.0.0
git push --tags
```

## 3. GitHub Actions tự chạy

- Vào https://github.com/hosytri07/trishnexus-monorepo/actions
- Workflow **Release App** sẽ run ~10-15 phút (compile Rust release)
- Xong → tab **Releases** có entry mới với file `.exe` + SHA256

## 4. Cập nhật `apps_meta` Firestore

Sau khi Release thành công, vào https://www.trishteam.io.vn/admin/apps:
- Tìm app vừa release → **Sửa**
- Cập nhật:
  - `version` → mới
  - `download.windows_x64.url` → URL `.exe` GitHub Release
  - `download.windows_x64.sha256` → SHA256 trong release notes
  - `status` → `released` (nếu trước đó là `scheduled`)
  - `changelog_url` → URL Release
- Lưu

→ TrishLauncher mở next-fetch sẽ thấy badge "Có bản mới". User click **🔄 Cập nhật** → tải về → NSIS ghi đè bản cũ.

## 5. Test workflow trước khi tag (optional)

Nếu chưa chắc workflow chạy đúng, test bằng `workflow_dispatch`:

1. Vào tab **Actions** → **Release App**
2. Bấm **Run workflow**
3. Chọn `app_id`, nhập `version`, tick **draft = true**
4. Run → output sẽ là draft Release (không publish public)
5. Verify .exe trong Artifacts hoặc Draft Release
6. Nếu OK → xoá draft, tag thật + push

## App ID hiện tại

| ID | Tên | Cần login? |
|---|---|---|
| `trishlauncher` | TrishLauncher | none |
| `trishlibrary` | TrishLibrary | trial |
| `trishadmin` | TrishAdmin | (nội bộ — không qua launcher) |
| `trishfont` | TrishFont | none |
| `trishcheck` | TrishCheck | none |
| `trishclean` | TrishClean | none |
| `trishdesign` | TrishDesign | user (paid) |

## Pattern tag

```
<app-id>-v<semver>
```

Ví dụ hợp lệ:
- `trishlauncher-v1.0.0`
- `trishlibrary-v2.1.3`
- `trishfont-v1.0.0-beta.1`

## Troubleshooting

### Workflow fail "pnpm install"
- Kiểm tra `pnpm-lock.yaml` có outdated không. Pull latest, `pnpm install` local, commit lock file.

### Workflow fail "tauri build"
- Có thể Rust deps chưa compatible Windows. Test local `pnpm tauri build --bundles nsis` trước.

### Release tạo OK nhưng `.exe` 0 byte
- NSIS output path có thể đổi giữa Tauri 2.x versions. Edit step **Locate built .exe** trong workflow YAML.

### Cần signed .exe (loại Windows SmartScreen warning)
- Hiện chưa có code-signing cert (mua EV ~$250/năm hoặc Azure Trusted Signing). User nhận warning "Unknown Publisher" lần đầu.
- Workaround: thêm hướng dẫn "Right-click .exe → Properties → Unblock" vào website /downloads.

---

© 2026 TrishTEAM
