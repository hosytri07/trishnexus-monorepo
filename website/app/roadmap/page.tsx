/**
 * /roadmap — Phase 78.6 public roadmap 3 cột.
 * Đang làm / Sắp ra / Tương lai.
 */
import Link from 'next/link';
import type { Metadata } from 'next';
import { Clock, Rocket, Telescope, CheckCircle2, ArrowRight } from 'lucide-react';
import { BruFooter } from '@/components/bru/bru-footer';

export const metadata: Metadata = {
  title: 'Roadmap — TrishTEAM',
  description: 'Lộ trình phát triển công khai: tính năng đang làm, sắp ra, tương lai.',
};

interface RoadmapItem {
  app: 'work' | 'utilities' | 'finance' | 'admin' | 'website';
  title: string;
  description: string;
  progress?: number; // 0-100, optional cho status doing
}

const APP_COLORS: Record<RoadmapItem['app'], string> = {
  work: '#34D399',
  utilities: '#FBBF24',
  finance: '#2563EB',
  admin: '#F87171',
  website: '#A78BFA',
};

const DOING: RoadmapItem[] = [
  {
    app: 'website',
    title: 'Brutalist redesign v1',
    description: 'Rebuild homepage + apps + downloads + changelog + roadmap + Cmd+K search.',
    progress: 80,
  },
  {
    app: 'utilities',
    title: 'DWG scanner v3',
    description: 'Cải thiện heuristic detect font trong file DWG R2004+ compressed.',
    progress: 60,
  },
  {
    app: 'work',
    title: 'Audit UI Design/Library/ISO',
    description: 'Polish text-vô-hồn, empty states, consistent với TrishUtilities đã làm.',
    progress: 0,
  },
];

const SOON: RoadmapItem[] = [
  {
    app: 'work',
    title: 'Wave 44.8 — Pick polyline AutoCAD',
    description: 'Test code đã commit ở phase 43 wave 16 trong môi trường AutoCAD thật.',
  },
  {
    app: 'utilities',
    title: 'Cài tất cả font thiếu .dwg',
    description: 'Auto-tải font thiếu từ Pack TrishTEAM khi scan .dwg ra missing fonts.',
  },
  {
    app: 'finance',
    title: 'Audit UI Finance + Admin',
    description: 'Refactor panels cũ sang Phase 45 design components.',
  },
  {
    app: 'all',
    title: 'Build .exe release 4 app',
    description: 'Build production installer + sign + upload GitHub Release.',
  } as RoadmapItem,
  {
    app: 'website',
    title: 'Newsletter subscribe',
    description: 'Email signup → Resend list → thông báo release mới qua email.',
  },
];

const FUTURE: RoadmapItem[] = [
  {
    app: 'utilities',
    title: 'TrishUtilities macOS build',
    description: 'Port qua Tauri 2 macOS native. Cần test với engineer dùng Mac.',
  },
  {
    app: 'all',
    title: 'Pro tier subscription',
    description: 'Tính năng advanced (cloud sync premium, advanced analytics, priority support).',
  },
  {
    app: 'all',
    title: 'Mobile companion app',
    description: 'iOS/Android app cho quick reference + sync với desktop.',
  },
  {
    app: 'work',
    title: 'Civil 3D / Revit integration',
    description: 'Bridge plugin để gen block trực tiếp từ TrishWork sang Civil 3D / Revit.',
  },
  {
    app: 'website',
    title: 'Community forum',
    description: 'Place cho engineer Việt thảo luận, share tips, feature request.',
  },
  {
    app: 'website',
    title: 'API public + developer docs',
    description: 'Cho developer 3rd party tích hợp data từ TrishTEAM ecosystem.',
  },
];

function RoadmapColumn({
  title,
  subtitle,
  icon: Icon,
  color,
  items,
}: {
  title: string;
  subtitle: string;
  icon: typeof Clock;
  color: string;
  items: RoadmapItem[];
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div
        style={{
          borderTop: `4px solid ${color}`,
          paddingTop: 16,
          marginBottom: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <Icon size={20} strokeWidth={2.5} style={{ color }} />
          <h2
            style={{
              fontSize: 24,
              fontWeight: 900,
              letterSpacing: '-0.02em',
              color,
            }}
          >
            {title}
          </h2>
        </div>
        <p className="bru-mono" style={{ color: 'var(--bru-fg-muted)', fontSize: 11 }}>
          {subtitle} · {items.length} mục
        </p>
      </div>
      {items.map((item, i) => (
        <article
          key={i}
          className="bru-card"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            padding: 18,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <span
              className="bru-tag"
              style={{
                borderColor: APP_COLORS[item.app] ?? 'var(--bru-border-strong)',
                color: APP_COLORS[item.app] ?? 'var(--bru-fg)',
                fontSize: 9,
              }}
            >
              {String(item.app).toUpperCase()}
            </span>
            {item.progress !== undefined && (
              <span className="bru-mono" style={{ fontSize: 10, color: 'var(--bru-fg-muted)' }}>
                {item.progress}%
              </span>
            )}
          </div>
          <h3
            style={{
              fontSize: 16,
              fontWeight: 800,
              letterSpacing: '-0.01em',
              color: 'var(--bru-fg)',
              lineHeight: 1.3,
            }}
          >
            {item.title}
          </h3>
          <p className="bru-body-sm">{item.description}</p>
          {item.progress !== undefined && item.progress > 0 && (
            <div
              style={{
                height: 4,
                background: 'var(--bru-border)',
                borderRadius: 99,
                overflow: 'hidden',
                marginTop: 4,
              }}
            >
              <div
                style={{
                  width: `${item.progress}%`,
                  height: '100%',
                  background: color,
                  transition: 'width 300ms',
                }}
              />
            </div>
          )}
        </article>
      ))}
    </div>
  );
}

export default function RoadmapPage() {
  return (
    <main className="bru">
      <section className="bru-section" style={{ paddingTop: 'clamp(64px, 10vw, 160px)' }}>
        <div className="bru-container">
          <div className="bru-eyebrow" style={{ marginBottom: 16 }}>
            // Lộ trình công khai
          </div>
          <h1 className="bru-display-xl" style={{ marginBottom: 32, lineHeight: 1.15 }}>
            ROADMAP.
          </h1>
          <p className="bru-body-lg" style={{ maxWidth: 720, marginBottom: 32 }}>
            Đang làm gì, sắp ra cái gì, tương lai có gì. Roadmap update thường xuyên.
            Muốn vote feature? Gửi qua{' '}
            <a
              href="mailto:trishteam.official@gmail.com"
              style={{ color: 'var(--bru-accent)' }}
            >
              email
            </a>{' '}
            hoặc Telegram.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Link href="/changelog" className="bru-btn">
              Xem changelog
              <ArrowRight size={14} strokeWidth={2.5} />
            </Link>
          </div>
        </div>
      </section>

      <section className="bru-section bru-section-sm">
        <div className="bru-container">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr',
              gap: 32,
            }}
            className="md-grid-3"
          >
            <RoadmapColumn
              title="Đang làm"
              subtitle="In progress"
              icon={Clock}
              color="#FBBF24"
              items={DOING}
            />
            <RoadmapColumn
              title="Sắp ra"
              subtitle="Up next"
              icon={Rocket}
              color="#34D399"
              items={SOON}
            />
            <RoadmapColumn
              title="Tương lai"
              subtitle="Backlog"
              icon={Telescope}
              color="#A78BFA"
              items={FUTURE}
            />
          </div>
        </div>
        <style>{`
          @media (min-width: 900px) {
            .md-grid-3 {
              grid-template-columns: repeat(3, 1fr) !important;
            }
          }
        `}</style>
      </section>

      <section className="bru-section bru-section-sm" style={{ background: 'var(--bru-bg-elevated)' }}>
        <div className="bru-container-narrow" style={{ textAlign: 'center' }}>
          <CheckCircle2 size={48} strokeWidth={1.5} style={{ color: 'var(--bru-accent)', margin: '0 auto 24px' }} />
          <h2 className="bru-display-sm" style={{ marginBottom: 16 }}>
            Đã hoàn thành?
          </h2>
          <p className="bru-body-lg" style={{ marginBottom: 24 }}>
            Xem chi tiết những gì đã ship trong <Link href="/changelog" style={{ color: 'var(--bru-accent)' }}>changelog</Link>.
          </p>
        </div>
      </section>

      <BruFooter />
    </main>
  );
}
