import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Đường Việt Nam — Cao tốc, QL, vành đai — TrishTEAM',
  description:
    'Database 25+ tuyến đường VN: cao tốc Bắc-Nam, QL1A, QL6, QL14, vành đai Hà Nội & TP.HCM. Có thông số tải trọng, tốc độ, chiều dài.',
  openGraph: {
    title: 'Đường giao thông Việt Nam — Database 2026',
    description: 'CT.01 Bắc-Nam, CT.04 HN-HP, vành đai 4 HN, vành đai 4 HCM...',
    type: 'website',
  },
  alternates: { canonical: '/duong-vn' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
