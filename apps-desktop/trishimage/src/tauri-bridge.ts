import { invoke } from '@tauri-apps/api/core';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import type { RawImageEntry } from '@trishteam/core/images';

export interface ScanImagesStats {
  entries: RawImageEntry[];
  truncated: boolean;
  elapsed_ms: number;
  errors: number;
}

function isInTauri(): boolean {
  return (
    typeof window !== 'undefined' &&
    // @ts-expect-error — __TAURI_INTERNALS__ injected at runtime
    typeof window.__TAURI_INTERNALS__ !== 'undefined'
  );
}

/** Dev fallback seed: 24 ảnh giả phân bố 3 events trong 5 ngày. */
export const DEV_FALLBACK_SCAN: ScanImagesStats = {
  entries: makeFakeSet(),
  truncated: false,
  elapsed_ms: 3,
  errors: 0,
};

function makeFakeSet(): RawImageEntry[] {
  const out: RawImageEntry[] = [];
  // Event 1: sáng 2026-04-20 — 8 ảnh phong cảnh.
  const day1 = Date.UTC(2026, 3, 20, 8, 0);
  for (let i = 0; i < 8; i++) {
    out.push(
      fake(`IMG_${1000 + i}.JPG`, day1 + i * 3 * 60 * 1000, 4032, 3024, 'iPhone 14 Pro', i % 3 === 0 ? 2 : 0),
    );
  }
  // Event 2: chiều 2026-04-20 + sáng 21 (gap < 8h cùng event? no — 14h gap).
  const day2 = Date.UTC(2026, 3, 20, 22, 0);
  for (let i = 0; i < 6; i++) {
    out.push(
      fake(`IMG_${2000 + i}.PNG`, day2 + i * 5 * 60 * 1000, 3024, 4032, null, 1),
    );
  }
  // Event 3: 2026-04-24 — panorama.
  const day3 = Date.UTC(2026, 3, 24, 10, 0);
  out.push(fake('PANO_001.JPG', day3, 10000, 3000, 'Canon EOS R5', 0));
  out.push(fake('PANO_002.JPG', day3 + 2 * 60_000, 12000, 3000, 'Canon EOS R5', 0));
  // Broken image without metadata.
  out.push(fake('broken.webp', null, 0, 0, null, null));
  // 7 ảnh square cho Instagram.
  const day4 = Date.UTC(2026, 3, 23, 15, 0);
  for (let i = 0; i < 7; i++) {
    out.push(
      fake(`INSTA_${i}.JPG`, day4 + i * 60_000, 1080, 1080, 'iPhone 14 Pro', i < 3 ? 3 : 0),
    );
  }
  return out;
}

function fake(
  name: string,
  taken: number | null,
  w: number,
  h: number,
  camera: string | null,
  faces: number | null,
): RawImageEntry {
  return {
    path: `/Users/dev/Pictures/${name}`,
    name,
    ext: name.split('.').pop()!.toLowerCase(),
    size_bytes:
      taken === null ? 15_000 : Math.floor(w * h * 0.35),
    taken_ms: taken,
    width: w > 0 ? w : null,
    height: h > 0 ? h : null,
    camera,
    has_gps: camera === 'iPhone 14 Pro',
    face_count: faces,
  };
}

export async function pickFolder(): Promise<string | null> {
  if (!isInTauri()) return '/tmp/fake-photos';
  const picked = await openDialog({
    directory: true,
    multiple: false,
    title: 'Chọn thư mục ảnh',
  });
  return typeof picked === 'string' ? picked : null;
}

export async function scanImages(
  dir: string,
  maxEntries?: number,
): Promise<ScanImagesStats> {
  if (!isInTauri()) {
    // Sleep giả để animation spinner mượt.
    await new Promise((r) => setTimeout(r, 120));
    return DEV_FALLBACK_SCAN;
  }
  const stats = await invoke<ScanImagesStats>('scan_images', {
    dir,
    maxEntries: maxEntries ?? null,
    maxDepth: null,
  });
  return stats;
}
