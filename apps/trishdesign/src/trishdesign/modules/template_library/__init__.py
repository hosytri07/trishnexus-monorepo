"""Template Library — bảng tính kết cấu (Excel do admin upload).

User flow:
1. Admin upload .xlsx lên Firebase Storage vào path `structural_templates/{category}/`.
2. App gọi REST API liệt kê danh sách, hiển thị grid.
3. User click "Tải về" → lưu vào folder templates local, mở bằng Excel mặc định OS.
4. App track lịch sử tải, đánh dấu file đã sync vs chưa.

Kiến trúc:
- models.py: schema Template dataclass + SQLite migrations
- repository.py: tương tác Firebase Storage + local cache
- view.py: Qt UI (grid card + download button)
"""
