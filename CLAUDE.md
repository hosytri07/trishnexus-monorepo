# CLAUDE.md — TrishNexus Project Context

**Đọc ngay khi session bắt đầu.** File này là entry point cho Claude làm việc trên repo này.

## Context ngắn

- **User**: Trí (hosytri77 / hosytri77@gmail.com / trishteam.official@gmail.com), kỹ sư hạ tầng giao thông Đà Nẵng, không phải developer. Giao tiếp tiếng Việt, ngắn gọn, tránh jargon.
- **Workspace**: Monorepo tại `C:\Users\ADMIN\Documents\Claude\Projects\TrishTEAM\trishnexus-monorepo` (CẢ máy nhà và máy cơ quan đều dùng user `ADMIN`, cùng path). Đồng bộ qua GitHub.
- **GitHub**: `hosytri07/trishnexus-monorepo`
- **Website live**: trishteam-website (Vercel), domain chính thức `trishteam.io.vn` (mua TenTen, chưa cấu hình)

## Quy ước quan trọng

1. **Luôn đọc `docs/HANDOFF-MASTER.md`** khi session mới bắt đầu để biết đang làm đến đâu. File đó là "nhật ký progress" chia sẻ giữa 2 máy. Chỉ đọc section `📍 PHIÊN HIỆN TẠI` trên cùng — phần dưới là archive.
2. **Luôn cập nhật `docs/HANDOFF-MASTER.md`** trước khi session kết thúc — nếu không, máy bên kia sẽ làm trùng.
3. **User gõ `tiếp tục`** = đọc handoff + pick up. Không hỏi dài dòng.
4. **User gõ `chốt` / `xong rồi` / `để mai` / `bấm END.bat`** = update handoff TRƯỚC khi chào.

## Cấu trúc monorepo (nhanh)

```
trishnexus-monorepo/
├── CLAUDE.md                    ← file này
├── docs/HANDOFF-MASTER.md       ← trạng thái hiện tại, luôn đọc/update
├── design/tokens.json           ← nguồn sự thật design tokens
├── scripts/                     ← gen-tokens.js + START/END/SETUP.bat
├── shared/trishteam_core/       ← Python package chung cho mọi app
├── apps/
│   ├── trishdesign/             ← app đầu tiên (done scaffold)
│   └── trishfont/               ← app đang refactor (curated folder scan)
└── website/                     ← TrishTeam Website (HTML)
```

## Tools user có sẵn

- **Double-click `scripts/START.bat`**: pull code, chuẩn bị môi trường (bấm mỗi sáng)
- **Double-click `scripts/END.bat`**: commit + push tự động, nhắc eject USB (bấm mỗi tối)
- **Double-click `scripts/SETUP.bat`**: setup máy mới (ch�