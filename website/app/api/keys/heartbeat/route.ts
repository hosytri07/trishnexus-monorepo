/**
 * POST /api/keys/heartbeat
 *
 * Body: { key_id: string; session_id: string }
 * Response: { ok: true, expires_at } | { ok: false, reason: 'session_not_found' }
 *
 * Heartbeat 5 phút/lần. Nếu trả ok:false → app phải logout (session đã bị kick).
 */
import { NextResponse, type NextRequest } from 'next/server';
import { heartbeatKeySession } from '@/lib/keys-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '3600',
};

export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = (await req.json().catch(() => null)) as
      | { key_id?: string; session_id?: string }
      | null;
    if (!body?.key_id || !body?.session_id) {
      return NextResponse.json(
        { error: 'invalid-input' },
        { status: 400, headers: CORS },
      );
    }
    const result = await heartbeatKeySession(body.key_id, body.session_id);
    return NextResponse.json(result, { status: 200, headers: CORS });
  } catch (err) {
    return NextResponse.json(
      { error: 'internal', detail: (err as Error).message },
      { status: 500, headers: CORS },
    );
  }
}
