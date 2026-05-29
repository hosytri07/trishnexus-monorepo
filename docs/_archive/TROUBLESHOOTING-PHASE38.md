# Troubleshooting — TrishTEAM Phase 38

Các lỗi thường gặp trong wave release v1.0.0 + cách fix.

## 1. Build / Tauri

### Tauri version mismatch

Lỗi: `Found version mismatched Tauri packages: tauri (v2.11.0) : @tauri-apps/api (v2.10.1)`

**Fix:** sửa `apps-desktop/<app>/package.json`:

```json
"@tauri-apps/api": "^2.11.0",
"@tauri-apps/cli": "^2.11.0"
```

Rồi `pnpm install` ở root + build lại.

### TypeScript build error: `Property 'X' does not exist`

Common: type drift sau refactor. Vd `det.installed` không tồn tại (type là `det.state === 'installed'`).

**Fix:** đọc error message → sửa code theo hint → build lại.

### Cargo.lock corruption (binary nulls)

Hiếm. Lỗi: `error: invalid value: ... at line N column 1`

**Fix:** xóa lock file + rebuild:
```powershell
del apps-desktop\<app>\src-tauri\Cargo.lock
cd apps-desktop\<app>
cargo build --release
```

---

## 2. Frontend / Vite / TS

### `.ts-app button { border: none }` ăn mất viền nút

Design-system theme.css có rule reset:
```css
.ts-app button { border: none; background: transparent; }
```

Specificity (0,1,1) thắng single-class selector như `.btn` (0,1,0).

**Fix:** prefix `.ts-app` cho tất cả button class:
```css
.ts-app .btn { border: 1.5px solid var(--accent); ... }
```

Đã save memory `design_system_specificity_trap.md`.

### TrishCheck Theme `'system'` vs Clean `'auto'`

Theme type khác nhau giữa apps:
- TrishCheck/Font/Library: `'light' | 'dark' | 'system'`
- TrishClean: `'light' | 'dark' | 'auto'`

**Fix:** dùng đúng giá trị cho từng app khi viết theme toggle.

### Vite HMR không pickup `.ts` import

Khi sửa file .ts deep import (vd `apps-seed.ts`), HMR có thể bỏ qua.

**Fix:** Ctrl+C terminal đang chạy `pnpm tauri dev` → restart lại.

---

## 3. Tauri Plugin Permissions

### `openUrl(folderPath)` fail silent

`tauri-plugin-opener` chỉ accept HTTP/HTTPS. File path silent fail.

**Fix:** dùng custom Rust command spawn `explorer.exe`:
```rust
std::process::Command::new("explorer").arg(&path).spawn()?;
```

Hoặc spawn `cmd /c start "" "<url>"` cho URL (bypass plugin scope check).

### Capabilities thiếu permission

Lỗi: `Not allowed to open path C:\...`

**Fix:** thêm vào `apps-desktop/<app>/src-tauri/capabilities/default.json`:
```json
"opener:allow-open-path",
"opener:allow-reveal-item-in-dir"
```

Lưu ý: `allow-open-path` vẫn cần explicit allowlist scope cho đường dẫn động — nên dùng custom Rust command thay.

---

## 4. PowerShell / Git

### `&&` không hoạt động trong PowerShell

PowerShell 5 không hỗ trợ `&&` chain operator.

**Fix:** dùng `;` hoặc 2 dòng:
```powershell
cd path\to\dir ; pnpm tauri dev

REM hoặc:
cd path\to\dir
pnpm tauri dev
```

### `del .git\index.lock 2>nul` báo lỗi

PowerShell không hiểu `2>nul` (cú pháp CMD).

**Fix:** PowerShell-friendly:
```powershell
Remove-Item .git\index.lock -ErrorAction SilentlyContinue
```

Hoặc đơn giản:
```powershell
del .git\index.lock
```
(không kèm redirect — nếu file không có sẽ báo error nhưng không crash).

### `fatal: Unable to create '.git/index.lock'`

Có git process khác đang chạy (VS Code Git ext, GitHub Desktop...).

**Fix:** đóng VS Code (hoặc tắt Git extension) → xóa lock + retry:
```powershell
Remove-Item .git\index.lock -ErrorAction SilentlyContinue
git add ...
git commit -m "..."
```

### VS Code linter tự revert thay đổi

Sau khi tool sửa file + commit + push, VS Code có thể auto-format reset file về cũ.

**Triệu chứng:** `git diff HEAD` cho thấy DELETIONS, production OK nhưng local sai.

**Fix:**
1. Đóng VS Code TRƯỚC khi commit
2. Hoặc tắt "format on save" + "eslint.fix"
3. Restore: `git checkout HEAD -- <path>`
4. Verify production qua Incognito browser

---

## 5. Vercel / Deployment

### Build fail: SyntaxError "Expected '{', got 'X'"

File JS/TS bị truncate ở cuối. Common khi linter cắt mất hàm export.

**Fix:** mở file ở line cuối, đảm bảo không bị cắt giữa chừng. Vd `huong-dan-content.ts` phải kết thúc bằng:
```typescript
export function findGuideBySlug(slug: string): AppGuide | null {
  return APP_GUIDES.find((g) => g.slug === slug) ?? null;
}
```

### Server Components render error (digest)

Error chung Next 14 SSR. Common cause:
- `headers()` trong layout buộc dynamic, conflict với prerender
- Firestore admin SDK fail server-side
- Missing env var trên Vercel

**Fix:**
1. Kiểm tra Vercel function logs
2. Bỏ `headers()` calls không cần thiết
3. Defensive try/catch quanh server-side fetches
4. Hardcode static data nếu Firestore ít thay đổi

### Theme dark/light không sync

Page dùng Tailwind hardcoded color (`text-slate-600`, `bg-white`) thay CSS vars.

**Fix:** thay bằng `style={{ color: 'var(--color-text-primary)' }}` etc.

Hoặc thêm `dark:` Tailwind variants:
```tsx
className="bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200"
```

(Đã config `darkMode: ['class', '[data-theme="dark"]']` trong tailwind.config.cjs).

---

## 6. Logo / UI

### Logo PNG có background trắng/tinted thay vì trong suốt

PNG content có alpha thấp toàn canvas (semi-transparent fill) — không phải transparent thật ở viền.

**Fix:** Python cleanup script xóa pixel có alpha < 200 + near-white:
```python
for y in range(h):
    for x in range(w):
        r, g, b, a = pixels[x, y]
        if a < 200 and r > 220 and g > 220 and b > 220:
            pixels[x, y] = (0, 0, 0, 0)
```

### Tile background khác màu mỗi app

Code trước render `linear-gradient(${app.accent}22 → ${app.accent}44)` per-app.

**Fix:** đồng nhất 1 màu cố định:
```tsx
const tintBg = '#ffffff';  // hoặc 'var(--color-surface-card)'
```

---

## 7. Common Browser Issues

### Production page không cập nhật

**Causes:**
1. Browser cache
2. Vercel cache
3. Local files lệch HEAD (chưa push)

**Fix sequence:**
1. Hard refresh: `Ctrl+Shift+R`
2. Incognito test: `Ctrl+Shift+N`
3. Check `git log` xem commit có push chưa
4. Check Vercel dashboard deploy status

### Cài app từ Launcher báo "HTTP 404"

GitHub Release `<app>-v<version>` chưa publish hoặc đã xóa.

**Fix:**
1. Update `apps-registry.json`: `status` → `"coming_soon"`
2. Hoặc tạo lại release: `gh release create <app>-v<version> ...`

---

## 8. App-specific

### TrishFont cài chậm + Access denied

Cài tuần tự + retry 3 lần × 150ms = lâu. File đã cài bị lock bởi Windows font cache.

**Fix (đã làm Phase 38):**
- `rayon::par_iter` parallel install
- Skip nếu dest_path đã tồn tại với cùng size
- Retry 2 lần × 50ms thay 3 × 150ms

### TrishCheck License view lặp app

`scan_installed_software` registry trả về 12 entries cho cùng app (vd AutoCAD).

**Fix (đã làm):** `dedupeInstalled()` group theo canonical name (price DB match hoặc strip year/version từ tên).

### TrishLauncher không hiện logo cho 5 app mới

Firestore `apps_meta` chỉ chứa AppRegistryEntry, thiếu AppMeta (logo_path/accent).

**Fix (đã làm):** merge `APP_META[id]` + Firestore data trong `apps-fetch.ts` + `apps-server.ts`.
