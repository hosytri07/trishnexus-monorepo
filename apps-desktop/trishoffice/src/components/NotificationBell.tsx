/**
 * NotificationBell — Notifications dropdown (Phase 38.20).
 *
 * 4 loại notifications:
 *   1. Workflows pending (status='pending')
 *   2. Hợp đồng sắp hết hạn (end_date < 30 ngày tới)
 *   3. Lương đến kỳ tính (period = current month + chưa có payroll)
 *   4. Sinh nhật NV trong tuần này
 */

import { Bell } from 'lucide-react';
import { useState, useMemo } from 'react';
import { useCollection, today, formatDate } from '../storage';
import type { Employee, WorkflowRequest, ContractIncome, PayrollEntry } from '../types';
import type { ModuleKey } from '../auth/types';

interface Notification {
  id: string;
  type: 'workflow' | 'contract' | 'payroll' | 'birthday';
  title: string;
  subtitle?: string;
  icon: string;
  moduleKey: ModuleKey;
  time: string;
}

interface NotificationBellProps {
  onNavigate?: (page: ModuleKey) => void;
}

export function NotificationBell({ onNavigate }: NotificationBellProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const employees = useCollection<Employee>('employees', 'emp');
  const workflows = useCollection<WorkflowRequest>('workflows', 'wf');
  const contracts = useCollection<ContractIncome>('contracts', 'con');
  const payrolls = useCollection<PayrollEntry>('payroll', 'pay');

  const notifications = useMemo<Notification[]>(() => {
    const notifs: Notification[] = [];
    const todayStr = today();
    const todayDate = new Date(todayStr);

    // 1. Workflows pending
    workflows.items
      .filter((w) => w.status === 'pending')
      .slice(0, 3)
      .forEach((w) => {
        notifs.push({
          id: `wf_${w.id}`,
          type: 'workflow',
          title: `Quy trình chờ duyệt: ${w.title}`,
          subtitle: w.description,
          icon: '📋',
          moduleKey: 'workflows',
          time: formatRelativeTime(w.created_at),
        });
      });

    // 2. Contracts ending in next 30 days
    const thirtyDaysLater = new Date(todayDate);
    thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);
    contracts.items
      .filter(
        (c) =>
          c.end_date &&
          c.status !== 'completed' &&
          c.status !== 'cancelled' &&
          new Date(c.end_date) <= thirtyDaysLater &&
          new Date(c.end_date) >= todayDate,
      )
      .slice(0, 3)
      .forEach((c) => {
        notifs.push({
          id: `con_${c.id}`,
          type: 'contract',
          title: `Hợp đồng sắp hết hạn: ${c.title}`,
          subtitle: `Kết thúc: ${formatDate(c.end_date)}`,
          icon: '📈',
          moduleKey: 'accounting',
          time: `Còn ${daysUntil(c.end_date)} ngày`,
        });
      });

    // 3. Payroll for current month
    const currentPeriod = todayStr.slice(0, 7);
    const currentPayrolls = payrolls.items.filter((p) => p.period === currentPeriod);
    if (currentPayrolls.length === 0) {
      notifs.push({
        id: 'payroll_pending',
        type: 'payroll',
        title: 'Lương kỳ tính',
        subtitle: `Tháng ${currentPeriod} chưa được tính`,
        icon: '💵',
        moduleKey: 'accounting',
        time: 'Sắp đến hạn',
      });
    }

    // 4. Birthdays this week
    const weekStart = new Date(todayDate);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1); // Monday
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6); // Sunday
    employees.items
      .filter((e) => {
        if (!e.dob) return false;
        const [year, month, day] = e.dob.split('-');
        const dobThisYear = new Date(
          todayDate.getFullYear(),
          parseInt(month) - 1,
          parseInt(day),
        );
        return dobThisYear >= weekStart && dobThisYear <= weekEnd;
      })
      .slice(0, 3)
      .forEach((e) => {
        notifs.push({
          id: `bd_${e.id}`,
          type: 'birthday',
          title: `Sinh nhật: ${e.full_name}`,
          subtitle: getAgeFromDOB(e.dob),
          icon: '🎂',
          moduleKey: 'calendar',
          time: 'Tuần này',
        });
      });

    return notifs;
  }, [employees.items, workflows.items, contracts.items, payrolls.items]);

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        className="app-topbar-icon-btn"
        onClick={() => setOpen(!open)}
        title="Thông báo"
        style={{ position: 'relative' }}
      >
        <Bell size={15} />
        {notifications.length > 0 && (
          <span
            style={{
              position: 'absolute',
              top: -4,
              right: -4,
              width: 18,
              height: 18,
              borderRadius: '50%',
              background: '#EF4444',
              color: '#fff',
              fontSize: 10,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {notifications.length}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 8,
            width: 320,
            maxHeight: 400,
            overflowY: 'auto',
            background: 'var(--color-surface-card, #fff)',
            border: '1px solid var(--color-border-subtle, #E5E7EB)',
            borderRadius: 12,
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            zIndex: 1000,
            fontSize: 13,
          }}
        >
          {notifications.length === 0 ? (
            <div
              style={{
                padding: 16,
                textAlign: 'center',
                color: 'var(--color-text-muted, #6B7280)',
              }}
            >
              Không có thông báo
            </div>
          ) : (
            <>
              {notifications.map((notif) => (
                <button
                  key={notif.id}
                  type="button"
                  onClick={() => {
                    onNavigate?.(notif.moduleKey);
                    setOpen(false);
                  }}
                  style={{
                    width: '100%',
                    padding: 12,
                    borderBottom: '1px solid var(--color-border-subtle, #F3F4F6)',
                    border: 'none',
                    textAlign: 'left',
                    background: 'transparent',
                    cursor: 'pointer',
                    transition: 'background 150ms',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background =
                      'var(--color-surface-row, #F9FAFB)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <div style={{ display: 'flex', gap: 10 }}>
                    <span style={{ fontSize: 16 }}>{notif.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontWeight: 600,
                          color: 'var(--color-text-primary, #111827)',
                          marginBottom: 2,
                        }}
                      >
                        {notif.title}
                      </div>
                      {notif.subtitle && (
                        <div
                          style={{
                            fontSize: 11,
                            color: 'var(--color-text-muted, #9CA3AF)',
                            marginBottom: 4,
                          }}
                        >
                          {notif.subtitle}
                        </div>
                      )}
                      <div
                        style={{
                          fontSize: 10,
                          color: 'var(--color-text-muted, #D1D5DB)',
                        }}
                      >
                        {notif.time}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
              <div
                style={{
                  padding: 12,
                  textAlign: 'center',
                  borderTop: '1px solid var(--color-border-subtle, #F3F4F6)',
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    onNavigate?.('calendar');
                    setOpen(false);
                  }}
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--color-accent-primary, #10B981)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  Xem tất cả
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (hours < 1) return 'Vừa xong';
  if (hours < 24) return `${hours}h trước`;
  if (days < 7) return `${days} ngày trước`;
  return `${Math.floor(days / 7)} tuần trước`;
}

function daysUntil(dateStr?: string): number {
  if (!dateStr) return 0;
  const date = new Date(dateStr);
  const today = new Date();
  const diff = date.getTime() - today.getTime();
  return Math.ceil(diff / 86400000);
}

function getAgeFromDOB(dob?: string): string {
  if (!dob) return '';
  const [year, month, day] = dob.split('-');
  const age = new Date().getFullYear() - parseInt(year);
  return `${month}/${day} (${age} tuổi)`;
}
