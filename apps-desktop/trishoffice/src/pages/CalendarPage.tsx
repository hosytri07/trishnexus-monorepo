/**
 * CalendarPage — Lịch sự kiện (Phase 38.20).
 *
 * Hiển thị 3 loại events trên lịch:
 *   1. Nghỉ phép NV (leave_paid/leave_unpaid/leave_sick)
 *   2. Công tác (business_trip)
 *   3. Sinh nhật NV (tính từ dob)
 *
 * Features:
 *   - Month grid view
 *   - Filter: tất cả / phòng ban / NV cụ thể
 *   - Period picker (month navigation)
 *   - Click day → popup list events
 *   - RBAC: usePermission('attendance')
 */

import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCollection, today } from '../storage';
import { usePermission } from '../auth/usePermission';
import { useAuth } from '../auth/AuthContext';
import type { Employee, AttendanceEntry } from '../types';
import type { DepartmentInfo } from '../auth/types';

interface DayEvent {
  id: string;
  type: 'leave' | 'business_trip' | 'birthday';
  title: string;
  icon: string;
  color: string;
  fullDetails?: string;
}

export function CalendarPage(): JSX.Element {
  const auth = useAuth();
  const employees = useCollection<Employee>('employees', 'emp');
  const attendance = useCollection<AttendanceEntry>('attendance', 'att');
  const departments = useCollection<DepartmentInfo>('departments', 'dpt');
  const perm = usePermission('attendance');

  const [currentDate, setCurrentDate] = useState<Date>(() => {
    const d = new Date();
    d.setDate(1); // first day of month
    return d;
  });
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const month = currentDate.getMonth();
  const year = currentDate.getFullYear();

  // Get filtered employees based on permission scope + filter
  const visibleEmployees = useMemo(() => {
    let all = employees.items;
    // Apply RBAC
    all = perm.filter(
      all,
      (e) => e.department,
      (e) => e.id,
    );
    // Apply dept filter
    if (selectedDept !== 'all') {
      all = all.filter((e) => e.department === selectedDept);
    }
    return all;
  }, [employees.items, perm, selectedDept]);

  const deptOptions = useMemo(() => {
    const depts = [...new Set(employees.items.map((e) => e.department))];
    return depts.filter((d) => !!d).sort();
  }, [employees.items]);

  // Calculate events for each day
  const dayEvents = useMemo<Record<number, DayEvent[]>>(() => {
    const events: Record<number, DayEvent[]> = {};
    const isoCurrent = `${year}-${String(month + 1).padStart(2, '0')}`;

    // 1. Attendance events (leaves + business trips)
    attendance.items
      .filter((a) => a.date.startsWith(isoCurrent))
      .filter((a) => a.type !== 'work' && a.type !== 'holiday')
      .forEach((a) => {
        const emp = employees.items.find((e) => e.id === a.employee_id);
        if (!emp) return;
        // Check if visible
        if (!visibleEmployees.find((e) => e.id === emp.id)) return;
        if (selectedEmployee !== 'all' && a.employee_id !== selectedEmployee) return;

        const day = parseInt(a.date.slice(8, 10));
        const icon = a.type === 'leave_paid' || a.type === 'leave_unpaid' || a.type === 'leave_sick' ? '📋' : '✈️';
        const typeLabel = {
          leave_paid: 'Nghỉ phép có lương',
          leave_unpaid: 'Nghỉ không lương',
          leave_sick: 'Nghỉ ốm',
          business_trip: 'Công tác',
        }[a.type] || a.type;

        if (!events[day]) events[day] = [];
        events[day].push({
          id: `att_${a.id}`,
          type: a.type.startsWith('leave') ? 'leave' : 'business_trip',
          title: `${emp.full_name}: ${typeLabel}`,
          icon,
          color: a.type.startsWith('leave') ? '#FCA5A5' : '#FDE047',
          fullDetails: `${emp.full_name} - ${typeLabel}`,
        });
      });

    // 2. Birthdays (match month/day)
    employees.items.forEach((emp) => {
      if (!emp.dob) return;
      if (!visibleEmployees.find((e) => e.id === emp.id)) return;
      if (selectedEmployee !== 'all' && emp.id !== selectedEmployee) return;

      const [, dobMonth, dobDay] = emp.dob.split('-');
      if (parseInt(dobMonth) === month + 1) {
        const day = parseInt(dobDay);
        if (!events[day]) events[day] = [];
        const age = year - parseInt(emp.dob.split('-')[0]);
        events[day].push({
          id: `bd_${emp.id}`,
          type: 'birthday',
          title: `🎂 ${emp.full_name} sinh nhật (${age} tuổi)`,
          icon: '🎂',
          color: '#FEC08D',
          fullDetails: `${emp.full_name} sinh nhật tuổi ${age}`,
        });
      }
    });

    return events;
  }, [year, month, attendance.items, employees.items, visibleEmployees, selectedEmployee]);

  // Build calendar grid
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDate = new Date(firstDay);
  startDate.setDate(startDate.getDate() - (firstDay.getDay() || 7) + 1); // Monday
  const weeks: Date[][] = [];
  for (let i = 0; i < 6; i++) {
    const week: Date[] = [];
    for (let j = 0; j < 7; j++) {
      week.push(new Date(startDate));
      startDate.setDate(startDate.getDate() + 1);
    }
    weeks.push(week);
    if (weeks[i][6] > lastDay) break; // stop if beyond last day
  }

  const dayNames = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
  const monthName = new Date(year, month).toLocaleDateString('vi-VN', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div>
      <div className="app-header">
        <h1>📅 Lịch</h1>
        <p>Lịch nghỉ phép · công tác · sinh nhật nhân viên</p>
      </div>

      {/* Controls */}
      <div
        style={{
          marginBottom: 20,
          padding: 16,
          background: 'var(--color-surface-card, #fff)',
          border: '1px solid var(--color-border-subtle, #E5E7EB)',
          borderRadius: 12,
          display: 'flex',
          gap: 16,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        {/* Department filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted, #6B7280)' }}>
            Phòng ban:
          </label>
          <select
            value={selectedDept}
            onChange={(e) => {
              setSelectedDept(e.target.value);
              setSelectedEmployee('all');
            }}
            style={{
              padding: '6px 10px',
              borderRadius: 6,
              border: '1px solid var(--color-border-subtle, #E5E7EB)',
              fontSize: 12,
              background: 'var(--color-surface-row, #F9FAFB)',
            }}
          >
            <option value="all">Tất cả</option>
            {deptOptions.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>
        </div>

        {/* Employee filter */}
        {selectedDept && selectedDept !== 'all' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted, #6B7280)' }}>
              Nhân viên:
            </label>
            <select
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
              style={{
                padding: '6px 10px',
                borderRadius: 6,
                border: '1px solid var(--color-border-subtle, #E5E7EB)',
                fontSize: 12,
                background: 'var(--color-surface-row, #F9FAFB)',
              }}
            >
              <option value="all">Tất cả</option>
              {visibleEmployees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.full_name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Calendar */}
      <div
        style={{
          background: 'var(--color-surface-card, #fff)',
          border: '1px solid var(--color-border-subtle, #E5E7EB)',
          borderRadius: 12,
          overflow: 'hidden',
        }}
      >
        {/* Header + Month nav */}
        <div
          style={{
            padding: 16,
            background: 'var(--color-surface-row, #F9FAFB)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid var(--color-border-subtle, #E5E7EB)',
          }}
        >
          <button
            type="button"
            onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 6,
              display: 'flex',
              alignItems: 'center',
            }}
            title="Tháng trước"
          >
            <ChevronLeft size={18} />
          </button>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{monthName}</h2>
          <button
            type="button"
            onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 6,
              display: 'flex',
              alignItems: 'center',
            }}
            title="Tháng sau"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Day names */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            background: 'var(--color-surface-row, #F9FAFB)',
            borderBottom: '1px solid var(--color-border-subtle, #E5E7EB)',
          }}
        >
          {dayNames.map((name) => (
            <div
              key={name}
              style={{
                padding: 12,
                textAlign: 'center',
                fontSize: 12,
                fontWeight: 700,
                color: 'var(--color-text-muted, #6B7280)',
              }}
            >
              {name}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: 1,
            background: '#E5E7EB',
            padding: 1,
          }}
        >
          {weeks.map((week, wi) =>
            week.map((date, di) => {
              const isCurrentMonth = date.getMonth() === month;
              const isToday = date.toISOString().slice(0, 10) === today();
              const day = date.getDate();
              const events = dayEvents[day] || [];
              const isSelected = selectedDay === day;

              return (
                <button
                  key={`${wi}_${di}`}
                  type="button"
                  onClick={() => setSelectedDay(isSelected ? null : day)}
                  style={{
                    minHeight: 100,
                    padding: 8,
                    background: isCurrentMonth
                      ? 'var(--color-surface-card, #fff)'
                      : 'var(--color-surface-row, #F9FAFB)',
                    border: isSelected
                      ? '2px solid var(--color-accent-primary, #10B981)'
                      : 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontFamily: 'inherit',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                  }}
                  onMouseEnter={(e) => {
                    if (isCurrentMonth && !isSelected) {
                      e.currentTarget.style.background =
                        'var(--color-surface-row, #F9FAFB)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (isCurrentMonth && !isSelected) {
                      e.currentTarget.style.background =
                        'var(--color-surface-card, #fff)';
                    }
                  }}
                >
                  {/* Day number */}
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: isToday ? 700 : 600,
                      color: isToday
                        ? 'var(--color-accent-primary, #10B981)'
                        : isCurrentMonth
                          ? 'var(--color-text-primary, #111827)'
                          : 'var(--color-text-muted, #9CA3AF)',
                      padding: isToday ? '4px 6px' : 0,
                      borderRadius: isToday ? 4 : 0,
                      background: isToday
                        ? 'rgba(16, 185, 129, 0.1)'
                        : 'transparent',
                    }}
                  >
                    {day}
                  </div>
                  {/* Events */}
                  {events.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {events.slice(0, 2).map((evt) => (
                        <div
                          key={evt.id}
                          style={{
                            fontSize: 9,
                            padding: '2px 4px',
                            borderRadius: 3,
                            background: evt.color,
                            color: '#000',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={evt.fullDetails}
                        >
                          {evt.icon} {evt.title.slice(0, 15)}
                        </div>
                      ))}
                      {events.length > 2 && (
                        <div
                          style={{
                            fontSize: 8,
                            color: 'var(--color-text-muted, #6B7280)',
                            padding: '1px 4px',
                          }}
                        >
                          +{events.length - 2} khác
                        </div>
                      )}
                    </div>
                  )}
                </button>
              );
            }),
          )}
        </div>
      </div>

      {/* Day popup */}
      {selectedDay && dayEvents[selectedDay] && dayEvents[selectedDay].length > 0 && (
        <div
          style={{
            marginTop: 20,
            padding: 16,
            background: 'var(--color-surface-card, #fff)',
            border: '1px solid var(--color-border-subtle, #E5E7EB)',
            borderRadius: 12,
          }}
        >
          <h3 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 700 }}>
            📅 {selectedDay} tháng {month + 1} năm {year}
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {dayEvents[selectedDay].map((evt) => (
              <div
                key={evt.id}
                style={{
                  padding: 10,
                  background: evt.color,
                  borderRadius: 8,
                  fontSize: 12,
                  color: '#000',
                }}
              >
                {evt.icon} <strong>{evt.fullDetails}</strong>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
