'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Copy, Hash, Loader2 } from 'lucide-react';

const ALGOS = ['SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'] as const;
type Algo = typeof ALGOS[number];

async function hash(text: string, algo: Algo): Promise<string> {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest(algo, data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export default function HashPage() {
  const [input, setInput] = useState('');
  const [results, setResults] = useState<Record<Algo, string>>({} as Record<Algo, string>);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!input) {
        setResults({} as Record<Algo, string>);
        return;
      }
      setBusy(true);
      try {
        const r: Record<string, string> = {};
        for (const a of ALGOS) {
          r[a] = await hash(input, a);
        }
        if (!cancelled) setResults(r as Record<Algo, string>);
      } finally {
        if (!cancelled) setBusy(false);
      }
    }
    void run();
    return () => { cancelled = true; };
  }, [input]);

  async function copyHash(algo: Algo) {
    const v = results[algo];
    if (!v) return;
    await navigator.clipboard.writeText(v);
    setCopied(algo);
    setTimeout(() => setCopied(null), 1800);
  }

  return (
    <main className="max-w-3xl mx-auto px-6 py-8">
      <Link href="/" className="inline-flex items-center gap-2 mb-6 text-sm" style={{ color: 'var(--color-text-muted)' }}>
        <ArrowLeft size={15} /> Quay lại Dashboard
      </Link>

      <header className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Hash size={26} strokeWidth={1.75} style={{ color: 'var(--color-accent-primary)' }} />
          <h1 className="text-3xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Hash generator</h1>
        </div>
        <p className="text-base" style={{ color: 'var(--color-text-secondary)' }}>
          Sinh hash SHA-1 / SHA-256 / SHA-384 / SHA-512 client-side qua Web Crypto API. Không log.
        </p>
      </header>

      <section className="rounded-xl border p-5 mb-4" style={{ background: 'var(--color-surface-card)', borderColor: 'var(--color-border-default)' }}>
        <label className="text-xs font-semibold mb-1.5 inline-block" style={{ color: 'var(--color-text-muted)' }}>
          Input text {busy && <Loader2 size={11} className="inline animate-spin ml-1" />}
        </label>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={5}
          placeholder="Nhập text cần hash..."
          className="w-full p-3 rounded-md outline-none border text-sm font-mono"
          style={{ background: 'var(--color-surface-bg_elevated)', borderColor: 'var(--color-border-default)', color: 'var(--color-text-primary)' }}
        />
      </section>

      {input && (
        <section className="space-y-2">
          {ALGOS.map((a) => (
            <div
              key={a}
              className="rounded-md border p-3"
              style={{ background: 'var(--color-surface-card)', borderColor: 'var(--color-border-default)' }}
            >
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="font-mono text-[10px] px-1.5 h-5 rounded inline-flex items-center font-bold"
                  style={{ background: 'var(--color-accent-soft)', color: 'var(--color-accent-primary)' }}
                >
                  {a}
                </span>
                <button
                  type="button"
                  onClick={() => copyHash(a)}
                  disabled={!results[a]}
                  className="ml-auto inline-flex items-center gap-1 text-xs font-semibold disabled:opacity-50"
                  style={{ color: 'var(--color-accent-primary)' }}
                >
                  <Copy size={11} /> {copied === a ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <code className="block font-mono text-xs break-all" style={{ color: 'var(--color-text-primary)' }}>
                {results[a] || '...'}
              </code>
            </div>
          ))}
        </section>
      )}

      <p className="mt-4 text-xs" style={{ color: 'var(--color-text-muted)' }}>
        💡 SHA-256 phổ biến nhất (chuẩn Bitcoin / SSL cert). MD5 + SHA-1 nay bị deprecate cho security
        nhưng vẫn dùng được cho checksum file.
      </p>
    </main>
  );
}
