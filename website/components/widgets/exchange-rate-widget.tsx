'use client';

/**
 * ExchangeRateWidget — tỷ giá ngoại tệ sang VND.
 * Fetch /api/exchange-rate (cache 1h), hiển thị list ccy → VND với flag emoji.
 */
import { useEffect, useState } from 'react';
import { DollarSign, ExternalLink, RefreshCw } from 'lucide-react';
import { WidgetCard } from './widget-card';

type Rate = { code: string; name: string; per_vnd: number };

type ERResponse = {
  ok: boolean;
  updated_at: string;
  source: string;
  url: string;
  rates: Rate[];
  error?: string;
};

const FLAGS: Record<string, string> = {
  USD: '🇺🇸',
  EUR: '🇪🇺',
  GBP: '🇬🇧',
  JPY: '🇯🇵',
  CNY: '🇨🇳',
  KRW: '🇰🇷',
  THB: '🇹🇭',
  AUD: '🇦🇺',
};

function formatVND(n: number): string {
  return n.toLocaleString('vi-VN');
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'vừa xong';
  if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
  return d.toLocaleDateString('vi-VN');
}

export function ExchangeRateWidget() {
  const [data, setData] = useState<ERResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(nonce === 0 ? '/api/exchange-rate' : `/api/exchange-rate?r=${nonce}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<ERResponse>;
      })
      .then((json) => {
        if (cancelled) return;
        setData(json);
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(String(e));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [nonce]);

  const isStale = !!data?.error;

  return (
    <WidgetCard
      title="Tỷ giá ngoại tệ"
      icon={<DollarSign size={16} strokeWidth={2} />}
      action={
        <button
          type="button"
          onClick={() => setNonce((n) => n + 1)}
          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors hover:opacity-80"
          style={{ color: 'var(--color-text-muted)' }}
          disabled={loading}
          aria-label="Làm mới tỷ giá"
          title="Làm mới"
        >
          <RefreshCw
            size={12}
            strokeWidth={2}
            className={loading ? 'animate-spin' : ''}
          />
          {loading ? 'Tải…' : 'Làm mới'}
        </button>
      }
    >
      {error && !data && (
        <div
          className="text-sm py-6 text-center"
          style={{ color: 'var(--color-text-muted)' }}
        >
          Không tải được tỷ giá. {error}
        </div>
      )}

      {data && isStale && (
        <div
          className="text-[10px] uppercase tracking-wide mb-2 px-2 py-1 rounded inline-block"
          style={{
            background: 'rgba(245,158,11,0.12)',
            color: '#F59E0B',
            border: '1px solid rgba(245,158,11,0.30)',
          }}
        >
          Ước lượng · API không phản hồi
        </div>
      )}

      {data && (
        <div className="tt-scroll-wrap">
          <ul className="space-y-0.5">
            {data.rates.map((r) => (
              <li
                key={r.code}
                className="grid grid-cols-[auto_1fr_auto] items-center gap-2 py-1 border-b last:border-0 text-xs"
                style={{ borderColor: 'var(--color-border-subtle)' }}
              >
                <span className="text-sm leading-none" aria-hidden="true">
                  {FLAGS[r.code] ?? '🏳️'}
                </span>
                <div className="min-w-0">
                  <div
                    className="font-semibold text-xs leading-tight"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    {r.code}
                  </div>
                  <div
                    className="text-[10px] truncate leading-tight"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    {r.name}
                  </div>
                </div>
                <span
                  className="tabular-nums font-semibold shrink-0 text-xs"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  {formatVND(r.per_vnd)}
                  <span
                    className="text-[10px] font-normal ml-0.5"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    đ
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <style jsx>{`
            .tt-scroll-wrap {
              max-height: 200px;
              overflow-y: auto;
              scrollbar-width: thin;
              scrollbar-color: var(--color-border-default) transparent;
              scroll-behavior: smooth;
              padding-right: 4px;
              mask-image: linear-gradient(
                to bottom,
                transparent 0,
                black 8px,
                black calc(100% - 8px),
                transparent 100%
              );
              -webkit-mask-image: linear-gradient(
                to bottom,
                transparent 0,
                black 8px,
                black calc(100% - 8px),
                transparent 100%
              );
            }
            .tt-scroll-wrap::-webkit-scrollbar {
              width: 4px;
            }
            .tt-scroll-wrap::-webkit-scrollbar-track {
              background: transparent;
            }
            .tt-scroll-wrap::-webkit-scrollbar-thumb {
              background: var(--color-border-default);
              border-radius: 4px;
              transition: background 0.15s;
            }
            .tt-scroll-wrap:hover::-webkit-scrollbar-thumb {
              background: var(--color-accent-primary);
            }
          `}</style>
        </div>
      )}

      {data && (
        <div
          className="flex items-center justify-between mt-3 pt-2 border-t text-[10px]"
          style={{
            borderColor: 'var(--color-border-subtle)',
            color: 'var(--color-text-muted)',
          }}
        >
          <a
            href={data.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 hover:opacity-70 transition-opacity"
          >
            Nguồn: {data.source}
            <ExternalLink size={9} strokeWidth={2} />
          </a>
          <span className="tabular-nums">
            Cập nhật {formatRelative(data.updated_at)}
          </span>
        </div>
      )}
    </WidgetCard>
  );
}
