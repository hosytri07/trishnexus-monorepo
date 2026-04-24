/**
 * /offline — Phase 11.9.4.
 *
 * Fallback page khi service worker phát hiện navigation request fail.
 * Server-rendered (no client state) để SW có thể precache sẵn ở bước
 * install. Không import widget nào để tránh phụ thuộc Firestore/network.
 */
import Link from 'next/link';
import { WifiOff, RefreshCw, Home } from 'lucide-react';

export const metadata = {
  title: 'Offline — TrishTEAM',
  description:
    'Bạn đang offline. TrishTEAM vẫn hiển thị app shell và một vài tính năng cơ bản.',
};

export default function OfflinePage() {
  return (
    <main
      className="max-w-[44rem] mx-auto px-6 py-16 flex flex-col items-center text-center"
      style={{ color: 'var(--color-text)' }}
    >
      <div
        className="rounded-full p-6 mb-6"
        style={{
          background: 'var(--color-accent-soft)',
          color: 'var(--color-accent)',
        }}
      >
        <WifiOff size={48} strokeWidth={1.75} />
      </div>

      <h1
        className="text-3xl font-bold mb-3"
        style={{ color: 'var(--color-text)' }}
      >
        Không có kết nối Internet
      </h1>

      <p
        className="text-base mb-8 max-w-md"
        style={{ color: 'var(--color-text-muted)' }}
      >
        Bạn đang offline nên TrishTEAM không thể tải dữ liệu mới. Một số nội
        dung đã cache có thể vẫn xem được — thử quay lại trang chủ hoặc
        reload sau khi có mạng trở lại.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition"
          style={{
            background: 'var(--color-accent)',
            color: '#0b1220',
          }}
        >
          <Home size={16} />
          Về dashboard
        </Link>
        <ReloadButton />
      </div>

      <div
        className="mt-12 text-xs"
        style={{ color: 'var(--color-text-muted)' }}
      >
        TrishTEAM lưu ghi chú QuickNotes ở localStorage nên bạn vẫn xem được
        nội dung đã nhập gần đây khi offline.
      </div>
    </main>
  );
}

/**
 * Client island riêng cho nút reload — tránh mark cả page 'use client'.
 */
function ReloadButton() {
  return (
    <form action="/" method="get">
      <button
        type="submit"
        className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium border transition"
        style={{
          borderColor: 'var(--color-border)',
          color: 'var(--color-text)',
          background: 'transparent',
        }}
      >
        <RefreshCw size={16} />
        Thử lại
      </button>
    </form>
  );
}
