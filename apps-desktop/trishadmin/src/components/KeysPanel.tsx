/**
 * Phase 18.7.a — Keys panel.
 *
 * Quản lý activation keys: generate batch, list, revoke, copy code.
 */

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@trishteam/auth/react';
import {
  type ActorContext,
  createKeys,
  formatRelative,
  formatTimestamp,
  listKeys,
  revokeKey,
  deleteKey,
} from '../lib/firestore-admin.js';
import type { ActivationKey } from '@trishteam/data';
import { applyMask, maskKey, maskUid } from '../lib/mask.js';
import { useReveal } from '../lib/use-reveal.js';
import { RevealToggle } from './RevealToggle.js';

interface Props {
  adminUid: string;
}

const STATUS_LABEL: Record<ActivationKey['status'], string> = {
  active: '🟢 Active',
  used: '✅ Used',
  revoked: '🚫 Revoked',
};

export function KeysPanel({ adminUid }: Props): JSX.Element {
  const { firebaseUser } = useAuth();
  const actor: ActorContext = {
    uid: firebaseUser?.uid ?? adminUid,
    email: firebaseUser?.email ?? undefined,
  };
  const [keys, setKeys] = useState<ActivationKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<ActivationKey['status'] | 'all'>('all');
  const [showGenerate, setShowGenerate] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const reveal = useReveal(false);

  async function load(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const list = await listKeys(500);
      setKeys(list);
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
    return keys.filter((k) => {
      if (statusFilter !== 'all' && k.status !== statusFilter) return false;
      if (!q) return true;
      return (
        (k.code ?? '').toLowerCase().includes(q) ||
        (k.note ?? '').toLowerCase().includes(q) ||
        (k.used_by_uid ?? '').toLowerCase().includes(q)
      );
    });
  }, [keys, filter, statusFilter]);

  async function handleRevoke(k: ActivationKey): Promise<void> {
    if (!window.confirm(`Revoke key ${k.code}? Key đã used vẫn giữ user role.`)) return;
    try {
      await revokeKey(k.id, actor, k.code);
      setActionMsg(`✓ Đã revoke ${k.code}`);
      await load();
    } catch (err) {
      setActionMsg(`⚠ Lỗi: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async function handleDelete(k: ActivationKey): Promise<void> {
    if (k.status !== 'revoked') {
      window.alert('Chỉ xóa được key đã revoke (an toàn audit trail).');
      return;
    }
    if (!window.confirm(`Xóa hẳn key ${k.code} khỏi Firestore?`)) return;
    try {
      await deleteKey(k.id, actor, k.code);
      setActionMsg(`✓ Đã xóa ${k.code}`);
      await load();
    } catch (err) {
      setActionMsg(`⚠ Lỗi: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async function copyCode(code: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(code);
      setActionMsg(`📋 Copy ${code}`);
    } catch {
      setActionMsg('⚠ Clipboard không khả dụng');
    }
  }

  return (
    <div className="panel">
      <header className="panel-head">
        <div>
          <h1>🔑 Activation Keys</h1>
          <p className="muted small">
            {keys.length} key trong Firestore. Format: <code>TRISH-XXXX-XXXX-XXXX</code>.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <RevealToggle
            revealed={reveal.revealAll}
            onToggle={reveal.toggleAll}
            variant="header"
            showLabel
            overrideCount={reveal.hasRowOverrides ? keys.length : 0}
            disabled={loading}
          />
          <button type="button" className="btn btn-ghost" onClick={() => void load()} disabled={loading}>
            {loading ? '⏳' : '🔄'} Refresh
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowGenerate(true)}
          >
            ＋ Sinh keys mới
          </button>
        </div>
      </header>

      <div className="filter-row">
        <input
          type="search"
          placeholder="🔍 Tìm code / note / UID đã dùng…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="input"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as ActivationKey['status'] | 'all')}
          className="input"
        >
          <option value="all">Tất cả status</option>
          <option value="active">🟢 Active</option>
          <option value="used">✅ Used</option>
          <option value="revoked">🚫 Revoked</option>
        </select>
      </div>

      {error && <div className="error-banner">⚠ {error}</div>}
      {actionMsg && (
        <div className="info-banner" onClick={() => setActionMsg(null)}>
          {actionMsg}
        </div>
      )}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Status</th>
              <th>Note</th>
              <th>Tạo</th>
              <th>Used by</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="muted small" style={{ textAlign: 'center', padding: 24 }}>
                  {loading ? 'Đang tải…' : '(Không có key nào)'}
                </td>
              </tr>
            ) : (
              filtered.map((k) => {
                const rowRevealed = reveal.isRevealed(k.id);
                const usedByShort = k.used_by_uid ? String(k.used_by_uid).slice(0, 10) : '';
                return (
                <tr key={k.id} className={rowRevealed ? 'row-revealed' : 'row-masked'}>
                  <td>
                    <code className="key-code">
                      {applyMask(k.code ?? '(no code)', rowRevealed, maskKey)}
                    </code>
                  </td>
                  <td>
                    <span className={`status-badge status-${k.status ?? 'active'}`}>
                      {STATUS_LABEL[k.status] ?? k.status ?? '?'}
                    </span>
                  </td>
                  <td className="muted small">{k.note ?? '—'}</td>
                  <td title={formatTimestamp(k.created_at)}>
                    {formatRelative(k.created_at)}
                  </td>
                  <td className="muted small">
                    {k.used_by_uid ? (
                      <>
                        <code>
                          {applyMask(usedByShort, rowRevealed, maskUid)}
                          {rowRevealed ? '…' : ''}
                        </code>
                        <br />
                        {formatRelative(k.used_at ?? null)}
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>
                    <div className="row-actions">
                      <RevealToggle
                        revealed={rowRevealed}
                        onToggle={() => reveal.toggleRow(k.id)}
                        variant="inline"
                      />
                      <button
                        type="button"
                        className="btn btn-sm btn-ghost"
                        onClick={() => void copyCode(k.code)}
                        title="Copy code"
                      >
                        📋
                      </button>
                      {k.status === 'active' && (
                        <button
                          type="button"
                          className="btn btn-sm btn-ghost btn-danger"
                          onClick={() => void handleRevoke(k)}
                        >
                          🚫 Revoke
                        </button>
                      )}
                      {k.status === 'revoked' && (
                        <button
                          type="button"
                          className="btn btn-sm btn-ghost btn-danger"
                          onClick={() => void handleDelete(k)}
                          title="Xóa hẳn"
                        >
                          🗑
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {showGenerate && (
        <GenerateKeysModal
          adminUid={adminUid}
          onClose={() => setShowGenerate(false)}
          onDone={async (msg) => {
            setActionMsg(msg);
            await load();
          }}
        />
      )}
    </div>
  );
}

interface GenerateKeysModalProps {
  adminUid: string;
  onClose: () => void;
  onDone: (msg: string) => Promise<void>;
}

function GenerateKeysModal({
  adminUid,
  onClose,
  onDone,
}: GenerateKeysModalProps): JSX.Element {
  const [count, setCount] = useState(1);
  const [note, setNote] = useState('');
  const [expireDays, setExpireDays] = useState(0);
  const [busy, setBusy] = useState(false);
  const [generated, setGenerated] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (count < 1 || count > 50) {
      setError('Count phải từ 1 đến 50');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const expiresAt =
        expireDays > 0 ? Date.now() + expireDays * 24 * 60 * 60 * 1000 : 0;
      const keys = await createKeys(
        {
          count,
          note: note.trim() || undefined,
          expiresAt,
          createdByUid: adminUid,
        },
        { uid: adminUid },
      );
      setGenerated(keys.map((k) => k.code));
      await onDone(`✓ Sinh ${keys.length} key thành công`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function copyAll(): Promise<void> {
    if (!generated) return;
    await navigator.clipboard.writeText(generated.join('\n'));
  }

  return (
    <div className="modal-backdrop" onClick={busy ? undefined : onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 540 }}>
        <header className="modal-head">
          <h2>＋ Sinh activation keys</h2>
          <button className="mini" onClick={onClose} disabled={busy}>×</button>
        </header>
        <div className="modal-body">
          {!generated ? (
            <form onSubmit={handleSubmit}>
              <label className="form-label">
                <span>Số lượng key (1–50)</span>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={count}
                  onChange={(e) => setCount(parseInt(e.target.value, 10) || 1)}
                  disabled={busy}
                />
              </label>
              <label className="form-label">
                <span>Ghi chú (tuỳ chọn)</span>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Cấp cho khách X / batch tháng 4 / …"
                  disabled={busy}
                />
              </label>
              <label className="form-label">
                <span>Hết hạn sau (ngày — 0 = không expire)</span>
                <input
                  type="number"
                  min={0}
                  max={3650}
                  value={expireDays}
                  onChange={(e) => setExpireDays(parseInt(e.target.value, 10) || 0)}
                  disabled={busy}
                />
              </label>
              {error && <div className="error-banner" style={{ marginTop: 8 }}>⚠ {error}</div>}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
                <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  {busy ? '⏳ Đang sinh…' : '🔑 Sinh keys'}
                </button>
              </div>
            </form>
          ) : (
            <div>
              <p>✓ Đã sinh {generated.length} key. Copy ngay vì không hiện lại được.</p>
              <pre className="key-list-output">{generated.join('\n')}</pre>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
                <button type="button" className="btn btn-ghost" onClick={() => void copyAll()}>
                  📋 Copy tất cả
                </button>
                <button type="button" className="btn btn-primary" onClick={onClose}>
                  Đóng
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
