'use client';

/**
 * GoldPricesWidget — card giá vàng (SJC).
 * Dùng chung hook usePricesData với GasPricesWidget — 1 request tới /api/prices.
 */
import { Coins, ExternalLink, RefreshCw } from 'lucide-react';
import { WidgetCard } from './widget-card';
import { usePricesData } from '@/lib/prices-store';

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

export function GoldPricesWidget() {
  const { data, loading, error, refresh } = usePricesData();
  const gold = data?.gold;
  const isStale = !!gold?.error;

  return (
    <WidgetCard
      title="Giá vàng"
      icon={<Coins size={16} strokeWidth={2} />}
      action={
        <button
          type="button"
          onClick={refresh}
          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors hover:opacity-80"
          style={{ color: 'var(--color-text-muted)' }}
          disabled={loading}
          aria-label="Làm mới giá vàng"
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
      {error && !gold && (
        <div
          className="text-sm py-6 text-center"
          style={{ color: 'var(--color-text-muted)' }}
        >
          Không tải được giá. {error}
        </div>
      )}

      {gold && isStale && (
        <div
          className="text-[10px] uppercase tracking-wide mb-2 px-2 py-1 rounded inline-block"
          style={{
            background: 'rgba(245,158,11,0.12)',
            color: '#F59E0B',
            border: '1px solid rgba(245,158,11,0.30)',
          }}
        >
          Ước lượng · chưa lấy được realtime
        </div>
      )}

      {gold && (
        <div className="tt-gold-scroll">
          <div
            className="grid grid-cols-[1fr_auto_auto] items-center gap-2 pb-1 mb-0.5 text-[10px] uppercase tracking-wide border-b"
            style={{
              borderColor: 'var(--color-border-subtle)',
              color: 'var(--color-text-muted)',
            }}
          >
            <span>Loại</span>
            <span className="text-right">Mua</span>
            <span className="text-right">Bán</span>
          </div>
          <ul className="space-y-0.5">
            {gold.items.map((it) => (
              <li
                key={it.name}
                className="grid grid-cols-[1fr_auto_auto] items-center gap-2 py-1 border-b last:border-0 text-xs"
                style={{ borderColor: 'var(--color-border-subtle)' }}
              >
                <span
                  className="truncate"
                  style={{ color: 'var(--color-text-primary)' }}
                  title={it.name}
                >
                  {it.name}
                </span>
                <span
                  className="tabular-nums text-right font-semibold"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  {formatVND(it.buy)}
                </span>
                <span
                  className="tabular-nums text-right font-semibold"
                  style={{ color: '#F59E0B' }}
                >
                  {formatVND(it.sell)}
                </span>
              </li>
            ))}
          </ul>
          <style jsx>{`
            .tt-gold-scroll {
              max-height: 200px;
              overflow-y: auto;
              scrollbar-width: thin;
              scrollbar-color: var(--color-border-default) transparent;
              scroll-behavior: smooth;
              padding-right: 4px;
            }
            .tt-gold-scroll::-webkit-scrollbar {
              width: 4px;
            }
            .tt-gold-scroll::-webkit-scrollbar-track {
              background: transparent;
            }
            .tt-gold-scroll::-webkit-scrollbar-thumb {
              background: var(--color-border-default);
              border-radius: 4px;
            }
            .tt-gold-scroll:hover::-webkit-scrollbar-thumb {
              background: var(--color-accent-primary);
            }
          `}</style>
        </div>
      )}

      {data && gold && (
        <div
          className="flex items-center justify-between mt-3 pt-2 border-t text-[10px]"
          style={{
            borderColor: 'var(--color-border-subtle)',
            color: 'var(--color-text-muted)',
          }}
        >
          <a
            href={gold.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 hover:opacity-70 transition-opacity"
          >
            Nguồn: {gold.source}
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
