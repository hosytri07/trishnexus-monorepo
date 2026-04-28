import Link from 'next/link';
import { ArrowLeft, Timer } from 'lucide-react';
import { PomodoroWidget } from '@/components/widgets/pomodoro-widget';

export const metadata = {
  title: 'Pomodoro — TrishTEAM',
  description: 'Đồng hồ Pomodoro 25-5-25-5-25-5-25-15 — tập trung làm việc theo phương pháp Cirillo.',
};

export default function PomodoroPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-8">
      <Link href="/" className="inline-flex items-center gap-2 mb-6 text-sm" style={{ color: 'var(--color-text-muted)' }}>
        <ArrowLeft size={15} /> Quay lại Dashboard
      </Link>

      <header className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Timer size={26} strokeWidth={1.75} style={{ color: 'var(--color-accent-primary)' }} />
          <h1 className="text-3xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Pomodoro</h1>
        </div>
        <p className="text-base" style={{ color: 'var(--color-text-secondary)' }}>
          Tập trung làm việc 25 phút, nghỉ 5 phút. Sau 4 chu kỳ, nghỉ dài 15 phút. Phương pháp do Francesco Cirillo phát minh từ những năm 1980 — đơn giản nhưng cực kỳ hiệu quả với coding, viết, học bài.
        </p>
      </header>

      <PomodoroWidget />
    </main>
  );
}
