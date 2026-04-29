/**
 * VitalsPanel — TrishAdmin desktop, Phase 21 prep (2026-04-29).
 *
 * Đọc Firestore /vitals/{env}/samples/{*} → metric card LCP/INP/CLS/TTFB/FCP/STARTUP
 * + percentile p50/p75/p95 + rating distribution.
 *
 * Server endpoint: telemetry write qua /api/vitals (Phase 16.3).
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

interface VitalSample {
  id: string;
  app?: string;
  version?: string;
  platform?: string;
  name?: string;
  value?: number;
  rating?: 'good' | 'needs-improvement' | 'poor' | 'unknown';
  path?: string;
  uid?: string;
  ts?: number;
}

const ENV = (typeof window !== 'undefined' && (window as { ENV?: string }).ENV) || 'prod';
const METRICS: Array<{ name: string; unit: string; thresholds: [number, number] }> = [
  { name: 'LCP', unit: 'ms', thresholds: [2500, 4000] },
  { name: 'INP', unit: 'ms', thresholds: [200, 500] },
  { name: 'CLS', unit: '', thresholds: [0.1, 0.25] },
  { name: 'TTFB', unit: 'ms', thresholds: [800, 1800] },
  { name: 'FCP', unit: 'ms', thresholds: [1800, 3000] },
  { name: 'STARTUP', unit: 'ms', thresholds: [1500, 3000] },
];

export function VitalsPanel(): JSX.Element {
  const [samples, setSamples] = useState<VitalSample[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load(): Promise<void> {
    setLoading(true);
    setErr(null);
    try {
      const db = getFirestore();
      const col = collection(db, `vitals/${ENV}/samples`);
      const q = query(col, orderBy('ts', 'desc'), limit(2000));
      const snap = await getDocs(q);
      const items: VitalSample[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as DocumentData),
      } as VitalSample));
      setSamples(items);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErr(msg);
    } finally {
      setLoading(false);
    }
  }

  const stats = useMemo(() => {
    const byMetric = new Map<string, number[]>();
    const ratingByMetric = new Map<string, { good: number; ni: number; poor: number; unknown: number }>();
    for (const s of samples) {
      if (!s.name || !Number.isFinite(s.value)) continue;
      const arr = byMetric.get(s.name) || [];
      arr.push(s.value as number);
      byMetric.set(s.name, arr);
      const r = ratingByMetric.get(s.name) || { good: 0, ni: 0, poor: 0, unknown: 0 };
      if (s.rating === 'good') r.good++;
      else if (s.rating === 'needs-improvement') r.ni++;
      else if (s.rating === 'poor') r.poor++;
      else r.unknown++;
      ratingByMetric.set(s.name, r);
    }
    const out: Record<string, { count: number; p50: number; p75: number; p95: number; rating: { good: number; ni: number; poor: number; unknown: number } }> = {};
    for (const [name, values] of byMetric) {
      values.sort((a, b) => a - b);
      out[name] = {
        count: values.length,
        p50: percentile(values, 0.5),
        p75: percentile(values, 0.75),
        p95: percentile(values, 0.95),
        rating: ratingByMetric.get(name) || { good: 0, ni: 0, poor: 0, unknown: 0 },
      };
    }
    return out;
  }, [samples]);

  return (
    <div className="panel-content">
      <header className="panel-header">
        <div>
          <h2>📊 Web Vitals — {ENV}</h2>
          <p className="muted">Performance từ website + 7 desktop app (STARTUP). Percentile linear interpolation.</p>
        </div>
        <div className="panel-actions">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => void load()}>
            ↻ Reload
          </button>
        </div>
      </header>

      {loading && <p className="muted">Đang tải…</p>}
      {err && <p className="error">Lỗi: {err}</p>}

      {!loading && !err && (
        <div className="metric-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginTop: 16 }}>
          {METRICS.map((m) => {
            const s = stats[m.name];
            const p75 = s?.p75 ?? null;
            const color = p75 == null ? '#6b7280' : p75 <= m.thresholds[0] ? '#10b981' : p75 <= m.thresholds[1] ? '#f59e0b' : '#ef4444';
            return (
              <div key={m.name} className="metric-card" style={{
                padding: 16,
                border: `2px solid ${color}`,
                borderRadius: 8,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <strong style={{ fontSize: 18 }}>{m.name}</strong>
                  <span className="muted small">{s?.count ?? 0} sample</span>
                </div>
                <div style={{ marginTop: 8, fontSize: 28, fontWeight: 700, color }}>
                  {p75 != null ? formatValue(p75, m.unit) : '—'}
                </div>
                <div className="muted small">p75 {m.unit && `(${m.unit})`}</div>
                {s && (
                  <>
                    <div className="muted small" style={{ marginTop: 4 }}>
                      p50 {formatValue(s.p50, m.unit)} · p95 {formatValue(s.p95, m.unit)}
                    </div>
                    <RatingBar rating={s.rating} />
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function formatValue(v: number, unit: string): string {
  if (unit === 'ms') {
    return v >= 1000 ? `${(v / 1000).toFixed(2)}s` : `${Math.round(v)}ms`;
  }
  return v.toFixed(3);
}

function RatingBar({ rating }: { rating: { good: number; ni: number; poor: number; unknown: number } }): JSX.Element {
  const total = rating.good + rating.ni + rating.poor + rating.unknown;
  if (total === 0) return <></>;
  const pct = (n: number) => `${(n / total * 100).toFixed(0)}%`;
  return (
    <div style={{ marginTop: 8, height: 6, display: 'flex', borderRadius: 3, overflow: 'hidden' }}>
      <div style={{ width: pct(rating.good), background: '#10b981' }} title={`Good: ${rating.good}`} />
      <div style={{ width: pct(rating.ni), background: '#f59e0b' }} title={`NI: ${rating.ni}`} />
      <div style={{ width: pct(rating.poor), background: '#ef4444' }} title={`Poor: ${rating.poor}`} />
      <div style={{ width: pct(rating.unknown), background: '#6b7280' }} title={`Unknown: ${rating.unknown}`} />
    </div>
  );
}
