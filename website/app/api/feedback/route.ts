/**
 * /api/feedback — nhận góp ý user, forward sang Telegram bot.
 *
 * Input: multipart/form-data với fields:
 *   - name (string, required)
 *   - email (string, optional but recommended)
 *   - message (string, required, 5-4000 chars)
 *   - file (File, optional, <= 10 MB)
 *
 * Output: { ok: true } hoặc { ok: false, error: string }
 *
 * Bảo mật:
 *   - Env vars TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID (server-only).
 *   - Rate-limit mềm: mỗi IP 5 req / phút (in-memory, reset khi serverless warm/cold).
 *   - Không log email/token ra console.
 *   - Escape HTML khi build message Telegram.
 */
import { NextRequest } from 'next/server';

export const runtime = 'nodejs'; // Cần Node.js runtime để gửi file đa phần

const MAX_MESSAGE_LEN = 4000;
const MIN_MESSAGE_LEN = 5;
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX = 5;

// In-memory rate bucket (fine for single-process dev; serverless cold-starts reset).
const rateMap = new Map<string, { count: number; reset: number }>();

function checkRate(ip: string): boolean {
  const now = Date.now();
  const cur = rateMap.get(ip);
  if (!cur || cur.reset < now) {
    rateMap.set(ip, { count: 1, reset: now + RATE_WINDOW_MS });
    return true;
  }
  if (cur.count >= RATE_MAX) return false;
  cur.count += 1;
  return true;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function getIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  const real = req.headers.get('x-real-ip');
  if (real) return real.trim();
  return 'unknown';
}

async function tgSendMessage(text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) throw new Error('missing_telegram_env');

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`telegram_send_message_${res.status}_${body.slice(0, 120)}`);
  }
}

async function tgSendDocument(file: File, caption: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) throw new Error('missing_telegram_env');

  const fd = new FormData();
  fd.append('chat_id', chatId);
  fd.append('caption', caption);
  fd.append('parse_mode', 'HTML');
  fd.append('document', file, file.name || 'attachment');

  const res = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
    method: 'POST',
    body: fd,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`telegram_send_document_${res.status}_${body.slice(0, 120)}`);
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const ip = getIp(req);
    if (!checkRate(ip)) {
      return Response.json(
        { ok: false, error: 'Quá nhiều yêu cầu, vui lòng thử lại sau.' },
        { status: 429 }
      );
    }

    const ct = req.headers.get('content-type') ?? '';
    if (!ct.includes('multipart/form-data')) {
      return Response.json(
        { ok: false, error: 'invalid_content_type' },
        { status: 400 }
      );
    }

    const form = await req.formData();
    const name = String(form.get('name') ?? '').trim();
    const email = String(form.get('email') ?? '').trim();
    const message = String(form.get('message') ?? '').trim();
    const fileEntry = form.get('file');
    const file = fileEntry instanceof File && fileEntry.size > 0 ? fileEntry : null;

    if (!name || name.length > 120) {
      return Response.json(
        { ok: false, error: 'Tên không hợp lệ (1-120 ký tự).' },
        { status: 400 }
      );
    }
    if (email && (email.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
      return Response.json(
        { ok: false, error: 'Email không hợp lệ.' },
        { status: 400 }
      );
    }
    if (
      !message ||
      message.length < MIN_MESSAGE_LEN ||
      message.length > MAX_MESSAGE_LEN
    ) {
      return Response.json(
        {
          ok: false,
          error: `Nội dung góp ý phải dài ${MIN_MESSAGE_LEN}-${MAX_MESSAGE_LEN} ký tự.`,
        },
        { status: 400 }
      );
    }
    if (file && file.size > MAX_FILE_BYTES) {
      return Response.json(
        { ok: false, error: 'File đính kèm phải ≤ 10 MB.' },
        { status: 400 }
      );
    }

    const header =
      `<b>📨 Góp ý mới — TrishTEAM Website</b>\n` +
      `<b>Tên:</b> ${escapeHtml(name)}\n` +
      (email ? `<b>Email:</b> ${escapeHtml(email)}\n` : '<i>Email: (không cung cấp)</i>\n') +
      `<b>IP:</b> <code>${escapeHtml(ip)}</code>\n` +
      `<b>Lúc:</b> <code>${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</code>\n\n`;

    const fullText = header + escapeHtml(message);

    if (file) {
      // Caption Telegram giới hạn 1024 ký tự → gửi message riêng + document riêng
      const short =
        fullText.length <= 1000
          ? fullText
          : header + escapeHtml(message.slice(0, 900)) + '…';
      await tgSendDocument(file, short);
      if (fullText.length > 1000) {
        await tgSendMessage(fullText);
      }
    } else {
      await tgSendMessage(fullText);
    }

    return Response.json({ ok: true });
  } catch (err) {
    // Không leak env error vào user — chỉ ghi server side.
    // eslint-disable-next-line no-console
    console.error('[feedback] failed:', err);
    return Response.json(
      { ok: false, error: 'Không gửi được, vui lòng thử lại sau.' },
      { status: 500 }
    );
  }
}
