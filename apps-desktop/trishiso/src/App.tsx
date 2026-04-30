import { ChangeEvent, FormEvent, isValidElement, useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { Archive, BarChart3, Building2, CalendarDays, CheckCircle2, ChevronLeft, ClipboardList, Download, Edit3, FileCheck2, FileText, FolderOpen, HardDrive, Home, MapPin, Plus, RefreshCcw, Search, Settings, Trash2, Upload, FileSpreadsheet, Copy, X, Printer, Paperclip, UserCheck, Undo2, Clock, AlertTriangle, PackageCheck, Sun, Moon } from 'lucide-react';
import logoUrl from './assets/logo.png';

type PageKey = 'dashboard' | 'projects' | 'equipment' | 'loans' | 'isoStorage' | 'formLinks' | 'approvals' | 'imports' | 'templates' | 'storage' | 'reports' | 'settings';
type FileStatus = 'Đã có' | 'Chưa có' | 'Thiếu bản ký' | 'Thiếu scan' | 'Cần cập nhật';
type ProjectStatus = 'Đầy đủ' | 'Đang hoàn thiện' | 'Thiếu nhiều';

type HoSoTong = {
  id: string;
  soThuTu: string;
  tenCongTrinh: string;
  quocLo: string;
  tinhThanh: string;
  soHoSo: string;
  keHoachVon: string;
  quyetDinhPheDuyet: string;
  ngayQuyetDinh: string;
  chiPhiKhaoSat: number;
  chiPhiThietKe: number;
  chiPhiDuToan: number;
  chuTriKhaoSat: string;
  chuNhiemThietKe: string;
  chuNhiemDuToan: string;
  noiLuuHoSoGiay: string;
  noiLuuHoSoSo: string;
  ghiChu: string;
  createdAt: string;
  updatedAt: string;
};

type MucLucItem = {
  id: string;
  hoSoId: string;
  stt: number;
  tenVanBan: string;
  kyMaHieu: string;
  soQuyen: string;
  ngayCapNhat: string;
  ghiChu: string;
  batBuoc: boolean;
  trangThai: FileStatus;
  tenFile?: string;
  bieuMauId?: string;
};

type MauMucLuc = {
  id: string;
  tenMau: string;
  moTa: string;
  items: string[];
};

type AuditLog = { id: string; time: string; action: string };

type TaiLieuDinhKem = {
  id: string;
  hoSoId: string;
  mucLucId: string;
  tenFile: string;
  loaiFile: string;
  kichThuoc: number;
  phienBan: string;
  ngayTaiLen: string;
  nguoiTaiLen: string;
  ghiChu: string;
};

type MuonTraHoSo = {
  id: string;
  hoSoId: string;
  nguoiMuon: string;
  phongBan: string;
  ngayMuon: string;
  hanTra: string;
  ngayTra: string;
  mucDich: string;
  tinhTrangKhiMuon: string;
  tinhTrangKhiTra: string;
  trangThai: 'Đang mượn' | 'Đã trả' | 'Quá hạn';
  ghiChu: string;
};

type TrangThaiThietBi = 'Đang sử dụng' | 'Đang bảo trì' | 'Ngừng sử dụng' | 'Thanh lý';

type ThietBi = {
  id: string;
  maThietBi: string;
  tenThietBi: string;
  nhomThietBi: string;
  serial: string;
  phongBan: string;
  viTri: string;
  nguoiQuanLy: string;
  ngayMua: string;
  nhaCungCap: string;
  trangThai: TrangThaiThietBi;
  chuKyBaoTri: number;
  ngayBaoTriGanNhat: string;
  ngayBaoTriTiepTheo: string;
  chuKyHieuChuan: number;
  ngayHieuChuanGanNhat: string;
  ngayHieuChuanTiepTheo: string;
  fileChungNhan: string;
  phienBanChungNhan: string;
  ghiChu: string;
  updatedAt: string;
};

type IsoFolder = {
  id: string;
  parentId: string;
  tenFolder: string;
  maFolder: string;
  moTa: string;
  nguoiQuanLy: string;
  duongDanLuu: string;
  createdAt: string;
  updatedAt: string;
};

type BieuMauIso = {
  id: string;
  folderId: string;
  maBieuMau: string;
  tenBieuMau: string;
  phienBan: string;
  ngayBanHanh: string;
  fileName: string;
  ghiChu: string;
  updatedAt: string;
};

type ApprovalStatus = 'Nháp' | 'Chờ kiểm tra' | 'Chờ duyệt' | 'Đã ban hành' | 'Từ chối' | 'Hết hiệu lực';
type ApprovalTargetType = 'Hồ sơ' | 'Biểu mẫu' | 'Mục lục';

type ApprovalFlow = {
  id: string;
  targetType: ApprovalTargetType;
  targetId: string;
  maDoiTuong: string;
  tenDoiTuong: string;
  phienBan: string;
  trangThai: ApprovalStatus;
  nguoiLap: string;
  nguoiKiemTra: string;
  nguoiDuyet: string;
  ngayTao: string;
  ngayCapNhat: string;
  ngayBanHanh: string;
  lyDoTuChoi: string;
  ghiChu: string;
};


const defaultChecklist = [
  'Phiếu phân công nhiệm vụ',
  'Hợp đồng',
  'QĐ phê duyệt nhiệm vụ khảo sát',
  'Tờ trình phương án khảo sát',
  'QĐ phê duyệt phương án khảo sát',
  'Biên bản nghiệm thu khảo sát',
  'Tờ trình phê duyệt nhiệm vụ thiết kế',
  'QĐ phê duyệt nhiệm vụ thiết kế',
  'QĐ phê duyệt của KQLĐBIII',
  'QĐ phê duyệt của CĐBVN',
  'Biên bản nghiệm thu thiết kế',
  'Báo cáo kết quả khảo sát XDCT',
  'Báo cáo kinh tế kỹ thuật XDCT',
  'Hồ sơ dự toán',
  'Sổ khảo sát',
  'Nhật ký khảo sát',
];

const templatesSeed: MauMucLuc[] = [
  { id: 'tpl-khaosat', tenMau: 'Mẫu hồ sơ khảo sát - thiết kế', moTa: 'Bộ mục lục chuẩn theo hình mẫu bạn gửi.', items: defaultChecklist },
  { id: 'tpl-thietbi', tenMau: 'Mẫu hồ sơ thiết bị', moTa: 'Dùng cho thiết bị nội bộ, hiệu chuẩn, bảo trì.', items: ['Phiếu đề xuất mua sắm', 'Biên bản bàn giao thiết bị', 'Hồ sơ kỹ thuật thiết bị', 'Lịch bảo trì', 'Phiếu bảo trì', 'Giấy chứng nhận hiệu chuẩn', 'Biên bản thanh lý'] },
];

const projectsSeed: HoSoTong[] = [
  {
    id: 'hs-1', soThuTu: '8-2022', tenCongTrinh: 'Sửa chữa mặt đường, thoát nước và hoàn thiện hệ thống ATGT các đoạn Km1324 - Km1328, QL1, tỉnh Phú Yên', quocLo: 'QL1', tinhThanh: 'Phú Yên', soHoSo: '5-2022', keHoachVon: '0', quyetDinhPheDuyet: '1340/QĐ-TCĐBVN', ngayQuyetDinh: '2022-02-03', chiPhiKhaoSat: 59118000, chiPhiThietKe: 425926000, chiPhiDuToan: 0, chuTriKhaoSat: 'Ninh', chuNhiemThietKe: 'Huyền', chuNhiemDuToan: '', noiLuuHoSoGiay: 'Tủ HS-2022 / Kệ A / Ngăn 08', noiLuuHoSoSo: '\\\\SERVER01\\ISO\\2022\\PhuYen\\5-2022', ghiChu: '', createdAt: now(), updatedAt: now(),
  },
  {
    id: 'hs-2', soThuTu: '9-2022', tenCongTrinh: 'Sửa chữa mặt đường đoạn Km1298+650 - Km1300+800, sửa chữa, bổ sung cống ngang tại Km1299+020 và Km1304+706, QL1, tỉnh Phú Yên', quocLo: 'QL1', tinhThanh: 'Phú Yên', soHoSo: '17-2022', keHoachVon: 'KH2022 BS', quyetDinhPheDuyet: '1209/QĐ-CQLĐBIII', ngayQuyetDinh: '2022-11-08', chiPhiKhaoSat: 95312000, chiPhiThietKe: 305159000, chiPhiDuToan: 0, chuTriKhaoSat: 'Vũ', chuNhiemThietKe: 'Huyền', chuNhiemDuToan: 'Thoa', noiLuuHoSoGiay: 'Tủ HS-2022 / Kệ B / Ngăn 17', noiLuuHoSoSo: 'D:\\ISO\\CongTrinh\\2022\\17-2022', ghiChu: 'Cần bổ sung file scan hợp đồng', createdAt: now(), updatedAt: now(),
  },
  {
    id: 'hs-3', soThuTu: '10-2022', tenCongTrinh: 'Sửa chữa mặt đường đoạn Km1430+00 - Km1433+200, QL1, tỉnh Khánh Hòa', quocLo: 'QL1', tinhThanh: 'Khánh Hòa', soHoSo: '38-2022', keHoachVon: 'KH2022 BS', quyetDinhPheDuyet: '1210/QĐ-CQLĐBIII', ngayQuyetDinh: '2022-11-08', chiPhiKhaoSat: 20969000, chiPhiThietKe: 223982000, chiPhiDuToan: 0, chuTriKhaoSat: 'Ninh', chuNhiemThietKe: 'Huyền', chuNhiemDuToan: 'Minh', noiLuuHoSoGiay: 'Kho lưu trữ / Tủ KH-2022 / Ngăn 03', noiLuuHoSoSo: '\\\\NAS\\HoSo\\KhanhHoa\\38-2022', ghiChu: '', createdAt: now(), updatedAt: now(),
  },
];

function seedMucLuc(): MucLucItem[] {
  const statuses: FileStatus[] = ['Đã có', 'Đã có', 'Chưa có', 'Đã có', 'Thiếu bản ký', 'Đã có', 'Chưa có', 'Đã có', 'Đã có', 'Chưa có', 'Đã có', 'Đã có', 'Thiếu scan', 'Đã có', 'Cần cập nhật', 'Chưa có'];
  return projectsSeed.flatMap((p, projectIndex) => defaultChecklist.map((name, idx) => {
    const status = projectIndex === 0 ? 'Đã có' : statuses[(idx + projectIndex) % statuses.length];
    return {
      id: `ml-${p.id}-${idx + 1}`,
      hoSoId: p.id,
      stt: idx + 1,
      tenVanBan: name,
      kyMaHieu: status === 'Chưa có' ? '' : `${p.soHoSo}/${String(idx + 1).padStart(2, '0')}`,
      soQuyen: status === 'Chưa có' ? '' : '01',
      ngayCapNhat: status === 'Chưa có' ? '' : '2026-04-24',
      ghiChu: status === 'Chưa có' ? 'Chưa nhận hồ sơ' : '',
      batBuoc: true,
      trangThai: status as FileStatus,
      tenFile: status === 'Chưa có' ? '' : `${p.soHoSo}_${idx + 1}.pdf`,
      bieuMauId: idx === 0 ? 'bm-1' : idx === 1 ? 'bm-2' : idx === 4 ? 'bm-HS-01' : '',
    };
  }));
}


function seedApprovals(): ApprovalFlow[] {
  return [
    { id: 'pd-1', targetType: 'Biểu mẫu', targetId: 'bm-1', maDoiTuong: 'BM/BM-ISO-01', tenDoiTuong: 'Phiếu kiểm soát tài liệu', phienBan: '01', trangThai: 'Đã ban hành', nguoiLap: 'Quản trị', nguoiKiemTra: 'Phụ trách ISO', nguoiDuyet: 'Lãnh đạo phòng', ngayTao: '2026-01-02', ngayCapNhat: '2026-01-05', ngayBanHanh: '2026-01-05', lyDoTuChoi: '', ghiChu: 'Biểu mẫu chuẩn đang có hiệu lực.' },
    { id: 'pd-2', targetType: 'Hồ sơ', targetId: 'hs-2', maDoiTuong: 'HS 17-2022', tenDoiTuong: 'Hồ sơ sửa chữa mặt đường QL1 tỉnh Phú Yên', phienBan: '01', trangThai: 'Chờ kiểm tra', nguoiLap: 'Vũ', nguoiKiemTra: 'Phụ trách ISO', nguoiDuyet: 'Trưởng phòng', ngayTao: '2026-04-20', ngayCapNhat: '2026-04-22', ngayBanHanh: '', lyDoTuChoi: '', ghiChu: 'Cần kiểm tra đủ mục lục và file scan.' },
    { id: 'pd-3', targetType: 'Biểu mẫu', targetId: 'bm-HS-01', maDoiTuong: 'HSNB/BM-HS-01', tenDoiTuong: 'Phiếu kiểm tra đầy đủ mục lục hồ sơ', phienBan: '01', trangThai: 'Chờ duyệt', nguoiLap: 'Quản trị', nguoiKiemTra: 'Phụ trách ISO', nguoiDuyet: 'Lãnh đạo phòng', ngayTao: '2026-04-24', ngayCapNhat: '2026-04-24', ngayBanHanh: '', lyDoTuChoi: '', ghiChu: 'Biểu mẫu mới phục vụ kiểm tra hồ sơ con.' },
    { id: 'pd-4', targetType: 'Biểu mẫu', targetId: 'bm-4', maDoiTuong: 'NSDT/BM-NSDT-03', tenDoiTuong: 'Phiếu đánh giá sau đào tạo', phienBan: '01', trangThai: 'Nháp', nguoiLap: 'Nhân sự', nguoiKiemTra: '', nguoiDuyet: '', ngayTao: '2026-04-18', ngayCapNhat: '2026-04-18', ngayBanHanh: '', lyDoTuChoi: '', ghiChu: 'Đang bổ sung nội dung trước khi gửi kiểm tra.' },
  ];
}

const logsSeed: AuditLog[] = [{ id: 'log-1', time: now(), action: 'Khởi tạo dữ liệu Phase 1.10.1 - thêm quy trình duyệt hồ sơ/biểu mẫu' }];

function seedAttachments(): TaiLieuDinhKem[] {
  return seedMucLuc()
    .filter(item => item.trangThai === 'Đã có' && item.tenFile)
    .slice(0, 18)
    .map((item, idx) => ({
      id: `tl-${item.id}`,
      hoSoId: item.hoSoId,
      mucLucId: item.id,
      tenFile: item.tenFile || `tai-lieu-${idx + 1}.pdf`,
      loaiFile: 'application/pdf',
      kichThuoc: 240000 + idx * 58000,
      phienBan: 'v1.0',
      ngayTaiLen: '2026-04-24',
      nguoiTaiLen: 'Quản trị',
      ghiChu: 'File mẫu để kiểm tra giao diện phiên bản',
    }));
}


function seedLoans(): MuonTraHoSo[] {
  return [
    { id: 'mt-1', hoSoId: 'hs-2', nguoiMuon: 'Nguyễn Văn A', phongBan: 'Phòng Kế hoạch', ngayMuon: '2026-04-18', hanTra: '2026-04-28', ngayTra: '', mucDich: 'Rà soát hồ sơ phục vụ báo cáo', tinhTrangKhiMuon: 'Đủ bìa, có 1 tập hồ sơ giấy', tinhTrangKhiTra: '', trangThai: 'Đang mượn', ghiChu: 'Cần nhắc trước hạn 1 ngày' },
    { id: 'mt-2', hoSoId: 'hs-3', nguoiMuon: 'Trần Thị B', phongBan: 'Phòng Thiết kế', ngayMuon: '2026-04-05', hanTra: '2026-04-15', ngayTra: '', mucDich: 'Đối chiếu bản vẽ hoàn công', tinhTrangKhiMuon: 'Bìa hơi cũ, hồ sơ còn nguyên', tinhTrangKhiTra: '', trangThai: 'Quá hạn', ghiChu: 'Quá hạn, cần thu hồi' },
    { id: 'mt-3', hoSoId: 'hs-1', nguoiMuon: 'Lê Minh C', phongBan: 'Phòng Khảo sát', ngayMuon: '2026-03-20', hanTra: '2026-03-25', ngayTra: '2026-03-24', mucDich: 'Photo phụ lục hợp đồng', tinhTrangKhiMuon: 'Đầy đủ', tinhTrangKhiTra: 'Đã trả đủ', trangThai: 'Đã trả', ghiChu: '' },
  ];
}

function seedEquipment(): ThietBi[] {
  return [
    { id: 'tb-1', maThietBi: 'TB-KS-001', tenThietBi: 'Máy toàn đạc điện tử Leica TS06', nhomThietBi: 'Thiết bị khảo sát', serial: 'TS06-2022-001', phongBan: 'Phòng Khảo sát', viTri: 'Kho thiết bị / Tủ KS-01', nguoiQuanLy: 'Ninh', ngayMua: '2022-03-10', nhaCungCap: 'Leica Geosystems', trangThai: 'Đang sử dụng', chuKyBaoTri: 6, ngayBaoTriGanNhat: '2025-12-15', ngayBaoTriTiepTheo: '2026-06-15', chuKyHieuChuan: 12, ngayHieuChuanGanNhat: '2025-05-05', ngayHieuChuanTiepTheo: '2026-05-05', fileChungNhan: 'GCN_HieuChuan_TB-KS-001_2025.pdf', phienBanChungNhan: 'v1.0', ghiChu: 'Cần kiểm tra pin trước mỗi đợt khảo sát', updatedAt: now() },
    { id: 'tb-2', maThietBi: 'TB-VP-014', tenThietBi: 'Máy in màu Canon LBP', nhomThietBi: 'Thiết bị văn phòng', serial: 'CN-014-2023', phongBan: 'Văn phòng', viTri: 'Phòng Hành chính', nguoiQuanLy: 'Lan', ngayMua: '2023-08-21', nhaCungCap: 'Canon Việt Nam', trangThai: 'Đang bảo trì', chuKyBaoTri: 3, ngayBaoTriGanNhat: '2026-01-10', ngayBaoTriTiepTheo: '2026-04-10', chuKyHieuChuan: 0, ngayHieuChuanGanNhat: '', ngayHieuChuanTiepTheo: '', fileChungNhan: '', phienBanChungNhan: '', ghiChu: 'Kẹt giấy nhiều, đang chờ thay cụm sấy', updatedAt: now() },
    { id: 'tb-3', maThietBi: 'TB-KS-007', tenThietBi: 'Máy thủy bình Nikon', nhomThietBi: 'Thiết bị khảo sát', serial: 'NK-007-2021', phongBan: 'Phòng Khảo sát', viTri: 'Kho thiết bị / Kệ B', nguoiQuanLy: 'Vũ', ngayMua: '2021-11-02', nhaCungCap: 'Nikon', trangThai: 'Đang sử dụng', chuKyBaoTri: 6, ngayBaoTriGanNhat: '2026-02-01', ngayBaoTriTiepTheo: '2026-08-01', chuKyHieuChuan: 12, ngayHieuChuanGanNhat: '2025-03-30', ngayHieuChuanTiepTheo: '2026-03-30', fileChungNhan: 'GCN_HieuChuan_TB-KS-007_2025.pdf', phienBanChungNhan: 'v1.0', ghiChu: 'Đã quá hạn hiệu chuẩn, ưu tiên xử lý', updatedAt: now() },
  ];
}

function seedIsoFolders(): IsoFolder[] {
  return [
    { id: 'fld-root', parentId: '', tenFolder: 'Kho ISO nội bộ', maFolder: 'ISO', moTa: 'Folder gốc quản lý tài liệu, biểu mẫu và hồ sơ nội bộ ISO.', nguoiQuanLy: 'Quản trị ISO', duongDanLuu: '\\\\SERVER01\\ISO_NoiBo', createdAt: now(), updatedAt: now() },
    { id: 'fld-qt', parentId: 'fld-root', tenFolder: 'Quy trình ISO', maFolder: 'QT', moTa: 'Lưu các quy trình, quy định, hướng dẫn áp dụng nội bộ.', nguoiQuanLy: 'Ban ISO', duongDanLuu: '\\\\SERVER01\\ISO_NoiBo\\01_QuyTrinh', createdAt: now(), updatedAt: now() },
    { id: 'fld-bm', parentId: 'fld-root', tenFolder: 'Biểu mẫu ISO', maFolder: 'BM', moTa: 'Folder chứa các biểu mẫu đang hiệu lực.', nguoiQuanLy: 'Ban ISO', duongDanLuu: '\\\\SERVER01\\ISO_NoiBo\\02_BieuMau', createdAt: now(), updatedAt: now() },
    { id: 'fld-hsnb', parentId: 'fld-root', tenFolder: 'Hồ sơ nội bộ', maFolder: 'HSNB', moTa: 'Lưu hồ sơ nội bộ phát sinh theo từng biểu mẫu.', nguoiQuanLy: 'Văn phòng', duongDanLuu: '\\\\SERVER01\\ISO_NoiBo\\03_HoSoNoiBo', createdAt: now(), updatedAt: now() },
    { id: 'fld-tb', parentId: 'fld-hsnb', tenFolder: 'Hồ sơ thiết bị', maFolder: 'TB', moTa: 'Hồ sơ bảo trì, hiệu chuẩn, bàn giao thiết bị.', nguoiQuanLy: 'Phòng Thiết bị', duongDanLuu: '\\\\SERVER01\\ISO_NoiBo\\03_HoSoNoiBo\\ThietBi', createdAt: now(), updatedAt: now() },
    { id: 'fld-ns', parentId: 'fld-hsnb', tenFolder: 'Hồ sơ nhân sự - đào tạo', maFolder: 'NSDT', moTa: 'Hồ sơ đào tạo, đánh giá năng lực, phân công nhiệm vụ.', nguoiQuanLy: 'Hành chính', duongDanLuu: '\\\\SERVER01\\ISO_NoiBo\\03_HoSoNoiBo\\NhanSu_DaoTao', createdAt: now(), updatedAt: now() },
  ];
}

function seedBieuMauIso(): BieuMauIso[] {
  return [
    { id: 'bm-1', folderId: 'fld-bm', maBieuMau: 'BM-ISO-01', tenBieuMau: 'Phiếu kiểm soát tài liệu', phienBan: '01', ngayBanHanh: '2026-01-05', fileName: 'BM-ISO-01_Phieu_kiem_soat_tai_lieu.docx', ghiChu: 'Biểu mẫu dùng cho kiểm soát tài liệu nội bộ.', updatedAt: now() },
    { id: 'bm-2', folderId: 'fld-hsnb', maBieuMau: 'BM-HSNB-02', tenBieuMau: 'Danh mục hồ sơ nội bộ', phienBan: '02', ngayBanHanh: '2026-02-10', fileName: 'BM-HSNB-02_Danh_muc_ho_so_noi_bo.xlsx', ghiChu: 'Dùng để lập danh mục và nơi lưu hồ sơ.', updatedAt: now() },
    { id: 'bm-3', folderId: 'fld-tb', maBieuMau: 'BM-TB-01', tenBieuMau: 'Phiếu theo dõi bảo trì thiết bị', phienBan: '01', ngayBanHanh: '2026-03-01', fileName: 'BM-TB-01_Phieu_bao_tri_thiet_bi.xlsx', ghiChu: 'Gắn với folder hồ sơ thiết bị.', updatedAt: now() },
    { id: 'bm-4', folderId: 'fld-ns', maBieuMau: 'BM-NSDT-03', tenBieuMau: 'Phiếu đánh giá sau đào tạo', phienBan: '01', ngayBanHanh: '2026-03-15', fileName: 'BM-NSDT-03_Danh_gia_sau_dao_tao.docx', ghiChu: 'Gắn với hồ sơ nhân sự - đào tạo.', updatedAt: now() },
    { id: 'bm-HS-01', folderId: 'fld-hsnb', maBieuMau: 'BM-HS-01', tenBieuMau: 'Phiếu kiểm tra đầy đủ mục lục hồ sơ', phienBan: '01', ngayBanHanh: '2026-04-24', fileName: 'BM-HS-01_Phieu_kiem_tra_muc_luc_ho_so.docx', ghiChu: 'Dùng để đối chiếu hồ sơ phát sinh có đủ thành phần bắt buộc hay chưa.', updatedAt: now() },
  ];
}


function now() { return new Date().toISOString(); }
function today() { return new Date().toISOString().slice(0, 10); }
function money(n: number) { return new Intl.NumberFormat('vi-VN').format(n || 0); }
function fileSize(bytes: number) {
  if (!bytes) return '-';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes; let idx = 0;
  while (size >= 1024 && idx < units.length - 1) { size /= 1024; idx += 1; }
  return `${size.toFixed(idx ? 1 : 0)} ${units[idx]}`;
}
function dateVN(value: string) { return value ? new Intl.DateTimeFormat('vi-VN').format(new Date(value)) : '-'; }
function daysUntil(value: string) { if (!value) return 99999; const d = new Date(value + 'T00:00:00'); const nowDate = new Date(today() + 'T00:00:00'); return Math.ceil((d.getTime() - nowDate.getTime()) / 86400000); }
function createId(prefix: string) { return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`; }

function useLocalState<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => {
    try { const saved = localStorage.getItem(key); return saved ? JSON.parse(saved) as T : fallback; } catch { return fallback; }
  });
  useEffect(() => { localStorage.setItem(key, JSON.stringify(value)); }, [key, value]);
  return [value, setValue] as const;
}

function completion(items: MucLucItem[]) {
  const required = items.filter(i => i.batBuoc);
  const done = required.filter(i => i.trangThai === 'Đã có').length;
  const total = required.length || 1;
  const percent = Math.round((done / total) * 100);
  const status: ProjectStatus = percent === 100 ? 'Đầy đủ' : percent >= 70 ? 'Đang hoàn thiện' : 'Thiếu nhiều';
  return { done, total, percent, status, missing: total - done };
}

function statusBadge(status: FileStatus | ProjectStatus) {
  if (status === 'Đã có' || status === 'Đầy đủ') return 'badge badge-green';
  if (status === 'Đang hoàn thiện' || status === 'Cần cập nhật' || status === 'Thiếu scan' || status === 'Thiếu bản ký') return 'badge badge-yellow';
  return 'badge badge-red';
}

const emptyProject: HoSoTong = { id: '', soThuTu: '', tenCongTrinh: '', quocLo: '', tinhThanh: '', soHoSo: '', keHoachVon: '', quyetDinhPheDuyet: '', ngayQuyetDinh: today(), chiPhiKhaoSat: 0, chiPhiThietKe: 0, chiPhiDuToan: 0, chuTriKhaoSat: '', chuNhiemThietKe: '', chuNhiemDuToan: '', noiLuuHoSoGiay: '', noiLuuHoSoSo: '', ghiChu: '', createdAt: '', updatedAt: '' };
const emptyMucLuc: MucLucItem = { id: '', hoSoId: '', stt: 1, tenVanBan: '', kyMaHieu: '', soQuyen: '', ngayCapNhat: today(), ghiChu: '', batBuoc: true, trangThai: 'Chưa có', tenFile: '', bieuMauId: '' };
const emptyLoan: MuonTraHoSo = { id: '', hoSoId: '', nguoiMuon: '', phongBan: '', ngayMuon: today(), hanTra: today(), ngayTra: '', mucDich: '', tinhTrangKhiMuon: '', tinhTrangKhiTra: '', trangThai: 'Đang mượn', ghiChu: '' };
const emptyEquipment: ThietBi = { id: '', maThietBi: '', tenThietBi: '', nhomThietBi: '', serial: '', phongBan: '', viTri: '', nguoiQuanLy: '', ngayMua: today(), nhaCungCap: '', trangThai: 'Đang sử dụng', chuKyBaoTri: 6, ngayBaoTriGanNhat: '', ngayBaoTriTiepTheo: '', chuKyHieuChuan: 12, ngayHieuChuanGanNhat: '', ngayHieuChuanTiepTheo: '', fileChungNhan: '', phienBanChungNhan: '', ghiChu: '', updatedAt: now() };
const emptyIsoFolder: IsoFolder = { id: '', parentId: 'fld-root', tenFolder: '', maFolder: '', moTa: '', nguoiQuanLy: '', duongDanLuu: '', createdAt: '', updatedAt: '' };
const emptyBieuMauIso: BieuMauIso = { id: '', folderId: 'fld-bm', maBieuMau: '', tenBieuMau: '', phienBan: '01', ngayBanHanh: today(), fileName: '', ghiChu: '', updatedAt: now() };

export default function App() {
  const [page, setPage] = useState<PageKey>('dashboard');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try { return (localStorage.getItem('iso_theme') as 'light' | 'dark') || 'light'; } catch { return 'light'; }
  });
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('iso_theme', theme); } catch {}
  }, [theme]);
  const [projects, setProjects] = useLocalState<HoSoTong[]>('iso17-projects', projectsSeed);
  const [mucLuc, setMucLuc] = useLocalState<MucLucItem[]>('iso17-mucluc', seedMucLuc());
  const [templates] = useLocalState<MauMucLuc[]>('iso17-templates', templatesSeed);
  const [logs, setLogs] = useLocalState<AuditLog[]>('iso17-logs', logsSeed);
  const [attachments, setAttachments] = useLocalState<TaiLieuDinhKem[]>('iso17-attachments', seedAttachments());
  const [loans, setLoans] = useLocalState<MuonTraHoSo[]>('iso17-loans', seedLoans());
  const [equipment, setEquipment] = useLocalState<ThietBi[]>('iso17-equipment', seedEquipment());
  const [isoFolders, setIsoFolders] = useLocalState<IsoFolder[]>('iso18-folders', seedIsoFolders());
  const [bieuMauIso, setBieuMauIso] = useLocalState<BieuMauIso[]>('iso18-bieumau', seedBieuMauIso());
  const [approvals, setApprovals] = useLocalState<ApprovalFlow[]>('iso110-approvals', seedApprovals());
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string>('');
  const [projectModal, setProjectModal] = useState(false);
  const [projectForm, setProjectForm] = useState<HoSoTong>(emptyProject);
  const [itemModal, setItemModal] = useState(false);
  const [itemForm, setItemForm] = useState<MucLucItem>(emptyMucLuc);
  const [loanModal, setLoanModal] = useState(false);
  const [loanForm, setLoanForm] = useState<MuonTraHoSo>(emptyLoan);
  const [equipmentModal, setEquipmentModal] = useState(false);
  const [equipmentForm, setEquipmentForm] = useState<ThietBi>(emptyEquipment);
  const [folderModal, setFolderModal] = useState(false);
  const [folderForm, setFolderForm] = useState<IsoFolder>(emptyIsoFolder);
  const [bieuMauModal, setBieuMauModal] = useState(false);
  const [bieuMauForm, setBieuMauForm] = useState<BieuMauIso>(emptyBieuMauIso);
  const [selectedFolderId, setSelectedFolderId] = useState('fld-root');

  const selected = projects.find(p => p.id === selectedId) || null;
  const selectedItems = selected ? mucLuc.filter(i => i.hoSoId === selected.id).sort((a, b) => a.stt - b.stt) : [];
  const selectedStats = completion(selectedItems);

  const projectRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return projects.filter(p => !q || [p.tenCongTrinh, p.soHoSo, p.quocLo, p.tinhThanh, p.quyetDinhPheDuyet, p.chuTriKhaoSat, p.chuNhiemThietKe].join(' ').toLowerCase().includes(q));
  }, [projects, search]);

  const dashboard = useMemo(() => {
    const stats = projects.map(p => completion(mucLuc.filter(i => i.hoSoId === p.id)));
    const full = stats.filter(s => s.percent === 100).length;
    const missing = stats.reduce((sum, s) => sum + s.missing, 0);
    const avg = stats.length ? Math.round(stats.reduce((sum, s) => sum + s.percent, 0) / stats.length) : 0;
    return { total: projects.length, full, missing, avg };
  }, [projects, mucLuc]);

  const loanStats = useMemo(() => buildLoanStats(loans), [loans]);
  const equipmentStats = useMemo(() => buildEquipmentStats(equipment), [equipment]);
  const warnings = useMemo(() => buildWarnings(projects, mucLuc, attachments), [projects, mucLuc, attachments]);
  const provinceStats = useMemo(() => groupByProvince(projects, mucLuc), [projects, mucLuc]);
  const statusStats = useMemo(() => groupByStatus(projects, mucLuc), [projects, mucLuc]);

  function addLog(action: string) { setLogs(prev => [{ id: createId('log'), time: now(), action }, ...prev].slice(0, 100)); }
  function resetData() { setProjects(projectsSeed); setMucLuc(seedMucLuc()); setAttachments(seedAttachments()); setLoans(seedLoans()); setEquipment(seedEquipment()); setIsoFolders(seedIsoFolders()); setBieuMauIso(seedBieuMauIso()); setApprovals(seedApprovals()); setLogs(logsSeed); setSelectedId(''); setSelectedFolderId('fld-root'); addLog('Khôi phục dữ liệu mẫu Phase 1.10.1'); }

  function openCreateProject() { setProjectForm({ ...emptyProject, ngayQuyetDinh: today() }); setProjectModal(true); }
  function openEditProject(p: HoSoTong) { setProjectForm(p); setProjectModal(true); }
  function saveProject(e: FormEvent) {
    e.preventDefault();
    if (!projectForm.tenCongTrinh.trim()) return alert('Nhập tên công trình trước đã nhé.');
    if (projectForm.id) {
      setProjects(prev => prev.map(p => p.id === projectForm.id ? { ...projectForm, updatedAt: now() } : p));
      addLog(`Cập nhật hồ sơ tổng quát: ${projectForm.soHoSo || projectForm.tenCongTrinh}`);
    } else {
      const id = createId('hs');
      const newProject = { ...projectForm, id, createdAt: now(), updatedAt: now() };
      setProjects(prev => [newProject, ...prev]);
      setMucLuc(prev => [...templatesSeed[0].items.map((name, idx) => ({ ...emptyMucLuc, id: createId('ml'), hoSoId: id, stt: idx + 1, tenVanBan: name, trangThai: 'Chưa có' as FileStatus, ngayCapNhat: '', bieuMauId: '' })), ...prev]);
      addLog(`Tạo hồ sơ tổng quát mới: ${newProject.soHoSo || newProject.tenCongTrinh}`);
    }
    setProjectModal(false);
  }
  function deleteProject(id: string) {
    const p = projects.find(x => x.id === id);
    if (!confirm(`Xoá hồ sơ "${p?.soHoSo || p?.tenCongTrinh}" và toàn bộ mục lục con?`)) return;
    setProjects(prev => prev.filter(x => x.id !== id));
    setMucLuc(prev => prev.filter(x => x.hoSoId !== id));
    setAttachments(prev => prev.filter(x => x.hoSoId !== id));
    if (selectedId === id) setSelectedId('');
    addLog(`Xoá hồ sơ tổng quát: ${p?.soHoSo || id}`);
  }

  function openCreateItem() { if (!selected) return; setItemForm({ ...emptyMucLuc, id: '', hoSoId: selected.id, stt: selectedItems.length + 1 }); setItemModal(true); }
  function openEditItem(item: MucLucItem) { setItemForm(item); setItemModal(true); }
  function saveItem(e: FormEvent) {
    e.preventDefault();
    if (!itemForm.tenVanBan.trim()) return alert('Nhập tên văn bản trước đã nhé.');
    const clean = { ...itemForm, ngayCapNhat: itemForm.trangThai === 'Chưa có' ? '' : (itemForm.ngayCapNhat || today()) };
    if (clean.id) {
      setMucLuc(prev => prev.map(i => i.id === clean.id ? clean : i));
      addLog(`Cập nhật mục lục: ${clean.tenVanBan}`);
    } else {
      setMucLuc(prev => [...prev, { ...clean, id: createId('ml') }]);
      addLog(`Thêm mục lục hồ sơ: ${clean.tenVanBan}`);
    }
    setItemModal(false);
  }
  function deleteItem(id: string) {
    const item = mucLuc.find(i => i.id === id);
    if (!confirm(`Xoá mục "${item?.tenVanBan}"?`)) return;
    setMucLuc(prev => prev.filter(i => i.id !== id));
    setAttachments(prev => prev.filter(x => x.mucLucId !== id));
    addLog(`Xoá mục lục: ${item?.tenVanBan || id}`);
  }


  function attachFile(item: MucLucItem, e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const count = attachments.filter(a => a.mucLucId === item.id).length;
    const newAttachment: TaiLieuDinhKem = {
      id: createId('tl'), hoSoId: item.hoSoId, mucLucId: item.id,
      tenFile: file.name, loaiFile: file.type || 'Không xác định', kichThuoc: file.size,
      phienBan: `v${count + 1}.0`, ngayTaiLen: today(), nguoiTaiLen: 'Người dùng hiện tại',
      ghiChu: 'Phase 1.10.1 lưu metadata để test UI; Phase backend sẽ upload file thật lên server.',
    };
    setAttachments(prev => [newAttachment, ...prev]);
    setMucLuc(prev => prev.map(i => i.id === item.id ? { ...i, trangThai: 'Đã có', tenFile: file.name, ngayCapNhat: today() } : i));
    addLog(`Đính kèm file ${file.name} cho mục: ${item.tenVanBan}`);
    e.target.value = '';
  }
  function deleteAttachment(id: string) {
    const file = attachments.find(a => a.id === id);
    if (!confirm(`Xoá file "${file?.tenFile}" khỏi danh sách phiên bản?`)) return;
    setAttachments(prev => prev.filter(a => a.id !== id));
    addLog(`Xoá file đính kèm: ${file?.tenFile || id}`);
  }
  function printSelectedChecklist() {
    if (!selected) return;
    window.print();
    addLog(`In mục lục hồ sơ: ${selected.soHoSo || selected.tenCongTrinh}`);
  }
  function exportSelectedHtml() {
    if (!selected) return;
    const rows = selectedItems.map(i => `<tr><td>${i.stt}</td><td>${escapeHtml(i.tenVanBan)}</td><td>${escapeHtml(i.kyMaHieu || '')}</td><td>${escapeHtml(i.soQuyen || '')}</td><td>${escapeHtml(i.ngayCapNhat || '')}</td><td>${escapeHtml(i.trangThai)}</td><td>${escapeHtml(i.ghiChu || '')}</td></tr>`).join('');
    const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Mục lục hồ sơ ${escapeHtml(selected.soHoSo || '')}</title><style>body{font-family:'Times New Roman',serif;padding:32px}h1{text-align:center;font-size:20px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #111;padding:6px;font-size:14px}th{font-weight:bold}</style></head><body><h1>MỤC LỤC HỒ SƠ</h1><p><b>Số hồ sơ:</b> ${escapeHtml(selected.soHoSo)}<br><b>Công trình:</b> ${escapeHtml(selected.tenCongTrinh)}</p><table><thead><tr><th>TT</th><th>Tên văn bản trong hồ sơ</th><th>Ký mã hiệu</th><th>Số quyển</th><th>Ngày cập nhật</th><th>Trạng thái</th><th>Ghi chú</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
    downloadBlob(new Blob([html], { type: 'text/html;charset=utf-8' }), `muc-luc-${selected.soHoSo || selected.id}.html`);
    addLog(`Xuất mục lục HTML để in: ${selected.soHoSo || selected.tenCongTrinh}`);
  }


  function openCreateLoan(projectId?: string) {
    setLoanForm({ ...emptyLoan, hoSoId: projectId || selectedId || projects[0]?.id || '', ngayMuon: today(), hanTra: today(), trangThai: 'Đang mượn' });
    setLoanModal(true);
  }
  function openEditLoan(loan: MuonTraHoSo) { setLoanForm(loan); setLoanModal(true); }
  function saveLoan(e: FormEvent) {
    e.preventDefault();
    if (!loanForm.hoSoId) return alert('Chọn hồ sơ cần mượn/trả trước đã nhé.');
    if (!loanForm.nguoiMuon.trim()) return alert('Nhập người mượn trước đã nhé.');
    const computedStatus = loanForm.ngayTra ? 'Đã trả' : (loanForm.hanTra && loanForm.hanTra < today() ? 'Quá hạn' : 'Đang mượn');
    const clean: MuonTraHoSo = { ...loanForm, trangThai: computedStatus as MuonTraHoSo['trangThai'] };
    if (clean.id) {
      setLoans(prev => prev.map(x => x.id === clean.id ? clean : x));
      addLog(`Cập nhật phiếu mượn/trả hồ sơ: ${clean.nguoiMuon}`);
    } else {
      setLoans(prev => [{ ...clean, id: createId('mt') }, ...prev]);
      addLog(`Tạo phiếu mượn hồ sơ cho: ${clean.nguoiMuon}`);
    }
    setLoanModal(false);
  }
  function returnLoan(id: string) {
    const loan = loans.find(x => x.id === id);
    setLoans(prev => prev.map(x => x.id === id ? { ...x, ngayTra: today(), trangThai: 'Đã trả', tinhTrangKhiTra: x.tinhTrangKhiTra || 'Đã trả hồ sơ' } : x));
    addLog(`Ghi nhận trả hồ sơ: ${loan?.nguoiMuon || id}`);
  }
  function deleteLoan(id: string) {
    const loan = loans.find(x => x.id === id);
    if (!confirm(`Xoá phiếu mượn/trả của "${loan?.nguoiMuon || id}"?`)) return;
    setLoans(prev => prev.filter(x => x.id !== id));
    addLog(`Xoá phiếu mượn/trả hồ sơ: ${loan?.nguoiMuon || id}`);
  }

  function openCreateEquipment() { setEquipmentForm({ ...emptyEquipment, id: '', ngayMua: today(), updatedAt: now() }); setEquipmentModal(true); }
  function openEditEquipment(item: ThietBi) { setEquipmentForm(item); setEquipmentModal(true); }
  function saveEquipment(e: FormEvent) {
    e.preventDefault();
    if (!equipmentForm.maThietBi.trim() || !equipmentForm.tenThietBi.trim()) return alert('Nhập mã thiết bị và tên thiết bị trước đã nhé.');
    const clean = { ...equipmentForm, updatedAt: now() };
    if (clean.id) {
      setEquipment(prev => prev.map(x => x.id === clean.id ? clean : x));
      addLog(`Cập nhật thiết bị: ${clean.maThietBi} - ${clean.tenThietBi}`);
    } else {
      setEquipment(prev => [{ ...clean, id: createId('tb') }, ...prev]);
      addLog(`Thêm thiết bị mới: ${clean.maThietBi} - ${clean.tenThietBi}`);
    }
    setEquipmentModal(false);
  }
  function deleteEquipment(id: string) {
    const item = equipment.find(x => x.id === id);
    if (!confirm(`Xoá thiết bị "${item?.maThietBi || id}"?`)) return;
    setEquipment(prev => prev.filter(x => x.id !== id));
    addLog(`Xoá thiết bị: ${item?.maThietBi || id}`);
  }

  function openCreateFolder(parentId?: string) {
    setFolderForm({ ...emptyIsoFolder, parentId: parentId || selectedFolderId || 'fld-root', createdAt: now(), updatedAt: now() });
    setFolderModal(true);
  }
  function openEditFolder(folder: IsoFolder) { setFolderForm(folder); setFolderModal(true); }
  function saveFolder(e: FormEvent) {
    e.preventDefault();
    if (!folderForm.tenFolder.trim()) return alert('Nhập tên folder trước đã nhé.');
    if (!folderForm.maFolder.trim()) return alert('Nhập mã folder để kết hợp với mã biểu mẫu.');
    const clean = { ...folderForm, maFolder: folderForm.maFolder.trim().toUpperCase(), updatedAt: now() };
    if (clean.id) {
      setIsoFolders(prev => prev.map(x => x.id === clean.id ? clean : x));
      addLog(`Cập nhật/đổi tên folder ISO: ${clean.maFolder} - ${clean.tenFolder}`);
    } else {
      const created = { ...clean, id: createId('fld'), createdAt: now(), updatedAt: now() };
      setIsoFolders(prev => [...prev, created]);
      setSelectedFolderId(created.id);
      addLog(`Tạo folder ISO mới: ${created.maFolder} - ${created.tenFolder}`);
    }
    setFolderModal(false);
  }
  function deleteFolder(id: string) {
    if (id === 'fld-root') return alert('Folder gốc thì để yên, xoá nó là cả kho ISO bay màu đó.');
    const folder = isoFolders.find(x => x.id === id);
    const hasChild = isoFolders.some(x => x.parentId === id);
    const hasForms = bieuMauIso.some(x => x.folderId === id);
    if (hasChild || hasForms) return alert('Folder này đang có folder con hoặc biểu mẫu. Hãy chuyển/xoá dữ liệu bên trong trước.');
    if (!confirm(`Xoá folder "${folder?.tenFolder || id}"?`)) return;
    setIsoFolders(prev => prev.filter(x => x.id !== id));
    if (selectedFolderId === id) setSelectedFolderId('fld-root');
    addLog(`Xoá folder ISO: ${folder?.maFolder || id}`);
  }
  function openCreateBieuMau(folderId?: string) {
    setBieuMauForm({ ...emptyBieuMauIso, folderId: folderId || selectedFolderId || 'fld-bm', ngayBanHanh: today(), updatedAt: now() });
    setBieuMauModal(true);
  }
  function openEditBieuMau(item: BieuMauIso) { setBieuMauForm(item); setBieuMauModal(true); }
  function saveBieuMau(e: FormEvent) {
    e.preventDefault();
    if (!bieuMauForm.maBieuMau.trim() || !bieuMauForm.tenBieuMau.trim()) return alert('Nhập mã và tên biểu mẫu trước đã nhé.');
    const clean = { ...bieuMauForm, maBieuMau: bieuMauForm.maBieuMau.trim().toUpperCase(), updatedAt: now() };
    if (clean.id) {
      setBieuMauIso(prev => prev.map(x => x.id === clean.id ? clean : x));
      addLog(`Cập nhật biểu mẫu ISO: ${clean.maBieuMau} - ${clean.tenBieuMau}`);
    } else {
      setBieuMauIso(prev => [{ ...clean, id: createId('bmiso') }, ...prev]);
      addLog(`Thêm biểu mẫu vào folder ISO: ${clean.maBieuMau} - ${clean.tenBieuMau}`);
    }
    setBieuMauModal(false);
  }
  function deleteBieuMau(id: string) {
    const item = bieuMauIso.find(x => x.id === id);
    if (!confirm(`Xoá biểu mẫu "${item?.maBieuMau || id}" khỏi folder?`)) return;
    setBieuMauIso(prev => prev.filter(x => x.id !== id));
    addLog(`Xoá biểu mẫu ISO: ${item?.maBieuMau || id}`);
  }
  function attachBieuMauFile(item: BieuMauIso, e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBieuMauIso(prev => prev.map(x => x.id === item.id ? { ...x, fileName: file.name, updatedAt: now() } : x));
    addLog(`Gắn file biểu mẫu ISO: ${item.maBieuMau} - ${file.name}`);
    e.target.value = '';
  }
  function attachEquipmentCertificate(item: ThietBi, e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setEquipment(prev => prev.map(x => x.id === item.id ? { ...x, fileChungNhan: file.name, phienBanChungNhan: x.phienBanChungNhan ? 'v2.0' : 'v1.0', updatedAt: now() } : x));
    addLog(`Gắn chứng nhận/biên bản cho thiết bị: ${item.maThietBi} - ${file.name}`);
    e.target.value = '';
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify({ projects, mucLuc, attachments, loans, equipment, isoFolders, bieuMauIso, approvals, templates, logs }, null, 2)], { type: 'application/json;charset=utf-8' });
    downloadBlob(blob, `backup-quan-ly-iso-${today()}.json`);
    addLog('Xuất backup JSON');
  }

  function importJson(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        const keys = ['projects', 'mucLuc', 'attachments', 'loans', 'equipment', 'isoFolders', 'bieuMauIso', 'approvals', 'logs'];
        const found = keys.filter(k => Array.isArray((data as Record<string, unknown>)[k]));
        if (found.length === 0) { alert('File JSON không có dữ liệu hợp lệ.'); return; }
        if (!confirm(`Khôi phục ${found.length}/${keys.length} bộ dữ liệu? Dữ liệu hiện tại sẽ bị ghi đè.`)) return;
        if (Array.isArray(data.projects)) setProjects(data.projects);
        if (Array.isArray(data.mucLuc)) setMucLuc(data.mucLuc);
        if (Array.isArray(data.attachments)) setAttachments(data.attachments);
        if (Array.isArray(data.loans)) setLoans(data.loans);
        if (Array.isArray(data.equipment)) setEquipment(data.equipment);
        if (Array.isArray(data.isoFolders)) setIsoFolders(data.isoFolders);
        if (Array.isArray(data.bieuMauIso)) setBieuMauIso(data.bieuMauIso);
        if (Array.isArray(data.approvals)) setApprovals(data.approvals);
        if (Array.isArray(data.logs)) setLogs(data.logs);
        addLog(`Khôi phục backup JSON (${found.length} bộ)`);
        alert(`Đã khôi phục ${found.length} bộ dữ liệu.`);
      } catch (err) {
        alert('Lỗi đọc file JSON: ' + (err as Error).message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function toggleTheme() {
    setTheme(t => t === 'light' ? 'dark' : 'light');
  }
  function exportSelectedChecklist() {
    if (!selected) return;
    const rows = [['TT', 'Tên văn bản trong hồ sơ', 'Ký mã hiệu', 'Số quyển', 'Ngày cập nhật', 'Trạng thái', 'File', 'Ghi chú'], ...selectedItems.map(i => [i.stt, i.tenVanBan, i.kyMaHieu, i.soQuyen, i.ngayCapNhat, i.trangThai, i.tenFile || '', i.ghiChu])];
    downloadBlob(new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' }), `muc-luc-${selected.soHoSo || selected.id}.csv`);
    addLog(`Xuất mục lục CSV: ${selected.soHoSo || selected.tenCongTrinh}`);
  }
  function exportReport() {
    const rows = [['Số HS', 'Tên công trình', 'Quốc lộ', 'Tỉnh/TP', 'Quyết định', 'Ngày QĐ', 'Tiến độ', 'Tình trạng', 'Thiếu', 'Nơi lưu giấy', 'Nơi lưu số'], ...projects.map(p => {
      const s = completion(mucLuc.filter(i => i.hoSoId === p.id));
      return [p.soHoSo, p.tenCongTrinh, p.quocLo, p.tinhThanh, p.quyetDinhPheDuyet, p.ngayQuyetDinh, `${s.done}/${s.total}`, s.status, s.missing, p.noiLuuHoSoGiay, p.noiLuuHoSoSo];
    })];
    downloadBlob(new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' }), `bao-cao-ho-so-${today()}.csv`);
    addLog('Xuất báo cáo tổng hợp hồ sơ CSV');
  }

  return <div className="min-h-screen" style={{ background: 'var(--color-surface-bg)', color: 'var(--color-text-primary)' }}>
    <aside className="fixed inset-y-0 left-0 hidden w-72 lg:block" style={{ background: 'var(--color-surface-card)', borderRight: '1px solid var(--color-border-subtle)', padding: '20px' }}>
      <div className="mb-6 flex items-center gap-3" style={{ background: 'var(--color-surface-row)', border: '1px solid var(--color-border-subtle)', borderRadius: '14px', padding: '12px' }}>
        <img src={logoUrl} alt="TrishISO" style={{ width: 48, height: 48, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
        <div className="min-w-0">
          <div style={{ fontSize: '15px', fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--color-text-primary)' }}>TrishISO</div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Phase 1.10.1</div>
        </div>
      </div>
      <nav className="space-y-2">
        {[
          ['dashboard', Home, 'Tổng quan'], ['projects', FolderOpen, 'Hồ sơ tổng quát'], ['equipment', PackageCheck, 'Thiết bị nội bộ'], ['loans', UserCheck, 'Mượn/trả hồ sơ'], ['isoStorage', FolderOpen, 'Lưu trữ ISO'], ['formLinks', FileCheck2, 'Liên kết BM-HS'], ['approvals', CheckCircle2, 'Duyệt hồ sơ'], ['imports', FileSpreadsheet, 'Nhập Excel'], ['templates', ClipboardList, 'Mẫu mục lục'], ['storage', Archive, 'Kho lưu trữ'], ['reports', BarChart3, 'Báo cáo'], ['settings', Settings, 'Cài đặt'],
        ].map(([key, Icon, label]) => <button key={key as string} onClick={() => { setPage(key as PageKey); setSelectedId(''); }} className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-bold transition ${page === key ? 'bg-primary-50 text-primary-700' : 'text-slate-600 hover:bg-slate-50'}`}><Icon className="h-5 w-5" />{label}</button>)}
      </nav>
    </aside>

    <main className="lg:pl-72">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 px-6 py-4 backdrop-blur">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div><h1 className="text-2xl font-black tracking-tight">{pageTitle(page)}</h1><p className="text-sm text-slate-500">Quản lý hồ sơ cha, mục lục hồ sơ con, nơi lưu bản giấy/bản số và mức độ đầy đủ.</p></div>
          <div className="flex flex-wrap gap-2">
            <button className="btn-secondary" onClick={toggleTheme} title="Đổi giao diện sáng/tối">
              {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </button>
            <button className="btn-secondary" onClick={exportJson}><Download className="h-4 w-4" /> Backup JSON</button>
            <label className="btn-secondary cursor-pointer">
              <Upload className="h-4 w-4" /> Khôi phục JSON
              <input type="file" accept=".json,application/json" onChange={importJson} className="hidden" />
            </label>
            <button className="btn-secondary" onClick={() => setPage('imports')}><FileSpreadsheet className="h-4 w-4" /> Nhập Excel</button><button className="btn-primary" onClick={openCreateProject}><Plus className="h-4 w-4" /> Thêm hồ sơ</button>
          </div>
        </div>
      </header>

      <div className="p-6">
        {page === 'dashboard' && <Dashboard dashboard={dashboard} projects={projects} mucLuc={mucLuc} warnings={warnings} provinceStats={provinceStats} statusStats={statusStats} loanStats={loanStats} equipmentStats={equipmentStats} setPage={setPage} setSelectedId={setSelectedId} />}
        {page === 'equipment' && <EquipmentPage equipment={equipment} onCreate={openCreateEquipment} onEdit={openEditEquipment} onDelete={deleteEquipment} onAttachCertificate={attachEquipmentCertificate} />}
        {page === 'loans' && <LoansPage projects={projects} loans={loans} onCreate={() => openCreateLoan()} onEdit={openEditLoan} onReturn={returnLoan} onDelete={deleteLoan} />}
        {page === 'isoStorage' && <IsoStoragePage folders={isoFolders} forms={bieuMauIso} selectedFolderId={selectedFolderId} setSelectedFolderId={setSelectedFolderId} onCreateFolder={openCreateFolder} onEditFolder={openEditFolder} onDeleteFolder={deleteFolder} onCreateForm={openCreateBieuMau} onEditForm={openEditBieuMau} onDeleteForm={deleteBieuMau} onAttachFile={attachBieuMauFile} />}
        {page === 'formLinks' && <FormLinksPage projects={projects} mucLuc={mucLuc} setMucLuc={setMucLuc} forms={bieuMauIso} folders={isoFolders} addLog={addLog} />}
        {page === 'approvals' && <ApprovalsPage approvals={approvals} setApprovals={setApprovals} projects={projects} forms={bieuMauIso} folders={isoFolders} addLog={addLog} />}
        {page === 'projects' && (selected ? <ProjectDetail project={selected} items={selectedItems} stats={selectedStats} attachments={attachments} onBack={() => setSelectedId('')} onEditProject={() => openEditProject(selected)} onCreateItem={openCreateItem} onEditItem={openEditItem} onDeleteItem={deleteItem} onAttachFile={attachFile} onDeleteAttachment={deleteAttachment} onExport={exportSelectedChecklist} onPrint={printSelectedChecklist} onExportHtml={exportSelectedHtml} onGoImport={() => setPage('imports')} onCreateLoan={() => openCreateLoan(selected.id)} loans={loans.filter(l => l.hoSoId === selected.id)} forms={bieuMauIso} folders={isoFolders} /> : <ProjectsPage projects={projectRows} mucLuc={mucLuc} search={search} setSearch={setSearch} onOpen={id => setSelectedId(id)} onEdit={openEditProject} onDelete={deleteProject} onGoImport={() => setPage('imports')} />)}
        {page === 'imports' && <ImportPage projects={projects} setProjects={setProjects} mucLuc={mucLuc} setMucLuc={setMucLuc} addLog={addLog} />}
        {page === 'templates' && <TemplatesPage templates={templates} />}
        {page === 'storage' && <StoragePage projects={projects} attachments={attachments} />}
        {page === 'reports' && <ReportsPage projects={projects} mucLuc={mucLuc} attachments={attachments} warnings={warnings} provinceStats={provinceStats} statusStats={statusStats} onExport={exportReport} />}
        {page === 'settings' && <SettingsPage logs={logs} onReset={resetData} />}
      </div>
    </main>

    {projectModal && <ProjectModal form={projectForm} setForm={setProjectForm} onClose={() => setProjectModal(false)} onSubmit={saveProject} />}
    {itemModal && <ItemModal form={itemForm} setForm={setItemForm} forms={bieuMauIso} folders={isoFolders} onClose={() => setItemModal(false)} onSubmit={saveItem} />}
    {loanModal && <LoanModal form={loanForm} setForm={setLoanForm} projects={projects} onClose={() => setLoanModal(false)} onSubmit={saveLoan} />}
    {equipmentModal && <EquipmentModal form={equipmentForm} setForm={setEquipmentForm} onClose={() => setEquipmentModal(false)} onSubmit={saveEquipment} />}
    {folderModal && <FolderModal form={folderForm} setForm={setFolderForm} folders={isoFolders} onClose={() => setFolderModal(false)} onSubmit={saveFolder} />}
    {bieuMauModal && <BieuMauModal form={bieuMauForm} setForm={setBieuMauForm} folders={isoFolders} onClose={() => setBieuMauModal(false)} onSubmit={saveBieuMau} />}
  </div>;
}

function pageTitle(page: PageKey) { return ({ dashboard: 'Tổng quan', projects: 'Hồ sơ tổng quát', equipment: 'Thiết bị nội bộ', loans: 'Mượn/trả hồ sơ giấy', isoStorage: 'Lưu trữ hồ sơ ISO', formLinks: 'Liên kết biểu mẫu - hồ sơ', approvals: 'Quy trình duyệt hồ sơ/biểu mẫu', imports: 'Nhập Excel / CSV', templates: 'Mẫu mục lục hồ sơ', storage: 'Kho lưu trữ & file', reports: 'Báo cáo', settings: 'Cài đặt' } as Record<PageKey, string>)[page]; }

function StatCard({ icon, label, title, value, hint, note }: { icon: any; label?: string; title?: string; value: string | number; hint?: string; note?: string }) {
  const Icon = icon;
  const titleText = label || title || '';
  const noteText = hint || note || '';
  // Lucide icons React 18+ là forwardRef object, không phải 'function'.
  // isValidElement check: nếu đã là JSX element thì render thẳng, ngược lại instantiate.
  const iconNode = Icon ? (isValidElement(Icon) ? Icon : <Icon className="h-6 w-6" />) : null;
  return <div className="card"><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-bold text-slate-500">{titleText}</p><p className="mt-2 text-3xl font-black">{value}</p><p className="mt-2 text-sm text-slate-500">{noteText}</p></div>{iconNode && <div className="rounded-2xl bg-primary-50 p-3 text-primary-700">{iconNode}</div>}</div></div>;
}

function buildWarnings(projects: HoSoTong[], mucLuc: MucLucItem[], attachments: TaiLieuDinhKem[]) {
  const rows = projects.flatMap(p => mucLuc.filter(i => i.hoSoId === p.id && i.batBuoc && i.trangThai !== 'Đã có').map(i => ({
    id: `${p.id}-${i.id}`, hoSoId: p.id, soHoSo: p.soHoSo, tenCongTrinh: p.tenCongTrinh, tinhThanh: p.tinhThanh, quocLo: p.quocLo,
    muc: i.tenVanBan, stt: i.stt, trangThai: i.trangThai, ngayCapNhat: i.ngayCapNhat,
    mucDo: i.trangThai === 'Chưa có' ? 'Cao' : (i.trangThai === 'Thiếu bản ký' || i.trangThai === 'Thiếu scan') ? 'Trung bình' : 'Nhẹ',
  })));
  const noFile = mucLuc.filter(i => i.trangThai === 'Đã có' && attachments.every(a => a.mucLucId !== i.id)).map(i => {
    const p = projects.find(x => x.id === i.hoSoId);
    return p ? { id: `nofile-${i.id}`, hoSoId: p.id, soHoSo: p.soHoSo, tenCongTrinh: p.tenCongTrinh, tinhThanh: p.tinhThanh, quocLo: p.quocLo, muc: i.tenVanBan, stt: i.stt, trangThai: 'Đã có nhưng chưa gắn file', ngayCapNhat: i.ngayCapNhat, mucDo: 'Nhẹ' } : null;
  }).filter(Boolean) as any[];
  return [...rows, ...noFile].sort((a: any, b: any) => (a.mucDo === 'Cao' ? -1 : b.mucDo === 'Cao' ? 1 : 0));
}

function groupByProvince(projects: HoSoTong[], mucLuc: MucLucItem[]) {
  const map = new Map<string, { name: string; total: number; full: number; avg: number; missing: number }>();
  for (const p of projects) {
    const key = p.tinhThanh || 'Chưa rõ';
    const stat = completion(mucLuc.filter(i => i.hoSoId === p.id));
    const row = map.get(key) || { name: key, total: 0, full: 0, avg: 0, missing: 0 };
    row.total += 1; row.full += stat.percent === 100 ? 1 : 0; row.avg += stat.percent; row.missing += stat.missing;
    map.set(key, row);
  }
  return Array.from(map.values()).map(x => ({ ...x, avg: x.total ? Math.round(x.avg / x.total) : 0 })).sort((a, b) => b.total - a.total);
}

function groupByStatus(projects: HoSoTong[], mucLuc: MucLucItem[]) {
  const base: Record<ProjectStatus, number> = { 'Đầy đủ': 0, 'Đang hoàn thiện': 0, 'Thiếu nhiều': 0 };
  for (const p of projects) base[completion(mucLuc.filter(i => i.hoSoId === p.id)).status] += 1;
  return base;
}

function MiniBar({ value }: { value: number }) { return <div className="h-2 rounded-full bg-slate-200"><div className="h-2 rounded-full bg-primary-700" style={{ width: `${Math.max(4, Math.min(100, value))}%` }} /></div>; }

function Dashboard({ dashboard, projects, mucLuc, warnings, provinceStats, statusStats, loanStats, equipmentStats, setPage, setSelectedId }: any) {
  const need = projects.map((p: HoSoTong) => ({ p, s: completion(mucLuc.filter((i: MucLucItem) => i.hoSoId === p.id)) })).filter((x: any) => x.s.percent < 100).sort((a: any, b: any) => a.s.percent - b.s.percent).slice(0, 5);
  return <div className="space-y-6">
    <div className="grid gap-4 md:grid-cols-4 xl:grid-cols-7">
      <StatCard icon={FolderOpen} label="Tổng hồ sơ" value={dashboard.total} hint="Hồ sơ/công trình đang quản lý" />
      <StatCard icon={FileCheck2} label="Đầy đủ" value={dashboard.full} hint="Đạt 100% mục bắt buộc" />
      <StatCard icon={X} label="Cảnh báo" value={warnings.length} hint="Thiếu mục, thiếu bản ký/scan hoặc thiếu file" />
      <StatCard icon={BarChart3} label="Hoàn thành TB" value={`${dashboard.avg}%`} hint="Tính trên toàn bộ hồ sơ" />
      <StatCard icon={UserCheck} label="Đang mượn" value={loanStats.active} hint="Hồ sơ giấy chưa trả" />
      <StatCard icon={AlertTriangle} label="Mượn quá hạn" value={loanStats.overdue} hint="Cần thu hồi ngay" />
      <StatCard icon={PackageCheck} label="Thiết bị" value={equipmentStats.total} hint={`${equipmentStats.overdue} quá hạn · ${equipmentStats.dueSoon} sắp đến hạn`} />
    </div>
    <div className="grid gap-6 xl:grid-cols-3">
      <div className="card xl:col-span-2"><div className="card-header"><div><h2 className="card-title">Hồ sơ cần xử lý trước</h2><p className="card-subtitle">Sắp xếp theo tỷ lệ hoàn thành thấp nhất. Đây là danh sách nên dí trước, kẻo audit dí mình.</p></div></div><div className="overflow-auto"><table className="data-table"><thead><tr><th>Số HS</th><th>Tên công trình</th><th>Tỉnh/TP</th><th>Tiến độ</th><th>Tình trạng</th><th></th></tr></thead><tbody>{need.map(({ p, s }: any) => <tr key={p.id}><td className="font-black text-primary-700">{p.soHoSo}</td><td className="max-w-xl whitespace-normal font-semibold text-slate-800">{p.tenCongTrinh}</td><td>{p.tinhThanh}</td><td><Progress percent={s.percent} label={`${s.done}/${s.total}`} /></td><td><span className={statusBadge(s.status)}>{s.status}</span></td><td><button className="btn-mini" onClick={() => { setPage('projects'); setSelectedId(p.id); }}>Xem</button></td></tr>)}</tbody></table></div></div>
      <div className="card"><h2 className="card-title">Tình trạng tổng</h2><div className="mt-5 space-y-4">{(['Đầy đủ','Đang hoàn thiện','Thiếu nhiều'] as ProjectStatus[]).map(st => <div key={st}><div className="mb-1 flex justify-between text-sm font-bold"><span>{st}</span><span>{statusStats[st]}</span></div><MiniBar value={dashboard.total ? Math.round(statusStats[st] / dashboard.total * 100) : 0} /></div>)}</div></div>
    </div>
    <div className="grid gap-6 xl:grid-cols-2">
      <div className="card"><h2 className="card-title">Thống kê theo tỉnh/thành</h2><div className="mt-4 space-y-4">{provinceStats.map((x: any) => <div key={x.name} className="rounded-2xl border border-slate-100 p-4"><div className="mb-2 flex justify-between"><b>{x.name}</b><span className="text-sm text-slate-500">{x.total} hồ sơ · thiếu {x.missing} mục</span></div><Progress percent={x.avg} label={`${x.avg}% TB`} /></div>)}</div></div>
      <div className="card"><h2 className="card-title">Cảnh báo mới nhất</h2><div className="mt-4 space-y-3">{warnings.slice(0, 8).map((w: any) => <button key={w.id} className="w-full rounded-2xl border border-slate-100 bg-slate-50 p-4 text-left transition hover:bg-primary-50" onClick={() => { setPage('projects'); setSelectedId(w.hoSoId); }}><div className="flex flex-wrap items-center gap-2"><span className={w.mucDo === 'Cao' ? 'badge badge-red' : w.mucDo === 'Trung bình' ? 'badge badge-yellow' : 'badge badge-gray'}>{w.mucDo}</span><b className="text-primary-700">{w.soHoSo}</b><span className="text-sm text-slate-500">{w.trangThai}</span></div><div className="mt-2 text-sm font-semibold text-slate-800">{w.stt}. {w.muc}</div><div className="mt-1 text-xs text-slate-500">{w.tenCongTrinh}</div></button>)}</div></div>
    </div>
  </div>;
}

function ProjectsPage({ projects, mucLuc, search, setSearch, onOpen, onEdit, onDelete, onGoImport }: any) {
  const [province, setProvince] = useState('Tất cả');
  const [road, setRoad] = useState('Tất cả');
  const [status, setStatus] = useState('Tất cả');
  const provinces = ['Tất cả', ...Array.from(new Set(projects.map((p: HoSoTong) => p.tinhThanh).filter(Boolean)))];
  const roads = ['Tất cả', ...Array.from(new Set(projects.map((p: HoSoTong) => p.quocLo).filter(Boolean)))];
  const filtered = projects.filter((p: HoSoTong) => {
    const stat = completion(mucLuc.filter((i: MucLucItem) => i.hoSoId === p.id));
    return (province === 'Tất cả' || p.tinhThanh === province) && (road === 'Tất cả' || p.quocLo === road) && (status === 'Tất cả' || stat.status === status);
  });
  return <div className="card">
    <div className="card-header"><div><h2 className="card-title">Danh mục hồ sơ tổng quát</h2><p className="card-subtitle">Phase 1.9 thêm lọc nâng cao theo tỉnh, tuyến, trạng thái và vẫn tìm kiếm nhanh toàn bảng.</p></div><div className="flex w-full flex-col gap-2 md:w-[34rem] md:flex-row"><button className="btn-secondary shrink-0" onClick={onGoImport}><FileSpreadsheet className="h-4 w-4" /> Nhập Excel</button><div className="relative w-full"><Search className="absolute left-4 top-3 h-4 w-4 text-slate-400" /><input className="input-field pl-10" value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm tên công trình, số HS, tỉnh, người phụ trách..." /></div></div></div>
    <div className="mb-4 grid gap-3 md:grid-cols-4"><label className="text-sm font-bold text-slate-600">Tỉnh/thành<select className="select-field mt-1" value={province} onChange={e => setProvince(e.target.value)}>{provinces.map(x => <option key={x}>{x}</option>)}</select></label><label className="text-sm font-bold text-slate-600">Quốc lộ/tuyến<select className="select-field mt-1" value={road} onChange={e => setRoad(e.target.value)}>{roads.map(x => <option key={x}>{x}</option>)}</select></label><label className="text-sm font-bold text-slate-600">Tình trạng<select className="select-field mt-1" value={status} onChange={e => setStatus(e.target.value)}>{['Tất cả','Đầy đủ','Đang hoàn thiện','Thiếu nhiều'].map(x => <option key={x}>{x}</option>)}</select></label><div className="rounded-2xl bg-primary-50 p-4 text-sm font-bold text-primary-700">Đang hiển thị {filtered.length}/{projects.length} hồ sơ</div></div>
    <div className="overflow-auto"><table className="data-table"><thead><tr><th>STT</th><th>Tên công trình</th><th>QL</th><th>Tỉnh/TP</th><th>Số HS</th><th>Kế hoạch vốn</th><th>Quyết định</th><th>Ngày QĐ</th><th>Chi phí KS/TK/DT</th><th>Chủ trì/CN</th><th>Tiến độ</th><th>Thao tác</th></tr></thead><tbody>{filtered.map((p: HoSoTong) => { const stat = completion(mucLuc.filter((i: MucLucItem) => i.hoSoId === p.id)); return <tr key={p.id}><td className="font-bold">{p.soThuTu}</td><td className="max-w-lg whitespace-normal"><button className="text-left font-bold text-primary-700 hover:underline" onClick={() => onOpen(p.id)}>{p.tenCongTrinh}</button><div className="mt-1 text-xs text-slate-400"><MapPin className="mr-1 inline h-3 w-3" />{p.noiLuuHoSoGiay}</div></td><td>{p.quocLo}</td><td>{p.tinhThanh}</td><td className="font-black text-primary-700">{p.soHoSo}</td><td>{p.keHoachVon}</td><td>{p.quyetDinhPheDuyet}</td><td>{dateVN(p.ngayQuyetDinh)}</td><td>{money(p.chiPhiKhaoSat)} / {money(p.chiPhiThietKe)} / {money(p.chiPhiDuToan)}</td><td>{p.chuTriKhaoSat} / {p.chuNhiemThietKe} / {p.chuNhiemDuToan}</td><td><Progress percent={stat.percent} label={`${stat.done}/${stat.total}`} /><span className={statusBadge(stat.status)}>{stat.status}</span></td><td><div className="flex gap-2"><button className="icon-btn" onClick={() => onEdit(p)}><Edit3 className="h-4 w-4" /></button><button className="icon-btn-danger" onClick={() => onDelete(p.id)}><Trash2 className="h-4 w-4" /></button></div></td></tr>; })}</tbody></table></div>
  </div>;
}

function ProjectDetail({ project, items, stats, attachments, loans = [], forms = [], folders = [], onBack, onEditProject, onCreateItem, onEditItem, onDeleteItem, onAttachFile, onDeleteAttachment, onExport, onPrint, onExportHtml, onCreateLoan }: any) {
  const missing = items.filter((i: MucLucItem) => i.batBuoc && i.trangThai !== 'Đã có');
  const projectFiles = attachments.filter((a: TaiLieuDinhKem) => a.hoSoId === project.id);
  const latestFile = (itemId: string) => attachments.filter((a: TaiLieuDinhKem) => a.mucLucId === itemId).sort((a: TaiLieuDinhKem, b: TaiLieuDinhKem) => b.ngayTaiLen.localeCompare(a.ngayTaiLen))[0];
  return <div className="space-y-6 print-area">
    <button className="btn-secondary no-print" onClick={onBack}><ChevronLeft className="h-4 w-4" /> Quay lại danh sách</button>
    <div className="card">
      <div className="card-header"><div><h2 className="card-title">{project.soHoSo} - {project.tenCongTrinh}</h2><p className="card-subtitle">Chi tiết hồ sơ tổng quát, nơi lưu và mức độ đầy đủ mục lục con.</p></div><div className="flex flex-wrap gap-2 no-print"><button className="btn-secondary" onClick={onCreateLoan}><UserCheck className="h-4 w-4" /> Lập phiếu mượn</button><button className="btn-secondary" onClick={onEditProject}><Edit3 className="h-4 w-4" /> Sửa hồ sơ</button><button className="btn-secondary" onClick={onExport}><Download className="h-4 w-4" /> CSV</button><button className="btn-secondary" onClick={onExportHtml}><FileText className="h-4 w-4" /> HTML in</button><button className="btn-primary" onClick={onPrint}><Printer className="h-4 w-4" /> In mục lục</button></div></div>
      <div className="grid gap-4 md:grid-cols-4"><StatCard icon={ClipboardList} label="Tiến độ" value={`${stats.done}/${stats.total}`} hint="Mục bắt buộc đã đủ" /><StatCard icon={BarChart3} label="Tỷ lệ" value={`${stats.percent}%`} hint="Tự tính theo mục đã có" /><StatCard icon={X} label="Còn thiếu" value={stats.missing} hint="Mục bắt buộc chưa đạt" /><StatCard icon={Paperclip} label="File" value={projectFiles.length} hint="Tổng file/phiên bản đã ghi nhận" /></div>
      <div className="mt-5 grid gap-4 md:grid-cols-3"><Info icon={Building2} label="Quốc lộ / Tỉnh" value={`${project.quocLo} - ${project.tinhThanh}`} /><Info icon={FileText} label="Quyết định" value={`${project.quyetDinhPheDuyet} / ${dateVN(project.ngayQuyetDinh)}`} /><Info icon={HardDrive} label="Lưu hồ sơ giấy" value={project.noiLuuHoSoGiay || '-'} /><Info icon={HardDrive} label="Lưu hồ sơ số" value={project.noiLuuHoSoSo || '-'} /><Info icon={CheckCircle2} label="Trạng thái" value={stats.status} /><Info icon={CalendarDays} label="Cập nhật" value={dateVN(project.updatedAt)} /></div>
    </div>

    {loans.length > 0 && <div className="card no-print"><div className="card-header"><div><h2 className="card-title">Lịch sử mượn/trả hồ sơ giấy</h2><p className="card-subtitle">Theo dõi ai đang giữ hồ sơ, hạn trả và tình trạng khi mượn/trả.</p></div></div><div className="overflow-auto"><table className="data-table"><thead><tr><th>Người mượn</th><th>Phòng ban</th><th>Ngày mượn</th><th>Hạn trả</th><th>Ngày trả</th><th>Trạng thái</th><th>Mục đích</th></tr></thead><tbody>{loans.map((l: MuonTraHoSo) => <tr key={l.id}><td className="font-bold">{l.nguoiMuon}</td><td>{l.phongBan || '-'}</td><td>{dateVN(l.ngayMuon)}</td><td>{dateVN(l.hanTra)}</td><td>{dateVN(l.ngayTra)}</td><td><span className={loanBadge(l.trangThai)}>{l.trangThai}</span></td><td className="max-w-md whitespace-normal">{l.mucDich || '-'}</td></tr>)}</tbody></table></div></div>}
    {missing.length > 0 && <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 no-print"><div className="font-black text-amber-800">Các mục còn thiếu/cần xử lý</div><div className="mt-3 flex flex-wrap gap-2">{missing.map((i: MucLucItem) => <span key={i.id} className="badge badge-yellow">{i.stt}. {i.tenVanBan} - {i.trangThai}</span>)}</div></div>}
    <div className="card"><div className="card-header"><div><h2 className="card-title">Mục lục hồ sơ con</h2><p className="card-subtitle">Có thể gắn nhiều file/phiên bản cho từng mục. Phase này lưu metadata file để test quy trình; Phase backend sẽ upload thật lên server.</p></div><button className="btn-primary no-print" onClick={onCreateItem}><Plus className="h-4 w-4" /> Thêm mục</button></div><div className="overflow-auto"><table className="data-table print-table"><thead><tr><th>TT</th><th>Tên văn bản trong hồ sơ</th><th>Ký mã hiệu</th><th>Số quyển</th><th>Ngày cập nhật</th><th>Trạng thái</th><th>Biểu mẫu ISO</th><th>File/phiên bản</th><th>Ghi chú</th><th className="no-print"></th></tr></thead><tbody>{items.map((i: MucLucItem) => { const files = attachments.filter((a: TaiLieuDinhKem) => a.mucLucId === i.id); const latest = latestFile(i.id); return <tr key={i.id}><td className="font-black">{i.stt}</td><td className="min-w-80 whitespace-normal font-semibold text-slate-800">{i.tenVanBan}{i.batBuoc && <span className="ml-2 text-xs text-red-500 no-print">Bắt buộc</span>}</td><td>{i.kyMaHieu || '-'}</td><td>{i.soQuyen || '-'}</td><td>{dateVN(i.ngayCapNhat)}</td><td><span className={statusBadge(i.trangThai)}>{i.trangThai}</span></td><td className="min-w-64 whitespace-normal">{i.bieuMauId ? (() => { const bm = forms.find((x: BieuMauIso) => x.id === i.bieuMauId); return bm ? <div><div className="font-bold text-primary-700">{fullFormCode(bm, folders)}</div><div className="text-xs text-slate-500">{bm.tenBieuMau} · v{bm.phienBan}</div></div> : <span className="text-red-500">Biểu mẫu không tồn tại</span>; })() : <span className="text-slate-400">Chưa liên kết</span>}</td><td className="min-w-64 whitespace-normal">{latest ? <div><div className="font-bold text-primary-700"><Paperclip className="mr-1 inline h-3 w-3" />{latest.tenFile}</div><div className="text-xs text-slate-500">{files.length} phiên bản · mới nhất {latest.phienBan} · {fileSize(latest.kichThuoc)}</div><div className="mt-2 space-y-1 no-print">{files.slice(0, 3).map((f: TaiLieuDinhKem) => <div key={f.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-xs"><span>{f.phienBan} · {f.ngayTaiLen} · {f.tenFile}</span><button className="text-red-600" onClick={() => onDeleteAttachment(f.id)}>Xoá</button></div>)}</div></div> : <span className="text-slate-400">Chưa có file</span>}</td><td className="max-w-xs whitespace-normal">{i.ghiChu || '-'}</td><td className="no-print"><div className="flex gap-2"><label className="icon-btn cursor-pointer" title="Đính kèm file"><Upload className="h-4 w-4" /><input type="file" className="hidden" onChange={(e) => onAttachFile(i, e)} /></label><button className="icon-btn" onClick={() => onEditItem(i)}><Edit3 className="h-4 w-4" /></button><button className="icon-btn-danger" onClick={() => onDeleteItem(i.id)}><Trash2 className="h-4 w-4" /></button></div></td></tr>})}</tbody></table></div></div>
  </div>;
}

function Info({ icon: Icon, label, value }: any) { return <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-500"><Icon className="h-4 w-4" />{label}</div><div className="break-all text-sm font-semibold text-slate-800">{value}</div></div>; }
function Progress({ percent, label }: { percent: number; label: string }) { return <div className="min-w-36"><div className="mb-1 flex justify-between text-xs font-bold"><span>{label}</span><span>{percent}%</span></div><div className="h-2 rounded-full bg-slate-200"><div className="h-2 rounded-full bg-primary-700" style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} /></div></div>; }


function LoansPage({ projects, loans, onCreate, onEdit, onReturn, onDelete }: any) {
  const [status, setStatus] = useState('Tất cả');
  const [query, setQuery] = useState('');
  const enriched = loans.map((l: MuonTraHoSo) => ({ loan: l, project: projects.find((p: HoSoTong) => p.id === l.hoSoId) }));
  const rows = enriched
    .filter(({ loan, project }: any) => status === 'Tất cả' || loan.trangThai === status)
    .filter(({ loan, project }: any) => {
      const q = query.trim().toLowerCase();
      return !q || [loan.nguoiMuon, loan.phongBan, loan.mucDich, loan.ghiChu, project?.soHoSo, project?.tenCongTrinh, project?.tinhThanh].join(' ').toLowerCase().includes(q);
    });
  const stats = buildLoanStats(loans);
  return <div className="space-y-6">
    <div className="grid gap-4 md:grid-cols-4">
      <StatCard icon={UserCheck} label="Đang mượn" value={stats.active} hint="Hồ sơ giấy chưa trả" />
      <StatCard icon={AlertTriangle} label="Quá hạn" value={stats.overdue} hint="Nên thu hồi trước khi thất lạc" />
      <StatCard icon={PackageCheck} label="Đã trả" value={stats.returned} hint="Có ngày trả hồ sơ" />
      <StatCard icon={Clock} label="Tổng phiếu" value={loans.length} hint="Lịch sử mượn/trả" />
    </div>
    <div className="card">
      <div className="card-header">
        <div><h2 className="card-title">Mượn/trả hồ sơ giấy</h2><p className="card-subtitle">Quản lý ai đang giữ hồ sơ, mượn ngày nào, hạn trả khi nào, tình trạng khi mượn/trả. Phần này cứu bạn khỏi cảnh hỏi “hồ sơ đâu rồi?” trong vô vọng.</p></div>
        <button className="btn-primary" onClick={onCreate}><Plus className="h-4 w-4" /> Lập phiếu mượn</button>
      </div>
      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <div className="relative md:col-span-2"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input className="input-field pl-9" placeholder="Tìm người mượn, phòng ban, số hồ sơ, công trình..." value={query} onChange={e => setQuery(e.target.value)} /></div>
        <select className="select-field" value={status} onChange={e => setStatus(e.target.value)}>{['Tất cả','Đang mượn','Quá hạn','Đã trả'].map(x => <option key={x}>{x}</option>)}</select>
      </div>
      <div className="overflow-auto">
        <table className="data-table">
          <thead><tr><th>Trạng thái</th><th>Người mượn</th><th>Hồ sơ</th><th>Ngày mượn</th><th>Hạn trả</th><th>Ngày trả</th><th>Mục đích</th><th>Tình trạng</th><th></th></tr></thead>
          <tbody>{rows.map(({ loan, project }: any) => <tr key={loan.id}>
            <td><span className={loanBadge(loan.trangThai)}>{loan.trangThai}</span></td>
            <td><div className="font-black">{loan.nguoiMuon}</div><div className="text-xs text-slate-500">{loan.phongBan || '-'}</div></td>
            <td className="max-w-md whitespace-normal"><div className="font-black text-primary-700">{project?.soHoSo || '-'}</div><div className="text-xs text-slate-600">{project?.tenCongTrinh || 'Không tìm thấy hồ sơ'}</div></td>
            <td>{dateVN(loan.ngayMuon)}</td><td>{dateVN(loan.hanTra)}</td><td>{dateVN(loan.ngayTra)}</td>
            <td className="max-w-sm whitespace-normal">{loan.mucDich || '-'}</td>
            <td className="max-w-xs whitespace-normal"><div><b>Mượn:</b> {loan.tinhTrangKhiMuon || '-'}</div>{loan.tinhTrangKhiTra && <div><b>Trả:</b> {loan.tinhTrangKhiTra}</div>}</td>
            <td><div className="flex gap-2">{loan.trangThai !== 'Đã trả' && <button className="icon-btn" title="Ghi nhận trả" onClick={() => onReturn(loan.id)}><Undo2 className="h-4 w-4" /></button>}<button className="icon-btn" onClick={() => onEdit(loan)}><Edit3 className="h-4 w-4" /></button><button className="icon-btn-danger" onClick={() => onDelete(loan.id)}><Trash2 className="h-4 w-4" /></button></div></td>
          </tr>)}</tbody>
        </table>
      </div>
    </div>
  </div>;
}

function LoanModal({ form, setForm, projects, onSubmit, onClose }: any) {
  return <Modal title={form.id ? 'Sửa phiếu mượn/trả hồ sơ' : 'Lập phiếu mượn hồ sơ'} onClose={onClose}>
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="text-sm font-bold text-slate-600">Chọn hồ sơ<select className="select-field mt-1" value={form.hoSoId} onChange={e => setForm({ ...form, hoSoId: e.target.value })}>{projects.map((p: HoSoTong) => <option key={p.id} value={p.id}>{p.soHoSo} - {p.tenCongTrinh}</option>)}</select></label>
      <div className="form-grid"><Input label="Người mượn" value={form.nguoiMuon} onChange={(v: string) => setForm({ ...form, nguoiMuon: v })} /><Input label="Phòng ban" value={form.phongBan} onChange={(v: string) => setForm({ ...form, phongBan: v })} /></div>
      <div className="form-grid"><Input label="Ngày mượn" type="date" value={form.ngayMuon} onChange={(v: string) => setForm({ ...form, ngayMuon: v })} /><Input label="Hạn trả" type="date" value={form.hanTra} onChange={(v: string) => setForm({ ...form, hanTra: v })} /><Input label="Ngày trả" type="date" value={form.ngayTra} onChange={(v: string) => setForm({ ...form, ngayTra: v })} /></div>
      <Input label="Mục đích mượn" value={form.mucDich} onChange={(v: string) => setForm({ ...form, mucDich: v })} />
      <div className="form-grid"><Input label="Tình trạng khi mượn" value={form.tinhTrangKhiMuon} onChange={(v: string) => setForm({ ...form, tinhTrangKhiMuon: v })} /><Input label="Tình trạng khi trả" value={form.tinhTrangKhiTra} onChange={(v: string) => setForm({ ...form, tinhTrangKhiTra: v })} /></div>
      <Input label="Ghi chú" value={form.ghiChu} onChange={(v: string) => setForm({ ...form, ghiChu: v })} />
      <div className="rounded-2xl bg-primary-50 p-4 text-sm font-semibold text-primary-800">Trạng thái sẽ tự tính: có ngày trả = Đã trả; chưa trả mà quá hạn = Quá hạn; còn lại = Đang mượn.</div>
      <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={onClose}>Huỷ</button><button className="btn-primary">Lưu phiếu</button></div>
    </form>
  </Modal>;
}

function buildLoanStats(loans: MuonTraHoSo[]) {
  return {
    active: loans.filter(l => l.trangThai === 'Đang mượn').length,
    overdue: loans.filter(l => l.trangThai === 'Quá hạn').length,
    returned: loans.filter(l => l.trangThai === 'Đã trả').length,
  };
}
function loanBadge(status: MuonTraHoSo['trangThai']) {
  if (status === 'Đã trả') return 'badge badge-green';
  if (status === 'Quá hạn') return 'badge badge-red';
  return 'badge badge-yellow';
}


function buildEquipmentStats(equipment: ThietBi[]) {
  const overdue = equipment.filter(x => equipmentRisk(x).level === 'Quá hạn').length;
  const dueSoon = equipment.filter(x => equipmentRisk(x).level === 'Sắp đến hạn').length;
  const maintenance = equipment.filter(x => x.trangThai === 'Đang bảo trì').length;
  return { total: equipment.length, overdue, dueSoon, maintenance, active: equipment.filter(x => x.trangThai === 'Đang sử dụng').length };
}
function equipmentRisk(item: ThietBi) {
  const cal = item.ngayHieuChuanTiepTheo ? daysUntil(item.ngayHieuChuanTiepTheo) : 99999;
  const mt = item.ngayBaoTriTiepTheo ? daysUntil(item.ngayBaoTriTiepTheo) : 99999;
  const min = Math.min(cal, mt);
  if (item.trangThai === 'Ngừng sử dụng' || item.trangThai === 'Thanh lý') return { level: 'Không theo dõi', days: min };
  if (min < 0) return { level: 'Quá hạn', days: min };
  if (min <= 30) return { level: 'Sắp đến hạn', days: min };
  return { level: 'Ổn', days: min };
}
function equipmentBadge(level: string) {
  if (level === 'Ổn') return 'badge badge-green';
  if (level === 'Sắp đến hạn') return 'badge badge-yellow';
  if (level === 'Quá hạn') return 'badge badge-red';
  return 'badge badge-gray';
}
function statusEquipmentBadge(status: TrangThaiThietBi) {
  if (status === 'Đang sử dụng') return 'badge badge-green';
  if (status === 'Đang bảo trì') return 'badge badge-yellow';
  if (status === 'Ngừng sử dụng') return 'badge badge-gray';
  return 'badge badge-red';
}

function EquipmentPage({ equipment, onCreate, onEdit, onDelete, onAttachCertificate }: any) {
  const [status, setStatus] = useState('Tất cả');
  const [group, setGroup] = useState('Tất cả');
  const [query, setQuery] = useState('');
  const stats = buildEquipmentStats(equipment);
  const groups = ['Tất cả', ...Array.from(new Set(equipment.map((x: ThietBi) => x.nhomThietBi).filter(Boolean)))];
  const rows = equipment
    .filter((x: ThietBi) => status === 'Tất cả' || x.trangThai === status)
    .filter((x: ThietBi) => group === 'Tất cả' || x.nhomThietBi === group)
    .filter((x: ThietBi) => {
      const q = query.trim().toLowerCase();
      return !q || [x.maThietBi, x.tenThietBi, x.nhomThietBi, x.serial, x.phongBan, x.viTri, x.nguoiQuanLy, x.nhaCungCap, x.ghiChu].join(' ').toLowerCase().includes(q);
    })
    .sort((a: ThietBi, b: ThietBi) => equipmentRisk(a).days - equipmentRisk(b).days);
  return <div className="space-y-6">
    <div className="grid gap-4 md:grid-cols-4">
      <StatCard icon={PackageCheck} label="Tổng thiết bị" value={stats.total} hint="Thiết bị nội bộ đang quản lý" />
      <StatCard icon={CheckCircle2} label="Đang sử dụng" value={stats.active} hint="Có thể cấp phát/vận hành" />
      <StatCard icon={AlertTriangle} label="Quá hạn" value={stats.overdue} hint="Quá hạn bảo trì/hiệu chuẩn" />
      <StatCard icon={Clock} label="Sắp đến hạn" value={stats.dueSoon} hint="Trong vòng 30 ngày" />
    </div>
    <div className="card">
      <div className="card-header">
        <div><h2 className="card-title">Danh mục thiết bị nội bộ</h2><p className="card-subtitle">Theo dõi tình trạng, vị trí, người quản lý, lịch bảo trì/hiệu chuẩn và chứng nhận đi kèm. Đây là nửa còn lại của ISO, không nên để thiết bị trôi như thuyền giấy.</p></div>
        <button className="btn-primary" onClick={onCreate}><Plus className="h-4 w-4" /> Thêm thiết bị</button>
      </div>
      <div className="mb-4 grid gap-3 md:grid-cols-4">
        <div className="relative md:col-span-2"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input className="input-field pl-9" placeholder="Tìm mã, tên, serial, phòng ban, vị trí, người quản lý..." value={query} onChange={e => setQuery(e.target.value)} /></div>
        <select className="select-field" value={group} onChange={e => setGroup(e.target.value)}>{groups.map(x => <option key={x}>{x}</option>)}</select>
        <select className="select-field" value={status} onChange={e => setStatus(e.target.value)}>{['Tất cả','Đang sử dụng','Đang bảo trì','Ngừng sử dụng','Thanh lý'].map(x => <option key={x}>{x}</option>)}</select>
      </div>
      <div className="overflow-auto">
        <table className="data-table">
          <thead><tr><th>Cảnh báo</th><th>Mã/Tên thiết bị</th><th>Nhóm</th><th>Phòng ban/Vị trí</th><th>Người quản lý</th><th>Bảo trì</th><th>Hiệu chuẩn</th><th>Chứng nhận</th><th>Trạng thái</th><th></th></tr></thead>
          <tbody>{rows.map((item: ThietBi) => { const risk = equipmentRisk(item); return <tr key={item.id}>
            <td><span className={equipmentBadge(risk.level)}>{risk.level}</span>{risk.days !== 99999 && <div className="mt-1 text-xs text-slate-500">{risk.days < 0 ? `Trễ ${Math.abs(risk.days)} ngày` : `Còn ${risk.days} ngày`}</div>}</td>
            <td className="max-w-sm whitespace-normal"><div className="font-black text-primary-700">{item.maThietBi}</div><div className="font-semibold text-slate-800">{item.tenThietBi}</div><div className="text-xs text-slate-500">Serial: {item.serial || '-'}</div></td>
            <td>{item.nhomThietBi || '-'}</td>
            <td className="max-w-xs whitespace-normal"><div>{item.phongBan || '-'}</div><div className="text-xs text-slate-500">{item.viTri || '-'}</div></td>
            <td>{item.nguoiQuanLy || '-'}</td>
            <td><div>Gần nhất: {dateVN(item.ngayBaoTriGanNhat)}</div><div className="font-bold">Tiếp theo: {dateVN(item.ngayBaoTriTiepTheo)}</div><div className="text-xs text-slate-500">Chu kỳ {item.chuKyBaoTri || 0} tháng</div></td>
            <td><div>Gần nhất: {dateVN(item.ngayHieuChuanGanNhat)}</div><div className="font-bold">Tiếp theo: {dateVN(item.ngayHieuChuanTiepTheo)}</div><div className="text-xs text-slate-500">Chu kỳ {item.chuKyHieuChuan || 0} tháng</div></td>
            <td className="max-w-xs whitespace-normal">{item.fileChungNhan ? <><div className="font-semibold text-primary-700">{item.fileChungNhan}</div><div className="text-xs text-slate-500">{item.phienBanChungNhan || 'v1.0'}</div></> : <span className="text-slate-400">Chưa có</span>}<label className="mt-2 inline-flex cursor-pointer items-center gap-1 text-xs font-bold text-primary-700"><Paperclip className="h-3 w-3" /> Gắn file<input type="file" className="hidden" onChange={e => onAttachCertificate(item, e)} /></label></td>
            <td><span className={statusEquipmentBadge(item.trangThai)}>{item.trangThai}</span></td>
            <td><div className="flex gap-2"><button className="icon-btn" onClick={() => onEdit(item)}><Edit3 className="h-4 w-4" /></button><button className="icon-btn-danger" onClick={() => onDelete(item.id)}><Trash2 className="h-4 w-4" /></button></div></td>
          </tr>})}</tbody>
        </table>
      </div>
    </div>
  </div>;
}

function EquipmentModal({ form, setForm, onSubmit, onClose }: any) {
  return <Modal title={form.id ? 'Sửa thiết bị' : 'Thêm thiết bị nội bộ'} onClose={onClose}>
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="form-grid"><Input label="Mã thiết bị" value={form.maThietBi} onChange={(v: string) => setForm({ ...form, maThietBi: v })} /><Input label="Tên thiết bị" value={form.tenThietBi} onChange={(v: string) => setForm({ ...form, tenThietBi: v })} /></div>
      <div className="form-grid"><Input label="Nhóm thiết bị" value={form.nhomThietBi} onChange={(v: string) => setForm({ ...form, nhomThietBi: v })} /><Input label="Serial" value={form.serial} onChange={(v: string) => setForm({ ...form, serial: v })} /></div>
      <div className="form-grid"><Input label="Phòng ban" value={form.phongBan} onChange={(v: string) => setForm({ ...form, phongBan: v })} /><Input label="Vị trí lưu/đặt" value={form.viTri} onChange={(v: string) => setForm({ ...form, viTri: v })} /><Input label="Người quản lý" value={form.nguoiQuanLy} onChange={(v: string) => setForm({ ...form, nguoiQuanLy: v })} /></div>
      <div className="form-grid"><Input label="Ngày mua" type="date" value={form.ngayMua} onChange={(v: string) => setForm({ ...form, ngayMua: v })} /><Input label="Nhà cung cấp" value={form.nhaCungCap} onChange={(v: string) => setForm({ ...form, nhaCungCap: v })} /></div>
      <label className="text-sm font-bold text-slate-600">Trạng thái<select className="select-field mt-1" value={form.trangThai} onChange={e => setForm({ ...form, trangThai: e.target.value })}>{['Đang sử dụng','Đang bảo trì','Ngừng sử dụng','Thanh lý'].map(x => <option key={x}>{x}</option>)}</select></label>
      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4"><div className="mb-3 font-black text-slate-700">Bảo trì định kỳ</div><div className="form-grid"><Input label="Chu kỳ bảo trì (tháng)" type="number" value={form.chuKyBaoTri} onChange={(v: string) => setForm({ ...form, chuKyBaoTri: Number(v) })} /><Input label="Ngày bảo trì gần nhất" type="date" value={form.ngayBaoTriGanNhat} onChange={(v: string) => setForm({ ...form, ngayBaoTriGanNhat: v })} /><Input label="Ngày bảo trì tiếp theo" type="date" value={form.ngayBaoTriTiepTheo} onChange={(v: string) => setForm({ ...form, ngayBaoTriTiepTheo: v })} /></div></div>
      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4"><div className="mb-3 font-black text-slate-700">Hiệu chuẩn / kiểm định</div><div className="form-grid"><Input label="Chu kỳ hiệu chuẩn (tháng)" type="number" value={form.chuKyHieuChuan} onChange={(v: string) => setForm({ ...form, chuKyHieuChuan: Number(v) })} /><Input label="Ngày hiệu chuẩn gần nhất" type="date" value={form.ngayHieuChuanGanNhat} onChange={(v: string) => setForm({ ...form, ngayHieuChuanGanNhat: v })} /><Input label="Ngày hiệu chuẩn tiếp theo" type="date" value={form.ngayHieuChuanTiepTheo} onChange={(v: string) => setForm({ ...form, ngayHieuChuanTiepTheo: v })} /></div></div>
      <div className="form-grid"><Input label="File chứng nhận/biên bản" value={form.fileChungNhan} onChange={(v: string) => setForm({ ...form, fileChungNhan: v })} /><Input label="Phiên bản chứng nhận" value={form.phienBanChungNhan} onChange={(v: string) => setForm({ ...form, phienBanChungNhan: v })} /></div>
      <Input label="Ghi chú" value={form.ghiChu} onChange={(v: string) => setForm({ ...form, ghiChu: v })} />
      <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={onClose}>Huỷ</button><button className="btn-primary">Lưu thiết bị</button></div>
    </form>
  </Modal>;
}

function TemplatesPage({ templates }: { templates: MauMucLuc[] }) { return <div className="grid gap-4 md:grid-cols-2">{templates.map(t => <div className="card" key={t.id}><h2 className="card-title">{t.tenMau}</h2><p className="card-subtitle">{t.moTa}</p><ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-slate-700">{t.items.map(x => <li key={x}>{x}</li>)}</ol></div>)}</div>; }

function IsoStoragePage({ folders, forms, selectedFolderId, setSelectedFolderId, onCreateFolder, onEditFolder, onDeleteFolder, onCreateForm, onEditForm, onDeleteForm, onAttachFile }: any) {
  const selected = folders.find((f: IsoFolder) => f.id === selectedFolderId) || folders[0];
  const folderForms = forms.filter((x: BieuMauIso) => x.folderId === selected?.id);
  const childFolders = folders.filter((f: IsoFolder) => f.parentId === selected?.id);
  const stats = { folders: folders.length, forms: forms.length, noFile: forms.filter((x: BieuMauIso) => !x.fileName).length };
  return <div className="space-y-6">
    <div className="grid gap-4 md:grid-cols-3">
      <StatCard title="Tổng folder ISO" value={stats.folders} note="Folder cha/con" icon={<FolderOpen />} />
      <StatCard title="Tổng biểu mẫu" value={stats.forms} note="Đã liên kết vào folder" icon={<FileText />} />
      <StatCard title="Biểu mẫu chưa có file" value={stats.noFile} note="Cần bổ sung file mẫu" icon={<AlertTriangle />} />
    </div>
    <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
      <div className="card">
        <div className="card-header"><div><h2 className="card-title">Cây folder ISO</h2><p className="card-subtitle">Tạo, sửa, xoá, đổi tên folder. Mã folder dùng để ghép với mã biểu mẫu.</p></div></div>
        <div className="mb-4 flex flex-wrap gap-2"><button className="btn-primary" onClick={() => onCreateFolder(selected?.id)}><Plus className="h-4 w-4" /> Folder con</button><button className="btn-secondary" onClick={() => onCreateFolder('fld-root')}>Folder cấp 1</button></div>
        <div className="space-y-2">{folders.map((f: IsoFolder) => <button key={f.id} className={`w-full rounded-2xl border p-3 text-left transition ${selected?.id === f.id ? 'border-primary-200 bg-primary-50 text-primary-800' : 'border-slate-100 bg-slate-50 hover:bg-slate-100'}`} onClick={() => setSelectedFolderId(f.id)}>
          <div className="flex items-center justify-between gap-2"><span className="font-black">{folderIndent(f, folders)}{f.tenFolder}</span><span className="badge badge-blue">{f.maFolder}</span></div>
          <div className="mt-1 truncate text-xs text-slate-500">{folderPath(f.id, folders)}</div>
        </button>)}</div>
      </div>
      <div className="space-y-6">
        <div className="card">
          <div className="card-header"><div><h2 className="card-title">{selected?.tenFolder || 'Chưa chọn folder'}</h2><p className="card-subtitle">{selected?.moTa || 'Chọn folder để xem thông tin lưu trữ.'}</p></div><div className="flex flex-wrap gap-2"><button className="btn-secondary" onClick={() => selected && onEditFolder(selected)}><Edit3 className="h-4 w-4" /> Sửa/đổi tên</button><button className="btn-danger" onClick={() => selected && onDeleteFolder(selected.id)}><Trash2 className="h-4 w-4" /> Xoá</button></div></div>
          {selected && <div className="grid gap-3 md:grid-cols-2"><InfoLine label="Mã folder" value={selected.maFolder} /><InfoLine label="Người quản lý" value={selected.nguoiQuanLy || '-'} /><InfoLine label="Đường dẫn lưu" value={selected.duongDanLuu || '-'} mono /><InfoLine label="Đường dẫn cây" value={folderPath(selected.id, folders)} mono /></div>}
        </div>
        <div className="card">
          <div className="card-header"><div><h2 className="card-title">Folder con</h2><p className="card-subtitle">Dùng để chia nhỏ hồ sơ nội bộ: thiết bị, nhân sự, đào tạo, quy trình...</p></div><button className="btn-primary" onClick={() => onCreateFolder(selected?.id)}><Plus className="h-4 w-4" /> Thêm folder con</button></div>
          <div className="grid gap-3 md:grid-cols-2">{childFolders.length ? childFolders.map((f: IsoFolder) => <button key={f.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-left hover:bg-primary-50" onClick={() => setSelectedFolderId(f.id)}><div className="font-black text-primary-700">{f.maFolder}</div><div className="font-semibold">{f.tenFolder}</div><div className="mt-1 text-xs text-slate-500">{f.moTa}</div></button>) : <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">Chưa có folder con.</div>}</div>
        </div>
        <div className="card">
          <div className="card-header"><div><h2 className="card-title">Biểu mẫu trong folder</h2><p className="card-subtitle">Mã đầy đủ = mã folder + mã biểu mẫu. Ví dụ: HSNB/BM-HSNB-02.</p></div><button className="btn-primary" onClick={() => onCreateForm(selected?.id)}><Plus className="h-4 w-4" /> Thêm biểu mẫu</button></div>
          <div className="overflow-auto"><table className="data-table"><thead><tr><th>Mã đầy đủ</th><th>Tên biểu mẫu</th><th>Phiên bản</th><th>Ngày ban hành</th><th>File</th><th>Ghi chú</th><th>Thao tác</th></tr></thead><tbody>{folderForms.map((bm: BieuMauIso) => <tr key={bm.id}><td className="font-black text-primary-700">{fullFormCode(bm, folders)}</td><td className="max-w-sm whitespace-normal font-semibold">{bm.tenBieuMau}</td><td>{bm.phienBan}</td><td>{dateVN(bm.ngayBanHanh)}</td><td>{bm.fileName ? <span className="badge badge-green">{bm.fileName}</span> : <span className="badge badge-yellow">Chưa có file</span>}</td><td className="max-w-xs whitespace-normal">{bm.ghiChu}</td><td><div className="flex flex-wrap gap-2"><button className="icon-btn" onClick={() => onEditForm(bm)}><Edit3 className="h-4 w-4" /></button><label className="icon-btn cursor-pointer"><Paperclip className="h-4 w-4" /><input type="file" className="hidden" onChange={e => onAttachFile(bm, e)} /></label><button className="icon-btn text-red-600" onClick={() => onDeleteForm(bm.id)}><Trash2 className="h-4 w-4" /></button></div></td></tr>)}</tbody></table></div>
          {!folderForms.length && <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">Folder này chưa có biểu mẫu. Bấm “Thêm biểu mẫu” để gắn mã biểu mẫu vào folder.</div>}
        </div>
      </div>
    </div>
  </div>;
}

function folderDepth(folder: IsoFolder, folders: IsoFolder[]) {
  let depth = 0; let current = folder;
  while (current.parentId) { const parent = folders.find(f => f.id === current.parentId); if (!parent) break; depth += 1; current = parent; if (depth > 10) break; }
  return depth;
}
function folderIndent(folder: IsoFolder, folders: IsoFolder[]) { return `${'— '.repeat(folderDepth(folder, folders))}`; }
function folderPath(id: string, folders: IsoFolder[]) {
  const path: string[] = []; let current = folders.find(f => f.id === id); let guard = 0;
  while (current && guard < 20) { path.unshift(`${current.maFolder} ${current.tenFolder}`); current = folders.find(f => f.id === current?.parentId); guard += 1; }
  return path.join(' / ');
}
function fullFormCode(item: BieuMauIso, folders: IsoFolder[]) {
  const folder = folders.find(f => f.id === item.folderId);
  return `${folder?.maFolder || 'ISO'}/${item.maBieuMau}`;
}
function InfoLine({ label, value, mono = false }: any) { return <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs font-black uppercase tracking-wide text-slate-400">{label}</div><div className={`mt-1 text-sm font-semibold text-slate-800 ${mono ? 'font-mono' : ''}`}>{value}</div></div>; }

function StoragePage({ projects, attachments }: { projects: HoSoTong[]; attachments: TaiLieuDinhKem[] }) {
  return <div className="space-y-6"><div className="card"><div className="card-header"><div><h2 className="card-title">Kho lưu trữ hồ sơ</h2><p className="card-subtitle">Theo dõi bản giấy, bản số và số lượng file/phiên bản đang gắn với từng hồ sơ.</p></div></div><div className="overflow-auto"><table className="data-table"><thead><tr><th>Số HS</th><th>Tên công trình</th><th>Hồ sơ giấy</th><th>Hồ sơ số</th><th>File</th><th>Ghi chú</th></tr></thead><tbody>{projects.map(p => { const count = attachments.filter(a => a.hoSoId === p.id).length; return <tr key={p.id}><td className="font-black text-primary-700">{p.soHoSo}</td><td className="max-w-lg whitespace-normal font-semibold">{p.tenCongTrinh}</td><td>{p.noiLuuHoSoGiay}</td><td className="font-mono text-xs">{p.noiLuuHoSoSo}</td><td><span className="badge badge-blue">{count} file</span></td><td>{p.ghiChu || '-'}</td></tr>})}</tbody></table></div></div><div className="card"><h2 className="card-title">Danh sách file/phiên bản gần nhất</h2><div className="mt-4 overflow-auto"><table className="data-table"><thead><tr><th>File</th><th>Phiên bản</th><th>Ngày tải</th><th>Dung lượng</th><th>Ghi chú</th></tr></thead><tbody>{attachments.slice(0, 50).map(a => <tr key={a.id}><td className="font-semibold text-primary-700">{a.tenFile}</td><td>{a.phienBan}</td><td>{dateVN(a.ngayTaiLen)}</td><td>{fileSize(a.kichThuoc)}</td><td>{a.ghiChu}</td></tr>)}</tbody></table></div></div></div>;
}

function ReportsPage({ projects, mucLuc, attachments, warnings, provinceStats, statusStats, onExport }: any) {
  const [province, setProvince] = useState('Tất cả');
  const [status, setStatus] = useState('Tất cả');
  const provinces = ['Tất cả', ...Array.from(new Set(projects.map((p: HoSoTong) => p.tinhThanh).filter(Boolean)))];
  const rows = projects.map((p: HoSoTong) => ({ p, s: completion(mucLuc.filter((i: MucLucItem) => i.hoSoId === p.id)) })).filter(({ p, s }: any) => (province === 'Tất cả' || p.tinhThanh === province) && (status === 'Tất cả' || s.status === status));
  const filteredWarnings = warnings.filter((w: any) => province === 'Tất cả' || w.tinhThanh === province);
  return <div className="space-y-6">
    <div className="grid gap-4 md:grid-cols-4"><StatCard icon={FolderOpen} label="Hồ sơ theo lọc" value={rows.length} hint="Sau khi áp dụng bộ lọc" /><StatCard icon={FileCheck2} label="Đầy đủ" value={rows.filter((r: any) => r.s.percent === 100).length} hint="Đạt 100% mục bắt buộc" /><StatCard icon={X} label="Cảnh báo" value={filteredWarnings.length} hint="Mục cần xử lý" /><StatCard icon={Paperclip} label="File/phiên bản" value={attachments.length} hint="Metadata file đang ghi nhận" /></div>
    <div className="card"><div className="card-header"><div><h2 className="card-title">Báo cáo thiếu hồ sơ</h2><p className="card-subtitle">Phase 1.9 có bộ lọc báo cáo, thống kê theo tỉnh và danh sách cảnh báo chi tiết.</p></div><button className="btn-primary" onClick={onExport}><Download className="h-4 w-4" /> Xuất CSV tổng hợp</button></div><div className="mb-4 grid gap-3 md:grid-cols-3"><label className="text-sm font-bold text-slate-600">Tỉnh/thành<select className="select-field mt-1" value={province} onChange={e => setProvince(e.target.value)}>{provinces.map(x => <option key={x}>{x}</option>)}</select></label><label className="text-sm font-bold text-slate-600">Tình trạng<select className="select-field mt-1" value={status} onChange={e => setStatus(e.target.value)}>{['Tất cả','Đầy đủ','Đang hoàn thiện','Thiếu nhiều'].map(x => <option key={x}>{x}</option>)}</select></label><div className="rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-700">Tổng trạng thái: Đủ {statusStats['Đầy đủ']} · Đang {statusStats['Đang hoàn thiện']} · Thiếu {statusStats['Thiếu nhiều']}</div></div><div className="overflow-auto"><table className="data-table"><thead><tr><th>Số HS</th><th>Tên công trình</th><th>Tỉnh/TP</th><th>Tiến độ</th><th>Tình trạng</th><th>Số mục thiếu</th><th>Nơi lưu</th></tr></thead><tbody>{rows.map(({ p, s }: any) => <tr key={p.id}><td className="font-black text-primary-700">{p.soHoSo}</td><td className="max-w-xl whitespace-normal font-semibold">{p.tenCongTrinh}</td><td>{p.tinhThanh}</td><td><Progress percent={s.percent} label={`${s.done}/${s.total}`} /></td><td><span className={statusBadge(s.status)}>{s.status}</span></td><td>{s.missing}</td><td>{p.noiLuuHoSoGiay}</td></tr>)}</tbody></table></div></div>
    <div className="grid gap-6 xl:grid-cols-2"><div className="card"><h2 className="card-title">Tổng hợp theo tỉnh/thành</h2><div className="mt-4 space-y-4">{provinceStats.map((x: any) => <div key={x.name} className="rounded-2xl bg-slate-50 p-4"><div className="mb-2 flex justify-between"><b>{x.name}</b><span className="text-sm text-slate-500">{x.full}/{x.total} đầy đủ · thiếu {x.missing}</span></div><Progress percent={x.avg} label={`${x.avg}% TB`} /></div>)}</div></div><div className="card"><h2 className="card-title">Danh sách cảnh báo chi tiết</h2><div className="mt-4 max-h-[32rem] overflow-auto"><table className="data-table"><thead><tr><th>Mức</th><th>Số HS</th><th>Mục</th><th>Trạng thái</th><th>Tỉnh</th></tr></thead><tbody>{filteredWarnings.map((w: any) => <tr key={w.id}><td><span className={w.mucDo === 'Cao' ? 'badge badge-red' : w.mucDo === 'Trung bình' ? 'badge badge-yellow' : 'badge badge-gray'}>{w.mucDo}</span></td><td className="font-black text-primary-700">{w.soHoSo}</td><td className="max-w-sm whitespace-normal">{w.stt}. {w.muc}</td><td>{w.trangThai}</td><td>{w.tinhThanh}</td></tr>)}</tbody></table></div></div></div>
  </div>;
}

function ImportPage({ projects, setProjects, mucLuc, setMucLuc, addLog }: any) {
  const [mode, setMode] = useState<'projects' | 'checklist'>('projects');
  const [projectId, setProjectId] = useState(projects[0]?.id || '');
  const [replaceChecklist, setReplaceChecklist] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [message, setMessage] = useState('');

  function downloadProjectTemplate() {
    const rows = [[
      'Số thứ tự', 'Tên công trình', 'Quốc lộ', 'Tỉnh/thành phố', 'Số HS', 'Kế hoạch vốn', 'Quyết định phê duyệt', 'Ngày quyết định',
      'Chi phí khảo sát', 'Chi phí thiết kế', 'Chi phí dự toán', 'Chủ trì khảo sát', 'Chủ nhiệm thiết kế', 'Chủ nhiệm dự toán', 'Nơi lưu hồ sơ giấy', 'Nơi lưu hồ sơ số', 'Ghi chú'
    ], ['9-2022', 'Tên công trình mẫu', 'QL1', 'Phú Yên', '17-2022', 'KH2022 BS', '1209/QĐ-CQLĐBIII', '08/11/2022', '95312000', '305159000', '0', 'Vũ', 'Huyền', 'Thoa', 'Tủ HS-2022 / Kệ B / Ngăn 17', '\\SERVER01\\ISO\\2022\\17-2022', '']];
    downloadBlob(new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' }), 'mau-import-ho-so-tong-quat.csv');
  }

  function downloadChecklistTemplate() {
    const rows = [['TT', 'Tên văn bản trong hồ sơ', 'Ký mã hiệu', 'Số quyển', 'Ngày cập nhật', 'Trạng thái', 'Tên file', 'Ghi chú', 'Bắt buộc'], ...defaultChecklist.map((name, idx) => [idx + 1, name, '', '', '', 'Chưa có', '', '', 'Có'])];
    downloadBlob(new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' }), 'mau-import-muc-luc-ho-so.csv');
  }

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setMessage('Đang đọc file...');
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' });
      runImport(rows);
    } catch (err) {
      console.error(err);
      setMessage('Không đọc được file. Nên dùng .xlsx hoặc .csv UTF-8. File Excel đang mở cũng nên đóng lại rồi thử lại.');
    } finally {
      e.target.value = '';
    }
  }

  function handlePasteImport() {
    if (!pasteText.trim()) return alert('Dán dữ liệu bảng Excel/CSV vào ô trước đã nhé.');
    const rows = parsePastedTable(pasteText);
    runImport(rows);
  }

  function runImport(rows: Record<string, any>[]) {
    if (!rows.length) return setMessage('File không có dòng dữ liệu nào.');
    if (mode === 'projects') importProjects(rows);
    else importChecklist(rows);
  }

  function importProjects(rows: Record<string, any>[]) {
    const imported: HoSoTong[] = rows.map((r, index) => {
      const tenCongTrinh = pick(r, ['Tên công trình', 'Ten cong trinh', 'Công trình', 'Cong trinh']);
      const soHoSo = pick(r, ['Số HS', 'So HS', 'Số hồ sơ', 'So ho so']);
      if (!tenCongTrinh && !soHoSo) return null;
      return {
        id: createId('hs'),
        soThuTu: pick(r, ['Số thứ tự', 'So thu tu', 'STT']) || String(index + 1),
        tenCongTrinh,
        quocLo: pick(r, ['Quốc lộ', 'Quoc lo', 'QL']),
        tinhThanh: pick(r, ['Tỉnh/thành phố', 'Tinh/thanh pho', 'Tỉnh', 'Tinh', 'Tỉnh/TP', 'Tinh/TP']),
        soHoSo,
        keHoachVon: pick(r, ['Kế hoạch vốn', 'Ke hoach von']),
        quyetDinhPheDuyet: pick(r, ['Quyết định phê duyệt', 'Quyet dinh phe duyet', 'QĐ phê duyệt', 'QD phe duyet']),
        ngayQuyetDinh: parseDateInput(pickRaw(r, ['Ngày quyết định', 'Ngay quyet dinh', 'Ngày QĐ', 'Ngay QD'])),
        chiPhiKhaoSat: parseMoney(pick(r, ['Chi phí khảo sát', 'Chi phi khao sat', 'Khảo sát', 'Khao sat'])),
        chiPhiThietKe: parseMoney(pick(r, ['Chi phí thiết kế', 'Chi phi thiet ke', 'Thiết kế', 'Thiet ke'])),
        chiPhiDuToan: parseMoney(pick(r, ['Chi phí dự toán', 'Chi phi du toan', 'Dự toán', 'Du toan'])),
        chuTriKhaoSat: pick(r, ['Chủ trì khảo sát', 'Chu tri khao sat', 'Chủ trì', 'Chu tri']),
        chuNhiemThietKe: pick(r, ['Chủ nhiệm thiết kế', 'Chu nhiem thiet ke', 'Chủ nhiệm', 'Chu nhiem']),
        chuNhiemDuToan: pick(r, ['Chủ nhiệm dự toán', 'Chu nhiem du toan']),
        noiLuuHoSoGiay: pick(r, ['Nơi lưu hồ sơ giấy', 'Noi luu ho so giay', 'Hồ sơ giấy', 'Ho so giay']),
        noiLuuHoSoSo: pick(r, ['Nơi lưu hồ sơ số', 'Noi luu ho so so', 'Hồ sơ số', 'Ho so so', 'Đường dẫn', 'Duong dan']),
        ghiChu: pick(r, ['Ghi chú', 'Ghi chu']),
        createdAt: now(),
        updatedAt: now(),
      } as HoSoTong;
    }).filter(Boolean) as HoSoTong[];

    if (!imported.length) return setMessage('Không tìm thấy dòng hồ sơ hợp lệ. Kiểm tra cột “Tên công trình” hoặc “Số HS”.');
    setProjects((prev: HoSoTong[]) => [...imported, ...prev]);
    const generatedChecklist = imported.flatMap(p => defaultChecklist.map((name, idx) => ({ ...emptyMucLuc, id: createId('ml'), hoSoId: p.id, stt: idx + 1, tenVanBan: name, trangThai: 'Chưa có' as FileStatus, ngayCapNhat: '' })));
    setMucLuc((prev: MucLucItem[]) => [...generatedChecklist, ...prev]);
    addLog(`Import ${imported.length} hồ sơ tổng quát từ Excel/CSV`);
    setMessage(`Đã import ${imported.length} hồ sơ tổng quát. Hệ thống đã tự sinh mục lục mặc định cho từng hồ sơ.`);
  }

  function importChecklist(rows: Record<string, any>[]) {
    if (!projectId) return setMessage('Chọn hồ sơ tổng quát cần nhập mục lục trước đã.');
    const imported: MucLucItem[] = rows.map((r, index) => {
      const tenVanBan = pick(r, ['Tên văn bản trong hồ sơ', 'Ten van ban trong ho so', 'Tên văn bản', 'Ten van ban', 'Nội dung', 'Noi dung']);
      if (!tenVanBan) return null;
      return {
        id: createId('ml'),
        hoSoId: projectId,
        stt: Number(pick(r, ['TT', 'STT', 'Số thứ tự', 'So thu tu'])) || index + 1,
        tenVanBan,
        kyMaHieu: pick(r, ['Ký mã hiệu', 'Ky ma hieu', 'Mã hiệu', 'Ma hieu']),
        soQuyen: pick(r, ['Số quyển', 'So quyen']),
        ngayCapNhat: parseDateInput(pickRaw(r, ['Ngày cập nhật', 'Ngay cap nhat', 'Ngày', 'Ngay'])),
        ghiChu: pick(r, ['Ghi chú', 'Ghi chu']),
        batBuoc: !['không', 'khong', 'no', 'false', '0'].includes(normalizeText(pick(r, ['Bắt buộc', 'Bat buoc', 'Required']))),
        trangThai: normalizeStatus(pick(r, ['Trạng thái', 'Trang thai', 'Tình trạng', 'Tinh trang'])),
        tenFile: pick(r, ['Tên file', 'Ten file', 'File', 'Đường dẫn file', 'Duong dan file']),
      } as MucLucItem;
    }).filter(Boolean) as MucLucItem[];

    if (!imported.length) return setMessage('Không tìm thấy dòng mục lục hợp lệ. Kiểm tra cột “Tên văn bản trong hồ sơ”.');
    setMucLuc((prev: MucLucItem[]) => replaceChecklist ? [...prev.filter(i => i.hoSoId !== projectId), ...imported] : [...prev, ...imported]);
    const p = projects.find((x: HoSoTong) => x.id === projectId);
    addLog(`Import ${imported.length} mục lục cho hồ sơ ${p?.soHoSo || projectId}`);
    setMessage(`Đã import ${imported.length} mục lục cho hồ sơ ${p?.soHoSo || ''}.`);
  }

  return <div className="space-y-6">
    <div className="card">
      <div className="card-header"><div><h2 className="card-title">Nhập dữ liệu từ Excel / CSV</h2><p className="card-subtitle">Hỗ trợ file .xlsx, .xls, .csv. Với bảng trong Word, copy bảng rồi dán vào ô bên dưới để nhập nhanh. Không cần đúng 100% tên cột, hệ thống có nhận diện một số tên cột phổ biến.</p></div></div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
          <div className="mb-2 flex items-center gap-2 text-sm font-black text-slate-700"><FileSpreadsheet className="h-5 w-5 text-primary-700" /> Kiểu dữ liệu nhập</div>
          <select className="select-field" value={mode} onChange={e => setMode(e.target.value as any)}>
            <option value="projects">Hồ sơ tổng quát / bảng công trình</option>
            <option value="checklist">Mục lục hồ sơ con</option>
          </select>
        </label>
        {mode === 'checklist' && <label className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
          <div className="mb-2 text-sm font-black text-slate-700">Hồ sơ nhận mục lục</div>
          <select className="select-field" value={projectId} onChange={e => setProjectId(e.target.value)}>
            {projects.map((p: HoSoTong) => <option key={p.id} value={p.id}>{p.soHoSo || 'Chưa có số'} - {p.tenCongTrinh.slice(0, 80)}</option>)}
          </select>
          <label className="mt-3 flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={replaceChecklist} onChange={e => setReplaceChecklist(e.target.checked)} /> Xoá mục lục cũ của hồ sơ này trước khi nhập</label>
        </label>}
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <label className="btn-primary cursor-pointer"><Upload className="h-4 w-4" /> Chọn file Excel/CSV<input type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={handleFile} /></label>
        <button className="btn-secondary" onClick={downloadProjectTemplate}><Download className="h-4 w-4" /> Mẫu hồ sơ tổng</button>
        <button className="btn-secondary" onClick={downloadChecklistTemplate}><Download className="h-4 w-4" /> Mẫu mục lục</button>
      </div>
      {message && <div className="mt-4 rounded-2xl border border-primary-100 bg-primary-50 p-4 text-sm font-bold text-primary-800">{message}</div>}
    </div>

    <div className="card">
      <div className="card-header"><div><h2 className="card-title">Dán dữ liệu từ Excel/Word</h2><p className="card-subtitle">Copy vùng bảng trong Excel hoặc bảng mục lục trong Word, dán vào đây rồi bấm nhập. Cách này rất hợp khi file Word có bảng mục lục như ảnh bạn gửi.</p></div></div>
      <textarea className="input-field min-h-52 font-mono text-xs" value={pasteText} onChange={e => setPasteText(e.target.value)} placeholder={'Ví dụ:\nTT\tTên văn bản trong hồ sơ\tKý mã hiệu\tSố quyển\tNgày cập nhật\tGhi chú\n1\tPhiếu phân công nhiệm vụ\t...'} />
      <div className="mt-4 flex flex-wrap gap-2"><button className="btn-primary" onClick={handlePasteImport}><Copy className="h-4 w-4" /> Nhập dữ liệu đã dán</button><button className="btn-secondary" onClick={() => setPasteText('')}>Xoá nội dung dán</button></div>
    </div>

    <div className="card">
      <h2 className="card-title">Quy ước cột nên dùng</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="rounded-3xl bg-slate-50 p-5"><h3 className="font-black">Hồ sơ tổng quát</h3><p className="mt-2 text-sm leading-6 text-slate-600">Số thứ tự, Tên công trình, Quốc lộ, Tỉnh/thành phố, Số HS, Kế hoạch vốn, Quyết định phê duyệt, Ngày quyết định, Chi phí khảo sát, Chi phí thiết kế, Chi phí dự toán, Chủ trì khảo sát, Chủ nhiệm thiết kế, Chủ nhiệm dự toán, Nơi lưu hồ sơ giấy, Nơi lưu hồ sơ số, Ghi chú.</p></div>
        <div className="rounded-3xl bg-slate-50 p-5"><h3 className="font-black">Mục lục hồ sơ con</h3><p className="mt-2 text-sm leading-6 text-slate-600">TT, Tên văn bản trong hồ sơ, Ký mã hiệu, Số quyển, Ngày cập nhật, Trạng thái, Tên file, Ghi chú, Bắt buộc. Trạng thái hợp lệ: Đã có, Chưa có, Thiếu bản ký, Thiếu scan, Cần cập nhật.</p></div>
      </div>
    </div>
  </div>;
}

function normalizeText(value: any) {
  return String(value ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, ' ').trim();
}
function pickRaw(row: Record<string, any>, aliases: string[]) {
  const map = new Map(Object.keys(row).map(k => [normalizeText(k), k]));
  for (const alias of aliases) {
    const key = map.get(normalizeText(alias));
    if (key !== undefined) return row[key];
  }
  return '';
}
function pick(row: Record<string, any>, aliases: string[]) { return String(pickRaw(row, aliases) ?? '').trim(); }
function parseMoney(value: any) {
  const text = String(value ?? '').replace(/[^0-9.-]/g, '');
  return Number(text) || 0;
}
function parseDateInput(value: any) {
  if (!value) return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
  }
  const text = String(value).trim();
  const m = text.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);
  if (m) return `${m[3].length === 2 ? '20' + m[3] : m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  const d = new Date(text);
  return Number.isNaN(d.getTime()) ? text : d.toISOString().slice(0, 10);
}
function normalizeStatus(value: any): FileStatus {
  const t = normalizeText(value);
  if (!t) return 'Chưa có';
  if (t.includes('da co') || t.includes('du')) return 'Đã có';
  if (t.includes('ky')) return 'Thiếu bản ký';
  if (t.includes('scan')) return 'Thiếu scan';
  if (t.includes('cap nhat')) return 'Cần cập nhật';
  return 'Chưa có';
}
function parsePastedTable(text: string) {
  const lines = text.split(/\r?\n/).filter(x => x.trim());
  if (!lines.length) return [];
  const delimiter = lines[0].includes('\t') ? '\t' : (lines[0].includes(';') ? ';' : ',');
  const headers = lines[0].split(delimiter).map(x => x.trim());
  return lines.slice(1).map(line => {
    const cells = line.split(delimiter);
    return Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? '']));
  });
}


function FormLinksPage({ projects, mucLuc, setMucLuc, forms, folders, addLog }: any) {
  const [projectId, setProjectId] = useState(projects[0]?.id || '');
  const [query, setQuery] = useState('');
  const project = projects.find((p: HoSoTong) => p.id === projectId);
  const items = mucLuc
    .filter((i: MucLucItem) => i.hoSoId === projectId)
    .filter((i: MucLucItem) => !query.trim() || [i.tenVanBan, i.kyMaHieu, i.ghiChu].join(' ').toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a: MucLucItem, b: MucLucItem) => a.stt - b.stt);
  const linked = mucLuc.filter((i: MucLucItem) => i.bieuMauId).length;
  const orphan = mucLuc.filter((i: MucLucItem) => i.batBuoc && !i.bieuMauId).length;
  function linkItem(itemId: string, bieuMauId: string) {
    setMucLuc((prev: MucLucItem[]) => prev.map(i => i.id === itemId ? { ...i, bieuMauId, ngayCapNhat: today() } : i));
    const bm = forms.find((x: BieuMauIso) => x.id === bieuMauId);
    addLog(`Liên kết mục hồ sơ với biểu mẫu ISO${bm ? ': ' + bm.maBieuMau : ''}`);
  }
  function autoSuggest() {
    const mapByText = (name: string) => {
      const t = name.toLowerCase();
      if (t.includes('thiết bị') || t.includes('bảo trì') || t.includes('hiệu chuẩn')) return forms.find((x: BieuMauIso) => x.maBieuMau.includes('TB'))?.id || '';
      if (t.includes('phân công') || t.includes('kiểm soát') || t.includes('tài liệu')) return forms.find((x: BieuMauIso) => x.maBieuMau.includes('ISO'))?.id || '';
      if (t.includes('mục lục') || t.includes('hồ sơ') || t.includes('hợp đồng') || t.includes('quyết định')) return forms.find((x: BieuMauIso) => x.maBieuMau.includes('HS') || x.maBieuMau.includes('HSNB'))?.id || '';
      return '';
    };
    setMucLuc((prev: MucLucItem[]) => prev.map(i => i.hoSoId === projectId && !i.bieuMauId ? { ...i, bieuMauId: mapByText(i.tenVanBan) } : i));
    addLog('Tự gợi ý liên kết biểu mẫu ISO cho mục lục hồ sơ');
  }
  return <div className="space-y-6">
    <div className="grid gap-4 md:grid-cols-3">
      <StatCard icon={FileCheck2} label="Đã liên kết" value={linked} hint="Mục hồ sơ có biểu mẫu ISO gốc" />
      <StatCard icon={AlertTriangle} label="Chưa liên kết" value={orphan} hint="Mục bắt buộc chưa có biểu mẫu" />
      <StatCard icon={ClipboardList} label="Biểu mẫu" value={forms.length} hint="Đang quản lý trong lưu trữ ISO" />
    </div>
    <div className="card">
      <div className="card-header"><div><h2 className="card-title">Liên kết biểu mẫu ISO với hồ sơ phát sinh</h2><p className="card-subtitle">Luồng chuẩn: folder ISO → biểu mẫu → hồ sơ/mục lục phát sinh. Nhìn vào một mục hồ sơ là biết nó được lập theo biểu mẫu nào, mã nào, phiên bản nào. Audit thích điều này.</p></div><button className="btn-secondary" onClick={autoSuggest}><RefreshCcw className="h-4 w-4" /> Gợi ý tự động</button></div>
      <div className="mb-4 grid gap-3 md:grid-cols-3"><select className="select-field md:col-span-2" value={projectId} onChange={e => setProjectId(e.target.value)}>{projects.map((p: HoSoTong) => <option key={p.id} value={p.id}>{p.soHoSo} - {p.tenCongTrinh}</option>)}</select><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input className="input-field pl-9" placeholder="Tìm mục hồ sơ..." value={query} onChange={e => setQuery(e.target.value)} /></div></div>
      {project && <div className="mb-4 rounded-2xl bg-primary-50 p-4 text-sm text-primary-900"><b>Hồ sơ đang xử lý:</b> {project.soHoSo} · {project.tinhThanh} · {project.noiLuuHoSoGiay}</div>}
      <div className="overflow-auto"><table className="data-table"><thead><tr><th>TT</th><th>Mục hồ sơ</th><th>Trạng thái</th><th>Biểu mẫu đang liên kết</th><th>Chọn biểu mẫu ISO</th></tr></thead><tbody>{items.map((i: MucLucItem) => { const bm = forms.find((x: BieuMauIso) => x.id === i.bieuMauId); return <tr key={i.id}><td className="font-black">{i.stt}</td><td className="max-w-xl whitespace-normal"><div className="font-bold text-slate-800">{i.tenVanBan}</div><div className="text-xs text-slate-500">Ký mã hiệu: {i.kyMaHieu || '-'} · {i.batBuoc ? 'Bắt buộc' : 'Không bắt buộc'}</div></td><td><span className={statusBadge(i.trangThai)}>{i.trangThai}</span></td><td className="min-w-72 whitespace-normal">{bm ? <div><div className="font-black text-primary-700">{fullFormCode(bm, folders)}</div><div className="text-xs text-slate-500">{bm.tenBieuMau} · phiên bản {bm.phienBan} · ban hành {dateVN(bm.ngayBanHanh)}</div></div> : <span className="badge badge-red">Chưa liên kết</span>}</td><td><select className="select-field min-w-80" value={i.bieuMauId || ''} onChange={e => linkItem(i.id, e.target.value)}><option value="">Không liên kết</option>{forms.map((f: BieuMauIso) => <option key={f.id} value={f.id}>{fullFormCode(f, folders)} - {f.tenBieuMau}</option>)}</select></td></tr>})}</tbody></table></div>
    </div>
  </div>;
}


function approvalBadge(status: ApprovalStatus) {
  if (status === 'Đã ban hành') return 'badge badge-green';
  if (status === 'Chờ kiểm tra' || status === 'Chờ duyệt') return 'badge badge-yellow';
  if (status === 'Từ chối' || status === 'Hết hiệu lực') return 'badge badge-red';
  return 'badge';
}

function nextApprovalStatus(status: ApprovalStatus): ApprovalStatus {
  if (status === 'Nháp') return 'Chờ kiểm tra';
  if (status === 'Chờ kiểm tra') return 'Chờ duyệt';
  if (status === 'Chờ duyệt') return 'Đã ban hành';
  return status;
}

function ApprovalsPage({ approvals, setApprovals, projects, forms, folders, addLog }: any) {
  const [targetType, setTargetType] = useState<ApprovalTargetType>('Hồ sơ');
  const [targetId, setTargetId] = useState(projects[0]?.id || '');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('Tất cả');
  const source = targetType === 'Hồ sơ' ? projects : forms;
  useEffect(() => { setTargetId((targetType === 'Hồ sơ' ? projects[0]?.id : forms[0]?.id) || ''); }, [targetType, projects, forms]);
  const stats = {
    total: approvals.length,
    draft: approvals.filter((x: ApprovalFlow) => x.trangThai === 'Nháp').length,
    waiting: approvals.filter((x: ApprovalFlow) => x.trangThai === 'Chờ kiểm tra' || x.trangThai === 'Chờ duyệt').length,
    issued: approvals.filter((x: ApprovalFlow) => x.trangThai === 'Đã ban hành').length,
  };
  const rows = approvals.filter((x: ApprovalFlow) => (status === 'Tất cả' || x.trangThai === status) && (!query.trim() || [x.maDoiTuong, x.tenDoiTuong, x.nguoiLap, x.nguoiKiemTra, x.nguoiDuyet, x.ghiChu].join(' ').toLowerCase().includes(query.toLowerCase())));
  function createApproval() {
    const item = source.find((x: any) => x.id === targetId);
    if (!item) return alert('Chọn đối tượng cần đưa vào quy trình duyệt trước đã.');
    const ma = targetType === 'Hồ sơ' ? `HS ${item.soHoSo || item.soThuTu || item.id}` : fullFormCode(item, folders);
    const ten = targetType === 'Hồ sơ' ? item.tenCongTrinh : item.tenBieuMau;
    const existed = approvals.some((x: ApprovalFlow) => x.targetType === targetType && x.targetId === targetId && x.trangThai !== 'Hết hiệu lực');
    if (existed && !confirm('Đối tượng này đang có luồng duyệt còn hiệu lực. Vẫn tạo thêm phiên bản/luồng mới?')) return;
    const newItem: ApprovalFlow = { id: createId('pd'), targetType, targetId, maDoiTuong: ma, tenDoiTuong: ten, phienBan: targetType === 'Biểu mẫu' ? item.phienBan || '01' : '01', trangThai: 'Nháp', nguoiLap: 'Người lập', nguoiKiemTra: '', nguoiDuyet: '', ngayTao: today(), ngayCapNhat: today(), ngayBanHanh: '', lyDoTuChoi: '', ghiChu: 'Luồng duyệt mới' };
    setApprovals((prev: ApprovalFlow[]) => [newItem, ...prev]);
    addLog(`Tạo luồng duyệt ${targetType.toLowerCase()}: ${ma}`);
  }
  function updateStatus(item: ApprovalFlow, action: 'next' | 'reject' | 'expire' | 'draft') {
    let next = item.trangThai;
    let extra: Partial<ApprovalFlow> = {};
    if (action === 'next') {
      next = nextApprovalStatus(item.trangThai);
      if (next === 'Chờ kiểm tra') extra = { nguoiKiemTra: item.nguoiKiemTra || 'Phụ trách ISO' };
      if (next === 'Chờ duyệt') extra = { nguoiKiemTra: item.nguoiKiemTra || 'Phụ trách ISO', nguoiDuyet: item.nguoiDuyet || 'Lãnh đạo phòng' };
      if (next === 'Đã ban hành') extra = { nguoiDuyet: item.nguoiDuyet || 'Lãnh đạo phòng', ngayBanHanh: today(), lyDoTuChoi: '' };
    }
    if (action === 'reject') {
      const reason = prompt('Nhập lý do từ chối:', item.lyDoTuChoi || 'Thiếu file hoặc thiếu thông tin bắt buộc') || '';
      next = 'Từ chối'; extra = { lyDoTuChoi: reason };
    }
    if (action === 'expire') { next = 'Hết hiệu lực'; extra = { ghiChu: item.ghiChu ? `${item.ghiChu} / Đã đánh dấu hết hiệu lực` : 'Đã đánh dấu hết hiệu lực' }; }
    if (action === 'draft') { next = 'Nháp'; extra = { lyDoTuChoi: '' }; }
    setApprovals((prev: ApprovalFlow[]) => prev.map(x => x.id === item.id ? { ...x, ...extra, trangThai: next, ngayCapNhat: today() } : x));
    addLog(`Cập nhật quy trình duyệt: ${item.maDoiTuong} → ${next}`);
  }
  function removeFlow(id: string) {
    if (!confirm('Xoá luồng duyệt này?')) return;
    setApprovals((prev: ApprovalFlow[]) => prev.filter(x => x.id !== id));
    addLog('Xoá một luồng duyệt hồ sơ/biểu mẫu');
  }
  return <div className="space-y-6">
    <div className="grid gap-4 md:grid-cols-4">
      <StatCard title="Tổng luồng" value={stats.total} note="Hồ sơ + biểu mẫu" icon={<ClipboardList />} />
      <StatCard title="Nháp" value={stats.draft} note="Chưa gửi kiểm tra" icon={<FileText />} />
      <StatCard title="Đang chờ" value={stats.waiting} note="Chờ kiểm tra/duyệt" icon={<Clock />} />
      <StatCard title="Đã ban hành" value={stats.issued} note="Đang có hiệu lực" icon={<CheckCircle2 />} />
    </div>
    <div className="card">
      <div className="card-header"><div><h2 className="card-title">Tạo luồng duyệt mới</h2><p className="card-subtitle">Quy trình: Nháp → Chờ kiểm tra → Chờ duyệt → Đã ban hành. Có thể từ chối hoặc đánh dấu hết hiệu lực.</p></div><button className="btn-primary" onClick={createApproval}><Plus className="h-4 w-4" /> Tạo luồng</button></div>
      <div className="form-grid mt-4"><label className="text-sm font-bold text-slate-600">Loại đối tượng<select className="select-field mt-1" value={targetType} onChange={e => setTargetType(e.target.value as ApprovalTargetType)}><option>Hồ sơ</option><option>Biểu mẫu</option></select></label><label className="text-sm font-bold text-slate-600">Đối tượng<select className="select-field mt-1" value={targetId} onChange={e => setTargetId(e.target.value)}>{source.map((x: any) => <option key={x.id} value={x.id}>{targetType === 'Hồ sơ' ? `${x.soHoSo || x.soThuTu} - ${x.tenCongTrinh}` : `${fullFormCode(x, folders)} - ${x.tenBieuMau}`}</option>)}</select></label></div>
    </div>
    <div className="card">
      <div className="card-header"><div><h2 className="card-title">Danh sách duyệt</h2><p className="card-subtitle">Theo dõi ai lập, ai kiểm tra, ai duyệt, ngày ban hành và trạng thái hiệu lực.</p></div><div className="flex flex-wrap gap-2"><input className="input-field w-64" placeholder="Tìm mã/tên/người xử lý..." value={query} onChange={e => setQuery(e.target.value)} /><select className="select-field" value={status} onChange={e => setStatus(e.target.value)}>{['Tất cả', 'Nháp', 'Chờ kiểm tra', 'Chờ duyệt', 'Đã ban hành', 'Từ chối', 'Hết hiệu lực'].map(x => <option key={x}>{x}</option>)}</select></div></div>
      <div className="overflow-auto"><table className="data-table"><thead><tr><th>Loại</th><th>Mã/Tên</th><th>Phiên bản</th><th>Trạng thái</th><th>Người lập</th><th>Kiểm tra</th><th>Duyệt</th><th>Ngày ban hành</th><th>Lý do/Ghi chú</th><th>Thao tác</th></tr></thead><tbody>{rows.map((x: ApprovalFlow) => <tr key={x.id}><td><span className="badge">{x.targetType}</span></td><td className="min-w-96 whitespace-normal"><div className="font-black text-primary-700">{x.maDoiTuong}</div><div className="text-sm font-semibold text-slate-700">{x.tenDoiTuong}</div></td><td>{x.phienBan}</td><td><span className={approvalBadge(x.trangThai)}>{x.trangThai}</span></td><td>{x.nguoiLap}<div className="text-xs text-slate-400">{dateVN(x.ngayTao)}</div></td><td>{x.nguoiKiemTra || '-'}</td><td>{x.nguoiDuyet || '-'}</td><td>{dateVN(x.ngayBanHanh)}</td><td className="max-w-xs whitespace-normal">{x.lyDoTuChoi ? <span className="text-red-600">{x.lyDoTuChoi}</span> : x.ghiChu || '-'}</td><td><div className="flex flex-wrap gap-2"><button className="btn-secondary py-2" disabled={x.trangThai === 'Đã ban hành' || x.trangThai === 'Hết hiệu lực'} onClick={() => updateStatus(x, 'next')}>{x.trangThai === 'Nháp' ? 'Gửi kiểm tra' : x.trangThai === 'Chờ kiểm tra' ? 'Chuyển duyệt' : x.trangThai === 'Chờ duyệt' ? 'Ban hành' : 'Đã xong'}</button><button className="btn-secondary py-2" onClick={() => updateStatus(x, 'draft')}>Về nháp</button><button className="btn-danger py-2" onClick={() => updateStatus(x, 'reject')}>Từ chối</button><button className="btn-danger py-2" onClick={() => updateStatus(x, 'expire')}>Hết hiệu lực</button><button className="icon-btn-danger" onClick={() => removeFlow(x.id)}><Trash2 className="h-4 w-4" /></button></div></td></tr>)}</tbody></table></div>
    </div>
  </div>;
}

function SettingsPage({ logs, onReset }: any) { return <div className="space-y-6"><div className="card"><h2 className="card-title">Cài đặt dữ liệu demo</h2><p className="card-subtitle">Dữ liệu hiện lưu bằng localStorage để test nhanh giao diện Phase 1.10.1.</p><button className="btn-danger mt-4" onClick={onReset}><RefreshCcw className="h-4 w-4" /> Khôi phục dữ liệu mẫu</button></div><div className="card"><h2 className="card-title">Nhật ký thao tác</h2><div className="mt-4 space-y-3">{logs.map((l: AuditLog) => <div key={l.id} className="rounded-2xl bg-slate-50 p-4 text-sm"><b>{dateVN(l.time)}</b> - {l.action}</div>)}</div></div></div>; }

function ProjectModal({ form, setForm, onClose, onSubmit }: any) { return <Modal title={form.id ? 'Sửa hồ sơ tổng quát' : 'Thêm hồ sơ tổng quát'} onClose={onClose}><form onSubmit={onSubmit} className="space-y-4"><div className="form-grid"><Input label="Số thứ tự" value={form.soThuTu} onChange={(v: string) => setForm({ ...form, soThuTu: v })} /><Input label="Số hồ sơ" value={form.soHoSo} onChange={(v: string) => setForm({ ...form, soHoSo: v })} /><Input label="Quốc lộ" value={form.quocLo} onChange={(v: string) => setForm({ ...form, quocLo: v })} /><Input label="Tỉnh/thành phố" value={form.tinhThanh} onChange={(v: string) => setForm({ ...form, tinhThanh: v })} /></div><Input label="Tên công trình" value={form.tenCongTrinh} onChange={(v: string) => setForm({ ...form, tenCongTrinh: v })} /><div className="form-grid"><Input label="Kế hoạch vốn" value={form.keHoachVon} onChange={(v: string) => setForm({ ...form, keHoachVon: v })} /><Input label="Quyết định phê duyệt" value={form.quyetDinhPheDuyet} onChange={(v: string) => setForm({ ...form, quyetDinhPheDuyet: v })} /><Input label="Ngày quyết định" type="date" value={form.ngayQuyetDinh} onChange={(v: string) => setForm({ ...form, ngayQuyetDinh: v })} /><Input label="Chủ trì khảo sát" value={form.chuTriKhaoSat} onChange={(v: string) => setForm({ ...form, chuTriKhaoSat: v })} /><Input label="Chủ nhiệm thiết kế" value={form.chuNhiemThietKe} onChange={(v: string) => setForm({ ...form, chuNhiemThietKe: v })} /><Input label="Chủ nhiệm dự toán" value={form.chuNhiemDuToan} onChange={(v: string) => setForm({ ...form, chuNhiemDuToan: v })} /><Input label="Chi phí khảo sát" type="number" value={form.chiPhiKhaoSat} onChange={(v: string) => setForm({ ...form, chiPhiKhaoSat: Number(v) })} /><Input label="Chi phí thiết kế" type="number" value={form.chiPhiThietKe} onChange={(v: string) => setForm({ ...form, chiPhiThietKe: Number(v) })} /><Input label="Chi phí dự toán" type="number" value={form.chiPhiDuToan} onChange={(v: string) => setForm({ ...form, chiPhiDuToan: Number(v) })} /></div><Input label="Nơi lưu hồ sơ giấy" value={form.noiLuuHoSoGiay} onChange={(v: string) => setForm({ ...form, noiLuuHoSoGiay: v })} /><Input label="Nơi lưu hồ sơ số" value={form.noiLuuHoSoSo} onChange={(v: string) => setForm({ ...form, noiLuuHoSoSo: v })} /><Input label="Ghi chú" value={form.ghiChu} onChange={(v: string) => setForm({ ...form, ghiChu: v })} /><div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={onClose}>Huỷ</button><button className="btn-primary">Lưu</button></div></form></Modal>; }
function ItemModal({ form, setForm, forms = [], folders = [], onClose, onSubmit }: any) { const statuses: FileStatus[] = ['Đã có', 'Chưa có', 'Thiếu bản ký', 'Thiếu scan', 'Cần cập nhật']; return <Modal title={form.id ? 'Sửa mục lục hồ sơ' : 'Thêm mục lục hồ sơ'} onClose={onClose}><form onSubmit={onSubmit} className="space-y-4"><div className="form-grid"><Input label="TT" type="number" value={form.stt} onChange={(v: string) => setForm({ ...form, stt: Number(v) })} /><label className="text-sm font-bold text-slate-600">Trạng thái<select className="select-field mt-1" value={form.trangThai} onChange={e => setForm({ ...form, trangThai: e.target.value as FileStatus })}>{statuses.map(s => <option key={s}>{s}</option>)}</select></label></div><Input label="Tên văn bản trong hồ sơ" value={form.tenVanBan} onChange={(v: string) => setForm({ ...form, tenVanBan: v })} /><label className="text-sm font-bold text-slate-600">Biểu mẫu ISO áp dụng<select className="select-field mt-1" value={form.bieuMauId || ''} onChange={e => setForm({ ...form, bieuMauId: e.target.value })}><option value="">Không liên kết</option>{forms.map((bm: BieuMauIso) => <option key={bm.id} value={bm.id}>{fullFormCode(bm, folders)} - {bm.tenBieuMau} / v{bm.phienBan}</option>)}</select></label><div className="form-grid"><Input label="Ký mã hiệu" value={form.kyMaHieu} onChange={(v: string) => setForm({ ...form, kyMaHieu: v })} /><Input label="Số quyển" value={form.soQuyen} onChange={(v: string) => setForm({ ...form, soQuyen: v })} /><Input label="Ngày cập nhật" type="date" value={form.ngayCapNhat} onChange={(v: string) => setForm({ ...form, ngayCapNhat: v })} /><Input label="Tên file / đường dẫn file" value={form.tenFile || ''} onChange={(v: string) => setForm({ ...form, tenFile: v })} /></div><label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={form.batBuoc} onChange={e => setForm({ ...form, batBuoc: e.target.checked })} /> Mục bắt buộc</label><Input label="Ghi chú" value={form.ghiChu} onChange={(v: string) => setForm({ ...form, ghiChu: v })} /><div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={onClose}>Huỷ</button><button className="btn-primary">Lưu</button></div></form></Modal>; }

function FolderModal({ form, setForm, folders, onClose, onSubmit }: any) { return <Modal title={form.id ? 'Sửa / đổi tên folder ISO' : 'Thêm folder ISO'} onClose={onClose}><form onSubmit={onSubmit} className="space-y-4"><div className="form-grid"><Input label="Tên folder" value={form.tenFolder} onChange={(v: string) => setForm({ ...form, tenFolder: v })} /><Input label="Mã folder" value={form.maFolder} onChange={(v: string) => setForm({ ...form, maFolder: v })} /></div><label className="text-sm font-bold text-slate-600">Folder cha<select className="select-field mt-1" value={form.parentId} onChange={e => setForm({ ...form, parentId: e.target.value })}><option value="">Không có / folder gốc</option>{folders.filter((f: IsoFolder) => f.id !== form.id).map((f: IsoFolder) => <option key={f.id} value={f.id}>{folderPath(f.id, folders)}</option>)}</select></label><div className="form-grid"><Input label="Người quản lý" value={form.nguoiQuanLy} onChange={(v: string) => setForm({ ...form, nguoiQuanLy: v })} /><Input label="Đường dẫn lưu trữ" value={form.duongDanLuu} onChange={(v: string) => setForm({ ...form, duongDanLuu: v })} /></div><Input label="Mô tả" value={form.moTa} onChange={(v: string) => setForm({ ...form, moTa: v })} /><div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={onClose}>Huỷ</button><button className="btn-primary">Lưu folder</button></div></form></Modal>; }
function BieuMauModal({ form, setForm, folders, onClose, onSubmit }: any) { return <Modal title={form.id ? 'Sửa biểu mẫu ISO' : 'Thêm biểu mẫu vào folder'} onClose={onClose}><form onSubmit={onSubmit} className="space-y-4"><label className="text-sm font-bold text-slate-600">Folder lưu biểu mẫu<select className="select-field mt-1" value={form.folderId} onChange={e => setForm({ ...form, folderId: e.target.value })}>{folders.map((f: IsoFolder) => <option key={f.id} value={f.id}>{folderPath(f.id, folders)}</option>)}</select></label><div className="form-grid"><Input label="Mã biểu mẫu" value={form.maBieuMau} onChange={(v: string) => setForm({ ...form, maBieuMau: v })} /><Input label="Phiên bản" value={form.phienBan} onChange={(v: string) => setForm({ ...form, phienBan: v })} /><Input label="Ngày ban hành" type="date" value={form.ngayBanHanh} onChange={(v: string) => setForm({ ...form, ngayBanHanh: v })} /></div><Input label="Tên biểu mẫu" value={form.tenBieuMau} onChange={(v: string) => setForm({ ...form, tenBieuMau: v })} /><Input label="Tên file / đường dẫn file" value={form.fileName} onChange={(v: string) => setForm({ ...form, fileName: v })} /><Input label="Ghi chú" value={form.ghiChu} onChange={(v: string) => setForm({ ...form, ghiChu: v })} /><div className="rounded-2xl bg-primary-50 p-4 text-sm font-bold text-primary-800">Mã đầy đủ sẽ hiển thị dạng: {fullFormCode(form, folders)}</div><div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={onClose}>Huỷ</button><button className="btn-primary">Lưu biểu mẫu</button></div></form></Modal>; }
function Modal({ title, children, onClose }: any) { return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"><div className="max-h-[90vh] w-full max-w-4xl overflow-auto rounded-3xl bg-white p-6 shadow-2xl"><div className="mb-5 flex items-center justify-between"><h2 className="text-xl font-black">{title}</h2><button className="icon-btn" onClick={onClose}><X className="h-4 w-4" /></button></div>{children}</div></div>; }
function Input({ label, value, onChange, type = 'text' }: any) { return <label className="text-sm font-bold text-slate-600">{label}<input className="input-field mt-1" type={type} value={value ?? ''} onChange={e => onChange(e.target.value)} /></label>; }
function escapeHtml(value: any) { return String(value ?? '').replace(/[&<>\"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;' }[ch] || ch)); }
function toCsv(rows: any[][]) { return '\ufeff' + rows.map(r => r.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n'); }
function downloadBlob(blob: Blob, filename: string) { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url); }
