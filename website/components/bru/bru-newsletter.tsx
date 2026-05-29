'use client';

/**
 * BruNewsletter — Phase 78.6 subscribe form.
 * POST email → /api/newsletter → Resend list. Hiện tại stub local (chưa wire backend).
 */
import { useState } from 'react';
import { Mail, ArrowRight, Check, AlertCircle } from 'lucide-react';

type Status = 'idle' | 'sending' | 'ok' | 'error';

export function BruNewsletter() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === 'sending' || !email.trim()) return;

    setStatus('sending');
    setError(null);

    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `HTTP ${res.status}`);
      }
      setStatus('ok');
      setEmail('');
      setTimeout(() => setStatus('idle'), 4000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Lỗi không xác định';
      setError(msg);
      setStatus('error');
      setTimeout(() => setStatus('idle'), 4000);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <Mail size={14} strokeWidth={2.5} style={{ color: 'var(--bru-accent)' }} />
        <span className="bru-mono" style={{ fontSize: 11, color: 'var(--bru-accent)', letterSpacing: '0.1em' }}>
          NEWSLETTER
        </span>
      </div>
      <p className="bru-body-sm" style={{ color: 'var(--bru-fg-dim)', marginBottom: 4 }}>
        Đăng ký nhận thông báo release mới qua email. Không spam.
      </p>
      <div style={{ display: 'flex', gap: 0, border: '2px solid var(--bru-border-strong)', borderRadius: 4, overflow: 'hidden' }}>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          disabled={status === 'sending'}
          style={{
            flex: 1,
            padding: '12px 14px',
            border: 'none',
            outline: 'none',
            background: 'transparent',
            color: 'var(--bru-fg)',
            fontFamily: 'inherit',
            fontSize: 13,
          }}
        />
        <button
          type="submit"
          disabled={status === 'sending' || !email.trim()}
          style={{
            padding: '0 18px',
            border: 'none',
            background: 'var(--bru-accent)',
            color: 'var(--bru-accent-fg)',
            cursor: 'pointer',
            fontWeight: 800,
            fontSize: 12,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          {status === 'sending' ? 'Đang...' : status === 'ok' ? <><Check size={14} /> OK</> : <>Subscribe <ArrowRight size={14} /></>}
        </button>
      </div>
      {status === 'ok' && (
        <p className="bru-mono" style={{ color: '#34D399', fontSize: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Check size={12} /> Đã đăng ký! Check email confirm.
        </p>
      )}
      {status === 'error' && error && (
        <p className="bru-mono" style={{ color: '#F87171', fontSize: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
          <AlertCircle size={12} /> {error}
        </p>
      )}
    </form>
  );
}
