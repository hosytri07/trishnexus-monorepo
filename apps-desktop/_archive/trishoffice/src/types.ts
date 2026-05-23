/**
 * TrishOffice — Domain types (Phase 38.6 rebuilt scope + Phase 40.2 multi-tenant).
 *
 * 7 module types. Phase 1 dùng localStorage; Phase 2+ Firestore sync.
 *
 * Phase 40.2 — Multi-tenant: mỗi user TrishTEAM mặc định 1 Company. Có thể tạo
 * thêm. Data Employee/Attendance/Asset/... CHƯA scope theo company_id ở phiên
 * này — sẽ migrate ở Phase 41.
 */

// ============================================================
// 0. Company (Phase 40.2 — multi-tenant)
// ============================================================
export interface Company {
  /** Doc ID = generateId('cmp') */
  id: string;
  /** Tên công ty (vd "Công ty TNHH ABC") */
  name: string;
  /** Mã viết tắt (vd "ABC", "GT-DANANG") */
  code: string;
  /** Logo URL hoặc emoji */
  logo?: string;
  /** Địa chỉ trụ sở */
  address?: string;
  /** Mã số thuế */
  tax_code?: string;
  /** Email liên hệ */
  email?: string;
  /** Phone công ty */
  phone?: string;
  /** UID user TrishTEAM tạo company này (chủ company, sẽ là role 'owner') */
  owner_uid: string;
  /** Active = false → công ty đã đóng / suspended */
  active: boolean;
  /** Note nội bộ */
  note?: string;
  created_at: number;
  updated_at: number;
}

// ============================================================
// 1. Nhân sự (Employees)
// ============================================================
export type EmployeeStatus = 'active' | 'on_leave' | 'terminated';
export type ContractType = 'full_time' | 'part_time' | 'contract' | 'intern';
export type Gender = 'male' | 'female' | 'other';

export interface Employee {
  id: string;
  /** Mã nhân viên do công ty đặt (vd "NV001") */
  employee_code: string;
  full_name: string;
  /** Phase 38.19 — Ảnh đại diện base64 data URL (max ~512KB) */
  photo_data_url?: string;
  email?: string;
  phone?: string;
  dob?: string; // YYYY-MM-DD
  gender?: Gender;
  address?: string;
  /** Chức vụ (vd "Kỹ sư thiết kế") */
  position: string;
  /** Phòng ban (vd "Phòng Thiết kế") */
  department: string;
  hire_date: string; // YYYY-MM-DD
  contract_type: ContractType;
  /** Lương cơ bản hàng tháng (VND) */
  base_salary: number;
  /** Phụ cấp cố định (VND/tháng) — cộng dồn xăng/điện thoại/cơm */
  allowance?: number;
  /** Mã số BHXH (10 chữ số) */
  bhxh_code?: string;
  /** Mã số thuế cá nhân */
  tax_code?: string;
  /** Số tài khoản ngân hàng (chuyển lương) */
  bank_account?: string;
  bank_name?: string;
  status: EmployeeStatus;
  notes?: string;
  created_at: number;
  updated_at: number;
}

// ============================================================
// 2. Chấm công (Attendance) — Phase 1 manual
// ============================================================
export type AttendanceType =
  | 'work' // làm việc bình thường
  | 'leave_paid' // nghỉ phép có lương
  | 'leave_unpaid' // nghỉ không lương
  | 'leave_sick' // ốm
  | 'business_trip' // công tác
  | 'holiday'; // nghỉ lễ

export interface AttendanceEntry {
  id: string;
  employee_id: string;
  /** Ngày làm việc YYYY-MM-DD */
  date: string;
  type: AttendanceType;
  /** Giờ vào HH:MM (24h) — null nếu nghỉ cả ngày */
  time_in?: string;
  /** Giờ ra HH:MM */
  time_out?: string;
  /** Số giờ làm chính (auto tính từ time_in/time_out, có thể manual override) */
  hours_regular: number;
  /** Số giờ OT (manual nhập) */
  hours_ot?: number;
  notes?: string;
  /** Ai nhập (uid admin/HR) */
  created_by?: string;
  created_at: number;
  /** Phase 41.3 — added for BaseEntity compat (auto-set by useCollection) */
  updated_at?: number;
}

// ============================================================
// 3. Tài sản công ty (Assets)
// ============================================================
export type AssetCategory =
  | 'laptop'
  | 'desktop'
  | 'monitor'
  | 'printer'
  | 'phone'
  | 'vehicle'
  | 'furniture'
  | 'tool'
  | 'other';

export type AssetStatus = 'in_use' | 'available' | 'maintenance' | 'broken' | 'disposed';

export interface Asset {
  id: string;
  /** Mã tài sản (vd "TS001") */
  asset_code: string;
  name: string;
  category: AssetCategory;
  /** Serial / VIN (xe) / IMEI (điện thoại) */
  serial?: string;
  /** Hãng */
  brand?: string;
  /** Model / cấu hình */
  model?: string;
  purchase_date?: string;
  /** Giá mua (VND) */
  purchase_price?: number;
  /** Hết hạn bảo hành */
  warranty_until?: string;
  /** Đang giao cho ai (employee_id) */
  assigned_to?: string;
  assigned_at?: number;
  status: AssetStatus;
  /** Vị trí đặt (kho / phòng ban) */
  location?: string;
  notes?: string;
  created_at: number;
  updated_at: number;
}

// ============================================================
// 4. Quy trình duyệt (Workflows)
// ============================================================
export type WorkflowType =
  | 'purchase' // yêu cầu mua sắm
  | 'leave' // xin nghỉ
  | 'business_trip' // công tác
  | 'advance' // tạm ứng
  | 'expense' // hoàn ứng / báo công tác phí
  | 'overtime' // OT
  | 'other';

export type WorkflowStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface WorkflowApprovalStep {
  step_order: number;
  /** Vai trò người duyệt (vd "Trưởng phòng Thiết kế") */
  approver_role?: string;
  approver_id?: string; // employee_id
  status: 'pending' | 'approved' | 'rejected';
  comment?: string;
  decided_at?: number;
}

export interface WorkflowRequest {
  id: string;
  /** Mã yêu cầu auto (vd "YCMS-001") */
  request_code: string;
  type: WorkflowType;
  title: string;
  description: string;
  /** Người tạo */
  requester_id: string; // employee_id
  /** Số tiền nếu mua sắm/tạm ứng/expense (VND) */
  amount?: number;
  /** Ngày bắt đầu (nếu nghỉ phép/công tác) */
  start_date?: string;
  end_date?: string;
  status: WorkflowStatus;
  steps: WorkflowApprovalStep[];
  attachments?: string[]; // path/url
  created_at: number;
  updated_at: number;
}

// ============================================================
// 5. Tài liệu nội bộ (Documents)
// ============================================================
export type DocumentCategory =
  | 'regulation' // quy định
  | 'policy' // quy chế
  | 'procedure' // thủ tục
  | 'form' // biểu mẫu
  | 'announcement' // thông báo
  | 'training' // đào tạo
  | 'other';

export interface CompanyDocument {
  id: string;
  /** Mã tài liệu (vd "QD-NS-001") */
  doc_code: string;
  title: string;
  category: DocumentCategory;
  /** Nội dung markdown hoặc plain text */
  content?: string;
  /** Path file đính kèm (PDF/DOCX) */
  file_path?: string;
  /** Phòng ban áp dụng */
  department?: string;
  /** Ngày ban hành */
  issued_date?: string;
  /** Phiên bản (vd "1.0", "2.1") */
  version?: string;
  /** Người ban hành */
  issued_by?: string;
  /** Trạng thái: draft | active | obsolete */
  status: 'draft' | 'active' | 'obsolete';
  notes?: string;
  created_at: number;
  updated_at: number;
}

// ============================================================
// 6. Kế toán — Lương (Payroll)
// ============================================================
export interface PayrollEntry {
  id: string;
  employee_id: string;
  /** Tháng/năm tính lương: YYYY-MM */
  period: string;
  /** Lương cơ bản tại thời điểm tính (snapshot) */
  base_salary: number;
  /** Phụ cấp cố định (VND) */
  allowance: number;
  /** Số ngày công thực tế */
  workdays: number;
  /** Số ngày công chuẩn của tháng (vd 22-26) */
  workdays_standard: number;
  /** Số giờ OT */
  ot_hours: number;
  /** Tỷ lệ OT (1.5x ngày thường, 2.0x cuối tuần, 3.0x lễ) */
  ot_rate?: number;
  /** Tiền OT = base_salary / 26 / 8 * ot_hours * ot_rate */
  ot_amount: number;
  /** Tổng thu nhập trước khấu trừ */
  gross_income: number;
  /** BHXH 8% */
  bhxh: number;
  /** BHYT 1.5% */
  bhyt: number;
  /** BHTN 1% */
  bhtn: number;
  /** Công đoàn 1% (optional) */
  union_fee?: number;
  /** Thuế TNCN (tính theo bậc lũy tiến) */
  tax_pit: number;
  /** Tổng khấu trừ */
  total_deductions: number;
  /** Lương net thực nhận */
  net_pay: number;
  notes?: string;
  status: 'draft' | 'finalized' | 'paid';
  paid_at?: number;
  created_at: number;
  updated_at: number;
}

// ============================================================
// 7. Kế toán mở rộng — Hợp đồng (Doanh thu) + Chi phí + Thuế (Phase 38.9)
// ============================================================

/** Loại hợp đồng */
export type ContractType_Income =
  | 'construction' // thi công xây dựng
  | 'consulting' // tư vấn thiết kế
  | 'survey' // khảo sát
  | 'maintenance' // bảo trì
  | 'supply' // cung cấp vật tư
  | 'other';

export type ContractStatus =
  | 'draft' // soạn
  | 'signed' // đã ký
  | 'in_progress' // đang triển khai
  | 'completed' // hoàn thành
  | 'cancelled'; // hủy

/** Loại thanh toán hợp đồng */
export type ContractPaymentType =
  | 'advance' // tạm ứng (thanh toán trước)
  | 'progress' // theo tiến độ
  | 'final' // quyết toán cuối
  | 'retention_release'; // hoàn trả tiền giữ lại

export interface ContractPayment {
  id: string;
  date: string; // YYYY-MM-DD
  amount: number; // VND (chưa VAT)
  vat_amount?: number; // VAT từng đợt thanh toán
  type: ContractPaymentType;
  /** Số phiếu thu / số chứng từ */
  receipt_number?: string;
  notes?: string;
  created_at: number;
}

export interface ContractIncome {
  id: string;
  /** Số hợp đồng (vd "HD-2026-001") */
  contract_code: string;
  /** Tên hợp đồng / công trình */
  title: string;
  /** Khách hàng (chủ đầu tư / đơn vị thuê) */
  customer_name: string;
  /** Mã số thuế khách hàng */
  customer_tax_code?: string;
  customer_address?: string;
  customer_contact?: string;
  type: ContractType_Income;
  /** Giá trị hợp đồng chưa VAT (VND) */
  contract_value: number;
  /** Tỷ lệ VAT đầu ra (%) — mặc định 10 (XD-GT) */
  vat_rate: number;
  /** % tiền giữ lại bảo hành (retention) — mặc định 5% */
  retention_rate?: number;
  /** Ngày ký HD */
  signed_date?: string;
  /** Ngày bắt đầu thi công */
  start_date?: string;
  /** Ngày dự kiến hoàn thành */
  end_date?: string;
  /** Ngày thực tế hoàn thành */
  completion_date?: string;
  status: ContractStatus;
  /** Phòng ban phụ trách */
  department?: string;
  /** NV phụ trách (employee_id) */
  manager_id?: string;
  /** Lịch sử thanh toán */
  payments: ContractPayment[];
  notes?: string;
  created_at: number;
  updated_at: number;
}

/** Loại chi phí */
export type ExpenseCategory =
  | 'material' // vật tư XD
  | 'labor' // nhân công thuê ngoài
  | 'equipment' // thuê / mua thiết bị
  | 'subcontract' // thầu phụ
  | 'transport' // vận chuyển
  | 'utility' // điện nước văn phòng
  | 'office' // VPP
  | 'admin' // hành chính
  | 'travel' // công tác phí
  | 'tax_fee' // thuế phí
  | 'other';

export type ExpensePaymentStatus = 'pending' | 'partial' | 'paid';

export interface Expense {
  id: string;
  /** Mã phiếu chi (vd "PC-2026-0042") */
  expense_code: string;
  /** Ngày phát sinh chi phí */
  date: string;
  category: ExpenseCategory;
  /** Mô tả ngắn */
  title: string;
  /** Nhà cung cấp */
  vendor_name?: string;
  vendor_tax_code?: string;
  /** Số tiền chưa VAT */
  amount: number;
  /** Tỷ lệ VAT đầu vào (%) — 0 / 5 / 8 / 10 */
  vat_rate: number;
  /** VAT đầu vào (auto = amount * vat_rate / 100) */
  vat_amount: number;
  /** Tổng = amount + vat_amount */
  total: number;
  /** Đã thanh toán bao nhiêu */
  paid_amount: number;
  payment_status: ExpensePaymentStatus;
  payment_date?: string;
  /** Số hóa đơn VAT (nếu có) — để khấu trừ */
  invoice_number?: string;
  /** Liên kết với hợp đồng nào (cho cost analysis) */
  linked_contract_id?: string;
  /** NV chi (advance recipient nếu là tạm ứng) */
  paid_to_employee_id?: string;
  notes?: string;
  created_at: number;
  updated_at: number;
}

// ============================================================
// 8. Phòng ban (chia sẻ giữa Nhân sự + Workflow)
// ============================================================
export interface Department {
  id: string;
  /** Mã phòng ban (vd "TK") */
  code: string;
  name: string;
  /** Trưởng phòng (employee_id) */
  manager_id?: string;
  parent_id?: string; // phòng ban cha (cho hierarchy)
  notes?: string;
  created_at: number;
  updated_at: number;
}
