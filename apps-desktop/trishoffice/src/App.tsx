/**
 * TrishOffice — App shell HRM/ERP-light cho công ty (Phase 38.7 — RBAC).
 *
 * Auth flow:
 *   1. KeyGate (Firebase account + key activation — đã ở main.tsx)
 *   2. needsBootstrap (chưa có user nào) → SetupAdminPage
 *   3. !currentUser (đã có user nhưng chưa login) → LoginPage
 *   4. currentUser → app shell với role-aware NAV
 *
 * 10 module:
 *   1-7. Dashboard, Nhân sự, Chấm công, Tài sản, Workflow, Tài liệu, Kế toán
 *   8. Người dùng (Admin IT + Owner)
 *   9. Phòng ban (Admin IT + manage)
 *  10. Cài đặt cá nhân (mọi role)
 */

import { useEffect, useRef, useState } from 'react';
import { useAuth as useEcosystemAuth } from '@trishteam/auth/react';
import { useAuth } from './auth/AuthContext';
import { canSeeModule } from './auth/permissions';
import { ROLES } from './auth/types';
import { LoginPage } from './auth/LoginPage';
import { NoPermissionPage } from './auth/NoPermissionPage';
import { FirebaseLoginPage } from './auth/FirebaseLoginPage';
import { Header } from './components/Header';
import { EmployeesPage } from './pages/EmployeesPage';
import { AttendancePage } from './pages/AttendancePage';
import { AssetsPage } from './pages/AssetsPage';
import { WorkflowsPage } from './pages/WorkflowsPage';
import { DocumentsPage } from './pages/DocumentsPage';
import { AccountingPage } from './pages/AccountingPage';
import { CalendarPage } from './pages/CalendarPage';
import { ReportsPage } from './pages/ReportsPage';
import { ImportExportPage } from './pages/ImportExportPage';
import { UsersPage } from './pages/UsersPage';
import { DepartmentsPage } from './pages/DepartmentsPage';
import { SettingsPage } from './pages/SettingsPage';
import { useCollection, today } from './storage';
import type { ModuleKey } from './auth/types';
import type {
  Employee,
  AttendanceEntry,
  Asset,
  WorkflowRequest,
  CompanyDocument,
  PayrollEntry,
} from './types';
import type { DepartmentInfo } from './auth/types';

const THEME_KEY = 'trishoffice:theme';

interface NavItem {
  key: ModuleKey;
  emoji: string;
  label: string;
  desc: string;
  /** Chia thành group nav */
  group: 'main' | 'admin' | 'self';
}

const NAV: NavItem[] = [
  // Main 7 modules
  {
    key: 'dashboard',
    emoji: '📊',
    label: 'Dashboard',
    desc: 'Tổng quan: KPI · pending workflows',
    group: 'main',
  },
  {
    key: 'employees',
    emoji: '👥',
    label: 'Nhân sự',
    desc: 'Hồ sơ nhân viên + hợp đồng + lương + BHXH',
    group: 'main',
  },
  {
    key: 'attendance',
    emoji: '📅',
    label: 'Chấm công',
    desc: 'Manual nhập giờ vào/ra · OT · ngày nghỉ',
    group: 'main',
  },
  {
    key: 'assets',
    emoji: '🏢',
    label: 'Tài sản',
    desc: 'Laptop · máy in · xe · cấp phát + thu hồi',
    group: 'main',
  },
  {
    key: 'workflows',
    emoji: '📋',
    label: 'Quy trình duyệt',
    desc: 'Yêu cầu mua sắm · xin phép · công tác phí',
    group: 'main',
  },
  {
    key: 'documents',
    emoji: '💼',
    label: 'Tài liệu nội bộ',
    desc: 'Quy định · quy chế · biểu mẫu',
    group: 'main',
  },
  {
    key: 'accounting',
    emoji: '💵',
    label: 'Kế toán',
    desc: 'Bảng lương · thuế TNCN · BHXH',
    group: 'main',
  },
  {
    key: 'calendar',
    emoji: '📅',
    label: 'Lịch',
    desc: 'Lịch nghỉ phép · công tác · sinh nhật',
    group: 'main',
  },
  {
    key: 'reports',
    emoji: '📊',
    label: 'Báo cáo',
    desc: 'P&L · Cash flow · KPI tài chính',
    group: 'main',
  },
  // Admin
  {
    key: 'import_export',
    emoji: '📥',
    label: 'Sao lưu / Nhập xuất',
    desc: 'Backup · restore · Excel import/export',
    group: 'admin',
  },
  {
    key: 'users',
    emoji: '🛡️',
    label: 'Người dùng',
    desc: 'Quản lý account + role + quyền',
    group: 'admin',
  },
  {
    key: 'departments',
    emoji: '🏛️',
    label: 'Phòng ban',
    desc: 'Cơ cấu phòng ban',
    group: 'admin',
  },
  // Self
  {
    key: 'settings',
    emoji: '⚙️',
    label: 'Cài đặt cá nhân',
    desc: 'Đổi password + profile',
    group: 'self',
  },
];

export function App(): JSX.Element {
  const auth = useAuth();
  const ecosystem = useEcosystemAuth();
  const [page, setPage] = useState<ModuleKey>('dashboard');

  // Theme: light/dark đồng bộ với @trishteam/design-system
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      return (window.localStorage.getItem(THEME_KEY) as 'light' | 'dark') || 'light';
    } catch {
      return 'light';
    }
  });
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      window.localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);
  const toggleTheme = (): void => setTheme((t) => (t === 'light' ? 'dark' : 'light'));

  // Phase 38.11 — Ecosystem auto-login (run lại sau mỗi logout).
  //
  // Logic:
  //   1. Có AppUser local nào liên kết firebase_uid của user đang login Firebase → auto sign-in
  //      user đó (kể cả NV thường — admin đã link UID khi tạo account)
  //   2. Không có local match nhưng Firebase user là ecosystem admin → tạo + sign-in admin
  //   3. Không match cả 2 → fall through (LoginPage hoặc NoPermissionPage)
  //
  // Dùng inProgress ref để tránh fire 2 lần đồng thời, KHÔNG block sau khi logout.
  const autoSignInProgress = useRef(false);
  useEffect(() => {
    if (auth.loading || ecosystem.loading) return;
    if (auth.currentUser) return; // đã có session
    if (!ecosystem.firebaseUser) return; // chưa login Firebase
    if (autoSignInProgress.current) return;

    const fbUid = ecosystem.firebaseUser.uid;
    const fbEmail = ecosystem.firebaseUser.email ?? '';
    const allLocal = auth.listUsers();

    // 1. Tìm local user đã link với firebase_uid hoặc email match
    const linked = allLocal.find(
      (u) =>
        u.active &&
        (u.firebase_uid === fbUid ||
          (!!fbEmail && u.email?.toLowerCase() === fbEmail.toLowerCase())),
    );

    if (linked) {
      // Auto login local user
      autoSignInProgress.current = true;
      void auth
        .signInAsEcosystemAdmin({
          // Tái dùng method này vì nó cũng update last_login + update firebase_uid nếu chưa có
          firebase_uid: fbUid,
          email: fbEmail || linked.email || 'user@trishteam',
          display_name: linked.display_name,
        })
        .finally(() => {
          autoSignInProgress.current = false;
        });
      return;
    }

    // 2. Nếu là ecosystem admin → tạo + sign-in admin
    if (ecosystem.isAdmin) {
      autoSignInProgress.current = true;
      void auth
        .signInAsEcosystemAdmin({
          firebase_uid: fbUid,
          email: fbEmail || 'admin@trishteam',
          display_name:
            ecosystem.profile?.display_name ||
            ecosystem.firebaseUser.displayName ||
            fbEmail ||
            'TrishTEAM Admin',
        })
        .finally(() => {
          autoSignInProgress.current = false;
        });
    }
    // 3. Khác: fall through tới LoginPage / NoPermissionPage
  }, [
    auth.loading,
    auth.currentUser,
    auth.listUsers,
    auth.signInAsEcosystemAdmin,
    ecosystem.loading,
    ecosystem.firebaseUser,
    ecosystem.isAdmin,
    ecosystem.profile,
  ]);

  // Loading state — đợi cả ecosystem auth + local auth load xong
  if (auth.loading || ecosystem.loading) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          display: 'grid',
          placeItems: 'center',
          color: 'var(--color-text-muted, #9CA3AF)',
          fontSize: 13,
        }}
      >
        Đang tải...
      </div>
    );
  }

  // Phase 38.16 — Nếu chưa login Firebase → hiển thị FirebaseLoginPage
  // (đảm bảo user không stuck ở NoPermissionPage khi đã signOut)
  if (!ecosystem.firebaseUser) {
    return <FirebaseLoginPage />;
  }

  // Phase 38.11 — Strict access control:
  //   - Admin hệ sinh thái (Firebase isAdmin) → auto-login với role 'owner'
  //   - User thường (Firebase user/trial) → BLOCK ngay, KHÔNG cho LoginPage
  //   - Local users (do admin trong app tạo) → login qua LoginPage bằng creds local
  //
  // Logic:
  //   - isEcosystemAdmin: admin TrishTEAM (full access)
  //   - hasLocalUsers: app đã được admin setup (có ít nhất 1 AppUser)
  //   - Nếu KHÔNG phải admin AND KHÔNG có local users → block (NoPermissionPage)
  //   - Nếu KHÔNG phải admin AND có local users → cho LoginPage (nhân viên login local)
  const isEcosystemAdmin = !!ecosystem.firebaseUser && ecosystem.isAdmin;
  const allLocalUsers = auth.listUsers();
  const hasLocalUsers = allLocalUsers.length > 0;

  // Có local user nào đã link với Firebase user hiện tại?
  const fbEmailLower = ecosystem.firebaseUser?.email?.toLowerCase() ?? '';
  const linkedLocalUser = ecosystem.firebaseUser
    ? allLocalUsers.find(
        (u) =>
          u.active &&
          (u.firebase_uid === ecosystem.firebaseUser!.uid ||
            (!!fbEmailLower && u.email?.toLowerCase() === fbEmailLower)),
      )
    : null;

  const willAutoSignIn =
    !!ecosystem.firebaseUser && (isEcosystemAdmin || !!linkedLocalUser);

  // Đang chờ auto-login (admin hệ sinh thái HOẶC NV có account đã link Firebase)
  if (!auth.currentUser && willAutoSignIn) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          display: 'grid',
          placeItems: 'center',
          color: 'var(--color-text-muted, #9CA3AF)',
          fontSize: 13,
        }}
      >
        Đang đăng nhập với tài khoản{' '}
        {isEcosystemAdmin ? 'admin hệ sinh thái' : linkedLocalUser?.display_name}
        ...
      </div>
    );
  }

  // Block user thường nếu app chưa được admin setup
  if (!auth.currentUser && !isEcosystemAdmin && !hasLocalUsers) {
    return <NoPermissionPage />;
  }

  // App đã có local users (admin đã setup) → cho phép login local bằng username/password
  if (!auth.currentUser) return <LoginPage />;

  // Logged in: gate page by permission
  const visibleNav = NAV.filter((item) =>
    canSeeModule(auth.currentUser!.role, item.key),
  );
  // Auto switch to dashboard if current page no longer visible
  if (!visibleNav.some((n) => n.key === page)) {
    if (page !== 'dashboard') setTimeout(() => setPage('dashboard'), 0);
  }

  const me = auth.currentUser;
  const roleMeta = ROLES[me.role];

  const mainNav = visibleNav.filter((n) => n.group === 'main');
  const adminNav = visibleNav.filter((n) => n.group === 'admin');
  const selfNav = visibleNav.filter((n) => n.group === 'self');

  return (
    <div className="app-root">
      <Header
        theme={theme}
        onToggleTheme={toggleTheme}
        onNavigate={setPage}
        onOpenSettings={() => setPage('settings')}
      />
      <div className="app-shell">
        <aside className="app-sidebar">
          {/* Phase 38.8 — Logo đã chuyển lên Header. Sidebar giữ user info card */}

        {/* User info */}
        <div
          style={{
            padding: '10px 8px',
            margin: '0 4px 12px',
            background: 'var(--color-accent-soft, rgba(16, 185, 129, 0.08))',
            border: '1px solid var(--color-border-subtle, rgba(16, 185, 129, 0.2))',
            borderRadius: 8,
            fontSize: 11,
          }}
        >
          <div
            style={{
              fontWeight: 700,
              color: 'var(--color-accent-primary, #047857)',
              marginBottom: 2,
            }}
          >
            {roleMeta.emoji} {me.display_name}
          </div>
          <div style={{ color: 'var(--color-text-muted, #6B7280)', fontSize: 10 }}>
            {roleMeta.label}
          </div>
        </div>

        {/* Main nav */}
        {mainNav.map((item) => (
          <NavButton
            key={item.key}
            item={item}
            active={page === item.key}
            onClick={() => setPage(item.key)}
          />
        ))}

        {/* Admin nav */}
        {adminNav.length > 0 && (
          <>
            <NavSection label="Quản trị" />
            {adminNav.map((item) => (
              <NavButton
                key={item.key}
                item={item}
                active={page === item.key}
                onClick={() => setPage(item.key)}
              />
            ))}
          </>
        )}

        {/* Self nav */}
        {selfNav.length > 0 && (
          <>
            <NavSection label="Cá nhân" />
            {selfNav.map((item) => (
              <NavButton
                key={item.key}
                item={item}
                active={page === item.key}
                onClick={() => setPage(item.key)}
              />
            ))}
          </>
        )}

        {/* Logout */}
        <button
          type="button"
          className="app-nav-item"
          onClick={() => {
            if (confirm('Đăng xuất khỏi TrishOffice?')) auth.logout();
          }}
          style={{
            marginTop: 8,
            color: '#DC2626',
          }}
          title="Đăng xuất"
        >
          <span style={{ fontSize: 16 }}>🚪</span>
          <span>Đăng xuất</span>
        </button>

        <div
          style={{
            marginTop: 'auto',
            padding: '12px 8px',
            fontSize: 10,
            color: 'var(--color-text-muted, #9CA3AF)',
            textAlign: 'center',
          }}
        >
          v0.1.0 · Phase 38.22
          <br />
          HRM/ERP-light · Full suite
        </div>
      </aside>

        <main className="app-main">
          {page === 'dashboard' && <DashboardPage onNavigate={setPage} />}
          {page === 'employees' && <EmployeesPage />}
          {page === 'attendance' && <AttendancePage />}
          {page === 'assets' && <AssetsPage />}
          {page === 'workflows' && <WorkflowsPage />}
          {page === 'documents' && <DocumentsPage />}
          {page === 'accounting' && <AccountingPage />}
          {page === 'calendar' && <CalendarPage />}
          {page === 'reports' && <ReportsPage />}
          {page === 'import_export' && <ImportExportPage />}
          {page === 'users' && <UsersPage />}
          {page === 'departments' && <DepartmentsPage />}
          {page === 'settings' && <SettingsPage />}
        </main>
      </div>
    </div>
  );
}

// ============================================================
// Sidebar bits
// ============================================================
function NavButton({
  item,
  active,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  onClick: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      className={`app-nav-item ${active ? 'active' : ''}`}
      onClick={onClick}
      title={item.desc}
    >
      <span style={{ fontSize: 16 }}>{item.emoji}</span>
      <span>{item.label}</span>
    </button>
  );
}

function NavSection({ label }: { label: string }): JSX.Element {
  return (
    <div
      style={{
        padding: '12px 12px 4px',
        fontSize: 10,
        fontWeight: 700,
        color: 'var(--color-text-muted, #9CA3AF)',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
      }}
    >
      {label}
    </div>
  );
}

// ============================================================
// Dashboard — KPI live (lọc theo scope)
// ============================================================
function DashboardPage({
  onNavigate,
}: {
  onNavigate: (k: ModuleKey) => void;
}): JSX.Element {
  const auth = useAuth();
  const me = auth.currentUser!;
  const roleMeta = ROLES[me.role];

  const employees = useCollection<Employee>('employees', 'emp');
  const attendance = useCollection<AttendanceEntry>('attendance', 'att');
  const assets = useCollection<Asset>('assets', 'ast');
  const workflows = useCollection<WorkflowRequest>('workflows', 'wf');
  const documents = useCollection<CompanyDocument>('documents', 'doc');
  const payrolls = useCollection<PayrollEntry>('payroll', 'pay');
  const departments = useCollection<DepartmentInfo>('departments', 'dpt');

  // Stats
  const totalEmployees = employees.items.length;
  const activeEmployees = employees.items.filter((e) => e.status === 'active').length;
  const onLeaveEmployees = employees.items.filter((e) => e.status === 'on_leave').length;

  const todayStr = today();
  const todayAttendance = attendance.items.filter((a) => a.date === todayStr);
  const workingToday = todayAttendance.filter((a) => a.type === 'work').length;
  const leaveToday = todayAttendance.filter((a) => a.type !== 'work').length;

  const assetsInUse = assets.items.filter((a) => a.status === 'in_use').length;
  const assetsAvailable = assets.items.filter((a) => a.status === 'available').length;
  const assetsBroken = assets.items.filter(
    (a) => a.status === 'broken' || a.status === 'maintenance',
  ).length;

  const pendingWorkflows = workflows.items.filter((w) => w.status === 'pending').length;
  const approvedWorkflows = workflows.items.filter((w) => w.status === 'approved').length;
  const rejectedWorkflows = workflows.items.filter((w) => w.status === 'rejected').length;

  const activeDocs = documents.items.filter((d) => d.status === 'active').length;

  // Lương tháng hiện tại
  const currentPeriod = todayStr.slice(0, 7);
  const currentPayrolls = payrolls.items.filter((p) => p.period === currentPeriod);
  const totalGross = currentPayrolls.reduce((s, p) => s + p.gross_income, 0);
  const totalNet = currentPayrolls.reduce((s, p) => s + p.net_pay, 0);

  // Lương cá nhân (cho staff)
  const myPayroll = me.employee_id
    ? currentPayrolls.find((p) => p.employee_id === me.employee_id)
    : undefined;

  const isEmpty =
    totalEmployees === 0 &&
    assets.items.length === 0 &&
    workflows.items.length === 0 &&
    documents.items.length === 0 &&
    departments.items.length === 0;

  // Staff dashboard — chỉ thông tin cá nhân
  if (me.role === 'staff') {
    const myEmployee = me.employee_id
      ? employees.items.find((e) => e.id === me.employee_id)
      : undefined;
    const myAttendance = me.employee_id
      ? attendance.items.filter((a) => a.employee_id === me.employee_id && a.date.startsWith(currentPeriod))
      : [];
    const myAssets = me.employee_id
      ? assets.items.filter((a) => a.assigned_to === me.employee_id)
      : [];
    const myWorkflows = me.employee_id
      ? workflows.items.filter((w) => w.requester_id === me.employee_id)
      : [];

    return (
      <div>
        <div className="app-header">
          <h1>
            {roleMeta.emoji} Xin chào, {me.display_name}
          </h1>
          <p>
            {roleMeta.label} · Bảng tổng quan cá nhân của bạn
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 12,
            marginBottom: 24,
          }}
        >
          <StatCard
            label="Hồ sơ NV"
            value={myEmployee?.full_name ?? '—'}
            hint={myEmployee?.position ?? 'Chưa liên kết hồ sơ'}
            onClick={() => onNavigate('employees')}
          />
          <StatCard
            label={`Chấm công ${currentPeriod}`}
            value={myAttendance.length.toString()}
            hint="Số bản ghi tháng này"
            onClick={() => onNavigate('attendance')}
          />
          <StatCard
            label="Tài sản đang giữ"
            value={myAssets.length.toString()}
            hint="Laptop · máy · thiết bị"
            onClick={() => onNavigate('assets')}
          />
          <StatCard
            label="Yêu cầu của tôi"
            value={myWorkflows.length.toString()}
            hint={`${myWorkflows.filter((w) => w.status === 'pending').length} chờ duyệt`}
            onClick={() => onNavigate('workflows')}
          />
          {myPayroll && (
            <StatCard
              label={`Lương net ${currentPeriod}`}
              value={formatVNDShort(myPayroll.net_pay)}
              hint="Sau BHXH + thuế"
              onClick={() => onNavigate('accounting')}
            />
          )}
        </div>

        <RoleHelpCard />
      </div>
    );
  }

  // Manager/Owner/HR/Accountant/AdminIT dashboard
  return (
    <div>
      <div className="app-header">
        <h1>
          {roleMeta.emoji} Dashboard — {me.display_name}
        </h1>
        <p>
          {roleMeta.label} · {roleMeta.description}
        </p>
      </div>

      {isEmpty && (
        <div
          style={{
            marginBottom: 20,
            padding: 16,
            background: 'rgba(59, 130, 246, 0.06)',
            border: '1px dashed rgba(59, 130, 246, 0.3)',
            borderRadius: 10,
            fontSize: 13,
            lineHeight: 1.6,
          }}
        >
          👋 <strong>Bắt đầu nhanh:</strong> Vào{' '}
          <em>Phòng ban</em> tạo cơ cấu phòng ban (có nút "Thêm nhanh 6 phòng
          chuẩn"), sau đó vào <em>Nhân sự</em> thêm nhân viên, rồi tạo account
          login cho họ ở <em>Người dùng</em>.
          <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {canSeeModule(me.role, 'departments') && (
              <button type="button" onClick={() => onNavigate('departments')} style={quickBtn}>
                🏛️ Tạo phòng ban
              </button>
            )}
            {canSeeModule(me.role, 'employees') && (
              <button type="button" onClick={() => onNavigate('employees')} style={quickBtn}>
                👥 Thêm nhân viên
              </button>
            )}
            {canSeeModule(me.role, 'users') && (
              <button type="button" onClick={() => onNavigate('users')} style={quickBtn}>
                🛡️ Tạo user login
              </button>
            )}
          </div>
        </div>
      )}

      {/* KPI Stats */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
          marginBottom: 24,
        }}
      >
        {canSeeModule(me.role, 'employees') && (
          <StatCard
            label="Tổng nhân sự"
            value={totalEmployees.toString()}
            hint={`${activeEmployees} đang làm · ${onLeaveEmployees} nghỉ phép`}
            onClick={() => onNavigate('employees')}
          />
        )}
        {canSeeModule(me.role, 'attendance') && (
          <StatCard
            label="Đi làm hôm nay"
            value={workingToday.toString()}
            hint={`${leaveToday} nghỉ · ngày ${todayStr}`}
            onClick={() => onNavigate('attendance')}
          />
        )}
        {canSeeModule(me.role, 'assets') && (
          <StatCard
            label="Tài sản đang dùng"
            value={assetsInUse.toString()}
            hint={`${assetsAvailable} sẵn · ${assetsBroken} hỏng/bảo trì`}
            onClick={() => onNavigate('assets')}
          />
        )}
        {canSeeModule(me.role, 'workflows') && (
          <StatCard
            label="Quy trình chờ duyệt"
            value={pendingWorkflows.toString()}
            hint={`${approvedWorkflows} duyệt · ${rejectedWorkflows} từ chối`}
            onClick={() => onNavigate('workflows')}
          />
        )}
      </div>

      {/* Secondary stats */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
          marginBottom: 24,
        }}
      >
        {canSeeModule(me.role, 'documents') && (
          <StatCard
            label="Tài liệu hiện hành"
            value={activeDocs.toString()}
            hint={`${documents.items.length} tổng tài liệu`}
            onClick={() => onNavigate('documents')}
          />
        )}
        {canSeeModule(me.role, 'accounting') && (
          <>
            <StatCard
              label={`Tổng lương ${currentPeriod}`}
              value={totalGross > 0 ? formatVNDShort(totalGross) : '—'}
              hint={
                currentPayrolls.length > 0
                  ? `${currentPayrolls.length} bảng lương`
                  : 'Chưa tính lương'
              }
              onClick={() => onNavigate('accounting')}
            />
            <StatCard
              label={`Lương net ${currentPeriod}`}
              value={totalNet > 0 ? formatVNDShort(totalNet) : '—'}
              hint="Sau BHXH + thuế"
              onClick={() => onNavigate('accounting')}
            />
          </>
        )}
        {canSeeModule(me.role, 'departments') && (
          <StatCard
            label="Phòng ban"
            value={departments.items.length.toString()}
            hint={`${departments.items.filter((d) => d.active).length} active`}
            onClick={() => onNavigate('departments')}
          />
        )}
        {canSeeModule(me.role, 'users') && (
          <StatCard
            label="User accounts"
            value={auth.listUsers().length.toString()}
            hint={`${auth.listUsers().filter((u) => u.active).length} active`}
            onClick={() => onNavigate('users')}
          />
        )}
      </div>

      <RoleHelpCard />
    </div>
  );
}

// ============================================================
// Role help card
// ============================================================
function RoleHelpCard(): JSX.Element {
  const auth = useAuth();
  const me = auth.currentUser!;
  const roleMeta = ROLES[me.role];

  return (
    <div
      style={{
        marginTop: 32,
        padding: 16,
        background: 'rgba(16, 185, 129, 0.08)',
        border: '1px solid rgba(74, 222, 128, 0.25)',
        borderRadius: 10,
        fontSize: 12,
        lineHeight: 1.65,
      }}
    >
      <strong>
        {roleMeta.emoji} Quyền của bạn ({roleMeta.label}):
      </strong>
      <p style={{ margin: '6px 0 0' }}>{roleMeta.description}</p>
      <p style={{ margin: '6px 0 0', color: 'var(--color-text-muted, #6B7280)', fontSize: 11 }}>
        Sidebar đã được lọc theo role — chỉ hiển thị module bạn được phép truy
        cập. Các nút sửa/xóa trong từng module cũng tự ẩn nếu không có quyền.
      </p>
    </div>
  );
}

// ============================================================
// StatCard — clickable
// ============================================================
function StatCard({
  label,
  value,
  hint,
  onClick,
}: {
  label: string;
  value: string;
  hint?: string;
  onClick?: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: 16,
        background: 'var(--color-surface-card, #fff)',
        border: '1px solid var(--color-border-subtle, #E5E7EB)',
        borderRadius: 12,
        cursor: onClick ? 'pointer' : 'default',
        textAlign: 'left',
        fontFamily: 'inherit',
        transition: 'border-color 0.15s, transform 0.1s',
      }}
      onMouseEnter={(e) => {
        if (onClick) {
          e.currentTarget.style.borderColor =
            'var(--color-accent-primary, #10B981)';
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor =
          'var(--color-border-subtle, #E5E7EB)';
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: 'var(--color-text-muted, #6B7280)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          fontWeight: 600,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 24,
          fontWeight: 800,
          marginTop: 4,
          color: 'var(--color-accent-primary, #10B981)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {value}
      </div>
      {hint && (
        <div
          style={{
            fontSize: 10,
            color: 'var(--color-text-muted, #9CA3AF)',
            marginTop: 4,
          }}
        >
          {hint}
        </div>
      )}
    </button>
  );
}

/** Format VND ngắn gọn cho dashboard: 12.5M / 1.2B */
function formatVNDShort(amount: number): string {
  if (!isFinite(amount) || amount === 0) return '—';
  if (amount >= 1_000_000_000) return (amount / 1_000_000_000).toFixed(2) + 'B đ';
  if (amount >= 1_000_000) return (amount / 1_000_000).toFixed(1) + 'M đ';
  if (amount >= 1_000) return (amount / 1_000).toFixed(0) + 'K đ';
  return amount.toString() + ' đ';
}

const quickBtn: React.CSSProperties = {
  padding: '6px 12px',
  borderRadius: 8,
  border: 'none',
  background: 'var(--color-accent-primary, #10B981)',
  color: '#fff',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
};
