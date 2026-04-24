/**
 * vn-calendar.ts — Lịch âm VN + ngày lễ.
 *
 * Thuật toán Hồ Ngọc Đức (giấy phép: Creative Commons Attribution 3.0, dùng rộng rãi).
 * Nguồn tham khảo: https://www.informatik.uni-leipzig.de/~duc/amlich/
 *
 * API:
 *   convertSolar2Lunar(dd, mm, yy, tz=7) → { day, month, year, leap }
 *   getCanChiOfYear(yy)                  → "Giáp Tý", "Ất Sửu"...
 *   getCanChiOfMonth(month, yy)          → "Giáp Tý"...
 *   getNextHoliday(now)                  → { name, date, daysLeft, isToday, isLunar }
 *   listHolidaysForYear(yy)              → Holiday[] (cả solar lẫn lunar)
 *
 * Timezone: Việt Nam = UTC+7 (không DST).
 */

const TZ = 7;

/* ─────────────────  Core Hồ Ngọc Đức  ───────────────── */

function INT(d: number): number {
  return Math.floor(d);
}

/** Solar date → Julian day number (at noon UTC). */
function jdFromDate(dd: number, mm: number, yy: number): number {
  const a = INT((14 - mm) / 12);
  const y = yy + 4800 - a;
  const m = mm + 12 * a - 3;
  let jd =
    dd +
    INT((153 * m + 2) / 5) +
    365 * y +
    INT(y / 4) -
    INT(y / 100) +
    INT(y / 400) -
    32045;
  if (jd < 2299161) {
    // Julian calendar for dates before 1582-10-15
    jd = dd + INT((153 * m + 2) / 5) + 365 * y + INT(y / 4) - 32083;
  }
  return jd;
}

/** Julian day → solar date [dd, mm, yy]. */
function jdToDate(jd: number): [number, number, number] {
  let a: number;
  let b: number;
  let c: number;
  if (jd > 2299160) {
    a = jd + 32044;
    b = INT((4 * a + 3) / 146097);
    c = a - INT((146097 * b) / 4);
  } else {
    b = 0;
    c = jd + 32082;
  }
  const d = INT((4 * c + 3) / 1461);
  const e = c - INT((1461 * d) / 4);
  const m = INT((5 * e + 2) / 153);
  const dd = e - INT((153 * m + 2) / 5) + 1;
  const mm = m + 3 - 12 * INT(m / 10);
  const yy = b * 100 + d - 4800 + INT(m / 10);
  return [dd, mm, yy];
}

/** Julian day of k-th new moon (k=0 at ~1900-01-01). */
function getNewMoonDay(k: number, timeZone: number): number {
  const T = k / 1236.85;
  const T2 = T * T;
  const T3 = T2 * T;
  const dr = Math.PI / 180;
  let Jd1 =
    2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3;
  Jd1 =
    Jd1 +
    0.00033 *
      Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr);
  const M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3;
  const Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3;
  const F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3;
  let C1 =
    (0.1734 - 0.000393 * T) * Math.sin(M * dr) +
    0.0021 * Math.sin(2 * dr * M);
  C1 = C1 - 0.4068 * Math.sin(Mpr * dr) + 0.0161 * Math.sin(dr * 2 * Mpr);
  C1 = C1 - 0.0004 * Math.sin(dr * 3 * Mpr);
  C1 =
    C1 +
    0.0104 * Math.sin(dr * 2 * F) -
    0.0051 * Math.sin(dr * (M + Mpr));
  C1 =
    C1 -
    0.0074 * Math.sin(dr * (M - Mpr)) +
    0.0004 * Math.sin(dr * (2 * F + M));
  C1 =
    C1 -
    0.0004 * Math.sin(dr * (2 * F - M)) -
    0.0006 * Math.sin(dr * (2 * F + Mpr));
  C1 =
    C1 +
    0.0010 * Math.sin(dr * (2 * F - Mpr)) +
    0.0005 * Math.sin(dr * (2 * Mpr + M));
  let deltat: number;
  if (T < -11) {
    deltat =
      0.001 +
      0.000839 * T +
      0.0002261 * T2 -
      0.00000845 * T3 -
      0.000000081 * T * T3;
  } else {
    deltat = -0.000278 + 0.000265 * T + 0.000262 * T2;
  }
  const JdNew = Jd1 + C1 - deltat;
  return INT(JdNew + 0.5 + timeZone / 24);
}

function getSunLongitude(jdn: number, timeZone: number): number {
  const T = (jdn - 2451545.5 - timeZone / 24) / 36525;
  const T2 = T * T;
  const dr = Math.PI / 180;
  const M =
    357.5291 + 35999.0503 * T - 0.0001559 * T2 - 0.00000048 * T * T2;
  const L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2;
  let DL =
    (1.9146 - 0.004817 * T - 0.000014 * T2) * Math.sin(dr * M);
  DL =
    DL +
    (0.019993 - 0.000101 * T) * Math.sin(dr * 2 * M) +
    0.00029 * Math.sin(dr * 3 * M);
  let L = L0 + DL;
  L = L * dr;
  L = L - Math.PI * 2 * INT(L / (Math.PI * 2));
  return INT((L / Math.PI) * 6);
}

function getLunarMonth11(yy: number, timeZone: number): number {
  const off = jdFromDate(31, 12, yy) - 2415021;
  const k = INT(off / 29.530588853);
  let nm = getNewMoonDay(k, timeZone);
  const sunLong = getSunLongitude(nm, timeZone);
  if (sunLong >= 9) {
    nm = getNewMoonDay(k - 1, timeZone);
  }
  return nm;
}

function getLeapMonthOffset(a11: number, timeZone: number): number {
  const k = INT((a11 - 2415021.076998695) / 29.530588853 + 0.5);
  let last = 0;
  let i = 1;
  let arc = getSunLongitude(getNewMoonDay(k + i, timeZone), timeZone);
  do {
    last = arc;
    i++;
    arc = getSunLongitude(getNewMoonDay(k + i, timeZone), timeZone);
  } while (arc !== last && i < 14);
  return i - 1;
}

export type LunarDate = {
  day: number;
  month: number;
  year: number;
  leap: boolean;
};

/** Chuyển dương lịch → âm lịch (timezone VN = +7). */
export function convertSolar2Lunar(
  dd: number,
  mm: number,
  yy: number,
  timeZone: number = TZ
): LunarDate {
  const dayNumber = jdFromDate(dd, mm, yy);
  const k = INT((dayNumber - 2415021.076998695) / 29.530588853);
  let monthStart = getNewMoonDay(k + 1, timeZone);
  if (monthStart > dayNumber) {
    monthStart = getNewMoonDay(k, timeZone);
  }
  let a11 = getLunarMonth11(yy, timeZone);
  let b11 = a11;
  let lunarYear: number;
  if (a11 >= monthStart) {
    lunarYear = yy;
    a11 = getLunarMonth11(yy - 1, timeZone);
  } else {
    lunarYear = yy + 1;
    b11 = getLunarMonth11(yy + 1, timeZone);
  }
  const lunarDay = dayNumber - monthStart + 1;
  const diff = INT((monthStart - a11) / 29);
  let leap = false;
  let lunarMonth = diff + 11;
  if (b11 - a11 > 365) {
    const leapMonthDiff = getLeapMonthOffset(a11, timeZone);
    if (diff >= leapMonthDiff) {
      lunarMonth = diff + 10;
      if (diff === leapMonthDiff) leap = true;
    }
  }
  if (lunarMonth > 12) lunarMonth = lunarMonth - 12;
  if (lunarMonth >= 11 && diff < 4) lunarYear -= 1;
  return { day: lunarDay, month: lunarMonth, year: lunarYear, leap };
}

/* ─────────────────  Can-Chi  ───────────────── */

const CAN = ['Giáp', 'Ất', 'Bính', 'Đinh', 'Mậu', 'Kỷ', 'Canh', 'Tân', 'Nhâm', 'Quý'] as const;
const CHI = [
  'Tý', 'Sửu', 'Dần', 'Mão', 'Thìn', 'Tỵ',
  'Ngọ', 'Mùi', 'Thân', 'Dậu', 'Tuất', 'Hợi',
] as const;

export function getCanChiOfYear(yy: number): string {
  const can = CAN[(yy + 6) % 10];
  const chi = CHI[(yy + 8) % 12];
  return `${can} ${chi}`;
}

/** Can chi của tháng âm — tháng 11 = Tý, tháng 12 = Sửu, ... */
export function getCanChiOfMonth(lunarMonth: number, lunarYear: number): string {
  const canOfYear = (lunarYear + 6) % 10;
  const canIdx = (canOfYear * 2 + lunarMonth + 3) % 10;
  const chiIdx = (lunarMonth + 1) % 12;
  return `${CAN[canIdx]} ${CHI[chiIdx]}`;
}

/* ─────────────────  Holidays  ───────────────── */

export type HolidaySource = 'solar' | 'lunar';

export type Holiday = {
  name: string;
  source: HolidaySource;
  /** 1-based month, day */
  month: number;
  day: number;
  /** Số ngày liên tiếp (default 1). */
  spread?: number;
};

/** Template holidays (áp dụng mọi năm). */
export const HOLIDAY_TEMPLATES: Holiday[] = [
  { name: 'Tết Dương lịch', source: 'solar', month: 1, day: 1 },
  { name: 'Tết Nguyên Đán', source: 'lunar', month: 1, day: 1, spread: 5 },
  { name: 'Rằm tháng Giêng', source: 'lunar', month: 1, day: 15 },
  { name: 'Giỗ Tổ Hùng Vương', source: 'lunar', month: 3, day: 10 },
  { name: 'Giải phóng miền Nam', source: 'solar', month: 4, day: 30 },
  { name: 'Quốc tế Lao động', source: 'solar', month: 5, day: 1 },
  { name: 'Phật Đản', source: 'lunar', month: 4, day: 15 },
  { name: 'Tết Đoan Ngọ', source: 'lunar', month: 5, day: 5 },
  { name: 'Lễ Vu Lan', source: 'lunar', month: 7, day: 15 },
  { name: 'Quốc khánh', source: 'solar', month: 9, day: 2, spread: 2 },
  { name: 'Tết Trung thu', source: 'lunar', month: 8, day: 15 },
  { name: 'Ngày Nhà giáo VN', source: 'solar', month: 11, day: 20 },
  { name: 'Giáng sinh', source: 'solar', month: 12, day: 25 },
];

export type ResolvedHoliday = {
  name: string;
  source: HolidaySource;
  /** Ngày dương lịch (Date ở 00:00 local) — ngày BẮT ĐẦU nếu spread > 1. */
  date: Date;
  /** Độ lệch tuyệt đối ngày từ `now`. Âm = đã qua, 0 = hôm nay, dương = tương lai. */
  daysLeft: number;
  isToday: boolean;
};

/** Tạo Date 00:00 local time. */
function makeLocalDate(yy: number, mm: number, dd: number): Date {
  return new Date(yy, mm - 1, dd);
}

/**
 * Tìm ngày dương lịch ứng với holiday âm lịch cho một năm dương cụ thể.
 * Duyệt 400 ngày từ 1/1/yy solar; đủ bao trùm Tết Dương + Tết Âm năm sau nếu cần.
 */
function findLunarDateInSolarYear(
  targetLunarMonth: number,
  targetLunarDay: number,
  solarYear: number
): Date | null {
  for (let m = 1; m <= 12; m++) {
    for (let d = 1; d <= 31; d++) {
      const probe = makeLocalDate(solarYear, m, d);
      // Skip invalid dates (e.g. Feb 30)
      if (probe.getMonth() + 1 !== m) continue;
      const lunar = convertSolar2Lunar(d, m, solarYear);
      if (
        !lunar.leap &&
        lunar.month === targetLunarMonth &&
        lunar.day === targetLunarDay
      ) {
        return probe;
      }
    }
  }
  return null;
}

/** Trả về các instance holiday đã resolved cho một năm dương cụ thể. */
export function listHolidaysForYear(solarYear: number): ResolvedHoliday[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const out: ResolvedHoliday[] = [];
  for (const h of HOLIDAY_TEMPLATES) {
    let date: Date | null = null;
    if (h.source === 'solar') {
      date = makeLocalDate(solarYear, h.month, h.day);
    } else {
      date = findLunarDateInSolarYear(h.month, h.day, solarYear);
    }
    if (!date) continue;
    const diffMs = date.getTime() - today.getTime();
    const daysLeft = Math.round(diffMs / (1000 * 60 * 60 * 24));
    out.push({
      name: h.name,
      source: h.source,
      date,
      daysLeft,
      isToday: daysLeft === 0,
    });
  }
  return out;
}

/**
 * Holiday kế tiếp (hoặc hôm nay) — duyệt cả năm hiện tại và năm sau.
 */
export function getNextHoliday(now: Date = new Date()): ResolvedHoliday | null {
  const yy = now.getFullYear();
  const pool = [...listHolidaysForYear(yy), ...listHolidaysForYear(yy + 1)];
  const future = pool
    .filter((h) => h.daysLeft >= 0)
    .sort((a, b) => a.daysLeft - b.daysLeft);
  return future[0] ?? null;
}

/** Danh sách holiday sắp tới (daysLeft>=0), sắp xếp gần → xa, tối đa N. */
export function getUpcomingHolidays(
  limit: number = 5,
  now: Date = new Date()
): ResolvedHoliday[] {
  const yy = now.getFullYear();
  const pool = [...listHolidaysForYear(yy), ...listHolidaysForYear(yy + 1)];
  return pool
    .filter((h) => h.daysLeft >= 0)
    .sort((a, b) => a.daysLeft - b.daysLeft)
    .slice(0, limit);
}

/** Format ngày dương: "dd/mm". */
export function formatShortDate(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}
