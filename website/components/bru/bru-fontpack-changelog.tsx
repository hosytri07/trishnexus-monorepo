/**
 * BruFontpackChangelog — Phase 78.13.10 — Client component fetch Firestore.
 *
 * Embed trong /changelog để hiển thị release notes của fontpacks admin upload.
 * Sort theo release_date desc.
 */
'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Calendar, FileText, Download } from 'lucide-react';

interface FontPack {
  id: string;
  name: string;
  version: string;
  description?: string;
  release_notes?: string;
  release_date?: number;
  download_url?: string;
  size_bytes?: number;
  file_count?: number;
}

export function BruFontpackChangelog(): JSX.Element {
  const [packs, setPacks] = useState<FontPack[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load(): Promise<void> {
      if (!db) {
        setLoading(false);
        return;
      }
      try {
        const snap = await getDocs(collection(db, 'fontpacks'));
        const data = snap.docs
          .map((d) => d.data() as FontPack)
          .filter((p) => p.release_notes); // chỉ pack có release notes
        data.sort((a, b) => (b.release_date ?? 0) - (a.release_date ?? 0));
        setPacks(data);
      } catch {
        // silent — fontpacks chưa có → không hiển thị section
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  if (loading) return <></>;
  if (packs.length === 0) return <></>;

  return (
    <section
      style={{
        marginBottom: 48,
        padding: '24px 0',
        borderBottom: '2px solid var(--bru-border)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            padding: '4px 10px',
            background: '#34D399',
            color: '#000',
            letterSpacing: 1,
          }}
        >
          🔤 FONT PACKS
        </span>
        <span className="bru-mono" style={{ color: 'var(--bru-fg-muted)', fontSize: 13 }}>
          Auto-fed from Firestore
        </span>
      </div>
      <h3 className="bru-h2" style={{ marginBottom: 24 }}>
        Font Pack Releases
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {packs.map((p) => (
          <div
            key={p.id}
            style={{
              padding: 16,
              border: '1px solid var(--bru-border)',
              borderLeft: '3px solid #34D399',
              background: 'var(--bru-bg-elevated)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
              <div>
                <h4 style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
                  {p.name}{' '}
                  <span className="bru-mono" style={{ color: 'var(--bru-fg-muted)', fontWeight: 400, fontSize: 14 }}>
                    v{p.version}
                  </span>
                </h4>
                {p.release_date && (
                  <div className="bru-mono" style={{ fontSize: 11, color: 'var(--bru-fg-muted)', marginTop: 2, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Calendar size={11} />
                    {new Date(p.release_date).toLocaleDateString('vi-VN')}
                  </div>
                )}
              </div>
              {p.download_url && (
                <a
                  href={p.download_url}
                  className="bru-btn bru-btn-sm"
                  style={{ fontSize: 11, padding: '4px 10px' }}
                >
                  <Download size={12} strokeWidth={2.5} />
                  Tải
                </a>
              )}
            </div>

            {p.description && (
              <p className="bru-body-sm" style={{ color: 'var(--bru-fg-dim)', marginBottom: 8 }}>
                {p.description}
              </p>
            )}

            {p.release_notes && (
              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  padding: '8px 12px',
                  background: 'rgba(52,211,153,0.08)',
                  borderRadius: 2,
                  fontSize: 13,
                  lineHeight: 1.55,
                  whiteSpace: 'pre-wrap',
                }}
              >
                <FileText size={14} strokeWidth={2.5} style={{ color: '#34D399', flexShrink: 0, marginTop: 2 }} />
                <div>{p.release_notes}</div>
              </div>
            )}

            {(p.size_bytes || p.file_count) && (
              <div className="bru-mono" style={{ fontSize: 11, color: 'var(--bru-fg-muted)', marginTop: 8 }}>
                {p.file_count ? `${p.file_count.toLocaleString()} files` : ''}
                {p.file_count && p.size_bytes ? ' · ' : ''}
                {p.size_bytes ? formatBytes(p.size_bytes) : ''}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function formatBytes(b: number): string {
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  return `${(b / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
