import { useEffect, useMemo, useState } from 'react';
import {
  getSysReport,
  getAppVersion,
  runCpuBenchmark,
  runMemoryBandwidth,
  runDiskBenchmark,
  getBatteryInfo,
  getTopProcesses,
  type SysReport,
  type BenchResult,
  type DiskBenchResult,
  type BatteryInfo,
  type TopProcesses,
  type ProcessInfo,
} from './tauri-bridge.js';
import {
  formatBytes,
  formatUptime,
} from './scoring.js';
import {
  loadSettings,
  saveSettings,
  applyTheme,
  type Settings,
} from './settings.js';
import { makeT } from './i18n/index.js';
import { SettingsModal } from './components/SettingsModal.js';
import { ActionsToolbar } from './components/ActionsToolbar.js';
import { MinSpecTable } from './components/MinSpecTable.js';
import { HistoryDrawer } from './components/HistoryDrawer.js';
import {
  loadSnapshots,
  pushSnapshot,
  deleteSnapshot,
  clearSnapshots,
  buildSnapshot,
  type Snapshot,
} from './lib/snapshots.js';
import { downloadReport, type ExportPayload } from './lib/exporters.js';
import { copyReportToClipboard } from './lib/clipboard.js';
import { loadMinSpecs, type SpecsLoadResult } from './lib/specs-loader.js';
import { SOFTWARE_SPECS, type MachineSpec } from './data/min-specs.js';
import logoUrl from './assets/logo.png';

/**
 * Phase 15.0 — TrishCheck v2 root component.
 *
 * Layout: topbar (brand + settings) → actions toolbar → tab bar
 * (System/Min-spec/History) → main content. Footer copyright.
 *
 * State management:
 *  - settings: theme/language/autoSnapshot (localStorage)
 *  - sys: SysReport cache (refresh on demand)
 *  - cpuBench/memBench: BenchResult sau khi run
 *  - snapshots: history list (localStorage)
 *  - tab: active tab string
 *
 * Auto-snapshot: nếu setting bật, mỗi lần benchmark xong tự push vào history.
 */

type Tab = 'system' | 'minspec' | 'history';

export function App(): JSX.Element {
  // Settings (lazy init từ localStorage)
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const tr = useMemo(() => makeT(settings.language), [settings.language]);

  // System info + benchmark
  const [sys, setSys] = useState<SysReport | null>(null);
  const [version, setVersion] = useState('dev');
  const [cpuBench, setCpuBench] = useState<BenchResult | null>(null);
  const [memBench, setMemBench] = useState<BenchResult | null>(null);
  const [diskBench, setDiskBench] = useState<DiskBenchResult | null>(null);
  const [running, setRunning] = useState(false);

  // Phase 15.0.n.B/C — Battery + top processes
  const [battery, setBattery] = useState<BatteryInfo | null>(null);
  const [topProc, setTopProc] = useState<TopProcesses | null>(null);

  // History
  const [snapshots, setSnapshots] = useState<Snapshot[]>(() => loadSnapshots());

  // Tab
  const [tab, setTab] = useState<Tab>('system');

  // Phase 15.0.l — Min-specs (admin-managed remote JSON, fallback bundled)
  const [specsResult, setSpecsResult] = useState<SpecsLoadResult>(() => ({
    specs: SOFTWARE_SPECS,
    source: 'bundled',
    fetchedAt: null,
    error: null,
  }));
  const [specsRefreshing, setSpecsRefreshing] = useState(false);

  // Apply theme khi mount + thay đổi
  useEffect(() => {
    applyTheme(settings.theme);
  }, [settings.theme]);

  // Initial fetch
  useEffect(() => {
    void getSysReport().then(setSys);
    void getAppVersion().then(setVersion);
    void getBatteryInfo().then(setBattery);
    void getTopProcesses(5).then(setTopProc);
    // Phase 15.0.l — load min-specs từ remote, fallback bundled
    void loadMinSpecs().then(setSpecsResult);
  }, []);

  // Compute machine spec cho MinSpec compare.
  // Phase 15.0.j fix:
  //  - RAM: OS report 31.7GB cho thanh 32GB (bytes giảm do hardware reserve).
  //    Round-half-up sang int GB → 31.7 → 32, khớp đúng spec yêu cầu "32GB".
  //  - Disk: max free trong các non-removable drives (software install
  //    drive nào có chỗ trống nhất). Disk thường rộng nên không cần round.
  const machineSpec: MachineSpec | null = useMemo(() => {
    if (!sys) return null;
    const rawRamGb = sys.total_memory_bytes / 1_073_741_824;
    const ramGb = Math.round(rawRamGb); // 31.7 → 32, 15.8 → 16
    const fixedDisks = sys.disks.filter((d) => !d.is_removable);
    const maxFree = fixedDisks.length
      ? Math.max(...fixedDisks.map((d) => d.available_bytes))
      : 0;
    const diskFreeGb = maxFree / 1_073_741_824;
    return {
      cpu_cores: sys.cpu_cores,
      ram_gb: ramGb,
      disk_free_gb: diskFreeGb,
    };
  }, [sys]);

  // Action: refresh sys info + battery + top processes
  const handleRefresh = async (): Promise<void> => {
    const [fresh, bat, top] = await Promise.all([
      getSysReport(),
      getBatteryInfo(),
      getTopProcesses(5),
    ]);
    setSys(fresh);
    setBattery(bat);
    setTopProc(top);
  };

  // Action: run all benchmarks (CPU + memory + disk)
  const handleBenchmark = async (): Promise<void> => {
    if (!sys || running) return;
    setRunning(true);
    try {
      const cpu = await runCpuBenchmark(3);
      setCpuBench(cpu);
      const mem = await runMemoryBandwidth(5);
      setMemBench(mem);
      const disk = await runDiskBenchmark(100);
      setDiskBench(disk);

      // Auto-snapshot nếu bật
      if (settings.autoSnapshot) {
        const snap = buildSnapshot(sys, cpu, mem, 'auto');
        setSnapshots((prev) => pushSnapshot(prev, snap));
      }
    } finally {
      setRunning(false);
    }
  };

  // Action: manual save snapshot
  const handleSnapshot = (): void => {
    if (!sys) return;
    const snap = buildSnapshot(sys, cpuBench, memBench, 'manual');
    setSnapshots((prev) => pushSnapshot(prev, snap));
  };

  // Action: copy report to clipboard
  const handleCopy = async (): Promise<boolean> => {
    if (!sys) return false;
    const payload = buildPayload(sys, cpuBench, memBench, version);
    return copyReportToClipboard(payload);
  };

  // Action: export
  // Phase 15.0.o — async vì Rust-side save trả Promise<path>. Sau khi lưu
  // xong hiện toast với path để user biết file ở đâu.
  const [exportToast, setExportToast] = useState<string | null>(null);
  const handleExport = async (format: 'json' | 'md'): Promise<void> => {
    if (!sys) return;
    const payload = buildPayload(sys, cpuBench, memBench, version);
    try {
      const savedPath = await downloadReport(payload, format);
      setExportToast(`Đã lưu: ${savedPath}`);
      setTimeout(() => setExportToast(null), 4000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setExportToast(`Lưu thất bại: ${msg}`);
      setTimeout(() => setExportToast(null), 4000);
    }
  };

  // Action: history delete
  const handleDelete = (taken_at: string): void => {
    setSnapshots((prev) => deleteSnapshot(prev, taken_at));
  };
  const handleClearAll = (): void => {
    setSnapshots(clearSnapshots());
  };

  // Action: refresh min-specs từ remote
  const handleRefreshSpecs = async (): Promise<void> => {
    if (specsRefreshing) return;
    setSpecsRefreshing(true);
    try {
      const result = await loadMinSpecs();
      setSpecsResult(result);
    } finally {
      setSpecsRefreshing(false);
    }
  };

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <img
            className="brand-logo"
            src={logoUrl}
            alt=""
            aria-hidden
            width={40}
            height={40}
          />
          <div>
            <strong>TrishCheck</strong>
            <div className="sub">{tr('topbar.tagline')}</div>
          </div>
        </div>
        <div className="topbar-actions">
          <button
            className="btn btn-ghost"
            onClick={() => setSettingsOpen(true)}
            type="button"
          >
            ⚙ {tr('topbar.settings')}
          </button>
          <span className="muted small">v{version}</span>
        </div>
      </header>

      <ActionsToolbar
        language={settings.language}
        benchRunning={running}
        hasBench={!!cpuBench}
        onRefresh={() => void handleRefresh()}
        onCopy={handleCopy}
        onExportJson={() => void handleExport('json')}
        onExportMd={() => void handleExport('md')}
        onSnapshot={handleSnapshot}
        onBenchmark={() => void handleBenchmark()}
      />

      {exportToast && (
        <div className="export-toast" role="status" aria-live="polite">
          {exportToast}
        </div>
      )}

      <nav className="tab-bar" role="tablist">
        <TabButton
          active={tab === 'system'}
          onClick={() => setTab('system')}
          label={tr('tab.system')}
        />
        <TabButton
          active={tab === 'minspec'}
          onClick={() => setTab('minspec')}
          label={tr('tab.minspec')}
        />
        <TabButton
          active={tab === 'history'}
          onClick={() => setTab('history')}
          label={`${tr('tab.history')} (${snapshots.length})`}
        />
      </nav>

      <main className="main-content">
        {tab === 'system' && (
          <SystemView
            sys={sys}
            cpuBench={cpuBench}
            memBench={memBench}
            diskBench={diskBench}
            battery={battery}
            topProc={topProc}
            language={settings.language}
          />
        )}
        {tab === 'minspec' && machineSpec && (
          <MinSpecTable
            language={settings.language}
            machine={machineSpec}
            specs={specsResult.specs}
            source={specsResult.source}
            onRefresh={() => void handleRefreshSpecs()}
            refreshing={specsRefreshing}
          />
        )}
        {tab === 'minspec' && !machineSpec && (
          <p className="muted">Đang đọc thông tin máy...</p>
        )}
        {tab === 'history' && (
          <HistoryDrawer
            language={settings.language}
            snapshots={snapshots}
            onDelete={handleDelete}
            onClearAll={handleClearAll}
          />
        )}
      </main>

      <footer className="foot">
        <span className="muted small">
          {tr('footer.copyright')} · trishteam.io.vn
        </span>
      </footer>

      {settingsOpen && (
        <SettingsModal
          initial={settings}
          onClose={() => setSettingsOpen(false)}
          onSave={(next) => {
            applyTheme(next.theme);
            setSettings(next);
            saveSettings(next);
            setSettingsOpen(false);
          }}
        />
      )}
    </div>
  );
}

// ============================================================
// Sub-components
// ============================================================

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  label: string;
}

function TabButton({ active, onClick, label }: TabButtonProps): JSX.Element {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      className={active ? 'tab tab-active' : 'tab'}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

interface SystemViewProps {
  sys: SysReport | null;
  cpuBench: BenchResult | null;
  memBench: BenchResult | null;
  diskBench: DiskBenchResult | null;
  battery: BatteryInfo | null;
  topProc: TopProcesses | null;
  language: 'vi' | 'en';
}

function SystemView({
  sys,
  cpuBench,
  memBench,
  diskBench,
  battery,
  topProc,
  language,
}: SystemViewProps): JSX.Element {
  const tr = makeT(language);
  if (!sys) {
    return <p className="muted">Đang đọc...</p>;
  }

  // Phase 15.0.o — bỏ tier evaluation: thông số kỹ thuật, không gợi ý chủ quan

  return (
    <>
      {/* System info */}
      <section className="panel">
        <h2>{tr('section.system')}</h2>
        <dl className="info-grid">
          <InfoRow label={tr('sys.os')} value={`${sys.os} ${sys.os_version}`} />
          <InfoRow label={tr('sys.arch')} value={sys.arch} />
          <InfoRow label={tr('sys.hostname')} value={sys.hostname} />
          <InfoRow
            label={tr('sys.uptime')}
            value={formatUptime(sys.uptime_seconds)}
          />
        </dl>
      </section>

      {/* CPU + RAM */}
      <section className="panel">
        <h2>{tr('section.cpu_ram')}</h2>
        <dl className="info-grid">
          <InfoRow label={tr('sys.cpu')} value={sys.cpu_brand || 'unknown'} />
          <InfoRow
            label={tr('sys.cpu_cores')}
            value={sys.cpu_cores ? String(sys.cpu_cores) : '—'}
          />
          <InfoRow
            label={tr('sys.cpu_freq')}
            value={
              sys.cpu_freq_mhz
                ? `${(sys.cpu_freq_mhz / 1000).toFixed(2)} GHz`
                : '—'
            }
          />
          <InfoRow
            label={tr('sys.ram_total')}
            value={formatBytes(sys.total_memory_bytes)}
          />
          <InfoRow
            label={tr('sys.ram_used')}
            value={formatBytes(sys.used_memory_bytes)}
          />
          <InfoRow
            label={tr('sys.swap')}
            value={formatBytes(sys.total_swap_bytes)}
          />
        </dl>
      </section>

      {/* GPU */}
      {sys.gpus.length > 0 && (
        <section className="panel">
          <h2>{tr('section.gpu')}</h2>
          <div className="gpu-grid">
            {sys.gpus.map((g, idx) => (
              <GpuCard key={`${g.name}-${idx}`} gpu={g} />
            ))}
          </div>
        </section>
      )}

      {/* Phase 15.0.n.B — Battery (laptop only) */}
      {battery && battery.has_battery && (
        <section className="panel">
          <h2>{tr('section.battery')}</h2>
          <BatteryCard battery={battery} language={language} />
        </section>
      )}

      {/* Phase 15.0.n.C — Top processes */}
      {topProc &&
        (topProc.by_memory.length > 0 || topProc.by_cpu.length > 0) && (
          <section className="panel">
            <h2>{tr('section.top_processes')}</h2>
            <div className="top-proc-grid">
              <TopProcessTable
                title={tr('top_proc.by_memory')}
                processes={topProc.by_memory}
                metric="memory"
              />
              <TopProcessTable
                title={tr('top_proc.by_cpu')}
                processes={topProc.by_cpu}
                metric="cpu"
              />
            </div>
          </section>
        )}

      {/* Disks */}
      {sys.disks.length > 0 && (
        <section className="panel">
          <h2>{tr('section.disk')}</h2>
          <div className="disk-grid">
            {sys.disks.map((d, idx) => (
              <DiskCard key={`${d.mount_point}-${idx}`} disk={d} language={language} />
            ))}
          </div>
        </section>
      )}

      {/* Networks */}
      {sys.networks.length > 0 && (
        <section className="panel">
          <h2>{tr('section.network')}</h2>
          <div className="network-grid">
            {sys.networks.slice(0, 6).map((n) => (
              <NetworkCard key={n.name} adapter={n} />
            ))}
          </div>
          {sys.networks.length > 6 && (
            <p className="muted small">
              + {sys.networks.length - 6} adapter khác
            </p>
          )}
        </section>
      )}

      {/* Benchmark — số liệu kỹ thuật, không đánh giá */}
      <section className="panel">
        <div className="panel-head">
          <h2>{tr('section.benchmark')}</h2>
        </div>
        <p className="muted small">{tr('bench.note')}</p>
        <BenchCard
          title={tr('bench.cpu')}
          result={cpuBench}
          unit={tr('bench.unit')}
          emptyLabel={tr('bench.empty')}
        />
        <BenchCard
          title={tr('bench.memory')}
          result={memBench}
          unit={tr('bench.unit')}
          emptyLabel={tr('bench.empty')}
        />
        <DiskBenchCard
          title={tr('bench.disk')}
          result={diskBench}
          emptyLabel={tr('bench.empty')}
        />
      </section>
    </>
  );
}

// ============================================================
// Battery + Top Processes + Disk bench cards
// ============================================================

interface BatteryCardProps {
  battery: BatteryInfo;
  language: 'vi' | 'en';
}

function BatteryCard({ battery, language }: BatteryCardProps): JSX.Element {
  const tr = makeT(language);
  // Health color: ≥80 green, ≥60 amber, <60 red
  const healthColor =
    battery.health_pct >= 80
      ? 'green'
      : battery.health_pct >= 60
        ? 'amber'
        : 'red';
  const healthLabel =
    battery.health_pct >= 80
      ? tr('battery.health_good')
      : battery.health_pct >= 60
        ? tr('battery.health_ok')
        : tr('battery.health_bad');

  return (
    <div className="battery-card">
      <div className="battery-row">
        <div className="battery-percent">
          <div className="battery-percent-big">{battery.percent}%</div>
          <div className="muted small">{battery.status_label}</div>
        </div>
        <div className="battery-bar-wrap">
          <div className="battery-bar">
            <div
              className="battery-bar-fill"
              style={{ width: `${battery.percent}%` }}
            />
          </div>
        </div>
      </div>
      {battery.design_capacity_mwh > 0 && (
        <dl className="battery-meta">
          <div>
            <dt>{tr('battery.design')}</dt>
            <dd>{(battery.design_capacity_mwh / 1000).toFixed(1)} Wh</dd>
          </div>
          <div>
            <dt>{tr('battery.full_charge')}</dt>
            <dd>
              {(battery.full_charge_capacity_mwh / 1000).toFixed(1)} Wh
            </dd>
          </div>
          <div>
            <dt>{tr('battery.health')}</dt>
            <dd>
              <span className={`tier tier-${healthColor}`}>
                {battery.health_pct}% — {healthLabel}
              </span>
            </dd>
          </div>
        </dl>
      )}
    </div>
  );
}

interface TopProcessTableProps {
  title: string;
  processes: ProcessInfo[];
  metric: 'memory' | 'cpu';
}

function TopProcessTable({
  title,
  processes,
  metric,
}: TopProcessTableProps): JSX.Element {
  if (processes.length === 0) {
    return (
      <div className="top-proc-card">
        <h3>{title}</h3>
        <p className="muted small">—</p>
      </div>
    );
  }
  return (
    <div className="top-proc-card">
      <h3>{title}</h3>
      <ul className="top-proc-list">
        {processes.map((p) => (
          <li key={p.pid}>
            <span className="top-proc-name" title={p.name}>
              {p.name || `pid:${p.pid}`}
            </span>
            <span className="top-proc-value">
              {metric === 'memory'
                ? formatBytes(p.memory_bytes)
                : `${p.cpu_percent.toFixed(1)}%`}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface DiskBenchCardProps {
  title: string;
  result: DiskBenchResult | null;
  emptyLabel: string;
}

function DiskBenchCard({
  title,
  result,
  emptyLabel,
}: DiskBenchCardProps): JSX.Element {
  if (!result) {
    return (
      <div className="bench-card bench-empty">
        <h3>{title}</h3>
        <p className="muted small">{emptyLabel}</p>
      </div>
    );
  }
  return (
    <div className="bench-card">
      <div className="bench-head">
        <h3>{title}</h3>
      </div>
      <div className="bench-numbers bench-disk-numbers">
        <div>
          <div className="big">
            {result.write_throughput_mb_per_s.toFixed(0)}
            <span className="unit"> MB/s</span>
          </div>
          <div className="muted small">Ghi (write)</div>
        </div>
        <div>
          <div className="big">
            {result.read_throughput_mb_per_s.toFixed(0)}
            <span className="unit"> MB/s</span>
          </div>
          <div className="muted small">Đọc (read)</div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string;
}): JSX.Element {
  return (
    <div className="info-row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

interface DiskCardProps {
  disk: SysReport['disks'][number];
  language: 'vi' | 'en';
}

function DiskCard({ disk, language }: DiskCardProps): JSX.Element {
  const tr = makeT(language);
  const used = disk.total_bytes - disk.available_bytes;
  const usedPct = disk.total_bytes
    ? (used / disk.total_bytes) * 100
    : 0;

  return (
    <div className="disk-card">
      <div className="disk-card-head">
        <strong>{disk.mount_point}</strong>
        <span className="muted small">{disk.file_system}</span>
        {disk.is_removable && (
          <span className="badge badge-removable">USB</span>
        )}
      </div>
      <div className="disk-bar">
        <div
          className="disk-bar-fill"
          style={{ width: `${Math.min(100, usedPct).toFixed(1)}%` }}
        />
      </div>
      <div className="disk-card-meta">
        <span>
          {tr('sys.disk_used')}: <b>{formatBytes(used)}</b>
        </span>
        <span>
          {tr('sys.disk_free')}: <b>{formatBytes(disk.available_bytes)}</b>
        </span>
        <span className="muted">
          / {formatBytes(disk.total_bytes)}
        </span>
      </div>
    </div>
  );
}

interface NetworkCardProps {
  adapter: SysReport['networks'][number];
}

function NetworkCard({ adapter }: NetworkCardProps): JSX.Element {
  return (
    <div className="network-card">
      <div className="network-card-head">
        <strong>{adapter.name}</strong>
        <code className="muted small">{adapter.mac_address}</code>
      </div>
      <div className="network-card-meta muted small">
        ↓ {formatBytes(adapter.received_bytes)} · ↑{' '}
        {formatBytes(adapter.transmitted_bytes)}
      </div>
    </div>
  );
}

interface GpuCardProps {
  gpu: SysReport['gpus'][number];
}

function GpuCard({ gpu }: GpuCardProps): JSX.Element {
  // VRAM = uint32 max (4_294_967_295) khi Win32 capped → show "≥4 GB"
  const isCapped = gpu.vram_bytes === 4_294_967_295;
  const vramLabel = isCapped
    ? '≥4 GB (giới hạn Win32)'
    : gpu.vram_bytes > 0
      ? formatBytes(gpu.vram_bytes)
      : '—';

  const vendorBadge = gpu.vendor !== 'unknown' ? gpu.vendor.toUpperCase() : '';
  const typeBadge = gpu.is_integrated ? 'iGPU' : 'dGPU';

  return (
    <div className="gpu-card">
      <div className="gpu-card-head">
        <strong>{gpu.name}</strong>
        <div className="gpu-card-badges">
          {vendorBadge && (
            <span className={`badge gpu-vendor-${gpu.vendor}`}>
              {vendorBadge}
            </span>
          )}
          <span className={`badge gpu-type-${gpu.is_integrated ? 'igpu' : 'dgpu'}`}>
            {typeBadge}
          </span>
        </div>
      </div>
      <dl className="gpu-card-meta">
        <div>
          <dt>VRAM</dt>
          <dd>{vramLabel}</dd>
        </div>
        {gpu.driver_version && (
          <div>
            <dt>Driver</dt>
            <dd>
              <code className="small">{gpu.driver_version}</code>
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}

interface BenchCardProps {
  title: string;
  result: BenchResult | null;
  unit: string;
  emptyLabel: string;
}

function BenchCard({
  title,
  result,
  unit,
  emptyLabel,
}: BenchCardProps): JSX.Element {
  if (!result) {
    return (
      <div className="bench-card bench-empty">
        <h3>{title}</h3>
        <p className="muted small">{emptyLabel}</p>
      </div>
    );
  }
  return (
    <div className="bench-card">
      <div className="bench-head">
        <h3>{title}</h3>
      </div>
      <div className="bench-numbers">
        <div className="big">
          {result.throughput_mb_per_s.toFixed(0)}
          <span className="unit"> {unit}</span>
        </div>
        <div className="muted small">
          {(result.bytes_processed / 1_048_576).toFixed(0)} MB trong{' '}
          {result.elapsed_ms} ms
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Helpers
// ============================================================

function buildPayload(
  sys: SysReport,
  cpu: BenchResult | null,
  mem: BenchResult | null,
  app_version: string,
): ExportPayload {
  return {
    sys,
    cpu_bench: cpu,
    mem_bench: mem,
    generated_at: new Date().toISOString(),
    app_version,
  };
}
