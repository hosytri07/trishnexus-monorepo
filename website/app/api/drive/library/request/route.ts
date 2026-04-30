/**
 * POST /api/drive/library/request — Phase 26.5.E.1
 *
 * User TrishDrive standalone gửi request admin upload file mới.
 * Lưu Firestore /trishdrive/_/file_requests/{auto_id}.
 * Phase 26.5.E.2 sau: TrishAdmin có moderation queue tab xem + reply.
 *
 * Body: { file_name: string, description?: string }
 * Auth: Bearer Firebase ID token (lấy uid + email từ token).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { adminDb, adminAuth, adminReady } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Max-Age': '600',
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

interface RequestBody {
  file_name: string;
  description?: string;
}

export async function POST(req: NextRequest) {
  try {
    if (!adminReady()) {
      return NextResponse.json(
        { error: 'Firebase Admin SDK chưa cấu hình' },
        { status: 501, headers: CORS_HEADERS },
      );
    }

    const authHeader = req.headers.get('authorization') || '';
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match) {
      return NextResponse.json(
        { error: 'Thiếu Authorization Bearer token' },
        { status: 401, headers: CORS_HEADERS },
      );
    }
    let decoded;
    try {
      decoded = await adminAuth().verifyIdToken(match[1]);
    } catch (e) {
      return NextResponse.json(
        { error: `Token không hợp lệ: ${(e as Error).message}` },
        { status: 401, headers: CORS_HEADERS },
      );
    }

    const body = (await req.json()) as RequestBody;
    if (!body.file_name?.trim()) {
      return NextResponse.json(
        { error: 'Tên file (file_name) bắt buộc' },
        { status: 400, headers: CORS_HEADERS },
      );
    }
    if (body.file_name.length > 200) {
      return NextResponse.json(
        { error: 'Tên file quá dài (max 200 ký tự)' },
        { status: 400, headers: CORS_HEADERS },
      );
    }
    if (body.description && body.description.length > 1000) {
      return NextResponse.json(
        { error: 'Mô tả quá dài (max 1000 ký tự)' },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    const db = adminDb();
    const docRef = await db
      .collection('trishdrive')
      .doc('_')
      .collection('file_requests')
      .add({
        user_uid: decoded.uid,
        user_email: decoded.email || null,
        user_name: decoded.name || null,
        file_name: body.file_name.trim(),
        description: body.description?.trim() || null,
        status: 'pending', // pending | approved | rejected | uploaded
        admin_reply: null,
        created_at: Date.now(),
      });

    return NextResponse.json(
      { ok: true, request_id: docRef.id },
      { headers: CORS_HEADERS },
    );
  } catch (e) {
    console.error('[library/request]', e);
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}
