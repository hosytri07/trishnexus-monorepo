'use client';

/**
 * AppDetailModal — popup chi tiết app khi click vào tile trong EcosystemWidget.
 * Nội dung:
 *   - Logo lớn + tên + tagline
 *   - Status badge (released / beta / coming_soon) + login requirement
 *   - Version + size + release_date
 *   - Features list (bullet)
 *   - Screenshots (nếu có)
 *   - CTA: Tải xuống / Xem changelog / Yêu cầu sớm ra
 */
import { useState } from 'react';
import { Calendar, Download, ExternalLink, HardDrive, Lock, Package, User, KeyRound, Gem } from 'lucide-react';
import { Modal } from '@/components/modal/modal';
import {
  type AppForWebsite,
  statusLabel,
  formatSize,
  formatReleaseDate,
} from '@/lib/apps';
import { resolveAppIcon } from '@/lib/app-icons';

type Props = {
  app: AppForWebsite | null;
  onClose: () => void;
};

const LoginIcon = {
  none: Package,
  trial: KeyRound,
  paid: Gem,
  user: User,
  admin: Lock,
  dev: Lock,
} as const;

const LoginLabel = {
  none: 'Không cần đăng nhập',
  trial: 'Cần đăng nhập (trial bị chặn — kích hoạt key)',
  paid: 'Cần kích hoạt key',
  user: 'Yêu cầu tài khoản user',
  admin: 'Yêu cầu admin',
  dev: 'Yêu cầu developer',
} as const;

function StatusBadge({ status }: { status: AppForWebsite['status'] }) {
  const map = {
    released: { bg: 'rgba(16,185,129,0.12)', fg: '#10B981', dot: '#10B981' },
    beta: { bg: 'rgba(245,158,11,0.12)', fg: '#F59E0B', dot: '#F59E0B' },
    coming_soon: { bg: 'rgba(160,152,144,0.15)', fg: 'var(--color-text-muted)', dot: 'var(--color-text-muted)' },
  } as const;
  const style = map[status] ?? map.coming_soon;

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
      style={{ background: style.bg, color: style.fg }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        aria-hidden="true"
        style={{ background: style.dot }}
      />
      {statusLabel(status)}
    </span>
  );
}

function AppLogo({ app }: { app: AppForWebsite }) {
  const [broken, setBroken] = useState(false);
  const Fallback = resolveAppIcon(app.icon_fallback);
  const showFallback = broken || !app.logo_path;

  // Nền white-ish gradient để logo transparent nổi bật trong dark mode.
  const tintBg = `
    linear-gradient(135deg,
      rgba(255,255,255,0.88) 0%,
      rgba(255,255,255,0.75) 100%
    ),
    linear-gradient(135deg, ${app.accent}22 0%, ${app.accent}44 100%)
  `;

  return (
    <div
      className="w-20 h-20 rounded-xl flex items-center justify-center shrink-0 overflow-hidden"
      style={{
        background: tintBg,
        border: `1px solid ${app.accent}55`,
      }}
    >
      {showFallback ? (
        <Fallback size={40} strokeWidth={1.75} style={{ color: app.accent }} />
      ) : (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={app.logo_path}
          alt={`${app.name} logo`}
          width={72}
          height={72}
          onError={() => setBroken(true)}
          style={{ objectFit: 'contain', width: '72px', height: '72px' }}
        />
      )}
    </div>
  );
}

export function AppDetailModal({ app, onClose }: Props) {
  if (!app) return null;
  const LoginIconCmp = LoginIcon[app.login_required] ?? Package;
  const loginLabel = LoginLabel[app.login_required] ?? app.login_required;
  const downloadEntry = app.download?.windows_x64;
  const canDownload = app.status === 'released' && !!downloadEntry?.url;

  return (
    <Modal open={!!app} onClose={onClose} title={app.name}>
      <div className="space-y-6">
        {/* Header: logo + tagline + badges */}
        <div className="flex items-start gap-4">
          <AppLogo app={app} />
          <div className="min-w-0 flex-1">
            <p
              className="text-base leading-relaxed"
              style={{ color: 'var(--color-text-primary)' }}
            >
              {app.tagline}
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <StatusBadge status={app.status} />
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs"
                style={{
                  background: 'var(--color-surface-muted)',
                  color: 'var(--color-text-muted)',
                }}
              >
                <LoginIconCmp size={11} strokeWidth={2} />
                {loginLabel}
              </span>
            </div>
          </div>
        </div>

        {/* Meta grid: version + size + release date */}
        <div
          className="grid grid-cols-3 gap-3 py-4 border-y"
          style={{ borderColor: 'var(--color-border-subtle)' }}
        >
          <div>
            <div
              className="flex items-center gap-1.5 text-xs uppercase tracking-wide mb-1"
              style={{ color: 'var(--color-text-muted)' }}
            >
              <Package size={11} strokeWidth={2} />
              Phiên bản
            </div>
            <div
              className="font-semibold tabular-nums"
              style={{ color: 'var(--color-text-primary)' }}
            >
              {app.version}
            </div>
          </div>
          <div>
            <div
              className="flex items-center gap-1.5 text-xs uppercase tracking-wide mb-1"
              style={{ color: 'var(--color-text-muted)' }}
            >
              <HardDrive size={11} strokeWidth={2} />
              Dung lượng
            </div>
            <div
              className="font-semibold tabular-nums"
              style={{ color: 'var(--color-text-primary)' }}
            >
              {formatSize(app.size_bytes)}
            </div>
          </div>
          <div>
            <div
              className="flex items-center gap-1.5 text-xs uppercase tracking-wide mb-1"
              style={{ color: 'var(--color-text-muted)' }}
            >
              <Calendar size={11} strokeWidth={2} />
              Phát hành
            </div>
            <div
              className="font-semibold tabular-nums"
              style={{ color: 'var(--color-text-primary)' }}
            >
              {formatReleaseDate(app.release_date)}
            </div>
          </div>
        </div>

        {/* Features */}
        {app.features.length > 0 && (
          <div>
            <h3
              className="text-sm font-semibold uppercase tracking-wide mb-3"
              style={{ color: 'var(--color-text-secondary)', letterSpacing: '0.04em' }}
            >
              Tính năng chính
            </h3>
            <ul className="space-y-2">
              {app.features.map((f, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2.5 text-sm leading-relaxed"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  <span
                    className="inline-block w-1.5 h-1.5 rounded-full mt-2 shrink-0"
                    style={{ background: app.accent }}
                  />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Actions */}
        <div
          className="flex flex-wrap gap-2 pt-4 border-t"
          style={{ borderColor: 'var(--color-border-subtle)' }}
        >
          {canDownload ? (
            <a
              href={downloadEntry!.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 h-10 rounded-md font-semibold text-sm transition-opacity hover:opacity-90"
              style={{
                background: 'var(--color-accent-gradient)',
                color: '#ffffff',
              }}
            >
              <Download size={14} strokeWidth={2.25} />
              Tải xuống
            </a>
          ) : (
            <button
              type="button"
              disabled
              className="inline-flex items-center gap-2 px-4 h-10 rounded-md font-semibold text-sm cursor-not-allowed"
              style={{
                background: 'var(--color-surface-muted)',
                color: 'var(--color-text-muted)',
              }}
            >
              <Download size={14} strokeWidth={2.25} />
              Chưa phát hành
            </button>
          )}

          {app.changelog_url && (
            <a
              href={app.changelog_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 h-10 rounded-md font-medium text-sm border transition-colors hover:bg-[var(--color-surface-muted)]"
              style={{
                borderColor: 'var(--color-border-default)',
                color: 'var(--color-text-primary)',
              }}
            >
              Changelog
              <ExternalLink size={12} strokeWidth={2} />
            </a>
          )}
        </div>
      </div>
    </Modal>
  );
}
