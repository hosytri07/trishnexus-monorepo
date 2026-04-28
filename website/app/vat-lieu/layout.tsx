import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Vật liệu xây dựng — Catalog kỹ thuật — TrishTEAM',
  description:
    'Catalog 25+ loại vật liệu XD: thép CB300/500, xi măng PCB30/40, bê tông M200-M500, gạch tuynel, đá 1×2/4×6, cát, phụ gia. Có thông số TCVN.',
  openGraph: {
    title: 'Vật liệu xây dựng — Database kỹ thuật',
    description: 'Thông số TCVN + thương hiệu phổ biến + giá tham khảo.',
    type: 'website',
  },
  alternates: { canonical: '/vat-lieu' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
