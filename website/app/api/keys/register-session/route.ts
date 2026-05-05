/**
 * POST /api/keys/register-session
 *
 * Body:
 *   {
 *     key_code: string;       // "XXXX-XXXX-XXXX-XXXX" hoặc 16 chars
 *     app_id: string;         // 'trishfinance' | 'trishiso' | ...
 *     machine_id: string;     // 16 hex chars
 *     ip_address?: string;    // optional, server tự lấy nếu không truyền
 *     hostname?: string;
 *     os?: string;
 *   }
 *
 * Headers (cho account key):
 *   Authorization: Bearer <Firebase ID token>
 *
 * Response:
 *   200  → { ok: true, session_id, key_id, expires_at, kicked_session_id? }
 *   400  → { error: 'invalid-input' }
 *   401  → { error: 'unauthenticated' }
 *   403  → { error: 'key/wrong-binding' | 'key/wrong-app' | 'key/revoked' | 'key/expired' }
 *   404  → { error: 'key/not-found' }
 *   500  → { error: 'internal' }
 */
import { NextResponse, type NextRequest } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import {
  registerKeySession,
  SessionRegisterError,
  type RegisterSessionInput,
} from '@/lib/keys-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '3600',
};

export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

interface ReqBody {
  key_code?: string;
  app_id?: string;
  machine_id?: string;
  ip_address?: string;
  hostname?: string;
  os?: string;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = (await req.json().catch(() => null)) as ReqBody | null;
    if (!body) {
      return NextResponse.json(
        { error: 'invalid-input' },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    const keyCode = body.key_code ?? '';
    const appId = body.app_id ?? '';
    const machineId = body.machine_id ?? '';
    if (!keyCode || !appId || !machineId) {
      return NextResponse.json(
        { error: 'invalid-input' },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    // Verify Firebase ID token nếu có (account key cần)
    let uid: string | undefined;
    const authHeader = req.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const idToken = authHeader.slice(7);
      try {
        const decoded = await adminAuth().verifyIdToken(idToken);
        uid = decoded.uid;
      } catch (err) {
        return NextResponse.json(
          { error: 'unauthenticated', detail: (err as Error).message },
          { status: 401, headers: CORS_HEADERS },
        );
      }
    }

    // IP server-side (Vercel header). Fallback body.ip_address hoặc 'unknown'.
    const ipFromHeaders =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      req.headers.get('x-real-ip') ??
      undefined;
    const ipAddress = body.ip_address || ipFromHeaders || 'unknown';

    const input: RegisterSessionInput = {
      keyCode,
      appId,
      machineId,
      ipAddress,
      hostname: body.hostname,
      os: body.os,
      userAgent: req.headers.get('user-agent') ?? undefined,
      uid,
    };

    const result = await registerKeySession(input);

    return NextResponse.json(
      {
        ok: true,
        session_id: result.sessionId,
        key_id: result.keyId,
        expires_at: result.expiresAt,
        kicked_session_id: result.kickedSessionId,
      },
      { status: 200, headers: CORS_HEADERS },
    );
  } catch (err) {
    if (err instanceof SessionRegisterError) {
      const status =
        err.code === 'key/not-found'
          ? 404
          : err.code === 'invalid-input'
            ? 400
            : err.code === 'key/unauthenticated'
              ? 401
              : 403;
      return NextResponse.json(
        { error: err.code, message: err.message },
        { status, headers: CORS_HEADERS },
      );
    }
    return NextResponse.json(
      { error: 'internal', detail: (err as Error).message },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}
