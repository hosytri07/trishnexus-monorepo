/**
 * Phase 18.7.a + Phase 38.7 — Users panel.
 *
 * Quản lý user Firestore: filter, đổi role (4 cấp: trial/demo/user/admin),
 * set demo expiry days, toggle ISO/Finance, reset trial, xóa.
 *
 * Phase 38.7 changes:
 * - Thêm role 'demo' với input số ngày (mặc định 30, max 365)
 * - Cột demo expiry trong table (cảnh báo khi ≤ 7 ngày)
 * - Replace window.confirm/prompt bằng custom ConfirmModal (memory rule no browser popup)
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
  setUserIsoAdmin,
  setUserFinanceUser,
  setUserRole,
} from '../lib/firestore-admin.js';
import type { TrishUser, UserRole } from '@trishteam/data';
import { applyMask, maskEmail, maskKey, maskName, maskUid } from '../lib/mask.js';
import { useReveal } from '../lib/use-reveal.js';
import { RevealToggle } from './RevealToggle.js';

const ROLE_OPTIONS: UserRole[] = ['trial', 'demo', 'user', 'admin'];
const ROLE_LABEL: Record<UserRole, string> = {
  trial: '✨ Trial',
  demo: '⏳ Demo',
  user: '✅ User',
  admin: '🛡 Admin',
};

const DEMO_DAYS_DEFAULT = 30;
const DEMO_DAYS_MIN = 1;
const DEMO_DAYS_MAX = 365;
const DEMO_WARNING_THRESHOLD_DAYS = 7;

function formatDemoExpiry(expMs?: number, now: number = Date.now()): {
  text: string;
  daysLeft: number;
  expired: boolean;
} {
  if (!expMs || expMs <= 0) return { text: '—', daysLeft: 0, expired: true };
  const diffMs = expMs - now;
  const daysLeft = Math.ceil(diffMs / 86_400_000);
  if (diffMs <= 0) return { text: 'Hết hạn', daysLeft: 0, expired: true };
  if (daysLeft <= 1) return { text: '< 1 ngày', daysLeft: 1, expired: false };
  return { text: `${daysLeft} ngày`, daysLeft, expired: false };
}

interface ConfirmAction {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  /** Yêu cầu user gõ chính xác text này để xác nhận (vd email cho delete). */
  requireText?: string;
  onConfirm: () => Promise<void> | void;
}

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
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
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

  async function handleSaveRole(
    user: TrishUser,
    newRole: UserRole,
    demoDays?: number,
  ): Promise<void> {
    try {
      await setUserRole(user.id, newRole, actor, user.email, demoDays);
      const suffix =
        newRole === 'demo' && demoDays
          ? ` (${demoDays} ngày)`
          : '';
      setActionMsg(`✓ Đổi role ${user.email} → ${ROLE_LABEL[newRole]}${suffix}`);
      await load();
      setEditing(null);
    } catch (err) {
      setActionMsg(`⚠ Lỗi: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  function handleToggleIsoAdmin(user: TrishUser): void {
    const next = !user.iso_admin;
    setConfirmAction({
      title: next ? 'Cấp quyền ISO Editor' : 'Thu hồi quyền ISO Editor',
      message: `${next ? 'CẤP' : 'THU HỒI'} quyền chỉnh sửa TrishISO cho ${user.email}?`,
      confirmLabel: next ? 'Cấp quyền' : 'Thu hồi',
      danger: !next,
      onConfirm: async () => {
        await setUserIsoAdmin(user.id, next, actor, user.email);
        setActionMsg(`✓ ${next ? 'Đã cấp' : 'Đã thu hồi'} quyền ISO Editor cho ${user.email}`);
        await load();
      },
    });
  }

  function handleToggleFinanceUser(user: TrishUser): void {
    const next = !user.finance_user;
    setConfirmAction({
      title: next ? 'Cấp quyền TrishFinance' : 'Thu hồi quyền TrishFinance',
      message:
        `${next ? 'CẤP' : 'THU HỒI'} quyền sử dụng TrishFinance cho ${user.email}?\n\n` +
        `App này không thuộc hệ sinh thái — chỉ user được cấp mới dùng được.`,
      confirmLabel: next ? 'Cấp quyền' : 'Thu hồi',
      danger: !next,
      onConfirm: async () => {
        await setUserFinanceUser(user.id, next, actor, user.email);
        setActionMsg(`✓ ${next ? 'Đã cấp' : 'Đã thu hồi'} quyền TrishFinance cho ${user.email}`);
        await load();
      },
    });
  }

  function handleResetTrial(user: TrishUser): void {
    setConfirmAction({
      title: 'Reset về trial',
      message:
        `Reset ${user.email} về trial?\n\n` +
        `• Mất role hiện tại (admin/user/demo).\n` +
        `• Mất activated key (nếu có).\n` +
        `• User sẽ bị block khi mở app TrishTEAM.`,
      confirmLabel: 'Reset',
      danger: true,
      onConfirm: async () => {
        await resetUserToTrial(user.id, actor, user.email);
        setActionMsg(`✓ Đã reset ${user.email} về trial`);
        await load();
      },
    });
  }

  function handleDelete(user: TrishUser): void {
    setConfirmAction({
      title: 'Xóa tài khoản (Firestore doc)',
      message:
        `XÓA tài khoản ${user.email}?\n\n` +
        `• Mất toàn bộ dữ liệu user trong Firestore (role, key activation, ...).\n` +
        `• Firebase Auth user vẫn còn — user có thể login lại (sẽ thành trial mới).\n` +
        `• Để ban hẳn cần Cloud Function (chưa có UI).\n\n` +
        `Gõ chính xác email để xác nhận:`,
      confirmLabel: 'Xóa',
      danger: true,
      requireText: user.email,
      onConfirm: async () => {
        await deleteUserDoc(user.id, actor, user.email);
        setActionMsg(`✓ Đã xóa doc Firestore của ${user.email}`);
        await load();
      },
    });
  }

  return (
    <div className="panel">
      <header className="panel-head">
        <div>
          <h1>👥 Users</h1>
          <p className="muted small">
            Quản lý {users.length} user trong Firestore. Đổi role / set demo / reset trial.
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
              <th>Demo expiry</th>
              <th>Provider</th>
              <th>Đăng ký</th>
              <th>Last login</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="muted small" style={{ textAlign: 'center', padding: 24 }}>
                  {loading ? 'Đang tải…' : '(Không có user nào khớp filter)'}
                </td>
              </tr>
            ) : (
              filtered.map((u) => {
                const rowRevealed = reveal.isRevealed(u.id);
                const uidShort = (u.id ?? '').slice(0, 10);
                const keyShort = u.activated_key_id ? String(u.activated_key_id).slice(0, 12) : '';
                const demoInfo = u.role === 'demo' ? formatDemoExpiry(u.demo_expires_at) : null;
                const demoColor =
                  demoInfo === null
                    ? undefined
                    : demoInfo.expired
                      ? 'var(--color-danger, #dc2626)'
                      : demoInfo.daysLeft <= DEMO_WARNING_THRESHOLD_DAYS
                        ? 'var(--color-warning, #f59e0b)'
                        : 'var(--color-text-secondary)';
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
                        {u.role ? ROLE_LABEL[u.role as UserRole] : "?"}
                      </span>
                      {keyShort && (
                        <span className="muted small" style={{ display: 'block' }}>
                          🔑 {applyMask(keyShort, rowRevealed, maskKey)}
                          {rowRevealed ? '…' : ''}
                        </span>
                      )}
                    </td>
                    <td
                      style={{ color: demoColor, fontWeight: demoInfo?.expired ? 600 : undefined }}
                      title={
                        demoInfo === null
                          ? undefined
                          : u.demo_expires_at
                            ? formatTimestamp(u.demo_expires_at)
                            : undefined
                      }
                    >
                      {demoInfo === null ? '—' : demoInfo.text}
                    </td>
                    <td className="muted small">{u.provider ?? '—'}</td>
                    <td title={formatTimestamp(u.created_at)}>{formatRelative(u.created_at)}</td>
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
                          className="btn btn-sm btn-ghost"
                          onClick={() => handleToggleIsoAdmin(u)}
                          title={u.iso_admin ? 'Thu hồi quyền ISO Editor' : 'Cấp quyền ISO Editor (TrishISO)'}
                          style={{
                            color: u.iso_admin ? 'var(--color-accent-primary)' : undefined,
                            fontWeight: u.iso_admin ? 700 : undefined,
                          }}
                        >
                          {u.iso_admin ? '✓ ISO' : '○ ISO'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-ghost"
                          onClick={() => handleToggleFinanceUser(u)}
                          title={u.finance_user ? 'Thu hồi quyền TrishFinance' : 'Cấp quyền TrishFinance (off-ecosystem)'}
                          style={{
                            color: u.finance_user ? 'var(--color-accent-primary)' : undefined,
                            fontWeight: u.finance_user ? 700 : undefined,
                          }}
                        >
                          {u.finance_user ? '✓ Finance' : '○ Finance'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-ghost btn-danger"
                          onClick={() => handleResetTrial(u)}
                          title="Reset về trial"
                        >
                          ↺ Trial
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-ghost btn-danger"
                          onClick={() => handleDelete(u)}
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
          onSave={(role, demoDays) => void handleSaveRole(editing, role, demoDays)}
        />
      )}

      {confirmAction && (
        <ConfirmModal
          action={confirmAction}
          onClose={() => setConfirmAction(null)}
          onResult={(msg) => {
            if (msg) setActionMsg(msg);
          }}
        />
      )}
    </div>
  );
}

/* ───────────────────── Edit Role modal ───────────────────── */

interface EditRoleModalProps {
  user: TrishUser;
  onClose: () => void;
  onSave: (role: UserRole, demoDays?: number) => void;
}

function EditRoleModal({ user, onClose, onSave }: EditRoleModalProps): JSX.Element {
  const [role, setRole] = useState<UserRole>(user.role);
  const [demoDays, setDemoDays] = useState<number>(() => {
    if (user.role === 'demo' && user.demo_expires_at) {
      const remaining = Math.max(1, Math.ceil((user.demo_expires_at - Date.now()) / 86_400_000));
      return Math.min(remaining, DEMO_DAYS_MAX);
    }
    return DEMO_DAYS_DEFAULT;
  });

  const isChanged =
    role !== user.role ||
    (role === 'demo' &&
      (() => {
        const cur = user.demo_expires_at
          ? Math.max(1, Math.ceil((user.demo_expires_at - Date.now()) / 86_400_000))
          : DEMO_DAYS_DEFAULT;
        return cur !== demoDays;
      })());

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
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

          {role === 'demo' && (
            <div
              style={{
                marginTop: 16,
                padding: 12,
                background: 'var(--color-surface-elevated, rgba(245, 158, 11, 0.08))',
                borderRadius: 8,
                border: '1px solid rgba(245, 158, 11, 0.3)',
              }}
            >
              <label
                htmlFor="demo-days"
                style={{ display: 'block', fontWeight: 600, marginBottom: 8 }}
              >
                ⏳ Số ngày demo
              </label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  id="demo-days"
                  type="number"
                  min={DEMO_DAYS_MIN}
                  max={DEMO_DAYS_MAX}
                  step={1}
                  value={demoDays}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (Number.isFinite(v)) {
                      setDemoDays(Math.min(Math.max(Math.floor(v), DEMO_DAYS_MIN), DEMO_DAYS_MAX));
                    }
                  }}
                  className="input"
                  style={{ width: 100 }}
                />
                <span className="muted small">ngày (1 – {DEMO_DAYS_MAX})</span>
              </div>
              <div className="muted small" style={{ marginTop: 8 }}>
                Hết hạn: {new Date(Date.now() + demoDays * 86_400_000).toLocaleString('vi-VN')}
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                {[7, 14, 30, 60, 90].map((d) => (
                  <button
                    key={d}
                    type="button"
                    className="btn btn-sm btn-ghost"
                    onClick={() => setDemoDays(d)}
                    style={{
                      borderColor: demoDays === d ? 'var(--color-accent-primary)' : undefined,
                      fontWeight: demoDays === d ? 700 : undefined,
                    }}
                  >
                    {d}d
                  </button>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Hủy
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => onSave(role, role === 'demo' ? demoDays : undefined)}
              disabled={!isChanged}
            >
              💾 Lưu
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────── Confirm modal (replace window.confirm) ───────────────────── */

interface ConfirmModalProps {
  action: ConfirmAction;
  onClose: () => void;
  onResult: (msg: string | null) => void;
}

function ConfirmModal({ action, onClose, onResult }: ConfirmModalProps): JSX.Element {
  const [typedText, setTypedText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const requireMatch =
    action.requireText !== undefined &&
    typedText.trim().toLowerCase() === action.requireText.trim().toLowerCase();
  const canConfirm = action.requireText === undefined || requireMatch;

  async function doConfirm(): Promise<void> {
    if (submitting) return;
    if (action.requireText !== undefined && !requireMatch) {
      setLocalError('Text xác nhận không khớp');
      return;
    }
    setSubmitting(true);
    setLocalError(null);
    try {
      await action.onConfirm();
      onResult(null); // success message do action.onConfirm tự set
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      onResult(`⚠ Lỗi: ${msg}`);
      setLocalError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={submitting ? undefined : onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <header className="modal-head">
          <h2>{action.title}</h2>
          <button className="mini" onClick={onClose} disabled={submitting}>
            ×
          </button>
        </header>
        <div className="modal-body">
          <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5, marginBottom: 12 }}>
            {action.message}
          </p>

          {action.requireText !== undefined && (
            <div style={{ marginBottom: 12 }}>
              <input
                type="text"
                className="input"
                placeholder={action.requireText}
                value={typedText}
                onChange={(e) => {
                  setTypedText(e.target.value);
                  setLocalError(null);
                }}
                autoFocus
                disabled={submitting}
                style={{ width: '100%' }}
              />
              {requireMatch && (
                <div className="muted small" style={{ marginTop: 4, color: 'var(--color-success, #16a34a)' }}>
                  ✓ Khớp — có thể xác nhận
                </div>
              )}
            </div>
          )}

          {localError && (
            <div className="error-banner" style={{ marginBottom: 12 }}>
              ⚠ {localError}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onClose}
              disabled={submitting}
            >
              Hủy
            </button>
            <button
              type="button"
              className={`btn ${action.danger ? 'btn-danger' : 'btn-primary'}`}
              onClick={() => void doConfirm()}
              disabled={submitting || !canConfirm}
            >
              {submitting ? '⏳ Đang xử lý…' : action.confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
