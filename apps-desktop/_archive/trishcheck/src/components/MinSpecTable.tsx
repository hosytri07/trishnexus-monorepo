import { useMemo } from 'react';
import type { Language } from '../settings.js';
import { makeT } from '../i18n/index.js';
import {
  CATEGORY_LABELS,
  compareSpec,
  formatSpec,
  type MachineSpec,
  type SoftwareSpec,
  type CompareStatus,
} from '../data/min-specs.js';

/**
 * Phase 15.0.l — Min-spec compare table.
 *
 * Render bảng phần mềm phổ biến với status pass/warn/fail dựa MachineSpec.
 * Group theo category. Tooltip hiện chi tiết khi hover status badge.
 *
 * Specs nhận từ prop (App.tsx load remote/bundled). Refresh button trên
 * section header để re-fetch admin-managed JSON.
 */

interface MinSpecTableProps {
  language: Language;
  machine: MachineSpec;
  specs: SoftwareSpec[];
  source: 'remote' | 'bundled';
  onRefresh: () => void;
  refreshing: boolean;
}

export function MinSpecTable({
  language,
  machine,
  specs,
  source,
  onRefresh,
  refreshing,
}: MinSpecTableProps): JSX.Element {
  const tr = makeT(language);

  // Group by category để render section
  const grouped = useMemo(() => {
    const map = new Map<string, SoftwareSpec[]>();
    for (const spec of specs) {
      const list = map.get(spec.category) ?? [];
      list.push(spec);
      map.set(spec.category, list);
    }
    return map;
  }, [specs]);

  return (
    <section className="minspec">
      <header className="section-head">
        <div className="section-head-row">
          <div>
            <h2>{tr('minspec.title')}</h2>
            <p className="muted small">{tr('minspec.subtitle')}</p>
            <p className="muted small">
              Máy bạn: <b>{machine.cpu_cores}C</b> / <b>{machine.ram_gb} GB RAM</b> / <b>{machine.disk_free_gb.toFixed(0)} GB</b> còn trống
            </p>
          </div>
          <div className="minspec-meta">
            <span
              className={`source-pill source-pill-${source}`}
              title={
                source === 'remote'
                  ? 'Đang dùng dữ liệu mới nhất từ admin'
                  : 'Đang dùng dữ liệu built-in (chưa fetch được remote)'
              }
            >
              {source === 'remote' ? '● remote' : '⚠ bundled'}
            </span>
            <button
              type="button"
              className="btn btn-ghost btn-small"
              onClick={onRefresh}
              disabled={refreshing}
            >
              {refreshing ? '⟳ ...' : '⟳ Refresh'}
            </button>
          </div>
        </div>
      </header>

      <div className="minspec-table-wrap">
        <table className="minspec-table">
          <thead>
            <tr>
              <th>{tr('minspec.col_app')}</th>
              <th>{tr('minspec.col_min')}</th>
              <th>{tr('minspec.col_recommended')}</th>
              <th>{tr('minspec.col_status')}</th>
            </tr>
          </thead>
          <tbody>
            {Array.from(grouped.entries()).map(([category, specs]) => (
              <CategoryGroup
                key={category}
                category={category}
                specs={specs}
                machine={machine}
                language={language}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

interface CategoryGroupProps {
  category: string;
  specs: SoftwareSpec[];
  machine: MachineSpec;
  language: Language;
}

function CategoryGroup({
  category,
  specs,
  machine,
  language,
}: CategoryGroupProps): JSX.Element {
  return (
    <>
      <tr className="minspec-category-row">
        <td colSpan={4}>
          {CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS] ??
            category}
        </td>
      </tr>
      {specs.map((spec) => (
        <SpecRow
          key={spec.id}
          spec={spec}
          machine={machine}
          language={language}
        />
      ))}
    </>
  );
}

interface SpecRowProps {
  spec: SoftwareSpec;
  machine: MachineSpec;
  language: Language;
}

function SpecRow({ spec, machine, language }: SpecRowProps): JSX.Element {
  const tr = makeT(language);
  const result = compareSpec(machine, spec);
  const tooltip = result.details.join(' · ');

  return (
    <tr>
      <td>
        <span className="minspec-app-icon" aria-hidden>
          {spec.icon}
        </span>
        <span className="minspec-app-name">{spec.name}</span>
        {spec.note && (
          <div className="minspec-note muted small">{spec.note}</div>
        )}
      </td>
      <td>
        <code>{formatSpec(spec.min)}</code>
      </td>
      <td>
        <code>{formatSpec(spec.recommended)}</code>
      </td>
      <td>
        <StatusBadge
          status={result.status}
          label={statusLabel(result.status, tr)}
          tooltip={tooltip}
        />
      </td>
    </tr>
  );
}

function statusLabel(
  status: CompareStatus,
  tr: (key: string) => string,
): string {
  if (status === 'pass') return tr('minspec.status_pass');
  if (status === 'warn') return tr('minspec.status_warn');
  return tr('minspec.status_fail');
}

interface StatusBadgeProps {
  status: CompareStatus;
  label: string;
  tooltip: string;
}

function StatusBadge({
  status,
  label,
  tooltip,
}: StatusBadgeProps): JSX.Element {
  const icon = status === 'pass' ? '✓' : status === 'warn' ? '⚠' : '✗';
  return (
    <span
      className={`minspec-status minspec-status-${status}`}
      title={tooltip || label}
    >
      {icon} {label}
    </span>
  );
}
