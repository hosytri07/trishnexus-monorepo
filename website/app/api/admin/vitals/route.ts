/**
 * GET /api/admin/vitals — Phase 16.4.
 *
 * Header: Authorization: Bearer <Firebase ID token> (admin only).
 * Query:
 *   - env   = 'prod' | 'dev' (default 'prod')
 *   - hours = number (default 24, max 24*30)
 *
 * Đọc tối đa 5000 sample mới nhất từ Firestore collection
 * `/vitals/{env}/samples`, tính percentile (p50/p75/p95) per metric,
 * rating distribution (good/needs-improvement/poor/unknown), và top
 * path theo count để FE hiển thị bảng phụ.
 *
 * Chọn aggregate server-side (không cho FE query trực tiếp) để:
 *   - Giữ rules `/vitals` chỉ cho admin read và chỉ qua Admin SDK.
 *   - Tránh kéo 5000 doc về client (bandwidth + cost).
 *   - Dễ cache (sau: thêm ISR hoặc Cloud Scheduler tính trước).
 *
 * Response shape (JSON):
 *   {
 *     env: 'prod',
 *     hours: 24,
 *     total: number,
 *     perMetric: {
 *       [name]: { count, p50, p75, p95, min, max, ratings: {good,ni,poor,unknown} }
 *     },
 *     topPaths: Array<{ path: string, count: number, lcpP75?: number }>
 *   }
 *
 * Nếu Admin SDK chưa cấu hình → 501 `admin_not_ready` (UI hiển thị hướng
 * dẫn setup).
 */
import { NextResponse, type NextRequest } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { adminAuth, adminDb, adminReady } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_SAMPLES = 5000;
const MAX_HOURS = 24 * 30;

type Rating = 'good' | 'needs-improvement' | 'poor' | 'unknown';

interface Sample {
  name: string;
  value: number;
  rating?: string;
  path?: string;
}

interface MetricBucket {
  count: number;
  p50: number;
  p75: number;
  p95: number;
  min: number;
  max: number;
  ratings: { good: number; 'needs-improvement': number; poor: number; unknown: number };
}

interface TopPath {
  path: string;
  count: number;
  lcpP75?: number;
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
    console.error('[admin/vitals] verify fail:', e);
    return { error: 'invalid_token', status: 401 } as const;
  }
}

function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  if (sortedAsc.length === 1) return sortedAsc[0];
  const rank = (p / 100) * (sortedAsc.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sortedAsc[lo];
  const frac = rank - lo;
  return sortedAsc[lo] * (1 - frac) + sortedAsc[hi] * frac;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function toRating(r?: string): Rating {
  if (r === 'good' || r === 'needs-improvement' || r === 'poor') return r;
  return 'unknown';
}

export async function GET(req: NextRequest) {
  if (!adminReady()) {
    return NextResponse.json(
      { error: 'admin_not_ready', hint: 'Set FIREBASE_SERVICE_ACCOUNT env' },
      { status: 501 },
    );
  }

  const caller = await verifyAdmin(req);
  if ('error' in caller) {
    return NextResponse.json({ error: caller.error }, { status: caller.status });
  }

  const url = new URL(req.url);
  const env =
    url.searchParams.get('env') === 'dev' ? 'dev' : 'prod';
  const hoursRaw = Number(url.searchParams.get('hours') ?? '24');
  const hours = Number.isFinite(hoursRaw)
    ? Math.max(1, Math.min(MAX_HOURS, Math.floor(hoursRaw)))
    : 24;

  const since = Timestamp.fromMillis(Date.now() - hours * 3600 * 1000);

  try {
    const snap = await adminDb()
      .collection('vitals')
      .doc(env)
      .collection('samples')
      .where('ts', '>=', since)
      .orderBy('ts', 'desc')
      .limit(MAX_SAMPLES)
      .get();

    const byMetric = new Map<string, number[]>();
    const ratingsByMetric = new Map<
      string,
      { good: number; 'needs-improvement': number; poor: number; unknown: number }
    >();
    const byPath = new Map<string, { count: number; lcp: number[] }>();

    snap.forEach((d) => {
      const s = d.data() as Sample;
      if (typeof s.name !== 'string' || typeof s.value !== 'number') return;

      const arr = byMetric.get(s.name) ?? [];
      arr.push(s.value);
      byMetric.set(s.name, arr);

      const r = toRating(s.rating);
      const cur =
        ratingsByMetric.get(s.name) ?? {
          good: 0,
          'needs-improvement': 0,
          poor: 0,
          unknown: 0,
        };
      cur[r] += 1;
      ratingsByMetric.set(s.name, cur);

      if (s.path) {
        const p = byPath.get(s.path) ?? { count: 0, lcp: [] };
        p.count += 1;
        if (s.name === 'LCP') p.lcp.push(s.value);
        byPath.set(s.path, p);
      }
    });

    const perMetric: Record<string, MetricBucket> = {};
    for (const [name, values] of byMetric) {
      const sorted = values.slice().sort((a, b) => a - b);
      perMetric[name] = {
        count: sorted.length,
        p50: round2(percentile(sorted, 50)),
        p75: round2(percentile(sorted, 75)),
        p95: round2(percentile(sorted, 95)),
        min: round2(sorted[0]),
        max: round2(sorted[sorted.length - 1]),
        ratings: ratingsByMetric.get(name) ?? {
          good: 0,
          'needs-improvement': 0,
          poor: 0,
          unknown: 0,
        },
      };
    }

    const topPaths: TopPath[] = Array.from(byPath.entries())
      .map(([path, v]) => {
        const sorted = v.lcp.slice().sort((a, b) => a - b);
        return {
          path,
          count: v.count,
          lcpP75:
            sorted.length > 0 ? round2(percentile(sorted, 75)) : undefined,
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);

    return NextResponse.json({
      env,
      hours,
      total: snap.size,
      truncated: snap.size >= MAX_SAMPLES,
      perMetric,
      topPaths,
    });
  } catch (e) {
    console.error('[admin/vitals] query fail:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
