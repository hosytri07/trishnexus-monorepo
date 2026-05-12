/**
 * lib/email-templates.ts — Phase 39 email notification.
 *
 * HTML email templates với design-system TrishTEAM:
 * Plus Jakarta Sans + emerald primary + radius 14px.
 *
 * Templates:
 * - roleChangeEmail()    — admin đổi role user
 * - demoExpiringEmail()  — demo còn ≤ 7 ngày (cron daily)
 * - demoActivatedEmail() — user dùng promo/key thành công
 */

const WEBSITE_URL = 'https://trishteam.io.vn';
const BRAND_COLOR = '#10B981'; // emerald-500
const BRAND_GRADIENT = 'linear-gradient(135deg, #10B981 0%, #059669 100%)';
const FONT_STACK = "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

function shell(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:${FONT_STACK};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border-radius:14px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.05);">
          <tr>
            <td style="background:${BRAND_GRADIENT};padding:24px 28px;color:#FFFFFF;">
              <div style="font-size:13px;font-weight:600;letter-spacing:1px;text-transform:uppercase;opacity:0.85;">TrishTEAM</div>
              <h1 style="margin:6px 0 0 0;font-size:22px;font-weight:700;color:#FFFFFF;">${title}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;color:#374151;font-size:15px;line-height:1.6;">
              ${body}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 28px;background:#F9FAFB;border-top:1px solid #E5E7EB;color:#9CA3AF;font-size:12px;line-height:1.5;text-align:center;">
              Đây là email tự động từ hệ thống TrishTEAM.<br>
              Liên hệ admin: <a href="mailto:hosytri77@gmail.com" style="color:${BRAND_COLOR};text-decoration:none;">hosytri77@gmail.com</a>
              &nbsp;•&nbsp;
              <a href="${WEBSITE_URL}" style="color:${BRAND_COLOR};text-decoration:none;">${WEBSITE_URL.replace('https://', '')}</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function ctaButton(label: string, href: string): string {
  return `<div style="margin:24px 0;text-align:center;">
    <a href="${href}" style="display:inline-block;padding:12px 28px;background:${BRAND_GRADIENT};color:#FFFFFF;text-decoration:none;border-radius:10px;font-weight:700;font-size:14px;">${label}</a>
  </div>`;
}

function infoBox(content: string, color: 'emerald' | 'amber' | 'rose' = 'emerald'): string {
  const styles = {
    emerald: { bg: '#ECFDF5', border: '#10B981', text: '#065F46' },
    amber: { bg: '#FFFBEB', border: '#F59E0B', text: '#92400E' },
    rose: { bg: '#FEF2F2', border: '#EF4444', text: '#991B1B' },
  }[color];
  return `<div style="margin:18px 0;padding:14px 16px;background:${styles.bg};border:1px solid ${styles.border};border-left:4px solid ${styles.border};border-radius:8px;color:${styles.text};font-size:14px;line-height:1.5;">${content}</div>`;
}

const ROLE_LABEL: Record<string, { label: string; emoji: string; desc: string }> = {
  trial: { label: 'Trial', emoji: '✨', desc: 'Chưa được kích hoạt — bị chặn truy cập app.' },
  demo: { label: 'Demo', emoji: '⏳', desc: 'Dùng thử có hạn — full access trong thời gian demo.' },
  user: { label: 'User', emoji: '✅', desc: 'Chính thức vĩnh viễn — full access các app TrishTEAM.' },
  admin: { label: 'Admin', emoji: '🛡', desc: 'Quản trị hệ thống — full access + admin tools.' },
};

// ──────────────────────────────────────────────────────────
// Role change email
// ──────────────────────────────────────────────────────────

export interface RoleChangeEmailParams {
  userEmail: string;
  userName?: string;
  newRole: 'trial' | 'demo' | 'user' | 'admin';
  oldRole?: string;
  demoExpiresAt?: number; // chỉ khi newRole='demo'
  demoDays?: number;
}

export function roleChangeEmail(params: RoleChangeEmailParams): {
  subject: string;
  html: string;
} {
  const role = ROLE_LABEL[params.newRole];
  const name = params.userName ?? params.userEmail;

  const isUpgrade = params.newRole === 'user' || params.newRole === 'admin' || params.newRole === 'demo';

  let detailsBox = '';
  if (params.newRole === 'demo' && params.demoExpiresAt) {
    const expiryDate = new Date(params.demoExpiresAt).toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    detailsBox = infoBox(
      `⏰ <strong>Hạn dùng thử:</strong> ${params.demoDays ?? '?'} ngày, hết hạn lúc <strong>${expiryDate}</strong>.<br>` +
        `Sau ngày này, tài khoản tự về trạng thái Trial (bị chặn). Liên hệ admin nếu cần gia hạn.`,
      'amber',
    );
  } else if (params.newRole === 'user') {
    detailsBox = infoBox(
      `🎉 <strong>Chúc mừng!</strong> Bạn đã được upgrade lên tài khoản User chính thức — quyền truy cập vĩnh viễn các app TrishTEAM (Library / Check / Clean / Font / Shortcut / Launcher).`,
      'emerald',
    );
  } else if (params.newRole === 'trial') {
    detailsBox = infoBox(
      `⚠ Tài khoản đã bị reset về Trial — sẽ bị chặn khi mở app. Nếu đây là nhầm lẫn, liên hệ admin để khôi phục.`,
      'rose',
    );
  }

  const body = `
    <p style="margin:0 0 12px 0;">Xin chào <strong>${name}</strong>,</p>
    <p style="margin:0 0 16px 0;">Tài khoản của bạn đã được cập nhật quyền truy cập:</p>
    <div style="margin:18px 0;padding:16px;background:#F9FAFB;border-radius:10px;text-align:center;">
      ${params.oldRole ? `<div style="font-size:13px;color:#9CA3AF;">${ROLE_LABEL[params.oldRole]?.emoji ?? '•'} ${ROLE_LABEL[params.oldRole]?.label ?? params.oldRole}</div>
      <div style="font-size:24px;color:#9CA3AF;margin:4px 0;">↓</div>` : ''}
      <div style="font-size:20px;font-weight:700;color:${BRAND_COLOR};">
        ${role.emoji} ${role.label}
      </div>
      <div style="font-size:13px;color:#6B7280;margin-top:6px;">${role.desc}</div>
    </div>
    ${detailsBox}
    ${
      isUpgrade
        ? ctaButton('🚀 Mở Dashboard', `${WEBSITE_URL}/dashboard`)
        : ctaButton('Liên hệ admin', 'mailto:hosytri77@gmail.com')
    }
    <p style="margin:16px 0 0 0;font-size:13px;color:#6B7280;">
      Bạn cần đăng nhập lại trên các app desktop để áp dụng quyền truy cập mới.
    </p>
  `;

  const subject =
    params.newRole === 'demo'
      ? `🎁 Tài khoản TrishTEAM đã được cấp Demo ${params.demoDays ?? ''} ngày`
      : params.newRole === 'user'
        ? `✅ Tài khoản TrishTEAM đã được upgrade lên User`
        : params.newRole === 'admin'
          ? `🛡 Tài khoản TrishTEAM đã được cấp quyền Admin`
          : `⚠ Tài khoản TrishTEAM đã bị reset về Trial`;

  return { subject, html: shell(subject, body) };
}

// ──────────────────────────────────────────────────────────
// Demo expiring email (cron daily)
// ──────────────────────────────────────────────────────────

export interface DemoExpiringEmailParams {
  userEmail: string;
  userName?: string;
  demoExpiresAt: number;
  daysLeft: number;
}

export function demoExpiringEmail(params: DemoExpiringEmailParams): {
  subject: string;
  html: string;
} {
  const name = params.userName ?? params.userEmail;
  const expiryDate = new Date(params.demoExpiresAt).toLocaleString('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const urgent = params.daysLeft <= 2;

  const body = `
    <p style="margin:0 0 12px 0;">Xin chào <strong>${name}</strong>,</p>
    <p style="margin:0 0 16px 0;">Bản dùng thử (Demo) của bạn sắp hết hạn:</p>
    <div style="margin:18px 0;padding:20px;background:${urgent ? '#FEF2F2' : '#FFFBEB'};border-radius:10px;text-align:center;border:2px solid ${urgent ? '#EF4444' : '#F59E0B'};">
      <div style="font-size:38px;font-weight:800;color:${urgent ? '#DC2626' : '#D97706'};line-height:1;">${params.daysLeft}</div>
      <div style="font-size:15px;font-weight:600;color:${urgent ? '#991B1B' : '#92400E'};margin-top:4px;">ngày còn lại</div>
      <div style="font-size:13px;color:${urgent ? '#991B1B' : '#92400E'};margin-top:10px;">Hết hạn: <strong>${expiryDate}</strong></div>
    </div>
    ${infoBox(
      `Sau khi hết hạn, tài khoản sẽ tự chuyển về Trial — bạn sẽ bị chặn truy cập các app TrishTEAM cho đến khi được admin upgrade lại.`,
      urgent ? 'rose' : 'amber',
    )}
    <p style="margin:16px 0 8px 0;font-weight:600;">Để gia hạn / upgrade lên User chính thức:</p>
    <ul style="margin:0 0 16px 0;padding-left:20px;color:#374151;font-size:14px;line-height:1.7;">
      <li>Liên hệ admin Trí qua email <a href="mailto:hosytri77@gmail.com" style="color:${BRAND_COLOR};">hosytri77@gmail.com</a></li>
      <li>Hoặc nhập mã khuyến mãi mới (nếu admin cấp) tại <a href="${WEBSITE_URL}/dashboard" style="color:${BRAND_COLOR};">/dashboard</a></li>
    </ul>
    ${ctaButton('Mở Dashboard', `${WEBSITE_URL}/dashboard`)}
  `;

  const subject = urgent
    ? `⏰ Demo TrishTEAM còn ${params.daysLeft} ngày — sắp hết hạn!`
    : `⏳ Demo TrishTEAM còn ${params.daysLeft} ngày`;

  return { subject, html: shell(subject, body) };
}

// ──────────────────────────────────────────────────────────
// Demo activated email (user dùng promo/key)
// ──────────────────────────────────────────────────────────

export interface DemoActivatedEmailParams {
  userEmail: string;
  userName?: string;
  source: 'promo' | 'key';
  sourceCode: string; // promo code hoặc 16-char key
  demoExpiresAt: number;
  durationDays: number;
}

export function demoActivatedEmail(params: DemoActivatedEmailParams): {
  subject: string;
  html: string;
} {
  const name = params.userName ?? params.userEmail;
  const expiryDate = new Date(params.demoExpiresAt).toLocaleString('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const sourceLabel = params.source === 'promo' ? 'mã khuyến mãi' : 'key kích hoạt';

  const body = `
    <p style="margin:0 0 12px 0;">Xin chào <strong>${name}</strong>,</p>
    <p style="margin:0 0 16px 0;">Bạn đã kích hoạt thành công ${sourceLabel} <code style="background:#F3F4F6;padding:2px 6px;border-radius:4px;font-family:monospace;">${params.sourceCode}</code>.</p>
    <div style="margin:18px 0;padding:20px;background:#ECFDF5;border-radius:10px;text-align:center;border:2px solid ${BRAND_COLOR};">
      <div style="font-size:38px;font-weight:800;color:${BRAND_COLOR};line-height:1;">${params.durationDays}</div>
      <div style="font-size:15px;font-weight:600;color:#065F46;margin-top:4px;">ngày dùng thử (Demo)</div>
      <div style="font-size:13px;color:#065F46;margin-top:10px;">Hết hạn: <strong>${expiryDate}</strong></div>
    </div>
    ${infoBox(
      `🎉 Bạn có thể mở khóa và sử dụng tất cả app TrishTEAM (TrishLibrary, TrishCheck, TrishClean, TrishFont, TrishShortcut, TrishLauncher) trong thời gian này.`,
      'emerald',
    )}
    ${ctaButton('🚀 Mở Dashboard', `${WEBSITE_URL}/dashboard`)}
    <p style="margin:16px 0 0 0;font-size:13px;color:#6B7280;">
      <strong>Lưu ý:</strong> Mỗi mã chỉ dùng được 1 lần / tài khoản. Trước ngày hết hạn 7 ngày, bạn sẽ nhận email nhắc gia hạn.
    </p>
  `;

  const subject = `✅ Đã kích hoạt Demo TrishTEAM (${params.durationDays} ngày)`;
  return { subject, html: shell(subject, body) };
}
