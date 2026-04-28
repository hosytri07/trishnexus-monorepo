'use client';

/**
 * /cong-cu/vn2000 — Phase 19.20 — VN2000 ↔ WGS84 converter UI.
 *
 * Single-point converter với 2 panel — input + output.
 * Hỗ trợ DD (decimal degrees) và DMS (degrees-minutes-seconds).
 */
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRightLeft, Compass, Copy, Info } from 'lucide-react';
import {
  wgs84ToVn2000,
  vn2000ToWgs84,
  ddToDms,
  dmsToDd,
} from '@/lib/vn2000';

type Direction = 'wgs2vn' | 'vn2wgs';
type Format = 'dd' | 'dms';

export default function Vn2000Page() {
  const [dir, setDir] = useState<Direction>('wgs2vn');
  const [format, setFormat] = useState<Format>('dd');
  const [latIn, setLatIn] = useState('21.0285');
  const [lonIn, setLonIn] = useState('105.8542');
  const [hIn, setHIn] = useState('0');
  const [copied, setCopied] = useState<string | null>(null);

  const result = useMemo(() => {
    const lat = format === 'dd' ? parseFloat(latIn) : dmsToDd(latIn);
    const lon = format === 'dd' ? parseFloat(lonIn) : dmsToDd(lonIn);
    const h = parseFloat(hIn);
    if (lat === null || lon === null || isNaN(lat) || isNaN(lon)) return null;
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
    const transformed =
      dir === 'wgs2vn'
        ? wgs84ToVn2000({ lat, lon, h: isNaN(h) ? 0 : h })
        : vn2000ToWgs84({ lat, lon, h: isNaN(h) ? 0 : h });
    return transformed;
  }, [latIn, lonIn, hIn, format, dir]);

  function swap() {
    if (!result) return;
    setDir(dir === 'wgs2vn' ? 'vn2wgs' : 'wgs2vn');
    setLatIn(format === 'dd' ? result.lat.toFixed(8) : ddToDms(result.lat, true));
    setLonIn(format === 'dd' ? result.lon.toFixed(8) : ddToDms(result.lon, false));
    setHIn((result.h ?? 0).toFixed(3));
  }

  async function copy(text: string, key: string) {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1800);
  }

  const fromLabel = dir === 'wgs2vn' ? 'WGS84' : 'VN2000';
  const toLabel = dir === 'wgs2vn' ? 'VN2000' : 'WGS84';

  return (
    <main className="max-w-3xl mx-auto px-6 py-8">
      <Link
        href="/"
        className="inline-flex items-center gap-2 mb-6 text-sm transition-opacity hover:opacity-80"
        style={{ color: 'var(--color-text-muted)' }}
      >
        <ArrowLeft size={15} /> Quay lại Dashboard
      </Link>

      <header className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Compass size={26} strokeWidth={1.75} style={{ color: 'var(--color-accent-primary)' }} />
          <h1 className="text-3xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
            VN2000 ↔ WGS84
          </h1>
        </div>
        <p className="text-base" style={{ color: 'var(--color-text-secondary)' }}>
          Chuyển đổi toạ độ giữa hệ VN2000 (chuẩn quốc gia, ellipsoid Krasovsky) và WGS84
          (GPS quốc tế) qua phép biến đổi Helmert 7-tham số (Quyết định 05/2007/QĐ-BTNMT).
        </p>
      </header>

      {/* Direction toggle */}
      <div
        className="rounded-xl border p-5 mb-4"
        style={{ background: 'var(--color-surface-card)', borderColor: 'var(--color-border-default)' }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="inline-flex p-0.5 rounded-md" style={{ background: 'var(--color-surface-bg_elevated)' }}>
            <DirBtn active={dir === 'wgs2vn'} onClick={() => setDir('wgs2vn')} label="WGS84 → VN2000" />
            <DirBtn active={dir === 'vn2wgs'} onClick={() => setDir('vn2wgs')} label="VN2000 → WGS84" />
          </div>
          <div className="inline-flex p-0.5 rounded-md" style={{ background: 'var(--color-surface-bg_elevated)' }}>
            <DirBtn active={format === 'dd'} onClick={() => setFormat('dd')} label="DD" />
            <DirBtn active={format === 'dms'} onClick={() => setFormat('dms')} label="DMS" />
          </div>
        </div>

        {/* Input + Output */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-stretch">
          {/* INPUT */}
          <section>
            <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--color-accent-primary)' }}>
              Input ({fromLabel})
            </div>
            <Field label="Vĩ độ (lat)" placeholder={format === 'dd' ? '21.0285' : '21°01\'42.6"N'} value={latIn} onChange={setLatIn} />
            <Field label="Kinh độ (lon)" placeholder={format === 'dd' ? '105.8542' : '105°51\'15.1"E'} value={lonIn} onChange={setLonIn} />
            <Field label="Cao độ h (m)" placeholder="0" value={hIn} onChange={setHIn} numeric />
          </section>

          {/* Swap button */}
          <div className="flex md:flex-col items-center justify-center pt-6">
            <button
              type="button"
              onClick={swap}
              disabled={!result}
              className="inline-flex items-center justify-center w-10 h-10 rounded-full transition-all hover:bg-[var(--color-surface-muted)] disabled:opacity-30"
              style={{ color: 'var(--color-accent-primary)' }}
              title="Đảo chiều + đưa kết quả thành input"
            >
              <ArrowRightLeft size={18} />
            </button>
          </div>

          {/* OUTPUT */}
          <section>
            <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#10B981' }}>
              Output ({toLabel})
            </div>
            {result ? (
              <>
                <OutField
                  label="Vĩ độ"
                  value={
                    format === 'dd' ? result.lat.toFixed(8) : ddToDms(result.lat, true)
                  }
                  onCopy={() =>
                    copy(format === 'dd' ? result.lat.toFixed(8) : ddToDms(result.lat, true), 'lat')
                  }
                  copied={copied === 'lat'}
                />
                <OutField
                  label="Kinh độ"
                  value={
                    format === 'dd' ? result.lon.toFixed(8) : ddToDms(result.lon, false)
                  }
                  onCopy={() =>
                    copy(format === 'dd' ? result.lon.toFixed(8) : ddToDms(result.lon, false), 'lon')
                  }
                  copied={copied === 'lon'}
                />
                <OutField
                  label="Cao độ h"
                  value={(result.h ?? 0).toFixed(3) + ' m'}
                  onCopy={() => copy((result.h ?? 0).toFixed(3), 'h')}
                  copied={copied === 'h'}
                />
              </>
            ) : (
              <div
                className="text-sm h-32 flex items-center justify-center rounded-md"
                style={{
                  background: 'var(--color-surface-bg_elevated)',
                  color: 'var(--color-text-muted)',
                }}
              >
                Nhập lat/lon hợp lệ
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Info box */}
      <div
        className="rounded-xl border p-4"
        style={{
          background: 'var(--color-accent-soft)',
          borderColor: 'var(--color-accent-primary)',
          borderLeftWidth: 3,
        }}
      >
        <div className="flex items-start gap-3 text-sm">
          <Info size={16} strokeWidth={2} style={{ color: 'var(--color-accent-primary)' }} className="shrink-0 mt-0.5" />
          <div style={{ color: 'var(--color-text-primary)' }}>
            <p className="mb-1.5">
              <strong>Tham số Helmert 7-param trung bình quốc gia</strong> theo Quyết định
              05/2007/QĐ-BTNMT. Sai số kỳ vọng <strong>±5m</strong>.
            </p>
            <p style={{ color: 'var(--color-text-secondary)' }}>
              Cho công trình chính xác (định vị mốc, cắm cọc) cần dùng tham số riêng từng
              tỉnh — liên hệ Sở TN&MT tỉnh để xin tham số chính thức.
            </p>
          </div>
        </div>
      </div>

      <p className="mt-4 text-xs" style={{ color: 'var(--color-text-muted)' }}>
        Test: Tọa độ Hà Nội WGS84 (21.0285, 105.8542) → VN2000 ≈ (21.0271, 105.8527, -111m).
      </p>
    </main>
  );
}

function DirBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center px-3 h-9 rounded text-xs font-semibold transition-colors"
      style={{
        background: active ? 'var(--color-accent-soft)' : 'transparent',
        color: active ? 'var(--color-accent-primary)' : 'var(--color-text-muted)',
      }}
    >
      {label}
    </button>
  );
}

function Field({
  label,
  placeholder,
  value,
  onChange,
  numeric = false,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  numeric?: boolean;
}) {
  return (
    <div className="mb-2">
      <label className="text-[10px] uppercase tracking-wider mb-1 inline-block" style={{ color: 'var(--color-text-muted)' }}>
        {label}
      </label>
      <input
        type={numeric ? 'number' : 'text'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-10 px-3 rounded-md outline-none border text-sm font-mono"
        style={{
          background: 'var(--color-surface-bg_elevated)',
          borderColor: 'var(--color-border-default)',
          color: 'var(--color-text-primary)',
        }}
      />
    </div>
  );
}

function OutField({
  label,
  value,
  onCopy,
  copied,
}: {
  label: string;
  value: string;
  onCopy: () => void;
  copied: boolean;
}) {
  return (
    <div className="mb-2">
      <label className="text-[10px] uppercase tracking-wider mb-1 inline-block" style={{ color: 'var(--color-text-muted)' }}>
        {label}
      </label>
      <div className="flex gap-1">
        <div
          className="flex-1 h-10 px-3 rounded-md flex items-center text-sm font-mono"
          style={{
            background: 'rgba(16,185,129,0.10)',
            border: '1px solid rgba(16,185,129,0.4)',
            color: 'var(--color-text-primary)',
          }}
        >
          {value}
        </div>
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex items-center justify-center w-10 h-10 rounded-md transition-colors hover:bg-[var(--color-surface-muted)]"
          style={{ color: copied ? '#10B981' : 'var(--color-text-muted)', border: '1px solid var(--color-border-default)' }}
          title={copied ? 'Đã copy' : 'Copy'}
        >
          <Copy size={14} />
        </button>
      </div>
    </div>
  );
}
