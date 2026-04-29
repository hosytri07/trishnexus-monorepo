'use client';

/**
 * Phase 19.22 — TrishLauncher download card (data từ props).
 *
 * Trước Phase 19.22 hardcode 5 platform target (.exe / .msi / .dmg / ...).
 * Giờ Trí chỉ release .exe → 1 card duy nhất + verify SHA256.
 */

import type { AppForWebsite } from '@/lib/apps';
import { AppDownloadCard } from './AppDownloadCard';

export function DownloadCards({ launcher }: { launcher: AppForWebsite }) {
  return (
    <div className="space-y-3">
      <AppDownloadCard app={launcher} primary />

      <section
        className="border rounded-lg p-5 text-sm mt-6"
        style={{
          borderColor: 'var(--color-border-subtle)',
          background: 'var(--color-surface-card)',
          color: 'var(--color-text-secondary)',
        }}
      >
        <p className="font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>
          ✅ Verify checksum (khuyến khích):
        </p>
        <p className="mb-2">
          Sau khi tải, kiểm tra SHA256 để đảm bảo file không bị chỉnh sửa khi truyền:
        </p>
        <pre
          className="font-mono text-xs p-3 rounded overflow-x-auto"
          style={{ background: 'var(--color-surface-raised)' }}
        >
{`# Windows PowerShell
Get-FileHash .\\TrishLauncher_${launcher.version}_x64-setup.exe -Algorithm SHA256`}
        </pre>
      </section>
    </div>
  );
}
