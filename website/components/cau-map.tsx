'use client';

/**
 * CauMap — Phase 19.19 — Leaflet map cho /cau-vn.
 *
 * Vì 7549 cầu thiếu lat/lon, ta render markers theo TỈNH (group + jitter quanh
 * trung tâm tỉnh để các marker không trùng). User vẫn thấy phân bố cầu trên VN.
 *
 * Leaflet load qua CDN (tránh thêm npm dep) — hook lazy load.
 *
 * Centroid 63 tỉnh approximate (lat, lng).
 */
import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { VietnamBridge } from '@/data/bridges-vn';
import { STRUCTURE_CONFIGS } from '@/data/bridges-vn';

// Centroid 63 tỉnh + thành VN (approximate, đủ cho cluster)
const PROVINCE_CENTERS: Record<string, [number, number]> = {
  'Hà Nội': [21.0285, 105.8542],
  'Hồ Chí Minh': [10.7769, 106.7009],
  'Hải Phòng': [20.8449, 106.6881],
  'Đà Nẵng': [16.0544, 108.2022],
  'Cần Thơ': [10.0452, 105.7469],
  'An Giang': [10.5216, 105.1259],
  'Bà Rịa - Vũng Tàu': [10.5417, 107.2429],
  'Bắc Giang': [21.2731, 106.1946],
  'Bắc Kạn': [22.1474, 105.8345],
  'Bạc Liêu': [9.2940, 105.7216],
  'Bắc Ninh': [21.1861, 106.0763],
  'Bến Tre': [10.2352, 106.3759],
  'Bình Định': [13.7757, 109.2231],
  'Bình Dương': [11.3254, 106.4770],
  'Bình Phước': [11.7512, 106.7234],
  'Bình Thuận': [11.0904, 108.0721],
  'Cà Mau': [9.1768, 105.1524],
  'Cao Bằng': [22.6666, 106.2575],
  'Đắk Lắk': [12.7100, 108.2378],
  'Đắk Nông': [12.2646, 107.6098],
  'Điện Biên': [21.3856, 103.0321],
  'Đồng Nai': [10.9453, 106.8246],
  'Đồng Tháp': [10.4938, 105.6882],
  'Gia Lai': [13.9833, 108.0],
  'Hà Giang': [22.8025, 104.9784],
  'Hà Nam': [20.5836, 105.9229],
  'Hà Tĩnh': [18.3559, 105.8877],
  'Hải Dương': [20.9373, 106.3146],
  'Hậu Giang': [9.7848, 105.6413],
  'Hòa Bình': [20.8156, 105.3373],
  'Hưng Yên': [20.6464, 106.0511],
  'Khánh Hòa': [12.2585, 109.0526],
  'Kiên Giang': [10.0125, 105.0809],
  'Kon Tum': [14.3497, 108.0005],
  'Lai Châu': [22.3964, 103.4717],
  'Lâm Đồng': [11.9404, 108.4583],
  'Lạng Sơn': [21.8538, 106.7610],
  'Lào Cai': [22.4856, 103.9722],
  'Long An': [10.6957, 106.2431],
  'Nam Định': [20.4388, 106.1621],
  'Nghệ An': [19.2342, 104.9200],
  'Ninh Bình': [20.2506, 105.9744],
  'Ninh Thuận': [11.6739, 108.8629],
  'Phú Thọ': [21.4080, 105.2046],
  'Phú Yên': [13.0882, 109.0929],
  'Quảng Bình': [17.6102, 106.3487],
  'Quảng Nam': [15.5394, 108.0192],
  'Quảng Ngãi': [15.1213, 108.8045],
  'Quảng Ninh': [21.0064, 107.2925],
  'Quảng Trị': [16.7942, 107.0451],
  'Sóc Trăng': [9.6037, 105.9740],
  'Sơn La': [21.3256, 103.9188],
  'Tây Ninh': [11.3104, 106.0980],
  'Thái Bình': [20.4500, 106.3406],
  'Thái Nguyên': [21.5928, 105.8442],
  'Thanh Hóa': [19.8067, 105.7852],
  'Thừa Thiên Huế': [16.4637, 107.5909],
  'Tiền Giang': [10.3593, 106.3624],
  'Trà Vinh': [9.9347, 106.3453],
  'Tuyên Quang': [21.8237, 105.2179],
  'Vĩnh Long': [10.2536, 105.9722],
  'Vĩnh Phúc': [21.3608, 105.5474],
  'Yên Bái': [21.7168, 104.8986],
};

// Aliases
const PROVINCE_ALIASES: Record<string, string> = {
  'TP HCM': 'Hồ Chí Minh',
  'TP. HCM': 'Hồ Chí Minh',
  'Sài Gòn': 'Hồ Chí Minh',
  'TP HN': 'Hà Nội',
  'Huế': 'Thừa Thiên Huế',
  'Tiền Giang - Vĩnh Long': 'Tiền Giang',
  'Vĩnh Long - Cần Thơ': 'Cần Thơ',
};

function resolveProvince(name: string): [number, number] | null {
  // Direct
  if (PROVINCE_CENTERS[name]) return PROVINCE_CENTERS[name];
  // Try alias
  if (PROVINCE_ALIASES[name]) return PROVINCE_CENTERS[PROVINCE_ALIASES[name]] ?? null;
  // Fuzzy: split by '-' or ',' and try first segment
  const first = name.split(/[-,]/)[0]?.trim();
  if (first && PROVINCE_CENTERS[first]) return PROVINCE_CENTERS[first];
  return null;
}

interface Props {
  bridges: VietnamBridge[];
  onSelect?: (bridge: VietnamBridge) => void;
}

declare global {
  interface Window {
    L?: any;
  }
}

export function CauMap({ bridges, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lazy load Leaflet from CDN
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.L) {
      setReady(true);
      return;
    }
    // Inject CSS
    if (!document.querySelector('link[href*="leaflet.css"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }
    // Inject JS
    if (!document.querySelector('script[src*="leaflet.js"]')) {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.async = true;
      script.onload = () => setReady(true);
      script.onerror = () => setError('Không tải được Leaflet CDN');
      document.head.appendChild(script);
    } else {
      // Already loading — poll
      const t = setInterval(() => {
        if (window.L) {
          setReady(true);
          clearInterval(t);
        }
      }, 100);
      return () => clearInterval(t);
    }
  }, []);

  // Init map + markers
  useEffect(() => {
    if (!ready || !containerRef.current || !window.L) return;
    const L = window.L;
    if (mapRef.current) {
      // Map already exists — clear old markers
      mapRef.current.eachLayer((layer: any) => {
        if (layer instanceof L.Marker || layer instanceof L.CircleMarker) {
          mapRef.current.removeLayer(layer);
        }
      });
    } else {
      // Init new map
      mapRef.current = L.map(containerRef.current, {
        center: [16.0, 107.0], // Trung tâm VN
        zoom: 6,
        scrollWheelZoom: true,
      });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 18,
      }).addTo(mapRef.current);
    }

    // Build markers — group by province để jitter
    const provinceGroups = new Map<string, VietnamBridge[]>();
    bridges.forEach((b) => {
      const list = provinceGroups.get(b.province) ?? [];
      list.push(b);
      provinceGroups.set(b.province, list);
    });

    let plotted = 0;
    provinceGroups.forEach((list, province) => {
      const center = resolveProvince(province);
      if (!center) return;
      // Limit 100 markers per province để tránh lag
      const sample = list.slice(0, Math.min(list.length, 100));
      sample.forEach((b, i) => {
        const cfg = STRUCTURE_CONFIGS[b.structure];
        // Jitter ±0.15° quanh centroid (~16km radius)
        const jitter = 0.15;
        const angle = (i / sample.length) * Math.PI * 2;
        const dist = jitter * (0.3 + Math.random() * 0.7);
        const lat = center[0] + Math.sin(angle) * dist;
        const lng = center[1] + Math.cos(angle) * dist;

        const marker = L.circleMarker([lat, lng], {
          radius: 5,
          fillColor: cfg.color,
          color: '#ffffff',
          weight: 1,
          opacity: 0.9,
          fillOpacity: 0.7,
        }).addTo(mapRef.current);

        marker.bindPopup(
          `<div style="font-family: system-ui, sans-serif; min-width: 200px;">
            <div style="font-weight: bold; font-size: 14px; margin-bottom: 4px;">${escapeHtml(b.name)}</div>
            <div style="font-size: 12px; color: #666;">${escapeHtml(b.province)} · ${b.length_m}m</div>
            <div style="font-size: 11px; color: ${cfg.color}; font-weight: bold; text-transform: uppercase; margin-top: 4px;">${cfg.shortName}</div>
            ${b.year_built ? `<div style="font-size: 11px; color: #999; margin-top: 2px;">Năm xây: ${b.year_built}</div>` : ''}
          </div>`,
        );

        if (onSelect) {
          marker.on('click', () => onSelect(b));
        }
        plotted++;
      });
    });

    console.log(`[map] plotted ${plotted}/${bridges.length} bridges`);

    return () => {
      // Don't destroy map — reuse on re-render
    };
  }, [ready, bridges, onSelect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  if (error) {
    return (
      <div
        className="flex items-center justify-center text-sm rounded-lg border"
        style={{ height: 500, color: '#EF4444', borderColor: 'var(--color-border-default)' }}
      >
        ⚠ {error}
      </div>
    );
  }

  if (!ready) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border"
        style={{ height: 500, background: 'var(--color-surface-card)', borderColor: 'var(--color-border-default)' }}
      >
        <div className="text-center">
          <Loader2 size={28} className="animate-spin mx-auto mb-2" style={{ color: 'var(--color-accent-primary)' }} />
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Đang tải bản đồ Leaflet...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="rounded-lg border overflow-hidden"
      style={{
        height: 600,
        borderColor: 'var(--color-border-default)',
        background: '#1f2937',
      }}
    />
  );
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[c]!);
}
