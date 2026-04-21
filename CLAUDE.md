# CLAUDE.md — TrishNexus Project Context

**Đọc ngay khi session bắt đầu.** File này là entry point cho Claude làm việc trên repo này.

## Context ngắn

- **User**: Trí (hosytri07 / hosytri77@gmail.com), không phải developer. Giao tiếp tiếng Việt, ngắn gọn, tránh jargon.
- **Workspace**: Monorepo trên USB tại `G:\4. Code\TrishNexus-New\trishnexus-monorepo`. User làm việc luân phiên giữa máy nhà và máy cơ quan.
- **GitHub**: `hosytri07/trishnexus-monorepo`
- **Website live**: trishteam-website (Vercel), domain chính thức `trishteam.io.vn` (mua TenTen, chưa cấu hình)

## Quy ước quan trọng

1. **Luôn đọc `docs/SESSION-HANDOFF.md`** khi session mới bắt đầu để biết đang làm đến đâu. File đó là "nhật ký progress" chia sẻ giữa 2 máy.
2. **Luôn cập nhật `docs/SESSION-HANDOFF.md`** trước khi session kết thúc — nếu không, máy bên kia sẽ làm trùng.
3. **User gõ `tiếp tục`** = đọc handoff + pick up. Không hỏi dài dòng.
4. **User gõ `chốt` / `xong rồi` / `để mai` / `bấm END.bat`** = update handoff TRƯỚC khi chào.

## Cấu trúc monorepo (nhanh)

```
trishnexus-monorepo/
├── CLAUDE.md                    ← file này
├── docs/SESSION-HANDOFF.md      ← trạng thái hiện tại, luôn đọc/update
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
- **Double-click `scripts/SETUP.bat`**: setup máy mới (chạy 1 lần per máy)

## Chi tiết công việc

Xem **`docs/SESSION-HANDOFF.md`** — có đầy đủ: trạng thái, task đang dở, kế hoạch tiếp theo, API của trishteam_core, user preferences.
