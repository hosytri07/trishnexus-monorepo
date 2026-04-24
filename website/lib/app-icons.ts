/**
 * Map icon_fallback (string) → lucide React component.
 * Static map: chỉ import icons thật sự dùng → tree-shake sạch, bundle gọn.
 * Nếu thêm app mới ở apps-meta.ts, nhớ thêm icon tương ứng vào map này.
 */
import {
  Activity,
  Box,
  Compass,
  FileText,
  Image as ImageIcon,
  Library,
  NotebookPen,
  Rocket,
  Search,
  Trash2,
  Type,
  type LucideIcon,
} from 'lucide-react';

export const APP_ICON_MAP: Record<string, LucideIcon> = {
  Activity,
  Box,
  Compass,
  FileText,
  Image: ImageIcon,
  Library,
  NotebookPen,
  Rocket,
  Search,
  Trash2,
  Type,
};

export function resolveAppIcon(name: string): LucideIcon {
  return APP_ICON_MAP[name] ?? Box;
}
