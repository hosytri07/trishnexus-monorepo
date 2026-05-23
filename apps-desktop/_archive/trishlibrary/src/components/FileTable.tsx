/**
 * Phase 15.2.r3 — FileTable: 5 cột (Mã / Tên file / Tên tài liệu / Dung lượng / Loại)
 * + group by folder + collapse/expand + click row mở edit modal.
 */

import { useMemo, useState } from 'react';
import {
  type LibraryFile,
  formatBytes,
  groupByFolder,
} from '../types.js';
import { openLocalPath } from '../tauri-bridge.js';

interface FileTableProps {
  files: LibraryFile[];
  trKey: (key: string, vars?: Record<string, string | number>) => string;
  selectedPath: string | null;
  onEdit: (file: LibraryFile) => void;
  onDelete: (file: LibraryFile) => void;
}

export function FileTable({
  files,
  trKey,
  selectedPath,
  onEdit,
  onDelete,
}: FileTableProps): JSX.Element {
  const grouped = useMemo(() => groupByFolder(files), [files]);
  // Tất cả folder mặc định mở
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  function toggleFolder(folder: string): void {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(folder)) next.delete(folder);
      else next.add(folder);
      return next;
    });
  }

  if (files.length === 0) {
    return <div className="empty">{trKey('table.empty')}</div>;
  }

  // Sort folder: empty (root) cuối, các folder khác alphabet
  const folderOrder = Array.from(grouped.keys()).sort((a, b) => {
    if (a === '' && b !== '') return 1;
    if (b === '' && a !== '') return -1;
    return a.localeCompare(b, 'vi');
  });

  return (
    <div className="file-table-wrap">
      <table className="file-table">
        <thead>
          <tr>
            <th className="col-id">{trKey('table.col.id')}</th>
            <th className="col-name">{trKey('table.col.file_name')}</th>
            <th className="col-title">{trKey('table.col.doc_title')}</th>
            <th className="col-size">{trKey('table.col.size')}</th>
            <th className="col-type">{trKey('table.col.type')}</th>
            <th className="col-links">{trKey('table.col.links')}</th>
            <th className="col-actions" />
          </tr>
        </thead>
        <tbody>
          {folderOrder.map((folder) => {
            const folderFiles = grouped.get(folder) ?? [];
            const isCollapsed = collapsed.has(folder);
            const folderLabel = folder || trKey('sidebar.no_folder');
            return (
              <FolderGroup
                key={folder || '__root__'}
                folder={folder}
                folderLabel={folderLabel}
                files={folderFiles}
                collapsed={isCollapsed}
                selectedPath={selectedPath}
                onToggle={() => toggleFolder(folder)}
                trKey={trKey}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

interface FolderGroupProps {
  folder: string;
  folderLabel: string;
  files: LibraryFile[];
  collapsed: boolean;
  selectedPath: string | null;
  onToggle: () => void;
  trKey: (key: string, vars?: Record<string, string | number>) => string;
  onEdit: (file: LibraryFile) => void;
  onDelete: (file: LibraryFile) => void;
}

function FolderGroup({
  folderLabel,
  files,
  collapsed,
  selectedPath,
  onToggle,
  trKey,
  onEdit,
  onDelete,
}: FolderGroupProps): JSX.Element {
  return (
    <>
      <tr className="folder-row" onClick={onToggle}>
        <td colSpan={7} className="folder-head">
          <span className="folder-toggle">{collapsed ? '▶' : '▼'}</span>
          <span className="folder-icon">📁</span>
          <strong>{folderLabel}</strong>
          <span className="muted small">
            · {trKey('folder.count_files', { n: files.length })}
          </span>
        </td>
      </tr>
      {!collapsed &&
        files.map((f) => (
          <FileRow
            key={f.id}
            file={f}
            isSelected={f.path === selectedPath}
            trKey={trKey}
            onEdit={() => onEdit(f)}
            onDelete={() => onDelete(f)}
          />
        ))}
    </>
  );
}

interface FileRowProps {
  file: LibraryFile;
  isSelected: boolean;
  trKey: (key: string, vars?: Record<string, string | number>) => string;
  onEdit: () => void;
  onDelete: () => void;
}

function FileRow({
  file,
  isSelected,
  trKey,
  onEdit,
  onDelete,
}: FileRowProps): JSX.Element {
  function copyId(e: React.MouseEvent): void {
    e.stopPropagation();
    void navigator.clipboard?.writeText(file.id);
  }

  return (
    <tr
      className={'file-row ' + (isSelected ? 'file-row-selected' : '')}
      onClick={onEdit}
    >
      <td className="col-id">
        <code className="file-id" onClick={copyId} title={trKey('table.row.copy_id')}>
          {file.id}
        </code>
      </td>
      <td className="col-name" title={file.file_name}>
        {file.file_name || '—'}
      </td>
      <td className="col-title" title={file.doc_title}>
        <strong>{file.doc_title || '—'}</strong>
      </td>
      <td className="col-size">{formatBytes(file.size_bytes)}</td>
      <td className="col-type">
        <span className="file-type-chip">{trKey(`type.${file.file_type}`)}</span>
      </td>
      <td className="col-links">
        <span className="link-count" title="Số link tải + QR">
          🔗 {file.links.length}
        </span>
      </td>
      <td className="col-actions">
        <button
          type="button"
          className="row-btn row-btn-primary"
          onClick={(e) => {
            e.stopPropagation();
            void openLocalPath(file.path);
          }}
          title={trKey('table.row.open_file')}
        >
          📂
        </button>
        <button
          type="button"
          className="row-btn"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          title={trKey('table.row.delete')}
        >
          🗑
        </button>
      </td>
    </tr>
  );
}
