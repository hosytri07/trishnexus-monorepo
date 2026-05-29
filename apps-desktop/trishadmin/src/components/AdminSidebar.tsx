/**
 * AdminSidebar — Phase 78.12 collapsible + searchable sidebar.
 *
 * Khác AppSidebar (design-system) ở:
 *   - Mỗi group có nút toggle collapse/expand (chevron)
 *   - Search input top filter items realtime
 *   - Auto-expand group chứa active item
 *   - Persist collapsed state localStorage
 */
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { ChevronDown, ChevronRight, Search } from 'lucide-react';

export interface AdminSidebarItem {
  id: string;
  icon?: ReactNode;
  label: string;
  badge?: ReactNode;
  /** Searchable keywords (in case label localized) */
  keywords?: string[];
}

export interface AdminSidebarGroup {
  id: string;
  label: string;
  icon?: ReactNode;
  /** Default collapsed state (auto-expand if contains activeId) */
  defaultCollapsed?: boolean;
  items: AdminSidebarItem[];
}

export interface AdminSidebarProps {
  groups: AdminSidebarGroup[];
  activeId: string;
  onSelect: (id: string) => void;
  /** Width — default 240px */
  width?: number;
  header?: ReactNode;
  footer?: ReactNode;
  /** localStorage key prefix */
  storageKey?: string;
}

const DEFAULT_STORAGE = 'trishadmin:sidebar:collapsed';

export function AdminSidebar({
  groups,
  activeId,
  onSelect,
  width = 240,
  header,
  footer,
  storageKey = DEFAULT_STORAGE,
}: AdminSidebarProps): JSX.Element {
  const [query, setQuery] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  // Load collapsed state
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved) {
        setCollapsedGroups(JSON.parse(saved));
      } else {
        // Default: collapse all except first group + group chua activeId
        const init: Record<string, boolean> = {};
        groups.forEach((g, i) => {
          const hasActive = g.items.some((it) => it.id === activeId);
          init[g.id] = !(i === 0 || hasActive) && !(g.defaultCollapsed === false);
        });
        setCollapsedGroups(init);
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist on change
  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(collapsedGroups));
    } catch {
      /* ignore */
    }
  }, [collapsedGroups, storageKey]);

  // Auto-expand group containing activeId
  useEffect(() => {
    const activeGroup = groups.find((g) => g.items.some((it) => it.id === activeId));
    if (activeGroup && collapsedGroups[activeGroup.id]) {
      setCollapsedGroups((prev) => ({ ...prev, [activeGroup.id]: false }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  // Filter groups by search query
  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups
      .map((g) => ({
        ...g,
        items: g.items.filter((it) => {
          const labelMatch = it.label.toLowerCase().includes(q);
          const keywordMatch = it.keywords?.some((k) => k.toLowerCase().includes(q));
          const idMatch = it.id.toLowerCase().includes(q);
          return labelMatch || keywordMatch || idMatch;
        }),
      }))
      .filter((g) => g.items.length > 0);
  }, [groups, query]);

  function toggleGroup(gid: string) {
    setCollapsedGroups((prev) => ({ ...prev, [gid]: !prev[gid] }));
  }

  return (
    <aside
      style={{
        width,
        background: 'var(--color-surface-card)',
        borderRight: '1px solid var(--color-border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {header && (
        <div
          style={{
            padding: '14px 16px',
            borderBottom: '1px solid var(--color-border-subtle)',
            flexShrink: 0,
          }}
        >
          {header}
        </div>
      )}

      {/* Search input */}
      <div
        style={{
          padding: '10px 12px',
          borderBottom: '1px solid var(--color-border-subtle)',
          flexShrink: 0,
          position: 'relative',
        }}
      >
        <Search
          size={13}
          strokeWidth={2}
          style={{
            position: 'absolute',
            left: 22,
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--color-text-muted)',
            pointerEvents: 'none',
          }}
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tìm panel..."
          style={{
            width: '100%',
            padding: '6px 10px 6px 28px',
            background: 'var(--color-surface-bg)',
            border: '1px solid var(--color-border-default)',
            borderRadius: 4,
            color: 'var(--color-text-primary)',
            fontSize: 12,
            fontFamily: 'inherit',
            outline: 'none',
          }}
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            style={{
              position: 'absolute',
              right: 18,
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--color-text-muted)',
              fontSize: 14,
              lineHeight: 1,
              padding: 2,
            }}
            aria-label="Xóa filter"
          >
            ×
          </button>
        )}
      </div>

      {/* Nav groups */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
        {filteredGroups.length === 0 ? (
          <div
            style={{
              padding: 20,
              textAlign: 'center',
              fontSize: 12,
              color: 'var(--color-text-muted)',
            }}
          >
            Không có panel nào khớp.
          </div>
        ) : (
          filteredGroups.map((group) => {
            const isCollapsed = !query && collapsedGroups[group.id]; // search query luôn expand
            const groupHasActive = group.items.some((it) => it.id === activeId);
            return (
              <div key={group.id} style={{ marginBottom: 4 }}>
                {/* Group header (clickable to toggle) */}
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 12px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 10.5,
                    fontWeight: 700,
                    letterSpacing: 0.6,
                    textTransform: 'uppercase',
                    color: 'var(--color-text-muted)',
                    fontFamily: 'inherit',
                  }}
                  aria-expanded={!isCollapsed}
                >
                  {isCollapsed ? (
                    <ChevronRight size={12} strokeWidth={2.5} />
                  ) : (
                    <ChevronDown size={12} strokeWidth={2.5} />
                  )}
                  {group.icon && <span>{group.icon}</span>}
                  <span style={{ flex: 1, textAlign: 'left' }}>{group.label}</span>
                  <span
                    style={{
                      fontSize: 9,
                      padding: '0 5px',
                      borderRadius: 99,
                      background: groupHasActive
                        ? 'var(--color-accent-primary)'
                        : 'var(--color-surface-muted)',
                      color: groupHasActive ? '#fff' : 'var(--color-text-muted)',
                      minWidth: 16,
                      textAlign: 'center',
                    }}
                  >
                    {group.items.length}
                  </span>
                </button>

                {/* Group items */}
                {!isCollapsed && (
                  <div>
                    {group.items.map((item) => {
                      const isActive = item.id === activeId;
                      const baseStyle: CSSProperties = {
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        width: '100%',
                        padding: '6px 14px 6px 28px',
                        background: isActive ? 'var(--color-accent-soft)' : 'transparent',
                        color: isActive ? 'var(--color-accent-primary)' : 'var(--color-text-primary)',
                        border: 'none',
                        borderLeft: isActive
                          ? '2px solid var(--color-accent-primary)'
                          : '2px solid transparent',
                        fontSize: 12.5,
                        fontWeight: isActive ? 600 : 500,
                        fontFamily: 'inherit',
                        textAlign: 'left',
                        cursor: 'pointer',
                        transition: 'background 80ms',
                      };
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => onSelect(item.id)}
                          style={baseStyle}
                          onMouseEnter={(e) => {
                            if (!isActive) {
                              (e.currentTarget as HTMLButtonElement).style.background =
                                'var(--color-surface-muted)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isActive) {
                              (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                            }
                          }}
                        >
                          {item.icon && (
                            <span style={{ fontSize: 13, lineHeight: 1, flexShrink: 0 }}>
                              {item.icon}
                            </span>
                          )}
                          <span
                            style={{
                              flex: 1,
                              minWidth: 0,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {item.label}
                          </span>
                          {item.badge != null && (
                            <span
                              style={{
                                fontSize: 9,
                                padding: '1px 6px',
                                borderRadius: 99,
                                background: isActive
                                  ? 'var(--color-accent-primary)'
                                  : 'var(--color-surface-muted)',
                                color: isActive ? 'white' : 'var(--color-text-muted)',
                                flexShrink: 0,
                                minWidth: 18,
                                textAlign: 'center',
                              }}
                            >
                              {item.badge}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </nav>

      {footer && (
        <div
          style={{
            padding: '12px 16px',
            borderTop: '1px solid var(--color-border-subtle)',
            flexShrink: 0,
          }}
        >
          {footer}
        </div>
      )}
    </aside>
  );
}
