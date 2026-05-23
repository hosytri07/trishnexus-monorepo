/**
 * Phase 45.3 — AppTable: table chuẩn với sort, hover, sticky header, empty state.
 *
 * Dùng generic + helper:
 *   const cols: AppTableColumn<User>[] = [
 *     { key: 'email', label: 'Email', width: 240 },
 *     { key: 'role',  label: 'Vai trò', render: (u) => <AppBadge>{u.role}</AppBadge> },
 *     { key: 'actions', label: '', render: (u) => <AppButton size="sm">Sửa</AppButton>, align: 'right' },
 *   ];
 *   <AppTable data={users} columns={cols} keyField="id" empty="Chưa có user nào" />
 */

import type { CSSProperties, ReactNode } from 'react';

export interface AppTableColumn<T> {
  key: string;
  label: ReactNode;
  width?: number | string;
  align?: 'left' | 'center' | 'right';
  /** Render custom cell. Nếu không có, tự lấy row[key]. */
  render?: (row: T, index: number) => ReactNode;
  /** Cho phép sort cột này */
  sortable?: boolean;
}

export interface AppTableProps<T> {
  data: ReadonlyArray<T>;
  columns: ReadonlyArray<AppTableColumn<T>>;
  /** Field unique để React key. Default 'id'. */
  keyField?: keyof T;
  /** Empty state — hiện khi data.length===0 */
  empty?: ReactNode;
  /** Loading state */
  loading?: boolean;
  /** Click row */
  onRowClick?: (row: T, index: number) => void;
  /** Sort state controlled */
  sortKey?: string;
  sortDir?: 'asc' | 'desc';
  onSortChange?: (key: string, dir: 'asc' | 'desc') => void;
  /** Sticky header — default true */
  stickyHeader?: boolean;
  /** Density: compact (small) | normal (default) | comfortable */
  density?: 'compact' | 'normal' | 'comfortable';
}

const DENSITY_PADDING = {
  compact: '6px 10px',
  normal: '10px 14px',
  comfortable: '14px 18px',
} as const;

export function AppTable<T>({
  data,
  columns,
  keyField,
  empty = 'Không có dữ liệu',
  loading = false,
  onRowClick,
  sortKey,
  sortDir,
  onSortChange,
  stickyHeader = true,
  density = 'normal',
}: AppTableProps<T>): JSX.Element {
  const padding = DENSITY_PADDING[density];

  const handleHeaderClick = (col: AppTableColumn<T>): void => {
    if (!col.sortable || !onSortChange) return;
    if (sortKey === col.key) {
      onSortChange(col.key, sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      onSortChange(col.key, 'asc');
    }
  };

  return (
    <div
      style={{
        background: 'var(--color-surface-card)',
        border: '1px solid var(--color-border-subtle)',
        borderRadius: 10,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <div style={{ overflowX: 'auto' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: 13,
            color: 'var(--color-text-primary)',
          }}
        >
          <thead
            style={{
              background: 'var(--color-surface-muted)',
              position: stickyHeader ? 'sticky' : undefined,
              top: stickyHeader ? 0 : undefined,
              zIndex: stickyHeader ? 1 : undefined,
            }}
          >
            <tr>
              {columns.map((col) => {
                const isSorted = sortKey === col.key;
                const cursor = col.sortable && onSortChange ? 'pointer' : 'default';
                const headerStyle: CSSProperties = {
                  textAlign: col.align ?? 'left',
                  padding,
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--color-text-secondary)',
                  borderBottom: '1px solid var(--color-border-default)',
                  whiteSpace: 'nowrap',
                  cursor,
                  userSelect: 'none',
                  width: col.width,
                };
                return (
                  <th
                    key={col.key}
                    style={headerStyle}
                    onClick={() => handleHeaderClick(col)}
                  >
                    {col.label}
                    {isSorted && (
                      <span style={{ marginLeft: 4, opacity: 0.7 }}>
                        {sortDir === 'asc' ? '▲' : '▼'}
                      </span>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 && !loading ? (
              <tr>
                <td
                  colSpan={columns.length}
                  style={{
                    padding: '32px 16px',
                    textAlign: 'center',
                    color: 'var(--color-text-muted)',
                    fontSize: 13,
                  }}
                >
                  {empty}
                </td>
              </tr>
            ) : (
              data.map((row, i) => {
                const rowKey = keyField ? String(row[keyField]) : i;
                return (
                  <tr
                    key={rowKey}
                    onClick={onRowClick ? () => onRowClick(row, i) : undefined}
                    style={{
                      borderBottom: '1px solid var(--color-border-subtle)',
                      cursor: onRowClick ? 'pointer' : 'default',
                      transition: 'background 100ms',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLTableRowElement).style.background = 'var(--color-surface-muted)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLTableRowElement).style.background = '';
                    }}
                  >
                    {columns.map((col) => {
                      const cellStyle: CSSProperties = {
                        padding,
                        textAlign: col.align ?? 'left',
                        verticalAlign: 'middle',
                      };
                      const value =
                        col.render?.(row, i) ?? (row as Record<string, unknown>)[col.key] ?? '';
                      return (
                        <td key={col.key} style={cellStyle}>
                          {value as ReactNode}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {loading && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(255,255,255,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 13,
            color: 'var(--color-text-muted)',
          }}
        >
          ⏳ Đang tải...
        </div>
      )}
    </div>
  );
}
