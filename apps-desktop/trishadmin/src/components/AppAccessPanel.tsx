/**
 * Phase 44.5 + 45.7 — AppAccessPanel: cấp/thu hồi quyền user vào 4 app.
 * Refactor dùng AppPageHeader + AppCard + AppTable + AppInput + AppButton + AppBadge.
 *
 * Khác KeyGate cũ: admin trực tiếp tick + Save, không cần user nhập key.
 */

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@trishteam/auth/react';
import type { TrishUser } from '@trishteam/data';
import {
  AppPageHeader,
  AppCard,
  AppTable,
  AppInput,
  AppButton,
  AppBadge,
  AppEmpty,
  type AppTableColumn,
} from '@trishteam/design-system';
import {
  type ActorContext,
  listUsers,
  grantAppAccess,
  revokeAppAccess,
} from '../lib/firestore-admin.js';

/** 4 app mới Phase 44. */
const APPS = [
  { id: 'trishwork',      label: 'TrishWork',      color: '#34D399', shortLabel: 'Work' },
  { id: 'trishutilities', label: 'TrishUtilities', color: '#FBBF24', shortLabel: 'Utilities' },
  { id: 'trishfinance',   label: 'TrishFinance',   color: '#2563EB', shortLabel: 'Finance' },
  { id: 'trishadmin',     label: 'TrishAdmin',     color: '#F87171', shortLabel: 'Admin' },
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
        : 0;
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
          grants: { ...row.grants, [appId]: { ...row.grants[appId]!, ...patch } },
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
          await grantAppAccess(uid, app.id, draft.days, actor, user.email);
        } else if (!draft.enabled && currentEnabled) {
          await revokeAppAccess(uid, app.id, actor, user.email);
        } else if (draft.enabled && currentEnabled) {
          const currentDays = currentBinding!.expires_at > 0
            ? Math.ceil((currentBinding!.expires_at - Date.now()) / 86_400_000)
            : 0;
          if (Math.abs(currentDays - draft.days) > 1) {
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

  // Build columns dynamic
  const columns: AppTableColumn<TrishUser>[] = [
    {
      key: 'user',
      label: 'Người dùng',
      width: 260,
      render: (u) => (
        <div>
          <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--color-text-primary)' }}>{u.email}</div>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
            {u.display_name || u.id.slice(0, 12)}
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      label: 'Vai trò',
      width: 100,
      render: (u) => <RoleBadge role={u.role} />,
    },
    ...APPS.map<AppTableColumn<TrishUser>>((app) => ({
      key: app.id,
      label: (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: app.color, display: 'inline-block' }} />
          {app.shortLabel}
        </span>
      ),
      align: 'center' as const,
      width: 130,
      render: (u) => {
        const row = drafts[u.id];
        if (!row) return null;
        const draft = row.grants[app.id]!;
        const isSaving = savingUid === u.id;
        return (
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={draft.enabled}
              onChange={(e) => updateGrant(u.id, app.id, { enabled: e.target.checked })}
              disabled={isSaving}
              style={{ width: 15, height: 15, accentColor: app.color, cursor: 'pointer' }}
            />
            <input
              type="number"
              min={0}
              max={9999}
              value={draft.days}
              onChange={(e) => updateGrant(u.id, app.id, { days: Number(e.target.value) || 0 })}
              disabled={!draft.enabled || isSaving}
              title="Số ngày (0 = vĩnh viễn)"
              style={{
                width: 50,
                padding: '3px 6px',
                border: '1px solid var(--color-border-default)',
                borderRadius: 4,
                fontSize: 12,
                background: draft.enabled ? 'var(--color-surface-card)' : 'var(--color-surface-muted)',
              }}
            />
            <span style={{ fontSize: 10.5, color: 'var(--color-text-muted)' }}>ng</span>
          </label>
        );
      },
    })),
    {
      key: 'actions',
      label: '',
      align: 'right' as const,
      width: 90,
      render: (u) => {
        const isSaving = savingUid === u.id;
        return (
          <AppButton size="sm" loading={isSaving} onClick={() => void saveRow(u.id)}>
            💾 Lưu
          </AppButton>
        );
      },
    },
  ];

  return (
    <div style={{ background: 'var(--color-surface-bg)', minHeight: '100%' }}>
      <AppPageHeader
        title="🔑 Cấp quyền App (Phase 44)"
        subtitle="Tick app cho từng user + nhập số ngày (0 = vĩnh viễn). Bấm Lưu để ghi Firestore."
        actions={
          <AppButton variant="secondary" onClick={() => void reload()} loading={loading}>
            🔄 Tải lại
          </AppButton>
        }
      />

      <div style={{ padding: '18px 24px' }}>
        {/* Search + Status */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 14, alignItems: 'center' }}>
          <div style={{ flex: 1, maxWidth: 400 }}>
            <AppInput
              type="search"
              placeholder="Tìm theo email / tên / uid..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              iconLeft="🔍"
            />
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--color-text-muted)' }}>
            <strong>{filteredUsers.length}</strong> / {users.length} user
          </div>
        </div>

        {/* Status message */}
        {actionMsg && (
          <AppCard variant="ghost" padding="sm" style={{ marginBottom: 14, background: actionMsg.startsWith('✓') ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)', borderColor: actionMsg.startsWith('✓') ? '#10b981' : '#ef4444' }}>
            <div style={{ fontSize: 13, color: actionMsg.startsWith('✓') ? '#047857' : '#b91c1c' }}>
              {actionMsg}
            </div>
          </AppCard>
        )}

        {error && (
          <AppCard variant="ghost" padding="sm" style={{ marginBottom: 14, background: 'rgba(239,68,68,0.08)', borderColor: '#ef4444' }}>
            <div style={{ fontSize: 13, color: '#b91c1c' }}>⚠ {error}</div>
          </AppCard>
        )}

        {/* Table */}
        {!loading && filteredUsers.length === 0 ? (
          <AppEmpty
            icon="👥"
            title={filter ? 'Không có user nào khớp' : 'Chưa có user nào'}
            description={filter ? `Không tìm thấy user khớp "${filter}". Thử từ khóa khác.` : 'Khi user tạo tài khoản, họ sẽ xuất hiện ở đây.'}
          />
        ) : (
          <AppTable
            data={filteredUsers}
            columns={columns}
            keyField="id"
            loading={loading}
            density="normal"
          />
        )}
      </div>
    </div>
  );
}

// Small helper: render role badge
function RoleBadge({ role }: { role: string }): JSX.Element {
  const map: Record<string, { tone: 'warning' | 'info' | 'success' | 'danger' | 'neutral'; label: string }> = {
    trial: { tone: 'warning', label: 'Trial' },
    demo:  { tone: 'info',    label: 'Demo' },
    user:  { tone: 'success', label: 'User' },
    admin: { tone: 'danger',  label: 'Admin' },
  };
  const m = map[role] ?? { tone: 'neutral' as const, label: role };
  return <AppBadge tone={m.tone} dot>{m.label}</AppBadge>;
}
