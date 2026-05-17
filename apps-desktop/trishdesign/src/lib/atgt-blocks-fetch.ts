/**
 * TrishDesign Phase 42 wave 8.3 — Fetch danh mục block ATGT từ Firestore.
 *
 * Collection: /atgt_blocks/{blockId}
 *   - Admin curate qua web (/admin/atgt-blocks)
 *   - TrishDesign user fetch về làm dropdown nhập liệu
 *
 * Lưu cache vào localStorage để fallback khi mất mạng.
 */

import { useEffect, useState } from 'react';
import { getFirebaseDb } from '@trishteam/auth';
import { collection, getDocs, limit, query } from 'firebase/firestore';

export interface AtgtBlock {
  id: string;
  label: string;        // Tên hiển thị (vd "P.101", "W.221")
  fileName: string;     // .dwg file name (vd "1.BB.dwg", "2.BB.dwg")
  category: string;     // Biển báo / Cọc tiêu / Vạch sơn / Đèn tín hiệu / Hộ lan mềm / Cống ngang / Tiêu phản quang / Gương cầu lồi / Rãnh dọc / Lí trình
  /** Phase 42 wave 9 — Ý nghĩa tài sản (vd "Đường cấm", "Cấm đi ngược chiều") */
  meaning?: string;
  /** Phase 42 wave 9 — Dạng địa vật: Block (INSERT 1 điểm) hoặc Linetype (PLINE dọc tuyến) */
  shapeKind?: 'block' | 'linetype';
  /** Phase 42 wave 9 — Hướng so với tim tuyến: vuông góc / song song */
  orientation?: 'perpendicular' | 'parallel';
  description?: string;
  colorIndex?: number;  // AutoCAD ACI (default 7)
  hatchName?: string;   // Hatch pattern (optional)
  defaultScale?: number;
  updated_at?: number;
}

const CACHE_KEY = 'trishdesign:atgt-blocks-cache';

function loadCache(): AtgtBlock[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as AtgtBlock[];
  } catch {
    return [];
  }
}

function saveCache(items: AtgtBlock[]): void {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(CACHE_KEY, JSON.stringify(items)); } catch { /* ignore */ }
}

/**
 * Hook fetch danh mục block ATGT từ Firestore.
 * Trả về danh sách cached ngay khi mount, sau đó refresh từ Firestore.
 */
export function useAtgtBlocks(): {
  blocks: AtgtBlock[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
} {
  const [blocks, setBlocks] = useState<AtgtBlock[]>(() => loadCache());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const db = getFirebaseDb();
      const snap = await getDocs(query(collection(db, 'atgt_blocks'), limit(1000)));
      const items = snap.docs.map((d) => d.data() as AtgtBlock);
      setBlocks(items);
      saveCache(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  return { blocks, loading, error, reload: load };
}
