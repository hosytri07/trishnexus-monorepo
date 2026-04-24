/**
 * Chuyển raw benchmark numbers → điểm 1..5 tương ứng mức máy.
 *
 * Reference baseline (2026-04):
 * - Máy cấu hình trung bình 2024 (Ryzen 5 5600 / M2): CPU SHA-256 ~450 MB/s,
 *   memory copy ~14 GB/s.
 * - Máy mạnh 2025-26 (M3 Pro / 14900K): CPU ~800 MB/s, memory ~25 GB/s.
 * - Máy yếu 2019 (i3 gen 8 / Celeron N4xxx): CPU ~150 MB/s, memory ~6 GB/s.
 *
 * Ngưỡng là xấp xỉ — giúp user hiểu máy ở mức nào, không phải benchmark
 * chính xác ngành. Logic được tách khỏi UI để dễ unit test.
 */

export type Tier = 'excellent' | 'good' | 'ok' | 'low' | 'very_low';

export interface TierInfo {
  tier: Tier;
  label: string;
  color: 'green' | 'blue' | 'amber' | 'orange' | 'red';
  description: string;
}

export function cpuTier(mbPerSecond: number): TierInfo {
  if (mbPerSecond >= 700) {
    return {
      tier: 'excellent',
      label: 'Xuất sắc',
      color: 'green',
      description: 'Chạy mượt mọi ứng dụng nặng (TrishImage face-group, TrishFont render).',
    };
  }
  if (mbPerSecond >= 400) {
    return {
      tier: 'good',
      label: 'Tốt',
      color: 'blue',
      description: 'Đủ sức cho toàn bộ ecosystem, hơi chậm ở batch lớn.',
    };
  }
  if (mbPerSecond >= 250) {
    return {
      tier: 'ok',
      label: 'Đạt',
      color: 'amber',
      description: 'Chạy được tất cả app, nên tránh batch quá lớn cùng lúc.',
    };
  }
  if (mbPerSecond >= 120) {
    return {
      tier: 'low',
      label: 'Hơi chậm',
      color: 'orange',
      description: 'Ưu tiên TrishNote / TrishClean. TrishImage sẽ lag rõ.',
    };
  }
  return {
    tier: 'very_low',
    label: 'Rất yếu',
    color: 'red',
    description: 'Chỉ nên dùng TrishNote + TrishQR. Tránh app xử lý ảnh/font nặng.',
  };
}

export function memoryTier(mbPerSecond: number): TierInfo {
  // Note: memory copy returns MB/s, thresholds in MB/s.
  if (mbPerSecond >= 20_000) {
    return {
      tier: 'excellent',
      label: 'Xuất sắc',
      color: 'green',
      description: 'Memory bandwidth top — app nặng swap ít.',
    };
  }
  if (mbPerSecond >= 12_000) {
    return {
      tier: 'good',
      label: 'Tốt',
      color: 'blue',
      description: 'Dư sức mở nhiều app song song.',
    };
  }
  if (mbPerSecond >= 7_000) {
    return {
      tier: 'ok',
      label: 'Đạt',
      color: 'amber',
      description: 'Đủ dùng. Tránh mở quá nhiều tab/ app cùng lúc.',
    };
  }
  if (mbPerSecond >= 3_500) {
    return {
      tier: 'low',
      label: 'Hơi chậm',
      color: 'orange',
      description: 'Nên đóng app nền trước khi dùng TrishImage.',
    };
  }
  return {
    tier: 'very_low',
    label: 'Rất yếu',
    color: 'red',
    description: 'Memory bandwidth thấp — cân nhắc nâng cấp RAM.',
  };
}

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '—';
  const gb = bytes / 1024 ** 3;
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = bytes / 1024 ** 2;
  if (mb >= 1) return `${mb.toFixed(0)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

export function formatUptime(seconds: number): string {
  if (seconds <= 0) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
