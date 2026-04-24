# TrishTEAM Website — Phase 11

Landing + portal web cho hệ sinh thái TrishTEAM. Đồng bộ **design tokens v2**
(2-theme system: dark default + light) với desktop apps qua `scripts/export-tokens.py`.

---

## Stack (pinned)

| Layer       | Lib                | Version |
|-------------|--------------------|---------|
| Framework   | Next.js            | 14.2.5  |
| UI         | React              | 18.3.1  |
| CSS        | Tailwind CSS       | 3.4.4   |
| Icons       | lucide-react       | 0.383.0 |
| Util        | clsx + tailwind-merge | 2.x  |
| Lang        | TypeScript         | 5.4.5   |

shadcn/ui sẽ add từng component khi cần (`npx shadcn@latest add button` v.v.)
chứ không bulk init — giữ bundle nhẹ.

---

## Setup trên máy (Windows / macOS / Linux)

```bash
# 1. Cần Node 18+ — kiểm tra:
node --version

# 2. Install (pnpm khuyên dùng vì lock file gọn + nhanh hơn npm)
cd website
npm install              # hoặc pnpm install / yarn install

# 3. Sync tokens từ design/tokens.v2.json (đã auto sync trước commit, nhưng nếu JSON đổi thì chạy):
npm run tokens:sync

# 4. Dev
npm run dev              # http://localhost:3000

# 5. Build prod
npm run build
npm run start
```

---

## Tokens sync workflow

```
design/tokens.v2.json            ← source of truth (designer edit file này)
        │
        ▼  python scripts/export-tokens.py
        │
website/assets/tokens.css        ← CSS vars (:root dark + [data-theme='light'])
website/assets/tailwind.theme.cjs ← Tailwind theme object
```

**Quy tắc**:

- Đừng edit trực tiếp `tokens.css` hay `tailwind.theme.cjs` — script auto regen.
- Khi designer sửa `tokens.v2.json`, chạy `npm run tokens:sync` rồi commit cả 3 file.
- CI chạy `npm run tokens:check` → exit 1 nếu drift → block PR.

---

## Theme switching

- **Default**: dark (`<html data-theme="dark">` trong `app/layout.tsx`).
- **Toggle**: component `<ThemeToggle />` (Lucide icon Moon/Sun) gọi `useTheme().setTheme('light')`.
- **Persist**: `localStorage.trishteam:theme` (client-only, hydration mismatch tolerant nhờ `suppressHydrationWarning`).
- **Aliases**: file cũ có thể chứa `'trishwarm'` / `'candy'` / `'midnight'`... — `theme-provider.tsx` map về `'dark'` / `'light'`. Cùng logic với desktop `theme_manager.py`.

---

## Roadmap (Phase 11.x)

- [x] **Phase 11.0** — Scaffold Next.js + Tailwind + tokens pipeline + stub /apps + /downloads, silence Watchpack + telemetry (Task #71 + #88).
- [ ] **Phase 11.1** — Landing đầy đủ + typography polish:
  - 10 app grid + screenshots + changelog từ `shared/apps.json`.
  - **Title VIẾT HOA + Be Vietnam Pro** qua `next/font/google` (subset latin + vietnamese). (User request #89.)
- [ ] **Phase 11.2** — `/apps/<id>` SSG với metadata + download button → GitHub Release.
- [ ] **Phase 11.3** — `/login`, `/signup`, `/forgot-password` dùng Firebase Auth Web SDK.
- [ ] **Phase 11.4** — Middleware session cookie + `/portal` role-gated pages.
- [ ] **Phase 11.5** — Admin: release management + user role assignment (TrishAdmin parity).

---

## Dev noise — đã tắt gì ở Phase 11.0 polish

- **Next telemetry**: `NEXT_TELEMETRY_DISABLED=1` set qua `cross-env` trong script `dev`/`build`/`start`. Không gửi số liệu anonymous về Vercel.
- **Watchpack EINVAL** (Windows lstat `C:\hiberfil.sys`/`C:\pagefile.sys`/`C:\swapfile.sys`/`C:\DumpStack.log.tmp`): `next.config.mjs` > `webpack.watchOptions.ignored` liệt kê các path system + `node_modules`/`.git`/`.next` — Watchpack skip, log sạch.
- **npm update notice** (`New minor version of npm available`): không tắt được qua script, nhưng chỉ hiện 1 lần sau `npm install`. Muốn im hẳn: `npm config set update-notifier false` (global, không commit vào repo).
- **404 `/apps` `/downloads`**: đã tạo stub page (coming-soon card) ở `app/apps/page.tsx` + `app/downloads/page.tsx`. Phase 11.1/11.2 wire nội dung thật.

---

## Liên quan

- Design tokens: `../design/tokens.v2.json`
- Desktop app parity: `../docs/WEB-DESKTOP-PARITY.md`
- Auth spec: `../docs/AUTH.md`
- Roadmap tổng: `../docs/ROADMAP.md`
