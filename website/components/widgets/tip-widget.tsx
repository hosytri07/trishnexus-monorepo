'use client';

/**
 * DailyTipWidget — tip xoay vòng theo ngày.
 * Pool gồm: traffic sign (QC41), fact về cầu VN, engineering tip.
 * Seed bằng date string (YYYY-MM-DD) → cùng 1 tip trong 1 ngày across reload.
 * Phase 11.2c/d sẽ thay pool hardcode bằng random từ data file.
 */
import { useMemo } from 'react';
import { Lightbulb, RefreshCw } from 'lucide-react';
import { useState, useEffect } from 'react';
import { WidgetCard } from './widget-card';

type Tip = {
  category: 'Biển báo' | 'Cầu VN' | 'Engineering' | 'Mẹo';
  title: string;
  body: string;
  accent: string;
};

const POOL: Tip[] = [
  {
    category: 'Biển báo',
    title: 'Biển 401 — Đường một chiều',
    body: 'Biển P.401 có hình chữ nhật nền xanh, mũi tên trắng chỉ chiều đi. Cấm quay đầu ngược chiều, kể cả khi đường vắng.',
    accent: '#EF4444',
  },
  {
    category: 'Cầu VN',
    title: 'Cầu Rồng · Đà Nẵng',
    body: 'Thông xe 2013, dài 666m, kỷ lục cầu hình rồng lớn nhất Đông Nam Á. Mỗi tối Thứ Bảy & Chủ Nhật 21h phun lửa + phun nước.',
    accent: '#10B981',
  },
  {
    category: 'Engineering',
    title: 'Định mức dự toán 2024',
    body: 'Thông tư 12/2021/TT-BXD thay cho TT 10/2019. Định mức vật liệu bê tông thay đổi ~3-5% tuỳ mác. Kiểm lại cost estimates cũ.',
    accent: '#4ADE80',
  },
  {
    category: 'Mẹo',
    title: 'Shortcut AutoCAD ít người biết',
    body: 'Gõ OP → tab Display → uncheck "Use large buttons for Toolbars" để nhỏ lại ribbon trên màn 4K. Gained 15% canvas space.',
    accent: '#F59E0B',
  },
  {
    category: 'Biển báo',
    title: 'Biển cảnh báo W.233 — Trẻ em',
    body: 'Hình tam giác vàng đen, viền đỏ. Thường đặt trước cổng trường 50-150m. Tốc độ tối đa vùng này 40 km/h trong giờ học.',
    accent: '#EF4444',
  },
  {
    category: 'Cầu VN',
    title: 'Cầu Mỹ Thuận 2',
    body: 'Thông xe 12/2023, cầu dây văng dài 1,9 km qua sông Tiền. Vượt cầu Mỹ Thuận 1 năm xây dựng nhanh hơn cầu cũ 9 năm.',
    accent: '#10B981',
  },
  {
    category: 'Engineering',
    title: 'VN2000 vs WGS84',
    body: 'Bản đồ nhà nước VN dùng hệ VN2000, GPS phổ thông dùng WGS84. Sai lệch ~400m nếu không chuyển. Dùng TrishDesign để convert nhanh.',
    accent: '#4ADE80',
  },
];

/** Hash simple từ date string → index vào POOL. */
function dayIndex(dateStr: string): number {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = (hash << 5) - hash + dateStr.charCodeAt(i);
    hash |= 0; // 32-bit
  }
  return Math.abs(hash) % POOL.length;
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export function DailyTipWidget() {
  // Bắt đầu tip đầu pool (index 0) ở server để render nhất quán, client mount mới swap sang theo-ngày
  const [tip, setTip] = useState<Tip>(POOL[0]);
  const [rotateCount, setRotateCount] = useState(0);

  useEffect(() => {
    const idx = (dayIndex(todayStr()) + rotateCount) % POOL.length;
    setTip(POOL[idx]);
  }, [rotateCount]);

  const dateLabel = useMemo(() => {
    const d = new Date();
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
  }, []);

  return (
    <WidgetCard
      title={`Mẹo hôm nay · ${dateLabel}`}
      icon={<Lightbulb size={16} strokeWidth={2} />}
      action={
        <button
          type="button"
          onClick={() => setRotateCount((c) => c + 1)}
          className="inline-flex items-center gap-1 text-xs transition-colors hover:opacity-80"
          style={{ color: 'var(--color-text-muted)' }}
          aria-label="Xem tip khác"
        >
          <RefreshCw size={11} strokeWidth={2} />
          Tip khác
        </button>
      }
      accent={tip.accent}
    >
      <div className="space-y-2">
        <span
          className="inline-block px-2 py-0.5 rounded text-xs font-medium"
          style={{
            background: `${tip.accent}1a`,
            color: tip.accent,
          }}
        >
          {tip.category}
        </span>
        <h4
          className="font-semibold text-base leading-tight"
          style={{ color: 'var(--color-text-primary)' }}
        >
          {tip.title}
        </h4>
        <p
          className="text-sm leading-relaxed"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          {tip.body}
        </p>
      </div>
    </WidgetCard>
  );
}
