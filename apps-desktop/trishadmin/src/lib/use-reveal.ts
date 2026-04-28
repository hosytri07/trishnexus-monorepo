/**
 * Phase 18.8.b — Hook quản lý trạng thái ẩn/hiện thông tin nhạy cảm.
 *
 * - `revealAll: boolean` — master toggle cho cả panel.
 * - `revealedRows: Set<string>` — per-row OVERRIDE khác với master.
 *
 * Logic isRevealed:
 * - revealedRows.has(id) → trả về !revealAll (override)
 * - else → trả về revealAll
 *
 * Khi master toggle thì clear revealedRows để bắt đầu sạch.
 *
 * Mặc định ẩn tất cả khi mở panel (revealAll = false, set rỗng).
 */

import { useCallback, useState } from 'react';

export interface RevealState {
  revealAll: boolean;
  toggleAll: () => void;
  toggleRow: (id: string) => void;
  isRevealed: (id: string) => boolean;
  hasRowOverrides: boolean;
}

export function useReveal(defaultAll = false): RevealState {
  const [revealAll, setRevealAll] = useState<boolean>(defaultAll);
  const [revealedRows, setRevealedRows] = useState<Set<string>>(new Set());

  const toggleAll = useCallback(() => {
    setRevealedRows(new Set());
    setRevealAll((prev) => !prev);
  }, []);

  const toggleRow = useCallback((id: string) => {
    setRevealedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const isRevealed = useCallback(
    (id: string): boolean => {
      if (revealedRows.has(id)) return !revealAll;
      return revealAll;
    },
    [revealAll, revealedRows],
  );

  return {
    revealAll,
    toggleAll,
    toggleRow,
    isRevealed,
    hasRowOverrides: revealedRows.size > 0,
  };
}
