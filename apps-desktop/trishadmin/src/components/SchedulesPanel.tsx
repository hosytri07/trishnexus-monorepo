/**
 * Phase 78.13 — Schedule Manager Panel (TrishAdmin).
 *
 * Admin view: tất cả scheduled_tasks/{taskId} (filter by uid, kind, status).
 * Read-only ngoại trừ disable + xoá (đề phòng task lỗi liên tục).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getFirebaseDb } from '@trishteam/auth';
import { useAuth } from '@trishteam/auth/react';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  updateDoc,
} from 'firebase/firestore';
import { writeAudit } from '../lib/firestore-admin.js';

interface ScheduledTask {
  id: string;
  uid: string;
  name: string;
  kind: string;
  cadence: string;
  enabled: boolean;
  nextRun: number;
  lastRun?: number;
  lastStatus?: string;
  lastError?: string;
  lastSummary?: string;
  deviceId: string;
  deviceName?: string;
  createdAt?: number;
  updatedAt?: number;
}

const KIND_LABELS: Record<string, string> = {
  'clean.preview': '🔍 Clean preview',
  'clean.full': '🧹 Clean full',
  'check.report': '📊 Check report',
  'font.scan-system': '🔤 Font scan',
};

const CADENCE_LABELS: Record<string, string> = {
  hourly: 'Mỗi giờ',
  'daily-morning': 'Sáng 08:00',
  'daily-noon': 'Trưa 12:00',
  'daily-evening': 'Tối 19:00',
  'weekly-monday': 'Thứ 2 hàng tuần',
  'weekly-friday': 'Thứ 6 hàng tuần',
  'monthly-first': 'Mùng 1 hàng tháng',
};

export function SchedulesPanel(): JSX.Element {
  const { firebaseUser } = useAuth();
  const [rows, setRows] = useState<ScheduledTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterKind, setFilterKind] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterUid, setFilterUid] = useState<string>('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const db = getFirebaseDb();
      const snap = await getDocs(
        query(collection(db, 'scheduled_tasks'), orderBy('nextRun', 'asc')),
      );
      const data = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ScheduledTask, 'id'>) }));
      setRows(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (filterKind && r.kind !== filterKind) return false;
      if (filterStatus && (r.lastStatus ?? 'idle') !== filterStatus) return false;
      if (filterUid && !r.uid.toLowerCase().includes(filterUid.toLowerCase())) return false;
      return true;
    });
  }, [rows, filterKind, filterStatus, filterUid]);

  const stats = useMemo(() => {
    const total = rows.length;
    const enabled = rows.filter((r) => r.enabled).length;
    const errors = rows.filter((r) => r.lastStatus === 'error').length;
    const overdue = rows.filter((r) => r.enabled && r.nextRun < Date.now()).length;
    return { total, enabled, errors, overdue };
  }, [rows]);

  async function handleToggle(t: ScheduledTask): Promise<void> {
    try {
      const db = getFirebaseDb();
      const next = !t.enabled;
      await updateDoc(doc(db, 'scheduled_tasks', t.id), { enabled: next });
      if (firebaseUser) {
        await writeAudit({
          action: next ? 'schedule.enable' : 'schedule.disable',
          actor_uid: firebaseUser.uid,
          actor_email: firebaseUser.email ?? undefined,
          target_type: 'scheduled_task',
          target_id: t.id,
          target_label: t.name,
          details: { user_uid: t.uid, kind: t.kind, cadence: t.cadence },
        });
      }
      await load();
    } catch (e) {
      alert(`Toggle thất bại: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async function handleDelete(t: ScheduledTask): Promise<void> {
    if (!window.confirm(`Xoá task "${t.name}" của ${t.uid.slice(0, 8)}...?`)) return;
    try {
      const db = getFirebaseDb();
      await deleteDoc(doc(db, 'scheduled_tasks', t.id));
      if (firebaseUser) {
        await writeAudit({
          action: 'schedule.delete',
          actor_uid: firebaseUser.uid,
          actor_email: firebaseUser.email ?? undefined,
          target_type: 'scheduled_task',
          target_id: t.id,
          target_label: t.name,
          details: { user_uid: t.uid, kind: t.kind, cadence: t.cadence, device_id: t.deviceId },
        });
      }
      await load();
    } catch (e) {
      alert(`Xoá thất bại: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>⏰ Schedule Manager</h2>
        <p style={{ margin: '6px 0 0', color: 'var(--color-text-muted)', fontSize: 13 }}>
          Tất cả scheduled tasks toàn user. Read-only ngoại trừ disable + xoá khẩn cấp.
        </p>
      </div>

      {/* Stats */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <StatBox label="Tổng" value={stats.total} />
        <StatBox label="Đang bật" value={stats.enabled} color="#34d399" />
        <StatBox label="Lỗi gần nhất" value={stats.errors} color="#fca5a5" />
        <StatBox label="Quá hạn (chưa chạy)" value={stats.overdue} color="#fbbf24" />
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Filter UID..."
          value={filterUid}
          onChange={(e) => setFilterUid(e.target.value)}
          style={filterInput}
        />
        <select value={filterKind} onChange={(e) => setFilterKind(e.target.value)} style={filterInput}>
          <option value="">— Tất cả loại task —</option>
          {Object.entries(KIND_LABELS).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={filterInput}>
          <option value="">— Mọi status —</option>
          <option value="idle">idle</option>
          <option value="running">running</option>
          <option value="success">success</option>
          <option value="error">error</option>
        </select>
        <button type="button" onClick={() => void load()} style={refreshBtn}>
          ⟲ Refresh
        </button>
      </div>

      {error && (
        <div
          style={{
            padding: '8px 12px',
            marginBottom: 12,
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.3)',
            color: '#fca5a5',
            borderRadius: 4,
            fontSize: 12.5,
          }}
        >
          ⚠ {error}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div style={{ color: 'var(--color-text-muted)' }}>Đang tải...</div>
      ) : filtered.length === 0 ? (
        <div
          style={{
            padding: 32,
            textAlign: 'center',
            border: '1px dashed var(--color-border-subtle)',
            borderRadius: 6,
            color: 'var(--color-text-muted)',
          }}
        >
          Không có task nào khớp filter.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: 'var(--color-surface-bg)', textAlign: 'left' }}>
                <th style={th}>Task</th>
                <th style={th}>User UID</th>
                <th style={th}>Device</th>
                <th style={th}>Tần suất</th>
                <th style={th}>Next run</th>
                <th style={th}>Last result</th>
                <th style={th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => {
                const isOverdue = t.enabled && t.nextRun < Date.now();
                return (
                  <tr key={t.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                    <td style={td}>
                      <div style={{ fontWeight: 600 }}>{t.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                        {KIND_LABELS[t.kind] ?? t.kind}
                      </div>
                    </td>
                    <td style={td}>
                      <code style={codeMono}>{t.uid.slice(0, 12)}…</code>
                    </td>
                    <td style={td}>
                      <div style={{ fontSize: 11 }}>{t.deviceName ?? '—'}</div>
                      <code style={{ ...codeMono, fontSize: 10 }}>{t.deviceId.slice(0, 12)}…</code>
                    </td>
                    <td style={td}>{CADENCE_LABELS[t.cadence] ?? t.cadence}</td>
                    <td style={td}>
                      <div style={{ color: isOverdue ? '#fbbf24' : 'inherit' }}>{formatTs(t.nextRun)}</div>
                      {isOverdue && <div style={{ fontSize: 10, color: '#fbbf24' }}>⚠ quá hạn</div>}
                    </td>
                    <td style={td}>
                      {t.lastStatus ? (
                        <>
                          <span style={{ ...statusPill, ...statusColor(t.lastStatus) }}>{t.lastStatus}</span>
                          {t.lastRun && (
                            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
                              {formatTs(t.lastRun)}
                            </div>
                          )}
                          {t.lastSummary && (
                            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t.lastSummary}>
                              {t.lastSummary}
                            </div>
                          )}
                          {t.lastError && (
                            <div style={{ fontSize: 11, color: '#fca5a5', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t.lastError}>
                              ⚠ {t.lastError}
                            </div>
                          )}
                        </>
                      ) : (
                        <span style={{ color: 'var(--color-text-muted)' }}>—</span>
                      )}
                    </td>
                    <td style={td}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button type="button" onClick={() => void handleToggle(t)} style={miniBtn(t.enabled)}>
                          {t.enabled ? '● bật' : '○ tắt'}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(t)}
                          style={{ ...miniBtn(false), background: 'rgba(239,68,68,0.12)', color: '#fca5a5' }}
                        >
                          Xoá
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: number; color?: string }): JSX.Element {
  return (
    <div
      style={{
        padding: 12,
        background: 'var(--color-surface-bg)',
        border: '1px solid var(--color-border-subtle)',
        borderRadius: 6,
      }}
    >
      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 800, color: color ?? 'var(--color-text-primary)', marginTop: 4 }}>
        {value}
      </div>
    </div>
  );
}

function formatTs(ts: number): string {
  if (!ts) return '—';
  const d = new Date(ts);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function statusColor(status: string): React.CSSProperties {
  switch (status) {
    case 'success':
      return { background: 'rgba(52,211,153,0.18)', color: '#34d399' };
    case 'error':
      return { background: 'rgba(239,68,68,0.18)', color: '#fca5a5' };
    case 'running':
      return { background: 'rgba(251,191,36,0.18)', color: '#fbbf24' };
    default:
      return { background: 'var(--color-surface-muted)', color: 'var(--color-text-muted)' };
  }
}

const th: React.CSSProperties = {
  padding: '8px 10px',
  fontWeight: 700,
  fontSize: 11.5,
  textTransform: 'uppercase',
  color: 'var(--color-text-muted)',
  letterSpacing: 0.5,
  borderBottom: '1px solid var(--color-border-default)',
};

const td: React.CSSProperties = {
  padding: '10px',
  verticalAlign: 'top',
};

const filterInput: React.CSSProperties = {
  padding: '6px 10px',
  background: 'var(--color-surface-bg)',
  border: '1px solid var(--color-border-default)',
  borderRadius: 4,
  color: 'var(--color-text-primary)',
  fontSize: 13,
  fontFamily: 'inherit',
};

const refreshBtn: React.CSSProperties = {
  padding: '6px 12px',
  background: 'var(--color-surface-bg)',
  border: '1px solid var(--color-border-default)',
  borderRadius: 4,
  color: 'var(--color-text-primary)',
  fontSize: 13,
  cursor: 'pointer',
};

const codeMono: React.CSSProperties = {
  fontFamily: 'ui-monospace, monospace',
  fontSize: 11,
  background: 'var(--color-surface-bg)',
  padding: '1px 5px',
  borderRadius: 3,
};

const statusPill: React.CSSProperties = {
  display: 'inline-block',
  fontSize: 10.5,
  padding: '1px 7px',
  borderRadius: 99,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: 0.3,
};

function miniBtn(active: boolean): React.CSSProperties {
  return {
    padding: '3px 9px',
    border: 'none',
    borderRadius: 4,
    fontSize: 11,
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontWeight: 600,
    background: active ? 'rgba(52,211,153,0.18)' : 'var(--color-surface-muted)',
    color: active ? '#34d399' : 'var(--color-text-muted)',
  };
}
