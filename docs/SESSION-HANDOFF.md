# Session Handoff — TrishNexus

**Mục đích:** Claude ở session Cowork mới đọc file này để pick up công việc đúng chỗ.

**Ngôn ngữ giao tiếp với user:** Tiếng Việt. User là Trí (hosytri07 / hosytri07@gmail.com), không phải developer — cần giải thích đơn giản, tránh jargon khi không cần thiết.

---

## 🚨 RULES BẮT BUỘC CHO CLAUDE

### Khi bắt đầu session
- Nếu user gõ `tiếp tục`, `tiếp tục từ handoff`, `pick up`, hoặc chỉ nói `tiếp tục` → đọc file này ngay, không hỏi gì thêm trước.
- Tóm tắt 2-3 dòng cho user biết "đang ở bước nào" rồi mới đề xuất action tiếp theo.

### Trước khi kết thúc session (QUAN TRỌNG)
- Luôn update section **"Trạng thái hiện tại"** ở dưới trước khi user đóng chat.
- Cụ thể: đánh dấu ✅ việc đã xong, cập nhật section "Đang dở — PICK UP TỪ ĐÂY", thêm file code quan trọng mới tạo.
- Nếu user nói kiểu "xong hôm nay rồi" / "chốt" / "để mai làm tiếp" / "bấm END.bat" → trigger update handoff TRƯỚC khi chào tạm biệt.
- Lý do: máy kia (nhà ↔ cơ quan) sẽ đọc file này khi mở chat mới — nếu handoff cũ, Claude sẽ làm trùng việc hoặc bỏ sót.

---

## Workflow đổi máy (Plan B — GitHub sync, đã chốt)

**Quy trình mỗi máy:** `START.bat` → mở Cowork chat mới → gõ `tiếp tục` → làm việc → `END.bat`

- Repo chính: Windows local (không USB). Path trên máy nhà: `C:\Users\TRI\Documents\Claude\Projects\TrishTEAM\trishnexus-monorepo\`
- Đồng bộ qua GitHub: `hosytri07/trishnexus-monorepo`
- **Máy cơ quan lần đầu (bootstrap):** mở PowerShell → `cd Documents\Claude\Projects` → `git clone https://github.com/hosytri07/trishnexus-monorepo.git TrishTEAM\trishnexus-monorepo` → chạy `SETUP.bat` 1 lần duy nhất. Từ đó dùng START/END bình thường.

---

## Trạng thái hiện tại (cuối session 2026-04-25 — máy nhà, **Phase 14.7 FULL DONE: Release published + Website live tại https://trishteam.io.vn**)

### Ship session này (2026-04-24 tối — máy cơ quan, tiếp theo sau 14.5.5.e)

**Phase 14.6.a — Registry loader** (shipped 2026-04-24):

- ✅ **registry-loader.ts** (`apps-desktop/trishlauncher/src/registry-loader.ts`, ~132 dòng): Module fetch JSON registry từ URL user config. Export `loadRegistry(configUrl): Promise<RegistryLoadResult>` với shape `{ registry, source: 'seed'|'remote', fetchedAt, error }` — **không throw** để UI luôn render được.
    - URL rỗng → seed luôn, không network.
    - `fetchRemote` có `AbortController` timeout 8s + `Accept: application/json` header + `cache: 'no-cache'`.
    - `isValidRegistry` runtime check: `schema_version === 2` + `apps` phải là array + `ecosystem` phải là object. Sai shape → ném lỗi `registry shape mismatch` → caller fallback seed.
    - `resolveRegistryUrl(raw)`: nếu URL không kết thúc `.json` thì tự append `apps-registry.json` (convention CDN folder prefix).
    - Log `console.warn` khi fail để dev debug nhưng không block user.

**Phase 14.6.b — Auto-update scheduler** (shipped 2026-04-24):

- ✅ **update-scheduler.ts** (`apps-desktop/trishlauncher/src/update-scheduler.ts`, ~87 dòng): Module quản lý interval re-fetch dựa `settings.autoUpdateInterval`.
    - `getLastFetchMs/setLastFetchMs`: persist epoch ms trong localStorage key `trishlauncher:registry:last_fetch_ms`.
    - `shouldRefetch(interval)`: `'off'` → false, chưa fetch lần nào → true, khác → so sánh `Date.now() - last >= INTERVAL_MS[interval]` (daily = 24h, weekly = 7d).
    - `startScheduler(interval, onDue) → cleanup`: fire `onDue()` ngay nếu overdue (không chờ tick đầu), rồi `setInterval(1h poll)` check định kỳ. Trả cleanup function để `useEffect` dọn khi unmount / interval đổi.
    - `'off'` → trả no-op cleanup (không schedule).
    - Note trong code: launcher không chạy 24/7, scheduler chỉ có hiệu lực trong lifecycle app mở — đủ cho use case bật mỗi sáng. Phase 14.6.e sẽ cân nhắc Rust background scheduler sau.

- ✅ **App.tsx** wiring (`apps-desktop/trishlauncher/src/App.tsx`, ~360 dòng):
    - Import `loadRegistry/RegistryLoadResult` + `startScheduler/setLastFetchMs`.
    - State `[registryResult, setRegistryResult]` init với `{ registry: SEED_REGISTRY, source: 'seed', fetchedAt: null, error: null }`.
    - `useEffect` phụ thuộc `settings.registryUrl`: `loadRegistry(url)` → `setRegistryResult(next)` + `setLastFetchMs(Date.now())` nếu remote OK.
    - `useEffect` phụ thuộc `settings.autoUpdateInterval + settings.registryUrl`: `startScheduler(interval, () => loadRegistry(url).then(...))` → cleanup đúng cách khi interval đổi.
    - Thay `SEED_REGISTRY.ecosystem.{tagline,website}` trong JSX bằng `registryResult.registry.ecosystem.*` → UI tự follow remote khi fetch thành công.
    - Topbar sysbar hiện 2 pill status:
        - `.sysbar-pill-ok` (xanh): "Bản mới nhất từ remote" kèm timestamp `new Date(fetchedAt).toLocaleTimeString()`.
        - `.sysbar-pill-warn` (hổ phách): "Đang dùng bản seed" + tooltip error message nếu có (giúp user biết URL sai).

**Phase 14.6.d — Fix status + replace launcher icon** (shipped 2026-04-24, cùng phiên):

- ✅ **apps-seed.ts** (`apps-desktop/trishlauncher/src/apps-seed.ts`): Đổi TẤT CẢ 9 app từ `status: 'released'` / `'beta'` → `status: 'coming_soon'` vì chưa có binary thật trên CDN. Logic `cta.ts` sẵn có: status `coming_soon` → nút **"Sắp ra mắt"** (disabled) thay cho nút "Tải về" xanh dẫn tới URL 404. UI bây giờ đúng thực tế — không nói dối user. Khi nào Phase 14.7 upload binary app X lên CDN → đổi riêng app X về `'released'`.
- ✅ **Icons launcher** (`apps-desktop/trishlauncher/src-tauri/icons/*`): Replace 6 file icon cũ (chữ "L" trắng nền xám, không đúng branding) bằng logo TrishLauncher thật (**T navy + rocket vàng + vuông vàng góc trên phải, nền trong suốt**). Source: `apps/trishlauncher/src/trishlauncher/resources/logos/trishlauncher.png` (256×256 RGBA, đã xóa background) → upscale Lanczos lên 1024×1024 → gen 6 file Tauri chuẩn qua Python PIL:
    - `icon.png` 1024×1024 (219 KB)
    - `128x128@2x.png` 256×256 (32 KB)
    - `128x128.png` 128×128 (12 KB)
    - `32x32.png` 32×32 (2 KB)
    - `icon.ico` multi-size Windows 16/24/32/48/64/128/256 (59 KB)
    - `icon.icns` macOS (466 KB)

**Phase 14.6.c — Bundle config v2.0.0** (shipped 2026-04-24):

- ✅ **tauri.conf.json** (`apps-desktop/trishlauncher/src-tauri/tauri.conf.json`, 91 dòng):
    - Thêm `"label": "main"` cho window đầu tiên → Rust `get_webview_window("main")` trong tray code match explicit thay vì dựa default.
    - `bundle.homepage: "https://trishteam.io.vn"` cho meta installer.
    - `bundle.windows.nsis`: `installMode: "perMachine"` (installer hỏi UAC đúng chuẩn), `languages: ["English", "Vietnamese"]`, `displayLanguageSelector: true` (user chọn VN/EN khi chạy installer), `installerIcon: "icons/icon.ico"`.
    - `bundle.windows.wix.language: ["en-US", "vi-VN"]` cho bản .msi song ngữ (dev tools enterprise).
    - `bundle.linux.deb.depends: [libwebkit2gtk-4.1-0, libgtk-3-0, libayatana-appindicator3-1, librsvg2-2]` → `apt install` tự kéo runtime deps cần cho tray + SVG icon. `section: "utils"` cho đúng Debian category.
    - `bundle.linux.appimage.bundleMediaFramework: false` → bỏ gstreamer khỏi AppImage (~80MB tiết kiệm, launcher không cần media).
    - `bundle.macOS.minimumSystemVersion: "10.15"` + `dmg.windowSize: 660x400` cho UX install-drag.
    - `plugins.updater.active: false` — **deferred Phase 17.2** khi có EV cert (không signed thì auto-update bị Windows SmartScreen block, không có value).

**Phase 14.7.a/b/c — Website /downloads + registry public** (shipped 2026-04-24):

- ✅ **Website location** (`website/`, không phải `apps/web/`): Next.js 14 App Router, pnpm workspace entry `website`. Đây là website công khai `trishteam.io.vn`.
- ✅ **apps-registry.json** (`website/public/apps-registry.json`, 9 apps): Mirror đúng shape `SEED_REGISTRY` trong `apps-seed.ts`. `schema_version: 2`, `ecosystem.{name, tagline, logo_url, website}`, và 9 app đều `status: "coming_soon"`. Sau deploy Next.js, launcher fetch được ở `https://trishteam.io.vn/apps-registry.json` — khớp convention `resolveRegistryUrl()` trong registry-loader.
- ✅ **page.tsx** (`website/app/downloads/page.tsx`, ~50 dòng): Server component, export `metadata` Next.js + import `DownloadCards`. Hiện title "Tải TrishLauncher", mô tả ecosystem, note version `v2.0.0-1 (alpha)` + cảnh báo SmartScreen.
- ✅ **DownloadCards.tsx** (`website/app/downloads/DownloadCards.tsx`, ~220 dòng, `'use client'`): OS detect qua `navigator.userAgent` trong `useEffect` (tránh SSR hydration mismatch). 5 target: Windows .exe (available), Windows .msi (available), macOS .dmg / Linux .deb / Linux .AppImage (coming_soon). `releaseUrl()` template `https://github.com/hosytri07/trishnexus-monorepo/releases/download/launcher-v2.0.0-1/<file>`. UI: primary card "Phù hợp máy của bạn" ở trên + list "Các nền tảng khác" bên dưới + section PowerShell/shasum verify SHA256.

**Phase 14.7.d — CI release workflow + hướng dẫn upload** (shipped 2026-04-24):

- ✅ **.github/workflows/build-launcher.yml** (~160 dòng): Trigger `push tags launcher-v*` hoặc `workflow_dispatch`. Chạy `windows-latest`: `pnpm/action-setup@v4 (9.15.0)` → `actions/setup-node@v4 (node 20, cache pnpm)` → `dtolnay/rust-toolchain@stable` → `Swatinem/rust-cache@v2` (cache `apps-desktop/trishlauncher/src-tauri -> target`) → `pnpm install --frozen-lockfile` → `pnpm -r --filter './packages/*' build` → `pnpm tauri build`. Collect step tạo `SHA256SUMS.txt` gộp cả 3 file (nsis .exe + 2 msi en-US/vi-VN), expose sha256 + size primary cho release body. `softprops/action-gh-release@v2` upload 4 asset, `prerelease: true`.
- ✅ **docs/RELEASE-LAUNCHER.md**: 2 phương án song song — (1) push tag + CI lo, (2) upload thủ công bản đã build local qua `gh release create` hoặc web UI. Bảng checksum 3 file đã verify kèm checklist sau publish + note bump version 3 chỗ (package.json + Cargo.toml + tauri.conf.json) + nhắc MSI yêu cầu numeric-only pre-release (`-1`, `-2`, `-3`...).
- ✅ **docs/release-notes/launcher-v2.0.0-1.md**: Template release notes đầy đủ (điểm chính, bảng file + size + SHA256, đã biết, phase kế tiếp). Dùng làm `--notes-file` cho `gh release create` hoặc copy vào textarea GitHub web UI.
- ✅ **src-tauri/target/release/bundle/SHA256SUMS.txt** (local, không commit): Generated sẵn từ 3 file đã build — chỉ cần upload kèm nếu đi phương án manual.

Kích thước + checksum bản build hiện tại trên máy Trí:

| File | Size | SHA256 |
| --- | --- | --- |
| `TrishLauncher_2.0.0-1_x64-setup.exe` | 5.3 MB | `d86089cd…f2b1f` |
| `TrishLauncher_2.0.0-1_x64_en-US.msi` | 3.4 MB | `87503f93…d8196` |
| `TrishLauncher_2.0.0-1_x64_vi-VN.msi` | 3.4 MB | `1038224a…4c3e` |

**Phase 14.7.e — Fix Vercel monorepo build** (shipped 2026-04-25):

- ✅ **website/next.config.mjs**: Thêm 2 config bắt buộc cho Next.js 14 + pnpm workspace TS source exports:
    - `transpilePackages: ['@trishteam/core', '@trishteam/ui', '@trishteam/adapters', '@trishteam/data']` — bắt Next.js SWC transpile TS source của 4 workspace packages (packages export `.ts` nguồn trực tiếp, không build dist).
    - `webpack.resolve.extensionAlias: { '.js': ['.ts', '.tsx', '.js', '.jsx'], '.mjs': ['.mts', '.mjs'], '.cjs': ['.cts', '.cjs'] }` — map `.js` import trong TS source → file `.ts/.tsx` thực tế. Cần khi TS dùng `moduleResolution: NodeNext` với `"type": "module"` (TS source viết `export * from './types.js'` nhưng file thật là `types.ts`).
    - Thiếu 1 trong 2 → Vercel build fail với `Module not found: Can't resolve './types.js'`.

**Phase 14.7 — Release published + Website deployed** (shipped 2026-04-25):

- ✅ **GitHub Release `launcher-v2.0.0-1`**: Published tại `https://github.com/hosytri07/trishnexus-monorepo/releases/tag/launcher-v2.0.0-1`. 4 asset: nsis `.exe` (5.3 MB) + 2 `.msi` en-US/vi-VN (3.4 MB each) + `SHA256SUMS.txt`. Prerelease flag. Dùng phương án manual (`gh release create`) thay vì CI vì build đã có sẵn local.
- ✅ **Vercel project**: `hosytri07/trishnexus-monorepo` → Framework Next.js → Root Directory `website` → Install Command `cd .. && pnpm install --frozen-lockfile` → env var `ENABLE_EXPERIMENTAL_COREPACK=1` (bắt Vercel dùng pnpm 9.15.0 từ `packageManager` field thay vì default pnpm 6.35.1). Production deployment auto-trigger khi push `main`.
- ✅ **Custom domain `trishteam.io.vn`**: Đăng ký tại Tenten.vn (expire 2027-04-21). NS đã trỏ về `ns-b1/b2/b3.tenten.vn`. DNS records:
    - `A @ 216.198.79.1` (Vercel Anycast IP mới, thay `76.76.21.21` cũ)
    - `CNAME www 1c03c3aef23280e2.vercel-dns-017.com`
- ✅ **Live URLs** (verified 2026-04-25):
    - `https://trishteam.io.vn` — landing page
    - `https://www.trishteam.io.vn` — 307 redirect về root
    - `https://trishteam.io.vn/downloads` — download cards (OS-detect, Windows .exe primary)
    - `https://trishteam.io.vn/apps-registry.json` — registry JSON cho launcher fetch
    - SSL cert auto-provisioned by Vercel (Let's Encrypt)

**Phase 14.7.f — CORS headers cho registry endpoint** (shipped 2026-04-25):

- ✅ **website/next.config.mjs** thêm `async headers()`: source `/apps-registry.json` → `Access-Control-Allow-Origin: *` + `Access-Control-Allow-Methods: GET, OPTIONS` + `Cache-Control: public, s-maxage=300, stale-while-revalidate=86400`. Vercel mặc định không set CORS cho static files trong `public/` — phải opt-in qua headers config.
- Lý do fail trước fix: Tauri WebView (origin `tauri://localhost` / dev `http://localhost:1420`) fetch cross-origin sang `https://trishteam.io.vn` bị browser block CORS preflight. Curl với `-L` follow redirect không bị (Rust client không enforce CORS).
- ⚠ Dù fix CORS này nhưng vẫn còn 307 redirect chain cross-origin block fetch cuối → giải pháp bền hơn là 14.7.g (Rust-side fetch).

**Phase 14.7.g — Rust-side registry fetch (BYPASS CORS/CSP/redirect)** (shipped 2026-04-25):

- ✅ **apps-desktop/trishlauncher/src-tauri/Cargo.toml**: thêm `reqwest = { version = "0.12", default-features = false, features = ["rustls-tls"] }`. Rustls thay vì native-tls → không phụ thuộc OpenSSL/SChannel runtime. Webpki-roots bundled đủ verify Let's Encrypt cert.
- ✅ **lib.rs**: thêm `#[tauri::command] async fn fetch_registry_text(url: String) -> Result<String, String>` (~30 dòng). Build `reqwest::Client` với timeout 10s + User-Agent `TrishLauncher/<version>` + header `Accept: application/json`. Status non-2xx → Err. Trả body text — frontend tự `JSON.parse` (separation of concerns).
- ✅ **tauri-bridge.ts**: thêm `fetchRegistryText(url)` wrapper invoke. Browser dev mode (`!isInTauri()`) fallback browser fetch (sẽ bị CORS — chỉ dùng để soi UI, OK).
- ✅ **registry-loader.ts** refactor:
    - Constant `DEFAULT_REGISTRY_URL = 'https://trishteam.io.vn/apps-registry.json'` hardcode.
    - `loadRegistry(overrideUrl?: string)` — empty/undefined override → dùng default URL. Admin có thể override qua localStorage.
    - Bỏ `resolveRegistryUrl()` heuristic (đã gây bug append `/apps-registry.json` sau query string `?v=2`).
    - Bỏ `cache: 'no-store'` config browser fetch (Rust dùng reqwest không cache).
- ✅ **App.tsx** scheduler: bỏ early-return `if (!settings.registryUrl.trim()) return;` — luôn schedule với default URL. `startScheduler('off')` tự no-op nên không cần guard.

**Phase 14.7.h — Ẩn Registry URL field trong SettingsModal** (shipped 2026-04-25):

- ✅ **components/SettingsModal.tsx**: xóa section `<input type="url">` cho `settings.registryUrl`. Comment trỏ tới Phase 14.7.h. Schema settings.ts vẫn giữ field `registryUrl` (backward compat — admin override qua localStorage `trishlauncher:settings:v1` field `registryUrl` nếu cần đổi sang staging URL). Future TrishAdmin app sẽ có UI quản lý chuyên biệt.
- End-user thấy 3 mục: Giao diện / Ngôn ngữ / Tự kiểm tra bản mới. Không còn confused về "Registry URL là gì".

**Phase 14.7.j — UI polish: pill text + footer release counter** (shipped 2026-04-25):

- ✅ **i18n/index.ts** thêm key VI/EN:
    - `sysbar.connected`: "Đã kết nối" / "Connected"
    - `sysbar.offline`: "Offline — dùng bản gốc" / "Offline — using bundled"
    - `footer.apps_released`: "phần mềm đã phát hành" / "apps released"
- ✅ **App.tsx**:
    - Pill `● remote` → `● Đã kết nối` (xanh)
    - Pill `⚠ seed fallback` → `⚠ Offline — dùng bản gốc` (hổ phách)
    - Footer "9 app trong ecosystem" → "0/9 phần mềm đã phát hành" (đếm `apps.filter(a => a.status === 'released').length`).
    - Khi từng app launch lên CDN thật → đổi field `status` trong `apps-registry.json` từ `coming_soon` → `released` → footer tự cập nhật ngay không cần ship lại launcher.

### Đang dở — PICK UP TỪ ĐÂY (session sau)

**Phase 14.7 hoàn thành xong code.** Cần làm:

**Việc 1 — Rebuild + reupload launcher production:**

1. `cd apps-desktop/trishlauncher && pnpm tauri build` (~10-15 phút) — bundle code mới với Rust fetch + UI polish.
2. Generate `SHA256SUMS.txt` mới qua PowerShell `Get-FileHash` cho 3 file output.
3. `gh release upload launcher-v2.0.0-1 <files> --clobber --repo hosytri07/trishnexus-monorepo` để replace asset cũ trên GitHub Release (giữ tag, không bump version vì chưa user nào tải về thực tế).
4. Reinstall trên máy → verify pill xanh "Đã kết nối" + Settings không còn Registry URL field + footer "0/9 phần mềm đã phát hành".

**Việc 2 — Phase 15.0: TrishCheck (app con đầu tiên):**

Sau khi launcher production stable, ship app con đầu tiên. Recommend **TrishCheck** trước TrishFont vì:
- Read-only (chỉ đọc system info), không phá data, không cần handle file write.
- Dùng `sysinfo` crate sẵn (đã có trong launcher) → không thêm dep mới.
- Pattern đơn giản, học stack Tauri 2 + tokens v2 trên 1 app rồi áp dụng cho 8 app còn lại.
- Build → release → user thấy có app thật chạy được (1/9 trong launcher footer).

Plan TrishCheck:
- Tạo `apps-desktop/trishcheck/` skeleton tương tự TrishLauncher (Tauri 2 + React + TS + tokens v2).
- Features: OS info, CPU model + count + load, RAM total/used, GPU info, disk usage per drive, network adapter list, benchmark CPU (single-core + multi-core qua `criterion` hoặc đơn giản `std::time::Instant`), benchmark disk read/write speed.
- UI: 1 page với cards cho từng category. Export report dạng JSON/Markdown.
- Bundle: NSIS .exe + MSI en-US/vi-VN (cùng pattern launcher).
- Tag GitHub Release: `trishcheck-v2.0.0-1`.
- Khi release → đổi `status: 'coming_soon'` → `'released'` trong cả `apps-desktop/trishlauncher/src/apps-seed.ts` **và** `website/public/apps-registry.json`. Thêm `download.windows_x64.url` trỏ tới GitHub Release asset.

### Đang dở phụ (optional, sẽ làm session sau)

- **Phase 14.6.e — Rust background scheduler** (deferred): Cân nhắc chuyển update scheduler sang Rust side dùng `tokio::time::interval` để check cả khi app minimize tray. Hiện tại JS `setInterval` chỉ chạy khi webview alive — nhưng launcher thường mở xuyên phiên làm việc nên không critical.
- **Phase 14.8 — macOS / Linux build** (khi có runner): Mở rộng `build-launcher.yml` thêm job `build-macos` (macos-14 arm64) và `build-linux` (ubuntu-22.04). Trên macOS cần `codesign` + notarize nếu muốn user không thấy Gatekeeper cảnh báo — defer đến khi có Apple Developer account. Linux `.deb` + `.AppImage` thẳng tiến, không cần sign.
- **Phase 15.x — Ship app con đầu tiên**: TrishFont 2.0.0 Tauri (viết lại từ PyQt cũ) → khi release, đổi `status: 'coming_soon'` → `'released'` trong cả `apps-seed.ts` và `website/public/apps-registry.json`, thêm field `download.windows_x64.sha256` thật.
- **Phase 17.2 — EV Code Signing**: Khi mua EV cert, bật `plugins.updater.active: true` + signed auto-update trong `tauri.conf.json`.

### Context quan trọng cho session sau

- **Sandbox limitation:** pnpm NTFS symlink không resolve qua WSL → `tsc`/`cargo check` không chạy được trong sandbox Linux. Trí verify thực trên Windows 11 bằng `pnpm qa:all` + `pnpm tauri dev` per app.
- **Tauri version lock** (Cargo.lock): `tauri 2.10.3`, `tauri-runtime 2.10.1`, `tauri-runtime-wry 2.10.1`, `tauri-plugin-opener 2.5.3`. Đủ mới để hỗ trợ `show_menu_on_left_click` + `TrayIconBuilder::with_id` + `Submenu::with_items`.
- **Repo path máy nhà:** `C:\Users\TRI\Documents\Claude\Projects\TrishTEAM\trishnexus-monorepo\` (theo convention CLAUDE.md).
- **Nếu máy nhà chưa có monorepo:** chạy `SETUP.bat` 1 lần (check Git/Node/pnpm/Rust + pnpm install). Dung lượng sau SETUP: ~950MB (node_modules 623MB + .venv 295MB + code ~30MB). Sau `pnpm tauri dev` lần đầu target/ phình lên ~1.5GB thêm — bình thường, không đẩy git.
- **Mỗi phiên:** bấm `START.bat` → pull + pnpm install tự động → mở Cowork chat mới → gõ `tiếp tục` → Claude đọc file này + pick up từ phần "Đang dở".
- **Cuối phiên:** bấm `END.bat` → commit + push tự động.
- **File tool cache issue (sandbox):** WSL 9P mount có thể đọc bản cache cũ của file khi Tauri app / Vite đang chạy. Nếu Claude grep không thấy content rồi `cat >>` append → duplicate. An toàn hơn: Read tool (đọc Windows path trực tiếp) để verify trước khi edit.

---

## Trạng thái cũ — Phase 14.5.5.e (archived 2026-04-24 tối)

**Phase 14.5.5.e — Settings modal** (shipped 2026-04-24 tối):

- ✅ **settings.ts** (`apps-desktop/trishlauncher/src/settings.ts`, 101 dòng): Schema `Settings { theme, language, registryUrl, autoUpdateInterval }` + `loadSettings/saveSettings` với localStorage key `trishlauncher:settings:v1`. Validator defensive cho mỗi enum field → corrupt value fall về default thay vì crash. Helper `applyTheme(mode)` set/remove `data-theme` attribute trên `document.documentElement`.
- ✅ **i18n/index.ts** (`apps-desktop/trishlauncher/src/i18n/index.ts`, 94 dòng): Dictionary VN/EN inline + `t(key, lang)` + `makeT(lang)` factory. Fallback: miss EN → tra VI → literal key (dev bug dễ phát hiện). Dictionary cover topbar/footer/empty state/settings modal (25+ keys). Các label trong card + AppDetailModal tạm giữ Tiếng Việt — phase sau bù i18n full UI khi ổn định.
- ✅ **components/SettingsModal.tsx** (`apps-desktop/trishlauncher/src/components/SettingsModal.tsx`, 185 dòng): Modal dùng pattern AppDetailModal (overlay click close + Esc + stopPropagation). 4 section: theme (radio 3 option), language (radio 2), registry URL (input), auto-update (select). Draft state local → `onSave(next)` mới commit. Preview language live trong modal (đổi VN ↔ EN label ngay khi chọn radio).
- ✅ **styles.css** (`apps-desktop/trishlauncher/src/styles.css`):
    - Thay `@media (prefers-color-scheme: dark) { :root {...} }` thành `:root:not([data-theme='light']) {...}` để không override khi user chọn light thủ công.
    - Thêm `:root[data-theme='dark']` + `:root[data-theme='light']` để force theme.
    - Classes mới: `.topbar-actions`, `.modal-dialog-settings`, `.modal-head-simple`, `.settings-section`, `.settings-radio-group`, `.settings-radio`, `.settings-radio-active`, `.settings-input`, `.settings-select`, `.settings-hint`.
    - Thêm `.sysbar-pill`, `.sysbar-pill-ok` (xanh), `.sysbar-pill-warn` (hổ phách) cho badge remote/seed source (dùng tiếp trong 14.6.a).
- ✅ **App.tsx** (`apps-desktop/trishlauncher/src/App.tsx`): Import `loadSettings/saveSettings/applyTheme/Settings` + `SettingsModal` + `makeT`. State `[settings, setSettings]` lazy init từ `loadSettings()`, `[settingsOpen]`. `tr = useMemo(() => makeT(settings.language), ...)`. `useEffect` apply theme mỗi khi `settings.theme` đổi. Topbar wrap 2 button trong `.topbar-actions` — button "Cài đặt" mới + "Mở website". Empty state + footer dùng `tr()` cho label. Render `<SettingsModal>` khi `settingsOpen`: onSave = applyTheme ngay → setSettings → saveSettings → đóng modal.

---

## Trạng thái cũ — Phase 14.5.5.d (archived 2026-04-24 tối)

**Phase 14.5.5.d — System tray** (shipped 2026-04-24 chiều):

- ✅ **Cargo.toml** (`apps-desktop/trishlauncher/src-tauri/Cargo.toml`): bật feature `tray-icon` cho `tauri = { version = "2.0", features = ["tray-icon"] }` → dùng `tauri::tray::TrayIconBuilder` + `tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu}` built-in, **không cần plugin ngoài**, **không cần `pnpm add`**.
- ✅ **lib.rs** (`apps-desktop/trishlauncher/src-tauri/src/lib.rs`, ~400 dòng sau update):
    - Thêm `struct QuickLaunchItem { id, label, path }` + `struct TrayState { quick_launch: Mutex<Vec<_>> }` shared state.
    - Hàm `build_tray_menu(&AppHandle, &[QuickLaunchItem]) -> Result<Menu<Wry>>` dựng đầy đủ menu: `Mở TrishLauncher / Ẩn xuống tray / — / Mở nhanh app đã cài (submenu) / — / Thoát TrishLauncher`. Submenu rỗng khi list trống thay bằng 1 item disabled `(Chưa phát hiện app nào đã cài)` cho UX rõ ràng.
    - Hàm `apply_tray_menu(&AppHandle, Menu)` rebuild menu trên tray `main` đang tồn tại.
    - Command `update_tray_quick_launch(app, state, items: Vec<QuickLaunchItem>)`: lưu state + rebuild menu. Frontend gọi sau mỗi lần `detect_install` xong.
    - Helper `focus_main_window(&AppHandle)`: unminimize + show + set_focus cho menu "Mở" và click tray trái.
    - Helper `spawn_open(&str) -> io::Result<Child>`: cross-platform launch (Windows `cmd /c start`, macOS `open -a`, Linux `xdg-open`) — tái sử dụng cùng matrix với `launch_path` command mà không phải invoke ngược.
    - `pub fn run()` mở rộng:
        - `.manage(TrayState::default())` register state.
        - `.invoke_handler(...)` thêm `update_tray_quick_launch`.
        - `.setup(|app| { ... })` dựng `TrayIconBuilder::with_id("main")` với icon = `app.default_window_icon()`, tooltip `"TrishLauncher — 10 ứng dụng tiện ích"`, menu cơ bản (rỗng quick-launch), `.show_menu_on_left_click(false)`.
        - `on_menu_event`: match `tray:show` / `tray:hide` / `tray:quit` / `tray:launch:<id>` — case cuối lookup path từ `TrayState.quick_launch` để spawn (không trust label, tránh injection).
        - `on_tray_icon_event`: click trái → toggle window (visible = hide, hidden = show + focus).
        - `.on_window_event(|window, event|)`: `WindowEvent::CloseRequested` cho window "main" → `window.hide() + api.prevent_close()` thay vì quit. User phải Thoát qua menu tray mới exit hẳn.
    - **Gotcha đã fix sẵn:** `Menu::with_items` + `Submenu::with_items` cần `&[&dyn IsMenuItem<Wry>]`, array literal không tự coerce cross-type → explicit cast phần tử đầu `&show_i as &dyn tauri::menu::IsMenuItem<tauri::Wry>`, các phần tử sau auto-coerce theo element type của array.
- ✅ **tauri-bridge.ts** (`src/tauri-bridge.ts`): export `interface QuickLaunchItem` + `updateTrayQuickLaunch(items)` — graceful degradation (no-op trong browser dev mode).
- ✅ **App.tsx** (`src/App.tsx`): sau khi `detectInstall` xong trong useEffect → build `QuickLaunchItem[]` từ `results.filter(state === 'installed' && path)` (label lấy `compatApps.name`) → gọi `updateTrayQuickLaunch(items)`. Tray menu tự sync mỗi lần platform hoặc compat list thay đổi.

---

## Trạng thái cũ (archived 2026-04-24 sau Phase 14.5.5.c.1)

## Trạng thái cũ 2026-04-23 — máy cơ quan, **Phase 11.5.22 QR Generator + roadmap Phase 14-17 mở rộng**

### Ship session này (2026-04-23 tối, máy cơ quan)

- ✅ **Phase 11.5.22 — QR Code Generator widget** (shipped 2026-04-23):
    - File: `website/components/widgets/qr-generator-widget.tsx` (~530 dòng TSX).
    - Auto-convert Drive file/folder, Docs→PDF, Sheets→XLSX, Slides→PPTX, Dropbox dl=1, YouTube → youtu.be.
    - Size 192/256/384 · ECC L/M/Q/H (default H) · Color picker · Paste/clear/sample.
    - Download PNG + SVG · Copy image (ClipboardItem) · Copy link · Open · Share Zalo/Telegram/Facebook/Email.
    - Library `qrcode@1.5.3` load dynamic từ `cdnjs.cloudflare.com/ajax/libs/qrcode/1.5.3/qrcode.min.js` — **không thêm npm dep**, promise-cached để không load lại.
    - Debounce 180ms regen khi đổi input/size/ecc/color.
    - Integrated vào `app/page.tsx` tại Row 4.5 (chỗ `ExternalAppsWidget` cũ đã gỡ Phase 11.5.21).
    - Footer note + doc comment Row 4.5 update.
    - `npx tsc --noEmit` trong `/website` exit 0.
- ✅ **Roadmap update — Phase 14/15/16/17 mới** (`docs/ROADMAP.md`):
    - Phase 11.5.x status tracker (bảng 22 subphase).
    - Phase 11.6 Firebase Auth · 11.7 User sync · 11.8 Admin backend · 11.9 PWA (scope rõ).
    - **Phase 14 — Deep rebuild + enhance 10 desktop app**: KHÔNG port code cũ trực tiếp — rebuild theo `trishteam_core` v2 (async worker, settings JSON, structlog, tokens v3). Bảng 10 app + enhancement đề xuất mới cho mỗi app (2-4 feature/app). 6 sub-phase 14.1-14.6.
    - **Phase 15 — Zalo Mini App ecosystem**: tham khảo https://github.com/Zalo-MiniApp. 7 Mini app đề xuất (Portal/Note/QR/Check/Library/Font/Announcement). Kiến trúc: zmp-cli + ZaUI + TS, backend dùng chung Firebase, Zalo user ID → Firebase custom token. 8 sub-phase 15.1-15.8.
    - Phase 16 SEO/Analytics · Phase 17 Final deploy.
    - Timeline table — estimate ~4-5 tháng còn lại.

### Đang dở — PICK UP TỪ ĐÂY (session sau)

**Phase 11.6 — Firebase Auth wiring website** là target tiếp theo:

1. Trí cần check `website/components/widgets/qr-generator-widget.tsx` chạy được trong trình duyệt (npm run dev → dashboard có QR card mới).
2. Nếu QR widget OK → bắt đầu Phase 11.6:
   - Tạo `website/lib/firebase.ts` — init app với `NEXT_PUBLIC_FIREBASE_*` env.
   - Config `.env.local` template (không commit key thật).
   - Providers: Google OAuth primary, Email+password fallback.
   - Route guard (authenticated) group cho `/dashboard`, `/notes`, `/library`.
   - Server-side session cookie từ ID token.
   - Role check custom claims (`role: user|admin|dev`) gate `/admin`.

**Lưu ý quan trọng cho session sau:** User đã chốt scope Phase 14 (rebuild 10 desktop app, KHÔNG port code cũ, thêm feature mới) + Phase 15 (Zalo Mini App). Khi user hỏi "tiếp theo làm gì" ở session mới → trả lời dựa trên ROADMAP.md bảng timeline.

---

## Trạng thái cũ (archived 2026-04-23 tối sau khi ship QR Generator)

## Trạng thái hiện tại cũ (cuối session 2026-04-23 — máy nhà, **Phase 1.6 SSO + Phase 13.3 theme switcher + Phase 13.4 shared QSS builder + Phase 13.5 theme picker bug fix + rút 7 → 2 theme + Phase 13.6 design-spec v2 + Phase 11.0 website scaffold + pattern từ 7 repo**)

### Đã ship thêm cuối session (Phase 11.0 — 2026-04-23, website scaffold + tokens pipeline)

- ✅ **Task #71 — Phase 11.0 Website scaffold + export-tokens pipeline** (shipped 2026-04-23):
    - **`scripts/export-tokens.py` (~240 dòng)**: đọc `design/tokens.v2.json` → xuất 2 file auto-generated:
      - `website/assets/tokens.css` (~4.9KB): `:root` = dark theme defaults + all theme-independent tokens (font/space/radius/shadow/motion/zIndex/semantic/group/icon), `[data-theme='light']` = light theme color overrides. Header `AUTO-GENERATED — DO NOT EDIT BY HAND`.
      - `website/assets/tailwind.theme.cjs` (~4.7KB): `module.exports = { colors, fontFamily, fontSize, spacing, borderRadius, boxShadow, transitionDuration, zIndex, ... }` — object plug thẳng vào `tailwind.config.cjs` qua `theme.extend`.
      - **`--check` mode**: so sánh output vs file hiện có → exit 1 nếu drift. CI lint bước tiếp theo sẽ hook vào đây để block PR có tokens lệch.
      - Skip `_comment` + `_meta` keys; quote numeric keys (`'2xl'`, `'0'`) cho JS syntax valid.
      - `_pretty(path)` helper: relative nếu trong repo, absolute nếu ngoài — `--out /tmp/xxx` không crash.
    - **Website scaffold** (`website/` folder, 14 file 450 dòng non-generated):
      - **Config**: `package.json` (pin Next 14.2.5 + React 18.3.1 + Tailwind 3.4.4 + lucide-react 0.383 + clsx + tailwind-merge + TS 5.4.5, engines ≥18.17.0), `tailwind.config.cjs` (`darkMode: ['class', '[data-theme="dark"]']`, import tokens từ assets), `postcss.config.cjs`, `tsconfig.json` (strict + bundler resolution + `@/*` alias), `next.config.mjs`, `.gitignore`.
      - **App**: `app/layout.tsx` (RSC, `<html lang="vi" data-theme="dark" suppressHydrationWarning>`, metadata SEO, wrap `<ThemeProvider>`), `app/page.tsx` (landing Hero với accent gradient `-webkit-background-clip: text`, 2 CTA Download TrishLauncher + Xem 10 app), `app/globals.css` (import tokens.css trước `@tailwind base`, body dùng CSS vars, focus-visible ring accent).
      - **Components**: `components/theme-provider.tsx` (client Context, 2-theme + alias resolver `trishwarm`/`midnight`/`candy`/... → `dark`/`light` đồng bộ với desktop `theme_manager.py`, `localStorage['trishteam:theme']` persist, hydrate sau mount + `suppressHydrationWarning` tolerant), `components/theme-toggle.tsx` (Lucide Moon/Sun icon → toggle dark↔light).
      - **Doc**: `README.md` — stack pinned table + setup Windows/mac/Linux + tokens sync workflow + Phase 11.x roadmap (11.0 scaffold → 11.1 landing → 11.2 `/apps/<id>` SSG → 11.3 Firebase Auth → 11.4 session middleware → 11.5 admin).
    - **Test**: `shared/trishteam_core/tests/test_export_tokens.py` — **12 test mới**:
      1. `test_script_exists` — file exists.
      2. `test_render_css_contains_both_themes` — `:root` + `[data-theme='light']` block, `color-scheme: dark|light` khai báo đúng, surface.bg swap (`#0f0e0c` → `#f7f6f3`).
      3. `test_render_css_has_theme_independent_tokens` — semantic/group/font/space/radius/motion/zIndex đều ở `:root`.
      4. `test_render_css_skips_comment_keys` — `_comment` / `_meta` không lọt vào CSS.
      5-7. Tailwind output: `module.exports = { ... };` structure, expected keys (colors/fontFamily/fontSize/spacing/borderRadius/boxShadow/transitionDuration/zIndex), balanced braces, numeric keys quoted (`'2xl':` / `'0':`).
      8-9. CLI: `--out` write file, `--check` idempotent sau write, drift detection (sửa tay CSS → exit 1).
      10. `test_repo_tokens_css_in_sync` — `python scripts/export-tokens.py --check` trên repo hiện tại exit 0 (catch pre-commit regression).
    - **Tổng test trishteam_core: 174 pass + 2 skip** (từ 162 → 174, +12). 0.81s full run.
    - **Scope ship có chủ đích nhỏ**: ship an toàn trước khi yêu cầu user install Node 18+ + npm install 200MB. User có thể chạy `cd website && npm install && npm run dev` trên máy sau. Phase 11.1–11.5 (full landing + `/apps`/`/login`/session middleware/admin) là scope riêng.

⚠ **Gotcha Phase 11.0 cho session sau**:
1. **Không commit `node_modules/` hay `.next/`** — `.gitignore` đã liệt kê. `package-lock.json` / `pnpm-lock.yaml` OK để commit (reproducible build).
2. **Tokens drift detection**: sau khi sửa `design/tokens.v2.json`, **bắt buộc** chạy `python scripts/export-tokens.py` trước commit. CI phase sau sẽ add `npm run tokens:check` vào GitHub Actions → block PR drift.
3. **Alias resolver đồng bộ 2 nơi**: desktop `theme_manager.py` + website `theme-provider.tsx` đều có bảng `{ trishwarm→dark, midnight→dark, candy→light, ... }`. Nếu thêm alias mới, **cập nhật cả 2**. Tương lai có thể export bảng alias từ `tokens.v2.json` → `shared/aliases.json` cho cả 2 bên consume.
4. **`<html suppressHydrationWarning>` là bắt buộc** khi ThemeProvider đọc localStorage sau mount — React hydration sẽ warn "data-theme mismatch" nếu user lưu `light`, nhưng đó là intentional (server không access được localStorage). Đừng xoá.
5. **Tailwind `darkMode: ['class', '[data-theme="dark"]']`**: giữ `class` cho tương thích shadcn/ui (nhiều component của nó dùng `.dark:*`), `[data-theme="dark"]` cho consistency với desktop QSS. Khi add shadcn component, check nó không conflict.

---

### Đã ship thêm cuối session (Phase 13.6 — 2026-04-23, doc-only)

- ✅ **Task #72 — Phase 13.6 Rewrite `docs/design-spec.md` v2**:
    - Merge `docs/DESIGN.md` (agent brief 9 mục format awesome-claude-design) + `docs/design-spec.md` (spec chi tiết 576 dòng) → **1 file duy nhất** `design-spec.md` v2.0. Tránh drift giữa 2 file (hiện tượng hay gặp: code sửa, 1 doc update, doc kia lỗi thời 3 phase).
    - **Sửa drift khớp code hiện tại sau Phase 13.5:**
      - Palette: cool-gray `#0F1419/#151B23/#F9FAFB` (v0.1 cũ) → warm `#0f0e0c/#1a1814/#f5f2ed` (thực tế).
      - Theme: "7 theme TrishWarm+6 skin" → "2 theme dark+light" + aliases table cho backward compat.
      - App list: "7 app" → "11 app" (bỏ `TrishType` không tồn tại, thêm 5 app scaffold mới).
      - AppHeader: height 48px → **56px** (code thực tế).
      - LogPanel: QPlainTextEdit + timestamp prefix → **QTextEdit HTML emoji prefix, không timestamp** (match reference TrishFont_v1.py).
      - Font: primary Segoe UI → **Be Vietnam Pro** (primary), Segoe UI fallback.
    - **Thêm section mới:**
      - §10 "Agent prompt guide" — 9 bước khi Claude/Copilot sinh UI (đọc tokens trước, dùng qicon, set theme target=self.window(), ...).
      - §11 "Gotcha — dev must-know" — 6 bẫy thực tế (QMainWindow stylesheet priority, alias 1-way, stripe theme-independent, lazy import theme_manager, WCAG contrast floor, không hardcode rgba white).
    - `docs/DESIGN.md` rút thành 8-dòng pointer trỏ về design-spec.md (backward compat cho link cũ, có thể xoá Phase ≥14).
    - **Smoke test:** 162 pass + 2 skip sau khi update doc — không vỡ test nào (doc-only change).

### Đã ship thêm cuối session (Phase 13.5 — 2026-04-23)

- ✅ **Task #83 — Phase 13.5 fix bug theme picker + rút 7 theme xuống 2**:
    - **Bug fix "Click giao diện không gì thay đổi":** Root cause do Qt stylesheet priority — `BaseWindow.__init__` gọi `apply_theme(self)` set stylesheet trên **QMainWindow**, trong khi `_on_theme_picked()` cũ lại set trên `QApplication.instance()`. Widget-level stylesheet **thắng** app-level stylesheet (Qt rule), nên theme mới bị QMainWindow-stylesheet cũ ghi đè → UI không đổi. Fix: `app_header.py` target `self.window()` (top-level QMainWindow chứa header đang click) thay vì `QApplication.instance()`, rồi broadcast qua `QApplication.topLevelWidgets()` cho các sub-window (AboutDialog, UpdateDialog, subwindow khác đang mở).
    - **Đơn giản hoá UX 7 → 2 theme:** User feedback "tôi chỉ cần 2 chế độ dark mode và light mode" → xoá 5 skin Youwee (midnight/aurora/sunset/ocean/forest), giữ lại **dark** (chữ #f5f2ed trên nền #0f0e0c) + **light** (chữ #1a1814 trên nền #f7f6f3), default vẫn là `dark`. Accent gradient `#667EEA → #764BA2` giữ nguyên ở cả 2 mode để brand identity nhất quán. Label Tiếng Việt: "Tối (Dark)" / "Sáng (Light)".
    - **Backward compat zero-break:** `design/tokens.v2.json` thêm block `theme_aliases` map legacy keys (trishwarm/midnight/aurora/sunset/ocean/forest → dark; candy → light). `theme_registry.py` thêm `resolve_alias(key)` + mở rộng `TokensBundle.aliases`. `theme_manager.init()` resolve alias trước khi validate (user upgrade từ Phase 13.3/13.4 không bị crash vì persist file chứa "trishwarm"). `set_theme("trishwarm")` persist key canonical `"dark"` chứ không phải alias.
    - **Test:** thêm 11 test mới (6 `TestAliases` trong `test_theme_registry.py` + 5 `TestInitWithLegacyAlias` trong `test_theme_manager.py`). Sửa 2 test cũ cho schema 2-theme (`test_dark_theme_uses_light_text` check palette dict thay vì QSS string vì `#1a1814` xuất hiện cả trong dark.bg_elevated lẫn light.text). **Tổng test trishteam_core: 162 pass + 2 skip** (từ 151 trước đó).
    - **Smoke test xác nhận trên Windows (user Trí, 2026-04-23):** cả 2 mode Tối (Dark) + Sáng (Light) đổi UI ngay khi click. Backward compat persist file cũ không crash.
    - **Bonus — rewrite `scripts/RUN-TRISHFONT.bat`** (diagnostic fix): user báo `python -m trishfont.app` manual chạy OK nhưng `.bat` không mở được app. Root cause: script cũ dùng `--quiet` pip + không track errorlevel cho từng bước → lỗi thật sự bị nuốt. Rewrite với: (1) `setlocal EnableDelayedExpansion` để capture errorlevel chính xác, (2) echo path `.venv\Scripts\python.exe` + Python version để verify đúng venv, (3) check cả `trishteam_core` lẫn `trishfont` riêng biệt (trước chỉ check trishfont), (4) BỎ `--quiet` khi pip install (thấy lỗi mạng/permission), (5) in `__file__` của 2 module sau khi cài để debug path, (6) echo command trước khi chạy app để user screenshot.

⚠ **Gotcha Phase 13.5 cho session sau**:
1. **QMainWindow stylesheet priority > QApplication stylesheet** — đây là Qt rule bất biến. Khi apply runtime theme switch, phải target **widget** đang chứa (self.window()), không phải QApplication. Nếu có nhiều top-level window (AboutDialog, UpdateDialog, subwindow) thì broadcast qua `QApplication.topLevelWidgets()`.
2. **Alias là 1-way**: từ alias → canonical key, không ngược lại. Persist file luôn ghi canonical (`dark`/`light`), không ghi alias. Đừng thử thêm reverse alias lookup, nó gây ambiguity (cả 6 legacy đều map về `dark`).
3. **Không xóa `theme_aliases` block trong tokens.v2.json** cho đến khi chắc chắn không còn user với persist file legacy. Đây là compat layer cho user upgrade từ Phase 13.3/13.4.
4. **Đừng hardcode theme keys trong code mới** — luôn query qua `theme_registry.list_themes()` hoặc `theme_manager.current`. Số theme tương lai có thể thay đổi (thêm high-contrast/sepia, ...) nhưng API không đổi.
5. **Test 2 theme mode tương phản là yêu cầu WCAG**: dark text #f5f2ed trên bg #0f0e0c contrast ratio ~15:1 (AAA); light text #1a1814 trên bg #f7f6f3 ~14:1 (AAA). Nếu tương lai đổi palette nhớ check với `docs/design-spec.md` hoặc tool như WebAIM contrast checker — đừng ship contrast <4.5:1 (AA bare minimum).

---

### Đã ship cuối session (Phase 13.4)

- ✅ **Task #70 — Phase 13.4 Shared QSS builder cho 11 app**:
    - `shared/trishteam_core/src/trishteam_core/ui/theme_registry.py`: mở rộng `build_qss_from_palette(palette, bundle=None)` từ ~50 dòng QSS subset → **~200 dòng full-coverage**. Giờ cover toàn bộ role-specific selector mà trước đây còn nằm trong `theme.py`: CardGroup stripe (6 variant primary/green/amber/cyan/blue/danger), LogPanel (QTextEdit HTML mono), ActionBar CTA gradient primary, Sidebar pill gradient checked state, AppHeader, InlineToolbar, FooterBar, Badge, QMenu, Tooltip. Mỗi variant stripe lấy màu từ `semantic.success/warning/error/info` + `group.primary` của bundle — **theme-independent** (đổi theme không làm mất dải màu stripe).
    - `shared/trishteam_core/src/trishteam_core/ui/theme.py`: rewrite thành **façade mỏng ~85 dòng**. `build_qss(dark=True)` delegate qua `theme_registry.build_qss_from_theme(key)` với `_resolve_legacy_theme_key()` ưu tiên `theme_manager.current` (nếu đã init), fallback bundle default. `dark=False` pick theme mode=light đầu tiên (thường là candy). 11 app không phải sửa code — `from trishteam_core.ui import apply_theme, build_qss` vẫn work.
    - `shared/trishteam_core/src/trishteam_core/ui/theme_manager.py`: `_apply_to()` giờ cũng set `QFont("Be Vietnam Pro", 10)` với StyleHint.SansSerif lên QApplication khi có target, bảo đảm runtime theme switch không reset font hệ thống.
    - **Candy light theme fix**: `theme.py` cũ dùng `rgba(255,255,255,0.05)` / `rgba(255,255,255,0.08)` hardcode cho input/card bg — vô hình trên nền trắng candy. Phase 13.4 thay bằng palette tokens (`surface.muted`, `surface.row`, `border.subtle`) đọc từ ThemePalette → dark + light đều hiển thị đúng contrast.
    - **7 test mới** trong `test_theme_registry.py > TestFullQssPhase134`: verify (1) cả 7 theme build QSS có đủ 23 role-specific selector, (2) stripe colors giống nhau cross-theme, (3) candy text phải màu tối (≠ `#ffffff`/`#f5…`), (4) gradient primary dùng palette.accent per theme, (5) sidebar checked dùng qlineargradient, (6) `build_qss_from_palette` accept custom bundle, (7) font sizes pull từ bundle.
    - **Tổng test trishteam_core: 151 pass + 2 skip** (từ 144 trước đó), time 0.72s, không vỡ test cũ.

### Gotcha Phase 13.4 cho session sau

1. **Backward compat bắt buộc** — `build_qss(dark=True)` / `apply_theme(target, dark=True)` là public API của 11 app. Không đổi signature. Nếu muốn chỉ dùng theme_manager, gọi thêm, đừng xoá.
2. **Stripe colors phải theme-independent** — 6 variant CardGroup stripe (primary/green/amber/cyan/blue/danger) lấy từ `bundle.semantic.*` + `bundle.group.primary`, **không** từ `palette.accent`. Nghĩa là đổi theme từ trishwarm → midnight, stripe vẫn giữ đúng hue để user recognize nhóm file. Nếu bundle tương lai đổi semantic colors, cân nhắc locking.
3. **Candy light + rgba hardcode = fail** — đây là bug trước Phase 13.4. Nếu thêm QSS mới (widget mới), dùng palette tokens (`surface.muted`, `text.muted`, `border.subtle`) chứ đừng hardcode `rgba(255,255,255,0.XX)`. Test candy để verify.
4. **Lazy import `theme_manager` trong `theme.py`** — `_resolve_legacy_theme_key()` lazy import để tránh vòng import khi test headless. Đừng chuyển sang eager import ở top.
5. **`theme.py` façade là contract public** — tương lai nếu muốn xoá file này, phải deprecate warning trước + update 11 app. ROADMAP §13 "Không break apps hiện có" vẫn là luật.

### Đã ship thêm cuối session (sau Phase 1.6)

- ✅ **Task #69 — Phase 13.3 Runtime theme switcher**:
    - `shared/trishteam_core/src/trishteam_core/ui/theme_registry.py` (mới, ~320 dòng): pure-Python loader cho `design/tokens.v2.json`, **không** import PyQt6 — test headless được. API: `list_themes()`, `get_theme(key)`, `build_qss_from_theme(key)`. Cache + reload. Resolve path qua 3 tầng (env override → `TRISHTEAM_MONOREPO_ROOT` → walk up).
    - `shared/trishteam_core/src/trishteam_core/ui/theme_manager.py` (mới, ~210 dòng): QObject singleton `theme_manager` với `theme_changed(str)` signal. Persist qua plain JSON ở `platformdirs.user_config_dir("TrishTEAM")/theme.json` (share across 11 app, KHÔNG phải QSettings per-app). Fallback `~/.trishteam/theme.json` nếu platformdirs vắng. PyQt6 import-guard → headless vẫn dùng được (signal thành callable list stub).
    - `shared/trishteam_core/src/trishteam_core/widgets/app_header.py`: thêm param `show_theme_picker=True` + nút "🎨 Giao diện" + submenu QMenu list 7 theme với QActionGroup exclusive (checked = current). Lazy import theme_manager để test không cần tokens.
    - `shared/trishteam_core/src/trishteam_core/ui/__init__.py`: refactor thành lazy `__getattr__` — PyQt6-bound exports (BaseWindow/HoverSidebar/apply_theme/build_qss/ThemeManager) chỉ import khi caller thực sự dùng. Cho phép test `from trishteam_core.ui import theme_registry` chạy headless.
    - **37 test mới** (`test_theme_registry.py` 18 + `test_theme_manager.py` 19): path resolution, parse/validate bundle, caching, 7 theme thật, QSS builder spot-check, init + persist roundtrip (valid/corrupt/unknown), set_theme signal emission, apply to stub target, persist failure tolerance.
    - **Tổng test trishteam_core: 146** (144 pass + 2 skip, từ 109 trước đó). Không vỡ test cũ.

### Gotcha Phase 13.3 cho session sau

1. **Persist path SHARE across 11 app** — dùng `platformdirs.user_config_dir("TrishTEAM")/theme.json` chứ **không** phải QSettings per-app. Nếu sau này đổi sang QSettings phải đảm bảo organizationName/applicationName giống nhau mọi app, nếu không user đổi theme ở Launcher mà TrishFont không nhớ.
2. **Lazy `__init__.py`** — nếu thêm export mới vào `trishteam_core.ui` cần PyQt6, phải thêm branch vào `__getattr__`, đừng eager-import ở top.
3. **Signal stub headless** — `_ThemeSignalBus` khi không có PyQt6 dùng fake class với `.connect/.disconnect/.emit`, đủ cho test. Khi wire vào production slot phải là bound method hoặc function — lambda closure ok.
4. **QSS của theme_registry là subset** của `theme.py` — chỉ cover base / button / input / card / menu / scrollbar. Các role-specific (CardGroup stripe, LogPanel, ActionBar CTA) vẫn ở `theme.py`. Task #70 sẽ merge 2 cái.

---

### Đã hoàn thành đầu session 2026-04-23 (Phase 1.6 + pattern từ 7 repo)

- ✅ **Task #78 — Phase 1.6 SSO deep link `trishteam://` + oneshot redeem**:
    - `shared/trishteam_core/src/trishteam_core/auth/sso_handler.py` (mới, ~500 dòng): `parse_deep_link_url()` cho 5 kind (auth/library/note/install/admin), `redeem_oneshot_to_session()` (Cloud Function → signInWithCustomToken → lookup enrich → token_store.save + session singleton set dưới lock), `mint_web_handoff()` (desktop → web, Bearer idToken → exchangeForWebToken), `register_windows_protocol_handler()` (HKCU\Software\Classes\trishteam, scope user mặc định, không cần UAC).
    - `firebase_client.py` thêm `sign_in_with_custom_token(token)`.
    - `auth/__init__.py` export SSOError/DeepLinkAction/CloudConfig/WebHandoff + parse_deep_link_url.
    - `apps/trishlauncher/src/trishlauncher/bootstrap.py` thêm command `handle-url <url>` (exit code 5 nếu URL invalid) → dispatch theo kind, kind=auth thì redeem oneshot, các kind khác fallback về Launcher.
    - **37 test** tại `shared/trishteam_core/tests/test_sso_handler.py` (parse 12 + CloudConfig URL 3 + exchange 7 + redeem 5 + mint handoff 4 + build session 3 + Windows registry 3 — 2 skip non-Windows).
    - **Tổng test auth Python: 109** (107 pass + 2 skip trên Linux CI, full pass trên Windows).

- ✅ **Áp dụng pattern từ 7 repo nghiên cứu** (obra/superpowers, eze-is/web-access, alchaincyf/huashu-skills, henrygd/beszel, pear-devs/pear-desktop, MarkEdit-app/MarkEdit, VoltAgent/awesome-claude-design):
    - `docs/DESIGN.md` (mới) — Claude-Design brief 9 section sinh từ `tokens.v2.json` + `design-spec.md`, format theo awesome-claude-design để Claude/Copilot sinh UI nhất quán với design system.
    - `.claude/skills/trishteam-phase-ship/SKILL.md` (mới) — project-level skill cho workflow phase-ship (Inventory → Smoke-test → Integration test → Update docs incremental → Update TaskList → SESSION-HANDOFF note), tổng hợp pattern superpowers + huashu-skills incremental doc-edit + ghi lại pitfall từ repo history (Phase 1.1 import bug, Phase 5 hardcoded localhost, Phase 13.1 reader lag) để session sau không lặp lại.
    - Các repo khác đã cân nhắc nhưng **chưa áp dụng** (để tránh scope creep): beszel agent tự báo (chờ đến Phase 11 monitoring), pear-desktop Electron wrapper (TrishTEAM dùng PyQt6, không cần), MarkEdit editor (chưa có use case), web-access a11y checklist (đã có trong design-spec).

- ✅ **docs/AUTH.md v0.5**: §9.1 thêm dòng `sso_handler.py`, §9.3 test count 63 → 109, §9.4 mở rộng API quick reference với SSO import + ví dụ web→desktop + desktop→web, **§9.6 mới** (full Phase 1.6 doc: URL scheme table, mint/redeem flow, Windows registry, bootstrap command, env var config, security notes), §7 checklist tick thêm 6 item, changelog v0.5 entry.

- ✅ **docs/ROADMAP.md**: Phase 10 security checklist tick DPAPI + setUserRole admin claims, thêm bảng "Phase 1 sub-phases — shipped (2026-04-22 → 2026-04-23)" cover 1.1 → 1.8 với task#.

### Đang dở — PICK UP TỪ ĐÂY (sau Phase 13.5)

**🧪 Smoke test trên Windows — verify bug fix + 2 theme mới** (cần làm trước khi đụng code mới):
1. `cd C:\Users\TRI\Documents\Claude\Projects\TrishTEAM\trishnexus-monorepo`
2. `git pull` → `scripts\RUN-TRISHFONT.bat` (script tự dùng `.venv\Scripts\python.exe`, không dùng system Python vì system Python chưa cài gói `trishfont`).
3. Click nút **"🎨 Giao diện"** ở AppHeader → menu giờ chỉ có **2 option**: `Tối (Dark)` và `Sáng (Light)`.
4. **Kỳ vọng Phase 13.5:** click "Sáng (Light)" → **UI đổi sang light ngay lập tức** (bg trắng #f7f6f3, chữ đen #1a1814, accent tím xanh giữ nguyên). Click "Tối (Dark)" → quay về dark. Đây là bug trước đây không hoạt động (click không gì thay đổi).
5. Đóng app → mở lại → phải nhớ theme vừa chọn (file `%APPDATA%\TrishTEAM\theme.json` ghi `{"theme": "light"}` hoặc `{"theme": "dark"}`).
6. **Verify backward compat** (optional, cho user đã dùng từ Phase 13.3): nếu `%APPDATA%\TrishTEAM\theme.json` có `{"theme": "trishwarm"}` cũ, app vẫn mở được (không crash), auto resolve sang `dark`.
7. Nếu click vẫn không đổi UI: screenshot + check `python -c "from trishteam_core.ui.theme_registry import list_themes; print(list_themes())"` phải trả về `[("dark", "Tối (Dark)"), ("light", "Sáng (Light)")]`. Nghi vấn khác: font Be Vietnam Pro chưa install → `QFont.StyleHint.SansSerif` fallback Segoe UI (không ảnh hưởng màu).

**Các task còn pending (chọn 1 nhánh, Phase 11.0 vừa ship):**

**Nhánh A — Phase 11.1 Website landing đầy đủ** (tiếp Phase 11.0):
1. `cd website && npm install` trên máy nhà (cần Node 18+). Verify `npm run dev` chạy localhost:3000 render được landing hero + theme toggle hoạt động.
2. Wire 10-app grid từ `shared/apps.json` registry. Component `<AppCard />` (logo + name + description + tags).
3. Add shadcn/ui components: `npx shadcn@latest add button card sheet dialog sonner dropdown-menu`.
4. `/apps/<id>` SSG route — đọc metadata từ apps.json, render screenshots + changelog.
5. Download button → GitHub Release API (hoặc static link trước nếu chưa có release).

**Nhánh B — Phase 11.3 Firebase Auth** (cần có Firebase project sẵn):
1. `/login`, `/signup`, `/forgot-password` dùng Firebase Auth Web SDK.
2. Session cookie handler + Next middleware redirect nếu chưa auth.
3. `/portal` role-gated pages (dùng custom claims `role: 'admin'|'user'`).
4. Đồng bộ với desktop SSO (trishteam:// deep link từ Phase 1.6).

**Nhánh C — Task #66 Phase 12 AI augmentation** (long-term, risk cao):
1. Integrate `vietlegal-harrier-0.6b` semantic embedding model (~600MB).
2. FAISS local index cho TrishDesign/Library — query "font manga" trả fonts phù hợp.
3. Code path: `shared/trishteam_core/ai/` module mới. Cần POC trước khi full integration.

**Gợi ý**: Nhánh A là natural next step sau Phase 11.0. Trước đó chỉ có 14 file scaffold stub — Phase 11.1 wire real data. Risk trung bình nhưng scope rõ (apps.json là input đã có). Nhánh B phụ thuộc Firebase project config (đã spec ở AUTH.md nhưng chưa hẳn đã deploy) — nên làm sau 11.1. Nhánh C cần POC model + benchmark trước.

### Gotcha — đừng lặp lại

1. **CloudConfig nạp env var, chưa đọc config file**: `apps/trishlauncher/src/trishlauncher/bootstrap.py:_load_cloud_config()` hiện đọc `TRISHTEAM_FIREBASE_PROJECT_ID / API_KEY / REGION / FUNCTIONS_EMULATOR`. Production sẽ cần reader cho `<install_root>/config/firebase.json` (ưu tiên file, fallback env). Chưa implement để tránh nở scope Phase 1.6 — ghi vào Phase 1.8 hoặc Phase 10 installer.
2. **PyQt6 không load trong sandbox Linux** (`libEGL.so.1: cannot open shared object file`). Production Windows OK. Sandbox chỉ dùng để verify pure-Python logic (theme_registry, theme_manager stub signal, sso_handler) — đừng tốn sức fix sandbox GUI.
3. **`exchange_oneshot_token` length validate 16–128**: Cloud Function sinh oneshot 32 chars nên OK, nhưng nếu đổi generator bên web phải bump `_MIN_ONESHOT_LEN / _MAX_ONESHOT_LEN` trong `sso_handler.py`.
4. **Session singleton lock**: `redeem_oneshot_to_session` set `session._state.user` **phải** lấy `session_module._state.lock` (đã làm). Đừng bypass — có thread refresh background, race condition sẽ ẩn rất lâu mới lộ.
5. **`.claude/skills/trishteam-phase-ship/SKILL.md` là bắt buộc đọc khi bắt đầu Phase mới**. Step 6 (SESSION-HANDOFF note) là lý do có section này — đừng ship code xong rồi quên update handoff.
6. **Theme persist path SHARE across 11 app** (Phase 13.3): dùng `platformdirs.user_config_dir("TrishTEAM")/theme.json`, KHÔNG phải QSettings per-app. Nếu đổi sang QSettings phải set organization/application name giống nhau mọi app.
7. **Lazy `trishteam_core.ui.__init__.py`** (Phase 13.3): thêm export mới cần PyQt6 → phải thêm branch vào `__getattr__`, đừng eager-import ở top. Nếu không CI/test headless sẽ die với libEGL.

---

## Trạng thái hiện tại (cuối session 2026-04-22 tối — máy nhà, **ROUND 2 align reference**) [archived 2026-04-23]

### ⚠ Lý do round 2

User phản hồi screenshot round 1: *"Giao diện app hiện tại không giống tôi nói, tôi nói là các giao diện phải là giao diện như tôi gửi code python của 2 app trước đó tôi code không phải giao diện thế này. Đọc và viết lại cho chuẩn nhé"*.

User upload 2 file Python reference:
- `uploads/TrishFont_v1.py` (747 dòng, 32 KB) — source của app TrishFont v1.0 cũ, **palette warm-dark + layout single-page + log HTML**.
- `uploads/TrishLibrary.py` (870 dòng, 42 KB) — source của app Trish Library 1.0, QPalette-based dark theme với split view.

Sau khi **đọc kỹ cả 2 file** (không phải đoán từ screenshot), tôi phát hiện 6 sai lệch lớn so với code cũ:
1. **Palette sai tone**: dùng cool gray `#0F1419/#1F2937`, reference dùng **warm brown-dark** `#0f0e0c / #1a1814 / #1e1c18`.
2. **Text sai tone**: dùng `#F9FAFB/#9CA3AF`, reference dùng ấm `#f5f2ed / #a09890 / #d4cec4`.
3. **Card thiếu dải màu trái**: reference FontGroupCard có `border-left: 3px solid {group_color}` tạo điểm nhấn visual chính.
4. **LogPanel sai kiểu**: dùng QPlainTextEdit + timestamp mono, reference dùng QTextEdit + HTML colored span + emoji prefix (`✅/❌/⏭`), KHÔNG có timestamp.
5. **Font sai thứ tự**: primary Segoe UI, reference dùng **Be Vietnam Pro** primary.
6. **Button primary bị lạm dụng**: mọi QPushButton có gradient, reference phần lớn nút là secondary (bg `rgba(255,255,255,0.05)`), chỉ CTA install mới gradient.

### Đã hoàn thành round 2 (session 2026-04-22 tối)

- ✅ Đọc kỹ 2 file reference (TrishFont_v1.py + TrishLibrary.py).
- ✅ **`tokens.py` rewrite**: DARK namespace dùng warm palette match reference (`bg #0f0e0c`, `bg_elevated #1a1814`, `text.primary #f5f2ed`, etc.). Font stack đổi primary → Be Vietnam Pro. Thêm `COLOR.group` với 5 màu stripe.
- ✅ **`theme.py` rewrite**: QSS mới khớp reference patterns. Button default = secondary (muted bg + muted text + accent hover). Button primary chỉ khi set `variant="primary"`. Input bg `rgba(255,255,255,0.05)`. Card role có stripe variants qua property `stripe="primary|green|amber|cyan|blue|danger"` → QSS tô dải trái 3px. Log body styled qua QSS global (mono + border + radius).
- ✅ **`card_group.py` rewrite**: match FontGroupCard. Padding 14/12. Header: toggle ▼ màu stripe + icon + name bold 12pt màu stripe + badge "N file" muted. "Chọn tất cả N file trong nhóm" là QCheckBox màu stripe (inline style). HLine divider rgba(0.06). File checkboxes indent 0 với prefix "  " (spaces). API thêm `stripe="..."` param.
- ✅ **`log_panel.py` rewrite**: QTextEdit (không phải QPlainTextEdit) + HTML colored span. Emoji do caller tự gắn (`log_success("✅ xong")`). Không auto-timestamp (flag `show_timestamp=True` opt-in). Thêm `set_progress(done, total)` + QProgressBar 5px accent gradient. `log_separator()` vẽ dòng `═══`.
- ✅ **`app_header.py` rewrite**: cao 56px (thay 40), padding 20/16. Brand dùng `RichText` với flag `name_is_html=True` để render "Trish<b>Font</b>" (bold nửa sau). Version muted 11px. 2 nút ghost update/about cao 30px.
- ✅ **`inline_toolbar.py` tweak**: padding 18/10 spacing 10 match reference config bar. Label + icon dùng `#a09890 font-size: 12px`.
- ✅ **`action_bar.py` rewrite**: 2 secondary button (Chọn tất cả / Bỏ chọn) thay cho checkbox+button cũ. Counter label swap muted ↔ bold accent khi có count. CTA primary gradient 34px cao.
- ✅ **`library/view.py` update**: CATEGORY_STRIPE dict (sans_serif→primary, serif→amber, mono→green, display→cyan). Log messages dùng emoji prefix trực tiếp trong string.
- ✅ **`app.py` update**: AppHeader dùng `app_name="Trish<b>Font</b>"` + `name_is_html=True`.
- ✅ Syntax check `py_compile` 9 file OK.

### Đang dở — PICK UP TỪ ĐÂY sau round 2

**🧪 Vẫn là Bước A: Smoke test trên Windows với code round 2**

1. `cd C:\Users\TRI\Documents\Claude\Projects\TrishTEAM\trishnexus-monorepo`
2. `git pull` (nếu từ máy kia) hoặc `scripts\RUN-TRISHFONT.bat`
3. Kỳ vọng khi chạy `python -m trishfont.app`:
   - **Tone warm** (nâu đen ấm #0f0e0c), không còn lạnh xám.
   - Header 56px với `✨ Trish**Font**` + `v1.0.0` muted + 2 nút ghost `🔄 Cập nhật` + `ℹ Giới thiệu`.
   - Sidebar compact bên trái (180px).
   - Tab Thư viện: 2 InlineToolbar (path + search) → ActionBar (2 nút secondary + counter + CTA gradient) → CardGroup có dải màu trái (primary/amber/green/cyan) → LogPanel đáy.
   - Log hiển thị `✅ Quét xong: N file` bằng HTML color xanh lá, không có `[HH:MM:SS]` prefix.
4. Nếu vẫn lệch reference: screenshot cụ thể vùng lệch, mình fix targeted.

### Bối cảnh palette (cho session sau)

Source of truth = `/mnt/uploads/TrishFont_v1.py` constants:
```
ACCENT     = "#667eea"
ACCENT2    = "#764ba2"
BG_DARK    = "#0f0e0c"   ← warm black
BG_CARD    = "#1a1814"   ← warm card
BG_ROW     = "#1e1c18"   ← warm row
TEXT_MAIN  = "#f5f2ed"   ← warm off-white
TEXT_MUTED = "#a09890"   ← warm muted
GREEN = "#10b981"; AMBER = "#f59e0b"; RED = "#ef4444"; BLUE = "#3b82f6"
```
Group colors: Unicode=ACCENT, VNI=GREEN, TCVN3=AMBER, VietwareX=CYAN#06b6d4, AutoCAD=BLUE.

---

## Trạng thái hiện tại (cuối session 2026-04-22 chiều — máy nhà) [ROUND 1 — archived, các feedback đã handle ở round 2]

### Đã hoàn thành
- ✅ **Sprint 1 (website)**: `tokens.css` deployed Vercel, accent `#667EEA` live trên 11 trang.
- ✅ **Monorepo scaffold + GitHub**: `hosytri07/trishnexus-monorepo` pushed.
- ✅ **shared/trishteam_core**: package Python chung, editable install.
- ✅ **apps/trishdesign**: scaffold xong, 14 sidebar items smoke test pass.
- ✅ **USB/GitHub scripts**: START/END/SETUP.bat + README.txt (đã pivot từ USB sang GitHub sync).
- ✅ **CLAUDE.md + handoff mechanism**: Magic phrase `tiếp tục` / `chốt` / `bấm END.bat` hoạt động.
- ✅ **TrishFont refactor LOGIC xong** (session 2026-04-22 sáng):
    - Bug freeze fix: PreviewView rewrite thành split view (QListWidget + QLabel preview), chỉ render 1 font/thời điểm.
    - Curated folder scan: `FontRepository.scan_folder(path)` thay `scan_system()`, hỗ trợ .ttf/.otf/.ttc/.otc recursive.
    - Settings module mới: `modules/settings/{models,paths,repository,__init__}.py` với MIGRATION_002_SETTINGS + key `font_library_path`.
    - Path resolution 4 tầng: SQLite → env `TRISHFONT_FONT_DIR` → frozen exe `/fonts` → None (popup picker).
    - Auto-scan khi startup nếu path đã lưu.
    - App chạy được, **không freeze**, Tiếng Việt render tốt (Segoe UI global font).
    - Dark theme sơ bộ với accent gradient `#667EEA → #764BA2` match website.
- ✅ **UI Design System Sprint — Phase 1 + Phase 2 XONG** (session 2026-04-22 chiều):
    - `docs/design-spec.md` (24 KB, 559 dòng) — palette, typography, spacing, widget spec chi tiết, mô tả 2 app ref, layout TrishFont đích.
    - Feedback user đã áp: **bỏ Admin dot** (app public, không login) → thay bằng 2 nút ghost `[🔄 Cập nhật]` + `[ℹ Giới thiệu]` ở AppHeader.
    - 9 widget mới ở `shared/trishteam_core/widgets/`:
        - `app_header.py` — AppHeader với About + Update signals
        - `inline_toolbar.py` — InlineToolbar + ToolbarField dataclass
        - `action_bar.py` — ActionBar với counter realtime + CTA gradient disabled khi counter=0
        - `card_group.py` — CardGroup (collapsible, tristate select-all, filter API)
        - `log_panel.py` — LogPanel terminal-style (log_success/warn/error color-coded)
        - `footer_bar.py` — FooterBar branding + quick nav
        - `split_sidebar.py` — SplitSidebar tree + content area
        - `dialogs.py` — AboutDialog (tác giả + 6 app ecosystem) + UpdateDialog (tab App / Data)
        - `empty.py` — thêm setter setTitle/setSubtitle/setIcon
    - `ui/theme.py` mở rộng QSS cho roles mới (app-header, inline-toolbar, action-bar, log-panel, footer-bar).
    - `ui/base_window.py` thêm `set_header()` và `set_footer()` slot (optional, không break TrishDesign).
    - `apps/trishfont/src/trishfont/modules/library/view.py` **rewrite toàn diện**: InlineToolbar path + search → ActionBar bulk select → CardGroup group theo category (sans_serif/serif/mono/display) → LogPanel đáy với splitter vertical.
    - `apps/trishfont/src/trishfont/modules/favorites/view.py` fix lại để tương thích class mới (override `_reload_groups`, ẩn path toolbar + action bar).
    - `apps/trishfont/src/trishfont/app.py` wire AppHeader + FooterBar + About/Update dialog stubs.
    - **Test:** py_compile OK 9 widget + 4 file app, AST-parse toàn repo 2299 files OK. Runtime test phải chạy trên Windows (sandbox không có libEGL).

### Đang dở — PICK UP TỪ ĐÂY

**🧪 Bước tiếp — smoke test thật trên Windows + wire worker**

### Việc cần làm (tiếp theo)

**Bước A — Smoke test trên Windows (15-30 phút):**
1. Pull GitHub về máy (hoặc file mới từ session này).
2. `pip install -e shared/trishteam_core` + `pip install -e apps/trishfont` (hoặc setup xong rồi).
3. Chạy `python -m trishfont.app` → kỳ vọng:
    - AppHeader có logo ✨ + "TrishFont v1.0.0" + 2 nút `🔄 Cập nhật` `ℹ Giới thiệu` góc phải.
    - Sidebar trái vẫn hiển thị 4 trang: Thư viện / Xem trước / Yêu thích / Cài đặt font.
    - Tab Thư viện: 2 InlineToolbar (path + search) → ActionBar → scroll với CardGroup theo category → LogPanel đáy.
    - Click `ℹ Giới thiệu` → dialog hiện tác giả + 6 app ecosystem.
    - Click `🔄 Cập nhật` → dialog 2 tab (Ứng dụng / Dữ liệu font).
    - FooterBar đáy có `TrishFont v1.0.0 · Quản lý font chuyên nghiệp` trái + quick nav phải.
4. Test flow: chọn folder font → scan → check log → tick font → counter update → bấm CTA (sẽ log "worker chưa wire" — OK, Phase 3).
5. Nếu có lỗi Qt: báo lại để fix. Nếu UI lệch spec: screenshot + feedback.

**Bước B — Wire install worker + update checker thật (Phase 3, 2-3h):**
1. `apps/trishfont/src/trishfont/modules/install/worker.py` — threading worker copy file → `%LOCALAPPDATA%\Microsoft\Windows\Fonts\` + registry entry + broadcast `WM_FONTCHANGE`.
2. `shared/trishteam_core/src/trishteam_core/update/` — module check GitHub release API cho app + font pack CDN URL.
3. Connect UpdateDialog signals vào module update thật thay stub trong app.py.
4. Connect ActionBar `ctaClicked` vào install worker (hiện đang chỉ log warn).

**Bước C — Apply design language cho TrishDesign (khi TrishFont stable, xa hơn):**
- Copy pattern: AppHeader + InlineToolbar + SplitSidebar + FooterBar.
- Test: chạy cả 2 app cạnh nhau → visual consistency ≥ 90%.

### Bối cảnh design (giữ cho session sau đọc lại)

User đã gửi 2 screenshot app cũ của họ làm **design reference bắt buộc** cho cả 6 app TrishNexus:
1. **TrishFont v1.0.0 cũ** (screenshot attach trước) — có header logo ✨ + version + Admin dot, toolbar inline "Font: [path] [Quét lại] AutoCAD Fonts: [path] [Chọn]", bulk action "Chọn tất cả / Bỏ chọn / counter / ⚡ Cài đặt font đã chọn (gradient)", card groups có folder icon + tên accent + badge "4 file" + checkboxes, log panel đáy với monospace + màu xanh lá ghi "✓ Quét xong: 11 nhóm, 1716 file font".
2. **Trish Library 1.0** (screenshot attach sau) — header mảnh, toolbar inline "📍 Đang xem: [input]  🔍 Tìm kiếm: [input] | Tất cả (*.*)", 2-column split (sidebar "Các Thư Viện Của Bạn" + file explorer bên phải với cột Name/Size/Type/Date/Ghi chú/Link QR), footer "💾 Lưu Thông tin (gradient)" + action bar đáy "Gần đây / Báo cáo-Xuất Excel / Cài đặt / Giới thiệu".

**Phản hồi user:** *"tôi đã nói cái giao diện nó phải giống cái trước kể cả các app sau này... chỉnh lại sau này các app đều giống giao diện này ko phải chỉ đổi dark mode là xong"* + *"bạn đang vẽ các app nó quá xấu ko đạt mức kỳ vọng được của tôi"*.

**Feedback mới trong session này (đã áp):**
- Admin dot → thay bằng About + Update (app public, không login).
- About dialog có tác giả + thông tin hệ sinh thái 6 app TrishNexus.
- Update button cho phép tự update data fonts mới (stub UI đã xong, wire worker Phase 3).

### Files mới tạo/sửa session này (absolute, tham khảo)

**Shared widgets (mới):**
- `shared/trishteam_core/src/trishteam_core/widgets/app_header.py`
- `shared/trishteam_core/src/trishteam_core/widgets/inline_toolbar.py`
- `shared/trishteam_core/src/trishteam_core/widgets/action_bar.py`
- `shared/trishteam_core/src/trishteam_core/widgets/card_group.py`
- `shared/trishteam_core/src/trishteam_core/widgets/log_panel.py`
- `shared/trishteam_core/src/trishteam_core/widgets/footer_bar.py`
- `shared/trishteam_core/src/trishteam_core/widgets/split_sidebar.py`
- `shared/trishteam_core/src/trishteam_core/widgets/dialogs.py`

**Shared (đã sửa):**
- `shared/trishteam_core/src/trishteam_core/widgets/__init__.py` — export 9 widget + dialogs
- `shared/trishteam_core/src/trishteam_core/widgets/empty.py` — thêm setter
- `shared/trishteam_core/src/trishteam_core/ui/theme.py` — QSS cho roles mới
- `shared/trishteam_core/src/trishteam_core/ui/base_window.py` — thêm set_header/set_footer

**TrishFont (đã sửa):**
- `apps/trishfont/src/trishfont/app.py` — wire header + footer + dialogs
- `apps/trishfont/src/trishfont/modules/library/view.py` — rewrite toàn diện
- `apps/trishfont/src/trishfont/modules/favorites/view.py` — sync với library class mới

**Docs:**
- `docs/design-spec.md` — spec v0.1
- `docs/SESSION-HANDOFF.md` — file này

### 7 app kế thừa design language này (roadmap)
TrishFont, TrishLauncher, TrishDesign, TrishLibrary, TrishNote, TrishAdmin,
TrishType. Tất cả dùng chung `trishteam_core/widgets/` → sửa 1 nơi, 7 app đổi
theo + đồng bộ với website `trishteam.io.vn`. Logo chính thức đã xử lý ở
`design/logos/<AppName>/` (remove bg, multi-size PNG + .ico). Các app cũ
TrishVideo/Excel/PPT đã loại khỏi scope — chưa có logo, chưa có nhu cầu.

---

## Cấu trúc project (hiện tại sau pivot)

```
C:\Users\TRI\Documents\Claude\Projects\TrishTEAM\trishnexus-monorepo\
├── CLAUDE.md
├── docs/SESSION-HANDOFF.md             ← file này
├── docs/design-spec.md                  ← CẦN TẠO (Phase 1)
├── design/tokens.json                   ← source of truth
├── scripts/
│   ├── gen-tokens.js
│   ├── START.bat / END.bat / SETUP.bat
│   └── README.txt
├── shared/trishteam_core/
│   └── src/trishteam_core/
│       ├── ui/{base_window,sidebar,theme,tokens}.py
│       └── widgets/{card,empty,toast}.py  ← SẼ thêm 7 widget mới Phase 2
├── apps/
│   ├── trishdesign/                     ← scaffold xong
│   └── trishfont/
│       └── src/trishfont/
│           ├── app.py
│           └── modules/
│               ├── library/{models,repository,view}.py    ← CẦN redesign UI Phase 2
│               ├── preview/view.py                        ← CẦN redesign UI Phase 2
│               ├── favorites/view.py
│               ├── install/view.py
│               └── settings/{models,paths,repository,__init__}.py  ← NEW, OK
└── website/assets/tokens.css
```

## File code quan trọng (relative từ monorepo root)

### Logic (đã stable, không đụng ở Phase 2)
- `apps/trishfont/src/trishfont/modules/settings/*` — SettingsRepository + path resolver
- `apps/trishfont/src/trishfont/modules/library/models.py` — MIGRATION_001_FONTS, Font dataclass
- `apps/trishfont/src/trishfont/modules/library/repository.py` — FontRepository.scan_folder

### UI (sẽ redesign Phase 2)
- `shared/trishteam_core/src/trishteam_core/ui/theme.py` — QSS generator dark mode + Segoe UI global (đã basic, sẽ expand ở Phase 2)
- `shared/trishteam_core/src/trishteam_core/ui/tokens.py` — có `COLOR` (light) + `DARK` namespaces
- `shared/trishteam_core/src/trishteam_core/ui/base_window.py` — có thể cần slot cho AppHeader/FooterBar
- `apps/trishfont/src/trishfont/modules/library/view.py` — rewrite theo design spec
- `apps/trishfont/src/trishfont/modules/preview/view.py` — rewrite theo design spec

## API của trishteam_core (stable, dùng y nguyên)

- `trishteam_core.store.Database(path)` — SQLite wrapper, có `.conn`, `.transaction()`, `.close()`
- `trishteam_core.store.migrate(db, [(version, sql_str), ...])` — PRAGMA user_version
- `trishteam_core.utils.user_data_dir_for(app_name)` — platformdirs Path
- `trishteam_core.utils.get_logger(name, log_dir=)` — RotatingFileHandler
- `trishteam_core.ui.BaseWindow(title=)` — main window
- `trishteam_core.ui.apply_theme(app, dark=True)` — set Segoe UI + QSS dark
- `trishteam_core.ui.build_qss(dark=True)` — QSS string
- `trishteam_core.widgets.Card, EmptyState, Toast, show_toast(widget, message)`

## User preferences đã biết

- Không phải developer, thích giải thích ngắn gọn tiếng Việt
- Ghét gõ lệnh git dài → dùng .bat double-click
- Làm việc 2 máy (nhà + cơ quan) qua GitHub sync (đã pivot từ USB)
- Font folder curated riêng, KHÔNG scan system fonts
- Domain chính thức: `trishteam.io.vn` (TenTen, chưa cấu hình)
- Ưu tiên làm từng bước nhỏ, confirm trước khi bước tiếp
- Git config: name=`hosytri07`, email=`hosytri07@gmail.com`
- **Design language:** dark mode + gradient tím-xanh + compact + emoji có màu. Tham khảo TrishFont v1.0.0 cũ + Trish Library 1.0 của user. Không chấp nhận UI xấu/Material bloat.

---

## Chào user khi bắt đầu session mới

Gợi ý câu mở đầu:

> Chào Trí. Đã đọc handoff — UI Design System đã xong Phase 1 + 2: 9 widget core + TrishFont rewrite xong, AppHeader có About + Update (đã bỏ Admin dot), design-spec.md v0.1 đã ghi. Giờ cần Trí **chạy thử trên Windows** (`python -m trishfont.app`) để confirm UI đúng ý. Nếu ổn → sang Phase 3 wire worker cài font + update checker. Trí test xong báo feedback (screenshot hoặc mô tả) để mình fix tiếp nhé?
