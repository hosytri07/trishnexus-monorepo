# Cowork Memory Sync

Folder này chứa **bản backup memory của Cowork (Claude Desktop)** để chuyển giữa máy nhà ↔ máy cơ quan qua git.

## Cách dùng

### Khi commit từ máy A → máy B

Memory tự động được Cowork lưu tại path local:
```
%APPDATA%\Claude\local-agent-mode-sessions\{a}\{b}\spaces\{c}\memory\
```

Path này có random UUID per session, KHÔNG sync được tự động giữa 2 máy.

**Workflow đề xuất:**

1. **Cuối phiên** trên máy A — bảo Claude:
   > "Copy toàn bộ memory hiện tại vào `docs/cowork-memory/`, ghi đè files cũ. Commit + push."

2. **Đầu phiên** trên máy B — sau khi `START.bat` pull code, bảo Claude:
   > "Đọc tất cả `*.md` trong `docs/cowork-memory/` và rebuild memory cho session này (skip MEMORY.md, đọc nội dung 7 file khác và lưu vào memory folder của session)."

   Claude sẽ đọc 7 file rồi tự `Write` vào folder memory của session mới.

### Files trong folder này

- `MEMORY.md` — index (không phải memory thật, chỉ pointer)
- `user_profile.md` — Trí: kỹ sư hạ tầng GT Đà Nẵng
- `workflow_handoff.md` — quy trình đọc HANDOFF-MASTER đầu/cuối phiên
- `project_context.md` — TrishTEAM monorepo architecture
- `communication_style.md` — tiếng Việt ngắn gọn, lệnh 1 dòng
- `trishadmin_private.md` — TrishAdmin không push GitHub Release
- `design_system_standard.md` — TrishDrive làm gold standard UI/UX
- `phase_24_plan.md` — TrishDrive admin-only + TrishLibrary public view

## Note về bảo mật

Repo `trishnexus-monorepo` là **private**. Memory chứa thông tin nội bộ (cá nhân Trí, design decisions, admin restrictions). Nếu sau này Trí muốn open-source, cần `.gitignore` folder này hoặc move ra repo private khác.
