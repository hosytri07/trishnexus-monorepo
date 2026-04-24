'use client';

/**
 * FeedbackWidget — form góp ý gửi trực tiếp tới bot Telegram.
 *
 * Fields: name, email, message, file (optional ≤ 10 MB).
 * POST multipart/form-data → /api/feedback → Telegram bot.
 *
 * UX: inline form, hiển thị toast-like status (idle/sending/ok/error).
 * Nếu user reset sau thành công, form clear hết.
 */
import { useRef, useState } from 'react';
import {
  CheckCircle2,
  FileText,
  Loader2,
  MessageSquare,
  Paperclip,
  Send,
  X,
  AlertCircle,
} from 'lucide-react';
import { WidgetCard } from './widget-card';

type Status = 'idle' | 'sending' | 'success' | 'error';

const MAX_FILE_MB = 10;
const MIN_MESSAGE = 5;
const MAX_MESSAGE = 4000;

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function FeedbackWidget() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  function pickFile() {
    fileRef.current?.click();
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    if (f && f.size > MAX_FILE_MB * 1024 * 1024) {
      setErr(`File phải ≤ ${MAX_FILE_MB} MB`);
      setStatus('error');
      e.target.value = '';
      return;
    }
    setFile(f);
    setStatus('idle');
    setErr(null);
  }

  function clearFile() {
    setFile(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  function reset() {
    setName('');
    setEmail('');
    setMessage('');
    clearFile();
    setStatus('idle');
    setErr(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === 'sending') return;

    if (!name.trim()) {
      setErr('Vui lòng nhập tên.');
      setStatus('error');
      return;
    }
    if (message.trim().length < MIN_MESSAGE) {
      setErr(`Nội dung phải ≥ ${MIN_MESSAGE} ký tự.`);
      setStatus('error');
      return;
    }
    if (message.trim().length > MAX_MESSAGE) {
      setErr(`Nội dung phải ≤ ${MAX_MESSAGE} ký tự.`);
      setStatus('error');
      return;
    }

    setStatus('sending');
    setErr(null);

    try {
      const fd = new FormData();
      fd.append('name', name.trim());
      fd.append('email', email.trim());
      fd.append('message', message.trim());
      if (file) fd.append('file', file);

      const r = await fetch('/api/feedback', { method: 'POST', body: fd });
      const json = (await r.json().catch(() => null)) as
        | { ok: boolean; error?: string }
        | null;
      if (!r.ok || !json?.ok) {
        throw new Error(json?.error ?? `HTTP ${r.status}`);
      }
      setStatus('success');
      // Clear sau 4s, giữ email để user gõ message mới ko phải nhập lại
      setTimeout(() => {
        setMessage('');
        clearFile();
        setStatus('idle');
      }, 3500);
    } catch (e) {
      setStatus('error');
      setErr(e instanceof Error ? e.message : 'Lỗi không rõ');
    }
  }

  const sending = status === 'sending';
  const charCount = message.length;
  const charCountOver = charCount > MAX_MESSAGE;

  return (
    <WidgetCard
      title="Góp ý & phản hồi"
      icon={<MessageSquare size={16} strokeWidth={2} />}
      action={
        <span
          className="text-[10px] uppercase tracking-wide"
          style={{ color: 'var(--color-text-muted)' }}
        >
          Gửi qua Telegram
        </span>
      }
    >
      <form onSubmit={onSubmit} className="space-y-3" id="feedback">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <label className="flex flex-col gap-1">
            <span
              className="text-[11px] uppercase tracking-wide font-medium"
              style={{ color: 'var(--color-text-muted)' }}
            >
              Họ tên <span style={{ color: '#EF4444' }}>*</span>
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              required
              placeholder="Hồ Sỹ Trí"
              className="px-3 h-9 rounded-md text-sm outline-none border"
              style={{
                background: 'var(--color-surface-bg)',
                borderColor: 'var(--color-border-default)',
                color: 'var(--color-text-primary)',
              }}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span
              className="text-[11px] uppercase tracking-wide font-medium"
              style={{ color: 'var(--color-text-muted)' }}
            >
              Email (tùy chọn)
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={200}
              placeholder="ban@email.com"
              className="px-3 h-9 rounded-md text-sm outline-none border"
              style={{
                background: 'var(--color-surface-bg)',
                borderColor: 'var(--color-border-default)',
                color: 'var(--color-text-primary)',
              }}
            />
          </label>
        </div>

        <label className="flex flex-col gap-1">
          <span
            className="text-[11px] uppercase tracking-wide font-medium flex items-center justify-between"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <span>
              Nội dung <span style={{ color: '#EF4444' }}>*</span>
            </span>
            <span
              className={`tabular-nums ${charCountOver ? 'font-semibold' : ''}`}
              style={{ color: charCountOver ? '#EF4444' : 'var(--color-text-muted)' }}
            >
              {charCount}/{MAX_MESSAGE}
            </span>
          </span>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            required
            placeholder="Góp ý, lỗi, yêu cầu tính năng… càng chi tiết càng tốt."
            className="px-3 py-2 rounded-md text-sm outline-none border resize-y"
            style={{
              background: 'var(--color-surface-bg)',
              borderColor: 'var(--color-border-default)',
              color: 'var(--color-text-primary)',
              minHeight: 90,
            }}
          />
        </label>

        {/* File attach */}
        <div className="flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            onChange={onFileChange}
            className="hidden"
            accept="image/*,.pdf,.doc,.docx,.txt,.zip"
          />
          <button
            type="button"
            onClick={pickFile}
            className="inline-flex items-center gap-1.5 px-3 h-9 rounded-md text-xs font-medium border hover:bg-[var(--color-surface-muted)] transition-colors"
            style={{
              borderColor: 'var(--color-border-default)',
              color: 'var(--color-text-primary)',
            }}
          >
            <Paperclip size={13} strokeWidth={2} />
            {file ? 'Đổi file' : 'Đính kèm file'}
          </button>
          {file && (
            <div
              className="flex items-center gap-1.5 px-2.5 h-9 rounded-md text-xs"
              style={{
                background: 'var(--color-surface-muted)',
                color: 'var(--color-text-primary)',
              }}
            >
              <FileText size={12} strokeWidth={2} />
              <span className="max-w-[160px] truncate" title={file.name}>
                {file.name}
              </span>
              <span
                className="tabular-nums"
                style={{ color: 'var(--color-text-muted)' }}
              >
                ({formatSize(file.size)})
              </span>
              <button
                type="button"
                onClick={clearFile}
                aria-label="Bỏ file"
                className="ml-1 hover:opacity-70"
              >
                <X size={11} strokeWidth={2.25} />
              </button>
            </div>
          )}
          <span
            className="text-[10px] ml-auto"
            style={{ color: 'var(--color-text-muted)' }}
          >
            ≤ {MAX_FILE_MB} MB
          </span>
        </div>

        {/* Status line */}
        {status === 'success' && (
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-md text-sm"
            style={{
              background: 'rgba(16,185,129,0.12)',
              color: '#10B981',
              border: '1px solid rgba(16,185,129,0.30)',
            }}
          >
            <CheckCircle2 size={14} strokeWidth={2} />
            Đã gửi! Cảm ơn phản hồi của bạn.
          </div>
        )}
        {status === 'error' && err && (
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-md text-sm"
            style={{
              background: 'rgba(239,68,68,0.12)',
              color: '#EF4444',
              border: '1px solid rgba(239,68,68,0.30)',
            }}
          >
            <AlertCircle size={14} strokeWidth={2} />
            {err}
          </div>
        )}

        {/* Buttons */}
        <div className="flex items-center gap-2 pt-1">
          <button
            type="submit"
            disabled={sending}
            className="inline-flex items-center gap-2 px-4 h-10 rounded-md font-semibold text-sm transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{
              background: 'var(--color-accent-gradient)',
              color: '#ffffff',
            }}
          >
            {sending ? (
              <>
                <Loader2
                  size={14}
                  strokeWidth={2.25}
                  className="animate-spin"
                />
                Đang gửi…
              </>
            ) : (
              <>
                <Send size={14} strokeWidth={2.25} />
                Gửi góp ý
              </>
            )}
          </button>
          <button
            type="button"
            onClick={reset}
            disabled={sending}
            className="inline-flex items-center gap-1.5 px-3 h-10 rounded-md text-sm font-medium border hover:bg-[var(--color-surface-muted)] transition-colors disabled:opacity-50"
            style={{
              borderColor: 'var(--color-border-default)',
              color: 'var(--color-text-muted)',
            }}
          >
            Xóa
          </button>
        </div>

        <p
          className="text-[10px] italic"
          style={{ color: 'var(--color-text-muted)' }}
        >
          Nội dung sẽ chuyển tới tác giả qua bot Telegram riêng, không lưu trữ
          trên server.
        </p>
      </form>
    </WidgetCard>
  );
}
