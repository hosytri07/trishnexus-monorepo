/**
 * /fontpacks — Phase 78.13.9 — Catalog font packs công khai.
 *
 * Fetch từ Firestore `fontpacks/{id}` (rules public read). Hiển thị release notes
 * admin set qua TrishAdmin để user biết pack có gì mới trước khi tải.
 */
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Download, ArrowRight, FileText, Calendar } from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { BruFooter } from '@/components/bru/bru-footer';

interface FontPack {
  id: string;
  name: string;
  version: string;
  description: string;
  kind: 'windows' | 'autocad' | 'mixed';
  size_bytes: number;
  file_count: number;
  tags: string[];
  preview_image?: string;
  download_url: string;
  sha256: string;
  release_notes?: string;
  release_date?: number;
}

const KIND_LABEL: Record<string, string> = {
  windows: '🪟 Windows',
  autocad: '📐 AutoCAD',
  mixed: '🎨 Mixed',
};

export default function FontPacksPage(): JSX.Element {
  const [packs, setPacks] = useState<FontPack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load(): Promise<void> {
      if (!db) {
        setError('Firebase chưa được cấu hình.');
        setLoading(false);
        return;
      }
      try {
        const snap = await getDocs(collection(db, 'fontpacks'));
        const data = snap.docs.map((d) => d.data() as FontPack).filter((p) => p.download_url);
        // Sort: newest release_date first, fallback to name
        data.sort((a, b) => {
          if (a.release_date && b.release_date) return b.release_date - a.release_date;
          return a.name.localeCompare(b.name);
        });
        setPacks(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  return (
    <main className="bru">
      {/* HERO */}
      <section className="bru-section" style={{ paddingTop: 'clamp(64px, 10vw, 160px)' }}>
        <div className="bru-container">
          <div className="bru-eyebrow" style={{ marginBottom: 16 }}>
            // Font Packs
          </div>
          <h1 className="bru-display-xl" style={{ marginBottom: 32 }}>
            FONT <span className="bru-accent">CHO KỸ SƯ</span>
            <br />
            TIẾNG VIỆT + AUTOCAD
          </h1>
          <p className="bru-body-lg" style={{ maxWidth: 640 }}>
            Tải về và cài 1-click qua TrishUtilities. Mỗi pack có ghi chú phát hành riêng từ admin.
          </p>
        </div>
      </section>

      {/* LIST */}
      <section className="bru-section bru-section-sm">
        <div className="bru-container">
          {loading && (
            <div className="bru-mono" style={{ color: 'var(--bru-fg-muted)' }}>
              ⟳ Đang tải catalog...
            </div>
          )}
          {error && (
            <div
              style={{
                padding: '12px 16px',
                background: 'rgba(239,68,68,0.1)',
                color: '#fca5a5',
                border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 4,
              }}
            >
              ⚠ {error}
            </div>
          )}
          {!loading && !error && packs.length === 0 && (
            <div
              style={{
                padding: 48,
                textAlign: 'center',
                border: '1px dashed var(--bru-border)',
                color: 'var(--bru-fg-muted)',
              }}
            >
              Chưa có font pack nào được phát hành. Hãy quay lại sau.
            </div>
          )}
          {!loading && !error && packs.length > 0 && (
            <div className="bru-grid-2">
              {packs.map((p) => (
                <article
                  key={p.id}
                  className="bru-card"
                  style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
                    <h2 style={{ fontSize: 'clamp(20px, 2.2vw, 28px)', fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1.1, margin: 0 }}>
                      {p.name}
                    </h2>
                    <span className="bru-tag">{KIND_LABEL[p.kind] ?? p.kind}</span>
                  </div>

                  <p className="bru-body-sm" style={{ color: 'var(--bru-fg-dim)' }}>
                    {p.description}
                  </p>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr 1fr',
                      gap: 12,
                      padding: '12px 0',
                      borderTop: '1px solid var(--bru-border)',
                      borderBottom: '1px solid var(--bru-border)',
                    }}
                  >
                    <Stat label="Version" value={`v${p.version}`} />
                    <Stat label="Files" value={p.file_count.toLocaleString()} />
                    <Stat label="Size" value={formatBytes(p.size_bytes)} />
                  </div>

                  {p.release_notes && (
                    <div
                      style={{
                        padding: '10px 14px',
                        background: 'rgba(52,211,153,0.08)',
                        borderLeft: '3px solid #34d399',
                        fontSize: 13,
                        lineHeight: 1.55,
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: '#34d399', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <FileText size={12} strokeWidth={2.5} />
                        Ghi chú từ admin
                      </div>
                      {p.release_notes}
                      {p.release_date && (
                        <div style={{ fontSize: 11, color: 'var(--bru-fg-muted)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Calendar size={11} />
                          Phát hành: {new Date(p.release_date).toLocaleDateString('vi-VN')}
                        </div>
                      )}
                    </div>
                  )}

                  {p.tags && p.tags.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {p.tags.map((t) => (
                        <span key={t} className="bru-tag" style={{ fontSize: 10 }}>
                          {t}
                        </span>
                      ))}
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 'auto' }}>
                    <a
                      href={p.download_url}
                      className="bru-btn bru-btn-primary"
                      style={{ justifyContent: 'center' }}
                    >
                      <Download size={16} strokeWidth={2.5} />
                      Tải {p.name}
                    </a>
                    <div
                      className="bru-mono"
                      style={{ fontSize: 10, color: 'var(--bru-fg-muted)', textAlign: 'center', wordBreak: 'break-all' }}
                    >
                      SHA256: {p.sha256.slice(0, 24)}…
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="bru-section bru-section-sm">
        <div className="bru-container-narrow" style={{ textAlign: 'center' }}>
          <h2 className="bru-display-md" style={{ marginBottom: 24 }}>
            Cài 1-click qua TrishUtilities
          </h2>
          <p className="bru-body-lg" style={{ marginBottom: 24 }}>
            Mở app, vào module Font → tab Font Packs → bấm Cài. Tự verify SHA256 + giải nén + register Windows + AutoCAD.
          </p>
          <Link href="/downloads" className="bru-btn bru-btn-primary">
            Tải TrishUtilities
            <ArrowRight size={16} strokeWidth={2.5} />
          </Link>
        </div>
      </section>

      <BruFooter />
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div>
      <div className="bru-mono" style={{ color: 'var(--bru-fg-muted)', fontSize: 10, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--bru-fg)' }}>{value}</div>
    </div>
  );
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  return `${(b / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
