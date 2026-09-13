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

import { lazy, useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
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
  Construction,
  TrafficCone,
  Waves,
  Bot,
  ScanLine,
  Signpost,
  Frame,
  Layers,
  Puzzle,
  Building2,
  Globe,
  FolderOpen,
  NotebookPen,
  FileText,
  FilePen,
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
// Lazy-load 3 module nặng (Wave 45.x) — chỉ tải code khi mở tab feature, để
// màn Home hiện ngay thay vì đợi bundle cả TipTap/OCR/search (~giảm load đầu).
const DesignModule = lazy(() =>
  import('./modules/design/DesignModule.js').then((m) => ({ default: m.DesignModule })),
);
const LibraryModule = lazy(() =>
  import('./modules/library/LibraryModule.js').then((m) => ({ default: m.LibraryModule })),
);
const IsoModule = lazy(() =>
  import('./modules/iso/IsoModule.js').then((m) => ({ default: m.IsoModule })),
);

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

/**
 * Shell con (trong AuthGate) — lọc nhóm theo quyền. Module Hồ sơ ISO chỉ hiện
 * với admin hoặc user có cờ PKTCNĐB; trial/demo không thấy.
 */
function GatedWorkShell({
  features,
  theme,
  onThemeToggle,
  onSettings,
}: {
  features: WorkFeature[];
  theme: 'light' | 'dark';
  onThemeToggle: () => void;
  onSettings: () => void;
}): JSX.Element {
  const { role, profile } = useAuth();
  // Dashboard đã sẵn sàng (qua auth) → ẩn splash khởi động.
  useEffect(() => {
    (window as unknown as { __hideSplash?: () => void }).__hideSplash?.();
  }, []);
  const canViewIso = role === 'admin' || (role === 'user' && profile?.pktcndb === true);
  const groups = canViewIso ? GROUPS : GROUPS.filter((g) => g.id !== 'iso');
  const feats = canViewIso ? features : features.filter((f) => f.groupId !== 'iso');
  return (
    <WorkShell
      appId="work"
      appName="TrishWork"
      version={APP_VERSION}
      groups={groups}
      features={feats}
      theme={theme}
      footerDb={getFirebaseDb()}
      topbarRight={
        <AppTopbar
          extras={<TopbarBell />}
          theme={theme}
          onThemeToggle={onThemeToggle}
          onSettings={onSettings}
        />
      }
    />
  );
}

export function App(): JSX.Element {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const t = loadTheme(THEME_KEY);
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', t);
    }
    return t;
  });
  const [showSettings, setShowSettings] = useState(false);

  // React đã mount → đóng cửa sổ splash native + hiện cửa sổ chính (đang hiển
  // thị in-page splash, sẽ tự ẩn khi dashboard sẵn sàng). Liền mạch, không đen.
  useEffect(() => {
    void invoke('close_splashscreen').catch(() => {});
  }, []);

  useEffect(() => {
    applyTheme(theme, THEME_KEY);
  }, [theme]);
  useEffect(() => {
    applyAppAccent('work');
  }, []);

  const features = useMemo<WorkFeature[]>(
    () => [
      // ---- Khảo sát · Thiết kế ----
      { id: 'design:roaddamage', groupId: 'design', label: 'Vẽ hư hỏng mặt đường', icon: <Construction size={ISZ} />, keywords: 'autocad hu hong mat duong', render: () => <DesignModule initialPanel="roaddamage" hideNav /> },
      { id: 'design:atgt', groupId: 'design', label: 'Vẽ hiện trạng ATGT', icon: <TrafficCone size={ISZ} />, keywords: 'an toan giao thong', render: () => <DesignModule initialPanel="atgt" hideNav /> },
      { id: 'design:cross_section', groupId: 'design', label: 'Vẽ mặt cắt hốt sạt', icon: <Waves size={ISZ} />, keywords: 'bao lu sat lo mat cat', render: () => <DesignModule initialPanel="cross_section" hideNav /> },
      { id: 'design:chatbot', groupId: 'design', label: 'Chatbot AutoCAD', icon: <Bot size={ISZ} />, keywords: 'ai chat lisp', render: () => <DesignModule initialPanel="chatbot" hideNav /> },
      { id: 'design:survey', groupId: 'design', label: 'Tiện ích PDF · Quét sổ hiện trạng', icon: <ScanLine size={ISZ} />, keywords: 'ocr quet pdf convert chuyen doi merge split so hien trang', render: () => <DesignModule initialPanel="survey" hideNav /> },
      { id: 'design:signref', groupId: 'design', label: 'Tra cứu biển báo · vạch', icon: <Signpost size={ISZ} />, keywords: 'bien bao vach son qc 41 2024 tra cuu', render: () => <DesignModule initialPanel="signref" hideNav /> },
      { id: 'design:titleblock', groupId: 'design', label: 'Tạo khung tên bản vẽ', icon: <Frame size={ISZ} />, keywords: 'khung ten ban ve title block dwg', render: () => <DesignModule initialPanel="titleblock" hideNav /> },
      { id: 'design:drawinglib', groupId: 'design', label: 'Thư viện bản vẽ', icon: <Layers size={ISZ} />, keywords: 'thu vien ban ve chi tiet dien hinh mau cong ranh block dwg', render: () => <DesignModule initialPanel="drawinglib" hideNav /> },
      { id: 'design:legaldocs', groupId: 'design', label: 'Thông tư · Văn bản mới', icon: <FileText size={ISZ} />, keywords: 'thong tu van ban quyet dinh nghi dinh tieu chuan quy chuan tcvn qcvn phap luat', render: () => <DesignModule initialPanel="legaldocs" hideNav /> },
      { id: 'design:autolisp', groupId: 'design', label: 'Quản lý Autolisp', icon: <Puzzle size={ISZ} />, keywords: 'lisp lsp', render: () => <DesignModule initialPanel="autolisp" hideNav /> },
      { id: 'design:structural', groupId: 'design', label: 'Bảng tính kết cấu', icon: <Building2 size={ISZ} />, keywords: 'ket cau', comingSoon: true, render: () => <DesignModule initialPanel="structural" hideNav /> },
      { id: 'design:gismap', groupId: 'design', label: 'GIS – MAP', icon: <Globe size={ISZ} />, keywords: 'ban do vn2000', render: () => <DesignModule initialPanel="gismap" hideNav /> },

      // ---- Thư viện ----
      { id: 'library:library', groupId: 'library', label: 'Thư viện', icon: <FolderOpen size={ISZ} />, keywords: 'tai lieu thu vien', render: () => <LibraryModule initialPanel="library" hideNav /> },
      { id: 'library:note', groupId: 'library', label: 'Ghi chú', icon: <NotebookPen size={ISZ} />, keywords: 'note ghi chu', render: () => <LibraryModule initialPanel="note" hideNav /> },
      { id: 'library:doc-edit', groupId: 'library', label: 'Soạn thảo văn bản', icon: <FilePen size={ISZ} />, keywords: 'soan thao editor docx word document', render: () => <LibraryModule initialPanel="document" documentTab="editor" hideNav /> },
      // Tiện ích PDF (convert/merge/split) đã chuyển sang nhóm Khảo sát·Thiết kế → "Tiện ích PDF · Quét sổ hiện trạng" (gộp với OCR).
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
      <GatedWorkShell
        features={features}
        theme={theme}
        onThemeToggle={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
        onSettings={() => setShowSettings(true)}
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
