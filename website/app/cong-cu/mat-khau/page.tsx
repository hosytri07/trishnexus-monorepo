'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Copy, KeyRound, RefreshCw } from 'lucide-react';

const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const DIGITS = '0123456789';
const SYMBOLS = '!@#$%^&*()-_=+[]{}|;:,.<>?';

function generate(length: number, opts: { lower: boolean; upper: boolean; digits: boolean; symbols: boolean; ambiguous: boolean }): string {
  let chars = '';
  if (opts.lower) chars += LOWER;
  if (opts.upper) chars += UPPER;
  if (opts.digits) chars += DIGITS;
  if (opts.symbols) chars += SYMBOLS;
  if (!opts.ambiguous) chars = chars.replace(/[lI1O0]/g, '');
  if (!chars) return '';
  const arr = new Uint32Array(length);
  crypto.getRandomValues(arr);
  let out = '';
  for (let i = 0; i < length; i++) out += chars[arr[i]! % chars.length];
  return out;
}

function strength(pwd: string): { label: string; color: string; pct: number } {
  let score = 0;
  if (pwd.length >= 8) score++;
  if (pwd.length >= 12) score++;
  if (pwd.length >= 16) score++;
  if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^a-zA-Z0-9]/.test(pwd)) score++;
  if (score >= 6) return { label: 'Cực mạnh', color: '#10B981', pct: 100 };
  if (score >= 5) return { label: 'Mạnh', color: '#34D399', pct: 80 };
  if (score >= 3) return { label: 'Trung bình', color: '#F59E0B', pct: 50 };
  return { label: 'Yếu', color: '#EF4444', pct: 25 };
}

export default function MatKhauPage() {
  const [length, setLength] = useState(16);
  const [opts, setOpts] = useState({ lower: true, upper: true, digits: true, symbols: true, ambiguous: false });
  const [pwd, setPwd] = useState('');
  const [copied, setCopied] = useState(false);

  function regen() {
    setPwd(generate(length, opts));
  }

  useEffect(() => { regen(); /* eslint-disable-next-line */ }, [length, opts]);

  const stren = useMemo(() => strength(pwd), [pwd]);

  async function copy() {
    if (!pwd) return;
    await navigator.clipboard.writeText(pwd);
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
          <KeyRound size={26} strokeWidth={1.75} style={{ color: 'var(--color-accent-primary)' }} />
          <h1 className="text-3xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Tạo mật khẩu</h1>
        </div>
        <p className="text-base" style={{ color: 'var(--color-text-secondary)' }}>
          Generator mật khẩu mạnh client-side (Web Crypto API) — không gửi qua server, không log.
        </p>
      </header>

      <section className="rounded-xl border p-5 mb-4" style={{ background: 'var(--color-surface-card)', borderColor: 'var(--color-border-default)' }}>
        {/* Output */}
        <div className="rounded-md border p-3 mb-4 flex items-center gap-2" style={{ background: 'var(--color-surface-bg_elevated)', borderColor: 'var(--color-accent-primary)' }}>
          <code className="flex-1 font-mono text-base md:text-lg break-all" style={{ color: 'var(--color-text-primary)' }}>{pwd || '...'}</code>
          <button type="button" onClick={regen} className="inline-flex items-center justify-center w-9 h-9 rounded hover:bg-[var(--color-surface-muted)]" title="Sinh mới" style={{ color: 'var(--color-text-secondary)' }}>
            <RefreshCw size={14} />
          </button>
          <button type="button" onClick={copy} className="inline-flex items-center justify-center w-9 h-9 rounded" style={{ background: 'var(--color-accent-primary)', color: '#ffffff' }} title="Copy">
            <Copy size={14} />
          </button>
        </div>
        {copied && <div className="text-xs mb-3" style={{ color: '#10B981' }}>✓ Đã copy!</div>}

        {/* Strength bar */}
        <div className="mb-4">
          <div className="flex justify-between text-xs mb-1">
            <span style={{ color: 'var(--color-text-muted)' }}>Độ mạnh</span>
            <span className="font-bold" style={{ color: stren.color }}>{stren.label}</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-surface-bg_elevated)' }}>
            <div className="h-full transition-all" style={{ width: `${stren.pct}%`, background: stren.color }} />
          </div>
        </div>

        {/* Length slider */}
        <div className="mb-4">
          <div className="flex justify-between text-sm mb-2">
            <label style={{ color: 'var(--color-text-muted)' }}>Độ dài</label>
            <span className="font-bold" style={{ color: 'var(--color-accent-primary)' }}>{length}</span>
          </div>
          <input type="range" min={8} max={64} value={length} onChange={(e) => setLength(parseInt(e.target.value))} className="w-full" />
        </div>

        {/* Options */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <Toggle label="a-z (chữ thường)" checked={opts.lower} onChange={(v) => setOpts({ ...opts, lower: v })} />
          <Toggle label="A-Z (chữ HOA)" checked={opts.upper} onChange={(v) => setOpts({ ...opts, upper: v })} />
          <Toggle label="0-9 (số)" checked={opts.digits} onChange={(v) => setOpts({ ...opts, digits: v })} />
          <Toggle label="!@#$ (ký tự đặc biệt)" checked={opts.symbols} onChange={(v) => setOpts({ ...opts, symbols: v })} />
          <Toggle label="Ký tự dễ nhầm (l, I, 1, O, 0)" checked={opts.ambiguous} onChange={(v) => setOpts({ ...opts, ambiguous: v })} />
        </div>
      </section>

      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
        🔒 Mật khẩu sinh client-side qua Web Crypto API (cryptographically secure). Không lưu, không gửi.
      </p>
    </main>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-current" />
      <span style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
    </label>
  );
}
