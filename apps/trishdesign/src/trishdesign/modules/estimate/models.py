"""Models cho module Dự toán theo Thông tư 11/2021/TT-BXD.

Luồng dữ liệu:
    EstimateProject (1 công trình)
      └─ WorkItem[] (hạng mục: đào đất, bê tông B25, thép tròn...)
           ├─ unit_price_id → UnitPrice (đơn giá tổng hợp)
           └─ quantity (khối lượng user nhập)
      └─ CostSummary (tổng hợp các chi phí)
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional


# ---------- Đơn giá + định mức (admin upload, user read-only) ----------

@dataclass
class UnitPrice:
    """Đơn giá tổng hợp 1 mã công tác theo địa phương/thời kỳ."""
    code: str                  # "AB.11211" - mã hiệu công tác
    description: str           # "Đào móng bằng máy ≤ 0.4m³"
    unit: str                  # "m³", "tấn", "md"
    vl: float                  # Vật liệu (VND)
    nc: float                  # Nhân công (VND)
    mtc: float                 # Máy thi công (VND)
    locale: str = "default"    # "hanoi_2025", "tinh_binh_2025"...
    version: int = 1

    @property
    def total(self) -> float:
        return self.vl + self.nc + self.mtc


# ---------- Dự án + hạng mục ----------

@dataclass
class EstimateProject:
    id: str
    name: str
    location: str = ""
    investor: str = ""              # Chủ đầu tư
    designer: str = ""              # Đơn vị thiết kế
    year: int = 0
    locale_code: str = "default"    # chọn bộ đơn giá
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)

    # Hệ số áp dụng (TT11 cho phép tuỳ dự án)
    k_chi_phi_chung: float = 0.065        # 6.5% (công trình giao thông cấp III mặc định)
    k_thu_nhap_chiu_thue: float = 0.055   # 5.5%
    k_nha_tam: float = 0.01               # 1% (nếu có)
    vat_rate: float = 0.10                # 10%


@dataclass
class WorkItem:
    id: str
    project_id: str
    order: int                     # STT
    section: str                   # "A. Phần móng", "B. Phần thân"
    unit_price_code: str           # ref UnitPrice.code
    description_override: str = "" # user có thể sửa mô tả
    quantity: float = 0.0

    # Các giá trị snapshot lưu lại để tránh khi admin sửa đơn giá thì dự án cũ bị thay đổi
    snapshot_unit: str = ""
    snapshot_vl: float = 0.0
    snapshot_nc: float = 0.0
    snapshot_mtc: float = 0.0

    @property
    def unit_total(self) -> float:
        return self.snapshot_vl + self.snapshot_nc + self.snapshot_mtc

    @property
    def total_cost(self) -> float:
        return self.unit_total * self.quantity


# ---------- Summary ----------

@dataclass
class CostSummary:
    """Kết quả tính toán, cache lại trong DB để report nhanh."""
    project_id: str
    T: float = 0.0           # Chi phí trực tiếp = Σ quantity × unit_total
    GT: float = 0.0          # Chi phí gián tiếp = T × k_chi_phi_chung
    TL: float = 0.0          # Thu nhập chịu thuế tính trước = (T+GT) × k_thu_nhap_chiu_thue
    VAT: float = 0.0         # Thuế GTGT
    NT: float = 0.0          # Nhà tạm
    G_xd: float = 0.0        # Tổng cộng chi phí xây dựng

    computed_at: datetime = field(default_factory=datetime.now)


def compute_summary(project: EstimateProject, items: list[WorkItem]) -> CostSummary:
    """Tính toán dự toán theo công thức TT11/2021."""
    T = sum(w.total_cost for w in items)
    GT = T * project.k_chi_phi_chung
    TL = (T + GT) * project.k_thu_nhap_chiu_thue
    NT = (T + GT + TL) * project.k_nha_tam
    VAT = (T + GT + TL + NT) * project.vat_rate
    G_xd = T + GT + TL + NT + VAT
    return CostSummary(
        project_id=project.id,
        T=T, GT=GT, TL=TL, NT=NT, VAT=VAT, G_xd=G_xd,
    )


# ---------- Migrations ----------

MIGRATION_002_ESTIMATE = """
CREATE TABLE IF NOT EXISTS unit_prices (
    code         TEXT NOT NULL,
    locale       TEXT NOT NULL,
    version      INTEGER NOT NULL DEFAULT 1,
    description  TEXT NOT NULL,
    unit         TEXT NOT NULL,
    vl           REAL NOT NULL DEFAULT 0,
    nc           REAL NOT NULL DEFAULT 0,
    mtc          REAL NOT NULL DEFAULT 0,
    PRIMARY KEY (code, locale, version)
);
CREATE INDEX IF NOT EXISTS idx_up_locale ON unit_prices(locale);

CREATE TABLE IF NOT EXISTS estimate_projects (
    id                    TEXT PRIMARY KEY,
    name                  TEXT NOT NULL,
    location              TEXT DEFAULT '',
    investor              TEXT DEFAULT '',
    designer              TEXT DEFAULT '',
    year                  INTEGER DEFAULT 0,
    locale_code           TEXT DEFAULT 'default',
    k_chi_phi_chung       REAL DEFAULT 0.065,
    k_thu_nhap_chiu_thue  REAL DEFAULT 0.055,
    k_nha_tam             REAL DEFAULT 0.01,
    vat_rate              REAL DEFAULT 0.10,
    created_at            TEXT NOT NULL,
    updated_at            TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS work_items (
    id                   TEXT PRIMARY KEY,
    project_id           TEXT NOT NULL REFERENCES estimate_projects(id) ON DELETE CASCADE,
    ord                  INTEGER NOT NULL DEFAULT 0,
    section              TEXT DEFAULT '',
    unit_price_code      TEXT NOT NULL,
    description_override TEXT DEFAULT '',
    quantity             REAL NOT NULL DEFAULT 0,
    snapshot_unit        TEXT DEFAULT '',
    snapshot_vl          REAL DEFAULT 0,
    snapshot_nc          REAL DEFAULT 0,
    snapshot_mtc         REAL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_wi_project ON work_items(project_id);
"""
