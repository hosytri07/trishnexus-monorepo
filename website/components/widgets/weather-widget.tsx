'use client';

/**
 * WeatherWidget — thời tiết realtime theo GPS user (fallback Đà Nẵng).
 *
 * Flow:
 *   1. Load cache localStorage nếu còn hạn (15 min) → render ngay.
 *   2. Hỏi navigator.geolocation.getCurrentPosition (1 lần).
 *   3. Reverse-geocode → city name qua nominatim.openstreetmap.org (free, no key).
 *   4. Fetch open-meteo với lat/lon thật.
 *   5. Nếu user reject hoặc timeout 8s → fallback Đà Nẵng 16.05/108.20.
 *
 * Cache tách 2 key: vị trí (localStorage) + data (localStorage TTL 15').
 * Đổi city → invalidate cache data.
 */
import { useEffect, useState } from 'react';
import {
  Cloud,
  CloudRain,
  Sun,
  CloudSnow,
  Zap,
  Droplets,
  Wind,
  MapPin,
  RefreshCw,
} from 'lucide-react';
import { WidgetCard } from './widget-card';

type Coords = { lat: number; lon: number; city: string };

type WeatherData = {
  coords: Coords;
  temperature: number;
  feels_like: number;
  humidity: number;
  wind_speed: number;
  weather_code: number;
  fetched_at: number;
};

const COORDS_KEY = 'trishteam:weather:coords';
const DATA_KEY = 'trishteam:weather:data';
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 phút

const FALLBACK_COORDS: Coords = { lat: 16.0544, lon: 108.2022, city: 'Đà Nẵng' };

function endpointForWeather(lat: number, lon: number): string {
  return (
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m` +
    `&timezone=auto`
  );
}

function endpointForReverseGeocode(lat: number, lon: number): string {
  // open-meteo có API geocoding riêng — free, không cần key, khá ổn
  // nhưng không có reverse search. Dùng Nominatim (OSM) — có rate limit nhẹ.
  return (
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2` +
    `&lat=${lat}&lon=${lon}&accept-language=vi&zoom=10`
  );
}

function describeWeather(code: number): { label: string; Icon: typeof Sun } {
  if (code === 0) return { label: 'Trời quang', Icon: Sun };
  if (code >= 1 && code <= 3) return { label: 'Ít mây', Icon: Cloud };
  if (code >= 45 && code <= 48) return { label: 'Sương mù', Icon: Cloud };
  if (code >= 51 && code <= 67) return { label: 'Mưa phùn', Icon: CloudRain };
  if (code >= 71 && code <= 77) return { label: 'Tuyết', Icon: CloudSnow };
  if (code >= 80 && code <= 82) return { label: 'Mưa rào', Icon: CloudRain };
  if (code >= 95 && code <= 99) return { label: 'Dông', Icon: Zap };
  return { label: 'Mây', Icon: Cloud };
}

function loadCachedCoords(): Coords | null {
  try {
    const raw = window.localStorage.getItem(COORDS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Coords;
  } catch {
    return null;
  }
}

function saveCachedCoords(c: Coords): void {
  try {
    window.localStorage.setItem(COORDS_KEY, JSON.stringify(c));
  } catch {
    /* ignore */
  }
}

function loadCachedData(): WeatherData | null {
  try {
    const raw = window.localStorage.getItem(DATA_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WeatherData;
    if (Date.now() - parsed.fetched_at > CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveCachedData(d: WeatherData): void {
  try {
    window.localStorage.setItem(DATA_KEY, JSON.stringify(d));
  } catch {
    /* ignore */
  }
}

async function reverseGeocode(lat: number, lon: number): Promise<string> {
  try {
    const r = await fetch(endpointForReverseGeocode(lat, lon), {
      headers: { 'Accept-Language': 'vi' },
    });
    if (!r.ok) throw new Error(String(r.status));
    const json = await r.json();
    const addr = json?.address ?? {};
    const city =
      addr.city ||
      addr.town ||
      addr.county ||
      addr.state ||
      addr.country ||
      'Không rõ';
    return city;
  } catch {
    return 'Không rõ';
  }
}

/** Xin quyền GPS rồi trả về coords (fallback nếu fail). */
function getUserCoords(): Promise<Coords> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve(FALLBACK_COORDS);
      return;
    }
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(FALLBACK_COORDS);
      }
    }, 8000);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        const city = await reverseGeocode(lat, lon);
        resolve({ lat, lon, city });
      },
      () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(FALLBACK_COORDS);
      },
      { enableHighAccuracy: false, maximumAge: 10 * 60 * 1000, timeout: 6000 }
    );
  });
}

async function fetchWeather(coords: Coords): Promise<WeatherData> {
  const r = await fetch(endpointForWeather(coords.lat, coords.lon));
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const json = await r.json();
  return {
    coords,
    temperature: Math.round(json.current?.temperature_2m ?? 0),
    feels_like: Math.round(json.current?.apparent_temperature ?? 0),
    humidity: Math.round(json.current?.relative_humidity_2m ?? 0),
    wind_speed: Math.round(json.current?.wind_speed_10m ?? 0),
    weather_code: json.current?.weather_code ?? 0,
    fetched_at: Date.now(),
  };
}

export function WeatherWidget() {
  const [data, setData] = useState<WeatherData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0); // trigger refetch

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        // 1. Nếu có cache còn hạn → dùng ngay
        const cachedData = loadCachedData();
        if (cachedData && nonce === 0) {
          if (!cancelled) {
            setData(cachedData);
            setLoading(false);
          }
          return;
        }

        // 2. Lấy coords: cache hoặc hỏi GPS
        let coords = loadCachedCoords();
        if (!coords || nonce !== 0) {
          coords = await getUserCoords();
          saveCachedCoords(coords);
        }

        // 3. Fetch weather
        const weather = await fetchWeather(coords);
        if (cancelled) return;
        saveCachedData(weather);
        setData(weather);
      } catch (e) {
        if (!cancelled) setError(String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [nonce]);

  const { label, Icon } = data
    ? describeWeather(data.weather_code)
    : { label: 'Đang tải…', Icon: Cloud };

  const cityLabel = data?.coords.city ?? 'Đang xác định vị trí…';

  return (
    <WidgetCard
      title="Thời tiết"
      icon={<Cloud size={16} strokeWidth={2} />}
      action={
        <button
          type="button"
          onClick={() => setNonce((n) => n + 1)}
          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors hover:opacity-80"
          style={{ color: 'var(--color-text-muted)' }}
          aria-label="Làm mới"
          title="Làm mới"
          disabled={loading}
        >
          <RefreshCw
            size={12}
            strokeWidth={2}
            className={loading ? 'animate-spin' : ''}
          />
          {loading ? 'Tải…' : 'Làm mới'}
        </button>
      }
    >
      <div className="py-1">
        <div className="flex items-center gap-4">
          <Icon
            size={56}
            strokeWidth={1.5}
            style={{ color: 'var(--color-accent-primary)' }}
          />
          <div className="min-w-0">
            <div
              className="font-bold tabular-nums tracking-tight"
              style={{
                fontSize: 'clamp(2.25rem, 5vw, 3rem)',
                color: 'var(--color-text-primary)',
                lineHeight: 1,
              }}
            >
              {loading && !data ? '--' : error ? '--' : `${data!.temperature}°C`}
            </div>
            <div
              className="text-sm mt-1 truncate"
              style={{ color: 'var(--color-text-muted)' }}
            >
              {error ? 'Không tải được' : label}
              {data && ` · cảm giác ${data.feels_like}°`}
            </div>
          </div>
        </div>

        <div
          className="flex items-center gap-5 mt-4 pt-3 text-sm border-t flex-wrap"
          style={{
            borderColor: 'var(--color-border-subtle)',
            color: 'var(--color-text-muted)',
          }}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <MapPin
              size={14}
              strokeWidth={2}
              style={{ color: 'var(--color-accent-primary)' }}
            />
            <span
              className="truncate font-medium"
              style={{ color: 'var(--color-text-secondary)' }}
              title={cityLabel}
            >
              {cityLabel}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Droplets size={14} strokeWidth={2} style={{ color: '#3B82F6' }} />
            <span className="tabular-nums">{data ? `${data.humidity}%` : '--%'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Wind size={14} strokeWidth={2} style={{ color: '#06B6D4' }} />
            <span className="tabular-nums">
              {data ? `${data.wind_speed} km/h` : '-- km/h'}
            </span>
          </div>
        </div>
      </div>
    </WidgetCard>
  );
}
