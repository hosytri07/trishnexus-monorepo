'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRightLeft, Code2, Copy } from 'lucide-react';

export default function Base64Page() {
  const [mode, setMode] = useState<'encode' | 'decode'>('encode');
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function process(value: string, m: 'encode' | 'decode') {
    setInput(value);
    setError(null);
    if (!value) {
      setOutput('');
      return;
    }
    try {
      if (m === 'encode') {
        // Use TextEncoder for proper UTF-8 handling
        const bytes = new TextEncoder().encode(value);
        let binary = '';
        bytes.forEach((b) => (binary += String.fromCharCode(b)));
        setOutput(btoa(binary));
      } else {
        const binary = atob(value.trim());
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        setOutput(new TextDecoder().decode(bytes));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi process');
      setOutput('');
    }
  }

  function swap() {
    const newMode = mode === 'encode' ? 'decode' : 'encode';
    setMode(newMode);
    process(output, newMode);
  }

  async function copyOut() {
    if (!output) return;
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <main className="max-w-3xl mx-auto px-6 py-8">
      <Link href="/" className="inline-flex items-center gap-2 mb-6 text-sm" style={{ color: 'var(--color-text-muted)' }}>
        <ArrowLeft size={15} /> Quay lại Dashboard
      </Link>

      <header className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Code2 size={26} strokeWidth={1.75} style={{ color: 'var(--color-accent-primary)' }} />
          <h1 className="text-3xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Base64 Encoder / Decoder</h1>
        </div>
        <p className="text-base" style={{ color: 'var(--color-text-secondary)' }}>
          Encode / decode chuỗi UTF-8 sang Base64 — hỗ trợ tiếng Việt có dấu.
        </p>
      </header>

      <section className="rounded-xl border p-5" style={{ background: 'var(--color-surface-card)', borderColor: 'var(--color-border-default)' }}>
        {/* Mode toggle */}
        <div className="flex justify-center mb-4">
          <div className="inline-flex p-0.5 rounded-md" style={{ background: 'var(--color-surface-bg_elevated)' }}>
            <ModeBtn active={mode === 'encode'} onClick={() => { setMode('encode'); process(input, 'encode'); }} label="Text → Base64" />
            <ModeBtn active={mode === 'decode'} onClick={() => { setMode('decode'); process(input, 'decode'); }} label="Base64 → Text" />
          </div>
        </div>

        <Field label={mode === 'encode' ? 'Text gốc' : 'Base64 input'}>
          <textarea
            value={input}
            onChange={(e) => process(e.target.value, mode)}
            rows={5}
            placeholder={mode === 'encode' ? 'Nhập text bất kỳ (hỗ trợ tiếng Việt)...' : 'Paste chuỗi Base64...'}
            className="w-full p-3 rounded-md outline-none border text-sm font-mono"
            style={{ background: 'var(--color-surface-bg_elevated)', borderColor: 'var(--color-border-default)', color: 'var(--color-text-primary)' }}
          />
        </Field>

        <div className="flex justify-center my-3">
          <button
            type="button"
            onClick={swap}
            disabled={!output}
            className="inline-flex items-center justify-center w-10 h-10 rounded-full transition-colors hover:bg-[var(--color-surface-muted)] disabled:opacity-50"
            title="Swap input ↔ output"
            style={{ color: 'var(--color-accent-primary)' }}
          >
            <ArrowRightLeft size={16} />
          </button>
        </div>

        <Field label={mode === 'encode' ? 'Base64 output' : 'Text decoded'}>
          <div className="relative">
            <textarea
              readOnly
              value={output}
              rows={5}
              className="w-full p-3 rounded-md outline-none border text-sm font-mono"
              style={{ background: 'var(--color-accent-soft)', borderColor: 'var(--color-accent-primary)', color: 'var(--color-text-primary)' }}
            />
            {output && (
              <button type="button" onClick={copyOut} className="absolute top-2 right-2 inline-flex items-center justify-center w-8 h-8 rounded" style={{ background: 'var(--color-accent-primary)', color: '#ffffff' }} title="Copy">
                <Copy size={12} />
              </button>
            )}
          </div>
        </Field>

        {copied && <div className="text-xs mt-2" style={{ color: '#10B981' }}>✓ Đã copy!</div>}
        {error && <div className="text-xs mt-2 px-3 py-2 rounded" style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}>⚠ {error}</div>}
      </section>

      <p className="mt-4 text-xs" style={{ color: 'var(--color-text-muted)' }}>
        💡 Base64 dùng để truyền binary qua text (vd embed ảnh trong CSS/HTML). Không phải mã hoá — ai cũng decode được.
      </p>
    </main>
  );
}

function ModeBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex items-center px-4 h-9 rounded text-sm font-semibold" style={{ background: active ? 'var(--color-accent-soft)' : 'transparent', color: active ? 'var(--color-accent-primary)' : 'var(--color-text-muted)' }}>
      {label}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-2">
      <label className="text-xs font-semibold mb-1.5 inline-block" style={{ color: 'var(--color-text-muted)' }}>{label}</label>
      {children}
    </div>
  );
}
