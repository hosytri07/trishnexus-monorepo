'use client';

/**
 * /admin/vitals — Phase 16.4.
 *
 * Dashboard Core Web Vitals. Fetch `/api/admin/vitals?env=&hours=` với
 * ID token header, render:
 *   - Bộ chọn env (prod | dev) + hours (1h | 24h | 7d | 30d).
 *   - Grid metric cards (LCP, CLS, INP, TTFB, FCP, FID): p50 / p75 / p95
 *     với màu theo ngưỡng Web Vitals chuẩn. Bar rating distribution.
 *   - Bảng top path với count + LCP p75.
 *
 * Chỉ dùng Admin SDK server-side (rules /vitals client write=deny, read
 * chỉ admin) nên mọi tính toán nằm trong /api/admin/vitals route.
 *
 * Ngưỡng Web Vitals (ms, trừ CLS unitless):
 *   LCP  good <2500   ni <4000   poor
 *   INP  good <200    ni <500    poor
 *   FID  good <100    ni <300    poor
 *   CLS  good <0.1    ni <0.25   poor
 *   TTFB good <800    ni <1800   poor
 *   FCP  good <1800   ni <3000   poor
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Gauge,
  Loader2,
  RefreshCw,
  TrendingUp,
  AlertTriangle,
  Clock,
  ChevronDown,
} from 'lucide-react';
import { getIdToken } from 'firebase/auth';
import { auth } from '@/lib/firebase';

type Rating = 'good' | 'needs-improvement' | 'poor' | 'unknown';

interface MetricBucket {
  count: number;
  p50: number;
  p75: number;
  p95: number;
  min: number;
  max: number;
  ratings: Record<Rating, number>;
}

interface TopPath {
  path: string;
  count: number;
  lcpP75?: number;
}

interface VitalsResponse {
  env: string;
  hours: number;
  total: number;
  truncated: boolean;
  perMetric: Record<string, MetricBucket>;
  topPaths: TopPath[];
}

// Thứ tự ưu tiên hiển thị. Tên "Next.js-*" ẩn vào group riêng.
const METRIC_ORDER = ['LCP', 'INP', 'CLS', 'TTFB', 'FCP', 'FID'] as const;

interface Threshold {
  good: number;
  ni: number;
  unit: 'ms' | '';
}

const THRESHOLDS: Record<string, Threshold> = {
  LCP: { good: 2500, ni: 4000, unit: 'ms' },
  INP: { good: 200, ni: 500, unit: 'ms' },
  FID: { good: 100, ni: 300, unit: 'ms' },
  CLS: { good: 0.1, ni: 0.25, unit: '' },
  TTFB: { good: 800, ni: 1800, unit: 'ms' },
  FCP: { good: 1800, ni: 3000, unit: 'ms' },
};

const METRIC_LABEL: Record<string, string> = {
  LCP: 'Largest Contentful Paint',
  INP: 'Interaction to Next Paint',
  FID: 'First Input Delay',
  CLS: 'Cumulative Layout Shift',
  TTFB: 'Time To First Byte',
  FCP: 'First Contentful Paint',
};

function rateValue(name: string, value: number): Rating {
  const t = THRESHOLDS[name];
  if (!t) return 'unknown';
  if (value < t.good) return 'good';
  if (value < t.ni) return 'needs-improvement';
  return 'poor';
}

function ratingColor(r: Rating): string {
  switch (r) {
    case 'good':
      return '#10B981';
    case 'needs-improvement':
      return '#F59E0B';
    case 'poor':
      return '#EF4444';
    default:
      return 'var(--color-text-muted)';
  }
}

function formatValue(name: string, v: number): string {
  const t = THRESHOLDS[name];
  if (!t) return String(v);
  if (t.unit === 'ms') {
    if (v >= 1000) return `${(v / 1000).toFixed(2)} s`;
    return `${Math.round(v)} ms`;
  }
  return v.toFixed(3);
}

const HOURS_OPTIONS: { label: string; value: number }[] = [
  { label: '1 giờ', value: 1 },
  { label: '24 giờ', value: 24 },
  { label: '7 ngày', value: 24 * 7 },
  { label: '30 ngày', value: 24 * 30 },
];

export default function AdminVitalsPage() {
  const [env, setEnv] = useState<'prod' | 'dev'>('prod');
  const [hours, setHours] = useState(24);
  const [data, setData] = useState<VitalsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      if (!auth?.currentUser) {
        throw new Error('Chưa đăng nhập');
      }
      const idToken = await getIdToken(auth.currentUser);
      const res = await fetch(
        `/api/admin/vitals?env=${env}&hours=${hours}`,
        {
          headers: { Authorization: `Bearer ${idToken}` },
          cache: 'no-store',
        },
      );
      if (res.status === 501) {
        throw new Error(
          'Admin SDK chưa cấu hình — set FIREBASE_SERVICE_ACCOUNT env',
        );
      }
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const body = (await res.json()) as VitalsResponse;
      setData(body);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [env, hours]);

  useEffect(() => {
    void load();
  }, [load]);

  const metricsToShow = useMemo(() => {
    if (!data) return [] as string[];
    return METRIC_ORDER.filter((m) => data.perMetric[m]);
  }, [data]);

  return (
    <div className="space-y-5">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1
            className="text-2xl font-bold flex items-center gap-2"
            style={{ color: 'var(--color-text-primary)' }}
          >
            <Gauge size={22} style={{ color: 'var(--color-accent-primary)' }} />
            Core Web Vitals
          </h1>
          <p
            className="text-sm mt-1"
            style={{ color: 'var(--color-text-muted)' }}
          >
            p50 / p75 / p95 tính từ sample tươi của {hours >= 24 ? `${hours / 24} ngày` : `${hours} giờ`} gần nhất.
            {data?.truncated ? ' (đã cắt ở 5000 sample)' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="inline-flex items-center h-10 rounded-md overflow-hidden text-xs font-semibold"
            style={{
              background: 'var(--color-surface-muted)',
              border: '1px solid var(--color-border-subtle)',
            }}
          >
            {(['prod', 'dev'] as const).map((e) => (
              <button
                key={e}
                onClick={() => setEnv(e)}
                className="px-3 h-full uppercase tracking-wide transition-colors"
                style={{
                  background:
                    env === e ? 'var(--color-accent-soft)' : 'transparent',
                  color:
                    env === e
                      ? 'var(--color-accent-primary)'
                      : 'var(--color-text-secondary)',
                }}
              >
                {e}
              </button>
            ))}
          </div>
          <label
            className="relative inline-flex items-center h-10 px-3 rounded-md gap-1.5"
            style={{
              background: 'var(--color-surface-muted)',
              border: '1px solid var(--color-border-subtle)',
            }}
          >
            <Clock size={14} style={{ color: 'var(--color-text-muted)' }} />
            <select
              value={hours}
              onChange={(e) => setHours(Number(e.target.value))}
              className="bg-transparent outline-none text-sm pr-5 appearance-none"
              style={{ color: 'var(--color-text-primary)' }}
            >
              {HOURS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <ChevronDown
              size={14}
              className="absolute right-2 pointer-events-none"
              style={{ color: 'var(--color-text-muted)' }}
            />
          </label>
          <button
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 h-10 px-3 rounded-md text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{
              background: 'var(--color-accent-gradient)',
              color: '#ffffff',
            }}
          >
            {loading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <RefreshCw size={14} />
            )}
            Làm mới
          </button>
        </div>
      </header>

      {err ? (
        <div
          className="p-4 rounded-md text-sm flex items-start gap-2"
          style={{
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.25)',
            color: '#B91C1C',
          }}
        >
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <div>
            <b>Không tải được dữ liệu.</b> {err}
          </div>
        </div>
      ) : null}

      {!data && !err ? (
        <div
          className="p-10 text-center rounded-lg text-sm"
          style={{
            background: 'var(--color-surface-primary)',
            border: '1px solid var(--color-border-subtle)',
            color: 'var(--color-text-muted)',
          }}
        >
          <Loader2 size={18} className="inline animate-spin mr-1" /> Đang tải…
        </div>
      ) : null}

      {data ? (
        <>
          <div
            className="grid grid-cols-3 sm:grid-cols-4 gap-3 p-4 rounded-lg"
            style={{
              background: 'var(--color-surface-primary)',
              border: '1px solid var(--color-border-subtle)',
            }}
          >
            <Summary label="Sample" value={data.total.toLocaleString('vi-VN')} />
            <Summary
              label="Env"
              value={data.env}
              hint={data.env === 'prod' ? 'Production' : 'Preview/Dev'}
            />
            <Summary
              label="Window"
              value={
                data.hours >= 24
                  ? `${data.hours / 24} ngày`
                  : `${data.hours} giờ`
              }
            />
            <Summary
              label="Metric"
              value={String(metricsToShow.length)}
              hint="Đã ghi nhận"
            />
          </div>

          {metricsToShow.length === 0 ? (
            <div
              className="p-10 text-center rounded-lg"
              style={{
                background: 'var(--color-surface-primary)',
                border: '1px solid var(--color-border-subtle)',
                color: 'var(--color-text-muted)',
              }}
            >
              <Activity size={28} className="inline opacity-40 mb-2" />
              <p className="text-sm">
                Chưa có sample nào trong khoảng thời gian này. Đợi user truy cập
                trang hoặc đổi sang <code>dev</code>.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {metricsToShow.map((name) => (
                <MetricCard
                  key={name}
                  name={name}
                  bucket={data.perMetric[name]}
                />
              ))}
            </div>
          )}

          {data.topPaths.length > 0 ? (
            <div
              className="rounded-lg overflow-hidden"
              style={{
                background: 'var(--color-surface-primary)',
                border: '1px solid var(--color-border-subtle)',
              }}
            >
              <div
                className="px-4 py-3 flex items-center gap-2 text-sm font-semibold"
                style={{
                  borderBottom: '1px solid var(--color-border-subtle)',
                  color: 'var(--color-text-primary)',
                }}
              >
                <TrendingUp
                  size={14}
                  style={{ color: 'var(--color-accent-primary)' }}
                />
                Top trang có traffic
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr
                    style={{
                      background: 'var(--color-surface-muted)',
                      color: 'var(--color-text-muted)',
                    }}
                  >
                    <th className="text-left px-4 py-2 font-medium">Path</th>
                    <th className="text-right px-4 py-2 font-medium">
                      Sample
                    </th>
                    <th className="text-right px-4 py-2 font-medium">
                      LCP p75
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.topPaths.map((p) => {
                    const rating =
                      p.lcpP75 != null ? rateValue('LCP', p.lcpP75) : 'unknown';
                    return (
                      <tr
                        key={p.path}
                        style={{
                          borderTop: '1px solid var(--color-border-subtle)',
                        }}
                      >
                        <td
                          className="px-4 py-2 font-mono text-xs"
                          style={{ color: 'var(--color-text-primary)' }}
                        >
                          {p.path || '/'}
                        </td>
                        <td
                          className="px-4 py-2 text-right"
                          style={{ color: 'var(--color-text-secondary)' }}
                        >
                          {p.count.toLocaleString('vi-VN')}
                        </td>
                        <td
                          className="px-4 py-2 text-right font-medium"
                          style={{ color: ratingColor(rating) }}
                        >
                          {p.lcpP75 != null ? formatValue('LCP', p.lcpP75) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function Summary({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div>
      <p
        className="text-[11px] uppercase tracking-wide font-semibold"
        style={{ color: 'var(--color-text-muted)' }}
      >
        {label}
      </p>
      <p
        className="text-lg font-bold mt-0.5"
        style={{ color: 'var(--color-text-primary)' }}
      >
        {value}
      </p>
      {hint ? (
        <p
          className="text-[11px] mt-0.5"
          style={{ color: 'var(--color-text-muted)' }}
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function MetricCard({ name, bucket }: { name: string; bucket: MetricBucket }) {
  const rating = rateValue(name, bucket.p75);
  const color = ratingColor(rating);
  const total =
    bucket.ratings.good +
    bucket.ratings['needs-improvement'] +
    bucket.ratings.poor +
    bucket.ratings.unknown;
  const pct = (n: number) => (total === 0 ? 0 : (n / total) * 100);

  return (
    <div
      className="p-4 rounded-lg"
      style={{
        background: 'var(--color-surface-primary)',
        border: '1px solid var(--color-border-subtle)',
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p
            className="text-lg font-bold"
            style={{ color: 'var(--color-text-primary)' }}
          >
            {name}
          </p>
          <p
            className="text-xs"
            style={{ color: 'var(--color-text-muted)' }}
          >
            {METRIC_LABEL[name] ?? ''}
          </p>
        </div>
        <span
          className="text-[11px] font-semibold uppercase px-2 py-1 rounded"
          style={{
            background: `${color}22`,
            color,
          }}
        >
          {rating === 'good'
            ? 'Tốt'
            : rating === 'needs-improvement'
              ? 'Cần cải thiện'
              : rating === 'poor'
                ? 'Kém'
                : '—'}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-4">
        {(['p50', 'p75', 'p95'] as const).map((p) => {
          const v = bucket[p];
          const r = rateValue(name, v);
          return (
            <div
              key={p}
              className="p-2 rounded"
              style={{
                background: 'var(--color-surface-muted)',
              }}
            >
              <p
                className="text-[10px] uppercase tracking-wide font-semibold"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {p}
              </p>
              <p
                className="text-sm font-bold mt-0.5"
                style={{ color: ratingColor(r) }}
              >
                {formatValue(name, v)}
              </p>
            </div>
          );
        })}
      </div>

      {/* Rating distribution bar */}
      <div className="mt-4">
        <div
          className="h-2 rounded overflow-hidden flex"
          style={{ background: 'var(--color-surface-muted)' }}
        >
          <span
            style={{
              width: `${pct(bucket.ratings.good)}%`,
              background: '#10B981',
            }}
            title={`Good ${bucket.ratings.good}`}
          />
          <span
            style={{
              width: `${pct(bucket.ratings['needs-improvement'])}%`,
              background: '#F59E0B',
            }}
            title={`Needs improvement ${bucket.ratings['needs-improvement']}`}
          />
          <span
            style={{
              width: `${pct(bucket.ratings.poor)}%`,
              background: '#EF4444',
            }}
            title={`Poor ${bucket.ratings.poor}`}
          />
        </div>
        <div
          className="flex justify-between text-[11px] mt-1"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <span style={{ color: '#10B981' }}>
            ● {bucket.ratings.good} good
          </span>
          <span style={{ color: '#F59E0B' }}>
            ● {bucket.ratings['needs-improvement']} NI
          </span>
          <span style={{ color: '#EF4444' }}>
            ● {bucket.ratings.poor} poor
          </span>
          <span>n={bucket.count}</span>
        </div>
      </div>
    </div>
  );
}
