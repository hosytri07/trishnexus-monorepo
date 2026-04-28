/**
 * Database cầu Việt Nam — Phase 19.18 — 7,549 cầu thật.
 *
 * Source: Cục Quản lý Đường bộ + 1 số nguồn khác.
 * File data: /public/bridges-vn.json (1.8 MB JSON compact, gzip ~400KB).
 * Được fetch lazy lúc /cau-vn page mount → tránh bundle JS.
 *
 * Schema dạng compact để giảm size — UI normalizer biến về dạng đầy đủ.
 */

export type BridgeStructure =
  | 'dam'
  | 'dam-thep'
  | 'vom'
  | 'day-vang'
  | 'treo'
  | 'extradosed'
  | 'khac';

/** Compact record — load từ JSON file */
export interface BridgeCompact {
  id: string;
  n: string;          // name
  p: string;          // province
  r: string;          // road / quốc lộ
  k: string;          // ly_trinh (km marker)
  l: number;          // length_m
  s: BridgeStructure; // structure
  w?: number;         // width_m
  sp?: number;        // span_count
  sr?: string;        // structure_raw (text gốc nếu khác)
  lc?: string;        // load_class
  mg?: string;        // manager / đơn vị
  c?: string;         // condition / tình trạng
  y?: number;         // year_built
  src?: string;       // source
}

/** Normalized record — dùng trong UI */
export interface VietnamBridge {
  id: string;
  name: string;
  province: string;
  road: string;
  ly_trinh: string;
  length_m: number;
  width_m?: number;
  span_count?: number;
  structure: BridgeStructure;
  structure_raw?: string;
  load_class?: string;
  manager?: string;
  condition?: string;
  year_built?: number;
  source?: string;
}

export function normalizeBridge(b: BridgeCompact): VietnamBridge {
  return {
    id: b.id,
    name: b.n,
    province: b.p,
    road: b.r,
    ly_trinh: b.k,
    length_m: b.l,
    structure: b.s,
    width_m: b.w,
    span_count: b.sp,
    structure_raw: b.sr,
    load_class: b.lc,
    manager: b.mg,
    condition: b.c,
    year_built: b.y,
    source: b.src,
  };
}

export interface StructureConfig {
  structure: BridgeStructure;
  name: string;
  shortName: string;
  color: string;
}

export const STRUCTURE_CONFIGS: Record<BridgeStructure, StructureConfig> = {
  dam: { structure: 'dam', name: 'Dầm bê tông cốt thép', shortName: 'Dầm BTCT', color: '#3B82F6' },
  'dam-thep': { structure: 'dam-thep', name: 'Dầm thép', shortName: 'Dầm thép', color: '#6366F1' },
  vom: { structure: 'vom', name: 'Vòm', shortName: 'Vòm', color: '#10B981' },
  'day-vang': { structure: 'day-vang', name: 'Dây văng', shortName: 'Dây văng', color: '#F59E0B' },
  treo: { structure: 'treo', name: 'Treo (dây võng)', shortName: 'Treo', color: '#A855F7' },
  extradosed: { structure: 'extradosed', name: 'Extradosed', shortName: 'Extradosed', color: '#EC4899' },
  khac: { structure: 'khac', name: 'Khác', shortName: 'Khác', color: '#9CA3AF' },
};

export function formatLength(m: number): string {
  if (m >= 1000) return `${(m / 1000).toFixed(2)} km`;
  return `${m} m`;
}

/** Fetch toàn bộ database từ /public/bridges-vn.json */
export async function fetchAllBridges(): Promise<VietnamBridge[]> {
  const res = await fetch('/bridges-vn.json');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as BridgeCompact[];
  return data.map(normalizeBridge);
}
