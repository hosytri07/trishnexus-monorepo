/**
 * Phase 15.2.r9 — FolderTree: hiện folder con dạng cây giống Explorer.
 *
 * Input: Map<folderPath, count> với folderPath dạng "TCVN/Bê tông cốt thép".
 * Output: tree nested, expand/collapse, click leaf để filter.
 */

import { useMemo, useState } from 'react';
import type { LibraryFile } from '../types.js';

interface TreeNode {
  /** Tên hiển thị (segment cuối). */
  name: string;
  /** Full path từ root, vd "TCVN/Bê tông". Empty string = root cấp ngoài cùng. */
  fullPath: string;
  /** Số file trực tiếp trong folder này (không tính descendants). */
  directCount: number;
  /** Tổng số file (kể cả descendants). */
  totalCount: number;
  children: TreeNode[];
}

function buildTree(files: LibraryFile[]): TreeNode {
  const root: TreeNode = {
    name: '',
    fullPath: '',
    directCount: 0,
    totalCount: 0,
    children: [],
  };

  for (const f of files) {
    const folder = f.folder.trim();
    if (!folder) {
      root.directCount++;
      root.totalCount++;
      continue;
    }
    // Walk segments
    const segments = folder.split('/').filter(Boolean);
    let curr = root;
    let acc = '';
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i]!;
      acc = acc ? `${acc}/${seg}` : seg;
      let child = curr.children.find((c) => c.name === seg);
      if (!child) {
        child = {
          name: seg,
          fullPath: acc,
          directCount: 0,
          totalCount: 0,
          children: [],
        };
        curr.children.push(child);
      }
      child.totalCount++;
      if (i === segments.length - 1) {
        child.directCount++;
      }
      curr = child;
    }
    root.totalCount++;
  }

  // Sort children alphabet
  function sortRecursive(node: TreeNode): void {
    node.children.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
    for (const c of node.children) sortRecursive(c);
  }
  sortRecursive(root);

  return root;
}

interface FolderTreeProps {
  files: LibraryFile[];
  selectedFolder: string | null;
  libraryName: string;
  hasRoot: boolean;
  trKey: (key: string, vars?: Record<string, string | number>) => string;
  onSelectFolder: (folder: string | null) => void;
  onRenameLibrary: (next: string) => void;
  onResetLibrary: () => void;
}

export function FolderTree({
  files,
  selectedFolder,
  libraryName,
  hasRoot,
  trKey,
  onSelectFolder,
  onRenameLibrary,
  onResetLibrary,
}: FolderTreeProps): JSX.Element {
  const tree = useMemo(() => buildTree(files), [files]);
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const init = new Set<string>();
    init.add('');
    return init;
  });
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState(libraryName);

  function commitRename(): void {
    const next = draftName.trim();
    if (next && next !== libraryName) onRenameLibrary(next);
    setEditingName(false);
  }
  function cancelRename(): void {
    setDraftName(libraryName);
    setEditingName(false);
  }

  function toggle(path: string): void {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  return (
    <div className="folder-tree">
      {/* Library name (root) — inline rename + reset actions */}
      <div
        className={
          'tree-node tree-all tree-library-root ' +
          (selectedFolder === null ? 'active' : '')
        }
      >
        <span className="tree-toggle-spacer" />
        <span className="tree-icon">📚</span>
        {editingName ? (
          <input
            className="tree-rename-input"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename();
              else if (e.key === 'Escape') cancelRename();
            }}
            autoFocus
            maxLength={100}
          />
        ) : (
          <button
            type="button"
            className="tree-label-btn"
            onClick={() => onSelectFolder(null)}
            title={libraryName}
          >
            <span className="tree-label">{libraryName}</span>
            <span className="tree-count">{tree.totalCount}</span>
          </button>
        )}
        {!editingName && (
          <span className="tree-actions">
            <button
              type="button"
              className="tree-action-btn"
              onClick={(e) => {
                e.stopPropagation();
                setDraftName(libraryName);
                setEditingName(true);
              }}
              title={trKey('sidebar.library_rename')}
            >
              ✏
            </button>
            {hasRoot && (
              <button
                type="button"
                className="tree-action-btn tree-action-danger"
                onClick={(e) => {
                  e.stopPropagation();
                  onResetLibrary();
                }}
                title={trKey('sidebar.library_reset')}
              >
                ↻
              </button>
            )}
          </span>
        )}
      </div>

      {tree.directCount > 0 && (
        <button
          type="button"
          className={
            'tree-node ' + (selectedFolder === '' ? 'active' : '')
          }
          onClick={() => onSelectFolder('')}
        >
          <span className="tree-toggle-spacer" />
          <span className="tree-icon">📄</span>
          <span className="tree-label">{trKey('sidebar.no_folder')}</span>
          <span className="tree-count">{tree.directCount}</span>
        </button>
      )}

      {tree.children.map((child) => (
        <TreeNodeView
          key={child.fullPath}
          node={child}
          depth={0}
          selectedFolder={selectedFolder}
          expanded={expanded}
          onToggle={toggle}
          onSelect={onSelectFolder}
        />
      ))}
    </div>
  );
}

interface TreeNodeViewProps {
  node: TreeNode;
  depth: number;
  selectedFolder: string | null;
  expanded: Set<string>;
  onToggle: (path: string) => void;
  onSelect: (path: string) => void;
}

function TreeNodeView({
  node,
  depth,
  selectedFolder,
  expanded,
  onToggle,
  onSelect,
}: TreeNodeViewProps): JSX.Element {
  const isOpen = expanded.has(node.fullPath);
  const hasChildren = node.children.length > 0;
  const isActive = selectedFolder === node.fullPath;

  return (
    <>
      <div
        className={'tree-node ' + (isActive ? 'active' : '')}
        style={{ paddingLeft: 8 + depth * 14 }}
      >
        {hasChildren ? (
          <button
            type="button"
            className="tree-toggle"
            onClick={(e) => {
              e.stopPropagation();
              onToggle(node.fullPath);
            }}
            aria-label={isOpen ? 'Thu gọn' : 'Mở rộng'}
          >
            {isOpen ? '▼' : '▶'}
          </button>
        ) : (
          <span className="tree-toggle-spacer" />
        )}
        <button
          type="button"
          className="tree-label-btn"
          onClick={() => onSelect(node.fullPath)}
        >
          <span className="tree-icon">{hasChildren ? '📁' : '📄'}</span>
          <span className="tree-label" title={node.fullPath}>
            {node.name}
          </span>
          <span className="tree-count">{node.totalCount}</span>
        </button>
      </div>
      {hasChildren && isOpen && (
        <>
          {node.children.map((child) => (
            <TreeNodeView
              key={child.fullPath}
              node={child}
              depth={depth + 1}
              selectedFolder={selectedFolder}
              expanded={expanded}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
        </>
      )}
    </>
  );
}
