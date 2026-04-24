# TrishLauncher (Tauri 2)

Desktop launcher cho hệ sinh thái TrishTEAM. Thay thế bản Qt/Python cũ
bằng stack mới gọn hơn, tái sử dụng tối đa code từ website:

```
Rust (Tauri 2)  ──── IPC ────▶  React 18 (Vite) ──▶ @trishteam/core
  - sys_info                     - App.tsx            - apps catalog
  - app_version                  - tauri-bridge.ts    - statusLabel, formatSize
  - opener plugin                - apps-seed.ts       - filterByPlatform
```

## Prerequisites (máy dev)

- Rust ≥ 1.77 (`rustup default stable`)
- Node ≥ 18 + pnpm 9 (đã có ở monorepo root)
- Tauri system deps theo OS:
  - **Windows:** WebView2 Runtime + Microsoft Visual Studio C++ Build Tools
  - **macOS:** Xcode command line tools
  - **Linux:** `webkit2gtk-4.1`, `libssl-dev`, `libayatana-appindicator3-dev`

Cài Tauri CLI global (lần đầu):

```bash
cargo install tauri-cli --version "^2.0"
# hoặc chỉ dùng @tauri-apps/cli đã declare trong package.json:
pnpm add -D @tauri-apps/cli@^2.0
```

## Develop

```bash
# 1. Từ repo root — install deps toàn monorepo
pnpm install

# 2. Vào launcher
cd apps-desktop/trishlauncher

# 3a. Dev chỉ UI (trong browser, không Rust) — nhanh iterate CSS
pnpm dev

# 3b. Dev full — Tauri spawn Rust + webview window
pnpm tauri:dev
```

Khi chạy `pnpm dev` trong browser, `tauri-bridge.ts` sẽ detect không
có `window.__TAURI_INTERNALS__` và trả fallback data (OS = `browser-dev`).
UI vẫn render đủ nhưng button "Tải về" chuyển thành mở tab mới.

## Build release installer

```bash
pnpm tauri:build
```

Tauri 2 tự bundle theo OS host:

- Windows → `.msi` + `.exe` (NSIS) tại `src-tauri/target/release/bundle/`
- macOS → `.dmg` + `.app`
- Linux → `.deb` + `.AppImage`

> Code-sign + notarize để release thật sẽ làm ở Phase 17.2 (EV cert).

## Tauri commands hiện có (alpha.1)

| Command | Frontend wrapper (`tauri-bridge.ts`) | Trả về |
| ------- | ------------------------------------ | ------ |
| `sys_info` | `getSysInfo()` | OS, arch, CPU, RAM, hostname |
| `app_version` | `getAppVersion()` | `CARGO_PKG_VERSION` |

Filesystem write + installer runner sẽ thêm ở Phase 14.2.x khi launcher
bắt đầu quản lý app thật (download + verify sha256 + spawn installer).

## Icon placeholder

`src-tauri/icons/` hiện rỗng — cần chạy `cargo tauri icon path/to/source.png`
để generate đủ set (32x32, 128x128, 256x256, .icns, .ico) trước khi
bundle release. Xem Phase 14.6 / 17.2.

## Architecture notes

- **pnpm workspace protocol** — dùng `"@trishteam/core": "workspace:*"`.
  pnpm symlink vào `packages/core` và resolve subpath (`/apps`, `/clean`…)
  qua `exports` field. tsconfig paths trỏ thẳng `src/index.ts` khi cần
  typecheck local, không cần build step.
- **CSP strict** — mặc định chỉ cho `https://*.firebaseio.com`,
  `*.googleapis.com`, `*.trishteam.io.vn`. Khi thêm endpoint khác,
  sửa `src-tauri/tauri.conf.json` → `app.security.csp`.
- **Minimal capabilities** — chỉ `opener:allow-open-url`. Cần write
  file hay shell exec thì phải add capability rõ ràng.
