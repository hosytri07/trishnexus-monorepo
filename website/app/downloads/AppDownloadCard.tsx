'use client';

/**
 * AppDownloadCard — Phase 19.22.
 *
 * Card download cho 1 app, dùng chung cho TrishLauncher (primary) +
 * các app con. Logic:
 *   - status='released' → nút "Tải về" → /dl/{appId}
 *   - status='scheduled' & chưa tới release_at → countdown, disable
 *   - status='scheduled' & đã tới → render như released
 *   - khác → "Sắp ra mắt", disable
 */

import { Download, Calendar, Lock } from 'lucide-react';
import {
  type AppForWebsite,
  isReleaseAvailable,
  getReleaseAt,
  formatSize,
  formatReleaseDate,
} from '@/lib/apps';
import { CountdownClock } from '@/components/countdown-clock';

export function AppDownloadCard({
  app,
  primary = false,
}: {
  app: AppForWebsite;
  primary?: boolean;
}) {
  const win = app.download?.windows_x64;
  const available = isReleaseAvailable(app);
  const releaseAt = getReleaseAt(app);
  const isScheduled = app.status === 'scheduled' && releaseAt && !available;
  const isDeprecated = app.status === 'deprecated';

  const accent = primary ? 'var(--color-accent-primary)' : 'var(--color-border-subtle)';
  const bg = primary ? 'var(--color-accent-primary-soft)' : 'var(--color-surface-card)';

  return (
    <div
      id={app.id}
      className="flex items-center gap-4 border rounded-lg p-4 scroll-mt-20"
      style={{ borderColor: accent, background: bg }}
    >
      {/* Logo */}
      <div
        className="shrink-0 flex items-center justify-center"
        style={{
          width: primary ? 64 : 56,
          height: primary ? 64 : 56,
          background: 'rgba(255, 255, 255, 0.85)',
          borderRadius: 10,
          border: `1px solid ${app.accent}44`,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={app.logo_path}
          alt={`${app.name} logo`}
          width={primary ? 50 : 44}
          height={primary ? 50 : 44}
          style={{ objectFit: 'contain' }}
        />
      </div>

      {/* Name + tagline */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <strong
            className={primary ? 'text-lg' : 'text-base'}
            style={{ color: 'var(--color-text-primary)' }}
          >
            {app.name}
          </strong>
          <span
            className="text-xs tabular-nums"
            style={{ color: 'var(--color-text-muted)' }}
          >
            v{app.version}
            {app.size_bytes > 0 ? ` · ${formatSize(app.size_bytes)}` : ''}
          </span>
        </div>
        <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
          {app.tagline}
        </div>
        {isScheduled && releaseAt ? (
          <div
            className="text-xs mt-1.5 inline-flex items-center gap-1.5 px-2 py-1 rounded"
            style={{
              background: 'rgba(245,158,11,0.12)',
              color: '#B45309',
            }}
          >
            <Calendar size={11} />
            <span>Phát hành {formatReleaseDate(releaseAt)} · còn</span>
            <CountdownClock releaseAt={releaseAt} showIcon={false} />
          </div>
        ) : null}
      </div>

      {/* Action button */}
      {isDeprecated ? (
        <span
          className="inline-flex items-center gap-2 px-4 py-2 rounded font-semibold text-sm shrink-0"
          style={{
            background: 'var(--color-surface-raised)',
            color: 'var(--color-text-muted)',
            cursor: 'not-allowed',
          }}
          aria-disabled
        >
          <Lock size={14} /> Đã gộp
        </span>
      ) : available && win?.url ? (
        <a
          href={`/dl/${app.id}`}
          download
          className="inline-flex items-center gap-2 px-4 py-2 rounded font-semibold text-sm transition-opacity hover:opacity-90 shrink-0"
          style={{
            background: 'var(--color-accent-gradient)',
            color: '#ffffff',
          }}
        >
          <Download size={14} strokeWidth={2.25} />
          Tải về
        </a>
      ) : (
        <span
          className="inline-flex items-center gap-2 px-4 py-2 rounded font-semibold text-sm shrink-0"
          style={{
            background: 'var(--color-surface-raised)',
            color: 'var(--color-text-muted)',
            cursor: 'not-allowed',
          }}
          aria-disabled
        >
          <Calendar size={14} />
          {isScheduled ? 'Chưa tới giờ' : 'Sắp ra mắt'}
        </span>
      )}
    </div>
  );
}
