'use client';

/**
 * Phase 14.7.c — Client-side OS detection + render download cards.
 *
 * Tách riêng file vì Next.js 14 App Router không cho export `metadata`
 * cùng `'use client'`. Page.tsx (server) giữ metadata + import cái này.
 *
 * Detect logic dựa `navigator.userAgent` — không phải 100% chính xác
 * (user có thể spoof UA) nhưng đủ cho UX. User vẫn thấy full list bên
 * dưới để override manual.
 */

import { useEffect, useState } from 'react';
import { Download, Monitor, Apple, HardDrive, Package } from 'lucide-react';

type OS = 'windows' | 'macos' | 'linux' | 'unknown';

interface DownloadTarget {
  os: OS;
  label: string;
  ext: string;
  fileName: string;
  note: string;
  available: boolean;
  Icon: typeof Monitor;
}

// Phase 16.4 ship v2.0.1 — login badges + footer login link.
// Tag GitHub Release: launcher-v2.0.1 — phân biệt với release app con
// sau này (vd font-v2.0.0, note-v2.0.0).
const RELEASE_TAG = 'launcher-v2.0.1';
const RELEASE_VERSION = '2.0.1';
const GH_REPO = 'hosytri07/trishnexus-monorepo';

const releaseUrl = (fileName: string) =>
  `https://github.com/${GH_REPO}/releases/download/${RELEASE_TAG}/${fileName}`;

const TARGETS: DownloadTarget[] = [
  {
    os: 'windows',
    label: 'Windows — Installer (.exe)',
    ext: 'exe',
    fileName: `TrishLauncher_${RELEASE_VERSION}_x64-setup.exe`,
    note: 'NSIS installer. Hỗ trợ UAC + chọn ngôn ngữ VN/EN.',
    available: true,
    Icon: Monitor,
  },
  {
    os: 'windows',
    label: 'Windows — Enterprise (.msi)',
    ext: 'msi',
    fileName: `TrishLauncher_${RELEASE_VERSION}_x64_en-US.msi`,
    note: 'Gói MSI cho Group Policy / SCCM deploy.',
    available: true,
    Icon: Package,
  },
  {
    os: 'macos',
    label: 'macOS — DMG (Apple Silicon + Intel)',
    ext: 'dmg',
    fileName: `TrishLauncher_${RELEASE_VERSION}_universal.dmg`,
    note: 'Đang chuẩn bị — cần build trên máy macOS.',
    available: false,
    Icon: Apple,
  },
  {
    os: 'linux',
    label: 'Linux — Debian / Ubuntu (.deb)',
    ext: 'deb',
    fileName: `trish-launcher_${RELEASE_VERSION}_amd64.deb`,
    note: 'Đang chuẩn bị — cần build trên Linux.',
    available: false,
    Icon: HardDrive,
  },
  {
    os: 'linux',
    label: 'Linux — AppImage (mọi distro)',
    ext: 'AppImage',
    fileName: `trish-launcher_${RELEASE_VERSION}_amd64.AppImage`,
    note: 'Đang chuẩn bị — cần build trên Linux.',
    available: false,
    Icon: HardDrive,
  },
];

/** Detect OS từ User-Agent. Trả 'unknown' nếu không match rõ. */
function detectOs(ua: string): OS {
  const lower = ua.toLowerCase();
  if (lower.includes('win')) return 'windows';
  if (lower.includes('mac')) return 'macos';
  if (lower.includes('linux') || lower.includes('x11')) return 'linux';
  return 'unknown';
}

export function DownloadCards() {
  const [os, setOs] = useState<OS>('unknown');

  useEffect(() => {
    // navigator chỉ tồn tại ở client — chạy trong useEffect để tránh
    // hydration mismatch với SSR.
    setOs(detectOs(navigator.userAgent));
  }, []);

  const primary = TARGETS.find((t) => t.os === os && t.available);
  const rest = TARGETS.filter((t) => t !== primary);

  return (
    <div className="space-y-8">
      {primary && (
        <section>
          <h2
            className="text-sm uppercase font-bold mb-3"
            style={{ color: 'var(--color-text-muted)', letterSpacing: '0.05em' }}
          >
            Phù hợp máy của bạn
          </h2>
          <DownloadCard target={primary} primary />
        </section>
      )}

      <section>
        <h2
          className="text-sm uppercase font-bold mb-3"
          style={{ color: 'var(--color-text-muted)', letterSpacing: '0.05em' }}
        >
          {primary ? 'Các nền tảng khác' : 'Tất cả nền tảng'}
        </h2>
        <div className="grid gap-3">
          {rest.map((t) => (
            <DownloadCard key={t.fileName} target={t} />
          ))}
        </div>
      </section>

      <section
        className="border rounded-lg p-6 text-sm"
        style={{
          borderColor: 'var(--color-border-subtle)',
          background: 'var(--color-surface-card)',
          color: 'var(--color-text-secondary)',
        }}
      >
        <p className="font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>
          Verify checksum (khuyến khích):
        </p>
        <p className="mb-2">
          Mỗi bản release có file <code className="font-mono">SHA256SUMS.txt</code> kèm theo. So
          sánh checksum sau khi tải để đảm bảo file không bị chỉnh sửa:
        </p>
        <pre
          className="font-mono text-xs p-3 rounded overflow-x-auto"
          style={{ background: 'var(--color-surface-raised)' }}
        >
{`# Windows PowerShell
Get-FileHash .\\TrishLauncher_${RELEASE_VERSION}_x64-setup.exe -Algorithm SHA256

# macOS / Linux
shasum -a 256 TrishLauncher_${RELEASE_VERSION}_*.dmg`}
        </pre>
      </section>
    </div>
  );
}

function DownloadCard({
  target,
  primary = false,
}: {
  target: DownloadTarget;
  primary?: boolean;
}) {
  const { label, note, fileName, available, Icon } = target;
  const accent = primary ? 'var(--color-accent-primary)' : 'var(--color-border-subtle)';
  const bg = primary ? 'var(--color-accent-primary-soft)' : 'var(--color-surface-card)';

  return (
    <div
      className="flex items-center gap-4 border rounded-lg p-4"
      style={{ borderColor: accent, background: bg }}
    >
      <Icon
        size={28}
        style={{ color: primary ? 'var(--color-accent-primary)' : 'var(--color-text-muted)' }}
      />
      <div className="flex-1 min-w-0">
        <div
          className="font-semibold"
          style={{ color: 'var(--color-text-primary)' }}
        >
          {label}
        </div>
        <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
          {note}
        </div>
      </div>
      {available ? (
        <a
          href={releaseUrl(fileName)}
          download={fileName}
          className="inline-flex items-center gap-2 px-4 py-2 rounded font-semibold text-sm"
          style={{
            background: 'var(--color-accent-primary)',
            color: 'var(--color-on-accent, white)',
          }}
        >
          <Download size={16} />
          Tải về
        </a>
      ) : (
        <span
          className="inline-flex items-center gap-2 px-4 py-2 rounded font-semibold text-sm"
          style={{
            background: 'var(--color-surface-raised)',
            color: 'var(--color-text-muted)',
            cursor: 'not-allowed',
          }}
          aria-disabled
        >
          Sắp ra mắt
        </span>
      )}
    </div>
  );
}
