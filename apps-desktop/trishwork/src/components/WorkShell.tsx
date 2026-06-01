/**
 * WorkShell — shell điều hướng cho TrishWork (Wave 45.x redesign).
 *
 *   - Topbar slim: [logo] TrishWork vX  ...........  {bell/theme/⚙}
 *   - Tab bar kiểu browser: [Home] [feature mở ×] ... (viền màu theo nhóm)
 *   - Home = Dashboard nhóm: 3 nhóm module, mỗi nhóm là grid panel sub-feature.
 *     Có ô tìm kiếm, hàng "Gần đây / Ghim", nhóm thu gọn được.
 *   - Command palette (Ctrl+K): gõ tên → mở nhanh bất kỳ công cụ. Thay sidebar.
 *
 * Mỗi feature mở trong 1 tab, render module tương ứng với hideNav (không sidebar).
 * Module giữ mounted khi tab còn mở.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react';
import { AppLogo, type AppShellId } from '@trishteam/design-system';
import { Home, X, Search, Command, Star, Clock } from 'lucide-react';
import './work-shell.css';

export interface WorkGroup {
  id: string;
  label: string;
  icon: ReactNode;
  accent: string;
}
export interface WorkFeature {
  id: string;
  groupId: string;
  label: string;
  description?: string;
  icon: ReactNode;
  /** từ khoá phụ cho search/palette */
  keywords?: string;
  render: () => ReactNode;
}
export interface WorkShellProps {
  appId: AppShellId;
  appName: string;
  version: string;
  groups: ReadonlyArray<WorkGroup>;
  features: ReadonlyArray<WorkFeature>;
  topbarRight?: ReactNode;
  /** Theme global — WorkShell re-assert sau khi mở tab để module con không đè. */
  theme: 'light' | 'dark';
}

const LS_PINNED = 'trishwork:dash:pinned';
const LS_RECENT = 'trishwork:dash:recent';
const LS_COLLAPSED = 'trishwork:dash:collapsed';

function loadList(key: string): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
function saveList(key: string, v: string[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* ignore */
  }
}

export function WorkShell({
  appId,
  appName,
  version,
  groups,
  features,
  topbarRight,
  theme,
}: WorkShellProps): JSX.Element {
  const [openIds, setOpenIds] = useState<string[]>([]);
  const [active, setActive] = useState<string>('home');
  const [animKey, setAnimKey] = useState(0);
  const [pinned, setPinned] = useState<string[]>(() => loadList(LS_PINNED));
  const [recent, setRecent] = useState<string[]>(() => loadList(LS_RECENT));
  const [collapsed, setCollapsed] = useState<string[]>(() => loadList(LS_COLLAPSED));
  const [dashQuery, setDashQuery] = useState('');
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState('');
  const paletteInputRef = useRef<HTMLInputElement | null>(null);

  const featById = useMemo(() => {
    const m = new Map<string, WorkFeature>();
    features.forEach((f) => m.set(f.id, f));
    return m;
  }, [features]);
  const groupById = useMemo(() => {
    const m = new Map<string, WorkGroup>();
    groups.forEach((g) => m.set(g.id, g));
    return m;
  }, [groups]);

  const goto = useCallback((tab: string) => {
    setActive(tab);
    setAnimKey((k) => k + 1);
  }, []);

  const openFeature = useCallback(
    (id: string) => {
      setOpenIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
      setRecent((prev) => {
        const next = [id, ...prev.filter((x) => x !== id)].slice(0, 8);
        saveList(LS_RECENT, next);
        return next;
      });
      goto(id);
      setPaletteOpen(false);
      setPaletteQuery('');
    },
    [goto],
  );

  const closeTab = useCallback((id: string, e?: ReactMouseEvent) => {
    e?.stopPropagation();
    setOpenIds((prev) => {
      const next = prev.filter((x) => x !== id);
      setActive((cur) => {
        if (cur !== id) return cur;
        const idx = prev.indexOf(id);
        return next[idx] ?? next[idx - 1] ?? 'home';
      });
      return next;
    });
    setAnimKey((k) => k + 1);
  }, []);

  const togglePin = useCallback((id: string, e?: ReactMouseEvent) => {
    e?.stopPropagation();
    setPinned((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      saveList(LS_PINNED, next);
      return next;
    });
  }, []);

  const toggleGroup = useCallback((gid: string) => {
    setCollapsed((prev) => {
      const next = prev.includes(gid) ? prev.filter((x) => x !== gid) : [...prev, gid];
      saveList(LS_COLLAPSED, next);
      return next;
    });
  }, []);

  // Keyboard: Ctrl+K palette, Ctrl+0 Home
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setPaletteOpen((v) => !v);
        return;
      }
      if (e.key === 'Escape') {
        setPaletteOpen(false);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        const t = e.target as HTMLElement | null;
        if (t?.tagName === 'INPUT' || t?.tagName === 'TEXTAREA') return;
        e.preventDefault();
        goto('home');
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goto]);

  useEffect(() => {
    if (paletteOpen) setTimeout(() => paletteInputRef.current?.focus(), 30);
  }, [paletteOpen]);

  // Re-assert theme global sau khi đổi tab (module con mount có thể đã ghi
  // data-theme theo setting riêng → khôi phục về theme của shell).
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [active, theme]);

  const paletteResults = useMemo(() => {
    const q = paletteQuery.trim().toLowerCase();
    if (!q) return features;
    return features.filter(
      (f) =>
        f.label.toLowerCase().includes(q) ||
        (f.keywords ?? '').toLowerCase().includes(q) ||
        (groupById.get(f.groupId)?.label ?? '').toLowerCase().includes(q),
    );
  }, [paletteQuery, features, groupById]);

  return (
    <div className="work-shell ts-app">
      {/* Topbar */}
      <header className="ws-topbar">
        <div className="ws-brand">
          <AppLogo appId={appId} size={30} />
          <strong className="ws-appname">{appName}</strong>
          <span className="ws-version">v{version}</span>
        </div>
        <div className="ws-spacer" />
        <button
          type="button"
          className="ws-cmdk-btn"
          onClick={() => setPaletteOpen(true)}
          title="Mở nhanh công cụ (Ctrl+K)"
        >
          <Command size={13} />
          <span>Ctrl+K</span>
        </button>
        {topbarRight && <div className="ws-actions">{topbarRight}</div>}
      </header>

      {/* Tab bar */}
      <nav className="ws-tabbar" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={active === 'home'}
          className={`ws-tab ws-tab-home ${active === 'home' ? 'active' : ''}`}
          onClick={() => goto('home')}
          title="Trang chủ (Ctrl+0)"
        >
          <Home size={15} />
          <span className="ws-tab-label">Home</span>
        </button>
        {openIds.map((id) => {
          const f = featById.get(id);
          if (!f) return null;
          const accent = groupById.get(f.groupId)?.accent;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active === id}
              className={`ws-tab ${active === id ? 'active' : ''}`}
              onClick={() => goto(id)}
              style={active === id ? ({ '--ws-tab-accent': accent } as CSSProperties) : undefined}
            >
              <span className="ws-tab-ico" style={{ color: accent }}>
                {f.icon}
              </span>
              <span className="ws-tab-label">{f.label}</span>
              <span
                className="ws-tab-close"
                role="button"
                aria-label={`Đóng ${f.label}`}
                onClick={(e) => closeTab(id, e)}
              >
                <X size={13} />
              </span>
            </button>
          );
        })}
      </nav>

      {/* Content */}
      <main className="ws-content">
        <div
          className="ws-pane"
          style={{ display: active === 'home' ? 'block' : 'none' }}
          key={active === 'home' ? `home-${animKey}` : 'home'}
        >
          {active === 'home' && (
            <Dashboard
              appName={appName}
              groups={groups}
              features={features}
              pinned={pinned}
              recent={recent}
              collapsed={collapsed}
              dashQuery={dashQuery}
              onDashQuery={setDashQuery}
              onOpen={openFeature}
              onTogglePin={togglePin}
              onToggleGroup={toggleGroup}
            />
          )}
        </div>

        {openIds.map((id) => {
          const f = featById.get(id);
          if (!f) return null;
          const isActive = active === id;
          return (
            <div
              key={id}
              className="ws-pane ws-module-pane"
              style={{ display: isActive ? 'block' : 'none' }}
            >
              <div className="ws-module-anim" key={isActive ? `${id}-${animKey}` : id}>
                {f.render()}
              </div>
            </div>
          );
        })}
      </main>

      {/* Command palette */}
      {paletteOpen && (
        <div className="ws-palette-overlay" onClick={() => setPaletteOpen(false)}>
          <div className="ws-palette" onClick={(e) => e.stopPropagation()}>
            <div className="ws-palette-search">
              <Search size={16} />
              <input
                ref={paletteInputRef}
                type="text"
                placeholder="Mở công cụ… (gõ tên, vd: PDF, ATGT, lịch bảo trì)"
                value={paletteQuery}
                onChange={(e) => setPaletteQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && paletteResults[0]) openFeature(paletteResults[0].id);
                }}
              />
            </div>
            <div className="ws-palette-list">
              {paletteResults.length === 0 && (
                <div className="ws-palette-empty">Không tìm thấy công cụ nào.</div>
              )}
              {paletteResults.map((f) => {
                const g = groupById.get(f.groupId);
                return (
                  <button
                    key={f.id}
                    type="button"
                    className="ws-palette-item"
                    onClick={() => openFeature(f.id)}
                  >
                    <span className="ws-palette-ico" style={{ color: g?.accent }}>
                      {f.icon}
                    </span>
                    <span className="ws-palette-label">{f.label}</span>
                    <span className="ws-palette-group">{g?.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Dashboard ---------------- */
function Dashboard({
  appName,
  groups,
  features,
  pinned,
  recent,
  collapsed,
  dashQuery,
  onDashQuery,
  onOpen,
  onTogglePin,
  onToggleGroup,
}: {
  appName: string;
  groups: ReadonlyArray<WorkGroup>;
  features: ReadonlyArray<WorkFeature>;
  pinned: string[];
  recent: string[];
  collapsed: string[];
  dashQuery: string;
  onDashQuery: (v: string) => void;
  onOpen: (id: string) => void;
  onTogglePin: (id: string, e?: ReactMouseEvent) => void;
  onToggleGroup: (gid: string) => void;
}): JSX.Element {
  const featById = useMemo(() => {
    const m = new Map<string, WorkFeature>();
    features.forEach((f) => m.set(f.id, f));
    return m;
  }, [features]);

  const q = dashQuery.trim().toLowerCase();
  const matches = (f: WorkFeature): boolean =>
    !q ||
    f.label.toLowerCase().includes(q) ||
    (f.keywords ?? '').toLowerCase().includes(q);

  const pinnedFeats = pinned.map((id) => featById.get(id)).filter(Boolean) as WorkFeature[];
  const recentFeats = recent
    .map((id) => featById.get(id))
    .filter((f): f is WorkFeature => !!f && !pinned.includes(f.id))
    .slice(0, 6);

  return (
    <div className="ws-dashboard">
      <div className="ws-dash-head">
        <h1 className="ws-dash-title">{appName}</h1>
        <p className="ws-dash-sub">
          Chọn công cụ để bắt đầu — mỗi mục mở trong một tab riêng. Nhấn{' '}
          <kbd>Ctrl</kbd>+<kbd>K</kbd> để mở nhanh.
        </p>
      </div>

      <div className="ws-dash-search">
        <Search size={16} />
        <input
          type="text"
          placeholder="Tìm công cụ trong TrishWork…"
          value={dashQuery}
          onChange={(e) => onDashQuery(e.target.value)}
        />
      </div>

      {!q && (pinnedFeats.length > 0 || recentFeats.length > 0) && (
        <div className="ws-quick">
          {pinnedFeats.length > 0 && (
            <div className="ws-quick-block">
              <div className="ws-quick-head">
                <Star size={13} /> Ghim
              </div>
              <div className="ws-chiprow">
                {pinnedFeats.map((f) => (
                  <Chip key={f.id} f={f} onOpen={onOpen} />
                ))}
              </div>
            </div>
          )}
          {recentFeats.length > 0 && (
            <div className="ws-quick-block">
              <div className="ws-quick-head">
                <Clock size={13} /> Gần đây
              </div>
              <div className="ws-chiprow">
                {recentFeats.map((f) => (
                  <Chip key={f.id} f={f} onOpen={onOpen} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {groups.map((g) => {
        const feats = features.filter((f) => f.groupId === g.id && matches(f));
        if (feats.length === 0) return null;
        const isCollapsed = !q && collapsed.includes(g.id);
        return (
          <section className="ws-group" key={g.id}>
            <button
              type="button"
              className="ws-group-head"
              onClick={() => onToggleGroup(g.id)}
              style={{ '--ws-group-accent': g.accent } as CSSProperties}
            >
              <span className="ws-group-ico" style={{ color: g.accent }}>
                {g.icon}
              </span>
              <span className="ws-group-label">{g.label}</span>
              <span className="ws-group-count">{feats.length} công cụ</span>
              <span className={`ws-group-chev ${isCollapsed ? 'collapsed' : ''}`}>⌄</span>
            </button>
            {!isCollapsed && (
              <div className="ws-grid">
                {feats.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className="ws-card"
                    style={{ '--ws-card-accent': g.accent } as CSSProperties}
                    onClick={() => onOpen(f.id)}
                  >
                    <span className="ws-card-shimmer" />
                    <span className="ws-card-ico">{f.icon}</span>
                    <span className="ws-card-body">
                      <span className="ws-card-title">{f.label}</span>
                      {f.description && <span className="ws-card-desc">{f.description}</span>}
                    </span>
                    <span
                      className={`ws-card-pin ${pinned.includes(f.id) ? 'pinned' : ''}`}
                      role="button"
                      aria-label="Ghim"
                      onClick={(e) => onTogglePin(f.id, e)}
                    >
                      <Star size={14} />
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function Chip({ f, onOpen }: { f: WorkFeature; onOpen: (id: string) => void }): JSX.Element {
  return (
    <button type="button" className="ws-chip" onClick={() => onOpen(f.id)}>
      <span className="ws-chip-ico">{f.icon}</span>
      <span>{f.label}</span>
    </button>
  );
}
