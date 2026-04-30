# Quản lý ISO nội bộ - Website Phase 1.10

Website React + TypeScript + Vite quản lý hồ sơ ISO, mục lục hồ sơ con, nơi lưu trữ, mượn/trả hồ sơ giấy và thiết bị nội bộ.

## Chạy dự án

```bash
npm install
npm run dev
```

Mở trình duyệt:

```text
http://localhost:3000
```

## Có gì trong Phase 1.10

- Dashboard tổng quan hồ sơ, cảnh báo, mượn/trả và thiết bị.
- Hồ sơ tổng quát / hồ sơ cha.
- Mục lục hồ sơ con / checklist đầy đủ-thiếu.
- File đính kèm dạng metadata để test giao diện.
- Import Excel/CSV cho hồ sơ và mục lục.
- Kho lưu trữ bản giấy/bản số.
- Mượn/trả hồ sơ giấy.
- Quản lý thiết bị nội bộ:
  - mã thiết bị
  - tên thiết bị
  - serial
  - nhóm thiết bị
  - phòng ban/vị trí
  - người quản lý
  - tình trạng sử dụng
  - lịch bảo trì
  - lịch hiệu chuẩn/kiểm định
  - file chứng nhận/biên bản
  - cảnh báo quá hạn/sắp đến hạn
- Backup JSON.

## Lưu ý

Phase 1 vẫn lưu dữ liệu bằng `localStorage` để test nhanh giao diện và nghiệp vụ. File đính kèm/chứng nhận hiện chỉ lưu metadata, chưa upload file thật lên server.

Sang Phase 2 nên làm backend/database thật: SQLite/PostgreSQL/Supabase/Firebase, upload file thật, login, phân quyền và audit log chuẩn.


## Phase 1.10

Bổ sung module Lưu trữ hồ sơ ISO: quản lý cây folder, thêm/sửa/xoá/đổi tên folder, gắn biểu mẫu vào folder, kết hợp mã folder với mã biểu mẫu và lưu metadata file biểu mẫu để test quy trình.
- Lưu trữ hồ sơ ISO theo cây folder.
- Quản lý biểu mẫu ISO trong từng folder.
- Liên kết biểu mẫu ISO với từng mục hồ sơ phát sinh.
- Hiển thị mã đầy đủ dạng `MÃ_FOLDER/MÃ_BIỂU_MẪU` trong mục lục hồ sơ.
- Trang riêng `Liên kết BM-HS` để rà soát mục nào chưa gắn biểu mẫu.

## Ghi chú Phase 1.10

Dữ liệu vẫn lưu bằng `localStorage` để test nhanh quy trình. File thật và phân quyền/backend sẽ xử lý ở Phase 2.


## Phase 1.10

Bổ sung module Quy trình duyệt hồ sơ/biểu mẫu: Nháp → Chờ kiểm tra → Chờ duyệt → Đã ban hành, có từ chối, hết hiệu lực, thống kê và nhật ký thao tác.
