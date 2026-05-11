/**
 * Phase 38.8 — Promo Codes panel (TrishAdmin desktop).
 *
 * Quản lý promo codes readable (TRIAL2026 dạng). CRUD đầy đủ:
 * - Tạo code mới (code + duration + max_activations + expires + note)
 * - Toggle active/inactive
 * - Xóa hẳn (yêu cầu xác nhận)
 * - Copy code vào clipboard
 * - Realtime stats (activation_count) qua refresh
 *
 * Mirror feature /admin/promo-codes của website.
 */

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@trishteam/auth/react';
import {
  type ActorContext,
  type CreatePromoCodeInput,
  createPromoCode,
  deletePromoCode,
  formatRelative,
  formatTimestamp,
  listPromoCodes,
  togglePromoCodeActive,
} from '../lib/firestore-admin.js';
import type { PromoCode } from '@trishteam/data';

interface ConfirmAction {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  requireText?: string;
  onConfirm: () => Promise<void> | void;
}

export function PromoCodesPanel(): JSX.Element {
  const { firebaseUser } = useAuth();
  const actor: ActorContext = {
    uid: firebaseUser?.uid ?? '',
    email: firebaseUser?.email ?? undefined,
  };

  const [codes, setCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Form state
  const [newCode, setNewCode] = useState('');
  const [newDuration, setNewDuration] = useState<number>(3);
  const [newMaxActivations, setNewMaxActivations] = useState<string>(''); // '' = unlimited
  const [newExpiresDate, setNewExpiresDate] = useState<string>(''); // YYYY-MM-DD
  const [newNote, setNewNote] = useState('');

  async function load(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const list = await listPromoCodes(500);
      setCodes(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const stats = useMemo(() => {
    const total = codes.length;
    const active = codes.filter((c) => c.active !== false).length;
    const totalActivations = codes.reduce(
      (sum, c) => sum + (c.activation_count ?? 0),
      0,
    );
    return { total, active, totalActivations };
  }, [codes]);

  async function handleCreate(): Promise<void> {
    if (submitting) return;
    setSubmitting(true);
    try {
      const input: CreatePromoCodeInput = {
        code: newCode,
        duration_days: newDuration,
        note: newNote.trim() || undefined,
        max_activations: newMaxActivations.trim()
          ? Math.max(1, Math.floor(Number(newMaxActivations)))
          : undefined,
        expires_at: newExpiresDate
          ? new Date(`${newExpiresDate}T23:59:59`).getTime()
          : undefined,
      };
      const created = await createPromoCode(input, actor);
      setActionMsg(`✓ Đã tạo mã ${created.code} (${created.duration_days} ngày demo)`);
      setNewCode('');
      setNewDuration(3);
      setNewMaxActivations('');
      setNewExpiresDate('');
      setNewNote('');
      await load();
    } catch (err) {
      setActionMsg(`⚠ Lỗi: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSubmitting(false);
    }
  }

  function handleToggle(c: PromoCode): void {
    const next = !c.active;
    setConfirmAction({
      title: next ? `Kích hoạt lại ${c.code}` : `Tạm ngưng ${c.code}`,
      message: next
        ? `Bật lại ${c.code} — user có thể nhập lại để kích hoạt demo.`
        : `Tạm ngưng ${c.code} — user nhập sẽ bị reject "inactive". Code không bị xóa, có thể bật lại sau.`,
      confirmLabel: next ? 'Kích hoạt' : 'Tạm ngưng',
      onConfirm: async () => {
        await togglePromoCodeActive(c.code, next, actor);
        setActionMsg(`✓ ${next ? 'Đã bật' : 'Đã ngưng'} ${c.code}`);
        await load();
      },
    });
  }

  function handleDelete(c: PromoCode): void {
    setConfirmAction({
      title: `Xóa mã ${c.code}`,
      message:
        `XÓA HẲN mã ${c.code} khỏi Firestore?\n\n` +
        `• ${c.activation_count ?? 0} user đã dùng — họ vẫn giữ demo (không bị thu hồi).\n` +
        `• Sau khi xóa: code không thể nhập lại; nếu tạo code cùng tên thì user đã dùng vẫn bị chặn "already_used" (vì activated_codes giữ lại).\n` +
        `• Khuyến nghị: dùng "Tạm ngưng" thay vì xóa.\n\n` +
        `Gõ chính xác code để xác nhận:`,
      confirmLabel: 'Xóa hẳn',
      danger: true,
      requireText: c.code,
      onConfirm: async () => {
        await deletePromoCode(c.code, actor);
        setActionMsg(`✓ Đã xóa ${c.code}`);
        await load();
      },
    });
  }

  async function handleCopy(code: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedId(code);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      /* ignore */
    }
  }

  function fmtDate(ms?: number): string {
    if (!ms) return '—';
    return new Date(ms).toLocaleString('vi-VN');
  }

  const canSubmit =
    !submitting &&
    newCode.trim().length >= 4 &&
    newDuration >= 1 &&
    newDuration <= 365;

  return (
    <div className="panel">
      <header className="panel-head">
        <div>
          <h1>🎟 Mã khuyến mãi (Promo Codes)</h1>
          <p className="muted small">
            Code readable (vd <code>TRIAL2026</code>) — user gõ vào để upgrade trial → demo. Mỗi user dùng 1 code 1 lần.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span
            style={{
              padding: '4px 10px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              background: 'rgba(16, 185, 129, 0.15)',
              color: 'rgb(16, 185, 129)',
            }}
          >
            {stats.active} active
          </span>
          <span
            style={{
              padding: '4px 10px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              background: 'rgba(59, 130, 246, 0.15)',
              color: 'rgb(59, 130, 246)',
            }}
          >
            {stats.totalActivations} lượt dùng
          </span>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => void load()}
            disabled={loading}
          >
            {loading ? '⏳' : '🔄'} Refresh
          </button>
        </div>
      </header>

      {/* Create form */}
      <section
        style={{
          marginBottom: 16,
          padding: 16,
          background: 'var(--color-surface-card)',
          border: '1px solid var(--color-border-default)',
          borderRadius: 12,
        }}
      >
        <h2 style={{ marginTop: 0, marginBottom: 12, fontSize: 15 }}>Tạo mã mới</h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1fr 1fr 1.5fr',
            gap: 10,
            marginBottom: 10,
          }}
        >
          <div>
            <label
              className="muted small"
              style={{ display: 'block', marginBottom: 4, fontWeight: 600 }}
            >
              Code (4-32 ký tự, chữ + số)
            </label>
            <input
              type="text"
              className="input"
              placeholder="VD: TRIAL2026"
              value={newCode}
              onChange={(e) => setNewCode(e.target.value.toUpperCase())}
              maxLength={32}
              style={{ fontFamily: 'monospace', letterSpacing: 1, width: '100%' }}
            />
          </div>
          <div>
            <label
              className="muted small"
              style={{ display: 'block', marginBottom: 4, fontWeight: 600 }}
            >
              Số ngày demo (1-365)
            </label>
            <input
              type="number"
              className="input"
              min={1}
              max={365}
              value={newDuration}
              onChange={(e) => setNewDuration(Number(e.target.value) || 1)}
              style={{ width: '100%' }}
            />
          </div>
          <div>
            <label
              className="muted small"
              style={{ display: 'block', marginBottom: 4, fontWeight: 600 }}
            >
              Giới hạn lượt (∞)
            </label>
            <input
              type="number"
              className="input"
              min={1}
              value={newMaxActivations}
              onChange={(e) => setNewMaxActivations(e.target.value)}
              placeholder="Trống = ∞"
              style={{ width: '100%' }}
            />
          </div>
          <div>
            <label
              className="muted small"
              style={{ display: 'block', marginBottom: 4, fontWeight: 600 }}
            >
              Hạn code (∞ nếu trống)
            </label>
            <input
              type="date"
              className="input"
              value={newExpiresDate}
              onChange={(e) => setNewExpiresDate(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <label
              className="muted small"
              style={{ display: 'block', marginBottom: 4, fontWeight: 600 }}
            >
              Ghi chú (optional)
            </label>
            <input
              type="text"
              className="input"
              placeholder="VD: Khuyến mãi ra mắt 2026"
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void handleCreate()}
            disabled={!canSubmit}
          >
            {submitting ? '⏳ Đang tạo…' : '✚ Tạo mã'}
          </button>
        </div>
      </section>

      {error && <div className="error-banner">⚠ {error}</div>}
      {actionMsg && (
        <div className="info-banner" onClick={() => setActionMsg(null)}>
          {actionMsg} <span className="muted small">(click đóng)</span>
        </div>
      )}

      {/* List */}
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Status</th>
              <th>Demo</th>
              <th>Lượt dùng</th>
              <th>Hạn code</th>
              <th>Ghi chú</th>
              <th>Tạo lúc</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {codes.length === 0 ? (
              <tr>
                <td colSpan={8} className="muted small" style={{ textAlign: 'center', padding: 24 }}>
                  {loading ? 'Đang tải…' : '(Chưa có mã nào — tạo mã đầu tiên ở form trên)'}
                </td>
              </tr>
            ) : (
              codes.map((c) => {
                const expired =
                  typeof c.expires_at === 'number' &&
                  c.expires_at > 0 &&
                  c.expires_at < Date.now();
                const quotaFull =
                  typeof c.max_activations === 'number' &&
                  c.max_activations > 0 &&
                  (c.activation_count ?? 0) >= c.max_activations;
                const usable = c.active !== false && !expired && !quotaFull;
                return (
                  <tr key={c.id}>
                    <td>
                      <code
                        style={{
                          fontFamily: 'monospace',
                          fontWeight: 700,
                          letterSpacing: 1,
                        }}
                      >
                        {c.code}
                      </code>
                    </td>
                    <td>
                      {usable ? (
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 600,
                            background: 'rgba(16, 185, 129, 0.15)',
                            color: 'rgb(16, 185, 129)',
                          }}
                        >
                          ✓ Active
                        </span>
                      ) : (
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 600,
                            background: 'rgba(156, 163, 175, 0.2)',
                            color: 'var(--color-text-muted)',
                          }}
                        >
                          {c.active === false
                            ? 'Tạm ngưng'
                            : expired
                              ? 'Hết hạn'
                              : 'Hết lượt'}
                        </span>
                      )}
                    </td>
                    <td>{c.duration_days} ngày</td>
                    <td>
                      <strong>{c.activation_count ?? 0}</strong>
                      {' / '}
                      {c.max_activations && c.max_activations > 0 ? c.max_activations : '∞'}
                    </td>
                    <td>{c.expires_at ? fmtDate(c.expires_at) : '∞'}</td>
                    <td className="muted small">{c.note ?? '—'}</td>
                    <td
                      className="muted small"
                      title={formatTimestamp(c.created_at)}
                    >
                      {formatRelative(c.created_at ?? null)}
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          type="button"
                          className="btn btn-sm btn-ghost"
                          onClick={() => void handleCopy(c.code)}
                          title="Copy code vào clipboard"
                        >
                          {copiedId === c.code ? '✓ Đã copy' : '📋 Copy'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-ghost"
                          onClick={() => handleToggle(c)}
                          title={c.active !== false ? 'Tạm ngưng' : 'Kích hoạt lại'}
                        >
                          {c.active !== false ? '⏸ Ngưng' : '▶ Bật'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-ghost btn-danger"
                          onClick={() => handleDelete(c)}
                          title="Xóa hẳn (không thể hoàn tác)"
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

      {confirmAction && (
        <ConfirmModal
          action={confirmAction}
          onClose={() => setConfirmAction(null)}
        />
      )}
    </div>
  );
}

/* ───────────────────── Confirm modal ───────────────────── */

interface ConfirmModalProps {
  action: ConfirmAction;
  onClose: () => void;
}

function ConfirmModal({ action, onClose }: ConfirmModalProps): JSX.Element {
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
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
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
                style={{ width: '100%', fontFamily: 'monospace', letterSpacing: 1 }}
              />
              {requireMatch && (
                <div
                  className="muted small"
                  style={{ marginTop: 4, color: 'var(--color-success, #16a34a)' }}
                >
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
