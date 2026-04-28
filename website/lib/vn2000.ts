/**
 * lib/vn2000.ts — Phase 19.20 — VN2000 ↔ WGS84 transformation.
 *
 * Source: Quyết định 05/2007/QĐ-BTNMT về tham số chuyển đổi giữa hệ toạ độ
 * VN2000 (Krasovsky 1940 ellipsoid) và WGS84.
 *
 * Tham số trung bình quốc gia (7-parameter Helmert):
 *   dx = -191.90441429 m
 *   dy = -39.30318279 m
 *   dz = -111.45032835 m
 *   rx = -0.00928836 arcsec
 *   ry = 0.01975479 arcsec
 *   rz = -0.00427372 arcsec
 *   m  = 0.252906278 ppm
 *
 * Sai số kỳ vọng: ±5m theo thông báo BTNMT — phù hợp cho khảo sát sơ bộ +
 * tham khảo. Cho công trình chính xác cần dùng tham số riêng từng tỉnh.
 *
 * Ellipsoids:
 *   WGS84: a=6378137, f=1/298.257223563
 *   Krasovsky 1940: a=6378245, f=1/298.3
 *
 * Note: VN2000 gốc projection Gauss-Krüger nhưng tham số chuyển ECEF → blh
 *       dùng ellipsoid Krasovsky.
 */

// ============================================================
// Ellipsoid params
// ============================================================
const WGS84 = {
  a: 6378137.0,
  f: 1 / 298.257223563,
};
const KRASOVSKY = {
  a: 6378245.0,
  f: 1 / 298.3,
};

// 7-param Helmert (national average) WGS84 → VN2000
// Theo Quyết định 05/2007/QĐ-BTNMT
const HELMERT = {
  dx: -191.90441429,
  dy: -39.30318279,
  dz: -111.45032835,
  rx_sec: -0.00928836,
  ry_sec: 0.01975479,
  rz_sec: -0.00427372,
  m_ppm: 0.252906278,
};

const ARCSEC_TO_RAD = Math.PI / (180 * 3600);

// ============================================================
// blh ↔ ECEF conversions
// ============================================================
function blhToEcef(
  lat: number,
  lon: number,
  h: number,
  ell: { a: number; f: number },
): [number, number, number] {
  const phi = (lat * Math.PI) / 180;
  const lam = (lon * Math.PI) / 180;
  const e2 = 2 * ell.f - ell.f * ell.f;
  const N = ell.a / Math.sqrt(1 - e2 * Math.sin(phi) * Math.sin(phi));
  const x = (N + h) * Math.cos(phi) * Math.cos(lam);
  const y = (N + h) * Math.cos(phi) * Math.sin(lam);
  const z = (N * (1 - e2) + h) * Math.sin(phi);
  return [x, y, z];
}

function ecefToBlh(
  x: number,
  y: number,
  z: number,
  ell: { a: number; f: number },
): [number, number, number] {
  const e2 = 2 * ell.f - ell.f * ell.f;
  const p = Math.sqrt(x * x + y * y);
  let phi = Math.atan2(z, p * (1 - e2));
  let N: number;
  // Iterative — convergence after 3-5 iters
  for (let i = 0; i < 10; i++) {
    N = ell.a / Math.sqrt(1 - e2 * Math.sin(phi) * Math.sin(phi));
    const newPhi = Math.atan2(z + e2 * N * Math.sin(phi), p);
    if (Math.abs(newPhi - phi) < 1e-12) {
      phi = newPhi;
      break;
    }
    phi = newPhi;
  }
  const lam = Math.atan2(y, x);
  const sinPhi = Math.sin(phi);
  const Nfinal = ell.a / Math.sqrt(1 - e2 * sinPhi * sinPhi);
  const h = p / Math.cos(phi) - Nfinal;
  return [(phi * 180) / Math.PI, (lam * 180) / Math.PI, h];
}

// ============================================================
// Helmert 7-param transform
// ============================================================
function applyHelmert(
  x: number,
  y: number,
  z: number,
  inverse = false,
): [number, number, number] {
  const sign = inverse ? -1 : 1;
  const dx = sign * HELMERT.dx;
  const dy = sign * HELMERT.dy;
  const dz = sign * HELMERT.dz;
  const rx = sign * HELMERT.rx_sec * ARCSEC_TO_RAD;
  const ry = sign * HELMERT.ry_sec * ARCSEC_TO_RAD;
  const rz = sign * HELMERT.rz_sec * ARCSEC_TO_RAD;
  const m = 1 + sign * HELMERT.m_ppm * 1e-6;
  // Simplified rotation (small-angle)
  const xp = m * (x + rz * y - ry * z) + dx;
  const yp = m * (-rz * x + y + rx * z) + dy;
  const zp = m * (ry * x - rx * y + z) + dz;
  return [xp, yp, zp];
}

// ============================================================
// Public API
// ============================================================
export interface LatLng {
  lat: number;
  lon: number;
  h?: number;
}

/** WGS84 → VN2000 (Krasovsky lat/lon/h) */
export function wgs84ToVn2000(p: LatLng): LatLng {
  const [x1, y1, z1] = blhToEcef(p.lat, p.lon, p.h ?? 0, WGS84);
  const [x2, y2, z2] = applyHelmert(x1, y1, z1, false);
  const [lat, lon, h] = ecefToBlh(x2, y2, z2, KRASOVSKY);
  return { lat, lon, h };
}

/** VN2000 → WGS84 */
export function vn2000ToWgs84(p: LatLng): LatLng {
  const [x1, y1, z1] = blhToEcef(p.lat, p.lon, p.h ?? 0, KRASOVSKY);
  const [x2, y2, z2] = applyHelmert(x1, y1, z1, true);
  const [lat, lon, h] = ecefToBlh(x2, y2, z2, WGS84);
  return { lat, lon, h };
}

/** Format DD → DMS string. */
export function ddToDms(dd: number, isLat = true): string {
  const abs = Math.abs(dd);
  const d = Math.floor(abs);
  const minFloat = (abs - d) * 60;
  const m = Math.floor(minFloat);
  const s = ((minFloat - m) * 60).toFixed(3);
  const hemi = isLat ? (dd >= 0 ? 'N' : 'S') : dd >= 0 ? 'E' : 'W';
  return `${d}°${m}'${s}"${hemi}`;
}

/** Parse DMS string ("21°02'13.245N") → DD. Trả null nếu fail. */
export function dmsToDd(s: string): number | null {
  const m = s.match(/^(-?\d+(?:\.\d+)?)\s*[°d]?\s*(\d+(?:\.\d+)?)?\s*['m]?\s*(\d+(?:\.\d+)?)?\s*["s]?\s*([NSEW])?$/i);
  if (!m) return null;
  const d = parseFloat(m[1]!);
  const min = parseFloat(m[2] ?? '0');
  const sec = parseFloat(m[3] ?? '0');
  const hemi = (m[4] ?? '').toUpperCase();
  let dd = Math.abs(d) + min / 60 + sec / 3600;
  if (d < 0 || hemi === 'S' || hemi === 'W') dd = -dd;
  return dd;
}
