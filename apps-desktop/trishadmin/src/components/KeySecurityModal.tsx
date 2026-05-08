/**
 * Phase 24.3 — KeySecurityModal.
 *
 * Modal quản lý security rules cho 1 activation key:
 *   - IP whitelist (CIDR / plain / "192.168.1.*")
 *   - IP blacklist
 *   - Concurrent policy (reject vs kick_oldest)
 *   - Max concurrent
 *   - Block proxy/VPN
 *   - Tags
 *
 * Validate IP/CIDR client-side trước khi save. Audit log tự động qua updateKeySecurity.
 */
import { useEffect, useMemo, useState } from 'react';
import type { ActivationKey } from '@trishteam/data';
import { ipMatches } from '@trishteam/data';
import {
  type ActorContext,
  type KeySecurityPatch,
  updateKeySecurity,
} from '../lib/firestore-admin.js';

interface Props {
  keyDoc: ActivationKey;
  actor: ActorContext;
  onClose: () => void;
  onSaved: () => void;
}

const IP_RULE_HELP = [
  'Plain IP: 1.2.3.4',
  'CIDR: 192.168.1.0/24',
  'Wildcard: 192.168.1.*',
  'All: * hoặc 0.0.0.0/0',
].join(' • ');

function validateRule(rule: string): boolean {
  const trimmed = rule.trim();
  if (!trimmed) return false;
  if (trimmed === '*' || trimmed === '0.0.0.0/0') return true;
  // CIDR
  if (/^\d+\.\d+\.\d+\.\d+\/\d+$/.test(trimmed)) {
    const [_, prefix] = trimmed.split('/');
    const p = parseInt(prefix, 10);
    return p >= 0 && p <= 32;
  }
  // Plain IPv4
  if (/^\d+\.\d+\.\d+\.\d+$/.test(trimmed)) {
    return trimmed.split('.').every((p) => {
      const n = parseInt(p, 10);
      return n >= 0 && n <= 255;
    });
  }
  // Wildcard (vd 192.168.1.*)
  if (/^[\d.*]+$/.test(trimmed) && trimmed.includes('*')) return true;
  // IPv6 plain (loose check)
  if (trimmed.includes(':') && /^[0-9a-fA-F:]+$/.test(trimmed)) return true;
  return false;
}

export function KeySecurityModal({
  keyDoc,
  actor,
  onClose,
  onSaved,
}: Props): JSX.Element {
  const [whitelist, setWhitelist] = useState<string[]>(keyDoc.ip_whitelist ?? []);
  const [blacklist, setBlacklist] = useState<string[]>(keyDoc.ip_blacklist ?? []);
  const [concurrentPolicy, setConcurrentPolicy] = useState<'reject' | 'kick_oldest'>(
    keyDoc.concurrent_policy ?? 'reject',
  );
  const [maxConcurrent, setMaxConcurrent] = useState<number>(keyDoc.max_concurrent ?? 1);
  const [blockProxy, setBlockProxy] = useState<boolean>(keyDoc.block_proxy ?? false);
  const [tags, setTags] = useState<string[]>(keyDoc.tags ?? []);
  const [tagInput, setTagInput] = useState('');
  const [whitelistInput, setWhitelistInput] = useState('');
  const [blacklistInput, setBlacklistInput] = useState('');
  const [testIp, setTestIp] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'ip' | 'concurrent' | 'tags'>('ip');

  // ESC để đóng (không click ngoài)
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  function addRule(target: 'wl' | 'bl', raw: string): void {
    const v = raw.trim();
    if (!v) return;
    if (!validateRule(v)) {
      setError(`Rule không hợp lệ: "${v}". Format: ${IP_RULE_HELP}`);
      return;
    }
    setError(null);
    if (target === 'wl') {
      if (!whitelist.includes(v)) setWhitelist([...whitelist, v]);
      setWhitelistInput('');
    } else {
      if (!blacklist.includes(v)) setBlacklist([...blacklist, v]);
      setBlacklistInput('');
    }
  }

  function removeRule(target: 'wl' | 'bl', value: string): void {
    if (target === 'wl') setWhitelist(whitelist.filter((r) => r !== value));
    else setBlacklist(blacklist.filter((r) => r !== value));
  }

  function addTag(): void {
    const v = tagInput.trim();
    if (!v) return;
    if (!tags.includes(v)) setTags([...tags, v]);
    setTagInput('');
  }

  function removeTag(t: string): void {
    setTags(tags.filter((x) => x !== t));
  }

  // Live test IP có pass rules không
  const testResult = useMemo(() => {
    if (!testIp.trim()) return null;
    const ip = testIp.trim();
    for (const rule of blacklist) {
      if (ipMatches(ip, rule)) {
        return { allowed: false, reason: `Khớp blacklist: ${rule}` };
      }
    }
    if (whitelist.length > 0) {
      const matched = whitelist.find((r) => ipMatches(ip, r));
      if (!matched) {
        return { allowed: false, reason: `Không khớp whitelist (${whitelist.length} rules)` };
      }
      return { allowed: true, reason: `Khớp whitelist: ${matched}` };
    }
    return { allowed: true, reason: 'OK (không có whitelist, không khớp blacklist)' };
  }, [testIp, whitelist, blacklist]);

  async function handleSave(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const patch: KeySecurityPatch = {
        ip_whitelist: whitelist,
        ip_blacklist: blacklist,
        concurrent_policy: concurrentPolicy,
        max_concurrent: maxConcurrent,
        block_proxy: blockProxy,
        tags,
      };
      await updateKeySecurity(keyDoc.id, patch, actor, keyDoc.code);
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 640, maxHeight: '90vh', overflowY: 'auto' }}
      >
        <header className="modal-head">
          <h2>🛡️ Security rules — <code>{keyDoc.code}</code></h2>
          <button className="mini" onClick={onClose} disabled={busy}>×</button>
        </header>

        <div className="modal-body">
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid var(--border)' }}>
            <TabBtn active={tab === 'ip'} onClick={() => setTab('ip')}>
              🌐 IP rules
            </TabBtn>
            <TabBtn active={tab === 'concurrent'} onClick={() => setTab('concurrent')}>
              👥 Concurrent
            </TabBtn>
            <TabBtn active={tab === 'tags'} onClick={() => setTab('tags')}>
              🏷️ Tags
            </TabBtn>
          </div>

          {error && <div className="error-banner" style={{ marginBottom: 12 }}>⚠ {error}</div>}

          {tab === 'ip' && (
            <>
              <p className="muted small" style={{ marginBottom: 12 }}>
                {IP_RULE_HELP}
              </p>

              {/* Whitelist */}
              <div style={{ marginBottom: 16 }}>
                <label className="form-label">
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    ✅ <strong>Whitelist</strong> ({whitelist.length}) — chỉ cho IP khớp activate
                  </span>
                </label>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <input
                    type="text"
                    className="td-input"
                    placeholder="vd 192.168.1.0/24"
                    value={whitelistInput}
                    onChange={(e) => setWhitelistInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addRule('wl', whitelistInput);
                      }
                    }}
                    disabled={busy}
                  />
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    onClick={() => addRule('wl', whitelistInput)}
                    disabled={busy}
                  >
                    + Thêm
                  </button>
                </div>
                <RuleChips items={whitelist} onRemove={(v) => removeRule('wl', v)} color="emerald" />
              </div>

              {/* Blacklist */}
              <div style={{ marginBottom: 16 }}>
                <label className="form-label">
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    🚫 <strong>Blacklist</strong> ({blacklist.length}) — chặn IP khớp
                  </span>
                </label>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <input
                    type="text"
                    className="td-input"
                    placeholder="vd 1.2.3.4"
                    value={blacklistInput}
                    onChange={(e) => setBlacklistInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addRule('bl', blacklistInput);
                      }
                    }}
                    disabled={busy}
                  />
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    onClick={() => addRule('bl', blacklistInput)}
                    disabled={busy}
                  >
                    + Thêm
                  </button>
                </div>
                <RuleChips items={blacklist} onRemove={(v) => removeRule('bl', v)} color="red" />
              </div>

              {/* Block proxy/VPN */}
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: 10,
                  background: 'var(--bg-soft)',
                  borderRadius: 8,
                  marginBottom: 12,
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={blockProxy}
                  onChange={(e) => setBlockProxy(e.target.checked)}
                  disabled={busy}
                />
                <span style={{ fontSize: 13 }}>
                  🔒 <strong>Block VPN/Tor/proxy</strong> — chặn nếu ipapi flag IP là proxy
                </span>
              </label>

              {/* Live tester */}
              <div
                style={{
                  padding: 10,
                  background: 'var(--bg-soft)',
                  borderRadius: 8,
                  border: '1px dashed var(--border)',
                }}
              >
                <label className="form-label">
                  <span style={{ fontSize: 12 }}>🧪 Test 1 IP với rules hiện tại</span>
                </label>
                <input
                  type="text"
                  className="td-input"
                  placeholder="vd 192.168.1.50"
                  value={testIp}
                  onChange={(e) => setTestIp(e.target.value)}
                  disabled={busy}
                />
                {testResult && (
                  <div
                    style={{
                      marginTop: 6,
                      fontSize: 12,
                      color: testResult.allowed ? '#059669' : '#DC2626',
                    }}
                  >
                    {testResult.allowed ? '✅' : '🚫'} {testResult.reason}
                  </div>
                )}
              </div>
            </>
          )}

          {tab === 'concurrent' && (
            <>
              <label className="form-label">
                <span>Số session đồng thời tối đa</span>
                <input
                  type="number"
                  className="td-input"
                  min={1}
                  max={99}
                  value={maxConcurrent}
                  onChange={(e) => setMaxConcurrent(parseInt(e.target.value, 10) || 1)}
                  disabled={busy}
                />
                <span className="muted small">
                  Hiện key này có thể chạy đồng thời {maxConcurrent} máy.
                </span>
              </label>

              <label className="form-label" style={{ marginTop: 16 }}>
                <span>Khi vượt giới hạn</span>
                <select
                  className="td-select"
                  value={concurrentPolicy}
                  onChange={(e) => setConcurrentPolicy(e.target.value as 'reject' | 'kick_oldest')}
                  disabled={busy}
                >
                  <option value="reject">🛑 Reject — chặn user mới, báo "Key đang dùng"</option>
                  <option value="kick_oldest">🔄 Kick oldest — đẩy session cũ nhất, cho user mới vào</option>
                </select>
              </label>
            </>
          )}

          {tab === 'tags' && (
            <>
              <label className="form-label">
                <span>Tags (phân loại + filter)</span>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <input
                    type="text"
                    className="td-input"
                    placeholder="vd team-alpha, beta-tester"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addTag();
                      }
                    }}
                    disabled={busy}
                  />
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    onClick={addTag}
                    disabled={busy}
                  >
                    + Thêm
                  </button>
                </div>
                <RuleChips items={tags} onRemove={removeTag} color="blue" />
              </label>
            </>
          )}
        </div>

        <div className="modal-foot" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Hủy
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void handleSave()}
            disabled={busy}
          >
            {busy ? '⏳ Đang lưu…' : '💾 Lưu'}
          </button>
        </div>
      </div>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '8px 14px',
        background: active ? 'var(--accent)' : 'transparent',
        color: active ? '#fff' : 'var(--fg)',
        border: 'none',
        borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
        borderRadius: 0,
        fontSize: 13,
        fontWeight: active ? 700 : 500,
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}

function RuleChips({
  items,
  onRemove,
  color,
}: {
  items: string[];
  onRemove: (v: string) => void;
  color: 'emerald' | 'red' | 'blue';
}): JSX.Element {
  if (items.length === 0) {
    return <div className="muted small">(trống — chưa có rule)</div>;
  }
  const colorMap: Record<string, { bg: string; fg: string; border: string }> = {
    emerald: {
      bg: 'rgba(16,185,129,0.1)',
      fg: '#059669',
      border: 'rgba(16,185,129,0.3)',
    },
    red: {
      bg: 'rgba(220,38,38,0.1)',
      fg: '#DC2626',
      border: 'rgba(220,38,38,0.3)',
    },
    blue: {
      bg: 'rgba(59,130,246,0.1)',
      fg: '#2563EB',
      border: 'rgba(59,130,246,0.3)',
    },
  };
  const c = colorMap[color];
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {items.map((item) => (
        <span
          key={item}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 10px',
            background: c.bg,
            color: c.fg,
            border: `1px solid ${c.border}`,
            borderRadius: 12,
            fontSize: 12,
            fontFamily: 'monospace',
          }}
        >
          {item}
          <button
            type="button"
            onClick={() => onRemove(item)}
            style={{
              background: 'transparent',
              border: 'none',
              color: c.fg,
              cursor: 'pointer',
              fontSize: 14,
              lineHeight: 1,
              padding: 0,
            }}
            title="Xóa"
          >
            ×
          </button>
        </span>
      ))}
    </div>
  );
}
