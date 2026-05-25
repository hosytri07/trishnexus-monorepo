import { useMemo, useState } from 'react';
import type { Language } from '../settings.js';
import { makeT } from '../i18n/index.js';
import {
  CATEGORY_LABELS,
  compareSpec,
  computeSpecPercent,
  formatSpec,
  type MachineSpec,
  type SoftwareSpec,
  type SpecCategory,
  type SpecRequirement,
} from '../data/min-specs.js';

/**
 * Phase 15.0.l — Min-spec compare table.
 *
 * Render bảng phần mềm phổ biến với status pass/warn/fail dựa MachineSpec.
 * Group theo category. Tooltip hiện chi tiết khi hover status badge.
 *
 * Wave 70.2 — Click card → mở detail modal (full spec OS/CPU/GPU/Disk).
 * Wave 70.3 — Admin có nút "+ Thêm phần mềm" — lưu custom local.
 */

interface MinSpecTableProps {
  language: Language;
  machine: MachineSpec;
  specs: SoftwareSpec[];
  source: 'remote' | 'bundled';
  onRefresh: () => void;
  refreshing: boolean;
  /** Wave 70.3 — admin có thể thêm/sửa/xoá phần mềm custom */
  isAdmin?: boolean;
  onAddCustom?: (spec: SoftwareSpec) => void;
  onDeleteCustom?: (id: string) => void;
}

export function MinSpecTable({
  language,
  machine,
  specs,
  source,
  onRefresh,
  refreshing,
  isAdmin = false,
  onAddCustom,
  onDeleteCustom,
}: MinSpecTableProps): JSX.Element {
  const tr = makeT(language);

  // Phase 68.2 — Filter + search state
  const [filterStatus, setFilterStatus] = useState<'all' | 'pass' | 'warn' | 'fail'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Wave 70.2 — Detail modal state
  const [detailSpec, setDetailSpec] = useState<SoftwareSpec | null>(null);

  // Wave 70.3 — Add custom software form modal
  const [addOpen, setAddOpen] = useState(false);

  // Compute status results once
  const results = useMemo(
    () => specs.map((spec) => ({ spec, result: compareSpec(machine, spec) })),
    [specs, machine],
  );

  // Summary counts
  const summary = useMemo(() => {
    let pass = 0, warn = 0, fail = 0;
    for (const r of results) {
      if (r.result.status === 'pass') pass++;
      else if (r.result.status === 'warn') warn++;
      else fail++;
    }
    return { pass, warn, fail, total: results.length };
  }, [results]);

  // Apply filter + search
  const filteredSpecs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return results
      .filter((r) => filterStatus === 'all' || r.result.status === filterStatus)
      .filter((r) => !q || r.spec.name.toLowerCase().includes(q))
      .map((r) => r.spec);
  }, [results, filterStatus, searchQuery]);

  // Group filtered by category
  const grouped = useMemo(() => {
    const map = new Map<string, SoftwareSpec[]>();
    for (const spec of filteredSpecs) {
      const list = map.get(spec.category) ?? [];
      list.push(spec);
      map.set(spec.category, list);
    }
    return map;
  }, [filteredSpecs]);

  // Smart upgrade suggestions: gather failed specs reasons
  const suggestions = useMemo(() => {
    const ramFails = results.filter((r) => r.result.status !== 'pass' && r.result.details.some((d) => d.toLowerCase().includes('ram'))).length;
    const cpuFails = results.filter((r) => r.result.status !== 'pass' && r.result.details.some((d) => d.toLowerCase().includes('cpu'))).length;
    const diskFails = results.filter((r) => r.result.status !== 'pass' && r.result.details.some((d) => d.toLowerCase().includes('disk') || d.toLowerCase().includes('ổ'))).length;
    const out: string[] = [];
    if (ramFails >= 3) out.push(`💡 Nâng cấp RAM → đáp ứng thêm ~${ramFails} phần mềm`);
    if (cpuFails >= 3) out.push(`💡 Nâng cấp CPU → đáp ứng thêm ~${cpuFails} phần mềm`);
    if (diskFails >= 3) out.push(`💡 Giải phóng ổ đĩa → đáp ứng thêm ~${diskFails} phần mềm`);
    return out;
  }, [results]);

  const passPct = summary.total > 0 ? Math.round((summary.pass / summary.total) * 100) : 0;

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
            {isAdmin && (
              <button
                type="button"
                className="btn btn-primary btn-small"
                onClick={() => setAddOpen(true)}
                title="Thêm phần mềm tuỳ chỉnh (chỉ admin)"
              >
                + Thêm phần mềm
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Phase 68.2 — Summary header card */}
      <div className="minspec-summary">
        <div className="minspec-summary-main">
          <div className="minspec-summary-pct">{passPct}%</div>
          <div className="minspec-summary-info">
            <div className="minspec-summary-title">
              Máy bạn đáp ứng <strong>{summary.pass}/{summary.total}</strong> phần mềm
            </div>
            <div className="minspec-summary-bar">
              {summary.pass > 0 && (
                <div className="minspec-summary-seg minspec-summary-seg-pass" style={{ width: `${(summary.pass / summary.total) * 100}%` }} title={`✓ Đạt: ${summary.pass}`} />
              )}
              {summary.warn > 0 && (
                <div className="minspec-summary-seg minspec-summary-seg-warn" style={{ width: `${(summary.warn / summary.total) * 100}%` }} title={`⚠ Marginal: ${summary.warn}`} />
              )}
              {summary.fail > 0 && (
                <div className="minspec-summary-seg minspec-summary-seg-fail" style={{ width: `${(summary.fail / summary.total) * 100}%` }} title={`✗ Fail: ${summary.fail}`} />
              )}
            </div>
            <div className="minspec-summary-legend">
              <span className="minspec-summary-legend-item"><span className="minspec-summary-dot minspec-summary-dot-pass" /> Đạt {summary.pass}</span>
              <span className="minspec-summary-legend-item"><span className="minspec-summary-dot minspec-summary-dot-warn" /> Marginal {summary.warn}</span>
              <span className="minspec-summary-legend-item"><span className="minspec-summary-dot minspec-summary-dot-fail" /> Fail {summary.fail}</span>
            </div>
          </div>
        </div>
        {suggestions.length > 0 && (
          <div className="minspec-suggestions">
            <div className="minspec-suggestions-title">Gợi ý nâng cấp:</div>
            {suggestions.map((s, i) => (
              <div key={i} className="minspec-suggestion">{s}</div>
            ))}
          </div>
        )}
      </div>

      {/* Filter chips + search */}
      <div className="minspec-toolbar">
        <div className="minspec-filter-chips">
          <button
            type="button"
            className={`cat-pill ${filterStatus === 'all' ? 'active' : ''}`}
            onClick={() => setFilterStatus('all')}
          >
            Tất cả <span className="cat-count">{summary.total}</span>
          </button>
          <button
            type="button"
            className={`cat-pill cat-pill-pass ${filterStatus === 'pass' ? 'active' : ''}`}
            onClick={() => setFilterStatus('pass')}
          >
            ✓ Đạt <span className="cat-count">{summary.pass}</span>
          </button>
          <button
            type="button"
            className={`cat-pill cat-pill-warn ${filterStatus === 'warn' ? 'active' : ''}`}
            onClick={() => setFilterStatus('warn')}
          >
            ⚠ Marginal <span className="cat-count">{summary.warn}</span>
          </button>
          <button
            type="button"
            className={`cat-pill cat-pill-fail ${filterStatus === 'fail' ? 'active' : ''}`}
            onClick={() => setFilterStatus('fail')}
          >
            ✗ Fail <span className="cat-count">{summary.fail}</span>
          </button>
        </div>
        <input
          type="text"
          placeholder="🔍 Tìm phần mềm..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="minspec-search"
        />
      </div>

      <div className="minspec-card-list">
        {Array.from(grouped.entries()).map(([category, specs]) => (
          <div key={category} className="minspec-cat-section">
            <div className="minspec-cat-title">
              {CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS] ?? category}
              <span className="cat-count">{specs.length}</span>
            </div>
            <div className="minspec-cards-grid">
              {specs.map((spec) => (
                <SoftwareCard
                  key={spec.id}
                  spec={spec}
                  machine={machine}
                  onClick={() => setDetailSpec(spec)}
                  isAdmin={isAdmin}
                  onDelete={
                    spec.custom && onDeleteCustom
                      ? () => onDeleteCustom(spec.id)
                      : undefined
                  }
                />
              ))}
            </div>
          </div>
        ))}
        {filteredSpecs.length === 0 && (
          <div className="empty">
            Không có phần mềm nào khớp filter "{searchQuery}".
          </div>
        )}
      </div>

      {/* Wave 70.2 — Detail modal */}
      {detailSpec && (
        <SoftwareDetailModal
          spec={detailSpec}
          machine={machine}
          onClose={() => setDetailSpec(null)}
        />
      )}

      {/* Wave 70.3 — Add custom modal */}
      {addOpen && onAddCustom && (
        <AddSoftwareModal
          onClose={() => setAddOpen(false)}
          onSubmit={(spec) => {
            onAddCustom(spec);
            setAddOpen(false);
          }}
        />
      )}
    </section>
  );
}

/** Phase 69.2 — Software card với 2 cấu hình side-by-side + 2 % compare */
function SoftwareCard({
  spec,
  machine,
  onClick,
  isAdmin,
  onDelete,
}: {
  spec: SoftwareSpec;
  machine: MachineSpec;
  onClick: () => void;
  isAdmin?: boolean;
  onDelete?: () => void;
}): JSX.Element {
  const result = compareSpec(machine, spec);
  const minPct = computeSpecPercent(machine, spec.min);
  const recPct = computeSpecPercent(machine, spec.recommended);

  const statusIcon = result.status === 'pass' ? '✓' : result.status === 'warn' ? '⚠' : '✗';
  const statusLabel =
    result.status === 'pass' ? 'Đạt' : result.status === 'warn' ? 'Marginal' : 'Không đủ';

  return (
    <div
      className="software-card software-card-clickable"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      title="Click để xem thông số chi tiết"
    >
      <div className="software-card-head">
        <span className="software-card-icon">{spec.icon}</span>
        <div className="software-card-title">
          <div className="software-card-name">
            {spec.name}
            {spec.custom && <span className="software-card-custom-tag">CUSTOM</span>}
          </div>
          {spec.note && (
            <div className="software-card-note">{spec.note}</div>
          )}
        </div>
        <span
          className={`software-status software-status-${result.status}`}
          title={result.details.join(' · ')}
        >
          {statusIcon} {statusLabel}
        </span>
      </div>

      <div className="software-specs-grid">
        <div className="software-spec-col">
          <div className="software-spec-label">Cấu hình tối thiểu</div>
          <div className="software-spec-value">{formatSpec(spec.min)}</div>
          <div className="software-spec-bar">
            <div
              className="software-spec-fill"
              style={{
                width: `${Math.min(100, minPct)}%`,
                background: minPct >= 100 ? '#10b981' : minPct >= 60 ? '#f59e0b' : '#ef4444',
              }}
            />
          </div>
          <div className="software-spec-pct" style={{ color: minPct >= 100 ? '#10b981' : minPct >= 60 ? '#f59e0b' : '#ef4444' }}>
            {minPct}% đáp ứng
          </div>
        </div>
        <div className="software-spec-col">
          <div className="software-spec-label">Cấu hình đề xuất</div>
          <div className="software-spec-value">{formatSpec(spec.recommended)}</div>
          <div className="software-spec-bar">
            <div
              className="software-spec-fill"
              style={{
                width: `${Math.min(100, recPct)}%`,
                background: recPct >= 100 ? '#10b981' : recPct >= 60 ? '#f59e0b' : '#ef4444',
              }}
            />
          </div>
          <div className="software-spec-pct" style={{ color: recPct >= 100 ? '#10b981' : recPct >= 60 ? '#f59e0b' : '#ef4444' }}>
            {recPct}% đáp ứng
          </div>
        </div>
      </div>

      {result.details.length > 0 && (
        <div className="software-card-detail">
          {result.details.slice(0, 2).map((d, i) => (
            <span key={i} className="software-detail-item">• {d}</span>
          ))}
        </div>
      )}

      <div className="software-card-foot">
        <span className="software-card-cta">Xem chi tiết →</span>
        {isAdmin && spec.custom && onDelete && (
          <button
            type="button"
            className="software-card-delete"
            onClick={(e) => {
              e.stopPropagation();
              if (window.confirm(`Xoá phần mềm "${spec.name}"?`)) {
                onDelete();
              }
            }}
            title="Xoá phần mềm này"
          >
            🗑
          </button>
        )}
      </div>
    </div>
  );
}

/** Wave 70.2 — Detail modal: hiển thị full thông số 2 cấu hình side-by-side */
function SoftwareDetailModal({
  spec,
  machine,
  onClose,
}: {
  spec: SoftwareSpec;
  machine: MachineSpec;
  onClose: () => void;
}): JSX.Element {
  const result = compareSpec(machine, spec);
  const minPct = computeSpecPercent(machine, spec.min);
  const recPct = computeSpecPercent(machine, spec.recommended);

  const statusIcon = result.status === 'pass' ? '✓' : result.status === 'warn' ? '⚠' : '✗';
  const statusLabel =
    result.status === 'pass' ? 'Máy bạn đạt cấu hình đề xuất'
      : result.status === 'warn' ? 'Máy bạn đạt mức tối thiểu — có thể chạy chậm'
      : 'Máy bạn chưa đạt cấu hình tối thiểu';

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card software-detail-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="software-detail-head">
          <span className="software-detail-icon">{spec.icon}</span>
          <div className="software-detail-title">
            <div className="software-detail-name">
              {spec.name}
              {spec.custom && <span className="software-card-custom-tag">CUSTOM</span>}
            </div>
            {spec.vendor && <div className="software-detail-vendor">{spec.vendor}</div>}
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-small"
            onClick={onClose}
            aria-label="Đóng"
          >
            ✕
          </button>
        </header>

        <div className={`software-detail-status software-detail-status-${result.status}`}>
          <span className="software-detail-status-icon">{statusIcon}</span>
          <div>
            <div className="software-detail-status-label">{statusLabel}</div>
            <div className="software-detail-machine">
              Máy bạn: {machine.cpu_cores}C / {machine.ram_gb} GB RAM / {machine.disk_free_gb.toFixed(0)} GB free
            </div>
          </div>
        </div>

        <div className="software-detail-cols">
          <SpecDetailColumn
            title="Cấu hình tối thiểu"
            subtitle="Chạy được nhưng có thể giật / chậm"
            req={spec.min}
            pct={minPct}
            accent="#f59e0b"
          />
          <SpecDetailColumn
            title="Cấu hình đề xuất"
            subtitle="Chạy mượt mà, dùng full tính năng"
            req={spec.recommended}
            pct={recPct}
            accent="#10b981"
          />
        </div>

        {result.details.length > 0 && (
          <div className="software-detail-reasons">
            <div className="software-detail-reasons-title">Lý do {result.status === 'fail' ? 'không đạt' : 'chưa đề xuất'}:</div>
            <ul>
              {result.details.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          </div>
        )}

        {spec.note && (
          <div className="software-detail-note">
            <strong>Ghi chú:</strong> {spec.note}
          </div>
        )}

        {spec.url && (
          <div className="software-detail-foot">
            <a
              href={spec.url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost btn-small"
            >
              🔗 Trang chính thức
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

function SpecDetailColumn({
  title,
  subtitle,
  req,
  pct,
  accent,
}: {
  title: string;
  subtitle: string;
  req: SpecRequirement;
  pct: number;
  accent: string;
}): JSX.Element {
  const color = pct >= 100 ? '#10b981' : pct >= 60 ? '#f59e0b' : '#ef4444';
  return (
    <div className="software-detail-col" style={{ borderTopColor: accent }}>
      <div className="software-detail-col-title">{title}</div>
      <div className="software-detail-col-subtitle">{subtitle}</div>

      <div className="software-detail-pct-row">
        <div className="software-detail-pct-bar">
          <div
            className="software-detail-pct-fill"
            style={{ width: `${Math.min(100, pct)}%`, background: color }}
          />
        </div>
        <div className="software-detail-pct-value" style={{ color }}>
          {pct}%
        </div>
      </div>

      <div className="software-detail-spec-grid">
        <SpecField label="🪟 OS" value={req.os ?? 'Windows 10/11'} />
        <SpecField label="⚙️ CPU" value={req.cpu_model ? `${req.cpu_cores} cores · ${req.cpu_model}` : `${req.cpu_cores} cores`} />
        <SpecField label="💾 RAM" value={`${req.ram_gb} GB`} />
        <SpecField label="💿 Ổ đĩa free" value={`${req.disk_free_gb} GB${req.ssd_recommended ? ' (SSD khuyến nghị)' : ''}`} />
        {req.gpu && <SpecField label="🎮 GPU" value={req.gpu} />}
        {req.notes && <SpecField label="📝 Ghi chú" value={req.notes} fullWidth />}
      </div>
    </div>
  );
}

function SpecField({
  label,
  value,
  fullWidth,
}: {
  label: string;
  value: string;
  fullWidth?: boolean;
}): JSX.Element {
  return (
    <div className={`software-spec-field ${fullWidth ? 'software-spec-field-full' : ''}`}>
      <div className="software-spec-field-label">{label}</div>
      <div className="software-spec-field-value">{value}</div>
    </div>
  );
}

/** Wave 70.3 — Form modal admin thêm phần mềm custom */
function AddSoftwareModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (spec: SoftwareSpec) => void;
}): JSX.Element {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('📦');
  const [category, setCategory] = useState<SpecCategory>('office');
  const [vendor, setVendor] = useState('');
  const [url, setUrl] = useState('');
  const [note, setNote] = useState('');

  // Min
  const [minCpu, setMinCpu] = useState(2);
  const [minRam, setMinRam] = useState(4);
  const [minDisk, setMinDisk] = useState(2);
  const [minOs, setMinOs] = useState('Windows 10/11 64-bit');
  const [minCpuModel, setMinCpuModel] = useState('');
  const [minGpu, setMinGpu] = useState('');

  // Recommended
  const [recCpu, setRecCpu] = useState(4);
  const [recRam, setRecRam] = useState(8);
  const [recDisk, setRecDisk] = useState(10);
  const [recOs, setRecOs] = useState('Windows 11 22H2+');
  const [recCpuModel, setRecCpuModel] = useState('');
  const [recGpu, setRecGpu] = useState('');
  const [recSsd, setRecSsd] = useState(true);

  function handleSubmit(): void {
    if (!name.trim()) {
      window.alert('Tên phần mềm không được để trống');
      return;
    }
    const id = `custom-${Date.now()}-${name.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 20)}`;
    const spec: SoftwareSpec = {
      id,
      name: name.trim(),
      icon: icon.trim() || '📦',
      category,
      vendor: vendor.trim() || undefined,
      url: url.trim() || undefined,
      note: note.trim() || undefined,
      custom: true,
      min: {
        cpu_cores: minCpu,
        ram_gb: minRam,
        disk_free_gb: minDisk,
        os: minOs.trim() || undefined,
        cpu_model: minCpuModel.trim() || undefined,
        gpu: minGpu.trim() || undefined,
      },
      recommended: {
        cpu_cores: recCpu,
        ram_gb: recRam,
        disk_free_gb: recDisk,
        os: recOs.trim() || undefined,
        cpu_model: recCpuModel.trim() || undefined,
        gpu: recGpu.trim() || undefined,
        ssd_recommended: recSsd,
      },
    };
    onSubmit(spec);
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card add-software-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="add-software-head">
          <h3>+ Thêm phần mềm tuỳ chỉnh</h3>
          <button
            type="button"
            className="btn btn-ghost btn-small"
            onClick={onClose}
            aria-label="Đóng"
          >
            ✕
          </button>
        </header>

        <div className="add-software-body">
          <div className="add-software-section">
            <div className="add-software-section-title">Thông tin chung</div>
            <div className="add-software-grid">
              <label className="add-software-field">
                <span>Tên phần mềm *</span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="VD: Blender 4.0"
                  autoFocus
                />
              </label>
              <label className="add-software-field">
                <span>Icon (emoji)</span>
                <input
                  type="text"
                  value={icon}
                  onChange={(e) => setIcon(e.target.value)}
                  placeholder="📦"
                  maxLength={4}
                />
              </label>
              <label className="add-software-field">
                <span>Danh mục</span>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as SpecCategory)}
                >
                  {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </label>
              <label className="add-software-field">
                <span>Nhà phát triển</span>
                <input
                  type="text"
                  value={vendor}
                  onChange={(e) => setVendor(e.target.value)}
                  placeholder="VD: Blender Foundation"
                />
              </label>
              <label className="add-software-field add-software-field-full">
                <span>URL trang chính thức</span>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://..."
                />
              </label>
              <label className="add-software-field add-software-field-full">
                <span>Ghi chú</span>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="VD: Cần GPU rời cho render Cycles"
                />
              </label>
            </div>
          </div>

          <div className="add-software-section">
            <div className="add-software-section-title">Cấu hình tối thiểu</div>
            <div className="add-software-grid">
              <label className="add-software-field">
                <span>CPU cores</span>
                <input type="number" min={1} max={64} value={minCpu} onChange={(e) => setMinCpu(Number(e.target.value))} />
              </label>
              <label className="add-software-field">
                <span>RAM (GB)</span>
                <input type="number" min={1} max={512} value={minRam} onChange={(e) => setMinRam(Number(e.target.value))} />
              </label>
              <label className="add-software-field">
                <span>Đĩa free (GB)</span>
                <input type="number" min={0} max={5000} value={minDisk} onChange={(e) => setMinDisk(Number(e.target.value))} />
              </label>
              <label className="add-software-field add-software-field-full">
                <span>OS</span>
                <input type="text" value={minOs} onChange={(e) => setMinOs(e.target.value)} />
              </label>
              <label className="add-software-field add-software-field-full">
                <span>CPU model</span>
                <input type="text" value={minCpuModel} onChange={(e) => setMinCpuModel(e.target.value)} placeholder="VD: Intel Core i3-6100" />
              </label>
              <label className="add-software-field add-software-field-full">
                <span>GPU</span>
                <input type="text" value={minGpu} onChange={(e) => setMinGpu(e.target.value)} placeholder="VD: 2 GB VRAM DirectX 11" />
              </label>
            </div>
          </div>

          <div className="add-software-section">
            <div className="add-software-section-title">Cấu hình đề xuất</div>
            <div className="add-software-grid">
              <label className="add-software-field">
                <span>CPU cores</span>
                <input type="number" min={1} max={64} value={recCpu} onChange={(e) => setRecCpu(Number(e.target.value))} />
              </label>
              <label className="add-software-field">
                <span>RAM (GB)</span>
                <input type="number" min={1} max={512} value={recRam} onChange={(e) => setRecRam(Number(e.target.value))} />
              </label>
              <label className="add-software-field">
                <span>Đĩa free (GB)</span>
                <input type="number" min={0} max={5000} value={recDisk} onChange={(e) => setRecDisk(Number(e.target.value))} />
              </label>
              <label className="add-software-field add-software-field-full">
                <span>OS</span>
                <input type="text" value={recOs} onChange={(e) => setRecOs(e.target.value)} />
              </label>
              <label className="add-software-field add-software-field-full">
                <span>CPU model</span>
                <input type="text" value={recCpuModel} onChange={(e) => setRecCpuModel(e.target.value)} placeholder="VD: Intel Core i7-12700K" />
              </label>
              <label className="add-software-field add-software-field-full">
                <span>GPU</span>
                <input type="text" value={recGpu} onChange={(e) => setRecGpu(e.target.value)} placeholder="VD: RTX 3060 8 GB VRAM" />
              </label>
              <label className="add-software-field add-software-field-checkbox">
                <input type="checkbox" checked={recSsd} onChange={(e) => setRecSsd(e.target.checked)} />
                <span>Khuyến nghị SSD</span>
              </label>
            </div>
          </div>
        </div>

        <footer className="add-software-foot">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Huỷ
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSubmit}>
            + Thêm phần mềm
          </button>
        </footer>
      </div>
    </div>
  );
}
