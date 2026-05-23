/**
 * LicenseView — Tab "💰 Bản quyền" trong TrishCheck.
 *
 * Scan registry Windows để list software cài đặt → match với database giá
 * tham khảo (`data/software-prices.json`) → hiển thị table:
 *   tên · version · giá/năm · alternatives miễn phí
 *
 * Plus: tab "Tham khảo" để browse toàn bộ DB không cần installed.
 */

import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { openUrl } from '@tauri-apps/plugin-opener';
import pricesData from '../data/software-prices.json';

interface InstalledSoftware {
  name: string;
  version: string;
  publisher: string;
  install_date: string;
  estimated_size_kb: number;
}

interface PriceEntry {
  match: string[];
  ten_vi: string;
  loai: string;
  vendor: string;
  gia_vnd_nam: number;
  ghi_chu: string;
  free_alt: string[];
  link: string;
}

interface MatchedItem {
  installed: InstalledSoftware;
  price: PriceEntry | null;
}

const PRICES: PriceEntry[] = (pricesData.items ?? []) as PriceEntry[];

function fuzzyMatch(installedName: string, matchTerms: string[]): boolean {
  const lower = installedName.toLowerCase();
  return matchTerms.some((term) => lower.includes(term.toLowerCase()));
}

/**
 * Canonicalize tên software để dedupe các bản update / sub-component / version
 * khác nhau nhưng cùng 1 app:
 *   - "AutoCAD 2023" / "AutoCAD 2024 - English" / "AutoCAD - DWG..." → "autocad"
 *   - "Microsoft 365 Apps" / "Microsoft Office Pro" → "microsoft 365 / office"
 *
 * Strategy:
 *   1. Nếu match được 1 PriceEntry → dùng `match[0]` làm key (canonical group)
 *   2. Nếu không → strip version/year/architecture/edition khỏi tên
 */
function canonicalKey(name: string, prices: PriceEntry[]): string {
  const matched = prices.find((p) => fuzzyMatch(name, p.match));
  if (matched) return `db:${matched.match[0].toLowerCase()}`;
  // Fallback: strip version numbers, years, architectures, common suffixes
  let key = name.toLowerCase().trim();
  key = key.replace(/\s*\d{4}([\s-].*)?$/, ''); // "AutoCAD 2024 - English" → "autocad"
  key = key.replace(/\s*\d+(\.\d+)+.*$/, ''); // "Foo 1.2.3" → "foo"
  key = key.replace(
    /\s*[-–—]\s*(english|vietnamese|japanese|x64|x86|64-bit|32-bit|trial|preview|beta|free|pro|enterprise|standard|home|ultimate)\b.*$/i,
    '',
  );
  key = key.replace(/\s+/g, ' ').trim();
  return `name:${key}`;
}

/**
 * Group installed software by canonical key. Giữ entry có install_date mới
 * nhất (hoặc version cao nhất nếu không có ngày).
 */
function dedupeInstalled(
  list: InstalledSoftware[],
  prices: PriceEntry[],
): InstalledSoftware[] {
  const groups = new Map<string, InstalledSoftware>();
  for (const sw of list) {
    const key = canonicalKey(sw.name, prices);
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, sw);
      continue;
    }
    // Prefer entry với install_date mới hơn
    const a = sw.install_date || '';
    const b = existing.install_date || '';
    if (a > b) {
      groups.set(key, sw);
      continue;
    }
    // Tie-break by version string (so sánh lexical đủ tốt cho semver-ish)
    if (a === b && sw.version > existing.version) {
      groups.set(key, sw);
    }
  }
  return [...groups.values()].sort((a, b) =>
    a.name.localeCompare(b.name, 'vi'),
  );
}

function formatVnd(vnd: number): string {
  if (vnd === 0) return 'Miễn phí';
  if (vnd >= 1_000_000) return `${(vnd / 1_000_000).toFixed(1)}M ₫/năm`;
  return `${(vnd / 1_000).toFixed(0)}K ₫/năm`;
}

function formatDate(installDate: string): string {
  // Format YYYYMMDD → DD/MM/YYYY
  if (installDate.length === 8) {
    return `${installDate.slice(6, 8)}/${installDate.slice(4, 6)}/${installDate.slice(0, 4)}`;
  }
  return installDate;
}

interface LicenseViewProps {
  language?: 'vi' | 'en';
}

export function LicenseView({ language = 'vi' }: LicenseViewProps): JSX.Element {
  void language;
  const [installed, setInstalled] = useState<InstalledSoftware[]>([]);
  const [matched, setMatched] = useState<MatchedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [view, setView] = useState<'installed' | 'browse'>('installed');
  const [filter, setFilter] = useState<'all' | 'paid' | 'free'>('all');
  const [search, setSearch] = useState('');

  async function scan(): Promise<void> {
    setLoading(true);
    setErr(null);
    try {
      const raw = await invoke<InstalledSoftware[]>('scan_installed_software');
      // Dedupe: nhiều entry registry trùng tên (AutoCAD x12) → group lại 1 app
      const list = dedupeInstalled(raw, PRICES);
      setInstalled(list);
      // Match từng installed với DB
      const matchedList: MatchedItem[] = list.map((sw) => {
        const price =
          PRICES.find((p) => fuzzyMatch(sw.name, p.match)) ?? null;
        return { installed: sw, price };
      });
      setMatched(matchedList);
    } catch (e) {
      setErr(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void scan();
  }, []);

  // Stats từ matched
  const known = matched.filter((m) => m.price !== null);
  const paidKnown = known.filter((m) => (m.price?.gia_vnd_nam ?? 0) > 0);
  const totalCostVnd = paidKnown.reduce(
    (sum, m) => sum + (m.price?.gia_vnd_nam ?? 0),
    0,
  );

  // Filter list theo view + filter + search
  const filteredInstalled = matched.filter((m) => {
    if (search) {
      const s = search.toLowerCase();
      if (
        !m.installed.name.toLowerCase().includes(s) &&
        !(m.price?.ten_vi.toLowerCase().includes(s) ?? false)
      ) {
        return false;
      }
    }
    if (filter === 'paid') return (m.price?.gia_vnd_nam ?? 0) > 0;
    if (filter === 'free') {
      return m.price !== null && m.price.gia_vnd_nam === 0;
    }
    return true;
  });

  const filteredBrowse = PRICES.filter((p) => {
    if (search) {
      const s = search.toLowerCase();
      if (
        !p.ten_vi.toLowerCase().includes(s) &&
        !p.vendor.toLowerCase().includes(s) &&
        !p.loai.toLowerCase().includes(s)
      ) {
        return false;
      }
    }
    if (filter === 'paid') return p.gia_vnd_nam > 0;
    if (filter === 'free') return p.gia_vnd_nam === 0;
    return true;
  });

  return (
    <div style={{ padding: 16 }}>
      {/* Stats */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 10,
          marginBottom: 16,
        }}
      >
        <StatCard
          label="Đã cài"
          value={`${installed.length} app`}
          color="#3B82F6"
        />
        <StatCard
          label="Trong DB giá"
          value={`${known.length} app`}
          color="#10B981"
        />
        <StatCard
          label="Có bản quyền (paid)"
          value={`${paidKnown.length} app`}
          color="#F59E0B"
        />
        <StatCard
          label="Tổng giá ước tính"
          value={`${(totalCostVnd / 1_000_000).toFixed(1)}M ₫/năm`}
          color="#EF4444"
        />
      </div>

      {/* View toggle + filter + search */}
      <div
        style={{
          display: 'flex',
          gap: 10,
          alignItems: 'center',
          marginBottom: 12,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            type="button"
            onClick={() => setView('installed')}
            style={tabBtnStyle(view === 'installed')}
          >
            💻 Đã cài trên máy ({installed.length})
          </button>
          <button
            type="button"
            onClick={() => setView('browse')}
            style={tabBtnStyle(view === 'browse')}
          >
            📚 Tham khảo DB ({PRICES.length})
          </button>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['all', 'paid', 'free'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              style={chipStyle(filter === f)}
            >
              {f === 'all' ? 'Tất cả' : f === 'paid' ? '💰 Có phí' : '🆓 Miễn phí'}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍 Tìm tên/vendor/loại…"
          style={{
            flex: 1,
            minWidth: 200,
            padding: '6px 10px',
            border: '1px solid var(--border)',
            borderRadius: 6,
            background: 'var(--bg)',
            color: 'var(--fg)',
            fontSize: 13,
          }}
        />
        <button
          type="button"
          onClick={() => void scan()}
          disabled={loading}
          style={{
            padding: '6px 14px',
            border: '1px solid var(--accent)',
            borderRadius: 6,
            background: 'var(--accent)',
            color: '#fff',
            fontWeight: 600,
            cursor: loading ? 'wait' : 'pointer',
          }}
        >
          {loading ? '⏳ Đang quét…' : '🔄 Quét lại'}
        </button>
      </div>

      {err && (
        <div
          style={{
            padding: 10,
            marginBottom: 12,
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 6,
            color: '#DC2626',
            fontSize: 13,
          }}
        >
          ⚠ {err}
        </div>
      )}

      {/* Table view */}
      {view === 'installed' ? (
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Tên</th>
              <th style={thStyle}>Version</th>
              <th style={thStyle}>Loại</th>
              <th style={thStyle}>Giá tham khảo</th>
              <th style={thStyle}>Free thay thế</th>
              <th style={thStyle}>Cài</th>
            </tr>
          </thead>
          <tbody>
            {filteredInstalled.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ ...tdStyle, textAlign: 'center', padding: 20 }}>
                  {loading
                    ? 'Đang quét registry…'
                    : 'Không có software nào khớp filter.'}
                </td>
              </tr>
            ) : (
              filteredInstalled.map((m, i) => (
                <tr
                  key={i}
                  style={{
                    background: i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.02)',
                  }}
                >
                  <td style={tdStyle}>
                    <strong>{m.price?.ten_vi ?? m.installed.name}</strong>
                    {!m.price && (
                      <div style={{ fontSize: 11, color: '#6B7280' }}>
                        {m.installed.publisher}
                      </div>
                    )}
                  </td>
                  <td style={tdStyle}>{m.installed.version || '-'}</td>
                  <td style={tdStyle}>{m.price?.loai ?? '?'}</td>
                  <td style={tdStyle}>
                    {m.price ? (
                      <PriceBadge vnd={m.price.gia_vnd_nam} />
                    ) : (
                      <span style={{ color: '#9CA3AF', fontSize: 11 }}>
                        chưa có
                      </span>
                    )}
                    {m.price?.ghi_chu && (
                      <div style={{ fontSize: 10, color: '#6B7280', marginTop: 2 }}>
                        {m.price.ghi_chu}
                      </div>
                    )}
                  </td>
                  <td style={tdStyle}>
                    {m.price?.free_alt.length ? (
                      <div style={{ fontSize: 11 }}>
                        {m.price.free_alt.slice(0, 3).join(' · ')}
                      </div>
                    ) : (
                      <span style={{ color: '#9CA3AF' }}>-</span>
                    )}
                  </td>
                  <td style={tdStyle}>
                    <span style={{ fontSize: 11 }}>
                      {formatDate(m.installed.install_date)}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      ) : (
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Tên</th>
              <th style={thStyle}>Vendor</th>
              <th style={thStyle}>Loại</th>
              <th style={thStyle}>Giá</th>
              <th style={thStyle}>Free thay thế</th>
              <th style={thStyle}></th>
            </tr>
          </thead>
          <tbody>
            {filteredBrowse.map((p, i) => (
              <tr
                key={i}
                style={{
                  background: i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.02)',
                }}
              >
                <td style={tdStyle}>
                  <strong>{p.ten_vi}</strong>
                </td>
                <td style={tdStyle}>{p.vendor}</td>
                <td style={tdStyle}>{p.loai}</td>
                <td style={tdStyle}>
                  <PriceBadge vnd={p.gia_vnd_nam} />
                  {p.ghi_chu && (
                    <div style={{ fontSize: 10, color: '#6B7280', marginTop: 2 }}>
                      {p.ghi_chu}
                    </div>
                  )}
                </td>
                <td style={tdStyle}>
                  {p.free_alt.length ? (
                    <div style={{ fontSize: 11 }}>
                      {p.free_alt.slice(0, 3).join(' · ')}
                    </div>
                  ) : (
                    <span style={{ color: '#9CA3AF' }}>-</span>
                  )}
                </td>
                <td style={tdStyle}>
                  <button
                    type="button"
                    onClick={() => void openUrl(p.link)}
                    style={linkBtnStyle}
                    title="Mở link mua/download"
                  >
                    🔗
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p
        className="muted small"
        style={{ marginTop: 12, fontSize: 11, color: '#9CA3AF' }}
      >
        💡 Giá tham khảo cập nhật {pricesData.updated_at}. {pricesData.note}
      </p>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}): JSX.Element {
  return (
    <div
      style={{
        padding: 10,
        background: 'var(--bg-elev)',
        border: `1px solid ${color}33`,
        borderLeft: `3px solid ${color}`,
        borderRadius: 6,
      }}
    >
      <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

function PriceBadge({ vnd }: { vnd: number }): JSX.Element {
  if (vnd === 0) {
    return (
      <span
        style={{
          padding: '2px 8px',
          background: '#D1FAE5',
          color: '#065F46',
          borderRadius: 4,
          fontSize: 11,
          fontWeight: 600,
        }}
      >
        🆓 Miễn phí
      </span>
    );
  }
  return (
    <span
      style={{
        padding: '2px 8px',
        background: '#FEE2E2',
        color: '#991B1B',
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 600,
      }}
    >
      💰 {formatVnd(vnd)}
    </span>
  );
}

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 12,
};

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 10px',
  borderBottom: '2px solid var(--border)',
  fontWeight: 700,
  color: 'var(--fg)',
  background: 'var(--bg-elev)',
  fontSize: 12,
};

const tdStyle: React.CSSProperties = {
  padding: '8px 10px',
  borderBottom: '1px solid var(--border)',
  verticalAlign: 'top',
};

function tabBtnStyle(active: boolean): React.CSSProperties {
  return {
    padding: '6px 14px',
    border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
    borderRadius: 6,
    background: active ? 'var(--accent)' : 'transparent',
    color: active ? '#fff' : 'var(--fg)',
    fontWeight: active ? 600 : 500,
    cursor: 'pointer',
    fontSize: 12,
  };
}

function chipStyle(active: boolean): React.CSSProperties {
  return {
    padding: '4px 10px',
    border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
    borderRadius: 4,
    background: active ? 'var(--accent)' : 'transparent',
    color: active ? '#fff' : 'var(--fg)',
    fontWeight: active ? 600 : 500,
    cursor: 'pointer',
    fontSize: 11,
  };
}

const linkBtnStyle: React.CSSProperties = {
  padding: '4px 8px',
  border: '1px solid var(--border)',
  borderRadius: 4,
  background: 'transparent',
  cursor: 'pointer',
  fontSize: 14,
};
