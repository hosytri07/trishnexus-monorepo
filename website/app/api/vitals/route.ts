/**
 * POST /api/vitals — Phase 16.3.
 *
 * Nhận Web Vitals metric từ `components/web-vitals-reporter.tsx`
 * (qua navigator.sendBeacon), ghi vào Firestore collection
 * `/vitals/{env}/samples/{auto-id}` với TTL policy (Phase 16.4 cleanup).
 *
 * Schema sample:
 *   {
 *     name: 'LCP' | 'CLS' | 'INP' | 'FID' | 'TTFB' | 'FCP' | string,
 *     value: number,
 *     rating: 'good' | 'needs-improvement' | 'poor' | undefined,
 *     path: string,              // chỉ pathname (không query)
 *     ts: Timestamp,             // server-set
 *     ua: string,                // user-agent (cắt 120 ký tự)
 *     nav: 'navigate'|'reload'|'back_forward'|'prerender'|undefined,
 *   }
 *
 * Security:
 *   - Mở cho public (dùng sendBeacon từ tab chưa auth cũng gửi được).
 *   - Rate-limit mềm: chấp nhận 1 payload, không batch — volume mỗi
 *     session < 10 metric → không cần throttle server-side cho MVP.
 *   - Validate body strict: đúng shape mới ghi, ngoài ra return 400.
 *   - KHÔNG ghi nếu Firebase Admin chưa cấu hình — route trả 204 no-op
 *     để client không retry vô nghĩa.
 *
 * Không trả JSON lớn: `sendBeacon` bỏ qua response body mà vẫn gửi.
 * Trả 204 (hoặc 400 khi malformed) là đủ.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb, adminReady } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_NAMES = new Set([
  'LCP',
  'FID',
  'CLS',
  'INP',
  'TTFB',
  'FCP',
  // Next.js custom metric names (có hyphen).
  'Next.js-hydration',
  'Next.js-route-change-to-render',
  'Next.js-render',
]);

interface VitalBody {
  name?: unknown;
  value?: unknown;
  id?: unknown;
  delta?: unknown;
  navigationType?: unknown;
  rating?: unknown;
  path?: unknown;
  ts?: unknown;
  ua?: unknown;
}

function sanitize(body: VitalBody):
  | {
      name: string;
      value: number;
      rating?: string;
      path: string;
      ua: string;
      nav?: string;
    }
  | null {
  if (typeof body !== 'object' || body === null) return null;
  if (typeof body.name !== 'string' || !VALID_NAMES.has(body.name)) return null;
  if (typeof body.value !== 'number' || !Number.isFinite(body.value)) return null;
  const path =
    typeof body.path === 'string' ? body.path.slice(0, 200) : '/';
  const ua = typeof body.ua === 'string' ? body.ua.slice(0, 120) : '';
  const rating =
    body.rating === 'good' || body.rating === 'needs-improvement' || body.rating === 'poor'
      ? body.rating
      : undefined;
  const nav =
    typeof body.navigationType === 'string' && body.navigationType.length <= 32
      ? body.navigationType
      : undefined;
  return {
    name: body.name,
    value: Math.round((body.value as number) * 100) / 100,
    rating,
    path,
    ua,
    nav,
  };
}

export async function POST(req: NextRequest) {
  if (!adminReady()) {
    // Im lặng no-op khi server chưa config credential (dev, preview).
    return new NextResponse(null, { status: 204 });
  }
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const cleaned = sanitize(raw as VitalBody);
  if (!cleaned) {
    return NextResponse.json({ error: 'invalid_shape' }, { status: 400 });
  }
  try {
    const env =
      process.env.NODE_ENV === 'production' ? 'prod' : 'dev';
    await adminDb()
      .collection('vitals')
      .doc(env)
      .collection('samples')
      .add({
        ...cleaned,
        ts: FieldValue.serverTimestamp(),
      });
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    console.warn('[api/vitals] write fail', e);
    return NextResponse.json({ error: 'write_fail' }, { status: 500 });
  }
}

export function GET() {
  return NextResponse.json({
    endpoint: '/api/vitals',
    method: 'POST',
    body: 'VitalBody shape — xem web-vitals-reporter.tsx',
    note: 'Phase 16.3 — ghi vào /vitals/{env}/samples/{auto-id}',
  });
}
