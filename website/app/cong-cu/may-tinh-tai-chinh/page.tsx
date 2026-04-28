import Link from 'next/link';
import { ArrowLeft, Calculator } from 'lucide-react';
import { FinancialCalcWidget } from '@/components/widgets/financial-calc-widget';

export const metadata = {
  title: 'Máy tính tài chính — TrishTEAM',
  description: 'Tính lãi kép, tiết kiệm, trả góp — công cụ tài chính cá nhân cơ bản.',
};

export default function FinancialCalcPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-8">
      <Link href="/" className="inline-flex items-center gap-2 mb-6 text-sm" style={{ color: 'var(--color-text-muted)' }}>
        <ArrowLeft size={15} /> Quay lại Dashboard
      </Link>

      <header className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Calculator size={26} strokeWidth={1.75} style={{ color: 'var(--color-accent-primary)' }} />
          <h1 className="text-3xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Máy tính tài chính</h1>
        </div>
        <p className="text-base" style={{ color: 'var(--color-text-secondary)' }}>
          Tính nhanh lãi kép, tiết kiệm theo tháng, trả góp — kết quả ước tính cơ bản, không thay thế tư vấn ngân hàng.
        </p>
      </header>

      <FinancialCalcWidget />
    </main>
  );
}
