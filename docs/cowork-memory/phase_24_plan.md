---
name: Phase 24 plan — TrishDrive admin-only + TrishLibrary public view
description: "Re-architecture lớn: TrishDrive thành admin tool trong TrishAdmin, user truy cập file qua TrishLibrary 'Thư viện TrishTEAM' tab. Chốt 4 default."
type: project
---

Trí (2026-04-30) confirm direction Phase 24:

**TrishDrive admin-only**: User Telegram setup quá lằng ngoằng (Bot token + api_id/hash MTProto). Trí muốn TrishDrive chỉ admin (Trí) dùng để upload/manage. User thường chỉ xem + tải.

**Why:** UX cho user thường không khả thi nếu phải tự đăng ký Bot Telegram. Admin upload, user tải.

**How to apply (Phase 24 sub-phases):**

**24.1** — Move TrishDrive vào TrishAdmin:
- Copy `apps-desktop/trishdrive/src-tauri/src/{mtproto,creds,db,crypto,telegram}.rs` vào TrishAdmin
- Copy `apps-desktop/trishdrive/src/pages/*.tsx` thành panel mới trong TrishAdmin
- TrishAdmin nav thêm tab "TrishDrive" với toàn bộ chức năng
- TrishDrive standalone (`apps-desktop/trishdrive/`) GIỮ codebase (Trí confirm "Ok" khi mình đề xuất giữ để rollback dễ), chỉ remove khỏi `apps-registry.json` public release

**24.2** — TrishLibrary thêm tab "Thư viện TrishTEAM":
- Read Firestore `/trishdrive/_/shares` lọc `is_public == true`
- Filter theo folder Trí đã đặt (reuse folder structure trong TrishDrive)
- Click file → mở browser tới link `trishteam.io.vn/s/{code}#k={key}` (no-password share, auto-tải)
- KHÔNG cần download trực tiếp trong app — mở browser là OK

**24.3** — Design system unification:
- Tạo workspace package `@trishteam/design-system`
- Extract CSS vars + components từ TrishDrive
- Apply: TrishLauncher, TrishAdmin, TrishLibrary, TrishFont, TrishCheck, TrishClean, audit lại TrishISO + TrishFinance
- Long-running, làm dần qua nhiều session

**4 chốt default từ Trí (2026-04-30):**

1. ✅ **Public/private toggle** trong ShareModal: checkbox "Hiện trong Thư viện TrishTEAM" mặc định OFF (private). Trí muốn quyết file nào hiện public.
2. ✅ **Filter theo folder** Trí đã tạo trong TrishDrive (App / Tài liệu / Form / Dự án X).
3. ✅ **TrishDrive standalone giữ codebase**, chỉ ngừng public release.
4. ✅ **Design system rebuild theo TrishDrive là gold standard** — xem feedback memory `design_system_standard.md`.

**Side note**: Share link cho file MTProto vẫn block tới khi web /proxy implement `bot.forwardMessage` workaround (channel→bot's chat → getFile). Phase 24+ làm nếu cần.
