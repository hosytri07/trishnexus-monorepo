import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Ôn thi Tin học văn phòng — Word/Excel/PPT — TrishTEAM',
  description:
    'Bộ đề ôn thi Tin học văn phòng cơ bản: Microsoft Word, Excel, PowerPoint, hệ điều hành Windows + Mạng cơ bản. Có giải thích chi tiết.',
  openGraph: {
    title: 'Ôn thi Tin học văn phòng — IC3 / MOS',
    description: 'Quiz có 4 chuyên đề: Word, Excel, PowerPoint, Hệ điều hành & Mạng.',
    type: 'website',
  },
  alternates: { canonical: '/tin-hoc-vp' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
