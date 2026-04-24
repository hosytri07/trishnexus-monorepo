'use client';

/**
 * QuickNotesWidget — Phase 11.7.2.
 *
 * Nguồn lưu:
 *   - Guest: localStorage (offline-only)
 *   - Login: Firestore `/notes/{uid}/items/quick-note`, realtime qua
 *     `useNotesSync` hook (đồng bộ multi-device).
 *
 * UI trạng thái:
 *   ✅ "Đã sync cloud"   → Firestore saved.
 *   💾 "Đã lưu local"    → guest / fallback.
 *   ⏳ "Đang lưu…"       → debounce hoặc gọi setDoc.
 *   ⚠️ "Lỗi sync"        → setDoc fail (text vẫn giữ + local cache).
 */
import Link from 'next/link';
import {
  NotebookPen,
  Check,
  Cloud,
  CloudOff,
  AlertTriangle,
  ExternalLink,
  Trash2,
} from 'lucide-react';
import { WidgetCard } from './widget-card';
import { useNotesSync } from '@/lib/notes-sync';

export function QuickNotesWidget() {
  const { text, setText, status, source, clear } = useNotesSync();

  return (
    <WidgetCard
      title="Ghi chú nhanh"
      icon={<NotebookPen size={16} strokeWidth={2} />}
      action={
        <Link
          href="/notes"
          className="inline-flex items-center gap-1 text-xs font-medium transition-colors hover:opacity-80"
          style={{ color: 'var(--color-text-link)' }}
        >
          Mở TrishNotes
          <ExternalLink size={12} strokeWidth={2} />
        </Link>
      }
    >
      <div className="space-y-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={
            source === 'remote'
              ? 'Ghi ý tưởng nhanh ở đây… Sync realtime qua Firestore, mở trên thiết bị khác vẫn thấy.'
              : 'Ghi ý tưởng nhanh ở đây… Auto-save localStorage. Đăng nhập để sync multi-device.'
          }
          className="w-full resize-none outline-none p-3 rounded-md text-sm leading-relaxed"
          style={{
            background: 'var(--color-surface-muted)',
            border: '1px solid var(--color-border-subtle)',
            color: 'var(--color-text-primary)',
            minHeight: 140,
            fontFamily: 'inherit',
          }}
          aria-label="Ghi chú nhanh"
        />

        <div
          className="flex items-center justify-between text-xs"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <span className="inline-flex items-center gap-1.5">
            <StatusIcon status={status} source={source} />
            <StatusLabel status={status} source={source} chars={text.length} />
          </span>

          {text.length > 0 && (
            <button
              type="button"
              onClick={clear}
              className="inline-flex items-center gap-1 transition-colors hover:opacity-80"
              style={{ color: 'var(--color-text-muted)' }}
              aria-label="Xoá ghi chú nhanh"
            >
              <Trash2 size={11} strokeWidth={2} />
              Xoá
            </button>
          )}
        </div>
      </div>
    </WidgetCard>
  );
}

function StatusIcon({
  status,
  source,
}: {
  status: 'saved' | 'saving' | 'error' | 'local';
  source: 'local' | 'remote';
}) {
  if (status === 'error') {
    return (
      <AlertTriangle size={12} strokeWidth={2.5} style={{ color: '#F59E0B' }} />
    );
  }
  if (status === 'saving') {
    return (
      <span
        className="inline-block w-1.5 h-1.5 rounded-full animate-pulse"
        style={{ background: 'var(--color-accent-primary)' }}
      />
    );
  }
  if (source === 'remote' && status === 'saved') {
    return <Cloud size={12} strokeWidth={2.25} style={{ color: '#10B981' }} />;
  }
  if (source === 'local') {
    return (
      <CloudOff size={12} strokeWidth={2} style={{ color: 'var(--color-text-muted)' }} />
    );
  }
  return <Check size={12} strokeWidth={2.5} style={{ color: '#10B981' }} />;
}

function StatusLabel({
  status,
  source,
  chars,
}: {
  status: 'saved' | 'saving' | 'error' | 'local';
  source: 'local' | 'remote';
  chars: number;
}) {
  if (status === 'error') return <>Lỗi sync · lưu tạm local · {chars} ký tự</>;
  if (status === 'saving') return <>Đang lưu… · {chars} ký tự</>;
  if (source === 'remote') return <>Đã sync cloud · {chars} ký tự</>;
  return <>Đã lưu local · {chars} ký tự</>;
}
