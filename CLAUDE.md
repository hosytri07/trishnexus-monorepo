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
- **Double-click `scripts/SETUP.bat`**: setup may moi (chay 1 lan)
