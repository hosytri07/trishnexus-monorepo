/**
 * Phase 78.13 — DevicesPanel (TrishAdmin).
 *
 * Liệt kê tất cả device đã sync settings TrishUtilities lên Firestore
 * (collection `synced_configs`). Group theo user UID.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getFirebaseDb } from '@trishteam/auth';
import { useAuth } from '@trishteam/auth/react';
import { collection, deleteDoc, doc, getDocs } from 'firebase/firestore';
import { writeAudit } from '../lib/firestore-admin.js';

interface SyncedConfig {
  uid: string;
  deviceId: string;
  deviceName: string;
  appVersion?: string;
  lastSyncedAt: number;
  configs?: Record<string, unknown>;
}

export function DevicesPanel(): JSX.Element {
  const { firebaseUser } = useAuth();
  const [rows, setRows] = useState<SyncedConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const db = getFirebaseDb();
      const snap = await getDocs(collection(db, 'synced_configs'));
      const data = snap.docs.map((d) => d.data() as SyncedConfig);
      data.sort((a, b) => (b.lastSyncedAt ?? 0) - (a.lastSyncedAt ?? 0));
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
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter(
      (r) =>
        r.uid.toLowerCase().includes(q) ||
        r.deviceId.toLowerCase().includes(q) ||
        (r.deviceName ?? '').toLowerCase().includes(q),
    );
  }, [rows, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, SyncedConfig[]>();
    for (const r of filtered) {
      const arr = map.get(r.uid) ?? [];
      arr.push(r);
      map.set(r.uid, arr);
    }
    return Array.from(map.entries()).sort(
      ([, a], [, b]) => Math.max(...b.map((d) => d.lastSyncedAt ?? 0)) - Math.max(...a.map((d) => d.lastSyncedAt ?? 0)),
    );
  }, [filtered]);

  async function handleDelete(c: SyncedConfig): Promise<void> {
    if (!window.confirm(`Xoá synced config của ${c.deviceName} (${c.uid.slice(0, 8)}...)?`)) return;
    try {
      const db = getFirebaseDb();
      await deleteDoc(doc(db, 'synced_configs', `${c.uid}_${c.deviceId}`));
      if (firebaseUser) {
        await writeAudit({
          action: 'synced_config.delete',
          actor_uid: firebaseUser.uid,
          actor_email: firebaseUser.email ?? undefined,
          target_type: 'synced_config',
          target_id: `${c.uid}_${c.deviceId}`,
          target_label: c.deviceName,
          details: { user_uid: c.uid, device_id: c.deviceId, app_version: c.appVersion },
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
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>🖥 Synced Devices</h2>
        <p style={{ margin: '6px 0 0', color: 'var(--color-text-muted)', fontSize: 13 }}>
          Cấu hình TrishUtilities đã sync lên cloud. Mỗi user có 1+ device.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input
          type="text"
          placeholder="Tìm uid / deviceId / tên máy..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={inputStyle}
        />
        <button type="button" onClick={() => void load()} style={btnStyle}>
          ⟲ Refresh
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
        <Stat label="Tổng device" value={rows.length} />
        <Stat label="Số user" value={new Set(rows.map((r) => r.uid)).size} />
        <Stat label="Sync trong 7 ngày" value={rows.filter((r) => (Date.now() - (r.lastSyncedAt ?? 0)) < 7 * 86400_000).length} />
      </div>

      {error && (
        <div style={{ padding: '8px 12px', marginBottom: 12, background: 'rgba(239,68,68,0.1)', color: '#fca5a5', borderRadius: 4 }}>
          ⚠ {error}
        </div>
      )}

      {loading ? (
        <div style={{ color: 'var(--color-text-muted)' }}>Đang tải...</div>
      ) : grouped.length === 0 ? (
        <div
          style={{
            padding: 32,
            textAlign: 'center',
            border: '1px dashed var(--color-border-subtle)',
            borderRadius: 6,
            color: 'var(--color-text-muted)',
          }}
        >
          Chưa có device nào sync lên cloud.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {grouped.map(([uid, configs]) => (
            <div
              key={uid}
              style={{
                border: '1px solid var(--color-border-subtle)',
                borderRadius: 6,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  padding: '8px 12px',
                  background: 'var(--color-surface-bg)',
                  borderBottom: '1px solid var(--color-border-subtle)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <code style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>{uid}</code>
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                  {configs.length} device{configs.length > 1 ? 's' : ''}
                </span>
              </div>
              <div>
                {configs.map((c) => (
                  <div
                    key={c.deviceId}
                    style={{
                      padding: '8px 12px',
                      borderBottom: '1px solid var(--color-border-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>🖥 {c.deviceName}</div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
                        <code style={{ fontFamily: 'ui-monospace, monospace' }}>{c.deviceId.slice(0, 24)}</code>
                        {' · '}
                        v{c.appVersion ?? '?'}
                        {' · '}
                        {c.lastSyncedAt ? new Date(c.lastSyncedAt).toLocaleString('vi-VN') : '—'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleDelete(c)}
                      style={{
                        padding: '4px 10px',
                        background: 'rgba(239,68,68,0.12)',
                        color: '#fca5a5',
                        border: 'none',
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Xoá
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }): JSX.Element {
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
      <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>{value}</div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: '6px 10px',
  background: 'var(--color-surface-bg)',
  border: '1px solid var(--color-border-default)',
  borderRadius: 4,
  color: 'var(--color-text-primary)',
  fontSize: 13,
  fontFamily: 'inherit',
  outline: 'none',
};

const btnStyle: React.CSSProperties = {
  padding: '6px 12px',
  background: 'var(--color-surface-bg)',
  border: '1px solid var(--color-border-default)',
  borderRadius: 4,
  color: 'var(--color-text-primary)',
  fontSize: 13,
  cursor: 'pointer',
};
