/**
 * Phase 24.3 — Security alerts panel.
 *
 * Hiển thị các suspicious activity alerts:
 *   - multi_ip_concurrent: 1 key có >2 IP active trong 5 phút
 *   - ip_outside_whitelist: IP không nằm trong key.ip_whitelist
 *   - ip_in_blacklist: IP khớp blacklist
 *   - proxy_detected: ipapi flag IP là proxy/VPN/Tor
 *
 * Admin có thể:
 *   - Run detector ngay (button "🔍 Quét")
 *   - Acknowledge alert (mark as read)
 *   - Delete alert
 *   - Filter theo severity / type
 */
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@trishteam/auth/react';
import {
  acknowledgeAlert,
  type ActorContext,
  deleteAlert,
  detectSuspiciousActivity,
  formatRelative,
  formatTimestamp,
  listActiveSessions,
  listAlerts,
} from '../lib/firestore-admin.js';
import { geoLookupBatch } from '../lib/geo-lookup.js';
import type { AlertSeverity, AlertType, SecurityAlert } from '@trishteam/data';

interface Props {
  adminUid: string;
}

const TYPE_LABEL: Record<AlertType, string> = {
  multi_ip_concurrent: '🌐 Nhiều IP đồng thời',
  ip_outside_whitelist: '⚠️ IP ngoài whitelist',
  ip_in_blacklist: '🚫 IP trong blacklist',
  proxy_detected: '🔒 VPN/Proxy detected',
  rapid_country_change: '🛫 Đổi nước nhanh',
  unusual_concurrent: '👥 Concurrent bất thường',
};

const SEVERITY_COLOR: Record<AlertSeverity, { bg: string; fg: string; border: string }> = {
  info: { bg: 'rgba(59,130,246,0.1)', fg: '#2563EB', border: 'rgba(59,130,246,0.3)' },
  warning: { bg: 'rgba(245,158,11,0.1)', fg: '#D97706', border: 'rgba(245,158,11,0.3)' },
  critical: { bg: 'rgba(220,38,38,0.1)', fg: '#DC2626', border: 'rgba(220,38,38,0.3)' },
};

export function AlertsPanel({ adminUid }: Props): JSX.Element {
  const { firebaseUser } = useAuth();
  const actor: ActorContext = {
    uid: firebaseUser?.uid ?? adminUid,
    email: firebaseUser?.email ?? undefined,
  };
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [showAcked, setShowAcked] = useState(false);
  const [severityFilter, setSeverityFilter] = useState<AlertSeverity | 'all'>('all');

  async function load(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const list = await listAlerts(300, showAcked);
      setAlerts(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // Auto-refresh every 60s
    const id = setInterval(() => void load(), 60000);
    return () => clearInterval(id);
  }, [showAcked]);

  async function handleScan(): Promise<void> {
    setScanning(true);
    setError(null);
    try {
      // Geo lookup for proxy detection
      const sessions = await listActiveSessions(500);
      const ips = sessions.map((s) => s.ip_address).filter(Boolean);
      const geoMap = await geoLookupBatch(ips);
      // Convert IpGeoCache to simpler shape for detector
      const simpleMap = new Map<string, { is_proxy?: boolean; country_code?: string } | null>();
      for (const [ip, geo] of geoMap.entries()) {
        simpleMap.set(ip, geo ? { is_proxy: geo.is_proxy, country_code: geo.country_code } : null);
      }
      const created = await detectSuspiciousActivity(simpleMap);
      setActionMsg(
        created > 0
          ? `🚨 Phát hiện ${created} alert mới`
          : '✓ Không phát hiện hoạt động đáng ngờ',
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setScanning(false);
    }
  }

  async function handleAck(a: SecurityAlert): Promise<void> {
    try {
      await acknowledgeAlert(a.id, actor);
      setActionMsg(`✓ Đã ack alert ${a.id.slice(0, 8)}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleDelete(a: SecurityAlert): Promise<void> {
    if (!window.confirm(`Xóa alert "${a.message}"?`)) return;
    try {
      await deleteAlert(a.id, actor);
      setActionMsg(`✓ Đã xóa`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  const filtered = useMemo(() => {
    return alerts.filter((a) => {
      if (severityFilter !== 'all' && a.severity !== severityFilter) return false;
      return true;
    });
  }, [alerts, severityFilter]);

  const counts = useMemo(() => {
    return {
      total: alerts.length,
      critical: alerts.filter((a) => a.severity === 'critical').length,
      warning: alerts.filter((a) => a.severity === 'warning').length,
      info: alerts.filter((a) => a.severity === 'info').length,
    };
  }, [alerts]);

  return (
    <div style={{ padding: 20 }}>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>
            🚨 Security Alerts ({filtered.length})
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#6B7280' }}>
            Phát hiện hoạt động đáng ngờ (multi-IP, blacklist hit, VPN). Auto-refresh 60s.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void handleScan()}
            disabled={scanning}
          >
            {scanning ? '⏳ Đang quét…' : '🔍 Quét ngay'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => void load()} disabled={loading}>
            {loading ? '⏳' : '🔄'} Refresh
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 16 }}>
        <StatBox label="Tổng" value={counts.total} />
        <StatBox label="🔴 Critical" value={counts.critical} color="#DC2626" />
        <StatBox label="🟡 Warning" value={counts.warning} color="#D97706" />
        <StatBox label="🔵 Info" value={counts.info} color="#2563EB" />
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value as AlertSeverity | 'all')}
          className="td-select"
          style={{ minWidth: 160 }}
        >
          <option value="all">Tất cả mức</option>
          <option value="critical">🔴 Critical</option>
          <option value="warning">🟡 Warning</option>
          <option value="info">🔵 Info</option>
        </select>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 12px',
            border: '1px solid var(--border)',
            borderRadius: 6,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          <input type="checkbox" checked={showAcked} onChange={(e) => setShowAcked(e.target.checked)} />
          Hiện cả đã ack
        </label>
      </div>

      {error && <div className="error-banner" style={{ marginBottom: 12 }}>⚠ {error}</div>}
      {actionMsg && (
        <div className="info-banner" onClick={() => setActionMsg(null)} style={{ marginBottom: 12 }}>
          {actionMsg}
        </div>
      )}

      {/* List */}
      {filtered.length === 0 ? (
        <div
          style={{
            padding: 32,
            textAlign: 'center',
            color: '#6B7280',
            background: 'var(--bg-soft)',
            borderRadius: 8,
            border: '1px dashed var(--border)',
          }}
        >
          {loading ? '⏳ Đang tải…' : '✅ Không có alert (chưa quét hoặc tất cả đã ack)'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map((a) => (
            <AlertCard key={a.id} alert={a} onAck={handleAck} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

function AlertCard({
  alert,
  onAck,
  onDelete,
}: {
  alert: SecurityAlert;
  onAck: (a: SecurityAlert) => void;
  onDelete: (a: SecurityAlert) => void;
}): JSX.Element {
  const c = SEVERITY_COLOR[alert.severity];
  return (
    <div
      style={{
        padding: 14,
        background: c.bg,
        border: `1px solid ${c.border}`,
        borderRadius: 8,
        opacity: alert.acknowledged ? 0.55 : 1,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: c.fg, textTransform: 'uppercase' }}>
              {alert.severity}
            </span>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{TYPE_LABEL[alert.type]}</span>
            {alert.acknowledged && (
              <span style={{ fontSize: 11, color: '#6B7280' }}>✓ Đã ack</span>
            )}
          </div>
          <div style={{ fontSize: 13, color: 'var(--fg)', marginBottom: 6 }}>{alert.message}</div>
          {alert.key_code && (
            <div style={{ fontSize: 11, color: '#6B7280' }}>
              Key: <code>{alert.key_code}</code>
              {alert.uid && (
                <>
                  {' '}• User: <code>{alert.uid.slice(0, 12)}…</code>
                </>
              )}
            </div>
          )}
          {alert.details && Object.keys(alert.details).length > 0 && (
            <details style={{ marginTop: 6, fontSize: 11 }}>
              <summary style={{ cursor: 'pointer', color: '#6B7280' }}>Chi tiết</summary>
              <pre
                style={{
                  marginTop: 6,
                  padding: 8,
                  background: 'rgba(0,0,0,0.05)',
                  borderRadius: 4,
                  fontSize: 10,
                  overflowX: 'auto',
                }}
              >
                {JSON.stringify(alert.details, null, 2)}
              </pre>
            </details>
          )}
          <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 6 }} title={formatTimestamp(alert.created_at)}>
            {formatRelative(alert.created_at)}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {!alert.acknowledged && (
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={() => onAck(alert)}
              title="Acknowledge"
            >
              ✓ Ack
            </button>
          )}
          <button
            type="button"
            className="btn btn-sm btn-ghost btn-danger"
            onClick={() => onDelete(alert)}
            title="Xóa"
          >
            🗑
          </button>
        </div>
      </div>
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: number; color?: string }): JSX.Element {
  return (
    <div
      style={{
        padding: 12,
        background: 'var(--bg-soft)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: color ?? 'var(--fg)' }}>{value}</div>
    </div>
  );
}
