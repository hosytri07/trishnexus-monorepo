'use client';

/**
 * /admin/errors — Phase 16.5.
 *
 * Hai khối:
 *   1. Top issue — group theo fingerprint (FNV-1a kind+msg+first-stack-line).
 *   2. Recent — 300 sample raw với filter kind.
 *
 * Fetch `/api/admin/errors?env=&hours=&kind=` với Bearer ID token.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  AlertOctagon,
  Bug,
  Clock,
  ChevronDown,
  Loader2,
  RefreshCw,
  XCircle,
  FileWarning,
} from 'lucide-react';
import { getIdToken } from 'firebase/auth';
import { auth } from '@/lib/firebase';

type Kind = 'error' | 'unhandledrejection' | 'react';

interface Issue {
  fingerprint: string;
  count: number;
  kind: string;
  message: string;
  path: string;
  firstSeen: number;
  lastSeen: number;
}

interface RecentRow {
  id: string;
  kind: string;
  message: string;
  path: string;
  ua: string;
  stack: string;
  fingerprint: string;
  release: string;
  ts: number;
}

interface ErrorsResponse {
  env: string;
  hours: number;
  total: number;
  truncated: boolean;
  issues: Issue[];
  recent: RecentRow[];
}

const HOURS_OPTIONS: { label: string; value: number }[] = [
  { label: '1 giờ', value: 1 },
  { label: '24 giờ', value: 24 },
  { label: '7 ngày', value: 168 },
  { label: '30 ngày', value: 720 },
];

const KIND_OPTIONS: { label: string; value: '' | Kind }[] = [
  { label: 'Tất cả', value: '' },
  { label: 'JS error', value: 'error' },
  { label: 'Unhandled rejection', value: 'unhandledrejection' },
  { label: 'React', value: 'react' },
];

const KIND_ICON: Record<string, typeof Bug> = {
  error: AlertOctagon,
  unhandledrejection: FileWarning,
  react: XCircle,
};

const KIND_COLOR: Record<string, string> = {
  error: '#EF4444',
  unhandledrejection: '#F59E0B',
  react: '#8B5CF6',
};

function relativeTime(ms: number): string {
  if (!ms) return '—';
  const diff = Date.now() - ms;
  if (diff < 60_000) return 'vài giây trước';
  if (diff < 3600_000) return `${Math.round(diff / 60_000)} phút trước`;
  if (diff < 86_400_000) return `${Math.round(diff / 3600_000)} giờ trước`;
  return `${Math.round(diff / 86_400_000)} ngày trước`;
}

export default function AdminErrorsPage() {
  const [env, setEnv] = useState<'prod' | 'dev'>('prod');
  const [hours, setHours] = useState(168);
  const [kind, setKind] = useState<'' | Kind>('');
  const [data, setData] = useState<ErrorsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<RecentRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      if (!auth?.currentUser) throw new Error('Chưa đăng nhập');
      const idToken = await getIdToken(auth.currentUser);
      const qs = new URLSearchParams({
        env,
        hours: String(hours),
      });
      if (kind) qs.set('kind', kind);
      const res = await fetch(`/api/admin/errors?${qs.toString()}`, {
        headers: { Authorization: `Bearer ${idToken}` },
        cache: 'no-store',
      });
      if (res.status === 501) {
        throw new Error('Admin SDK chưa cấu hình');
      }
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      setData((await res.json()) as ErrorsResponse);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [env, hours, kind]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-5">
      <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1
            className="text-2xl font-bold flex items-center gap-2"
            style={{ color: 'var(--color-text-primary)' }}
          >
            <Bug size={20} style={{ color: '#EF4444' }} /> Lỗi runtime
          </h1>
          <p
            className="text-sm mt-1"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Stream từ `/api/errors` (sendBeacon) → Firestore
            `/errors/{'{env}'}/samples/`. {data?.truncated
              ? '(đã cắt ở 1000 sample)'
              : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
          <label
            className="relative inline-flex items-center h-10 px-3 rounded-md gap-1.5"
            style={{
              background: 'var(--color-surface-muted)',
              border: '1px solid var(--color-border-subtle)',
            }}
          >
            <AlertTriangle
              size={14}
              style={{ color: 'var(--color-text-muted)' }}
            />
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as '' | Kind)}
              className="bg-transparent outline-none text-sm pr-5 appearance-none"
              style={{ color: 'var(--color-text-primary)' }}
            >
              {KIND_OPTIONS.map((o) => (
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

      {data && data.total === 0 ? (
        <div
          className="p-10 text-center rounded-lg"
          style={{
            background: 'var(--color-surface-primary)',
            border: '1px solid var(--color-border-subtle)',
            color: 'var(--color-text-muted)',
          }}
        >
          <Bug size={28} className="inline opacity-40 mb-2" />
          <p className="text-sm">
            Không có lỗi nào trong khoảng này. Tuyệt, site đang khoẻ 🌿
          </p>
        </div>
      ) : null}

      {data && data.total > 0 ? (
        <>
          <section
            className="rounded-lg overflow-hidden"
            style={{
              background: 'var(--color-surface-primary)',
              border: '1px solid var(--color-border-subtle)',
            }}
          >
            <div
              className="px-4 py-3 flex items-center justify-between text-sm font-semibold"
              style={{
                borderBottom: '1px solid var(--color-border-subtle)',
                color: 'var(--color-text-primary)',
              }}
            >
              <span>Top issue (group theo fingerprint)</span>
              <span
                className="text-xs"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {data.total} sample · {data.issues.length} issue
              </span>
            </div>
            <ul
              className="divide-y"
              style={{ borderColor: 'var(--color-border-subtle)' }}
            >
              {data.issues.map((iss) => {
                const Icon = KIND_ICON[iss.kind] ?? Bug;
                const color = KIND_COLOR[iss.kind] ?? '#EF4444';
                return (
                  <li
                    key={iss.fingerprint}
                    className="flex items-start gap-3 px-4 py-3"
                  >
                    <span
                      className="inline-flex items-center justify-center w-8 h-8 rounded shrink-0"
                      style={{ background: `${color}22`, color }}
                    >
                      <Icon size={14} strokeWidth={2.25} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-sm font-medium truncate"
                        style={{ color: 'var(--color-text-primary)' }}
                        title={iss.message}
                      >
                        {iss.message}
                      </p>
                      <p
                        className="text-xs mt-0.5 truncate font-mono"
                        style={{ color: 'var(--color-text-muted)' }}
                      >
                        {iss.path} · {iss.kind} ·{' '}
                        {relativeTime(iss.lastSeen)}
                      </p>
                    </div>
                    <span
                      className="text-xs font-bold tabular-nums px-2 py-1 rounded"
                      style={{
                        background: `${color}22`,
                        color,
                      }}
                    >
                      ×{iss.count}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>

          <section
            className="rounded-lg overflow-hidden"
            style={{
              background: 'var(--color-surface-primary)',
              border: '1px solid var(--color-border-subtle)',
            }}
          >
            <div
              className="px-4 py-3 text-sm font-semibold"
              style={{
                borderBottom: '1px solid var(--color-border-subtle)',
                color: 'var(--color-text-primary)',
              }}
            >
              Sample gần nhất ({data.recent.length})
            </div>
            <ul
              className="divide-y max-h-[480px] overflow-auto"
              style={{ borderColor: 'var(--color-border-subtle)' }}
            >
              {data.recent.map((r) => {
                const Icon = KIND_ICON[r.kind] ?? Bug;
                const color = KIND_COLOR[r.kind] ?? '#EF4444';
                return (
                  <li key={r.id}>
                    <button
                      className="w-full text-left flex items-start gap-3 px-4 py-2.5 transition-colors hover:bg-[color:var(--color-surface-muted)]"
                      onClick={() => setSelected(r)}
                    >
                      <Icon
                        size={14}
                        style={{ color, marginTop: 3 }}
                        strokeWidth={2.25}
                      />
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-sm truncate"
                          style={{ color: 'var(--color-text-primary)' }}
                        >
                          {r.message}
                        </p>
                        <p
                          className="text-xs mt-0.5 truncate"
                          style={{ color: 'var(--color-text-muted)' }}
                        >
                          {r.path} · {relativeTime(r.ts)}
                          {r.release ? ` · v${r.release}` : ''}
                        </p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      ) : null}

      {selected ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.55)' }}
          onClick={() => setSelected(null)}
        >
          <div
            className="max-w-2xl w-full max-h-[85vh] overflow-auto rounded-lg p-5"
            style={{
              background: 'var(--color-surface-primary)',
              border: '1px solid var(--color-border-subtle)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <p
                  className="text-xs uppercase tracking-wide font-semibold"
                  style={{
                    color: KIND_COLOR[selected.kind] ?? '#EF4444',
                  }}
                >
                  {selected.kind}
                </p>
                <h2
                  className="text-lg font-bold mt-1"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  {selected.message}
                </h2>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="h-8 w-8 rounded flex items-center justify-center"
                style={{
                  background: 'var(--color-surface-muted)',
                  color: 'var(--color-text-muted)',
                }}
                aria-label="Đóng"
              >
                ✕
              </button>
            </div>
            <dl
              className="grid grid-cols-2 gap-2 text-xs mb-3"
              style={{ color: 'var(--color-text-muted)' }}
            >
              <div>
                <dt>Path</dt>
                <dd
                  className="font-mono text-sm"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  {selected.path || '/'}
                </dd>
              </div>
              <div>
                <dt>Thời điểm</dt>
                <dd
                  className="text-sm"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  {selected.ts
                    ? new Date(selected.ts).toLocaleString('vi-VN')
                    : '—'}
                </dd>
              </div>
              <div className="col-span-2">
                <dt>UA</dt>
                <dd
                  className="text-sm truncate"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  {selected.ua || '—'}
                </dd>
              </div>
              <div>
                <dt>Release</dt>
                <dd
                  className="text-sm"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  {selected.release || '—'}
                </dd>
              </div>
              <div>
                <dt>Fingerprint</dt>
                <dd
                  className="text-sm font-mono"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  {selected.fingerprint || '—'}
                </dd>
              </div>
            </dl>
            {selected.stack ? (
              <pre
                className="text-[11px] p-3 rounded whitespace-pre-wrap font-mono"
                style={{
                  background: 'var(--color-surface-muted)',
                  color: 'var(--color-text-secondary)',
                  maxHeight: 320,
                  overflow: 'auto',
                }}
              >
                {selected.stack}
              </pre>
            ) : (
              <p
                className="text-sm italic"
                style={{ color: 'var(--color-text-muted)' }}
              >
                Không có stack trace.
              </p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
