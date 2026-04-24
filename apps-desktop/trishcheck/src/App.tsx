import { useEffect, useState } from 'react';
import {
  getSysReport,
  getAppVersion,
  runCpuBenchmark,
  runMemoryBandwidth,
  type SysReport,
  type BenchResult,
} from './tauri-bridge.js';
import {
  cpuTier,
  memoryTier,
  formatBytes,
  formatUptime,
  type TierInfo,
} from './scoring.js';

export function App(): JSX.Element {
  const [sys, setSys] = useState<SysReport | null>(null);
  const [version, setVersion] = useState('dev');
  const [cpu, setCpu] = useState<BenchResult | null>(null);
  const [mem, setMem] = useState<BenchResult | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    void getSysReport().then(setSys);
    void getAppVersion().then(setVersion);
  }, []);

  async function runAll() {
    setRunning(true);
    try {
      const cpuRes = await runCpuBenchmark(3);
      setCpu(cpuRes);
      const memRes = await runMemoryBandwidth(5);
      setMem(memRes);
    } finally {
      setRunning(false);
    }
  }

  const cpuInfo = cpu ? cpuTier(cpu.throughput_mb_per_s) : null;
  const memInfo = mem ? memoryTier(mem.throughput_mb_per_s) : null;

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="logo" aria-hidden>◐</span>
          <div>
            <strong>TrishCheck</strong>
            <div className="sub">Kiểm tra máy có đủ sức chạy ecosystem TrishTEAM</div>
          </div>
        </div>
        <span className="muted small">v{version}</span>
      </header>

      <section className="panel">
        <h2>Thông tin máy</h2>
        {!sys && <p className="muted">Đang đọc...</p>}
        {sys && (
          <dl className="info-grid">
            <InfoRow label="Hệ điều hành" value={`${sys.os} ${sys.os_version}`} />
            <InfoRow label="Kiến trúc" value={sys.arch} />
            <InfoRow label="CPU" value={sys.cpu_brand || 'unknown'} />
            <InfoRow label="Số nhân" value={sys.cpu_cores ? String(sys.cpu_cores) : '—'} />
            <InfoRow
              label="Xung nhịp"
              value={sys.cpu_freq_mhz ? `${(sys.cpu_freq_mhz / 1000).toFixed(2)} GHz` : '—'}
            />
            <InfoRow label="RAM tổng" value={formatBytes(sys.total_memory_bytes)} />
            <InfoRow label="RAM đang dùng" value={formatBytes(sys.used_memory_bytes)} />
            <InfoRow label="Swap" value={formatBytes(sys.total_swap_bytes)} />
            <InfoRow label="Uptime" value={formatUptime(sys.uptime_seconds)} />
            <InfoRow label="Hostname" value={sys.hostname} />
          </dl>
        )}
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Benchmark</h2>
          <button className="btn btn-primary" disabled={running} onClick={runAll}>
            {running ? 'Đang chạy…' : cpu ? 'Chạy lại' : 'Bắt đầu kiểm tra'}
          </button>
        </div>
        <p className="muted small">
          Bench CPU (SHA-256) và memory bandwidth. Mất ~2-5 giây. Kết quả
          không gửi về server — chỉ hiển thị local.
        </p>

        <BenchCard title="CPU (SHA-256)" result={cpu} info={cpuInfo} unit="MB/s" />
        <BenchCard title="Memory bandwidth" result={mem} info={memInfo} unit="MB/s" />
      </section>

      <footer className="foot">
        <span className="muted small">
          © 2026 TrishTEAM · trishteam.io.vn
        </span>
      </footer>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="info-row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

interface BenchCardProps {
  title: string;
  result: BenchResult | null;
  info: TierInfo | null;
  unit: string;
}

function BenchCard({ title, result, info, unit }: BenchCardProps): JSX.Element {
  if (!result || !info) {
    return (
      <div className="bench-card bench-empty">
        <h3>{title}</h3>
        <p className="muted small">Chưa có dữ liệu</p>
      </div>
    );
  }
  return (
    <div className="bench-card">
      <div className="bench-head">
        <h3>{title}</h3>
        <span className={`tier tier-${info.color}`}>{info.label}</span>
      </div>
      <div className="bench-numbers">
        <div className="big">
          {result.throughput_mb_per_s.toFixed(0)}
          <span className="unit"> {unit}</span>
        </div>
        <div className="muted small">
          {formatMB(result.bytes_processed)} trong {result.elapsed_ms} ms
        </div>
      </div>
      <p className="bench-desc">{info.description}</p>
    </div>
  );
}

function formatMB(bytes: number): string {
  return `${(bytes / 1_048_576).toFixed(0)} MB`;
}
