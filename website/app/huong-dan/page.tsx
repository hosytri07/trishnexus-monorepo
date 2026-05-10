/**
 * /huong-dan — Index hướng dẫn 11 apps TrishTEAM (Phase 39.1).
 */

import Link from 'next/link';
import type { Metadata } from 'next';
import { APP_GUIDES } from '@/lib/huong-dan-content';

export const metadata: Metadata = {
  title: 'Hướng dẫn — TrishTEAM',
  description:
    'Hướng dẫn sử dụng 11 app TrishTEAM cho kỹ sư xây dựng / giao thông Việt Nam: TrishLauncher, TrishLibrary, TrishDesign, TrishDrive, TrishFinance, TrishISO, TrishShortcut, TrishCheck, TrishClean, TrishFont, TrishOffice.',
};

const KEY_TYPE_LABELS: Record<
  'free' | 'standalone' | 'account',
  { label: string; emoji: string; color: string }
> = {
  free: { label: 'Miễn phí', emoji: '🆓', color: '#10B981' },
  standalone: { label: 'Key máy', emoji: '🔒', color: '#F59E0B' },
  account: { label: 'Key tài khoản', emoji: '🗝', color: '#DC2626' },
};

export default function HuongDanIndexPage(): JSX.Element {
  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1
          className="text-3xl font-bold mb-2"
          style={{ color: 'var(--color-text-primary)' }}
        >
          📖 Hướng dẫn sử dụng
        </h1>
        <p
          className="max-w-3xl"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Bộ tài liệu hướng dẫn cho 11 app TrishTEAM — từ cài đặt, đăng ký tài
          khoản, đến các tính năng nâng cao. Click vào card để xem chi tiết từng
          app.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {APP_GUIDES.map((guide) => {
          const keyMeta = KEY_TYPE_LABELS[guide.keyType];
          return (
            <Link
              key={guide.slug}
              href={`/huong-dan/${guide.slug}`}
              className="group rounded-lg border hover:shadow-md transition p-5"
              style={{
                borderColor: 'var(--color-border-default)',
                background: 'var(--color-surface-card)',
              }}
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="text-3xl">{guide.icon}</div>
                <div className="flex-1 min-w-0">
                  <h2
                    className="font-bold text-base transition"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    {guide.title}
                  </h2>
                  <span
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold mt-1"
                    style={{
                      background: `${keyMeta.color}15`,
                      color: keyMeta.color,
                    }}
                  >
                    {keyMeta.emoji} {keyMeta.label}
                  </span>
                </div>
              </div>
              <p
                className="text-sm line-clamp-3"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                {guide.shortDesc}
              </p>
              <div
                className="mt-3 text-xs font-semibold"
                style={{ color: 'var(--color-accent-primary)' }}
              >
                Xem hướng dẫn →
              </div>
            </Link>
          );
        })}
      </div>

      <div
        className="mt-10 p-5 rounded-lg border"
        style={{
          background: 'var(--color-accent-soft)',
          borderColor: 'var(--color-accent-primary)',
        }}
      >
        <h2
          className="font-bold mb-2"
          style={{ color: 'var(--color-text-primary)' }}
        >
          🔑 Về cơ chế tài khoản
        </h2>
        <ul
          className="text-sm space-y-1.5 list-disc pl-5"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          <li>
            <strong>🆓 Miễn phí:</strong> Chỉ TrishLauncher — tải về dùng ngay,
            không cần đăng nhập.
          </li>
          <li>
            <strong>👤 Cần đăng nhập:</strong> 10 app còn lại yêu cầu đăng nhập
            Firebase (email/Google). Tài khoản mới có role &quot;trial&quot; bị
            chặn — admin cấp role &quot;user&quot; (full quyền) hoặc
            &quot;demo&quot; (có thời hạn) sau khi liên hệ.
          </li>
          <li>
            <strong>👑 Admin:</strong> chỉ cấp nội bộ, không bán. Mỗi tài khoản
            demo có thời hạn riêng do admin set (mặc định 30-365 ngày).
          </li>
        </ul>
      </div>
    </div>
  );
}
