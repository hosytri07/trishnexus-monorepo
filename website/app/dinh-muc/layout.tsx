import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Định mức xây dựng — Tra cứu QĐ 1776 — TrishTEAM',
  description:
    'Tra cứu định mức hao phí vật liệu, nhân công, máy thi công theo QĐ 1776/2007/QĐ-BXD. Có máy tính khối lượng × định mức.',
  openGraph: {
    title: 'Định mức dự toán xây dựng — QĐ 1776/2007',
    description: 'Đào đắp, bê tông, cốt thép, xây trát, cốp pha, mặt đường, cọc móng.',
    type: 'website',
  },
  alternates: { canonical: '/dinh-muc' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
