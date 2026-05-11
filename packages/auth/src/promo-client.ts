/**
 * promo-client.ts — Phase 38.8.
 *
 * Client helper cho /api/promo/activate. Dùng trong TierGate form +
 * Website dashboard. Cần Firebase ID token của user đang login.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const API_BASE =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ((globalThis as any).process?.env?.NEXT_PUBLIC_API_BASE as string | undefined) ||
  'https://www.trishteam.io.vn';

export interface PromoActivateResult {
  ok: true;
  role: 'demo';
  demo_expires_at: number;
  duration_days: number;
  note: string;
}

export interface PromoActivateError {
  ok: false;
  error: string;
  message: string;
}

const ERROR_MESSAGES: Record<string, string> = {
  missing_token: 'Chưa đăng nhập — vui lòng đăng nhập lại.',
  invalid_token: 'Phiên đăng nhập hết hạn — vui lòng đăng nhập lại.',
  missing_code: 'Vui lòng nhập mã.',
  invalid_format: 'Mã không hợp lệ (4-32 ký tự, chỉ chữ và số).',
  invalid_code: 'Mã không tồn tại.',
  inactive: 'Mã đã bị tạm ngưng.',
  expired: 'Mã đã hết hạn.',
  quota_reached: 'Mã đã đủ số lượt kích hoạt.',
  already_used: 'Bạn đã dùng mã này rồi.',
  role_blocked:
    'Tài khoản đã là User hoặc Admin — không cần dùng mã khuyến mãi.',
  demo_still_longer:
    'Bản demo hiện tại của bạn còn dài hơn mã này — không cần kích hoạt.',
  user_not_found: 'Tài khoản chưa được khởi tạo trên hệ thống.',
  unsupported_action: 'Loại mã không được hỗ trợ.',
  invalid_duration: 'Cấu hình mã không hợp lệ — báo admin.',
};

function friendlyMessage(code: string): string {
  return ERROR_MESSAGES[code] ?? `Lỗi: ${code}`;
}

/**
 * Submit promo code lên backend. Trả ok=true với thông tin demo,
 * ok=false với error code + friendly message tiếng Việt.
 */
export async function activatePromoCode(
  rawCode: string,
  idToken: string,
): Promise<PromoActivateResult | PromoActivateError> {
  const code = rawCode.trim().toUpperCase().replace(/[\s-]/g, '');
  if (!code) {
    return { ok: false, error: 'missing_code', message: friendlyMessage('missing_code') };
  }
  try {
    const res = await fetch(`${API_BASE}/api/promo/activate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code }),
    });
    let body: { ok?: boolean; error?: string; role?: string; demo_expires_at?: number; duration_days?: number; note?: string } = {};
    try {
      body = await res.json();
    } catch {
      /* ignore */
    }
    if (res.ok && body.ok && body.role === 'demo') {
      return {
        ok: true,
        role: 'demo',
        demo_expires_at: body.demo_expires_at ?? 0,
        duration_days: body.duration_days ?? 0,
        note: body.note ?? '',
      };
    }
    const errCode = body.error ?? `http_${res.status}`;
    return {
      ok: false,
      error: errCode,
      message: friendlyMessage(errCode),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      error: 'network_error',
      message: `Lỗi mạng: ${msg}`,
    };
  }
}
