/**
 * POST /api/drive/share/{token}/proxy — Phase 22.7b + Phase 26.0
 *
 * Server proxy bytes từ Telegram. Hỗ trợ 2 pipeline:
 *
 * 1. Bot API (`pipeline: 'botapi'`, default):
 *    Body: { bot_token, tg_file_id, is_first_chunk? }
 *    Flow: bot.getFile(tg_file_id) → file_path → CDN download → return bytes
 *
 * 2. MTProto (`pipeline: 'mtproto'`, Phase 26.0):
 *    Body: { bot_token, tg_message_id, channel_id, is_first_chunk? }
 *    Flow:
 *      - bot.forwardMessage(from=channel_id, to=LOG_CHANNEL_ID, message_id=tg_message_id)
 *        → response Message có document.file_id (Bot API format)
 *      - bot.getFile(file_id) → file_path → CDN download → bytes
 *      - bot.deleteMessage(LOG_CHANNEL_ID, forwarded.message_id) cleanup
 *
 * LOG_CHANNEL_ID: env var `TRISHDRIVE_LOG_CHANNEL_ID` — admin tạo private channel
 * trống + add bot làm admin để bot có quyền post forwarded message.
 *
 * Server in-memory dùng bot_token (decrypted client-side bằng password share),
 * không lưu — vẫn zero-knowledge.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { adminDb, adminReady } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export const runtime = 'nodejs';

interface ProxyBody {
  bot_token: string;
  pipeline?: 'botapi' | 'mtproto';
  // Bot API fields
  tg_file_id?: string;
  // MTProto fields (Phase 26.0)
  tg_message_id?: number;
  channel_id?: number;
  is_first_chunk?: boolean;
}

interface TgMessage {
  message_id: number;
  document?: { file_id: string; file_unique_id: string; file_name?: string; file_size?: number };
  video?: { file_id: string };
  photo?: Array<{ file_id: string }>;
}

interface TgApiResponse<T> {
  ok: boolean;
  description?: string;
  result?: T;
}

const TG_API = 'https://api.telegram.org';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const body = (await req.json()) as ProxyBody;
    if (!body.bot_token) {
      return NextResponse.json({ error: 'Missing bot_token' }, { status: 400 });
    }

    const pipeline = body.pipeline ?? 'botapi';
    if (pipeline === 'botapi' && !body.tg_file_id) {
      return NextResponse.json({ error: 'Missing tg_file_id for Bot API pipeline' }, { status: 400 });
    }
    if (pipeline === 'mtproto' && (!body.tg_message_id || !body.channel_id)) {
      return NextResponse.json({ error: 'Missing tg_message_id / channel_id for MTProto pipeline' }, { status: 400 });
    }

    // ----- Verify share token (Firestore) -----
    if (!adminReady()) {
      return NextResponse.json({ error: 'Firebase Admin SDK chưa cấu hình' }, { status: 501 });
    }
    const db = adminDb();
    const ref = db.collection('trishdrive').doc('_').collection('shares').doc(token);
    const doc = await ref.get();
    if (!doc.exists) {
      return NextResponse.json({ error: 'Share không tồn tại' }, { status: 404 });
    }
    const data = doc.data() as Record<string, unknown>;
    if (data.revoked === true) {
      return NextResponse.json({ error: 'Share đã bị thu hồi' }, { status: 410 });
    }
    if (typeof data.expires_at === 'number' && data.expires_at < Date.now()) {
      return NextResponse.json({ error: 'Share đã hết hạn' }, { status: 410 });
    }
    if (typeof data.max_downloads === 'number' && typeof data.download_count === 'number'
        && data.download_count >= data.max_downloads) {
      return NextResponse.json({ error: 'Share đã đạt giới hạn lượt tải' }, { status: 410 });
    }

    // ----- Resolve tg_file_id (Bot API form) -----
    let resolvedFileId: string;

    if (pipeline === 'botapi') {
      resolvedFileId = body.tg_file_id!;
    } else {
      // MTProto pipeline — forward message qua log channel
      const logChannelId = process.env.TRISHDRIVE_LOG_CHANNEL_ID;
      if (!logChannelId) {
        return NextResponse.json({
          error: 'Server chưa cấu hình TRISHDRIVE_LOG_CHANNEL_ID — admin tạo private channel + add bot admin + set env var.',
        }, { status: 501 });
      }

      const forwardResp = await fetch(`${TG_API}/bot${body.bot_token}/forwardMessage`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          chat_id: logChannelId,
          from_chat_id: body.channel_id,
          message_id: body.tg_message_id,
          disable_notification: true,
        }),
      });
      const forwardJson = await forwardResp.json() as TgApiResponse<TgMessage>;
      if (!forwardJson.ok || !forwardJson.result) {
        return NextResponse.json({
          error: `forwardMessage fail: ${forwardJson.description || 'unknown'}. Kiểm tra bot có là admin của channel ${body.channel_id} (source) + ${logChannelId} (log) không.`,
        }, { status: 502 });
      }

      const fwdMsg = forwardJson.result;
      const docFile = fwdMsg.document?.file_id || fwdMsg.video?.file_id || fwdMsg.photo?.[fwdMsg.photo.length - 1]?.file_id;
      if (!docFile) {
        return NextResponse.json({ error: 'Forwarded message không có document/file' }, { status: 502 });
      }
      resolvedFileId = docFile;

      // Best-effort cleanup forwarded message khỏi log channel sau khi getFile
      // (delete async, không block download)
      setTimeout(() => {
        fetch(`${TG_API}/bot${body.bot_token}/deleteMessage?chat_id=${encodeURIComponent(logChannelId)}&message_id=${fwdMsg.message_id}`)
          .catch(() => { /* ignore cleanup error */ });
      }, 60_000); // 60s sau khi forward (đủ time download chunk)
    }

    // ----- Bot API getFile + download CDN -----
    const fileResp = await fetch(`${TG_API}/bot${body.bot_token}/getFile?file_id=${encodeURIComponent(resolvedFileId)}`);
    const fileJson = await fileResp.json() as TgApiResponse<{ file_path?: string }>;
    if (!fileJson.ok || !fileJson.result?.file_path) {
      return NextResponse.json({ error: fileJson.description || 'getFile failed' }, { status: 502 });
    }

    const fileUrl = `${TG_API}/file/bot${body.bot_token}/${fileJson.result.file_path}`;
    const dlResp = await fetch(fileUrl);
    if (!dlResp.ok) {
      return NextResponse.json({ error: `Telegram CDN ${dlResp.status}` }, { status: 502 });
    }

    if (body.is_first_chunk) {
      await ref.update({ download_count: FieldValue.increment(1) });
    }

    return new Response(dlResp.body, {
      status: 200,
      headers: { 'content-type': 'application/octet-stream', 'cache-control': 'no-store' },
    });
  } catch (e) {
    console.error('[share/proxy]', e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
