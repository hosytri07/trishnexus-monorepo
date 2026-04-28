'use client';

/**
 * /admin/keys — Quản lý activation keys (Phase 16.3)
 *
 * Chỉ admin truy cập. Tính năng:
 *   - Generate key mới (12 ký tự alphanumeric uppercase ngẫu nhiên)
 *   - List tất cả keys với status (active / used / revoked) + used_by
 *   - Revoke key (active → revoked)
 *   - Copy code vào clipboard
 *   - Note để gắn nhãn key (vd "Cấp cho khách A")
 */

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Copy,
  KeyRound,
  Plus,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Loader2,
} from 'lucide-react';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  doc,
  updateDoc,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, firebaseReady } from '@/lib/firebase';
import { useConfirm } from '@/components/confirm-modal';
import { useAuth } from '@/lib/auth-context';

interface KeyRow {
  id: string;
  code: string;
  status: 'active' | 'used' | 'revoked';
  note?: string;
  used_by_uid?: string;
  used_at?: number;
  expires_at: number;
  created_at: number;
  created_by_uid: string;
}

/**
 * Phase 19.10 — fix key format mismatch giữa web ↔ TrishAdmin desktop.
 * Generate format đồng bộ với TrishAdmin: TRISH-XXXX-XXXX-XXXX
 * (3 nhóm 4 ký tự, alphabet bỏ I/O/0/1 dễ nhầm).
 */
const KEY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomChunk(len: number): string {
  const arr = new Uint8Array(len);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < len; i++) arr[i] = Math.floor(Math.random() * 256);
  }
  let out = '';
  for (let i = 0; i < len; i++) {
    out += KEY_ALPHABET[arr[i]! % KEY_ALPHABET.length];
  }
  return out;
}

/**
 * Phase 19.18 — Format key 16 ký tự ngẫu nhiên + dấu - mỗi 4 ký tự.
 * Stored: XXXX-XXXX-XXXX-XXXX (16 alphanumeric, alphabet 32 chars bỏ I/O/0/1).
 * Bỏ TRISH prefix theo yêu cầu user.
 */
function generateRandomKey(): string {
  return `${randomChunk(4)}-${randomChunk(4)}-${randomChunk(4)}-${randomChunk(4)}`;
}

function formatKeyForDisplay(code: string): string {
  return code ?? '';
}

export default function AdminKeysPage() {
  const router = useRouter();
  const { user, isAdmin, loading } = useAuth();
  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [note, setNote] = useState('');
  const [ConfirmDialog, askConfirm] = useConfirm();
  const [toast, setToast] = useState<{ msg: string; kind: 'ok' | 'err' } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !isAdmin) {
      router.replace('/');
    }
  }, [loading, isAdmin, router]);

  // Subscribe Firestore keys collection (admin only — rules enforce)
  useEffect(() => {
    if (!isAdmin || !firebaseReady || !db) return;
    const q = query(collection(db, 'keys'), orderBy('created_at', 'desc'));
    let unsub: Unsubscribe | null = null;
    try {
      unsub = onSnapshot(
        q,
        (snap) => {
          const rows: KeyRow[] = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<KeyRow, 'id'>),
          }));
          setKeys(rows);
          setLoadingKeys(false);
        },
        (err) => {
          console.error('[admin/keys] subscribe fail', err);
          setToast({ msg: `Lỗi load keys: ${err.message}`, kind: 'err' });
          setLoadingKeys(false);
        },
      );
    } catch (err) {
      console.error('[admin/keys] init subscribe fail', err);
      setLoadingKeys(false);
    }
    return () => {
      if (unsub) unsub();
    };
  }, [isAdmin]);

  function showToast(msg: string, kind: 'ok' | 'err' = 'ok'): void {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 3500);
  }

  async function handleGenerate(e: FormEvent): Promise<void> {
    e.preventDefault();
    if (generating || !user || !db) return;
    setGenerating(true);
    try {
      // Retry tối đa 3 lần nếu trùng code (cực hiếm với 28^12 = ~2e17)
      let code = '';
      for (let i = 0; i < 3; i++) {
        code = generateRandomKey();
        const dup = keys.find((k) => k.code === code);
        if (!dup) break;
      }
      const now = Date.now();
      await addDoc(collection(db, 'keys'), {
        code,
        status: 'active',
        note: note.trim() || null,
        expires_at: 0,
        created_at: now,
        created_by_uid: user.id,
        _server_created_at: serverTimestamp(),
      });
      setNote('');
      showToast(`✓ Đã tạo key ${formatKeyForDisplay(code)}`);
    } catch (err) {
      showToast(
        `Tạo fail: ${err instanceof Error ? err.message : String(err)}`,
        'err',
      );
    } finally {
      setGenerating(false);
    }
  }

  async function handleRevoke(keyId: string): Promise<void> {
    if (!db) return;
    const ok = await askConfirm({
      title: 'Thu hồi key này?',
      message: 'Sau khi thu hồi, key không thể dùng để activate. Hành động không thể khôi phục.',
      okLabel: 'Thu hồi',
      danger: true,
    });
    if (!ok) return;
    try {
      await updateDoc(doc(db, 'keys', keyId), {
        status: 'revoked',
      });
      showToast('Đã thu hồi key');
    } catch (err) {
      showToast(
        `Revoke fail: ${err instanceof Error ? err.message : String(err)}`,
        'err',
      );
    }
  }

  async function handleCopy(code: string, keyId: string): Promise<void> {
    try {
      // Copy với format có gạch để user dễ nhập
      await navigator.clipboard.writeText(formatKeyForDisplay(code));
      setCopiedId(keyId);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      showToast('Copy fail', 'err');
    }
  }

  if (loading) {
    return (
      <div className="admin-loading">
        <Loader2 className="spin" size={28} />
      </div>
    );
  }

  if (!isAdmin) return null;

  const activeCount = keys.filter((k) => k.status === 'active').length;
  const usedCount = keys.filter((k) => k.status === 'used').length;
  const revokedCount = keys.filter((k) => k.status === 'revoked').length;

  return (
    <div className="admin-keys-page"><ConfirmDialog />
      <Link href="/admin" className="admin-back">
        <ArrowLeft size={18} /> Admin
      </Link>

      <header className="admin-keys-header">
        <h1>
          <KeyRound size={24} /> Quản lý Activation Keys
        </h1>
        <div className="admin-keys-stats">
          <span className="stat-pill stat-active">{activeCount} active</span>
          <span className="stat-pill stat-used">{usedCount} used</span>
          <span className="stat-pill stat-revoked">{revokedCount} revoked</span>
        </div>
      </header>

      {/* Generate new key */}
      <section className="admin-section">
        <h2>Tạo key mới</h2>
        <form onSubmit={handleGenerate} className="generate-form">
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ghi chú (vd: 'Cấp cho khách A — Zalo 0901234567'). Optional."
            disabled={generating}
            maxLength={200}
          />
          <button type="submit" disabled={generating}>
            {generating ? (
              <Loader2 size={16} className="spin" />
            ) : (
              <Plus size={16} />
            )}
            {generating ? 'Đang tạo…' : 'Generate'}
          </button>
        </form>
        <p className="admin-hint">
          Key 12 ký tự ngẫu nhiên (chữ hoa + số, loại bỏ 0/O/1/I/S/B dễ nhầm). Trùng cực hiếm.
        </p>
      </section>

      {/* List */}
      <section className="admin-section">
        <h2>Danh sách keys ({keys.length})</h2>
        {loadingKeys ? (
          <p className="muted">Đang tải…</p>
        ) : keys.length === 0 ? (
          <p className="muted">Chưa có key nào. Tạo key đầu tiên ở trên.</p>
        ) : (
          <div className="keys-table-wrap">
            <table className="keys-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Status</th>
                  <th>Ghi chú</th>
                  <th>Tạo lúc</th>
                  <th>Used by / at</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => (
                  <tr key={k.id} className={`status-${k.status}`}>
                    <td>
                      <code className="key-code">{formatKeyForDisplay(k.code)}</code>
                    </td>
                    <td>
                      <StatusBadge status={k.status} />
                    </td>
                    <td className="note-cell">{k.note ?? '—'}</td>
                    <td>
                      <span className="muted small">
                        {new Date(k.created_at).toLocaleString('vi-VN')}
                      </span>
                    </td>
                    <td>
                      {k.used_by_uid ? (
                        <span className="muted small">
                          {k.used_by_uid.slice(0, 8)}…<br />
                          {k.used_at
                            ? new Date(k.used_at).toLocaleString('vi-VN')
                            : ''}
                        </span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          type="button"
                          className="action-btn"
                          onClick={() => void handleCopy(k.code, k.id)}
                          title="Copy code"
                        >
                          {copiedId === k.id ? (
                            <CheckCircle2 size={14} />
                          ) : (
                            <Copy size={14} />
                          )}
                        </button>
                        {k.status === 'active' && (
                          <button
                            type="button"
                            className="action-btn action-danger"
                            onClick={() => void handleRevoke(k.id)}
                            title="Thu hồi key"
                          >
                            <RotateCcw size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {toast && (
        <div className={`admin-toast admin-toast-${toast.kind}`}>{toast.msg}</div>
      )}

      <style jsx>{`
        .admin-keys-page {
          padding: 32px 24px;
          max-width: 1200px;
          margin: 0 auto;
          position: relative;
        }
        .admin-loading {
          min-height: calc(100vh - 60px);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        :global(.spin) {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
        .admin-back {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          color: var(--color-text-muted);
          text-decoration: none;
          font-size: 13px;
          margin-bottom: 16px;
          transition: color 0.2s;
        }
        .admin-back:hover {
          color: var(--color-accent-primary);
        }
        .admin-keys-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
          padding-bottom: 16px;
          border-bottom: 1px solid var(--color-border-subtle);
          flex-wrap: wrap;
          gap: 12px;
        }
        .admin-keys-header h1 {
          margin: 0;
          display: flex;
          align-items: center;
          gap: 10px;
          color: var(--color-text-primary);
          font-size: 1.5rem;
        }
        .admin-keys-stats {
          display: flex;
          gap: 8px;
        }
        .stat-pill {
          padding: 6px 14px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 600;
        }
        .stat-active {
          background: rgba(74, 222, 128, 0.12);
          color: rgb(74, 222, 128);
        }
        .stat-used {
          background: rgba(96, 165, 250, 0.12);
          color: rgb(96, 165, 250);
        }
        .stat-revoked {
          background: rgba(239, 68, 68, 0.12);
          color: rgb(252, 165, 165);
        }
        .admin-section {
          margin-bottom: 32px;
        }
        .admin-section h2 {
          font-size: 1.1rem;
          margin: 0 0 12px;
          color: var(--color-text-primary);
        }
        .generate-form {
          display: flex;
          gap: 8px;
        }
        .generate-form input {
          flex: 1;
          padding: 10px 14px;
          background: var(--color-surface-muted);
          border: 1px solid var(--color-border-subtle);
          border-radius: 10px;
          color: var(--color-text-primary);
          font-size: 13px;
          outline: none;
        }
        .generate-form input:focus {
          border-color: var(--color-accent-primary);
        }
        .generate-form button {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 10px 20px;
          background: var(--color-accent-gradient, var(--color-accent-primary));
          color: #0b1020;
          border: none;
          border-radius: 10px;
          font-weight: 700;
          font-size: 13px;
          cursor: pointer;
          transition: opacity 0.2s;
        }
        .generate-form button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .admin-hint {
          margin-top: 8px;
          font-size: 12px;
          color: var(--color-text-muted);
        }
        .keys-table-wrap {
          overflow-x: auto;
          background: var(--color-surface-bg_elevated);
          border: 1px solid var(--color-border-subtle);
          border-radius: 12px;
        }
        .keys-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }
        .keys-table th,
        .keys-table td {
          padding: 10px 14px;
          text-align: left;
          border-bottom: 1px solid var(--color-border-subtle);
        }
        .keys-table th {
          background: var(--color-surface-muted);
          font-weight: 600;
          color: var(--color-text-muted);
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .keys-table tr:last-child td {
          border-bottom: none;
        }
        .key-code {
          font-family: var(--font-mono, monospace);
          padding: 4px 8px;
          background: var(--color-surface-muted);
          border-radius: 6px;
          font-size: 12px;
          letter-spacing: 0.1em;
          color: var(--color-accent-primary);
        }
        .status-used {
          opacity: 0.7;
        }
        .status-revoked {
          opacity: 0.5;
        }
        .status-revoked .key-code {
          text-decoration: line-through;
        }
        .note-cell {
          max-width: 240px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .row-actions {
          display: flex;
          gap: 6px;
        }
        .action-btn {
          background: var(--color-surface-muted);
          border: 1px solid var(--color-border-subtle);
          color: var(--color-text-muted);
          width: 30px;
          height: 30px;
          border-radius: 6px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s;
        }
        .action-btn:hover {
          background: var(--color-accent-soft, rgba(74, 222, 128, 0.15));
          color: var(--color-accent-primary);
          border-color: var(--color-accent-primary);
        }
        .action-danger:hover {
          background: rgba(239, 68, 68, 0.12);
          color: rgb(252, 165, 165);
          border-color: rgba(239, 68, 68, 0.4);
        }
        .muted {
          color: var(--color-text-muted);
        }
        .small {
          font-size: 11px;
        }
        .admin-toast {
          position: fixed;
          bottom: 20px;
          right: 20px;
          padding: 12px 20px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 500;
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
          z-index: 1000;
        }
        .admin-toast-ok {
          background: var(--color-accent-primary);
          color: #0b1020;
        }
        .admin-toast-err {
          background: rgb(239, 68, 68);
          color: white;
        }
      `}</style>
    </div>
  );
}

function StatusBadge({ status }: { status: string }): JSX.Element {
  const config: Record<string, { label: string; bg: string; color: string; icon: JSX.Element }> = {
    active: {
      label: 'Active',
      bg: 'rgba(74, 222, 128, 0.12)',
      color: 'rgb(74, 222, 128)',
      icon: <CheckCircle2 size={12} />,
    },
    used: {
      label: 'Used',
      bg: 'rgba(96, 165, 250, 0.12)',
      color: 'rgb(96, 165, 250)',
      icon: <KeyRound size={12} />,
    },
    revoked: {
      label: 'Revoked',
      bg: 'rgba(239, 68, 68, 0.12)',
      color: 'rgb(252, 165, 165)',
      icon: <XCircle size={12} />,
    },
  };
  const c = config[status] ?? config.active!;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '3px 8px',
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 600,
        background: c.bg,
        color: c.color,
      }}
    >
      {c.icon}
      {c.label}
    </span>
  );
}
