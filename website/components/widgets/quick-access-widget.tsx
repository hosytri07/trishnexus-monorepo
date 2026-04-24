/**
 * QuickAccessWidget — 6 card big-tap shortcut tới feature pages.
 * Match ảnh cũ: Ôn thi / Chứng chỉ XD / TrishNotes / Biển báo / Cầu VN / Bảng tin.
 */
import Link from 'next/link';
import {
  Car,
  Construction,
  NotebookPen,
  TrafficCone,
  Waypoints,
  Newspaper,
  Target,
  type LucideIcon,
} from 'lucide-react';
import { WidgetCard } from './widget-card';

type Item = {
  title: string;
  subtitle: string;
  href: string;
  Icon: LucideIcon;
  accent: string;
};

const ITEMS: Item[] = [
  {
    title: 'Ôn thi lái xe',
    subtitle: 'A1 / B1 / B2 / C',
    href: '/driving-test',
    Icon: Car,
    accent: '#F59E0B',
  },
  {
    title: 'Chứng chỉ XD',
    subtitle: '345 câu hỏi',
    href: '/certificates',
    Icon: Construction,
    accent: '#4ADE80',
  },
  {
    title: 'TrishNotes',
    subtitle: 'Ghi chú cá nhân',
    href: '/notes',
    Icon: NotebookPen,
    accent: '#06B6D4',
  },
  {
    title: 'Biển báo',
    subtitle: 'QC41:2024',
    href: '/traffic-signs',
    Icon: TrafficCone,
    accent: '#EF4444',
  },
  {
    title: 'Cầu VN',
    subtitle: '7.897 cầu',
    href: '/bridges',
    Icon: Waypoints,
    accent: '#10B981',
  },
  {
    title: 'Bảng tin',
    subtitle: 'Tin tức · Chia sẻ',
    href: '/posts',
    Icon: Newspaper,
    accent: '#8B5CF6',
  },
];

export function QuickAccessWidget() {
  return (
    <WidgetCard title="Truy cập nhanh" icon={<Target size={16} strokeWidth={2} />}>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group flex flex-col items-center justify-center gap-2 rounded-lg p-4 text-center transition-all"
            style={{
              background: 'var(--color-surface-muted)',
              border: '1px solid var(--color-border-subtle)',
              minHeight: 120,
            }}
          >
            <div
              className="w-11 h-11 rounded-lg inline-flex items-center justify-center transition-transform group-hover:scale-110"
              style={{
                background: `${item.accent}22`,
                border: `1px solid ${item.accent}55`,
              }}
            >
              <item.Icon size={22} strokeWidth={1.75} style={{ color: item.accent }} />
            </div>
            <div>
              <div
                className="font-semibold text-sm"
                style={{ color: 'var(--color-text-primary)' }}
              >
                {item.title}
              </div>
              <div
                className="text-xs mt-0.5"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {item.subtitle}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </WidgetCard>
  );
}
