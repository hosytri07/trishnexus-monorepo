/**
 * Database vật liệu xây dựng — Phase 19.20.
 * Reference theo TCVN + thông số phổ biến tại VN.
 */

export type MaterialCategory =
  | 'thep'        // Thép xây dựng
  | 'xi-mang'     // Xi măng
  | 'be-tong'     // Bê tông
  | 'gach'        // Gạch xây
  | 'da-cat'      // Đá / cát
  | 'vat-tu-khac';// Khác

export interface MaterialItem {
  id: string;
  category: MaterialCategory;
  name: string;
  spec: string;
  /** TCVN / quy chuẩn áp dụng */
  standard?: string;
  /** Thông số kỹ thuật chính */
  properties: { label: string; value: string }[];
  /** Hãng sản xuất phổ biến VN */
  brands?: string[];
  /** Giá tham khảo (chỉ định hướng) */
  priceRef?: string;
}

export const MATERIALS: MaterialItem[] = [
  // ===== Thép =====
  {
    id: 'thep-cb240',
    category: 'thep',
    name: 'Thép tròn trơn CB240-T',
    spec: 'D6 - D40, fy = 240 MPa',
    standard: 'TCVN 1651-1:2018',
    properties: [
      { label: 'Giới hạn chảy', value: '240 MPa' },
      { label: 'Cường độ kéo', value: '380 MPa' },
      { label: 'Độ giãn dài', value: '≥ 22%' },
      { label: 'Đường kính', value: 'D6 / D8 / D10 / D12 / D14 / D16' },
      { label: 'Sử dụng', value: 'Thép đai, thép chờ' },
    ],
    brands: ['Hòa Phát', 'Pomina', 'Việt Nhật', 'Tisco'],
    priceRef: '14,500 - 16,000 đ/kg',
  },
  {
    id: 'thep-cb300',
    category: 'thep',
    name: 'Thép vằn CB300-V',
    spec: 'D10 - D40, fy = 300 MPa',
    standard: 'TCVN 1651-2:2018',
    properties: [
      { label: 'Giới hạn chảy', value: '300 MPa' },
      { label: 'Cường độ kéo', value: '450 MPa' },
      { label: 'Độ giãn dài', value: '≥ 16%' },
      { label: 'Sử dụng', value: 'Thép cốt chính dầm, sàn, móng' },
    ],
    brands: ['Hòa Phát', 'Pomina', 'Việt Nhật', 'Tisco', 'Vinakyoei'],
    priceRef: '15,200 - 16,800 đ/kg',
  },
  {
    id: 'thep-cb400',
    category: 'thep',
    name: 'Thép vằn CB400-V',
    spec: 'D10 - D40, fy = 400 MPa',
    standard: 'TCVN 1651-2:2018',
    properties: [
      { label: 'Giới hạn chảy', value: '400 MPa' },
      { label: 'Cường độ kéo', value: '570 MPa' },
      { label: 'Độ giãn dài', value: '≥ 14%' },
      { label: 'Sử dụng', value: 'Cao tầng, kết cấu chịu lực lớn' },
    ],
    brands: ['Hòa Phát', 'Pomina', 'Vinakyoei', 'Posco SS-Vina'],
    priceRef: '15,800 - 17,500 đ/kg',
  },
  {
    id: 'thep-cb500',
    category: 'thep',
    name: 'Thép vằn CB500-V',
    spec: 'D10 - D40, fy = 500 MPa',
    standard: 'TCVN 1651-2:2018',
    properties: [
      { label: 'Giới hạn chảy', value: '500 MPa' },
      { label: 'Cường độ kéo', value: '650 MPa' },
      { label: 'Sử dụng', value: 'Công trình đặc biệt, cao tầng > 30 tầng' },
    ],
    brands: ['Hòa Phát', 'Vinakyoei', 'Tung Ho'],
    priceRef: '17,000 - 19,000 đ/kg',
  },
  {
    id: 'thep-hinh-h',
    category: 'thep',
    name: 'Thép hình H (H-beam)',
    spec: 'H100 - H600',
    standard: 'JIS G3192 / TCVN 7571',
    properties: [
      { label: 'Mặt cắt', value: 'H100x100, H150x150, H200x200, H300x300, H400x400, H600x300' },
      { label: 'Mác thép', value: 'SS400 / SS540' },
      { label: 'Sử dụng', value: 'Cột, dầm khung thép, nhà công nghiệp' },
    ],
    brands: ['Posco SS-Vina', 'Hòa Phát Dung Quất', 'Formosa'],
  },

  // ===== Xi măng =====
  {
    id: 'xi-mang-pcb30',
    category: 'xi-mang',
    name: 'Xi măng PCB30',
    spec: 'Cường độ ≥ 30 MPa sau 28 ngày',
    standard: 'TCVN 6260:2020',
    properties: [
      { label: 'Cường độ 28 ngày', value: '≥ 30 MPa' },
      { label: 'Khối lượng', value: '50 kg/bao' },
      { label: 'Sử dụng', value: 'Xây trát thông thường, công trình dân dụng' },
    ],
    brands: ['Vicem Hà Tiên', 'Vicem Hoàng Thạch', 'Insee', 'Holcim'],
    priceRef: '~80,000 đ/bao 50kg',
  },
  {
    id: 'xi-mang-pcb40',
    category: 'xi-mang',
    name: 'Xi măng PCB40',
    spec: 'Cường độ ≥ 40 MPa sau 28 ngày',
    standard: 'TCVN 6260:2020',
    properties: [
      { label: 'Cường độ 28 ngày', value: '≥ 40 MPa' },
      { label: 'Khối lượng', value: '50 kg/bao' },
      { label: 'Sử dụng', value: 'Bê tông kết cấu, cọc, dầm chính' },
    ],
    brands: ['Vicem Hà Tiên', 'Vicem Bút Sơn', 'Insee', 'Cẩm Phả'],
    priceRef: '~95,000 đ/bao 50kg',
  },
  {
    id: 'xi-mang-pcb50',
    category: 'xi-mang',
    name: 'Xi măng PCB50',
    spec: 'Cường độ ≥ 50 MPa sau 28 ngày',
    standard: 'TCVN 6260:2020',
    properties: [
      { label: 'Cường độ 28 ngày', value: '≥ 50 MPa' },
      { label: 'Sử dụng', value: 'Cao tầng, hầm, công trình ven biển' },
    ],
    brands: ['Vicem Hoàng Thạch', 'Insee Premium'],
  },
  {
    id: 'xi-mang-bn',
    category: 'xi-mang',
    name: 'Xi măng bền sulphate (CSF)',
    spec: 'Bền hóa chất môi trường biển',
    standard: 'TCVN 7711:2013',
    properties: [
      { label: 'C3A', value: '< 5% (loại MS)' },
      { label: 'Sử dụng', value: 'Cọc khoan nhồi vùng biển, cảng biển' },
    ],
    brands: ['Vicem Hà Tiên CSF', 'Insee Marine'],
  },

  // ===== Bê tông =====
  {
    id: 'bt-m200',
    category: 'be-tong',
    name: 'Bê tông M200 (B15)',
    spec: 'fc = 14.5 MPa (mẫu trụ)',
    standard: 'TCVN 5574:2018',
    properties: [
      { label: 'Cường độ chịu nén', value: '20 MPa (mẫu lập phương)' },
      { label: 'Tỷ lệ N/X', value: '0.55 - 0.60' },
      { label: 'Sử dụng', value: 'Bê tông lót, sàn nhà thấp tầng' },
    ],
    priceRef: 'Trộn tay ~1.5 triệu/m³',
  },
  {
    id: 'bt-m250',
    category: 'be-tong',
    name: 'Bê tông M250 (B20)',
    spec: 'fc = 18.0 MPa',
    standard: 'TCVN 5574:2018',
    properties: [
      { label: 'Cường độ chịu nén', value: '25 MPa (lập phương)' },
      { label: 'Sử dụng', value: 'Móng đơn, dầm, cột nhà 3-5 tầng' },
    ],
    priceRef: '~1.6 triệu/m³ (BT thương phẩm)',
  },
  {
    id: 'bt-m300',
    category: 'be-tong',
    name: 'Bê tông M300 (B22.5)',
    spec: 'fc = 21.5 MPa',
    standard: 'TCVN 5574:2018',
    properties: [
      { label: 'Cường độ chịu nén', value: '30 MPa (lập phương)' },
      { label: 'Sử dụng', value: 'Cọc, móng băng, sàn cao tầng' },
    ],
    priceRef: '~1.7 triệu/m³',
  },
  {
    id: 'bt-m400',
    category: 'be-tong',
    name: 'Bê tông M400 (B30)',
    spec: 'fc = 27.0 MPa',
    standard: 'TCVN 5574:2018',
    properties: [
      { label: 'Cường độ chịu nén', value: '40 MPa (lập phương)' },
      { label: 'Sử dụng', value: 'Cọc khoan nhồi, dầm cầu, công trình lớn' },
    ],
    priceRef: '~1.85 triệu/m³',
  },
  {
    id: 'bt-m500',
    category: 'be-tong',
    name: 'Bê tông M500 (B40)',
    spec: 'fc = 36.0 MPa',
    standard: 'TCVN 5574:2018',
    properties: [
      { label: 'Cường độ chịu nén', value: '50 MPa (lập phương)' },
      { label: 'Sử dụng', value: 'Cọc nhồi đường kính lớn, cầu lớn' },
    ],
    priceRef: '~2.0 - 2.2 triệu/m³',
  },

  // ===== Gạch =====
  {
    id: 'gach-tuynel',
    category: 'gach',
    name: 'Gạch tuynel 2 lỗ',
    spec: '80 × 80 × 180 mm',
    standard: 'TCVN 1450:2009',
    properties: [
      { label: 'Khối lượng', value: '~1.4 kg/viên' },
      { label: 'Cường độ chịu nén', value: 'M75 / M100' },
      { label: 'Số viên/m³', value: '~510 viên' },
      { label: 'Sử dụng', value: 'Tường ngăn, tường bao' },
    ],
    priceRef: '1,200 - 1,500 đ/viên',
  },
  {
    id: 'gach-dac',
    category: 'gach',
    name: 'Gạch đặc',
    spec: '100 × 60 × 220 mm',
    standard: 'TCVN 1450:2009',
    properties: [
      { label: 'Khối lượng', value: '~3.2 kg/viên' },
      { label: 'Cường độ', value: 'M75 / M100 / M150' },
      { label: 'Sử dụng', value: 'Tường chịu lực, móng' },
    ],
    priceRef: '1,800 - 2,300 đ/viên',
  },
  {
    id: 'gach-aac',
    category: 'gach',
    name: 'Gạch không nung AAC',
    spec: 'Bê tông khí chưng áp',
    standard: 'TCVN 7959:2017',
    properties: [
      { label: 'Khối lượng riêng', value: '500-700 kg/m³' },
      { label: 'Kích thước', value: '600×200×100/150/200 mm' },
      { label: 'Cách nhiệt', value: 'Tốt — λ ≈ 0.16 W/m.K' },
      { label: 'Sử dụng', value: 'Tường ngăn nhẹ cao tầng' },
    ],
    brands: ['Viglacera AAC', 'AAC Tân Kỷ Nguyên', 'Sông Đà 7'],
    priceRef: '950,000 - 1,200,000 đ/m³',
  },

  // ===== Đá / Cát =====
  {
    id: 'da-1x2',
    category: 'da-cat',
    name: 'Đá 1×2',
    spec: 'Cỡ hạt 10-20mm',
    standard: 'TCVN 7570:2006',
    properties: [
      { label: 'Khối lượng riêng', value: '~1,500 kg/m³ (xếp tự nhiên)' },
      { label: 'Sử dụng', value: 'Bê tông M200-M400' },
    ],
    priceRef: '350,000 - 450,000 đ/m³',
  },
  {
    id: 'da-4x6',
    category: 'da-cat',
    name: 'Đá 4×6',
    spec: 'Cỡ hạt 40-60mm',
    standard: 'TCVN 7570:2006',
    properties: [
      { label: 'Sử dụng', value: 'Bê tông móng, lớp lót, BT khối lớn' },
    ],
    priceRef: '300,000 - 380,000 đ/m³',
  },
  {
    id: 'cat-vang',
    category: 'da-cat',
    name: 'Cát vàng (cát bê tông)',
    spec: 'Module độ lớn 2.0 - 3.3',
    standard: 'TCVN 7570:2006',
    properties: [
      { label: 'Module độ lớn', value: '2.0 - 3.3' },
      { label: 'Hàm lượng bùn sét', value: '< 1%' },
      { label: 'Sử dụng', value: 'Bê tông kết cấu' },
    ],
    priceRef: '350,000 - 500,000 đ/m³',
  },
  {
    id: 'cat-den',
    category: 'da-cat',
    name: 'Cát đen (cát xây tô)',
    spec: 'Module độ lớn 1.5 - 2.0',
    standard: 'TCVN 7570:2006',
    properties: [
      { label: 'Sử dụng', value: 'Vữa xây trát, đắp nền' },
    ],
    priceRef: '180,000 - 280,000 đ/m³',
  },

  // ===== Khác =====
  {
    id: 'thep-buoc',
    category: 'vat-tu-khac',
    name: 'Thép buộc',
    spec: 'Dây thép 1.0 - 1.2mm',
    properties: [
      { label: 'Sử dụng', value: 'Buộc cốt thép trước khi đổ BT' },
    ],
    priceRef: '20,000 - 25,000 đ/kg',
  },
  {
    id: 'phu-gia',
    category: 'vat-tu-khac',
    name: 'Phụ gia siêu dẻo',
    spec: 'Polycarboxylate, 1-1.5% xi măng',
    standard: 'TCVN 8826:2011',
    properties: [
      { label: 'Tăng độ sụt', value: 'Có' },
      { label: 'Giảm nước', value: '20-35%' },
      { label: 'Sử dụng', value: 'Bê tông tự lèn, cọc nhồi' },
    ],
    brands: ['Sika ViscoCrete', 'BASF MasterGlenium', 'Mapei Dynamon'],
  },
  {
    id: 'gioang-cao-su',
    category: 'vat-tu-khac',
    name: 'Băng cản nước (waterstop)',
    spec: 'Cao su / PVC 200-300mm',
    properties: [
      { label: 'Sử dụng', value: 'Mạch ngừng bê tông tầng hầm, bể nước' },
    ],
    brands: ['Sika', 'Fosroc', 'BASF'],
  },
];

export interface CategoryConfig {
  id: MaterialCategory;
  name: string;
  shortName: string;
  color: string;
  icon: string;
}

export const CATEGORY_CONFIGS: Record<MaterialCategory, CategoryConfig> = {
  thep: { id: 'thep', name: 'Thép xây dựng', shortName: 'Thép', color: '#3B82F6', icon: '🏗' },
  'xi-mang': { id: 'xi-mang', name: 'Xi măng', shortName: 'Xi măng', color: '#6B7280', icon: '🧱' },
  'be-tong': { id: 'be-tong', name: 'Bê tông', shortName: 'Bê tông', color: '#10B981', icon: '🏢' },
  gach: { id: 'gach', name: 'Gạch xây', shortName: 'Gạch', color: '#EF4444', icon: '🧱' },
  'da-cat': { id: 'da-cat', name: 'Đá / Cát', shortName: 'Đá/Cát', color: '#F59E0B', icon: '⛰' },
  'vat-tu-khac': { id: 'vat-tu-khac', name: 'Khác', shortName: 'Khác', color: '#A855F7', icon: '🛠' },
};
