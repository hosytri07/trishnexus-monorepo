/**
 * /api/prices — lấy giá xăng dầu + giá vàng từ nhiều nguồn (fallback chain).
 *
 * Strategy cho mỗi phần:
 *   1. Thử source A (primary).
 *   2. Nếu fail hoặc parser không match → thử source B, C, D… (backup).
 *   3. Nếu cả list fail → trả seed data với `error` + `tried` log.
 *
 * NOTE (Phase 11.5.7): Trí test thực tế SJC/Petrolimex block request server
 * → đảo sang 24h.com.vn làm PRIMARY, giữ SJC/Petrolimex làm backup phòng khi
 * 24h đổi layout.
 *
 * Gas:
 *   - Primary:   https://www.24h.com.vn/gia-xang-gia-dau-hom-nay-c46e1783.html
 *   - Backup 1:  https://www.petrolimex.com.vn/
 *   - Backup 2:  https://www.petrolimex.com.vn/nd/gia-ban-le-cac-mat-hang-xang-dau-tai-khu-vuc-1-tt.html
 *
 * Gold:
 *   - Primary:   https://www.24h.com.vn/gia-vang-hom-nay-c425.html (tổng hợp SJC/PNJ/DOJI)
 *   - Backup 1:  XML feed SJC (nếu tồn tại): https://sjc.com.vn/xml/tygiavang.xml
 *   - Backup 2:  HTML scrape https://sjc.com.vn/giavang.php
 *
 * Response shape:
 *   { ok, updated_at, gas: {source, url, items, error?, tried[]},
 *     gold: {source, url, items, error?, tried[]} }
 *
 * Response gồm `tried` — list nguồn đã thử kèm status → Trí copy JSON cho tôi
 * để debug regex khi seed fallback xảy ra.
 *
 * Cache: Next fetch cache 15 phút.
 */

export const revalidate = 900;

const PETROLIMEX_URLS = [
  'https://www.petrolimex.com.vn/',
  'https://www.petrolimex.com.vn/nd/gia-ban-le-cac-mat-hang-xang-dau-tai-khu-vuc-1-tt.html',
];
const GAS_24H_URL = 'https://www.24h.com.vn/gia-xang-gia-dau-hom-nay-c46e1783.html';
const SJC_XML_URL = 'https://sjc.com.vn/xml/tygiavang.xml';
const SJC_HTML_URL = 'https://sjc.com.vn/giavang.php';
const GOLD_24H_URL = 'https://www.24h.com.vn/gia-vang-hom-nay-c425.html';

type GasItem = { name: string; price: number; unit: string };
type GoldItem = { name: string; buy: number; sell: number };
type TryLog = { url: string; status: 'ok' | 'error' | 'no_match'; note?: string };

type GasResult = {
  source: string;
  url: string;
  items: GasItem[];
  error?: string;
  tried: TryLog[];
};
type GoldResult = {
  source: string;
  url: string;
  items: GoldItem[];
  error?: string;
  tried: TryLog[];
};

function parseVND(s: string): number {
  const digits = s.replace(/[^\d]/g, '');
  return digits ? parseInt(digits, 10) : 0;
}

async function fetchText(url: string, timeoutMs = 8000): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'vi-VN,vi;q=0.9,en;q=0.8',
      },
      next: { revalidate: 900 },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

// ============ GAS ============

function parsePetrolimex(html: string): GasItem[] {
  // Strip HTML tags để regex dễ match giá nằm cạnh tên sản phẩm.
  const stripped = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const items: GasItem[] = [];
  const rules: Array<{ name: string; regex: RegExp }> = [
    { name: 'Xăng RON 95-V', regex: /RON\s*95[\s\-–]?V\b/i },
    { name: 'Xăng RON 95-III', regex: /RON\s*95[\s\-–]?III\b/i },
    { name: 'Xăng E5 RON 92-II', regex: /E5\s*RON\s*92/i },
    { name: 'Dầu DO 0,001S-V', regex: /DO\s*0[,\.]\s*001\s*S[\s\-–]?V/i },
    { name: 'Dầu DO 0,05S-II', regex: /DO\s*0[,\.]\s*05\s*S/i },
    { name: 'Dầu hỏa', regex: /Dầu\s*hỏa/i },
  ];

  for (const r of rules) {
    const m = stripped.match(r.regex);
    if (!m || m.index == null) continue;
    const window = stripped.slice(m.index, m.index + 200);
    const priceMatch = window.match(/\b(\d{2}[\.,\s]?\d{3})\b/);
    if (priceMatch) {
      const price = parseVND(priceMatch[1]);
      if (price > 8000 && price < 80000) {
        items.push({ name: r.name, price, unit: 'đ/lít' });
      }
    }
  }
  return items;
}

/**
 * 24h.com.vn/gia-xang-... — trang tin tức, có bảng giá dạng "RON 95-III: 23.050 đồng/lít"
 * Parser quét text stripped, dùng regex lookahead tìm giá cạnh tên sản phẩm.
 */
function parse24hGas(html: string): GasItem[] {
  const stripped = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const items: GasItem[] = [];
  const rules: Array<{ name: string; regex: RegExp }> = [
    { name: 'Xăng RON 95-V', regex: /RON\s*95[\s\-–]?V\b/i },
    { name: 'Xăng RON 95-III', regex: /RON\s*95[\s\-–]?(?:III|3)\b/i },
    { name: 'Xăng E5 RON 92-II', regex: /E5\s*RON\s*92/i },
    { name: 'Dầu DO 0,001S-V', regex: /DO\s*0[,\.]\s*001\s*S/i },
    { name: 'Dầu DO 0,05S-II', regex: /DO\s*0[,\.]\s*05\s*S/i },
    { name: 'Dầu hỏa', regex: /Dầu\s*hỏa/i },
  ];
  for (const r of rules) {
    const m = stripped.match(r.regex);
    if (!m || m.index == null) continue;
    // 24h.com.vn thường viết "... : 23.050 đồng/lít", mở window 250.
    const window = stripped.slice(m.index, m.index + 250);
    const priceMatch = window.match(/(\d{2}[\.,\s]?\d{3})\s*(?:đồng|đ)?\s*\/\s*lít/i);
    if (priceMatch) {
      const price = parseVND(priceMatch[1]);
      if (price > 8000 && price < 80000) {
        items.push({ name: r.name, price, unit: 'đ/lít' });
      }
    }
  }
  // Dedupe by name
  const seen = new Set<string>();
  return items.filter((it) => {
    if (seen.has(it.name)) return false;
    seen.add(it.name);
    return true;
  });
}

const SEED_GAS: GasItem[] = [
  { name: 'Xăng RON 95-III', price: 23_050, unit: 'đ/lít' },
  { name: 'Xăng E5 RON 92-II', price: 22_000, unit: 'đ/lít' },
  { name: 'Dầu DO 0,05S-II', price: 20_100, unit: 'đ/lít' },
];

async function scrapeGas(): Promise<GasResult> {
  const tried: TryLog[] = [];

  // 1. 24h.com.vn (PRIMARY — Phase 11.5.7)
  try {
    const html = await fetchText(GAS_24H_URL);
    const items = parse24hGas(html);
    if (items.length > 0) {
      tried.push({ url: GAS_24H_URL, status: 'ok', note: `${items.length} items (24h)` });
      return { source: '24h.com.vn', url: GAS_24H_URL, items, tried };
    }
    tried.push({ url: GAS_24H_URL, status: 'no_match', note: '24h regex không khớp' });
  } catch (e) {
    tried.push({ url: GAS_24H_URL, status: 'error', note: String(e).slice(0, 120) });
  }

  // 2. Petrolimex (backup) — thử nếu 24h đổi layout
  for (const url of PETROLIMEX_URLS) {
    try {
      const html = await fetchText(url);
      const items = parsePetrolimex(html);
      if (items.length > 0) {
        tried.push({ url, status: 'ok', note: `${items.length} items (petrolimex backup)` });
        return { source: 'Petrolimex', url, items, tried };
      }
      tried.push({ url, status: 'no_match', note: 'regex không khớp' });
    } catch (e) {
      tried.push({ url, status: 'error', note: String(e).slice(0, 120) });
    }
  }

  return {
    source: '24h.com.vn (seed fallback)',
    url: GAS_24H_URL,
    items: SEED_GAS,
    error: 'all_sources_failed',
    tried,
  };
}

// ============ GOLD ============

/**
 * SJC XML feed — thử match các schema phổ biến:
 *   <Item Name="..." Buy="..." Sell="..."/>
 *   <row Loai="..." Mua="..." Ban="..."/>
 *   <gia TenVang="..." GiaMua="..." GiaBan="..."/>
 */
function parseSJCXml(xml: string): GoldItem[] {
  const items: GoldItem[] = [];
  const rowRe = /<(?:Item|row|gia|rate)\s+([^>]+?)\/?>/gi;
  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(xml)) !== null) {
    const attrs = m[1];
    const nameAttr = attrs.match(
      /(?:Name|TenVang|Loai|TypeName|title)\s*=\s*"([^"]+)"/i
    );
    const buyAttr = attrs.match(
      /(?:Buy|Mua|GiaMua|PurchaseRate|buyRate)\s*=\s*"([^"]+)"/i
    );
    const sellAttr = attrs.match(
      /(?:Sell|Ban|GiaBan|TransferRate|sellRate)\s*=\s*"([^"]+)"/i
    );
    if (!nameAttr || !buyAttr || !sellAttr) continue;
    const buy = parseVND(buyAttr[1]);
    const sell = parseVND(sellAttr[1]);
    if (buy > 1_000_000 && sell > 1_000_000 && sell < 500_000_000) {
      items.push({ name: nameAttr[1].trim(), buy, sell });
    }
  }
  return items.slice(0, 6);
}

function parseSJCHtml(html: string): GoldItem[] {
  const items: GoldItem[] = [];
  const stripped = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const types: Array<{ name: string; regex: RegExp }> = [
    { name: 'SJC (1L, 10L, 1 chỉ)', regex: /SJC\s*1L[,\s]*10L/i },
    { name: 'Nhẫn SJC 99,99%', regex: /Nhẫn\s*SJC\s*99[,\.]?99/i },
    { name: 'Nữ trang 99,99%', regex: /Nữ\s*trang\s*99[,\.]?99/i },
    { name: 'Nữ trang 75%', regex: /Nữ\s*trang\s*75/i },
  ];

  for (const t of types) {
    const m = stripped.match(t.regex);
    if (!m || m.index == null) continue;
    const window = stripped.slice(m.index, m.index + 400);
    const nums = Array.from(window.matchAll(/\b(\d{2,3}[\.,]\d{3}[\.,]\d{3})\b/g))
      .map((mm) => parseVND(mm[1]))
      .filter((n) => n > 1_000_000 && n < 500_000_000);
    if (nums.length >= 2) {
      items.push({ name: t.name, buy: nums[0], sell: nums[1] });
    }
  }
  return items;
}

/**
 * 24h.com.vn/gia-vang-... — trang tổng hợp SJC/PNJ/DOJI/BTMC.
 * Mỗi dòng thường là: "SJC 10L, 1L ... 120.000 ... 122.000"
 * Parser dùng regex tìm 2 số triệu liên tiếp cạnh tên sản phẩm.
 */
function parse24hGold(html: string): GoldItem[] {
  const stripped = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const items: GoldItem[] = [];
  const types: Array<{ name: string; regex: RegExp }> = [
    { name: 'SJC (1L, 10L)', regex: /SJC\s*(?:10L|1\s*L)/i },
    { name: 'Nhẫn SJC 99,99%', regex: /Nhẫn\s*(?:SJC\s*)?9999|Nhẫn\s*SJC/i },
    { name: 'PNJ 99,99%', regex: /PNJ\s*9999|PNJ\s*99[,\.]99/i },
    { name: 'DOJI SJC', regex: /DOJI(?:\s*SJC)?/i },
    { name: 'DOJI Nhẫn 99,99%', regex: /DOJI\s*(?:Nhẫn|9999)/i },
    { name: 'Nữ trang 75%', regex: /Nữ\s*trang\s*75/i },
  ];
  for (const t of types) {
    const m = stripped.match(t.regex);
    if (!m || m.index == null) continue;
    const window = stripped.slice(m.index, m.index + 400);
    const nums = Array.from(window.matchAll(/\b(\d{2,3}[\.,]\d{3}[\.,]\d{3}|\d{2,3}[\.,]\d{3})\b/g))
      .map((mm) => parseVND(mm[1]))
      .filter((n) => n > 1_000_000 && n < 500_000_000);
    if (nums.length >= 2) {
      items.push({ name: t.name, buy: nums[0], sell: nums[1] });
    }
  }
  const seen = new Set<string>();
  return items.filter((it) => {
    if (seen.has(it.name)) return false;
    seen.add(it.name);
    return true;
  }).slice(0, 6);
}

const SEED_GOLD: GoldItem[] = [
  { name: 'SJC (1L, 10L, 1 chỉ)', buy: 120_000_000, sell: 122_000_000 },
  { name: 'Nhẫn SJC 99,99%', buy: 114_500_000, sell: 116_500_000 },
  { name: 'Nữ trang 75%', buy: 83_500_000, sell: 85_500_000 },
];

async function scrapeGold(): Promise<GoldResult> {
  const tried: TryLog[] = [];

  // 1. 24h.com.vn (PRIMARY — Phase 11.5.7, tổng hợp SJC/PNJ/DOJI)
  try {
    const html = await fetchText(GOLD_24H_URL);
    const items = parse24hGold(html);
    if (items.length > 0) {
      tried.push({ url: GOLD_24H_URL, status: 'ok', note: `${items.length} items (24h)` });
      return { source: '24h.com.vn', url: GOLD_24H_URL, items, tried };
    }
    tried.push({ url: GOLD_24H_URL, status: 'no_match', note: '24h regex không khớp' });
  } catch (e) {
    tried.push({ url: GOLD_24H_URL, status: 'error', note: String(e).slice(0, 120) });
  }

  // 2. SJC XML (backup — nếu endpoint tồn tại)
  try {
    const xml = await fetchText(SJC_XML_URL);
    const items = parseSJCXml(xml);
    if (items.length > 0) {
      tried.push({
        url: SJC_XML_URL,
        status: 'ok',
        note: `${items.length} items (xml backup)`,
      });
      return { source: 'SJC (XML)', url: SJC_XML_URL, items, tried };
    }
    tried.push({
      url: SJC_XML_URL,
      status: 'no_match',
      note: 'xml schema không nhận dạng',
    });
  } catch (e) {
    tried.push({ url: SJC_XML_URL, status: 'error', note: String(e).slice(0, 120) });
  }

  // 3. SJC HTML (backup cuối)
  try {
    const html = await fetchText(SJC_HTML_URL);
    const items = parseSJCHtml(html);
    if (items.length > 0) {
      tried.push({
        url: SJC_HTML_URL,
        status: 'ok',
        note: `${items.length} items (html backup)`,
      });
      return { source: 'SJC', url: SJC_HTML_URL, items, tried };
    }
    tried.push({
      url: SJC_HTML_URL,
      status: 'no_match',
      note: 'regex không khớp',
    });
  } catch (e) {
    tried.push({
      url: SJC_HTML_URL,
      status: 'error',
      note: String(e).slice(0, 120),
    });
  }

  return {
    source: '24h.com.vn (seed fallback)',
    url: GOLD_24H_URL,
    items: SEED_GOLD,
    error: 'all_sources_failed',
    tried,
  };
}

// ============ HANDLER ============

export async function GET(): Promise<Response> {
  const [gas, gold] = await Promise.all([scrapeGas(), scrapeGold()]);
  return Response.json({
    ok: true,
    updated_at: new Date().toISOString(),
    gas,
    gold,
  });
}
