'use client';

/**
 * CountdownClock — Phase 19.22.
 *
 * Đồng hồ đếm ngược realtime tự update mỗi giây tới release_at.
 *
 * Format: "4n 23:59:42" (4 ngày 23 giờ 59 phút 42 giây)
 * Khi đã qua release_at: hiện "Đã phát hành"
 *
 * Auto-cleanup interval khi unmount hoặc đã đến giờ.
 */
import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';

interface Props {
  releaseAt: string;
  /** Hiện icon đồng hồ phía trước. Default true. */
  showIcon?: boolean;
  /** Hiện chữ "Còn" prefix. Default false. */
  showLabel?: boolean;
  className?: string;
  style?: React.CSSProperties;
  iconSize?: number;
}

export function CountdownClock({
  releaseAt,
  showIcon = true,
  showLabel = false,
  className = '',
  style,
  iconSize = 11,
}: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const target = new Date(releaseAt).getTime();
    if (isNaN(target) || Date.now() >= target) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [releaseAt]);

  const target = new Date(releaseAt).getTime();
  if (isNaN(target)) {
    return <span className={className} style={style}>—</span>;
  }
  const diff = target - now;

  if (diff <= 0) {
    return (
      <span className={`inline-flex items-center gap-1 ${className}`} style={style}>
        {showIcon ? <Clock size={iconSize} /> : null}
        Đã phát hành
      </span>
    );
  }

  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const mins = Math.floor((diff % 3_600_000) / 60_000);
  const secs = Math.floor((diff % 60_000) / 1_000);

  const pad = (n: number) => n.toString().padStart(2, '0');
  const text = days > 0
    ? `${days}n ${pad(hours)}:${pad(mins)}:${pad(secs)}`
    : `${pad(hours)}:${pad(mins)}:${pad(secs)}`;

  return (
    <span
      className={`inline-flex items-center gap-1 tabular-nums font-mono ${className}`}
      style={style}
    >
      {showIcon ? <Clock size={iconSize} /> : null}
      {showLabel ? 'Còn ' : ''}{text}
    </span>
  );
}
