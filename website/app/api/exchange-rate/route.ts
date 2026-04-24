/**
 * /api/exchange-rate — tỷ giá ngoại tệ sang VND.
 *
 * Primary: open.er-api.com/v6/latest/USD (free, không cần key).
 *   - Returns: { rates: { VND: 24500, EUR: 0.91, JPY: 156, CNY: 7.2, ... } }
 *   - Ta derive: USD→VND = rates.VND
 *                EUR→VND = rates.VND / rates.EUR
 *                JPY→VND = rates.VND / rates.JPY (/ 100 → 1 JPY hơn kém)
 *                CNY→VND = rates.VND / rates.CNY
 *
 * Fallback: seed static khi API fail.
 *
 * Cache: 1 giờ.
 */
export const revalidate = 3600;

type Rate = { code: string; name: string; per_vnd: number };

const OPEN_ER_API_URL = 'https://open.er-api.com/v6/latest/USD';

const SEED: Rate[] = [
  { code: 'USD', name: 'Đô la Mỹ', per_vnd: 24_500 },
  { code: 'EUR', name: 'Euro', per_vnd: 27_800 },
  { code: 'JPY', name: 'Yên Nhật (100 ¥)', per_vnd: 16_200 },
  { code: 'CNY', name: 'Nhân dân tệ', per_vnd: 3_420 },
  { code: 'GBP', name: 'Bảng Anh', per_vnd: 31_500 },
  { code: 'KRW', name: 'Won Hàn Quốc (100 ₩)', per_vnd: 1_820 },
];

async function fetchOpenER(): Promise<Rate[] | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch(OPEN_ER_API_URL, {
      signal: ctrl.signal,
      next: { revalidate: 3600 },
    });
    clearTimeout(timer);
    if (!r.ok) return null;
    const json = (await r.json()) as {
      result?: string;
      rates?: Record<string, number>;
    };
    if (json.result !== 'success' || !json.rates) return null;
    const vnd = json.rates.VND;
    if (!vnd || vnd < 10_000) return null;
    const rates: Rate[] = [];
    rates.push({ code: 'USD', name: 'Đô la Mỹ', per_vnd: Math.round(vnd) });
    if (json.rates.EUR)
      rates.push({
        code: 'EUR',
        name: 'Euro',
        per_vnd: Math.round(vnd / json.rates.EUR),
      });
    if (json.rates.GBP)
      rates.push({
        code: 'GBP',
        name: 'Bảng Anh',
        per_vnd: Math.round(vnd / json.rates.GBP),
      });
    if (json.rates.JPY)
      rates.push({
        code: 'JPY',
        name: 'Yên Nhật (100 ¥)',
        per_vnd: Math.round((vnd / json.rates.JPY) * 100),
      });
    if (json.rates.CNY)
      rates.push({
        code: 'CNY',
        name: 'Nhân dân tệ',
        per_vnd: Math.round(vnd / json.rates.CNY),
      });
    if (json.rates.KRW)
      rates.push({
        code: 'KRW',
        name: 'Won Hàn Quốc (100 ₩)',
        per_vnd: Math.round((vnd / json.rates.KRW) * 100),
      });
    if (json.rates.THB)
      rates.push({
        code: 'THB',
        name: 'Baht Thái',
        per_vnd: Math.round(vnd / json.rates.THB),
      });
    if (json.rates.AUD)
      rates.push({
        code: 'AUD',
        name: 'Đô la Úc',
        per_vnd: Math.round(vnd / json.rates.AUD),
      });
    return rates;
  } catch {
    return null;
  }
}

export async function GET(): Promise<Response> {
  const live = await fetchOpenER();
  if (live && live.length > 0) {
    return Response.json({
      ok: true,
      updated_at: new Date().toISOString(),
      source: 'open.er-api.com',
      url: OPEN_ER_API_URL,
      rates: live,
    });
  }
  return Response.json({
    ok: true,
    updated_at: new Date().toISOString(),
    source: 'Seed (API fail)',
    url: OPEN_ER_API_URL,
    rates: SEED,
    error: 'api_unreachable',
  });
}
