/**
 * VN-2000 Coordinate System — Phase 28.13.
 *
 * Hệ tọa độ quốc gia VN-2000 (Thông tư 24/2024/TT-BTNMT, kế thừa từ
 * Quyết định 83/2000/QĐ-TTg). Mỗi tỉnh có kinh tuyến trục riêng để
 * giảm sai số đo đạc trên địa bàn.
 *
 * Map: tỉnh (lower-snake_case) → kinh tuyến trục (degrees) + múi chiếu (3°/6°).
 * Phần lớn tỉnh dùng múi 3°. Các tỉnh có địa hình rộng dùng múi 6°.
 *
 * Chuyển đổi WGS-84 (lat/lon) ↔ VN-2000 (X, Y):
 *   - Ellipsoid: WGS-84 (Việt Nam dùng WGS-84 cho VN-2000, không phải Krasovsky cũ)
 *     a = 6378137.0, f = 1/298.257223563
 *   - Phép chiếu: Transverse Mercator (UTM-like nhưng với kinh tuyến trục local)
 *   - Scale factor k0: 0.9999 cho múi 3°, 0.9996 cho múi 6° (theo TT 24/2024)
 *   - False Easting: 500000m
 *   - False Northing: 0m
 */

export type ZoneWidth = 3 | 6;

export interface VN2000Province {
  code: string;          // mã tỉnh (snake_case không dấu)
  name: string;          // Tên tiếng Việt
  meridian: number;      // kinh tuyến trục (độ thập phân)
  zoneWidth: ZoneWidth;  // múi chiếu
}

/**
 * Kinh tuyến trục VN-2000 cho 63 tỉnh thành (theo Phụ lục VI Thông tư
 * 24/2024/TT-BTNMT). Phần lớn dùng múi 3°.
 */
export const VN2000_PROVINCES: VN2000Province[] = [
  // Miền Bắc
  { code: 'lai_chau', name: 'Lai Châu', meridian: 103.0, zoneWidth: 3 },
  { code: 'dien_bien', name: 'Điện Biên', meridian: 103.0, zoneWidth: 3 },
  { code: 'son_la', name: 'Sơn La', meridian: 104.0, zoneWidth: 3 },
  { code: 'lao_cai', name: 'Lào Cai', meridian: 104.75, zoneWidth: 3 },
  { code: 'yen_bai', name: 'Yên Bái', meridian: 104.75, zoneWidth: 3 },
  { code: 'phu_tho', name: 'Phú Thọ', meridian: 104.75, zoneWidth: 3 },
  { code: 'ha_giang', name: 'Hà Giang', meridian: 105.5, zoneWidth: 3 },
  { code: 'tuyen_quang', name: 'Tuyên Quang', meridian: 106.0, zoneWidth: 3 },
  { code: 'cao_bang', name: 'Cao Bằng', meridian: 105.75, zoneWidth: 3 },
  { code: 'bac_kan', name: 'Bắc Kạn', meridian: 106.5, zoneWidth: 3 },
  { code: 'thai_nguyen', name: 'Thái Nguyên', meridian: 106.5, zoneWidth: 3 },
  { code: 'lang_son', name: 'Lạng Sơn', meridian: 107.25, zoneWidth: 3 },
  { code: 'quang_ninh', name: 'Quảng Ninh', meridian: 107.75, zoneWidth: 3 },
  { code: 'hai_phong', name: 'Hải Phòng', meridian: 105.75, zoneWidth: 3 },
  { code: 'hai_duong', name: 'Hải Dương', meridian: 105.5, zoneWidth: 3 },
  { code: 'bac_giang', name: 'Bắc Giang', meridian: 107.0, zoneWidth: 3 },
  { code: 'bac_ninh', name: 'Bắc Ninh', meridian: 105.5, zoneWidth: 3 },
  { code: 'hung_yen', name: 'Hưng Yên', meridian: 105.5, zoneWidth: 3 },
  { code: 'thai_binh', name: 'Thái Bình', meridian: 105.5, zoneWidth: 3 },
  { code: 'nam_dinh', name: 'Nam Định', meridian: 105.5, zoneWidth: 3 },
  { code: 'ha_nam', name: 'Hà Nam', meridian: 105.0, zoneWidth: 3 },
  { code: 'ninh_binh', name: 'Ninh Bình', meridian: 105.0, zoneWidth: 3 },
  { code: 'ha_noi', name: 'Hà Nội', meridian: 105.0, zoneWidth: 3 },
  { code: 'hoa_binh', name: 'Hòa Bình', meridian: 106.0, zoneWidth: 6 },
  { code: 'thanh_hoa', name: 'Thanh Hóa', meridian: 105.0, zoneWidth: 3 },
  { code: 'nghe_an', name: 'Nghệ An', meridian: 104.75, zoneWidth: 3 },
  { code: 'ha_tinh', name: 'Hà Tĩnh', meridian: 105.5, zoneWidth: 3 },

  // Miền Trung
  { code: 'quang_binh', name: 'Quảng Bình', meridian: 106.0, zoneWidth: 3 },
  { code: 'quang_tri', name: 'Quảng Trị', meridian: 106.25, zoneWidth: 3 },
  { code: 'thua_thien_hue', name: 'Thừa Thiên Huế', meridian: 107.0, zoneWidth: 3 },
  { code: 'da_nang', name: 'Đà Nẵng', meridian: 107.75, zoneWidth: 3 },
  { code: 'quang_nam', name: 'Quảng Nam', meridian: 107.75, zoneWidth: 3 },
  { code: 'quang_ngai', name: 'Quảng Ngãi', meridian: 108.0, zoneWidth: 3 },
  { code: 'binh_dinh', name: 'Bình Định', meridian: 108.25, zoneWidth: 3 },
  { code: 'phu_yen', name: 'Phú Yên', meridian: 108.5, zoneWidth: 3 },
  { code: 'khanh_hoa', name: 'Khánh Hòa', meridian: 108.25, zoneWidth: 3 },
  { code: 'ninh_thuan', name: 'Ninh Thuận', meridian: 108.25, zoneWidth: 3 },
  { code: 'binh_thuan', name: 'Bình Thuận', meridian: 108.5, zoneWidth: 3 },
  { code: 'kon_tum', name: 'Kon Tum', meridian: 107.5, zoneWidth: 3 },
  { code: 'gia_lai', name: 'Gia Lai', meridian: 108.5, zoneWidth: 3 },
  { code: 'dak_lak', name: 'Đắk Lắk', meridian: 108.5, zoneWidth: 3 },
  { code: 'dak_nong', name: 'Đắk Nông', meridian: 108.5, zoneWidth: 3 },
  { code: 'lam_dong', name: 'Lâm Đồng', meridian: 107.75, zoneWidth: 3 },

  // Miền Nam
  { code: 'binh_phuoc', name: 'Bình Phước', meridian: 106.25, zoneWidth: 3 },
  { code: 'tay_ninh', name: 'Tây Ninh', meridian: 105.5, zoneWidth: 3 },
  { code: 'binh_duong', name: 'Bình Dương', meridian: 105.75, zoneWidth: 3 },
  { code: 'dong_nai', name: 'Đồng Nai', meridian: 107.75, zoneWidth: 3 },
  { code: 'ba_ria_vung_tau', name: 'Bà Rịa - Vũng Tàu', meridian: 107.75, zoneWidth: 3 },
  { code: 'ho_chi_minh', name: 'TP. Hồ Chí Minh', meridian: 105.75, zoneWidth: 3 },
  { code: 'long_an', name: 'Long An', meridian: 105.75, zoneWidth: 3 },
  { code: 'tien_giang', name: 'Tiền Giang', meridian: 105.75, zoneWidth: 3 },
  { code: 'ben_tre', name: 'Bến Tre', meridian: 105.75, zoneWidth: 3 },
  { code: 'tra_vinh', name: 'Trà Vinh', meridian: 105.5, zoneWidth: 3 },
  { code: 'vinh_long', name: 'Vĩnh Long', meridian: 105.5, zoneWidth: 3 },
  { code: 'dong_thap', name: 'Đồng Tháp', meridian: 105.0, zoneWidth: 3 },
  { code: 'an_giang', name: 'An Giang', meridian: 104.75, zoneWidth: 3 },
  { code: 'kien_giang', name: 'Kiên Giang', meridian: 104.5, zoneWidth: 3 },
  { code: 'can_tho', name: 'Cần Thơ', meridian: 105.0, zoneWidth: 3 },
  { code: 'hau_giang', name: 'Hậu Giang', meridian: 105.0, zoneWidth: 3 },
  { code: 'soc_trang', name: 'Sóc Trăng', meridian: 105.5, zoneWidth: 3 },
  { code: 'bac_lieu', name: 'Bạc Liêu', meridian: 105.0, zoneWidth: 3 },
  { code: 'ca_mau', name: 'Cà Mau', meridian: 104.5, zoneWidth: 3 },
];

/** Default tỉnh — Đà Nẵng (theo Trí). */
export const DEFAULT_PROVINCE_CODE = 'da_nang';

export function findProvince(code: string): VN2000Province | null {
  return VN2000_PROVINCES.find((p) => p.code === code) ?? null;
}

// ============================================================
// WGS-84 (lat/lon) ↔ VN-2000 (Easting, Northing)
// ============================================================

const A = 6378137.0;                          // semi-major axis WGS-84
const F = 1 / 298.257223563;                  // flattening
const E2 = F * (2 - F);                       // first eccentricity squared
const FALSE_EASTING = 500000;
const FALSE_NORTHING = 0;

/** Scale factor k0 theo múi chiếu (TT 24/2024). */
function getK0(zoneWidth: ZoneWidth): number {
  return zoneWidth === 3 ? 0.9999 : 0.9996;
}

function deg2rad(d: number): number { return (d * Math.PI) / 180; }
function rad2deg(r: number): number { return (r * 180) / Math.PI; }

/**
 * Convert WGS-84 (lat, lon độ thập phân) → VN-2000 (X = Northing, Y = Easting).
 * Algorithm: Transverse Mercator (TM) projection.
 */
export function wgs84ToVn2000(
  lat: number,
  lon: number,
  province: VN2000Province,
): { x: number; y: number } {
  const k0 = getK0(province.zoneWidth);
  const lambda0 = deg2rad(province.meridian);
  const phi = deg2rad(lat);
  const lambda = deg2rad(lon);

  const eSq = E2;
  const ePrimeSq = eSq / (1 - eSq);
  const N = A / Math.sqrt(1 - eSq * Math.sin(phi) ** 2);
  const T = Math.tan(phi) ** 2;
  const C = ePrimeSq * Math.cos(phi) ** 2;
  const Acoef = Math.cos(phi) * (lambda - lambda0);

  // M — meridional arc
  const M = A * (
    (1 - eSq / 4 - 3 * eSq ** 2 / 64 - 5 * eSq ** 3 / 256) * phi
    - (3 * eSq / 8 + 3 * eSq ** 2 / 32 + 45 * eSq ** 3 / 1024) * Math.sin(2 * phi)
    + (15 * eSq ** 2 / 256 + 45 * eSq ** 3 / 1024) * Math.sin(4 * phi)
    - (35 * eSq ** 3 / 3072) * Math.sin(6 * phi)
  );

  const easting = FALSE_EASTING + k0 * N * (
    Acoef
    + (1 - T + C) * Acoef ** 3 / 6
    + (5 - 18 * T + T ** 2 + 72 * C - 58 * ePrimeSq) * Acoef ** 5 / 120
  );
  const northing = FALSE_NORTHING + k0 * (
    M + N * Math.tan(phi) * (
      Acoef ** 2 / 2
      + (5 - T + 9 * C + 4 * C ** 2) * Acoef ** 4 / 24
      + (61 - 58 * T + T ** 2 + 600 * C - 330 * ePrimeSq) * Acoef ** 6 / 720
    )
  );

  return { x: northing, y: easting };
}

/**
 * Convert VN-2000 (X = Northing, Y = Easting) → WGS-84 (lat, lon).
 * Inverse Transverse Mercator.
 */
export function vn2000ToWgs84(
  x: number,
  y: number,
  province: VN2000Province,
): { lat: number; lon: number } {
  const k0 = getK0(province.zoneWidth);
  const lambda0 = deg2rad(province.meridian);
  const eSq = E2;
  const ePrimeSq = eSq / (1 - eSq);
  const e1 = (1 - Math.sqrt(1 - eSq)) / (1 + Math.sqrt(1 - eSq));

  const M = (x - FALSE_NORTHING) / k0;
  const mu = M / (A * (1 - eSq / 4 - 3 * eSq ** 2 / 64 - 5 * eSq ** 3 / 256));

  const phi1 = mu
    + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * Math.sin(2 * mu)
    + (21 * e1 ** 2 / 16 - 55 * e1 ** 4 / 32) * Math.sin(4 * mu)
    + (151 * e1 ** 3 / 96) * Math.sin(6 * mu)
    + (1097 * e1 ** 4 / 512) * Math.sin(8 * mu);

  const N1 = A / Math.sqrt(1 - eSq * Math.sin(phi1) ** 2);
  const T1 = Math.tan(phi1) ** 2;
  const C1 = ePrimeSq * Math.cos(phi1) ** 2;
  const R1 = A * (1 - eSq) / (1 - eSq * Math.sin(phi1) ** 2) ** 1.5;
  const D = (y - FALSE_EASTING) / (N1 * k0);

  const phi = phi1 - (N1 * Math.tan(phi1) / R1) * (
    D ** 2 / 2
    - (5 + 3 * T1 + 10 * C1 - 4 * C1 ** 2 - 9 * ePrimeSq) * D ** 4 / 24
    + (61 + 90 * T1 + 298 * C1 + 45 * T1 ** 2 - 252 * ePrimeSq - 3 * C1 ** 2) * D ** 6 / 720
  );
  const lambda = lambda0 + (
    D
    - (1 + 2 * T1 + C1) * D ** 3 / 6
    + (5 - 2 * C1 + 28 * T1 - 3 * C1 ** 2 + 8 * ePrimeSq + 24 * T1 ** 2) * D ** 5 / 120
  ) / Math.cos(phi1);

  return { lat: rad2deg(phi), lon: rad2deg(lambda) };
}

export function formatVn2000(x: number, y: number): string {
  return `X=${x.toFixed(2)} Y=${y.toFixed(2)}`;
}
