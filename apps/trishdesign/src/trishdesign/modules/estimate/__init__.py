"""Estimate — Dự toán công trình theo Thông tư 11/2021/TT-BXD.

Cấu trúc TT11:
    G_xd   = Chi phí xây dựng
           = Chi phí trực tiếp (T)
           + Chi phí gián tiếp (GT)       [= T × k_gt]
           + Thu nhập chịu thuế tính trước [= (T+GT) × k_tl]
           + Thuế GTGT                    [= (T+GT+TL) × 10%]
           + Chi phí nhà tạm              [nếu có, % riêng]

Trong đó T = Σ (Khối lượng × Đơn giá tổng hợp).
Đơn giá tổng hợp = VL + NC + MTC (vật liệu + nhân công + máy thi công).

Phase 1 (Sprint 8-9):
    - Schema DB: projects, work_items, unit_prices, norms, cost_summary
    - CRUD hạng mục, tính T và các hệ số
    - Export bảng tổng hợp Excel + Word

Phase 2 (Sprint 10+):
    - Bảng lương, vật tư, ca máy chi tiết
    - Định mức nhà nước tra từ thư viện admin upload
    - Tính bù giá vật liệu theo thời kỳ
"""
