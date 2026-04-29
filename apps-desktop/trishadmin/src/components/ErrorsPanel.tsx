/**
 * ErrorsPanel — TrishAdmin desktop, Phase 21 prep (2026-04-29).
 *
 * Đọc Firestore /errors/{env}/samples/{*} → group theo fingerprint, top 20 issue
 * + recent 100 sample. Có filter app + severity.
 *
 * Server endpoint: telemetry write qua /api/errors (Phase 16.5). Client read trực tiếp Firestore
 * vì TrishAdmin chỉ dành cho admin (rules cho phép read).
 */

import { useEffect, useMemo, useState } from 'react';
import {
  collection,
  getFirestore,
  limit,
  orderBy,
  query,
  getDocs,
  type DocumentData,
} from 'firebase/firestore';

interface ErrorSample {
  id: string;
  app?: string;
  version?: string;
  platform?: string;
  severity?: string;
  name?: string;
  message?: string;
  stack?: string;
  context?: Record<string, unknown>;
  uid?: string;
  ts?: number;
  fingerprint?: string;
}

const ENV = (typeof window !== 'undefined' && (window as { ENV?: string }).ENV) || 'prod';
const APP_OPTIONS = ['(tất cả)', 'website', 'trishlauncher', 'trishlibrary', 'trishadmin', 'trishfont', 'trishcheck', 'trishclean', 'trishdesign'];
const SEV_OPTIONS = ['(tất cả)', 'fatal', 'error', 'warning', 'info'];

export function ErrorsPanel(): JSX.Element {
  const [samples, setSamples] = useState<ErrorSample[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [filterApp, setFilterApp] = useState<string>('(tất cả)');
  const [filterSeverity, setFilterSeverity] = useState<string>('(tất cả)');
  const [selected, setSelected] = useState<ErrorSample | null>(null);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load(): Promise<void> {
    setLoading(true);
    setErr(null);
    try {
      const db = getFirestore();
      const col = collection(db, `errors/${ENV}/samples`);
      const q = query(col, orderBy('ts', 'desc'), limit(300));
      const snap = await getDocs(q);
      const items: ErrorSample[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as DocumentData),
      } as ErrorSample));
      setSamples(items);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErr(msg);
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    return samples.filter((s) => {
      if (filterApp !== '(tất cả)' && s.app !== filterApp) return false;
      if (filterSeverity !== '(tất cả)' && s.severity !== filterSeverity) return false;
      return true;
    });
  }, [samples, filterApp, filterSeverity]);

  /** Group theo fingerprint — top 20 issue */
  const groups = useMemo(() => {
    const map = new Map<string, { fp: string; count: number; latest: ErrorSample; apps: Set<string> }>();
    for (const s of filtered) {
      const fp = s.fingerprint || 'unknown';
      const cur = map.get(fp);
      if (cur) {
        cur.count++;
        if ((s.ts ?? 0) > (cur.latest.ts ?? 0)) cur.latest = s;
        if (s.app) cur.apps.add(s.app);
      } else {
        map.set(fp, {
          fp,
          count: 1,
          latest: s,
          apps: new Set(s.app ? [s.app] : []),
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count).slice(0, 20);
  }, [filtered]);

  return (
    <div className="panel-content">
      <header className="panel-header">
        <div>
          <h2>🐞 Errors — {ENV}</h2>
          <p className="muted">Lỗi tự động báo từ 7 desktop app + website. Group theo fingerprint (FNV-1a hash của name+message+stack).</p>
        </div>
        <div className="panel-actions">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => void load()}>
            ↻ Reload
          </button>
        </div>
      </header>

      <div className="filter-row">
        <label>
          App:
          <select value={filterApp} onChange={(e) => setFilterApp(e.target.value)}>
            {APP_OPTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
        <label>
          Severity:
          <select value={filterSeverity} onChange={(e) => setFilterSeverity(e.target.value)}>
            {SEV_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <span className="muted small">Tổng {filtered.length} sample / {samples.length} đọc về</span>
      </div>

      {loading && <p className="muted">Đang tải…</p>}
      {err && <p className="error">Lỗi: {err}</p>}

      {!loading && !err && (
        <>
          <h3 style={{ marginTop: 24 }}>Top 20 issue (group theo fingerprint)</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Count</th>
                <th>Apps</th>
                <th>Severity</th>
                <th>Name</th>
                <th>Message (cắt)</th>
                <th>Latest</th>
              </tr>
            </thead>
            <tbody>
              {groups.length === 0 && (
                <tr><td colSpan={7} className="muted">Chưa có error nào</td></tr>
              )}
              {groups.map((g, i) => (
                <tr key={g.fp} onClick={() => setSelected(g.latest)} style={{ cursor: 'pointer' }}>
                  <td>{i + 1}</td>
                  <td><strong>{g.count}</strong></td>
                  <td>{Array.from(g.apps).join(', ')}</td>
                  <td><Severity sev={g.latest.severity} /></td>
                  <td>{g.latest.name}</td>
                  <td>{(g.latest.message || '').slice(0, 80)}</td>
                  <td>{formatTs(g.latest.ts)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {selected && (
            <div className="modal-backdrop" onClick={() => setSelected(null)}>
              <div className="modal-card" onClick={(e) => e.stopPropagation()}>
                <header>
                  <h3>{selected.name} — {selected.app} v{selected.version}</h3>
                  <button type="button" onClick={() => setSelected(null)}>×</button>
                </header>
                <p><strong>Severity:</strong> <Severity sev={selected.severity} /></p>
                <p><strong>Message:</strong> {selected.message}</p>
                <p><strong>Time:</strong> {formatTs(selected.ts)}</p>
                {selected.uid && <p><strong>UID:</strong> {selected.uid}</p>}
                <p><strong>Fingerprint:</strong> <code>{selected.fingerprint}</code></p>
                {selected.stack && (
                  <>
                    <h4>Stack trace</h4>
                    <pre className="code-block">{selected.stack}</pre>
                  </>
                )}
                {selected.context && (
                  <>
                    <h4>Context</h4>
                    <pre className="code-block">{JSON.stringify(selected.context, null, 2)}</pre>
                  </>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Severity({ sev }: { sev?: string }): JSX.Element {
  const color: Record<string, string> = {
    fatal: '#dc2626',
    error: '#ef4444',
    warning: '#f59e0b',
    info: '#3b82f6',
  };
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 4,
      background: color[sev || 'error'] || '#6b7280',
      color: 'white',
      fontSize: 12,
      fontWeight: 600,
    }}>
      {sev || 'unknown'}
    </span>
  );
}

function formatTs(ts: number | undefined): string {
  if (!ts) return '—';
  const d = new Date(ts);
  const diff = Date.now() - ts;
  if (diff < 60_000) return `${Math.round(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)}h ago`;
  return d.toLocaleString('vi-VN');
}
