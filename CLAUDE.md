# CLAUDE.md - TrishNexus Project Context

**Doc ngay khi session bat dau.** File nay la entry point cho Claude lam viec tren repo nay.

## Context ngan

- **User**: Tri (hosytri77 / hosytri77@gmail.com / trishteam.official@gmail.com), ky su ha tang giao thong Da Nang, KHONG phai developer. Giao tiep tieng Viet, ngan gon, tranh jargon.
- **Workspace**: Monorepo tai `C:\Users\TRI\Documents\Claude\Projects\TrishTEAM\trishnexus-monorepo` (May TRI (Cowork dung user TRI), cung path moi may). Dong bo qua GitHub.
- **GitHub**: `hosytri07/trishnexus-monorepo`
- **Website live**: trishteam-website (Vercel), domain chinh thuc `trishteam.io.vn` (mua TenTen, chua cau hinh)

## Quy uoc quan trong

1. **Luon doc `docs/HANDOFF-MASTER.md`** khi session moi bat dau de biet dang lam den dau. File do la "nhat ky progress" chia se giua 2 may. Chi doc section `PHIEN HIEN TAI` tren cung - phan duoi la archive.
2. **Luon cap nhat `docs/HANDOFF-MASTER.md`** truoc khi session ket thuc - neu khong, may ben kia se lam trung.
3. **User go `tiep tuc`** = doc handoff + pick up. Khong hoi dai dong.
4. **User go `chot` / `xong roi` / `de mai` / `bam END.bat`** = update handoff TRUOC khi chao.

## Cau truc monorepo (Phase 44 - 2026-05-23 - sau khi gop)

```
trishnexus-monorepo/
- CLAUDE.md                       <- file nay
- docs/HANDOFF-MASTER.md          <- trang thai hien tai, luon doc/update
- design/tokens.json              <- design tokens (4 app accent + brand)
- scripts/                        <- gen-tokens.js + START/END/SETUP.bat
- shared/trishteam_core/          <- Python package chung
- packages/
  - design-system/                <- AppShell + AppLogo + theme + 4 accent rules
  - auth/                         <- AuthGate (replace KeyGate cu) + Firebase
  - data/                         <- types + userHasAppAccess() + AppId enum
  - core / ui / adapters / ...
- apps-desktop/
  - trishwork/         (NEW) <- gop Design + Library + ISO. Accent xanh la.
  - trishutilities/    (NEW) <- gop Clean + Check + Drive + Font + Shortcut. Accent tim.
  - trishfinance/            <- giu, accent vang cam.
  - trishadmin/              <- giu + them AppAccessPanel. Accent do.
  - _archive/                <- 10 app cu (read-only, khong trong workspace)
    - trishdesign / trishlibrary / trishiso /
    - trishclean / trishcheck / trishdrive /
    - trishfont / trishshortcut /
    - trishlauncher / trishoffice
- website/                        <- TrishTeam Website (Next.js 14)
```

## 4 app moi + Admin (Phase 44)

| App | Accent | Ports dev | Gop tu |
|---|---|---|---|
| **TrishWork** | `#34D399` xanh la | 1440 | Design + Library + ISO |
| **TrishUtilities** | `#A78BFA` tim | 1442 | Clean + Check + Drive + Font + Shortcut |
| **TrishFinance** | `#FBBF24` vang cam | (giu) | (refactor doc UI defer) |
| **TrishAdmin** | `#F87171` do | (giu) | + AppAccessPanel moi |

## Auth flow MOI (Phase 44.2)

1. Mo app -> Firebase Auth login screen (Google / email-password)
2. Sign up moi -> Firestore `/users/{uid}` role='trial' -> bi block tat ca app
3. Admin (Tri) vao TrishAdmin -> panel "Cap quyen App" -> tick chon app cho user trial -> save
4. User reload -> mo app duoc voi cac module duoc gan
5. KHONG con nhap key tay trong app

## Tools user co san

- **Double-click `scripts/START.bat`**: pull code, chuan bi moi truong (bam moi sang)
- **Double-click `scripts/END.bat`**: commit + push tu dong, nhac eject USB (bam moi toi)
- **Double-click `scripts/SETUP.bat`**: setup may moi - verify prerequisites (chay 1 lan)
- **Double-click `scripts/SETUP-MAY-MOI.bat`** (Phase 77, MOI): 1-click bootstrap may trang. Cai winget: Git, gh, Node LTS, Rust, VS Build Tools, WebView2, VS Code + npm globals: firebase-tools, vercel + auto auth (gh/firebase/vercel) + clone repo + pnpm install. Mat 25-60 phut. Dung khi chuyen sang may co quan / may moi hoan toan.

## Cau truc 4 app desktop (Phase 65-77 - 2026-05-25 - sau full polish)

**TrishUtilities** la app dang polish nhat hien tai, 5 module deu da hoan thanh:

| Module | Tab label | Status |
|---|---|---|
| Clean | Don dep | DiskHealthCard donut, pre-clean modal, scan progress realtime |
| Check | Kiem tra may | Health Score donut, Live monitor 2s, MinSpec compare, Speed Test, GPU VRAM dung registry |
| Drive | **Downloader** (rename tu "Cloud") | 4 sub-tab: Tai file / Tai video MXH / Google Drive (NEW) / Thu vien |
| Font | Font | Empty states polish |
| Shortcut | Shortcut | Dashboard widget, sidebar nhom + workspace |

Cac tinh nang noi bat moi (Phase 65-77):
- **Google Drive bulk downloader**: paste folder URL → scrape embeddedfolderview HTML → tai trang tiep qua drive.usercontent (KHONG dung yt-dlp). Hien progress per file qua event `gdrive:progress`.
- **Network speed test**: Cloudflare /__down + /__up + 5 ping → MBps download/upload/jitter/latency.
- **Lazy-load module**: `React.lazy()` + keep-mounted (display:contents/none) → tab switching instant lan 2+.
- **MinSpec admin**: nut "+ Them phan mem" cho admin, luu localStorage `trishcheck:custom-specs:v1`.

## Quy uoc code

- TypeScript `strict: true`, `noUncheckedIndexedAccess: true`. Khong unsafe `any`.
- Vietnamese comment + UI text. Class names lowercase-kebab.
- CSS scoped via `:root[data-app="<id>"]` selector trong `packages/design-system/src/app-overlay.css` (~5900 dong).
- Module dat ten chuc nang (Clean/Check/Drive/Font/Shortcut), khong bao gom "Trish" prefix trong code (chi label UI).
- Tauri commands snake_case → Tauri auto-convert sang camelCase cho TS invoke.
- Khong de "text vo hon" — moi empty state phai co icon + heading + sub + action neu co the.
