# TrishTEAM — Website spec

Phase 11. Website **trishteam.com** — marketing hub + cloud UI cho các app có
sync (Library / Note / Search / Admin). Share design token + logo + auth với
desktop.

> Stack: **Next.js 14 App Router** + Tailwind + shadcn/ui + **Lucide icons** + Firebase SDK.
> Deploy: **Vercel**.
> Design reference: Youwee (<https://github.com/vanloctech/youwee>) — cùng stack shadcn + Lucide, cùng theme-system 6+1. Xem [`ROADMAP.md` Phase 13](ROADMAP.md#phase-13--design-language-refresh-v2).

---

## 1. Mục tiêu

1. **Marketing hub**: giới thiệu 10 app public (trừ TrishAdmin), download
   link chỉ đúng 1 nơi — `apps.json` từ repo registry.
2. **Cloud UI đồng bộ**: user login → thao tác Library / Note / Search trên
   web → desktop app mở ra thấy ngay.
3. **Admin portal**: `/admin` route (role-gated) cho Admin/Dev quản lý user +
   logs + push update.
4. **Brand consistency**: cùng palette warm-dark, cùng logo, cùng typography
   như desktop.

---

## 2. Sitemap

```
/                           Landing — hero TrishTEAM + 10 app grid
/apps/trishfont             Detail page — screenshots, changelog, download
/apps/trishdesign
/apps/trishlibrary
/apps/trishnote
/apps/trishtype
/apps/trishcheck
/apps/trishsearch
/apps/trishclean
/apps/trishimage
/apps/trishlauncher

/downloads                  Tổng hợp latest version từng app

/login                      Firebase Auth (Email/Password + Google)
/signup
/forgot-password
/account                    Profile + connected apps + logout

/library                    [auth] UI web cho TrishLibrary
/note                       [auth] UI web cho TrishNote
/search                     [auth] UI web cho TrishSearch

/admin                      [role=admin|dev] Portal TrishAdmin
/admin/users
/admin/logs
/admin/packs                Push font-pack mới
/admin/releases             Bump version app

/docs                       Developer docs (MDX)
/docs/getting-started
/docs/apps/<id>
/docs/api                   Firebase REST reference
/privacy
/terms
```

---

## 3. Repo layout

```
trishteam-website/              (repo riêng HOẶC website/ trong monorepo)
├─ app/                         (Next.js 14 App Router)
│   ├─ (marketing)/             grouped layout cho /, /apps, /docs, ...
│   ├─ (auth)/                  grouped layout cho /login, /signup
│   ├─ (dashboard)/             grouped layout cho /library, /note, /search
│   ├─ admin/                   role-gated layout
│   └─ api/                     Next route handlers (proxy Firebase)
├─ components/
│   ├─ ui/                      shadcn components customized
│   ├─ marketing/               AppCard, HeroSection, FeatureGrid
│   ├─ dashboard/               LibraryList, NoteEditor, SearchBar
│   └─ admin/
├─ lib/
│   ├─ firebase-client.ts
│   ├─ firebase-admin.ts
│   ├─ auth.ts                  server-side session helpers
│   ├─ apps-registry.ts         fetch apps.json cache SSR
│   └─ design-tokens.ts         import từ tokens.json export
├─ public/
│   └─ logos/                   optional copy local; prefer raw.githubusercontent
├─ styles/
│   └─ globals.css              Tailwind + CSS vars từ tokens
├─ tailwind.config.ts
├─ next.config.mjs
└─ package.json
```

---

## 4. Design tokens sync với desktop

### Source of truth

`shared/trishteam_core/src/trishteam_core/ui/tokens.json` — đây là bảng màu
warm-dark gốc dùng cho desktop QSS.

### Export script

`scripts/export-tokens-css.py`:

```python
"""Convert tokens.json → globals.css CSS variables.

Input:  shared/trishteam_core/.../tokens.json
Output: website/styles/tokens.css
"""
import json, pathlib
src = pathlib.Path("shared/trishteam_core/src/trishteam_core/ui/tokens.json")
dst = pathlib.Path("website/styles/tokens.css")
data = json.loads(src.read_text())
lines = [":root {"]
for k, v in data["colors"].items():
    lines.append(f"  --color-{k.replace('_','-')}: {v};")
for k, v in data["spacing"].items():
    lines.append(f"  --spacing-{k}: {v}px;")
lines.append("}")
dst.write_text("\n".join(lines))
print(f"✓ Exported {len(data['colors'])} colors → {dst}")
```

Chạy trong CI mỗi build → web luôn match desktop.

### Tailwind mapping

```ts
// tailwind.config.ts
module.exports = {
  theme: {
    extend: {
      colors: {
        "warm-darkest": "var(--color-bg-darkest)",   // #0f0e0c
        "warm-dark":    "var(--color-bg-dark)",       // #1a1814
        "warm-fg":      "var(--color-fg-primary)",    // #f5f2ed
        "warm-mute":    "var(--color-fg-muted)",      // #a09890
        "accent":       "var(--color-accent)",        // #667EEA
      }
    }
  }
}
```

---

## 5. Logo source

Web **không** duplicate logo files. Đọc trực tiếp:

```ts
// lib/apps-registry.ts
const LOGO_BASE = "https://raw.githubusercontent.com/hosytri07/" +
                  "trishnexus-launcher-registry/main/logos";

export function logoUrl(appName: string, size: 64|128|256|512 = 256) {
  return `${LOGO_BASE}/${appName}/icon-${size}.png`;
}
```

Khi đổi logo desktop → push lên registry → web auto thấy sau CDN cache clear
(~5 phút).

---

## 6. Landing page spec

```
┌──────────────────────────────────────────────────────────┐
│ Header: [TrishTEAM logo + text]   nav   [Đăng nhập]      │
├──────────────────────────────────────────────────────────┤
│                                                            │
│   Hero:                                                    │
│   ┌────────────┐                                           │
│   │ [umbrella  │   TrishTEAM                                │
│   │  logo 200] │   Hệ sinh thái ứng dụng cá nhân           │
│   │            │   gọn — nhanh — đồng bộ                    │
│   └────────────┘   [Tải launcher]  [Xem demo]              │
│                                                            │
├──────────────────────────────────────────────────────────┤
│                                                            │
│   10 app grid (4 cột, 3 dòng + dòng cuối 2 cột):          │
│                                                            │
│   [Font] [Design] [Library] [Note]                         │
│   [Type] [Check]  [Search]  [Clean]                        │
│   [Image] [Launcher]                                       │
│                                                            │
│   Mỗi card: logo 96px + name + tagline + [Tìm hiểu →]     │
│                                                            │
├──────────────────────────────────────────────────────────┤
│   Feature highlight: "Một tài khoản — xài mọi nơi"         │
│   "Đồng bộ realtime desktop ⇄ web"                         │
│   "Bảo mật DPAPI + Firebase"                               │
├──────────────────────────────────────────────────────────┤
│   Footer: © 2026 TrishTEAM · Privacy · Terms · GitHub      │
└──────────────────────────────────────────────────────────┘
```

- Palette warm-dark: bg `#0f0e0c`, card `#1a1814`, accent `#667EEA`.
- Typography: Inter cho UI, không dùng font serif.
- App cards hover: scale 1.02 + subtle glow theo accent color per app.

---

## 7. Dashboard routes (auth required)

### /library

Web version của TrishLibrary — list items với filter:

```
┌─────────────────────────────────────────────────────────┐
│ Sidebar: ─ Tất cả  ─ PDF  ─ Docx  ─ Link  ─ Note        │
│          ─ Tag: dự án A, học thuật, ...                  │
├─────────────────────────────────────────────────────────┤
│ Search bar [_______________]                 [+ Thêm]    │
├─────────────────────────────────────────────────────────┤
│  📄 Bảng tính dầm T.xlsx                                 │
│     tag: kết cấu · updated 2h trước                      │
│                                                           │
│  🔗 https://docs.example.com/vn2000-guide                │
│     tag: khảo sát · updated hôm qua                      │
└─────────────────────────────────────────────────────────┘
```

- Firestore realtime listener: `onSnapshot(collection("library/{uid}/items"))`.
- CRUD qua Firestore SDK; desktop cũng dùng cùng collection → sync tự động.

### /note

Markdown editor (reuse `@uiw/react-md-editor` hoặc similar).

### /search

Full-text search qua `search_index` collection (Firestore không có native
full-text, dùng Algolia extension HOẶC simple `array-contains-any` cho tag).

---

## 8. /admin portal

Chỉ user với `role in ("admin","dev")` vào được — middleware check session
cookie custom claim.

### Features

- **/admin/users** — list user, set role (dev only), reset password, disable
  account.
- **/admin/logs** — paginated view của `auth_events` và `admin_ops`
  collection.
- **/admin/packs** — upload font-pack mới → push lên repo
  `trishnexus-fontpacks` qua GitHub API.
- **/admin/releases** — bump version app trong `apps.json`, trigger build CI.

### Middleware

```ts
// middleware.ts
export function middleware(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith("/admin")) {
    const session = await verifySessionCookie(req.cookies.get("session")?.value);
    if (!session) return NextResponse.redirect(new URL("/login", req.url));
    if (!["admin","dev"].includes(session.role)) {
      return NextResponse.redirect(new URL("/", req.url));
    }
  }
}
```

---

## 9. Auth flow chi tiết

### Login (Email/Password)

1. User điền form `/login` → submit.
2. Client-side: `signInWithEmailAndPassword(auth, email, password)` →
   trả về Firebase user + id token.
3. POST `/api/auth/session` với id token → server `admin.auth().createSessionCookie`
   → set cookie HttpOnly Secure.
4. Redirect → `/library` (hoặc `?next=` param).

### Login (Google)

`signInWithPopup(auth, googleProvider)` → tương tự bước 3-4.

### Session cookie lifecycle

- TTL 5 ngày (rotate).
- Revoke khi user logout hoặc admin disable account.
- Middleware `verifySessionCookie` với `checkRevoked: true` cho /admin routes.

### Desktop ↔ Web SSO

Cả 2 dùng **cùng 1 Firebase project** — user login web → Firestore collection
`/users/{uid}` update last_login. Desktop lần sau login cùng email → nhận
cùng uid → thấy cùng data.

Không cần web-to-desktop SSO token passing; đơn giản login riêng cả 2, cùng
credentials, cùng project.

---

## 10. CI/CD

- **Build**: GitHub Actions trigger per PR → `next build` + `typecheck` +
  `eslint` → output artifact.
- **Deploy**: Vercel tự connect repo → preview URL per PR, production
  auto-deploy từ `main` branch.
- **Env vars**: Firebase config + service account key (base64) trong Vercel
  project settings — không commit.
- **Tokens sync**: GitHub Action chạy `scripts/export-tokens-css.py` trên mỗi
  push vào `shared/trishteam_core/.../tokens.json`, commit kết quả vào
  `website/styles/tokens.css`.

---

## 11. Checklist (exit criteria Phase 11)

- [ ] Khởi tạo repo `trishteam-website/` (hoặc folder `website/` trong monorepo).
- [ ] Setup Next.js 14 + Tailwind + shadcn/ui + Lucide icons + Firebase SDK.
- [ ] Chạy `npx shadcn@latest init` + add Card/Button/Sheet/Dialog/Sonner/DropdownMenu.
- [ ] Wire 2-theme system (dark default + light — Phase 13.5 rút từ 7) qua Tailwind `darkMode: class` + `data-theme` attribute. Giữ bảng `theme_aliases` từ `tokens.v2.json` để link cũ (trishwarm/midnight/aurora/...) không vỡ.
- [ ] Export tokens script + CI step.
- [ ] Landing page với 10 app grid + logo từ registry.
- [ ] Từng `/apps/<id>` page với screenshots + changelog + download button
      (đọc `apps.json` SSG).
- [ ] `/login`, `/signup`, `/forgot-password` Firebase Auth.
- [ ] Session cookie handler + middleware.
- [ ] `/library` + `/note` + `/search` với Firestore realtime.
- [ ] `/admin` middleware + 4 sub-pages.
- [ ] Domain `trishteam.com` trỏ Vercel, SSL auto.
- [ ] Privacy + Terms page.
- [ ] Lighthouse > 95 performance + accessibility.
- [ ] E2E test với Playwright: login → library CRUD → logout.

---

## 12. Milestones

| Mốc   | Deliverable                                      | ETA     |
| ----- | ------------------------------------------------ | ------- |
| W-1   | Scaffold Next.js + Tailwind + tokens export      | Week 1  |
| W-2   | Landing + /apps/<id> SSG                         | Week 2  |
| W-3   | Auth + session cookie + /account                 | Week 3  |
| W-4   | /library realtime                                | Week 4  |
| W-5   | /note editor                                     | Week 5  |
| W-6   | /search + /admin                                 | Week 6  |
| W-7   | Polish + Lighthouse + E2E                        | Week 7  |
| W-8   | Launch trishteam.com production                  | Week 8  |

---

## Changelog

- **2026-04-22 v0.1** — spec ban đầu, Phase 11 TrishTEAM.
