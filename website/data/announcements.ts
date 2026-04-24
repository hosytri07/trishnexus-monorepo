/**
 * Admin announcements — thanh thông báo hiển thị đầu trang.
 *
 * Nguồn dữ liệu: static TS array (commit để publish). Sau này có thể move sang
 * Firestore collection `announcements` với cùng schema — widget chỉ cần đổi data source.
 *
 * Quy tắc hiển thị:
 *   - Chỉ show announcement active: hiện tại ∈ [starts_at, expires_at].
 *   - Nếu audience='users' → chỉ hiện khi user đã login (chưa implement auth → skip).
 *   - User bấm X → id được lưu `localStorage.trishteam:dismissed` → không hiện lại.
 *   - Ưu tiên theo order: critical > warning > info > success.
 */

export type AnnouncementSeverity = 'info' | 'success' | 'warning' | 'critical';
export type AnnouncementAudience = 'all' | 'users' | 'guests';

export type Announcement = {
  id: string;
  severity: AnnouncementSeverity;
  title: string;
  body?: string;
  link?: { label: string; href: string };
  audience: AnnouncementAudience;
  /** ISO 8601 — nếu thiếu, active ngay */
  starts_at?: string;
  /** ISO 8601 — nếu thiếu, không expire */
  expires_at?: string;
  dismissible?: boolean;
};

export const ANNOUNCEMENTS: Announcement[] = [
  {
    id: 'v11-3-launch',
    severity: 'success',
    title: '🎉 TrishTEAM vừa cập nhật Phase 11.3',
    body:
      'Thêm widget Pomodoro, Máy tính tài chính, Lịch công tác, Tỷ giá ngoại tệ, form Góp ý qua Telegram và mục Liên hệ tác giả.',
    link: { label: 'Gửi góp ý', href: '#feedback' },
    audience: 'all',
    starts_at: '2026-04-20T00:00:00Z',
    expires_at: '2026-05-15T00:00:00Z',
    dismissible: true,
  },
  // Thêm announcement mới tại đây — commit + deploy là xong.
];
