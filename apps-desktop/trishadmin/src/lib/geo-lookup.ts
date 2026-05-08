/**
 * Phase 24.3 — IP geo lookup with Firestore cache.
 *
 * Strategy:
 *   1. Check /ip_geo/{ip} (cached)
 *   2. If miss/stale (>7 days) → fetch http://ip-api.com/json/{ip} (free, no key)
 *   3. Write back to Firestore for next time
 *
 * Rate limit ip-api.com: 45 req/min. Cache giảm hit drastically.
 */
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getFirebaseDb } from '@trishteam/auth';
import { paths, type IpGeoCache } from '@trishteam/data';

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface IpApiResponse {
  status: 'success' | 'fail';
  message?: string;
  country?: string;
  countryCode?: string;
  region?: string;
  regionName?: string;
  city?: string;
  isp?: string;
  org?: string;
  as?: string;
  proxy?: boolean;
  hosting?: boolean;
  mobile?: boolean;
  lat?: number;
  lon?: number;
}

/** In-memory cache cho session để tránh hit Firestore lặp lại */
const memoryCache = new Map<string, IpGeoCache>();

/**
 * Lookup IP → geo info. Returns null nếu IP invalid hoặc lookup fail.
 *
 * Cache layers (best → worst):
 *   1. Memory (1 session)
 *   2. Firestore (7 ngày)
 *   3. ip-api.com (live)
 */
export async function geoLookup(ip: string): Promise<IpGeoCache | null> {
  if (!ip || ip === 'unknown' || ip === 'localhost' || ip.startsWith('127.')) {
    return null;
  }

  // Layer 1: memory
  const cached = memoryCache.get(ip);
  if (cached && Date.now() - cached.cached_at < CACHE_TTL_MS) {
    return cached;
  }

  // Layer 2: Firestore
  const db = getFirebaseDb();
  const docRef = doc(db, paths.ipGeo(ip));
  try {
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data() as IpGeoCache;
      if (Date.now() - data.cached_at < CACHE_TTL_MS) {
        memoryCache.set(ip, data);
        return data;
      }
    }
  } catch (err) {
    console.warn('[geo-lookup] Firestore read fail:', err);
  }

  // Layer 3: ip-api.com (free, no auth)
  try {
    const res = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,message,country,countryCode,region,regionName,city,isp,org,as,proxy,hosting,mobile,lat,lon`,
    );
    if (!res.ok) {
      console.warn('[geo-lookup] ip-api fetch fail:', res.status);
      return null;
    }
    const data = (await res.json()) as IpApiResponse;
    if (data.status !== 'success') {
      return null;
    }
    const entry: IpGeoCache = {
      ip,
      ...(data.country ? { country: data.country } : {}),
      ...(data.countryCode ? { country_code: data.countryCode } : {}),
      ...(data.regionName ? { region: data.regionName } : {}),
      ...(data.city ? { city: data.city } : {}),
      ...(data.isp ? { isp: data.isp } : {}),
      ...(data.org ? { org: data.org } : {}),
      ...(data.as ? { as_number: data.as } : {}),
      is_proxy: data.proxy ?? false,
      is_hosting: data.hosting ?? false,
      is_mobile: data.mobile ?? false,
      ...(data.lat !== undefined ? { lat: data.lat } : {}),
      ...(data.lon !== undefined ? { lon: data.lon } : {}),
      cached_at: Date.now(),
    };

    // Write-back cache (best-effort)
    try {
      await setDoc(docRef, entry as unknown as Record<string, unknown>);
    } catch (err) {
      console.warn('[geo-lookup] Firestore write fail:', err);
    }
    memoryCache.set(ip, entry);
    return entry;
  } catch (err) {
    console.warn('[geo-lookup] ip-api fetch error:', err);
    return null;
  }
}

/**
 * Bulk lookup nhiều IPs cùng lúc (parallel với rate limit 45/min).
 * Throttle: chunk 40 mỗi 60s.
 */
export async function geoLookupBatch(
  ips: string[],
): Promise<Map<string, IpGeoCache | null>> {
  const result = new Map<string, IpGeoCache | null>();
  const unique = Array.from(new Set(ips));
  const CHUNK = 40;
  for (let i = 0; i < unique.length; i += CHUNK) {
    const batch = unique.slice(i, i + CHUNK);
    const lookups = await Promise.all(batch.map((ip) => geoLookup(ip).catch(() => null)));
    batch.forEach((ip, idx) => result.set(ip, lookups[idx]));
    if (i + CHUNK < unique.length) {
      await new Promise((r) => setTimeout(r, 1500)); // 1.5s gap để khỏi rate limit
    }
  }
  return result;
}

/**
 * Convert ISO country code (vd "VN", "US") sang flag emoji 🇻🇳 🇺🇸.
 * Đơn giản: 2 chars → 2 regional indicators.
 */
export function countryFlagEmoji(code?: string): string {
  if (!code || code.length !== 2) return '🌍';
  const A = 0x1f1e6;
  const upper = code.toUpperCase();
  const cp1 = upper.charCodeAt(0) - 65 + A;
  const cp2 = upper.charCodeAt(1) - 65 + A;
  return String.fromCodePoint(cp1, cp2);
}

/** Format ngắn gọn cho hiển thị trong table */
export function formatGeoShort(geo: IpGeoCache | null): string {
  if (!geo) return '—';
  const flag = countryFlagEmoji(geo.country_code);
  const city = geo.city ?? '';
  const country = geo.country ?? '';
  if (city && country) return `${flag} ${city}, ${country}`;
  if (country) return `${flag} ${country}`;
  return flag;
}
