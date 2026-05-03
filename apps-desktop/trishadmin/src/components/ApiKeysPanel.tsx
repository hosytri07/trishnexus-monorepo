/**
 * TrishAdmin — Quản lý API Keys (Phase 28.8).
 *
 * Admin set Groq + Claude key 1 lần ở đây. Sync xuống tất cả TrishDesign
 * instances qua Firestore (encrypted AES-GCM).
 *
 * Schema:
 *   /admin_settings/{tenant}/api_keys/{provider}
 *   /admin_settings/{tenant}/audit_log/{autoId}
 *
 * Multi-tenant: dropdown chọn tenant (default 'default'). Lưu localStorage
 * trishteam.tenant_id để các app khác đọc cùng tenant.
 */

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@trishteam/auth/react';
import {
  ALL_PROVIDERS,
  DEFAULT_PROVIDERS,
  FEEDBACK_PROVIDERS,
  PROVIDER_LABEL,
  PROVIDER_PLACEHOLDER,
  PROVIDER_FREE,
  DEFAULT_TENANT_ID,
  type ApiKeyProvider,
  type AuditLogEntry,
  saveApiKey,
  loadAllApiKeys,
  loadApiKeyMeta,
  loadAuditLog,
  getActiveTenantId,
  setActiveTenantId,
  validateTenantId,
} from '@trishteam/admin-keys';

interface KeyMeta {
  updatedAt: number;
  modifiedBy: string;
  modifiedByEmail: string;
}

function fmtTime(ms: number): string {
  if (!ms) return '—';
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function ApiKeysPanel(): JSX.Element {
  const { firebaseUser } = useAuth();
  const adminUid = firebaseUser?.uid ?? '';
  const adminEmail = firebaseUser?.email ?? '';

  const [tenant, setTenant] = useState<string>(() => getActiveTenantId());
  const [tenantInput, setTenantInput] = useState<string>(() => getActiveTenantId());
  const [keys, setKeys] = useState<Record<ApiKeyProvider, string>>({ groq: '', gemini: '', claude: '', tg_feedback_bot: '', tg_feedback_chat: '', tg_lisp_chat: '' });
  const [drafts, setDrafts] = useState<Record<ApiKeyProvider, string>>({ groq: '', gemini: '', claude: '', tg_feedback_bot: '', tg_feedback_chat: '', tg_lisp_chat: '' });
  const [meta, setMeta] = useState<Record<ApiKeyProvider, KeyMeta | null>>({ groq: null, gemini: null, claude: null, tg_feedback_bot: null, tg_feedback_chat: null, tg_lisp_chat: null });
  const [showKey, setShowKey] = useState<Record<ApiKeyProvider, boolean>>({ groq: false, gemini: false, claude: false });
  const [audit, setAudit] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState<string | null>(null);
  const [busy, setBusy] = useState<Record<ApiKeyProvider, boolean>>({ groq: false, gemini: false, claude: false });
  const [showPaid, setShowPaid] = useState(false);

  const visibleProviders: ApiKeyProvider[] = showPaid
    ? [...DEFAULT_PROVIDERS, 'claude' as ApiKeyProvider]
    : DEFAULT_PROVIDERS;

  function flash(msg: string): void {
    setSavedFlash(msg);
    setTimeout(() => setSavedFlash(null), 2000);
  }

  async function loadAll(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const [allKeys, ...metaList] = await Promise.all([
        loadAllApiKeys(tenant),
        ...ALL_PROVIDERS.map((p) => loadApiKeyMeta(tenant, p)),
      ]);
      setKeys(allKeys);
      setDrafts({ ...allKeys });
      const metaObj: Record<ApiKeyProvider, KeyMeta | null> = { groq: null, gemini: null, claude: null, tg_feedback_bot: null, tg_feedback_chat: null, tg_lisp_chat: null };
      ALL_PROVIDERS.forEach((p, i) => {
        metaObj[p] = metaList[i] ?? null;
      });
      setMeta(metaObj);
      const log = await loadAuditLog(tenant, 50);
      setAudit(log);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
  }, [tenant]);

  async function handleSave(provider: ApiKeyProvider): Promise<void> {
    if (!adminUid) {
      flash('⚠ Chưa đăng nhập admin');
      return;
    }
    setBusy((b) => ({ ...b, [provider]: true }));
    try {
      await saveApiKey(tenant, provider, drafts[provider], adminUid, adminEmail);
      flash(`✓ Đã ${drafts[provider] ? 'lưu' : 'xoá'} ${provider}`);
      await loadAll();
    } catch (err) {
      flash(`❌ Lỗi: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy((b) => ({ ...b, [provider]: false }));
    }
  }

  function handleApplyTenant(): void {
    const err = validateTenantId(tenantInput);
    if (err) {
      flash(`❌ ${err}`);
      return;
    }
    setActiveTenantId(tenantInput);
    setTenant(tenantInput);
    flash(`✓ Đã chuyển tenant → ${tenantInput}`);
  }

  function handleResetTenant(): void {
    setActiveTenantId(DEFAULT_TENANT_ID);
    setTenant(DEFAULT_TENANT_ID);
    setTenantInput(DEFAULT_TENANT_ID);
    flash('✓ Đã reset tenant về default');
  }

  const dirty = useMemo(() => {
    const out: Record<ApiKeyProvider, boolean> = { groq: false, gemini: false, claude: false };
    ALL_PROVIDERS.forEach((p) => {
      out[p] = drafts[p] !== keys[p];
    });
    return out;
  }, [drafts, keys]);

  return (
    <div className="panel">
      <header className="panel-head">
        <div>
          <h1>🔐 API Keys — AI integration</h1>
          <p className="muted">
            Set Groq + Claude key 1 lần ở đây. Tự sync xuống TrishDesign + các app khác qua Firestore (AES-GCM encrypted).
          </p>
        </div>
        <div className="panel-actions">
          {savedFlash && <span className="td-saved-flash">{savedFlash}</span>}
          <button className="btn btn-ghost btn-sm" onClick={() => void loadAll()} disabled={loading}>
            🔄 Reload
          </button>
        </div>
      </header>

      {/* Tenant selector */}
      <section style={{ marginBottom: 16, padding: 16, background: 'var(--surface, #1a1a1a)', border: '1px solid var(--border, #2a2a2a)', borderRadius: 8 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Tenant (multi-team)</h2>
        <p className="muted small" style={{ marginBottom: 10 }}>
          Mặc định <code>default</code>. Đổi tenant để phân biệt team / công ty khác (vd <code>cienco4</code>, <code>danang-bgt</code>).
          Mỗi tenant có bộ key + audit log riêng. Tất cả desktop app trên máy này đọc cùng tenant đang active.
        </p>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="text"
            className="td-input"
            style={{ maxWidth: 280 }}
            value={tenantInput}
            onChange={(e) => setTenantInput(e.target.value)}
            placeholder="default · cienco4 · ..."
          />
          <button className="btn btn-primary btn-sm" onClick={handleApplyTenant}>
            ✓ Áp dụng
          </button>
          <button className="btn btn-ghost btn-sm" onClick={handleResetTenant}>
            ↺ Reset → default
          </button>
          <span className="muted small">
            Active: <strong>{tenant}</strong>
          </span>
        </div>
      </section>

      {error && (
        <div className="error-banner" style={{ marginBottom: 12 }}>
          ❌ {error}
        </div>
      )}

      {loading && <div className="muted">⏳ Đang tải...</div>}

      {/* API key inputs */}
      {!loading && (
        <section style={{ marginBottom: 16, padding: 16, background: 'var(--surface, #1a1a1a)', border: '1px solid var(--border, #2a2a2a)', borderRadius: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ fontSize: 14, fontWeight: 600 }}>
              Keys cho tenant <code>{tenant}</code>
            </h2>
            <label style={{ fontSize: 12, display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
              <input type="checkbox" checked={showPaid} onChange={(e) => setShowPaid(e.target.checked)} />
              Hiện cả AI paid (Claude...)
            </label>
          </div>
          {visibleProviders.map((provider) => (
            <div
              key={provider}
              style={{
                marginBottom: 18,
                padding: 12,
                border: '1px solid var(--border-color, #2a2a2a)',
                borderRadius: 8,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                <strong>
                  {PROVIDER_LABEL[provider]}
                  {PROVIDER_FREE[provider] && <span style={{ marginLeft: 6, fontSize: 10, padding: '1px 6px', background: '#10b981', color: 'white', borderRadius: 4 }}>FREE</span>}
                </strong>
                <span className="muted small">
                  {meta[provider]
                    ? `Sửa lần cuối: ${fmtTime(meta[provider]!.updatedAt)} bởi ${meta[provider]!.modifiedByEmail || meta[provider]!.modifiedBy}`
                    : '⚠ Chưa có key'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'stretch' }}>
                <input
                  type={showKey[provider] ? 'text' : 'password'}
                  className="td-input"
                  style={{ flex: 1, fontFamily: 'monospace' }}
                  placeholder={PROVIDER_PLACEHOLDER[provider]}
                  value={drafts[provider]}
                  onChange={(e) => setDrafts((d) => ({ ...d, [provider]: e.target.value }))}
                />
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setShowKey((s) => ({ ...s, [provider]: !s[provider] }))}
                  title={showKey[provider] ? 'Ẩn key' : 'Hiện key'}
                >
                  {showKey[provider] ? '🙈' : '👁'}
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => void handleSave(provider)}
                  disabled={busy[provider] || !dirty[provider]}
                >
                  {busy[provider] ? '⏳' : drafts[provider] ? '💾 Lưu + Sync' : '🗑 Xoá'}
                </button>
              </div>
              <div className="muted small" style={{ marginTop: 6 }}>
                {drafts[provider]
                  ? `${drafts[provider].length} ký tự${dirty[provider] ? ' · ⚠ Chưa lưu' : ' · ✓ Đã sync Firestore'}`
                  : 'Để trống = xoá key khỏi Firestore'}
              </div>
            </div>
          ))}
          <p className="muted small" style={{ marginTop: 8 }}>
            🛡 Encrypt AES-GCM trước khi lưu Firestore. Master key hardcoded trong source — đây là defense-in-depth, không phải HSM-grade.
          </p>
        </section>
      )}

      {/* Telegram feedback bot config */}
      {!loading && (
        <section style={{ marginBottom: 16, padding: 16, background: 'var(--surface, #1a1a1a)', border: '1px solid var(--border, #2a2a2a)', borderRadius: 8 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>📨 Telegram Bot — Form góp ý từ user</h2>
          <p className="muted small" style={{ marginBottom: 10, marginTop: 0 }}>
            Cấu hình bot Telegram để các app desktop (TrishDesign...) gửi feedback + file đính kèm về kênh admin.
            Có thể tận dụng bot TrishDrive đã tạo (bot token giống), chỉ cần điền chat ID của channel/group nhận góp ý.
          </p>
          {[...FEEDBACK_PROVIDERS, 'tg_lisp_chat' as ApiKeyProvider].map((provider) => (
            <div
              key={provider}
              style={{
                marginBottom: 14,
                padding: 10,
                border: '1px solid var(--border-color, #2a2a2a)',
                borderRadius: 8,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                <strong>{PROVIDER_LABEL[provider]}</strong>
                <span className="muted small">
                  {meta[provider]
                    ? `Sửa ${fmtTime(meta[provider]!.updatedAt)} bởi ${meta[provider]!.modifiedByEmail || meta[provider]!.modifiedBy}`
                    : '⚠ Chưa cấu hình'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'stretch' }}>
                <input
                  type={showKey[provider] ? 'text' : 'password'}
                  className="td-input"
                  style={{ flex: 1, fontFamily: 'monospace' }}
                  placeholder={PROVIDER_PLACEHOLDER[provider]}
                  value={drafts[provider]}
                  onChange={(e) => setDrafts((d) => ({ ...d, [provider]: e.target.value }))}
                />
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowKey((s) => ({ ...s, [provider]: !s[provider] }))}>
                  {showKey[provider] ? '🙈' : '👁'}
                </button>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => void handleSave(provider)} disabled={busy[provider] || !dirty[provider]}>
                  {busy[provider] ? '⏳' : drafts[provider] ? '💾 Lưu + Sync' : '🗑 Xoá'}
                </button>
              </div>
            </div>
          ))}
          <p className="muted small" style={{ marginTop: 8, fontSize: 11 }}>
            💡 Lấy <strong>Bot Token</strong> từ <code>@BotFather</code> trên Telegram. Lấy <strong>Chat ID</strong> bằng cách: thêm bot vào channel/group → gửi tin nhắn → vào URL <code>https://api.telegram.org/bot&lt;TOKEN&gt;/getUpdates</code> xem field <code>chat.id</code>.<br />
            🧩 <strong>Channel LISP</strong>: tạo 1 channel/group RIÊNG để admin upload file .lsp curated cho TrishTEAM library. User download xuống TrishDesign + load vào AutoCAD.
          </p>
        </section>
      )}

      {/* Audit log */}
      {!loading && (
        <section style={{ padding: 16, background: 'var(--surface, #1a1a1a)', border: '1px solid var(--border, #2a2a2a)', borderRadius: 8 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>📜 Audit log (50 entries gần nhất)</h2>
          {audit.length === 0 ? (
            <div className="muted small">Chưa có thay đổi nào.</div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Thời gian</th>
                    <th>Provider</th>
                    <th>Action</th>
                    <th>Người sửa</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.map((e) => (
                    <tr key={e.id}>
                      <td>{fmtTime(e.timestamp)}</td>
                      <td>{e.provider}</td>
                      <td>{e.action === 'set' ? '💾 Set' : '🗑 Delete'}</td>
                      <td>{e.modifiedByEmail || e.modifiedBy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
