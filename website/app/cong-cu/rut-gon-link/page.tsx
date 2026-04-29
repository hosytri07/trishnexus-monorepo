'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Copy, Link2, Loader2 } from 'lucide-react';
import { getIdToken } from 'firebase/auth';
import { auth } from '@/lib/firebase';

export default function RutGonLinkPage() {
  const [url, setUrl] = useState('');
  const [short, setShort] = useState<string | null>(null);
  const [provider, setProvider] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleShorten() {
    if (!url.trim()) return;
    setBusy(true);
    setError(null);
    setShort(null);
    try {
      // Optional: gửi ID token nếu đã login để track created_by_uid
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (auth?.currentUser) {
        try {
          const t = await getIdToken(auth.currentUser);
          headers.Authorization = `Bearer ${t}`;
        } catch {
          // ignore, anonymous OK
        }
      }
      const res = await fetch('/api/shorten', {
        method: 'POST',
        headers,
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Lỗi không xác định');
      setShort(data.short);
      setProvider(data.provider);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi rút gọn');
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!short) return;
    await navigator.clipboard.writeText(short);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <main className="max-w-2xl mx-auto px-6 py-8">
      <Link href="/" className="inline-flex items-center gap-2 mb-6 text-sm" style={{ color: 'var(--color-text-muted)' }}>
        <ArrowLeft size={15} /> Quay lại Dashboard
      </Link>

      <header className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Link2 size={26} strokeWidth={1.75} style={{ color: 'var(--color-accent-primary)' }} />
          <h1 className="text-3xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
            Rút gọn link
          </h1>
        </div>
        <p className="text-base" style={{ color: 'var(--color-text-secondary)' }}>
          Rút gọn URL dài thành link ngắn dễ chia sẻ. Link tạo trên domain trishteam.io.vn — vĩnh viễn không expire.
        </p>
      </header>

      <section className="rounded-xl border p-5 mb-4" style={{ background: 'var(--color-surface-card)', borderColor: 'var(--color-border-default)' }}>
        <label className="text-xs font-semibold mb-1.5 inline-block" style={{ color: 'var(--color-text-muted)' }}>URL cần rút gọn</label>
        <textarea
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          rows={3}
          placeholder="https://example.com/very-long-url-with-many-parameters?foo=bar&baz=qux..."
          className="w-full p-3 rounded-md outline-none border text-sm font-mono mb-3"
          style={{ background: 'var(--color-surface-bg_elevated)', borderColor: 'var(--color-border-default)', color: 'var(--color-text-primary)' }}
        />
        <button
          type="button"
          onClick={handleShorten}
          disabled={busy || !url.trim()}
          className="inline-flex items-center gap-2 px-5 h-10 rounded-md text-sm font-bold disabled:opacity-50"
          style={{ background: 'var(--color-accent-gradient)', color: '#ffffff' }}
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />}
          {busy ? 'Đang rút...' : 'Rút gọn'}
        </button>

        {error && (
          <div className="mt-3 px-3 py-2 rounded text-xs" style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}>
            ⚠ {error}
          </div>
        )}

        {short && (
          <div className="mt-4 rounded-md border p-3" style={{ background: 'var(--color-accent-soft)', borderColor: 'var(--color-accent-primary)' }}>
            <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--color-accent-primary)' }}>
              Link ngắn (qua {provider})
            </div>
            <div className="flex items-center gap-2">
              <a href={short} target="_blank" rel="noopener noreferrer" className="flex-1 font-mono text-base font-bold break-all" style={{ color: 'var(--color-accent-primary)' }}>
                {short}
              </a>
              <button type="button" onClick={copy} className="inline-flex items-center justify-center w-9 h-9 rounded transition-colors hover:opacity-80" style={{ background: 'var(--color-accent-primary)', color: '#ffffff' }} title="Copy">
                <Copy size={14} />
              </button>
            </div>
            {copied && <div className="text-xs mt-2" style={{ color: '#10B981' }}>✓ Đã copy!</div>}
          </div>
        )}
      </section>

      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
        💡 Link ngắn lưu trên Firestore TrishTEAM, vĩnh viễn không expire, có thể track click count. Đăng nhập để track ai tạo link.
      </p>
    </main>
  );
}
