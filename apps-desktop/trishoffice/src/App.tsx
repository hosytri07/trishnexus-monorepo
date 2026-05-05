/**
 * TrishOffice — App shell HRM/ERP-light cho công ty (Phase 38.6 rebuilt).
 *
 * 7 module:
 *   1. Dashboard điều hành — overview KPI
 *   2. Nhân sự — HR profile + hợp đồng + bảo hiểm + nghỉ phép
 *   3. Chấm công — manual nhập giờ vào/ra (Phase 1, auto sau)
 *   4. Tài sản công ty — laptop/máy in/xe/văn phòng phẩm
 *   5. Quy trình duyệt — workflow phê duyệt nhiều cấp (mua sắm/xin phép/công tác phí)
 *   6. Tài liệu nội bộ — quy định + quy chế + biểu mẫu công ty
 *   7. Kế toán — lương + thuế TNCN + BHXH + báo cáo BCTC
 *
 * MVP scaffold: tất cả module đang là placeholder. Implement dần Phase 38.6.x.
 */

import { useState } from 'react';

type PageKey =
  | 'dashboard'
  | 'employees'
  | 'attendance'
  | 'assets'
  | 'workflows'
  | 'documents'
  | 'accounting';

interface NavItem {
  key: PageKey;
  emoji: string;
  label: string;
  desc: string;
  phase: string;
}

const NAV: NavItem[] = [
  {
    key: 'dashboard',
    emoji: '📊',
    label: 'Dashboard điều hành',
    desc: 'Tổng quan: nhân sự · giờ công · tài sản · KPI · pending workflows',
    phase: '38.6.1',
  },
  {
    key: 'employees',
    emoji: '👥',
    label: 'Nhân sự',
    desc: 'Hồ sơ nhân viên + hợp đồng + lương cơ bản + BHXH + nghỉ phép',
    phase: '38.6.2',
  },
  {
    key: 'attendance',
    emoji: '📅',
    label: 'Chấm công',
    desc: 'Manual nhập giờ vào/ra · OT · ngày nghỉ · lịch trực (auto sau)',
    phase: '38.6.3',
  },
  {
    key: 'assets',
    emoji: '🏢',
    label: 'Tài sản công ty',
    desc: 'Laptop · máy in · xe · văn phòng phẩm — cấp phát + thu hồi',
    phase: '38.6.4',
  },
  {
    key: 'workflows',
    emoji: '📋',
    label: 'Quy trình duyệt',
    desc: 'Yêu cầu mua sắm · xin phép · công tác phí — phê duyệt nhiều cấp',
    phase: '38.6.5',
  },
  {
    key: 'documents',
    emoji: '💼',
    label: 'Tài liệu nội bộ',
    desc: 'Quy định · quy chế · thủ tục · biểu mẫu công ty (≠ ISO chất lượng)',
    phase: '38.6.6',
  },
  {
    key: 'accounting',
    emoji: '💵',
    label: 'Kế toán',
    desc: 'Bảng lương · thuế TNCN · BHXH · BHYT · công đoàn · báo cáo BCTC',
    phase: '38.6.7',
  },
];

export function App(): JSX.Element {
  const [page, setPage] = useState<PageKey>('dashboard');

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="app-sidebar-logo">
          <span className="app-sidebar-logo-emoji">🏢</span>
          <span>TrishOffice</span>
        </div>
        {NAV.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`app-nav-item ${page === item.key ? 'active' : ''}`}
            onClick={() => setPage(item.key)}
            title={item.desc}
          >
            <span style={{ fontSize: 16 }}>{item.emoji}</span>
            <span>{item.label}</span>
          </button>
        ))}
        <div
          style={{
            marginTop: 'auto',
            padding: '12px 8px',
            fontSize: 10,
            color: 'var(--color-text-muted, #9CA3AF)',
            textAlign: 'center',
          }}
        >
          v0.1.0 · Phase 38.6 scaffold
          <br />
          HRM/ERP-light cho cty
        </div>
      </aside>

      <main className="app-main">
        {page === 'dashboard' && <DashboardPage onNavigate={setPage} />}
        {page === 'employees' && <PlaceholderPage item={NAV[1]!} />}
        {page === 'attendance' && <PlaceholderPage item={NAV[2]!} />}
        {page === 'assets' && <PlaceholderPage item={NAV[3]!} />}
        {page === 'workflows' && <PlaceholderPage item={NAV[4]!} />}
        {page === 'documents' && <PlaceholderPage item={NAV[5]!} />}
        {page === 'accounting' && <PlaceholderPage item={NAV[6]!} />}
      </main>
    </div>
  );
}

function DashboardPage({
  onNavigate,
}: {
  onNavigate: (k: PageKey) => void;
}): JSX.Element {
  return (
    <div>
      <div className="app-header">
        <h1>🏢 TrishOffice — Quản lý công ty</h1>
        <p>
          Bộ công cụ HRM/ERP-light cho doanh nghiệp XD-GT vừa và nhỏ (5-50 người):
          quản lý nhân sự, chấm công, tài sản công ty, quy trình duyệt, tài liệu
          nội bộ, kế toán.
        </p>
      </div>

      {/* Quick stats placeholder */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
          marginBottom: 24,
        }}
      >
        <StatCard label="Tổng nhân sự" value="—" hint="Đang phát triển" />
        <StatCard label="Đang đi làm hôm nay" value="—" hint="Đang phát triển" />
        <StatCard label="Tài sản đang dùng" value="—" hint="Đang phát triển" />
        <StatCard
          label="Quy trình chờ duyệt"
          value="—"
          hint="Đang phát triển"
        />
      </div>

      {/* Module cards */}
      <h2
        style={{
          fontSize: 16,
          fontWeight: 700,
          margin: '0 0 12px',
          color: 'var(--color-text-secondary, #6B7280)',
        }}
      >
        7 module
      </h2>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 16,
        }}
      >
        {NAV.filter((n) => n.key !== 'dashboard').map((item) => (
          <button
            key={item.key}
            type="button"
            className="module-card"
            onClick={() => onNavigate(item.key)}
            style={{
              border: 'none',
              cursor: 'pointer',
              textAlign: 'left',
              fontFamily: 'inherit',
            }}
          >
            <div className="module-card-header">
              <span className="module-card-emoji">{item.emoji}</span>
              <h3 className="module-card-title">{item.label}</h3>
            </div>
            <p className="module-card-desc">{item.desc}</p>
            <div
              style={{
                marginTop: 10,
                fontSize: 10,
                color: '#9CA3AF',
                fontWeight: 600,
              }}
            >
              ⏳ Phase {item.phase} — Đang phát triển
            </div>
          </button>
        ))}
      </div>

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
        <strong>📦 Phân biệt với apps khác trong ecosystem:</strong>
        <ul style={{ margin: '6px 0 0 18px', padding: 0 }}>
          <li>
            <strong>TrishOffice</strong> (app này): quản lý <em>công ty</em> —
            nhân sự, tài sản hành chính, kế toán, quy trình duyệt
          </li>
          <li>
            <strong>TrishISO</strong>: hồ sơ ISO chất lượng + thiết bị{' '}
            <em>kỹ thuật</em> (máy thí nghiệm, dụng cụ đo, cần hiệu chuẩn)
          </li>
          <li>
            <strong>TrishFinance</strong>: bán hàng (POS) + nhà trọ + thu chi cá
            nhân (≠ kế toán công ty)
          </li>
          <li>
            <strong>TrishDesign</strong>: công cụ kỹ sư XD-GT (CAD automation,
            quản lý dự án, hồ sơ thiết kế)
          </li>
        </ul>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}): JSX.Element {
  return (
    <div
      style={{
        padding: 16,
        background: 'var(--color-surface-card, #fff)',
        border: '1px solid var(--color-border-subtle, #E5E7EB)',
        borderRadius: 12,
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
          fontSize: 28,
          fontWeight: 800,
          marginTop: 4,
          color: 'var(--color-accent-primary, #10B981)',
        }}
      >
        {value}
      </div>
      {hint && (
        <div
          style={{
            fontSize: 10,
            color: '#9CA3AF',
            marginTop: 4,
          }}
        >
          {hint}
        </div>
      )}
    </div>
  );
}

function PlaceholderPage({ item }: { item: NavItem }): JSX.Element {
  return (
    <div>
      <div className="app-header">
        <h1>
          {item.emoji} {item.label}
        </h1>
        <p>{item.desc}</p>
      </div>
      <div
        style={{
          padding: 48,
          textAlign: 'center',
          border: '1px dashed var(--color-border-default, #D1D5DB)',
          borderRadius: 12,
          color: 'var(--color-text-muted, #9CA3AF)',
        }}
      >
        <div style={{ fontSize: 56, marginBottom: 12 }}>{item.emoji}</div>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
          Module đang phát triển
        </h2>
        <p style={{ margin: '8px 0 0', fontSize: 13 }}>
          Tính năng "{item.label}" sẽ được implement trong Phase {item.phase}.
        </p>
      </div>
    </div>
  );
}
