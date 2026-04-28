import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Chuyển đổi VN2000 ↔ WGS84 — Helmert 7-param — TrishTEAM',
  description:
    'Convert toạ độ VN2000 sang WGS84 và ngược lại bằng tham số Helmert 7-param theo QĐ 05/2007/QĐ-BTNMT. Hỗ trợ DD và DMS.',
  openGraph: {
    title: 'VN2000 ↔ WGS84 Coordinate Converter',
    description: 'Helmert 7-parameter transformation theo chuẩn quốc gia VN.',
    type: 'website',
  },
  alternates: { canonical: '/cong-cu/vn2000' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
