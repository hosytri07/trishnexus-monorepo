import type { Metadata } from 'next';
import { Be_Vietnam_Pro } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { AuthProvider } from '@/lib/auth-context';
import { TopNav } from '@/components/nav/top-nav';
import { SideNav } from '@/components/nav/side-nav';
import { OverlayHost } from '@/components/overlay-host';
import { PwaRegister } from '@/components/pwa-register';
import { WebVitalsReporter } from '@/components/web-vitals-reporter';
import { ErrorReporter } from '@/components/error-reporter';
import { ErrorBoundary } from '@/components/error-boundary';
import { UmamiTracker } from '@/components/umami-tracker';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';

/**
 * Be Vietnam Pro — font chính cho cả display (tiêu đề) lẫn body.
 * Subset 'latin' + 'vietnamese' bảo đảm dấu tiếng Việt rõ nét.
 * Expose CSS variable --font-display để page.tsx + component dùng qua
 * Tailwind class (`font-display`) hoặc inline style (`var(--font-display)`).
 */
const beVietnamPro = Be_Vietnam_Pro({
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
  return (
    // data-theme="dark" là default. ThemeProvider có thể swap sang "light" runtime.
    <html
      lang="vi"
      data-theme="dark"
      className={beVietnamPro.variable}
      suppressHydrationWarning
    >
      <body className="font-display min-h-screen relative overflow-x-hidden">
        {/* Ambient gradient decoration — làm dịu 2 vùng trống 2 bên khi
            viewport rộng hơn max-w-[88rem]. pointer-events-none + z-[-1]
            để không ảnh hưởng click/scroll. Dùng var(--color-accent-*) để
            tự đổi màu theo theme (dark/light). */}
        <div
          aria-hidden
          data-ambient-decor
          className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
        >
          <div
            className="absolute"
            style={{
              top: '12%',
              left: '-8%',
              width: '32rem',
              height: '32rem',
              background:
                'radial-gradient(closest-side, var(--color-accent-soft), transparent 70%)',
              filter: 'blur(60px)',
              opacity: 0.85,
            }}
          />
          <div
            className="absolute"
            style={{
              top: '55%',
              right: '-10%',
              width: '36rem',
              height: '36rem',
              background:
                'radial-gradient(closest-side, rgba(245,158,11,0.10), transparent 70%)',
              filter: 'blur(80px)',
              opacity: 0.7,
            }}
          />
          <div
            className="absolute"
            style={{
              bottom: '-10%',
              left: '30%',
              width: '28rem',
              height: '28rem',
              background:
                'radial-gradient(closest-side, rgba(56,189,248,0.08), transparent 70%)',
              filter: 'blur(70px)',
              opacity: 0.6,
            }}
          />
        </div>

        <ThemeProvider>
          <AuthProvider>
            <TopNav />
            <div className="flex items-start relative">
              <SideNav />
              <div className="flex-1 min-w-0">
                {/* Phase 16.5: Bắt React render error, show fallback + report. */}
                <ErrorBoundary>{children}</ErrorBoundary>
              </div>
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
