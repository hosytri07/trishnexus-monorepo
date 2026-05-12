/**
 * lib/email-sender.ts — Phase 39 email notification.
 *
 * Wrapper quanh Resend API. Centralized error handling + fallback log.
 * Env: RESEND_API_KEY (required), RESEND_FROM (default noreply@trishteam.io.vn).
 */
import 'server-only';
import { Resend } from 'resend';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM = process.env.RESEND_FROM || 'TrishTEAM <noreply@trishteam.io.vn>';

let _client: Resend | null = null;

function getClient(): Resend | null {
  if (!RESEND_API_KEY) {
    console.warn('[email-sender] RESEND_API_KEY missing — skipping email');
    return null;
  }
  if (!_client) {
    _client = new Resend(RESEND_API_KEY);
  }
  return _client;
}

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  /** Optional plain text fallback */
  text?: string;
  /** Optional override From (else uses RESEND_FROM) */
  from?: string;
}

export interface SendEmailResult {
  ok: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Gửi 1 email. Trả ok=true với messageId nếu thành công, ok=false với error string nếu fail.
 * KHÔNG throw — caller dùng result.ok để biết.
 */
export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const client = getClient();
  if (!client) {
    return { ok: false, error: 'RESEND_API_KEY not configured' };
  }
  try {
    const res = await client.emails.send({
      from: params.from ?? RESEND_FROM,
      to: params.to,
      subject: params.subject,
      html: params.html,
      ...(params.text ? { text: params.text } : {}),
    });
    if (res.error) {
      console.error('[email-sender] Resend error:', res.error);
      return { ok: false, error: res.error.message ?? String(res.error) };
    }
    return { ok: true, messageId: res.data?.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[email-sender] throw:', msg);
    return { ok: false, error: msg };
  }
}

/** Best-effort: gửi nhưng không block flow nếu fail. */
export function sendEmailFireAndForget(params: SendEmailParams): void {
  void sendEmail(params).catch((err) => {
    console.warn('[email-sender] fire-and-forget fail:', err);
  });
}
