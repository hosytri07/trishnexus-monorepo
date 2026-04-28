import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Ôn thi Tiếng Anh — Grammar/Vocab/Reading — TrishTEAM',
  description:
    'Quiz tiếng Anh CEFR A2 - B2: ngữ pháp, từ vựng kỹ thuật xây dựng, đọc hiểu, business / TOEIC. Có giải thích đáp án.',
  openGraph: {
    title: 'English practice — engineering & business',
    description: 'Quiz 4 chuyên đề: Grammar, Vocabulary, Reading, Business / TOEIC.',
    type: 'website',
  },
  alternates: { canonical: '/tieng-anh' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
