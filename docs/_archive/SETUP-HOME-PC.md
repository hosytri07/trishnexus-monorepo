# Checklist cài đặt máy nhà — TrishNexus Phase 14+

**Dành cho Trí khi về máy nhà và không nhớ đã cài thư viện gì.**

Monorepo Phase 14+ dùng stack **Node + pnpm + Rust (Tauri)**. Máy nhà có thể đã có 1 phần (Git, Python legacy), cần cài thêm phần còn lại.

---

## Bước 1 — Kiểm tra nhanh những gì đang có

Mở **Command Prompt** (Start → gõ `cmd` → Enter), gõ 5 lệnh dưới đây và xem kết quả:

```
git --version
node --version
pnpm --version
rustc --version
python --version
```

- **Hiện version** (ví dụ `git version 2.44.0`) → đã cài, skip bước cài.
- **Hiện "'xxx' is not recognized..."** → chưa cài, làm theo bước cài tương ứng bên dưới.

---

## Bước 2 — Cài những thứ còn thiếu

### 2.1 Git (bắt buộc)
- Link tải: <https://git-scm.com/download/win>
- Yêu cầu: version bất kỳ từ 2.30 trở lên.
- Khi cài: giữ mặc định, bấm Next liên tục là được.
- Verify: `git --version`

### 2.2 Node.js 18+ (bắt buộc)
- Link tải: <https://nodejs.org/> → tải bản **LTS** (màu xanh đậm, hiện tại v20.x).
- Yêu cầu: Node ≥ 18.
- Khi cài: check ô "Add to PATH" (mặc định đã check).
- **Không cần check ô "Automatically install the necessary tools..."** — cái đó sẽ cài Chocolatey + Python + VS Build Tools mất ~30 phút. Ta sẽ cài Rust riêng sạch hơn.
- Verify: `node --version` và `npm --version`.

### 2.3 pnpm (bắt buộc)
- Sau khi có Node, mở Command Prompt **admin** (chuột phải → Run as administrator), gõ:
```
npm install -g pnpm
```
- Verify: `pnpm --version`
- Nếu lỗi EACCES hoặc permission — chạy lại trong PowerShell admin.

### 2.4 Rust toolchain (bắt buộc cho desktop app Tauri)
- Link tải: <https://www.rust-lang.org/tools/install>
- Tải `rustup-init.exe` (x86_64 Windows MSVC) → chạy.
- Khi cài: **chọn option 1 "Proceed with installation (default)"** — Enter.
- Rust sẽ tự cài `rustc` + `cargo` + toolchain stable.
- **Yêu cầu phụ**: Rust cần Microsoft C++ Build Tools để compile (vì link với Windows system libs). Nếu rustup báo thiếu thì:
  - Link: <https://visualstudio.microsoft.com/visual-cpp-build-tools/>
  - Tải "Build Tools for Visual Studio" → chạy installer.
  - Chọn workload **"Desktop development with C++"** (chỉ cần phần này, không cần cả VS IDE).
  - Kích thước ~5 GB, cài ~15-20 phút.
- Verify: `rustc --version` và `cargo --version`.

### 2.5 WebView2 Runtime (thường có sẵn trên Win 11)
- Windows 11: thường có sẵn trong Edge. Skip nếu `Win + R → msedge --version` chạy được.
- Windows 10: tải Evergreen Bootstrapper: <https://developer.microsoft.com/en-us/microsoft-edge/webview2/>
- Verify: không cần — Tauri sẽ báo lỗi lúc chạy nếu thiếu.

### 2.6 Python (optional — cho script QA)
- Nếu anh đã có Python 3.11+ thì bỏ qua. Nếu chưa:
  - Link: <https://www.python.org/downloads/>
  - Khi cài: **check ô "Add Python to PATH"** (quan trọng).
- Không bắt buộc cho Phase 14+ — chỉ cần nếu muốn chạy `scripts/qa/gen-icons.py` hoặc legacy Qt app.

---

## Bước 3 — Pull code + init monorepo

Sau khi có đủ Git + Node + pnpm + Rust:

### Nếu máy nhà **chưa có** thư mục `trishnexus-monorepo`:
Mở PowerShell, gõ:
```
cd $HOME\Documents\Claude\Projects\TrishTEAM
git clone https://github.com/hosytri07/trishnexus-monorepo.git
cd trishnexus-monorepo\scripts
.\SETUP.bat
```

### Nếu máy nhà **đã có** thư mục (từ trước Phase 14):
Double-click `scripts\START.bat` → nó pull code mới về. Xong thấy "SAN SANG" thì đóng cửa sổ, bấm tiếp `SETUP.bat` để nó chạy `pnpm install` lần đầu.

---

## Bước 4 — Verify monorepo chạy được

Trong Command Prompt ở thư mục `trishnexus-monorepo`:

```
pnpm qa:all
```

Lệnh này chạy 2 script:
- `pnpm qa:doctor` — kiểm tra consistency 10 desktop app (49 check).
- `pnpm qa:rust` — audit Rust layer (24 check).

Kết quả mong đợi: **73/73 pass, 0 fail**. Nếu lỗi → chụp screenshot gửi Claude.

Test desktop launcher:
```
cd apps-desktop\trishlauncher
pnpm tauri dev
```

Lần đầu cargo build ~5-10 phút. Sau đó cửa sổ launcher hiện ra với 9 app card.

---

## Bước 5 — Mở Cowork + tiếp tục

Sau khi verify xong, mở **Cowork Desktop** → chat mới → gõ:

```
tiếp tục
```

Claude sẽ đọc `docs/SESSION-HANDOFF.md` và pick up từ **Phase 14.5.5.d — System tray**.

---

## Bảng tóm tắt cài đặt

| Thư viện | Bắt buộc? | Version | Thời gian cài |
| --- | --- | --- | --- |
| Git | ✅ | 2.30+ | 2 phút |
| Node.js | ✅ | 18 LTS+ | 5 phút |
| pnpm | ✅ | mới nhất | 30 giây |
| Rust (rustup) | ✅ cho Tauri | stable | 10 phút |
| VS C++ Build Tools | ✅ (Rust dep) | 2019+ | 20 phút |
| WebView2 | Win 10: ✅ | Evergreen | 2 phút |
| Python | ❌ optional | 3.11+ | 5 phút |

**Tổng thời gian cài từ máy trắng:** ~45 phút (chưa tính tải).

**Nếu máy đã có 1 phần:** chỉ cài thứ thiếu, chắc 15-20 phút.

---

## Nếu bí / lỗi

Mở Cowork Desktop → chat mới → paste screenshot lỗi + copy dòng lệnh đã gõ. Claude sẽ chẩn đoán giúp.

Cập nhật: 2026-04-24 · Phase 14.5.5.c.1.
