/**
 * TrishFinance — Phase 23.1.B types.
 *
 * Cấu trúc database tổng (lưu localStorage + sync Firestore):
 *   FinanceDb {
 *     accounts:   Account[]                  // ngân hàng/ví/tiền mặt — SHARED
 *     property:   NhaTroProperty | null      // thông tin nhà trọ
 *     phongs:     Phong[]
 *     khachs:     KhachThue[]
 *     hopDongs:   HopDong[]
 *     dienNuoc:   DienNuocReading[]
 *     hoaDons:    HoaDonNhaTro[]
 *     thanhToans: ThanhToan[]
 *     suCos:      SuCo[]
 *     chiPhis:    ChiPhi[]                   // chi phí nhà trọ
 *     // Tài chính cá nhân
 *     ledger:     LedgerEntry[]              // sổ thu chi cá nhân
 *     budgets:    Budget[]
 *     recurrings: RecurringTxn[]
 *     // Bán hàng
 *     shop:       ShopProfile | null         // template + thông tin shop
 *     products:   Product[]
 *     orders:     Order[]
 *     customers:  Customer[]
 *     // System
 *     contractTemplate: string                // mẫu hợp đồng
 *     invoiceConfig:    InvoiceConfig
 *     logs:       AuditLog[]
 *   }
 */

// ==========================================================
// SHARED — Tài khoản nhận/chi tiền (dùng chung 3 module)
// ==========================================================
export type AccountKind = 'cash' | 'bank' | 'wallet';

export interface Account {
  id: string;
  kind: AccountKind;
  name: string;            // VD "VietinBank", "ZaloPay", "Tiền mặt két"
  bankCode?: string;       // VD "ICB" cho VietinBank — dùng VietQR
  accountNumber?: string;  // STK
  accountName?: string;    // Chủ TK
  note?: string;
  isDefault?: boolean;     // Tài khoản mặc định nhận tiền
  active: boolean;
  createdAt: string;
}

// ==========================================================
// MODULE NHÀ TRỌ
// ==========================================================
export interface NhaTroProperty {
  id: string;             // Phase 23.8.C — multi-property
  name: string;
  address: string;
  // Đại diện pháp luật (chủ nhà)
  repName: string;
  repAddress: string;
  repPhone: string;
  repBirth: string;
  repCccd: string;
  repCccdDate: string;
  repCccdPlace: string;
  active: boolean;
  createdAt: string;
}

export type PhongStatus = 'trong' | 'dang_thue' | 'bao_tri' | 'dat_coc';

export interface Phong {
  id: string;
  propertyId: string;      // Phase 23.8.C — gán phòng vào nhà trọ nào
  code: string;            // "P101"
  floor: number;           // 1, 2, 3...
  area?: number;           // m2
  rentPrice: number;       // đ/tháng
  maxOccupants: number;    // số người tối đa
  status: PhongStatus;
  note?: string;
  imageUrl?: string;       // link Drive ảnh phòng
  createdAt: string;
  updatedAt: string;
}

export interface KhachThue {
  id: string;
  name: string;
  phone: string;
  cccd: string;
  cccdDate?: string;
  cccdPlace?: string;
  birth?: string;
  job?: string;
  address?: string;        // địa chỉ thường trú
  cccdImageUrl?: string;   // link Drive ảnh CMND
  createdAt: string;
}

export type HopDongStatus = 'dang_hd' | 'ket_thuc' | 'huy';

export interface HopDong {
  id: string;
  phongId: string;
  khachId: string;
  startDate: string;       // YYYY-MM-DD
  endDate: string;
  rentPrice: number;
  deposit: number;
  paymentMethod: string;   // "Chuyển khoản / Tiền mặt"
  customServices?: string; // ghi chú dịch vụ phụ
  status: HopDongStatus;
  contractFileUrl?: string;// link Drive file scan HĐ đã ký
  createdAt: string;
  updatedAt: string;
}

export interface DienNuocReading {
  id: string;
  phongId: string;
  thang: number;
  nam: number;
  dienCu: number;
  dienMoi: number;
  nuocCu: number;
  nuocMoi: number;
  createdAt: string;
}

export type HoaDonStatus = 'chua_tt' | 'da_tt' | 'qua_han';

export interface HoaDonNhaTro {
  id: string;
  invCode: string;         // INV...
  phongId: string;
  khachId?: string;
  thang: number;
  nam: number;
  rentPrice: number;
  dienKwh: number;
  dienAmount: number;
  nuocM3: number;
  nuocAmount: number;
  internet: number;
  veSinh: number;
  custom: { label: string; amount: number }[];
  total: number;
  status: HoaDonStatus;
  hanTT: string;           // YYYY-MM-DD
  paidAt?: string;
  paidAccountId?: string;  // tài khoản nhận tiền
  createdAt: string;
}

export interface ThanhToan {
  id: string;
  hoaDonId: string;
  amount: number;
  accountId: string;       // nhận vào account nào
  date: string;
  note?: string;
}

export type SuCoStatus = 'cho_xu_ly' | 'dang_xu_ly' | 'da_xong';

export interface SuCo {
  id: string;
  phongId?: string;
  title: string;
  description?: string;
  reportedAt: string;
  status: SuCoStatus;
  cost?: number;           // chi phí sửa
  resolvedAt?: string;
}

export interface ChiPhi {
  id: string;
  date: string;
  category: string;        // "Sửa chữa", "Vệ sinh", "Internet", ...
  description: string;
  amount: number;
  accountId?: string;      // tài khoản chi
  fromModule: 'nhatro' | 'banhang' | 'manual';
  refId?: string;          // id ref tới SuCo / Order
  createdAt: string;
}

// ==========================================================
// MODULE TÀI CHÍNH CÁ NHÂN
// ==========================================================
export type LedgerKind = 'thu' | 'chi';
export type LedgerCategory =
  | 'an_uong' | 'di_lai' | 'mua_sam' | 'hoa_don' | 'giai_tri' | 'suc_khoe'
  | 'giao_duc' | 'qua_tang' | 'khac_chi'
  | 'luong' | 'thuong' | 'dau_tu' | 'kinh_doanh' | 'cho_thue' | 'khac_thu';

export interface LedgerEntry {
  id: string;
  date: string;
  kind: LedgerKind;
  category: LedgerCategory;
  amount: number;
  description: string;
  accountId?: string;      // ví/tài khoản
  fromModule: 'manual' | 'nhatro' | 'banhang' | 'recurring';
  refId?: string;
  createdAt: string;
}

export interface Budget {
  id: string;
  year: number;
  month: number;           // 1-12
  category: LedgerCategory;
  limit: number;
}

export interface RecurringTxn {
  id: string;
  kind: LedgerKind;
  category: LedgerCategory;
  amount: number;
  description: string;
  accountId?: string;
  cycle: 'monthly' | 'weekly' | 'daily';
  dayOfMonth?: number;
  weekday?: number;        // 0-6 (Mon=0)
  active: boolean;
  lastTriggeredAt?: string;
}

// ==========================================================
// MODULE BÁN HÀNG (POS)
// ==========================================================
export type ShopTemplate = 'cafe' | 'taphoa' | 'sieuthi' | 'internet' | 'custom';

export interface ShopProfile {
  id: string;             // Phase 23.8.C — multi-shop
  template: ShopTemplate;
  name: string;
  address: string;
  phone: string;
  taxCode?: string;
  logoUrl?: string;
  active: boolean;
  createdAt: string;
}

export interface Product {
  id: string;
  shopId: string;          // Phase 23.8.C — gán SP vào shop nào
  sku: string;
  name: string;
  category: string;
  unit: string;            // "ly", "chai", "kg", "giờ", "phần"
  costPrice: number;
  salePrice: number;
  stock: number;
  minStock: number;        // cảnh báo dưới mức này
  imageUrl?: string;       // link Drive
  active: boolean;
  createdAt: string;
}

export interface OrderLine {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  amount: number;
}

export type OrderStatus = 'paid' | 'pending' | 'canceled';
export type PayMethod = 'cash' | 'transfer' | 'wallet' | 'debt';
export type OrderType = 'dine_in' | 'takeout';   // Phase 23.9.F — Cafe dual mode

export interface Order {
  id: string;
  shopId: string;          // Phase 23.8.C
  code: string;            // ORD...
  date: string;
  customerId?: string;
  lines: OrderLine[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  payMethod: PayMethod;
  paidAccountId?: string;
  status: OrderStatus;
  note?: string;
  orderType?: OrderType;        // Phase 23.9.F — chỉ dùng cho cafe (dine_in vs takeout)
  tableNumber?: string;         // Phase 23.9.F — bàn số mấy nếu dine_in (deprecated, dùng tableId)
  tableId?: string;             // Phase 23.9.H — ref tới CafeTable.id
  createdAt: string;
}

export interface Customer {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  loyaltyPoints: number;
  totalSpent: number;
  createdAt: string;
}

// Phase 23.9.H — Quán Cafe: bàn
export interface CafeTable {
  id: string;
  shopId: string;
  code: string;            // "B01", "B02", "VIP1"...
  capacity?: number;       // số ghế
  status: 'free' | 'occupied' | 'pending_payment';
  currentOrderId?: string; // Order pending tại bàn
  note?: string;
  createdAt: string;
}

// Phase 23.9.G — Quán Internet: máy + sessions
export interface ComputerStation {
  id: string;
  shopId: string;
  code: string;            // "M01", "M02"...
  ratePerHour: number;     // 8000đ/giờ
  status: 'free' | 'occupied';
  currentSessionId?: string;
  note?: string;
  createdAt: string;
}

export interface StationSession {
  id: string;
  shopId: string;
  stationId: string;
  customerId?: string;
  startedAt: string;       // ISO timestamp
  endedAt?: string;
  extras: OrderLine[];     // sản phẩm phụ (nước, bánh, mì tôm)
  note?: string;
  finalOrderId?: string;   // ref tới Order khi checkout
}

// ==========================================================
// SYSTEM
// ==========================================================
export interface InvoiceConfig {
  defaultDienPrice: number;
  defaultNuocPrice: number;
  defaultInternet: number;
  defaultVeSinh: number;
  hanTTDayInMonth: number;     // hạn TT ngày bao nhiêu hàng tháng
  invoicePrefix: string;       // INV
}

export interface AuditLog {
  id: string;
  time: string;
  action: string;
  module?: 'nhatro' | 'taichinh' | 'banhang' | 'system';
}

// ==========================================================
// MASTER DATABASE TYPE — Phase 23.8.C multi-property/multi-shop
// ==========================================================
export interface FinanceDb {
  accounts: Account[];
  // Multi-property (Phase 23.8.C) — 1 user quản nhiều nhà trọ
  properties: NhaTroProperty[];
  activePropertyId: string;
  phongs: Phong[];
  khachs: KhachThue[];
  hopDongs: HopDong[];
  dienNuoc: DienNuocReading[];
  hoaDons: HoaDonNhaTro[];
  thanhToans: ThanhToan[];
  suCos: SuCo[];
  chiPhis: ChiPhi[];
  ledger: LedgerEntry[];
  budgets: Budget[];
  recurrings: RecurringTxn[];
  // Multi-shop (Phase 23.8.C) — 1 user quản nhiều cửa hàng
  shops: ShopProfile[];
  activeShopId: string;
  products: Product[];
  orders: Order[];
  customers: Customer[];
  // Phase 23.9.G — Quán Internet
  stations: ComputerStation[];
  stationSessions: StationSession[];
  // Phase 23.9.H — Quán Cafe
  cafeTables: CafeTable[];
  contractTemplate: string;
  invoiceConfig: InvoiceConfig;
  logs: AuditLog[];
  dbVersion: string;
}

export const DEFAULT_INVOICE_CONFIG: InvoiceConfig = {
  defaultDienPrice: 4000,
  defaultNuocPrice: 25000,
  defaultInternet: 100000,
  defaultVeSinh: 20000,
  hanTTDayInMonth: 5,
  invoicePrefix: 'INV',
};

export const DEFAULT_CONTRACT_TEMPLATE = `CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
Độc lập - Tự do - Hạnh phúc
-----------------------------

HỢP ĐỒNG THUÊ PHÒNG TRỌ

Hôm nay, ngày {{today_day}} tháng {{today_month}} năm {{today_year}}, tại địa chỉ: {{property_address}}
Chúng tôi gồm có:

I. ĐẠI DIỆN BÊN CHO THUÊ PHÒNG TRỌ (BÊN A):
Ông/bà: {{property_rep_name}}    Sinh ngày: {{property_birth}}
Nơi thường trú: {{property_rep_address}}
Số CMND/CCCD: {{property_cccd}}    cấp ngày {{property_cccd_date}} tại: {{property_cccd_place}}
Số điện thoại: {{property_phone}}

II. BÊN THUÊ PHÒNG TRỌ (BÊN B):
Ông/bà: {{tenant_name}}    Sinh ngày: {{tenant_birth}}
Nơi đăng ký HK thường trú: {{tenant_address}}
Số CMND/CCCD: {{tenant_cccd}}    cấp ngày {{tenant_cccd_date}} tại: {{tenant_cccd_place}}
Số điện thoại: {{tenant_phone}}

Sau khi bàn bạc, hai bên thống nhất ký kết Hợp đồng thuê phòng trọ với các điều khoản chi tiết như sau:

III. THÔNG TIN PHÒNG THUÊ VÀ MỤC ĐÍCH SỬ DỤNG:
1. Bên A đồng ý cho bên B thuê 01 phòng ở tại địa chỉ: {{property_address}}
2. Phòng số: {{room_code}}
3. Mục đích thuê: Chỉ sử dụng để lưu trú, không sử dụng vào mục đích kinh doanh, tàng trữ hàng hóa hay vi phạm pháp luật.

IV. GIÁ THUÊ, TIỀN CỌC VÀ CÁC CHI PHÍ DỊCH VỤ:
1. Giá thuê phòng: {{rent_price}} đ/tháng.
2. Tiền đặt cọc: {{deposit}} đ.
3. Hình thức thanh toán: {{payment_method}}. Tiền thuê phòng được thanh toán từ ngày 01 đến ngày 05 hàng tháng.
4. Chi phí dịch vụ khác:
- Tiền điện: {{elec_price}} đ/kWh tính theo chỉ số công tơ thực tế sử dụng.
- Tiền nước: {{water_price}} đ/khối (hoặc tính theo người).
- Các chi phí khác: {{custom_services}}

V. THỜI HẠN HỢP ĐỒNG:
1. Thời hạn thuê: từ ngày {{start_date}} đến ngày {{end_date}}.
2. Hợp đồng có thể gia hạn theo thỏa thuận của hai bên.

VI. ĐIỀU KHOẢN CHUNG:
Hai bên cam kết thực hiện đúng các điều khoản đã ghi trong hợp đồng. Mọi tranh chấp sẽ được giải quyết trên cơ sở thương lượng, nếu không thống nhất sẽ đưa ra cơ quan có thẩm quyền giải quyết theo pháp luật hiện hành.

Hợp đồng được lập thành 02 bản có giá trị pháp lý như nhau, mỗi bên giữ 01 bản.

ĐẠI DIỆN BÊN A                                    ĐẠI DIỆN BÊN B
(Ký, ghi rõ họ tên)                              (Ký, ghi rõ họ tên)
`;

export const EMPTY_DB: FinanceDb = {
  accounts: [],
  properties: [],
  activePropertyId: '',
  phongs: [],
  khachs: [],
  hopDongs: [],
  dienNuoc: [],
  hoaDons: [],
  thanhToans: [],
  suCos: [],
  chiPhis: [],
  ledger: [],
  budgets: [],
  recurrings: [],
  shops: [],
  activeShopId: '',
  products: [],
  orders: [],
  customers: [],
  stations: [],
  stationSessions: [],
  cafeTables: [],
  contractTemplate: DEFAULT_CONTRACT_TEMPLATE,
  invoiceConfig: DEFAULT_INVOICE_CONFIG,
  logs: [],
  dbVersion: '23.9.1',
};

// Categorize labels (UI)
export const LEDGER_CATEGORY_LABEL: Record<LedgerCategory, string> = {
  an_uong: '🍽 Ăn uống',
  di_lai: '🚌 Đi lại',
  mua_sam: '🛍 Mua sắm',
  hoa_don: '💡 Hóa đơn',
  giai_tri: '🎬 Giải trí',
  suc_khoe: '⚕ Sức khỏe',
  giao_duc: '📚 Giáo dục',
  qua_tang: '🎁 Quà tặng',
  khac_chi: '… Chi khác',
  luong: '💰 Lương',
  thuong: '🎉 Thưởng',
  dau_tu: '📈 Đầu tư',
  kinh_doanh: '🏪 Kinh doanh',
  cho_thue: '🏠 Cho thuê',
  khac_thu: '… Thu khác',
};

export function isExpenseCategory(c: LedgerCategory): boolean {
  return ['an_uong','di_lai','mua_sam','hoa_don','giai_tri','suc_khoe','giao_duc','qua_tang','khac_chi'].includes(c);
}

// Vietnam banks supported by VietQR (top phổ biến)
export const VIETQR_BANKS = [
  { code: 'VCB', name: 'Vietcombank' },
  { code: 'ICB', name: 'VietinBank' },
  { code: 'BIDV', name: 'BIDV' },
  { code: 'AGRIBANK', name: 'Agribank' },
  { code: 'TCB', name: 'Techcombank' },
  { code: 'MB', name: 'MB Bank' },
  { code: 'ACB', name: 'ACB' },
  { code: 'TPB', name: 'TPBank' },
  { code: 'VPB', name: 'VPBank' },
  { code: 'VIB', name: 'VIB' },
  { code: 'SHB', name: 'SHB' },
  { code: 'STB', name: 'Sacombank' },
  { code: 'HDB', name: 'HDBank' },
  { code: 'OCB', name: 'OCB' },
  { code: 'MSB', name: 'MSB' },
  { code: 'EIB', name: 'Eximbank' },
];
