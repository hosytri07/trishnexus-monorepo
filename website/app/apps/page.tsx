/**
 * /apps — Phase 19.1 redirect tới /downloads.
 *
 * Page placeholder Phase 11.1 cũ đã out of scope. Listing thật của apps
 * đã có ở /downloads. Giữ route này để không 404 cho old bookmarks +
 * permanent redirect (308) qua Next.js metadata API.
 */
import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Đang chuyển hướng... — TrishTEAM',
  robots: { index: false },
};

export default function AppsPage(): never {
  redirect('/downloads');
}
