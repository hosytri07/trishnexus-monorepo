/**
 * Phase 19.22 — Section "Apps đã phát hành" trên /downloads.
 *
 * Nhận `apps` props từ page server async → không tự fetch lại.
 *
 * Filter:
 *   - id !== 'trishlauncher' (section riêng phía trên)
 *   - status không phải 'deprecated' (4 app gộp vào TrishLibrary, không hiện)
 */

import type { AppForWebsite } from '@/lib/apps';
import { AppDownloadCard } from './AppDownloadCard';

export function OtherAppsSection({ apps }: { apps: AppForWebsite[] }) {
  const visibleApps = apps.filter(
    (a) => a.id !== 'trishlauncher' && a.status !== 'deprecated',
  );

  if (visibleApps.length === 0) {
    return (
      <p
        className="text-sm py-8 text-center"
        style={{ color: 'var(--color-text-muted)' }}
      >
        Chưa có app nào.
      </p>
    );
  }

  return (
    <div className="grid gap-3">
      {visibleApps.map((app) => (
        <AppDownloadCard key={app.id} app={app} />
      ))}
    </div>
  );
}
