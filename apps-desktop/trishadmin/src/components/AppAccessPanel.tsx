/**
 * Phase 44.5 — AppAccessPanel: cấp/thu hồi quyền user vào 4 app mới.
 *
 * Khác UsersPanel cũ:
 * - Focus 4 app mới: trishwork / trishutilities / trishfinance / trishadmin
 * - Mỗi user 1 row với 4 cột app + checkbox enable + input số ngày
 * - Thay thế cơ chế "user nhập key 16 ký tự" cũ — admin trực tiếp tick + Save
 *
 * Lưu Firestore /users/{uid}.app_keys[appId] = { key_id, activated_at, expires_at }
 */

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@trishteam/auth/react';
import type { TrishUser } from '@trishteam/data';
import {
  type ActorContext,
  listUsers,
  grantAppAccess,
  revokeAppAccess,
} from '../lib/firestore-admin.js';

/** 4 app mới Phase 44. */
const APPS = [
  { id: 'trishwork',      label: 'TrishWork',      color: '#34D399' },
  { id: 'trishutilities', label: 'TrishUtilities', color: '#A78BFA' },
  { id: 'trishfinance',   label: 'TrishFinance',   color: '#FBBF24' },
  { id: 'trishadmin',     label: 'TrishAdmin',     color: '#F87171' },
] as const;

const DEFAULT_DURATION_DAYS = 365;

interface RowDraft {
  uid: string;
  email: string;
  grants: Partial<Record<string, { enabled: boolean; days: number }>>;
}

function buildDraft(user: TrishUser): RowDraft {
  const now = Date.now();
  const grants: RowDraft['grants'] = {};
  for (const app of APPS) {
    const binding = user.app_keys?.[app.id];
    if (binding) {
      const days = binding.expires_at > 0
        ? Math.max(0, Math.ceil((binding.expires_at - now) / 86_400_000))
        : 0; // 0 = vĩnh viễn
      grants[app.id] = { enabled: true, days };
    } else {
      grants[app.id] = { enabled: false, days: DEFAULT_DURATION_DAYS };
    }
  }
  return { uid: user.id, email: user.email, grants };
}

export function AppAccessPanel(): JSX.Element {
  const { firebaseUser } = useAuth();
  const actor: ActorContext = {
    uid: firebaseUser?.uid ?? '',
    email: firebaseUser?.email ?? undefined,
  };

  const [users, setUsers] = useState<TrishUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [drafts, setDrafts] = useState<Record<string, RowDraft>>({});
  const [savingUid, setSavingUid] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  useEffect(() => {
    void reload();
  }, []);

  async function reload(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const list = await listUsers(500);
      setUsers(list);
      const map: Record<string, RowDraft> = {};
      for (const u of list) map[u.id] = buildDraft(u);
      setDrafts(map);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  const filteredUsers = useMemo(() => {
    if (!filter.trim()) return users;
    const q = filter.toLowerCase();
    return users.filter(
      (u) =>
        u.email.toLowerCase().includes(q) ||
        u.display_name?.toLowerCase().includes(q) ||
        u.id.toLowerCase().includes(q),
    );
  }, [users, filter]);

  function updateGrant(uid: string, appId: string, patch: Partial<{ enabled: boolean; days: number }>): void {
    setDrafts((prev) => {
      const row = prev[uid];
      if (!row) return prev;
      return {
        ...prev,
        [uid]: {
          ...row,
          grants: {
            ...row.grants,
            [appId]: { ...row.grants[appId]!, ...patch },
          },
        },
      };
    });
  }

  async function saveRow(uid: string): Promise<void> {
    const row = drafts[uid];
    const user = users.find((u) => u.id === uid);
    if (!row || !user) return;
    setSavingUid(uid);
    setActionMsg(null);
    try {
      for (const app of APPS) {
        const draft = row.grants[app.id];
        if (!draft) continue;
        const currentBinding = user.app_keys?.[app.id];
        const currentEnabled = !!currentBinding;

        if (draft.enabled && !currentEnabled) {
          // Mới enable → grant
          await grantAppAccess(uid, app.id, draft.days, actor, user.email);
        } else if (!draft.enabled && currentEnabled) {
          // Mới disable → revoke
          await revokeAppAccess(uid, app.id, actor, user.email);
        } else if (draft.enabled && currentEnabled) {
          // Đã có, check xem days thay đổi không
          const currentDays = currentBinding!.expires_at > 0
            ? Math.ceil((currentBinding!.expires_at - Date.now()) / 86_400_000)
            : 0;
          if (Math.abs(currentDays - draft.days) > 1) {
            // Re-grant để update expiry
            await grantAppAccess(uid, app.id, draft.days, actor, user.email);
          }
        }
      }
      setActionMsg(`✓ Đã lưu cho ${user.email}`);
      await reload();
    } catch (err) {
      setActionMsg(`✗ Lỗi: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSavingUid(null);
    }
  }

  return (
    <div style={{ padding: '20px 24px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 6 }}>
        🔑 Cấp quyền App (Phase 44)
      </h1>
      <p style={{ color: 'var(--color-text-muted, #6b6877)', fontSize: 14, marginBottom: 18 }}>
        Tick app cho từng user + nhập số ngày (0 = vĩnh viễn). Bấm <strong>Lưu</strong> để
        ghi Firestore. User reload app sẽ thấy quyền mới.
      </p>

      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        <input
          type="search"
          placeholder="🔍 Tìm theo email / tên / uid..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{
            flex: 1,
            padding: '8px 12px',
            border: '1px solid var(--color-border-default, rgba(0,0,0,0.12))',
            borderRadius: 8,
            fontSize: 14,
            background: 'var(--color-surface-card, white)',
            color: 'var(--color-text-primary, #1c1b22)',
          }}
        />
        <button
          type="button"
          onClick={() => void reload()}
          style={{
            padding: '8px 16px',
            background: 'var(--color-accent-primary, #dc2626)',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          🔄 Tải lại
        </button>
      </div>

      {actionMsg && (
        <div
          style={{
            padding: '10px 14px',
            background: 'var(--color-surface-muted, #ebe9e3)',
            borderRadius: 8,
            marginBottom: 14,
            fontSize: 13,
          }}
        >
          {actionMsg}
        </div>
      )}

      {loading && <p style={{ color: 'var(--color-text-muted, #6b6877)' }}>⏳ Đang tải users...</p>}
      {error && <p style={{ color: 'var(--color-text-danger, #ef4444)' }}>⚠ {error}</p>}

      {!loading && !error && (
        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: 13,
              background: 'var(--color-surface-card, white)',
              borderRadius: 10,
            }}
          >
            <thead>
              <tr style={{ background: 'var(--color-surface-muted, #ebe9e3)' }}>
                <th style={th}>User</th>
                <th style={th}>Role</th>
                {APPS.map((app) => (
                  <th key={app.id} style={{ ...th, borderBottom: `3px solid ${app.color}` }}>
                    {app.label}
                  </th>
                ))}
                <th style={th}>Lưu</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => {
                const row = drafts[user.id];
                if (!row) return null;
                const isSaving = savingUid === user.id;
                return (
                  <tr key={user.id} style={{ borderBottom: '1px solid var(--color-border-subtle, rgba(0,0,0,0.06))' }}>
                    <td style={td}>
                      <div style={{ fontWeight: 500 }}>{user.email}</div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted, #6b6877)' }}>
                        {user.display_name || user.id.slice(0, 12)}
                      </div>
                    </td>
                    <td style={td}>{user.role}</td>
                    {APPS.map((app) => {
                      const draft = row.grants[app.id]!;
                      return (
                        <td key={app.id} style={td}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <input
                              type="checkbox"
                              checked={draft.enabled}
                              onChange={(e) =>
                                updateGrant(user.id, app.id, { enabled: e.target.checked })
                              }
                              disabled={isSaving}
                            />
                            <input
                              type="number"
                              min={0}
                              max={9999}
                              value={draft.days}
                              onChange={(e) =>
                                updateGrant(user.id, app.id, { days: Number(e.target.value) || 0 })
                              }
                              disabled={!draft.enabled || isSaving}
                              title="Số ngày (0 = vĩnh viễn)"
                              style={{
                                width: 56,
                                padding: '4px 6px',
                                border: '1px solid var(--color-border-default, rgba(0,0,0,0.12))',
                                borderRadius: 4,
                                fontSize: 12,
                              }}
                            />
                            <span style={{ fontSize: 11, color: 'var(--color-text-muted, #6b6877)' }}>
                              ng
                            </span>
                          </label>
                        </td>
                      );
                    })}
                    <td style={td}>
                      <button
                        type="button"
                        onClick={() => void saveRow(user.id)}
                        disabled={isSaving}
                        style={{
                          padding: '6px 12px',
                          background: isSaving ? '#aaa' : 'var(--color-accent-primary, #dc2626)',
                          color: 'white',
                          border: 'none',
                          borderRadius: 6,
                          cursor: isSaving ? 'wait' : 'pointer',
                          fontSize: 12,
                          fontWeight: 500,
                        }}
                      >
                        {isSaving ? '⏳' : '💾 Lưu'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredUsers.length === 0 && (
            <p style={{ color: 'var(--color-text-muted, #6b6877)', padding: '20px', textAlign: 'center' }}>
              Không có user nào khớp filter.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

const th: React.CSSProperties = {
  textAlign: 'left',
  padding: '10px 12px',
  fontWeight: 500,
  fontSize: 12,
  color: 'var(--color-text-secondary, #3f3d4a)',
  borderBottom: '1px solid var(--color-border-default, rgba(0,0,0,0.12))',
};

const td: React.CSSProperties = {
  padding: '10px 12px',
  verticalAlign: 'middle',
  color: 'var(--color-text-primary, #1c1b22)',
};
