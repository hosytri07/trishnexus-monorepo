# TrishTEAM — Vercel deploy guide (Phase 17.1)

Tài liệu trình tự deploy website `trishnexus-monorepo/website` lên
Vercel với domain chính thức `trishteam.io.vn` (mua tại TENTEN).

> **Mục tiêu:** sau 30 phút làm theo đúng checklist, `https://trishteam.io.vn`
> trả HTTP/2 200 với chứng chỉ Let's Encrypt hợp lệ, tất cả env vars
> production đã wire đúng, smoke test pass sạch.

---

## Pre-flight checklist

Trước khi bấm Deploy:

- [ ] `pnpm -C website tsc --noEmit` xanh (EXIT=0)
- [ ] `pnpm -C website lint` không có error (warning OK)
- [ ] `pnpm -C website build` chạy local thành công
- [ ] Ảnh OG default ở `website/public/og/og-default.png` (1200×630)
- [ ] `.env.example` ở root + `website/.env.example` cập nhật sát env
      thực tế (KHÔNG commit `.env.local`)
- [ ] Firebase project production (khác dev): rules + indexes đã deploy
      (`firebase deploy --only firestore:rules,firestore:indexes --project trishteam-prod`)
- [ ] Firebase service account JSON đã có (Settings → Service accounts →
      Generate new private key) — sẽ paste vào `FIREBASE_SERVICE_ACCOUNT`
      ở bước env

---

## Bước 1 — Tạo project Vercel

1. Login https://vercel.com với GitHub account của Trí.
2. `+ New Project` → import repo `hosytri77/trishnexus-monorepo`.
3. **Root Directory**: `website`
4. **Framework Preset**: Next.js (auto-detected)
5. **Build Command**: `next build` (mặc định)
6. **Install Command**: `pnpm install --frozen-lockfile` (hoặc npm tương ứng — xem `package.json` root)
7. Chưa bấm Deploy — sang bước 2 set env trước.

---

## Bước 2 — Environment Variables

Ở tab `Settings → Environment Variables`, paste lần lượt (chọn đủ cả
`Production`, `Preview`, `Development` cho env common; `Production` only
cho secret prod).

### Firebase client (Production + Preview)

| Key | Value | Ghi chú |
|-----|-------|---------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | `AIzaSy...` | Firebase → Project Settings → General |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `trishteam-prod.firebaseapp.com` | |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `trishteam-prod` | |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | `trishteam-prod.appspot.com` | |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | `1234567890` | |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | `1:1234567890:web:abcdef` | |

### Firebase Admin (Production only)

| Key | Value | Ghi chú |
|-----|-------|---------|
| `FIREBASE_SERVICE_ACCOUNT` | Base64 của JSON service account | `cat serviceAccount.json \| base64 -w0` |

> ⚠️ Không commit file JSON vào repo. Token này có quyền admin Firestore/Auth.

### Site config (Production)

| Key | Value |
|-----|-------|
| `NEXT_PUBLIC_SITE_URL` | `https://trishteam.io.vn` |
| `NEXT_PUBLIC_APP_VERSION` | `1.0.0` (mỗi release bump — map source map & filter error by version) |

### Semantic search (Production, optional)

| Key | Value | Ghi chú |
|-----|-------|---------|
| `NEXT_PUBLIC_GEMINI_API_KEY` | `AIza...` | Nếu để trống → fallback FNV hash embedding |

### Analytics (Production + Preview, sau khi Umami đã self-host)

| Key | Value |
|-----|-------|
| `NEXT_PUBLIC_UMAMI_SRC` | `https://analytics.trishteam.io.vn/script.js` |
| `NEXT_PUBLIC_UMAMI_WEBSITE_ID` | UUID từ Umami dashboard |
| `NEXT_PUBLIC_UMAMI_DOMAINS` | `trishteam.io.vn` |

---

## Bước 3 — Deploy lần đầu

1. Ở tab `Deployments`, bấm `Deploy`.
2. Đợi ~2 phút. Theo log:
   - `Installing dependencies` ~30s
   - `Running "next build"` ~60s
   - `Collecting page data` ~15s
3. Nếu fail → xem log, thường do env thiếu. Sửa → `Redeploy`.
4. URL tạm thời dạng `trishnexus-<hash>.vercel.app` — mở thử, kiểm tra:
   - Home `/` render
   - Ảnh OG hiện (view-source, tìm `<meta property="og:image">`)
   - Console không có error 500

---

## Bước 4 — Wire domain `trishteam.io.vn`

### 4.1. Trong Vercel

1. `Settings → Domains → Add`.
2. Nhập `trishteam.io.vn` → `Add`.
3. Vercel hiển thị 2 record cần thêm ở DNS provider.

### 4.2. Trong TENTEN (quản lý domain)

Đăng nhập https://tenten.vn → My Domain → `trishteam.io.vn` → DNS Records:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A    | @    | `76.76.21.21` (Vercel Anycast) | 300 |
| CNAME | www | `cname.vercel-dns.com` | 300 |

> TENTEN có thể yêu cầu bỏ các bản ghi A/AAAA cũ trước.

### 4.3. Verify

Đợi 5-15 phút (TTL phụ thuộc TENTEN):

```bash
dig trishteam.io.vn +short         # phải ra 76.76.21.21
dig www.trishteam.io.vn +short     # phải ra cname.vercel-dns.com...
```

Quay về Vercel Domains tab — badge đổi từ `Invalid Configuration` →
`Valid`. SSL Let's Encrypt issue trong 1-2 phút.

---

## Bước 5 — Domain canonical

Vercel auto redirect `www.trishteam.io.vn` → `trishteam.io.vn` khi set
`trishteam.io.vn` làm primary. Kiểm tra:

```bash
curl -sI https://www.trishteam.io.vn | head -5
# phải thấy: location: https://trishteam.io.vn/
```

---

## Bước 6 — Smoke test production

Checklist thủ công:

### Core flow
- [ ] `https://trishteam.io.vn/` load < 2s (Network tab: LCP < 2500ms)
- [ ] Dark mode mặc định, toggle light mode hoạt động
- [ ] TopNav + SideNav render đầy đủ
- [ ] Command Palette mở bằng `Cmd/Ctrl + K`
- [ ] `/apps` list đúng 10 app, click mở trang con
- [ ] `/search` ô search hoạt động, semantic toggle có state

### Auth
- [ ] `/login` — email/password hợp lệ đăng nhập được
- [ ] `/login` — Google OAuth popup mở
- [ ] Đăng ký mới: user doc tạo ở `/users/{uid}` với `role: 'user'`
- [ ] Logout clear state, quay về guest mode

### PWA
- [ ] Manifest valid: Chrome DevTools → Application → Manifest (không error)
- [ ] Service worker register: Application → Service Workers → `active`
- [ ] Offline mode: DevTools → Network → Offline, reload → `/offline` fallback

### SEO
- [ ] `https://trishteam.io.vn/sitemap.xml` — 5 URL
- [ ] `https://trishteam.io.vn/robots.txt` — đúng allow/disallow + opt-out AI
- [ ] `view-source:` → `<meta property="og:image" content="https://trishteam.io.vn/og/og-default.png">`
- [ ] Open Graph debug: https://www.opengraph.xyz/ paste URL → preview đẹp

### Observability
- [ ] DevTools Console không có error đỏ khi reload
- [ ] DevTools Network: POST `/api/vitals` status 204 sau khi scroll
- [ ] Gây lỗi thử: browser console `throw new Error('test')` → trong 10s
      có entry mới ở `/admin/errors` (đăng nhập admin để xem)

### Admin (cần login admin)
- [ ] `/admin` render dashboard (không 403)
- [ ] `/admin/vitals` show Core Web Vitals (có thể trống nếu vừa deploy)
- [ ] `/admin/errors` show lỗi test vừa gây
- [ ] `/admin/reindex` semantic reindex apps chạy OK

---

## Bước 7 — Post-launch

1. **Tag git:** `git tag -a v1.0.0 -m "TrishTEAM website go-live" && git push --tags`
2. **Bump NEXT_PUBLIC_APP_VERSION** lên `1.0.0` trong Vercel env → Redeploy.
3. **Viết CHANGELOG entry** (xem `docs/CHANGELOG.md`).
4. **Ping team** qua Zalo group.
5. **Monitor 24h**: check `/admin/errors` mỗi 4h để bắt regression sớm.

---

## Rollback

Nếu phát hiện regression nghiêm trọng trong vòng 1h sau deploy:

### Option A — Promote previous deployment (< 30s)

1. Vercel `Deployments` tab.
2. Tìm deployment trước (xanh ✓).
3. `⋯` → `Promote to Production`.
4. Domain tự trỏ về deployment cũ trong ~10s.

### Option B — Revert git

```bash
git revert <bad-commit-sha>
git push origin main
# Vercel tự deploy lại từ main
```

### Option C — Tắt domain

Nếu có lỗi gây nguy hiểm (leak PII, XSS đang được exploit):

1. Vercel `Settings → Domains → trishteam.io.vn → Remove`.
2. Sửa hoàn chỉnh → wire lại ở bước 4.

---

## Troubleshooting

| Triệu chứng | Nguyên nhân thường gặp | Fix |
|-------------|------------------------|-----|
| Build fail `Module not found` | Import path sai case (Linux case-sensitive) | Rename file khớp import |
| 500 ở `/api/vitals` | `FIREBASE_SERVICE_ACCOUNT` thiếu hoặc sai format | Regenerate, paste base64 |
| `/admin` trả 403 dù đã login | Chưa có role='admin' | `scripts/seed-admin.ts` hoặc gán trực tiếp Firestore |
| Image OG không hiện trên Zalo/FB | Cache crawler cũ | Facebook Debugger `scrape again` |
| `sitemap.xml` 404 | Next.js build chưa có sitemap route | Confirm `app/sitemap.ts` commit lên main |
| SSL "pending" > 30 phút | DNS chưa propagate hoặc record sai | `dig +trace trishteam.io.vn` kiểm tra |

---

## References

- Vercel Next.js docs: https://vercel.com/docs/frameworks/nextjs
- Firebase Admin on Vercel: https://firebase.google.com/docs/admin/setup
- TENTEN DNS: https://tenten.vn/faq
