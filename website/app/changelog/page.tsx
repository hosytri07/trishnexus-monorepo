/**
 * /changelog — Phase 78.6 release notes timeline.
 * Hardcoded data — sau này có thể fetch từ GitHub Releases API.
 */
import Link from 'next/link';
import type { Metadata } from 'next';
import { Sparkles, Bug, Zap, Plus, ArrowRight } from 'lucide-react';
import { BruFooter } from '@/components/bru/bru-footer';
import { BruFontpackChangelog } from '@/components/bru/bru-fontpack-changelog';

export const metadata: Metadata = {
  title: 'Changelog — TrishTEAM',
  description: 'Lịch sử phiên bản, tính năng mới, bug fix của hệ sinh thái TrishTEAM.',
};

type ChangeType = 'feature' | 'fix' | 'improve' | 'release';

const CHANGE_ICONS: Record<ChangeType, { icon: typeof Sparkles; color: string; label: string }> = {
  feature: { icon: Plus, color: '#34D399', label: 'NEW' },
  fix: { icon: Bug, color: '#F87171', label: 'FIX' },
  improve: { icon: Zap, color: '#FBBF24', label: 'IMPROVE' },
  release: { icon: Sparkles, color: '#2563EB', label: 'RELEASE' },
};

interface Release {
  version: string;
  date: string;
  app: 'all' | 'work' | 'utilities' | 'finance' | 'website';
  headline: string;
  changes: { type: ChangeType; text: string }[];
}

const RELEASES: Release[] = [
  {
    version: 'v1.0.0',
    date: '27/05/2026',
    app: 'website',
    headline: 'Website rebuild brutalist',
    changes: [
      { type: 'release', text: 'Rebuild toàn bộ website theo phong cách Modern Brutalist — palette đen + vàng, big typography, sharp edges.' },
      { type: 'feature', text: 'Trang changelog + roadmap public.' },
      { type: 'feature', text: 'Cmd+K global search overlay (sắp ra).' },
      { type: 'improve', text: 'Tinh gọn 28 → 17 routes, bỏ widgets không cần.' },
    ],
  },
  {
    version: 'v1.0.0',
    date: '26/05/2026',
    app: 'utilities',
    headline: 'TrishUtilities full polish + DWG scanner',
    changes: [
      { type: 'release', text: 'TrishUtilities v1.0.0 stable.' },
      { type: 'feature', text: 'DWG Font Detector — scan file .dwg/.dxf tìm font thiếu (heuristic 3 method + DXF parse).' },
      { type: 'feature', text: 'Install Progress UI v3 với ETA + ok/fail count + summary card.' },
      { type: 'feature', text: 'Auto-skip "Access Denied" cho font hệ thống Windows lock (Tahoma, Times, Palatino).' },
      { type: 'fix', text: 'Fix crash lnk crate khi parse .lnk format lạ — wrap catch_unwind.' },
      { type: 'fix', text: 'Enable assetProtocol Tauri 2 → icon shortcut hiển thị (trước đó fallback emoji).' },
      { type: 'improve', text: 'Icon shortcut size 48 → 72px cho dễ nhìn.' },
      { type: 'improve', text: 'Search + filter chip (VN/Serif/Sans/Mono) trong PackDetailPanel.' },
    ],
  },
  {
    version: 'v1.0.0',
    date: '25/05/2026',
    app: 'utilities',
    headline: 'TrishUtilities polish 5 module',
    changes: [
      { type: 'feature', text: 'Network Speed Test (Cloudflare /__down + /__up + ping).' },
      { type: 'feature', text: 'Google Drive bulk folder downloader.' },
      { type: 'feature', text: 'GPU VRAM dùng registry (fix bug cap 4GB).' },
      { type: 'feature', text: 'Lazy-load 5 module — tab switching instant lần 2+.' },
      { type: 'feature', text: 'MinSpec admin "+ Thêm phần mềm" modal lưu localStorage.' },
      { type: 'feature', text: 'SETUP-MAY-MOI.bat — 1-click bootstrap máy trắng winget toolchain.' },
    ],
  },
  {
    version: 'v1.0.0',
    date: '23/05/2026',
    app: 'all',
    headline: 'Ecosystem refactor 12 → 4 app',
    changes: [
      { type: 'release', text: 'Gộp 10 desktop app thành 3 app + Admin: Work / Utilities / Finance / Admin.' },
      { type: 'feature', text: 'AppShell + AppLogo shared cho 4 app — accent màu riêng per app.' },
      { type: 'feature', text: 'Firebase Auth thay key system cũ. Role: trial/free/pro/admin + app access matrix.' },
      { type: 'feature', text: 'TrishAdmin "Cấp quyền App" panel.' },
      { type: 'feature', text: 'Phase 45 Design System v1: 10 components (AppCard, AppButton, AppForm, AppTable, …).' },
    ],
  },
  {
    version: 'v1.0.0',
    date: '10/05/2026',
    app: 'all',
    headline: 'Wave release v1.0 — 6 apps stable',
    changes: [
      { type: 'release', text: 'TrishLauncher 1.0.0 — hub miễn phí.' },
      { type: 'release', text: 'TrishCheck 1.0.0 — system info + benchmark.' },
      { type: 'release', text: 'TrishClean 1.0.0 — dọn cache + undo 7 ngày.' },
      { type: 'release', text: 'TrishFont 1.0.0 — quản lý font tiếng Việt + AutoCAD .shx.' },
      { type: 'release', text: 'TrishShortcut 1.0.0 — quản lý shortcut + workspace + hotkey.' },
      { type: 'release', text: 'TrishLibrary 1.0.0 — thư viện + Note + Document + Image + 13 PDF tools.' },
      { type: 'feature', text: 'Auto-update detection via PE FileVersion.' },
      { type: 'feature', text: 'Bỏ key system → Role-based access.' },
    ],
  },
];

const APP_LABELS: Record<Release['app'], { label: string; color: string }> = {
  all: { label: 'ALL', color: '#FBBF24' },
  work: { label: 'WORK', color: '#34D399' },
  utilities: { label: 'UTILITIES', color: '#FBBF24' },
  finance: { label: 'FINANCE', color: '#2563EB' },
  website: { label: 'WEB', color: '#A78BFA' },
};

export default function ChangelogPage() {
  return (
    <main className="bru">
      <section className="bru-section" style={{ paddingTop: 'clamp(64px, 10vw, 160px)' }}>
        <div className="bru-container">
          <div className="bru-eyebrow" style={{ marginBottom: 16 }}>
            // Release timeline
          </div>
          <h1 className="bru-display-xl" style={{ marginBottom: 32, lineHeight: 1.15 }}>
            CHANGELOG.
          </h1>
          <p className="bru-body-lg" style={{ maxWidth: 720, marginBottom: 32 }}>
            Tất cả thay đổi, tính năng mới, bug fix của hệ sinh thái TrishTEAM.
            Update thường xuyên. Theo dõi để biết app vừa có gì mới.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Link href="/downloads" className="bru-btn bru-btn-primary">
              <ArrowRight size={14} strokeWidth={2.5} />
              Tải bản mới nhất
            </Link>
            <Link href="/roadmap" className="bru-btn">
              Xem roadmap
              <ArrowRight size={14} strokeWidth={2.5} />
            </Link>
          </div>
        </div>
      </section>

      {/* Phase 78.13.10 — Fontpack releases auto-fed from Firestore */}
      <section className="bru-section bru-section-sm" style={{ paddingTop: 0 }}>
        <div className="bru-container">
          <BruFontpackChangelog />
        </div>
      </section>

      {/* Timeline */}
      <section className="bru-section bru-section-sm">
        <div className="bru-container">
          <div style={{ position: 'relative' }}>
            {/* Vertical line */}
            <div
              style={{
                position: 'absolute',
                left: 14,
                top: 0,
                bottom: 0,
                width: 2,
                background: 'var(--bru-border)',
              }}
            />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 48 }}>
              {RELEASES.map((r, i) => {
                const appMeta = APP_LABELS[r.app];
                return (
                  <article
                    key={`${r.version}-${r.date}-${i}`}
                    style={{ paddingLeft: 48, position: 'relative' }}
                  >
                    {/* Dot */}
                    <span
                      style={{
                        position: 'absolute',
                        left: 6,
                        top: 2,
                        width: 18,
                        height: 18,
                        background: appMeta.color,
                        borderRadius: '50%',
                        border: '3px solid var(--bru-bg)',
                        zIndex: 1,
                      }}
                    />

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'baseline',
                        gap: 12,
                        marginBottom: 12,
                        flexWrap: 'wrap',
                      }}
                    >
                      <span
                        style={{
                          fontSize: 'clamp(20px, 2.2vw, 28px)',
                          fontWeight: 900,
                          letterSpacing: '-0.02em',
                          color: 'var(--bru-fg)',
                        }}
                      >
                        {r.version}
                      </span>
                      <span
                        className="bru-tag"
                        style={{
                          borderColor: appMeta.color,
                          color: appMeta.color,
                          fontSize: 10,
                        }}
                      >
                        {appMeta.label}
                      </span>
                      <span className="bru-mono" style={{ color: 'var(--bru-fg-muted)', fontSize: 11 }}>
                        {r.date}
                      </span>
                    </div>

                    <h2
                      style={{
                        fontSize: 'clamp(18px, 1.8vw, 22px)',
                        fontWeight: 700,
                        color: 'var(--bru-fg)',
                        marginBottom: 20,
                      }}
                    >
                      {r.headline}
                    </h2>

                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {r.changes.map((c, j) => {
                        const meta = CHANGE_ICONS[c.type];
                        const Icon = meta.icon;
                        return (
                          <li
                            key={j}
                            style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: 12,
                              padding: '8px 0',
                              borderBottom: '1px solid var(--bru-border)',
                            }}
                          >
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                padding: '2px 6px',
                                borderRadius: 3,
                                background: `${meta.color}1F`,
                                color: meta.color,
                                fontSize: 9,
                                fontWeight: 800,
                                letterSpacing: '0.08em',
                                fontFamily: 'var(--font-family-mono), monospace',
                                flexShrink: 0,
                                minWidth: 64,
                                justifyContent: 'center',
                              }}
                            >
                              <Icon size={10} strokeWidth={2.5} />
                              {meta.label}
                            </span>
                            <span className="bru-body-sm" style={{ flex: 1 }}>
                              {c.text}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <BruFooter />
    </main>
  );
}
