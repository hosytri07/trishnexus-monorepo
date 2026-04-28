import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Quy chuẩn / Tiêu chuẩn ngành XD-GT — TrishTEAM',
  description:
    'Tra cứu QCVN, TCVN, Thông tư, Nghị định, Quyết định ngành xây dựng – giao thông Việt Nam. 19 văn bản chính cập nhật 2024-2025.',
  openGraph: {
    title: 'Quy chuẩn / Tiêu chuẩn ngành XD-GT',
    description: 'QCVN 41:2024, TCVN 4054, TCVN 11823 và 16 văn bản pháp lý quan trọng.',
    type: 'website',
  },
  alternates: { canonical: '/quy-chuan' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
