/**
 * Phase 78.13 — Scheduled Tasks (TrishUtilities).
 *
 * Hai export:
 *   - ScheduledTasksModal: full modal có backdrop + nút Đóng. Mount từ App.tsx.
 *   - ScheduledTasksPanel: panel content thuần — embed trong Settings tab.
 */
import { useCallback, useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { useAuth } from '@trishteam/auth/react';
import {
  createScheduledTask,
  deleteScheduledTask,
  listScheduledTasksForUser,
  updateScheduledTask,
} from '../lib/scheduled-tasks/firestore.js';
import {
  CADENCES,
  TASK_KINDS,
  type ScheduledTask,
  type ScheduledTaskCadence,
  type ScheduledTaskKind,
} from '../lib/scheduled-tasks/types.js';
import { formatAbsolute, formatRelative } from '../lib/scheduled-tasks/cadence.js';
import { getDeviceId, getDeviceName } from '../lib/scheduled-tasks/device.js';

interface ModalProps {
  onClose: () => void;
}

export function ScheduledTasksModal({ onClose }: ModalProps): JSX.Element {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.55)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(820px, 96vw)',
          maxHeight: '90vh',
          background: 'var(--color-surface-card)',
          border: '1px solid var(--color-border-default)',
          borderRadius: 8,
          display: 'flex',
          flexDirection: 'column',
          color: 'var(--color-text-primary)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '14px 18px',
            borderBottom: '1px solid var(--color-border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>⏰ Lịch chạy tự động</div>
            <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)', marginTop: 2 }}>
              Tasks sẽ tự chạy nền khi app đang mở. Tối đa độ trễ 1 phút.
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: '1px solid var(--color-border-default)',
              padding: '4px 10px',
              borderRadius: 4,
              cursor: 'pointer',
              color: 'var(--color-text-primary)',
              fontSize: 13,
            }}
          >
            Đóng
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 18 }}>
          <ScheduledTasksPanel />
        </div>
      </div>
    </div>
  );
}

export function ScheduledTasksPanel(): JSX.Element {
  const { firebaseUser } = useAuth();
  const uid = firebaseUser?.uid;
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<ScheduledTaskKind>('clean.preview');
  const [cadence, setCadence] = useState<ScheduledTaskCadence>('daily-morning');

  const load = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
    setError(null);
    try {
      const rows = await listScheduledTasksForUser(uid);
      setTasks(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreate(): Promise<void> {
    if (!uid) return;
    if (!name.trim()) {
      setError('Vui lòng đặt tên task.');
      return;
    }
    setError(null);
    try {
      await createScheduledTask({
        uid,
        name: name.trim(),
        kind,
        cadence,
        deviceId: getDeviceId(),
        deviceName: getDeviceName(),
      });
      setName('');
      setShowForm(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleToggle(t: ScheduledTask): Promise<void> {
    setBusyId(t.id);
    try {
      await updateScheduledTask(t.id, { enabled: !t.enabled });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(t: ScheduledTask): Promise<void> {
    if (!window.confirm(`Xoá task "${t.name}"?`)) return;
    setBusyId(t.id);
    try {
      await deleteScheduledTask(t.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  const currentDeviceId = getDeviceId();

  return (
    <div>
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

      {!showForm ? (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          style={{
            padding: '8px 14px',
            background: 'var(--color-accent-primary)',
            color: 'white',
            border: 'none',
            borderRadius: 4,
            fontWeight: 600,
            fontSize: 13,
            cursor: 'pointer',
            marginBottom: 16,
          }}
        >
          + Tạo task mới
        </button>
      ) : (
        <div
          style={{
            background: 'var(--color-surface-bg)',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: 6,
            padding: 14,
            marginBottom: 16,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 12,
          }}
        >
          <label style={{ gridColumn: '1 / -1', fontSize: 12 }}>
            <div style={{ color: 'var(--color-text-muted)', marginBottom: 4 }}>Tên task</div>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="VD: Dọn rác AutoCAD mỗi sáng"
              style={inputStyle}
            />
          </label>
          <label style={{ fontSize: 12 }}>
            <div style={{ color: 'var(--color-text-muted)', marginBottom: 4 }}>Loại task</div>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as ScheduledTaskKind)}
              style={inputStyle}
            >
              {TASK_KINDS.map((k) => (
                <option key={k.kind} value={k.kind}>
                  {k.icon} {k.label}
                </option>
              ))}
            </select>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
              {TASK_KINDS.find((k) => k.kind === kind)?.description}
            </div>
          </label>
          <label style={{ fontSize: 12 }}>
            <div style={{ color: 'var(--color-text-muted)', marginBottom: 4 }}>Tần suất</div>
            <select
              value={cadence}
              onChange={(e) => setCadence(e.target.value as ScheduledTaskCadence)}
              style={inputStyle}
            >
              {CADENCES.map((c) => (
                <option key={c.cadence} value={c.cadence}>
                  {c.label}
                </option>
              ))}
            </select>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
              {CADENCES.find((c) => c.cadence === cadence)?.description}
            </div>
          </label>
          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8, marginTop: 4 }}>
            <button type="button" onClick={() => void handleCreate()} style={primaryBtn}>
              Lưu task
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setName('');
              }}
              style={ghostBtn}
            >
              Hủy
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Đang tải...</div>
      ) : tasks.length === 0 ? (
        <div
          style={{
            padding: 24,
            border: '1px dashed var(--color-border-subtle)',
            borderRadius: 6,
            textAlign: 'center',
            color: 'var(--color-text-muted)',
            fontSize: 13,
          }}
        >
          Chưa có task nào. Tạo task để app tự chạy theo lịch.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {tasks.map((t) => {
            const meta = TASK_KINDS.find((k) => k.kind === t.kind);
            const cad = CADENCES.find((c) => c.cadence === t.cadence);
            const isOwnDevice = t.deviceId === currentDeviceId;
            return (
              <div
                key={t.id}
                style={{
                  border: '1px solid var(--color-border-subtle)',
                  borderRadius: 6,
                  padding: 12,
                  background: 'var(--color-surface-bg)',
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  gap: 10,
                  opacity: t.enabled ? 1 : 0.6,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 14, fontWeight: 700 }}>
                      {meta?.icon} {t.name}
                    </span>
                    <span
                      style={{
                        fontSize: 10.5,
                        padding: '1px 6px',
                        borderRadius: 99,
                        background: 'var(--color-surface-muted)',
                        color: 'var(--color-text-muted)',
                      }}
                    >
                      {cad?.label}
                    </span>
                    {!isOwnDevice && (
                      <span
                        style={{
                          fontSize: 10.5,
                          padding: '1px 6px',
                          borderRadius: 99,
                          background: 'rgba(251,191,36,0.18)',
                          color: '#fbbf24',
                        }}
                        title={`Tạo từ máy: ${t.deviceName ?? t.deviceId}`}
                      >
                        🖥 máy khác
                      </span>
                    )}
                    {t.lastStatus && (
                      <span
                        style={{
                          fontSize: 10.5,
                          padding: '1px 6px',
                          borderRadius: 99,
                          background:
                            t.lastStatus === 'success'
                              ? 'rgba(52,211,153,0.18)'
                              : t.lastStatus === 'error'
                              ? 'rgba(239,68,68,0.18)'
                              : 'rgba(251,191,36,0.18)',
                          color:
                            t.lastStatus === 'success'
                              ? '#34d399'
                              : t.lastStatus === 'error'
                              ? '#fca5a5'
                              : '#fbbf24',
                        }}
                      >
                        {t.lastStatus}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)', marginTop: 4 }}>
                    Tiếp theo: <strong>{formatAbsolute(t.nextRun)}</strong> ({formatRelative(t.nextRun)})
                  </div>
                  {t.lastRun && (
                    <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)', marginTop: 2 }}>
                      Lần trước: {formatRelative(t.lastRun)}
                      {t.lastSummary ? ` — ${t.lastSummary}` : ''}
                      {t.lastError ? ` — ⚠ ${t.lastError}` : ''}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => void handleToggle(t)}
                    disabled={busyId === t.id}
                    style={{
                      ...smallBtn,
                      background: t.enabled
                        ? 'rgba(52,211,153,0.18)'
                        : 'var(--color-surface-muted)',
                      color: t.enabled ? '#34d399' : 'var(--color-text-muted)',
                    }}
                  >
                    {t.enabled ? '● bật' : '○ tắt'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(t)}
                    disabled={busyId === t.id}
                    style={{
                      ...smallBtn,
                      background: 'rgba(239,68,68,0.12)',
                      color: '#fca5a5',
                    }}
                  >
                    Xoá
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div
        style={{
          marginTop: 16,
          paddingTop: 12,
          borderTop: '1px solid var(--color-border-subtle)',
          fontSize: 11,
          color: 'var(--color-text-muted)',
        }}
      >
        Device hiện tại: <code style={codeStyle}>{getDeviceName()}</code> · ID:{' '}
        <code style={codeStyle}>{currentDeviceId.slice(0, 16)}…</code>
      </div>
    </div>
  );
}

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '6px 10px',
  background: 'var(--color-surface-card)',
  border: '1px solid var(--color-border-default)',
  borderRadius: 4,
  color: 'var(--color-text-primary)',
  fontSize: 13,
  fontFamily: 'inherit',
  outline: 'none',
};

const primaryBtn: CSSProperties = {
  padding: '7px 14px',
  background: 'var(--color-accent-primary)',
  color: 'white',
  border: 'none',
  borderRadius: 4,
  fontWeight: 600,
  fontSize: 13,
  cursor: 'pointer',
};

const ghostBtn: CSSProperties = {
  padding: '7px 14px',
  background: 'transparent',
  color: 'var(--color-text-primary)',
  border: '1px solid var(--color-border-default)',
  borderRadius: 4,
  fontSize: 13,
  cursor: 'pointer',
};

const smallBtn: CSSProperties = {
  padding: '3px 10px',
  border: 'none',
  borderRadius: 4,
  fontSize: 11,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const codeStyle: CSSProperties = {
  fontFamily: 'ui-monospace, monospace',
  fontSize: 10,
  background: 'var(--color-surface-bg)',
  padding: '0 4px',
  borderRadius: 3,
};
