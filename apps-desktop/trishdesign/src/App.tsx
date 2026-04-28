/**
 * TrishDesign — App Shell.
 *
 * Phase 14.4.7 · v2.0.0-alpha — Bộ công cụ Khảo sát & Thiết kế.
 * Sidebar 11 module + UserPanel + Cài đặt.
 */

import { useEffect, useMemo, useState } from 'react';
import logoUrl from './assets/logo.png';
import { UserPanel } from './components/UserPanel.js';
import { DashboardPanel } from './modules/engineer/DashboardPanel.js';
import { DocumentsPanel } from './modules/engineer/DocumentsPanel.js';
import { RoadDamagePanel } from './modules/engineer/RoadDamagePanel.js';
import { TrafficSafetyPanel } from './modules/engineer/TrafficSafetyPanel.js';
import { SurveyPanel } from './modules/engineer/SurveyPanel.js';
import { AutoLispPanel } from './modules/engineer/AutoLispPanel.js';
import { StructuralPanel } from './modules/engineer/StructuralPanel.js';
import { EstimatePanel } from './modules/engineer/EstimatePanel.js';
import { GISMapPanel } from './modules/engineer/GISMapPanel.js';
import { ChatbotPanel } from './modules/engineer/ChatbotPanel.js';
import { SettingsPanel } from './modules/engineer/SettingsPanel.js';

type ModuleId =
  | 'dashboard'
  | 'documents'
  | 'roaddamage'
  | 'atgt'
  | 'survey'
  | 'autolisp'
  | 'structural'
  | 'estimate'
  | 'gismap'
  | 'chatbot'
  | 'settings';

interface NavItem {
  id: ModuleId;
  icon: string;
  label: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', icon: '🏠', label: 'Dashboard & Dự án' },
  { id: 'documents', icon: '📂', label: 'Danh mục hồ sơ' },
  { id: 'roaddamage', icon: '🛣', label: 'Hư hỏng mặt đường' },
  { id: 'atgt', icon: '🚦', label: 'An toàn giao thông' },
  { id: 'survey', icon: '🔍', label: 'Khảo sát (OCR)' },
  { id: 'autolisp', icon: '🧩', label: 'Quản lý Autolisp' },
  { id: 'structural', icon: '🏗', label: 'Bảng tính kết cấu' },
  { id: 'estimate', icon: '💰', label: 'Dự toán' },
  { id: 'gismap', icon: '🌐', label: 'GIS – MAP' },
  { id: 'chatbot', icon: '🤖', label: 'Chatbot AutoCAD' },
];

const SETTINGS_ITEM: NavItem = { id: 'settings', icon: '⚙', label: 'Cài đặt' };

const STORAGE_KEY = 'trishdesign.active_module';
const COLLAPSE_KEY = 'trishdesign.sidebar_collapsed';

function loadActive(): ModuleId {
  if (typeof window === 'undefined') return 'dashboard';
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    const all = [...NAV_ITEMS, SETTINGS_ITEM];
    if (v && all.some((i) => i.id === v)) return v as ModuleId;
  } catch {
    /* ignore */
  }
  return 'dashboard';
}

function loadCollapsed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(COLLAPSE_KEY) === '1';
  } catch {
    return false;
  }
}

export function App(): JSX.Element {
  const [active, setActive] = useState<ModuleId>(() => loadActive());
  const [collapsed, setCollapsed] = useState<boolean>(() => loadCollapsed());

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, active);
    } catch {
      /* ignore */
    }
  }, [active]);

  useEffect(() => {
    try {
      window.localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  const activeItem = useMemo(
    () => [...NAV_ITEMS, SETTINGS_ITEM].find((i) => i.id === active) ?? NAV_ITEMS[0],
    [active],
  );

  const renderPanel = (): JSX.Element => {
    switch (active) {
      case 'dashboard': return <DashboardPanel />;
      case 'documents': return <DocumentsPanel />;
      case 'roaddamage': return <RoadDamagePanel />;
      case 'atgt': return <TrafficSafetyPanel />;
      case 'survey': return <SurveyPanel />;
      case 'autolisp': return <AutoLispPanel />;
      case 'structural': return <StructuralPanel />;
      case 'estimate': return <EstimatePanel />;
      case 'gismap': return <GISMapPanel />;
      case 'chatbot': return <ChatbotPanel />;
      case 'settings': return <SettingsPanel />;
      default: return <DashboardPanel />;
    }
  };

  return (
    <div className={`td-shell${collapsed ? ' td-shell-collapsed' : ''}`}>
      <aside className="td-sidebar">
        <header className="td-sidebar-head">
          <div className="td-logo-wrap">
            <img src={logoUrl} alt="" className="td-sidebar-logo" />
            {!collapsed && <span className="td-sidebar-name">TrishDesign</span>}
          </div>
          <button
            type="button"
            className="td-collapse-btn"
            onClick={() => setCollapsed((v) => !v)}
            title={collapsed ? 'Mở sidebar' : 'Thu sidebar'}
            aria-label={collapsed ? 'Mở sidebar' : 'Thu sidebar'}
          >
            {collapsed ? '»' : '«'}
          </button>
        </header>

        <nav className="td-nav">
          <div className="td-nav-group">
            {!collapsed && (
              <div className="td-nav-group-label">
                <span>Công cụ Kỹ sư</span>
              </div>
            )}
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`td-nav-item${active === item.id ? ' td-nav-item-active' : ''}`}
                onClick={() => setActive(item.id)}
                title={item.label}
                aria-label={item.label}
              >
                <span className="td-nav-icon">{item.icon}</span>
                {!collapsed && <span className="td-nav-label">{item.label}</span>}
              </button>
            ))}
          </div>

          <div className="td-nav-group">
            {!collapsed && (
              <div className="td-nav-group-label">
                <span>Hệ thống</span>
              </div>
            )}
            <button
              type="button"
              className={`td-nav-item${active === SETTINGS_ITEM.id ? ' td-nav-item-active' : ''}`}
              onClick={() => setActive(SETTINGS_ITEM.id)}
              title={SETTINGS_ITEM.label}
              aria-label={SETTINGS_ITEM.label}
            >
              <span className="td-nav-icon">{SETTINGS_ITEM.icon}</span>
              {!collapsed && <span className="td-nav-label">{SETTINGS_ITEM.label}</span>}
            </button>
          </div>
        </nav>

        <div className="td-sidebar-foot-wrap">
          <UserPanel collapsed={collapsed} />
          {!collapsed && (
            <p className="td-sidebar-foot muted small">v2.0.0-alpha</p>
          )}
        </div>
      </aside>

      <main className="td-main">
        <div className="td-breadcrumb muted small">
          <span>{activeItem.icon}</span>
          <span>·</span>
          <span>{activeItem.label}</span>
        </div>
        {renderPanel()}
      </main>
    </div>
  );
}
