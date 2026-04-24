'use client';

/**
 * usePricesData — shared hook giúp GasPricesWidget + GoldPricesWidget dùng chung
 * 1 request tới /api/prices thay vì mỗi widget tự fetch.
 *
 * Cơ chế: module-level promise cache + subscribers pattern. Mount nào fetch trước
 * thì share kết quả với mount sau. `refresh()` invalidate cache và refetch.
 *
 * Không dùng React Context — nhẹ hơn, không cần wrap provider.
 */
import { useEffect, useState } from 'react';

export type GasItem = { name: string; price: number; unit: string };
export type GoldItem = { name: string; buy: number; sell: number };

export type PricesResponse = {
  ok: boolean;
  updated_at: string;
  gas: {
    source: string;
    url: string;
    items: GasItem[];
    error?: string;
  };
  gold: {
    source: string;
    url: string;
    items: GoldItem[];
    error?: string;
  };
};

type State = {
  data: PricesResponse | null;
  loading: boolean;
  error: string | null;
};

let state: State = { data: null, loading: false, error: null };
let inflight: Promise<void> | null = null;
const subscribers = new Set<(s: State) => void>();

function notify() {
  subscribers.forEach((s) => s(state));
}

async function fetchOnce(cacheBust = false): Promise<void> {
  if (inflight) return inflight;
  inflight = (async () => {
    state = { ...state, loading: true, error: null };
    notify();
    try {
      const url = cacheBust ? `/api/prices?r=${Date.now()}` : '/api/prices';
      const r = await fetch(url);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json = (await r.json()) as PricesResponse;
      state = { data: json, loading: false, error: null };
    } catch (e) {
      state = {
        ...state,
        loading: false,
        error: e instanceof Error ? e.message : 'fetch_failed',
      };
    } finally {
      inflight = null;
      notify();
    }
  })();
  return inflight;
}

export function usePricesData(): State & { refresh: () => void } {
  const [snap, setSnap] = useState<State>(state);

  useEffect(() => {
    subscribers.add(setSnap);
    if (!state.data && !state.loading) {
      fetchOnce();
    }
    return () => {
      subscribers.delete(setSnap);
    };
  }, []);

  return {
    ...snap,
    refresh: () => {
      fetchOnce(true);
    },
  };
}
