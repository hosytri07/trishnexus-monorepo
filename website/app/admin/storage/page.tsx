'use client';

/**
 * /admin/storage — Phase 19.18.4 — Storage info page.
 *
 * Vì project trên Spark plan KHÔNG bật được Firebase Storage (cần Blaze pay-as-you-go),
 * page này chuyển thành info hiển thị 3 storage tier đang dùng:
 *   - Cloudinary (primary, 25GB free)
 *   - Vercel /public/ (static, vô hạn)
 *   - Firebase Storage (DISABLED — không dùng)
 */
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowLeft,
  Cloud,
  Database,
  ExternalLink,
  HardDrive,
  Image as ImageIcon,
  Info,
} from 'lucide-react';

export default function StoragePage() {
  return (
    <main className="max-w-4xl mx-auto px-6 py-8">
      <Link
        href="/admin"
        className="inline-flex items-center gap-2 mb-6 text-sm transition-opacity hover:opacity-80"
        style={{ color: 'var(--color-text-muted)' }}
      >
        <ArrowLeft size={15} /> Admin Dashboard
      </Link>

      <header className="mb-6 flex items-center gap-3">
        <HardDrive size={26} strokeWidth={1.75} style={{ color: 'var(--color-accent-primary)' }} />
        <h1 className="text-3xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
          Storage Overview
        </h1>
      </header>

      {/* Banner */}
      <div
        className="rounded-xl border p-4 mb-6"
        style={{
          background: 'rgba(245,158,11,0.08)',
          borderColor: '#F59E0B',
          borderLeftWidth: 3,
        }}
      >
        <div className="flex items-start gap-3">
          <Info size={18} strokeWidth={2} style={{ color: '#F59E0B' }} />
          <div className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
            <strong>Firebase Spark plan</strong> không hỗ trợ Cloud Storage (Google đổi
            policy 2024 — cần upgrade Blaze pay-as-you-go). TrishTEAM dùng Cloudinary
            free tier (25 GB) + Vercel /public/ thay thế — đủ và rộng hơn nhiều.
          </div>
        </div>
      </div>

      {/* 3 storage tiers */}
      <div className="space-y-4 mb-6">
        {/* Cloudinary primary */}
        <Tier
          title="Cloudinary"
          subtitle="Primary storage — Avatar / Hero blog / Ảnh biển báo + cầu / User uploads"
          quota="25 GB / tháng + 25 GB bandwidth"
          status="active"
          icon={<Cloud size={22} strokeWidth={1.75} />}
          color="#10B981"
          link={{
            label: 'Cloudinary Dashboard',
            url: 'https://console.cloudinary.com',
          }}
          notes={[
            'Auto-resize: 1 ảnh upload → N preset (avatar 32/64/128/256, sign-thumb, sign-detail, post-hero, ...)',
            'Auto-format: serve WebP/AVIF cho browser mới, JPG cho cũ',
            'CDN global Akamai',
            'Folder structure: trishteam/avatars · /signs · /bridges · /posts · /temp',
          ]}
        />

        {/* Vercel public */}
        <Tier
          title="Vercel /public/"
          subtitle="Static assets — JSON databases (cầu, biển báo), logos, SVG"
          quota="Vô hạn (giới hạn bởi git repo size ~1 GB)"
          status="active"
          icon={<Database size={22} strokeWidth={1.75} />}
          color="#3B82F6"
          link={{ label: 'Repo', url: 'https://github.com/hosytri07/trishnexus-monorepo' }}
          notes={[
            'public/bridges-vn.json (1.8 MB) — 7,549 cầu',
            'public/qc41-signs.json (34 KB) — 451 biển báo',
            'public/signs/*.svg — 6 biển vector mẫu',
            'public/logos/, public/og/, public/icons/',
            'Edit qua git commit + push → Vercel auto-deploy',
          ]}
        />

        {/* Firebase Storage disabled */}
        <Tier
          title="Firebase Storage"
          subtitle="Disabled — Spark plan không hỗ trợ"
          quota="—"
          status="disabled"
          icon={<HardDrive size={22} strokeWidth={1.75} />}
          color="#9CA3AF"
          notes={[
            'Cần upgrade Blaze pay-as-you-go (~$0.026/GB/tháng) để bật',
            'Cloudinary đã đủ thay thế — không cần migrate',
            'Storage rules đã code sẵn (storage.rules) — kích hoạt được khi cần',
          ]}
        />
      </div>

      {/* Quick links */}
      <section
        className="rounded-xl border p-5"
        style={{
          background: 'var(--color-surface-card)',
          borderColor: 'var(--color-border-default)',
        }}
      >
        <h2
          className="text-sm font-bold uppercase tracking-wider mb-3 inline-flex items-center gap-2"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <Info size={13} /> Quản lý
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <QuickLink
            href="/admin/signs"
            label="Upload ảnh biển báo"
            icon={<ImageIcon size={14} />}
          />
          <QuickLink
            href="/admin/bridges"
            label="Upload ảnh cầu"
            icon={<ImageIcon size={14} />}
          />
          <QuickLink
            href="/admin/posts"
            label="Upload hero blog"
            icon={<ImageIcon size={14} />}
          />
          <a
            href="https://console.cloudinary.com/console/c-cbcf2ade0427b51661cb8e716c86d8/media_library"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-semibold transition-colors hover:bg-[var(--color-surface-muted)]"
            style={{
              background: 'var(--color-surface-bg_elevated)',
              color: 'var(--color-text-primary)',
              border: '1px solid var(--color-border-default)',
            }}
          >
            <ExternalLink size={14} />
            Cloudinary Media Library
          </a>
        </div>
      </section>
    </main>
  );
}

function Tier({
  title,
  subtitle,
  quota,
  status,
  icon,
  color,
  link,
  notes,
}: {
  title: string;
  subtitle: string;
  quota: string;
  status: 'active' | 'disabled';
  icon: React.ReactNode;
  color: string;
  link?: { label: string; url: string };
  notes?: string[];
}) {
  return (
    <section
      className="rounded-xl border p-5"
      style={{
        background: 'var(--color-surface-card)',
        borderColor: 'var(--color-border-default)',
        borderLeftWidth: 3,
        borderLeftColor: color,
        opacity: status === 'disabled' ? 0.65 : 1,
      }}
    >
      <header className="flex items-start gap-3 mb-3">
        <div
          className="shrink-0 inline-flex items-center justify-center w-11 h-11 rounded-md"
          style={{ background: color + '22', color }}
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-bold mb-1" style={{ color: 'var(--color-text-primary)' }}>
            {title}
            {status === 'active' ? (
              <span
                className="ml-2 inline-flex items-center px-2 h-5 rounded text-[10px] font-bold uppercase tracking-wider"
                style={{ background: 'rgba(16,185,129,0.18)', color: '#10B981' }}
              >
                ACTIVE
              </span>
            ) : (
              <span
                className="ml-2 inline-flex items-center px-2 h-5 rounded text-[10px] font-bold uppercase tracking-wider"
                style={{ background: 'rgba(156,163,175,0.18)', color: '#9CA3AF' }}
              >
                DISABLED
              </span>
            )}
          </h3>
          <p className="text-sm mb-1" style={{ color: 'var(--color-text-secondary)' }}>
            {subtitle}
          </p>
          <p
            className="text-xs font-mono"
            style={{ color: status === 'disabled' ? 'var(--color-text-muted)' : color }}
          >
            Quota: {quota}
          </p>
        </div>
      </header>

      {notes && notes.length > 0 && (
        <ul className="space-y-1 mt-3 ml-14">
          {notes.map((n, i) => (
            <li
              key={i}
              className="text-xs leading-relaxed"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              • {n}
            </li>
          ))}
        </ul>
      )}

      {link && (
        <div className="mt-3 ml-14">
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-semibold transition-opacity hover:opacity-80"
            style={{ color }}
          >
            <ExternalLink size={11} />
            {link.label}
          </a>
        </div>
      )}
    </section>
  );
}

function QuickLink({ href, label, icon }: { href: string; label: string; icon: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-semibold transition-colors hover:bg-[var(--color-surface-muted)]"
      style={{
        background: 'var(--color-surface-bg_elevated)',
        color: 'var(--color-text-primary)',
        border: '1px solid var(--color-border-default)',
      }}
    >
      {icon}
      {label}
    </Link>
  );
}
