# TrishTEAM — Design Brief

> **Đã merge vào [design-spec.md](./design-spec.md) (v2.0 — Phase 13.6, 2026-04-23).**
>
> File này trước đây là "agent brief rút gọn" theo format `awesome-claude-design`
> 9 mục. Phase 13.6 đã hợp nhất vào `design-spec.md` thành **1 source of truth duy nhất**
> cho cả designer + AI agents (Claude Code, Copilot, Cursor), tránh drift giữa 2 file.
>
> **Khi sinh UI mới, agent đọc:**
> 1. `design/tokens.v2.json` — source of truth về palette + typography.
> 2. `docs/design-spec.md` §10 "Agent prompt guide" — quy tắc dùng token, widget, icon.
> 3. `shared/trishteam_core/widgets/` — API reference các widget có sẵn.
>
> File `DESIGN.md` giữ lại làm pointer (backward compat cho link cũ) — có thể xoá
> ở Phase ≥14 nếu không còn link nào ref tới.

---

**Changelog**
- `v0.2` (2026-04-23) — Phase 13.6. Merge nội dung vào `design-spec.md` v2. File này rút gọn thành pointer.
- `v0.1` (2026-04-23) — Initial brief rút gọn cho agents, format `awesome-claude-design` 9 mục.
