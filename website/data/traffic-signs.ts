/**
 * Database biển báo QCVN 41:2024/BGTVT — Phase 19.18.3 — full 451 biển/vạch.
 *
 * Source: Thông tư 51/2024/TT-BGTVT (15/11/2024) — file PDF công khai.
 * File data: /public/qc41-signs.json (~34 KB, fetch lazy).
 *
 * 7 nhóm:
 *   bao-cam (P)              — 68
 *   bao-nguy-hiem (W)        — 99
 *   bao-hieu-lenh (R)        — 74
 *   bao-chi-dan (I)          — 106
 *   bao-chi-dan-cao-toc (IE) — 65
 *   bao-phu (S)              — 25
 *   vach-ke (V)              — 14
 */

export type SignGroup =
  | 'bao-cam'
  | 'bao-nguy-hiem'
  | 'bao-hieu-lenh'
  | 'bao-chi-dan'
  | 'bao-chi-dan-cao-toc'
  | 'bao-phu'
  | 'vach-ke'
  | 'den-tin-hieu';

export interface TrafficSign {
  code: string;
  group: SignGroup;
  name: string;
  meaning?: string;
  scope?: string;
  penalty?: string;
  image_url?: string;
}

export interface SignGroupConfig {
  group: SignGroup;
  name: string;
  shortName: string;
  color: string;
  shape: string;
  description: string;
}

export const SIGN_GROUP_CONFIGS: Record<SignGroup, SignGroupConfig> = {
  'bao-cam': {
    group: 'bao-cam',
    name: 'Biển báo cấm',
    shortName: 'Cấm',
    color: '#EF4444',
    shape: 'Tròn nền trắng viền đỏ',
    description: 'Báo điều cấm — vi phạm bị xử phạt theo Nghị định 100/2019.',
  },
  'bao-nguy-hiem': {
    group: 'bao-nguy-hiem',
    name: 'Biển báo nguy hiểm và cảnh báo',
    shortName: 'Nguy hiểm',
    color: '#F59E0B',
    shape: 'Tam giác nền vàng viền đen',
    description: 'Cảnh báo nguy hiểm phía trước — phải chú ý.',
  },
  'bao-hieu-lenh': {
    group: 'bao-hieu-lenh',
    name: 'Biển hiệu lệnh',
    shortName: 'Hiệu lệnh',
    color: '#3B82F6',
    shape: 'Tròn nền xanh viền trắng',
    description: 'Báo hiệu lệnh phải tuân theo — bắt buộc.',
  },
  'bao-chi-dan': {
    group: 'bao-chi-dan',
    name: 'Biển chỉ dẫn (đường thường)',
    shortName: 'Chỉ dẫn',
    color: '#10B981',
    shape: 'Chữ nhật nền xanh',
    description: 'Chỉ dẫn thông tin có ích cho người tham gia giao thông.',
  },
  'bao-chi-dan-cao-toc': {
    group: 'bao-chi-dan-cao-toc',
    name: 'Biển chỉ dẫn (đường cao tốc)',
    shortName: 'Chỉ dẫn CT',
    color: '#0EA5E9',
    shape: 'Chữ nhật nền xanh dương',
    description: 'Chỉ dẫn riêng cho đường cao tốc.',
  },
  'bao-phu': {
    group: 'bao-phu',
    name: 'Biển phụ',
    shortName: 'Phụ',
    color: '#6B7280',
    shape: 'Chữ nhật nền trắng viền đen',
    description: 'Bổ sung ý nghĩa cho biển chính.',
  },
  'vach-ke': {
    group: 'vach-ke',
    name: 'Vạch kẻ đường',
    shortName: 'Vạch',
    color: '#A855F7',
    shape: 'Vạch sơn trên mặt đường',
    description: 'Phân chia làn, hướng — quan trọng như biển báo.',
  },
  'den-tin-hieu': {
    group: 'den-tin-hieu',
    name: 'Đèn tín hiệu',
    shortName: 'Đèn',
    color: '#EC4899',
    shape: 'Đèn 3 màu',
    description: 'Điều khiển giao thông tại nút giao theo chu kỳ.',
  },
};

/** Fetch toàn bộ database từ /public/qc41-signs.json */
export async function fetchAllSigns(): Promise<TrafficSign[]> {
  const res = await fetch('/qc41-signs.json');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}
