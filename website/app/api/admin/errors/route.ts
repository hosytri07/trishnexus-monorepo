/**
 * GET /api/admin/errors — Phase 16.5.
 *
 * Header: Authorization: Bearer <ID token> (admin).
 * Query:
 *   - env   = 'prod' | 'dev' (default 'prod')
 *   - hours = 1..720 (default 168 = 7 ngày)
 *   - kind  = 'error'|'unhandledrejection'|'react' (optional)
 *
 * Trả về 300 sample mới nhất + aggregate theo fingerprint (top 20 issue
 * theo count, kèm lastSeen, sample path, message rút gọn).
 *
 * Response:
 *   {
 *     env, hours,
 *     total, truncated,
 *     issues: [{ fingerprint, count, kind, message, path, firstSeen, lastSeen }],
 *     recent: [{ id, ...sample }]  // raw list cho bảng
 *   }
 */
import { NextResponse, type NextRequest } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { adminAuth, adminDb, adminReady } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_SAMPLES = 1000;
const RECENT_LIMIT = 300;

interface Sample {
  kind?: string;
  message?: string;
  stack?: string;
  path?: string;
  ua?: string;
  fingerprint?: string;
  release?: string;
  ts?: { toMillis?: () => number };
}

async function verifyAdmin(req: NextRequest) {
  const authz = req.headers.get('authorization') ?? '';
  const token = authz.startsWith('Bearer ') ? authz.slice(7) : null;
  if (!token) return { error: 'missing_token', status: 401 } as const;
  try {
    const decoded = await adminAuth().verifyIdToken(token);
    if (decoded.admin === true) return { decoded } as const;
    const snap = await adminDb().collection('users').doc(decoded.uid).get();
    if (snap.exists && (snap.data() as { role?: string }).role === 'admin') {
      return { decoded } as const;
    }
    return { error: 'not_admin', status: 403 } as const;
  } catch (e) {
    console.error('[admin/errors] verify fail:', e);
    return { error: 'invalid_token', status: 401 } as const;
  }
}

export async function GET(req: NextRequest) {
  if (!adminReady()) {
    return NextResponse.json(
      { error: 'admin_not_ready' },
      { status: 501 },
    );
  }

  const caller = await verifyAdmin(req);
  if ('error' in caller) {
    return NextResponse.json({ error: caller.error }, { status: caller.status });
  }

  const url = new URL(req.url);
  const env = url.searchParams.get('env') === 'dev' ? 'dev' : 'prod';
  const hoursRaw = Number(url.searchParams.get('hours') ?? '168');
  const hours = Number.isFinite(hoursRaw)
    ? Math.max(1, Math.min(720, Math.floor(hoursRaw)))
    : 168;
  const kindFilter = url.searchParams.get('kind') ?? '';

  const since = Timestamp.fromMillis(Date.now() - hours * 3600 * 1000);

  try {
    const base = adminDb()
      .collection('errors')
      .doc(env)
      .collection('samples')
      .where('ts', '>=', since)
      .orderBy('ts', 'desc')
      .limit(MAX_SAMPLES);

    const snap = await base.get();

    interface Issue {
      fingerprint: string;
      count: number;
      kind: string;
      message: string;
      path: string;
      firstSeen: number;
      lastSeen: number;
    }
    const issues = new Map<string, Issue>();
    const recent: Array<Record<string, unknown>> = [];

    snap.forEach((d) => {
      const s = d.data() as Sample;
      const k = typeof s.kind === 'string' ? s.kind : 'error';
      if (kindFilter && k !== kindFilter) return;
      const millis =
        typeof s.ts?.toMillis === 'function' ? s.ts.toMillis() : 0;
      const fp =
        typeof s.fingerprint === 'string' && s.fingerprint
          ? s.fingerprint
          : `${k}|${(s.message ?? '').slice(0, 60)}`;

      const cur = issues.get(fp);
      if (cur) {
        cur.count += 1;
        if (millis > cur.lastSeen) cur.lastSeen = millis;
        if (millis > 0 && millis < cur.firstSeen) cur.firstSeen = millis;
      } else {
        issues.set(fp, {
          fingerprint: fp,
          count: 1,
          kind: k,
          message: (s.message ?? '(no message)').slice(0, 160),
          path: s.path ?? '/',
          firstSeen: millis || Date.now(),
          lastSeen: millis || Date.now(),
        });
      }

      if (recent.length < RECENT_LIMIT) {
        recent.push({
          id: d.id,
          kind: k,
          message: s.message ?? '',
          path: s.path ?? '',
          ua: s.ua ?? '',
          stack: s.stack ?? '',
          fingerprint: fp,
          release: s.release ?? '',
          ts: millis,
        });
      }
    });

    const issuesSorted = Array.from(issues.values())
      .sort((a, b) => b.count - a.count || b.lastSeen - a.lastSeen)
      .slice(0, 20);

    return NextResponse.json({
      env,
      hours,
      total: snap.size,
      truncated: snap.size >= MAX_SAMPLES,
      issues: issuesSorted,
      recent,
    });
  } catch (e) {
    console.error('[admin/errors] query fail:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
