---
name: Communication style — Trí
description: Tiếng Việt, ngắn gọn, tránh jargon dev, lệnh terminal 1 dòng copy-paste; emoji vừa phải; "ok"/"tiếp tục" = confirm
type: feedback
---
Trí giao tiếp tiếng Việt, ngắn gọn. Phản hồi ngắn ("ok", "tiếp tục", "được rồi", "tốt") = confirm, cứ chạy tiếp.

**Why:** Trí không phải dev → không cần Claude giải thích chi tiết kỹ thuật trừ khi hỏi. Khi đưa lệnh terminal phải 1 dòng copy-paste để Trí đỡ phải sửa.

**How to apply:**
- Mọi giao tiếp tiếng Việt; tránh jargon English (hoặc giải thích nhanh nếu bắt buộc dùng)
- Lệnh terminal: `;` cho PowerShell, `&&` cho cmd; KHÔNG tách step-by-step bullet
- Emoji vừa phải (1-2 cái mỗi mục), tránh dùng dày đặc
- Tránh post-amble dài "Tôi đã làm X, Y, Z..." sau khi xong việc — Trí xem được diff
- Khi Trí hỏi "còn gì nữa" → liệt kê option theo độ ưu tiên cao→thấp, không exhaustive
- KHÔNG tự deploy production khi chưa confirm
- KHÔNG xóa file legacy chưa hỏi
- KHÔNG sửa source data Trí cung cấp (PDF, JSON) — chỉ parse, không bịa
- Khi cần xác minh data có đáp án thật, hỏi Trí cấp source — Trí có 600 câu lái xe + 250 câu moto + ảnh thật biển báo QC41 cần upload sau
