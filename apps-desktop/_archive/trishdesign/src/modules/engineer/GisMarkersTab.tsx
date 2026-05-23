/**
 * Phase 42 — Tab "📍 Mốc tọa độ TrishTEAM" trong GISMapPanel.
 *
 * Fetch /gis_markers từ Firestore (admin curated). User filter theo
 * Tỉnh + Quốc lộ + Loại, click 1 mốc để copy tọa độ X/Y/Z vào clipboard
 * hoặc đánh dấu lên Leaflet map.
 */
import { useEffect, useState } from 'react';
import { getFirebaseDb } from '@trishteam/auth';
import { collection, getDocs, limit, query } from 'firebase/firestore';

type MarkerType = 'duong_chuyen_1' | 'duong_chuyen_2' | 'duong_chuyen_3' | 'duong_chuyen_gd' | 'bien_bao' | 'coc_h' | 'km';

interface GisMarker {
  id: string;
  type: MarkerType;
  name: string;
  province: string;
  route?: string;
  station_m?: number;
  x: number;
  y: number;
  z?: number;
  note?: string;
}

const TYPE_LABEL: Record<MarkerType, string> = {
  duong_chuyen_1: 'Mốc ĐC.I',
  duong_chuyen_2: 'Mốc ĐC.II',
  duong_chuyen_3: 'Mốc ĐC.III',
  duong_chuyen_gd: 'Mốc giả định',
  bien_bao: 'Biển báo',
  coc_h: 'Cọc H',
  km: 'Cọc Km',
};

function fmtStation(m?: number): string {
  if (m == null) return '—';
  return `Km${Math.floor(m / 1000)}+${(m % 1000).toString().padStart(3, '0')}`;
}

export function GisMarkersTab({ onPickMarker }: {
  onPickMarker?: (m: GisMarker) => void;
}): JSX.Element {
  const [markers, setMarkers] = useState<GisMarker[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterProvince, setFilterProvince] = useState<string>('');
  const [filterRoute, setFilterRoute] = useState<string>('');
  const [filterType, setFilterType] = useState<MarkerType | ''>('');
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const db = getFirebaseDb();
        const snap = await getDocs(query(collection(db, 'gis_markers'), limit(1000)));
        setMarkers(snap.docs.map((d) => d.data() as GisMarker));
      } catch (err) {
        setError(`Không tải được markers: ${err instanceof Error ? err.message : String(err)}`);
      }
      setLoading(false);
    })();
  }, []);

  const provinces = Array.from(new Set(markers.map((m) => m.province))).sort();
  const routes = Array.from(new Set(markers.map((m) => m.route).filter((r): r is string => !!r))).sort();

  const filtered = markers.filter((m) => {
    if (filterProvince && m.province !== filterProvince) return false;
    if (filterRoute && m.route !== filterRoute) return false;
    if (filterType && m.type !== filterType) return false;
    return true;
  });

  function copyCoord(m: GisMarker): void {
    const text = `${m.name}\nX = ${m.x.toFixed(3)}\nY = ${m.y.toFixed(3)}${m.z != null ? `\nZ = ${m.z.toFixed(3)}` : ''}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(m.id);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  return (
    <section className="td-section">
      <h2 className="td-section-title">📍 Mốc tọa độ TrishTEAM — admin curated</h2>
      <div className="td-section-body">
        {/* Filter bar */}
        <div className="dos-action-bar" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          <select value={filterProvince} onChange={(e) => setFilterProvince(e.target.value)} className="td-select" style={{ padding: '6px 10px', minWidth: 150 }}>
            <option value="">Tất cả tỉnh ({markers.length})</option>
            {provinces.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <select value={filterRoute} onChange={(e) => setFilterRoute(e.target.value)} className="td-select" style={{ padding: '6px 10px', minWidth: 130 }}>
            <option value="">Tất cả QL</option>
            {routes.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <select value={filterType} onChange={(e) => setFilterType(e.target.value as MarkerType | '')} className="td-select" style={{ padding: '6px 10px', minWidth: 150 }}>
            <option value="">Tất cả loại</option>
            {(Object.keys(TYPE_LABEL) as MarkerType[]).map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
          </select>
          <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--color-text-muted)' }}>
            {filtered.length}/{markers.length} mốc
          </span>
        </div>

        {loading && <div style={{ padding: 20, textAlign: 'center', color: 'var(--color-text-muted)' }}>⏳ Đang tải...</div>}
        {error && <div style={{ padding: 12, background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)', color: '#991B1B', borderRadius: 8, fontSize: 13 }}>⚠ {error}</div>}

        {!loading && !error && filtered.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
            Chưa có mốc nào trong danh mục. Admin thêm mốc qua website https://trishteam.io.vn/admin/gis-markers
          </div>
        )}

        {filtered.length > 0 && (
          <div style={{ maxHeight: 500, overflowY: 'auto', border: '1px solid var(--color-border-subtle)', borderRadius: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead style={{ position: 'sticky', top: 0, background: 'var(--color-surface-card)', borderBottom: '2px solid var(--color-border-default)' }}>
                <tr>
                  <th style={th}>Loại</th>
                  <th style={th}>Tên</th>
                  <th style={th}>Tỉnh / QL</th>
                  <th style={th}>Lý trình</th>
                  <th style={th}>X (VN2000)</th>
                  <th style={th}>Y (VN2000)</th>
                  <th style={th}>Z (m)</th>
                  <th style={th}>Ghi chú</th>
                  <th style={th}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => (
                  <tr key={m.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                    <td style={td}>{TYPE_LABEL[m.type]}</td>
                    <td style={{ ...td, fontWeight: 600 }}>{m.name}</td>
                    <td style={td}>{m.province}{m.route ? ` · ${m.route}` : ''}</td>
                    <td style={td}>{fmtStation(m.station_m)}</td>
                    <td style={{ ...td, fontFamily: 'monospace' }}>{m.x.toFixed(2)}</td>
                    <td style={{ ...td, fontFamily: 'monospace' }}>{m.y.toFixed(2)}</td>
                    <td style={{ ...td, fontFamily: 'monospace' }}>{m.z?.toFixed(2) ?? '—'}</td>
                    <td style={{ ...td, color: 'var(--color-text-muted)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.note ?? '—'}</td>
                    <td style={td}>
                      <button type="button" onClick={() => copyCoord(m)} className="td-btn-secondary" style={{ padding: '3px 8px', fontSize: 11 }}>
                        {copied === m.id ? '✓' : '📋 Copy'}
                      </button>
                      {onPickMarker && (
                        <button type="button" onClick={() => onPickMarker(m)} className="td-btn-secondary" style={{ padding: '3px 8px', fontSize: 11, marginLeft: 4 }}>
                          📍 Trên map
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

const th: React.CSSProperties = { padding: '6px 8px', textAlign: 'left', fontWeight: 700, color: 'var(--color-text-muted)', fontSize: 11 };
const td: React.CSSProperties = { padding: '6px 8px' };
