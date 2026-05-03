/**
 * Scanner — Phase 32.3.A
 *
 * Modal "Quét app từ máy" với 3 tab:
 *   1. Desktop — .lnk + .exe trên Desktop của user + Public Desktop
 *   2. Start Menu — .lnk trong %APPDATA%/Microsoft/Windows/Start Menu/Programs
 *   3. Đã cài — Registry HKLM/HKCU/HKLM-WOW6432 Uninstall keys
 *
 * User tick checkbox → Import batch nhiều shortcut cùng lúc.
 * Mỗi tab có search filter + Select All / Deselect All.
 */

import { useEffect, useMemo, useState } from 'react';
import { X, RefreshCw, Loader2, Check, FolderOpen, Monitor, AppWindow, Search } from 'lucide-react';
import {
  scanDesktop, scanStartMenu, scanInstalledApps, extractIconsBatch,
  type DesktopEntry, type InstalledApp,
} from '../tauri-bridge';
import type { Shortcut, ShortcutGroup, ShortcutType } from '../types';
import { genId } from '../storage';
import { guessCategory } from '../utils/categorize';
import { Toggle } from './Toggle';

type TabId = 'desktop' | 'start' | 'installed';

interface Props {
  groups: ShortcutGroup[];
  onClose: () => void;
  onImport: (shortcuts: Shortcut[]) => void;
}

export function Scanner({ groups, onClose, onImport }: Props): JSX.Element {
  const [tab, setTab] = useState<TabId>('desktop');
  const [desktopEntries, setDesktopEntries] = useState<DesktopEntry[] | null>(null);
  const [startEntries, setStartEntries] = useState<DesktopEntry[] | null>(null);
  const [installedApps, setInstalledApps] = useState<InstalledApp[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [defaultGroup, setDefaultGroup] = useState<ShortcutGroup>(groups[0] ?? 'Apps');
  const [autoCategorize, setAutoCategorize] = useState<boolean>(true);
  const [importing, setImporting] = useState<{ done: number; total: number } | null>(null);

  // Load tab khi tab change (lazy)
  useEffect(() => {
    setSearch('');
    setSelected(new Set());
    void loadTab(tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function loadTab(t: TabId, force = false): Promise<void> {
    setErr(null);
    if (t === 'desktop' && (desktopEntries === null || force)) {
      setLoading(true);
      try {
        setDesktopEntries(await scanDesktop());
      } catch (e) {
        setErr(`Quét Desktop fail: ${(e as Error).message}`);
      } finally {
        setLoading(false);
      }
    } else if (t === 'start' && (startEntries === null || force)) {
      setLoading(true);
      try {
        setStartEntries(await scanStartMenu());
      } catch (e) {
        setErr(`Quét Start Menu fail: ${(e as Error).message}`);
      } finally {
        setLoading(false);
      }
    } else if (t === 'installed' && (installedApps === null || force)) {
      setLoading(true);
      try {
        setInstalledApps(await scanInstalledApps());
      } catch (e) {
        setErr(`Quét app cài fail: ${(e as Error).message}`);
      } finally {
        setLoading(false);
      }
    }
  }

  function toggle(id: string): void {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  function selectAll(ids: string[]): void {
    setSelected(new Set(ids));
  }

  function deselectAll(): void {
    setSelected(new Set());
  }

  async function importSelected(): Promise<void> {
    const now = Date.now();
    const created: Shortcut[] = [];
    const groupChoice = defaultGroup;

    // Phase 32.4.B — auto-categorize: dùng guessCategory(name, target) thay vì
    // gán cứng defaultGroup. User vẫn có thể override sau khi import qua Edit.
    function pickGroup(name: string, target: string): ShortcutGroup {
      if (!autoCategorize) return groupChoice;
      return guessCategory(name, target, groups, groupChoice);
    }

    if (tab === 'desktop' || tab === 'start') {
      const list = tab === 'desktop' ? desktopEntries : startEntries;
      if (!list) return;
      list.forEach((e) => {
        if (!selected.has(e.sourcePath)) return;
        const target = e.target ?? e.sourcePath;
        const ext = (target.match(/\.([a-z]+)$/i)?.[1] ?? '').toLowerCase();
        let type: ShortcutType = 'app';
        if (ext === 'exe' || ext === 'lnk' || ext === 'bat' || ext === 'cmd') type = 'app';
        else if (ext === '') type = 'folder';
        else type = 'file';
        created.push({
          id: genId('sc'),
          name: e.name,
          type,
          target,
          working_dir: e.workingDir ?? undefined,
          args: e.args ?? undefined,
          group: pickGroup(e.name, target),
          click_count: 0,
          created_at: now,
          updated_at: now,
        });
      });
    } else if (tab === 'installed' && installedApps) {
      installedApps.forEach((a) => {
        if (!selected.has(a.name)) return;
        const exeFromIcon = a.iconPath
          ? a.iconPath.replace(/,-?\d+$/, '').replace(/^"(.*)"$/, '$1')
          : null;
        const target = exeFromIcon || a.installLocation || '';
        if (!target) return;
        created.push({
          id: genId('sc'),
          name: a.name,
          type: 'app',
          target,
          working_dir: a.installLocation ?? undefined,
          group: pickGroup(a.name, target),
          click_count: 0,
          created_at: now,
          updated_at: now,
          notes: a.publisher ? `${a.publisher}${a.version ? ' · ' + a.version : ''}` : undefined,
        });
      });
    }

    if (created.length === 0) {
      onClose();
      return;
    }

    // Phase 32.3.B — auto extract icons cho shortcut type=app/game/file
    setImporting({ done: 0, total: created.length });
    const exePaths = created
      .filter((s) => s.type === 'app' || s.type === 'game' || s.type === 'file')
      .map((s) => s.target);
    const iconMap = await extractIconsBatch(exePaths);

    const withIcons = created.map((s) => ({
      ...s,
      icon_path: iconMap.get(s.target) ?? s.icon_path,
    }));
    setImporting(null);
    onImport(withIcons);
    onClose();
  }

  // Filter list theo search
  const filteredDesktop = useMemo(() => {
    if (!desktopEntries) return [];
    const q = search.trim().toLowerCase();
    if (!q) return desktopEntries;
    return desktopEntries.filter((e) => e.name.toLowerCase().includes(q));
  }, [desktopEntries, search]);

  const filteredStart = useMemo(() => {
    if (!startEntries) return [];
    const q = search.trim().toLowerCase();
    if (!q) return startEntries;
    return startEntries.filter((e) => e.name.toLowerCase().includes(q));
  }, [startEntries, search]);

  const filteredInstalled = useMemo(() => {
    if (!installedApps) return [];
    const q = search.trim().toLowerCase();
    if (!q) return installedApps;
    return installedApps.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.publisher?.toLowerCase().includes(q),
    );
  }, [installedApps, search]);

  const currentList: { id: string; primary: string; secondary: string }[] =
    tab === 'desktop'
      ? filteredDesktop.map((e) => ({
          id: e.sourcePath,
          primary: e.name,
          secondary: e.target ?? e.sourcePath,
        }))
      : tab === 'start'
        ? filteredStart.map((e) => ({
            id: e.sourcePath,
            primary: e.name,
            secondary: e.target ?? e.sourcePath,
          }))
        : filteredInstalled.map((a) => ({
            id: a.name,
            primary: a.name,
            secondary: `${a.publisher ?? '—'}${a.version ? ' · v' + a.version : ''}`,
          }));

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15,14,12,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 100, padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          maxWidth: 720, width: '100%', maxHeight: '90vh',
          display: 'flex', flexDirection: 'column',
          background: 'var(--color-surface-card)',
          border: '1px solid var(--color-border-subtle)',
          borderRadius: 14,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: 18, borderBottom: '1px solid var(--color-border-subtle)' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Quét app từ máy</h2>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--color-text-muted)' }}>
              Chọn app/shortcut có sẵn trên máy để import nhanh, không cần thêm thủ công.
            </p>
          </div>
          <button className="btn btn-secondary btn-icon" onClick={onClose}><X size={14} /></button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, padding: '0 18px', borderBottom: '1px solid var(--color-border-subtle)' }}>
          <TabBtn icon={<Monitor size={14} />} label="Desktop" count={desktopEntries?.length} active={tab === 'desktop'} onClick={() => setTab('desktop')} />
          <TabBtn icon={<FolderOpen size={14} />} label="Start Menu" count={startEntries?.length} active={tab === 'start'} onClick={() => setTab('start')} />
          <TabBtn icon={<AppWindow size={14} />} label="Đã cài" count={installedApps?.length} active={tab === 'installed'} onClick={() => setTab('installed')} />
        </div>

        {/* Toolbar */}
        <div style={{ display: 'flex', gap: 8, padding: 12, alignItems: 'center', borderBottom: '1px solid var(--color-border-subtle)' }}>
          <div className="search-bar" style={{ flex: 1, width: 'auto' }}>
            <Search size={14} style={{ color: 'var(--color-text-muted)' }} />
            <input
              type="text"
              placeholder="Lọc theo tên..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            className="btn btn-secondary btn-icon"
            onClick={() => void loadTab(tab, true)}
            title="Quét lại"
          >
            <RefreshCw size={14} />
          </button>
          <select
            value={defaultGroup}
            onChange={(e) => setDefaultGroup(e.target.value)}
            className="input-field"
            style={{ width: 140, padding: '8px 10px' }}
            title={autoCategorize ? 'Nhóm fallback nếu không tự nhận diện được' : 'Nhóm cho tất cả mục import'}
            disabled={false}
          >
            {groups.map((g) => (
              <option key={g} value={g}>→ {g}</option>
            ))}
          </select>
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 10px',
              background: autoCategorize ? 'var(--color-accent-soft)' : 'var(--color-surface-row)',
              border: `1px solid ${autoCategorize ? 'var(--color-accent-primary)' : 'var(--color-border-default)'}`,
              borderRadius: 8,
              fontSize: 12,
              color: autoCategorize ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)',
              fontWeight: autoCategorize ? 600 : 400,
              whiteSpace: 'nowrap',
            }}
            title="Tự đoán nhóm theo tên app (Dev/Office/Game/Web/...)"
          >
            <Toggle checked={autoCategorize} onChange={setAutoCategorize} size="sm" />
            <span>Tự phân nhóm</span>
          </div>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '6px 12px' }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 60, color: 'var(--color-text-muted)', gap: 10 }}>
              <Loader2 size={28} className="spin" />
              <div style={{ fontSize: 13 }}>Đang quét...</div>
            </div>
          ) : err ? (
            <div style={{ padding: 14, color: '#dc2626', fontSize: 13 }}>{err}</div>
          ) : currentList.length === 0 ? (
            <div style={{ padding: 60, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
              {search ? 'Không có mục nào khớp filter' : 'Không tìm thấy mục nào ở vị trí này'}
            </div>
          ) : (
            <div>
              {/* Select all bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 4px', fontSize: 12, color: 'var(--color-text-muted)' }}>
                <span>Đã chọn: <b>{selected.size}</b> / {currentList.length}</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    style={{ background: 'none', border: 'none', color: 'var(--color-accent-primary)', fontSize: 12, cursor: 'pointer' }}
                    onClick={() => selectAll(currentList.map((i) => i.id))}
                  >
                    Chọn tất cả
                  </button>
                  <span style={{ color: 'var(--color-border-default)' }}>|</span>
                  <button
                    style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', fontSize: 12, cursor: 'pointer' }}
                    onClick={deselectAll}
                  >
                    Bỏ chọn
                  </button>
                </div>
              </div>

              {/* Items */}
              {currentList.map((item) => {
                const isSelected = selected.has(item.id);
                return (
                  <div
                    key={item.id}
                    onClick={() => toggle(item.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 12px',
                      borderRadius: 8,
                      cursor: 'pointer',
                      background: isSelected ? 'var(--color-accent-soft)' : 'transparent',
                      transition: 'background 100ms',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.background = 'var(--color-surface-hover)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <div
                      style={{
                        width: 18, height: 18, flexShrink: 0,
                        border: `2px solid ${isSelected ? 'var(--color-accent-primary)' : 'var(--color-border-default)'}`,
                        borderRadius: 4,
                        background: isSelected ? 'var(--color-accent-primary)' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      {isSelected && <Check size={12} color="#fff" />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.primary}
                      </div>
                      <div
                        style={{ fontSize: 11, color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        title={item.secondary}
                      >
                        {item.secondary}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderTop: '1px solid var(--color-border-subtle)' }}>
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
            {selected.size > 0 ? `Sẽ import ${selected.size} mục vào nhóm "${defaultGroup}"` : 'Tick checkbox để chọn'}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" onClick={onClose} disabled={importing !== null}>Huỷ</button>
            <button
              className="btn btn-primary"
              onClick={() => void importSelected()}
              disabled={selected.size === 0 || importing !== null}
            >
              {importing ? (
                <>
                  <Loader2 size={14} className="spin" /> Đang lấy icon ({importing.done}/{importing.total})
                </>
              ) : (
                <>
                  <Check size={14} /> Import {selected.size > 0 ? `(${selected.size})` : ''}
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

function TabBtn({
  icon, label, count, active, onClick,
}: { icon: React.ReactNode; label: string; count?: number; active: boolean; onClick: () => void }): JSX.Element {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '12px 16px',
        background: 'transparent',
        border: 'none',
        borderBottom: active ? '2px solid var(--color-accent-primary)' : '2px solid transparent',
        marginBottom: -1,
        color: active ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)',
        fontSize: 13,
        fontWeight: active ? 600 : 500,
        cursor: 'pointer',
      }}
    >
      {icon}
      {label}
      {count !== undefined && (
        <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>({count})</span>
      )}
    </button>
  );
}
