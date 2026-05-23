/**
 * Chuyển raw benchmark numbers → điểm 1..5 tương ứng mức máy.
 *
 * Phase 15.0.j — Multi-thread bench thresholds (mới):
 * Bench mới chạy SHA-256 song song trên TẤT CẢ CPU core. Số liệu này
 * reflect tổng compute capability máy — khớp với cảm nhận thực tế
 * khi chạy app multi-threaded (Photoshop, Premiere, Blender).
 *
 * Reference 2026:
 * - 4-core mid-range 2024 (i5-1340P / Ryzen 5 7530U): ~1500-2500 MB/s
 * - 8-core 2025 (i7-13700H / Ryzen 7 7840HS / M2 Pro): ~3000-5000 MB/s
 * - 16-20 core desktop 2026 (i9-14900K / Ryzen 9 7950X / M3 Max): ~5000-10000 MB/s
 * - Thấp 2019 (i3 dual-core, Celeron): ~300-600 MB/s
 *
 * ⚠ Lưu ý dev mode (debug build): chậm 5-10× release. Kết quả bench
 * trong `pnpm tauri dev` không đại diện performance thực tế của installed app.
 */

export type Tier = 'excellent' | 'good' | 'ok' | 'low' | 'very_low';

export interface TierInfo {
  tier: Tier;
  label: string;
  color: 'green' | 'blue' | 'amber' | 'orange' | 'red';
  description: string;
}

export function cpuTier(mbPerSecond: number): TierInfo {
  if (mbPerSecond >= 5000) {
    return {
      tier: 'excellent',
      label: 'Xuất sắc',
      color: 'green',
      description:
        'Workstation/máy gaming cao cấp. Render 4K, AI inference, compile code lớn — đều mượt.',
    };
  }
  if (mbPerSecond >= 2500) {
    return {
      tier: 'good',
      label: 'Tốt',
      color: 'blue',
      description:
        'Đủ sức cho mọi app sáng tạo (Photoshop, Premiere, AutoCAD). Render ảnh/video mượt.',
    };
  }
  if (mbPerSecond >= 1200) {
    return {
      tier: 'ok',
      label: 'Đạt',
      color: 'amber',
      description:
        'Văn phòng + design vừa phải tốt. Video editing 1080p chấp nhận được, 4K sẽ lag.',
    };
  }
  if (mbPerSecond >= 500) {
    return {
      tier: 'low',
      label: 'Hơi chậm',
      color: 'orange',
      description:
        'OK cho học tập + duyệt web + Office. Tránh Photoshop/Premiere — sẽ giật lag.',
    };
  }
  return {
    tier: 'very_low',
    label: 'Rất yếu',
    color: 'red',
    description:
      'Máy cũ — nên upgrade nếu cần dùng app sáng tạo. Office/web cơ bản vẫn OK.',
  };
}

/**
 * Phase 15.0.n.A — Disk tier (sequential read/write).
 * Reference 2026:
 * - HDD 7200 rpm: 100-200 MB/s
 * - SATA SSD: 400-600 MB/s
 * - NVMe Gen3: 2000-3500 MB/s
 * - NVMe Gen4: 5000-7000 MB/s
 * - NVMe Gen5: 12000-14000 MB/s
 */
export function diskTier(mbPerSecond: number): TierInfo {
  if (mbPerSecond >= 5000) {
    return {
      tier: 'excellent',
      label: 'NVMe Gen4+',
      color: 'green',
      description: 'SSD NVMe Gen4/5 — chuyển file lớn nhanh, load Photoshop/Premiere mượt.',
    };
  }
  if (mbPerSecond >= 2000) {
    return {
      tier: 'good',
      label: 'NVMe Gen3',
      color: 'blue',
      description: 'SSD NVMe Gen3 — đủ nhanh cho mọi tác vụ.',
    };
  }
  if (mbPerSecond >= 350) {
    return {
      tier: 'ok',
      label: 'SATA SSD',
      color: 'amber',
      description: 'SSD SATA — chấp nhận được cho dùng hàng ngày, tránh edit video lớn.',
    };
  }
  if (mbPerSecond >= 80) {
    return {
      tier: 'low',
      label: 'HDD',
      color: 'orange',
      description: 'Ổ cứng quay HDD — chậm. Khuyến nghị nâng cấp lên SSD ngay.',
    };
  }
  return {
    tier: 'very_low',
    label: 'Rất chậm',
    color: 'red',
    description: 'Ổ đĩa quá chậm — có thể bị lỗi hoặc quá đầy. Cần chẩn đoán.',
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
