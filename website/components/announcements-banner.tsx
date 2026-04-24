'use client';

/**
 * AnnouncementsBanner — thanh thông báo admin đầu dashboard.
 *
 * Lọc announcement active theo:
 *   - Trong khoảng [starts_at, expires_at]
 *   - Audience: 'all' hoặc 'guests' (chưa có auth → treat mọi người như guest)
 *   - Chưa bị dismiss (localStorage 'trishteam:dismissed')
 *
 * Ưu tiên theo severity: critical > warning > info > success.
 * Chỉ hiện 1 announcement cao nhất tại 1 thời điểm cho gọn.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Info,
  X,
} from 'lucide-react';
import {
  ANNOUNCEMENTS,
  type Announcement,
  type AnnouncementSeverity,
} from '@/data/announcements';

const DISMISS_KEY = 'trishteam:dismissed';

const SEVERITY_ORDER: Record<AnnouncementSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
  success: 3,
};

const SEVERITY_STYLE: Record<
  AnnouncementSeverity,
  { bg: string; border: string; color: string; Icon: typeof Info }
> = {
  critical: {
    bg: 'rgba(239,68,68,0.12)',
    border: 'rgba(239,68,68,0.35)',
    color: '#EF4444',
    Icon: AlertCircle,
  },
  warning: {
    bg: 'rgba(245,158,11,0.12)',
    border: 'rgba(245,158,11,0.35)',
    color: '#F59E0B',
    Icon: AlertTriangle,
  },
  info: {
    bg: 'rgba(59,130,246,0.12)',
    border: 'rgba(59,130,246,0.35)',
    color: '#3B82F6',
    Icon: Info,
  },
  success: {
    bg: 'rgba(16,185,129,0.12)',
    border: 'rgba(16,185,129,0.35)',
    color: '#10B981',
    Icon: CheckCircle2,
  },
};

function loadDismissed(): string[] {
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function saveDismissed(ids: string[]): void {
  try {
    window.localStorage.setItem(DISMISS_KEY, JSON.stringify(ids));
  } catch {
    /* ignore */
  }
}

function isActive(a: Announcement, now: number): boolean {
  if (a.starts_at && new Date(a.starts_at).getTime() > now) return false;
  if (a.expires_at && new Date(a.expires_at).getTime() < now) return false;
  // Chưa có auth → audience 'users' tạm ẩn, còn 'all' + 'guests' show.
  if (a.audience === 'users') return false;
  return true;
}

export function AnnouncementsBanner() {
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState<string[]>([]);

  useEffect(() => {
    setMounted(true);
    setDismissed(loadDismissed());
  }, []);

  const active = useMemo<Announcement | null>(() => {
    if (!mounted) return null;
    const now = Date.now();
    const list = ANNOUNCEMENTS.filter(
      (a) => isActive(a, now) && !dismissed.includes(a.id)
    ).sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
    return list[0] ?? null;
  }, [mounted, dismissed]);

  if (!mounted || !active) return null;

  const style = SEVERITY_STYLE[active.severity];
  const { Icon } = style;

  function handleDismiss() {
    if (!active) return;
    const next = [...new Set([...dismissed, active.id])];
    setDismissed(next);
    saveDismissed(next);
  }

  return (
    <div
      role="status"
      className="rounded-lg px-4 py-3 flex items-start gap-3"
      style={{
        background: style.bg,
        border: `1px solid ${style.border}`,
      }}
    >
      <span
        aria-hidden="true"
        className="shrink-0 mt-0.5"
        style={{ color: style.color }}
      >
        <Icon size={18} strokeWidth={2} />
      </span>

      <div className="min-w-0 flex-1">
        <div
          className="text-sm font-semibold"
          style={{ color: 'var(--color-text-primary)' }}
        >
          {active.title}
        </div>
        {active.body && (
          <div
            className="text-xs mt-0.5 leading-relaxed"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {active.body}
          </div>
        )}
        {active.link && (
          <a
            href={active.link.href}
            className="inline-flex items-center gap-1 text-xs font-semibold mt-1.5 hover:opacity-80 transition-opacity"
            style={{ color: style.color }}
            target={active.link.href.startsWith('http') ? '_blank' : undefined}
            rel={
              active.link.href.startsWith('http') ? 'noopener noreferrer' : undefined
            }
          >
            {active.link.label}
            <ExternalLink size={10} strokeWidth={2} />
          </a>
        )}
      </div>

      {(active.dismissible ?? true) && (
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Đóng thông báo"
          className="shrink-0 p-1 rounded hover:bg-[var(--color-surface-muted)] transition-colors"
          style={{ color: style.color }}
        >
          <X size={14} strokeWidth={2.25} />
        </button>
      )}
    </div>
  );
}
