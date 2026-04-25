/**
 * Phase 15.0.q — Section "Apps đã phát hành" trên /downloads page.
 *
 * Fetch apps released từ registry (qua lib/apps.ts), filter:
 *  - status === 'released'
 *  - id !== 'trishlauncher' (đã có section riêng phía trên)
 *  - có download.windows_x64.url
 *
 * Mỗi app render 1 card với logo + tagline + version + button "Tải về"
 * trỏ trực tiếp GitHub Release URL. Click → browser download.
 *
 * Khi admin push app mới (status released) trong apps-registry.json →
 * Vercel rebuild → page tự cập nhật, không cần code change.
 */

import { Download } from 'lucide-react';
import { getAppsForWebsite, formatSize } from '@/lib/apps';

export function OtherAppsSection() {
  const apps = getAppsForWebsite();
  const releasedApps = apps.filter(
    (a) =>
      a.status === 'released' &&
      a.id !== 'trishlauncher' &&
      Boolean(a.download?.windows_x64?.url),
  );

  if (releasedApps.length === 0) {
    return (
      <p
        className="text-sm py-8 text-center"
        style={{ color: 'var(--color-text-muted)' }}
      >
        Chưa có app con nào phát hành. TrishCheck đang được build, các app khác sẽ ra mắt
        trong các tuần tới.
      </p>
    );
  }

  return (
    <div className="grid gap-3">
      {releasedApps.map((app) => (
        <AppDownloadCard key={app.id} app={app} />
      ))}
    </div>
  );
}

function AppDownloadCard({
  app,
}: {
  app: ReturnType<typeof getAppsForWebsite>[number];
}) {
  const win = app.download.windows_x64;
  if (!win) return null;

  return (
    <div
      id={app.id}
      className="flex items-center gap-4 border rounded-lg p-4 scroll-mt-20"
      style={{
        borderColor: 'var(--color-border-subtle)',
        background: 'var(--color-surface-card)',
      }}
    >
      {/* Logo */}
      <div
        className="shrink-0 flex items-center justify-center"
        style={{
          width: 56,
          height: 56,
          background: 'rgba(255, 255, 255, 0.85)',
          borderRadius: 10,
          border: `1px solid ${app.accent}44`,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={app.logo_path}
          alt={`${app.name} logo`}
          width={44}
          height={44}
          style={{ objectFit: 'contain' }}
        />
      </div>

      {/* Name + tagline */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <strong
            className="text-base"
            style={{ color: 'var(--color-text-primary)' }}
          >
            {app.name}
          </strong>
          <span
            className="text-xs tabular-nums"
            style={{ color: 'var(--color-text-muted)' }}
          >
            v{app.version} · {formatSize(app.size_bytes)}
          </span>
        </div>
        <div
          className="text-xs mt-1"
          style={{ color: 'var(--color-text-muted)' }}
        >
          {app.tagline}
        </div>
      </div>

      {/* Download button */}
      <a
        href={win.url}
        download
        className="inline-flex items-center gap-2 px-4 py-2 rounded font-semibold text-sm transition-opacity hover:opacity-90 shrink-0"
        style={{
          background: 'var(--color-accent-primary)',
          color: '#ffffff',
        }}
      >
        <Download size={14} strokeWidth={2.25} />
        Tải về
      </a>
    </div>
  );
}
