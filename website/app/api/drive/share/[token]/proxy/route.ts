/**
 * POST /api/drive/share/{token}/proxy — Phase 22.7b
 *
 * Body: { bot_token: string (decrypted client-side), tg_file_id: string }
 * Server: getFile + download bytes from Telegram → return encrypted bytes (still AES-encrypted với master_key).
 *
 * Tại sao server làm? Vì client browser không thể fetch trực tiếp Telegram (CORS).
 * Server chỉ proxy bytes, không có master_key → không decrypt được content.
 *
 * Client gửi bot_token đã DECRYPT bằng password → server in-memory dùng → không lưu.
 *
 * Increment download_count khi proxy chunk đầu tiên (idx=0) thành công.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { initAdminApp } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

interface ProxyBody {
  bot_token: string;
  tg_file_id: string;
  is_first_chunk?: boolean;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const body = (await req.json()) as ProxyBody;
    if (!body.bot_token || !body.tg_file_id) {
      return NextResponse.json({ error: 'Missing bot_token / tg_file_id' }, { status: 400 });
    }

    initAdminApp();
    const db = getFirestore();
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

    // getFile Telegram
    const fileResp = await fetch(`https://api.telegram.org/bot${body.bot_token}/getFile?file_id=${encodeURIComponent(body.tg_file_id)}`);
    const fileJson = await fileResp.json() as { ok: boolean; result?: { file_path?: string }; description?: string };
    if (!fileJson.ok || !fileJson.result?.file_path) {
      return NextResponse.json({ error: fileJson.description || 'getFile failed' }, { status: 502 });
    }

    // Download encrypted bytes
    const fileUrl = `https://api.telegram.org/file/bot${body.bot_token}/${fileJson.result.file_path}`;
    const dlResp = await fetch(fileUrl);
    if (!dlResp.ok) {
      return NextResponse.json({ error: `Telegram CDN ${dlResp.status}` }, { status: 502 });
    }

    // Increment download count nếu chunk đầu
    if (body.is_first_chunk) {
      await ref.update({ download_count: FieldValue.increment(1) });
    }

    return new Response(dlResp.body, {
      status: 200,
      headers: {
        'content-type': 'application/octet-stream',
        'cache-control': 'no-store',
      },
    });
  } catch (e) {
    console.error('[share/proxy]', e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
