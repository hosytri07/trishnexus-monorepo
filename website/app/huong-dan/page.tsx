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
        <h1 className="text-3xl font-bold mb-2">📖 Hướng dẫn sử dụng</h1>
        <p className="text-slate-600 max-w-3xl">
          Bộ tài liệu hướng dẫn cho 11 app TrishTEAM — từ cài đặt, kích hoạt key,
          đến các tính năng nâng cao. Click vào card để xem chi tiết từng app.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {APP_GUIDES.map((guide) => {
          const keyMeta = KEY_TYPE_LABELS[guide.keyType];
          return (
            <Link
              key={guide.slug}
              href={`/huong-dan/${guide.slug}`}
              className="group rounded-lg border border-slate-200 bg-white hover:border-emerald-400 hover:shadow-md transition p-5"
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="text-3xl">{guide.icon}</div>
                <div className="flex-1 min-w-0">
                  <h2 className="font-bold text-base group-hover:text-emerald-600 transition">
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
              <p className="text-sm text-slate-600 line-clamp-3">
                {guide.shortDesc}
              </p>
              <div className="mt-3 text-xs text-emerald-600 group-hover:text-emerald-700 font-semibold">
                Xem hướng dẫn →
              </div>
            </Link>
          );
        })}
      </div>

      <div className="mt-10 p-5 rounded-lg bg-emerald-50 border border-emerald-200">
        <h2 className="font-bold text-emerald-900 mb-2">
          🔑 Về cơ chế Key & Activation
        </h2>
        <ul className="text-sm text-emerald-800 space-y-1.5 list-disc pl-5">
          <li>
            <strong>🆓 Miễn phí:</strong> App dùng được ngay, không cần key (chỉ
            TrishLauncher).
          </li>
          <li>
            <strong>🔒 Key máy (Standalone):</strong> Cần nhập key 16 ký tự để
            kích hoạt — bind vào máy hiện tại, KHÔNG cần đăng nhập tài khoản.
            Dùng cho: TrishShortcut, TrishCheck, TrishClean, TrishFont.
          </li>
          <li>
            <strong>🗝 Key tài khoản (Account):</strong> Cần đăng nhập Firebase
            (email/Google) + nhập key — bind vào tài khoản. Login máy khác sẽ
            kick session cũ tự động sau 5s. Dùng cho: TrishLibrary, TrishDrive,
            TrishDesign, TrishFinance, TrishISO, TrishOffice.
          </li>
          <li>
            Key do <strong>admin TrishTEAM cấp nội bộ</strong>, không bán. Mỗi
            key có thể được admin set riêng: thời hạn (mặc định 365 ngày) + số
            thiết bị đồng thời (mặc định 1).
          </li>
        </ul>
      </div>
    </div>
  );
}
