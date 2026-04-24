import { useMemo, useState } from 'react';
import {
  buildCollection,
  recommendPairs,
  type FontCollection,
  type FontFamily,
  type FontPair,
  type FontPersonality,
} from '@trishteam/core/fonts';
import {
  pickFontDirectory,
  scanFonts,
  type ScanFontsStats,
} from './tauri-bridge.js';

type Status = 'idle' | 'scanning' | 'done' | 'error';

const PERSONALITY_LABEL: Record<FontPersonality, string> = {
  serif: 'Serif',
  sans: 'Sans-serif',
  slab: 'Slab serif',
  mono: 'Monospace',
  display: 'Display',
  script: 'Script',
  handwriting: 'Handwriting',
  unknown: 'Không rõ',
};

const PERSONALITY_ORDER: FontPersonality[] = [
  'serif',
  'sans',
  'slab',
  'display',
  'script',
  'handwriting',
  'mono',
  'unknown',
];

const PREVIEW_SAMPLES = [
  'The quick brown fox jumps over the lazy dog',
  'Tiếng Việt có dấu: ả ă â đ ê ơ ư',
  'TrishTEAM — 1234567890',
];

export function App(): JSX.Element {
  const [dir, setDir] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<ScanFontsStats | null>(null);
  const [filter, setFilter] = useState<FontPersonality | null>(null);
  const [requireVn, setRequireVn] = useState(false);
  const [fixHeading, setFixHeading] = useState<string | null>(null);

  const collection: FontCollection | null = useMemo(() => {
    if (!stats) return null;
    return buildCollection(stats.entries);
  }, [stats]);

  const visibleFamilies = useMemo<FontFamily[]>(() => {
    if (!collection) return [];
    let list = collection.families;
    if (filter) list = list.filter((f) => f.personality === filter);
    if (requireVn) list = list.filter((f) => f.vn_support);
    return list;
  }, [collection, filter, requireVn]);

  const pairs: FontPair[] = useMemo(() => {
    if (!collection) return [];
    return recommendPairs(collection, {
      limit: 12,
      requireVnBody: requireVn,
      fixHeading: fixHeading ?? undefined,
    });
  }, [collection, requireVn, fixHeading]);

  const countByPersonality = useMemo(() => {
    const c: Record<FontPersonality, number> = {
      serif: 0,
      sans: 0,
      slab: 0,
      mono: 0,
      display: 0,
      script: 0,
      handwriting: 0,
      unknown: 0,
    };
    if (!collection) return c;
    for (const f of collection.families) c[f.personality]++;
    return c;
  }, [collection]);

  async function handlePickAndScan() {
    setError(null);
    try {
      const picked = await pickFontDirectory();
      if (!picked) return;
      setDir(picked);
      setStatus('scanning');
      const res = await scanFonts(picked, { maxEntries: 2000 });
      setStats(res);
      setStatus('done');
    } catch (e) {
      setError(String(e));
      setStatus('error');
    }
  }

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="logo" aria-hidden>
            Aa
          </span>
          <div>
            <strong>TrishFont</strong>
            <div className="sub">Font manager + Pair AI · alpha</div>
          </div>
        </div>
        <button className="btn btn-primary" onClick={handlePickAndScan}>
          {status === 'scanning' ? 'Đang quét...' : 'Chọn thư mục font'}
        </button>
      </header>

      {error && <div className="alert alert-error">Lỗi: {error}</div>}
      {stats?.truncated && (
        <div className="alert alert-warn">
          Đã quét tối đa ({stats.entries.length} font). Chia nhỏ thư mục
          để quét đủ.
        </div>
      )}

      {!stats && status !== 'scanning' && (
        <div className="empty">
          <p>
            TrishFont quét thư mục font (.ttf/.otf/.ttc/.otc), phân loại
            theo personality và đề xuất cặp <em>heading + body</em> hợp
            nhau.
          </p>
          <ul>
            <li>Windows: <code>C:\Windows\Fonts</code></li>
            <li>macOS: <code>~/Library/Fonts</code> hoặc <code>/System/Library/Fonts</code></li>
            <li>Linux: <code>~/.local/share/fonts</code></li>
            <li>Designer: folder project chứa font custom</li>
          </ul>
          <p className="muted small">
            Ở phase alpha: chỉ đọc metadata, không cài/đổi font. Preview
            dùng FontFace API với bytes load trực tiếp.
          </p>
        </div>
      )}

      {collection && stats && (
        <>
          <section className="stats-panel">
            <h2>Kết quả quét</h2>
            <div className="stats-grid">
              <Stat label="Thư mục" value={dir ?? '—'} wide />
              <Stat label="Số family" value={String(collection.families.length)} />
              <Stat label="Số file" value={String(collection.total_files)} />
              <Stat
                label="Dung lượng"
                value={formatBytes(collection.total_size_bytes)}
              />
              <Stat
                label="Thời gian"
                value={`${(stats.elapsed_ms / 1000).toFixed(1)} s`}
              />
              {stats.errors > 0 && (
                <Stat
                  label="Lỗi parse"
                  value={`${stats.errors} file`}
                  warn
                />
              )}
            </div>
          </section>

          <section className="categories">
            <h2>Theo personality</h2>
            <div className="cat-grid">
              <Pill
                label="Tất cả"
                count={collection.families.length}
                active={filter === null}
                onClick={() => setFilter(null)}
              />
              {PERSONALITY_ORDER.map((p) => {
                const c = countByPersonality[p];
                if (!c) return null;
                return (
                  <Pill
                    key={p}
                    label={PERSONALITY_LABEL[p]}
                    count={c}
                    active={filter === p}
                    onClick={() => setFilter(p)}
                  />
                );
              })}
            </div>
            <label className="vn-toggle">
              <input
                type="checkbox"
                checked={requireVn}
                onChange={(e) => setRequireVn(e.target.checked)}
              />
              <span>Chỉ hiện font hỗ trợ tiếng Việt</span>
            </label>
          </section>

          <section className="family-list">
            <h2>
              Family{' '}
              <span className="muted small">({visibleFamilies.length})</span>
            </h2>
            <div className="family-grid">
              {visibleFamilies.slice(0, 60).map((f) => (
                <FamilyCard
                  key={f.family}
                  family={f}
                  pinned={fixHeading === f.family}
                  onPin={() =>
                    setFixHeading(
                      fixHeading === f.family ? null : f.family,
                    )
                  }
                />
              ))}
              {visibleFamilies.length > 60 && (
                <div className="muted small">
                  … {visibleFamilies.length - 60} family nữa không hiện
                </div>
              )}
            </div>
          </section>

          <section className="pair-panel">
            <h2>
              Pair AI đề xuất{' '}
              {fixHeading && (
                <span className="muted small">
                  · heading cố định: <strong>{fixHeading}</strong>{' '}
                  <button
                    className="btn-link"
                    onClick={() => setFixHeading(null)}
                  >
                    (bỏ)
                  </button>
                </span>
              )}
            </h2>
            {pairs.length === 0 ? (
              <p className="muted small">
                Chưa có đủ family đa dạng để đề xuất pair (cần ≥ 2
                personality khác nhau).
              </p>
            ) : (
              <div className="pair-list">
                {pairs.map((p, i) => (
                  <PairRow key={`${p.heading.family}|${p.body.family}`} pair={p} rank={i + 1} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

interface StatProps {
  label: string;
  value: string;
  wide?: boolean;
  warn?: boolean;
}
function Stat({ label, value, wide, warn }: StatProps): JSX.Element {
  return (
    <div className={`stat ${wide ? 'wide' : ''} ${warn ? 'warn' : ''}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  );
}

interface PillProps {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}
function Pill({ label, count, active, onClick }: PillProps): JSX.Element {
  return (
    <button
      type="button"
      className={`cat-pill ${active ? 'active' : ''}`}
      onClick={onClick}
    >
      <div className="cat-label">{label}</div>
      <div className="cat-count">{count.toLocaleString('vi-VN')}</div>
    </button>
  );
}

interface FamilyCardProps {
  family: FontFamily;
  pinned: boolean;
  onPin: () => void;
}
function FamilyCard({ family, pinned, onPin }: FamilyCardProps): JSX.Element {
  return (
    <div className={`family-card ${pinned ? 'pinned' : ''}`}>
      <div className="family-head">
        <div className="family-name">{family.family}</div>
        <button
          type="button"
          className="btn-pin"
          onClick={onPin}
          title={pinned ? 'Bỏ chọn heading' : 'Dùng làm heading trong pair AI'}
        >
          {pinned ? '📌 heading' : 'Pin'}
        </button>
      </div>
      <div className="family-meta">
        <span className={`tag tag-${family.personality}`}>
          {PERSONALITY_LABEL[family.personality]}
        </span>
        <span className="muted small">
          {family.styles.length} style · weight {family.weight_min}–
          {family.weight_max}
          {family.has_italic ? ' · italic' : ''}
        </span>
        {family.vn_support && <span className="tag-vn">VI</span>}
      </div>
    </div>
  );
}

interface PairRowProps {
  pair: FontPair;
  rank: number;
}
function PairRow({ pair, rank }: PairRowProps): JSX.Element {
  const tier = tierFromScore(pair.score);
  return (
    <div className="pair-row">
      <div className="pair-rank">#{rank}</div>
      <div className="pair-main">
        <div className="pair-head-line">
          <strong>{pair.heading.family}</strong>{' '}
          <span className="muted">+ {pair.body.family}</span>
          <span className={`score score-${tier}`}>{pair.score}</span>
        </div>
        <div className="pair-samples">
          {PREVIEW_SAMPLES.map((s, i) => (
            <div key={i} className="pair-sample">
              <div
                className="sample-head"
                style={{ fontFamily: `'${pair.heading.family}', serif` }}
              >
                {s}
              </div>
              <div
                className="sample-body"
                style={{ fontFamily: `'${pair.body.family}', sans-serif` }}
              >
                {s}
              </div>
            </div>
          ))}
        </div>
        <div className="pair-rationale muted small">{pair.rationale}</div>
      </div>
    </div>
  );
}

function tierFromScore(score: number): string {
  if (score >= 85) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 50) return 'ok';
  if (score >= 30) return 'low';
  return 'bad';
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) return '—';
  const mb = bytes / 1024 ** 2;
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  const kb = bytes / 1024;
  return `${kb.toFixed(0)} KB`;
}
