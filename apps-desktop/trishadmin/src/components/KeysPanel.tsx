/**
 * Phase 18.7.a — Keys panel.
 *
 * Quản lý activation keys: generate batch, list, revoke, copy code.
 */

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@trishteam/auth/react';
import {
  type ActorContext,
  bulkRevokeKeys,
  createKeys,
  extendKeyExpiry,
  formatRelative,
  formatTimestamp,
  listKeys,
  resetKeyBinding,
  revokeKey,
  deleteKey,
} from '../lib/firestore-admin.js';
import type { ActivationKey } from '@trishteam/data';
import { applyMask, maskKey, maskUid } from '../lib/mask.js';
import { useReveal } from '../lib/use-reveal.js';
import { RevealToggle } from './RevealToggle.js';
import { KeySecurityModal } from './KeySecurityModal.js';
import { KeyAnalyticsModal } from './KeyAnalyticsModal.js';

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
  const [tagFilter, setTagFilter] = useState<string>('all');
  const [showGenerate, setShowGenerate] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  // Phase 24.3 — Security modal + analytics modal + bulk select
  const [securityModalKey, setSecurityModalKey] = useState<ActivationKey | null>(null);
  const [analyticsModalKey, setAnalyticsModalKey] = useState<ActivationKey | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
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

  const allTags = useMemo(() => {
    const s = new Set<string>();
    for (const k of keys) {
      for (const t of k.tags ?? []) s.add(t);
    }
    return Array.from(s).sort();
  }, [keys]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return keys.filter((k) => {
      if (statusFilter !== 'all' && k.status !== statusFilter) return false;
      if (tagFilter !== 'all' && !(k.tags ?? []).includes(tagFilter)) return false;
      if (!q) return true;
      return (
        (k.code ?? '').toLowerCase().includes(q) ||
        (k.note ?? '').toLowerCase().includes(q) ||
        (k.recipient ?? '').toLowerCase().includes(q) ||
        (k.used_by_uid ?? '').toLowerCase().includes(q) ||
        (k.bound_machine_id ?? '').toLowerCase().includes(q) ||
        (k.tags ?? []).some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [keys, filter, statusFilter, tagFilter]);

  function toggleSelect(id: string): void {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  }

  function toggleSelectAll(): void {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((k) => k.id)));
    }
  }

  async function handleBulkRevoke(): Promise<void> {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (
      !window.confirm(
        `Revoke ${ids.length} keys cùng lúc?\n\nKey đã used vẫn giữ user role (chỉ block activation tương lai). Hành động ghi audit log.`,
      )
    )
      return;
    try {
      const res = await bulkRevokeKeys(ids, actor);
      setActionMsg(
        res.failed > 0
          ? `⚠ Revoke ${res.success}/${ids.length} thành công, ${res.failed} fail`
          : `✓ Đã revoke ${res.success} keys`,
      );
      setSelectedIds(new Set());
      await load();
    } catch (err) {
      setActionMsg(`⚠ Lỗi: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async function handleExtend(k: ActivationKey): Promise<void> {
    const daysStr = window.prompt(
      `Gia hạn key ${k.code}\n\nThêm bao nhiêu ngày kể từ hôm nay? (vd 30, 90, 365)\nNhập 0 = vô thời hạn.`,
      '365',
    );
    if (daysStr === null) return;
    const days = parseInt(daysStr, 10);
    if (isNaN(days) || days < 0) {
      setActionMsg('⚠ Số ngày không hợp lệ');
      return;
    }
    const newExpiresAt = days === 0 ? 0 : Date.now() + days * 24 * 60 * 60 * 1000;
    try {
      await extendKeyExpiry(k.id, newExpiresAt, actor, k.code);
      setActionMsg(
        `✓ Đã gia hạn ${k.code} → ${days === 0 ? 'vô thời hạn' : `+${days} ngày`}`,
      );
      await load();
    } catch (err) {
      setActionMsg(`⚠ Lỗi: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async function handleResetBinding(k: ActivationKey): Promise<void> {
    const target = k.bound_uid ?? k.used_by_uid ?? k.bound_machine_id ?? '(none)';
    if (
      !window.confirm(
        `Reset binding cho key ${k.code}?\n\nHiện đang bind: ${target}\n\nKey sẽ về status='active', clear bound_uid + bound_machine_id. User cũ mất quyền dùng. Có thể cấp lại cho user khác.`,
      )
    )
      return;
    try {
      await resetKeyBinding(k.id, actor, k.code);
      setActionMsg(`✓ Đã reset binding ${k.code}`);
      await load();
    } catch (err) {
      setActionMsg(`⚠ Lỗi: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

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
          placeholder="🔍 Tìm code / note / recipient / UID / machine / tag…"
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
        {allTags.length > 0 && (
          <select
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
            className="input"
            title="Filter theo tag"
          >
            <option value="all">Tất cả tags</option>
            {allTags.map((t) => (
              <option key={t} value={t}>
                🏷️ {t}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div
          style={{
            padding: '8px 12px',
            marginBottom: 8,
            background: 'rgba(16,185,129,0.1)',
            border: '1px solid rgba(16,185,129,0.3)',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            fontSize: 13,
          }}
        >
          <strong>✅ Đã chọn {selectedIds.size} keys</strong>
          <button
            type="button"
            className="btn btn-sm btn-danger"
            onClick={() => void handleBulkRevoke()}
          >
            🚫 Bulk Revoke
          </button>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            onClick={() => setSelectedIds(new Set())}
          >
            Bỏ chọn
          </button>
        </div>
      )}

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
              <th style={{ width: 32 }}>
                <input
                  type="checkbox"
                  checked={filtered.length > 0 && selectedIds.size === filtered.length}
                  onChange={toggleSelectAll}
                  title="Chọn/bỏ chọn tất cả"
                />
              </th>
              <th>Code</th>
              <th>App / Status</th>
              <th>Concurrent / IP</th>
              <th>Bound</th>
              <th>Hạn / Tags</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="muted small" style={{ textAlign: 'center', padding: 24 }}>
                  {loading ? 'Đang tải…' : '(Không có key nào)'}
                </td>
              </tr>
            ) : (
              filtered.map((k) => {
                const rowRevealed = reveal.isRevealed(k.id);
                const usedByShort = k.used_by_uid ? String(k.used_by_uid).slice(0, 10) : '';
                const machineShort = k.bound_machine_id
                  ? String(k.bound_machine_id).slice(0, 8)
                  : '';
                const wlCount = (k.ip_whitelist ?? []).length;
                const blCount = (k.ip_blacklist ?? []).length;
                const hasIpRules = wlCount > 0 || blCount > 0 || k.block_proxy;
                const isExpired = k.expires_at > 0 && Date.now() >= k.expires_at;
                const expiresInDays =
                  k.expires_at > 0
                    ? Math.ceil((k.expires_at - Date.now()) / (24 * 60 * 60 * 1000))
                    : -1;
                return (
                  <tr key={k.id} className={rowRevealed ? 'row-revealed' : 'row-masked'}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(k.id)}
                        onChange={() => toggleSelect(k.id)}
                      />
                    </td>
                    <td>
                      <code className="key-code">
                        {applyMask(k.code ?? '(no code)', rowRevealed, maskKey)}
                      </code>
                      {k.note && (
                        <div className="muted small" style={{ marginTop: 2 }}>
                          📝 {k.note}
                        </div>
                      )}
                      {k.recipient && (
                        <div className="muted small" style={{ marginTop: 2 }}>
                          👤 {k.recipient}
                        </div>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span className={`status-badge status-${k.status ?? 'active'}`}>
                          {STATUS_LABEL[k.status] ?? k.status ?? '?'}
                        </span>
                        <span className="muted small">
                          {k.app_id === 'all' ? '🌐 all apps' : k.app_id ?? 'all'}
                        </span>
                        <span className="muted small">
                          {k.type === 'standalone' ? '🔒 standalone' : '👤 account'}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: 12 }}>
                        <strong>👥 {k.max_concurrent ?? 1}</strong> max
                        <span className="muted small" style={{ marginLeft: 4 }}>
                          ({k.concurrent_policy === 'kick_oldest' ? 'kick' : 'reject'})
                        </span>
                      </div>
                      <div className="muted small" style={{ marginTop: 4 }}>
                        {hasIpRules ? (
                          <>
                            🛡️ {wlCount > 0 && `WL:${wlCount} `}
                            {blCount > 0 && `BL:${blCount} `}
                            {k.block_proxy && '🔒'}
                          </>
                        ) : (
                          '— (no IP rules)'
                        )}
                      </div>
                    </td>
                    <td className="muted small">
                      {k.bound_uid || k.used_by_uid ? (
                        <>
                          <code>
                            👤 {applyMask(usedByShort, rowRevealed, maskUid)}
                            {rowRevealed ? '…' : ''}
                          </code>
                          <br />
                          <span style={{ fontSize: 11 }}>
                            {formatRelative(k.activated_at ?? k.used_at ?? null)}
                          </span>
                        </>
                      ) : k.bound_machine_id ? (
                        <>
                          <code>🔒 {machineShort}…</code>
                          <br />
                          <span style={{ fontSize: 11 }}>
                            {formatRelative(k.activated_at ?? null)}
                          </span>
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      <div style={{ fontSize: 12 }}>
                        {k.expires_at === 0 ? (
                          <span style={{ color: '#059669' }}>♾️ vô thời hạn</span>
                        ) : isExpired ? (
                          <span style={{ color: '#DC2626' }}>⏰ Hết hạn</span>
                        ) : expiresInDays <= 30 ? (
                          <span style={{ color: '#F59E0B' }} title={formatTimestamp(k.expires_at)}>
                            ⚠️ {expiresInDays}d
                          </span>
                        ) : (
                          <span title={formatTimestamp(k.expires_at)}>
                            {expiresInDays}d
                          </span>
                        )}
                      </div>
                      {(k.tags ?? []).length > 0 && (
                        <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                          {(k.tags ?? []).slice(0, 3).map((t) => (
                            <span
                              key={t}
                              style={{
                                fontSize: 10,
                                padding: '1px 6px',
                                background: 'rgba(59,130,246,0.1)',
                                color: '#2563EB',
                                borderRadius: 8,
                              }}
                            >
                              {t}
                            </span>
                          ))}
                          {(k.tags ?? []).length > 3 && (
                            <span style={{ fontSize: 10, color: '#6B7280' }}>
                              +{(k.tags ?? []).length - 3}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td>
                      <div className="row-actions" style={{ flexWrap: 'wrap', gap: 4 }}>
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
                        <button
                          type="button"
                          className="btn btn-sm btn-ghost"
                          onClick={() => setSecurityModalKey(k)}
                          title="IP rules / concurrent / tags"
                        >
                          🛡️
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-ghost"
                          onClick={() => setAnalyticsModalKey(k)}
                          title="Analytics & history"
                        >
                          📊
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-ghost"
                          onClick={() => void handleExtend(k)}
                          title="Gia hạn expiry"
                        >
                          ⏰
                        </button>
                        {(k.bound_uid || k.used_by_uid || k.bound_machine_id) && (
                          <button
                            type="button"
                            className="btn btn-sm btn-ghost"
                            onClick={() => void handleResetBinding(k)}
                            title="Reset binding (cấp lại key)"
                          >
                            🔄
                          </button>
                        )}
                        {k.status === 'active' && (
                          <button
                            type="button"
                            className="btn btn-sm btn-ghost btn-danger"
                            onClick={() => void handleRevoke(k)}
                            title="Revoke"
                          >
                            🚫
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

      {/* Phase 24.3 — Security modal */}
      {securityModalKey && (
        <KeySecurityModal
          keyDoc={securityModalKey}
          actor={actor}
          onClose={() => setSecurityModalKey(null)}
          onSaved={() => {
            setActionMsg(`✓ Đã update security rules cho ${securityModalKey.code}`);
            void load();
          }}
        />
      )}

      {/* Phase 24.3 — Analytics modal */}
      {analyticsModalKey && (
        <KeyAnalyticsModal
          keyDoc={analyticsModalKey}
          onClose={() => setAnalyticsModalKey(null)}
        />
      )}

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

// Phase 36.1 — App ID options cho key generate (sync với apps-registry.json)
const APP_ID_OPTIONS: { value: string; label: string; type: 'account' | 'standalone' }[] = [
  { value: 'all', label: '🌐 All apps (bundle)', type: 'account' },
  // Account keys
  { value: 'trishlibrary', label: '📚 TrishLibrary', type: 'account' },
  { value: 'trishdrive', label: '☁️ TrishDrive', type: 'account' },
  { value: 'trishdesign', label: '✏️ TrishDesign', type: 'account' },
  { value: 'trishfinance', label: '💰 TrishFinance', type: 'account' },
  { value: 'trishiso', label: '📋 TrishISO', type: 'account' },
  { value: 'trishoffice', label: '🏢 TrishOffice', type: 'account' },
  // Standalone keys
  { value: 'trishshortcut', label: '⌨️ TrishShortcut', type: 'standalone' },
  { value: 'trishcheck', label: '🔍 TrishCheck', type: 'standalone' },
  { value: 'trishclean', label: '🧹 TrishClean', type: 'standalone' },
  { value: 'trishfont', label: '🔤 TrishFont', type: 'standalone' },
];

function GenerateKeysModal({
  adminUid,
  onClose,
  onDone,
}: GenerateKeysModalProps): JSX.Element {
  const [count, setCount] = useState(10);
  const [note, setNote] = useState('');
  const [recipient, setRecipient] = useState('');
  const [expireDays, setExpireDays] = useState(365);
  const [appId, setAppId] = useState('all');
  const [maxConcurrent, setMaxConcurrent] = useState(1);
  const [busy, setBusy] = useState(false);
  const [generated, setGenerated] = useState<{ code: string; id: string }[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Auto-derive type từ appId selected
  const selectedApp = APP_ID_OPTIONS.find((o) => o.value === appId);
  const keyType = selectedApp?.type ?? 'account';

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (count < 1 || count > 500) {
      setError('Số lượng phải từ 1 đến 500');
      return;
    }
    if (maxConcurrent < 1 || maxConcurrent > 99) {
      setError('Max concurrent phải từ 1 đến 99');
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
          recipient: recipient.trim() || undefined,
          expiresAt,
          createdByUid: adminUid,
          type: keyType,
          appId,
          maxConcurrent,
        },
        { uid: adminUid },
      );
      setGenerated(keys.map((k) => ({ code: k.code, id: k.id })));
      await onDone(`✓ Sinh ${keys.length} key (${appId}, ${keyType}) thành công`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function copyAll(): Promise<void> {
    if (!generated) return;
    await navigator.clipboard.writeText(generated.map((k) => k.code).join('\n'));
  }

  function downloadCSV(): void {
    if (!generated) return;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '').slice(0, 15);
    const filename = `trishteam-keys-${appId}-${timestamp}.csv`;

    // Build CSV with UTF-8 BOM for Excel
    const rows = [
      ['Key', 'Type', 'App', 'Expiry', 'Max Concurrent', 'Created At', 'Recipient'],
      ...generated.map((k) => {
        const expiryDate =
          expireDays > 0 ? new Date(Date.now() + expireDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0] : 'Lifetime';
        const createdDate = new Date().toISOString().split('T')[0];
        return [
          k.code,
          keyType,
          appId,
          expiryDate,
          String(maxConcurrent),
          createdDate,
          recipient || '',
        ];
      }),
    ];

    let csv = rows.map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');
    // Add UTF-8 BOM for Excel compatibility
    const bom = '﻿';
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  async function copyEmailTemplate(): Promise<void> {
    if (!generated || generated.length === 0) return;
    const expiryDate =
      expireDays > 0 ? new Date(Date.now() + expireDays * 24 * 60 * 60 * 1000).toLocaleDateString('vi-VN') : 'vô thời hạn';
    const firstKey = generated[0].code;
    const email = `Chào [Tên user],

Admin TrishTEAM gửi bạn key kích hoạt cho app ${appId}:

Key: ${firstKey}${generated.length > 1 ? `\n... (${generated.length} key tổng cộng, xem file đính kèm)` : ''}
Hạn dùng: ${expiryDate}
Số máy đồng thời: ${maxConcurrent}

Hướng dẫn kích hoạt:
1. Mở app TrishAdmin hoặc tài khoản của bạn
2. Nhập key trên
3. Hoàn tất kích hoạt

Trân trọng,
TrishTEAM`;
    await navigator.clipboard.writeText(email);
  }

  return (
    <div className="modal-backdrop" onClick={busy ? undefined : onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 600, maxHeight: '90vh', overflowY: 'auto' }}>
        <header className="modal-head">
          <h2>＋ Sinh activation keys (Bulk)</h2>
          <button className="mini" onClick={onClose} disabled={busy}>×</button>
        </header>
        <div className="modal-body">
          {!generated ? (
            <form onSubmit={handleSubmit}>
              <label className="form-label">
                <span>Số lượng key (1–500, Ctrl+5 = 50, Ctrl+1 = 100, Ctrl+5 = 500)</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={count}
                    onChange={(e) => setCount(parseInt(e.target.value, 10) || 10)}
                    disabled={busy}
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost"
                    onClick={() => setCount(10)}
                    disabled={busy}
                    title="Preset 10"
                  >
                    10
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost"
                    onClick={() => setCount(50)}
                    disabled={busy}
                    title="Preset 50"
                  >
                    50
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost"
                    onClick={() => setCount(100)}
                    disabled={busy}
                    title="Preset 100"
                  >
                    100
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost"
                    onClick={() => setCount(500)}
                    disabled={busy}
                    title="Preset 500"
                  >
                    500
                  </button>
                </div>
              </label>

              {/* Phase 36.1 — App ID + auto-derive type */}
              <label className="form-label">
                <span>App áp dụng key</span>
                <select
                  value={appId}
                  onChange={(e) => setAppId(e.target.value)}
                  disabled={busy}
                  style={{ width: '100%', padding: '6px 8px' }}
                >
                  {APP_ID_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label} ({opt.type})
                    </option>
                  ))}
                </select>
                <small style={{ fontSize: 11, color: '#6B7280', marginTop: 4 }}>
                  Loại key: <strong>{keyType}</strong>{' '}
                  {keyType === 'account'
                    ? '— bind vào user.uid (cần login)'
                    : '— bind vào machine_id (no-login)'}
                </small>
              </label>

              <label className="form-label">
                <span>Max IP/máy đồng thời (1–99)</span>
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={maxConcurrent}
                  onChange={(e) =>
                    setMaxConcurrent(parseInt(e.target.value, 10) || 1)
                  }
                  disabled={busy}
                />
                <small style={{ fontSize: 11, color: '#6B7280' }}>
                  1 = chỉ 1 thiết bị. 5 = team nhỏ. 99 = không giới hạn.
                </small>
              </label>

              <label className="form-label">
                <span>Người nhận key (tuỳ chọn — audit)</span>
                <input
                  type="text"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder="Vd: Anh Nam – Cty XYZ"
                  disabled={busy}
                />
              </label>

              <label className="form-label">
                <span>Ghi chú nội bộ (tuỳ chọn)</span>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Cấp cho tester / batch tháng 5 / …"
                  disabled={busy}
                />
              </label>
              <label className="form-label">
                <span>Hết hạn sau (ngày — 0 = vô thời hạn, default 365)</span>
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
              <div style={{ marginBottom: 16 }}>
                <h3 style={{ margin: '0 0 8px 0', fontSize: 14, fontWeight: 600 }}>
                  ✓ Đã sinh {generated.length} key
                </h3>
                <p style={{ margin: 0, fontSize: 12, color: '#6B7280' }}>
                  Copy ngay vì list không hiện lại được. Export CSV hoặc copy email template.
                </p>
              </div>

              <div
                style={{
                  background: 'var(--color-surface-row, #F9FAFB)',
                  padding: 12,
                  borderRadius: 6,
                  maxHeight: 200,
                  overflowY: 'auto',
                  marginBottom: 12,
                  fontSize: 11,
                  fontFamily: 'monospace',
                  lineHeight: 1.4,
                }}
              >
                {generated.slice(0, 20).map((k, i) => (
                  <div key={i}>{k.code}</div>
                ))}
                {generated.length > 20 && (
                  <div style={{ color: '#9aa0b4', marginTop: 4 }}>
                    ... và {generated.length - 20} key khác
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16, borderTop: '1px solid #E5E7EB', paddingTop: 12 }}>
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  onClick={() => void copyAll()}
                  title="Copy all keys to clipboard"
                >
                  📋 Copy tất cả
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  onClick={downloadCSV}
                  title="Download CSV file for Excel"
                >
                  📊 CSV Export
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  onClick={() => void copyEmailTemplate()}
                  title="Copy email template"
                >
                  📧 Email Template
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
