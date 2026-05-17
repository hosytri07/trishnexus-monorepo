/**
 * TrishDesign Phase 43 wave 14.2 — Modal xem database ATGT (read-only).
 *
 * User TrishDesign mở modal → fetch Firestore /atgt_blocks → hiển thị 415 block
 * với search + filter + sort. Auto sync khi admin update qua TrishAdmin.
 *
 * Read-only — không CRUD ở đây (chỉ TrishAdmin admin sửa được).
 */

import { useEffect, useMemo, useState } from 'react';
import { useAtgtBlocks, type AtgtBlock } from '../../lib/atgt-blocks-fetch.js';

interface Props {
  onClose: () => void;
}

type SortBy = 'label' | 'fileName' | 'category' | 'meaning';

export function AtgtDatabaseViewer({ onClose }: Props): JSX.Element {
  const { blocks, loading, error, reload } = useAtgtBlocks();
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchText, setSearchText] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('label');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Auto fetch lần đầu
  useEffect(() => {
    void reload();
  }, []);

  const categories = useMemo(() => {
    const set = new Set<string>();
    blocks.forEach((b) => { if (b.category) set.add(b.category); });
    return Array.from(set).sort();
  }, [blocks]);

  const filtered = useMemo(() => {
    const list = blocks.filter((b) => {
      if (filterCategory !== 'all' && b.category !== filterCategory) return false;
      if (searchText.trim()) {
        const q = searchText.toLowerCase();
        return (
          b.label.toLowerCase().includes(q) ||
          b.fileName.toLowerCase().includes(q) ||
          (b.meaning ?? '').toLowerCase().includes(q) ||
          b.id.toLowerCase().includes(q)
        );
      }
      return true;
    });
    list.sort((a, b) => {
      let av = '', bv = '';
      switch (sortBy) {
        case 'label': av = a.label; bv = b.label; break;
        case 'fileName': av = a.fileName; bv = b.fileName; break;
        case 'category': av = a.category; bv = b.category; break;
        case 'meaning': av = a.meaning ?? ''; bv = b.meaning ?? ''; break;
      }
      const cmp = av.localeCompare(bv, 'vi', { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [blocks, filterCategory, searchText, sortBy, sortDir]);

  function handleSort(col: SortBy): void {
    if (sortBy === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(col);
      setSortDir('asc');
    }
  }

  function sortInd(col: SortBy): string {
    if (sortBy !== col) return ' ↕';
    return sortDir === 'asc' ? ' ▲' : ' ▼';
  }

  return (
    <div className="atgt-db-modal-backdrop" onClick={onClose}>
      <div className="atgt-db-modal" onClick={(e) => e.stopPropagation()}>
        <header className="atgt-db-header">
          <h2 className="atgt-db-title">📋 Database ATGT — {filtered.length}/{blocks.length} block</h2>
          <button type="button" className="atgt-db-mini" onClick={() => void reload()} title="Sync lại từ Firestore">🔄</button>
          <span style={{ flex: 1 }} />
          <span className="atgt-db-status">
            {loading ? '⏳ Đang tải...' : error ? `⚠ ${error}` : '✓ Auto-sync khi admin update'}
          </span>
          <button type="button" className="atgt-db-close" onClick={onClose}>✕</button>
        </header>

        <div className="atgt-db-filters">
          <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
            <option value="all">Tất cả nhóm</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input type="text" placeholder="🔎 Tìm tên / file / ý nghĩa..."
            value={searchText} onChange={(e) => setSearchText(e.target.value)} />
        </div>

        <div className="atgt-db-table-wrap">
          <table className="atgt-db-table">
            <thead>
              <tr>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('label')}>Label{sortInd('label')}</th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('fileName')}>File .dwg{sortInd('fileName')}</th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('category')}>Nhóm{sortInd('category')}</th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('meaning')}>Ý nghĩa{sortInd('meaning')}</th>
                <th>Dạng/Hướng</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && !loading ? (
                <tr><td colSpan={5} style={{ padding: 30, textAlign: 'center', color: 'var(--color-text-muted)' }}>
                  {blocks.length === 0 ? '⚠ Database chưa có data. Admin Trí vào TrishAdmin → 🚸 ATGT Blocks để import.' : 'Không có kết quả phù hợp filter.'}
                </td></tr>
              ) : filtered.map((b) => (
                <tr key={b.id}>
                  <td><strong>{b.label}</strong></td>
                  <td><code>{b.fileName}</code></td>
                  <td>{b.category}</td>
                  <td className="atgt-db-meaning">{b.meaning ?? '—'}</td>
                  <td>{b.shapeKind === 'linetype' ? 'Linetype' : 'Block'} / {b.orientation === 'parallel' ? '↔' : '⊥'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Styles />
      </div>
    </div>
  );
}

function Styles(): JSX.Element {
  return (
    <style>{`
      .atgt-db-modal-backdrop {
        position: fixed; inset: 0;
        background: rgba(0,0,0,0.6);
        display: flex; align-items: center; justify-content: center;
        z-index: 2000;
      }
      .atgt-db-modal {
        background: var(--color-bg-surface, #1a1a1f);
        border: 1px solid var(--color-border-subtle, #2a2a30);
        border-radius: 10px;
        width: 92vw; max-width: 1200px;
        height: 88vh; max-height: 800px;
        display: flex; flex-direction: column;
        box-shadow: 0 20px 60px rgba(0,0,0,0.5);
      }
      .atgt-db-header {
        display: flex; align-items: center; gap: 10px;
        padding: 12px 16px;
        border-bottom: 1px solid var(--color-border-subtle);
      }
      .atgt-db-title { margin: 0; font-size: 15px; font-weight: 700; }
      .atgt-db-mini { background: transparent; border: 1px solid var(--color-border-subtle); border-radius: 4px; padding: 3px 8px; cursor: pointer; color: inherit; font-size: 12px; }
      .atgt-db-status { font-size: 11px; color: var(--color-text-muted); }
      .atgt-db-close { background: transparent; border: none; cursor: pointer; padding: 4px 10px; font-size: 16px; color: var(--color-text-muted); }
      .atgt-db-close:hover { color: var(--color-text-strong); }

      .atgt-db-filters { display: flex; gap: 8px; padding: 10px 16px; border-bottom: 1px solid var(--color-border-subtle); }
      .atgt-db-filters select, .atgt-db-filters input {
        padding: 5px 10px; font-size: 12px;
        background: var(--color-bg-input, #0e0e12);
        border: 1px solid var(--color-border-subtle);
        border-radius: 4px; color: inherit; outline: none;
      }
      .atgt-db-filters input { flex: 1; min-width: 200px; }

      .atgt-db-table-wrap { flex: 1; overflow: auto; }
      .atgt-db-table { width: 100%; border-collapse: collapse; font-size: 12px; }
      .atgt-db-table th, .atgt-db-table td {
        padding: 6px 10px; text-align: left;
        border-bottom: 1px solid var(--color-border-subtle);
      }
      .atgt-db-table thead th {
        background: var(--color-bg-elevated);
        font-weight: 600; font-size: 11px;
        color: var(--color-text-muted);
        position: sticky; top: 0; z-index: 1;
      }
      .atgt-db-meaning { font-size: 11px; color: var(--color-text-muted); }
      .atgt-db-table code { font-size: 11px; color: var(--color-text-muted); }
    `}</style>
  );
}
