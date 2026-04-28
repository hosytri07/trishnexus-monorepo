import Link from 'next/link';
import { ArrowLeft, CloudSun } from 'lucide-react';
import { WeatherWidget } from '@/components/widgets/weather-widget';

export const metadata = {
  title: 'Thời tiết — TrishTEAM',
  description: 'Thời tiết hiện tại + dự báo theo vị trí của bạn.',
};

export default function WeatherPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-8">
      <Link href="/" className="inline-flex items-center gap-2 mb-6 text-sm" style={{ color: 'var(--color-text-muted)' }}>
        <ArrowLeft size={15} /> Quay lại Dashboard
      </Link>

      <header className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <CloudSun size={26} strokeWidth={1.75} style={{ color: 'var(--color-accent-primary)' }} />
          <h1 className="text-3xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Thời tiết</h1>
        </div>
        <p className="text-base" style={{ color: 'var(--color-text-secondary)' }}>
          Thời tiết hiện tại theo vị trí của bạn (cần cấp quyền Geolocation), dữ liệu từ Open-Meteo.
        </p>
      </header>

      <WeatherWidget />
    </main>
  );
}
