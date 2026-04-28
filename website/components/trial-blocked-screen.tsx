'use client';

/**
 * TrialBlockedScreen — Phase 19.16.
 *
 * Hiển thị cho user đăng nhập với role 'trial' khi truy cập feature
 * dành riêng cho user/admin. Hướng dẫn activate key.
 */
import Link from 'next/link';
import { ArrowRight, KeyRound, Mail, Sparkles } from 'lucide-react';

export function TrialBlockedScreen({ featureName }: { featureName: string }) {
  return (
    <main className="max-w-2xl mx-auto px-6 py-16 text-center">
      <div
        className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-5"
        style={{
          background: 'rgba(245,158,11,0.18)',
          border: '2px solid #F59E0B',
        }}
      >
        <KeyRound size={36} strokeWidth={1.5} style={{ color: '#F59E0B' }} />
      </div>

      <span
        className="inline-block mb-3 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider"
        style={{ background: 'rgba(245,158,11,0.18)', color: '#F59E0B' }}
      >
        Tài khoản Trial
      </span>

      <h1
        className="text-3xl md:text-4xl font-bold mb-3"
        style={{ color: 'var(--color-text-primary)' }}
      >
        Cần kích hoạt key để dùng {featureName}
      </h1>
      <p
        className="text-base md:text-lg leading-relaxed mb-6 max-w-lg mx-auto"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        Tài khoản hiện đang ở chế độ <strong>Trial</strong>. Tính năng này
        chỉ dành cho User và Admin. Hãy kích hoạt activation key để dùng đầy
        đủ tính năng của hệ sinh thái TrishTEAM.
      </p>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-8">
        <Link
          href="/profile"
          className="inline-flex items-center gap-2 px-5 h-11 rounded-md text-sm font-bold transition-opacity hover:opacity-90"
          style={{ background: 'var(--color-accent-gradient)', color: '#ffffff' }}
        >
          <Sparkles size={15} />
          Nhập Activation Key
          <ArrowRight size={14} />
        </Link>
        <a
          href="mailto:trishteam.official@gmail.com?subject=Xin%20activation%20key%20TrishTEAM"
          className="inline-flex items-center gap-2 px-5 h-11 rounded-md text-sm font-semibold transition-opacity hover:opacity-90"
          style={{
            background: 'var(--color-surface-card)',
            color: 'var(--color-text-primary)',
            border: '1px solid var(--color-border-default)',
          }}
        >
          <Mail size={15} />
          Liên hệ xin key
        </a>
      </div>

      <div
        className="rounded-lg p-4 text-left max-w-md mx-auto"
        style={{
          background: 'var(--color-surface-card)',
          border: '1px solid var(--color-border-default)',
        }}
      >
        <p
          className="text-xs font-bold uppercase tracking-wider mb-2"
          style={{ color: 'var(--color-text-muted)' }}
        >
          User và Admin được dùng:
        </p>
        <ul className="space-y-1.5 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          <li>📚 Thư viện đồng bộ + TrishTEAM curated</li>
          <li>📝 Ghi chú multi-device</li>
          <li>📄 Tài liệu Markdown editor</li>
          <li>🚗 Ôn thi lái xe + Chứng chỉ XD đầy đủ</li>
          <li>🚦 Database Biển báo + Cầu VN</li>
          <li>💾 Backup + sync tất cả thiết bị</li>
        </ul>
      </div>
    </main>
  );
}
