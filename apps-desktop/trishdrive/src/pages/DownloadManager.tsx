/**
 * DownloadManager — Phase 25.1.H
 *
 * Global floating widget hiển thị TẤT CẢ download đang chạy đồng thời.
 * Listen `drive-progress` event từ Rust, track Map<download_id, ProgressState>.
 * Mỗi entry hiện file_name + progress bar + MB current/total + % + phase.
 *
 * Sử dụng:
 *   - Mount 1 lần ở App.tsx (top-level).
 *   - Bất kỳ screen nào gọi `share_paste_and_download` truyền `downloadId` đều
 *     tự động xuất hiện trong panel.
 *   - Panel collapse/expand qua nút header.
 *   - Auto remove entry sau 5s khi phase = 'done' hoặc 'error' (cancellable).
 *
 * Vị trí: bottom-right, fixed, z-index cao hơn modal nhưng thấp hơn toast.
 */

import { useEffect, useState } from 'react';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { ChevronDown, ChevronUp, X, CheckCircle2, AlertCircle, Loader2, Pause, FileDown } from 'lucide-react';

interface ProgressEvent {
  download_id: string;
  current_chunk: number;
  total_chunks: number;
  bytes_done: number;
  total_bytes: number;
  file_name: string;
  /** 'downloading' | 'decrypting' | 'verifying' | 'done' | 'error' | 'paused' */
  phase: string;
}

interface DownloadEntry extends ProgressEvent {
  started_at: number;
  last_update_at: number;
  /** speed MB/s tính từ delta bytes / delta time */
  speed_mbps: number;
  /** prev bytes_done để tính speed */
  prev_bytes_done: number;
  prev_update_at: number;
}

const AUTO_REMOVE_MS = 5000;

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function phaseLabel(phase: string): string {
  switch (phase) {
    case 'downloading': return 'Đang tải';
    case 'decrypting': return 'Giải mã';
    case 'verifying': return 'Xác thực';
    case 'done': return 'Hoàn tất';
    case 'error': return 'Lỗi';
    case 'paused': return 'Tạm dừng';
    default: return phase;
  }
}

function phaseColor(phase: string): string {
  switch (phase) {
    case 'done': return 'var(--color-accent-primary)';
    case 'error': return '#ef4444';
    case 'paused': return '#f59e0b';
    default: return 'var(--color-accent-primary)';
  }
}

export function DownloadManager(): JSX.Element | null {
  const [entries, setEntries] = useState<Map<string, DownloadEntry>>(new Map());
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    let unlistenFn: UnlistenFn | null = null;
    let cancelled = false;

    void (async () => {
      unlistenFn = await listen<ProgressEvent>('drive-progress', (e) => {
        const p = e.payload;
        // Bỏ qua event không có download_id (legacy callers chưa update)
        if (!p.download_id) return;

        setEntries((prev) => {
          const next = new Map(prev);
          const existing = next.get(p.download_id);
          const now = Date.now();

          if (existing) {
            // Tính speed: delta bytes / delta time
            const dt = (now - existing.prev_update_at) / 1000;
            const dBytes = p.bytes_done - existing.prev_bytes_done;
            const speed_mbps = dt > 0.1 ? (dBytes / 1_048_576) / dt : existing.speed_mbps;

            next.set(p.download_id, {
              ...p,
              started_at: existing.started_at,
              last_update_at: now,
              speed_mbps: Math.max(0, speed_mbps),
              // Snapshot mỗi 500ms để smooth speed
              prev_bytes_done: dt > 0.5 ? p.bytes_done : existing.prev_bytes_done,
              prev_update_at: dt > 0.5 ? now : existing.prev_update_at,
            });
          } else {
            next.set(p.download_id, {
              ...p,
              started_at: now,
              last_update_at: now,
              speed_mbps: 0,
              prev_bytes_done: p.bytes_done,
              prev_update_at: now,
            });
          }
          return next;
        });

        // Auto-remove sau AUTO_REMOVE_MS nếu phase=done/error
        if (p.phase === 'done' || p.phase === 'error') {
          setTimeout(() => {
            if (cancelled) return;
            setEntries((prev) => {
              const next = new Map(prev);
              next.delete(p.download_id);
              return next;
            });
          }, AUTO_REMOVE_MS);
        }
      });
    })();

    return () => {
      cancelled = true;
      if (unlistenFn) unlistenFn();
    };
  }, []);

  if (entries.size === 0) return null;

  const list = Array.from(entries.values()).sort((a, b) => b.started_at - a.started_at);
  const activeCount = list.filter((e) => e.phase !== 'done' && e.phase !== 'error').length;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 16,
        right: 16,
        zIndex: 150,
        width: 360,
        maxWidth: 'calc(100vw - 32px)',
        background: 'var(--color-surface-card)',
        border: '1px solid var(--color-border-subtle)',
        borderRadius: 14,
        boxShadow: '0 8px 30px rgba(0,0,0,0.18)',
        overflow: 'hidden',
        fontFamily: 'inherit',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 14px',
          background: 'var(--color-accent-soft)',
          cursor: 'pointer',
          userSelect: 'none',
        }}
        onClick={() => setCollapsed((c) => !c)}
      >
        <FileDown className="h-4 w-4" style={{ color: 'var(--color-accent-primary)' }} />
        <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--color-accent-primary)' }}>
          {activeCount > 0
            ? `Đang tải ${activeCount} file${list.length > activeCount ? ` · ${list.length - activeCount} xong` : ''}`
            : `Tải xuống · ${list.length} file`}
        </div>
        <button
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--color-accent-primary)', padding: 2,
          }}
          onClick={(ev) => { ev.stopPropagation(); setCollapsed((c) => !c); }}
          title={collapsed ? 'Mở rộng' : 'Thu gọn'}
        >
          {collapsed ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {/* Body */}
      {!collapsed && (
        <div style={{ maxHeight: 'min(400px, 60vh)', overflowY: 'auto' }}>
          {list.map((entry) => {
            const pct = entry.total_bytes > 0
              ? Math.min(100, Math.round((entry.bytes_done / entry.total_bytes) * 100))
              : 0;
            const isDone = entry.phase === 'done';
            const isError = entry.phase === 'error';
            const isPaused = entry.phase === 'paused';
            const Icon = isDone ? CheckCircle2 : isError ? AlertCircle : isPaused ? Pause : Loader2;
            const iconClass = !isDone && !isError && !isPaused ? 'animate-spin' : '';
            const color = phaseColor(entry.phase);

            return (
              <div
                key={entry.download_id}
                style={{
                  padding: '10px 14px',
                  borderTop: '1px solid var(--color-border-subtle)',
                }}
              >
                {/* File name + close (chỉ hiện khi done/error) */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <Icon
                    className={`h-3.5 w-3.5 ${iconClass}`}
                    style={{ color, flexShrink: 0 }}
                  />
                  <div
                    style={{
                      flex: 1,
                      fontSize: 12, fontWeight: 600,
                      color: 'var(--color-text-primary)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}
                    title={entry.file_name}
                  >
                    {entry.file_name}
                  </div>
                  {(isDone || isError) && (
                    <button
                      style={{
                        background: 'transparent', border: 'none', cursor: 'pointer',
                        color: 'var(--color-text-muted)', padding: 0, lineHeight: 0,
                      }}
                      onClick={() => setEntries((prev) => {
                        const next = new Map(prev);
                        next.delete(entry.download_id);
                        return next;
                      })}
                      title="Xoá khỏi list"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Progress bar */}
                <div
                  style={{
                    height: 6,
                    background: 'var(--color-surface-row)',
                    borderRadius: 3,
                    overflow: 'hidden',
                    marginBottom: 4,
                  }}
                >
                  <div
                    style={{
                      width: `${pct}%`,
                      height: '100%',
                      background: color,
                      transition: 'width 250ms ease-out',
                    }}
                  />
                </div>

                {/* Stats: MB + % + speed + phase */}
                <div
                  style={{
                    display: 'flex', justifyContent: 'space-between',
                    fontSize: 11, color: 'var(--color-text-muted)',
                  }}
                >
                  <div>
                    {formatBytes(entry.bytes_done)} / {formatBytes(entry.total_bytes)} · {pct}%
                  </div>
                  <div style={{ color: isError ? '#ef4444' : 'var(--color-text-muted)' }}>
                    {entry.phase === 'downloading' && entry.speed_mbps > 0
                      ? `${entry.speed_mbps.toFixed(1)} MB/s`
                      : phaseLabel(entry.phase)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
