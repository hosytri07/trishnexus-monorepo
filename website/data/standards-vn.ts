/**
 * Database Quy chuẩn / Tiêu chuẩn ngành XD-GT — Phase 19.20.
 */

export type StandardType = 'qcvn' | 'tcvn' | 'thong-tu' | 'nghi-dinh' | 'quyet-dinh';

export interface Standard {
  id: string;
  code: string;
  type: StandardType;
  name: string;
  year: number;
  issuer: string;
  /** Tóm tắt phạm vi áp dụng */
  scope: string;
  category: 'duong-bo' | 'cau' | 'ham' | 'xay-dung' | 'an-toan' | 'khao-sat' | 'thiet-ke' | 'khac';
  /** Tags để tìm */
  tags: string[];
  url?: string;
  /** Replace Standard cũ */
  replaces?: string;
}

export const STANDARDS: Standard[] = [
  // ===== QCVN giao thông =====
  {
    id: 'qcvn-41-2024',
    code: 'QCVN 41:2024/BGTVT',
    type: 'qcvn',
    name: 'Quy chuẩn kỹ thuật quốc gia về báo hiệu đường bộ',
    year: 2024,
    issuer: 'Bộ Giao thông Vận tải',
    scope: 'Quy định về đèn tín hiệu giao thông; biển báo hiệu đường bộ; vạch kẻ đường; cọc tiêu, tường bảo vệ, rào chắn; cọc Km; thiết bị âm thanh báo hiệu.',
    category: 'duong-bo',
    tags: ['biển báo', 'vạch kẻ', 'đèn tín hiệu', 'cọc tiêu', 'báo hiệu'],
    replaces: 'QCVN 41:2019/BGTVT',
  },
  {
    id: 'qcvn-07-2016',
    code: 'QCVN 07:2016/BXD',
    type: 'qcvn',
    name: 'Quy chuẩn kỹ thuật quốc gia về công trình hạ tầng kỹ thuật',
    year: 2016,
    issuer: 'Bộ Xây dựng',
    scope: 'Hệ thống công trình hạ tầng kỹ thuật đô thị: đường, thoát nước, cấp nước, chiếu sáng.',
    category: 'xay-dung',
    tags: ['hạ tầng', 'đô thị', 'cống thoát nước'],
  },

  // ===== TCVN đường + cầu =====
  {
    id: 'tcvn-4054-2005',
    code: 'TCVN 4054:2005',
    type: 'tcvn',
    name: 'Đường ô tô — Yêu cầu thiết kế',
    year: 2005,
    issuer: 'Bộ Khoa học và Công nghệ',
    scope: 'Tiêu chuẩn thiết kế cho đường ô tô cấp III, IV, V và đường địa phương. Tốc độ thiết kế 20-100 km/h.',
    category: 'thiet-ke',
    tags: ['đường ô tô', 'thiết kế đường', 'mặt cắt'],
  },
  {
    id: 'tcvn-5729-2012',
    code: 'TCVN 5729:2012',
    type: 'tcvn',
    name: 'Đường ô tô cao tốc — Yêu cầu thiết kế',
    year: 2012,
    issuer: 'Bộ KH&CN',
    scope: 'Tiêu chuẩn thiết kế đường cao tốc tại VN — cấp 60, 80, 100, 120 km/h.',
    category: 'thiet-ke',
    tags: ['cao tốc', 'thiết kế', 'tốc độ cao'],
  },
  {
    id: 'tcvn-11823-2017',
    code: 'TCVN 11823:2017',
    type: 'tcvn',
    name: 'Thiết kế cầu đường bộ — Phần 3: Tải trọng và hệ số tải trọng',
    year: 2017,
    issuer: 'Bộ KH&CN',
    scope: 'Tiêu chuẩn HL93 — tải trọng cầu đường bộ. Áp dụng cho cầu mới + đánh giá cầu hiện hữu.',
    category: 'cau',
    tags: ['HL93', 'tải trọng', 'cầu', 'AASHTO'],
  },
  {
    id: 'tcvn-11823-1-2017',
    code: 'TCVN 11823-1:2017',
    type: 'tcvn',
    name: 'Thiết kế cầu đường bộ — Phần 1: Yêu cầu chung',
    year: 2017,
    issuer: 'Bộ KH&CN',
    scope: 'Yêu cầu chung trong thiết kế cầu — chuyển dịch từ AASHTO LRFD.',
    category: 'cau',
    tags: ['cầu', 'LRFD', 'thiết kế cầu'],
  },

  // ===== TCVN xây dựng =====
  {
    id: 'tcvn-5574-2018',
    code: 'TCVN 5574:2018',
    type: 'tcvn',
    name: 'Thiết kế kết cấu bê tông và bê tông cốt thép',
    year: 2018,
    issuer: 'Bộ KH&CN',
    scope: 'Tiêu chuẩn thiết kế kết cấu BTCT cho công trình dân dụng, công nghiệp, hạ tầng. Mác bê tông B7.5 - B100.',
    category: 'thiet-ke',
    tags: ['BTCT', 'bê tông', 'thiết kế kết cấu'],
  },
  {
    id: 'tcvn-9395-2012',
    code: 'TCVN 9395:2012',
    type: 'tcvn',
    name: 'Cọc khoan nhồi — Thi công và nghiệm thu',
    year: 2012,
    issuer: 'Bộ KH&CN',
    scope: 'Yêu cầu thi công + nghiệm thu cọc khoan nhồi đường kính 600-2500mm.',
    category: 'xay-dung',
    tags: ['cọc khoan nhồi', 'thi công', 'nghiệm thu', 'móng'],
  },
  {
    id: 'tcvn-7570-2006',
    code: 'TCVN 7570:2006',
    type: 'tcvn',
    name: 'Cốt liệu cho bê tông và vữa — Yêu cầu kỹ thuật',
    year: 2006,
    issuer: 'Bộ KH&CN',
    scope: 'Yêu cầu kỹ thuật cho cát, đá dùng trong sản xuất bê tông + vữa.',
    category: 'xay-dung',
    tags: ['cốt liệu', 'cát', 'đá', 'bê tông'],
  },
  {
    id: 'tcvn-1651-2018',
    code: 'TCVN 1651:2018',
    type: 'tcvn',
    name: 'Thép cốt bê tông — Phần 1: Thanh tròn trơn (Phần 2: Vằn)',
    year: 2018,
    issuer: 'Bộ KH&CN',
    scope: 'Yêu cầu kỹ thuật cho thép tròn trơn (CB240-T) và thép vằn (CB300-V → CB500-V).',
    category: 'xay-dung',
    tags: ['thép', 'cốt thép', 'CB300', 'CB500'],
  },
  {
    id: 'tcvn-6260-2020',
    code: 'TCVN 6260:2020',
    type: 'tcvn',
    name: 'Xi măng poóc lăng hỗn hợp — Yêu cầu kỹ thuật',
    year: 2020,
    issuer: 'Bộ KH&CN',
    scope: 'Yêu cầu cho xi măng PCB30 / PCB40 / PCB50.',
    category: 'xay-dung',
    tags: ['xi măng', 'PCB30', 'PCB40'],
  },

  // ===== An toàn lao động =====
  {
    id: 'tcvn-5308-2008',
    code: 'TCVN 5308:2008',
    type: 'tcvn',
    name: 'Quy phạm kỹ thuật an toàn trong xây dựng',
    year: 2008,
    issuer: 'Bộ KH&CN',
    scope: 'An toàn thi công xây dựng: làm việc trên cao, đào hố, giàn giáo, vận chuyển.',
    category: 'an-toan',
    tags: ['an toàn lao động', 'PPE', 'làm việc trên cao'],
  },
  {
    id: 'qcvn-18-2021',
    code: 'QCVN 18:2021/BXD',
    type: 'qcvn',
    name: 'Quy chuẩn kỹ thuật quốc gia về an toàn trong thi công xây dựng',
    year: 2021,
    issuer: 'Bộ Xây dựng',
    scope: 'Bắt buộc tuân thủ — thay TCVN 5308 cho công trình mới.',
    category: 'an-toan',
    tags: ['an toàn', 'thi công', 'bắt buộc'],
    replaces: 'TCVN 5308:2008 (cho phần thi công)',
  },

  // ===== Thông tư, NĐ =====
  {
    id: 'tt-51-2024-bgtvt',
    code: 'Thông tư 51/2024/TT-BGTVT',
    type: 'thong-tu',
    name: 'Ban hành QCVN 41:2024/BGTVT về báo hiệu đường bộ',
    year: 2024,
    issuer: 'Bộ GTVT',
    scope: 'Văn bản kèm QCVN 41:2024 — có hiệu lực 15/11/2024.',
    category: 'duong-bo',
    tags: ['QC41', 'biển báo'],
  },
  {
    id: 'nd-100-2019',
    code: 'NĐ 100/2019/NĐ-CP',
    type: 'nghi-dinh',
    name: 'Quy định xử phạt vi phạm hành chính lĩnh vực giao thông đường bộ',
    year: 2019,
    issuer: 'Chính phủ',
    scope: 'Mức phạt cụ thể cho từng vi phạm — biển báo, tốc độ, cồn, chứng chỉ.',
    category: 'duong-bo',
    tags: ['xử phạt', 'vi phạm', 'mức phạt'],
  },
  {
    id: 'nd-06-2021',
    code: 'NĐ 06/2021/NĐ-CP',
    type: 'nghi-dinh',
    name: 'Quản lý chất lượng, thi công và bảo trì công trình xây dựng',
    year: 2021,
    issuer: 'Chính phủ',
    scope: 'Phân cấp công trình, kiểm tra chất lượng, nghiệm thu.',
    category: 'xay-dung',
    tags: ['chất lượng', 'nghiệm thu', 'cấp công trình'],
  },
  {
    id: 'nd-10-2021',
    code: 'NĐ 10/2021/NĐ-CP',
    type: 'nghi-dinh',
    name: 'Quản lý chi phí đầu tư xây dựng',
    year: 2021,
    issuer: 'Chính phủ',
    scope: 'Tổng mức đầu tư, dự toán, chi phí tư vấn — căn cứ lập dự toán.',
    category: 'xay-dung',
    tags: ['chi phí', 'dự toán', 'TMĐT'],
  },
  {
    id: 'qd-1776-2007',
    code: 'QĐ 1776/2007/QĐ-BXD',
    type: 'quyet-dinh',
    name: 'Định mức dự toán xây dựng công trình',
    year: 2007,
    issuer: 'Bộ Xây dựng',
    scope: 'Định mức hao phí vật liệu / nhân công / máy thi công cho từng công tác.',
    category: 'xay-dung',
    tags: ['định mức', 'hao phí', 'dự toán'],
  },
  {
    id: 'qd-05-2007-btnmt',
    code: 'QĐ 05/2007/QĐ-BTNMT',
    type: 'quyet-dinh',
    name: 'Tham số chuyển đổi giữa hệ tọa độ VN2000 và WGS84',
    year: 2007,
    issuer: 'Bộ TN&MT',
    scope: 'Tham số Helmert 7-param trung bình quốc gia + tham số riêng từng tỉnh.',
    category: 'khao-sat',
    tags: ['VN2000', 'WGS84', 'tọa độ', 'Helmert'],
  },
];

export interface StandardTypeConfig {
  type: StandardType;
  name: string;
  shortName: string;
  color: string;
}

export const STANDARD_TYPE_CONFIGS: Record<StandardType, StandardTypeConfig> = {
  qcvn: { type: 'qcvn', name: 'Quy chuẩn kỹ thuật QG', shortName: 'QCVN', color: '#EF4444' },
  tcvn: { type: 'tcvn', name: 'Tiêu chuẩn quốc gia', shortName: 'TCVN', color: '#3B82F6' },
  'thong-tu': { type: 'thong-tu', name: 'Thông tư', shortName: 'TT', color: '#10B981' },
  'nghi-dinh': { type: 'nghi-dinh', name: 'Nghị định', shortName: 'NĐ', color: '#F59E0B' },
  'quyet-dinh': { type: 'quyet-dinh', name: 'Quyết định', shortName: 'QĐ', color: '#A855F7' },
};

export const CATEGORY_LABELS: Record<Standard['category'], string> = {
  'duong-bo': 'Đường bộ',
  cau: 'Cầu',
  ham: 'Hầm',
  'xay-dung': 'Xây dựng',
  'an-toan': 'An toàn lao động',
  'khao-sat': 'Khảo sát',
  'thiet-ke': 'Thiết kế',
  khac: 'Khác',
};
