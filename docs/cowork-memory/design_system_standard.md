---
name: Design system standard — TrishDrive làm chuẩn
description: "Toàn bộ desktop app TrishTEAM phải đồng bộ giao diện theo TrishDrive: theme, font, UI/UX, effects. Trí nhấn mạnh CỰC KỲ QUAN TRỌNG."
type: feedback
---

TrishDrive (apps-desktop/trishdrive) là **gold standard** UI/UX cho toàn bộ ecosystem TrishTEAM. Mọi app khác phải rebuild giao diện theo nó.

**Why:** Trí trực tiếp nói (2026-04-30, lúc gần kết thúc Phase 23): "TrishDrive hiện tại đang có theme, font, UI, UX, cơ chế effect rất đẹp và tôi muốn áp dụng toàn bộ tương đương với các app khác. Sẽ rebuild lại các app đã xong giống app này." Trí nhấn mạnh "QUAN TRỌNG CỰC KỲ" và "phải nhớ".

**How to apply:**

Khi rebuild bất kỳ app desktop nào (TrishLauncher, TrishLibrary, TrishAdmin, TrishFont, TrishCheck, TrishClean, TrishISO, TrishFinance), copy y nguyên các pattern sau từ TrishDrive:

1. **Font**: Plus Jakarta Sans, base 13px, max font-weight 600 (KHÔNG dùng 700+).
2. **Color tokens** (từ apps-desktop/trishdrive/src/theme.css hoặc index.css):
   - Accent: emerald `#10B981` / `#4ADE80` (gradient)
   - Background warm-tone neutral: cream/black layered
   - `var(--color-accent-primary)`, `var(--color-accent-soft)`, `var(--color-accent-gradient)`
   - `var(--color-surface-card)`, `var(--color-surface-row)`, `var(--color-surface-muted)`
   - `var(--color-border-default)`, `var(--color-border-subtle)`
   - `var(--color-text-primary)`, `var(--color-text-secondary)`, `var(--color-text-muted)`, `var(--color-text-link)`
3. **Border radius**: 14px cards, 10-12px panels, 6-8px buttons, 4px badges.
4. **Layout pattern**:
   - Sidebar 240px với logo top + nav items + user info bottom
   - Main content max-width 3xl (~640px) khi single column, full width khi table
   - Card pattern: `<div className="card">` + `<div className="card-header">` + `<h2 className="card-title">` + `<p className="card-subtitle">`
5. **Effect/animation**:
   - Hover state với subtle background change (var(--color-surface-row) → muted)
   - Transition 250ms ease-out
   - Progress bar gradient + animated width
   - Badge pill rounded-full với background-soft
6. **Component idioms**:
   - Buttons: `.btn-primary` (gradient bg + white text) vs `.btn-secondary` (border + transparent bg)
   - Inputs: `.input-field` consistent padding/border/radius
   - Stats: `<Stat label="..." value="..." hint="..." />` 3-line grid
   - Modal: backdrop blur + center card + ✕ icon top-right
7. **Logo**: dual version — taskbar transparent + UI white bg wrapper (vì logo Trí thường có background white intrinsic).
8. **Dark mode toggle**: light/dark CSS vars, persist localStorage.

**Phase 24.3 plan**: Tạo workspace package `@trishteam/design-system` extract toàn bộ từ TrishDrive → apply lần lượt sang 7+ app khác. TrishISO + TrishFinance đã có 1 phần (Phase 22.2) nhưng vẫn cần audit + đồng bộ lại theo TrishDrive chuẩn mới (post Phase 22.4-23.7).

**Khi nào áp dụng**: BẤT KỲ app nào Trí nhờ chỉnh UI/rebuild → mặc định pattern TrishDrive. Đừng tự ý dùng theme khác. Nếu user nói "theme khác" → hỏi rõ trước khi tự sáng tạo.
