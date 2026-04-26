'use client';

/**
 * EcosystemWidget — grid 10 apps từ apps-registry.json.
 * Click 1 tile → AppDetailModal hiện popup chi tiết.
 *
 * Tile v2 (sau feedback):
 *   - Logo to chiếm full-height bên trái (có nền tint sáng để dark mode
 *     không "nuốt" logo bg-transparent).
 *   - Tên + status text ở bên phải logo (layout ngang).
 *   - Status dot ở góc phải trên cùng tile.
 *
 *   ┌──────┬───────────────┐
 *   │      │ TrishFont     │
 *   │ LOGO │ Beta v0.9.0   │  ●
 *   │      │               │
 *   └──────┴───────────────┘
 */
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Sparkles, Download } from 'lucide-react';
import { WidgetCard } from './widget-card';
import { AppDetailModal } from './app-detail-modal';
import { getAppsForWebsite, type AppForWebsite } from '@/lib/apps';
import { resolveAppIcon } from '@/lib/app-icons';

function AppLogoBig({ app }: { app: AppForWebsite }) {
  const [broken, setBroken] = useState(false);
  const IconCmp = resolveAppIcon(app.icon_fallback);
  const showFallback = broken || !app.logo_path;

  // Nền tint sáng (white-ish gradient over accent) để logo transparent
  // vẫn nổi bật trong cả 2 theme.
  const tintBg = `
    linear-gradient(135deg,
      rgba(255,255,255,0.85) 0%,
      rgba(255,255,255,0.72) 100%
    ),
    linear-gradient(135deg, ${app.accent}22 0%, ${app.accent}44 100%)
  `;

  return (
    <div
      className="relative flex items-center justify-center shrink-0"
      style={{
        width: 72,
        height: 72,
        background: tintBg,
        borderRadius: 10,
        border: `1px solid ${app.accent}44`,
      }}
    >
      {showFallback ? (
        <IconCmp size={36} strokeWidth={1.75} style={{ color: app.accent }} />
      ) : (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={app.logo_path}
          alt={`${app.name} logo`}
          width={60}
          height={60}
          onError={() => setBroken(true)}
          style={{ objectFit: 'contain', width: 60, height: 60 }}
        />
      )}
    </div>
  );
}

function AppTile({ app, onClick }: { app: AppForWebsite; onClick: () => void }) {
  const statusDot =
    {
      released: '#10B981',
      beta: '#F59E0B',
      coming_soon: 'var(--color-text-muted)',
    }[app.status] ?? 'var(--color-text-muted)';

  const versionLabel =
    app.status === 'released'
      ? `v${app.version}`
      : app.status === 'beta'
      ? `Beta v${app.version}`
      : 'Sắp ra mắt';

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex items-center gap-3 p-3 rounded-lg transition-all text-left"
      style={{
        background: 'var(--color-surface-muted)',
        border: '1px solid var(--color-border-subtle)',
      }}
      aria-label={`Chi tiết ${app.name}`}
    >
      {/* Hover accent overlay */}
      <span
        aria-hidden="true"
        className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
        style={{
          background: `linear-gradient(135deg, ${app.accent}11 0%, transparent 100%)`,
          border: `1px solid ${app.accent}55`,
        }}
      />

      {/* Logo to bên trái */}
      <AppLogoBig app={app} />

      {/* Name + status */}
      <div className="relative min-w-0 flex-1">
        <div
          className="font-semibold text-sm truncate"
          style={{ color: 'var(--color-text-primary)' }}
          title={app.name}
        >
          {app.name}
        </div>
        <div
          className="text-xs truncate mt-0.5 tabular-nums"
          style={{ color: 'var(--color-text-muted)' }}
        >
          {versionLabel}
        </div>
        <div
          className="text-[11px] truncate mt-1.5 leading-snug"
          style={{ color: 'var(--color-text-secondary)' }}
          title={app.tagline}
        >
          {app.tagline.length > 50 ? `${app.tagline.slice(0, 50)}…` : app.tagline}
        </div>
      </div>

      {/* Status dot góc phải trên */}
      <span
        aria-hidden="true"
        className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full"
        style={{ background: statusDot, boxShadow: `0 0 6px ${statusDot}` }}
      />
    </button>
  );
}

export function EcosystemWidget() {
  const apps = useMemo(() => getAppsForWebsite(), []);
  const [selected, setSelected] = useState<AppForWebsite | null>(null);

  return (
    <>
      <WidgetCard
        title="Hệ sinh thái TrishNexus"
        icon={<Sparkles size={16} strokeWidth={2} />}
        action={
          <Link
            href="/downloads"
            className="inline-flex items-center gap-1 text-xs font-medium transition-colors hover:underline"
            style={{ color: 'var(--color-accent-primary)' }}
            title="Xem trang tải về đầy đủ với hướng dẫn cài đặt"
          >
            <Download size={12} strokeWidth={2.25} />
            Trang tải về
          </Link>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {apps.map((app) => (
            <AppTile key={app.id} app={app} onClick={() => setSelected(app)} />
          ))}
        </div>
      </WidgetCard>

      <AppDetailModal app={selected} onClose={() => setSelected(null)} />
    </>
  );
}
