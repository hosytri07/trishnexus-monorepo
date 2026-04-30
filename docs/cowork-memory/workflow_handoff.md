---
name: Workflow handoff TrishTEAM
description: Quy trình đọc/cập nhật HANDOFF-MASTER.md đầu+cuối phiên — file duy nhất tracking tiến trình dự án TrishTEAM monorepo
type: feedback
---
Đầu mọi phiên TrishTEAM: đọc `docs/HANDOFF-MASTER.md` trước khi làm gì khác. File chứa toàn bộ context dự án + tình trạng cuối phiên trước + việc tiếp.

**Why:** Trí làm việc luân phiên 2 máy (nhà + cơ quan) qua GitHub. Nếu Claude không đọc handoff thì làm trùng việc / mất context, đặc biệt khi chuyển phase. File handoff cũ (HANDOFF-WEBSITE-PHASE-19, HANDOFF-TRISHLIBRARY-3.0, SESSION-HANDOFF) đã gộp vào MASTER.

**How to apply:**
- Trí gõ "tiếp tục" / "pick up" / "đọc handoff" → đọc HANDOFF-MASTER trước
- Tóm tắt 2-3 dòng "đang ở đâu" rồi propose action
- Cuối phiên: update section "PICK UP TỪ ĐÂY" + mark phase done + ghi pick-up cho phiên kế
- Trước khi Trí bấm `END.bat` ở root project
