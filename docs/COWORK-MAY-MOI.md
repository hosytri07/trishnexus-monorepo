# 🎯 COWORK-MAY-MOI.md — Hướng dẫn dùng Cowork trên máy mới

> Khi Trí chuyển sang máy cơ quan (hoặc bất kỳ máy mới nào chưa có gì), đây là quy trình từ 0 đến chạy được TrishTEAM + chat với Claude qua Cowork.

---

## 📋 Checklist nhanh

```
[ ] 1. Copy SETUP-MAY-MOI.bat qua USB / Drive sang máy mới
[ ] 2. Run as administrator → chờ 25-60 phút
[ ] 3. Cài Claude Desktop (Cowork app)
[ ] 4. Mở Cowork → chọn folder TrishTEAM
[ ] 5. Gõ "tiếp tục" → Claude đọc HANDOFF + làm tiếp
```

---

## 🚀 Bước 1 — Bootstrap toolchain (1-click)

### Cách lấy file `SETUP-MAY-MOI.bat` qua máy mới

**Option A — USB**:
1. Trên máy cũ, copy file `C:\Users\TRI\Documents\Claude\Projects\TrishTEAM\SETUP-MAY-MOI.bat` vào USB.
2. Cắm USB vào máy mới, copy bat ra Desktop.

**Option B — Google Drive / OneDrive**:
1. Upload `SETUP-MAY-MOI.bat` lên Drive.
2. Trên máy mới, mở Drive web, tải về Desktop.

**Option C — GitHub Gist hoặc raw URL**: ít dùng vì repo private.

### Chạy script

1. **Right-click → Run as administrator** (BẮT BUỘC — winget cần admin để cài VS Build Tools).
2. Đọc message, bấm Enter để bắt đầu.
3. Chờ script tự cài 13 thứ:
   - Git, GitHub CLI (gh), Node.js LTS, pnpm (qua corepack)
   - Rust toolchain + target windows-msvc
   - **Visual Studio 2022 Build Tools** với workload VCTools + Windows 11 SDK (lâu nhất, 5-15 phút, ~4 GB)
   - Edge WebView2 Runtime
   - VS Code
   - Firebase CLI + Vercel CLI (npm globals)
4. Khi tới bước **auth**, script sẽ pause + mở browser:
   - `gh auth login` → dùng web browser, paste code → đăng nhập GitHub của Trí (`hosytri77@gmail.com`).
   - `firebase login` → dùng Google account `trishteam.official@gmail.com` (chủ project `trishteam-17c2d`).
   - `vercel login` → tài khoản Vercel.
5. Sau auth, script tự `git clone` repo về `%USERPROFILE%\Documents\Claude\Projects\TrishTEAM\trishnexus-monorepo` + chạy `pnpm install` (3-8 phút, ~500 MB).

### Sau khi xong

**Restart máy** (để PATH ổn định + VS Build Tools nhận đủ env vars).

---

## 🤖 Bước 2 — Cài Cowork (Claude Desktop)

Cowork là chế độ trong app **Claude Desktop**. Trí cần cài Claude Desktop nếu chưa có:

1. Vào https://claude.ai/download.
2. Tải bản Windows .exe.
3. Cài đặt theo wizard mặc định.
4. Đăng nhập tài khoản Anthropic của Trí.
5. Trong Claude Desktop, bật **Cowork mode** (Settings → Beta features).

Nếu Cowork chưa available cho tài khoản, đợi Anthropic mở quyền. Trong lúc đó vẫn có thể dùng Claude Code (CLI) hoặc Claude trên web.

---

## 📂 Bước 3 — Cấu hình Cowork cho TrishTEAM

Khi mở Cowork lần đầu:

1. **Add folder** (hoặc nút "+"): chọn `C:\Users\TRI\Documents\Claude\Projects\TrishTEAM\trishnexus-monorepo`.
   - Cowork sẽ scan toàn bộ folder, hiển thị danh sách file.
2. Cowork sẽ tự đọc `CLAUDE.md` (memory) → biết context dự án + quy ước.
3. Gõ "**tiếp tục**" trong chat đầu tiên → Claude:
   - Đọc `docs/HANDOFF-MASTER.md` section `PHIÊN HIỆN TẠI`
   - Biết đang ở Phase 65-77 (TrishUtilities polish xong, Drive bulk downloader, setup script).
   - Hỏi Trí muốn làm gì tiếp.

---

## 🔌 Bước 4 — Plugins / MCP / connectors

Nếu Trí có dùng MCP servers hoặc connectors, cài lại trên máy mới:

| Plugin / MCP | Mục đích | Cài cách nào |
|---|---|---|
| Firebase MCP | Quản lý Firestore từ Claude | Chưa cài / optional |
| GitHub MCP | Tạo issue/PR từ Claude | Chưa cài / optional |
| `claude_in_chrome` | Browser automation | Cài extension Chrome riêng |

Hiện tại workflow đơn giản nhất là chỉ dùng folder access — không cần MCP gì thêm.

---

## 🧪 Bước 5 — Smoke test app

Trong VS Code (đã cài ở bước 1), mở folder repo:

```powershell
cd C:\Users\TRI\Documents\Claude\Projects\TrishTEAM\trishnexus-monorepo
code .
```

Test 1 app dev (vd TrishUtilities):

```powershell
cd apps-desktop\trishutilities
pnpm tauri:dev
```

Lần đầu mất 5-15 phút (Rust compile). Sau đó hiện cửa sổ app. Login bằng Google → vào.

Test 3 app còn lại:
```powershell
cd ..\trishwork && pnpm tauri:dev
cd ..\trishfinance && pnpm tauri:dev
cd ..\trishadmin && pnpm tauri:dev
```

---

## 🔄 Workflow hằng ngày 2 máy (sync qua GitHub)

Sau khi setup xong, Trí dùng 2 script có sẵn:

**Đầu phiên (mỗi sáng)**:
```
scripts\START.bat
```
→ `git pull origin main` để lấy code mới từ máy cũ + chuẩn bị env.

**Cuối phiên (mỗi tối)**:
```
scripts\END.bat
```
→ commit tất cả thay đổi + push lên GitHub. Sáng hôm sau máy kia `START.bat` sẽ thấy.

**Quy ước "phép thuật" với Claude**:
- `tiếp tục` → Claude đọc HANDOFF + tiếp tục dở dang.
- `chốt` / `xong rồi` / `để mai` / `bấm END.bat` → Claude update HANDOFF rồi chào.

Đây là cách 2 máy không bao giờ làm trùng việc — HANDOFF là nguồn duy nhất giữa các phiên.

---

## 🩹 Troubleshoot

### "Cannot find pnpm" sau khi script chạy xong
→ Đóng cmd, mở cmd mới. Hoặc restart máy. PATH cần refresh.

### `pnpm tauri:dev` lỗi "link.exe not found"
→ VS Build Tools chưa cài xong workload C++. Mở **Visual Studio Installer** (search Start) → "Modify" → Workloads → tick "Desktop development with C++" → Modify.

### `cargo build` lỗi "Microsoft C++ Build Tools is required"
→ Same as above.

### `gh auth login` mở browser nhưng không xong
→ Chạy lại trong cmd: `gh auth login`. Chọn HTTPS + Login with web browser.

### `firebase deploy` lỗi quyền
→ `firebase login --reauth` để đăng nhập lại. Đảm bảo dùng Google account `trishteam.official@gmail.com` (owner project `trishteam-17c2d`).

### `vercel` lỗi
→ `vercel login` lại. Hoặc xoá `.vercel/` trong folder repo và `vercel link` để link lại.

### Tauri build lỗi WebView2 / icon
→ Cài Edge WebView2 Runtime thủ công: https://developer.microsoft.com/en-us/microsoft-edge/webview2/

### "Tải quá lâu" pnpm install
→ Bình thường 3-8 phút. Nếu lâu hơn 15 phút, network slow hoặc registry vấn đề. Thử `pnpm config set registry https://registry.npmjs.org/`.

---

## 📚 Files quan trọng

| File | Nội dung |
|---|---|
| `CLAUDE.md` | Memory chính — Claude đọc đầu tiên mỗi session |
| `docs/HANDOFF-MASTER.md` | Nhật ký progress, section "PHIÊN HIỆN TẠI" trên cùng |
| `docs/COWORK-MAY-MOI.md` | File này — guide setup máy mới |
| `scripts/SETUP-MAY-MOI.bat` | Bootstrap 1-click |
| `scripts/START.bat` | Đầu phiên: pull + prepare |
| `scripts/END.bat` | Cuối phiên: commit + push |
| `.firebaserc` | Firebase project: `trishteam-17c2d` |
| `package.json` | Workspace root, pnpm config |
| `pnpm-workspace.yaml` | Định nghĩa workspaces (apps-desktop/* + packages/*) |

---

## 🆘 Nếu hỏng hoàn toàn

Trên máy mới, xoá folder repo + clone lại:
```powershell
cd C:\Users\TRI\Documents\Claude\Projects\TrishTEAM
rmdir /s /q trishnexus-monorepo
git clone https://github.com/hosytri07/trishnexus-monorepo.git
cd trishnexus-monorepo
pnpm install
```

Không bị mất gì vì commits ở GitHub. Chỉ mất file chưa push (gõ `git status` ở máy cũ kiểm tra trước khi clean).

---

**Cập nhật**: 2026-05-25 — Phase 77 (setup script). Xem `HANDOFF-MASTER.md` cho trạng thái mới nhất.
