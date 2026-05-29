import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { AuthProvider } from '@/lib/auth-context';
// Phase 78 — Replace TopNav + SideNav cũ bằng BruNav minimal brutalist.
// Bo dark/light toggle, single palette (dark).
import { BruNav } from '@/components/bru/bru-nav';
import { BruCmdK } from '@/components/bru/bru-cmdk';
import { OverlayHost } from '@/components/overlay-host';
import { PwaRegister } from '@/components/pwa-register';
import { WebVitalsReporter } from '@/components/web-vitals-reporter';
import { ErrorReporter } from '@/components/error-reporter';
import { ErrorBoundary } from '@/components/error-boundary';
import { UmamiTracker } from '@/components/umami-tracker';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';

/**
 * Plus Jakarta Sans — font chính cho cả display (tiêu đề) lẫn body.
 * Phase 24.3 — switch từ Be Vietnam Pro sang Plus Jakarta Sans để đồng bộ
 * với 7 desktop app (design-system gold standard).
 * Subset 'latin' + 'vietnamese' bảo đảm dấu tiếng Việt rõ nét.
 * Expose CSS variable --font-display để page.tsx + component dùng qua
 * Tailwind class (`font-display`) hoặc inline style (`var(--font-display)`).
 */
const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-display',
  display: 'swap',
});

// Phase 16.2: metadataBase bắt buộc cho Open Graph image URL resolve đúng
// absolute. Lấy từ env, fallback `trishteam.io.vn` (domain đã mua — xem
// docs/DOMAIN-TENTEN.md).
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
  'https://trishteam.io.vn';

const SITE_TITLE = 'TrishTEAM — Dashboard hệ sinh thái ứng dụng cá nhân';
const SITE_DESC =
  'TrishTEAM: ôn thi lái xe, chứng chỉ XD, biển báo QC41:2024, cầu VN, bảng tin, TrishNotes — và 10 ứng dụng desktop đồng bộ. Offline-first, dark mode mặc định.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: '%s · TrishTEAM',
  },
  description: SITE_DESC,
  applicationName: 'TrishTEAM',
  manifest: '/manifest.json',
  keywords: [
    'TrishTEAM',
    'ôn thi lái xe',
    'chứng chỉ xây dựng',
    'QC41:2024',
    'biển báo giao thông',
    'TrishNotes',
    'desktop app Việt',
  ],
  authors: [{ name: 'Trí (TrishTEAM)' }],
  creator: 'TrishTEAM',
  publisher: 'TrishTEAM',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'TrishTEAM',
  },
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
  },
  // Phase 16.2: Open Graph defaults — mọi page kế thừa trừ khi override.
  openGraph: {
    type: 'website',
    locale: 'vi_VN',
    url: SITE_URL,
    title: SITE_TITLE,
    description: SITE_DESC,
    siteName: 'TrishTEAM',
    images: [
      {
        url: '/og/og-default.png',
        width: 1200,
        height: 630,
        alt: 'TrishTEAM — Dashboard hệ sinh thái ứng dụng cá nhân',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESC,
    images: ['/og/og-default.png'],
  },
  alternates: {
    canonical: SITE_URL,
  },
  formatDetection: { telephone: false },
};

export const viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#0b1220' },
    { media: '(prefers-color-scheme: light)', color: '#0ea5e9' },
  ],
  colorScheme: 'dark light',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Phase 38 — Maintenance mode đã tắt vĩnh viễn (sau wave release v1.0).
  // Trước có `headers()` đọc x-maintenance từ middleware nhưng gây runtime
  // error cho static prerendered pages. Giờ render thẳng layout đầy đủ.
  return (
    // data-theme="dark" là default. ThemeProvider có thể swap sang "light" runtime.
    <html
      lang="vi"
      data-theme="dark"
      className={plusJakartaSans.variable}
      suppressHydrationWarning
    >
      <body
        className="font-display min-h-screen relative overflow-x-hidden"
        style={{ background: '#0A0E0E', color: '#FAFAF7' }}
      >
        {/* Phase 78 — Brutalist flat bg. Bỏ ambient orbs (no glow). */}
        <ThemeProvider>
          <AuthProvider>
            {/* Phase 78 — Brutalist layout: top nav minimal, no sidebar, full-width content. */}
            <BruNav />
            <BruCmdK />
            <div className="bru">
              <ErrorBoundary>{children}</ErrorBoundary>
            </div>
            {/* Global overlays (Phase 11.5.12-14): Command Palette · Keyboard
                Help · Focus Mode. Render cuối để nằm trên mọi content. */}
            <OverlayHost />
            {/* Phase 11.9: Đăng ký service worker (offline fallback + cache). */}
            <PwaRegister />
            {/* Phase 16.3: Core Web Vitals reporter (sendBeacon → /api/vitals). */}
            <WebVitalsReporter />
            {/* Phase 16.5: Global error + unhandledrejection → /api/errors. */}
            <ErrorReporter />
            {/* Phase 16.6: Umami privacy analytics (flag-gated by env). */}
            <UmamiTracker />
            {/* Phase 20.5: Vercel Analytics + Speed Insights (free Hobby
                tier, 10k events/tháng). Tự enable khi deploy lên Vercel,
                dev local no-op. Privacy: cookie-less, không PII. */}
            <Analytics />
            <SpeedInsights />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
