/**
 * Phase 18.7.a — Users panel.
 *
 * Table users + filter by role + edit role modal + reset trial.
 */

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@trishteam/auth/react';
import {
  type ActorContext,
  deleteUserDoc,
  formatRelative,
  formatTimestamp,
  listUsers,
  resetUserToTrial,
  setUserRole,
} from '../lib/firestore-admin.js';
import type { TrishUser, UserRole } from '@trishteam/data';
import { applyMask, maskEmail, maskKey, maskName, maskUid } from '../lib/mask.js';
import { useReveal } from '../lib/use-reveal.js';
import { RevealToggle } from './RevealToggle.js';

const ROLE_OPTIONS: UserRole[] = ['trial', 'user', 'admin'];
const ROLE_LABEL: Record<UserRole, string> = {
  trial: '✨ Trial',
  user: '✅ User',
  admin: '🛡 Admin',
};

export function UsersPanel(): JSX.Element {
  const { firebaseUser } = useAuth();
  const actor: ActorContext = {
    uid: firebaseUser?.uid ?? '',
    email: firebaseUser?.email ?? undefined,
  };
  const [users, setUsers] = useState<TrishUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
  const [editing, setEditing] = useState<TrishUser | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const reveal = useReveal(false);

  async function load(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const list = await listUsers(500);
      setUsers(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (!q) return true;
      return (
        (u.email ?? '').toLowerCase().includes(q) ||
        (u.display_name ?? '').toLowerCase().includes(q) ||
        (u.id ?? '').toLowerCase().includes(q)
      );
    });
  }, [users, filter, roleFilter]);

  async function handleSaveRole(user: TrishUser, newRole: UserRole): Promise<void> {
    try {
      await setUserRole(user.id, newRole, actor, user.email);
      setActionMsg(`✓ Đổi role ${user.email} → ${ROLE_LABEL[newRole]}`);
      await load();
      setEditing(null);
    } catch (err) {
      setActionMsg(`⚠ Lỗi: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async function handleResetTrial(user: TrishUser): Promise<void> {
    if (!window.confirm(`Reset ${user.email} về trial? Mất role hiện tại + activated key.`)) {
      return;
    }
    try {
      await resetUserToTrial(user.id, actor, user.email);
      setActionMsg(`✓ Đã reset ${user.email} về trial`);
      await load();
    } catch (err) {
      setActionMsg(`⚠ Lỗi: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async function handleDelete(user: TrishUser): Promise<void> {
    // Confirm 2 lần — đây là destructive action
    if (
      !window.confirm(
        `XÓA tài khoản ${user.email}?\n\n` +
          `• Mất toàn bộ dữ liệu user trong Firestore (role, key activation, ...).\n` +
          `• Firebase Auth user vẫn còn — user có thể login lại (sẽ thành trial mới).\n` +
          `• Để ban hẳn cần Cloud Function (chưa có UI).\n\n` +
          `Tiếp tục?`,
      )
    ) {
      return;
    }
    const confirmText = window.prompt(
      `Gõ chính xác email "${user.email}" để xác nhận xóa:`,
    );
    if (confirmText?.trim().toLowerCase() !== user.email.trim().toLowerCase()) {
      setActionMsg('⚠ Hủy — email xác nhận không khớp');
      return;
    }
    try {
      await deleteUserDoc(user.id, actor, user.email);
      setActionMsg(`✓ Đã xóa doc Firestore của ${user.email}`);
      await load();
    } catch (err) {
      setActionMsg(`⚠ Lỗi: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return (
    <div className="panel">
      <header className="panel-head">
        <div>
          <h1>👥 Users</h1>
          <p className="muted small">
            Quản lý {users.length} user trong Firestore. Đổi role / reset trial.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <RevealToggle
            revealed={reveal.revealAll}
            onToggle={reveal.toggleAll}
            variant="header"
            showLabel
            overrideCount={reveal.hasRowOverrides ? users.length : 0}
            disabled={loading}
          />
          <button type="button" className="btn btn-ghost" onClick={() => void load()} disabled={loading}>
            {loading ? '⏳' : '🔄'} Refresh
          </button>
        </div>
      </header>

      <div className="filter-row">
        <input
          type="search"
          placeholder="🔍 Tìm email / tên / UID…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="input"
        />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as UserRole | 'all')}
          className="input"
        >
          <option value="all">Tất cả role</option>
          {ROLE_OPTIONS.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </select>
      </div>

      {error && <div className="error-banner">⚠ {error}</div>}
      {actionMsg && (
        <div className="info-banner" onClick={() => setActionMsg(null)}>
          {actionMsg} <span className="muted small">(click đóng)</span>
        </div>
      )}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Email · Tên</th>
              <th>Role</th>
              <th>Provider</th>
              <th>Đăng ký</th>
              <th>Last login</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="muted small" style={{ textAlign: 'center', padding: 24 }}>
                  {loading ? 'Đang tải…' : '(Không có user nào khớp filter)'}
                </td>
              </tr>
            ) : (
              filtered.map((u) => {
                const rowRevealed = reveal.isRevealed(u.id);
                const uidShort = (u.id ?? '').slice(0, 10);
                const keyShort = u.activated_key_id ? String(u.activated_key_id).slice(0, 12) : '';
                return (
                <tr key={u.id} className={rowRevealed ? 'row-revealed' : 'row-masked'}>
                  <td>
                    <strong>{applyMask(u.email || '(no email)', rowRevealed, maskEmail)}</strong>
                    <span className="muted small" style={{ display: 'block' }}>
                      {applyMask(u.display_name || '(no name)', rowRevealed, maskName)} ·{' '}
                      <code>
                        {applyMask(uidShort || '—', rowRevealed, maskUid)}
                        {rowRevealed && uidShort.length > 0 ? '…' : ''}
                      </code>
                    </span>
                  </td>
                  <td>
                    <span className={`role-badge role-${u.role ?? 'trial'}`}>
                      {ROLE_LABEL[u.role] ?? u.role ?? '?'}
                    </span>
                    {keyShort && (
                      <span className="muted small" style={{ display: 'block' }}>
                        🔑 {applyMask(keyShort, rowRevealed, maskKey)}
                        {rowRevealed ? '…' : ''}
                      </span>
                    )}
                  </td>
                  <td className="muted small">{u.provider ?? '—'}</td>
                  <td title={formatTimestamp(u.created_at)}>
                    {formatRelative(u.created_at)}
                  </td>
                  <td title={formatTimestamp(u.last_login_at)}>
                    {formatRelative(u.last_login_at ?? null)}
                  </td>
                  <td>
                    <div className="row-actions">
                      <RevealToggle
                        revealed={rowRevealed}
                        onToggle={() => reveal.toggleRow(u.id)}
                        variant="inline"
                      />
                      <button
                        type="button"
                        className="btn btn-sm btn-ghost"
                        onClick={() => setEditing(u)}
                        title="Đổi role"
                      >
                        ✏ Role
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-ghost btn-danger"
                        onClick={() => void handleResetTrial(u)}
                        title="Reset về trial"
                      >
                        ↺ Trial
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-ghost btn-danger"
                        onClick={() => void handleDelete(u)}
                        title="Xóa tài khoản (Firestore doc)"
                      >
                        🗑
                      </button>
                    </div>
                  </td>
                </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <EditRoleModal
          user={editing}
          onClose={() => setEditing(null)}
          onSave={(role) => void handleSaveRole(editing, role)}
        />
      )}
    </div>
  );
}

interface EditRoleModalProps {
  user: TrishUser;
  onClose: () => void;
  onSave: (role: UserRole) => void;
}

function EditRoleModal({ user, onClose, onSave }: EditRoleModalProps): JSX.Element {
  const [role, setRole] = useState<UserRole>(user.role);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
        <header className="modal-head">
          <h2>Đổi role — {user.email}</h2>
          <button className="mini" onClick={onClose}>×</button>
        </header>
        <div className="modal-body">
          <p className="muted small">
            Role hiện tại: <strong>{ROLE_LABEL[user.role]}</strong>. Đổi sẽ cập nhật ngay
            Firestore + áp dụng cho mọi app TrishTEAM ở lần fetch tiếp theo.
          </p>
          <div className="role-picker">
            {ROLE_OPTIONS.map((r) => (
              <label key={r} className={`role-option ${role === r ? 'active' : ''}`}>
                <input
                  type="radio"
                  name="role"
                  value={r}
                  checked={role === r}
                  onChange={() => setRole(r)}
                />
                <span>{ROLE_LABEL[r]}</span>
              </label>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Hủy
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => onSave(role)}
              disabled={role === user.role}
            >
              💾 Lưu
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
