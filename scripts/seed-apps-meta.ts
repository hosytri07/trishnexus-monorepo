/**
 * Phase 39.2 — DEPRECATED.
 *
 * Script này đã được thay bằng API endpoint /api/admin/seed-apps-meta để
 * tránh phải cài firebase-admin riêng ở root workspace.
 *
 * Cách mới — gọi qua HTTP với admin ID token:
 *
 *   1. Login admin: https://trishteam.io.vn/login
 *   2. Mở DevTools console, lấy ID token:
 *        await firebase.auth().currentUser.getIdToken()
 *      Hoặc dễ hơn: vào /profile, paste vào console:
 *        firebase.auth().currentUser.getIdToken().then(t => navigator.clipboard.writeText(t))
 *
 *   3. Trigger:
 *      curl.exe -X POST https://trishteam.io.vn/api/admin/seed-apps-meta `
 *        -H "Authorization: Bearer <ID_TOKEN>"
 *
 *   4. Response: { ok: true, added, updated, skipped, log: [...] }
 *
 * → Trí có thể xóa file này nếu muốn (để stub vì sandbox không có quyền xóa).
 */
console.log('DEPRECATED — dùng /api/admin/seed-apps-meta thay thế. Xem comment.');
export {};
