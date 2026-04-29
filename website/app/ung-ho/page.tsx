'use client';

/**
 * /ung-ho — Phase 19.18 — List + modal layout.
 *
 * Card list compact bên ngoài, click → modal full info + QR to.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, Heart, Info, Shield, X } from 'lucide-react';

interface Charity {
  id: string;
  name: string;
  organization: string;
  description: string;
  bank: string;
  bankCode: string;
  account: string;
  accountName: string;
  website: string;
  defaultMemo?: string;
  accent: string;
}

const CHARITIES: Charity[] = [
  {
    id: 'mttqvn',
    name: 'Quỹ Cứu trợ Trung ương',
    organization: 'Ủy ban TƯ Mặt trận Tổ quốc Việt Nam',
    description:
      'Quỹ tổng hợp lớn nhất của Mặt trận Tổ quốc — phân bổ cứu trợ thiên tai, dịch bệnh, hỗ trợ vùng khó khăn theo điều phối quốc gia.',
    bank: 'Vietinbank',
    bankCode: 'ICB',
    account: '102010008168',
    accountName: 'UY BAN TW MAT TRAN TO QUOC VIET NAM',
    website: 'https://mattran.org.vn',
    defaultMemo: 'Ung ho quy cuu tro TW',
    accent: '#EF4444',
  },
  {
    id: 'red-cross',
    name: 'Hội Chữ thập đỏ Việt Nam',
    organization: 'Hội CTĐ Việt Nam (Trung ương)',
    description:
      'Hỗ trợ nhân đạo: hiến máu, cứu trợ thiên tai, người yếu thế, mổ tim trẻ em, ATGT cộng đồng.',
    bank: 'Vietcombank Hà Nội',
    bankCode: 'VCB',
    account: '0011000049114',
    accountName: 'TW HOI CHU THAP DO VIET NAM',
    website: 'https://redcross.org.vn',
    defaultMemo: 'Ung ho Chu thap do',
    accent: '#DC2626',
  },
  {
    id: 'poor-fund',
    name: 'Quỹ Vì người nghèo Trung ương',
    organization: 'Ủy ban TƯ MTTQ Việt Nam',
    description:
      'Hỗ trợ hộ nghèo, hộ cận nghèo, hộ có hoàn cảnh khó khăn — xây nhà Đại đoàn kết, tặng quà Tết, hỗ trợ học bổng.',
    bank: 'Agribank',
    bankCode: 'VBA',
    account: '1300201059899',
    accountName: 'QUY VI NGUOI NGHEO TW',
    website: 'https://mattran.org.vn',
    defaultMemo: 'Ung ho quy vi nguoi ngheo',
    accent: '#F59E0B',
  },
];

function vietQrUrl(c: Charity, size: 'compact' | 'large' = 'compact'): string {
  const memo = encodeURIComponent(c.defaultMemo ?? '');
  const accountName = encodeURIComponent(c.accountName);
  const variant = size === 'large' ? 'compact2' : 'compact';
  return `https://img.vietqr.io/image/${c.bankCode}-${c.account}-${variant}.png?addInfo=${memo}&accountName=${accountName}`;
}

export default function UngHoPage() {
  const [selected, setSelected] = useState<Charity | null>(null);

  // ESC to close
  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelected(null);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [selected]);

  return (
    <main className="max-w-3xl mx-auto px-6 py-10">
      <Link
        href="/"
        className="inline-flex items-center gap-2 mb-6 text-sm transition-opacity hover:opacity-80"
        style={{ color: 'var(--color-text-muted)' }}
      >
        <ArrowLeft size={15} /> Quay lại Dashboard
      </Link>

      <header className="mb-8 text-center">
        <div
          className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4"
          style={{
            background: 'rgba(236,72,153,0.15)',
            border: '2px solid #EC4899',
          }}
        >
          <Heart size={32} strokeWidth={1.75} style={{ color: '#EC4899' }} />
        </div>
        <h1 className="text-3xl md:text-4xl font-bold mb-3" style={{ color: 'var(--color-text-primary)' }}>
          Ủng hộ thiện nguyện
        </h1>
        <p className="text-base md:text-lg leading-relaxed max-w-xl mx-auto" style={{ color: 'var(--color-text-secondary)' }}>
          Click chọn quỹ để xem QR + chi tiết. <strong>TrishTEAM phi tập trung — không nhận trung gian.</strong>
        </p>
      </header>

      <div
        className="rounded-xl border p-4 mb-6 max-w-2xl mx-auto"
        style={{
          background: 'var(--color-accent-soft)',
          borderColor: 'var(--color-accent-primary)',
          borderLeftWidth: 3,
        }}
      >
        <div className="flex items-start gap-3">
          <Shield size={18} strokeWidth={2} style={{ color: 'var(--color-accent-primary)' }} />
          <div className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
            <strong>An toàn 100%</strong> — tất cả tài khoản đều thuộc tổ chức được Chính phủ
            quản lý. QR chuẩn NAPAS 247 quét trực tiếp app ngân hàng VN.
          </div>
        </div>
      </div>

      {/* List */}
      <div className="space-y-2">
        {CHARITIES.map((c) => (
          <CharityRow key={c.id} charity={c} onClick={() => setSelected(c)} />
        ))}
      </div>

      {/* Modal */}
      {selected && <CharityModal charity={selected} onClose={() => setSelected(null)} />}

      <section
        className="mt-8 rounded-xl border p-5"
        style={{ background: 'var(--color-surface-card)', borderColor: 'var(--color-border-default)' }}
      >
        <h2
          className="text-sm font-bold uppercase tracking-wider mb-3 inline-flex items-center gap-2"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <Info size={13} /> Cách quyên góp
        </h2>
        <ol className="space-y-1.5 text-sm list-decimal list-inside" style={{ color: 'var(--color-text-secondary)' }}>
          <li>Click 1 quỹ để mở chi tiết + QR</li>
          <li>Mở app ngân hàng → Quét QR / VietQR</li>
          <li>Nhập số tiền + xác nhận</li>
        </ol>
      </section>
    </main>
  );
}

function CharityRow({ charity, onClick }: { charity: Charity; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left flex items-center gap-4 p-4 rounded-lg border transition-all hover:scale-[1.005]"
      style={{
        background: 'var(--color-surface-card)',
        borderColor: 'var(--color-border-default)',
        borderLeftWidth: 3,
        borderLeftColor: charity.accent,
      }}
    >
      {/* Icon circle */}
      <div
        className="shrink-0 inline-flex items-center justify-center w-12 h-12 rounded-full"
        style={{
          background: charity.accent + '22',
          border: `1px solid ${charity.accent}44`,
        }}
      >
        <Heart size={20} strokeWidth={1.75} style={{ color: charity.accent }} />
      </div>

      {/* Main info */}
      <div className="flex-1 min-w-0">
        <h3 className="text-base font-bold truncate" style={{ color: 'var(--color-text-primary)' }}>
          {charity.name}
        </h3>
        <p className="text-xs uppercase tracking-wider truncate" style={{ color: 'var(--color-text-muted)' }}>
          {charity.organization}
        </p>
        <p
          className="text-xs mt-1 inline-flex items-center gap-2 font-mono"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          <span>{charity.bank}</span>
          <span aria-hidden>·</span>
          <span>{charity.account}</span>
        </p>
      </div>

      {/* CTA */}
      <span
        className="shrink-0 inline-flex items-center gap-1 px-3 h-8 rounded text-xs font-semibold"
        style={{
          background: charity.accent + '22',
          color: charity.accent,
        }}
      >
        Xem QR →
      </span>
    </button>
  );
}

function CharityModal({ charity, onClose }: { charity: Charity; onClose: () => void }) {
  const qrUrl = vietQrUrl(charity, 'large');
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
      style={{ background: 'rgba(0,0,0,0.7)' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative max-w-2xl w-full rounded-xl border max-h-[90vh] overflow-y-auto"
        style={{
          background: 'var(--color-surface-card)',
          borderColor: charity.accent,
          borderWidth: 2,
        }}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 inline-flex items-center justify-center w-9 h-9 rounded-full transition-colors hover:bg-[var(--color-surface-muted)] z-10"
          aria-label="Đóng"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <X size={18} />
        </button>

        <div className="p-6 md:p-8">
          {/* Header */}
          <div
            className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-4"
            style={{
              background: charity.accent + '22',
              border: `2px solid ${charity.accent}55`,
            }}
          >
            <Heart size={26} strokeWidth={1.75} style={{ color: charity.accent }} />
          </div>
          <h2 className="text-2xl md:text-3xl font-bold mb-1" style={{ color: 'var(--color-text-primary)' }}>
            {charity.name}
          </h2>
          <p
            className="text-xs uppercase tracking-wider mb-4"
            style={{ color: charity.accent }}
          >
            {charity.organization}
          </p>
          <p className="text-sm leading-relaxed mb-6" style={{ color: 'var(--color-text-secondary)' }}>
            {charity.description}
          </p>

          {/* QR + bank info */}
          <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-5 mb-5">
            {/* QR large */}
            <div
              className="mx-auto md:mx-0 p-3 rounded-lg"
              style={{ background: '#ffffff' }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrUrl}
                alt={`QR ${charity.name}`}
                className="w-64 h-64 object-contain"
                loading="eager"
              />
            </div>

            {/* Bank info */}
            <dl className="space-y-3">
              <Row label="Ngân hàng" value={charity.bank} />
              <Row label="Số TK" value={charity.account} mono large />
              <Row label="Chủ TK" value={charity.accountName} />
              {charity.defaultMemo && (
                <Row label="Nội dung gợi ý" value={charity.defaultMemo} mono />
              )}
            </dl>
          </div>

          <div className="pt-4 border-t flex flex-wrap items-center justify-between gap-3" style={{ borderColor: 'var(--color-border-subtle)' }}>
            <a
              href={charity.website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-semibold transition-opacity hover:opacity-80"
              style={{ color: charity.accent }}
            >
              <ExternalLink size={13} />
              {charity.website.replace(/^https?:\/\//, '')}
            </a>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              💡 Mở app ngân hàng → Quét QR
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, mono = false, large = false }: { label: string; value: string; mono?: boolean; large?: boolean }) {
  return (
    <div className="flex flex-col">
      <dt className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: 'var(--color-text-muted)' }}>
        {label}
      </dt>
      <dd
        className={`${mono ? 'font-mono' : 'font-semibold'} ${large ? 'text-lg' : 'text-sm'}`}
        style={{ color: 'var(--color-text-primary)' }}
      >
        {value}
      </dd>
    </div>
  );
}
