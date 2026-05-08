/**
 * Phase 37.6 — ActiveSessionsPanel.
 *
 * Hiển thị tất cả session đang active của 11 apps (collectionGroup query).
 * Admin có thể force kick từng session — client sẽ detect mất doc qua
 * onSnapshot listener → auto logout máy đó.
 */
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@trishteam/auth/react';
import {
  type ActiveSessionRow,
  type ActorContext,
  kickSession,
  listActiveSessions,
} from '../lib/firestore-admin.js';
import { formatRelative, formatTimestamp } from '../lib/firestore-admin.js';
import { geoLookupBatch, countryFlagEmoji } from '../lib/geo-lookup.js';
import type { IpGeoCache } from '@trishteam/data';

interface Props {
  adminUid: string;
}

export function ActiveSessionsPanel({ adminUid }: Props): JSX.Element {
  const { firebaseUser } = useAuth();
  const actor: ActorContext = {
    uid: firebaseUser?.uid ?? adminUid,
    email: firebaseUser?.email ?? undefined,
  };
  const [sessions, setSessions] = useState<ActiveSessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [appFilter, setAppFilter] = useState<string>('all');
  const [countryFilter, setCountryFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  // Phase 24.3 — Geo cache + proxy filter
  const [geoMap, setGeoMap] = useState<Map<string, IpGeoCache | null>>(new Map());
  const [showProxyOnly, setShowProxyOnly] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);

  async function load(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const list = await listActiveSessions(500);
      setSessions(list);
      // Phase 24.3 — kick off geo lookup async
      const ips = list.map((s) => s.ip_address).filter((ip) => ip && ip !== 'unknown');
      if (ips.length > 0) {
        setGeoLoading(true);
        geoLookupBatch(ips)
          .then((m) => setGeoMap(m))
          .catch((err) => console.warn('[geo] batch fail:', err))
          .finally(() => setGeoLoading(false));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  // Phase 24.3 — CSV export sessions
  function exportSessionsCsv(): void {
    if (filtered.length === 0) {
      window.alert('Không có session để export');
      return;
    }
    const rows = [
      [
        'Session ID',
        'App',
        'Key ID',
        'UID',
        'Machine ID',
        'Hostname',
        'OS',
        'IP',
        'Country',
        'City',
        'ISP',
        'Is Proxy',
        'Started At',
        'Last Heartbeat',
        'Expires At',
      ],
      ...filtered.map((s) => {
        const geo = geoMap.get(s.ip_address);
        return [
          s.session_id,
          s.app_id,
          s.key_id,
          s.uid ?? '',
          s.machine_id,
          s.hostname ?? '',
          s.os ?? '',
          s.ip_address,
          geo?.country ?? '',
          geo?.city ?? '',
          geo?.isp ?? '',
          geo?.is_proxy ? 'YES' : 'no',
          new Date(s.started_at).toISOString(),
          new Date(s.last_heartbeat).toISOString(),
          new Date(s.expires_at).toISOString(),
        ];
      }),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const bom = '﻿';
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
    const ts = new Date().toISOString().replace(/[:.]/g, '').slice(0, 15);
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `trishteam-sessions-${ts}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    setActionMsg(`✓ Đã export ${filtered.length} sessions ra CSV`);
  }

  useEffect(() => {
    void load();
    // Auto-refresh mỗi 30s để admin thấy gần real-time
    const id = setInterval(() => void load(), 30000);
    return () => clearInterval(id);
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sessions.filter((s) => {
      if (appFilter !== 'all' && s.app_id !== appFilter) return false;
      const geo = geoMap.get(s.ip_address);
      if (countryFilter !== 'all' && geo?.country_code !== countryFilter) return false;
      if (showProxyOnly && !geo?.is_proxy) return false;
      if (!q) return true;
      return (
        s.uid?.toLowerCase().includes(q) ||
        s.machine_id?.toLowerCase().includes(q) ||
        s.ip_address?.toLowerCase().includes(q) ||
        s.key_id?.toLowerCase().includes(q) ||
        s.hostname?.toLowerCase().includes(q) ||
        geo?.country?.toLowerCase().includes(q) ||
        geo?.city?.toLowerCase().includes(q) ||
        geo?.isp?.toLowerCase().includes(q)
      );
    });
  }, [sessions, appFilter, search, geoMap, countryFilter, showProxyOnly]);

  const uniqueCountries = useMemo(() => {
    const set = new Set<string>();
    for (const s of sessions) {
      const geo = geoMap.get(s.ip_address);
      if (geo?.country_code) set.add(geo.country_code);
    }
    return Array.from(set).sort();
  }, [sessions, geoMap]);

  async function handleKick(s: ActiveSessionRow): Promise<void> {
    if (
      !window.confirm(
        `Force kick session?\n\nApp: ${s.app_id}\nUser: ${s.uid ?? '(standalone)'}\nMáy: ${s.machine_id}\nIP: ${s.ip_address}\n\nClient sẽ tự logout sau ~5 giây.`,
      )
    ) {
      return;
    }
    try {
      await kickSession(s.key_id, s.session_id, actor);
      setActionMsg(`✓ Đã kick session ${s.session_id.slice(0, 8)}…`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  const uniqueApps = useMemo(() => {
    return Array.from(new Set(sessions.map((s) => s.app_id))).sort();
  }, [sessions]);

  return (
    <div style={{ padding: 20 }}>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>
          🔌 Active Sessions ({filtered.length}
          {filtered.length !== sessions.length ? ` / ${sessions.length}` : ''})
        </h2>
        <p style={{ margin: '4px 0 0', fontSize: 12, color: '#6B7280' }}>
          Phiên đang chạy của 11 apps. Auto-refresh mỗi 30 giây. Admin có thể force kick.
        </p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="🔍 Search uid / machine / IP / key…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 1,
            minWidth: 240,
            padding: '8px 12px',
            border: '1px solid var(--color-border-default, #D1D5DB)',
            borderRadius: 6,
            fontSize: 13,
          }}
        />
        <select
          value={appFilter}
          onChange={(e) => setAppFilter(e.target.value)}
          style={{
            padding: '8px 12px',
            border: '1px solid var(--color-border-default, #D1D5DB)',
            borderRadius: 6,
            fontSize: 13,
            minWidth: 160,
          }}
        >
          <option value="all">Tất cả apps</option>
          {uniqueApps.map((app) => (
            <option key={app} value={app}>
              {app}
            </option>
          ))}
        </select>
        {uniqueCountries.length > 0 && (
          <select
            value={countryFilter}
            onChange={(e) => setCountryFilter(e.target.value)}
            style={{
              padding: '8px 12px',
              border: '1px solid var(--color-border-default, #D1D5DB)',
              borderRadius: 6,
              fontSize: 13,
              minWidth: 140,
            }}
          >
            <option value="all">🌍 Tất cả nước</option>
            {uniqueCountries.map((cc) => (
              <option key={cc} value={cc}>
                {countryFlagEmoji(cc)} {cc}
              </option>
            ))}
          </select>
        )}
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 10px',
            border: '1px solid var(--color-border-default, #D1D5DB)',
            borderRadius: 6,
            fontSize: 12,
            cursor: 'pointer',
            background: showProxyOnly ? 'rgba(220,38,38,0.1)' : 'transparent',
          }}
        >
          <input
            type="checkbox"
            checked={showProxyOnly}
            onChange={(e) => setShowProxyOnly(e.target.checked)}
          />
          🔒 Chỉ VPN/Proxy
        </label>
        <button
          type="button"
          onClick={exportSessionsCsv}
          disabled={loading || filtered.length === 0}
          style={{
            padding: '8px 12px',
            background: 'transparent',
            color: 'var(--fg)',
            border: '1px solid var(--color-border-default, #D1D5DB)',
            borderRadius: 6,
            fontSize: 13,
            cursor: 'pointer',
          }}
          title="Export CSV"
        >
          📊 CSV
        </button>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          style={{
            padding: '8px 16px',
            background: '#10B981',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {loading ? '⏳ Đang tải…' : geoLoading ? '🌍 Geo…' : '🔄 Refresh'}
        </button>
      </div>

      {actionMsg && (
        <div
          style={{
            padding: 10,
            marginBottom: 12,
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(74, 222, 128, 0.3)',
            borderRadius: 6,
            fontSize: 13,
            color: '#059669',
          }}
        >
          {actionMsg}
        </div>
      )}

      {error && (
        <div
          style={{
            padding: 10,
            marginBottom: 12,
            background: 'rgba(220, 38, 38, 0.1)',
            border: '1px solid rgba(220, 38, 38, 0.3)',
            borderRadius: 6,
            fontSize: 13,
            color: '#DC2626',
          }}
        >
          ⚠ {error}
        </div>
      )}

      <div style={{ overflowX: 'auto', border: '1px solid var(--color-border-subtle, #E5E7EB)', borderRadius: 8 }}>
        <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--color-surface-muted, #F3F4F6)' }}>
              <th style={cellHead}>App</th>
              <th style={cellHead}>User / Machine</th>
              <th style={cellHead}>IP</th>
              <th style={cellHead}>Hostname / OS</th>
              <th style={cellHead}>Bắt đầu</th>
              <th style={cellHead}>Heartbeat cuối</th>
              <th style={cellHead}>Hết hạn</th>
              <th style={cellHead}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: 24, textAlign: 'center', color: '#9CA3AF' }}>
                  {loading ? 'Đang tải…' : 'Không có session active.'}
                </td>
              </tr>
            ) : (
              filtered.map((s) => (
                <tr key={s.session_id} style={{ borderTop: '1px solid var(--color-border-subtle, #E5E7EB)' }}>
                  <td style={cell}>
                    <strong>{s.app_id}</strong>
                  </td>
                  <td style={cell}>
                    {s.uid ? (
                      <>
                        👤 <code>{s.uid.slice(0, 12)}…</code>
                      </>
                    ) : (
                      <>
                        🔒 <code>{s.machine_id.slice(0, 8)}…</code> (standalone)
                      </>
                    )}
                  </td>
                  <td style={cell}>
                    <code>{s.ip_address}</code>
                    {(() => {
                      const geo = geoMap.get(s.ip_address);
                      if (!geo) return null;
                      return (
                        <div style={{ fontSize: 10, color: '#6B7280', marginTop: 2 }}>
                          {countryFlagEmoji(geo.country_code)} {geo.city ?? '—'}
                          {geo.country && `, ${geo.country}`}
                          {geo.isp && (
                            <div style={{ fontSize: 10, color: '#9CA3AF' }}>
                              {geo.isp}
                            </div>
                          )}
                          {geo.is_proxy && (
                            <span
                              style={{
                                display: 'inline-block',
                                marginTop: 2,
                                padding: '1px 6px',
                                background: 'rgba(220,38,38,0.15)',
                                color: '#DC2626',
                                fontSize: 9,
                                borderRadius: 4,
                                fontWeight: 700,
                              }}
                            >
                              🔒 VPN/PROXY
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </td>
                  <td style={cell}>
                    {s.hostname || '—'}
                    {s.os && (
                      <div style={{ fontSize: 10, color: '#9CA3AF' }}>{s.os}</div>
                    )}
                  </td>
                  <td style={cell}>{formatRelative(s.started_at)}</td>
                  <td style={cell}>{formatRelative(s.last_heartbeat)}</td>
                  <td style={cell}>{formatTimestamp(s.expires_at)}</td>
                  <td style={cell}>
                    <button
                      type="button"
                      onClick={() => void handleKick(s)}
                      style={{
                        padding: '4px 10px',
                        background: '#DC2626',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                      title="Force kick session — client sẽ tự logout"
                    >
                      🚪 Kick
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const cellHead: React.CSSProperties = {
  padding: '10px 12px',
  textAlign: 'left',
  fontWeight: 700,
  fontSize: 11,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: '#6B7280',
};

const cell: React.CSSProperties = {
  padding: '10px 12px',
  fontSize: 12,
  verticalAlign: 'middle',
};
