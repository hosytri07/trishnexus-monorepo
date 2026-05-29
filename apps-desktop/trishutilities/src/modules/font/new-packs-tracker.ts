/**
 * Phase 78.13.10 — Track pack IDs đã được user xem.
 *
 * So sánh manifest fetch về với danh sách "đã xem" trong localStorage
 * để hiển thị badge "X pack mới" trong UI Font module.
 */
const SEEN_KEY = 'trishutilities.font.seen_packs';

export function getSeenPackIds(): Set<string> {
  try {
    const raw = window.localStorage.getItem(SEEN_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

export function markPackIdsSeen(ids: string[]): void {
  try {
    const current = getSeenPackIds();
    ids.forEach((id) => current.add(id));
    window.localStorage.setItem(SEEN_KEY, JSON.stringify(Array.from(current)));
  } catch {
    /* ignore */
  }
}

/** Trả về list pack ID có trong manifest mà chưa "seen" — sort theo release_date desc. */
export function getNewPackIds(
  allPacks: Array<{ id: string; release_date?: number }>,
): string[] {
  const seen = getSeenPackIds();
  const candidates = allPacks.filter((p) => !seen.has(p.id));
  candidates.sort((a, b) => (b.release_date ?? 0) - (a.release_date ?? 0));
  return candidates.map((p) => p.id);
}

/**
 * First-run case: nếu user chưa từng xem pack nào (Set rỗng) và manifest có
 * sẵn nhiều pack → tất cả đều "mới" — không hợp lý. Treat first-run = mark all
 * as seen (silent baseline). Chỉ badge khi có pack THẬT SỰ mới sau lần đầu.
 */
export function initSeenBaselineIfEmpty(allPackIds: string[]): boolean {
  const seen = getSeenPackIds();
  if (seen.size === 0 && allPackIds.length > 0) {
    markPackIdsSeen(allPackIds);
    return true; // baseline đã set
  }
  return false;
}
