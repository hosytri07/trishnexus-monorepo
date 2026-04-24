import { useMemo, useState } from 'react';
import { images } from '@trishteam/core';
import {
  pickFolder,
  scanImages,
  type ScanImagesStats,
} from './tauri-bridge.js';

type ViewMode = 'events' | 'faces' | 'all';

export function App(): JSX.Element {
  const [dir, setDir] = useState<string | null>(null);
  const [stats, setStats] = useState<ScanImagesStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aspectFilter, setAspectFilter] =
    useState<images.AspectClass | null>(null);
  const [view, setView] = useState<ViewMode>('events');

  const enriched: images.ImageMeta[] = useMemo(() => {
    if (!stats) return [];
    return stats.entries.map(images.enrichImage);
  }, [stats]);

  const filtered = useMemo(
    () => images.filterByAspect(enriched, aspectFilter),
    [enriched, aspectFilter],
  );

  const summary = useMemo(() => images.summarizeImages(enriched), [enriched]);
  const faces = useMemo(() => images.summarizeFaces(enriched), [enriched]);
  const events = useMemo(() => images.groupByEvent(filtered), [filtered]);
  const faceGroups = useMemo(
    () => images.groupByFaceBucket(filtered),
    [filtered],
  );

  const handlePickAndScan = async (): Promise<void> => {
    setError(null);
    const d = await pickFolder();
    if (!d) return;
    setDir(d);
    setLoading(true);
    try {
      const s = await scanImages(d);
      setStats(s);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <strong>TrishImage</strong>
          <span className="muted"> · photo organizer</span>
        </div>
        <div className="actions">
          <button onClick={() => void handlePickAndScan()} disabled={loading}>
            {loading ? 'Đang quét…' : 'Chọn thư mục…'}
          </button>
        </div>
      </header>

      <div className="main">
        <aside className="sidebar">
          {!stats && !loading && (
            <div className="empty">
              <h3>Bắt đầu</h3>
              <p className="muted">
                Chọn 1 thư mục ảnh để quét metadata + phân nhóm theo event
                + aspect + face bucket. Ảnh không bị decode pixel (chỉ
                đọc header ≤ 512 byte) nên nhanh cả với thư mục 10 000+
                ảnh.
              </p>
            </div>
          )}
          {stats && (
            <>
              <section>
                <h3>Tổng quan</h3>
                <div className="stat-grid">
                  <Stat label="Ảnh" value={summary.total_files.toString()} />
                  <Stat
                    label="Dung lượng"
                    value={images.formatBytes(summary.total_bytes)}
                  />
                  <Stat
                    label="Có EXIF time"
                    value={`${summary.with_exif_time}/${summary.total_files}`}
                  />
                  <Stat label="GPS" value={summary.with_gps.toString()} />
                  <Stat label="Thời gian quét" value={`${stats.elapsed_ms} ms`} />
                  <Stat label="Lỗi" value={stats.errors.toString()} />
                </div>
                {stats.truncated && (
                  <div className="warning">
                    Scan bị cắt vì vượt giới hạn — tăng max_entries hoặc chọn
                    folder nhỏ hơn.
                  </div>
                )}
              </section>

              <section>
                <h3>Lọc aspect</h3>
                <div className="aspect-pills">
                  <Pill
                    active={aspectFilter === null}
                    onClick={() => setAspectFilter(null)}
                  >
                    Tất cả ({summary.total_files})
                  </Pill>
                  {images.aspectOrder().map((a) => (
                    <Pill
                      key={a}
                      active={aspectFilter === a}
                      onClick={() => setAspectFilter(a)}
                      data-aspect={a}
                    >
                      {labelAspect(a)} ({summary.by_aspect[a]})
                    </Pill>
                  ))}
                </div>
              </section>

              <section>
                <h3>Face bucket</h3>
                <div className="face-grid">
                  <Stat
                    label="Có người"
                    value={`${faces.with_people}`}
                  />
                  <Stat
                    label="Không người"
                    value={`${faces.without_people}`}
                  />
                  <Stat
                    label="Chưa phân tích"
                    value={`${faces.not_analyzed}`}
                  />
                  <Stat
                    label="Coverage"
                    value={`${Math.round(faces.coverage * 100)}%`}
                  />
                </div>
                <p className="muted tiny">
                  Phase 14.3.4 alpha: bucket dựa trên `face_count` từ Rust.
                  Wire ONNX model ở 14.3.4.b.
                </p>
              </section>

              <section>
                <h3>View</h3>
                <div className="view-toggle">
                  <button
                    className={view === 'events' ? 'active' : ''}
                    onClick={() => setView('events')}
                  >
                    Events
                  </button>
                  <button
                    className={view === 'faces' ? 'active' : ''}
                    onClick={() => setView('faces')}
                  >
                    Faces
                  </button>
                  <button
                    className={view === 'all' ? 'active' : ''}
                    onClick={() => setView('all')}
                  >
                    Tất cả
                  </button>
                </div>
              </section>
            </>
          )}
        </aside>

        <main className="content">
          {loading && <div className="loading">Đang quét {dir}…</div>}
          {error && <div className="error">Lỗi: {error}</div>}
          {!loading && !error && stats && view === 'events' && (
            <EventsView events={events} />
          )}
          {!loading && !error && stats && view === 'faces' && (
            <FacesView groups={faceGroups} />
          )}
          {!loading && !error && stats && view === 'all' && (
            <AllView items={filtered} />
          )}
          {!loading && !error && !stats && (
            <div className="placeholder">
              Chưa có dữ liệu — bấm "Chọn thư mục…" ở thanh trên.
            </div>
          )}
        </main>
      </div>

      <footer className="statusbar">
        <span>{dir ?? '(chưa chọn folder)'}</span>
        <span>
          {stats
            ? `${filtered.length}/${stats.entries.length} ảnh đang hiển thị`
            : 'sẵn sàng'}
        </span>
      </footer>
    </div>
  );
}

function EventsView({
  events,
}: {
  events: images.EventGroup[];
}): JSX.Element {
  if (events.length === 0)
    return <div className="placeholder">Không có ảnh nào khớp.</div>;
  return (
    <div className="events">
      {events.map((ev) => (
        <section key={ev.id} className="event">
          <header className="event-head">
            <h2>{ev.label}</h2>
            <span className="muted tiny">
              {ev.images.length} ảnh ·{' '}
              {images.formatBytes(
                ev.images.reduce((s, im) => s + im.size_bytes, 0),
              )}
            </span>
          </header>
          <ul className="thumb-grid">
            {ev.images.map((im) => (
              <ImageCard key={im.path} image={im} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function FacesView({
  groups,
}: {
  groups: Map<images.FaceBucket, images.ImageMeta[]>;
}): JSX.Element {
  const buckets: images.FaceBucket[] = [
    'solo',
    'pair',
    'group',
    'none',
    'unknown',
  ];
  return (
    <div className="faces-view">
      {buckets.map((b) => {
        const list = groups.get(b) ?? [];
        if (list.length === 0) return null;
        return (
          <section key={b} className="face-section">
            <header className="event-head">
              <h2>{images.faceBucketLabel(b)}</h2>
              <span className="muted tiny">{list.length} ảnh</span>
            </header>
            <ul className="thumb-grid">
              {list.map((im) => (
                <ImageCard key={im.path} image={im} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function AllView({ items }: { items: images.ImageMeta[] }): JSX.Element {
  if (items.length === 0)
    return <div className="placeholder">Không có ảnh nào khớp.</div>;
  return (
    <ul className="thumb-grid flat">
      {items.map((im) => (
        <ImageCard key={im.path} image={im} />
      ))}
    </ul>
  );
}

function ImageCard({ image }: { image: images.ImageMeta }): JSX.Element {
  return (
    <li className="thumb" data-aspect={image.aspect}>
      <div className="thumb-placeholder">{image.ext.toUpperCase()}</div>
      <div className="thumb-meta">
        <div className="thumb-name" title={image.path}>
          {image.name}
        </div>
        <div className="thumb-sub">
          {image.width && image.height
            ? `${image.width}×${image.height}`
            : '—'}
          {' · '}
          {images.formatBytes(image.size_bytes)}
          {image.camera && (
            <>
              {' · '}
              <span className="muted">{image.camera}</span>
            </>
          )}
          {image.has_gps && <span className="gps">📍</span>}
        </div>
      </div>
    </li>
  );
}

function Stat({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
    </div>
  );
}

function Pill({
  active,
  onClick,
  children,
  ...rest
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  [k: string]: unknown;
}): JSX.Element {
  return (
    <button
      className={`pill ${active ? 'active' : ''}`}
      onClick={onClick}
      {...rest}
    >
      {children}
    </button>
  );
}

function labelAspect(a: images.AspectClass): string {
  switch (a) {
    case 'landscape':
      return 'Ngang';
    case 'portrait':
      return 'Dọc';
    case 'square':
      return 'Vuông';
    case 'panorama':
      return 'Panorama';
    case 'unknown':
      return 'Không rõ';
  }
}
