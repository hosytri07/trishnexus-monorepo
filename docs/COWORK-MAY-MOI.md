# 🎯 COWORK-MAY-MOI.md — Hướng dẫn chuyển máy / mở phiên mới

> File này cover **CẢ HAI tình huống**:
>
> - **TH1** — Máy đã có project sẵn (case phổ biến: chuyển nhà↔cơ quan): chỉ cần `START.bat` + Cowork "tiếp tục". Đi tới [Section A](#-th1--máy-đã-có-project-sẵn-thường-dùng) bên dưới.
> - **TH2** — Máy trắng hoàn toàn (lần đầu setup máy mới): cần `SETUP-MAY-MOI.bat` để cài full toolchain. Đi tới [Section B](#-th2--máy-trắng-hoàn-toàn).

---

## 🟢 TH1 — Máy đã có project sẵn (thường dùng)

### Trước khi rời máy hiện tại (ví dụ: máy nhà)

**1.** Đảm bảo tất cả thay đổi đã commit + push:

```
scripts\END.bat
```

→ Script tự `git add -A` + `git commit` + `git push origin main`. Nếu có conflict thì hỏi Claude fix.

**2.** Báo Claude "chốt" hoặc "xong rồi" để Claude update `docs/HANDOFF-MASTER.md` trước khi commit cuối cùng — đảm bảo máy bên kia biết đang làm dở gì.

### Khi tới máy đích (ví dụ: máy cơ quan)

**1.** Mở `C:\Users\TRI\Documents\Claude\Projects\TrishTEAM\trishnexus-monorepo` trong File Explorer.

**2.** Double-click `scripts\START.bat`. Script tự làm 3 bước:

- `git pull origin main` — kéo code mới nhất
- `pnpm install` — cập nhật dependencies (nếu có thay đổi `package.json`)
- `git status` — show file đang dở (nếu có)

Lần đầu chạy trên máy này, script sẽ hỏi "Máy NHÀ hay CƠ QUAN?" → chọn `2` → ghi vào `.machine-label` (chỉ hỏi 1 lần).

**3.** Mở **Claude Desktop** → **Cowork** mode → chat mới → gõ:

```
tiếp tục
```

Claude sẽ:
- Đọc `CLAUDE.md` (memory)
- Đọc section `📍 PHIÊN HIỆN TẠI` trong `docs/HANDOFF-MASTER.md`
- Biết đang ở đâu (vd Phase 65-77, chờ test Wave 44.8 polyline)
- Hỏi Trí muốn làm gì tiếp.

**Vậy là xong**. Không cần install gì thêm vì toolchain đã có sẵn từ lần setup trước.

### ⚠ Nếu `pnpm install` lỗi sau khi pull

Phổ biến nhất: máy bên kia thêm dependency mới và lockfile bị conflict. Fix:
```
pnpm install --frozen-lockfile=false
```
Hoặc xoá `node_modules` + `pnpm-lock.yaml` rồi cài lại (cẩn thận, mất 5 phút):
```
rmdir /s /q node_modules
pnpm install
```

### ⚠ Nếu Rust compile lỗi sau khi pull (vd command mới trong `lib.rs`)

Lần đầu `pnpm tauri:dev` sẽ build Rust 5-15 phút. Sau đó cache lại, nhanh hơn. Nếu lỗi:
```
cd apps-desktop\trishutilities\src-tauri
cargo clean
cd ..
pnpm tauri:dev
```

---

## 🆕 TH2 — Máy trắng hoàn toàn

(Chỉ áp dụng khi mua máy mới / format máy / lần đầu setup. Bình thường không cần.)

### Checklist 5 bước

```
[ ] 1. Copy SETUP-MAY-MOI.bat qua USB / Drive sang máy mới
[ ] 2. Right-click → Run as administrator → chờ 25-60 phút
[ ] 3. Cài Claude Desktop (Cowork app)
[ ] 4. Mở Cowork → Add folder TrishTEAM
[ ] 5. Gõ "tiếp tục" → Claude đọc HANDOFF + làm tiếp
```

### Bước 1 — Lấy `SETUP-MAY-MOI.bat`

File ở `C:\Users\TRI\Documents\Claude\Projects\TrishTEAM\SETUP-MAY-MOI.bat` (folder cha của repo, hoặc copy từ `scripts/SETUP-MAY-MOI.bat` trong repo).

3 cách lấy sang máy mới:
- **USB**: copy file ra Desktop máy mới.
- **Google Drive / OneDrive**: upload → tải về máy mới.
- **GitHub raw**: ít dùng vì repo private.

### Bước 2 — Chạy script

**Right-click → Run as administrator** (BẮT BUỘC để cài VS Build Tools).

Bấm Enter, script tự cài:

| # | Thứ | Mục đích |
|---|---|---|
| 1 | Git | Version control |
| 2 | GitHub CLI (gh) | Auth + repo helpers |
| 3 | Node.js LTS 22 | Vite + React |
| 4 | pnpm | Workspace manager |
| 5 | Rust + rustup | Compile Tauri backend |
| 6 | VS 2022 Build Tools (C++) | **Bắt buộc cho Rust** (lâu nhất 5-15 phút, ~4 GB) |
| 7 | Edge WebView2 | Tauri renderer |
| 8 | VS Code | Editor |
| 9 | Firebase CLI | Deploy rules / functions |
| 10 | Vercel CLI | Deploy website |
| 11 | `gh auth login` | Browser → đăng nhập GitHub |
| 12 | `firebase login` | Browser → Google account `trishteam.official@gmail.com` |
| 13 | `vercel login` | Browser → Vercel account |
| 14 | `git clone` | Repo về `~/Documents/Claude/Projects/TrishTEAM/` |
| 15 | `pnpm install` | Dependencies (~500 MB, 3-8 phút) |

Sau khi xong, **RESTART máy** để PATH ổn định.

### Bước 3 — Cài Claude Desktop

1. https://claude.ai/download → tải Windows .exe
2. Cài đặt + đăng nhập tài khoản Anthropic.
3. Settings → bật **Cowork mode** (nếu có trong Beta features).

### Bước 4 — Add folder vào Cowork

1. Cowork → nút "+" hoặc "Add folder".
2. Chọn `C:\Users\TRI\Documents\Claude\Projects\TrishTEAM\trishnexus-monorepo`.
3. Cowork scan + tự đọc `CLAUDE.md`.

### Bước 5 — Gõ "tiếp tục"

Y hệt TH1.

---

## 🔄 Workflow ngày-ngày sau khi setup (2 máy đồng bộ qua GitHub)

| Lệnh | Khi nào | Tác dụng |
|---|---|---|
| `scripts\START.bat` | Đầu mỗi phiên | Pull code + pnpm install |
| `scripts\END.bat` | Cuối mỗi phiên | Commit + push + nhắc eject USB nếu có |
| Gõ "tiếp tục" | Mở Cowork mỗi sáng | Claude đọc HANDOFF + làm tiếp |
| Gõ "chốt" / "xong rồi" / "để mai" | Trước khi tắt máy | Claude update HANDOFF trước khi chào |

**Quy tắc vàng**: Không bao giờ tắt máy mà không update HANDOFF. Nếu không, máy bên kia mai sẽ làm trùng hoặc miss context.

---

## 📚 Files quan trọng (cùng chia sẻ giữa 2 máy qua GitHub)

| File | Nội dung |
|---|---|
| `CLAUDE.md` | Memory chính — Claude đọc đầu tiên |
| `docs/HANDOFF-MASTER.md` | Nhật ký progress, section "PHIÊN HIỆN TẠI" trên cùng là current state |
| `docs/COWORK-MAY-MOI.md` | File này — guide chuyển máy |
| `scripts/SETUP-MAY-MOI.bat` | Bootstrap (chỉ dùng TH2) |
| `scripts/START.bat` | Đầu phiên |
| `scripts/END.bat` | Cuối phiên |
| `.machine-label` | (auto-tạo) ghi `home` / `office` để biết đang ở đâu |

---

## 🩹 Troubleshoot

### `git pull` lỗi conflict

Máy này có thay đổi local chưa commit đụng với code mới. Xem `git status`, hoặc nhờ Claude:
```
Tôi git pull bị conflict ở file X, fix giúp
```

### `pnpm install` lỗi sau pull

Thường do lockfile changed. Xem section "TH1 ⚠".

### `pnpm tauri:dev` chạy được nhưng app trắng / blank

Có thể WebView2 lỗi. Cài lại: https://developer.microsoft.com/en-us/microsoft-edge/webview2/

### `cargo build` lỗi "link.exe not found" / "Microsoft C++ Build Tools required"

VS Build Tools workload C++ chưa cài. Mở **Visual Studio Installer** (Start menu) → Modify → Workloads → tick "Desktop development with C++" → Modify.

### `firebase deploy` lỗi quyền

```
firebase login --reauth
```
Đảm bảo dùng Google `trishteam.official@gmail.com`.

### Cowork không thấy folder mới sau khi `git pull`

Cowork cache file list. Restart Cowork hoặc bấm Refresh.

### Nếu hỏng hoàn toàn — wipe + clone lại

```
cd C:\Users\TRI\Documents\Claude\Projects\TrishTEAM
rmdir /s /q trishnexus-monorepo
git clone https://github.com/hosytri07/trishnexus-monorepo.git
cd trishnexus-monorepo
pnpm install
```
Không mất gì vì code đã ở GitHub. Chỉ mất file local chưa push (check `git status` trước nếu lo).

---

**Cập nhật**: 2026-05-25 — Phase 65-77. Xem `HANDOFF-MASTER.md` cho trạng thái mới nhất.
