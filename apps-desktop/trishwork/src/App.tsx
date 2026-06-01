/**
 * TrishWork - root App component.
 *
 * Layout (Wave 45.x redesign):
 *   <AuthGate> → <WorkShell groups={} features={}>
 *     Home = Dashboard nhóm 3 module; click panel → mở sub-feature trong tab
 *     (module render với hideNav → không sidebar). Ctrl+K = command palette.
 *
 * Module migrate từ app cũ:
 *   - 44.3.1 trishdesign  -> modules/design
 *   - 44.3.2 trishlibrary -> modules/library  (backend port Wave 44.3.B)
 *   - 44.3.3 trishiso     -> modules/iso
 */

import { useEffect, useMemo, useState } from 'react';
import {
  applyAppAccent,
  applyTheme,
  loadTheme,
  NotificationCenter,
} from '@trishteam/design-system';
import { AuthGate, AppTopbar, useAuth } from '@trishteam/auth/react';
import { getFirebaseDb } from '@trishteam/auth';
import {
  PencilRuler,
  Library as LibraryIcon,
  ClipboardCheck,
  LayoutDashboard,
  FolderArchive,
  Construction,
  TrafficCone,
  Waves,
  Bot,
  ScanLine,
  Puzzle,
  Building2,
  Calculator,
  Globe,
  FolderOpen,
  NotebookPen,
  FileText,
  Image as ImageIcon,
  Cloud,
  PackageCheck,
  CalendarDays,
  UserCheck,
  Archive,
  FileCheck2,
  CheckCircle2,
  ClipboardList,
  FileSpreadsheet,
  Database,
  BarChart3,
} from 'lucide-react';
import { WorkSettingsModal } from './components/WorkSettingsModal.js';
import {
  WorkShell,
  type WorkGroup,
  type WorkFeature,
} from './components/WorkShell.js';
import { DesignModule } from './modules/design/DesignModule.js';
import { LibraryModule } from './modules/library/LibraryModule.js';
import { IsoModule } from './modules/iso/IsoModule.js';

const APP_VERSION = '1.0.0';
const THEME_KEY = 'trishwork.theme';
const ISZ = 46;

function TopbarBell(): JSX.Element {
  const { firebaseUser } = useAuth();
  return (
    <NotificationCenter
      db={getFirebaseDb()}
      currentUid={firebaseUser?.uid ?? null}
      appHint="work"
    />
  );
}

const GROUPS: WorkGroup[] = [
  { id: 'design', label: 'Khảo sát · Thiết kế', accent: '#34D399', icon: <PencilRuler size={18} /> },
  { id: 'library', label: 'Thư viện', accent: '#38BDF8', icon: <LibraryIcon size={18} /> },
  { id: 'iso', label: 'Hồ sơ ISO', accent: '#FBBF24', icon: <ClipboardCheck size={18} /> },
];

export function App(): JSX.Element {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const t = loadTheme(THEME_KEY);
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', t);
    }
    return t;
  });
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    applyTheme(theme, THEME_KEY);
  }, [theme]);
  useEffect(() => {
    applyAppAccent('work');
  }, []);

  const features = useMemo<WorkFeature[]>(
    () => [
      // ---- Khảo sát · Thiết kế ----
      { id: 'design:dashboard', groupId: 'design', label: 'Dashboard & Dự án', icon: <LayoutDashboard size={ISZ} />, keywords: 'du an project', render: () => <DesignModule initialPanel="dashboard" hideNav /> },
      { id: 'design:roaddamage', groupId: 'design', label: 'Vẽ hư hỏng mặt đường', icon: <Construction size={ISZ} />, keywords: 'autocad hu hong mat duong', render: () => <DesignModule initialPanel="roaddamage" hideNav /> },
      { id: 'design:atgt', groupId: 'design', label: 'Vẽ hiện trạng ATGT', icon: <TrafficCone size={ISZ} />, keywords: 'an toan giao thong', render: () => <DesignModule initialPanel="atgt" hideNav /> },
      { id: 'design:cross_section', groupId: 'design', label: 'Vẽ mặt cắt hốt sạt', icon: <Waves size={ISZ} />, keywords: 'bao lu sat lo mat cat', render: () => <DesignModule initialPanel="cross_section" hideNav /> },
      { id: 'design:chatbot', groupId: 'design', label: 'Chatbot AutoCAD', icon: <Bot size={ISZ} />, keywords: 'ai chat lisp', render: () => <DesignModule initialPanel="chatbot" hideNav /> },
      { id: 'design:survey', groupId: 'design', label: 'Khảo sát (OCR)', icon: <ScanLine size={ISZ} />, keywords: 'ocr quet', render: () => <DesignModule initialPanel="survey" hideNav /> },
      { id: 'design:autolisp', groupId: 'design', label: 'Quản lý Autolisp', icon: <Puzzle size={ISZ} />, keywords: 'lisp lsp', render: () => <DesignModule initialPanel="autolisp" hideNav /> },
      { id: 'design:structural', groupId: 'design', label: 'Bảng tính kết cấu', icon: <Building2 size={ISZ} />, keywords: 'ket cau', render: () => <DesignModule initialPanel="structural" hideNav /> },
      { id: 'design:estimate', groupId: 'design', label: 'Dự toán', icon: <Calculator size={ISZ} />, keywords: 'du toan chi phi', render: () => <DesignModule initialPanel="estimate" hideNav /> },
      { id: 'design:gismap', groupId: 'design', label: 'GIS – MAP', icon: <Globe size={ISZ} />, keywords: 'ban do vn2000', render: () => <DesignModule initialPanel="gismap" hideNav /> },
      { id: 'design:documents', groupId: 'design', label: 'Mẫu hồ sơ', icon: <FolderArchive size={ISZ} />, keywords: 'mau ho so template', render: () => <DesignModule initialPanel="documents" hideNav /> },

      // ---- Thư viện ----
      { id: 'library:library', groupId: 'library', label: 'Thư viện', icon: <FolderOpen size={ISZ} />, keywords: 'tai lieu thu vien', render: () => <LibraryModule initialPanel="library" hideNav /> },
      { id: 'library:note', groupId: 'library', label: 'Ghi chú', icon: <NotebookPen size={ISZ} />, keywords: 'note ghi chu', render: () => <LibraryModule initialPanel="note" hideNav /> },
      { id: 'library:document', groupId: 'library', label: 'Tài liệu · PDF', icon: <FileText size={ISZ} />, keywords: 'pdf convert soan thao', render: () => <LibraryModule initialPanel="document" hideNav /> },
      { id: 'library:image', groupId: 'library', label: 'Ảnh', icon: <ImageIcon size={ISZ} />, keywords: 'anh image exif', render: () => <LibraryModule initialPanel="image" hideNav /> },
      { id: 'library:trishteam', groupId: 'library', label: 'Thư viện TrishTEAM', icon: <Cloud size={ISZ} />, keywords: 'cloud chung', render: () => <LibraryModule initialPanel="trishteam" hideNav /> },

      // ---- Hồ sơ ISO ----
      { id: 'iso:dashboard', groupId: 'iso', label: 'Tổng quan', icon: <LayoutDashboard size={ISZ} />, keywords: 'tong quan', render: () => <IsoModule initialPage="dashboard" hideNav /> },
      { id: 'iso:projects', groupId: 'iso', label: 'Hồ sơ tổng quát', icon: <FolderOpen size={ISZ} />, keywords: 'ho so', render: () => <IsoModule initialPage="projects" hideNav /> },
      { id: 'iso:equipment', groupId: 'iso', label: 'Thiết bị nội bộ', icon: <PackageCheck size={ISZ} />, keywords: 'thiet bi', render: () => <IsoModule initialPage="equipment" hideNav /> },
      { id: 'iso:calendar', groupId: 'iso', label: 'Lịch bảo trì', icon: <CalendarDays size={ISZ} />, keywords: 'lich bao tri hieu chuan', render: () => <IsoModule initialPage="calendar" hideNav /> },
      { id: 'iso:loans', groupId: 'iso', label: 'Mượn/trả hồ sơ', icon: <UserCheck size={ISZ} />, keywords: 'muon tra', render: () => <IsoModule initialPage="loans" hideNav /> },
      { id: 'iso:isoStorage', groupId: 'iso', label: 'Lưu trữ ISO', icon: <Archive size={ISZ} />, keywords: 'luu tru', render: () => <IsoModule initialPage="isoStorage" hideNav /> },
      { id: 'iso:formLinks', groupId: 'iso', label: 'Liên kết BM-HS', icon: <FileCheck2 size={ISZ} />, keywords: 'bieu mau ho so', render: () => <IsoModule initialPage="formLinks" hideNav /> },
      { id: 'iso:approvals', groupId: 'iso', label: 'Duyệt hồ sơ', icon: <CheckCircle2 size={ISZ} />, keywords: 'duyet phe duyet', render: () => <IsoModule initialPage="approvals" hideNav /> },
      { id: 'iso:hoanCong', groupId: 'iso', label: 'Checklist hoàn công', icon: <ClipboardList size={ISZ} />, keywords: 'hoan cong checklist', render: () => <IsoModule initialPage="hoanCong" hideNav /> },
      { id: 'iso:imports', groupId: 'iso', label: 'Nhập Excel', icon: <FileSpreadsheet size={ISZ} />, keywords: 'import excel csv', render: () => <IsoModule initialPage="imports" hideNav /> },
      { id: 'iso:templates', groupId: 'iso', label: 'Mẫu mục lục', icon: <ClipboardList size={ISZ} />, keywords: 'muc luc template', render: () => <IsoModule initialPage="templates" hideNav /> },
      { id: 'iso:storage', groupId: 'iso', label: 'Kho lưu trữ', icon: <Database size={ISZ} />, keywords: 'kho file', render: () => <IsoModule initialPage="storage" hideNav /> },
      { id: 'iso:reports', groupId: 'iso', label: 'Báo cáo', icon: <BarChart3 size={ISZ} />, keywords: 'bao cao report', render: () => <IsoModule initialPage="reports" hideNav /> },
    ],
    [],
  );

  return (
    <AuthGate
      appId="trishwork"
      appShellId="work"
      appName="TrishWork"
      appTagline="Kỹ sư · Thư viện · ISO"
    >
      <WorkShell
        appId="work"
        appName="TrishWork"
        version={APP_VERSION}
        groups={GROUPS}
        features={features}
        theme={theme}
        topbarRight={
          <AppTopbar
            extras={<TopbarBell />}
            theme={theme}
            onThemeToggle={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
            onSettings={() => setShowSettings(true)}
          />
        }
      />
      {showSettings && (
        <WorkSettingsModal
          version={APP_VERSION}
          theme={theme}
          onThemeChange={setTheme}
          onClose={() => setShowSettings(false)}
        />
      )}
    </AuthGate>
  );
}
