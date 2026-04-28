import { Image as ImageIcon } from 'lucide-react';
import { ComingSoonPage } from '@/components/coming-soon-page';

export const metadata = {
  title: 'Ảnh — TrishTEAM',
  description: 'Photo manager local — chỉ có sẵn trên TrishLibrary 3.0 desktop.',
};

export default function AnhPage() {
  return (
    <ComingSoonPage
      title="Ảnh"
      description="Photo manager là tính năng LOCAL ONLY — chỉ chạy được trên desktop vì cần truy cập filesystem trực tiếp (LAN/UNC paths, EXIF, thumbnail cache, lightbox với prev/next ảnh từ ổ đĩa)."
      icon={ImageIcon}
      status="desktop"
      features={[
        '5 view modes giống Windows Explorer (Cực lớn / Lớn / Vừa / Nhỏ / Chi tiết)',
        'Thumbnail cache với progress bar preload',
        'EXIF metadata viewer (camera / ngày chụp / GPS map link)',
        'Lightbox fullscreen với prev/next + autoplay',
        'Bulk select + batch rename pattern',
        'LAN folder support (UNC \\\\server\\share)',
        'Logical rename (đổi tên hiển thị mà không đổi tên file thực)',
        '⚠ KHÔNG có web version — file ảnh nằm trên ổ đĩa local của anh',
      ]}
      relatedApp={{ name: 'TrishLibrary 3.0', downloadUrl: '/downloads#trishlibrary' }}
    />
  );
}
