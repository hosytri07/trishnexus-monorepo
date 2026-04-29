/**
 * POST /api/shorten — Phase 19.22 (rewrite).
 *
 * URL shortener của TrishTEAM. Lưu Firestore /short_links/{code} thay vì
 * gọi service public (is.gd / TinyURL — không reliable, khó quản lý).
 *
 * Body JSON: { url: string }
 * Optional Header: Authorization: Bearer <ID token>  (để track created_by_uid)
 *
 * Response: { short: 'https://trishteam.io.vn/s/{code}', provider: 'trishteam', code }
 *
 * Code: 6 ký tự lowercase + digits, bỏ 0/1/l/o để tránh nhầm.
 * Retry collision tối đa 5 lần.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminAuth, adminDb, adminReady } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CODE_CHARS = 'abcdefghijkmnpqrstuvwxyz23456789';
const CODE_LEN = 6;
const MAX_RETRIES = 5;

function genCode(): string {
  let out = '';
  for (let i = 0; i < CODE_LEN; i++) {
    out += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return out;
}

function getBaseUrl(req: NextRequest): string {
  // Ưu tiên env (production trỏ tới trishteam.io.vn)
  const env = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '');
  if (env) return env;
  // Fallback từ request headers
  const host = req.headers.get('host') ?? 'localhost:3000';
  const proto = req.headers.get('x-forwarded-proto') ?? (host.includes('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

export async function POST(req: NextRequest) {
  if (!adminReady()) {
    return NextResponse.json(
      { error: 'Admin SDK chưa cấu hình. Set FIREBASE_SERVICE_ACCOUNT hoặc GOOGLE_APPLICATION_CREDENTIALS.' },
      { status: 501 },
    );
  }

  let body: { url?: string };
  try {
    body = (await req.json()) as { url?: string };
  } catch {
    return NextResponse.json({ error: 'Body JSON không hợp lệ' }, { status: 400 });
  }

  const url = (body.url ?? '').trim();
  if (!url) return NextResponse.json({ error: 'Thiếu URL' }, { status: 400 });

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json({ error: 'URL không hợp lệ' }, { status: 400 });
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return NextResponse.json({ error: 'Chỉ hỗ trợ http/https' }, { status: 400 });
  }

  // Optional: track creator
  let createdByUid: string | null = null;
  const authz = req.headers.get('authorization') ?? '';
  const token = authz.startsWith('Bearer ') ? authz.slice(7) : null;
  if (token) {
    try {
      const decoded = await adminAuth().verifyIdToken(token);
      createdByUid = decoded.uid;
    } catch {
      // ignore — anonymous OK
    }
  }

  const db = adminDb();
  const baseUrl = getBaseUrl(req);

  // Generate unique code (retry max 5 nếu collision)
  let code = '';
  let attempt = 0;
  while (attempt < MAX_RETRIES) {
    const candidate = genCode();
    const ref = db.collection('short_links').doc(candidate);
    const snap = await ref.get();
    if (!snap.exists) {
      try {
        await ref.set({
          code: candidate,
          original_url: parsed.toString(),
          created_at: Date.now(),
          created_by_uid: createdByUid,
          click_count: 0,
        });
        code = candidate;
        break;
      } catch (e) {
        console.error('[shorten] write fail:', e);
        return NextResponse.json(
          { error: e instanceof Error ? e.message : String(e) },
          { status: 500 },
        );
      }
    }
    attempt++;
  }

  if (!code) {
    return NextResponse.json(
      { error: 'Không tạo được code unique sau 5 lần thử' },
      { status: 500 },
    );
  }

  const short = `${baseUrl}/s/${code}`;
  return NextResponse.json({ short, provider: 'trishteam', code });
}
